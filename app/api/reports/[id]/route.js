import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const service = getServiceClient();

    // Fetch base report
    const { data: rep, error: repErr } = await service
      .from('reports')
      .select('id,title,description,latitude,longitude,status,priority,address,created_at,updated_at,category_id,location_id,is_potential_duplicate,suppressed,duplicate_of')
      .eq('id', id)
      .single();

    if (repErr || !rep) {
      return NextResponse.json({ error: repErr?.message || 'Report not found' }, { status: 404 });
    }

    // Attach category
    let category = null;
    if (rep.category_id) {
      const { data: cat } = await service
        .from('categories')
        .select('id,label,slug')
        .eq('id', rep.category_id)
        .single();
      if (cat) category = { id: cat.id, label: cat.label, slug: cat.slug };
    }

    // Attach location
    let location = null;
    if (rep.location_id) {
      const { data: loc } = await service
        .from('locations')
        .select('id,name,slug,center_lat,center_lng')
        .eq('id', rep.location_id)
        .single();
      if (loc) location = { id: loc.id, name: loc.name, slug: loc.slug };
    }

    // Images
    const { data: imgs } = await service
      .from('report_images')
      .select('id,thumbnail_url,storage_path,created_at')
      .eq('report_id', rep.id)
      .order('created_at', { ascending: true });
    const images = (imgs || []).map((i) => ({
      id: i.id,
      thumbnail_url: i.thumbnail_url || null,
      url: i.storage_path || null,
      created_at: i.created_at,
    }));

    // History
    const { data: hist } = await service
      .from('audit_logs')
      .select('id,action,user_id,meta,created_at')
      .eq('report_id', rep.id)
      .order('created_at', { ascending: true });

    // Attach user emails for history (batch fetch)
    const userIds = Array.from(new Set((hist || []).map((h) => h.user_id).filter(Boolean)));
    let usersById = {};
    if (userIds.length) {
      const { data: users } = await service
        .from('users')
        .select('id,email')
        .in('id', userIds);
      (users || []).forEach((u) => { usersById[u.id] = { id: u.id, email: u.email }; });
    }
    const history = (hist || []).map((h) => ({
      id: h.id,
      action: h.action,
      meta: h.meta,
      created_at: h.created_at,
      user: h.user_id ? usersById[h.user_id] || null : null,
    }));

    const report = {
      id: rep.id,
      title: rep.title,
      description: rep.description,
      latitude: Number(rep.latitude),
      longitude: Number(rep.longitude),
      status: rep.status,
      priority: rep.priority,
      address: rep.address,
      created_at: rep.created_at,
      updated_at: rep.updated_at,
      is_potential_duplicate: rep.is_potential_duplicate,
      suppressed: rep.suppressed,
      duplicate_of: rep.duplicate_of,
      category,
      location,
      images,
      history,
    };

    return NextResponse.json({ report }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
