type PlannerSlotLike = {
  slot?: 'morning' | 'afternoon' | 'evening';
  attraction_id?: string;
  estimated_cost?: number;
  [key: string]: unknown;
};

export type PlannerDayLike = {
  day?: number;
  date_label?: string;
  cluster_area?: string;
  day_cost_estimate?: number;
  slots?: PlannerSlotLike[];
};

export type PlannerItineraryRecord = {
  city?: string;
  currency?: string;
  total_cost_estimate?: number;
  days?: PlannerDayLike[];
};

export type ReplanDisruption = {
  day: number;
  slot: 'morning' | 'afternoon' | 'evening';
  description: string;
};

export type ReplanSplitResult = {
  preservedDays: PlannerDayLike[];
  toReplan: PlannerDayLike[];
  replanStartDay: number;
};

const SLOT_ORDER: Record<'morning' | 'afternoon' | 'evening', number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};
const REQUIRED_SLOTS: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];

function normalizeSlotName(value: unknown): 'morning' | 'afternoon' | 'evening' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'morning' || normalized === 'afternoon' || normalized === 'evening') {
    return normalized;
  }
  return undefined;
}

function cloneDay(day: PlannerDayLike): PlannerDayLike {
  return {
    ...day,
    slots: Array.isArray(day.slots)
      ? day.slots.map((slot) => ({
          ...slot,
          slot: normalizeSlotName(slot.slot),
        }))
      : [],
  };
}

