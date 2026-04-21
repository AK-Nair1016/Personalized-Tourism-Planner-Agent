import { prisma } from "../lib/prisma";
import { fetchGooglePlaces, type GooglePlace } from "./googlePlaces";
import { dedupePlaces } from "../utils/dedupePlaces";

type EnhancedAttraction = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  estimated_cost: number;
  rating?: number | null;
  source: "google_places" | "seed_data";
};

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

    dbAttractions = attractions.map((a) => ({
      id: a.id,
      name: a.name,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      estimated_cost: Number(a.avgCost),
      rating: a.rating,
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
      estimated_cost: place.estimated_cost,
      rating: place.rating,
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