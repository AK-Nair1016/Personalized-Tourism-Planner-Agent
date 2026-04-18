import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { vibeAgent } from '../agents/vibeAgent';
import { reconcilerAgent } from '../agents/reconcilerAgent';
import { calculateBudget } from '../processing/calculateBudget';
import { clusterByProximity } from '../processing/clusterByProximity';
import { ensureDiversity } from '../processing/ensureDiversity';
import { prisma } from '../lib/prisma';

type PipelineContext = {
  requestId?: string;
};

type PipelineExecutionMeta = {
  vibeFallback: boolean;
  reconcilerFallback: boolean;
  vibeRetryCount: number;
  reconcilerRetryCount: number;
  usedFallback: boolean;
  retryCount: number;
  llmSuccess: boolean;
};

const MAX_LOG_MESSAGE_LENGTH = 220;
const DEFAULT_AGENT_ATTRACTION_LIMIT = 30;
const DEFAULT_AGENT_RETRY_ATTRACTION_LIMIT = 12;

export class PipelineStageError extends Error {
  public readonly stage: string;
  public readonly requestId?: string;
  public readonly originalError: unknown;

  constructor(stage: string, originalError: unknown, requestId?: string) {
    super(`Pipeline failed at stage "${stage}"`);
    this.name = 'PipelineStageError';
    this.stage = stage;
    this.requestId = requestId;
    this.originalError = originalError;
  }
}

function truncateMessage(value: string) {
  if (value.length <= MAX_LOG_MESSAGE_LENGTH) return value;
  return `${value.slice(0, MAX_LOG_MESSAGE_LENGTH)}...`;
}

function parseProviderErrorFromMessage(message: string) {
  const matched = message.match(/^(\d{3})\s+(\{[\s\S]+\})$/);
  if (!matched) return null;

  const statusCode = Number(matched[1]);

  try {
    const payload = JSON.parse(matched[2]) as {
      error?: {
        code?: string;
        type?: string;
        message?: string;
      };
    };

    return {
      providerStatusCode: statusCode,
      providerErrorCode: payload.error?.code,
      providerErrorType: payload.error?.type,
      providerErrorMessage: payload.error?.message,
    };
  } catch {
    return null;
  }
}

function normalizeErrorList(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  return value.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return { value: String(item) };
    }

    const asRecord = item as Record<string, unknown>;
    const details: Record<string, unknown> = {};
    const stage = asRecord.stage;
    const durationMs = asRecord.durationMs;

    if (typeof stage === 'string') details.stage = stage;
    if (typeof durationMs === 'number') details.durationMs = durationMs;

    const merged = {
      ...details,
      ...normalizeError(asRecord.error),
    };

    return merged;
  });
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

type PlannerItineraryLike = {
  total_cost_estimate?: number;
  days: unknown[];
};

function isValidPlannerItinerary(value: unknown): value is PlannerItineraryLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.days);
}

function isTokenLimitError(error: unknown) {
  const baseError =
    error instanceof PipelineStageError
      ? error.originalError
      : error;

  if (!(baseError instanceof Error)) return false;

  const parsed = parseProviderErrorFromMessage(baseError.message);
  if (parsed?.providerStatusCode === 413) return true;
  if (parsed?.providerErrorCode === 'rate_limit_exceeded') return true;
  if (parsed?.providerErrorType === 'tokens') return true;

  const message = baseError.message.toLowerCase();
  return (
    message.includes('request too large') ||
    message.includes('tokens per minute') ||
    message.includes('tpm')
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    const err = error as Error & {
      code?: unknown;
      meta?: unknown;
      failures?: unknown;
    };
    const providerError = parseProviderErrorFromMessage(err.message);
    const details: Record<string, unknown> = {
      errorName: err.name,
      errorMessage: truncateMessage(
        providerError?.providerErrorMessage ?? err.message
      ),
    };

    if (providerError?.providerStatusCode !== undefined) {
      details.providerStatusCode = providerError.providerStatusCode;
    }
    if (providerError?.providerErrorCode !== undefined) {
      details.providerErrorCode = providerError.providerErrorCode;
    }
    if (providerError?.providerErrorType !== undefined) {
      details.providerErrorType = providerError.providerErrorType;
    }

    if (err.code !== undefined) details.errorCode = err.code;
    if (err.meta !== undefined) details.errorMeta = err.meta;

    const normalizedFailures = normalizeErrorList(err.failures);
    if (normalizedFailures) details.failures = normalizedFailures;

    return details;
  }

  return { errorValue: String(error) };
}

