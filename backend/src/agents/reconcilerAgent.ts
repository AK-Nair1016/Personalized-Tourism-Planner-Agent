import groq, { GROQ_MODEL } from '../lib/groq';
import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { callWithRetry } from '../utils/retry';
import {
  compactUserProfileForPrompt,
} from './promptData';

type AnyRecord = Record<string, unknown>;
type SlotName = 'morning' | 'afternoon' | 'evening';

type ReconcilerSlot = {
  slot: SlotName;
  attraction_id: string;
  attraction_name: string;
  category: string;
  estimated_cost: number;
  duration_minutes: number;
  coordinates: { lat: number; lng: number };
  vibe_note: string;
};

type ReconcilerDay = {
  day: number;
  date_label: string;
  cluster_area: string;
  slots: ReconcilerSlot[];
  day_cost_estimate: number;
};

type ReconcilerItinerary = {
  city: string;
  total_cost_estimate: number;
  currency: string;
  days: ReconcilerDay[];
};

type AgentExecutionMeta = {
  usedFallback: boolean;
  retryCount: number;
  llmSuccess: boolean;
  correctedVibeNotes: number;
};

export type ReconcilerAgentResult = {
  itinerary: ReconcilerItinerary;
  tokensUsed: number;
  meta: AgentExecutionMeta;
};

type AttractionSnapshot = {
  id: string;
  name: string;
  category: string;
  avgCost: number;
  durationMinutes: number;
  coordinates: { lat: number; lng: number };
};

const SLOT_ORDER: SlotName[] = ['morning', 'afternoon', 'evening'];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  beach: ['beach', 'coast', 'shore', 'sand', 'sea', 'seaside', 'waterfront', 'waves'],
  entertainment: ['entertainment', 'show', 'theatre', 'theater', 'nightlife', 'casino', 'arcade', 'mall'],
  food: ['food', 'restaurant', 'cafe', 'cuisine', 'culinary', 'dining', 'seafood', 'tasting'],
  landmark: [
    'landmark',
    'heritage',
    'historic',
    'history',
    'fort',
    'palace',
    'gateway',
    'monument',
    'architecture',
    'quarter',
    'cathedral',
    'church',
    'basilica',
    'chapel',
    'temple',
    'promenade',
  ],
  market: ['market', 'bazaar', 'flea', 'shopping', 'stalls', 'vendors', 'crafts', 'souvenir'],
  museum: ['museum', 'gallery', 'exhibit', 'exhibition', 'art', 'archive', 'collection', 'heritage'],
  nature: [
    'nature',
    'waterfall',
    'falls',
    'dam',
    'lake',
    'river',
    'forest',
    'wildlife',
    'garden',
    'park',
    'viewpoint',
    'trail',
    'hill',
    'spice',
  ],
  temple: ['temple', 'shrine', 'church', 'cathedral', 'mosque', 'chapel', 'basilica'],
  viewpoint: ['viewpoint', 'view', 'lookout', 'hill', 'cliff', 'scenic', 'panorama', 'sunset'],
};

const ATTRACTION_TOKEN_STOP_WORDS = new Set([
  'and',
  'the',
  'with',
  'walk',
  'tour',
  'goa',
  'old',
  'new',
  'of',
]);

