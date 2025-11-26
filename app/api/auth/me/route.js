import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const supabase = getServiceClient();

  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    console.log('[/api/auth/me] Auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.log('[/api/auth/me] No bearer token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    console.log('[/api/auth/me] Token length:', token.length);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('[/api/auth/me] getUser result:', { user: user?.id, error: authError?.message });

    if (authError || !user) {
      console.log('[/api/auth/me] Invalid token:', authError?.message);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch user profile with role and municipality
    const { data: profile, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        municipality_id,
        status,
        locations (
          id,
          name,
          slug
        )
      `)
      .eq('id', user.id)
      .single();

    console.log('[/api/auth/me] Profile query:', { profile, error: userError?.message });

    if (userError || !profile) {
      console.log('[/api/auth/me] User profile not found');
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (profile.status !== 'active') {
      console.log('[/api/auth/me] Account not active:', profile.status);
      return NextResponse.json({ error: 'Account not active' }, { status: 403 });
    }

    console.log('[/api/auth/me] Success, role:', profile.role);

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      municipality_id: profile.municipality_id,
      municipality: profile.locations,
      status: profile.status,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    console.error('[/api/auth/me] Exception:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
