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

    // Check if a profile already exists for this email
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('id, email')
      .eq('email', invitation.email)
      .maybeSingle();

    // If a profile exists, update auth password and profile assignment
    if (existingUser) {
      try {
        // Ensure the auth user exists and set the chosen password
        const listed = await serviceClient.auth.admin.listUsers();
        const authUser = listed.data?.users?.find(
          (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
        );

        if (!authUser) {
          console.error('[accept-invite] Existing profile but no auth user found for email');
          return NextResponse.json({ error: 'Account exists but cannot locate auth user' }, { status: 500 });
        }

        // Update password and confirm email for existing auth user
        const { error: updErr } = await serviceClient.auth.admin.updateUserById(authUser.id, {
          password,
          email_confirm: true,
        });
        if (updErr) {
          console.error('[accept-invite] Failed to update existing auth user password:', updErr);
          return NextResponse.json({ error: 'Failed to update existing account' }, { status: 500 });
        }

        // Update profile details per invitation
        const { error: profileErr } = await serviceClient
          .from('users')
          .update({
            name: name || null,
            role: invitation.role,
            municipality_id: invitation.municipality_id,
            invited_by: invitation.invited_by,
            status: 'active',
          })
          .eq('id', existingUser.id);

        if (profileErr) {
          console.error('[accept-invite] Failed to update existing profile:', profileErr);
          return NextResponse.json({ error: 'Failed to update user record' }, { status: 500 });
        }

        // Mark invitation as used
        await serviceClient
          .from('user_invitations')
          .update({ used_at: new Date().toISOString() })
          .eq('id', invitation.id);

        await sendWelcomeEmail({
          email: invitation.email,
          name,
          role: invitation.role,
          municipalityName: invitation.locations?.name || 'your municipality',
        });

        return NextResponse.json({ success: true, email: invitation.email }, { status: 200 });
      } catch (e) {
        console.error('[accept-invite] Existing-user flow failed:', e);
        return NextResponse.json({ error: 'Failed to complete invitation for existing user' }, { status: 500 });
      }
    }

    // Create auth user (new account path)
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      // If the email already exists in auth, try to attach to that account
      if (authError.code === 'email_exists') {
        try {
          const listed = await serviceClient.auth.admin.listUsers();
          const authUser = listed.data?.users?.find(
            (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
          );

          if (!authUser) {
            console.error('[accept-invite] email_exists but no auth user located');
            return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
          }

          const { error: updErr } = await serviceClient.auth.admin.updateUserById(authUser.id, {
            password,
            email_confirm: true,
          });
          if (updErr) {
            console.error('[accept-invite] Failed to set password for existing auth user:', updErr);
            return NextResponse.json({ error: 'Failed to update existing account' }, { status: 500 });
          }

          // Upsert profile for safety (in case trigger/backfill didn't create it)
          const { error: upsertErr } = await serviceClient
            .from('users')
            .upsert(
              {
                id: authUser.id,
                email: invitation.email,
                name: name || null,
                role: invitation.role,
                municipality_id: invitation.municipality_id,
                invited_by: invitation.invited_by,
                status: 'active',
              },
              { onConflict: 'id' }
            );

          if (upsertErr) {
            console.error('[accept-invite] Upsert existing profile failed:', upsertErr);
            return NextResponse.json({ error: 'Failed to update user record' }, { status: 500 });
          }

          await serviceClient
            .from('user_invitations')
            .update({ used_at: new Date().toISOString() })
            .eq('id', invitation.id);

          await sendWelcomeEmail({
            email: invitation.email,
            name,
            role: invitation.role,
            municipalityName: invitation.locations?.name || 'your municipality',
          });

          return NextResponse.json({ success: true, email: invitation.email }, { status: 200 });
        } catch (e) {
          console.error('[accept-invite] email-exists recovery flow failed:', e);
          return NextResponse.json({ error: 'Failed to complete account setup' }, { status: 500 });
        }
      }

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
