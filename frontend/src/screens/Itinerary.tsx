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

  if (safeDays.length === 0) {
    return <div>No itinerary data available.</div>;
  }

  const currentDay = safeDays.find((d) => d.day === activeDay) ?? safeDays[0];

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Your {itinerary.city} Trip</h2>
          <p className={styles.subtitle}>
            {safeDays.length} days · {itinerary.currency} {itinerary.total_cost_estimate.toLocaleString()} est.
          </p>
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
                dailyCap={userProfile.budget ? userProfile.budget / safeDays.length : 0}
                totalSpend={itinerary.total_cost_estimate}
                totalBudget={userProfile.budget ?? 0}
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
