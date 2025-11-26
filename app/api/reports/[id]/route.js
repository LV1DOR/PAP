import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req, { params }) {
  try {
    const { id } = params;

    // Fetch report with category and location info
    const { data: report, error: reportErr } = await supabase
      .from('reports')
      .select(`
        id,
        title,
        description,
        latitude,
        longitude,
        address,
        status,
        priority,
        is_potential_duplicate,
        duplicate_of,
        suppressed,
        created_at,
        updated_at,
        user_id,
        category_id,
        location_id
      `)
      .eq('id', id)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Fetch images
    const { data: images } = await supabase
      .from('report_images')
      .select('id,url,thumbnail_url,width,height,created_at')
      .eq('report_id', id)
      .order('created_at', { ascending: true });

    // Fetch category
    const { data: category } = await supabase
      .from('categories')
      .select('id,slug,label')
      .eq('id', report.category_id)
      .single();

    // Fetch location
    let location = null;
    if (report.location_id) {
      const { data: loc } = await supabase
        .from('locations')
        .select('id,slug,name')
        .eq('id', report.location_id)
        .single();
      location = loc;
    }

    // Fetch audit history (status changes, etc.)
    const { data: history } = await supabase
      .from('audit_logs')
      .select('id,action,meta,created_at,user_id')
      .eq('report_id', id)
      .order('created_at', { ascending: false });

    // Fetch user info for history entries (if any)
    const historyWithUsers = await Promise.all(
      (history || []).map(async (h) => {
        if (h.user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('email,name')
            .eq('id', h.user_id)
            .single();
          return { ...h, user: userData };
        }
        return { ...h, user: null };
      })
    );

    return NextResponse.json({
      report: {
        ...report,
        category,
        location,
        images: images || [],
        history: historyWithUsers || [],
      },
    }, {
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
