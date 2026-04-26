import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { convertInrToLocal, getCurrencySymbol } from '../utils/currency';
import { fetchGooglePlaces, type GooglePlace } from '../services/googlePlaces';
import { dedupePlaces } from '../utils/dedupePlaces';

export async function getAttractions(req: Request, res: Response, next: NextFunction) {
  try {
    const { cityId, category, maxCost, query } = req.query;

    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    // ---- STEP 1: Existing DB logic ----
    console.debug(`[attractions] cityId=${cityId} query=${query ?? "none"}`);

    const attractions = await prisma.attraction.findMany({
      where: {
        cityId: String(cityId),
        ...(category && { category: { name: String(category) } }),
        ...(maxCost && { avgCost: { lte: Number(maxCost) } }),
      },
      include: {
        category: true,
        city: { include: { country: true } },
      },
    });

    // ---- STEP 2: Existing normalization ----
    const normalized = attractions.map((attraction: any) => {
      const localCurrencyCode = attraction.city.country.currencyCode;
      const localCurrencySymbol =
        attraction.city.country.currencySymbol || getCurrencySymbol(localCurrencyCode);

      return {
        ...attraction,
        avgCostInr: attraction.avgCost,
        avgCostLocal: convertInrToLocal(attraction.avgCost, localCurrencyCode),
        localCurrencyCode,
        localCurrencySymbol,
        source: 'seed_data' as const,
      };
    });

   // ---- STEP 3: OPTIONAL Google enrichment ----
if (query && typeof query === 'string') {
  const queryStr = query;

  try {
    let cityName: string | undefined = attractions[0]?.city?.name;

    // fallback if DB returned empty
    if (!cityName) {
      const city = await prisma.city.findUnique({
        where: { id: String(cityId) },
      });

      if (city?.name) {
        cityName = city.name;
      }
    }

    if (cityName) {
      console.debug(`[googlePlaces] attempting query="${queryStr}" city="${cityName}"`);

      const googleResults: GooglePlace[] = await fetchGooglePlaces(queryStr, cityName);

      console.debug(`[googlePlaces] results=${googleResults.length} city=${cityName}`);

      if (googleResults.length > 0) {
        // 🔧 Map Google
        const googleMapped = googleResults.map((place) => ({
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          avgCostInr: place.estimated_cost,
          avgCostLocal: place.estimated_cost,
          localCurrencyCode: 'INR',
          localCurrencySymbol: '₹',
          rating: place.rating,
          source: 'google_places' as const,
        }));

        // 🔧 Map DB
        const dbMapped = normalized.map((a: any) => ({
          id: a.id,
          name: a.name,
          latitude: a.latitude,
          longitude: a.longitude,
          avgCostInr: a.avgCostInr,
          avgCostLocal: a.avgCostLocal,
          localCurrencyCode: a.localCurrencyCode,
          localCurrencySymbol: a.localCurrencySymbol,
          rating: a.rating,
          source: 'seed_data' as const,
        }));

        // 🔥 Merge + dedupe
        const merged = dedupePlaces(dbMapped, googleMapped);

        console.debug(
          `[attractions] merged=${merged.length} (db=${dbMapped.length}, google=${googleMapped.length})`
        );

        return res.json(merged);
      }
    } else {
      console.warn(`[googlePlaces] city not found for cityId=${cityId}`);
    }

  } catch (err) {
    console.warn('Google enrichment failed, falling back to DB');
  }
}

    // ---- STEP 4: Default response ----
    console.debug(`[attractions] returning SEED data`);
    res.json(normalized);

  } catch (err) {
    next(err);
  }
}
