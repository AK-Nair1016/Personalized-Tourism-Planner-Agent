import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import type { Itinerary as ItineraryData, ItinerarySlot } from '@vibetrip/shared/types/Itinerary';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function isValidItineraryPayload(value: unknown): value is ItineraryData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.city === 'string' &&
    typeof candidate.currency === 'string' &&
    typeof candidate.total_cost_estimate === 'number' &&
    Array.isArray(candidate.days)
  );
}

export async function generateItinerary(userProfile: UserProfile): Promise<ItineraryData> {
  const response = await fetch(`${BASE_URL}/api/itinerary/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userProfile),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate itinerary: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const maybeWrapped =
    typeof payload === 'object' &&
    payload !== null &&
    'itinerary' in payload
      ? (payload as { itinerary: unknown }).itinerary
      : payload;

  if (!isValidItineraryPayload(maybeWrapped)) {
    throw new Error('Backend returned invalid itinerary payload');
  }

  return maybeWrapped;
}

type ReplanDisruption = {
  day: number;
  slot: ItinerarySlot['slot'];
  description: string;
};

export function buildReplanRequestPayload(itineraryId: string, disruption: ReplanDisruption) {
  return { itineraryId, disruption };
}

export async function replanItinerary(
  itineraryId: string,
  disruption: ReplanDisruption
): Promise<ItineraryData> {
  const response = await fetch(`${BASE_URL}/api/itinerary/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildReplanRequestPayload(itineraryId, disruption)),
  });

  if (!response.ok) {
    throw new Error(`Failed to replan itinerary: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isValidItineraryPayload(payload)) {
    throw new Error('Backend returned invalid replanned itinerary payload');
  }

  return payload;
}

export async function getCities() {
  const response = await fetch(`${BASE_URL}/api/cities`);
  if (!response.ok) throw new Error('Failed to fetch cities');
  return response.json();
}

export async function getAttractions(cityId: string) {
  const response = await fetch(`${BASE_URL}/api/attractions?cityId=${cityId}`);
  if (!response.ok) throw new Error('Failed to fetch attractions');
  return response.json();
}
