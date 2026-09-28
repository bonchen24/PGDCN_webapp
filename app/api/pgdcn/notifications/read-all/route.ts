import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { buildPgdcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PGDCN không hợp lệ hoặc đã hết hạn.');
  }

  const params: any[] = [];
  const conditions = buildPgdcnNotificationVisibilityConditions(actor, params);
  try {
    const result = await pool.query(
      `UPDATE app_documents
       SET data = jsonb_set(data, '{read}', 'true'::jsonb, true), updated_at = CURRENT_TIMESTAMP
       WHERE ${conditions.join(' AND ')}
         AND COALESCE(data->>'read', 'false') <> 'true'`,
      params,
    );
    return jsonOk({ updated: result.rowCount || 0 });
  } catch (error: any) {
    console.error('PostgreSQL PGDCN notification read-all error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
