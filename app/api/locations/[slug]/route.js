import { NextResponse } from 'next/server';
import { fetchReportsByLocation } from '@/lib/locations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req, { params }) {
  try {
    const { slug } = params;
    console.log('[locations slug API] Incoming slug:', slug);
    const { location, reports, error } = await fetchReportsByLocation(slug, { withImages: true });
    if (error || !location) {
      console.warn('[locations slug API] Not found / error:', error);
      return NextResponse.json({ error: error || 'not_found', slug }, { status: 404 });
    }
    console.log('[locations slug API] Found location id:', location.id, 'reports:', reports.length);
    return NextResponse.json({ location, reports }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (e) {
    console.error('[locations slug API] Exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
