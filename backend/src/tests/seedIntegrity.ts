// import { prisma } from '../lib/prisma';
// import {
//   ATTRACTION_PRICE_ANCHORS,
//   CITY_CATEGORY_PRICE_BANDS,
// } from '../../prisma/seed/seeders/pricingRules';

// type CheckResult = {
//   name: string;
//   passed: boolean;
//   details?: string;
// };

// type ExpectedCountry = {
//   id: string;
//   name: string;
//   currencyCode: string;
//   currencySymbol: string;
// };

// type ExpectedCity = {
//   id: string;
//   countryId: string;
//   name: string;
//   timezone: string;
// };

// type ExpectedCategory = {
//   id: string;
//   name: string;
// };

// const STRICT_IDS = (process.env.SEED_CHECK_STRICT_IDS ?? 'false').toLowerCase() === 'true';

// const EXPECTED_COUNTRIES: ExpectedCountry[] = [
//   { id: '7bf9b2b0-8803-486e-b48d-79ee79113e14', name: 'Thailand', currencyCode: 'THB', currencySymbol: '฿' },
//   { id: 'b9966b46-36ab-4d82-94f9-b8e328eff5ee', name: 'India', currencyCode: 'INR', currencySymbol: '₹' },
//   { id: 'ced854ec-13b0-4d17-8bc0-bca1c3810138', name: 'Singapore', currencyCode: 'SGD', currencySymbol: 'S$' },
//   { id: '7df1b510-7972-4381-b446-58f14a32697d', name: 'UAE', currencyCode: 'AED', currencySymbol: 'د.إ' },
// ];

// const EXPECTED_CITIES: ExpectedCity[] = [
//   {
//     id: '82ba3834-3280-4337-9663-0c88a393be81',
//     countryId: '7bf9b2b0-8803-486e-b48d-79ee79113e14',
//     name: 'Bangkok',
//     timezone: 'Asia/Bangkok',
//   },
//   {
//     id: 'fc0cf33f-973f-4073-8ba0-e96b363fddfd',
//     countryId: 'b9966b46-36ab-4d82-94f9-b8e328eff5ee',
//     name: 'Goa',
//     timezone: 'Asia/Kolkata',
//   },
//   {
//     id: 'de259adf-9d43-4192-a01c-6b89346aa546',
//     countryId: 'ced854ec-13b0-4d17-8bc0-bca1c3810138',
//     name: 'Singapore',
//     timezone: 'Asia/Singapore',
//   },
//   {
//     id: 'f3bf8d66-d08b-4b63-873f-dd5fc9cd8ea2',
//     countryId: '7df1b510-7972-4381-b446-58f14a32697d',
//     name: 'Dubai',
//     timezone: 'Asia/Dubai',
//   },
// ];

// const EXPECTED_CATEGORIES: ExpectedCategory[] = [
//   { id: '02281262-ffc0-4734-b2a0-61efa59250e3', name: 'museum' },
//   { id: 'dc6fa06e-3e3b-45ed-8ead-1fcca36236db', name: 'landmark' },
//   { id: '7855b675-b8ab-4564-bd69-3161f89d63c1', name: 'temple' },
//   { id: '67d88cdc-dc39-4078-a012-5278ca85f731', name: 'entertainment' },
//   { id: '7440c6c4-dc1b-47d2-9e15-05db759fc779', name: 'viewpoint' },
//   { id: '5ff0a89f-a8e6-40eb-9c7c-9dd6adff2f13', name: 'market' },
//   { id: '6e978058-8ce4-43aa-be92-cd7f51c7d564', name: 'nightlife' },
//   { id: '553c9ced-aa2d-4933-b69c-d708c55482ca', name: 'food' },
//   { id: 'c0e97c5b-ecef-4533-96c6-d7380ed6bb64', name: 'park' },
//   { id: 'bb55fd4f-9878-47f5-b5f7-8d406526b938', name: 'beach' },
//   { id: 'ae1474b9-b014-4cff-9e03-e0d8a649f8aa', name: 'nature' },
// ];

// function toNumber(value: unknown): number {
//   if (typeof value === 'number') return value;
//   if (typeof value === 'bigint') return Number(value);
//   if (typeof value === 'string') return Number(value);
//   return Number.NaN;
// }

