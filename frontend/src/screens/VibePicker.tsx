import VibeCard from '../components/cards/VibeCard';
import OptionCard from '../components/cards/OptionCard';
import NavigationButtons from '../components/ui/NavigationButtons';
import { UserProfile, Vibe, Group } from '@vibetrip/shared/types/userProfile';
import styles from './VibePicker.module.css';

interface VibePickerProps {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onNext: () => void;
}

const VIBES: Array<{
  key: Vibe;
  label: string;
  descriptor: string;
}> = [
  { key: 'adventurer', label: 'Adventurer', descriptor: 'Offbeat, outdoors, physical' },
  { key: 'foodie', label: 'Foodie', descriptor: 'Local eats, markets, flavour' },
  { key: 'culture_nerd', label: 'Culture Nerd', descriptor: 'History, temples, slow walks' },
  { key: 'slow_traveller', label: 'Slow Traveller', descriptor: 'Cafes, parks, no schedule' },
  { key: 'night_owl', label: 'Night Owl', descriptor: 'Evenings, rooftops, nightlife' },
  { key: 'budget_explorer', label: 'Budget Explorer', descriptor: 'Free spots, hidden gems' },
];

const groups:Group[] = ['solo', 'couple', 'family', 'group'];

export default function VibePicker({ userProfile, updateProfile, onNext }: VibePickerProps) {
  const { vibe, firstVisit, group } = userProfile;

  const toggleVibe = (selectedVibe: Vibe) => {
    if (vibe.includes(selectedVibe)) {
      const updated = vibe.filter(v => v !== selectedVibe);
      updateProfile({ vibe: updated });
      return;
    }

    if (vibe.length < 2) {
      const updated = [...vibe, selectedVibe];
      updateProfile({ vibe: updated });
    }
  };

  const isNextDisabled =
    vibe.length === 0 ||
    group === null ||
    firstVisit === null;

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <p className={styles.step}>Step 1 of 4</p>
          <h2 className={styles.title}>Select your travel vibe</h2>
          <p className={styles.subtitle}>
            Pick up to two moods so we can shape a plan that feels more like your kind of trip.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>What sounds most like you?</h3>
            <span className={styles.counter}>{vibe.length}/2 selected</span>
          </div>

          <div className={styles.vibeGrid}>
            {VIBES.map((v) => (
              <div key={v.key} className={styles.vibeOption}>
                <VibeCard
                  label={v.label}
                  selected={vibe.includes(v.key)}
                  onClick={() => toggleVibe(v.key)}
                />
                <p className={styles.vibeDescriptor}>{v.descriptor}</p>
              </div>
            ))}
          </div>

          <p className={styles.helperText}>Choose at least one vibe to continue.</p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Is this your first visit?</h3>
          <div className={styles.choiceGrid}>
            <OptionCard
              label="First Time"
              description="Show me the essentials and easy wins."
              selected={firstVisit === true}
              onClick={() => updateProfile({ firstVisit: true })}
            />

            <OptionCard
              label="Been Before"
              description="Skip the basics and lean into fresh finds."
              selected={firstVisit === false}
              onClick={() => updateProfile({ firstVisit: false })}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Who are you travelling with?</h3>
          <div className={styles.choiceGrid}>
            {groups.map(g => (
              <OptionCard
                key={g}
                label={g}
                selected={group === g}
                onClick={() => updateProfile({ group: g })}
              />
            ))}
          </div>
        </section>

        <div className={styles.navigation}>
          <NavigationButtons
            onNext={onNext}
            isNextDisabled={isNextDisabled}
          />
        </div>
      </div>
    </div>
  );
}
