import { Request, Response, NextFunction } from 'express';
import { runPlannerGraph } from '../graph/plannerGraph';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  convertInrToLocal,
  getCurrencySymbol,
  getInrToLocalRate,
} from '../utils/currency';

type RequestError = Error & {
  requestId?: string;
};

type ItinerarySlotLike = {
  slot?: unknown;
  attraction_id?: unknown;
  attraction_name?: unknown;
  category?: unknown;
  duration_minutes?: unknown;
  coordinates?: unknown;
  vibe_note?: unknown;
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

function localizeItineraryCosts(
  itinerary: ItineraryLike,
  localCurrencyCode: string,
  localCurrencySymbol: string
) {
  const daysRaw = Array.isArray(itinerary.days) ? (itinerary.days as ItineraryDayLike[]) : [];

  const localizedDays = daysRaw.map((day, dayIndex) => {
    const slotsRaw = Array.isArray(day.slots) ? (day.slots as ItinerarySlotLike[]) : [];

    const localizedSlots = slotsRaw.map((slot, slotIndex) => {
      const estimatedCostInr = round2(asNumber(slot.estimated_cost));
      const estimatedCostLocal = convertInrToLocal(estimatedCostInr, localCurrencyCode);

      return {
        slot: asString(slot.slot, slotIndex === 0 ? 'morning' : slotIndex === 1 ? 'afternoon' : 'evening'),
        attraction_id: asString(slot.attraction_id, `slot-${dayIndex + 1}-${slotIndex + 1}`),
        attraction_name: asString(slot.attraction_name, `Activity ${slotIndex + 1}`),
        category: asString(slot.category, 'general'),
        duration_minutes: asNumber(slot.duration_minutes),
        coordinates:
          typeof slot.coordinates === 'object' && slot.coordinates !== null
            ? slot.coordinates
            : { lat: 0, lng: 0 },
        vibe_note: asString(slot.vibe_note, 'A great match for your travel vibe.'),
        estimated_cost_inr: estimatedCostInr,
        estimated_cost_local: estimatedCostLocal,
        estimated_cost: estimatedCostLocal,
      };
    });

    const dayCostEstimateInr = round2(
      localizedSlots.reduce((sum, slot) => sum + asNumber(slot.estimated_cost_inr), 0)
    );
    const dayCostEstimateLocal = round2(
      localizedSlots.reduce((sum, slot) => sum + asNumber(slot.estimated_cost_local), 0)
    );

    return {
      day: asNumber(day.day) || dayIndex + 1,
      date_label: asString(day.date_label, `Day ${dayIndex + 1}`),
      cluster_area: asString(day.cluster_area, '-'),
      slots: localizedSlots,
      day_cost_estimate_inr: dayCostEstimateInr,
      day_cost_estimate_local: dayCostEstimateLocal,
      day_cost_estimate: dayCostEstimateLocal,
    };
  });

  const totalCostEstimateInr = round2(
    localizedDays.reduce((sum, day) => sum + asNumber(day.day_cost_estimate_inr), 0)
  );
  const totalCostEstimateLocal = round2(
    localizedDays.reduce((sum, day) => sum + asNumber(day.day_cost_estimate_local), 0)
  );

  return {
    city: asString(itinerary.city, 'Trip'),
    currency: localCurrencyCode,
    currency_symbol: localCurrencySymbol,
    pricing_basis_currency: 'INR',
    fx_inr_to_local: getInrToLocalRate(localCurrencyCode),
    total_cost_estimate_inr: totalCostEstimateInr,
    total_cost_estimate_local: totalCostEstimateLocal,
    total_cost_estimate: totalCostEstimateLocal,
    days: localizedDays,
  };
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
    const cityForCurrency = await prisma.city.findFirst({
      where: { name: String(userProfile?.city ?? (itinerary as ItineraryLike)?.city ?? '') },
      include: { country: true },
    });
    const localCurrencyCode = cityForCurrency?.country?.currencyCode ?? 'INR';
    const localCurrencySymbol =
      cityForCurrency?.country?.currencySymbol ?? getCurrencySymbol(localCurrencyCode);
    const localizedItinerary = localizeItineraryCosts(
      itinerary as ItineraryLike,
      localCurrencyCode,
      localCurrencySymbol
    );

    console.group(`[itinerary.generate] full itinerary requestId=${requestId}`);
    console.log(JSON.stringify(itinerary, null, 2));
    console.log('[itinerary.generate] cost audit (day-level)');
    console.table(costAudit.dayBreakdown);
    console.log('[itinerary.generate] cost audit (totals)', costAudit.totals);
    console.log('[itinerary.generate] localized currency', {
      currency: localizedItinerary.currency,
      symbol: localizedItinerary.currency_symbol,
      fxInrToLocal: localizedItinerary.fx_inr_to_local,
    });
    console.groupEnd();

    console.log(
      `[itinerary.generate] success requestId=${requestId} durationMs=${Date.now() - startedAt}`
    );
    res.json({ ...localizedItinerary, tokensUsed, meta });
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
