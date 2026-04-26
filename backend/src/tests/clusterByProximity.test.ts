import { clusterByProximity } from '../processing/clusterByProximity';

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

function buildAttraction(id: string, name: string, latitude: number, longitude: number) {
  return {
    id,
    name,
    latitude,
    longitude,
    category: { name: 'landmark' },
  };
}

function run() {
  const userProfile = {
    vibe: ['culture_nerd'],
    firstVisit: true,
    group: 'solo',
    city: 'Dubai',
    arrivalDate: '2026-05-01',
    departureDate: '2026-05-03',
    arrivalTime: '10:00',
    departureTime: '18:00',
    hotelArea: 'Downtown Dubai',
    budget: 15000,
    currency: 'INR',
    budgetSplit: 'balanced',
    pace: 'moderate',
    wakeUpStyle: 'mid_morning',
    transportPreference: 'public',
    dietary: 'none',
    mobilityNeeds: false,
    ageGroup: 'adults',
    mustVisit: [],
    avoid: [],
  } as any;

  const attractions = [
    buildAttraction('a1', 'Museum of the Future', 25.2203, 55.2823),
    buildAttraction('a2', 'Burj Khalifa', 25.1972, 55.2744),
    buildAttraction('a3', 'Al Fahidi Historical District', 25.2638, 55.2973),
    buildAttraction('a4', 'Dubai Fountain Boardwalk', 25.1945, 55.2797),
    buildAttraction('a5', 'Gold Souk Dubai', 25.2708, 55.2963),
    buildAttraction('a6', 'Jumeirah Public Beach', 25.2048, 55.2343),
  ];

  const clusters = clusterByProximity(userProfile, attractions, {
    effectiveDays: 2,
    dailyBudgetCap: 7500,
    categoryAllocation: {
      experiences: 3000,
      food: 2250,
      transport: 1500,
      buffer: 750,
    },
    flaggedExpensive: [],
  });

  assertEqual(clusters.length, 2, 'Expected a 2-day trip to produce 2 day clusters');
  assertDeepEqual(
    clusters[0].slots.map((slot) => slot.slot),
    ['morning', 'afternoon', 'evening'],
    'Expected day 1 to use only unique morning/afternoon/evening slots'
  );
  assertDeepEqual(
    clusters[1].slots.map((slot) => slot.slot),
    ['morning', 'afternoon', 'evening'],
    'Expected day 2 to allow an evening slot for an 18:00 departure'
  );
  assertTrue(
    new Set(clusters[0].slots.map((slot) => slot.slot)).size === clusters[0].slots.length,
    'Expected day 1 slot labels to be unique'
  );

  console.log('clusterByProximity.test.ts passed');
}

run();
