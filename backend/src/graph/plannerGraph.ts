import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { vibeAgent } from '../agents/vibeAgent';
import { reconcilerAgent } from '../agents/reconcilerAgent';
import { calculateBudget } from '../processing/calculateBudget';
import { clusterByProximity } from '../processing/clusterByProximity';
import { ensureDiversity } from '../processing/ensureDiversity';
import { prisma } from '../lib/prisma';
import { getEnhancedAttractions } from "../services/attractionsEnhanced";
import {
  normalizeMergedItinerary,
  PlannerDayLike,
  PlannerItineraryRecord,
  splitItineraryForReplan,
} from './replanUtils';
import {
  attractionMatchesAvoidTerms,
  buildDisruptionAwareProfile,
  deriveDisruptionPolicy,
  filterAndRankAttractionsForDisruption,
  getPreservedAttractionExclusions,
  getDisruptedSlotContext,
  isAttractionAllowedByDisruptionPolicy,
} from './replanDisruption';

type PipelineContext = {
  requestId?: string;

  // Replan support context
  existingItinerary?: any;

  disruption?: {
    day: number;
    slot: 'morning' | 'afternoon' | 'evening';
    description: string;
  };
};

type PipelineExecutionMeta = {
  vibeFallback: boolean;
  reconcilerFallback: boolean;
  vibeRetryCount: number;
  reconcilerRetryCount: number;
  reconcilerCorrectedVibeNotes: number;
  usedFallback: boolean;
  retryCount: number;
  llmSuccess: boolean;
};

type SlotName = 'morning' | 'afternoon' | 'evening';
const REQUIRED_SLOTS: SlotName[] = ['morning', 'afternoon', 'evening'];

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

type FallbackSlot = {
  slot: 'morning' | 'afternoon' | 'evening';
  attraction_id: string;
  attraction_name: string;
  category: string;
  estimated_cost: number;
  duration_minutes: number;
  coordinates: { lat: number; lng: number };
  vibe_note: string;
};

function isValidPlannerItinerary(value: unknown): value is PlannerItineraryLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.days);
}

