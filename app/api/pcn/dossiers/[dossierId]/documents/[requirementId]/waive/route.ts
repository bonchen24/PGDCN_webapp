import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/helpers';
import {
  CertificationDossier,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnUserAccount,
} from '@/types';
import { buildPcnDossierDocumentId, getPcnDossierRequirementsWithCustom } from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnDossierRequirement } from '@/utils/pcnDossierStageGate';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import { applyPcnDossierDocumentRework, assertPcnDossierNodeOperator } from '@/lib/server/pcn-dossier-operations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string; requirementId: string }> },
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { dossierId: rawDossierId, requirementId: rawRequirementId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  const requirementId = String(rawRequirementId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const reason = String(bodyJson?.reason || '').trim();

  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(requirementId) || !reason || reason.length > 1000) {
    return jsonBadRequest('Lý do bỏ qua tài liệu phải có từ 1 đến 1000 ký tự.');
  }

  const actor = getPcnSessionUser(req)! as PcnUserAccount;

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId],
      );
      if (!dossierResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi bỏ qua tài liệu.'), { statusCode: 409 });
      }

      await assertPcnDossierNodeOperator(client, dossier, requirementId, actor);

      const requirementResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDocumentRequirements' AND document_id = $1
         LIMIT 1`,
        [requirementId],
      );
      const requirement = requirementResult.rows[0]
        ? mapDocumentRow(requirementResult.rows[0]) as PcnDocumentRequirement
        : getPcnDossierRequirementsWithCustom(dossier).find((item) => item.id === requirementId);
      const fieldCodes = Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()) : [];
      if (!requirement || requirement.active !== true || !fieldCodes.includes(String(requirement.fieldCode || '').trim().toUpperCase())) {
        throw Object.assign(new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ PCN.'), { statusCode: 404 });
      }
      if (!canProcessPcnDossierRequirement(dossier, requirement)) {
        throw Object.assign(new Error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      const documentId = buildPcnDossierDocumentId(dossierId, requirementId);
      const documentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      const document = documentResult.rows[0] ? mapDocumentRow(documentResult.rows[0]) as PcnDossierDocument : undefined;
      if (document?.status === 'PRESENT' && document.currentVersionId) {
        throw Object.assign(new Error('Không thể bỏ qua khi tài liệu hiện tại đang có; hãy xóa phiên hiện tại trước.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const nextWaiver = { requirementId, reason, decidedAt: now, decidedBy: actor.username };
      const dossierWithWaiver: CertificationDossier = { ...dossier, documentWaivers: { ...(dossier.documentWaivers || {}), [requirementId]: nextWaiver }, updatedAt: now };
      const workflowRework = await applyPcnDossierDocumentRework(client, dossierWithWaiver, requirement, actor, now);

      for (const nextTask of workflowRework.workflowTasks || []) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'pcnDossierWorkflowTasks' AND document_id = $1`,
          [nextTask.id, JSON.stringify(getDocumentPayload(nextTask))],
        );
      }

      const nextDossier: CertificationDossier = { ...workflowRework.dossier, documentWaivers: dossierWithWaiver.documentWaivers, updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [dossierId, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const activityLog = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossierId,
        entityLabel: dossier.dossierCode || dossierId,
        actorUsername: actor.username,
        actorName: actor.name || 'Người dùng PCN',
        actorRole: actor.systemRole || actor.role,
        summary: `Đánh dấu bỏ qua tài liệu ${requirement.name} và ghi lý do${requirement.workflowStageLabel ? ` · giai đoạn ${requirement.workflowStageLabel}` : ''}`,
        source: 'UI',
        groupId: dossierId,
        changes: diffActivityFields(dossier, nextDossier, ['documentWaivers', 'updatedAt']),
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

      return {
        ...(document ? { document } : {}),
        dossier: nextDossier,
        ...(workflowRework.workflowTasks ? { workflowTasks: workflowRework.workflowTasks } : {}),
        activityLog,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || (message.toLowerCase().includes('không tìm thấy') ? 404 : 400));
  }
}