function extractTokensUsed(response: any) {
  const usage = response?.usage;
  const total =
    usage?.total_tokens ??
    usage?.totalTokens ??
    usage?.total ??
    0;

  return Number.isFinite(total) ? Number(total) : 0;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeSlotName(value: unknown, index: number): SlotName {
  if (value === 'morning' || value === 'afternoon' || value === 'evening') return value;
  return SLOT_ORDER[index % SLOT_ORDER.length];
}

function safeString(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isLabelLikeVibeNote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/[.!?]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= 4;
}

function normalizeForMatching(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function getAttractionNameTokens(attractionName: string) {
  return normalizeForMatching(attractionName)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !ATTRACTION_TOKEN_STOP_WORDS.has(token));
}

function getCategoryKeywords(category: string) {
  const normalizedCategory = normalizeForMatching(category).trim();
  return CATEGORY_KEYWORDS[normalizedCategory] ?? [normalizedCategory].filter(Boolean);
}

export function vibeNoteMatchesCategory(slot: {
  attraction_name: string;
  category: string;
  vibe_note: string;
}) {
  const note = normalizeForMatching(slot.vibe_note);
  const attractionTokens = getAttractionNameTokens(slot.attraction_name);
  const categoryKeywords = getCategoryKeywords(slot.category);
  const mentionedAttraction = attractionTokens.some((token) => note.includes(token));
  const mentionedOwnCategory = categoryKeywords.some((keyword) => note.includes(keyword));

  if (!mentionedAttraction && !mentionedOwnCategory) return false;

  for (const [otherCategory, otherKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (otherCategory === normalizeForMatching(slot.category).trim()) continue;
    const mentionsOtherCategory = otherKeywords.some((keyword) => note.includes(keyword));
    if (mentionsOtherCategory && !mentionedOwnCategory && !mentionedAttraction) return false;
    if (mentionsOtherCategory && !mentionedOwnCategory) return false;
  }

  return true;
}

export function buildNaturalVibeNote(
  attractionName: string,
  category: string,
  candidate?: string
) {
  const trimmedCandidate = typeof candidate === 'string' ? candidate.trim() : '';
  if (trimmedCandidate && !isLabelLikeVibeNote(trimmedCandidate)) {
    const candidateSlot = {
      attraction_name: attractionName,
      category,
      vibe_note: trimmedCandidate,
    };
    if (vibeNoteMatchesCategory(candidateSlot)) {
      return trimmedCandidate;
    }
    return buildGroundedVibeNote(attractionName, category);
  }

  let note: string;
  if (trimmedCandidate) {
    note = `${attractionName} is a good ${category} pick for this slot, with a ${trimmedCandidate.toLowerCase()} vibe that fits the trip.`;
    return vibeNoteMatchesCategory({
      attraction_name: attractionName,
      category,
      vibe_note: note,
    })
      ? note
      : buildGroundedVibeNote(attractionName, category);
  }

  note = `${attractionName} is a good ${category} pick for this slot and fits the overall pace and mood of the day.`;
  return vibeNoteMatchesCategory({
    attraction_name: attractionName,
    category,
    vibe_note: note,
  })
    ? note
    : buildGroundedVibeNote(attractionName, category);
}

function buildGroundedVibeNote(attractionName: string, category: string) {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory === 'market') {
    return `${attractionName} is a market stop for browsing local stalls, crafts, and easygoing street energy. It fits this slot without drifting away from the shopping-focused activity.`;
  }
  if (normalizedCategory === 'museum') {
    return `${attractionName} is a museum visit centered on exhibits, art, and local context. It gives this slot a grounded indoor culture break.`;
  }
  if (normalizedCategory === 'beach') {
    return `${attractionName} is a beach stop for sea views, sand, and a slower coastal pause. It fits this slot as a relaxed waterfront activity.`;
  }
  if (normalizedCategory === 'landmark') {
    return `${attractionName} is a landmark visit with heritage, architecture, and place-specific history. It gives this slot a clear sightseeing focus.`;
  }
  if (normalizedCategory === 'nature') {
    return `${attractionName} is a nature stop shaped around outdoor scenery and a slower open-air break. It fits this slot as a calm natural escape.`;
  }

  return `${attractionName} is a ${category} stop that fits this slot and the day plan. The visit is grounded in this specific attraction rather than a generic activity.`;
}

function extractCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as AnyRecord;

  const direct = row.coordinates;
  if (typeof direct === 'object' && direct !== null) {
    const directRecord = direct as AnyRecord;
    const directLat = toFiniteNumber(directRecord.lat);
    const directLng = toFiniteNumber(directRecord.lng);
    if (directLat !== null && directLng !== null) {
      return { lat: directLat, lng: directLng };
    }
  }

  const lat = toFiniteNumber(row.latitude) ?? toFiniteNumber(row.lat);
  const lng =
    toFiniteNumber(row.longitude) ??
    toFiniteNumber(row.lng) ??
    toFiniteNumber(row.lon);
  if (lat !== null && lng !== null) {
    return { lat, lng };
  }

  return null;
}

