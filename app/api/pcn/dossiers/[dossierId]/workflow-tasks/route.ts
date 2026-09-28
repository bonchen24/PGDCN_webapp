import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { isSafePcnSampleKey } from '@/lib/server/workflow-templates';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ dossierId: string }> | { dossierId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const dossierId = String(resolvedParams.dossierId || '').trim();
  if (!isSafePcnSampleKey(dossierId)) {
    return jsonError('Mã hồ sơ không hợp lệ.', 400);
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1
       ORDER BY COALESCE((data->>'cycleNo')::int, 0), document_id`,
      [dossierId]
    );
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
