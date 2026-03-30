import OptionCard from '../components/cards/OptionCard';
import ChipSelect from '../components/ui/ChipSelect';
import NavigationButtons from '../components/ui/NavigationButtons';
import type { AgeGroup, Dietary, UserProfile } from '../types/userProfile';
import styles from './FineTune.module.css';

interface FineTuneProps {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher'];

const AGE_GROUPS: Array<{
  key: AgeGroup;
  label: string;
  description: string;
}> = [
  {
    key: 'adults',
    label: 'All Adults',
    description: 'Built for grown-up pacing and flexibility.',
  },
  {
    key: 'seniors',
    label: 'Travelling with Seniors',
    description: 'Prioritize comfort, easier routes, and gentler transitions.',
  },
  {
    key: 'family_young_kids',
    label: 'Family with Young Kids',
    description: 'Add easier stops, breaks, and shorter movement windows.',
  },
];

const MOBILITY_OPTIONS = [
  {
    key: false,
    label: 'Standard',
    description: 'Walking is generally comfortable for this trip.',
  },
  {
    key: true,
    label: 'Limited Walking / Wheelchair',
    description: 'Favor accessible routes, easier transfers, and less distance.',
  },
];

const parseCommaList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const toDietaryLabel = (value: Dietary) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function FineTune({
  userProfile,
  updateProfile,
  onBack,
  onSubmit,
}: FineTuneProps) {
  return (
    <section className={styles.screen}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <p className={styles.step}>Step 4 of 4</p>
          <h2 className={styles.title}>Add the finishing touches</h2>
          <p className={styles.subtitle}>
            These details help us tailor the itinerary around food, comfort,
            access needs, and the places you absolutely want in or out.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Dietary preference</h3>
            <span className={styles.badge}>
              {toDietaryLabel(userProfile.dietary)}
            </span>
          </div>

          <div className={styles.chipShell}>
            <ChipSelect
              options={DIETARY_OPTIONS}
              selected={userProfile.dietary ? [toDietaryLabel(userProfile.dietary)] : []}
              onToggle={(value) =>
                updateProfile({ dietary: value.toLowerCase() as Dietary })
              }
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Mobility</h3>
          <div className={styles.optionGrid}>
            {MOBILITY_OPTIONS.map((mobilityOption) => (
              <div className={styles.optionShell} key={String(mobilityOption.key)}>
                <OptionCard
                  label={mobilityOption.label}
                  description={mobilityOption.description}
                  selected={userProfile.mobilityNeeds === mobilityOption.key}
                  onClick={() =>
                    updateProfile({ mobilityNeeds: mobilityOption.key })
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Who is this itinerary for?</h3>
          <div className={styles.optionGrid}>
            {AGE_GROUPS.map((ageGroup) => (
              <div className={styles.optionShell} key={ageGroup.key}>
                <OptionCard
                  label={ageGroup.label}
                  description={ageGroup.description}
                  selected={userProfile.ageGroup === ageGroup.key}
                  onClick={() => updateProfile({ ageGroup: ageGroup.key })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Must-visit places</h3>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Add attractions or neighborhoods, separated by commas.
            </span>
            <textarea
              className={styles.textarea}
              placeholder="Wat Pho, Chatuchak, Marina Bay Sands..."
              rows={3}
              value={userProfile.mustVisit.join(', ')}
              onChange={(e) =>
                updateProfile({ mustVisit: parseCommaList(e.target.value) })
              }
            />
          </label>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>What should we avoid?</h3>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Share any places, themes, or experiences to skip.
            </span>
            <textarea
              className={styles.textarea}
              placeholder="Nightlife, malls, long temple days..."
              rows={3}
              value={userProfile.avoid.join(', ')}
              onChange={(e) =>
                updateProfile({ avoid: parseCommaList(e.target.value) })
              }
            />
          </label>
        </section>

        <div className={styles.navigation}>
          <NavigationButtons
            onNext={onSubmit}
            onBack={onBack}
            nextLabel="Build my trip"
            isNextDisabled={false}
          />
        </div>
      </div>
    </section>
  );
}
