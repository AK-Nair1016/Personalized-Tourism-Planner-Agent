import { useState } from 'react';
import type { Itinerary as ItineraryData, ItinerarySlot } from '@vibetrip/shared/types/Itinerary';
import { replanItinerary } from '../../services/api';
import styles from './ReplanModal.module.css';

type SelectedSlot = {
  day: number;
  slot: ItinerarySlot['slot'];
};

type Props = {
  selectedSlot: SelectedSlot | null;
  itineraryId: string;
  isReplanning: boolean;
  onClose: () => void;
  onSuccess: (newItinerary: ItineraryData) => void;
  setIsReplanning: (value: boolean) => void;
};

export default function ReplanModal({
  selectedSlot,
  itineraryId,
  isReplanning,
  onClose,
  onSuccess,
  setIsReplanning,
}: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!selectedSlot) {
    return null;
  }

  const handleReplan = async () => {
    const description = reason.trim() || 'User requested change';

    try {
      setError(null);
      setIsReplanning(true);

      const updated = await replanItinerary(itineraryId, {
        day: selectedSlot.day,
        slot: selectedSlot.slot,
        description,
      });

      onSuccess(updated);
      setReason('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Replan failed');
      console.error('Replan failed', err);
    } finally {
      setIsReplanning(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="replan-title">
      <div className={styles.modal}>
        <p className={styles.eyebrow}>Change One Slot</p>
        <h3 id="replan-title" className={styles.title}>
          Replan Day {selectedSlot.day} {selectedSlot.slot}
        </h3>
        <p className={styles.copy}>
          Tell the planner what changed, and we&apos;ll replace only this part of the day.
        </p>

        <textarea
          className={styles.input}
          placeholder="Museum closed, weather changed, feeling tired, want something quieter..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isReplanning}
        />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            disabled={isReplanning}
            className={styles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReplan}
            disabled={isReplanning}
            className={styles.primaryButton}
          >
            {isReplanning ? 'Replanning...' : 'Replan Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}