// function addCheck(results: CheckResult[], name: string, passed: boolean, details?: string) {
//   results.push({ name, passed, details });
// }

// function parseExpectedAttractionsTotal() {
//   const raw = process.env.EXPECTED_ATTRACTIONS_TOTAL;
//   if (!raw) return undefined;
//   const parsed = Number(raw);
//   if (!Number.isFinite(parsed) || parsed < 0) {
//     throw new Error('EXPECTED_ATTRACTIONS_TOTAL must be a non-negative number');
//   }
//   return Math.floor(parsed);
// }

// function parseExpectedMinPerCity() {
//   const raw = process.env.EXPECTED_MIN_ATTRACTIONS_BY_CITY;
//   if (!raw) return undefined;

//   const parsed = JSON.parse(raw) as unknown;
//   if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
//     throw new Error('EXPECTED_MIN_ATTRACTIONS_BY_CITY must be a JSON object');
//   }

//   const out: Record<string, number> = {};
//   for (const [cityName, count] of Object.entries(parsed as Record<string, unknown>)) {
//     const numericCount = Number(count);
//     if (!Number.isFinite(numericCount) || numericCount < 0) {
//       throw new Error(`Invalid min count for city "${cityName}" in EXPECTED_MIN_ATTRACTIONS_BY_CITY`);
//     }
//     out[cityName] = Math.floor(numericCount);
//   }
//   return out;
// }

// async function verifyCountries(results: CheckResult[]) {
//   for (const expected of EXPECTED_COUNTRIES) {
//     const seeded = STRICT_IDS
//       ? await prisma.country.findUnique({ where: { id: expected.id } })
//       : await prisma.country.findUnique({ where: { name: expected.name } });

//     const label = `Country seeded: ${expected.name}`;
//     if (!seeded) {
//       addCheck(results, label, false, `Missing country (${STRICT_IDS ? expected.id : expected.name})`);
//       continue;
//     }

//     const isValid =
//       seeded.name === expected.name &&
//       seeded.currencyCode === expected.currencyCode &&
//       seeded.currencySymbol === expected.currencySymbol &&
//       (!STRICT_IDS || seeded.id === expected.id);

//     addCheck(
//       results,
//       label,
//       isValid,
//       isValid
//         ? `id=${seeded.id}`
//         : `Expected ${JSON.stringify(expected)} but got ${JSON.stringify({
//             id: seeded.id,
//             name: seeded.name,
//             currencyCode: seeded.currencyCode,
//             currencySymbol: seeded.currencySymbol,
//           })}`
//     );
//   }
// }

// async function verifyCities(results: CheckResult[]) {
//   for (const expected of EXPECTED_CITIES) {
//     const seeded = STRICT_IDS
//       ? await prisma.city.findUnique({
//           where: { id: expected.id },
//           include: { country: true },
//         })
//       : await prisma.city.findUnique({
//           where: { name: expected.name },
//           include: { country: true },
//         });

//     const label = `City seeded: ${expected.name}`;
//     if (!seeded) {
//       addCheck(results, label, false, `Missing city (${STRICT_IDS ? expected.id : expected.name})`);
//       continue;
//     }

//     const expectedCountry = EXPECTED_COUNTRIES.find((country) => country.id === expected.countryId);
//     const isValid = STRICT_IDS
//       ? seeded.name === expected.name &&
//         seeded.countryId === expected.countryId &&
//         seeded.timezone === expected.timezone &&
//         seeded.id === expected.id
//       : seeded.name === expected.name &&
//         seeded.timezone === expected.timezone &&
//         seeded.country.name === expectedCountry?.name;

//     addCheck(
//       results,
//       label,
//       isValid,
//       isValid
//         ? `id=${seeded.id}`
//         : `Expected ${JSON.stringify(expected)} but got ${JSON.stringify({
//             id: seeded.id,
//             name: seeded.name,
//             countryId: seeded.countryId,
//             timezone: seeded.timezone,
//           })}`
//     );
//   }
// }