function logPipeline(
  requestId: string | undefined,
  stage: string,
  event: 'start' | 'success' | 'error',
  details: Record<string, unknown> = {}
) {
  const payload = {
    requestId: requestId ?? 'n/a',
    stage,
    event,
    ...details,
  };

  const logLine = `[pipeline] ${JSON.stringify(payload)}`;
  if (event === 'error') {
    console.error(logLine);
    return;
  }

  console.log(logLine);
}

async function runStage<T>(
  context: PipelineContext,
  stage: string,
  action: () => Promise<T>
) {
  const startedAt = Date.now();
  logPipeline(context.requestId, stage, 'start');

  try {
    const result = await action();
    logPipeline(context.requestId, stage, 'success', {
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    logPipeline(context.requestId, stage, 'error', {
      durationMs: Date.now() - startedAt,
      ...normalizeError(error),
    });

    if (error instanceof PipelineStageError) {
      throw error;
    }

    throw new PipelineStageError(stage, error, context.requestId);
  }
}

export async function runPlannerGraph(
  userProfile: UserProfile,
  context: PipelineContext = {}
) {
  const primaryLimit = parsePositiveInt(
    process.env.AGENT_ATTRACTION_LIMIT,
    20 // reduced from 30 → token safety
  );

  const retryLimit = parsePositiveInt(
    process.env.AGENT_RETRY_ATTRACTION_LIMIT,
    10
  );

  // 1. CITY
  const city = await runStage(context, 'db_find_city', async () =>
    prisma.city.findFirst({
      where: { name: userProfile.city! },
    })
  );

  if (!city) {
    throw new PipelineStageError(
      'db_find_city',
      new Error(`City ${userProfile.city} not found`),
      context.requestId
    );
  }

  // 2. ATTRACTIONS
  const attractions = await runStage(context, 'db_load_attractions', async () =>
    prisma.attraction.findMany({
      where: { cityId: city.id },
      include: { category: true },
    })
  );

  // 3. PRE-FILTER
  const filteredAttractions = await runStage(context, 'pre_filter', async () =>
    attractions.filter((a) => {
      if (userProfile.avoid?.includes(a.category.name)) return false;
      if (userProfile.mobilityNeeds && a.intensityLevel > 3) return false;
      return true;
    })
  );

  // 4. LIMIT FOR TOKEN SAFETY
  let workingAttractions = filteredAttractions.slice(0, primaryLimit);

  if (workingAttractions.length < filteredAttractions.length) {
    logPipeline(context.requestId, 'agent_input_trim', 'success', {
      totalAttractions: filteredAttractions.length,
      sentToAgents: workingAttractions.length,
    });
  }

  // 5. BUDGET (TS)
  const budgetOutput = await runStage(context, 'process_budget', async () =>
    calculateBudget(userProfile, filteredAttractions)
  );

  // 6. CLUSTERING (TS)
  const clusters = await runStage(context, 'process_clustering', async () =>
    clusterByProximity(userProfile, filteredAttractions, budgetOutput)
  );

  // 7. DIVERSITY (TS)
  const adjustedClusters = await runStage(context, 'process_diversity', async () =>
    ensureDiversity(userProfile, clusters, filteredAttractions)
  );

  // 8. VIBE AGENT (LLM)
  let vibeOutput: any[] = [];
  let tokensUsed = 0;
  const executionMeta: PipelineExecutionMeta = {
    vibeFallback: false,
    reconcilerFallback: false,
    vibeRetryCount: 0,
    reconcilerRetryCount: 0,
    usedFallback: false,
    retryCount: 0,
    llmSuccess: true,
  };

  try {
    const vibeResult = await runStage(context, 'agent_vibe', async () =>
      vibeAgent(userProfile, workingAttractions)
    );
    vibeOutput = vibeResult.vibeOutput;
    tokensUsed += vibeResult.tokensUsed;
    executionMeta.vibeFallback = vibeResult.meta.usedFallback;
    executionMeta.vibeRetryCount += vibeResult.meta.retryCount;
    logPipeline(context.requestId, 'agent_vibe_outcome', 'success', {
      usedFallback: vibeResult.meta.usedFallback,
      retryCount: vibeResult.meta.retryCount,
      llmSuccess: vibeResult.meta.llmSuccess,
    });
  } catch (error) {
    if (!isTokenLimitError(error)) throw error;

    workingAttractions = filteredAttractions.slice(0, retryLimit);

    logPipeline(context.requestId, 'agent_retry_plan', 'success', {
      retryForStage: 'agent_vibe',
      reason: 'token_limit',
      sentToAgents: workingAttractions.length,
    });

    const vibeRetryResult = await runStage(context, 'agent_vibe_retry', async () =>
      vibeAgent(userProfile, workingAttractions)
    );
    vibeOutput = vibeRetryResult.vibeOutput;
    tokensUsed += vibeRetryResult.tokensUsed;
    executionMeta.vibeFallback = vibeRetryResult.meta.usedFallback;
    executionMeta.vibeRetryCount += vibeRetryResult.meta.retryCount;
    logPipeline(context.requestId, 'agent_vibe_outcome', 'success', {
      usedFallback: vibeRetryResult.meta.usedFallback,
      retryCount: vibeRetryResult.meta.retryCount,
      llmSuccess: vibeRetryResult.meta.llmSuccess,
      sourceStage: 'agent_vibe_retry',
    });
  }

  // 9. RECONCILER (LLM)
  let itinerary: any;

  try {
    const reconcilerResult = await runStage(context, 'agent_reconciler', async () =>
      reconcilerAgent(
        userProfile,
        vibeOutput,
        budgetOutput,
        clusters,
        adjustedClusters,
        filteredAttractions
      )
    );
    itinerary = reconcilerResult.itinerary;
    tokensUsed += reconcilerResult.tokensUsed;
    executionMeta.reconcilerFallback = reconcilerResult.meta.usedFallback;
    executionMeta.reconcilerRetryCount += reconcilerResult.meta.retryCount;
    logPipeline(context.requestId, 'agent_reconciler_outcome', 'success', {
      usedFallback: reconcilerResult.meta.usedFallback,
      retryCount: reconcilerResult.meta.retryCount,
      llmSuccess: reconcilerResult.meta.llmSuccess,
    });
  } catch (error) {
    console.error('[reconciler fallback triggered]');

    const fallbackClusters = Array.isArray((adjustedClusters as any)?.adjustedClusters)
      ? (adjustedClusters as any).adjustedClusters
      : [];

    itinerary = {
      days: fallbackClusters.map((day: any) => ({
        day: day.day,
        slots: day.slots.map((slot: any) => ({
          ...slot,
          vibe_note: 'auto-generated fallback',
        })),
      })),
      total_cost_estimate: (budgetOutput as any)?.totalBudget || 0,
    };
    executionMeta.reconcilerFallback = true;
    logPipeline(context.requestId, 'agent_reconciler_outcome', 'success', {
      usedFallback: true,
      retryCount: executionMeta.reconcilerRetryCount,
      llmSuccess: false,
      sourceStage: 'planner_graph_fallback',
    });
  }

  if (!isValidPlannerItinerary(itinerary)) {
    throw new PipelineStageError(
      'agent_reconciler',
      new Error('Invalid itinerary format'),
      context.requestId
    );
  }

  // 10. STORE
  await runStage(context, 'db_store_itinerary', async () =>
    prisma.itinerary.create({
      data: {
        cityId: city.id,
        userProfileJson: userProfile as any,
        itineraryJson: itinerary as any,
        totalCostEstimate: itinerary.total_cost_estimate || 0,
      },
    })
  );

  executionMeta.usedFallback =
    executionMeta.vibeFallback || executionMeta.reconcilerFallback;
  executionMeta.retryCount =
    executionMeta.vibeRetryCount + executionMeta.reconcilerRetryCount;
  executionMeta.llmSuccess = !executionMeta.usedFallback;

  return {
    itinerary,
    tokensUsed,
    meta: executionMeta,
  };
}
