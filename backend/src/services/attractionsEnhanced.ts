import { prisma } from "../lib/prisma";
import { fetchGooglePlaces, type GooglePlace } from "./googlePlaces";
import { dedupePlaces } from "../utils/dedupePlaces";

type EnhancedAttraction = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  avgCost: number;
  estimated_cost: number;
  avgDurationMinutes: number;
  category?: { name: string };
  rating?: number | null;
  bestTimeSlot?: string | null;
  indoorOutdoor?: 'indoor' | 'outdoor' | 'both' | null;
  intensityLevel?: number | null;
  vibeTags?: string[];
  source: "google_places" | "seed_data";
};

const DEFAULT_ATTRACTION_COST = 300;
const DEFAULT_DURATION_MINUTES = 90;

function normalizeCost(value: unknown) {
  const cost = Number(value);
  return Number.isFinite(cost) && cost > 0 ? cost : DEFAULT_ATTRACTION_COST;
}

// ===== MAIN SERVICE =====
export async function getEnhancedAttractions(
  cityId: string,
  cityName: string,
  query?: string
): Promise<EnhancedAttraction[]> {

  console.log("🔥 getEnhancedAttractions CALLED", { cityId, cityName, query });

  // ---- STEP 1: Fetch DB (ALWAYS) ----
  let dbAttractions: EnhancedAttraction[] = [];

  try {
    const attractions = await prisma.attraction.findMany({
      where: { cityId },
      include: { category: true },
    });

    dbAttractions = attractions.map((a: any) => ({
      id: a.id,
      name: a.name,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      avgCost: normalizeCost(a.avgCost),
      estimated_cost: normalizeCost(a.avgCost),
      avgDurationMinutes: a.avgDurationMinutes || DEFAULT_DURATION_MINUTES,
      category: { name: a.category.name },
      rating: a.rating,
      bestTimeSlot: a.bestTimeSlot,
      indoorOutdoor: a.indoorOutdoor as 'indoor' | 'outdoor' | 'both',
      intensityLevel: a.intensityLevel,
      vibeTags: Array.isArray(a.vibeTags) ? a.vibeTags : [],
      source: "seed_data" as const,
    }));

  } catch (error) {
    console.error("Seed data fetch failed:", error);
  }

  // ---- STEP 2: Fetch Google (ALWAYS TRY) ----
  let googleMapped: EnhancedAttraction[] = [];

  try {
    const searchQuery = query || "top tourist attractions in ";

    console.debug(`[googlePlaces] attempting query="${searchQuery}" city="${cityName}"`);

    const googleResults: GooglePlace[] = await fetchGooglePlaces(searchQuery, cityName);

    console.debug(`[googlePlaces] results=${googleResults.length} city=${cityName}`);

    googleMapped = googleResults.map((place) => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      avgCost: normalizeCost(place.estimated_cost),
      estimated_cost: normalizeCost(place.estimated_cost),
      avgDurationMinutes: DEFAULT_DURATION_MINUTES,
      category: { name: place.types?.[0] || "general" },
      rating: place.rating,
      bestTimeSlot: null,
      indoorOutdoor: null,
      intensityLevel: null,
      vibeTags: [],
      source: "google_places" as const,
    }));

  } catch (err) {
    console.warn("Google fetch failed, continuing with DB only");
  }

  // ---- STEP 3: Merge + dedupe ----
  const merged = dedupePlaces(dbAttractions, googleMapped);

  console.debug(
    `[attractions] merged=${merged.length} (db=${dbAttractions.length}, google=${googleMapped.length})`
  );

  return merged as EnhancedAttraction[];
}
