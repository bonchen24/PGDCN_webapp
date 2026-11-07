import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  getPgdDossierRequirementsWithCustom,
  markPgdDossierChecklistPresent,
  PgdDossierDocument,
} from '@/utils/pgdDossier';
import { assertPgdRequestEvidenceMutationAllowed, writePgdActivity } from '@/lib/server/pgd-operations';
import { resolveB1AttachmentRequirements } from '@/utils/pgdcnB1Attachments';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.dossierDocuments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  if (!actor.departmentScopes?.includes('PGD') && actor.pgdRole !== 'PGD_ADMIN') {
    return jsonForbidden('Tài khoản chưa được cấp phạm vi PGD.');
  }

  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
  if (!requestId) return jsonBadRequest('Thiếu mã hồ sơ PGD.');

  let body: { documentId?: string; requirementCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu phải là JSON hợp lệ.');
  }

  const documentId = String(body?.documentId || '').trim();
  const requirementCode = String(body?.requirementCode || '').trim();
  if (!documentId || !requirementCode) {
    return jsonBadRequest('Cần có documentId và requirementCode.');
  }

  if (/^(QC4-|QC9-|pcn-)/i.test(requirementCode)) {
    return jsonBadRequest('Yêu cầu không thuộc phạm vi hồ sơ PGD.');
  }

  try {
    const updated = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);

      const docResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = $2 AND data->>'requestId' = $3 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.dossierDocuments, documentId, request.id],
      );
      if (!docResult.rows[0]) throw Object.assign(new Error('Không tìm thấy chứng từ PGD.'), { statusCode: 404 });
      const doc = mapDocumentRow(docResult.rows[0]) as PgdDossierDocument;
      if (!['PENDING_MAPPING', 'UNMAPPED'].includes(String(doc.mappingStatus || doc.status || '').toUpperCase())) {
        throw Object.assign(new Error('Chỉ chứng từ đang chờ ánh xạ mới được gắn requirement.'), { statusCode: 409 });
      }

      const b1Requirement = resolveB1AttachmentRequirements({
        domain: 'PGD',
        productGroup: request.productGroup,
        templateId: request.workflowTemplateId,
        templateVersion: request.workflowTemplateVersion,
        workflowSnapshot: request.workflowSnapshot,
      }).find((item) => item.requirementId === requirementCode || item.requirementCode === requirementCode);
      if (!b1Requirement) {
        throw Object.assign(new Error('Mã yêu cầu không thuộc danh mục B1 của template đã chọn.'), { statusCode: 400 });
      }

      const isMultiple = b1Requirement.multiplicity === 'MULTIPLE';
      let version = doc.version || 1;
      let supersedesDocumentId = doc.supersedesDocumentId;

      if (!isMultiple) {
        const currentResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1
             AND data->>'requestId' = $2
             AND data->>'requirementCode' = $3
             AND document_id <> $4
             AND COALESCE(data->>'status', 'PRESENT') NOT IN ('SUPERSEDED', 'PENDING_MAPPING')
             AND COALESCE(data->>'metadataOnly', 'false') <> 'true'
             AND COALESCE(data->>'assessmentRoundId', '') = $5
             AND data->>'domain' = 'pgd'
           ORDER BY COALESCE((data->>'version')::int, 0) DESC LIMIT 1 FOR UPDATE`,
          [PGD_COLLECTIONS.dossierDocuments, request.id, b1Requirement.requirementCode, doc.id, doc.assessmentRoundId || ''],
        );
        const currentPrior = currentResult.rows[0] ? (mapDocumentRow(currentResult.rows[0]) as PgdDossierDocument) : undefined;
        if (currentPrior) {
          version = (Number(currentPrior.version) || 0) + 1;
          supersedesDocumentId = currentPrior.id;
          const updatedPrior = { ...currentPrior, status: 'SUPERSEDED' };
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = $1 AND document_id = $3`,
            [PGD_COLLECTIONS.dossierDocuments, JSON.stringify(getDocumentPayload(updatedPrior)), currentPrior.id],
          );
        }
      }

      const now = new Date().toISOString();
      const updatedDoc: PgdDossierDocument = {
        ...doc,
        domain: 'pgd',
        dossierId: request.id,
        templateId: request.workflowTemplateId || request.workflowSnapshot?.templateId,
        templateVersion: request.workflowTemplateVersion || request.workflowSnapshot?.templateVersion,
        requirementCode: b1Requirement.requirementCode,
        requirementId: b1Requirement.requirementId,
        title: b1Requirement.displayName,
        displayName: b1Requirement.displayName,
        stageId: b1Requirement.stageId,
        documentKind: b1Requirement.documentKind,
        multiplicity: isMultiple ? 'MULTIPLE' : 'SINGLE',
        mappingStatus: 'MAPPED',
        status: 'PRESENT',
        version,
        ...(supersedesDocumentId ? { supersedesDocumentId } : {}),
        mappedByUsername: actor.username,
        mappedAt: now,
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.dossierDocuments, JSON.stringify(getDocumentPayload(updatedDoc)), doc.id],
      );

      const nextChecklist = markPgdDossierChecklistPresent(
        request.productGroup,
        request.dossierChecklist,
        {
          requirementCode: updatedDoc.requirementCode,
          id: updatedDoc.id,
          version: updatedDoc.version,
        },
        now,
          b1Requirement.sourceProvenance === 'TEMPLATE_DEFINITION' ? 'UPLOADED' : 'PRESENT',
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload({ ...request, dossierChecklist: nextChecklist, updatedAt: now })), request.id],
      );

      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_REQUEST',
        entityId: request.id,
        requestCode: request.requestCode,
        summary: `Gắn tệp ${doc.originalFileName || doc.fileName} vào yêu cầu ${updatedDoc.requirementId || updatedDoc.requirementCode}`,
      });

      return updatedDoc;
    });

    return jsonOk({ success: true, dossierDocument: updated });
  } catch (error: any) {
    const message = error.message || String(error);
    if (error.statusCode === 404) return jsonNotFound(message);
    if (error.statusCode === 409) return jsonConflict(message);
    if (error.statusCode && error.statusCode !== 400) return jsonServerError(message, error.statusCode);
    return jsonBadRequest(message);
  }
}
