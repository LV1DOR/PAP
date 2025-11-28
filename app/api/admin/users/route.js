import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: list users (profiles) for admin panel
export async function GET(request) {
  try {
    const service = getServiceClient();
    const { data, error } = await service
      .from('users')
      .select('id, email, name, role, status, municipality_id, locations(name)')
      .order('email');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: reset password or generate recovery link
// body: { userId?: string, email?: string, newPassword?: string }
export async function POST(request) {
  try {
    const service = getServiceClient();
    const body = await request.json();
    const { userId, email, newPassword } = body || {};

    if (!userId && !email) {
      return NextResponse.json({ error: 'Provide userId or email' }, { status: 400 });
    }

    let targetUserId = userId;
    let targetEmail = email;
    if (!targetUserId || !targetEmail) {
      // look up auth user via listUsers when one of the identifiers is missing
      const listed = await service.auth.admin.listUsers();
      const match = listed.data?.users?.find((u) => {
        return (userId && u.id === userId) || (email && u.email?.toLowerCase() === email.toLowerCase());
      });
      if (!match) {
        return NextResponse.json({ error: 'Auth user not found' }, { status: 404 });
      }
      targetUserId = match.id;
      targetEmail = match.email;
    }

    if (newPassword) {
      // Directly set a temporary password and confirm email
      const { error: updErr } = await service.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
        email_confirm: true,
      });
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ success: true, mode: 'set-password' });
    }

    // Generate recovery link for manual sending/copying
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
    return NextResponse.json({ success: true, mode: 'recovery-link', recovery_url: linkData?.action_link });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
