import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { buildPcnNotificationVisibilityConditions } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  const params: any[] = [];
  const conditions = buildPcnNotificationVisibilityConditions(actor, params);
  try {
    const result = await pool.query(
      `SELECT document_id, data
       FROM app_documents
       WHERE ${conditions.join(' AND ')}
       ORDER BY data->>'createdAt' DESC, document_id DESC
       LIMIT 50`,
      params,
    );
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    console.error('PostgreSQL PCN notification read error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