// async function verifyCategories(results: CheckResult[]) {
//   for (const expected of EXPECTED_CATEGORIES) {
//     const seeded = STRICT_IDS
//       ? await prisma.category.findUnique({ where: { id: expected.id } })
//       : await prisma.category.findUnique({ where: { name: expected.name } });

//     const label = `Category seeded: ${expected.name}`;
//     if (!seeded) {
//       addCheck(results, label, false, `Missing category (${STRICT_IDS ? expected.id : expected.name})`);
//       continue;
//     }

//     const isValid = seeded.name === expected.name && (!STRICT_IDS || seeded.id === expected.id);
//     addCheck(
//       results,
//       label,
//       isValid,
//       isValid
//         ? `id=${seeded.id}`
//         : `Expected ${JSON.stringify(expected)} but got ${JSON.stringify({
//             id: seeded.id,
//             name: seeded.name,
//           })}`
//     );
//   }
// }

// async function verifyPricingAccuracy(results: CheckResult[]) {
//   const attractions = await prisma.attraction.findMany({
//     include: {
//       city: { select: { name: true } },
//       category: { select: { name: true } },
//     },
//   });

//   const outliers: string[] = [];
//   for (const attraction of attractions) {
//     const cityBands = CITY_CATEGORY_PRICE_BANDS[attraction.city.name];
//     const band = cityBands?.[attraction.category.name];
//     if (!band) continue;

//     if (attraction.avgCost < band.min || attraction.avgCost > band.max) {
//       outliers.push(
//         `${attraction.city.name}/${attraction.category.name}/${attraction.name}=${attraction.avgCost} (expected ${band.min}-${band.max})`
//       );
//     }
//   }

//   addCheck(
//     results,
//     'No pricing outliers beyond city-category bands',
//     outliers.length === 0,
//     outliers.length === 0
//       ? `checked=${attractions.length}`
//       : `outliers=${outliers.length}; sample=${outliers.slice(0, 3).join(' | ')}`
//   );

//   const anchoredRows = await prisma.attraction.findMany({
//     where: { placeId: { in: Object.keys(ATTRACTION_PRICE_ANCHORS) } },
//     select: {
//       placeId: true,
//       name: true,
//       avgCost: true,
//     },
//   });
//   const anchoredByPlaceId = new Map(anchoredRows.map((row) => [row.placeId, row]));
//   const anchorMismatches: string[] = [];

//   for (const [placeId, expectedCost] of Object.entries(ATTRACTION_PRICE_ANCHORS)) {
//     const row = anchoredByPlaceId.get(placeId);
//     if (!row) {
//       anchorMismatches.push(`${placeId}=missing`);
//       continue;
//     }

//     if (Math.abs(row.avgCost - expectedCost) > 1) {
//       anchorMismatches.push(`${row.name}=${row.avgCost} expected=${expectedCost}`);
//     }
//   }

//   addCheck(
//     results,
//     'Anchored attractions use curated pricing',
//     anchorMismatches.length === 0,
//     anchorMismatches.length === 0
//       ? `anchorsChecked=${Object.keys(ATTRACTION_PRICE_ANCHORS).length}`
//       : `mismatches=${anchorMismatches.length}; sample=${anchorMismatches.slice(0, 3).join(' | ')}`
//   );
// }

// async function run() {
//   const results: CheckResult[] = [];
//   const expectedAttractionsTotal = parseExpectedAttractionsTotal();
//   const expectedMinPerCity = parseExpectedMinPerCity();

//   const [countryCount, cityCount, categoryCount, attractionCount] = await prisma.$transaction([
//     prisma.country.count(),
//     prisma.city.count(),
//     prisma.category.count(),
//     prisma.attraction.count(),
//   ]);

//   addCheck(
//     results,
//     'Country count',
//     countryCount === EXPECTED_COUNTRIES.length,
//     `expected=${EXPECTED_COUNTRIES.length} actual=${countryCount}`
//   );
//   addCheck(
//     results,
//     'City count',
//     cityCount === EXPECTED_CITIES.length,
//     `expected=${EXPECTED_CITIES.length} actual=${cityCount}`
//   );
//   addCheck(
//     results,
//     'Category count',
//     categoryCount === EXPECTED_CATEGORIES.length,
//     `expected=${EXPECTED_CATEGORIES.length} actual=${categoryCount}`
//   );
//   addCheck(
//     results,
//     'Attraction count is non-zero',
//     attractionCount > 0,
//     `actual=${attractionCount}`
//   );

