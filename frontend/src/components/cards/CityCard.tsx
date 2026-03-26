import styles from './CityCard.module.css';

interface CityCardProps {
  cityName: string;
  country: string;
  selected: boolean;
  onClick: () => void;
}

export default function CityCard({ cityName, country, selected, onClick }: CityCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${styles.cityCard} ${selected ? styles.selected : ''}`}
      type="button"
    >
      <p className={styles.cityCardName}>{cityName}</p>
      <p className={styles.cityCardCountry}>{country}</p>
    </button>
  );
}
