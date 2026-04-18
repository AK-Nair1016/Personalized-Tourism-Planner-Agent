import { prisma } from '../../../src/lib/prisma';
import { bangkokAttractions } from './bangkok.seed';
import { goaAttractions } from './goa.seed';
import { singaporeAttractions } from './singapore.seed';
import { dubaiAttractions } from './dubai.seed';

type CountrySeed = {
  name: string;
  currencyCode: string;
  currencySymbol: string;
};

type CitySeed = {
  name: string;
  countryName: string;
  timezone: string;
};

type CategorySeed = {
  name: string;
  vibeTags: string[];
};

type AttractionSeed = {
  placeId: string;
  name: string;
  description: string | null;
  category: string;
  avgCost: number;
  avgDurationMinutes: number;
  latitude: number;
  longitude: number;
  rating: number | null;
  reviewCount: number;
  bestTimeSlot: 'morning' | 'afternoon' | 'evening';
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  intensityLevel: number;
  vibeTags: string[];
  bookingUrl: string | null;
};

const COUNTRIES: CountrySeed[] = [
  { name: 'Thailand', currencyCode: 'THB', currencySymbol: '฿' },
  { name: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { name: 'Singapore', currencyCode: 'SGD', currencySymbol: 'S$' },
  { name: 'UAE', currencyCode: 'AED', currencySymbol: 'د.إ' },
];

const CITIES: CitySeed[] = [
  { name: 'Bangkok', countryName: 'Thailand', timezone: 'Asia/Bangkok' },
  { name: 'Goa', countryName: 'India', timezone: 'Asia/Kolkata' },
  { name: 'Singapore', countryName: 'Singapore', timezone: 'Asia/Singapore' },
  { name: 'Dubai', countryName: 'UAE', timezone: 'Asia/Dubai' },
];

const CATEGORIES: CategorySeed[] = [
  { name: 'museum', vibeTags: ['culture_nerd', 'slow_traveller'] },
  { name: 'landmark', vibeTags: ['culture_nerd', 'adventurer'] },
  { name: 'temple', vibeTags: ['culture_nerd', 'slow_traveller'] },
  { name: 'entertainment', vibeTags: ['adventurer', 'night_owl'] },
  { name: 'viewpoint', vibeTags: ['adventurer', 'slow_traveller'] },
  { name: 'market', vibeTags: ['budget_explorer', 'foodie'] },
  { name: 'nightlife', vibeTags: ['night_owl', 'foodie'] },
  { name: 'food', vibeTags: ['foodie', 'budget_explorer'] },
  { name: 'park', vibeTags: ['slow_traveller', 'family'] },
  { name: 'beach', vibeTags: ['slow_traveller', 'adventurer'] },
  { name: 'nature', vibeTags: ['adventurer', 'slow_traveller'] },
];

const DESTINATION_ATTRACTIONS: Record<string, AttractionSeed[]> = {
  Bangkok: bangkokAttractions,
  Goa: goaAttractions,
  Singapore: singaporeAttractions,
  Dubai: dubaiAttractions,
};

async function upsertCountries() {
  const countryIdByName = new Map<string, string>();

  for (const country of COUNTRIES) {
    const record = await prisma.country.upsert({
      where: { name: country.name },
      update: {
        currencyCode: country.currencyCode,
        currencySymbol: country.currencySymbol,
      },
      create: country,
    });

    countryIdByName.set(record.name, record.id);
  }

  return countryIdByName;
}

async function upsertCities(countryIdByName: Map<string, string>) {
  const cityIdByName = new Map<string, string>();

  for (const city of CITIES) {
    const countryId = countryIdByName.get(city.countryName);
    if (!countryId) {
      throw new Error(`Missing country for city ${city.name}: ${city.countryName}`);
    }

    const record = await prisma.city.upsert({
      where: { name: city.name },
      update: {
        countryId,
        timezone: city.timezone,
      },
      create: {
        name: city.name,
        countryId,
        timezone: city.timezone,
      },
    });

    cityIdByName.set(record.name, record.id);
  }

  return cityIdByName;
}

async function upsertCategories() {
  const categoryIdByName = new Map<string, string>();

  for (const category of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { name: category.name },
      update: { vibeTags: category.vibeTags },
      create: category,
    });

    categoryIdByName.set(record.name, record.id);
  }

  return categoryIdByName;
}

async function upsertAttractions(
  cityIdByName: Map<string, string>,
  categoryIdByName: Map<string, string>
) {
  const expectedPlaceIdsByCity = new Map<string, string[]>();

  for (const [cityName, attractions] of Object.entries(DESTINATION_ATTRACTIONS)) {
    const cityId = cityIdByName.get(cityName);
    if (!cityId) {
      throw new Error(`Missing city id for ${cityName}`);
    }

    const expectedPlaceIds = attractions.map((attraction) => attraction.placeId);
    expectedPlaceIdsByCity.set(cityId, expectedPlaceIds);

    for (const attraction of attractions) {
      const categoryId = categoryIdByName.get(attraction.category);
      if (!categoryId) {
        throw new Error(`Missing category id for ${attraction.category}`);
      }

      await prisma.attraction.upsert({
        where: { placeId: attraction.placeId },
        update: {
          cityId,
          categoryId,
          name: attraction.name,
          description: attraction.description,
          avgCost: attraction.avgCost,
          avgDurationMinutes: attraction.avgDurationMinutes,
          latitude: attraction.latitude,
          longitude: attraction.longitude,
          rating: attraction.rating,
          reviewCount: attraction.reviewCount,
          bestTimeSlot: attraction.bestTimeSlot,
          indoorOutdoor: attraction.indoorOutdoor,
          intensityLevel: attraction.intensityLevel,
          vibeTags: attraction.vibeTags,
          bookingUrl: attraction.bookingUrl,
        },
        create: {
          placeId: attraction.placeId,
          cityId,
          categoryId,
          name: attraction.name,
          description: attraction.description,
          avgCost: attraction.avgCost,
          avgDurationMinutes: attraction.avgDurationMinutes,
          latitude: attraction.latitude,
          longitude: attraction.longitude,
          rating: attraction.rating,
          reviewCount: attraction.reviewCount,
          bestTimeSlot: attraction.bestTimeSlot,
          indoorOutdoor: attraction.indoorOutdoor,
          intensityLevel: attraction.intensityLevel,
          vibeTags: attraction.vibeTags,
          bookingUrl: attraction.bookingUrl,
        },
      });
    }
  }

  for (const [cityId, expectedPlaceIds] of expectedPlaceIdsByCity.entries()) {
    await prisma.attraction.deleteMany({
      where: {
        cityId,
        placeId: {
          notIn: expectedPlaceIds,
        },
      },
    });
  }
}

async function logSummary() {
  const rows = await prisma.city.findMany({
    where: {
      name: {
        in: Object.keys(DESTINATION_ATTRACTIONS),
      },
    },
    include: {
      _count: {
        select: {
          attractions: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const total = rows.reduce((sum, city) => sum + city._count.attractions, 0);

  console.log('Seed summary by city:');
  for (const city of rows) {
    console.log(`- ${city.name}: ${city._count.attractions} attractions`);
  }
  console.log(`Total attractions (4 destinations): ${total}`);
}

async function main() {
  const countryIdByName = await upsertCountries();
  const cityIdByName = await upsertCities(countryIdByName);
  const categoryIdByName = await upsertCategories();

  await upsertAttractions(cityIdByName, categoryIdByName);
  await logSummary();
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
