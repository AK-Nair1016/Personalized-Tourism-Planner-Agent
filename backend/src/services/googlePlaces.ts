// backend/src/services/googlePlaces.ts

const GOOGLE_BASE_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const API_KEY = process.env.GOOGLE_PLACES_KEY;

// ===== TYPES =====
export type GooglePlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  estimated_cost: number;
  rating: number | null;
  types: string[];
  source: "google_places";
};

// ===== CACHE =====
type CacheEntry = {
  data: GooglePlace[];
  expiry: number;
};

const cache = new Map<string, CacheEntry>();
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

let monthlyUsage = 0;
const MONTHLY_LIMIT = 400;

// ===== HELPERS =====

function mapPriceLevel(priceLevel?: number): number {
  switch (priceLevel) {
    case 0: return 0;
    case 1: return 200;
    case 2: return 500;
    case 3: return 1000;
    case 4: return 2000;
    default: return 300;
  }
}

function normalizePlace(place: any): GooglePlace {
  return {
    id: place.place_id,
    name: place.name,
    latitude: place.geometry?.location?.lat,
    longitude: place.geometry?.location?.lng,
    estimated_cost: mapPriceLevel(place.price_level),
    rating: place.rating ?? null,
    types: place.types || [],
    source: "google_places",
  };
}

// 🔥 DRY query builder
function buildQuery(query: string, city: string) {
  return `${query} in ${city}`;
}

// ===== MAIN FUNCTION =====
export async function fetchGooglePlaces(
  query: string,
  city: string
): Promise<GooglePlace[]> {

  if (!API_KEY) {
    console.error("[googlePlaces] Missing API key");
    return [];
  }

  const finalQuery = buildQuery(query, city);
  const cacheKey = finalQuery.toLowerCase();

  // ---- CACHE HIT ----
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.debug(`[googlePlaces] cache HIT for "${finalQuery}"`);
    return cached.data;
  }

  // ---- QUOTA GUARD ----
  if (monthlyUsage >= MONTHLY_LIMIT) {
    console.warn("[googlePlaces] quota limit reached");
    return [];
  }

  try {
    const url = `${GOOGLE_BASE_URL}?query=${encodeURIComponent(finalQuery)}&key=${API_KEY}`;

    console.debug(`[googlePlaces] requesting: "${finalQuery}"`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[googlePlaces] HTTP error ${response.status}`);
      return [];
    }

    const data = await response.json();

    // 🔥 IMPORTANT: check API status
    if (data.status !== "OK") {
      console.warn(`[googlePlaces] API status: ${data.status}`, data.error_message);
      return [];
    }

    const results: GooglePlace[] =
      data.results?.slice(0, 10).map(normalizePlace) || [];

    console.debug(`[googlePlaces] results=${results.length}`);

    // ---- TRACK USAGE ----
    if (results.length > 0) {
      monthlyUsage++;
    }

    // ---- CACHE STORE ----
    cache.set(cacheKey, {
      data: results,
      expiry: Date.now() + TTL,
    });

    return results;

  } catch (error) {
    console.error("[googlePlaces] fetch failed:", error);
    return [];
  }
}