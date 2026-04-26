import { UserProfile } from '@vibetrip/shared/types/userProfile';

type ReplanDisruption = {
  day: number;
  slot: 'morning' | 'afternoon' | 'evening';
  description: string;
};

type PlannerSlotLike = {
  slot?: string;
  attraction_id?: string;
  attraction_name?: string;
  category?: string;
};

type PlannerDayLike = {
  day?: number;
  slots?: PlannerSlotLike[];
};

type PlannerItineraryLike = {
  days?: PlannerDayLike[];
};

type DisruptedSlotContext = {
  attractionName?: string;
  category?: string;
};

export type PreservedAttractionExclusions = {
  attractionIds: string[];
  attractionNames: string[];
};

export type DisruptionPolicy = {
  avoidTerms: string[];
  avoidTags: string[];
  disallowedCategories: string[];
  preferredCategories: string[];
  allowedIndoorOutdoor: Array<'indoor' | 'both'> | null;
  requireAccessible: boolean;
  preferNearby: boolean;
  rationale: string[];
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0))
  );
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectStrings(item));
  }
  return [];
}

function getAttractionCategory(attraction: unknown) {
  if (typeof attraction !== 'object' || attraction === null) return '';
  const category = (attraction as Record<string, unknown>).category;
  if (typeof category === 'string') return normalizeText(category);
  if (typeof category === 'object' && category !== null) {
    return normalizeText((category as Record<string, unknown>).name);
  }
  return '';
}

function getAttractionId(attraction: unknown) {
  if (typeof attraction !== 'object' || attraction === null) return '';
  const row = attraction as Record<string, unknown>;
  return normalizeText(row.attraction_id ?? row.id);
}

function getAttractionName(attraction: unknown) {
  if (typeof attraction !== 'object' || attraction === null) return '';
  const row = attraction as Record<string, unknown>;
  return normalizeText(row.attraction_name ?? row.name);
}

function getIndoorOutdoor(attraction: unknown): 'indoor' | 'outdoor' | 'both' | '' {
  if (typeof attraction !== 'object' || attraction === null) return '';
  const value = normalizeText((attraction as Record<string, unknown>).indoorOutdoor);
  if (value === 'indoor' || value === 'outdoor' || value === 'both') return value;
  return '';
}

function getStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [normalizeText(value)];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function readBooleanField(attraction: unknown, keys: string[]): boolean | null {
  if (typeof attraction !== 'object' || attraction === null) return null;
  const row = attraction as Record<string, unknown>;

  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = normalizeText(value);
      if (normalized === 'true' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === 'no') return false;
    }
  }

  return null;
}

function readNumberField(attraction: unknown, keys: string[]): number | null {
  if (typeof attraction !== 'object' || attraction === null) return null;
  const row = attraction as Record<string, unknown>;

  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return null;
}

function getAttractionTags(attraction: unknown): string[] {
  if (typeof attraction !== 'object' || attraction === null) return [];
  const row = attraction as Record<string, unknown>;

  return uniqueStrings([
    ...getStringArray(row.tags),
    ...getStringArray(row.avoidTags),
    ...getStringArray(row.vibeTags),
  ]);
}

function isAccessibleAttraction(attraction: unknown): boolean {
  const explicitAccessibility = readBooleanField(attraction, [
    'isAccessible',
    'accessible',
    'wheelchairAccessible',
    'mobilityFriendly',
  ]);
  if (explicitAccessibility !== null) return explicitAccessibility;

  const accessibilityScore = readNumberField(attraction, [
    'accessibilityScore',
    'mobilityScore',
  ]);
  if (accessibilityScore !== null) return accessibilityScore >= 0.5;

  const intensityLevel = readNumberField(attraction, ['intensityLevel']);
  return intensityLevel === null || intensityLevel <= 2;
}

function isNearbyAttraction(attraction: unknown): boolean {
  const proximityScore = readNumberField(attraction, [
    'proximityScore',
    'distanceScore',
  ]);
  if (proximityScore !== null) return proximityScore >= 0.5;

  const distanceKm = readNumberField(attraction, ['distanceKm', 'distance_km']);
  if (distanceKm !== null) return distanceKm <= 12;

  return !getAttractionTags(attraction).includes('far_distance');
}

export function getDisruptedSlotContext(
  existingItinerary: PlannerItineraryLike | undefined,
  disruption?: ReplanDisruption
): DisruptedSlotContext {
  if (!existingItinerary || !disruption) return {};
  const days = Array.isArray(existingItinerary.days) ? existingItinerary.days : [];
  const day = days.find((item) => item?.day === disruption.day);
  const slots = Array.isArray(day?.slots) ? day?.slots : [];
  const slot = slots.find((item) => normalizeText(item?.slot) === normalizeText(disruption.slot));
  if (!slot) return {};

  return {
    attractionName: normalizeText(slot.attraction_name),
    category: normalizeText(slot.category),
  };
}

