import { findDuplicateReports, textSimilarity, haversine } from '../../lib/duplicate';

// Mock supabase client select chain
jest.mock('../../lib/supabase/client', () => {
  // Build a fluent mock chain object that records calls
  const chain = {
    gte: () => chain,
    lte: () => chain,
    limit: () => ({
      data: [
        { id: 1, title: 'Broken street light', latitude: 40.0, longitude: -70.0, created_at: new Date().toISOString(), status: 'reported' },
        { id: 2, title: 'Street light broken', latitude: 40.0003, longitude: -70.0002, created_at: new Date().toISOString(), status: 'reported' },
        { id: 3, title: 'Graffiti on wall', latitude: 40.01, longitude: -70.02, created_at: new Date().toISOString(), status: 'reported' },
      ],
      error: null,
    }),
    select: () => chain,
  };
  return {
    supabase: {
      from: () => chain,
    },
  };
});

describe('duplicate util', () => {
  test('textSimilarity basic overlap', () => {
    const s = textSimilarity('Broken street light', 'Street light broken');
    expect(s).toBeGreaterThan(0.4);
  });

  test('haversine distance sanity', () => {
    const d = haversine(0,0,0,0.001); // ~111m east
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  test('findDuplicateReports returns expected similar reports', async () => {
    const results = await findDuplicateReports({
      title: 'Broken street light',
      latitude: 40.0002,
      longitude: -70.0001,
      radius: 100,
      minSimilarity: 0.3,
      maxHours: 24,
    });
    const ids = results.map(r => r.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // Distant / different title should not appear
    expect(ids).not.toContain(3);
    // similarity ordering
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });
});
