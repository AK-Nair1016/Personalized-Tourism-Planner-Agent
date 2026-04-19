import { prisma } from "../lib/prisma";
import { fetchGooglePlaces, type GooglePlace } from "./googlePlaces";

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

  // ---- STEP 1: Try Google ----
  if (query) {
    const googleResults: GooglePlace[] = await fetchGooglePlaces(query, cityName);

    if (googleResults.length > 0) {
      return googleResults.map((place) => ({
        id: place.id,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        estimated_cost: place.estimated_cost,
        rating: place.rating,
        source: "google_places",
      }));
    }
  }

  // ---- STEP 2: Fallback to DB ----
  try {
    const attractions = await prisma.attraction.findMany({
      where: { cityId },
      include: { category: true },
    });

    return attractions.map((a) => ({
      id: a.id,
      name: a.name,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      estimated_cost: Number(a.avgCost),
      rating: a.rating,
      source: "seed_data",
    }));

  } catch (error) {
    console.error("Seed data fetch failed:", error);
    return [];
  }
}