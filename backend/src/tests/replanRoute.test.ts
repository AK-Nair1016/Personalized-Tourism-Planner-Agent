const runtimeRequire = eval('require') as any;
export {};
const request = runtimeRequire('supertest') as typeof import('supertest');

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message ?? 'Expected condition to be true');
  }
}

function mockModule(modulePath: string, exports: Record<string, unknown>) {
  const resolvedPath = runtimeRequire.resolve(modulePath);
  delete runtimeRequire.cache[resolvedPath];
  runtimeRequire.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports,
    children: [],
    path: resolvedPath,
    paths: [],
    isPreloading: false,
  } as any;
}

function clearModule(modulePath: string) {
  try {
    delete runtimeRequire.cache[runtimeRequire.resolve(modulePath)];
  } catch {
    // ignore cache misses
  }
}

type SlotName = 'morning' | 'afternoon' | 'evening';

type FixtureAttraction = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  avgCost: number;
  estimated_cost: number;
  avgDurationMinutes: number;
  category: { name: string };
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  bestTimeSlot: SlotName;
  intensityLevel: number;
  source: 'seed_data';
  proximityScore?: number;
  accessibilityScore?: number;
  tags?: string[];
};

type FixtureSlot = {
  slot: SlotName;
  attraction_id: string;
  attraction_name: string;
  category: string;
  duration_minutes: number;
  coordinates: { lat: number; lng: number };
  vibe_note: string;
  estimated_cost: number;
};

type RouteFixture = {
  name: string;
  disruption: {
    day: number;
    slot: SlotName;
    description: string;
  };
  existingItinerary: {
    city: string;
    currency: string;
    total_cost_estimate: number;
    days: Array<{
      day: number;
      date_label: string;
      cluster_area: string;
      day_cost_estimate: number;
      slots: FixtureSlot[];
    }>;
  };
  candidatePool: FixtureAttraction[];
  expectedReplacementName: string;
  expectedRejectedNames: string[];
  expectedUnchangedNames: string[];
  verifyReplacement: (replacementSlot: any) => void;
  mockVibeNote?: string;
};

const userProfile = {
  city: 'Goa',
  vibe: ['culture_nerd'],
  firstVisit: false,
  group: 'couple',
  arrivalDate: '2026-06-14',
  departureDate: '2026-06-16',
  arrivalTime: '10:00',
  departureTime: '18:00',
  hotelArea: 'Panjim',
  budget: 20000,
  currency: 'INR',
  budgetSplit: 'balanced',
  pace: 'relaxed',
  wakeUpStyle: 'mid_morning',
  transportPreference: 'mix',
  dietary: 'none',
  mobilityNeeds: false,
  ageGroup: 'adults',
  mustVisit: [],
  avoid: [],
};

function createSlot(
  slot: SlotName,
  attractionId: string,
  attractionName: string,
  category: string,
  estimatedCost = 300
): FixtureSlot {
  return {
    slot,
    attraction_id: attractionId,
    attraction_name: attractionName,
    category,
    duration_minutes: 90,
    coordinates: { lat: 15.5, lng: 73.82 },
    vibe_note: `${attractionName} fits the trip.`,
    estimated_cost: estimatedCost,
  };
}

