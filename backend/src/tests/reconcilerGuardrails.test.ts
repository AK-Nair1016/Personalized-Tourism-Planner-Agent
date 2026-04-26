import {
  buildNaturalVibeNote,
  vibeNoteMatchesCategory,
} from '../agents/reconcilerAgent';

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message ?? 'Expected condition to be true');
  }
}

function assertFalse(value: boolean, message?: string) {
  if (value) {
    throw new Error(message ?? 'Expected condition to be false');
  }
}

function assertIncludes(actual: string, expected: string, message?: string) {
  if (!actual.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(message ?? `Expected "${actual}" to include "${expected}"`);
  }
}

function assertNotIncludes(actual: string, rejected: string, message?: string) {
  if (actual.toLowerCase().includes(rejected.toLowerCase())) {
    throw new Error(message ?? `Expected "${actual}" to omit "${rejected}"`);
  }
}

function run() {
  assertFalse(
    vibeNoteMatchesCategory({
      attraction_name: 'Anjuna Flea Market',
      category: 'market',
      vibe_note: 'Explore the historic Se Cathedral and its colonial architecture.',
    }),
    'Market slot should reject unrelated cathedral copy'
  );

  assertFalse(
    vibeNoteMatchesCategory({
      attraction_name: 'Adil Shah Palace Gateway',
      category: 'landmark',
      vibe_note: 'Relax at this scenic beach with sand and sea views.',
    }),
    'Landmark slot should reject beach copy'
  );

  assertTrue(
    vibeNoteMatchesCategory({
      attraction_name: 'Anjuna Flea Market',
      category: 'market',
      vibe_note: 'Anjuna Flea Market is a lively market stop for stalls, crafts, and souvenirs.',
    }),
    'Specific market copy should pass'
  );

  const correctedMarketNote = buildNaturalVibeNote(
    'Anjuna Flea Market',
    'market',
    'Explore the historic Se Cathedral and its colonial architecture.'
  );
  assertIncludes(correctedMarketNote, 'Anjuna Flea Market');
  assertIncludes(correctedMarketNote, 'market');
  assertNotIncludes(correctedMarketNote, 'Se Cathedral');

  const correctedLandmarkNote = buildNaturalVibeNote(
    'Adil Shah Palace Gateway',
    'landmark',
    'Relax at this scenic beach with sand and sea views.'
  );
  assertIncludes(correctedLandmarkNote, 'Adil Shah Palace Gateway');
  assertIncludes(correctedLandmarkNote, 'landmark');
  assertNotIncludes(correctedLandmarkNote, 'beach');

  console.log('reconcilerGuardrails.test.ts passed');
}

run();
