import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdApprovalStep,
  PgdInspectionCertificate,
  PgdInspectionRequest,
  getPgdApprovalDenial,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  buildPgdDossierPackageSnapshot,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import { getPgdAssignmentApprovalDenial, getPgdV2ReturnTarget } from '@/utils/pgdWorkflow';
import { hasPgdDossierCapability, type PgdDossierCapability } from '@/utils/pgdDossierCapabilities';
import { createPgdAssessmentRound } from '@/utils/pgdAssessmentRounds';

export const dynamic = 'force-dynamic';

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.approvals, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const step = (await req.json().catch(() => ({}))) as PgdApprovalStep;
  if (!step?.id || step.domain !== 'pgd' || !step.requestId || !step.role) {
    return jsonBadRequest('Bước phê duyệt PGD thiếu thông tin.');
  }
  if (!['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL'].includes(step.role)) {
    return jsonBadRequest('Vai trò phê duyệt PGD không hợp lệ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, step.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để phê duyệt.'), { statusCode: 404 });
      const current = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      const workflowSchemaV2 = current.workflowSchemaVersion === 2 || current.workflowSnapshot?.workflowSchemaVersion === 2;
      const assignmentResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.assignments, step.requestId],
      );
      const assignment = assignmentResult.rows[0] ? mapDocumentRow(assignmentResult.rows[0]) as import('@/utils/pgdDomain').PgdInspectionAssignment : undefined;
      const existingActionResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'requestId' = $3 LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.approvals, step.id, step.requestId],
      );
      if (existingActionResult.rows[0]) {
        const existingAction = mapDocumentRow(existingActionResult.rows[0]) as PgdApprovalStep;
        if (existingAction.role !== step.role || existingAction.status !== step.status || (existingAction.comment || '') !== (step.comment || step.returnReason || '')) {
          throw Object.assign(new Error('ID thao tác phê duyệt đã được dùng cho một nội dung khác.'), { statusCode: 409 });
        }
        return { approval: existingAction, request: current, idempotent: true as const };
      }
      assertPgdRequestEvidenceMutationAllowed(current);
      assertPgdRequestStationMutationAllowed(current, 'REPORT_APPROVAL_RETURN');

      const approvalDenial = getPgdApprovalDenial(current.status, step.role, actor);
      const requiredCapability: PgdDossierCapability = step.role === 'TECHNICAL_REVIEW' ? 'TECHNICAL_REVIEW' : 'LEADERSHIP_APPROVAL';
      const assignedCapability = hasPgdDossierCapability(assignment, actor.username, requiredCapability);
      const managerDenial = getPgdAssignmentApprovalDenial('APPROVED', actor);
      if (approvalDenial && !assignedCapability) throw Object.assign(new Error(approvalDenial), { statusCode: 403 });
      if (workflowSchemaV2 && managerDenial && !assignedCapability) {
        throw Object.assign(new Error('Tài khoản chưa được phân công capability phê duyệt cho hồ sơ này.'), { statusCode: 403 });
      }

      const now = new Date().toISOString();
      if (step.status === 'RETURNED') {
        if (!workflowSchemaV2) throw Object.assign(new Error('Trả về B4 chỉ khả dụng cho hồ sơ workflow v2.'), { statusCode: 409 });
        const returnReason = String(step.returnReason || step.comment || '').trim();
        if (!returnReason) throw Object.assign(new Error('Cần ghi lý do trả hồ sơ về B4.'), { statusCode: 400 });
        const target = getPgdV2ReturnTarget(step.role);
        const roundResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY (data->>'sequence')::int, document_id FOR UPDATE`, [PGD_COLLECTIONS.assessmentRounds, current.id]);
        const existingRounds = roundResult.rows.map((row: any) => mapDocumentRow(row) as import('@/utils/pgdDomain').PgdAssessmentRound);
        const reopenedWorkRound = createPgdAssessmentRound({ id: `pgd-round-${randomUUID()}`, requestId: current.id, openedByUsername: actor.username, existingRounds, reason: `Trả về B4 bởi ${step.role}: ${returnReason}` }, now);
        await client.query(`INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`, [PGD_COLLECTIONS.assessmentRounds, reopenedWorkRound.id, JSON.stringify(getDocumentPayload(reopenedWorkRound))]);
        const returnedStep: PgdApprovalStep = {
          ...step,
          status: 'RETURNED',
          actedByUsername: actor.username,
          actedAt: now,
          comment: returnReason,
          returnReason,
          returnedAt: now,
          returnToStageId: target.stageId,
        };
        const nextRequest: PgdInspectionRequest = {
          ...current,
          status: target.status,
          updatedAt: now,
          assessmentRoundIds: Array.from(new Set([...(current.assessmentRoundIds || []), reopenedWorkRound.id])),
          currentAssessmentRoundId: reopenedWorkRound.id,
        };
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [PGD_COLLECTIONS.approvals, returnedStep.id, JSON.stringify(getDocumentPayload(returnedStep))],
        );
        if (step.role === 'LEADERSHIP_APPROVAL') {
          const priorTechnical = await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'requestId' = $2 AND data->>'role' = 'TECHNICAL_REVIEW' AND data->>'status' = 'APPROVED' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [PGD_COLLECTIONS.approvals, step.requestId],
          );
          if (priorTechnical.rows[0]) {
            const prior = mapDocumentRow(priorTechnical.rows[0]) as PgdApprovalStep;
            await client.query(
              `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
              [PGD_COLLECTIONS.approvals, JSON.stringify(getDocumentPayload({ ...prior, status: 'RETURNED', returnReason, returnedAt: now, returnToStageId: target.stageId })), prior.id],
            );
          }
        }
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
          [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), step.requestId],
        );
        await writePgdActivity(client, actor, {
          action: 'UPDATED',
          entityId: returnedStep.id,
          entityLabel: step.role === 'TECHNICAL_REVIEW' ? 'Thẩm xét PGD' : 'Phê duyệt lãnh đạo PGD',
          requestCode: current.requestCode,
          summary: `Trả hồ sơ ${current.requestCode} về B4: ${returnReason}`,
          idSuffix: `approval-return-${returnedStep.id}`,
          notify: buildPgdNotificationDraft({
            entityType: 'PGD_APPROVAL',
            action: 'STATUS_CHANGED',
            entityId: returnedStep.id,
            entityLabel: current.requestCode,
            requestCode: current.requestCode,
            previousStatus: current.status,
            nextStatus: target.status,
            actorName: actor.name || actor.username,
          }),
        });
        return { approval: returnedStep, request: nextRequest };
      }

      if (step.role === 'LEADERSHIP_APPROVAL') {
        const technicalApproval = await client.query(
          `SELECT document_id FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'requestId' = $2 AND data->>'role' = 'TECHNICAL_REVIEW' AND data->>'status' = 'APPROVED' LIMIT 1`,
          [PGD_COLLECTIONS.approvals, step.requestId],
        );
        if (!technicalApproval.rows[0]) {
          throw Object.assign(new Error('Hồ sơ PGD phải được phê duyệt chuyên môn trước khi trình lãnh đạo.'), { statusCode: 409 });
        }
      }

      const packageSnapshot = await buildPgdDossierPackageSnapshot(client, current);
      if (!packageSnapshot.manifest.complete) {
        throw Object.assign(
          new Error(
            `Bộ hồ sơ PGD chưa hoàn chỉnh: thiếu ${packageSnapshot.manifest.missingRequirementCodes.length} mục checklist hoặc ${packageSnapshot.manifest.missingAssetIds.length} file private.`,
          ),
          { statusCode: 409 },
        );
      }

      const packageManifestHash = createHash('sha256').update(stableJson(packageSnapshot.manifest)).digest('hex');
      const approvedStep = {
        ...step,
        sequence: step.role === 'TECHNICAL_REVIEW' ? 1 : 2,
        status: 'APPROVED' as const,
        actedByUsername: actor.username,
        actedAt: now,
        packageManifestHash,
        packageManifestSnapshot: packageSnapshot.manifest,
      };

      let nextStatus = current.status;
      if (step.role === 'TECHNICAL_REVIEW' && workflowSchemaV2) nextStatus = 'LEADERSHIP_APPROVAL';
      if (step.role === 'LEADERSHIP_APPROVAL') nextStatus = workflowSchemaV2 ? 'APPROVED_FOR_ISSUANCE' : 'SIGNED';
      const nextRequest = { ...current, status: nextStatus, updatedAt: now };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.approvals, approvedStep.id, JSON.stringify(getDocumentPayload(approvedStep))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), step.requestId],
      );

      let certificate: PgdInspectionCertificate | undefined;
      if (step.role === 'LEADERSHIP_APPROVAL') {
        const reportResult = await client.query(
          `SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
          [PGD_COLLECTIONS.reports, step.requestId],
        );
        if (!reportResult.rows[0]?.data?.templateSnapshot || !String(reportResult.rows[0]?.data?.conclusion || '').trim()) {
          throw Object.assign(new Error('Báo cáo PGD chưa đủ snapshot/kết luận để trình lãnh đạo phê duyệt.'), { statusCode: 409 });
        }
        const certificateResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
          [PGD_COLLECTIONS.certificates, step.requestId],
        );
        if (!certificateResult.rows[0]) {
          throw Object.assign(new Error('Chưa có dự thảo chứng thư PGD để lãnh đạo ký.'), { statusCode: 409 });
        }
        const currentCertificate = mapDocumentRow(certificateResult.rows[0]) as PgdInspectionCertificate;
        if (currentCertificate.status !== 'DRAFT' || !currentCertificate.templateSnapshot) {
          throw Object.assign(new Error('Chứng thư PGD chưa ở trạng thái dự thảo hợp lệ để trình ký.'), { statusCode: 409 });
        }
        certificate = workflowSchemaV2
          ? { ...currentCertificate, status: 'APPROVED', approvedByUsername: actor.username, approvedAt: now, updatedAt: now }
          : { ...currentCertificate, status: 'SIGNED', signedByUsername: actor.username, signedAt: now, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
          [PGD_COLLECTIONS.certificates, JSON.stringify(getDocumentPayload(certificate)), certificate.id],
        );
      }

      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: approvedStep.id,
        entityLabel: step.role === 'TECHNICAL_REVIEW' ? 'Phê duyệt chuyên môn PGD' : 'Phê duyệt lãnh đạo PGD',
        requestCode: current.requestCode,
        summary: `${step.role === 'TECHNICAL_REVIEW' ? 'Phê duyệt chuyên môn' : 'Phê duyệt lãnh đạo'} hồ sơ ${current.requestCode}`,
        idSuffix: `approval-${step.role}-${step.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_APPROVAL',
          action: 'STATUS_CHANGED',
          entityId: approvedStep.id,
          entityLabel: current.requestCode,
          requestCode: current.requestCode,
          previousStatus: current.status,
          nextStatus,
          actorName: actor.name || actor.username,
        }),
      });

      return { approval: approvedStep, request: nextRequest, ...(certificate ? { certificate } : {}) };
    });

    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