function buildRouteFixtureApp(fixture: RouteFixture) {
  const modulesToClear = [
    '../app',
    '../routes/itinerary.Routes',
    '../controllers/itinerary.Controller',
    '../graph/plannerGraph',
    '../graph/replanDisruption',
    '../graph/replanUtils',
  ];

  modulesToClear.forEach(clearModule);

  mockModule('../lib/prisma', {
    prisma: {
      city: {
        findFirst: async () => ({
          id: 'city-goa',
          name: 'Goa',
          country: { currencyCode: 'INR', currencySymbol: 'Rs' },
        }),
      },
      itinerary: {
        findUnique: async () => ({
          id: 'itinerary-1',
          userProfileJson: userProfile,
          itineraryJson: fixture.existingItinerary,
        }),
        create: async () => ({}),
      },
      replanLog: {
        create: async () => ({ id: 'replan-log-1' }),
      },
      attraction: {
        findMany: async () => [],
      },
    },
  });

  mockModule('../services/attractionsEnhanced', {
    getEnhancedAttractions: async () => fixture.candidatePool,
  });

  mockModule('../processing/calculateBudget', {
    calculateBudget: async () => ({
      effectiveDays: 1,
      dailyBudgetCap: 2500,
      totalBudget: 20000,
      categoryAllocation: {},
      flaggedExpensive: [],
    }),
  });

  mockModule('../processing/clusterByProximity', {
    clusterByProximity: async (_profile: any, attractions: FixtureAttraction[]) => [
      {
        day: fixture.disruption.day,
        clusterCenter: 'Panjim',
        slots: attractions.map((attraction) => ({
          slot: fixture.disruption.slot,
          attractionId: attraction.id,
        })),
      },
    ],
  });

  mockModule('../processing/ensureDiversity', {
    ensureDiversity: async (_profile: any, clusters: any[]) => ({
      adjustedClusters: clusters,
      flaggedDays: [],
    }),
  });

  mockModule('../agents/vibeAgent', {
    vibeAgent: async (_profile: any, attractions: FixtureAttraction[]) => ({
      vibeOutput: attractions.map((attraction) => ({
        attraction_id: attraction.id,
        vibe_fit_score: 0.95,
        reason: `${attraction.name} matches the trip vibe.`,
      })),
      tokensUsed: 111,
      meta: {
        usedFallback: false,
        retryCount: 0,
        llmSuccess: true,
      },
    }),
  });

  mockModule('../agents/reconcilerAgent', {
    reconcilerAgent: async (
      _profile: any,
      _vibeOutput: any[],
      _budgetOutput: any,
      logisticsOutput: Array<{ slots: Array<{ slot: SlotName; attractionId: string }> }>,
      _diversityOutput: any,
      attractions: FixtureAttraction[],
      options?: { disruption?: { day: number; slot: SlotName } }
    ) => {
      const chosenSlot = logisticsOutput[0]?.slots?.[0];
      const chosenAttraction = attractions.find((attraction) => attraction.id === chosenSlot?.attractionId);
      if (!chosenAttraction) {
        throw new Error(`${fixture.name}: no replacement survived filtering`);
      }

      return {
        itinerary: {
          city: 'Goa',
          currency: 'INR',
          total_cost_estimate: chosenAttraction.estimated_cost,
          days: [
            {
              day: options?.disruption?.day ?? fixture.disruption.day,
              date_label: fixture.existingItinerary.days[fixture.disruption.day - 1].date_label,
              cluster_area: fixture.existingItinerary.days[fixture.disruption.day - 1].cluster_area,
              day_cost_estimate: chosenAttraction.estimated_cost,
              slots: [
                {
                  slot: chosenSlot?.slot ?? fixture.disruption.slot,
                  attraction_id: chosenAttraction.id,
                  attraction_name: chosenAttraction.name,
                  category: chosenAttraction.category.name,
                  duration_minutes: chosenAttraction.avgDurationMinutes,
                  coordinates: {
                    lat: chosenAttraction.latitude,
                    lng: chosenAttraction.longitude,
                  },
                  vibe_note: fixture.mockVibeNote ?? `${chosenAttraction.name} is the safe replacement.`,
                  estimated_cost: chosenAttraction.estimated_cost,
                },
              ],
            },
          ],
        },
        tokensUsed: 222,
        meta: {
          usedFallback: false,
          retryCount: 0,
          llmSuccess: true,
        },
      };
    },
  });

  return runtimeRequire('../app').default;
}

async function runRouteFixture(fixture: RouteFixture) {
  const app = buildRouteFixtureApp(fixture);

  const response = await request(app)
    .post('/api/itinerary/replan')
    .send({
      itineraryId: 'itinerary-1',
      disruption: fixture.disruption,
    });

  assertEqual(response.status, 200, `${fixture.name}: expected HTTP 200`);

  const day = response.body.days.find((item: any) => item.day === fixture.disruption.day);
  assertTrue(Boolean(day), `${fixture.name}: expected disrupted day to exist in response`);

  const slots = day.slots;
  const slotNames = slots.map((slot: any) => slot.slot);
  assertEqual(slotNames.join(','), 'morning,afternoon,evening', `${fixture.name}: expected exactly one morning/afternoon/evening slot`);

  const replacedSlot = slots.find((slot: any) => slot.slot === fixture.disruption.slot);
  assertTrue(Boolean(replacedSlot), `${fixture.name}: expected disrupted slot to exist after replan`);
  assertEqual(replacedSlot.attraction_name, fixture.expectedReplacementName, `${fixture.name}: expected the correct replacement`);

  for (const rejectedName of fixture.expectedRejectedNames) {
    assertTrue(
      slots.every((slot: any) => slot.attraction_name !== rejectedName),
      `${fixture.name}: expected ${rejectedName} to be removed`
    );
  }

  for (const unchangedName of fixture.expectedUnchangedNames) {
    assertTrue(
      slots.some((slot: any) => slot.attraction_name === unchangedName),
      `${fixture.name}: expected ${unchangedName} to remain unchanged`
    );
  }

  fixture.verifyReplacement(replacedSlot);

  return response.body;
}

