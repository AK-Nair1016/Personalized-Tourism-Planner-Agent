import { Request, Response, NextFunction } from 'express';
import { runPlannerGraph } from '../graph/plannerGraph';
import crypto from 'crypto';

type RequestError = Error & {
  requestId?: string;
};

type ItinerarySlotLike = {
  estimated_cost?: unknown;
};

type ItineraryDayLike = {
  day?: unknown;
  date_label?: unknown;
  cluster_area?: unknown;
  day_cost_estimate?: unknown;
  slots?: unknown;
};

type ItineraryLike = {
  city?: unknown;
  currency?: unknown;
  total_cost_estimate?: unknown;
  days?: unknown;
};

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown, fallback = 'n/a') {
  return typeof value === 'string' ? value : fallback;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function buildCostAudit(itinerary: ItineraryLike) {
  const days = Array.isArray(itinerary.days) ? (itinerary.days as ItineraryDayLike[]) : [];
  const dayBreakdown = days.map((day, index) => {
    const slots = Array.isArray(day.slots) ? (day.slots as ItinerarySlotLike[]) : [];
    const slotCostTotal = round2(
      slots.reduce((sum, slot) => sum + asNumber(slot.estimated_cost), 0)
    );
    const dayCostEstimate = round2(asNumber(day.day_cost_estimate));
    const deltaDayEstimateVsSlots = round2(dayCostEstimate - slotCostTotal);

    return {
      day: asNumber(day.day) || index + 1,
      dateLabel: asString(day.date_label, '-'),
      clusterArea: asString(day.cluster_area, '-'),
      slotsCount: slots.length,
      slotCostTotal,
      dayCostEstimate,
      deltaDayEstimateVsSlots,
    };
  });

  const sumDaySlotTotals = round2(
    dayBreakdown.reduce((sum, day) => sum + day.slotCostTotal, 0)
  );
  const sumDayCostEstimates = round2(
    dayBreakdown.reduce((sum, day) => sum + day.dayCostEstimate, 0)
  );
  const tripTotalEstimate = round2(asNumber(itinerary.total_cost_estimate));

  const totals = {
    tripTotalEstimate,
    sumDayCostEstimates,
    sumDaySlotTotals,
    deltaTripVsDayEstimates: round2(tripTotalEstimate - sumDayCostEstimates),
    deltaTripVsSlotTotals: round2(tripTotalEstimate - sumDaySlotTotals),
    deltaDayEstimatesVsSlotTotals: round2(sumDayCostEstimates - sumDaySlotTotals),
  };

  return { dayBreakdown, totals };
}

export async function generateItinerary(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  console.log(
    `[itinerary.generate] start requestId=${requestId} city=${req.body?.city ?? 'unknown'}`
  );

  try {
    const userProfile = req.body;
    const { itinerary, tokensUsed, meta } = await runPlannerGraph(userProfile, { requestId });
    const costAudit = buildCostAudit(itinerary as ItineraryLike);

    console.group(`[itinerary.generate] full itinerary requestId=${requestId}`);
    console.log(JSON.stringify(itinerary, null, 2));
    console.log('[itinerary.generate] cost audit (day-level)');
    console.table(costAudit.dayBreakdown);
    console.log('[itinerary.generate] cost audit (totals)', costAudit.totals);
    console.groupEnd();

    console.log(
      `[itinerary.generate] success requestId=${requestId} durationMs=${Date.now() - startedAt}`
    );
    res.json({ ...itinerary, tokensUsed, meta });
  } catch (err) {
    const error = err as RequestError;
    error.requestId = requestId;

    console.error(
      `[itinerary.generate] failed requestId=${requestId} durationMs=${Date.now() - startedAt}`
    );
    next(error);
  }
}

export async function replanItinerary(req: Request, res: Response, next: NextFunction) {
  try {
    const { itinerary_id, disruption } = req.body;

    if (!itinerary_id || !disruption) {
      return res.status(400).json({ error: 'itinerary_id and disruption are required' });
    }

    // Day 6 - wire replan logic here
    console.log('replan called:', itinerary_id, disruption);
    res.json({ message: 'Replan coming Day 6' });
  } catch (err) {
    next(err);
  }
}