//   if (expectedAttractionsTotal !== undefined) {
//     addCheck(
//       results,
//       'Attraction count matches EXPECTED_ATTRACTIONS_TOTAL',
//       attractionCount === expectedAttractionsTotal,
//       `expected=${expectedAttractionsTotal} actual=${attractionCount}`
//     );
//   }

//   await verifyCountries(results);
//   await verifyCities(results);
//   await verifyCategories(results);
//   await verifyPricingAccuracy(results);

//   const countsByCity = await prisma.attraction.groupBy({
//     by: ['cityId'],
//     _count: { _all: true },
//   });
//   const countsByCityMap = new Map<string, number>(
//     countsByCity.map((row) => [row.cityId, row._count._all])
//   );
//   const seededCities = await prisma.city.findMany({
//     where: { name: { in: EXPECTED_CITIES.map((city) => city.name) } },
//     select: { id: true, name: true },
//   });
//   const cityIdByName = new Map(seededCities.map((city) => [city.name, city.id]));
//   for (const city of EXPECTED_CITIES) {
//     const resolvedCityId = STRICT_IDS ? city.id : cityIdByName.get(city.name);
//     const cityAttractionCount = resolvedCityId ? countsByCityMap.get(resolvedCityId) ?? 0 : 0;
//     addCheck(
//       results,
//       `Attractions exist for city: ${city.name}`,
//       cityAttractionCount > 0,
//       `count=${cityAttractionCount}`
//     );
//   }

//   const countsByCategory = await prisma.attraction.groupBy({
//     by: ['categoryId'],
//     _count: { _all: true },
//   });
//   const countsByCategoryMap = new Map<string, number>(
//     countsByCategory.map((row) => [row.categoryId, row._count._all])
//   );
//   const seededCategories = await prisma.category.findMany({
//     where: { name: { in: EXPECTED_CATEGORIES.map((category) => category.name) } },
//     select: { id: true, name: true },
//   });
//   const categoryIdByName = new Map(seededCategories.map((category) => [category.name, category.id]));
//   for (const category of EXPECTED_CATEGORIES) {
//     const resolvedCategoryId = STRICT_IDS
//       ? category.id
//       : categoryIdByName.get(category.name);
//     const categoryAttractionCount = resolvedCategoryId
//       ? countsByCategoryMap.get(resolvedCategoryId) ?? 0
//       : 0;
//     addCheck(
//       results,
//       `Attractions exist for category: ${category.name}`,
//       categoryAttractionCount > 0,
//       `count=${categoryAttractionCount}`
//     );
//   }

//   if (expectedMinPerCity) {
//     const cityNameToId = STRICT_IDS
//       ? new Map(EXPECTED_CITIES.map((city) => [city.name, city.id]))
//       : cityIdByName;
//     for (const [cityName, minCount] of Object.entries(expectedMinPerCity)) {
//       const cityId = cityNameToId.get(cityName);
//       const actual = cityId ? countsByCityMap.get(cityId) ?? 0 : 0;
//       addCheck(
//         results,
//         `Min attractions for city: ${cityName}`,
//         cityId !== undefined && actual >= minCount,
//         cityId
//           ? `min=${minCount} actual=${actual}`
//           : `City "${cityName}" does not exist in EXPECTED_CITIES`
//       );
//     }
//   }

