import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { buildPgdcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PGDCN không hợp lệ hoặc đã hết hạn.');
  }

  const params: any[] = [];
  const conditions = buildPgdcnNotificationVisibilityConditions(actor, params);
  try {
    const result = await pool.query(
      `DELETE FROM app_documents
       WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return jsonOk({ deleted: result.rowCount || 0 });
  } catch (error: any) {
    console.error('PostgreSQL PGDCN notification clear error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
