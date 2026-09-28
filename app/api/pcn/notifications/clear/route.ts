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
      `DELETE FROM app_documents
       WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return jsonOk({ deleted: result.rowCount || 0 });
  } catch (error: any) {
    console.error('PostgreSQL PCN notification clear error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
