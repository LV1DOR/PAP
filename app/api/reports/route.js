'use server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { findDuplicateReports } from '@/lib/duplicate';
import { findNearestLocation } from '@/lib/locations';

function parseNumber(value, defaultValue) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || null;
    const category = searchParams.get('category') || null;
    const page = parseNumber(searchParams.get('page'), 1);
    const limit = parseNumber(searchParams.get('limit'), 20);
    const withImages = searchParams.get('with_images') === 'true';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius'); // meters

    let query = supabase
      .from('reports')
      .select('id,title,latitude,longitude,status,created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category_id', parseNumber(category, null));

    if (lat && lng && radius) {
      const latNum = parseNumber(lat, null);
      const lngNum = parseNumber(lng, null);
      const r = parseNumber(radius, null);
      if (latNum !== null && lngNum !== null && r !== null) {
        const dLat = r / 111000; // ~ meters per degree latitude
        const dLng = r / (111000 * Math.cos((latNum * Math.PI) / 180));
        query = query
          .gte('latitude', latNum - dLat)
          .lte('latitude', latNum + dLat)
          .gte('longitude', lngNum - dLng)
          .lte('longitude', lngNum + dLng);
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      latitude: r.latitude,
      longitude: r.longitude,
      status: r.status,
      thumbnail_url: null,
    }));

    if (withImages && items.length) {
      // Fetch first image per report (N+1; acceptable for small datasets now)
      for (const report of items) {
        const { data: imgData, error: imgError } = await supabase
          .from('report_images')
          .select('thumbnail_url')
          .eq('report_id', report.id)
          .order('created_at', { ascending: true })
          .limit(1);
        if (!imgError && imgData && imgData.length) {
          report.thumbnail_url = imgData[0].thumbnail_url;
        }
      }
    }

    return NextResponse.json({
      items,
      meta: { page, limit, total: count || 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      latitude,
      longitude,
      address,
      priority = 'medium',
    } = body || {};

    if (!title || !description || !category_id || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try to read bearer token to associate user
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let userId = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7);
      try {
        const { data: userData } = await supabase.auth.getUser(token);
        userId = userData?.user?.id || null;
      } catch (_) {
        userId = null;
      }
    }

    // Duplicate detection BEFORE insert (compare against existing reports)
    const duplicates = await findDuplicateReports({
      title,
      latitude: parseNumber(latitude, null),
      longitude: parseNumber(longitude, null),
      radius: 75,
      minSimilarity: 0.4,
      maxHours: 24,
    });

    // Attempt to auto assign nearest location (within 25km) for geo grouping
    let locationId = null;
    const nearest = await findNearestLocation(parseNumber(latitude, null), parseNumber(longitude, null));
    if (nearest) locationId = nearest.id;

    const insertObj = {
      user_id: userId,
      category_id: parseNumber(category_id, null),
      title,
      description,
      latitude: parseNumber(latitude, null),
      longitude: parseNumber(longitude, null),
      address: address || null,
      status: 'reported',
      priority,
      location_id: locationId,
      is_potential_duplicate: duplicates.length > 0,
    };

    const { data, error } = await supabase
      .from('reports')
      .insert([insertObj])
      .select('id,status,created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      location_id: locationId,
      is_potential_duplicate: duplicates.length > 0,
      possible_duplicates: duplicates,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
