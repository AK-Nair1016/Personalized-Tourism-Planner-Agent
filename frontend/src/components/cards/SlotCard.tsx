import styles from './SlotCard.module.css';
import type { ItinerarySlot } from '@vibetrip/shared/types/Itinerary';

interface SlotCardProps {
  slot: ItinerarySlot;
  currency: string;
  onClick?: () => void;
}

export default function SlotCard({ slot, currency, onClick }: SlotCardProps) {
  const showInrReference =
    typeof slot.estimated_cost_inr === 'number' && currency !== 'INR';

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        <span className={styles.slotBadge}>{slot.slot}</span>
        <span className={styles.categoryBadge}>{slot.category}</span>
      </div>

      <h4 className={styles.name}>{slot.attraction_name}</h4>
      <p className={styles.vibeNote}>{slot.vibe_note}</p>

      <div className={styles.footer}>
        <div>
          <span className={styles.cost}>
            {slot.estimated_cost === 0
              ? 'Free'
              : `${currency} ${slot.estimated_cost.toLocaleString()}`}
          </span>
          {showInrReference && (
            <div className={styles.costMeta}>
              INR {slot.estimated_cost_inr?.toLocaleString()}
            </div>
          )}
        </div>
        {slot.duration_minutes && (
          <span className={styles.duration}>{slot.duration_minutes} min</span>
        )}
      </div>
    </button>
  );
}
