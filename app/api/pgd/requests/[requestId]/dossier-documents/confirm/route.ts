import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonNotFound, jsonOk } from '@/lib/server/response';
import { assertPgdRequestEvidenceMutationAllowed, assertPgdRequestStationMutationAllowed, writePgdActivity } from '@/lib/server/pgd-operations';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  getPgdDossierRequirementsWithCustom,
  getPgdDossierRequirementStationKey,
  markPgdDossierChecklistPresent,
  PgdDossierDocument,
} from '@/utils/pgdDossier';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.dossierDocuments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
  const body = (await req.json().catch(() => ({}))) || {};
  const requirementCode = String(body?.requirementCode || '').trim();
  if (!requestId || !requirementCode) return jsonBadRequest('Cần có hồ sơ và mã mục checklist cần xác nhận.');

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

      const requirement = getPgdDossierRequirementsWithCustom(request.productGroup, request.workflowSnapshot?.requirementDefinitions || [])
        .find((item) => item.code === requirementCode);
      if (!requirement) throw Object.assign(new Error('Mục checklist không thuộc snapshot của hồ sơ PGD.'), { statusCode: 400 });
      if (!requirement.customDefinition) throw Object.assign(new Error('Chỉ mục tài liệu tự định nghĩa cần xác nhận riêng.'), { statusCode: 400 });
      assertPgdRequestStationMutationAllowed(request, getPgdDossierRequirementStationKey(requirement.code, requirement.customDefinition.businessModuleKey));

      const currentResult = await client.query(
        `SELECT document_id, data FROM app_documents
          WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'requirementCode' = $3 AND data->>'domain' = 'pgd'
          ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC
          LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.dossierDocuments, request.id, requirementCode],
      );
      if (!currentResult.rows[0]) throw Object.assign(new Error('Chưa có tài liệu hiện hành để xác nhận.'), { statusCode: 409 });
      const current = mapDocumentRow(currentResult.rows[0]) as PgdDossierDocument;
      if (!current.fileAssetId) throw Object.assign(new Error('Cần có tệp private hiện hành trước khi xác nhận mục checklist.'), { statusCode: 409 });

      const checklistItem = (request.dossierChecklist || []).find((item) => item.requirementCode === requirementCode);
      if (!checklistItem || !['UPLOADED', 'GENERATED', 'CONFIRMED'].includes(checklistItem.status)) {
        throw Object.assign(new Error('Trạng thái checklist không cho phép xác nhận tài liệu này.'), { statusCode: 409 });
      }
      if (
        (checklistItem.currentDocumentId && checklistItem.currentDocumentId !== current.id)
        || (checklistItem.currentDocumentVersion && checklistItem.currentDocumentVersion !== current.version)
      ) {
        throw Object.assign(new Error('Tài liệu đã thay đổi; hãy tải lại hồ sơ rồi xác nhận bản hiện hành.'), { statusCode: 409 });
      }

      const assetResult = await client.query(
        `SELECT id, source_collection, source_document_id, source_json_path, byte_size, sha256
           FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [current.fileAssetId],
      );
      const asset = assetResult.rows[0];
      const expectedCollection = current.originCollection || PGD_COLLECTIONS.dossierDocuments;
      const expectedDocumentId = current.originDocumentId || current.id;
      const expectedJsonPath = current.originCollection === PGD_COLLECTIONS.documents ? 'output' : 'fileAssetId';
      if (
        !asset
        || String(asset.source_collection || '') !== expectedCollection
        || String(asset.source_document_id || '') !== expectedDocumentId
        || String(asset.source_json_path || '') !== expectedJsonPath
        || String(asset.sha256 || '').toLowerCase() !== String(current.checksum || '').toLowerCase()
        || Number(asset.byte_size) !== Number(current.byteSize)
      ) {
        throw Object.assign(new Error('Tệp hiện hành thiếu provenance hợp lệ hoặc checksum không khớp.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const dossierChecklist = markPgdDossierChecklistPresent(
        request.productGroup,
        request.dossierChecklist,
        { requirementCode: current.requirementCode, id: current.id, version: current.version },
        now,
        'CONFIRMED',
      );
      const nextRequest: PgdInspectionRequest = { ...request, dossierChecklist, updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), request.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_REQUEST',
        entityId: request.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Xác nhận tệp hiện hành cho mục checklist ${requirementCode} của ${request.requestCode}`,
        idSuffix: `confirm-dossier-document-${current.id}`,
      });
      return { request: nextRequest, dossierDocument: current };
    });
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
