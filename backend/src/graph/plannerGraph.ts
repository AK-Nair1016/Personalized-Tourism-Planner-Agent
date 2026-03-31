import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { vibeAgent } from '../agents/vibeAgent';
import { budgetAgent } from '../agents/budgetAgent';
import { logisticsAgent } from '../agents/logisticsAgent';
import { diversityAgent } from '../agents/diversityAgent';
import { reconcilerAgent } from '../agents/reconcilerAgent';
import { prisma } from '../lib/prisma';

export async function runPlannerGraph(userProfile: UserProfile) {
  // fetch attractions for selected city from DB
  const city = await prisma.city.findFirst({
    where: { name: userProfile.city! },
  });

  if (!city) {
    throw new Error(`City ${userProfile.city} not found in database`);
  }

  const attractions = await prisma.attraction.findMany({
    where: { cityId: city.id },
    include: { category: true },
  });

  // run 4 specialist agents in parallel
  const [vibeOutput, budgetOutput, logisticsOutput] = await Promise.all([
    vibeAgent(userProfile, attractions),
    budgetAgent(userProfile, []),
    logisticsAgent(userProfile, [], attractions),
  ]);

  // diversity agent needs logistics output
  const diversityOutput = await diversityAgent(userProfile, logisticsOutput, attractions);

  // reconciler gets all 4 outputs
  const itinerary = await reconcilerAgent(
    userProfile,
    vibeOutput,
    budgetOutput,
    logisticsOutput,
    diversityOutput,
    attractions
  );

  // store in DB
  await prisma.itinerary.create({
    data: {
      cityId: city.id,
      userProfileJson: userProfile as any,
      itineraryJson: itinerary as any,
      totalCostEstimate: itinerary.total_cost_estimate || 0,
    },
  });

  return itinerary;
}