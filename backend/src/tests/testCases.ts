import type { UserProfile } from '@vibetrip/shared/types/userProfile';

// ================= TYPES =================
type TestCase = {
  name: string;
  profile: UserProfile;
};

type TestResult = {
  name: string;
  passed: boolean;
  responseTimeMs: number;
  tokensUsed?: number;
  hasExecutionMeta?: boolean;
  usedFallback?: boolean;
  retryCount?: number;
  llmSuccess?: boolean;
  vibeFallback?: boolean;
  reconcilerFallback?: boolean;
  errorMessage?: string;
  isRateLimit?: boolean;
  isDailyLimit?: boolean;
  retryAfterMs?: number;
};

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
  exitCode?: number;
};

const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process;

const ENDPOINT =
  runtimeProcess?.env?.TEST_CASES_URL ?? 'http://localhost:3000/api/itinerary/generate';

const parsedDelayMs = Number(runtimeProcess?.env?.TEST_CASES_DELAY_MS ?? '35000');
const DELAY_MS =
  Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0
    ? Math.floor(parsedDelayMs)
    : 35000;

function isDailyTokenLimitMessage(message?: string): boolean {
  if (!message) return false;
  return message.toLowerCase().includes('tokens per day') || /\bTPD\b/i.test(message);
}

type FetchErrorCause = {
  code?: string;
  errno?: number;
  address?: string;
  port?: number;
  message?: string;
};

function formatFetchError(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const cause = (error as Error & { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return error.message;

  const typedCause = cause as FetchErrorCause;
  const parts: string[] = [];

  if (typedCause.code) parts.push(`code=${typedCause.code}`);
  if (typedCause.errno !== undefined) parts.push(`errno=${typedCause.errno}`);
  if (typedCause.address) parts.push(`address=${typedCause.address}`);
  if (typedCause.port !== undefined) parts.push(`port=${typedCause.port}`);
  if (typedCause.message) parts.push(`cause=${typedCause.message}`);

  if (parts.length === 0) return error.message;
  return `${error.message} (${parts.join(', ')})`;
}

function parseRetryAfterMs(rawBody: string): number | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed);
    const match = msg.match(/Please try again in (\d+)m(\d+)/);
    if (match) return (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
  } catch {}
  return null;
}

async function assertEndpointReachable() {
  try {
    await fetch(ENDPOINT, { method: 'OPTIONS' });
    return true;
  } catch (error) {
    const details = formatFetchError(error);
    console.error(
      `Endpoint is not reachable: ${ENDPOINT}. Start backend server first. Details: ${details}`
    );
    if (runtimeProcess) runtimeProcess.exitCode = 1;
    return false;
  }
}

