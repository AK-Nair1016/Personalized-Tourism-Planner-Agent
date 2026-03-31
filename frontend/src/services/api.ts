import { UserProfile } from '../types/userProfile';

export async function generateItinerary(userProfile: UserProfile) {
  // Day 5 - wire real API call here
  console.log('generateItinerary called with:', userProfile);
}

export async function replanItinerary(itineraryId: string, disruption: object) {
  // Day 6 - wire real replan call here
  console.log('replanItinerary called with:', itineraryId, disruption);
}

export async function getCities() {
  // Day 3 - wire real fetch here
  console.log('getCities called');
}

export async function getAttractions(cityId: string) {
  // Day 3 - wire real fetch here
  console.log('getAttractions called with:', cityId);
}