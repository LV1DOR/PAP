// Workflow helper for report status transitions
// Allowed statuses defined in schema: reported, validated, in_progress, resolved, rejected
// Roles: citizen (limited), staff/admin (full workflow control)

export const AllowedStatuses = [
  'reported',
  'validated',
  'in_progress',
  'resolved',
  'rejected'
];

// Transition map: source -> allowed target statuses
const transitions = {
  reported: ['validated', 'rejected'],
  validated: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [], // terminal
  rejected: [] // terminal unless reopened logic added later
};

export function canTransition(current, target) {
  if (!AllowedStatuses.includes(target)) return false;
  if (current === target) return true; // idempotent
  const allowed = transitions[current] || [];
  return allowed.includes(target);
}

// Role-based permission: citizens can only set reported->reported (no change) or view.
// Staff/Admin can perform defined transitions.
export function canUserChangeStatus(role, current, target) {
  if (role === 'staff' || role === 'admin') {
    return canTransition(current, target);
  }
  // citizens cannot transition except no-op
  if (role === 'citizen') {
    return current === target; // no-op allowed
  }
  return false;
}

export function validateStatusPayload(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };
  const { status } = body;
  if (!status) return { ok: false, error: 'Missing status field' };
  if (!AllowedStatuses.includes(status)) return { ok: false, error: 'Invalid status value' };
  return { ok: true, status };
}
