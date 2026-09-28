import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { isSafePcnSampleKey } from '@/lib/server/workflow-templates';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { PCN_FILE_ASSET_ID_PATTERN } from '@/lib/server/pcn-quality-documents';
import { PcnQualityDocument } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> | { documentId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isSessionAdmin(actor)) {
    return jsonForbidden('Chỉ Admin mới có quyền thực hiện thao tác này.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const documentId = decodeURIComponent(String(resolvedParams.documentId || '')).trim();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const assetId = String(body?.assetId || '').trim();
  const fileName = String(body?.fileName || '').trim();
  if (!isSafePcnSampleKey(documentId) || !PCN_FILE_ASSET_ID_PATTERN.test(assetId)) {
    return jsonError('Mã tài liệu chất lượng hoặc file asset không hợp lệ.', 400);
  }
  if (fileName.length > 255 || /[\\/]/.test(fileName)) {
    return jsonError('Tên file tài liệu chất lượng không hợp lệ.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pcn-quality-file:${documentId}:${assetId}`,
      ]);
      const documentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnQualityDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId]
      );
      if (documentResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy tài liệu chất lượng PCN.'), { statusCode: 404 });
      }
      const current = mapDocumentRow(documentResult.rows[0]) as PcnQualityDocument;
      if (current.fileAssetId === assetId) return { document: current, idempotent: true as const };

      const assetResult = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [assetId]
      );
      const asset = assetResult.rows[0];
      if (!asset) {
        throw Object.assign(new Error('Không tìm thấy file asset tài liệu chất lượng.'), { statusCode: 404 });
      }
      if (
        String(asset.source_collection) !== 'pcnQualityDocuments' ||
        String(asset.source_document_id) !== documentId ||
        String(asset.source_json_path) !== 'fileAssetId'
      ) {
        throw Object.assign(
          new Error('File asset không trỏ đúng tới tài liệu chất lượng cần gắn.'),
          { statusCode: 409 }
        );
      }

      const now = new Date().toISOString();
      const next: PcnQualityDocument = {
        ...current,
        fileAssetId: assetId,
        ...(fileName ? { fileName } : {}),
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnQualityDocuments' AND document_id = $1`,
        [documentId, JSON.stringify(getDocumentPayload(next))]
      );
      const activityLog = buildActivityLog({
        id: stablePcnMutationId(
          'activity-pcn-quality-file',
          `${documentId}:${assetId}:${next.updatedAt}`
        ),
        action: 'UPDATED',
        entityType: 'PCN_QUALITY_DOCUMENT',
        entityId: documentId,
        entityLabel: next.documentCode,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Gắn file tài liệu chất lượng/chỉ định PCN',
        changes: diffActivityFields(current, next, ['fileAssetId', 'fileName']),
        source: 'UI',
        createdAt: next.updatedAt,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
      );
      return { document: next, activityLog, idempotent: false as const };
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN quality document file attachment error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
