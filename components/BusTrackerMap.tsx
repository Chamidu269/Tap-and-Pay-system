'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon issue in React
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Bus {
  id: string;
  bus_number: string;
  route_name: string | null;
}

interface BusLocation {
  bus_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  updated_at: string;
}

interface MapProps {
  buses: Bus[];
  locations: Record<string, BusLocation>;
}

export default function BusTrackerMap({ buses, locations }: MapProps) {
  const centerLat = 7.8731; // Sri Lanka Central Lat
  const centerLng = 80.7718; // Sri Lanka Central Lng

  // Filter out buses that have a location
  const busesWithLocations = buses.map(bus => {
    const loc = locations[bus.id];
    if (loc && loc.lat && loc.lng) {
      return {
        ...bus,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        speed: loc.speed_kmh,
        updated: loc.updated_at
      };
    }
    return null;
  }).filter(Boolean) as any[];

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
      <MapContainer 
        center={busesWithLocations.length > 0 ? [busesWithLocations[0].lat, busesWithLocations[0].lng] : [centerLat, centerLng]} 
        zoom={busesWithLocations.length > 0 ? 11 : 8} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Gorgeous Dark themed Map
        />
        {busesWithLocations.map((bus) => (
          <Marker key={bus.id} position={[bus.lat, bus.lng]}>
            <Popup>
              <div style={{ color: '#0f172a', fontFamily: 'sans-serif' }}>
                <h4 style={{ margin: '0 0 4px 0' }}>Bus: {bus.bus_number}</h4>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem' }}>Route: <strong>{bus.route_name || 'Unassigned'}</strong></p>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem' }}>Speed: <strong>{bus.speed ? `${bus.speed} km/h` : 'Stopped'}</strong></p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Last Tap: {new Date(bus.updated).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