//   const [invalidBestTimeSlotRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "bestTimeSlot" NOT IN ('morning', 'afternoon', 'evening')
//   `;
//   const [invalidIndoorOutdoorRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "indoorOutdoor" NOT IN ('indoor', 'outdoor', 'both')
//   `;
//   const [invalidIntensityRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "intensityLevel" < 1 OR "intensityLevel" > 5
//   `;
//   const [invalidRatingRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "rating" IS NOT NULL AND ("rating" < 0 OR "rating" > 5)
//   `;
//   const [invalidAvgCostRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "avgCost" < 0
//   `;
//   const [invalidDurationRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "avgDurationMinutes" <= 0
//   `;
//   const [invalidReviewCountRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE "reviewCount" < 0
//   `;
//   const [emptyVibeTagsRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions"
//     WHERE COALESCE(array_length("vibeTags", 1), 0) = 0
//   `;
//   const [duplicatePlaceIdRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM (
//       SELECT "placeId"
//       FROM "attractions"
//       GROUP BY "placeId"
//       HAVING COUNT(*) > 1
//     ) dupes
//   `;
//   const [orphanCityRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions" a
//     LEFT JOIN "cities" c ON c.id = a."cityId"
//     WHERE c.id IS NULL
//   `;
//   const [orphanCategoryRows] = await prisma.$queryRaw<Array<{ count: bigint }>>`
//     SELECT COUNT(*)::bigint AS count
//     FROM "attractions" a
//     LEFT JOIN "categories" c ON c.id = a."categoryId"
//     WHERE c.id IS NULL
//   `;

//   addCheck(
//     results,
//     'No invalid bestTimeSlot values',
//     toNumber(invalidBestTimeSlotRows.count) === 0,
//     `invalidRows=${toNumber(invalidBestTimeSlotRows.count)}`
//   );
//   addCheck(
//     results,
//     'No invalid indoorOutdoor values',
//     toNumber(invalidIndoorOutdoorRows.count) === 0,
//     `invalidRows=${toNumber(invalidIndoorOutdoorRows.count)}`
//   );
//   addCheck(
//     results,
//     'No invalid intensity levels',
//     toNumber(invalidIntensityRows.count) === 0,
//     `invalidRows=${toNumber(invalidIntensityRows.count)}`
//   );
//   addCheck(
//     results,
//     'No invalid ratings',
//     toNumber(invalidRatingRows.count) === 0,
//     `invalidRows=${toNumber(invalidRatingRows.count)}`
//   );
//   addCheck(
//     results,
//     'No negative avgCost',
//     toNumber(invalidAvgCostRows.count) === 0,
//     `invalidRows=${toNumber(invalidAvgCostRows.count)}`
//   );
//   addCheck(
//     results,
//     'No non-positive avgDurationMinutes',
//     toNumber(invalidDurationRows.count) === 0,
//     `invalidRows=${toNumber(invalidDurationRows.count)}`
//   );
//   addCheck(
//     results,
//     'No negative reviewCount',
//     toNumber(invalidReviewCountRows.count) === 0,
//     `invalidRows=${toNumber(invalidReviewCountRows.count)}`
//   );
//   addCheck(
//     results,
//     'No empty vibeTags arrays',
//     toNumber(emptyVibeTagsRows.count) === 0,
//     `invalidRows=${toNumber(emptyVibeTagsRows.count)}`
//   );
//   addCheck(
//     results,
//     'No duplicate placeId values',
//     toNumber(duplicatePlaceIdRows.count) === 0,
//     `duplicatePlaceIds=${toNumber(duplicatePlaceIdRows.count)}`
//   );
//   addCheck(
//     results,
//     'No orphan city references in attractions',
//     toNumber(orphanCityRows.count) === 0,
//     `orphanRows=${toNumber(orphanCityRows.count)}`
//   );
//   addCheck(
//     results,
//     'No orphan category references in attractions',
//     toNumber(orphanCategoryRows.count) === 0,
//     `orphanRows=${toNumber(orphanCategoryRows.count)}`
//   );

//   const passed = results.filter((result) => result.passed);
//   const failed = results.filter((result) => !result.passed);

//   for (const result of results) {
//     console.log(
//       `[${result.passed ? 'PASS' : 'FAIL'}] ${result.name}${result.details ? ` | ${result.details}` : ''}`
//     );
//   }

//   console.log('\nSummary');
//   console.log(`Passed: ${passed.length}`);
//   console.log(`Failed: ${failed.length}`);

//   if (failed.length > 0) {
//     process.exitCode = 1;
//   }
// }

// run()
//   .catch((error) => {
//     console.error('Seed integrity test failed to run:', error);
//     process.exitCode = 1;
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