function sortSlots(day: PlannerDayLike): PlannerDayLike {
  const slots = Array.isArray(day.slots) ? [...day.slots] : [];

  slots.sort((left, right) => {
    const leftOrder = left.slot ? SLOT_ORDER[left.slot] : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.slot ? SLOT_ORDER[right.slot] : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return {
    ...day,
    slots,
  };
}

function findSlotByName(
  slots: PlannerSlotLike[],
  slotName: 'morning' | 'afternoon' | 'evening'
) {
  return slots.find((slot) => normalizeSlotName(slot.slot) === slotName);
}

function normalizeAttractionValue(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isDuplicateAttraction(
  candidateSlot: PlannerSlotLike,
  existingSlots: PlannerSlotLike[]
) {
  const candidateId = normalizeAttractionValue(candidateSlot.attraction_id);
  const candidateName = normalizeAttractionValue(candidateSlot.attraction_name);

  if (!candidateId && !candidateName) return false;

  return existingSlots.some((slot) => {
    const slotId = normalizeAttractionValue(slot.attraction_id);
    const slotName = normalizeAttractionValue(slot.attraction_name);

    return (candidateId && candidateId === slotId) || (candidateName && candidateName === slotName);
  });
}

export function splitItineraryForReplan(
  existingItinerary: PlannerItineraryRecord,
  disruption: ReplanDisruption
): ReplanSplitResult {
  const normalizedDisruptionSlot = normalizeSlotName(disruption.slot) ?? disruption.slot;
  const preservedDays: PlannerDayLike[] = [];
  const toReplan: PlannerDayLike[] = [];
  const days = Array.isArray(existingItinerary.days) ? existingItinerary.days : [];

  for (const day of days) {
    const dayNumber = typeof day?.day === 'number' ? day.day : 0;
    const dayClone = cloneDay(day);
    const slots = Array.isArray(dayClone.slots) ? dayClone.slots : [];

    if (dayNumber < disruption.day) {
      preservedDays.push(dayClone);
      continue;
    }

    if (dayNumber === disruption.day) {
      preservedDays.push({
        ...dayClone,
        slots: slots.filter(
          (slot) => normalizeSlotName(slot.slot) !== normalizedDisruptionSlot
        ),
      });
      toReplan.push({
        ...dayClone,
        slots: slots.filter(
          (slot) => normalizeSlotName(slot.slot) === normalizedDisruptionSlot
        ),
      });
      continue;
    }

    preservedDays.push(dayClone);
  }

  return {
    preservedDays,
    toReplan,
    replanStartDay: disruption.day,
  };
}

function recalculateItineraryTotals(itinerary: PlannerItineraryRecord): PlannerItineraryRecord {
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  const recalculatedDays = days.map((day, index) => {
    const slots = Array.isArray(day.slots) ? day.slots : [];
    const dayCostEstimate = slots.reduce(
      (sum, slot) => sum + (typeof slot.estimated_cost === 'number' ? slot.estimated_cost : 0),
      0
    );

    return {
      ...day,
      day: typeof day.day === 'number' ? day.day : index + 1,
      slots,
      day_cost_estimate: dayCostEstimate,
    };
  });

  return {
    ...itinerary,
    days: recalculatedDays,
    total_cost_estimate: recalculatedDays.reduce(
      (sum, day) => sum + (typeof day.day_cost_estimate === 'number' ? day.day_cost_estimate : 0),
      0
    ),
  };
}

function mergeSlotsBySlotKey(
  existingSlots: PlannerSlotLike[],
  incomingSlots: PlannerSlotLike[]
): PlannerSlotLike[] {
  const merged = [...existingSlots.map((slot) => ({ ...slot }))];

  for (const incomingSlot of incomingSlots) {
    const normalizedIncomingSlot = normalizeSlotName(incomingSlot.slot);
    if (!normalizedIncomingSlot) {
      merged.push({ ...incomingSlot });
      continue;
    }

    const replacement = {
      ...incomingSlot,
      slot: normalizedIncomingSlot,
    };
    const existingIndex = merged.findIndex(
      (slot) => normalizeSlotName(slot.slot) === normalizedIncomingSlot
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = replacement;
    } else {
      merged.push(replacement);
    }
  }

  return merged;
}

export function mergeReplannedItinerary(
  preservedDays: PlannerDayLike[],
  replannedItinerary: PlannerItineraryRecord
): PlannerItineraryRecord {
  const replannedDays = Array.isArray(replannedItinerary.days) ? replannedItinerary.days : [];
  const mergedDays = new Map<number, PlannerDayLike>();

  for (const day of preservedDays.map(cloneDay)) {
    const dayNumber = typeof day.day === 'number' ? day.day : mergedDays.size + 1;
    mergedDays.set(dayNumber, {
      ...day,
      day: dayNumber,
    });
  }

  for (const day of replannedDays.map(cloneDay)) {
    const dayNumber = typeof day.day === 'number' ? day.day : mergedDays.size + 1;
    const existingDay = mergedDays.get(dayNumber);

    if (!existingDay) {
      mergedDays.set(dayNumber, {
        ...day,
        day: dayNumber,
      });
      continue;
    }

    mergedDays.set(dayNumber, {
      ...existingDay,
      ...day,
      day: dayNumber,
      slots: mergeSlotsBySlotKey(
        Array.isArray(existingDay.slots) ? existingDay.slots : [],
        Array.isArray(day.slots) ? day.slots : []
      ),
    });
  }

  return recalculateItineraryTotals({
    ...replannedItinerary,
    days: Array.from(mergedDays.values())
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
      .map(sortSlots),
  });
}

export function removeDuplicateAttractions(days: PlannerDayLike[]): PlannerDayLike[] {
  const seenAttractionIds = new Set<string>();

  return days.map((day) => {
    const slots = Array.isArray(day.slots) ? day.slots : [];
    return {
      ...day,
      slots: slots.filter((slot) => {
        if (!slot.attraction_id) return true;
        if (seenAttractionIds.has(slot.attraction_id)) return false;
        seenAttractionIds.add(slot.attraction_id);
        return true;
      }),
    };
  });
}

export function normalizeMergedItinerary(itinerary: PlannerItineraryRecord): PlannerItineraryRecord {
  const days = Array.isArray(itinerary.days) ? itinerary.days.map(cloneDay) : [];
  const dedupedDays = removeDuplicateAttractions(days)
    .sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
    .map((day, index) => ({
      ...sortSlots(day),
      day: index + 1,
    }));

  return recalculateItineraryTotals({
    ...itinerary,
    days: dedupedDays,
  });
}

export function enforceSlotIntegrity(
  itinerary: PlannerItineraryRecord,
  referenceItinerary?: PlannerItineraryRecord
): PlannerItineraryRecord {
  const currentDays = Array.isArray(itinerary.days) ? itinerary.days.map(cloneDay) : [];
  const referenceDays = new Map<number, PlannerDayLike>(
    (Array.isArray(referenceItinerary?.days) ? referenceItinerary.days : []).map((day) => [
      typeof day.day === 'number' ? day.day : 0,
      cloneDay(day),
    ])
  );

  const normalizedDays = currentDays
    .sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
    .map((day, index) => {
      const dayNumber = typeof day.day === 'number' ? day.day : index + 1;
      const referenceDay = referenceDays.get(dayNumber);
      const currentSlots = Array.isArray(day.slots) ? day.slots.map((slot) => ({ ...slot })) : [];
      const chosenSlots: PlannerSlotLike[] = [];

      for (const requiredSlot of REQUIRED_SLOTS) {
        const currentSlot = findSlotByName(currentSlots, requiredSlot);
        if (currentSlot) {
          chosenSlots.push({ ...currentSlot, slot: requiredSlot });
          continue;
        }

        const referenceSlot = findSlotByName(
          Array.isArray(referenceDay?.slots) ? referenceDay.slots : [],
          requiredSlot
        );
        if (referenceSlot && !isDuplicateAttraction(referenceSlot, chosenSlots)) {
          chosenSlots.push({ ...referenceSlot, slot: requiredSlot });
        }
      }

      return {
        ...day,
        ...(referenceDay ? { date_label: referenceDay.date_label, cluster_area: referenceDay.cluster_area } : {}),
        day: dayNumber,
        slots: chosenSlots,
      };
    });

  return recalculateItineraryTotals({
    ...itinerary,
    days: normalizedDays.map(sortSlots),
  });
}
