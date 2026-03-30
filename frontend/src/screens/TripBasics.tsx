import CityCard from '../components/cards/CityCard';
import NavigationButtons from '../components/ui/NavigationButtons';
import type { UserProfile } from '../types/userProfile';
import styles from './TripBasics.module.css';

interface TripBasicsProps {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

const CITIES = [
  { name: 'Dubai', country: 'UAE' },
  { name: 'Goa', country: 'India' },
  { name: 'Singapore', country: 'Singapore' },
  { name: 'Bangkok', country: 'Thailand' },
];

export default function TripBasics({ userProfile, updateProfile, onNext, onBack }: TripBasicsProps) {
  const isNextDisabled =
    !userProfile.city ||
    !userProfile.arrivalDate ||
    !userProfile.departureDate ||
    !userProfile.arrivalTime ||
    !userProfile.departureTime;

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <p className={styles.step}>Step 2 of 4</p>
          <h2 className={styles.title}>Set the trip basics</h2>
          <p className={styles.subtitle}>
            Choose your destination, lock in your arrival and departure timing,
            and add your stay area so the itinerary fits the shape of your trip.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Choose your city</h3>
            <span className={styles.badge}>
              {userProfile.city ?? 'Select a destination'}
            </span>
          </div>

          <div className={styles.cityGrid}>
            {CITIES.map((city) => (
              <div className={styles.cityOption} key={city.name}>
                <CityCard
                  cityName={city.name}
                  country={city.country}
                  selected={userProfile.city === city.name}
                  onClick={() => updateProfile({ city: city.name })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Travel timing</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Arrival date</span>
              <input
                className={styles.input}
                type="date"
                value={userProfile.arrivalDate || ''}
                onChange={(e) => updateProfile({ arrivalDate: e.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Departure date</span>
              <input
                className={styles.input}
                type="date"
                value={userProfile.departureDate || ''}
                onChange={(e) => updateProfile({ departureDate: e.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Arrival time</span>
              <input
                className={styles.input}
                type="time"
                value={userProfile.arrivalTime || ''}
                onChange={(e) => updateProfile({ arrivalTime: e.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Departure time</span>
              <input
                className={styles.input}
                type="time"
                value={userProfile.departureTime || ''}
                onChange={(e) => updateProfile({ departureTime: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Stay details</h3>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span className={styles.fieldLabel}>Hotel area or neighbourhood</span>
            <input
              className={styles.input}
              type="text"
              placeholder="Marina, Old Town, Seminyak, Orchard..."
              value={userProfile.hotelArea || ''}
              onChange={(e) => updateProfile({ hotelArea: e.target.value })}
            />
          </label>
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
