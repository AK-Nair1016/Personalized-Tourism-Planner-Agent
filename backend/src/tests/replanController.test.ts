const runtimeRequire = eval('require') as any;
export {};

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

async function run() {
  const existingItinerary = {
    city: 'Goa',
    currency: 'INR',
    total_cost_estimate: 900,
    days: [
      {
        day: 1,
        date_label: '2026-06-14',
        cluster_area: 'Calangute',
        day_cost_estimate: 300,
        slots: [
          {
            slot: 'morning',
            attraction_id: 'old-day-1',
            attraction_name: 'Baga Beach',
            category: 'beach',
            duration_minutes: 120,
            coordinates: { lat: 15.5, lng: 73.75 },
            vibe_note: 'Beach start.',
            estimated_cost: 300,
          },
        ],
      },
      {
        day: 2,
        date_label: '2026-06-15',
        cluster_area: 'Panjim',
        day_cost_estimate: 900,
        slots: [
          {
            slot: 'morning',
            attraction_id: 'old-waterfall',
            attraction_name: 'Kuske Waterfall',
            category: 'nature',
            duration_minutes: 120,
            coordinates: { lat: 15.02, lng: 74.2 },
            vibe_note: 'Waterfall start.',
            estimated_cost: 300,
          },
          {
            slot: 'afternoon',
            attraction_id: 'keep-afternoon',
            attraction_name: 'Fontainhas',
            category: 'landmark',
            duration_minutes: 90,
            coordinates: { lat: 15.49, lng: 73.82 },
            vibe_note: 'Heritage walk.',
            estimated_cost: 300,
          },
          {
            slot: 'evening',
            attraction_id: 'keep-evening',
            attraction_name: 'Panjim Market',
            category: 'market',
            duration_minutes: 90,
            coordinates: { lat: 15.5, lng: 73.82 },
            vibe_note: 'Evening browse.',
            estimated_cost: 300,
          },
        ],
      },
    ],
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

  const candidatePool = [
    {
      id: 'unsafe-dam',
      name: 'Salaulim Dam',
      latitude: 15.24,
      longitude: 74.14,
      avgCost: 300,
      estimated_cost: 300,
      avgDurationMinutes: 120,
      category: { name: 'nature' },
      indoorOutdoor: 'outdoor',
      bestTimeSlot: 'morning',
      vibeTags: ['slow_traveller'],
      intensityLevel: 2,
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
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-landmark',
      name: 'Fontainhas Walk',
      latitude: 15.49,
      longitude: 73.82,
      avgCost: 300,
      estimated_cost: 300,
      avgDurationMinutes: 90,
      category: { name: 'landmark' },
      indoorOutdoor: 'both',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-market',
      name: 'Panjim Market Extension',
      latitude: 15.5,
      longitude: 73.83,
      avgCost: 250,
      estimated_cost: 250,
      avgDurationMinutes: 80,
      category: { name: 'market' },
      indoorOutdoor: 'both',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-landmark-2',
      name: 'Latin Quarter House',
      latitude: 15.48,
      longitude: 73.82,
      avgCost: 220,
      estimated_cost: 220,
      avgDurationMinutes: 70,
      category: { name: 'landmark' },
      indoorOutdoor: 'both',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-museum-2',
      name: 'Art Hall Goa',
      latitude: 15.47,
      longitude: 73.81,
      avgCost: 300,
      estimated_cost: 300,
      avgDurationMinutes: 75,
      category: { name: 'museum' },
      indoorOutdoor: 'indoor',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-landmark-3',
      name: 'Ribeira Street',
      latitude: 15.49,
      longitude: 73.8,
      avgCost: 180,
      estimated_cost: 180,
      avgDurationMinutes: 70,
      category: { name: 'landmark' },
      indoorOutdoor: 'both',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
    {
      id: 'safe-museum-3',
      name: 'Archive Goa',
      latitude: 15.5,
      longitude: 73.79,
      avgCost: 260,
      estimated_cost: 260,
      avgDurationMinutes: 65,
      category: { name: 'museum' },
      indoorOutdoor: 'indoor',
      bestTimeSlot: 'morning',
      vibeTags: ['culture_nerd'],
      intensityLevel: 1,
      source: 'seed_data',
    },
  ];

  const runPlannerGraphPath = runtimeRequire.resolve('../graph/plannerGraph');
  const controllerPath = runtimeRequire.resolve('../controllers/itinerary.Controller');
  delete runtimeRequire.cache[runPlannerGraphPath];
  delete runtimeRequire.cache[controllerPath];

  let loggedDisruption: any = null;
  let loggedUpdatedItinerary: any = null;
  let vibeAgentCalls = 0;
  let reconcilerAttractionCount = 0;

  mockModule('../lib/prisma', {
    prisma: {
      city: {
        findFirst: async () => ({
          name: 'Goa',
          country: { currencyCode: 'INR', currencySymbol: '₹' },
        }),
      },
      itinerary: {
        findUnique: async () => ({
          id: 'itinerary-1',
          userProfileJson: userProfile,
          itineraryJson: existingItinerary,
        }),
        create: async () => ({}),
      },
      replanLog: {
        create: async ({ data }: { data: any }) => {
          loggedDisruption = data.disruptionJson;
          loggedUpdatedItinerary = data.updatedItineraryJson;
          return { id: 'replan-log-1' };
        },
      },
    },
  });

  mockModule('../services/attractionsEnhanced', {
    getEnhancedAttractions: async () => candidatePool,
  });

  mockModule('../processing/calculateBudget', {
    calculateBudget: async () => ({
      effectiveDays: 1,
      dailyBudgetCap: 2000,
      totalBudget: 20000,
      categoryAllocation: {},
      flaggedExpensive: [],
    }),
  });

  mockModule('../processing/clusterByProximity', {
    clusterByProximity: (_profile: any, attractions: any[]) => [
      {
        day: 2,
        clusterCenter: 'Panjim',
        slots: attractions.slice(0, 1).map((attraction: any, index: number) => ({
          slot: index === 0 ? 'morning' : 'afternoon',
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
    vibeAgent: async (_profile: any, attractions: any[]) => {
      vibeAgentCalls += 1;
      return {
      vibeOutput: attractions.map((attraction: any) => ({
        attraction_id: attraction.id,
        vibe_fit_score: 0.95,
        reason: 'fixture fit',
      })),
      tokensUsed: 111,
      meta: {
        usedFallback: false,
        retryCount: 0,
        llmSuccess: true,
      },
    };
    },
  });

  mockModule('../agents/reconcilerAgent', {
    reconcilerAgent: async (
      _profile: any,
      _vibeOutput: any[],
      _budgetOutput: any,
      logisticsOutput: any[],
      _diversityOutput: any,
      attractions: any[]
    ) => {
      reconcilerAttractionCount = attractions.length;
      const targetSlot = logisticsOutput[0]?.slots?.[0];
      const chosenAttraction = attractions.find((attraction: any) => attraction.id === targetSlot?.attractionId);

      return {
        itinerary: {
          city: 'Goa',
          currency: 'INR',
          total_cost_estimate: chosenAttraction?.estimated_cost ?? 0,
          days: [
            {
              day: 2,
              date_label: '2026-06-15',
              cluster_area: 'Panjim',
              day_cost_estimate: chosenAttraction?.estimated_cost ?? 0,
              slots: [
                {
                  slot: targetSlot?.slot ?? 'morning',
                  attraction_id: chosenAttraction.id,
                  attraction_name: chosenAttraction.name,
                  category: chosenAttraction.category.name,
                  duration_minutes: chosenAttraction.avgDurationMinutes,
                  coordinates: {
                    lat: chosenAttraction.latitude,
                    lng: chosenAttraction.longitude,
                  },
                  vibe_note: `${chosenAttraction.name} is a safe indoor replacement.`,
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

  const { replanItinerary } = runtimeRequire('../controllers/itinerary.Controller') as {
    replanItinerary: (req: any, res: any, next: (error?: unknown) => void) => Promise<void>;
  };

  let statusCode = 200;
  let jsonPayload: any = null;
  let nextError: unknown = null;
  const headers = new Map<string, string>();

  const req = {
    body: {
      itineraryId: 'itinerary-1',
      disruption: {
        day: 2,
        slot: 'Morning',
        description: 'Waterfall closed due to weather',
      },
    },
    header: (name: string) => (name === 'x-request-id' ? 'fixture-request-id' : undefined),
  };

  const res = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: any) => {
      jsonPayload = payload;
      return payload;
    },
  };

  const next = (error?: unknown) => {
    nextError = error ?? null;
  };

  const capturedLogs: string[] = [];
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    capturedLogs.push(args.map((value) => String(value)).join(' '));
    originalConsoleLog(...args);
  };
  try {
    await replanItinerary(req, res, next);
  } finally {
    console.log = originalConsoleLog;
  }

  assertEqual(nextError, null);
  assertEqual(statusCode, 200);
  assertEqual(headers.get('x-request-id'), 'fixture-request-id');
  assertEqual(jsonPayload.days[1].slots[0].slot, 'morning');
  assertEqual(jsonPayload.days[1].slots[0].attraction_name, 'Museum of Goa');
  assertEqual(jsonPayload.days[1].slots[1].attraction_name, 'Fontainhas');
  assertEqual(jsonPayload.days[1].slots[2].attraction_name, 'Panjim Market');
  assertTrue(
    jsonPayload.days[1].slots.every((slot: any) => slot.attraction_name !== 'Kuske Waterfall'),
    'Expected old disrupted slot to be removed from the replanned day'
  );
  assertEqual(jsonPayload.tokensUsed, 222);
  assertEqual(jsonPayload.replan_context.disruption.day, 2);
  assertEqual(jsonPayload.replan_context.disruption.slot, 'morning');
  assertTrue(
    jsonPayload.replan_context.policy.rationale.length > 0,
    'Expected replan response to expose policy rationale'
  );
  assertEqual(vibeAgentCalls, 0, 'Replan flow must skip vibeAgent');
  assertTrue(reconcilerAttractionCount <= 6, 'Replan candidates must be capped to 6');
  assertTrue(
    capturedLogs.some((line) => line.includes('[replan] validation_applied')),
    'Expected [replan] validation_applied log'
  );
  assertTrue(
    capturedLogs.some((line) => line.includes('[replan] fixes')),
    'Expected [replan] fixes log'
  );
  assertEqual(loggedDisruption.day, 2);
  assertEqual(loggedDisruption.slot, 'morning');
  assertEqual(loggedDisruption.description, 'Waterfall closed due to weather');
  assertEqual(loggedUpdatedItinerary.days[1].slots[0].attraction_name, 'Museum of Goa');

  console.log('replanController.test.ts passed');
}

run();
