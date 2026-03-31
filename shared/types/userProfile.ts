export type Vibe =
  | 'adventurer'
  | 'foodie'
  | 'culture_nerd'
  | 'slow_traveller'
  | 'night_owl'
  | 'budget_explorer' 

export type Group = 'solo' | 'couple' | 'family' | 'group'
export type Pace = 'relaxed' | 'moderate' | 'fast'
export type WakeUpStyle = 'early_bird' | 'mid_morning' | 'late_riser'
export type Transport = 'public' | 'taxi' | 'walk' | 'mix'
export type BudgetSplit = 'experiences' | 'food' | 'balanced' | 'save'
export type Dietary = 'none' | 'vegetarian' | 'vegan' | 'halal' | 'kosher'
export type AgeGroup = 'adults' | 'seniors' | 'family_young_kids'

export interface UserProfile {
  vibe: Vibe[]
  firstVisit: boolean | null
  group: Group | null
  city: string | null
  arrivalDate: string | null
  departureDate: string | null
  arrivalTime: string | null
  departureTime: string | null
  hotelArea: string | null
  budget: number | null
  currency: string
  budgetSplit: BudgetSplit | null
  pace: Pace | null
  wakeUpStyle: WakeUpStyle | null
  transportPreference: Transport | null
  dietary: Dietary
  mobilityNeeds: boolean
  ageGroup: AgeGroup
  mustVisit: string[]
  avoid: string[]
}

export const defaultUserProfile: UserProfile = { //prevents undefined errors
  vibe: [], //multi-select 
  firstVisit: null,
  group: null, //single-select only
  city: null,
  arrivalDate: null,
  departureDate: null,
  arrivalTime: null,
  departureTime: null,
  hotelArea: null,
  budget: null,
  currency: 'INR',
  budgetSplit: null,
  pace: null,
  wakeUpStyle: null,
  transportPreference: null,
  dietary: 'none',
  mobilityNeeds: false,
  ageGroup: 'adults',
  mustVisit: [],
  avoid: []
}