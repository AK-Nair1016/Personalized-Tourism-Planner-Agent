type PricingBand = {
  min: number;
  max: number;
};

export const CITY_CATEGORY_PRICE_BANDS: Record<string, Record<string, PricingBand>> = {
  Bangkok: {
    temple: { min: 0, max: 600 },
    landmark: { min: 300, max: 2500 },
    viewpoint: { min: 800, max: 3500 },
    museum: { min: 200, max: 1500 },
    market: { min: 300, max: 1800 },
    nightlife: { min: 600, max: 3000 },
    food: { min: 200, max: 1500 },
    park: { min: 0, max: 500 },
    entertainment: { min: 500, max: 3000 },
    nature: { min: 300, max: 2500 },
    beach: { min: 0, max: 1500 },
  },
  Goa: {
    temple: { min: 0, max: 600 },
    landmark: { min: 0, max: 700 },
    viewpoint: { min: 0, max: 900 },
    museum: { min: 100, max: 900 },
    market: { min: 300, max: 1500 },
    nightlife: { min: 600, max: 2500 },
    food: { min: 200, max: 1200 },
    park: { min: 0, max: 500 },
    entertainment: { min: 500, max: 2500 },
    nature: { min: 1000, max: 3500 },
    beach: { min: 0, max: 1500 },
  },
  Singapore: {
    temple: { min: 500, max: 2500 },
    landmark: { min: 800, max: 3500 },
    viewpoint: { min: 1200, max: 5000 },
    museum: { min: 800, max: 3000 },
    market: { min: 500, max: 2500 },
    nightlife: { min: 2000, max: 6000 },
    food: { min: 300, max: 1500 },
    park: { min: 500, max: 5000 },
    entertainment: { min: 1500, max: 5000 },
    nature: { min: 1200, max: 6500 },
    beach: { min: 0, max: 2000 },
  },
  Dubai: {
    temple: { min: 500, max: 2500 },
    landmark: { min: 300, max: 3000 },
    viewpoint: { min: 1500, max: 7000 },
    museum: { min: 1500, max: 5000 },
    market: { min: 500, max: 4500 },
    nightlife: { min: 1200, max: 6000 },
    food: { min: 500, max: 2500 },
    park: { min: 0, max: 800 },
    entertainment: { min: 1500, max: 9000 },
    nature: { min: 2500, max: 9000 },
    beach: { min: 0, max: 1200 },
  },
};

export const ATTRACTION_PRICE_ANCHORS: Record<string, number> = {
  'seed-bkk-grand-palace': 1200,
  'seed-bkk-wat-arun': 250,
  'seed-bkk-iconsiam': 1800,
  'seed-goa-baga-beach': 600,
  'seed-goa-chapora-fort': 120,
  'seed-goa-fontainhas': 350,
  'seed-goa-dudhsagar-falls': 1800,
  'seed-sg-gardens-by-the-bay': 3500,
  'seed-sg-zoo': 4500,
  'seed-sg-maxwell-food-centre': 900,
  'seed-sg-night-safari': 4200,
  'seed-dxb-burj-khalifa': 5200,
  'seed-dxb-dubai-mall-aquarium': 3800,
  'seed-dxb-desert-safari': 6500,
  'seed-dxb-aquaventure': 7800,
  'seed-dxb-jumeirah-public-beach': 300,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type PriceCalibrationResult = {
  finalCost: number;
  source: 'anchor' | 'seed';
  clamped: boolean;
  bandMin: number | null;
  bandMax: number | null;
};

export function calibratePrice(input: {
  cityName: string;
  categoryName: string;
  placeId: string;
  proposedCost: number;
}): PriceCalibrationResult {
  const cityBands = CITY_CATEGORY_PRICE_BANDS[input.cityName];
  const band = cityBands?.[input.categoryName];
  const anchor = ATTRACTION_PRICE_ANCHORS[input.placeId];

  const source: 'anchor' | 'seed' = typeof anchor === 'number' ? 'anchor' : 'seed';
  const baseCost = source === 'anchor' ? anchor : input.proposedCost;

  if (!band) {
    return {
      finalCost: Math.max(0, baseCost),
      source,
      clamped: false,
      bandMin: null,
      bandMax: null,
    };
  }

  const finalCost = clamp(baseCost, band.min, band.max);
  return {
    finalCost,
    source,
    clamped: finalCost !== baseCost,
    bandMin: band.min,
    bandMax: band.max,
  };
}

