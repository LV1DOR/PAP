'use client';
import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clusterReports } from '@/lib/locations';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBoundsOnReports({ reports }) {
  const map = useMap();
  useEffect(() => {
    const points = reports.filter(r => r.latitude != null && r.longitude != null).map(r => [r.latitude, r.longitude]);
    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      // Default Algarve view
      map.setView([37.0194, -7.9322], 10);
    }
  }, [reports, map]);
  return null;
}

function filterDisplayReports(reports) {
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  return (reports || []).filter(r => {
    if (!r.status) return true;
    if (r.status === 'rejected') return false;
    if (r.status === 'resolved') {
      const updated = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      return updated > 0 && now - updated <= oneHourMs;
    }
    return true; // reported/validated/in_progress
  });
}

export default function ReportsMap({ reports }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const center = useMemo(() => {
    // Default Algarve center; bounds fitting will adjust after mount
    return [37.0194, -7.9322];
  }, [reports]);

  const displayReports = useMemo(() => filterDisplayReports(reports), [reports]);
  const clusters = useMemo(() => clusterReports(displayReports, { gridSize: 120, timeWindowMins: 90 }), [displayReports]);

  if (!ready) return <div className="h-64 w-full flex items-center justify-center text-sm text-gray-500">Loading map...</div>;

  return (
    <MapContainer center={center} zoom={10} style={{ height: '400px', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBoundsOnReports reports={displayReports} />
      {clusters.map(cl => {
        if (cl.count === 1) {
          const r = cl.members[0];
          return (
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
          );
        }
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
            </Popup>
          </CircleMarker>
        );
      })}
      {(!reports || !reports.length) && (
        <div className="absolute top-2 left-2 bg-white/80 backdrop-blur px-3 py-1 rounded text-xs shadow">No reports yet. Create one to see markers.</div>
      )}
    </MapContainer>
  );
}
