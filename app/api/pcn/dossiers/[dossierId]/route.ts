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
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnUserAccount,
  IssuancePackage,
} from '@/types';
import type { PcnDossierUpdateInput } from '@/utils/pcnDossierApi';
import {
  isPcnSystemManager,
  isOrganizationLeader,
  getPcnDossierDeletionDenial,
} from '@/utils/pcnRbac';
import { getPcnDossierStageGateDenial } from '@/utils/pcnDossierStageGate';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  assertPcnDossierOperator,
  hardDeleteOwnedDocumentGraph,
} from '@/lib/server/pcn-dossiers';
import { deleteOwnedFileAssets, type OwnedFileAsset } from '@/lib/server/storage';
import { getPcnDossierDateDenial } from '@/utils/pcnDossierDate';
import { getPcnOperationalFormKind, normalizePcnOperationalFormsPatch } from '@/utils/pcnOperationalForms';
import { mergePcnDocumentWaivers, normalizePcnDocumentWaiverPatch } from '@/utils/pcnDocumentWaivers';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnOperationalForm } from '@/utils/pcnWorkflowStages';
import { getPcnDocumentRequirements } from '@/utils/pcnDossierDocuments';
import {
  getPcnDossierExceptionReasonDenial,
  getPcnDossierMethodChangeDenial,
  getPcnDossierStatusMutationDenial,
  isPcnDossierTransitionAllowed,
} from '@/utils/pcnWorkflow';
import {
  getPcnDossierAssignmentDenial,
  getPcnOwnerAssignmentAuthorityDenial,
} from '@/utils/pcnDossierAssignment';
import { getPcnEffectiveApprovalSteps } from '@/utils/pcnApproval';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Cập nhật hồ sơ PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const rawUpdates = body.updates;

  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Mã hồ sơ và idempotencyKey phải hợp lệ.');
  }

  if (!rawUpdates || typeof rawUpdates !== 'object' || Array.isArray(rawUpdates)) {
    return jsonBadRequest('Thiếu dữ liệu cập nhật hồ sơ.');
  }

  const allowedFields = new Set([
    'status',
    'method',
    'ownerUsername',
    'evaluatorUsername',
    'reviewerUsername',
    'targetDate',
    'evaluationAt',
    'effectiveAt',
    'exceptionReason',
    'operationalForms',
    'documentWaivers',
  ]);
  const unknownFields = Object.keys(rawUpdates).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return jsonBadRequest(`Trường cập nhật hồ sơ không được phép: ${unknownFields.join(', ')}.`);
  }

  const updates: PcnDossierUpdateInput = {};
  const validStatuses = new Set([
    'DRAFT',
    'INTAKE_REVIEW',
    'AWAITING_DOCUMENTS',
    'ASSIGNED',
    'PLAN_PENDING_APPROVAL',
    'FIELD_EVALUATION',
    'AWAITING_SAMPLING',
    'SENT_TO_LAB',
    'AWAITING_RESULTS',
    'CORRECTIVE_ACTION',
    'TECHNICAL_REVIEW',
    'WAITING_APPROVAL',
    'APPROVED',
    'ISSUED',
    'DELIVERED',
    'ARCHIVED',
    'REJECTED',
    'CANCELLED',
    'ON_HOLD',
  ]);

  if (rawUpdates.status !== undefined) {
    const status = String(rawUpdates.status || '').trim().toUpperCase();
    if (!validStatuses.has(status)) {
      return jsonBadRequest('Trạng thái hồ sơ không hợp lệ.');
    }
    updates.status = status as PcnDossierUpdateInput['status'];
  }

  if (rawUpdates.method !== undefined) {
    const method = String(rawUpdates.method || '').trim().toUpperCase();
    if (!['METHOD_1', 'METHOD_5', 'METHOD_7'].includes(method)) {
      return jsonBadRequest('Phương thức chứng nhận không hợp lệ.');
    }
    updates.method = method as PcnDossierUpdateInput['method'];
  }

  const hasExplicitExceptionReason = Object.prototype.hasOwnProperty.call(rawUpdates, 'exceptionReason');
  if (hasExplicitExceptionReason) {
    if (rawUpdates.exceptionReason !== null && typeof rawUpdates.exceptionReason !== 'string') {
      return jsonBadRequest('Lý do ngoại lệ phải là chuỗi hoặc null.');
    }
    const exceptionReason = String(rawUpdates.exceptionReason || '').trim();
    if (exceptionReason.length > 1000) {
      return jsonBadRequest('Lý do ngoại lệ vượt quá độ dài 1000 ký tự.');
    }
    updates.exceptionReason = exceptionReason || undefined;
  }

  for (const field of ['ownerUsername', 'evaluatorUsername', 'reviewerUsername', 'targetDate', 'evaluationAt', 'effectiveAt'] as const) {
    if (rawUpdates[field] === undefined) continue;
    if (rawUpdates[field] !== null && typeof rawUpdates[field] !== 'string') {
      return jsonBadRequest(`Trường ${field} phải là chuỗi hoặc null.`);
    }
    const value = String(rawUpdates[field] || '').trim();
    if (value.length > 200) {
      return jsonBadRequest(`Trường ${field} vượt quá độ dài cho phép.`);
    }
    if (['targetDate', 'evaluationAt', 'effectiveAt'].includes(field) && value) {
      const labels: Record<string, string> = {
        targetDate: 'Hạn xử lý',
        evaluationAt: 'Ngày đánh giá',
        effectiveAt: 'Ngày hiệu lực',
      };
      const dateDenial = getPcnDossierDateDenial(labels[field], value);
      if (dateDenial) {
        return jsonBadRequest(dateDenial);
      }
    }
    updates[field] = (field === 'ownerUsername' || field === 'evaluatorUsername' || field === 'reviewerUsername')
      ? value.toLowerCase() || undefined
      : value || undefined;
  }

  if (rawUpdates.operationalForms !== undefined) {
    const operationalForms = normalizePcnOperationalFormsPatch(rawUpdates.operationalForms);
    if (Object.keys(operationalForms.errors).length > 0) {
      return jsonBadRequest(
        `Dữ liệu form nghiệp vụ chưa hợp lệ: ${Object.values(operationalForms.errors).join(' ')}`
      );
    }
    updates.operationalForms = operationalForms.forms;
  }

  if (rawUpdates.documentWaivers !== undefined) {
    const waivers = normalizePcnDocumentWaiverPatch(rawUpdates.documentWaivers);
    if (Object.keys(waivers.errors).length > 0) {
      return jsonBadRequest(
        `Đánh dấu bỏ qua tài liệu chưa hợp lệ: ${Object.values(waivers.errors).join(' ')}`
      );
    }
    updates.documentWaivers = waivers.values;
  }

  const idempotencyFingerprint = createHash('sha256').update(JSON.stringify({ dossierId, updates })).digest('hex');
  const actor = getPcnSessionUser(req)!;
  const hasOwnerControlledUpdate = ['status', 'method', 'targetDate', 'evaluationAt', 'effectiveAt', 'operationalForms']
    .some((field) => Object.prototype.hasOwnProperty.call(rawUpdates, field));
  const hasWaiverPatch = Object.prototype.hasOwnProperty.call(rawUpdates, 'documentWaivers')
    && Object.keys(updates.documentWaivers || {}).length > 0;

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ cần cập nhật.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      if (isPcnDossierPostApprovalLocked(dossier.status) && (hasOwnerControlledUpdate || hasWaiverPatch)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi chỉnh sửa.'), { statusCode: 409 });
      }

      const assignmentOnlyUpdate = Object.keys(rawUpdates).every((field) => field === 'ownerUsername');
      if (!assignmentOnlyUpdate) assertPcnDossierOperator(dossier, actor);

      if (hasWaiverPatch && !isOrganizationLeader(actor)) {
        throw Object.assign(new Error('Chỉ Lãnh đạo được duyệt waiver tài liệu.'), { statusCode: 403 });
      }

      const activityId = stablePcnMutationId('activity-pcn-dossier-update', `${dossierId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId]
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (existingActivity.idempotencyFingerprint && existingActivity.idempotencyFingerprint !== idempotencyFingerprint) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho một cập nhật hồ sơ khác.'), { statusCode: 409 });
        }
        return {
          dossier,
          activityLog: existingActivity,
          idempotent: true,
        };
      }

      const futureFormKind = Object.keys(updates.operationalForms || {}).find((formKey) => {
        const kind = getPcnOperationalFormKind(formKey);
        return Boolean(kind && !canProcessPcnOperationalForm(dossier, kind));
      });
      if (futureFormKind) {
        throw Object.assign(new Error('Biểu mẫu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      if (updates.method && updates.method !== dossier.method) {
        const issuanceResult = await client.query(
          `SELECT document_id FROM app_documents
           WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1
           LIMIT 1`,
          [dossierId]
        );
        const methodChangeDenial = getPcnDossierMethodChangeDenial(
          dossier,
          updates.method,
          Boolean(dossier.issuancePackageId || issuanceResult.rows.length > 0)
        );
        if (methodChangeDenial) throw Object.assign(new Error(methodChangeDenial), { statusCode: 409 });
      }

      const assignmentFields = [
        { key: 'ownerUsername', label: 'Chủ hồ sơ' },
        { key: 'evaluatorUsername', label: 'Trưởng đoàn đánh giá' },
        { key: 'reviewerUsername', label: 'Người soát xét kỹ thuật' },
      ] as const;

      const changedAssignments = assignmentFields.filter(({ key }) => {
        const nextUsername = String(updates[key] || '').trim().toLowerCase();
        const currentUsername = String(dossier[key] || '').trim().toLowerCase();
        return nextUsername !== currentUsername && (Boolean(nextUsername) || key === 'ownerUsername');
      });

      if (changedAssignments.length > 0) {
        const userResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'systemUsers'`
        );
        const assignmentUsers = userResult.rows.map((row: any) =>
          toPcnUserAccount({ documentId: row.document_id, data: row.data || {} })
        );
        for (const assignment of changedAssignments) {
          if (assignment.key === 'ownerUsername') {
            const authorityDenial = getPcnOwnerAssignmentAuthorityDenial({
              currentUsername: dossier.ownerUsername,
              nextUsername: updates.ownerUsername,
              actorUsername: actor.username,
              actorSystemRole: actor.systemRole || actor.role,
              actorManagementRoleCode: actor.managementRoleCode,
              actorDepartmentRoleCode: actor.departmentRoleCode,
            });
            if (authorityDenial) {
              throw Object.assign(new Error(authorityDenial), { statusCode: 403 });
            }
          }
          const denial = getPcnDossierAssignmentDenial({
            assignmentLabel: assignment.label,
            currentUsername: dossier[assignment.key],
            nextUsername: updates[assignment.key],
            dossierFieldCodes: Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes : [],
            users: assignmentUsers,
          });
          if (denial) throw Object.assign(new Error(denial), { statusCode: 400 });
        }
      }

      const hasDocumentWaiverUpdate = hasWaiverPatch;
      let nextDocumentWaivers = dossier.documentWaivers || {};
      let workflowRequirements: PcnDocumentRequirement[] | undefined;
      let workflowDocuments: PcnDossierDocument[] = [];

      if (updates.status || hasDocumentWaiverUpdate) {
        const requirementResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnDocumentRequirements'`
        );
        const configuredRequirements = requirementResult.rows.map(
          (row: any) => mapDocumentRow(row) as PcnDocumentRequirement
        );
        workflowRequirements = configuredRequirements.length > 0 ? configuredRequirements : undefined;
        if (hasDocumentWaiverUpdate) {
          const knownRequirementIds = new Set(
            getPcnDocumentRequirements(dossier.fieldCodes, workflowRequirements).map((r) => r.id)
          );
          const unknownRequirementId = Object.keys(updates.documentWaivers || {}).find(
            (requirementId) => !knownRequirementIds.has(requirementId)
          );
          if (unknownRequirementId) {
            throw Object.assign(
              new Error(`Không tìm thấy mục checklist cần đánh dấu bỏ qua: ${unknownRequirementId}.`),
              { statusCode: 400 }
            );
          }
          nextDocumentWaivers = mergePcnDocumentWaivers(
            dossier.documentWaivers,
            updates.documentWaivers || {},
            actor.username,
            new Date().toISOString()
          );
        }
        if (updates.status) {
          const documentResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
            [dossierId]
          );
          workflowDocuments = documentResult.rows.map(
            (row: any) => mapDocumentRow(row) as PcnDossierDocument
          );
        }
      }

      if (updates.status && updates.status !== dossier.status) {
        const statusMutationDenial = getPcnDossierStatusMutationDenial(dossier.status, updates.status);
        if (statusMutationDenial) throw Object.assign(new Error(statusMutationDenial), { statusCode: 409 });
        if (!isPcnDossierTransitionAllowed(dossier.status, updates.status)) {
          throw Object.assign(
            new Error(`Không thể chuyển hồ sơ PCN từ ${dossier.status} sang ${updates.status}`),
            { statusCode: 409 }
          );
        }
        const stageGateDenial = getPcnDossierStageGateDenial({
          dossier,
          nextStatus: updates.status,
          requirements: workflowRequirements,
          documents: workflowDocuments,
          documentWaivers: nextDocumentWaivers,
        });
        if (stageGateDenial) throw Object.assign(new Error(stageGateDenial), { statusCode: 409 });
      }

      const movingIntoExceptionLane = Boolean(
        updates.status &&
        updates.status !== dossier.status &&
        ['ON_HOLD', 'REJECTED', 'CANCELLED'].includes(updates.status)
      );
      const updatingExceptionReason = Boolean(
        hasExplicitExceptionReason &&
        ['ON_HOLD', 'REJECTED', 'CANCELLED'].includes(updates.status || dossier.status)
      );
      if (movingIntoExceptionLane || updatingExceptionReason) {
        const reasonDenial = getPcnDossierExceptionReasonDenial(
          (updates.status || dossier.status) as CertificationDossier['status'],
          hasExplicitExceptionReason ? updates.exceptionReason : undefined
        );
        if (reasonDenial) throw Object.assign(new Error(reasonDenial), { statusCode: 400 });
      }

      const exceptionStatuses = ['ON_HOLD', 'REJECTED', 'CANCELLED'];
      const leavingExceptionLane = Boolean(
        updates.status &&
        updates.status !== dossier.status &&
        exceptionStatuses.includes(dossier.status) &&
        !exceptionStatuses.includes(updates.status)
      );
      if (hasExplicitExceptionReason && !exceptionStatuses.includes(updates.status || dossier.status)) {
        const nextReason = String(updates.exceptionReason || '').trim();
        const currentReason = String(dossier.exceptionReason || '').trim();
        if (!exceptionStatuses.includes(dossier.status)) {
          throw Object.assign(new Error('Lý do ngoại lệ chỉ được cập nhật khi hồ sơ ở lane ngoại lệ.'), { statusCode: 400 });
        }
        if (leavingExceptionLane && nextReason !== currentReason) {
          throw Object.assign(new Error('Khi rời lane ngoại lệ, phải giữ nguyên lý do đã ghi nhận.'), { statusCode: 400 });
        }
      }

      const needsDownstreamReview = dossier.status === 'WAITING_APPROVAL' && (hasOwnerControlledUpdate || hasDocumentWaiverUpdate);
      let reopenedApprovalSteps: PcnApprovalStep[] | undefined;
      let reopenedIssuance: IssuancePackage | undefined;

      if (needsDownstreamReview) {
        const approvalResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
           ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
           FOR UPDATE`,
          [dossier.id]
        );
        const allApprovalSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
        const effectiveStepIds = new Set(getPcnEffectiveApprovalSteps(allApprovalSteps).map((step) => step.id));
        reopenedApprovalSteps = allApprovalSteps.map((step) =>
          effectiveStepIds.has(step.id)
            ? { ...step, status: 'PENDING' as const, actedAt: undefined }
            : step
        );
        for (const step of reopenedApprovalSteps) {
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'approvalSteps' AND document_id = $1`,
            [step.id, JSON.stringify(getDocumentPayload(step))]
          );
        }

        const issuanceResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1
           LIMIT 1 FOR UPDATE`,
          [dossier.id]
        );
        if (issuanceResult.rows[0]) {
          const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;
          reopenedIssuance = { ...issuance, status: 'RETURNED', updatedAt: new Date().toISOString() };
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'issuancePackages' AND document_id = $1`,
            [reopenedIssuance.id, JSON.stringify(getDocumentPayload(reopenedIssuance))]
          );
        }
      }

      const changeFields = [
        'status',
        'method',
        'ownerUsername',
        'exceptionReason',
        'evaluatorUsername',
        'reviewerUsername',
        'targetDate',
        'evaluationAt',
        'effectiveAt',
        'operationalForms',
        'documentWaivers',
      ];
      const now = new Date().toISOString();
      const { documentWaivers: _documentWaiversPatch, ...dossierUpdates } = updates;
      const nextDossier: CertificationDossier = {
        ...dossier,
        ...dossierUpdates,
        ...(updates.operationalForms
          ? {
              operationalForms: {
                ...(dossier.operationalForms || {}),
                ...updates.operationalForms,
              },
            }
          : {}),
        ...(hasDocumentWaiverUpdate ? { documentWaivers: nextDocumentWaivers } : {}),
        ...(needsDownstreamReview ? { status: 'TECHNICAL_REVIEW' as const } : {}),
        updatedAt: now,
      };

      const changes = diffActivityFields(dossier, nextDossier, changeFields);
      if (changes.length === 0) {
        return { dossier, activityLog: undefined, idempotent: true };
      }

      const hasAssignmentChange = changes.some(
        (change) =>
          ['ownerUsername', 'evaluatorUsername', 'reviewerUsername'].includes(change.field) &&
          typeof change.after === 'string' &&
          Boolean(change.after.trim())
      );

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [dossierId, JSON.stringify(getDocumentPayload(nextDossier))]
      );

      const activity = {
        ...buildActivityLog({
          id: activityId,
          action: hasAssignmentChange
            ? 'ASSIGNED'
            : updates.status && updates.status !== dossier.status
            ? 'STATUS_CHANGED'
            : 'UPDATED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: needsDownstreamReview
            ? 'Cập nhật dữ liệu trước duyệt và mở lại bước 4 để rà soát'
            : 'Cập nhật metadata/mốc vận hành hồ sơ chứng nhận',
          source: 'UI',
          changes,
          createdAt: now,
        }),
        idempotencyKey,
        idempotencyFingerprint,
      };

      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );

      return {
        dossier: nextDossier,
        ...(reopenedApprovalSteps ? { approvalSteps: reopenedApprovalSteps } : {}),
        ...(reopenedIssuance ? { issuance: reopenedIssuance } : {}),
        activityLog: activity,
        idempotent: false,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN dossier update error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Xóa hồ sơ PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const reason = String(body.reason || '').trim();
  const confirmationCode = String(body.confirmationCode || '').trim();

  if (!isSafePcnSampleKey(dossierId) || !reason || reason.length > 1000 || !confirmationCode) {
    return jsonBadRequest('Xóa hồ sơ phải có lý do tối đa 1000 ký tự và mã xác nhận.');
  }

  const actor = getPcnSessionUser(req)!;
  let assets: OwnedFileAsset[] = [];

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (!dossierResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const denial = getPcnDossierDeletionDenial(dossier, actor);
      if (denial) {
        const statusCode = /không thể xóa|legal hold/i.test(denial) ? 409 : 403;
        throw Object.assign(new Error(denial), { statusCode });
      }

      if (confirmationCode !== dossier.dossierCode) {
        throw Object.assign(new Error('Mã xác nhận không khớp với mã hồ sơ PCN.'), { statusCode: 409 });
      }

      const proposalResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'certificationProposals' AND data->>'dossierId' = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      const proposalId = String(proposalResult.rows[0]?.document_id || dossier.proposalId || '');

      const activity = {
        ...buildActivityLog({
          id: stablePcnMutationId('activity-pcn-dossier-hard-delete', `${dossier.id}:${actor.username}:${Date.now()}`),
          action: 'DELETED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `Xóa vĩnh viễn hồ sơ PCN ${dossier.dossierCode}: ${reason}`,
          source: 'UI',
          createdAt: new Date().toISOString(),
        }),
        deletionReason: reason,
        deletionConfirmationCode: dossier.dossierCode,
      };

      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );

      assets = await hardDeleteOwnedDocumentGraph(client, {
        parentCollection: 'certificationDossiers',
        parentId: dossier.id,
        relationField: 'dossierId',
      });

      return { dossierId: dossier.id, proposalId, activityLog: activity };
    });

    await deleteOwnedFileAssets(assets, 'pcn');
    return jsonOk({ deleted: true, ...result });
  } catch (error: any) {
    console.error('PCN dossier hard-delete error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
