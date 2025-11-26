// Mock supabase client early to avoid env requirement for URL
jest.mock('../../lib/supabase/client', () => ({ supabase: { from: () => ({}) } }));
import { clusterReports } from '../../lib/locations';

describe('clusterReports', () => {
  const baseTime = Date.now();
  const mk = (id, lat, lng, minutesOffset = 0) => ({
    id: id.toString(),
    title: 'Report ' + id,
    latitude: lat,
    longitude: lng,
    status: 'reported',
    created_at: new Date(baseTime + minutesOffset * 60 * 1000).toISOString(),
  });

  test('clusters close in space & time', () => {
    const reports = [
      mk(1, 40.0, -70.0, 0),
      mk(2, 40.0003, -70.0002, 30), // within grid + time window
      mk(3, 40.01, -70.02, 10),     // far spatially
    ];
    const clusters = clusterReports(reports, { gridSize: 100, timeWindowMins: 60 });
    // Expect two clusters: first with 2 members, second with 1
    expect(clusters.length).toBe(2);
    const counts = clusters.map(c => c.count).sort();
    expect(counts).toEqual([1,2]);
  });

  test('time window splits clusters', () => {
    const reports = [
      mk(1, 40.0, -70.0, 0),
      mk(2, 40.0002, -70.0001, 200), // outside 60 min window
    ];
    const clusters = clusterReports(reports, { gridSize: 100, timeWindowMins: 60 });
    expect(clusters.length).toBe(2);
  });
});
