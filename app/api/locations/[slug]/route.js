'use server';
import { NextResponse } from 'next/server';
import { fetchReportsByLocation } from '@/lib/locations';

export async function GET(_req, { params }) {
  try {
    const { slug } = params;
    const { location, reports, error } = await fetchReportsByLocation(slug, { withImages: true });
    if (error) return NextResponse.json({ error }, { status: 404 });
    return NextResponse.json({ location, reports });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