function extractCategoryName(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'object' && value !== null) {
    const asRecord = value as AnyRecord;
    if (typeof asRecord.name === 'string' && asRecord.name.trim()) {
      return asRecord.name.trim();
    }
  }
  return 'general';
}

function buildAttractionIndex(attractions: any[]) {
  const map = new Map<string, AttractionSnapshot>();

  for (const attraction of attractions) {
    if (typeof attraction !== 'object' || attraction === null) continue;
    const row = attraction as AnyRecord;

    const id = row.id ?? row.attraction_id;
    if (typeof id !== 'string' || !id.trim()) continue;

    const coordinates = extractCoordinates(row);
    if (!coordinates) continue;

    const avgCost =
      toFiniteNumber(row.avgCost) ??
      toFiniteNumber(row.avg_cost) ??
      toFiniteNumber(row.estimated_cost) ??
      300;
    const durationMinutes =
      toFiniteNumber(row.avgDurationMinutes) ??
      toFiniteNumber(row.duration_minutes) ??
      toFiniteNumber(row.durationMinutes) ??
      90;

    map.set(id, {
      id,
      name: safeString(row.name ?? row.attraction_name, id),
      category: extractCategoryName(row.category),
      avgCost: Math.max(1, avgCost),
      durationMinutes: Math.max(15, Math.round(durationMinutes)),
      coordinates,
    });
  }

  return map;
}

function buildVibeReasonIndex(vibeOutput: any[]) {
  const map = new Map<string, string>();

  for (const item of vibeOutput) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as AnyRecord;
    const id = row.attraction_id ?? row.id;
    if (typeof id !== 'string' || !id.trim()) continue;

    const reason = row.reason;
    if (typeof reason === 'string' && reason.trim()) {
      map.set(id, reason.trim());
    }
  }

  return map;
}

function inferTripDays(userProfile: UserProfile) {
  if (!userProfile.arrivalDate || !userProfile.departureDate) return 1;

  const arrival = new Date(userProfile.arrivalDate);
  const departure = new Date(userProfile.departureDate);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return 1;

  const diffDays = Math.ceil(
    (departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, diffDays);
}

function dateLabelForDay(arrivalDate: string | null, dayNumber: number) {
  if (arrivalDate) {
    const base = new Date(arrivalDate);
    if (!Number.isNaN(base.getTime())) {
      const date = new Date(base);
      date.setUTCDate(base.getUTCDate() + Math.max(0, dayNumber - 1));
      return date.toISOString().slice(0, 10);
    }
  }
  return `Day ${dayNumber}`;
}

function extractFirstJsonValue(text: string) {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) return null;

  const start = Math.min(...starts);
  const opening = text[start];
  const closing = opening === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseModelJson(text: string) {
  const clean = text
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(clean) as unknown;
  } catch {
    const extracted = extractFirstJsonValue(clean);
    if (!extracted) return null;

    try {
      return JSON.parse(extracted) as unknown;
    } catch {
      return null;
    }
  }
}

function buildSlotFromAttraction(
  slotName: SlotName,
  attraction: AttractionSnapshot,
  vibeReason?: string
): ReconcilerSlot {
  return {
    slot: slotName,
    attraction_id: attraction.id,
    attraction_name: attraction.name,
    category: attraction.category,
    estimated_cost: attraction.avgCost,
    duration_minutes: attraction.durationMinutes,
    coordinates: attraction.coordinates,
    vibe_note: buildNaturalVibeNote(attraction.name, attraction.category, vibeReason),
  };
}

