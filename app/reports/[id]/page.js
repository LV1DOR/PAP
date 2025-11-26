'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth/AuthProvider';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

// Leaflet icon setup
let markerIcon;
if (typeof window !== 'undefined') {
  const L = require('leaflet');
  markerIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [userRole, setUserRole] = useState('citizen');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/${id}`);
        if (!res.ok) throw new Error('Failed to load report');
        const data = await res.json();
        setReport(data.report);

        // Fetch user role if authenticated
        if (user) {
          const roleRes = await fetch('/api/auth/me');
          if (roleRes.ok) {
            const roleData = await roleRes.json();
            setUserRole(roleData.role || 'citizen');
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id, user]);

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change status to ${newStatus}?`)) return;
    setStatusChanging(true);
    try {
      const token = localStorage.getItem('supabase.auth.token');
      const accessToken = token ? JSON.parse(token).access_token : null;
      const res = await fetch(`/api/reports/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      // Reload report
      const updated = await fetch(`/api/reports/${id}`);
      const data = await updated.json();
      setReport(data.report);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setStatusChanging(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading report...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  if (!report) return <div className="p-6 text-center">Report not found</div>;

  const canChangeStatus = userRole === 'staff' || userRole === 'admin';
  const statusColor = {
    reported: 'bg-yellow-100 text-yellow-800',
    validated: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{report.title}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className={cn('px-3 py-1 rounded-full text-xs font-medium', statusColor[report.status])}>
              {report.status}
            </span>
            <span>•</span>
            <span>Priority: {report.priority}</span>
            {report.category && (
              <>
                <span>•</span>
                <span>{report.category.label}</span>
              </>
            )}
            {report.location && (
              <>
                <span>•</span>
                <span>{report.location.name}</span>
              </>
            )}
          </div>
        </div>
        <Button onClick={() => router.back()}>← Back</Button>
      </div>

      {/* Warnings */}
      {report.is_potential_duplicate && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-2 rounded text-sm">
          ⚠️ This report may be a duplicate of an existing report.
        </div>
      )}
      {report.suppressed && (
        <div className="bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm">
          🚫 This report has been suppressed (marked as duplicate).
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{report.description}</p>
              {report.address && (
                <div className="mt-3 text-sm text-gray-600">
                  <strong>Address:</strong> {report.address}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          {report.images && report.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Images ({report.images.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {report.images.map((img) => (
                    <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={img.thumbnail_url || img.url}
                        alt="Report"
                        className="w-full h-48 object-cover rounded border hover:opacity-90 transition"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 rounded overflow-hidden">
                {typeof window !== 'undefined' && (
                  <MapContainer
                    center={[report.latitude, report.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[report.latitude, report.longitude]} icon={markerIcon} />
                  </MapContainer>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Coordinates: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff actions */}
          {canChangeStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Staff Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.status === 'reported' && (
                  <>
                    <Button
                      onClick={() => handleStatusChange('validated')}
                      disabled={statusChanging}
                      className="w-full"
                    >
                      Validate
                    </Button>
                    <Button
                      onClick={() => handleStatusChange('rejected')}
                      disabled={statusChanging}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      Reject
                    </Button>
                  </>
                )}
                {report.status === 'validated' && (
                  <>
                    <Button
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={statusChanging}
                      className="w-full"
                    >
                      Start Progress
                    </Button>
                    <Button
                      onClick={() => handleStatusChange('rejected')}
                      disabled={statusChanging}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      Reject
                    </Button>
                  </>
                )}
                {report.status === 'in_progress' && (
                  <>
                    <Button
                      onClick={() => handleStatusChange('resolved')}
                      disabled={statusChanging}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Mark Resolved
                    </Button>
                    <Button
                      onClick={() => handleStatusChange('rejected')}
                      disabled={statusChanging}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {report.history && report.history.length > 0 ? (
                <ul className="space-y-3">
                  {report.history.map((h) => (
                    <li key={h.id} className="text-sm border-l-2 border-gray-200 pl-3">
                      <div className="font-medium text-gray-800">{h.action}</div>
                      <div className="text-xs text-gray-600">
                        {h.user?.email || 'System'} • {new Date(h.created_at).toLocaleString()}
                      </div>
                      {h.meta && Object.keys(h.meta).length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(h.meta)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No history available</p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><strong>ID:</strong> {report.id}</div>
              <div><strong>Created:</strong> {new Date(report.created_at).toLocaleString()}</div>
              <div><strong>Updated:</strong> {new Date(report.updated_at).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
