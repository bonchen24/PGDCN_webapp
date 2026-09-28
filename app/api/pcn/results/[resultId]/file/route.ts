import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/helpers';
import { CertificationDossier, ReturnedTestResult } from '@/types';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossier-operations';
import { PCN_FILE_ASSET_ID_PATTERN, stablePcnMutationId } from '@/lib/server/pcn-files';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resultId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Gắn file KQTN PCN chỉ khả dụng trong profile PCN.');
  }

  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { resultId: rawResultId } = await params;
  const resultId = String(rawResultId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const assetId = String(bodyJson?.assetId || '').trim();
  const fileName = String(bodyJson?.fileName || '').trim();

  if (!isSafePcnSampleKey(resultId) || !PCN_FILE_ASSET_ID_PATTERN.test(assetId)) {
    return jsonBadRequest('Mã KQTN hoặc file asset không hợp lệ.');
  }
  if (fileName.length > 255 || /[\\/]/.test(fileName)) {
    return jsonBadRequest('Tên file KQTN không hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-result-file:${resultId}:${assetId}`]);
      const resultQuery = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'returnedResults' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [resultId],
      );
      if (!resultQuery.rows[0]) throw Object.assign(new Error('Không tìm thấy KQTN cần đính kèm file.'), { statusCode: 404 });
      const currentResult = mapDocumentRow(resultQuery.rows[0]) as ReturnedTestResult;

      const dossierQuery = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [currentResult.dossierId],
      );
      if (!dossierQuery.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ của KQTN.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierQuery.rows[0]) as CertificationDossier;

      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi gắn file KQTN.'), { statusCode: 409 });
      }
      assertPcnDossierOperator(dossier, actor);

      if (currentResult.fileAssetId) {
        if (currentResult.fileAssetId === assetId) return { result: currentResult, idempotent: true as const };
        throw Object.assign(new Error('KQTN này đã có file đính kèm khác.'), { statusCode: 409 });
      }
      if (currentResult.ocrEvidence && fileName !== currentResult.ocrEvidence.sourceFileName) {
        throw Object.assign(new Error('Tên file scan phải khớp với file đã dùng để xác nhận OCR KQTN.'), { statusCode: 409 });
      }

      const assetQuery = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [assetId],
      );
      const asset = assetQuery.rows[0];
      if (!asset) throw Object.assign(new Error('Không tìm thấy file asset KQTN.'), { statusCode: 404 });
      if (
        String(asset.source_collection) !== 'returnedResults' ||
        String(asset.source_document_id) !== resultId ||
        String(asset.source_json_path) !== 'fileAssetId'
      ) {
        throw Object.assign(new Error('File asset không trỏ đúng tới KQTN cần đính kèm.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const nextResult: ReturnedTestResult = { ...currentResult, fileAssetId: assetId, updatedAt: now };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'returnedResults' AND document_id = $1`,
        [resultId, JSON.stringify(getDocumentPayload(nextResult))],
      );

      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-result-file', `${resultId}:${assetId}`),
        action: 'UPDATED',
        entityType: 'PCN_RESULT',
        entityId: resultId,
        entityLabel: nextResult.reportNumber || resultId,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: `Gắn file ${fileName || assetId} vào KQTN trả về`,
        source: 'UI',
        groupId: nextResult.dossierId,
        changes: diffActivityFields(currentResult, nextResult, ['fileAssetId']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );

      return { result: nextResult, activityLog, idempotent: false as const };
    });

    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN returned result file pointer error:', error);
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || 500);
  }
}
