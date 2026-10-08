import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonServerError,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  IssuancePackage,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnUserAccount,
} from '@/types';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { getPcnDocumentRequirements } from '@/utils/pcnDossierDocuments';
import {
  applyPcnApprovalDecision,
  getPcnApprovalDecisionDenial,
  getPcnEffectiveApprovalSteps,
  isPcnApprovalComplete,
} from '@/utils/pcnApproval';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string; stepId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Phê duyệt bộ phát hành PCN chỉ khả dụng trong profile PCN.');
  }
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { issuanceId: rawIssuanceId, stepId: rawStepId } = await params;
  const issuanceId = decodeURIComponent(String(rawIssuanceId || '')).trim();
  const stepId = decodeURIComponent(String(rawStepId || '')).trim();

  const body = await req.json().catch(() => ({}));
  const decision = String(body?.decision || '').trim().toUpperCase() as 'APPROVE' | 'RETURN';
  const comment = body?.comment === undefined ? undefined : String(body.comment || '').trim();
  const idempotencyKey = String(body?.idempotencyKey || '').trim();

  if (
    !isSafePcnSampleKey(issuanceId) ||
    !isSafePcnSampleKey(stepId) ||
    !isSafePcnSampleKey(idempotencyKey) ||
    !['APPROVE', 'RETURN'].includes(decision)
  ) {
    return jsonBadRequest('Thông tin quyết định phê duyệt PCN không hợp lệ.');
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

      const approvalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
         ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
         FOR UPDATE`,
        [dossier.id],
      );
      const allSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
      const steps = getPcnEffectiveApprovalSteps(allSteps);
      const currentStep = steps.find((step) => step.id === stepId);
      if (!currentStep) throw Object.assign(new Error('Không tìm thấy bước phê duyệt.'), { statusCode: 404 });

      const approvalUserResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'systemUsers'`,
      );
      const approvalActor = approvalUserResult.rows
        .map((row: any) => toPcnUserAccount({ documentId: row.document_id, data: row.data || {} }))
        .find((user: PcnUserAccount) => user.username.trim().toLowerCase() === actor.username.trim().toLowerCase());

      const approvalDenial = getPcnApprovalDecisionDenial(
        currentStep,
        approvalActor,
        Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes : [],
      );
      if (approvalDenial) throw Object.assign(new Error(approvalDenial), { statusCode: 403 });

      if (issuance.status !== 'PENDING_APPROVAL' || dossier.status !== 'WAITING_APPROVAL') {
        throw Object.assign(new Error('Bộ phát hành chưa được trình lại đầy đủ vào bước 5.'), { statusCode: 409 });
      }

      if (decision === 'APPROVE') {
        const requirementResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnDocumentRequirements'`,
        );
        const configuredRequirements = requirementResult.rows.map((row: any) => mapDocumentRow(row) as PcnDocumentRequirement);
        const documentResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
          [dossier.id],
        );
        const currentDocuments = documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument);
        const finalRequirements = getPcnDocumentRequirements(
          dossier.fieldCodes,
          configuredRequirements.length > 0 ? configuredRequirements : undefined,
        ).filter((requirement) => requirement.required && ['CERTIFICATE', 'DECISION'].includes(requirement.code));
        const missingDraft = finalRequirements.find((requirement) => {
          const document = currentDocuments.find((item) => item.requirementId === requirement.id);
          return !(
            document?.status === 'PRESENT' &&
            document.currentVersionId &&
            document.versions.some((version) => version.assetId === document.currentVersionId)
          );
        });
        if (missingDraft) {
          throw Object.assign(
            new Error(`Phải có bản dự thảo ${missingDraft.code === 'CERTIFICATE' ? 'GCN' : 'QĐ'} trước khi phê duyệt bước 5.`),
            { statusCode: 409 },
          );
        }
      }

      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ issuanceId, stepId, decision, comment: comment || '' }))
        .digest('hex');
      const activityId = stablePcnMutationId('activity-pcn-approval', `${issuanceId}:${stepId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId],
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== fingerprint) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho quyết định phê duyệt khác.'), { statusCode: 409 });
        }
        return { issuance, dossier, approvalSteps: allSteps, activityLog: existingActivity, idempotent: true };
      }

      let decidedSteps: PcnApprovalStep[];
      try {
        decidedSteps = applyPcnApprovalDecision(allSteps, stepId, decision, comment);
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
      }

      const effectiveStepIds = new Set(steps.map((step) => step.id));
      const nextSteps =
        decision === 'RETURN'
          ? decidedSteps.map((step) =>
              effectiveStepIds.has(step.id) ? { ...step, status: 'PENDING' as const, actedAt: undefined } : step,
            )
          : decidedSteps;
      const complete = isPcnApprovalComplete(nextSteps);
      const now = new Date().toISOString();
      const nextIssuance: IssuancePackage = {
        ...issuance,
        status: decision === 'RETURN' ? 'RETURNED' : complete ? 'APPROVED' : 'PENDING_APPROVAL',
        updatedAt: now,
      };
      const nextDossier: CertificationDossier =
        decision === 'RETURN'
          ? { ...dossier, status: 'TECHNICAL_REVIEW', updatedAt: now }
          : complete
            ? { ...dossier, status: 'APPROVED', updatedAt: now }
            : dossier;

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
      if (nextDossier !== dossier) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
        );
      }
      const changedStep = nextSteps.find((step) => step.id === stepId)!;
      const activity = {
        ...buildActivityLog({
          id: activityId,
          action: decision === 'RETURN' ? 'STATUS_CHANGED' : 'UPDATED',
          entityType: 'PCN_APPROVAL',
          entityId: changedStep.id,
          entityLabel: changedStep.role,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: decision === 'RETURN' ? 'Trả bộ hồ sơ về bước kỹ thuật' : 'Hoàn tất một bước phê duyệt bộ phát hành',
          source: 'UI',
          changes: diffActivityFields(currentStep, changedStep, ['status', 'comment', 'actedAt']),
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
