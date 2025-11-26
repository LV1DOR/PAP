'use client';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useMemo } from 'react';
import { clusterReports } from '@/lib/locations';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ reports, center }) {
  const map = useMap();
  const points = reports.filter(r => r.latitude != null && r.longitude != null).map(r => [r.latitude, r.longitude]);
  if (points.length > 1) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [20, 20] });
  } else {
    map.setView(center, 12);
  }
  return null;
}

export default function LocationMap({ location, reports }) {
  const center = [location.center_lat, location.center_lng];
  // Only show active (non-resolved/rejected) reports as live markers
  const activeReports = useMemo(() => reports.filter(r => r.status !== 'resolved' && r.status !== 'rejected'), [reports]);
  const clusters = useMemo(() => clusterReports(activeReports, { gridSize: 100, timeWindowMins: 120 }), [activeReports]);

  return (
    <MapContainer center={center} zoom={12} style={{ height: '420px', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds reports={activeReports} center={center} />
      {clusters.map(cl => {
        if (cl.count === 1) {
          const r = cl.members[0];
          return (
            <Marker key={r.id} position={[r.latitude, r.longitude]} icon={markerIcon}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold text-sm">{r.title}</div>
                  {r.thumbnail_url && (
                    <img src={r.thumbnail_url} alt={r.title} className="w-24 h-24 object-cover rounded" />
                  )}
                  <div className="text-xs text-gray-600">Status: {r.status}</div>
                </div>
              </Popup>
            </Marker>
          );
        }
        // cluster marker
        return (
          <CircleMarker
            key={cl.id}
            center={[cl.center.latitude, cl.center.longitude]}
            radius={18}
            pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.7 }}
          >
            <Popup>
              <div className="text-sm font-semibold mb-1">{cl.count} reports</div>
              <ul className="space-y-1 max-h-48 overflow-auto text-xs">
                {cl.members.slice(0, 10).map(m => (
                  <li key={m.id}>{m.title}</li>
                ))}
              </ul>
              {cl.members.length > 10 && <div className="text-xs text-gray-500 mt-1">+ {cl.members.length - 10} more</div>}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
