import { supabase, getServiceClient } from '@/lib/supabase/client';

/**
 * Fetch all locations with basic stats (report counts & last activity).
 */
export async function fetchLocationsWithStats() {
  const client = getServiceClient();
  // Fetch all locations once (service client bypasses RLS recursion issues)
  const { data: locs, error: locErr } = await client
    .from('locations')
    .select('id,slug,name,center_lat,center_lng');
  if (locErr) return { error: locErr.message, locations: [] };
  if (!locs.length) return { locations: [] };

  // Batch fetch reports for these locations
  const locationIds = locs.map(l => l.id);
  const sinceMs = Date.now() - 60 * 60 * 1000; // 1 hour window
  const { data: reportsData, error: repErr } = await client
    .from('reports')
    .select('id,location_id,status,created_at,updated_at')
    .in('location_id', locationIds);
  if (repErr) return { error: repErr.message, locations: [] };

  // Initialize stats map
  const statsMap = new Map();
  for (const l of locs) {
    statsMap.set(l.id, { active: 0, count: 0, last_report_at: null });
  }

  for (const r of reportsData) {
    const s = statsMap.get(r.location_id);
    if (!s) continue;
    const createdTime = new Date(r.created_at).getTime();
    if (!s.last_report_at || createdTime > new Date(s.last_report_at).getTime()) {
      s.last_report_at = r.created_at;
    }
    const isResolved = r.status === 'resolved';
    const isRejected = r.status === 'rejected';
    if (!isResolved && !isRejected) {
      s.active += 1; // ongoing
      s.count += 1;  // counts always include ongoing
    } else if (isResolved) {
      // Include recently resolved (within last hour) in count, but not active
      if (new Date(r.updated_at).getTime() > sinceMs) {
        s.count += 1;
      }
    }
  }

  const result = locs.map(l => ({ ...l, stats: statsMap.get(l.id) }));
  return { locations: result };
}

/**
 * Fetch reports for a given location slug with bounding box filter if defined.
 * @param {string} slug
 * @param {Object} opts
 * @param {number} [opts.limit=200]
 * @param {boolean} [opts.withImages=false]
 */
export async function fetchReportsByLocation(slug, { limit = 200, withImages = true } = {}) {
  const normalized = (slug || '').toLowerCase();
  // Simple exact match after normalizing, with explicit column selection
  const client = getServiceClient();
  const { data: locData, error: locErr } = await client
    .from('locations')
    .select('id,slug,name,center_lat,center_lng,bbox_min_lat,bbox_min_lng,bbox_max_lat,bbox_max_lng')
    .eq('slug', normalized)
    .single();

  if (locErr || !locData) {
    console.warn('[fetchReportsByLocation] slug lookup failed:', { slug, normalized, error: locErr });
    return { error: locErr?.message || 'Location not found', reports: [], location: null };
  }

  let query = client
    .from('reports')
    .select('id,title,latitude,longitude,status,created_at,updated_at,duplicate_of,is_potential_duplicate')
    .eq('location_id', locData.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  // If bounding box present, narrow search
  if (locData.bbox_min_lat != null) {
    query = query
      .gte('latitude', locData.bbox_min_lat)
      .lte('latitude', locData.bbox_max_lat)
      .gte('longitude', locData.bbox_min_lng)
      .lte('longitude', locData.bbox_max_lng);
  }

  const { data: reportsData, error: reportsErr } = await query;
  if (reportsErr) return { error: reportsErr.message, reports: [], location: locData };

  const reports = reportsData.map(r => ({
    id: r.id,
    title: r.title,
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    duplicate_of: r.duplicate_of,
    is_potential_duplicate: r.is_potential_duplicate,
    thumbnail_url: null,
  }));

  if (withImages && reports.length) {
    for (const rep of reports) {
      const { data: imgData } = await client
        .from('report_images')
        .select('thumbnail_url')
        .eq('report_id', rep.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (imgData && imgData.length) rep.thumbnail_url = imgData[0].thumbnail_url;
    }
  }

  return { location: locData, reports };
}

/**
 * Find nearest location to given coordinates within maxDistanceKm (default 25km).
 */
export async function findNearestLocation(latitude, longitude, { maxDistanceKm = 25 } = {}) {
  if (latitude == null || longitude == null) return null;
  const { data: locs, error } = await supabase
    .from('locations')
    .select('id,slug,name,center_lat,center_lng');
  if (error || !locs) return null;
  let best = null;
  for (const l of locs) {
    const d = haversineKm(latitude, longitude, l.center_lat, l.center_lng);
    if (d <= maxDistanceKm && (!best || d < best.distance_km)) {
      best = { id: l.id, slug: l.slug, name: l.name, distance_km: d };
    }
  }
  return best;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Simple spatial-time clustering.
 * Groups reports into cells (gridSize meters) and merges those within timeWindow minutes.
 * Returns array of clusters with center + members.
 */
export function clusterReports(reports, { gridSize = 75, timeWindowMins = 60 } = {}) {
  if (!reports || !reports.length) return [];
  const toRad = d => (d * Math.PI) / 180;
  const meterLat = 111000; // meters per degree latitude approx
  // Build cells map keyed by cell id
  const cells = new Map();
  for (const r of reports) {
    if (r.latitude == null || r.longitude == null) continue;
    // Convert meters to degrees
    const dLat = gridSize / meterLat;
    const dLng = gridSize / (meterLat * Math.cos(toRad(r.latitude)));
    const cellLat = Math.floor(r.latitude / dLat);
    const cellLng = Math.floor(r.longitude / dLng);
    const key = `${cellLat}:${cellLng}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(r);
  }
  const windowMs = timeWindowMins * 60 * 1000;
  const clusters = [];
  for (const members of cells.values()) {
    // Sort by time
    members.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let current = [];
    let startTime = null;
    for (const m of members) {
      const t = new Date(m.created_at).getTime();
      if (!startTime) { startTime = t; current.push(m); continue; }
      if (t - startTime <= windowMs) {
        current.push(m);
      } else {
        clusters.push(buildCluster(current));
        current = [m];
        startTime = t;
      }
    }
    if (current.length) clusters.push(buildCluster(current));
  }
  return clusters;
}

function buildCluster(members) {
  const lat = members.reduce((s, r) => s + r.latitude, 0) / members.length;
  const lng = members.reduce((s, r) => s + r.longitude, 0) / members.length;
  return {
    id: `${members[0].id}-cluster-${members.length}`,
    count: members.length,
    center: { latitude: lat, longitude: lng },
    members,
  };
}

/**
 * Utility to mark suppressed duplicates: choose canonical (first non-duplicate_of) and flag others.
 * (Server-side admin/service role usage.)
 */
export async function suppressDuplicates(reportIds, canonicalId) {
  if (!reportIds?.length || !canonicalId) return { error: 'Missing parameters' };
  const toSuppress = reportIds.filter(id => id !== canonicalId);
  const { error } = await supabase
    .from('reports')
    .update({ suppressed: true, duplicate_of: canonicalId })
    .in('id', toSuppress);
  if (error) return { error: error.message };
  return { suppressed: toSuppress.length, canonicalId };
}
