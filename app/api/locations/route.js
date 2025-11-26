import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Simple fetch without stats for admin use
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, slug, name, center_lat, center_lng')
      .order('name');

    if (error) {
      console.error('[/api/locations] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[/api/locations] Returning', locations?.length || 0, 'locations');

    return NextResponse.json({ locations: locations || [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    console.error('[/api/locations] Exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
