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
import { buildPcnDossierDocumentId } from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
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

  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(requirementId)) {
    return jsonBadRequest('Mã hồ sơ hoặc requirement không hợp lệ.');
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
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi xóa phiên tài liệu.'), { statusCode: 409 });
      }

      await assertPcnDossierNodeOperator(client, dossier, requirementId, actor);

      const requirementResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDocumentRequirements' AND document_id = $1
         LIMIT 1`,
        [requirementId],
      );
      const requirement = requirementResult.rows[0] ? mapDocumentRow(requirementResult.rows[0]) as PcnDocumentRequirement : undefined;
      const fieldCodes = Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()) : [];
      if (!requirement || requirement.active !== true || !fieldCodes.includes(String(requirement.fieldCode || '').trim().toUpperCase())) {
        throw Object.assign(new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ PCN.'), { statusCode: 404 });
      }

      const documentId = buildPcnDossierDocumentId(dossierId, requirementId);
      const documentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (!documentResult.rows[0]) throw Object.assign(new Error('Không tìm thấy checklist tài liệu của hồ sơ.'), { statusCode: 404 });
      const document = mapDocumentRow(documentResult.rows[0]) as PcnDossierDocument;

      const now = new Date().toISOString();
      const nextDocument: PcnDossierDocument = { ...document, currentVersionId: undefined, status: 'MISSING', lifecycleStatus: undefined, updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'dossierDocuments' AND document_id = $1`,
        [documentId, JSON.stringify(getDocumentPayload(nextDocument))],
      );

      const nextWaivers = { ...(dossier.documentWaivers || {}) };
      delete nextWaivers[requirementId];
      const workflowRework = await applyPcnDossierDocumentRework(client, { ...dossier, documentWaivers: nextWaivers }, requirement, actor, now);
      const nextDossier: CertificationDossier = { ...workflowRework.dossier, documentWaivers: nextWaivers, updatedAt: now };
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
        summary: `Gỡ phiên tài liệu hiện tại ${requirement.name}; giữ nguyên lịch sử phiên${requirement.workflowStageLabel ? ` · giai đoạn ${requirement.workflowStageLabel}` : ''}`,
        source: 'UI',
        groupId: dossierId,
        changes: diffActivityFields(document, nextDocument, ['currentVersionId', 'status', 'updatedAt'])
          .concat(diffActivityFields(dossier, nextDossier, ['documentWaivers', 'updatedAt'])),
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
        document: nextDocument,
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
