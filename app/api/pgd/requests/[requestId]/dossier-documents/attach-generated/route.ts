import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonCreated, jsonNotFound, jsonServerError } from '@/lib/server/response';
import { PGD_COLLECTIONS, PgdGeneratedDocument, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  buildPgdDossierDocument,
  getPgdDossierRequirementForTemplate,
  getPgdDossierRequirements,
  getPgdDossierRequirementStationKey,
  markPgdDossierChecklistPresent,
  PgdDossierDocument,
} from '@/utils/pgdDossier';
import { PgdDocumentTemplateKind } from '@/utils/pgdDocumentTemplates';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.dossierDocuments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

  const body = (await req.json().catch(() => ({}))) || {};
  const generatedDocumentId = String(body?.documentId || '').trim();
  const requirementCode = String(body?.requirementCode || '').trim().toUpperCase();

  if (!requestId || !generatedDocumentId || !requirementCode) {
    return jsonBadRequest('Cần có hồ sơ, tài liệu sinh và checklist đích để đưa biểu mẫu vào bộ hồ sơ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
           LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      const requirements = getPgdDossierRequirements(request.productGroup);
      const requirement = requirements.find((item) => item.code === requirementCode);
      if (!requirement) throw Object.assign(new Error('Checklist đích không thuộc nhóm sản phẩm của hồ sơ PGD.'), { statusCode: 400 });
      assertPgdRequestStationMutationAllowed(request, getPgdDossierRequirementStationKey(requirement.code));

      const generatedResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
           LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.documents, generatedDocumentId],
      );
      if (!generatedResult.rows[0]) throw Object.assign(new Error('Không tìm thấy tài liệu PGD đã sinh.'), { statusCode: 404 });
      const generated = mapDocumentRow(generatedResult.rows[0]) as PgdGeneratedDocument;
      if (generated.requestId !== request.id) throw Object.assign(new Error('Tài liệu sinh không thuộc hồ sơ PGD đang mở.'), { statusCode: 409 });
      const mappedRequirement = getPgdDossierRequirementForTemplate(generated.kind as PgdDocumentTemplateKind, request.productGroup);
      if (!mappedRequirement || mappedRequirement.code !== requirementCode) {
        throw Object.assign(new Error('Tài liệu sinh không khớp với mục checklist đã chọn.'), { statusCode: 400 });
      }

      if (generated.fileAssetId) {
        const assetResult = await client.query(
          `SELECT id, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
             FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
          [generated.fileAssetId],
        );
        const asset = assetResult.rows[0];
        if (
          !asset ||
          String(asset.source_collection || '') !== PGD_COLLECTIONS.documents ||
          String(asset.source_document_id || '') !== generated.id ||
          String(asset.source_json_path || '') !== 'output' ||
          String(asset.sha256 || '').toLowerCase() !== generated.sha256.toLowerCase() ||
          Number(asset.byte_size) !== Number(generated.byteSize)
        ) {
          throw Object.assign(new Error('File asset của tài liệu sinh không khớp provenance hoặc checksum.'), { statusCode: 409 });
        }
      }

      const currentResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'requirementCode' = $3 AND data->>'domain' = 'pgd'
           ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC
           LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.dossierDocuments, request.id, requirementCode],
      );
      const current = currentResult.rows[0] ? (mapDocumentRow(currentResult.rows[0]) as PgdDossierDocument) : undefined;
      const now = new Date().toISOString();
      const next = buildPgdDossierDocument(
        {
          id: `pgd-dossier-document-${randomUUID()}`,
          requestId: request.id,
          requirementCode,
          title: String(body?.title || requirement.title).trim() || requirement.title,
          fileName: generated.fileName,
          version: (Number(current?.version) || 0) + 1,
          checksum: generated.sha256,
          uploadedByUsername: actor.username,
          ...(generated.fileAssetId ? { fileAssetId: generated.fileAssetId } : {}),
          mimeType: generated.mimeType,
          byteSize: generated.byteSize,
          ...(current?.id ? { supersedesDocumentId: current.id } : {}),
          originCollection: PGD_COLLECTIONS.documents,
          originDocumentId: generated.id,
        } as Partial<PgdDossierDocument>,
        now,
      );

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`,
        [PGD_COLLECTIONS.dossierDocuments, next.id, JSON.stringify(getDocumentPayload(next))],
      );

      const nextChecklist = markPgdDossierChecklistPresent(
        request.productGroup,
        request.dossierChecklist,
        {
          requirementCode: next.requirementCode,
          id: next.id,
          version: next.version,
        },
        now,
      );

      const nextRequest: PgdInspectionRequest = {
        ...request,
        dossierChecklist: nextChecklist,
        updatedAt: now,
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), request.id],
      );

      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_REQUEST',
        entityId: request.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Đưa biểu mẫu ${generated.fileName} vào checklist ${requirementCode} của ${request.requestCode}`,
        idSuffix: `attach-generated-${generated.id}-${requirementCode}`,
      });

      return next;
    });

    return jsonCreated({ dossierDocument: result });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
