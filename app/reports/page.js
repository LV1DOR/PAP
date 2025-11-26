'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

// Dynamically import map to avoid SSR window errors
const ReportsMap = dynamic(() => import('@/components/reports/ReportsMap'), { ssr: false });

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/reports?limit=100&with_images=true');
        if (!res.ok) throw new Error('Failed to load reports');
        const json = await res.json();
        setReports(json.items || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Reports Map</h1>
      {error && <div className="text-red-600">{error}</div>}
      <ReportsMap reports={reports} />
      <div>
        <h2 className="text-xl font-semibold mb-2">Recent Reports</h2>
        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        <ul className="grid md:grid-cols-3 gap-4">
          {reports.map(r => (
            <li key={r.id} className="border rounded p-3 space-y-2 bg-white shadow-sm">
              <div className="font-medium">{r.title}</div>
              {r.thumbnail_url && (
                <img src={r.thumbnail_url} alt={r.title} className="w-full h-32 object-cover rounded" />
              )}
              <div className={cn('text-xs px-2 py-1 rounded inline-block',
                r.status === 'reported' && 'bg-yellow-100 text-yellow-700',
                r.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                r.status === 'resolved' && 'bg-green-100 text-green-700'
              )}>{r.status}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