// ================= TEST CASES =================
const allTestCases: TestCase[] = [
    {
    name: 'Dubai | Solo | Single vibe | Fast | 3 days',
    profile: {
  "vibe": ["culture_nerd"],
  "firstVisit": true,
  "group": "solo",
  "city": "Dubai",
  "arrivalDate": "2026-05-01",
  "departureDate": "2026-05-04",
  "arrivalTime": "10:00",
  "departureTime": "18:00",
  "hotelArea": "Downtown Dubai",
  "budget": 15000,
  "currency": "INR",
  "budgetSplit": "balanced",
  "pace": "moderate",
  "wakeUpStyle": "mid_morning",
  "transportPreference": "public",
  "dietary": "none",
  "mobilityNeeds": false,
  "ageGroup": "adults",
  "mustVisit": ['shopping districts'],
  "avoid": ['Crowded clubs']
},
  },
  {
    name: 'Goa | Couple | Double vibe | Moderate | 3 days',
    profile: {
      vibe: ['foodie', 'night_owl'],
      firstVisit: false,
      group: 'couple',
      city: 'Goa',
      arrivalDate: '2026-06-14',
      departureDate: '2026-06-17',
      arrivalTime: '11:30',
      departureTime: '17:00',
      hotelArea: 'Calangute',
      budget: 30000,
      currency: 'INR',
      budgetSplit: 'balanced',
      pace: 'moderate',
      wakeUpStyle: 'mid_morning',
      transportPreference: 'mix',
      dietary: 'vegetarian',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Baga Beach', 'Fontainhas'],
      avoid: ['Crowded clubs'],
    },
    
  },
  
  {
    name: 'Singapore | Family | Double vibe | Relaxed | 5 days',
    profile: {
      vibe: ['culture_nerd', 'slow_traveller'],
      firstVisit: true,
      group: 'family',
      city: 'Singapore',
      arrivalDate: '2026-07-02',
      departureDate: '2026-07-07',
      arrivalTime: '10:00',
      departureTime: '18:30',
      hotelArea: 'Marina Bay',
      budget: 85000,
      currency: 'INR',
      budgetSplit: 'food',
      pace: 'relaxed',
      wakeUpStyle: 'mid_morning',
      transportPreference: 'public',
      dietary: 'none',
      mobilityNeeds: false,
      ageGroup: 'family_young_kids',
      mustVisit: ['Gardens by the Bay', 'Singapore Zoo'],
      avoid: ['High-intensity rides'],
    },
  },
  {
    name: 'Bangkok | Group | Edge case (low budget + late arrival + early departure)',
    profile: {
      vibe: ['budget_explorer'],
      firstVisit: false,
      group: 'group',
      city: 'Bangkok',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
      arrivalTime: '20:00',
      departureTime: '08:00',
      hotelArea: 'Sukhumvit',
      budget: 5000,
      currency: 'INR',
      budgetSplit: 'save',
      pace: 'fast',
      wakeUpStyle: 'late_riser',
      transportPreference: 'public',
      dietary: 'halal',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Wat Arun'],
      avoid: ['Expensive rooftop bars'],
    },
  },
  {
    name: 'Dubai | Couple | Double vibe | Moderate | 5 days',
    profile: {
      vibe: ['adventurer', 'culture_nerd'],
      firstVisit: false,
      group: 'couple',
      city: 'Dubai',
      arrivalDate: '2026-09-03',
      departureDate: '2026-09-08',
      arrivalTime: '14:00',
      departureTime: '12:00',
      hotelArea: 'Dubai Marina',
      budget: 90000,
      currency: 'INR',
      budgetSplit: 'experiences',
      pace: 'moderate',
      wakeUpStyle: 'early_bird',
      transportPreference: 'taxi',
      dietary: 'vegan',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Burj Khalifa'],
      avoid: ['Very long queues'],
    },
  },
  {
    name: 'Goa | Solo | Single vibe | Relaxed | 2 days',
    profile: {
      vibe: ['slow_traveller'],
      firstVisit: true,
      group: 'solo',
      city: 'Goa',
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-07',
      arrivalTime: '08:30',
      departureTime: '21:00',
      hotelArea: 'Anjuna',
      budget: 16000,
      currency: 'INR',
      budgetSplit: 'balanced',
      pace: 'relaxed',
      wakeUpStyle: 'late_riser',
      transportPreference: 'walk',
      dietary: 'none',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Chapora Fort'],
      avoid: [],
    },
  },
  {
    name: 'Singapore | Group | Single vibe | Fast | 3 days',
    profile: {
      vibe: ['foodie'],
      firstVisit: false,
      group: 'group',
      city: 'Singapore',
      arrivalDate: '2026-11-12',
      departureDate: '2026-11-15',
      arrivalTime: '07:45',
      departureTime: '20:30',
      hotelArea: 'Bugis',
      budget: 60000,
      currency: 'INR',
      budgetSplit: 'food',
      pace: 'fast',
      wakeUpStyle: 'early_bird',
      transportPreference: 'public',
      dietary: 'kosher',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Maxwell Food Centre'],
      avoid: ['Theme parks'],
    },
  },
  {
    name: 'Bangkok | Family | Double vibe | Moderate | 5 days',
    profile: {
      vibe: ['culture_nerd', 'budget_explorer'],
      firstVisit: true,
      group: 'family',
      city: 'Bangkok',
      arrivalDate: '2026-12-01',
      departureDate: '2026-12-06',
      arrivalTime: '12:15',
      departureTime: '16:45',
      hotelArea: 'Silom',
      budget: 42000,
      currency: 'INR',
      budgetSplit: 'save',
      pace: 'moderate',
      wakeUpStyle: 'mid_morning',
      transportPreference: 'mix',
      dietary: 'vegetarian',
      mobilityNeeds: true,
      ageGroup: 'seniors',
      mustVisit: ['Grand Palace', 'ICONSIAM'],
      avoid: ['Steep stair-only locations'],
    },
  },
  {
    name: 'Goa | Couple | Double vibe | Moderate | 3 days',
    profile: {
      vibe: ['foodie', 'night_owl'],
      firstVisit: false,
      group: 'couple',
      city: 'Goa',
      arrivalDate: '2026-06-14',
      departureDate: '2026-06-17',
      arrivalTime: '11:30',
      departureTime: '17:00',
      hotelArea: 'Calangute',
      budget: 30000,
      currency: 'INR',
      budgetSplit: 'balanced',
      pace: 'moderate',
      wakeUpStyle: 'mid_morning',
      transportPreference: 'mix',
      dietary: 'vegetarian',
      mobilityNeeds: false,
      ageGroup: 'adults',
      mustVisit: ['Baga Beach', 'Fontainhas'],
      avoid: ['Crowded clubs'],
    },
  },
];

