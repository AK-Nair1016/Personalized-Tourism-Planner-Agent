import styles from './CostSummary.module.css';

interface CostSummaryProps {
  dailySpend: number;
  dailyCap: number;
  totalSpend: number;
  totalBudget: number;
  currency: string;
}

export default function CostSummary({ dailySpend, dailyCap, totalSpend, totalBudget, currency }: CostSummaryProps) {
  const dailyPercent = dailyCap > 0 ? Math.min((dailySpend / dailyCap) * 100, 100) : 0;
  const totalPercent = totalBudget > 0 ? Math.min((totalSpend / totalBudget) * 100, 100) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <span className={styles.label}>Today's spend</span>
        <span className={styles.value}>
          {currency} {dailySpend.toLocaleString()} / {dailyCap.toLocaleString()}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={dailyPercent >= 90 ? `${styles.barFill} ${styles.danger}` : styles.barFill}
          style={{ width: `${dailyPercent}%` }}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Total spend</span>
        <span className={styles.value}>
          {currency} {totalSpend.toLocaleString()} / {totalBudget.toLocaleString()}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={totalPercent >= 90 ? `${styles.barFill} ${styles.danger}` : styles.barFill}
          style={{ width: `${totalPercent}%` }}
        />
      </div>
    </div>
  );
}
