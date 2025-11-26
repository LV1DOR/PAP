'use client';
import { useEffect, useState } from 'react';
import LocationMap from '@/components/locations/LocationMap';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function LocationDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/locations/${slug}`);
        if (!res.ok) throw new Error('Failed to load location');
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data?.location) return <div className="p-6">Not found.</div>;

  const { location, reports } = data;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <div className="text-sm text-gray-600">Slug: {location.slug}</div>
        <div className="text-sm">Reports: {reports.length}</div>
      </div>
      <LocationMap location={location} reports={reports} />
      <div>
        <h2 className="text-xl font-semibold mb-3">Recent Reports</h2>
        {reports.length === 0 && <div className="text-sm text-gray-500">No reports yet.</div>}
        <ul className="grid md:grid-cols-3 gap-4">
          {reports.map(r => (
            <li key={r.id} className="border rounded p-3 space-y-2 bg-white shadow-sm">
              <div className="font-medium text-sm line-clamp-2">{r.title}</div>
              {r.thumbnail_url && (
                <img src={r.thumbnail_url} alt={r.title} className="w-full h-28 object-cover rounded" />
              )}
              <div className={cn('text-xs px-2 py-1 rounded inline-block',
                r.status === 'reported' && 'bg-yellow-100 text-yellow-700',
                r.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                r.status === 'resolved' && 'bg-green-100 text-green-700'
              )}>{r.status}</div>
              {r.is_potential_duplicate && (
                <div className="text-[10px] text-orange-600">Potential duplicate</div>
              )}
              {r.duplicate_of && (
                <div className="text-[10px] text-purple-600">Duplicate of {r.duplicate_of}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
