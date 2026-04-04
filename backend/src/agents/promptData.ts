import type { UserProfile } from '@vibetrip/shared/types/userProfile';

type AnyRecord = Record<string, any>;

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getCoordinates(attraction: AnyRecord) {
  const directCoordinates = attraction.coordinates;
  if (
    directCoordinates &&
    typeof directCoordinates === 'object' &&
    typeof directCoordinates.lat === 'number' &&
    typeof directCoordinates.lng === 'number'
  ) {
    return {
      lat: directCoordinates.lat,
      lng: directCoordinates.lng,
    };
  }

  const lat =
    readNumber(attraction.lat) ??
    readNumber(attraction.latitude) ??
    readNumber(attraction.location?.lat) ??
    readNumber(attraction.location?.latitude);
  const lng =
    readNumber(attraction.lng) ??
    readNumber(attraction.lon) ??
    readNumber(attraction.longitude) ??
    readNumber(attraction.location?.lng) ??
    readNumber(attraction.location?.lon) ??
    readNumber(attraction.location?.longitude);

  if (lat !== null && lng !== null) {
    return { lat, lng };
  }

  return undefined;
}

function getCategoryValue(category: unknown) {
  if (typeof category === 'string') return category;
  if (!category || typeof category !== 'object') return null;

  const asRecord = category as AnyRecord;
  return (
    asRecord.name ??
    asRecord.label ??
    asRecord.title ??
    null
  );
}

function safeLimit(limit: number) {
  if (!Number.isFinite(limit)) return 1;
  return Math.max(1, Math.floor(limit));
}

export function compactUserProfileForPrompt(userProfile: UserProfile) {
  return {
    vibe: userProfile.vibe,
    firstVisit: userProfile.firstVisit,
    group: userProfile.group,
    city: userProfile.city,
    arrivalDate: userProfile.arrivalDate,
    departureDate: userProfile.departureDate,
    arrivalTime: userProfile.arrivalTime,
    departureTime: userProfile.departureTime,
    hotelArea: userProfile.hotelArea,
    budget: userProfile.budget,
    currency: userProfile.currency,
    budgetSplit: userProfile.budgetSplit,
    pace: userProfile.pace,
    wakeUpStyle: userProfile.wakeUpStyle,
    transportPreference: userProfile.transportPreference,
    dietary: userProfile.dietary,
    mobilityNeeds: userProfile.mobilityNeeds,
    ageGroup: userProfile.ageGroup,
    mustVisit: userProfile.mustVisit,
    avoid: userProfile.avoid,
  };
}

export function compactAttractionsForPrompt(attractions: any[], limit: number) {
  return attractions.slice(0, safeLimit(limit)).map((attraction) => {
    const row = attraction as AnyRecord;
    return {
      attraction_id: row.id ?? row.attraction_id ?? null,
      name: row.name ?? row.attraction_name ?? null,
      category: getCategoryValue(row.category),
      area: row.area ?? row.neighborhood ?? row.cluster_area ?? null,
      avg_cost: row.avg_cost ?? row.avgCost ?? null,
      duration_minutes: row.duration_minutes ?? row.durationMinutes ?? null,
      coordinates: getCoordinates(row),
    };
  });
}

export function compactVibeOutputForPrompt(vibeOutput: any[], limit: number) {
  return vibeOutput.slice(0, safeLimit(limit)).map((item) => {
    const row = item as AnyRecord;
    return {
      attraction_id: row.attraction_id ?? row.id ?? null,
      vibe_fit_score: row.vibe_fit_score ?? row.score ?? null,
      reason: row.reason ?? null,
    };
  });
}

export function compactLogisticsOutputForPrompt(logisticsOutput: any[], dayLimit = 7, slotLimit = 5) {
  return logisticsOutput
    .slice(0, safeLimit(dayLimit))
    .map((dayItem) => {
      const row = dayItem as AnyRecord;
      const slots = Array.isArray(row.slots) ? row.slots : [];

      return {
        day: row.day ?? null,
        cluster_center: row.cluster_center ?? row.cluster_area ?? null,
        slots: slots.slice(0, safeLimit(slotLimit)).map((slotItem: AnyRecord) => ({
          slot: slotItem.slot ?? null,
          attraction_id: slotItem.attraction_id ?? slotItem.id ?? null,
        })),
      };
    });
}

export function compactDiversityOutputForPrompt(diversityOutput: any) {
  const row = diversityOutput as AnyRecord;
  const flaggedDays = Array.isArray(row?.flagged_days) ? row.flagged_days : [];

  return {
    diverse: row?.diverse ?? null,
    flagged_days: flaggedDays.slice(0, 10).map((flag: AnyRecord) => ({
      day: flag.day ?? null,
      issue: flag.issue ?? null,
      suggested_replacement: flag.suggested_replacement
        ? {
            remove_attraction_id: flag.suggested_replacement.remove_attraction_id ?? null,
            add_attraction_id: flag.suggested_replacement.add_attraction_id ?? null,
            reason: flag.suggested_replacement.reason ?? null,
          }
        : null,
    })),
  };
}
