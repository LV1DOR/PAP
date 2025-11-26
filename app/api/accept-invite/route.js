// API route for accepting invitations and creating accounts
// POST /api/accept-invite

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getServiceClient } from '@/lib/supabase/client';
import { sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, password, name } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Validate token using service client
    const serviceClient = getServiceClient();
    const { data: invitation, error: inviteError } = await serviceClient
      .from('user_invitations')
      .select('*, locations(name)')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }

    // Check if already used
    if (invitation.used_at) {
      return NextResponse.json({ error: 'Invitation already used' }, { status: 400 });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
    }

    // Check if email already registered
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('id')
      .eq('email', invitation.email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('[accept-invite] Auth creation error:', authError);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    console.log('[accept-invite] Auth user created:', authData.user.id);

    // Update user record (trigger already created it with default 'citizen' role)
    // We need to set the correct role, municipality, and invited_by
    const { error: userError } = await serviceClient
      .from('users')
      .update({
        name: name || null,
        role: invitation.role,
        municipality_id: invitation.municipality_id,
        invited_by: invitation.invited_by,
        status: 'active',
      })
      .eq('id', authData.user.id);

    if (userError) {
      console.error('[accept-invite] User record update error:', userError);
      // Try to clean up auth user
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: 'Failed to update user record' }, { status: 500 });
    }

    console.log('[accept-invite] User record updated with role:', invitation.role);

    // Mark invitation as used
    await serviceClient
      .from('user_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invitation.id);

    // Send welcome email
    await sendWelcomeEmail({
      email: invitation.email,
      name,
      role: invitation.role,
      municipalityName: invitation.locations?.name || 'your municipality',
    });

    return NextResponse.json({
      success: true,
      email: invitation.email,
    }, { status: 201 });
  } catch (e) {
    console.error('Accept invite error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: Validate token (without creating account)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const { data: invitation, error } = await serviceClient
      .from('user_invitations')
      .select('id, email, role, municipality_id, used_at, expires_at, locations(name)')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 400 });
    }

    const isValid = !invitation.used_at && new Date(invitation.expires_at) > new Date();

    return NextResponse.json({
      valid: isValid,
      invitation: isValid ? {
        email: invitation.email,
        role: invitation.role,
        municipalityName: invitation.locations?.name,
      } : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
