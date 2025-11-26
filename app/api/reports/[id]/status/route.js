'use server';
import { NextResponse } from 'next/server';
import { supabase, getServiceClient } from '@/lib/supabase/client';
import { canUserChangeStatus, validateStatusPayload } from '@/lib/workflow';

// Helper to get user id + role via bearer token
async function getUserContext(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { userId: null, role: 'citizen' }; // treat unauthenticated as lowest role
  }
  const token = authHeader.slice(7);
  try {
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (!userId) return { userId: null, role: 'citizen' };
    // Fetch role from users table
    const { data: roleRow } = await supabase.from('users').select('role').eq('id', userId).single();
    return { userId, role: roleRow?.role || 'citizen' };
  } catch (e) {
    return { userId: null, role: 'citizen' };
  }
}

export async function PATCH(request, { params }) {
  const { id } = params || {};
  if (!id) return NextResponse.json({ error: 'Missing report id' }, { status: 400 });

  // Validate payload
  let body;
  try { body = await request.json(); } catch (_) { body = null; }
  const validation = validateStatusPayload(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const targetStatus = validation.status;

  try {
    const { userId, role } = await getUserContext(request);

    // Fetch current report status
    const { data: currentRow, error: fetchErr } = await supabase
      .from('reports')
      .select('id,status')
      .eq('id', id)
      .single();
    if (fetchErr || !currentRow) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!canUserChangeStatus(role, currentRow.status, targetStatus)) {
      return NextResponse.json({ error: 'Forbidden or invalid transition' }, { status: role === 'citizen' ? 403 : 409 });
    }

    // Use service client for privileged update to ensure audit insertion later
    const client = getServiceClient();
    const { data: updated, error: updErr } = await client
      .from('reports')
      .update({ status: targetStatus })
      .eq('id', id)
      .select('id,status,updated_at')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