function normalizeSlotName(value: unknown): SlotName | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening') {
    return normalized;
  }
  return null;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toLowerString(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSafePlaceholderSlot(day: number, slot: SlotName) {
  const attractionName = `Fallback Landmark Day ${day}`;
  return {
    slot,
    attraction_id: `safe-${day}-${slot}`,
    attraction_name: attractionName,
    category: 'landmark',
    estimated_cost: 0,
    duration_minutes: 60,
    coordinates: { lat: 0, lng: 0 },
    vibe_note: `${attractionName} is a great stop for this slot.`,
  };
}

function sanitizeVibeNoteForSlot(
  slot: any,
  daySlots: any[],
  fixes: string[]
) {
  const attractionName = typeof slot?.attraction_name === 'string' ? slot.attraction_name : '';
  const rawNote = typeof slot?.vibe_note === 'string' ? slot.vibe_note.trim() : '';
  const noteLower = rawNote.toLowerCase();
  const attractionLower = attractionName.toLowerCase();

  const includesOwnAttraction = attractionLower.length > 0 && noteLower.includes(attractionLower);
  const referencesOtherAttraction = daySlots.some((otherSlot: any) => {
    if (otherSlot === slot) return false;
    const otherName =
      typeof otherSlot?.attraction_name === 'string' ? otherSlot.attraction_name.trim().toLowerCase() : '';
    if (!otherName || otherName === attractionLower) return false;
    return noteLower.includes(otherName);
  });

  if (!includesOwnAttraction || referencesOtherAttraction) {
    slot.vibe_note = `${attractionName} is a great stop for this slot.`;
    fixes.push('vibe_note_sanitized');
  }
}

function isDisallowedCategory(category: unknown, disallowedCategories: string[]) {
  const normalized = toLowerString(category);
  return normalized.length > 0 && disallowedCategories.includes(normalized);
}

function buildStrictReplanItinerary(
  existingItinerary: PlannerItineraryRecord,
  candidateItinerary: PlannerItineraryRecord,
  disruption: { day: number; slot: SlotName },
  disallowedCategories: string[]
) {
  const fixes: string[] = [];
  const reference = cloneRecord(existingItinerary ?? {});
  const referenceDays = Array.isArray(reference.days) ? reference.days : [];
  const candidateDays = Array.isArray(candidateItinerary?.days) ? candidateItinerary.days : [];
  const targetDayIndex = referenceDays.findIndex((day) => day?.day === disruption.day);

  if (targetDayIndex < 0) {
    return {
      itinerary: candidateItinerary,
      fixes: ['missing_disrupted_day_in_reference'],
    };
  }

  const targetDay = cloneRecord(referenceDays[targetDayIndex] ?? {});
  const targetDaySlots: any[] = Array.isArray(targetDay.slots) ? [...targetDay.slots] : [];
  const originalSlot: any = targetDaySlots.find(
    (slot) => normalizeSlotName((slot as Record<string, unknown>)?.slot) === disruption.slot
  );
  const candidateDay = candidateDays.find((day) => day?.day === disruption.day);
  const candidateSlots: any[] = Array.isArray(candidateDay?.slots) ? candidateDay.slots : [];
  const incomingSlotRaw =
    candidateSlots.find((slot) => normalizeSlotName((slot as Record<string, unknown>)?.slot) === disruption.slot) ??
    candidateSlots[0];

  let replacement: any = incomingSlotRaw
    ? { ...incomingSlotRaw, slot: disruption.slot }
    : originalSlot
      ? { ...originalSlot, slot: disruption.slot }
      : buildSafePlaceholderSlot(disruption.day, disruption.slot);

  if (!incomingSlotRaw) fixes.push('missing_replanned_slot_fallback_used');
  if (!originalSlot) fixes.push('missing_original_slot_in_reference');

  if (!replacement.attraction_name) {
    replacement = {
      ...replacement,
      attraction_name: originalSlot?.attraction_name ?? buildSafePlaceholderSlot(disruption.day, disruption.slot).attraction_name,
    };
    fixes.push('missing_attraction_name_fixed');
  }

  if (!replacement.attraction_id) {
    replacement = {
      ...replacement,
      attraction_id: originalSlot?.attraction_id ?? buildSafePlaceholderSlot(disruption.day, disruption.slot).attraction_id,
    };
    fixes.push('missing_attraction_id_fixed');
  }

  if (isDisallowedCategory(replacement.category, disallowedCategories)) {
    if (originalSlot && !isDisallowedCategory(originalSlot.category, disallowedCategories)) {
      replacement = { ...originalSlot, slot: disruption.slot };
      fixes.push('disallowed_category_reverted_to_original');
    } else {
      replacement = { ...replacement, category: 'landmark' };
      fixes.push('disallowed_category_forced_landmark');
    }
  }

  if (disruption.slot === 'evening' && toLowerString(replacement.category) === 'museum') {
    if (originalSlot && toLowerString(originalSlot.category) !== 'museum') {
      replacement = { ...originalSlot, slot: disruption.slot };
      fixes.push('evening_museum_reverted_to_original');
    } else {
      replacement = { ...replacement, category: 'landmark' };
      fixes.push('evening_museum_forced_landmark');
    }
  }

  const slotsByName = new Map<SlotName, any>();
  for (const slotName of REQUIRED_SLOTS) {
    const fromReference = targetDaySlots.find(
      (slot) => normalizeSlotName((slot as Record<string, unknown>)?.slot) === slotName
    );
    slotsByName.set(
      slotName,
      fromReference ? { ...fromReference, slot: slotName } : buildSafePlaceholderSlot(disruption.day, slotName)
    );
  }
  slotsByName.set(disruption.slot, { ...replacement, slot: disruption.slot });

  const normalizedSlots = REQUIRED_SLOTS.map((slotName) => {
    const slot = slotsByName.get(slotName) ?? buildSafePlaceholderSlot(disruption.day, slotName);
    return {
      ...slot,
      slot: slotName,
      estimated_cost: toFiniteNumber(slot.estimated_cost, 0),
      duration_minutes: Math.max(15, Math.round(toFiniteNumber(slot.duration_minutes, 90))),
      coordinates:
        typeof slot.coordinates === 'object' && slot.coordinates !== null
          ? slot.coordinates
          : { lat: 0, lng: 0 },
      category: typeof slot.category === 'string' && slot.category.trim() ? slot.category : 'landmark',
      attraction_name:
        typeof slot.attraction_name === 'string' && slot.attraction_name.trim()
          ? slot.attraction_name
          : buildSafePlaceholderSlot(disruption.day, slotName).attraction_name,
      attraction_id:
        typeof slot.attraction_id === 'string' && slot.attraction_id.trim()
          ? slot.attraction_id
          : buildSafePlaceholderSlot(disruption.day, slotName).attraction_id,
    };
  });

  const seenIds = new Set<string>();
  for (let i = 0; i < normalizedSlots.length; i += 1) {
    const slot = normalizedSlots[i];
    const id = toLowerString(slot.attraction_id);
    if (!id) continue;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      continue;
    }
    const replacementSlot = buildSafePlaceholderSlot(disruption.day, slot.slot as SlotName);
    normalizedSlots[i] = {
      ...replacementSlot,
      attraction_id: `${replacementSlot.attraction_id}-${i + 1}`,
    };
    fixes.push('duplicate_attraction_id_fixed');
    seenIds.add(toLowerString(normalizedSlots[i].attraction_id));
  }

  const disruptedSlot = normalizedSlots.find((slot) => slot.slot === disruption.slot);
  if (disruptedSlot && isDisallowedCategory(disruptedSlot.category, disallowedCategories)) {
    const fallback: any = originalSlot && !isDisallowedCategory(originalSlot.category, disallowedCategories)
      ? { ...originalSlot, slot: disruption.slot }
      : { ...buildSafePlaceholderSlot(disruption.day, disruption.slot), category: 'landmark' };
    const idx = normalizedSlots.findIndex((slot) => slot.slot === disruption.slot);
    normalizedSlots[idx] = {
      ...fallback,
      slot: disruption.slot,
      estimated_cost: toFiniteNumber(fallback.estimated_cost, 0),
      duration_minutes: Math.max(15, Math.round(toFiniteNumber(fallback.duration_minutes, 90))),
      coordinates:
        typeof fallback.coordinates === 'object' && fallback.coordinates !== null
          ? fallback.coordinates
          : { lat: 0, lng: 0 },
      vibe_note:
        typeof fallback.attraction_name === 'string'
          ? `${fallback.attraction_name} is a great stop for this slot.`
          : `${normalizedSlots[idx].attraction_name} is a great stop for this slot.`,
    };
    fixes.push('disallowed_category_post_validation_fixed');
  }

  for (const slot of normalizedSlots) {
    sanitizeVibeNoteForSlot(slot, normalizedSlots, fixes);
  }

  const dayCostEstimate = normalizedSlots.reduce(
    (sum, slot) => sum + toFiniteNumber(slot.estimated_cost, 0),
    0
  );

  const strictDays = referenceDays.map((day, index) => {
    if (index !== targetDayIndex) return cloneRecord(day);
    return {
      ...cloneRecord(day),
      day: disruption.day,
      slots: normalizedSlots,
      day_cost_estimate: dayCostEstimate,
    };
  });

  const totalCost = strictDays.reduce(
    (sum, day) => sum + toFiniteNumber((day as Record<string, unknown>)?.day_cost_estimate, 0),
    0
  );

  return {
    itinerary: {
      ...cloneRecord(candidateItinerary ?? {}),
      ...reference,
      days: strictDays,
      total_cost_estimate: totalCost,
    },
    fixes,
  };
}