const testCases: TestCase[] = allTestCases.slice(0, 1);

function safeErrorMessage(rawBody: string, status: number): string {
  if (!rawBody) return `HTTP ${status}`;
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const errorValue = parsed.error ?? parsed.message ?? parsed;
    return `HTTP ${status}: ${
      typeof errorValue === 'string' ? errorValue : JSON.stringify(errorValue)
    }`;
  } catch {
    return `HTTP ${status}: ${rawBody}`;
  }
}

async function runTestCase(testCase: TestCase): Promise<TestResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.profile),
    });

    const responseTimeMs = Date.now() - startedAt;

    if (!response.ok) {
      const rawBody = await response.text();
      return {
        name: testCase.name,
        passed: false,
        responseTimeMs,
        errorMessage: safeErrorMessage(rawBody, response.status),
      };
    }

    const responseData = await response.json() as Record<string, unknown>;

    return {
      name: testCase.name,
      passed: true,
      responseTimeMs,
      tokensUsed: typeof responseData.tokensUsed === 'number' ? responseData.tokensUsed : undefined,
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      responseTimeMs: Date.now() - startedAt,
      errorMessage: formatFetchError(error),
    };
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ================= FIXED TOKEN TRACKING =================
async function runAllTests() {
  const reachable = await assertEndpointReachable();
  if (!reachable) return;

  const results: TestResult[] = [];
  let totalTokensUsed = 0;
  const DAILY_LIMIT = 100000;

  for (const [index, testCase] of testCases.entries()) {
    console.log(`[${index + 1}] ${testCase.name}`);

    const result = await runTestCase(testCase);
    results.push(result);

    if (typeof result.tokensUsed === 'number') {
      totalTokensUsed += result.tokensUsed;
    }

    const remaining = DAILY_LIMIT - totalTokensUsed;

    console.log(
      `tokens: ${result.tokensUsed ?? 0} | total: ${totalTokensUsed} | remaining: ${remaining}`
    );

    if (remaining <= 0) {
      console.log('⚠️ Token limit reached');
      break;
    }

    if (index < testCases.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nFINAL → total: ${totalTokensUsed} | remaining: ${DAILY_LIMIT - totalTokensUsed}`);
}

runAllTests();

// import type { UserProfile } from '@vibetrip/shared/types/userProfile';

// type TestCase = {
//   name: string;
//   profile: UserProfile;
// };

// type TestResult = {
//   name: string;
//   passed: boolean;
//   responseTimeMs: number;
//   tokensUsed?: number;
//   hasExecutionMeta?: boolean;
//   usedFallback?: boolean;
//   retryCount?: number;
//   llmSuccess?: boolean;
//   vibeFallback?: boolean;
//   reconcilerFallback?: boolean;
//   errorMessage?: string;
//   isRateLimit?: boolean;
//   isDailyLimit?: boolean;
//   retryAfterMs?: number;
// };

// type RuntimeProcess = {
//   env?: Record<string, string | undefined>;
//   exitCode?: number;
// };

// const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process;

// const ENDPOINT =
//   runtimeProcess?.env?.TEST_CASES_URL ?? 'http://localhost:3000/api/itinerary/generate';
// // Increased to 35s for safer TPM (tokens per minute) compliance
// // With ~5K tokens/request, 35s = ~8.5K TPM (well under 12K limit)
// const parsedDelayMs = Number(runtimeProcess?.env?.TEST_CASES_DELAY_MS ?? '35000');
// const DELAY_MS =
//   Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0
//     ? Math.floor(parsedDelayMs)
//     : 35000;

// function isDailyTokenLimitMessage(message?: string): boolean {
//   if (!message) return false;
//   return message.toLowerCase().includes('tokens per day') || /\bTPD\b/i.test(message);
// }

// type FetchErrorCause = {
//   code?: string;
//   errno?: number;
//   address?: string;
//   port?: number;
//   message?: string;
// };

// function formatFetchError(error: unknown) {
//   if (!(error instanceof Error)) return String(error);

//   const cause = (error as Error & { cause?: unknown }).cause;
//   if (!cause || typeof cause !== 'object') return error.message;

//   const typedCause = cause as FetchErrorCause;
//   const parts: string[] = [];

//   if (typedCause.code) parts.push(`code=${typedCause.code}`);
//   if (typedCause.errno !== undefined) parts.push(`errno=${typedCause.errno}`);
//   if (typedCause.address) parts.push(`address=${typedCause.address}`);
//   if (typedCause.port !== undefined) parts.push(`port=${typedCause.port}`);
//   if (typedCause.message) parts.push(`cause=${typedCause.message}`);

//   if (parts.length === 0) return error.message;
//   return `${error.message} (${parts.join(', ')})`;
// }

// function parseRetryAfterMs(rawBody: string): number | null {
//   try {
//     const parsed = JSON.parse(rawBody) as Record<string, unknown>;
//     const msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed);
//     const match = msg.match(/Please try again in (\d+)m(\d+)/);
//     if (match) return (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
//   } catch {}
//   return null;
// }

// async function assertEndpointReachable() {
//   try {
//     await fetch(ENDPOINT, { method: 'OPTIONS' });
//     return true;
//   } catch (error) {
//     const details = formatFetchError(error);
//     console.error(
//       `Endpoint is not reachable: ${ENDPOINT}. Start backend server first (for example: npm run dev). Details: ${details}`
//     );
//     if (runtimeProcess) runtimeProcess.exitCode = 1;
//     return false;
//   }
// }

// const allTestCases: TestCase[] = [

// ];  

// // Run first 4 test cases (Dubai, Goa, Singapore, Bangkok)
// // Adjust slice(0, N) to control how many tests run
// // const testCases: TestCase[] = allTestCases.slice(0, 4);
// const testCases: TestCase[] = allTestCases.slice(0, 1); // replace this  with above
//  ""

//   function safeErrorMessage(rawBody: string, status: number): string {
//     if (!rawBody) return `HTTP ${status}`;

//     try {
//     const parsed = JSON.parse(rawBody) as Record<string, unknown>;
//     const errorValue = parsed.error ?? parsed.message ?? parsed;
//     return `HTTP ${status}: ${
//       typeof errorValue === 'string' ? errorValue : JSON.stringify(errorValue)
//     }`;
//   } catch {
//     return `HTTP ${status}: ${rawBody}`;
//   }
// }

// async function runTestCase(testCase: TestCase): Promise<TestResult> {
//   const startedAt = Date.now();

//   try {
//     const response = await fetch(ENDPOINT, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(testCase.profile),
//     });

//     const responseTimeMs = Date.now() - startedAt;

//     if (!response.ok) {
//       const rawBody = await response.text();
//       const retryAfterMs = parseRetryAfterMs(rawBody);
//       const errorMessage = safeErrorMessage(rawBody, response.status);
//       const isRateLimit =
//         response.status === 429 ||
//         rawBody.includes('rate_limit_exceeded') ||
//         rawBody.includes('Please try again');
//       const isDailyLimit = isDailyTokenLimitMessage(errorMessage);

//       return {
//         name: testCase.name,
//         passed: false,
//         responseTimeMs,
//         errorMessage,
//         isRateLimit,
//         isDailyLimit,
//         retryAfterMs: retryAfterMs ?? undefined,
//       };
//     }

//     // Try to extract token usage + execution metadata from response
//     let tokensUsed: number | undefined;
//     let hasExecutionMeta = false;
//     let usedFallback = false;
//     let retryCount = 0;
//     let llmSuccess = true;
//     let vibeFallback = false;
//     let reconcilerFallback = false;

//     try {
//       const responseData = await response.json() as Record<string, unknown>;

//       if (typeof responseData.tokensUsed === 'number') {
//         tokensUsed = responseData.tokensUsed;
//       }

//       const meta = responseData.meta;
//       if (typeof meta === 'object' && meta !== null) {
//         const executionMeta = meta as Record<string, unknown>;
//         hasExecutionMeta = true;
//         usedFallback = executionMeta.usedFallback === true;
//         llmSuccess = executionMeta.llmSuccess === true;
//         vibeFallback = executionMeta.vibeFallback === true;
//         reconcilerFallback = executionMeta.reconcilerFallback === true;
//         if (typeof executionMeta.retryCount === 'number' && Number.isFinite(executionMeta.retryCount)) {
//           retryCount = Math.max(0, Math.floor(executionMeta.retryCount));
//         }
//       }
//     } catch {
//       // Response might not be JSON or might not have metadata fields
//     }

//     return {
//       name: testCase.name,
//       passed: hasExecutionMeta ? llmSuccess : true,
//       responseTimeMs,
//       tokensUsed,
//       hasExecutionMeta,
//       usedFallback,
//       retryCount,
//       llmSuccess: hasExecutionMeta ? llmSuccess : undefined,
//       vibeFallback,
//       reconcilerFallback,
//     };
//   } catch (error) {
//     const errorMessage = formatFetchError(error);
//     return {
//       name: testCase.name,
//       passed: false,
//       responseTimeMs: Date.now() - startedAt,
//       errorMessage,
//       isDailyLimit: isDailyTokenLimitMessage(errorMessage),
//     };
//   }
// }

// function sleep(ms: number) {
//   return new Promise<void>((resolve) => {
//     setTimeout(resolve, ms);
//   });
// }

// async function runAllTests() {
//   const reachable = await assertEndpointReachable();
//   if (!reachable) {
//     return;
//   }

//   const results: TestResult[] = [];
//   let totalTokensUsed = 0;

//   console.log(`\n${'='.repeat(80)}`);
//   console.log(`🧪 VIBETRIP HYBRID ARCHITECTURE TEST SUITE`);
//   console.log(`${'='.repeat(80)}`);
//   console.log(`Running ${testCases.length} test cases against ${ENDPOINT}`);
//   console.log(`Delay between tests: ${DELAY_MS}ms (${Math.round(DELAY_MS / 1000)}s)`);
//   console.log(`Expected TPM: ~${Math.round((60000 / DELAY_MS) * 5000)} tokens/min (limit: 12,000)`);
//   console.log(`${'='.repeat(80)}\n`);

//   for (const [index, testCase] of testCases.entries()) {
//     console.log(`[${index + 1}/${testCases.length}] Testing: ${testCase.name}`);
    
//     const result = await runTestCase(testCase);
//     results.push(result);

//     if (typeof result.tokensUsed === 'number') {
//       totalTokensUsed += result.tokensUsed;
//     }

//     const tag = result.passed
//       ? '✅ PASS'
//       : result.usedFallback
//         ? '⚠️ FALLBACK'
//         : result.isRateLimit || result.isDailyLimit
//           ? '⏭️  SKIP'
//           : '❌ FAIL';
//     const tokenInfo =
//       typeof result.tokensUsed === 'number'
//         ? ` | ${result.tokensUsed.toLocaleString()} tokens`
//         : '';
//     const executionInfo = result.hasExecutionMeta
//       ? ` | retries:${result.retryCount ?? 0} | llm:${result.llmSuccess ? 'ok' : 'fallback'}`
//       : '';
//     const fallbackInfo = result.usedFallback
//       ? ` | fallback(vibe=${result.vibeFallback ? 'Y' : 'N'}, reconciler=${result.reconcilerFallback ? 'Y' : 'N'})`
//       : '';
//     const extra = result.isDailyLimit
//       ? ' | DAILY TOKEN LIMIT REACHED'
//       : result.isRateLimit
//         ? ` | RATE LIMITED — retry in ${result.retryAfterMs ? Math.ceil(result.retryAfterMs / 60000) + 'min' : 'unknown'}`
//         : result.errorMessage
//           ? ` | ${result.errorMessage}`
//           : '';

//     console.log(`${tag} | ${result.responseTimeMs}ms${tokenInfo}${executionInfo}${fallbackInfo}${extra}\n`);

//     if (result.isDailyLimit && index < testCases.length - 1) {
//       console.log('⚠️  Daily token limit reached. Run again tomorrow.');
//       break;
//     }

//     if (result.isRateLimit && index < testCases.length - 1) {
//       const wait = result.retryAfterMs ?? DELAY_MS;
//       console.log(`⚠️  Rate limit hit. Skipping remaining tests. Come back in ~${Math.ceil(wait / 60000)}min.\n`);
//       break;
//     }

//     if (index < testCases.length - 1 && DELAY_MS > 0) {
//       const remainingTests = testCases.length - index - 1;
//       const estimatedTimeMin = Math.round((remainingTests * DELAY_MS) / 60000);
//       console.log(`⏳ Waiting ${Math.round(DELAY_MS / 1000)}s before next test... (${remainingTests} tests remaining, ~${estimatedTimeMin}min)\n`);
//       await sleep(DELAY_MS);
//     }
//   }

//   const passed = results.filter((r) => r.passed).length;
//   const trueLlmSuccess = results.filter((r) => r.llmSuccess === true).length;
//   const fallbackTriggered = results.filter((r) => r.usedFallback).length;
//   const skipped = results.filter((r) => r.isRateLimit || r.isDailyLimit).length;
//   const failed = results.filter(
//     (r) => !r.passed && !r.usedFallback && !r.isRateLimit && !r.isDailyLimit
//   ).length;
//   const averageResponseTimeMs =
//     results.length === 0
//       ? 0
//       : Math.round(
//           results.reduce((total, result) => total + result.responseTimeMs, 0) /
//             results.length
//         );

//   const responsesWithTokenData = results.filter(
//     (result) => typeof result.tokensUsed === 'number'
//   ).length;

//   const avgTokensPerRequest =
//     responsesWithTokenData > 0
//       ? Math.round(totalTokensUsed / responsesWithTokenData)
//       : 0;

//   console.log(`${'='.repeat(80)}`);
//   console.log('📊 TEST SUMMARY');
//   console.log(`${'='.repeat(80)}`);
//   console.log(`Total passed:          ${passed}/${testCases.length}`);
//   console.log(`Total failed:          ${failed}/${testCases.length}`);
//   console.log(`Rate limited/skipped:  ${skipped}/${testCases.length}`);
//   console.log(`Fallback triggered:    ${fallbackTriggered}/${testCases.length}`);
//   console.log(`True LLM success:      ${trueLlmSuccess}/${testCases.length}`);
//   console.log(`Average response time: ${averageResponseTimeMs}ms`);
  
//   if (responsesWithTokenData > 0) {
//     console.log(`\n🎯 TOKEN USAGE (HYBRID ARCHITECTURE)`);
//     console.log(`Total tokens used:     ${totalTokensUsed.toLocaleString()}`);
//     console.log(`Average per request:   ${avgTokensPerRequest.toLocaleString()} tokens`);
//     console.log(`Groq TPD limit:        100,000 tokens/day`);
//     console.log(`Remaining today:       ~${(100000 - totalTokensUsed).toLocaleString()} tokens`);
//     console.log(`\n💡 v1.0 baseline was ~15,000 tokens/request`);
//     console.log(`   v2.0 hybrid target is ~5,000 tokens/request`);
//     if (avgTokensPerRequest > 0) {
//       const improvement = Math.round((15000 / avgTokensPerRequest) * 10) / 10;
//       console.log(`   Actual improvement: ${improvement}x reduction ✨`);
//     }
//   } else {
//     console.log(`\n⚠️  Token tracking unavailable. Add 'tokensUsed' to backend response.`);
//   }

//   console.log(`${'='.repeat(80)}\n`);

//   if (skipped > 0) {
//     console.log(`💡 Tip: You have ${skipped} skipped tests. Wait for quota reset and re-run.\n`);
//   }
//   if (fallbackTriggered > 0) {
//     console.log(`💡 Note: ${fallbackTriggered} request(s) returned fallback output.\n`);
//   }
//   if (failed > 0 && runtimeProcess) runtimeProcess.exitCode = 1;
// }

// runAllTests().catch((error) => {
//   console.error('❌ Test runner failed:', error);
//   if (runtimeProcess) runtimeProcess.exitCode = 1;
// });










