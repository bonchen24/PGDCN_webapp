import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonCreated,
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
  ReturnedTestResult,
} from '@/types';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  assertPcnDossierOperator,
  assertPcnTechnicalReviewSubmissionReady,
} from '@/lib/server/pcn-dossiers';
import { getPcnDossierStageGateDenial } from '@/utils/pcnDossierStageGate';
import { getPcnWorkflowResultOutcome } from '@/utils/pcnWorkflowRuntime';
import { getPcnDocumentRequirements } from '@/utils/pcnDossierDocuments';
import { buildPcnIssuancePackage } from '@/utils/pcnIssuance';
import {
  buildPcnApprovalSteps,
  getPcnEffectiveApprovalSteps,
} from '@/utils/pcnApproval';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Tạo bộ phát hành PCN chỉ khả dụng trong profile PCN.');
  }
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const body = await req.json().catch(() => ({}));
  const dossierId = String(body?.dossierId || '').trim();
  const idempotencyKey = String(body?.idempotencyKey || '').trim();
  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Mã hồ sơ và idempotencyKey tạo bộ phát hành không hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;
  try {
    const result = await withPgTransaction(async (client) => {
      const issuanceId = `issuance-${dossierId}`;
      const idempotencyFingerprint = createHash('sha256').update(JSON.stringify({ dossierId })).digest('hex');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-issuance-create:${dossierId}`]);

      const existingIssuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuanceId],
      );
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId],
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ để lập bộ phát hành.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      assertPcnDossierOperator(dossier, actor);

      if (existingIssuanceResult.rows.length > 0) {
        const issuance = mapDocumentRow(existingIssuanceResult.rows[0]) as IssuancePackage;
        if (issuance.dossierId !== dossier.id) {
          throw Object.assign(new Error('Bộ phát hành không thuộc hồ sơ đang yêu cầu.'), { statusCode: 409 });
        }
        if (issuance.status === 'RETURNED' && dossier.status === 'TECHNICAL_REVIEW') {
          await assertPcnTechnicalReviewSubmissionReady(client, dossier);
          const resubmitActivityId = stablePcnMutationId('activity-pcn-issuance-resubmit', `${issuanceId}:${idempotencyKey}`);
          const resubmitFingerprint = createHash('sha256').update(JSON.stringify({ dossierId, issuanceId })).digest('hex');
          const existingResubmitActivityResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'activityLogs' AND document_id = $1
             LIMIT 1 FOR UPDATE`,
            [resubmitActivityId],
          );
          if (existingResubmitActivityResult.rows[0]) {
            const existingActivity = mapDocumentRow(existingResubmitActivityResult.rows[0]) as Record<string, any>;
            if (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== resubmitFingerprint) {
              throw Object.assign(new Error('idempotencyKey đã được dùng cho lần trình lại khác.'), { statusCode: 409 });
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
          let allSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
          if (getPcnEffectiveApprovalSteps(allSteps).length === 0) {
            const leadershipStep = buildPcnApprovalSteps(dossier.id, new Date().toISOString())[0];
            await client.query(
              `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
               VALUES ('approvalSteps', $1, $2::jsonb, CURRENT_TIMESTAMP)
               ON CONFLICT (collection_name, document_id) DO NOTHING`,
              [leadershipStep.id, JSON.stringify(getDocumentPayload(leadershipStep))],
            );
            allSteps = [...allSteps, leadershipStep];
          }
          const effectiveIds = new Set(getPcnEffectiveApprovalSteps(allSteps).map((step) => step.id));
          const nextSteps = allSteps.map((step) =>
            effectiveIds.has(step.id) ? { ...step, status: 'PENDING' as const, actedAt: undefined } : step,
          );
          const now = new Date().toISOString();
          const nextIssuance: IssuancePackage = { ...issuance, status: 'PENDING_APPROVAL', updatedAt: now };
          const nextDossier: CertificationDossier = { ...dossier, status: 'WAITING_APPROVAL', updatedAt: now };

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
              id: resubmitActivityId,
              action: 'STATUS_CHANGED',
              entityType: 'PCN_ISSUANCE',
              entityId: nextIssuance.id,
              entityLabel: nextDossier.dossierCode,
              actorUsername: actor.username,
              actorName: actor.name,
              actorRole: actor.systemRole || actor.role,
              summary: 'Trình lại hồ sơ vào bước 5 sau khi hoàn thiện bước 4',
              source: 'UI',
              createdAt: now,
            }),
            idempotencyKey,
            idempotencyFingerprint: resubmitFingerprint,
          };
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
            [activity.id, JSON.stringify(getDocumentPayload(activity))],
          );
          return { issuance: nextIssuance, dossier: nextDossier, approvalSteps: nextSteps, activityLog: activity, idempotent: false };
        }

        const existingActivityResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'activityLogs' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [stablePcnMutationId('activity-pcn-issuance-create', issuanceId)],
        );
        if (existingActivityResult.rows.length === 0) {
          throw Object.assign(
            new Error('Bộ phát hành đã tồn tại nhưng thiếu nhật ký idempotency; cần rà soát toàn vẹn trước khi tiếp tục.'),
            { statusCode: 409 },
          );
        }
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (
          String(existingActivity.idempotencyKey || '').trim() !== idempotencyKey ||
          (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== idempotencyFingerprint)
        ) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho lần tạo bộ phát hành khác.'), { statusCode: 409 });
        }
        const approvalResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
           ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
           FOR UPDATE`,
          [dossier.id],
        );
        let approvalSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
        if (getPcnEffectiveApprovalSteps(approvalSteps).length === 0) {
          const leadershipStep = buildPcnApprovalSteps(dossier.id, new Date().toISOString())[0];
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('approvalSteps', $1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (collection_name, document_id) DO NOTHING`,
            [leadershipStep.id, JSON.stringify(getDocumentPayload(leadershipStep))],
          );
          approvalSteps = [...approvalSteps, leadershipStep];
        }
        return {
          issuance,
          dossier,
          approvalSteps,
          activityLog: existingActivity,
          idempotent: true,
        };
      }

      if (!['TECHNICAL_REVIEW', 'WAITING_APPROVAL', 'APPROVED'].includes(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ chưa sẵn sàng để lập bộ phát hành.'), { statusCode: 409 });
      }

      if (dossier.status === 'TECHNICAL_REVIEW') {
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
        const returnedResultResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1`,
          [dossier.id],
        );
        const hasConfirmedReturnedScan = returnedResultResult.rows.some((row: any) => {
          const result = mapDocumentRow(row) as ReturnedTestResult;
          return Boolean(result.fileAssetId && result.outcome !== 'PENDING' && result.isOfficial !== false);
        });
        const resolvedRequirementIds = hasConfirmedReturnedScan
          ? getPcnDocumentRequirements(dossier.fieldCodes, configuredRequirements.length > 0 ? configuredRequirements : undefined)
              .filter((requirement) => requirement.code === 'TEST_REPORT')
              .map((requirement) => requirement.id)
          : [];
        const stageGateDenial = getPcnDossierStageGateDenial({
          dossier,
          nextStatus: 'WAITING_APPROVAL',
          requirements: configuredRequirements.length > 0 ? configuredRequirements : undefined,
          documents: documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument),
          documentWaivers: dossier.documentWaivers,
          resultOutcome: getPcnWorkflowResultOutcome(returnedResultResult.rows.map((row: any) => mapDocumentRow(row) as ReturnedTestResult)),
          resolvedRequirementIds,
        });
        if (stageGateDenial) throw Object.assign(new Error(stageGateDenial), { statusCode: 409 });

        const finalRequirements = getPcnDocumentRequirements(
          dossier.fieldCodes,
          configuredRequirements.length > 0 ? configuredRequirements : undefined,
        ).filter((requirement) => requirement.required && ['CERTIFICATE', 'DECISION'].includes(requirement.code));
        const currentDocuments = documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument);
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
            new Error(`Phải có bản dự thảo ${missingDraft.code === 'CERTIFICATE' ? 'GCN' : 'QĐ'} trước khi trình bước 5.`),
            { statusCode: 409 },
          );
        }
      }

      const now = new Date().toISOString();
      const issuance = buildPcnIssuancePackage({ id: issuanceId, dossier, now });
      const approvalSteps = buildPcnApprovalSteps(dossier.id, now);
      const nextIssuance: IssuancePackage = {
        ...issuance,
        status: 'PENDING_APPROVAL',
        approvalStepIds: approvalSteps.map((step) => step.id),
        updatedAt: now,
      };
      const nextDossier: CertificationDossier = {
        ...dossier,
        ...(dossier.status === 'TECHNICAL_REVIEW' ? { status: 'WAITING_APPROVAL' as const } : {}),
        issuancePackageId: issuance.id,
        updatedAt: now,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('issuancePackages', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [nextIssuance.id, JSON.stringify(getDocumentPayload(nextIssuance))],
      );
      for (const step of approvalSteps) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('approvalSteps', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [step.id, JSON.stringify(getDocumentPayload(step))],
        );
      }
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );
      const activity = {
        ...buildActivityLog({
          id: stablePcnMutationId('activity-pcn-issuance-create', issuanceId),
          action: 'CREATED',
          entityType: 'PCN_ISSUANCE',
          entityId: nextIssuance.id,
          entityLabel: nextDossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: 'Tạo bộ phát hành và chuỗi phê duyệt PCN',
          source: 'UI',
          createdAt: now,
        }),
        idempotencyKey,
        idempotencyFingerprint,
      };
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))],
      );

      return { issuance: nextIssuance, dossier: nextDossier, approvalSteps, activityLog: activity, idempotent: false };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = Number(error?.statusCode) || (message.includes('Không tìm thấy') ? 404 : 400);
    if (status === 404) return jsonNotFound(message);
    if (status === 403) return jsonForbidden(message);
    if (status === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
