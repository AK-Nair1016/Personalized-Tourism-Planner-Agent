import styles from './VibeCard.module.css';

interface VibeCardProps {
  emoji?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export default function VibeCard({ emoji, label, selected, onClick }: VibeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${styles.vibeCard} ${selected ? styles.selected : ''}`}
      type="button"
    >
      {emoji && <span className={styles.vibeCardEmoji}>{emoji}</span>}
      <span className={styles.vibeCardLabel}>{label}</span>
    </button>
  );
}
