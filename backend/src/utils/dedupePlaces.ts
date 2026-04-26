type BasicPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

// --- helpers ---
const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

const haversineMeters = (a: BasicPlace, b: BasicPlace): number => {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// 🔥 IMPORTANT CHANGE HERE
export function dedupePlaces(
  primary: BasicPlace[],
  secondary: BasicPlace[]
) {
  const result = [...primary];

  for (const sec of secondary) {
    const isDuplicate = primary.some((pri) => {
      const nameMatch =
        normalizeName(pri.name) === normalizeName(sec.name);

      const distance = haversineMeters(pri, sec);

      return nameMatch || distance < 100;
    });

    if (!isDuplicate) {
      result.push(sec);
    }
  }

  return result;
}