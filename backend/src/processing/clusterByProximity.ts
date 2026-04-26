import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { BudgetOutput } from './calculateBudget';

export interface DayCluster {
  day: number;
  clusterCenter: string;
  slots: {
    slot: 'morning' | 'afternoon' | 'evening';
    attractionId: string;
  }[];
}

// haversine formula — calculates real-world distance between two GPS coordinates
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// nearest neighbour — orders attractions to minimize backtracking within a cluster
function orderByNearestNeighbour(attractions: any[]): any[] {
  if (attractions.length <= 1) return attractions;

  const unvisited = [...attractions];
  const ordered = [unvisited.shift()!];

  while (unvisited.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    unvisited.forEach((a, idx) => {
      const dist = haversineDistance(last.latitude, last.longitude, a.latitude, a.longitude);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  return ordered;
}

function getSlotsPerDay(pace: string): number {
  // The itinerary contract everywhere else in the pipeline is fixed to
  // morning / afternoon / evening. Returning more than 3 here creates
  // duplicate "evening" slots and unstable reconciler input.
  switch (pace) {
    case 'fast':
    case 'moderate':
    case 'relaxed':
    default:
      return 3;
  }
}

function getSlotLabel(index: number): 'morning' | 'afternoon' | 'evening' {
  if (index === 0) return 'morning';
  if (index === 1) return 'afternoon';
  return 'evening';
}

function getDay1StartIndex(arrivalTime: string): number {
  const hour = parseInt(arrivalTime.split(':')[0]);
  if (hour < 12) return 0; // morning
  if (hour < 17) return 1; // afternoon
  return 2;                // evening
}

function getLastDaySlots(departureTime: string, slotsPerDay: number): number {
  const hour = parseInt(departureTime.split(':')[0]);
  if (hour < 10) return 0;
  if (hour < 14) return 1;
  if (hour < 18) return Math.min(2, slotsPerDay);
  return Math.min(3, slotsPerDay);
}

export function clusterByProximity(
  userProfile: UserProfile,
  attractions: any[],
  budgetOutput: BudgetOutput
): DayCluster[] {
  const { effectiveDays } = budgetOutput;
  const slotsPerDay = getSlotsPerDay(userProfile.pace!);
  const totalSlotsNeeded = effectiveDays * slotsPerDay;

  // always include mustVisit attractions first
  const mustVisitIds = userProfile.mustVisit || [];
  const mustVisitAttractions = attractions.filter(a =>
    mustVisitIds.some(mv => a.name.toLowerCase().includes(mv.toLowerCase()))
  );
  const regularAttractions = attractions.filter(a =>
    !mustVisitIds.some(mv => a.name.toLowerCase().includes(mv.toLowerCase()))
  );

  // take only as many attractions as we need slots
  const pool = [...mustVisitAttractions, ...regularAttractions].slice(0, totalSlotsNeeded);

  // split pool into day-sized groups
  const clusters: DayCluster[] = [];

  for (let day = 1; day <= effectiveDays; day++) {
    const start = (day - 1) * slotsPerDay;
    let dayAttractions = pool.slice(start, start + slotsPerDay);

    // adjust Day 1 based on arrival time
    if (day === 1 && userProfile.arrivalTime) {
      const startIndex = getDay1StartIndex(userProfile.arrivalTime);
      dayAttractions = dayAttractions.slice(0, slotsPerDay - startIndex);
    }

    // adjust last day based on departure time
    if (day === effectiveDays && userProfile.departureTime) {
      const availableSlots = getLastDaySlots(userProfile.departureTime, slotsPerDay);
      dayAttractions = dayAttractions.slice(0, availableSlots);
    }

    // order by nearest neighbour to minimize backtracking
    const ordered = orderByNearestNeighbour(
      dayAttractions.filter(a => a.latitude && a.longitude)
    );

    // determine cluster center name
    const clusterCenter = ordered.length > 0
      ? ordered[Math.floor(ordered.length / 2)].name
      : `Day ${day} Area`;

    // assign slot labels
    const slots = ordered.map((a, idx) => ({
      slot: getSlotLabel(idx) as 'morning' | 'afternoon' | 'evening',
      attractionId: a.id,
    }));

    if (slots.length > 0) {
      clusters.push({ day, clusterCenter, slots });
    }
  }

  return clusters;
}
