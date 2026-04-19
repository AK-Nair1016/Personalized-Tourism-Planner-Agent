// backend/src/services/googlePlaces.ts

const GOOGLE_BASE_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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
const MONTHLY_LIMIT = 400; // keep buffer below 500 free tier

// ===== HELPERS =====

// Convert Google price_level (0–4) → estimated cost (INR)
function mapPriceLevel(priceLevel?: number): number {
  switch (priceLevel) {
    case 0: return 0;
    case 1: return 200;
    case 2: return 500;
    case 3: return 1000;
    case 4: return 2000;
    default: return 300; // fallback
  }
}

// Normalize Google response → internal format
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

// ===== MAIN FUNCTION =====
export async function fetchGooglePlaces(query: string, city: string) {
  // ---- HARD LIMIT GUARD ----
  if (monthlyUsage >= MONTHLY_LIMIT) {
    console.warn("Google Places quota limit reached");
    return [];
  }

  try {
    const url = `${GOOGLE_BASE_URL}?query=${encodeURIComponent(
      `${query} in ${city}`
    )}&key=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();

    const results = data.results?.slice(0, 10).map(normalizePlace) || [];

    // ---- TRACK USAGE ----
    if (results.length > 0) {
      monthlyUsage++;
    }

    return results;

  } catch (error) {
    console.error("Google Places fetch failed:", error);
    return [];
  }
}