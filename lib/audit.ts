import { sql } from '@/lib/db';

export async function writeAuditLog(params: {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await sql`
      INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, meta)
      VALUES (
        ${params.actorId || null},
        ${params.action},
        ${params.entityType || null},
        ${params.entityId || null},
        ${JSON.stringify(params.meta || {})}
      )
    `;
  } catch (err) {
    console.error('audit log failed', err);
  }
}