function buildFallbackItinerary(
  userProfile: UserProfile,
  vibeOutput: any[],
  logisticsOutput: any[],
  attractions: any[],
  options?: {
    preserveDayNumbers?: boolean;
  }
): ReconcilerItinerary {
  const attractionsById = buildAttractionIndex(attractions);
  const vibeReasonsById = buildVibeReasonIndex(vibeOutput);
  const rankedIds: string[] = [];
  const seenRankedIds = new Set<string>();

  for (const item of vibeOutput) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as AnyRecord;
    const id = row.attraction_id ?? row.id;
    if (typeof id !== 'string' || !attractionsById.has(id) || seenRankedIds.has(id)) continue;
    rankedIds.push(id);
    seenRankedIds.add(id);
  }

  for (const id of attractionsById.keys()) {
    if (seenRankedIds.has(id)) continue;
    rankedIds.push(id);
    seenRankedIds.add(id);
  }

  const usedAttractionIds = new Set<string>();
  const days: ReconcilerDay[] = [];
  const logisticsDays = Array.isArray(logisticsOutput) ? logisticsOutput : [];

  for (let dayIndex = 0; dayIndex < logisticsDays.length; dayIndex += 1) {
    const dayItem = logisticsDays[dayIndex];
    if (typeof dayItem !== 'object' || dayItem === null) continue;
    const dayRecord = dayItem as AnyRecord;
    const slots = Array.isArray(dayRecord.slots) ? dayRecord.slots : [];
    const builtSlots: ReconcilerSlot[] = [];

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex];
      if (typeof slot !== 'object' || slot === null) continue;
      const slotRecord = slot as AnyRecord;
      const attractionId = slotRecord.attraction_id ?? slotRecord.attractionId ?? slotRecord.id;
      if (typeof attractionId !== 'string' || usedAttractionIds.has(attractionId)) continue;

      const attraction = attractionsById.get(attractionId);
      if (!attraction) continue;

      usedAttractionIds.add(attractionId);
      builtSlots.push(
        buildSlotFromAttraction(
          normalizeSlotName(slotRecord.slot, slotIndex),
          attraction,
          vibeReasonsById.get(attractionId)
        )
      );
    }

    if (builtSlots.length === 0) continue;

    const dayRaw = toFiniteNumber(dayRecord.day);
    const dayNumber = dayRaw === null ? dayIndex + 1 : Math.max(1, Math.round(dayRaw));
    const clusterArea = safeString(
      dayRecord.cluster_center ?? dayRecord.cluster_area,
      userProfile.hotelArea ?? userProfile.city ?? 'City Center'
    );
    const dayCost = builtSlots.reduce((sum, slot) => sum + slot.estimated_cost, 0);

    days.push({
      day: dayNumber,
      date_label: dateLabelForDay(userProfile.arrivalDate, dayNumber),
      cluster_area: clusterArea,
      slots: builtSlots,
      day_cost_estimate: dayCost,
    });
  }

  const targetDayCount = options?.preserveDayNumbers
    ? Math.max(days.length, logisticsDays.length)
    : Math.min(7, Math.max(days.length, inferTripDays(userProfile)));
  let nextDayNumber = days.length > 0 ? Math.max(...days.map((day) => day.day)) + 1 : 1;
  let cursor = 0;

  while ((days.length < targetDayCount || days.length === 0) && cursor < rankedIds.length) {
    const daySlots: ReconcilerSlot[] = [];

    while (daySlots.length < 3 && cursor < rankedIds.length) {
      const attractionId = rankedIds[cursor];
      cursor += 1;
      if (usedAttractionIds.has(attractionId)) continue;

      const attraction = attractionsById.get(attractionId);
      if (!attraction) continue;

      usedAttractionIds.add(attractionId);
      daySlots.push(
        buildSlotFromAttraction(
          SLOT_ORDER[daySlots.length % SLOT_ORDER.length],
          attraction,
          vibeReasonsById.get(attractionId)
        )
      );
    }

    if (daySlots.length === 0) break;

    const dayCost = daySlots.reduce((sum, slot) => sum + slot.estimated_cost, 0);
    days.push({
      day: nextDayNumber,
      date_label: dateLabelForDay(userProfile.arrivalDate, nextDayNumber),
      cluster_area: userProfile.hotelArea ?? userProfile.city ?? 'City Center',
      slots: daySlots,
      day_cost_estimate: dayCost,
    });
    nextDayNumber += 1;
  }

  if (days.length === 0) {
    days.push({
      day: 1,
      date_label: dateLabelForDay(userProfile.arrivalDate, 1),
      cluster_area: userProfile.hotelArea ?? userProfile.city ?? 'City Center',
      slots: [],
      day_cost_estimate: 0,
    });
  }

  const normalizedDays = days
    .sort((a, b) => a.day - b.day)
    .map((day, index) => ({
      ...day,
      day: options?.preserveDayNumbers ? day.day : index + 1,
      date_label: options?.preserveDayNumbers
        ? dateLabelForDay(userProfile.arrivalDate, day.day)
        : dateLabelForDay(userProfile.arrivalDate, index + 1),
      day_cost_estimate: day.slots.reduce((sum, slot) => sum + slot.estimated_cost, 0),
    }));

  return {
    city: safeString(userProfile.city, 'Trip'),
    currency: safeString(userProfile.currency, 'INR'),
    total_cost_estimate: normalizedDays.reduce(
      (sum, day) => sum + day.day_cost_estimate,
      0
    ),
    days: normalizedDays,
  };
}

