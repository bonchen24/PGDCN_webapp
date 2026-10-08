import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonNotFound, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { buildPgdcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PGDCN không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const notificationId = decodeURIComponent(String(resolvedParams.notificationId || '')).trim();
  if (!notificationId) {
    return jsonError('Thiếu mã notification PGDCN.', 400);
  }

  const params: any[] = [];
  const conditions = buildPgdcnNotificationVisibilityConditions(actor, params);
  const idParam = `$${params.push(notificationId)}`;
  try {
    const result = await pool.query(
      `UPDATE app_documents
       SET data = jsonb_set(data, '{read}', 'true'::jsonb, true), updated_at = CURRENT_TIMESTAMP
       WHERE ${conditions.join(' AND ')} AND document_id = ${idParam}
       RETURNING document_id, data`,
      params,
    );
    if (result.rows.length === 0) {
      return jsonNotFound('Không tìm thấy notification PGDCN hoặc notification không thuộc audience.');
    }
    const item = mapDocumentRow(result.rows[0]);
    return jsonOk({
      updated: 1,
      item: { ...item, domain: result.rows[0].data?.domain === 'PGD' ? 'PGD' : 'PCN' },
    });
  } catch (error: any) {
    console.error('PostgreSQL PGDCN notification read mutation error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
