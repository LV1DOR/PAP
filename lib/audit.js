import { getServiceClient } from '@/lib/supabase/client';

/**
 * Insert an audit log entry.
 * Uses service role client to bypass RLS.
 * 
 * @param {Object} params
 * @param {string} params.action - Action description (e.g., 'status_changed', 'report_created')
 * @param {string|null} params.userId - User ID who performed the action (null for system)
 * @param {string|null} params.reportId - Related report ID (nullable)
 * @param {Object} params.meta - Additional metadata (e.g., { from: 'reported', to: 'validated' })
 */
export async function logAudit({ action, userId = null, reportId = null, meta = {} }) {
  try {
    const client = getServiceClient();
    const { error } = await client.from('audit_logs').insert([
      {
        action,
        user_id: userId,
        report_id: reportId,
        meta,
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.error('Failed to insert audit log:', error.message);
    }
  } catch (e) {
    console.error('Audit log exception:', e.message);
  }
}

/**
 * Log a status change event
 */
export async function logStatusChange({ reportId, userId, fromStatus, toStatus }) {
  return logAudit({
    action: 'status_changed',
    userId,
    reportId,
    meta: { from: fromStatus, to: toStatus },
  });
}

/**
 * Log report creation
 */
export async function logReportCreated({ reportId, userId, title }) {
  return logAudit({
    action: 'report_created',
    userId,
    reportId,
    meta: { title },
  });
}

/**
 * Log duplicate suppression
 */
export async function logDuplicateSuppressed({ reportId, userId, canonicalId }) {
  return logAudit({
    action: 'duplicate_suppressed',
    userId,
    reportId,
    meta: { canonical_report_id: canonicalId },
  });
}