function normalizeParsedItinerary(
  parsed: unknown,
  fallback: ReconcilerItinerary,
  attractions: any[],
  options?: {
    preserveDayNumbers?: boolean;
  }
) {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const row = parsed as AnyRecord;
  const daysRaw = row.days;
  if (!Array.isArray(daysRaw)) return null;
  const attractionsById = buildAttractionIndex(attractions);
  let correctedVibeNotes = 0;

  const days: ReconcilerDay[] = daysRaw
    .map((dayItem, dayIndex) => {
      if (typeof dayItem !== 'object' || dayItem === null) return null;
      const dayRecord = dayItem as AnyRecord;
      const slotsRaw = Array.isArray(dayRecord.slots) ? dayRecord.slots : [];
      const slots: ReconcilerSlot[] = slotsRaw
        .map((slotItem, slotIndex) => {
          if (typeof slotItem !== 'object' || slotItem === null) return null;
          const slotRecord = slotItem as AnyRecord;
          const fallbackSlot = fallback.days[dayIndex]?.slots[slotIndex];
          const coordinates =
            extractCoordinates(slotRecord) ??
            fallbackSlot?.coordinates ??
            { lat: 0, lng: 0 };
          const attractionId = safeString(
            slotRecord.attraction_id,
            fallbackSlot?.attraction_id ?? `slot-${dayIndex + 1}-${slotIndex + 1}`
          );
          const canonicalAttraction = attractionsById.get(attractionId);
          const attractionName =
            canonicalAttraction?.name ??
            safeString(
              slotRecord.attraction_name,
              fallbackSlot?.attraction_name ?? `Activity ${slotIndex + 1}`
            );
          const category =
            canonicalAttraction?.category ??
            safeString(slotRecord.category, fallbackSlot?.category ?? 'general');
          const incomingVibeNote = safeString(
            slotRecord.vibe_note,
            fallbackSlot?.vibe_note ?? ''
          );
          const normalizedVibeNote = buildNaturalVibeNote(
            attractionName,
            category,
            incomingVibeNote || fallbackSlot?.vibe_note
          );

          if (
            incomingVibeNote &&
            normalizeForMatching(incomingVibeNote) !== normalizeForMatching(normalizedVibeNote)
          ) {
            correctedVibeNotes += 1;
          }

          return {
            slot: normalizeSlotName(slotRecord.slot, slotIndex),
            attraction_id: attractionId,
            attraction_name: attractionName,
            category,
            estimated_cost:
              canonicalAttraction?.avgCost ??
              toFiniteNumber(slotRecord.estimated_cost) ??
              fallbackSlot?.estimated_cost ??
              0,
            duration_minutes:
              canonicalAttraction?.durationMinutes ??
              Math.max(
                15,
                Math.round(
                  toFiniteNumber(slotRecord.duration_minutes) ??
                    fallbackSlot?.duration_minutes ??
                    90
                )
              ),
            coordinates: canonicalAttraction?.coordinates ?? coordinates,
            vibe_note: normalizedVibeNote,
          };
        })
        .filter((slot): slot is ReconcilerSlot => Boolean(slot));

      const fallbackDay = fallback.days[dayIndex];
      const dayRaw = toFiniteNumber(dayRecord.day);
      const dayNumber = dayRaw === null ? dayIndex + 1 : Math.max(1, Math.round(dayRaw));
      return {
        day: dayNumber,
        date_label: safeString(
          dayRecord.date_label,
          fallbackDay?.date_label ?? `Day ${dayNumber}`
        ),
        cluster_area: safeString(
          dayRecord.cluster_area,
          fallbackDay?.cluster_area ?? 'City Center'
        ),
        slots,
        day_cost_estimate: slots.reduce((sum, slot) => sum + slot.estimated_cost, 0),
      };
    })
    .filter((day): day is ReconcilerDay => Boolean(day));

  if (days.length === 0) return null;

  const normalizedDays = days
    .sort((a, b) => a.day - b.day)
    .map((day, index) => ({
      ...day,
      day: options?.preserveDayNumbers ? day.day : index + 1,
      day_cost_estimate: day.slots.reduce((sum, slot) => sum + slot.estimated_cost, 0),
    }));

  const computedTotal = normalizedDays.reduce((sum, day) => sum + day.day_cost_estimate, 0);
  const providedTotal = toFiniteNumber(row.total_cost_estimate);
  const totalCost =
    providedTotal !== null && Math.abs(providedTotal - computedTotal) <= 1
      ? providedTotal
      : computedTotal;

  return {
    itinerary: {
      city: safeString(row.city, fallback.city),
      currency: safeString(row.currency, fallback.currency),
      total_cost_estimate: Math.max(0, totalCost),
      days: normalizedDays,
    },
    correctedVibeNotes,
  };
}

