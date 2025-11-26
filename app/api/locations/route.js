'use server';
import { NextResponse } from 'next/server';
import { fetchLocationsWithStats } from '@/lib/locations';

export async function GET() {
  try {
    const { locations, error } = await fetchLocationsWithStats();
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ locations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
