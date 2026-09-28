import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonForbidden, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { buildPcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const params: any[] = [];
  const conditions = buildPcnNotificationVisibilityConditions(actor, params);
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
    console.error('PostgreSQL PCN notification read-all error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