export function getPreservedAttractionExclusions(
  existingItinerary: PlannerItineraryLike | undefined,
  disruption?: ReplanDisruption
): PreservedAttractionExclusions {
  if (!existingItinerary || !disruption) {
    return { attractionIds: [], attractionNames: [] };
  }

  const attractionIds: string[] = [];
  const attractionNames: string[] = [];
  const days = Array.isArray(existingItinerary.days) ? existingItinerary.days : [];

  for (const day of days) {
    const dayNumber = typeof day?.day === 'number' ? day.day : 0;
    if (dayNumber !== disruption.day) continue;
    const slots = Array.isArray(day?.slots) ? day.slots : [];

    for (const slot of slots) {
      const attractionId = normalizeText(slot?.attraction_id);
      const attractionName = normalizeText(slot?.attraction_name);

      if (attractionId) attractionIds.push(attractionId);
      if (attractionName) attractionNames.push(attractionName);
    }
  }

  return {
    attractionIds: uniqueStrings(attractionIds),
    attractionNames: uniqueStrings(attractionNames),
  };
}

export function deriveDisruptionPolicy(
  disruption?: ReplanDisruption,
  disruptedSlot?: DisruptedSlotContext
): DisruptionPolicy {
  const description = normalizeText(disruption?.description);
  const disruptedCategory = normalizeText(disruptedSlot?.category);

  const disallowedCategories: string[] = [];
  const rationale: string[] = [];

  const weatherDisruption =
    description.includes('weather') ||
    description.includes('rain') ||
    description.includes('storm') ||
    description.includes('monsoon') ||
    description.includes('flood') ||
    description.includes('heatwave') ||
    description.includes('heat');

  if (weatherDisruption) {
    disallowedCategories.push('nature', 'beach', 'park');
    rationale.push('weather disruption');
  }

  const categoryClosure =
    (description.includes('closed') ||
      description.includes('closure') ||
      description.includes('maintenance')) &&
    disruptedCategory;

  if (categoryClosure) {
    disallowedCategories.push(disruptedCategory);
    rationale.push(`category closure: ${disruptedCategory}`);
  }

  return {
    avoidTerms: [],
    avoidTags: [],
    disallowedCategories: uniqueStrings(disallowedCategories),
    preferredCategories: [],
    allowedIndoorOutdoor: null,
    requireAccessible: false,
    preferNearby: false,
    rationale: uniqueStrings(rationale),
  };
}

export function buildDisruptionAwareProfile(
  userProfile: UserProfile,
  policy?: DisruptionPolicy
): UserProfile {
  const avoidTerms = policy?.avoidTerms ?? [];
  if (avoidTerms.length === 0) return userProfile;

  return {
    ...userProfile,
    avoid: uniqueStrings([...(userProfile.avoid ?? []), ...avoidTerms]),
  };
}

export function attractionMatchesAvoidTerms(attraction: unknown, avoidTerms: string[]): boolean {
  const normalizedTerms = uniqueStrings(avoidTerms);
  if (normalizedTerms.length === 0) return false;

  const blob = normalizeText(collectStrings(attraction).join(' '));
  if (!blob) return false;

  return normalizedTerms.some((term) => blob.includes(term));
}

export function isAttractionAllowedByDisruptionPolicy(
  attraction: unknown,
  policy?: DisruptionPolicy
): boolean {
  if (!policy) return true;
  if (attractionMatchesAvoidTerms(attraction, policy.avoidTerms)) return false;
  const attractionTags = getAttractionTags(attraction);
  if (policy.avoidTags.some((tag) => attractionTags.includes(tag))) return false;

  const category = getAttractionCategory(attraction);
  if (category && policy.disallowedCategories.includes(category)) return false;

  const indoorOutdoor = getIndoorOutdoor(attraction);
  if (
    policy.allowedIndoorOutdoor &&
    indoorOutdoor &&
    !policy.allowedIndoorOutdoor.includes(indoorOutdoor as 'indoor' | 'both')
  ) {
    return false;
  }

  if (policy.requireAccessible && !isAccessibleAttraction(attraction)) {
    return false;
  }

  if (policy.preferNearby && !isNearbyAttraction(attraction)) {
    return false;
  }

  return true;
}

export function scoreAttractionForDisruptionPolicy(
  attraction: unknown,
  policy?: DisruptionPolicy
): number {
  if (!policy) return 0;
  return 0;
}

export function filterAndRankAttractionsForDisruption<T>(
  attractions: T[],
  policy?: DisruptionPolicy,
  exclusions?: PreservedAttractionExclusions
): T[] {
  return [...attractions]
    .filter((attraction) => isAttractionAllowedByDisruptionPolicy(attraction, policy))
    .filter((attraction) => {
      const attractionId = getAttractionId(attraction);
      const attractionName = getAttractionName(attraction);

      if (attractionId && exclusions?.attractionIds.includes(attractionId)) return false;
      if (attractionName && exclusions?.attractionNames.includes(attractionName)) return false;
      return true;
    })
    .sort(
      (left, right) =>
        scoreAttractionForDisruptionPolicy(right, policy) -
        scoreAttractionForDisruptionPolicy(left, policy)
    );
}
