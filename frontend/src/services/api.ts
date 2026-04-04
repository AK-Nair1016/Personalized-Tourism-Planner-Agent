import { UserProfile } from '@vibetrip/shared/types/userProfile';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function generateItinerary(userProfile: UserProfile) {
  const response = await fetch(`${BASE_URL}/api/itinerary/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userProfile),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate itinerary: ${response.status}`);
  }

  return response.json();
}

export async function replanItinerary(itineraryId: string, disruption: object) {
  const response = await fetch(`${BASE_URL}/api/itinerary/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itinerary_id: itineraryId, disruption }),
  });

  if (!response.ok) {
    throw new Error(`Failed to replan itinerary: ${response.status}`);
  }

  return response.json();
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