export async function reconcilerAgent(
  userProfile: UserProfile,
  vibeOutput: any[],
  budgetOutput: any,
  logisticsOutput: any[],
  diversityOutput: any,
  attractions: any[],
  // 🔥 REPLAN (NEW OPTIONAL PARAMS)
  options?: {
    existingItinerary?: any;
    disruption?: any;
    preservedDays?: any[];
    replanStartDay?: number;
    disruptionPolicy?: {
      disallowedCategories?: string[];
      rationale?: string[];
    };
  }
): Promise<ReconcilerAgentResult> {
    const isReplan = !!options?.disruption && !!options?.existingItinerary;
  const disruption = options?.disruption;
  const existingItinerary = options?.existingItinerary;
  const preservedDays = options?.preservedDays;
  const replanStartDay = options?.replanStartDay ?? 1;
  const disruptionPolicy = options?.disruptionPolicy;
  const maxAttractions = Math.min(
    Number(process.env.AGENT_ATTRACTION_LIMIT ?? 20),
    20
  );

  const compactProfile = compactUserProfileForPrompt(userProfile);

  // ✅ compact vibe
  const compactVibe = vibeOutput.slice(0, maxAttractions).map((v: any) => ({
    id: v?.attraction_id ?? v?.id ?? null,
    score: v?.vibe_fit_score ?? v?.score ?? 0.5,
  }));

  // ✅ clusters (ONLY IDs)
  const adjustedClusters = Array.isArray(diversityOutput?.adjustedClusters)
    ? diversityOutput.adjustedClusters
    : logisticsOutput;

  const compactClusters = adjustedClusters.map((day: any) => ({
    day: day?.day ?? null,
    slots: Array.isArray(day?.slots)
      ? day.slots.map((s: any) => ({
          attraction_id: s?.attractionId ?? s?.attraction_id ?? null,
        }))
      : [],
  }));
  const compactCandidates = attractions.slice(0, maxAttractions).map((attraction: any) => ({
    id: attraction?.id ?? attraction?.attraction_id ?? null,
    name: attraction?.name ?? attraction?.attraction_name ?? null,
    category: attraction?.category?.name ?? attraction?.category ?? null,
    estimated_cost: attraction?.estimated_cost ?? attraction?.avgCost ?? null,
    duration_minutes: attraction?.avgDurationMinutes ?? attraction?.duration_minutes ?? null,
    coordinates:
      typeof attraction?.latitude === 'number' && typeof attraction?.longitude === 'number'
        ? { lat: attraction.latitude, lng: attraction.longitude }
        : attraction?.coordinates ?? null,
  }));

  // ✅ COMPRESSED BUDGET (IMPORTANT)
  const compactBudget = {
    dailyBudgetCap: budgetOutput?.dailyBudgetCap ?? null,
    totalBudget: userProfile.budget ?? null,
  };

  // 🔥 SIMPLIFIED PROMPT (MAJOR TOKEN REDUCTION)
    const systemPrompt = `
You are a deterministic itinerary reconciler.

Your job is NOT to be creative.
Your job is to strictly assemble a valid itinerary from pre-processed data.

--------------------------------------------------

${isReplan ? `
A disruption has occurred:
${JSON.stringify(disruption)}

You are generating ONLY the single disrupted slot that must be replaced.

REPLAN HARD RULES:
1. Output EXACTLY one day: day ${replanStartDay}.
2. That day must include EXACTLY one slot: "${disruption?.slot}".
3. Do NOT create any additional slots.
4. Use only attraction_ids from provided clusters and candidates.
5. Respect disallowedCategories from the disruption policy.
` : ``}

--------------------------------------------------

GLOBAL HARD CONSTRAINTS (STRICT PRIORITY):

1. Budget:
- Do NOT exceed daily budget cap
- Do NOT include flagged expensive attractions

2. Must-Visit:
- Always include mustVisit attractions

3. Vibe:
- STRICT: Only use attractions with vibe_fit_score >= 0.6
- If insufficient, then allow attractions with vibe_fit_score >= 0.5
- NEVER use attractions with vibe_fit_score < 0.5 under any condition

4. Clusters:
- Follow cluster grouping EXACTLY
- Do NOT move attractions across days
- Do NOT select attractions from different cluster areas in the same day
- All slots in a day must belong to the same cluster

--------------------------------------------------

DATA GROUNDING RULES (CRITICAL):

- You MUST ONLY use attraction_ids from provided clusters
- DO NOT invent attractions
- DO NOT change attraction_name
- DO NOT fabricate cost, category, or coordinates
- Use given data as source of truth
- vibe_note must be a natural 1-2 sentence description, not a label, tag, or persona name
- For each slot, vibe_note MUST directly describe the specific attraction selected for that slot.
- vibe_note MUST match the attraction category and the actual activity.
- Do NOT reuse generic vibe_note templates across unrelated attractions.
- Do NOT mention unrelated places, attractions, landmarks, beaches, markets, temples, or museums.
- If the attraction is a market, describe market/shopping/stall energy; if it is a landmark, describe heritage/architecture/sightseeing; if it is a museum, describe exhibits/art/culture; if it is a beach, describe coastal/sand/sea activity.

--------------------------------------------------

STRUCTURE RULES:

- Maintain slot order: morning → afternoon → evening
- Each day MUST contain exactly 3 slots unless strictly impossible
- Each day must have valid slots based on cluster input
- Do NOT repeat the same attraction within the same day
- Do NOT include more than 1 high-cost attraction (>2000) per day
- Maintain consistent JSON structure
${isReplan ? '- In replan mode, return exactly 1 slot in the slots array for the disrupted slot only' : ''}

--------------------------------------------------

INPUT DATA:

User:
${JSON.stringify(compactProfile)}

Vibe Scores:
${JSON.stringify(compactVibe)}

Budget:
${JSON.stringify(compactBudget)}

Clusters:
${JSON.stringify(compactClusters)}

${isReplan ? `
CANDIDATES:
${JSON.stringify(compactCandidates)}

Replan starts at day: ${JSON.stringify(replanStartDay)}
Derived disruption policy: ${JSON.stringify(disruptionPolicy)}
` : ``}

--------------------------------------------------

OUTPUT RULE:

Return ONLY valid JSON. No explanation.

{
  "city": string,
  "total_cost_estimate": number,
  "currency": string,
  "days": [
    {
      "day": number,
      "date_label": string,
      "cluster_area": string,
      "slots": [
        {
          "slot": "morning"|"afternoon"|"evening",
          "attraction_id": string,
          "attraction_name": string,
          "category": string,
          "estimated_cost": number,
          "duration_minutes": number,
          "coordinates": { "lat": number, "lng": number },
          "vibe_note": string
        }
      ],
      "day_cost_estimate": number
    }
  ]
}
`;

  let text = '{}';
  let tokensUsed = 0;
  let retryCount = 0;

  try {
    const response = isReplan
      ? await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: systemPrompt }],
          temperature: 0.2,
          max_completion_tokens: 2500,
        })
      : await callWithRetry(
          () =>
            groq.chat.completions.create({
              model: GROQ_MODEL,
              messages: [{ role: 'user', content: systemPrompt }],
              temperature: 0.2,
              max_completion_tokens: 2500,
            }),
          {
            onRetry: () => {
              retryCount += 1;
            },
          }
        );
    tokensUsed = extractTokensUsed(response);

    text = response.choices[0]?.message?.content || '{}';

  } catch (error) {
    console.error('[reconcilerAgent] LLM error → fallback triggered', error);

      return {
        itinerary: buildFallbackItinerary(
          userProfile,
          vibeOutput,
          logisticsOutput,
          attractions,
          { preserveDayNumbers: isReplan }
        ),
        tokensUsed,
        meta: {
          usedFallback: true,
          retryCount,
          llmSuccess: false,
          correctedVibeNotes: 0,
        },
      };
  }

  const fallback = buildFallbackItinerary(
    userProfile,
    vibeOutput,
    logisticsOutput,
    attractions,
    { preserveDayNumbers: isReplan }
  );

  const parsed = parseModelJson(text);
  const normalized = normalizeParsedItinerary(parsed, fallback, attractions, {
    preserveDayNumbers: isReplan,
  });

  if (normalized) {
    return {
      itinerary: normalized.itinerary,
      tokensUsed,
      meta: {
        usedFallback: false,
        retryCount,
        llmSuccess: true,
        correctedVibeNotes: normalized.correctedVibeNotes,
      },
    };
  }

  console.error('[reconcilerAgent] parse error → fallback', text);
  return {
    itinerary: fallback,
    tokensUsed,
    meta: {
      usedFallback: true,
      retryCount,
      llmSuccess: false,
      correctedVibeNotes: 0,
    },
  };
}