function buildFallbackSlotFromAttraction(
  attraction: any,
  slot: 'morning' | 'afternoon' | 'evening'
): FallbackSlot | null {
  if (!attraction?.id) return null;

  return {
    slot,
    attraction_id: attraction.id,
    attraction_name: attraction.name ?? attraction.id,
    category: attraction?.category?.name ?? attraction?.category ?? 'general',
    estimated_cost:
      typeof attraction?.estimated_cost === 'number'
        ? attraction.estimated_cost
        : typeof attraction?.avgCost === 'number'
          ? attraction.avgCost
          : 0,
    duration_minutes:
      typeof attraction?.avgDurationMinutes === 'number'
        ? attraction.avgDurationMinutes
        : typeof attraction?.duration_minutes === 'number'
          ? attraction.duration_minutes
          : 90,
    coordinates: {
      lat: typeof attraction?.latitude === 'number' ? attraction.latitude : 0,
      lng: typeof attraction?.longitude === 'number' ? attraction.longitude : 0,
    },
    vibe_note: 'auto-generated fallback',
  };
}

function buildPlannerGraphFallbackItinerary(
  fallbackClusters: any[],
  attractions: any[],
  budgetOutput: any,
  disruption?: {
    day: number;
    slot: 'morning' | 'afternoon' | 'evening';
  }
) {
  const attractionById = new Map(
    attractions
      .filter((attraction) => attraction?.id)
      .map((attraction) => [attraction.id, attraction])
  );

  const days = fallbackClusters
    .map((day: any) => {
      const slots = Array.isArray(day?.slots)
        ? day.slots
            .map((slot: any) => {
              const attractionId = slot?.attractionId ?? slot?.attraction_id ?? slot?.id;
              const attraction = attractionById.get(attractionId);
              const slotName = slot?.slot;
              if (
                !attraction ||
                (slotName !== 'morning' && slotName !== 'afternoon' && slotName !== 'evening')
              ) {
                return null;
              }

              return buildFallbackSlotFromAttraction(attraction, slotName);
            })
            .filter(Boolean)
        : [];

      return {
        day: typeof day?.day === 'number' ? day.day : 1,
        date_label: `Day ${typeof day?.day === 'number' ? day.day : 1}`,
        cluster_area: day?.clusterCenter ?? day?.cluster_center ?? day?.cluster_area ?? 'City Center',
        slots,
        day_cost_estimate: slots.reduce(
          (sum: number, slot: any) => sum + (typeof slot?.estimated_cost === 'number' ? slot.estimated_cost : 0),
          0
        ),
      };
    })
    .filter((day) => day.slots.length > 0);

  if (disruption && !days.some((day) => day.day === disruption.day)) {
    const fallbackAttraction = attractions[0];
    const fallbackSlot = buildFallbackSlotFromAttraction(fallbackAttraction, disruption.slot);
    if (fallbackSlot) {
      days.push({
        day: disruption.day,
        date_label: `Day ${disruption.day}`,
        cluster_area: fallbackAttraction?.name ?? 'City Center',
        slots: [fallbackSlot],
        day_cost_estimate: fallbackSlot.estimated_cost,
      });
    }
  }

  return {
    days,
    total_cost_estimate:
      days.reduce((sum, day) => sum + day.day_cost_estimate, 0) ||
      (budgetOutput as any)?.totalBudget ||
      0,
  };
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

  // Section: detect replan mode
  const isReplan = !!context.disruption && !!context.existingItinerary;
  const disruption = context.disruption;
  const existingItinerary = context.existingItinerary;
  const disruptedSlotContext = isReplan
    ? getDisruptedSlotContext(existingItinerary as PlannerItineraryRecord, disruption)
    : undefined;
  const disruptionPolicy = isReplan
    ? deriveDisruptionPolicy(disruption, disruptedSlotContext)
    : undefined;
  const preservedAttractionExclusions = isReplan
    ? getPreservedAttractionExclusions(existingItinerary as PlannerItineraryRecord, disruption)
    : undefined;
  const effectiveUserProfile = isReplan
    ? buildDisruptionAwareProfile(userProfile, disruptionPolicy)
    : userProfile;

  const primaryLimit = parsePositiveInt(
    process.env.AGENT_ATTRACTION_LIMIT,
    20
  );
  const replanCandidateLimit = 6;

  const retryLimit = parsePositiveInt(
    process.env.AGENT_RETRY_ATTRACTION_LIMIT,
    10
  );

  // 1. CITY
  const city = await runStage(context, 'db_find_city', async () =>
    prisma.city.findFirst({
      where: { name: effectiveUserProfile.city! },
    })
  );

  if (!city) {
    throw new PipelineStageError(
      'db_find_city',
      new Error(`City ${effectiveUserProfile.city} not found`),
      context.requestId
    );
  }

  // 2. ATTRACTIONS
  console.log("[planner] calling getEnhancedAttractions", {
    cityId: city.id,
    cityName: city.name
  });

  const attractions = await getEnhancedAttractions(
    city.id,
    city.name,
    "top tourist attractions"
  );

  console.log("[planner] attractions received", {
    count: attractions.length
  });

  // 3. PRE-FILTER
  const filteredAttractions = await runStage(context, 'pre_filter', async () =>
    filterAndRankAttractionsForDisruption(
      attractions.filter((a) => {
      if (attractionMatchesAvoidTerms(a, effectiveUserProfile.avoid ?? [])) return false;
      if (!isAttractionAllowedByDisruptionPolicy(a, disruptionPolicy)) return false;
      if (effectiveUserProfile.mobilityNeeds && (a as any).intensityLevel > 3) return false;
      return true;
      }),
      isReplan ? disruptionPolicy : undefined,
      preservedAttractionExclusions
    )
  );

  if (isReplan && disruptionPolicy) {
    logPipeline(context.requestId, 'replan_constraints', 'success', {
      disruptedSlotContext,
      derivedAvoidTerms: disruptionPolicy.avoidTerms,
      derivedAvoidTags: disruptionPolicy.avoidTags,
      disallowedCategories: disruptionPolicy.disallowedCategories,
      preferredCategories: disruptionPolicy.preferredCategories,
      allowedIndoorOutdoor: disruptionPolicy.allowedIndoorOutdoor,
      requireAccessible: disruptionPolicy.requireAccessible,
      preferNearby: disruptionPolicy.preferNearby,
      rationale: disruptionPolicy.rationale,
      excludedAttractionIds: preservedAttractionExclusions?.attractionIds ?? [],
      excludedAttractionNames: preservedAttractionExclusions?.attractionNames ?? [],
      filteredAttractions: attractions.length - filteredAttractions.length,
    });
  }

  // 4. LIMIT FOR TOKEN SAFETY
  let workingAttractions = filteredAttractions.slice(
    0,
    isReplan ? Math.min(primaryLimit, replanCandidateLimit) : primaryLimit
  );

  if (workingAttractions.length < filteredAttractions.length) {
    logPipeline(context.requestId, 'agent_input_trim', 'success', {
      totalAttractions: filteredAttractions.length,
      sentToAgents: workingAttractions.length,
    });
  }

  // 5. BUDGET (TS)
  const budgetOutput = await runStage(context, 'process_budget', async () =>
    calculateBudget(effectiveUserProfile, filteredAttractions)
  );

  // 6. CLUSTERING (TS)
  let clusters = await runStage(context, 'process_clustering', async () =>
    clusterByProximity(effectiveUserProfile, filteredAttractions, budgetOutput)
  );

  // 7. DIVERSITY (TS)
  let adjustedClusters = await runStage(context, 'process_diversity', async () =>
    ensureDiversity(effectiveUserProfile, clusters, filteredAttractions)
  );

  let preservedDays: PlannerDayLike[] = [];
  let replanStartDay = 1;
  let toReplan: PlannerDayLike[] = [];

  if (isReplan) {
    const split = splitItineraryForReplan(existingItinerary as PlannerItineraryRecord, disruption!);
    preservedDays = split.preservedDays;
    toReplan = split.toReplan;
    replanStartDay = split.replanStartDay;
    const allowedCandidateIds = new Set(
      workingAttractions
        .map((attraction: any) => attraction?.id ?? attraction?.attraction_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    );

    clusters = clusters
      .filter((cluster) => cluster.day === disruption!.day)
      .map((cluster) => ({
        ...cluster,
        slots: cluster.slots.filter(
          (slot) =>
            slot.slot === disruption!.slot &&
            allowedCandidateIds.has(
              String((slot as any).attractionId ?? (slot as any).attraction_id ?? (slot as any).id)
            )
        ),
      }))
      .filter((cluster) => cluster.slots.length > 0);
    adjustedClusters = {
      ...adjustedClusters,
      adjustedClusters: adjustedClusters.adjustedClusters
        .filter((cluster) => cluster.day === disruption!.day)
        .map((cluster) => ({
          ...cluster,
          slots: cluster.slots.filter(
            (slot: any) =>
              slot.slot === disruption!.slot &&
              allowedCandidateIds.has(String(slot?.attractionId ?? slot?.attraction_id ?? slot?.id))
          ),
        }))
        .filter((cluster) => cluster.slots.length > 0),
      flaggedDays: adjustedClusters.flaggedDays.filter((day) => day.day === disruption!.day),
    };

    logPipeline(context.requestId, 'replan_split', 'success', {
      preservedDayCount: preservedDays.length,
      replanDayCount: toReplan.length,
      replanStartDay,
      targetSlot: disruption!.slot,
    });
  }

  // 8. VIBE AGENT (LLM)
  let vibeOutput: any[] = [];
  let tokensUsed = 0;

  const executionMeta: PipelineExecutionMeta = {
    vibeFallback: false,
    reconcilerFallback: false,
    vibeRetryCount: 0,
    reconcilerRetryCount: 0,
    reconcilerCorrectedVibeNotes: 0,
    usedFallback: false,
    retryCount: 0,
    llmSuccess: true,
  };

  if (isReplan) {
    vibeOutput = workingAttractions
      .map((attraction: any) => {
        const attractionId = attraction?.id ?? attraction?.attraction_id;
        if (typeof attractionId !== 'string' || attractionId.trim().length === 0) return null;
        return {
          attraction_id: attractionId,
          vibe_fit_score: 1,
          reason: 'replan_candidate',
        };
      })
      .filter(Boolean) as any[];
    logPipeline(context.requestId, 'agent_vibe_skipped', 'success', {
      reason: 'replan_mode_single_llm',
      candidateCount: vibeOutput.length,
    });
  } else {
    try {
      const vibeResult = await runStage(context, 'agent_vibe', async () =>
        vibeAgent(effectiveUserProfile, workingAttractions)
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
        vibeAgent(effectiveUserProfile, workingAttractions)
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
  }

  // 9. RECONCILER (LLM)
  let itinerary: any;

  try {
    const reconcilerResult = await runStage(context, 'agent_reconciler', async () =>
      reconcilerAgent(
        effectiveUserProfile,
        vibeOutput,
        budgetOutput,
        clusters,
        adjustedClusters,
        isReplan ? workingAttractions : filteredAttractions,
        isReplan
          ? {
              existingItinerary,
              disruption,
              preservedDays,
              replanStartDay,
              disruptionPolicy,
            }
          : undefined
      )
    );
    itinerary = reconcilerResult.itinerary;
    tokensUsed += reconcilerResult.tokensUsed;
    executionMeta.reconcilerFallback = reconcilerResult.meta.usedFallback;
    executionMeta.reconcilerRetryCount += reconcilerResult.meta.retryCount;
    const correctedVibeNotes = reconcilerResult.meta.correctedVibeNotes ?? 0;
    executionMeta.reconcilerCorrectedVibeNotes += correctedVibeNotes;
    logPipeline(context.requestId, 'agent_reconciler_outcome', 'success', {
      usedFallback: reconcilerResult.meta.usedFallback,
      retryCount: reconcilerResult.meta.retryCount,
      llmSuccess: reconcilerResult.meta.llmSuccess,
      correctedVibeNotes,
    });
  } catch (error) {
    console.error('[reconciler fallback triggered]');

    const fallbackClusters = Array.isArray((adjustedClusters as any)?.adjustedClusters)
      ? (adjustedClusters as any).adjustedClusters
      : [];

    itinerary = buildPlannerGraphFallbackItinerary(
      fallbackClusters,
      filteredAttractions,
      budgetOutput,
      disruption
    );
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

  if (isReplan) {
    const strictReplanResult = buildStrictReplanItinerary(
      existingItinerary as PlannerItineraryRecord,
      itinerary as PlannerItineraryRecord,
      disruption as { day: number; slot: SlotName },
      disruptionPolicy?.disallowedCategories ?? []
    );
    itinerary = strictReplanResult.itinerary;
    console.log(
      `[replan] validation_applied ${JSON.stringify({
        requestId: context.requestId ?? 'n/a',
        day: disruption?.day,
        slot: disruption?.slot,
      })}`
    );
    console.log(
      `[replan] fixes ${JSON.stringify({
        requestId: context.requestId ?? 'n/a',
        fixes: strictReplanResult.fixes,
      })}`
    );
  } else {
    itinerary = normalizeMergedItinerary(itinerary as PlannerItineraryRecord);
  }

  // 10. STORE
  let storedItineraryId: string | undefined;

  if (!isReplan) {
    const storedItinerary = await runStage(context, 'db_store_itinerary', async () =>
      prisma.itinerary.create({
        data: {
          cityId: city.id,
          userProfileJson: userProfile as any,
          itineraryJson: itinerary as any,
          totalCostEstimate: itinerary.total_cost_estimate || 0,
        },
      })
    );

    storedItineraryId = storedItinerary.id;

    logPipeline(context.requestId, 'db_store_itinerary_id', 'success', {
      itineraryId: storedItinerary.id,
    });
  }

  executionMeta.usedFallback =
    executionMeta.vibeFallback || executionMeta.reconcilerFallback;
  executionMeta.retryCount =
    executionMeta.vibeRetryCount + executionMeta.reconcilerRetryCount;
  executionMeta.llmSuccess = !executionMeta.usedFallback;

  return {
    itinerary,
    itineraryId: storedItineraryId,
    tokensUsed,
    meta: executionMeta,
    replanContext: isReplan
      ? {
          disruption,
          disruptedSlot: disruptedSlotContext,
          policy: disruptionPolicy,
        }
      : undefined,
  };
}


