'use client';
import { Card } from '@/components/ui/card';

export default function TownCard({ town, onClick }) {
  const { name, slug, stats } = town;
  return (
    <Card className="p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md transition" onClick={() => onClick?.(slug)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{name}</h3>
        <span className="text-xs text-gray-500">{slug}</span>
      </div>
      <div className="flex gap-4 text-sm">
        <div><span className="font-medium">Total:</span> {stats.count}</div>
        <div><span className="font-medium">Active:</span> {stats.active}</div>
      </div>
      <div className="text-xs text-gray-500">Last: {stats.last_report_at ? new Date(stats.last_report_at).toLocaleDateString() : '—'}</div>
    </Card>
  );
}
