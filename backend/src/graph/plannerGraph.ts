import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { vibeAgent } from '../agents/vibeAgent';
import { budgetAgent } from '../agents/budgetAgent';
import { logisticsAgent } from '../agents/logisticsAgent';
import { diversityAgent } from '../agents/diversityAgent';
import { reconcilerAgent } from '../agents/reconcilerAgent';
import { prisma } from '../lib/prisma';

type PipelineContext = {
  requestId?: string;
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
    DEFAULT_AGENT_ATTRACTION_LIMIT
  );
  const retryLimit = parsePositiveInt(
    process.env.AGENT_RETRY_ATTRACTION_LIMIT,
    DEFAULT_AGENT_RETRY_ATTRACTION_LIMIT
  );

  const city = await runStage(context, 'db_find_city', async () =>
    prisma.city.findFirst({
      where: { name: userProfile.city! },
    })
  );

  if (!city) {
    const notFoundError = new Error(`City ${userProfile.city} not found in database`);
    throw new PipelineStageError('db_find_city', notFoundError, context.requestId);
  }

  const attractions = await runStage(context, 'db_load_attractions', async () =>
    prisma.attraction.findMany({
      where: { cityId: city.id },
      include: { category: true },
    })
  );

  let workingAttractions = attractions.slice(0, primaryLimit);
  if (workingAttractions.length < attractions.length) {
    logPipeline(context.requestId, 'agent_input_trim', 'success', {
      totalAttractions: attractions.length,
      sentToAgents: workingAttractions.length,
      reason: 'token_safety',
    });
  }

  let vibeOutput: any[] = [];
  try {
    vibeOutput = await runStage(context, 'agent_vibe', async () =>
      vibeAgent(userProfile, workingAttractions)
    );
  } catch (error) {
    if (!isTokenLimitError(error)) throw error;

    workingAttractions = attractions.slice(0, retryLimit);
    logPipeline(context.requestId, 'agent_retry_plan', 'success', {
      retryForStage: 'agent_vibe',
      reason: 'token_limit',
      sentToAgents: workingAttractions.length,
    });

    vibeOutput = await runStage(context, 'agent_vibe_retry', async () =>
      vibeAgent(userProfile, workingAttractions)
    );
  }

  const budgetOutput = await runStage(context, 'agent_budget', async () =>
    budgetAgent(userProfile, vibeOutput)
  );

  let logisticsOutput: any[] = [];
  try {
    logisticsOutput = await runStage(context, 'agent_logistics', async () =>
      logisticsAgent(userProfile, vibeOutput, workingAttractions)
    );
  } catch (error) {
    if (!isTokenLimitError(error)) throw error;

    const retryAttractions = attractions.slice(0, retryLimit);
    if (retryAttractions.length !== workingAttractions.length) {
      workingAttractions = retryAttractions;
      logPipeline(context.requestId, 'agent_retry_plan', 'success', {
        retryForStage: 'agent_logistics',
        reason: 'token_limit',
        sentToAgents: workingAttractions.length,
      });
    }

    logisticsOutput = await runStage(context, 'agent_logistics_retry', async () =>
      logisticsAgent(userProfile, vibeOutput, workingAttractions)
    );
  }

  const diversityOutput = await runStage(context, 'agent_diversity', async () =>
    diversityAgent(userProfile, logisticsOutput, workingAttractions)
  );

  const itinerary = await runStage(context, 'agent_reconciler', async () =>
    reconcilerAgent(
      userProfile,
      vibeOutput,
      budgetOutput,
      logisticsOutput,
      diversityOutput,
      workingAttractions
    )
  );

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

  return itinerary;
}
