export interface ItinerarySlot {
  slot: 'morning' | 'afternoon' | 'evening';
  attraction_id: string;
  attraction_name: string;
  category: string;
  estimated_cost: number;
  estimated_cost_inr?: number;
  estimated_cost_local?: number;
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
  day_cost_estimate_inr?: number;
  day_cost_estimate_local?: number;
}

export interface Itinerary {
  city: string;
  total_cost_estimate: number;
  total_cost_estimate_inr?: number;
  total_cost_estimate_local?: number;
  currency: string;
  currency_symbol?: string;
  pricing_basis_currency?: string;
  fx_inr_to_local?: number;
  days: ItineraryDay[];
}
