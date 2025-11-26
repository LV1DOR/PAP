import { supabase } from '@/lib/supabase/client';

// Simple text similarity: Jaccard over word sets
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union ? intersection / union : 0;
}

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find potential duplicate reports near given location & similar title.
 * @param {Object} opts
 * @param {string} opts.title - New report title
 * @param {number} opts.latitude
 * @param {number} opts.longitude
 * @param {number} [opts.radius=75] - search radius meters
 * @param {number} [opts.minSimilarity=0.4]
 * @param {number} [opts.maxHours=24] - lookback window hours
 */
export async function findDuplicateReports({ title, latitude, longitude, radius = 75, minSimilarity = 0.4, maxHours = 24 }) {
  if (latitude == null || longitude == null || !title) return [];
  const dLat = radius / 111000; // degrees latitude ~111km
  const dLng = radius / (111000 * Math.cos((latitude * Math.PI) / 180));
  const sinceIso = new Date(Date.now() - maxHours * 3600 * 1000).toISOString();

  // Initial bounding box query (rough filter)
  const { data, error } = await supabase
    .from('reports')
    .select('id,title,latitude,longitude,created_at,status')
    .gte('created_at', sinceIso)
    .gte('latitude', latitude - dLat)
    .lte('latitude', latitude + dLat)
    .gte('longitude', longitude - dLng)
    .lte('longitude', longitude + dLng)
    .limit(50);

  if (error || !data) return [];

  const results = [];
  for (const r of data) {
    if (r.latitude == null || r.longitude == null) continue;
    const dist = haversine(latitude, longitude, r.latitude, r.longitude);
    if (dist > radius) continue;
    const sim = textSimilarity(title, r.title);
    if (sim >= minSimilarity) {
      results.push({ id: r.id, distance_m: Math.round(dist), similarity: Number(sim.toFixed(3)), title: r.title, status: r.status });
    }
  }
  // Sort higher similarity then closer distance
  results.sort((a, b) => b.similarity - a.similarity || a.distance_m - b.distance_m);
  return results;
}

export { textSimilarity, haversine };