import {
  buildDisruptionAwareProfile,
  deriveDisruptionPolicy,
  filterAndRankAttractionsForDisruption,
  getPreservedAttractionExclusions,
  getDisruptedSlotContext,
} from '../graph/replanDisruption';

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(message ?? `Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertIncludes<T>(actual: T[], expected: T, message?: string) {
  if (!actual.includes(expected)) {
    throw new Error(
      message ?? `Expected array to include ${String(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function run() {
  const existingItinerary = {
    days: [
      {
        day: 2,
        slots: [
          {
            slot: 'morning',
            attraction_id: 'old-waterfall',
            attraction_name: 'Kuske Waterfall',
            category: 'nature',
          },
          {
            slot: 'afternoon',
            attraction_id: 'keep-fontainhas',
            attraction_name: 'Fontainhas',
            category: 'landmark',
          },
          {
            slot: 'evening',
            attraction_id: 'keep-market',
            attraction_name: 'Panjim Market',
            category: 'market',
          },
        ],
      },
    ],
  };

  const weatherDisruption = {
    day: 2,
    slot: 'morning' as const,
    description: 'Waterfall closed due to weather',
  };

  const weatherContext = getDisruptedSlotContext(existingItinerary, weatherDisruption);
  const weatherPolicy = deriveDisruptionPolicy(weatherDisruption, weatherContext);
  assertDeepEqual(
    weatherPolicy.disallowedCategories,
    ['nature', 'beach', 'park'],
    'Weather policy must contain strict disallowed categories'
  );
  assertEqual(weatherPolicy.requireAccessible, false);
  assertEqual(weatherPolicy.preferNearby, false);
  assertDeepEqual(weatherPolicy.preferredCategories, []);

  const closureDisruption = {
    day: 2,
    slot: 'morning' as const,
    description: 'Closed for maintenance',
  };
  const closurePolicy = deriveDisruptionPolicy(closureDisruption, weatherContext);
  assertDeepEqual(
    closurePolicy.disallowedCategories,
    ['nature'],
    'Category closure policy must disallow only the disrupted slot category'
  );

  const exclusions = getPreservedAttractionExclusions(existingItinerary, closureDisruption);
  assertIncludes(exclusions.attractionIds, 'old-waterfall');
  assertIncludes(exclusions.attractionIds, 'keep-fontainhas');
  assertIncludes(exclusions.attractionIds, 'keep-market');

  const ranked = filterAndRankAttractionsForDisruption(
    [
      {
        id: 'old-waterfall',
        name: 'Kuske Waterfall',
        category: { name: 'nature' },
      },
      {
        id: 'keep-market',
        name: 'Panjim Market',
        category: { name: 'market' },
      },
      {
        id: 'safe-museum',
        name: 'Museum of Goa',
        category: { name: 'museum' },
      },
    ],
    weatherPolicy,
    exclusions
  );

  assertDeepEqual(
    ranked.map((candidate) => (candidate as any).name),
    ['Museum of Goa'],
    'Ranking should keep only non-disallowed and non-duplicate candidates'
  );

  const profile = buildDisruptionAwareProfile(
    {
      city: 'Goa',
      avoid: ['crowded clubs'],
    } as any,
    weatherPolicy
  );
  assertDeepEqual(profile.avoid, ['crowded clubs']);

  console.log('replanDisruption.test.ts passed');
}

run();
