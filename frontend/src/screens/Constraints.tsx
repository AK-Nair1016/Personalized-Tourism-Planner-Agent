import OptionCard from '../components/cards/OptionCard';
import NavigationButtons from '../components/ui/NavigationButtons';
import type {
  BudgetSplit,
  Pace,
  Transport,
  UserProfile,
  WakeUpStyle,
} from '@vibetrip/shared/types/userProfile';
import styles from './Constraints.module.css';

interface ConstraintsProps {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

const BUDGET_SPLITS: Array<{
  key: BudgetSplit;
  label: string;
  description: string;
}> = [
  {
    key: 'experiences',
    label: 'Mostly Experiences',
    description: 'Leave more room for attractions, tours, and special activities.',
  },
  {
    key: 'food',
    label: 'Mostly Food',
    description: 'Save extra budget for restaurants, cafes, and local specialties.',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Keep spending evenly distributed across the whole trip.',
  },
  {
    key: 'save',
    label: 'Save Wherever Possible',
    description: 'Lean practical and make space for lower-cost choices.',
  },
];

const PACES: Array<{
  key: Pace;
  label: string;
  descriptor: string;
}> = [
  { key: 'relaxed', label: 'Relaxed', descriptor: '2-3 activities each day.' },
  { key: 'moderate', label: 'Moderate', descriptor: '4-5 activities with breathing room.' },
  { key: 'fast', label: 'Fast', descriptor: 'A packed plan with more ground covered.' },
];

const WAKE_UP_STYLES: Array<{
  key: WakeUpStyle;
  label: string;
  descriptor: string;
}> = [
  { key: 'early_bird', label: 'Early Bird', descriptor: 'Usually out the door by 8 AM.' },
  { key: 'mid_morning', label: 'Mid Morning', descriptor: 'A slower start around 10 AM.' },
  { key: 'late_riser', label: 'Late Starter', descriptor: 'Best plans begin closer to noon.' },
];

const TRANSPORTS: Array<{
  key: Transport;
  label: string;
  description: string;
}> = [
  {
    key: 'public',
    label: 'Public Transport',
    description: 'Metro, buses, and practical city routes.',
  },
  {
    key: 'taxi',
    label: 'Taxis / Grab',
    description: 'Convenience first, especially for longer hops.',
  },
  {
    key: 'walk',
    label: 'Walk Everywhere',
    description: 'Keep the itinerary clustered and foot-friendly.',
  },
  {
    key: 'mix',
    label: 'Mix',
    description: 'Use whatever makes the most sense in the moment.',
  },
];

export default function Constraints({
  userProfile,
  updateProfile,
  onNext,
  onBack,
}: ConstraintsProps) {
  const isNextDisabled =
    !userProfile.budget ||
    userProfile.budget <= 0 ||
    !userProfile.pace ||
    !userProfile.budgetSplit;

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <p className={styles.step}>Step 3 of 4</p>
          <h2 className={styles.title}>Set your comfort zone</h2>
          <p className={styles.subtitle}>
            Give us your budget, preferred pace, wake-up style, and transport
            habits so the itinerary feels realistic from morning to night.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Budget</h3>
            <span className={styles.badge}>
              {userProfile.currency} {userProfile.budget ?? 'Required'}
            </span>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Total trip budget</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              placeholder="Enter your total budget"
              value={userProfile.budget || ''}
              onChange={(e) => updateProfile({ budget: Number(e.target.value) })}
            />
          </label>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>How should we split your spend?</h3>
          <div className={styles.optionGrid}>
            {BUDGET_SPLITS.map((budgetSplit) => (
              <div className={styles.optionShell} key={budgetSplit.key}>
                <OptionCard
                  label={budgetSplit.label}
                  description={budgetSplit.description}
                  selected={userProfile.budgetSplit === budgetSplit.key}
                  onClick={() => updateProfile({ budgetSplit: budgetSplit.key })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>What pace feels right?</h3>
          <div className={styles.optionGrid}>
            {PACES.map((pace) => (
              <div className={styles.optionShell} key={pace.key}>
                <OptionCard
                  label={pace.label}
                  description={pace.descriptor}
                  selected={userProfile.pace === pace.key}
                  onClick={() => updateProfile({ pace: pace.key })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>When do you usually start the day?</h3>
          <div className={styles.optionGrid}>
            {WAKE_UP_STYLES.map((wakeUpStyle) => (
              <div className={styles.optionShell} key={wakeUpStyle.key}>
                <OptionCard
                  label={wakeUpStyle.label}
                  description={wakeUpStyle.descriptor}
                  selected={userProfile.wakeUpStyle === wakeUpStyle.key}
                  onClick={() => updateProfile({ wakeUpStyle: wakeUpStyle.key })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>How do you like to get around?</h3>
          <div className={styles.optionGrid}>
            {TRANSPORTS.map((transport) => (
              <div className={styles.optionShell} key={transport.key}>
                <OptionCard
                  label={transport.label}
                  description={transport.description}
                  selected={userProfile.transportPreference === transport.key}
                  onClick={() =>
                    updateProfile({ transportPreference: transport.key })
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <div className={styles.navigation}>
          <NavigationButtons
            onNext={onNext}
            onBack={onBack}
            isNextDisabled={isNextDisabled}
          />
        </div>
      </div>
    </section>
  );
}
