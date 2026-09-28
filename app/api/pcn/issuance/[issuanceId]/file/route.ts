import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/helpers';
import { CertificationDossier, IssuancePackage } from '@/types';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import { PCN_FILE_ASSET_ID_PATTERN, stablePcnMutationId } from '@/lib/server/pcn-files';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Gắn file phát hành PCN chỉ khả dụng trong profile PCN.');
  }

  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { issuanceId: rawIssuanceId } = await params;
  const issuanceId = String(rawIssuanceId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const assetId = String(bodyJson?.assetId || '').trim();
  const fileName = String(bodyJson?.fileName || '').trim();
  const idempotencyKey = String(bodyJson?.idempotencyKey || '').trim();

  if (!isSafePcnSampleKey(issuanceId) || !PCN_FILE_ASSET_ID_PATTERN.test(assetId) || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Mã bộ phát hành, file asset hoặc idempotencyKey không hợp lệ.');
  }
  if (fileName.length > 255 || /[\\/]/.test(fileName)) {
    return jsonBadRequest('Tên file phát hành không hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-issuance-file:${issuanceId}:${assetId}`]);
      const issuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuanceId],
      );
      if (!issuanceResult.rows[0]) throw Object.assign(new Error('Không tìm thấy bộ phát hành cần đính kèm file.'), { statusCode: 404 });
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuance.dossierId],
      );
      if (!dossierResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ của bộ phát hành.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const assetResult = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [assetId],
      );
      const asset = assetResult.rows[0];
      if (!asset) throw Object.assign(new Error('Không tìm thấy file asset phát hành.'), { statusCode: 404 });
      if (
        String(asset.source_collection) !== 'issuancePackages' ||
        String(asset.source_document_id) !== issuanceId ||
        String(asset.source_json_path) !== 'fileAssetIds'
      ) {
        throw Object.assign(new Error('File asset không trỏ đúng tới bộ phát hành cần đính kèm.'), { statusCode: 409 });
      }

      if ((issuance.fileAssetIds || []).includes(assetId)) {
        return { issuance, dossier, idempotent: true as const };
      }

      const now = new Date().toISOString();
      const nextIssuance: IssuancePackage = {
        ...issuance,
        fileAssetIds: Array.from(new Set([...(issuance.fileAssetIds || []), assetId])),
        updatedAt: now,
      };
      const nextDossier: CertificationDossier = { ...dossier, updatedAt: now };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'issuancePackages' AND document_id = $1`,
        [nextIssuance.id, JSON.stringify(getDocumentPayload(nextIssuance))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-issuance-file', `${issuanceId}:${assetId}`),
        action: 'UPDATED',
        entityType: 'PCN_ISSUANCE',
        entityId: issuanceId,
        entityLabel: issuance.issuanceNumber || issuance.dossierId,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: `Gắn file ${fileName || assetId} vào bộ phát hành`,
        source: 'UI',
        groupId: dossier.id,
        changes: diffActivityFields(issuance, nextIssuance, ['fileAssetIds']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload({ ...activityLog, idempotencyKey }))],
      );

      return { issuance: nextIssuance, dossier: nextDossier, activityLog, idempotent: false as const };
    });

    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN issuance file pointer error:', error);
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || 500);
  }
}
