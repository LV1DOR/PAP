import { PATCH } from '@/app/api/reports/[id]/status/route';
import { canTransition } from '@/lib/workflow';

// Mock supabase client
jest.mock('@/lib/supabase/client', () => {
  const reportStore = {
    'r1': { id: 'r1', status: 'reported' },
  };
  let roleByUser = { 'u-staff': 'staff', 'u-citizen': 'citizen' };
  return {
    supabase: {
      auth: {
        getUser: async (token) => {
          if (token === 'staff-token') return { data: { user: { id: 'u-staff' } } };
          if (token === 'citizen-token') return { data: { user: { id: 'u-citizen' } } };
          return { data: { user: null } };
        }
      },
      from: (table) => {
        if (table === 'reports') {
          return {
            select: () => ({ eq: (col, val) => ({ single: async () => ({ data: reportStore[val] || null, error: reportStore[val] ? null : { message: 'not found' } }) }) }),
          };
        }
        if (table === 'users') {
          return {
            select: () => ({ eq: (col, val) => ({ single: async () => ({ data: { role: roleByUser[val] || 'citizen' }, error: null }) }) }),
          };
        }
        return { select: () => ({}) };
      }
    },
    getServiceClient: () => ({
      from: () => ({
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'r1', status: 'validated' }, error: null }) }) }) })
      })
    })
  };
});

function buildRequest(body, token) {
  return new Request('http://localhost/api/reports/r1/status', {
    method: 'PATCH',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: JSON.stringify(body)
  });
}

describe('Status workflow API', () => {
  test('allows staff transition reported -> validated', async () => {
    const req = buildRequest({ status: 'validated' }, 'staff-token');
    const res = await PATCH(req, { params: { id: 'r1' } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('validated');
  });

  test('rejects invalid transition reported -> resolved directly', async () => {
    const req = buildRequest({ status: 'resolved' }, 'staff-token');
    const res = await PATCH(req, { params: { id: 'r1' } });
    expect(res.status).toBe(409);
  });

  test('citizen cannot change status', async () => {
    const req = buildRequest({ status: 'validated' }, 'citizen-token');
    const res = await PATCH(req, { params: { id: 'r1' } });
    expect(res.status).toBe(403);
  });

  test('workflow helper canTransition basics', () => {
    expect(canTransition('reported', 'validated')).toBe(true);
    expect(canTransition('reported', 'resolved')).toBe(false);
    expect(canTransition('resolved', 'resolved')).toBe(true); // idempotent
  });
});
