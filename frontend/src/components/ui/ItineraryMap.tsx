import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ItinerarySlot } from '@vibetrip/shared/types/Itinerary';

// fix default marker icon broken in webpack/vite
type LeafletIconDefaultPrototype = L.Icon.Default & {
  _getIconUrl?: () => string;
};

delete (L.Icon.Default.prototype as LeafletIconDefaultPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ItineraryMapProps {
  slots: ItinerarySlot[];
  hotelArea?: string | null;
}

export default function ItineraryMap({ slots, hotelArea }: ItineraryMapProps) {
  const baseAreaLabel = hotelArea?.trim();
  const validSlots = slots.filter(
    (s) => s.coordinates?.lat && s.coordinates?.lng
  );

  if (validSlots.length === 0) return null;

  const center: [number, number] = [
    validSlots[0].coordinates.lat,
    validSlots[0].coordinates.lng,
  ];

  const polylinePoints: [number, number][] = validSlots.map((s) => [
    s.coordinates.lat,
    s.coordinates.lng,
  ]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '350px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      {validSlots.map((slot, index) => (
        <Marker
          key={slot.attraction_id}
          position={[slot.coordinates.lat, slot.coordinates.lng]}
        >
          <Popup>
            <strong>{index + 1}. {slot.attraction_name}</strong>
            <br />
            {slot.slot} · {slot.category}
            {baseAreaLabel ? (
              <>
                <br />
                Base area: {baseAreaLabel}
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}

      <Polyline positions={polylinePoints} color="#3b82f6" weight={2} dashArray="5,8" />
    </MapContainer>
  );
}
