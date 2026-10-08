import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonNotFound, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { buildPcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const notificationId = decodeURIComponent(String(resolvedParams.notificationId || '')).trim();
  if (!notificationId) {
    return jsonError('Thiếu mã notification PCN.', 400);
  }

  const params: any[] = [];
  const conditions = buildPcnNotificationVisibilityConditions(actor, params);
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
      return jsonNotFound('Không tìm thấy notification PCN hoặc notification không thuộc audience.');
    }
    return jsonOk({ updated: 1, item: mapDocumentRow(result.rows[0]) });
  } catch (error: any) {
    console.error('PostgreSQL PCN notification read mutation error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
