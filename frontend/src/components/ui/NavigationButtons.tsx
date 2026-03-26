import styles from './NavigationButtons.module.css';

interface NavigationButtonsProps {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
}

export default function NavigationButtons({
  onNext,
  onBack,
  nextLabel = 'Next',
  isNextDisabled = false,
}: NavigationButtonsProps) {
  const containerClass = onBack
    ? styles.navigationButtons
    : `${styles.navigationButtons} ${styles.nextOnly}`;

  const nextButtonClass = isNextDisabled
    ? `${styles.button} ${styles.nextButton} ${styles.nextButtonDisabled}`
    : `${styles.button} ${styles.nextButton}`;

  return (
    <div className={containerClass}>
      {onBack && (
        <button
          className={`${styles.button} ${styles.backButton}`}
          onClick={onBack}
          type="button"
        >
          Back
        </button>
      )}
      <button
        className={nextButtonClass}
        disabled={isNextDisabled}
        onClick={onNext}
        type="button"
      >
        {nextLabel}
      </button>
    </div>
  );
}
