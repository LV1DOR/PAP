'use client';
import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function ReportsMap({ reports }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const center = useMemo(() => {
    if (reports && reports.length) {
      const first = reports.find(r => r.latitude != null && r.longitude != null);
      if (first) return [first.latitude, first.longitude];
    }
    return [0, 0];
  }, [reports]);

  if (!ready) return <div className="h-64 w-full flex items-center justify-center text-sm text-gray-500">Loading map...</div>;

  return (
    <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {reports.filter(r => r.latitude != null && r.longitude != null).map(r => (
        <Marker key={r.id} position={[r.latitude, r.longitude]} icon={defaultIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{r.title}</div>
              {r.thumbnail_url && (
                <img src={r.thumbnail_url} alt={r.title} className="w-24 h-24 object-cover rounded" />
              )}
              <div className="text-xs text-gray-600">Status: {r.status}</div>
            </div>
          </Popup>
        </Marker>
      ))}
      {(!reports || !reports.length) && (
        <div className="absolute top-2 left-2 bg-white/80 backdrop-blur px-3 py-1 rounded text-xs shadow">No reports yet. Create one to see markers.</div>
      )}
    </MapContainer>
  );
}