async function run() {
  const routeLevelFixture: RouteFixture = {
    name: 'Route-level test replaces disrupted slot without breaking day structure',
    disruption: {
      day: 2,
      slot: 'morning',
      description: 'Waterfall closed due to weather',
    },
    existingItinerary: {
      city: 'Goa',
      currency: 'INR',
      total_cost_estimate: 1200,
      days: [
        {
          day: 1,
          date_label: '2026-06-14',
          cluster_area: 'Calangute',
          day_cost_estimate: 300,
          slots: [createSlot('morning', 'day1-beach', 'Baga Beach', 'beach')],
        },
        {
          day: 2,
          date_label: '2026-06-15',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'old-waterfall', 'Kuske Waterfall', 'nature'),
            createSlot('afternoon', 'keep-fontainhas', 'Fontainhas', 'landmark'),
            createSlot('evening', 'keep-market', 'Panjim Market', 'market'),
          ],
        },
      ],
    },
    candidatePool: [
      {
        id: 'unsafe-waterfall-2',
        name: 'Salaulim Dam',
        latitude: 15.24,
        longitude: 74.14,
        avgCost: 300,
        estimated_cost: 300,
        avgDurationMinutes: 120,
        category: { name: 'nature' },
        indoorOutdoor: 'outdoor',
        bestTimeSlot: 'morning',
        intensityLevel: 3,
        source: 'seed_data',
      },
      {
        id: 'safe-museum',
        name: 'Museum of Goa',
        latitude: 15.51,
        longitude: 73.79,
        avgCost: 450,
        estimated_cost: 450,
        avgDurationMinutes: 90,
        category: { name: 'museum' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'morning',
        intensityLevel: 1,
        source: 'seed_data',
      },
    ],
    expectedReplacementName: 'Museum of Goa',
    expectedRejectedNames: ['Kuske Waterfall', 'Salaulim Dam'],
    expectedUnchangedNames: ['Fontainhas', 'Panjim Market'],
    verifyReplacement: (replacementSlot) => {
      assertTrue(replacementSlot.category !== 'nature', 'Route-level test: replacement must respect non-waterfall constraint');
    },
  };

  const weatherFixture: RouteFixture = {
    ...routeLevelFixture,
    name: 'Test A - Weather removes waterfall and avoids outdoor nature replacement',
    verifyReplacement: (replacementSlot) => {
      assertTrue(replacementSlot.category !== 'nature', 'Weather test: replacement must not be nature');
      assertTrue(replacementSlot.attraction_name !== 'Kuske Waterfall', 'Weather test: old waterfall must stay removed');
    },
  };

  const museumFixture: RouteFixture = {
    name: 'Test B - Museum removes museum and avoids museum replacement',
    disruption: {
      day: 1,
      slot: 'afternoon',
      description: 'Museum closed for maintenance',
    },
    existingItinerary: {
      city: 'Goa',
      currency: 'INR',
      total_cost_estimate: 900,
      days: [
        {
          day: 1,
          date_label: '2026-06-14',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'keep-church', 'Basilica of Bom Jesus', 'landmark'),
            createSlot('afternoon', 'old-museum', 'Museum of Goa', 'museum'),
            createSlot('evening', 'keep-market', 'Panjim Market', 'market'),
          ],
        },
      ],
    },
    candidatePool: [
      {
        id: 'museum-2',
        name: 'Museum of Christian Art',
        latitude: 15.50,
        longitude: 73.91,
        avgCost: 350,
        estimated_cost: 350,
        avgDurationMinutes: 90,
        category: { name: 'museum' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'afternoon',
        intensityLevel: 1,
        source: 'seed_data',
      },
      {
        id: 'gallery',
        name: 'Azulejo Gallery',
        latitude: 15.49,
        longitude: 73.82,
        avgCost: 300,
        estimated_cost: 300,
        avgDurationMinutes: 75,
        category: { name: 'entertainment' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'afternoon',
        intensityLevel: 1,
        source: 'seed_data',
      },
    ],
    expectedReplacementName: 'Azulejo Gallery',
    expectedRejectedNames: ['Museum of Goa', 'Museum of Christian Art'],
    expectedUnchangedNames: ['Basilica of Bom Jesus', 'Panjim Market'],
    verifyReplacement: (replacementSlot) => {
      assertTrue(replacementSlot.category !== 'museum', 'Museum test: replacement must not be a museum');
    },
  };

  const transportFixture: RouteFixture = {
    name: 'Test C - Category closure avoids same-category replacement on evening slot',
    disruption: {
      day: 3,
      slot: 'evening',
      description: 'Viewpoint closed for maintenance',
    },
    existingItinerary: {
      city: 'Goa',
      currency: 'INR',
      total_cost_estimate: 900,
      days: [
        {
          day: 1,
          date_label: '2026-06-14',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'day1-a', 'Fontainhas', 'landmark'),
            createSlot('afternoon', 'day1-b', 'Panjim Market', 'market'),
            createSlot('evening', 'day1-c', 'Miramar Beach', 'beach'),
          ],
        },
        {
          day: 2,
          date_label: '2026-06-15',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'day2-a', 'Reis Magos Fort', 'landmark'),
            createSlot('afternoon', 'day2-b', 'Museum of Goa', 'museum'),
            createSlot('evening', 'day2-c', 'Casino Cruise', 'entertainment'),
          ],
        },
        {
          day: 3,
          date_label: '2026-06-16',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'day3-a', 'Latin Quarter Walk', 'landmark'),
            createSlot('afternoon', 'day3-b', 'Goa Science Centre', 'museum'),
            createSlot('evening', 'old-remote', 'Remote Cliff Viewpoint', 'viewpoint'),
          ],
        },
      ],
    },
    candidatePool: [
      {
        id: 'far-viewpoint',
        name: 'Hilltop Viewpoint',
        latitude: 15.90,
        longitude: 74.33,
        avgCost: 200,
        estimated_cost: 200,
        avgDurationMinutes: 90,
        category: { name: 'viewpoint' },
        indoorOutdoor: 'outdoor',
        bestTimeSlot: 'evening',
        intensityLevel: 3,
        source: 'seed_data',
        proximityScore: 0.1,
        accessibilityScore: 0.2,
        tags: ['far_distance'],
      },
      {
        id: 'nearby-mall',
        name: 'Mall de Goa',
        latitude: 15.53,
        longitude: 73.83,
        avgCost: 250,
        estimated_cost: 250,
        avgDurationMinutes: 80,
        category: { name: 'market' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'evening',
        intensityLevel: 1,
        source: 'seed_data',
        proximityScore: 0.9,
        accessibilityScore: 0.95,
      },
    ],
    expectedReplacementName: 'Mall de Goa',
    expectedRejectedNames: ['Remote Cliff Viewpoint', 'Hilltop Viewpoint'],
    expectedUnchangedNames: ['Latin Quarter Walk', 'Goa Science Centre'],
    verifyReplacement: (replacementSlot) => {
      assertEqual(replacementSlot.attraction_name, 'Mall de Goa', 'Category-closure test: expected non-viewpoint replacement');
    },
  };

  const duplicateAvoidanceFixture: RouteFixture = {
    name: 'Test D - Replan avoids picking an attraction already used in preserved slots',
    disruption: {
      day: 2,
      slot: 'morning',
      description: 'Closed for maintenance',
    },
    existingItinerary: {
      city: 'Singapore',
      currency: 'INR',
      total_cost_estimate: 900,
      days: [
        {
          day: 1,
          date_label: '2026-07-02',
          cluster_area: 'Marina Bay',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'day1-a', 'Gardens by the Bay', 'park'),
            createSlot('afternoon', 'day1-b', 'Merlion Park', 'park'),
            createSlot('evening', 'day1-c', 'Boat Quay', 'landmark'),
          ],
        },
        {
          day: 2,
          date_label: '2026-07-03',
          cluster_area: 'Marina Bay',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'old-rhapsody', 'Garden Rhapsody', 'entertainment'),
            createSlot('afternoon', 'keep-museum', 'Museum of Goa', 'museum'),
            createSlot('evening', 'keep-quay', 'Clarke Quay', 'nightlife'),
          ],
        },
      ],
    },
    candidatePool: [
      {
        id: 'keep-museum',
        name: 'Museum of Goa',
        latitude: 15.51,
        longitude: 73.79,
        avgCost: 450,
        estimated_cost: 450,
        avgDurationMinutes: 90,
        category: { name: 'museum' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'morning',
        intensityLevel: 1,
        source: 'seed_data',
      },
      {
        id: 'safe-market',
        name: 'Panjim Market',
        latitude: 15.50,
        longitude: 73.82,
        avgCost: 300,
        estimated_cost: 300,
        avgDurationMinutes: 75,
        category: { name: 'market' },
        indoorOutdoor: 'both',
        bestTimeSlot: 'morning',
        intensityLevel: 1,
        source: 'seed_data',
      },
    ],
    expectedReplacementName: 'Panjim Market',
    expectedRejectedNames: ['Garden Rhapsody'],
    expectedUnchangedNames: ['Museum of Goa', 'Clarke Quay'],
    verifyReplacement: (replacementSlot) => {
      assertEqual(
        replacementSlot.attraction_name,
        'Panjim Market',
        'Duplicate-avoidance test: expected the non-duplicate candidate to win'
      );
    },
  };

  const eveningMuseumGuardFixture: RouteFixture = {
    name: 'Test E - Evening slot rejects museum and falls back to safe non-museum slot',
    disruption: {
      day: 1,
      slot: 'evening',
      description: 'Show closed for maintenance',
    },
    existingItinerary: {
      city: 'Goa',
      currency: 'INR',
      total_cost_estimate: 900,
      days: [
        {
          day: 1,
          date_label: '2026-06-14',
          cluster_area: 'Panjim',
          day_cost_estimate: 900,
          slots: [
            createSlot('morning', 'keep-church', 'Basilica of Bom Jesus', 'landmark'),
            createSlot('afternoon', 'keep-fontainhas', 'Fontainhas', 'landmark'),
            createSlot('evening', 'keep-market', 'Panjim Market', 'market'),
          ],
        },
      ],
    },
    candidatePool: [
      {
        id: 'museum-evening',
        name: 'Museum of Christian Art',
        latitude: 15.50,
        longitude: 73.91,
        avgCost: 350,
        estimated_cost: 350,
        avgDurationMinutes: 90,
        category: { name: 'museum' },
        indoorOutdoor: 'indoor',
        bestTimeSlot: 'evening',
        intensityLevel: 1,
        source: 'seed_data',
      },
    ],
    expectedReplacementName: 'Fallback Landmark Day 1',
    expectedRejectedNames: ['Museum of Christian Art', 'Panjim Market'],
    expectedUnchangedNames: ['Basilica of Bom Jesus', 'Fontainhas'],
    verifyReplacement: (replacementSlot) => {
      assertEqual(replacementSlot.category, 'landmark', 'Evening fallback should coerce to landmark when original is disallowed');
    },
  };

  const vibeNoteFallbackFixture: RouteFixture = {
    ...routeLevelFixture,
    name: 'Test F - Invalid vibe_note is replaced with strict fallback sentence',
    mockVibeNote: 'Great vibe tonight.',
    verifyReplacement: (replacementSlot) => {
      assertEqual(
        replacementSlot.vibe_note,
        `${replacementSlot.attraction_name} is a great stop for this slot.`,
        'Expected strict vibe_note fallback sentence'
      );
    },
  };

  await runRouteFixture(routeLevelFixture);
  await runRouteFixture(weatherFixture);
  await runRouteFixture(museumFixture);
  await runRouteFixture(transportFixture);
  await runRouteFixture(duplicateAvoidanceFixture);
  await runRouteFixture(eveningMuseumGuardFixture);
  await runRouteFixture(vibeNoteFallbackFixture);

  console.log('replanRoute.test.ts passed');
}

run();
