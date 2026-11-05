import { NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation, requirePgdSession } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonCreated, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import { getPgdStorageBucket, getPgdStorageClient, isPgdStorageConfigured } from '@/lib/server/pgd-files';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  buildPgdDossierDocument,
  getPgdDossierRequirementsWithCustom,
  getPgdDossierRequirementStationKeyForSnapshot,
  markPgdDossierChecklistPresent,
  PgdDossierDocument,
} from '@/utils/pgdDossier';
import {
  assertPgdRequestEvidenceMutationAllowed,
  getPgdOperationalStepAccess,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import type { PgdOperationalStationKey } from '@/utils/pgdWorkflow';

const PGD_SUPPLEMENTARY_STAGE_STATIONS: Record<string, PgdOperationalStationKey> = {
  intake: 'INTAKE_CAPABILITY',
  'review-assignment': 'PREPARATION',
  plan: 'PREPARATION',
  execution: 'FIELD_SAMPLING',
  'results-evaluation': 'LAB_RESULTS',
  'reporting-approval': 'REPORT_APPROVAL_RETURN',
  'issuance-archive': 'REPORT_APPROVAL_RETURN',
};

function buildPgdDossierMetadataChecksum(input: {
  requestId: string;
  requirementCode: string;
  title: string;
  fileName: string;
  version: number;
  documentNumber?: string;
  documentDate?: string;
  note?: string;
}): string {
  const seed = {
    requestId: input.requestId,
    requirementCode: input.requirementCode,
    title: input.title,
    fileName: input.fileName,
    version: input.version,
    documentNumber: input.documentNumber || '',
    documentDate: input.documentDate || '',
    note: input.note || '',
  };
  return createHash('sha256').update(JSON.stringify(seed)).digest('hex');
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const { requestId: rawRequestId } = await params;
    const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

    const requestResult = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
      [PGD_COLLECTIONS.requests, requestId],
    );
    if (!requestResult.rows[0]) {
      return jsonNotFound('Không tìm thấy hồ sơ PGD.');
    }
    const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
    const documentResult = await pool.query(
      `SELECT document_id, data
         FROM app_documents
        WHERE collection_name = $1
          AND data->>'requestId' = $2
          AND data->>'domain' = 'pgd'
        ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC`,
      [PGD_COLLECTIONS.dossierDocuments, request.id],
    );
    return jsonOk({
      dossierDocuments: documentResult.rows.map((row: any) => mapDocumentRow(row)) as PgdDossierDocument[],
      requirements: getPgdDossierRequirementsWithCustom(request.productGroup, request.workflowSnapshot?.requirementDefinitions || [], request.workflowSnapshot?.stages || []),
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.dossierDocuments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonBadRequest('Dữ liệu biểu mẫu không hợp lệ.');
  }

  const file = formData.get('file') as File | null;
  const requirementCode = String(formData.get('requirementCode') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const supplementaryStageId = String(formData.get('supplementaryStageId') || '').trim();
  const documentNumber = String(formData.get('documentNumber') || '').trim();
  const documentDate = String(formData.get('documentDate') || '').trim();
  const note = String(formData.get('note') || '').trim();
  const requestedFileName = String(formData.get('fileName') || '').trim();
  const fileName = file?.name
    ? sanitizePcnPathSegment(file.name)
    : sanitizePcnPathSegment(requestedFileName || `${requirementCode || 'pgd-dossier'}.meta`);

  const isSupplementary = Boolean(supplementaryStageId);
  const allowedSupplementaryExtensions = /\.(?:pdf|docx|png|jpe?g|gif|webp|avif)$/i;
  if (!requestId) {
    return jsonBadRequest('Thiếu mã hồ sơ PGD.');
  }
  if (isSupplementary && !file && !title) return jsonBadRequest('Cần có tiêu đề cho đầu mục phụ trợ PGD.');
  if (isSupplementary && requirementCode && !requirementCode.startsWith(`PGD_SUPPLEMENTARY_${supplementaryStageId.toUpperCase().replace(/-/g, '_')}_`)) {
    return jsonBadRequest('Đầu mục phụ trợ không thuộc giai đoạn PGD đã chọn.');
  }
  if (!isSupplementary && (!requirementCode || !title)) {
    return jsonBadRequest('Cần có requestId, requirementCode và tiêu đề chứng từ PGD.');
  }
  if (isSupplementary && (!PGD_SUPPLEMENTARY_STAGE_STATIONS[supplementaryStageId] || (file && !allowedSupplementaryExtensions.test(file.name)))) {
    return jsonBadRequest('Tệp phụ trợ PGD cần thuộc giai đoạn hợp lệ và dùng định dạng PDF, DOCX hoặc ảnh được hỗ trợ.');
  }
  if (isSupplementary && file && file.size <= 0) return jsonBadRequest('Tệp phụ trợ PGD không được để trống.');
  if (file && !isPgdStorageConfigured()) {
    return jsonServerError('Private Storage PGD chưa được cấu hình; hiện chỉ cho phép lưu metadata chứng từ, chưa thể nhận byte file.');
  }

  let uploadedBucketName: string | undefined;
  let uploadedObjectPath: string | undefined;

  try {
    const persisted = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để lưu chứng từ.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);

      const requirements = getPgdDossierRequirementsWithCustom(request.productGroup, request.workflowSnapshot?.requirementDefinitions || [], request.workflowSnapshot?.stages || []);
      const requirement = isSupplementary ? undefined : requirements.find((item) => item.code === requirementCode);
      if (!isSupplementary && !requirement) {
        throw Object.assign(new Error('Mã yêu cầu checklist PGD không thuộc nhóm sản phẩm của hồ sơ.'), { statusCode: 400 });
      }
      const resolvedRequirementCode = isSupplementary
        ? requirementCode || `PGD_SUPPLEMENTARY_${supplementaryStageId.toUpperCase().replace(/-/g, '_')}_${randomUUID()}`
        : requirementCode;
      const requirementStageLabel = requirement && requirement.stageLabel;
      const effectiveRequired = requirement
        ? request.dossierChecklist?.find((item) => item.requirementCode === requirementCode)?.required ?? requirement.required
        : false;
      const targetStationKey = isSupplementary
        ? PGD_SUPPLEMENTARY_STAGE_STATIONS[supplementaryStageId]
        : getPgdDossierRequirementStationKeyForSnapshot(requirement!.code, requirement!.customDefinition?.businessModuleKey, request.workflowSnapshot?.stages);
      const requirementAccess = getPgdOperationalStepAccess({
        status: request.status,
        targetStationKey,
      });
      if (!requirementAccess.editable) {
        throw Object.assign(new Error(requirementAccess.reason || 'Checklist PGD đang bị khóa theo trạm hồ sơ.'), { statusCode: 409 });
      }

      const currentResult = await client.query(
        `SELECT document_id, data
           FROM app_documents
          WHERE collection_name = $1
            AND data->>'requestId' = $2
            AND data->>'requirementCode' = $3
            AND data->>'domain' = 'pgd'
          ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC
          LIMIT 1
          FOR UPDATE`,
        [PGD_COLLECTIONS.dossierDocuments, request.id, resolvedRequirementCode],
      );
      const current = currentResult.rows[0] ? (mapDocumentRow(currentResult.rows[0]) as PgdDossierDocument) : undefined;
      if (isSupplementary && requirementCode && (!current || current.supplementaryStageId !== supplementaryStageId)) {
        throw Object.assign(new Error('Không tìm thấy đầu mục phụ trợ trong giai đoạn PGD đã chọn.'), { statusCode: 404 });
      }
      const resolvedTitle = isSupplementary ? title || current?.title || `Tệp phụ trợ · ${fileName}` : title;
      const version = (Number(current?.version) || 0) + 1;
      const documentId = `pgd-dossier-document-${randomUUID()}`;
      const now = new Date().toISOString();

      let fileBuffer: Buffer | undefined;
      if (file) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
      }

      const checksum = fileBuffer
        ? createHash('sha256').update(fileBuffer).digest('hex')
        : buildPgdDossierMetadataChecksum({
            requestId: request.id,
            requirementCode: resolvedRequirementCode,
            title: resolvedTitle,
            fileName,
            version,
            documentNumber,
            documentDate,
            note,
          });

      let fileAssetId: string | undefined;
      let mimeType: string | undefined;
      let byteSize: number | undefined;

      if (file && fileBuffer) {
        const storage = getPgdStorageClient();
        const bucketName = getPgdStorageBucket();
        const assetId = `pgd-file-${checksum.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
        const safeFileName = sanitizePcnPathSegment(fileName);
        const objectPath = `pgd/dossierDocuments/${sanitizePcnPathSegment(request.id)}/${sanitizePcnPathSegment(resolvedRequirementCode)}/${assetId}-${checksum}-${safeFileName}`;
        mimeType = String(file.type || 'application/octet-stream').toLowerCase();
        byteSize = fileBuffer.byteLength;

        await storage.ensurePrivateBucket(bucketName, 20 * 1024 * 1024);
        await storage.uploadObject({ bucketName, objectPath, body: fileBuffer, mimeType });
        uploadedBucketName = bucketName;
        uploadedObjectPath = objectPath;

        try {
          await client.query(
            `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
             VALUES ($1, $2, $3, $4, $5, 'fileAssetId', $6, $7, $8)`,
            [assetId, bucketName, objectPath, PGD_COLLECTIONS.dossierDocuments, documentId, mimeType, byteSize, checksum],
          );
        } catch (error) {
          await storage.deleteObject({ bucketName, objectPath }).catch(() => undefined);
          throw error;
        }
        fileAssetId = assetId;
      }

      if (!isSupplementary && requirement?.customDefinition && effectiveRequired && !fileAssetId) {
        throw Object.assign(new Error('Yêu cầu custom bắt buộc phải có tệp private hợp lệ trước khi xác nhận.'), { statusCode: 400 });
      }

      const next = buildPgdDossierDocument(
        {
          id: documentId,
          requestId: request.id,
          requirementCode: resolvedRequirementCode,
          title: resolvedTitle,
          fileName,
          version,
          checksum,
          uploadedByUsername: actor.username,
          ...(documentNumber ? { documentNumber } : {}),
          ...(documentDate ? { documentDate } : {}),
          ...(note ? { note } : {}),
          ...(fileAssetId ? { fileAssetId } : {}),
          ...(mimeType ? { mimeType } : {}),
          ...(byteSize !== undefined ? { byteSize } : {}),
          ...(current?.id ? { supersedesDocumentId: current.id } : {}),
          ...(isSupplementary ? { supplementaryStageId } : {}),
        } as Partial<PgdDossierDocument>,
        now,
      );

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`,
        [PGD_COLLECTIONS.dossierDocuments, next.id, JSON.stringify(getDocumentPayload(next))],
      );

      let nextRequest = request;
      if (!isSupplementary) {
        const nextChecklist = markPgdDossierChecklistPresent(
          request.productGroup,
          request.dossierChecklist,
          {
            requirementCode: next.requirementCode,
            id: next.id,
            version: next.version,
          },
          now,
          requirement!.customDefinition ? 'UPLOADED' : 'PRESENT',
        );

        nextRequest = { ...request, dossierChecklist: nextChecklist, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
          [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), request.id],
        );
      }

      await writePgdActivity(client, actor, {
        action: 'CREATED',
        entityType: 'PGD_REQUEST',
        entityId: request.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: isSupplementary
          ? file
            ? `Tải lên tệp phụ trợ ${fileName} cho giai đoạn ${supplementaryStageId} của ${request.requestCode}`
            : `Tạo đầu mục phụ trợ ${resolvedTitle} cho giai đoạn ${supplementaryStageId} của ${request.requestCode}`
          : [`Tải lên chứng từ ${fileName} cho mục ${requirement?.title || title} của ${request.requestCode}`, requirementStageLabel ? `Giai đoạn: ${requirementStageLabel}` : ''].filter(Boolean).join(' · '),
        idSuffix: `dossier-doc-${next.id}`,
      });

      return { dossierDocument: next, ...(isSupplementary ? {} : { request: nextRequest }) };
    });

    return jsonCreated(persisted);
  } catch (error: any) {
    if (uploadedBucketName && uploadedObjectPath) {
      await getPgdStorageClient().deleteObject({ bucketName: uploadedBucketName, objectPath: uploadedObjectPath }).catch(() => undefined);
    }
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
