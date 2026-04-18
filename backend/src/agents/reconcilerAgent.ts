import groq, { GROQ_MODEL } from '../lib/groq';
import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { callWithRetry } from '../utils/retry';
import {
  compactAttractionsForPrompt,
  compactDiversityOutputForPrompt,
  compactLogisticsOutputForPrompt,
  compactUserProfileForPrompt,
  compactVibeOutputForPrompt,
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

    const avgCost = toFiniteNumber(row.avgCost) ?? toFiniteNumber(row.avg_cost) ?? 0;
    const durationMinutes =
      toFiniteNumber(row.avgDurationMinutes) ??
      toFiniteNumber(row.duration_minutes) ??
      toFiniteNumber(row.durationMinutes) ??
      90;

    map.set(id, {
      id,
      name: safeString(row.name ?? row.attraction_name, id),
      category: extractCategoryName(row.category),
      avgCost: Math.max(0, avgCost),
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
    vibe_note: safeString(vibeReason, 'A great match for your travel vibe.'),
  };
}

function buildFallbackItinerary(
  userProfile: UserProfile,
  vibeOutput: any[],
  logisticsOutput: any[],
  attractions: any[]
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
      const attractionId = slotRecord.attraction_id ?? slotRecord.id;
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

  const targetDayCount = Math.min(7, Math.max(days.length, inferTripDays(userProfile)));
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
      day: index + 1,
      date_label: dateLabelForDay(userProfile.arrivalDate, index + 1),
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
  attractions: any[]
) {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const row = parsed as AnyRecord;
  const daysRaw = row.days;
  if (!Array.isArray(daysRaw)) return null;
  const attractionsById = buildAttractionIndex(attractions);

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

          return {
            slot: normalizeSlotName(slotRecord.slot, slotIndex),
            attraction_id: attractionId,
            attraction_name:
              canonicalAttraction?.name ??
              safeString(
                slotRecord.attraction_name,
                fallbackSlot?.attraction_name ?? `Activity ${slotIndex + 1}`
              ),
            category:
              canonicalAttraction?.category ??
              safeString(slotRecord.category, fallbackSlot?.category ?? 'general'),
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
            vibe_note: safeString(
              slotRecord.vibe_note,
              fallbackSlot?.vibe_note ?? 'A great match for your travel vibe.'
            ),
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
      day: index + 1,
      day_cost_estimate: day.slots.reduce((sum, slot) => sum + slot.estimated_cost, 0),
    }));

  const computedTotal = normalizedDays.reduce((sum, day) => sum + day.day_cost_estimate, 0);
  const providedTotal = toFiniteNumber(row.total_cost_estimate);
  const totalCost =
    providedTotal !== null && Math.abs(providedTotal - computedTotal) <= 1
      ? providedTotal
      : computedTotal;

  return {
    city: safeString(row.city, fallback.city),
    currency: safeString(row.currency, fallback.currency),
    total_cost_estimate: Math.max(0, totalCost),
    days: normalizedDays,
  };
}

export async function reconcilerAgent(
  userProfile: UserProfile,
  vibeOutput: any[],
  budgetOutput: any,
  logisticsOutput: any[],
  diversityOutput: any,
  attractions: any[]
): Promise<ReconcilerAgentResult> {
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

  // ✅ COMPRESSED BUDGET (IMPORTANT)
  const compactBudget = {
    dailyBudgetCap: budgetOutput?.dailyBudgetCap ?? null,
    totalBudget: userProfile.budget ?? null,
  };

  // 🔥 SIMPLIFIED PROMPT (MAJOR TOKEN REDUCTION)
  const prompt = `
You are a travel planner.

Build a day-by-day itinerary using given clusters and preferences.

Rules:
- Respect daily budget cap
- Prefer high vibe score attractions
- Maintain slot order: morning, afternoon, evening

User:
${JSON.stringify(compactProfile)}

Vibe:
${JSON.stringify(compactVibe)}

Budget:
${JSON.stringify(compactBudget)}

Clusters:
${JSON.stringify(compactClusters)}

Return ONLY JSON:

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
    const response = await callWithRetry(() =>
      groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
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
          attractions
        ),
        tokensUsed,
        meta: {
          usedFallback: true,
          retryCount,
          llmSuccess: false,
        },
      };
  }

  const fallback = buildFallbackItinerary(
    userProfile,
    vibeOutput,
    logisticsOutput,
    attractions
  );

  const parsed = parseModelJson(text);
  const normalized = normalizeParsedItinerary(parsed, fallback, attractions);

  if (normalized) {
    return {
      itinerary: normalized,
      tokensUsed,
      meta: {
        usedFallback: false,
        retryCount,
        llmSuccess: true,
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
    },
  };
}
