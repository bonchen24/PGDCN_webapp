import { NextRequest } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation, requirePcnSession } from '@/lib/server/auth';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/helpers';
import {
  CertificationDossier,
  IssuancePackage,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
} from '@/types';
import {
  buildPcnDossierDocumentId,
  buildPcnUploadedDossierAttachment,
  getPcnDossierRequirementsWithCustom,
} from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnDossierRequirement, getPcnRequirementReopenStatus, getPcnRequirementWorkflowStageIndex } from '@/utils/pcnDossierStageGate';
import { getPcnWorkflowStage, getPcnWorkflowStageIndex } from '@/utils/pcnWorkflowStages';
import { getPcnEffectiveApprovalSteps } from '@/utils/pcnApproval';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { applyPcnDossierDocumentRework, assertPcnDossierOperator } from '@/lib/server/pcn-dossier-operations';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> },
) {
  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  if (!dossierId) {
    return jsonBadRequest('Thiếu mã hồ sơ PCN.');
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'dossierDocuments'
         AND data->>'dossierId' = $1
       ORDER BY COALESCE((data->>'updatedAt')::timestamptz, updated_at) DESC, document_id`,
      [dossierId],
    );
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    console.error('PCN dossier document read error:', error);
    return jsonError(error?.message || String(error), 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> },
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const requirementId = String(bodyJson?.requirementId || '').trim();
  const assetId = String(bodyJson?.assetId || '').trim();
  const fileName = String(bodyJson?.fileName || '').trim();

  if (!dossierId || !requirementId || !/^pcn-file-[a-z0-9-]+$/.test(assetId) || !fileName) {
    return jsonBadRequest('Thiếu metadata phiên tài liệu PCN.');
  }
  if (fileName.length > 255 || /[\\/]/.test(fileName)) {
    return jsonBadRequest('Tên file tài liệu PCN không hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const document = await withPgTransaction(async (client) => {
      const dossierExists = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId],
      );
      if (dossierExists.rows.length === 0) throw new Error('Không tìm thấy hồ sơ PCN.');
      const dossier = mapDocumentRow(dossierExists.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi tải phiên tài liệu mới.'), { statusCode: 409 });
      }
      assertPcnDossierOperator(dossier, actor);

      const dossierFieldCodes = Array.isArray(dossier.fieldCodes)
        ? dossier.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean)
        : [];
      const requirement = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDocumentRequirements' AND document_id = $1
         LIMIT 1`,
        [requirementId],
      );
      const requirementDefinition = requirement.rows[0]
        ? mapDocumentRow(requirement.rows[0]) as PcnDocumentRequirement
        : getPcnDossierRequirementsWithCustom(dossier).find((item) => item.id === requirementId);
      const isCustomRequirement = Boolean(dossier.workflowSnapshot?.requirementDefinitions?.some((item) => item.domain === 'PCN' && item.id === requirementId));
      const requirementData: Partial<PcnDocumentRequirement> = requirementDefinition || {};
      const requirementFieldCode = String(requirementData.fieldCode || '').trim().toUpperCase();
      if ((!requirement.rows.length && !dossier.workflowSnapshot?.requirementDefinitions?.some((item) => item.id === requirementId)) || requirementData.active === false || !requirementFieldCode || !dossierFieldCodes.includes(requirementFieldCode)) {
        throw new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ PCN.');
      }
      if (!canProcessPcnDossierRequirement(dossier, requirementDefinition!)) {
        throw Object.assign(new Error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      const documentId = buildPcnDossierDocumentId(dossierId, requirementId);
      const asset = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 FOR UPDATE`,
        [assetId],
      );
      const assetRow = asset.rows[0];
      if (!assetRow
        || assetRow.source_collection !== 'dossierDocuments'
        || assetRow.source_document_id !== documentId
        || assetRow.source_json_path !== requirementId) {
        throw new Error('File asset không thuộc hồ sơ PCN.');
      }

      const existing = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND document_id = $1 FOR UPDATE`,
        [documentId],
      );
      const previous = existing.rows[0]?.data || {};
      const previousVersions = Array.isArray(previous.versions) ? previous.versions : [];
      const attachmentId = `pcn-attachment-upload-${assetId}`;
      const existingAttachmentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierAttachments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [attachmentId],
      );
      const existingAttachment = existingAttachmentResult.rows[0]
        ? mapDocumentRow(existingAttachmentResult.rows[0]) as PcnDossierAttachment
        : undefined;

      const hasVersion = previousVersions.some((version: any) => String(version?.assetId || '') === assetId);
      if (hasVersion && existingAttachment) {
        return {
          document: mapDocumentRow(existing.rows[0]),
          dossier,
          attachment: existingAttachment,
          idempotent: true as const,
        };
      }

      const now = new Date().toISOString();
      let persistedDocument: PcnDossierDocument;
      if (hasVersion) {
        persistedDocument = mapDocumentRow(existing.rows[0]) as PcnDossierDocument;
      } else {
        const version = {
          assetId,
          fileName: fileName.slice(0, 255),
          mimeType: assetRow.mime_type || undefined,
          byteSize: Number(assetRow.byte_size || 0),
          sha256: assetRow.sha256,
          uploadedAt: now,
          uploadedBy: actor.username,
        };
        const next = {
          ...previous,
          dossierId,
          requirementId,
          fieldCode: requirementFieldCode,
          currentVersionId: assetId,
          versions: [...previousVersions, version],
          status: 'PRESENT',
          ...(isCustomRequirement ? { lifecycleStatus: 'UPLOADED' as const } : {}),
          createdAt: previous.createdAt || now,
          updatedAt: now,
        };
        const write = await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
           RETURNING document_id, data`,
          [documentId, JSON.stringify(getDocumentPayload(next))],
        );
        persistedDocument = mapDocumentRow(write.rows[0]) as PcnDossierDocument;
      }

      const attachment = existingAttachment || buildPcnUploadedDossierAttachment({
        dossierId,
        requirement: requirementDefinition!,
        assetId,
        fileName,
        mimeType: assetRow.mime_type,
        byteSize: Number(assetRow.byte_size || 0),
        sha256: assetRow.sha256,
        uploadedAt: now,
        uploadedBy: actor.username,
      });
      if (!existingAttachment) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [attachment.id, JSON.stringify(getDocumentPayload(attachment))],
        );
      }

      const workflowRework = await applyPcnDossierDocumentRework(client, dossier, requirementDefinition!, actor, now);
      const currentStageIndex = getPcnWorkflowStageIndex(getPcnWorkflowStage(dossier.status)?.key || 'INTAKE');
      const requirementStageIndex = getPcnRequirementWorkflowStageIndex(requirementDefinition!);
      const needsDownstreamReview = dossier.status === 'WAITING_APPROVAL'
        && requirementStageIndex >= 0
        && requirementStageIndex < currentStageIndex;
      const reopenStatus = getPcnRequirementReopenStatus(requirementDefinition!) || 'TECHNICAL_REVIEW';
      let nextApprovalSteps: PcnApprovalStep[] | undefined;

      if (needsDownstreamReview) {
        const approvalResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
           ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
           FOR UPDATE`,
          [dossier.id],
        );
        const allSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
        const effectiveStepIds = new Set(getPcnEffectiveApprovalSteps(allSteps).map((step) => step.id));
        nextApprovalSteps = allSteps.map((step) => effectiveStepIds.has(step.id)
          ? { ...step, status: 'PENDING' as const, actedAt: undefined }
          : step);
        for (const step of nextApprovalSteps) {
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'approvalSteps' AND document_id = $1`,
            [step.id, JSON.stringify(getDocumentPayload(step))],
          );
        }
        const issuanceResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1
           LIMIT 1 FOR UPDATE`,
          [dossier.id],
        );
        if (issuanceResult.rows.length > 0) {
          const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;
          const nextIssuance: IssuancePackage = { ...issuance, status: 'RETURNED', updatedAt: now };
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'issuancePackages' AND document_id = $1`,
            [nextIssuance.id, JSON.stringify(getDocumentPayload(nextIssuance))],
          );
        }
      }

      const nextDossier: CertificationDossier = {
        ...workflowRework.dossier,
        ...(needsDownstreamReview ? { status: reopenStatus } : {}),
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [dossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const log = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossierId,
        entityLabel: dossier.dossierCode || dossierId,
        actorUsername: actor.username,
        actorName: actor.name || 'Người dùng PCN',
        actorRole: actor.systemRole || actor.role,
        summary: needsDownstreamReview
          ? `Tải phiên tài liệu ${fileName.slice(0, 120)} và mở lại ${getPcnWorkflowStage(reopenStatus)?.title || 'bước bị ảnh hưởng'} để rà soát`
          : workflowRework.reopenedNodeId
            ? `Tải phiên tài liệu ${fileName.slice(0, 120)} và mở lại node ${workflowRework.reopenedNodeId} theo vòng xử lý mới`
          : hasVersion
            ? `Bổ sung provenance cho phiên tài liệu ${fileName.slice(0, 120)} trong hồ sơ`
            : `Tải phiên tài liệu ${fileName.slice(0, 120)} vào hồ sơ`,
        source: 'UI',
        groupId: dossier.id,
        changes: diffActivityFields(dossier, nextDossier, ['updatedAt']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(log);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );

      return {
        document: persistedDocument,
        attachment,
        dossier: nextDossier,
        ...(workflowRework.workflowTasks ? { workflowTasks: workflowRework.workflowTasks } : {}),
        ...(nextApprovalSteps ? { approvalSteps: nextApprovalSteps } : {}),
        activityLog: log,
        idempotent: false as const,
      };
    });

    return jsonOk(document, { status: document.idempotent ? 200 : 201 });
  } catch (error: any) {
    console.error('PCN dossier document write error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const statusCode = Number(error?.statusCode)
      || (normalizedMessage.includes('không tìm thấy') || normalizedMessage.includes('không thuộc') ? 404 : 400);
    return jsonError(message, statusCode);
  }
}
