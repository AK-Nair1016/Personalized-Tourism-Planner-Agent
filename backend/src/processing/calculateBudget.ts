import { UserProfile } from '@vibetrip/shared/types/userProfile';

export interface BudgetOutput {
  effectiveDays: number;
  dailyBudgetCap: number;
  categoryAllocation: {
    experiences: number;
    food: number;
    transport: number;
    buffer: number;
  };
  flaggedExpensive: {
    attractionId: string;
    avgCost: number;
    reason: string;
  }[];
}

export function calculateBudget(
  userProfile: UserProfile,
  attractions: any[]
): BudgetOutput {
  const arrivalDate = new Date(userProfile.arrivalDate!);
  const departureDate = new Date(userProfile.departureDate!);
  const effectiveDays = Math.max(
    1,
    Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const dailyBudgetCap = userProfile.budget! / effectiveDays;

  // adjust allocation ratios based on budgetSplit preference
  let expRatio = 0.4, foodRatio = 0.3, transportRatio = 0.2, bufferRatio = 0.1;

  switch (userProfile.budgetSplit) {
    case 'experiences':
      expRatio = 0.55; foodRatio = 0.25; transportRatio = 0.15; bufferRatio = 0.05;
      break;
    case 'food':
      expRatio = 0.25; foodRatio = 0.55; transportRatio = 0.15; bufferRatio = 0.05;
      break;
    case 'save':
      expRatio = 0.30; foodRatio = 0.25; transportRatio = 0.20; bufferRatio = 0.25;
      break;
    case 'balanced':
    default:
      break;
  }

  const categoryAllocation = {
    experiences: Math.round(dailyBudgetCap * expRatio),
    food: Math.round(dailyBudgetCap * foodRatio),
    transport: Math.round(dailyBudgetCap * transportRatio),
    buffer: Math.round(dailyBudgetCap * bufferRatio),
  };

  // flag attractions where cost exceeds 20% of daily budget cap
  const flaggedExpensive = attractions
    .filter(a => a.avgCost > dailyBudgetCap * 0.2)
    .map(a => ({
      attractionId: a.id,
      avgCost: a.avgCost,
      reason: `Cost ${a.avgCost} exceeds 20% of daily budget cap ${Math.round(dailyBudgetCap * 0.2)}`,
    }));

  return { effectiveDays, dailyBudgetCap, categoryAllocation, flaggedExpensive };
}