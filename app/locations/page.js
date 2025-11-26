'use client';
import { useEffect, useState } from 'react';
import TownCard from '@/components/locations/TownCard';
import { useRouter } from 'next/navigation';

export default function LocationsIndexPage() {
  const [towns, setTowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/locations');
        if (!res.ok) throw new Error('Failed to load locations');
        const json = await res.json();
        setTowns(json.locations || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Algarve Towns</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {towns.map(t => (
          <TownCard key={t.id} town={t} onClick={(slug) => router.push(`/locations/${slug}`)} />
        ))}
      </div>
    </div>
  );
}
