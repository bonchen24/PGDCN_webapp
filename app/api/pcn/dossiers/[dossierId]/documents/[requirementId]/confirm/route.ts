import { NextRequest } from 'next/server';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/helpers';
import { withPgTransaction } from '@/lib/server/postgres';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossier-operations';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import type { CertificationDossier, PcnDossierDocument } from '@/types';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { getPcnDossierRequirementsWithCustom } from '@/utils/pcnDossierDocuments';
import { canProcessPcnDossierRequirement } from '@/utils/pcnDossierStageGate';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string; requirementId: string }> },
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { dossierId: rawDossierId, requirementId: rawRequirementId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  const requirementId = String(rawRequirementId || '').trim();
  if (!dossierId || !requirementId || requirementId.length > 200 || /[\\/]/.test(requirementId)) {
    return jsonBadRequest('Thiếu mã hồ sơ hoặc yêu cầu tài liệu PCN.');
  }
  const actor = getPcnSessionUser(req)!;

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
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi xác nhận tài liệu.'), { statusCode: 409 });
      }
      assertPcnDossierOperator(dossier, actor);

      const customDefinition = dossier.workflowSnapshot?.requirementDefinitions?.find((item) => item.domain === 'PCN' && item.id === requirementId);
      if (!customDefinition) throw Object.assign(new Error('Yêu cầu không thuộc snapshot PCN của hồ sơ.'), { statusCode: 404 });
      const requirement = getPcnDossierRequirementsWithCustom(dossier).find((item) => item.id === requirementId);
      if (!requirement || !dossier.fieldCodes.includes(requirement.fieldCode)) {
        throw Object.assign(new Error('Yêu cầu tài liệu không thuộc lĩnh vực của hồ sơ PCN.'), { statusCode: 400 });
      }
      if (!canProcessPcnDossierRequirement(dossier, requirement)) {
        throw Object.assign(new Error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      const documentId = `dossier-document-${dossierId}-${requirementId}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const documentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (!documentResult.rows[0]) throw Object.assign(new Error('Chưa có tệp tải lên hoặc bản sinh để xác nhận.'), { statusCode: 409 });
      const document = mapDocumentRow(documentResult.rows[0]) as PcnDossierDocument;
      if (document.dossierId !== dossierId || document.requirementId !== requirementId || document.status !== 'PRESENT' || !document.currentVersionId) {
        throw Object.assign(new Error('Tài liệu hiện hành không khớp hồ sơ hoặc yêu cầu.'), { statusCode: 409 });
      }
      if (document.lifecycleStatus === 'CONFIRMED') return { document, idempotent: true as const };
      if (!['UPLOADED', 'GENERATED'].includes(String(document.lifecycleStatus))) {
        throw Object.assign(new Error('Chỉ có thể xác nhận tệp đang chờ rà soát.'), { statusCode: 409 });
      }
      const version = document.versions.find((item) => item.assetId === document.currentVersionId);
      if (!version || !/^[a-f0-9]{64}$/i.test(String(version.sha256 || '')) || Number(version.byteSize) <= 0) {
        throw Object.assign(new Error('Phiên tài liệu hiện hành thiếu checksum hoặc dung lượng hợp lệ.'), { statusCode: 409 });
      }
      const assetResult = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [document.currentVersionId],
      );
      const asset = assetResult.rows[0];
      if (!asset
        || asset.source_collection !== 'dossierDocuments'
        || asset.source_document_id !== documentId
        || asset.source_json_path !== requirementId
        || String(asset.mime_type || '') !== String(version.mimeType || '')
        || Number(asset.byte_size) !== Number(version.byteSize)
        || String(asset.sha256 || '').toLowerCase() !== String(version.sha256 || '').toLowerCase()) {
        throw Object.assign(new Error('Asset hiện hành không khớp provenance hoặc checksum của phiên tài liệu.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const nextDocument: PcnDossierDocument = { ...document, lifecycleStatus: 'CONFIRMED', updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'dossierDocuments' AND document_id = $1`,
        [documentId, JSON.stringify(getDocumentPayload(nextDocument))],
      );
      const activityLog = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossierId,
        entityLabel: dossier.dossierCode || dossierId,
        actorUsername: actor.username,
        actorName: actor.name || 'Người dùng PCN',
        actorRole: actor.systemRole || actor.role,
        summary: `Xác nhận tệp hiện hành cho ${requirement.name}.${requirement.workflowStageLabel ? ` Giai đoạn: ${requirement.workflowStageLabel}.` : ''}`,
        source: 'USER_REVIEW',
        groupId: document.currentVersionId,
        changes: diffActivityFields(document, nextDocument, ['lifecycleStatus', 'updatedAt']),
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
      return { document: nextDocument, activityLog, idempotent: false as const };
    });
    return jsonOk(result, { status: result.idempotent ? 200 : 201 });
  } catch (error: any) {
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode) || (message.includes('không tìm thấy') || message.includes('không thuộc') ? 404 : 400);
    return jsonError(message, statusCode);
  }
}
