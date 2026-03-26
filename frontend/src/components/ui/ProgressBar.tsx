import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  currentScreen: number;
  totalScreens: number;
}

const steps = ['Who are you', 'Your trip', 'Constraints', 'Fine-tune'];

export default function ProgressBar({
  currentScreen,
  totalScreens,
}: ProgressBarProps) {
  return (
    <div className={styles.progressBar}>
      <div className={styles.inner}>
        <div className={styles.stepsRow}>
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentScreen;
            const isCurrent = stepNumber === currentScreen;
            const circleStateClass = isCompleted
              ? styles.completed
              : isCurrent
                ? styles.current
                : styles.upcoming;
            const labelStateClass = isCurrent ? styles.current : styles.inactive;
            const connectorStateClass =
              stepNumber < currentScreen ? styles.completed : '';

            return (
              <div key={step} className={styles.stepItem}>
                <div className={`${styles.stepCircle} ${circleStateClass}`}>
                  {isCompleted ? '✓' : stepNumber}
                </div>
                <span className={`${styles.stepLabel} ${labelStateClass}`}>
                  {step}
                </span>
                {index < totalScreens - 1 && (
                  <div className={`${styles.connector} ${connectorStateClass}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
