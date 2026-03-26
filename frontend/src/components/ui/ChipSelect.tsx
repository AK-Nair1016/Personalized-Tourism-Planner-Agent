import styles from './ChipSelect.module.css';

interface ChipSelectProps {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

export default function ChipSelect({ options, selected, onToggle }: ChipSelectProps) {
  return (
    <div className={styles.chipSelect}>
      {options.map((item) => (
        <button
          key={item}
          aria-pressed={selected.includes(item)}
          className={selected.includes(item) ? `${styles.chip} ${styles.selected}` : styles.chip}
          onClick={() => onToggle(item)}
          type="button"
        >
          <span className={styles.chipLabel}>{item}</span>
        </button>
      ))}
    </div>
  );
}
