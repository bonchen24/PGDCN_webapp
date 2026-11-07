import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/helpers';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { CertificationDossier, PcnDossierAttachment, PcnDossierWorkflowTask } from '@/types';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { buildActivityLog } from '@/utils/activityLog';
import { resolveB1AttachmentRequirements } from '@/utils/pgdcnB1Attachments';

const EDITABLE_NODE_TASK_STATUSES = new Set(['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED', 'COMPLETED']);

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const actor = getPcnSessionUser(req)!;
  if (!isPcnSystemManager(actor) && !actor.departmentScopes?.includes('PCN')) {
    return jsonForbidden('Tài khoản chưa được cấp phạm vi PCN.');
  }

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  if (!dossierId) return jsonBadRequest('Thiếu mã hồ sơ PCN.');

  let body: { attachmentId?: string; requirementId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu phải là JSON hợp lệ.');
  }

  const attachmentId = String(body?.attachmentId || '').trim();
  const requirementId = String(body?.requirementId || '').trim();
  if (!attachmentId || !requirementId) {
    return jsonBadRequest('Cần có attachmentId và requirementId.');
  }

  if (/^(PGD_|pgd-|REQUEST_|COMMERCIAL_|CUSTOMS_|PACKING_|BILL_)/i.test(requirementId)) {
    return jsonBadRequest('Yêu cầu không thuộc phạm vi hồ sơ PCN.');
  }

  try {
    const updated = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [dossierId],
      );
      if (!dossierResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; không thể cập nhật liên kết tệp.'), { statusCode: 409 });
      }

      const intakeNode = dossier.workflowSnapshot?.nodes?.find((item) => item.id === 'intake' && item.active !== false);
      if (!intakeNode) throw Object.assign(new Error('Không tìm thấy bước tiếp nhận B1 trong workflow PCN.'), { statusCode: 409 });
      const taskResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDossierWorkflowTasks'
           AND data->>'dossierId' = $1 AND data->>'nodeId' = $2
         LIMIT 1 FOR UPDATE`,
        [dossier.id, intakeNode.id],
      );
      const task = taskResult.rows[0] ? mapDocumentRow(taskResult.rows[0]) as PcnDossierWorkflowTask : undefined;
      if (!task || !EDITABLE_NODE_TASK_STATUSES.has(task.status)) {
        throw Object.assign(new Error('Bước tiếp nhận PCN đang khóa theo workflow.'), { statusCode: 409 });
      }
      const actorUsername = normalizeUsername(actor.username);
      const ownerUsername = normalizeUsername(dossier.ownerUsername);
      const assignedUsername = normalizeUsername(task.assignedUsername);
      const intakeCreatorMayMapB1 = normalizeUsername(dossier.intakeCreatedByUsername) === actorUsername;
      if (
        !isPcnSystemManager(actor)
        && ownerUsername !== actorUsername
        && assignedUsername !== actorUsername
        && !intakeCreatorMayMapB1
      ) {
        throw Object.assign(new Error('Bạn chưa được phân công xử lý bước PCN này.'), { statusCode: 403 });
      }

      const attachmentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierAttachments' AND document_id = $1 AND data->>'dossierId' = $2 LIMIT 1 FOR UPDATE`,
        [attachmentId, dossier.id],
      );
      if (!attachmentResult.rows[0]) throw Object.assign(new Error('Không tìm thấy tệp đính kèm PCN.'), { statusCode: 404 });
      const attachment = mapDocumentRow(attachmentResult.rows[0]) as PcnDossierAttachment;
      if (!['PENDING_MAPPING', 'UNMAPPED'].includes(String(attachment.mappingStatus || attachment.status || '').toUpperCase())) {
        throw Object.assign(new Error('Chỉ tệp đang chờ ánh xạ mới được gắn requirement.'), { statusCode: 409 });
      }

      const validRequirements = resolveB1AttachmentRequirements({
        domain: 'PCN',
        fieldCode: dossier.fieldCodes?.[0],
        templateId: dossier.workflowTemplateId,
        templateVersion: dossier.workflowTemplateVersion,
        workflowSnapshot: dossier.workflowSnapshot as any,
      });
      const matched = validRequirements.find((r) => r.requirementId === requirementId || r.requirementCode === requirementId);
      if (!matched) {
        throw Object.assign(new Error('Yêu cầu B1 không thuộc template/lưu trình PCN của hồ sơ.'), { statusCode: 400 });
      }

      const isMultiple = matched.multiplicity === 'MULTIPLE';
      let version = attachment.version || 1;
      let supersedesAttachmentId = attachment.supersedesAttachmentId;

      if (!isMultiple) {
        const priorResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierAttachments'
             AND data->>'dossierId' = $1
             AND (data->>'requirementId' = $2 OR data->>'requirementCode' = $2)
             AND document_id <> $3
             AND COALESCE(data->>'status', 'ACTIVE') = 'ACTIVE'
             AND COALESCE(data->>'metadataOnly', 'false') <> 'true'
           ORDER BY COALESCE((data->>'version')::int, 1) DESC LIMIT 1 FOR UPDATE`,
          [dossier.id, matched?.requirementId || requirementId, attachment.id],
        );
        const activePrior = priorResult.rows[0] ? (mapDocumentRow(priorResult.rows[0]) as PcnDossierAttachment) : undefined;
        if (activePrior) {
          version = (activePrior.version || 1) + 1;
          supersedesAttachmentId = activePrior.id;
          const updatedPrior = { ...activePrior, status: 'SUPERSEDED' };
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'dossierAttachments' AND document_id = $1`,
            [activePrior.id, JSON.stringify(getDocumentPayload(updatedPrior))],
          );
        }
      }

      const now = new Date().toISOString();
      const updatedAttachment: PcnDossierAttachment = {
        ...attachment,
        requirementId: matched.requirementId,
        requirementCode: matched.requirementCode,
        displayName: matched.displayName,
        mappingStatus: 'MAPPED',
        status: 'ACTIVE',
        domain: 'PCN',
        templateId: dossier.workflowTemplateId,
        templateVersion: dossier.workflowTemplateVersion,
        stageId: matched.stageId,
        documentKind: matched.documentKind,
        ...(isMultiple ? { multiplicity: 'MULTIPLE' as const } : { multiplicity: 'SINGLE' as const }),
        version,
        ...(supersedesAttachmentId ? { supersedesAttachmentId } : {}),
        mappedByUsername: actor.username,
        mappedAt: now,
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'dossierAttachments' AND document_id = $1`,
        [attachment.id, JSON.stringify(getDocumentPayload(updatedAttachment))],
      );

      const activityLog = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossier.id,
        entityLabel: dossier.dossierCode || dossier.id,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        domain: 'PCN',
        summary: `Gắn tệp ${attachment.originalFileName || attachment.fileName} vào yêu cầu ${updatedAttachment.requirementId}`,
        source: 'UI',
        groupId: dossier.id,
      });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );

      return updatedAttachment;
    });

    return jsonOk({ success: true, attachment: updated });
  } catch (error: any) {
    const message = error.message || String(error);
    if (error.statusCode === 403) return jsonForbidden(message);
    if (error.statusCode === 404) return jsonNotFound(message);
    if (error.statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
