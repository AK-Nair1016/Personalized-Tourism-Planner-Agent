import {
  mergeReplannedItinerary,
  normalizeMergedItinerary,
  PlannerItineraryRecord,
  splitItineraryForReplan,
} from '../graph/replanUtils';

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

function buildSampleItinerary(): PlannerItineraryRecord {
  return {
    city: 'Goa',
    currency: 'INR',
    total_cost_estimate: 600,
    days: [
      {
        day: 1,
        date_label: '2026-06-14',
        cluster_area: 'North Goa',
        day_cost_estimate: 300,
        slots: [
          { slot: 'morning', attraction_id: 'a1', estimated_cost: 100 },
          { slot: 'afternoon', attraction_id: 'a2', estimated_cost: 100 },
          { slot: 'evening', attraction_id: 'a3', estimated_cost: 100 },
        ],
      },
      {
        day: 2,
        date_label: '2026-06-15',
        cluster_area: 'Panaji',
        day_cost_estimate: 300,
        slots: [
          { slot: 'morning', attraction_id: 'b1', estimated_cost: 100 },
          { slot: 'afternoon', attraction_id: 'b2', estimated_cost: 100 },
          { slot: 'evening', attraction_id: 'b3', estimated_cost: 100 },
        ],
      },
      {
        day: 3,
        date_label: '2026-06-16',
        cluster_area: 'South Goa',
        day_cost_estimate: 300,
        slots: [
          { slot: 'morning', attraction_id: 'c1', estimated_cost: 100 },
          { slot: 'afternoon', attraction_id: 'c2', estimated_cost: 100 },
          { slot: 'evening', attraction_id: 'c3', estimated_cost: 100 },
        ],
      },
    ],
  };
}

function run() {
  const original = buildSampleItinerary();

  const dayOneMorning = splitItineraryForReplan(original, {
    day: 1,
    slot: 'morning',
    description: 'Rain',
  });
  assertEqual(dayOneMorning.replanStartDay, 1);
  assertEqual(dayOneMorning.preservedDays.length, 3);
  assertDeepEqual(
    dayOneMorning.preservedDays[0].slots?.map((slot) => slot.slot),
    ['afternoon', 'evening']
  );
  assertDeepEqual(
    dayOneMorning.preservedDays[1],
    original.days?.[1]
  );
  assertDeepEqual(
    dayOneMorning.preservedDays[2],
    original.days?.[2]
  );

  const dayOneMorningWithCaseMismatch = splitItineraryForReplan(original, {
    day: 1,
    slot: 'Morning' as 'morning',
    description: 'Rain',
  });
  assertDeepEqual(
    dayOneMorningWithCaseMismatch.preservedDays[0].slots?.map((slot) => slot.slot),
    ['afternoon', 'evening']
  );
  assertDeepEqual(
    dayOneMorningWithCaseMismatch.toReplan[0].slots?.map((slot) => slot.slot),
    ['morning']
  );

  const middleAfternoon = splitItineraryForReplan(original, {
    day: 2,
    slot: 'afternoon',
    description: 'Museum closed',
  });
  assertEqual(middleAfternoon.preservedDays.length, 3);
  assertDeepEqual(
    middleAfternoon.preservedDays[0],
    original.days?.[0]
  );
  assertDeepEqual(
    middleAfternoon.preservedDays[1].slots?.map((slot) => slot.slot),
    ['morning', 'evening']
  );
  assertEqual(middleAfternoon.toReplan[0].day, 2);
  assertDeepEqual(
    middleAfternoon.toReplan[0].slots?.map((slot) => slot.slot),
    ['afternoon']
  );
  assertEqual(middleAfternoon.toReplan.length, 1);
  assertDeepEqual(
    middleAfternoon.preservedDays[2],
    original.days?.[2]
  );

  const lastDayEvening = splitItineraryForReplan(original, {
    day: 3,
    slot: 'evening',
    description: 'Late flight',
  });
  assertEqual(lastDayEvening.preservedDays.length, 3);
  assertDeepEqual(
    lastDayEvening.preservedDays[2].slots?.map((slot) => slot.slot),
    ['morning', 'afternoon']
  );
  assertEqual(lastDayEvening.toReplan.length, 1);
  assertDeepEqual(
    lastDayEvening.toReplan[0].slots?.map((slot) => slot.slot),
    ['evening']
  );

  const merged = normalizeMergedItinerary(
    mergeReplannedItinerary(middleAfternoon.preservedDays, {
      city: 'Goa',
      currency: 'INR',
      days: [
        {
          day: 2,
          date_label: '2026-06-15',
          cluster_area: 'Panaji',
          slots: [
            { slot: 'afternoon', attraction_id: 'd1', estimated_cost: 150 },
          ],
        },
      ],
    })
  );

  assertEqual(merged.days?.length, 3);
  assertDeepEqual(
    merged.days?.[0],
    original.days?.[0]
  );
  assertDeepEqual(
    merged.days?.[1].slots?.map((slot) => slot.attraction_id),
    ['b1', 'd1', 'b3']
  );
  assertEqual(
    merged.days?.[1].slots?.filter((slot) => slot.slot === 'afternoon').length,
    1
  );
  assertEqual(merged.days?.[2].slots?.length, 3);
  assertDeepEqual(
    merged.days?.[2].slots?.map((slot) => slot.attraction_id),
    ['c1', 'c2', 'c3']
  );
  assertEqual(merged.days?.[1].day_cost_estimate, 350);
  assertEqual(merged.total_cost_estimate, 950);

  console.log('replanFlow.test.ts passed');
}

run();
