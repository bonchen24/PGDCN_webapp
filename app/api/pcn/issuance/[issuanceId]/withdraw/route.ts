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
  PcnApprovalStep,
} from '@/types';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { isOrganizationLeader } from '@/utils/pcnRbac';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { withdrawPcnIssuancePackage } from '@/utils/pcnIssuance';
import { getPcnEffectiveApprovalSteps } from '@/utils/pcnApproval';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Thu hồi bộ phát hành PCN chỉ khả dụng trong profile PCN.');
  }
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { issuanceId: rawIssuanceId } = await params;
  const issuanceId = decodeURIComponent(String(rawIssuanceId || '')).trim();

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim();
  const idempotencyKey = String(body?.idempotencyKey || '').trim();

  if (!isSafePcnSampleKey(issuanceId) || !isSafePcnSampleKey(idempotencyKey) || !reason || reason.length > 1000) {
    return jsonBadRequest('Thu hồi phải có lý do tối đa 1000 ký tự và idempotencyKey hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;
  try {
    const result = await withPgTransaction(async (client) => {
      const issuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuanceId],
      );
      if (issuanceResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy bộ phát hành.'), { statusCode: 404 });
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuance.dossierId],
      );
      if (dossierResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy hồ sơ của bộ phát hành.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const actorUsername = actor.username.trim().toLowerCase();
      const signerUsername = String(issuance.signerUsername || '').trim().toLowerCase();
      const isLeadership = isOrganizationLeader(actor);
      if (!isLeadership && (!signerUsername || signerUsername !== actorUsername)) {
        throw Object.assign(new Error('Chỉ Lãnh đạo hoặc người ký được phân quyền mới được thu hồi hồ sơ.'), { statusCode: 403 });
      }

      if (!isPcnDossierPostApprovalLocked(dossier.status) || !['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status)) {
        throw Object.assign(new Error('Chỉ được thu hồi hồ sơ đã phê duyệt hoặc phát hành.'), { statusCode: 409 });
      }

      const fingerprint = createHash('sha256').update(JSON.stringify({ issuanceId, reason })).digest('hex');
      const activityId = stablePcnMutationId('activity-pcn-issuance-withdraw', `${issuanceId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId],
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== fingerprint) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho lần thu hồi khác.'), { statusCode: 409 });
        }
        const approvalResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
           ORDER BY COALESCE((data->>'sequence')::int, 999), document_id`,
          [dossier.id],
        );
        return {
          issuance,
          dossier,
          approvalSteps: approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[],
          activityLog: existingActivity,
          idempotent: true,
        };
      }

      const approvalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
         ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
         FOR UPDATE`,
        [dossier.id],
      );
      const allSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
      const effectiveStepIds = new Set(getPcnEffectiveApprovalSteps(allSteps).map((step) => step.id));
      const nextSteps = allSteps.map((step) =>
        effectiveStepIds.has(step.id) ? { ...step, status: 'PENDING' as const, actedAt: undefined } : step,
      );
      const withdrawnAt = new Date().toISOString();
      const nextIssuance = withdrawPcnIssuancePackage(issuance, { reason, withdrawnByUsername: actor.username, withdrawnAt });
      const nextDossier: CertificationDossier = { ...dossier, status: 'TECHNICAL_REVIEW', updatedAt: withdrawnAt };

      for (const step of nextSteps) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'approvalSteps' AND document_id = $1`,
          [step.id, JSON.stringify(getDocumentPayload(step))],
        );
      }
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
          summary: 'Thu hồi bộ phát hành và mở lại bước 4 để rà soát',
          source: 'UI',
          changes: diffActivityFields(issuance, nextIssuance),
          createdAt: withdrawnAt,
        }),
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
      };
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))],
      );

      return { issuance: nextIssuance, dossier: nextDossier, approvalSteps: nextSteps, activityLog: activity, idempotent: false };
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
