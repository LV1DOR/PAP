// API route for creating invitations
// POST /api/invitations

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/client';
import { sendInvitationEmail } from '@/lib/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const supabase = getServiceClient();
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[/api/invitations GET] Auth error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role, municipality_id, status')
      .eq('id', user.id)
      .single();

    if (!userData || userData.status !== 'active') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query based on role
    let query = supabase
      .from('user_invitations')
      .select(`
        *,
        locations(name),
        users!invited_by(email, name)
      `)
      .order('created_at', { ascending: false });

    if (userData.role === 'municipality_admin') {
      // Municipality admin sees only their municipality's invites
      query = query.eq('municipality_id', userData.municipality_id);
    } else if (userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: invitations, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invitations }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const supabase = getServiceClient();
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[/api/invitations POST] Auth error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role, municipality_id, status, email, name')
      .eq('id', user.id)
      .single();

    if (!userData || userData.status !== 'active') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['super_admin', 'municipality_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role, municipality_id } = body;

    // Validate inputs
    if (!email || !role || !municipality_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['municipality_admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Municipality admin can only invite to their own municipality
    if (userData.role === 'municipality_admin' && userData.municipality_id !== municipality_id) {
      return NextResponse.json({ error: 'Cannot invite to other municipalities' }, { status: 403 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('user_invitations')
      .select('id')
      .eq('email', email)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Pending invitation already exists' }, { status: 400 });
    }

    // Get municipality name
    const { data: municipality } = await supabase
      .from('locations')
      .select('name')
      .eq('id', municipality_id)
      .single();

    if (!municipality) {
      return NextResponse.json({ error: 'Municipality not found' }, { status: 404 });
    }

    // Generate secure token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation (already using service client)
    const { data: invitation, error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        municipality_id,
        invited_by: user.id,
        token: inviteToken,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('[/api/invitations POST] Insert error:', inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    console.log('[/api/invitations POST] Created invitation:', invitation.id);

    // Send invitation email
    const emailResult = await sendInvitationEmail({
      email,
      role,
      municipalityName: municipality.name,
      inviterName: userData.name || userData.email,
      token: inviteToken,
    });

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Don't fail the request, invitation was created
    }

    console.log('[/api/invitations POST] Invite URL:', emailResult.inviteUrl);

    return NextResponse.json({
      invitation,
      emailSent: emailResult.success,
      invite_url: emailResult.inviteUrl,
    }, { status: 201 });
  } catch (e) {
    console.error('Invitation creation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
