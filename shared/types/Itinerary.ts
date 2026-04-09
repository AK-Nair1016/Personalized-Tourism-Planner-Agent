export interface ItinerarySlot {
  slot: 'morning' | 'afternoon' | 'evening';
  attraction_id: string;
  attraction_name: string;
  category: string;
  estimated_cost: number;
  duration_minutes: number | null;
  coordinates: { lat: number; lng: number };
  vibe_note: string;
}

export interface ItineraryDay {
  day: number;
  date_label: string;
  cluster_area: string;
  slots: ItinerarySlot[];
  day_cost_estimate: number;
}

export interface Itinerary {
  city: string;
  total_cost_estimate: number;
  currency: string;
  days: ItineraryDay[];
}