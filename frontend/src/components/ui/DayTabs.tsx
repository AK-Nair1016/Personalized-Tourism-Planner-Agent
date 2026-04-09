import styles from './DayTabs.module.css';

interface DayTabsProps {
  totalDays: number;
  activeDay: number;
  onSelectDay: (day: number) => void;
}

export default function DayTabs({ totalDays, activeDay, onSelectDay }: DayTabsProps) {
  return (
    <div className={styles.tabRow}>
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          className={activeDay === day ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onSelectDay(day)}
        >
          Day {day}
        </button>
      ))}
    </div>
  );
}