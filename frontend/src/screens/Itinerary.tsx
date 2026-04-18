import { useState } from 'react';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import type { Itinerary as ItineraryType } from '@vibetrip/shared/types/Itinerary';
import DayTabs from '../components/ui/DayTabs';
import SlotCard from '../components/cards/SlotCard';
import CostSummary from '../components/ui/CostSummary';
import ItineraryMap from '../components/ui/ItineraryMap';
import styles from './Itinerary.module.css';

interface ItineraryProps {
  userProfile: UserProfile;
  itinerary: ItineraryType;
}

export default function Itinerary({ userProfile, itinerary }: ItineraryProps) {
  const [activeDay, setActiveDay] = useState(1);
  const safeDays = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const fxInrToLocal =
    typeof itinerary.fx_inr_to_local === 'number' && Number.isFinite(itinerary.fx_inr_to_local)
      ? itinerary.fx_inr_to_local
      : 1;
  const budgetInProfileCurrency = userProfile.budget ?? 0;
  const totalBudgetForDisplay =
    itinerary.currency === userProfile.currency
      ? budgetInProfileCurrency
      : itinerary.pricing_basis_currency === userProfile.currency
        ? budgetInProfileCurrency * fxInrToLocal
        : budgetInProfileCurrency;

  if (safeDays.length === 0) {
    return <div>No itinerary data available.</div>;
  }

  const currentDay = safeDays.find((d) => d.day === activeDay) ?? safeDays[0];
  const dailyCapForDisplay = safeDays.length > 0 ? totalBudgetForDisplay / safeDays.length : 0;

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Your {itinerary.city} Trip</h2>
          <p className={styles.subtitle}>
            {safeDays.length} days · {itinerary.currency} {itinerary.total_cost_estimate.toLocaleString()} est.
          </p>
          {typeof itinerary.total_cost_estimate_inr === 'number' && itinerary.currency !== 'INR' && (
            <p className={styles.subtitle}>
              INR {itinerary.total_cost_estimate_inr.toLocaleString()} planning basis
            </p>
          )}
        </div>

        {/* Day tabs */}
        <DayTabs
          totalDays={safeDays.length}
          activeDay={activeDay}
          onSelectDay={setActiveDay}
        />

        {currentDay && (
          <>
            {/* Cluster area */}
            <p className={styles.clusterArea}>📍 {currentDay.cluster_area}</p>

            {/* Map */}
            <ItineraryMap
              slots={currentDay.slots}
              hotelArea={userProfile.hotelArea}
            />

            {/* Slot cards */}
            <div className={styles.slots}>
              {currentDay.slots.map((slot) => (
                <SlotCard
                  key={slot.attraction_id}
                  slot={slot}
                  currency={itinerary.currency}
                />
              ))}
            </div>

            {/* Cost summary */}
              <CostSummary
                dailySpend={currentDay.day_cost_estimate}
                dailyCap={dailyCapForDisplay}
                totalSpend={itinerary.total_cost_estimate}
                totalBudget={totalBudgetForDisplay}
                currency={itinerary.currency}
            />
          </>
        )}

        {/* Replan button - Day 6 */}
        <button className={styles.replanBtn}>
          Replan a slot
        </button>

      </div>
    </section>
  );
}
