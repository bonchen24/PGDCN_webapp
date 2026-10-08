import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  IssuancePackage,
} from '@/types';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { isPcnDossierTransitionAllowed } from '@/utils/pcnWorkflow';
import { archivePcnIssuancePackage } from '@/utils/pcnIssuance';
import { buildPcnRetentionMetadata } from '@/utils/pcnRetention';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Lưu trữ bộ phát hành PCN chỉ khả dụng trong profile PCN.');
  }
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { issuanceId: rawIssuanceId } = await params;
  const issuanceId = decodeURIComponent(String(rawIssuanceId || '')).trim();

  const body = await req.json().catch(() => ({}));
  const idempotencyKey = String(body?.idempotencyKey || '').trim();

  if (!isSafePcnSampleKey(issuanceId) || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Mã bộ phát hành và idempotencyKey lưu trữ không hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;
  try {
    const result = await withPgTransaction(async (client) => {
      const issuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'issuancePackages' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [issuanceId],
      );
      if (issuanceResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy bộ phát hành.'), { statusCode: 404 });
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [issuance.dossierId],
      );
      if (dossierResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy hồ sơ của bộ phát hành.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      if (!isPcnDossierTransitionAllowed(dossier.status, 'ARCHIVED')) {
        throw Object.assign(new Error('Hồ sơ chưa ở trạng thái được lưu trữ.'), { statusCode: 409 });
      }

      const fingerprint = createHash('sha256').update(JSON.stringify({ issuanceId })).digest('hex');
      const activityId = stablePcnMutationId('activity-pcn-issuance-archive', `${issuanceId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'activityLogs' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [activityId],
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== fingerprint) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho lần lưu trữ khác.'), { statusCode: 409 });
        }
        return { issuance, dossier, activityLog: existingActivity, idempotent: true };
      }

      const archivedAt = new Date().toISOString();
      const nextIssuance = archivePcnIssuancePackage(issuance, archivedAt);
      const nextDossier: CertificationDossier = {
        ...dossier,
        status: 'ARCHIVED',
        retention: dossier.retention || buildPcnRetentionMetadata(archivedAt),
        updatedAt: archivedAt,
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'issuancePackages' AND document_id = $1`,
        [nextIssuance.id, JSON.stringify(getDocumentPayload(nextIssuance))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const activity = {
        ...buildActivityLog({
          id: activityId,
          action: 'STATUS_CHANGED',
          entityType: 'PCN_ISSUANCE',
          entityId: nextIssuance.id,
          entityLabel: nextIssuance.issuanceNumber || nextIssuance.dossierId,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: 'Lưu trữ hồ sơ phát hành PCN',
          source: 'UI',
          changes: diffActivityFields(issuance, nextIssuance),
        }),
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
      };
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))],
      );

      return { issuance: nextIssuance, dossier: nextDossier, activityLog: activity, idempotent: false };
    });

    return jsonOk(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = Number(error?.statusCode) || (message.includes('Không tìm thấy') ? 404 : 400);
    if (status === 404) return jsonNotFound(message);
    if (status === 403) return jsonForbidden(message);
    if (status === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
