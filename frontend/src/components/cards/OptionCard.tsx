import styles from './OptionCard.module.css';

interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

export default function OptionCard({ label, description, selected, onClick }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${styles.optionCard} ${selected ? styles.selected : ''}`}
      type="button"
    >
      <span className={styles.optionCardLabel}>{label}</span>
      {description && <p className={styles.optionCardDescription}>{description}</p>}
    </button>
  );
}
