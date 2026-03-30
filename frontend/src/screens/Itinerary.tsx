import type { UserProfile } from '../types/userProfile';
import styles from './Itinerary.module.css';

interface ItineraryProps {
  userProfile: UserProfile;
}

const formatLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

export default function Itinerary({ userProfile }: ItineraryProps) {
  const summaryItems = [
    { label: 'City', value: userProfile.city ?? 'Not selected yet' },
    {
      label: 'Vibes',
      value: userProfile.vibe.length
        ? userProfile.vibe.map(formatLabel).join(' + ')
        : 'Still syncing',
    },
    {
      label: 'Pace',
      value: userProfile.pace ? formatLabel(userProfile.pace) : 'Not chosen',
    },
    {
      label: 'Dietary',
      value: userProfile.dietary ? formatLabel(userProfile.dietary) : 'None',
    },
  ];

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <p className={styles.step}>Your trip blueprint</p>
          <h2 className={styles.title}>Itinerary ready</h2>
          <p className={styles.subtitle}>
            This is your styled itinerary placeholder. The final generated plan
            can slot into this screen without changing the overall layout.
          </p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Trip summary</h3>
          <div className={styles.summaryGrid}>
            {summaryItems.map((item) => (
              <div className={styles.summaryCard} key={item.label}>
                <span className={styles.summaryLabel}>{item.label}</span>
                <span className={styles.summaryValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Preview layout</h3>
          <div className={styles.dayGrid}>
            <article className={styles.dayCard}>
              <span className={styles.dayTag}>Day 1</span>
              <h4 className={styles.dayTitle}>Arrival and easy start</h4>
              <p className={styles.dayCopy}>
                A soft landing with neighborhood exploring, a signature meal,
                and a low-friction first evening.
              </p>
            </article>

            <article className={styles.dayCard}>
              <span className={styles.dayTag}>Day 2</span>
              <h4 className={styles.dayTitle}>Core highlights</h4>
              <p className={styles.dayCopy}>
                A balanced day built around your selected pace, travel style,
                and must-visit priorities.
              </p>
            </article>

            <article className={styles.dayCard}>
              <span className={styles.dayTag}>Day 3</span>
              <h4 className={styles.dayTitle}>Flexible finale</h4>
              <p className={styles.dayCopy}>
                Buffer time for shopping, a final meal, and low-stress logistics
                before departure.
              </p>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
