import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

import { withPgTransaction } from '@/lib/server/db';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { getPgdStorageBucket, getPgdStorageClient, isPgdStorageConfigured } from '@/lib/server/pgd-files';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import { writePgdActivity } from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import { PGD_COLLECTIONS, type PgdInspectionAssignment, type PgdInspectionCertificate, type PgdInspectionRequest } from '@/utils/pgdDomain';
import { getPgdAssignmentApprovalDenial } from '@/utils/pgdWorkflow';
import { hasPgdDossierCapability } from '@/utils/pgdDossierCapabilities';
import { validatePgdIssuanceAction, type PgdIssuanceInput } from '@/utils/pgdIssuance';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.certificates, 'write');
  if (mutationError) return mutationError;
  const actor = getPgdSessionUser(req)!;

  let input: PgdIssuanceInput;
  let requestId = '';
  let operationId = '';
  let file: File | undefined;
  let fileBuffer: Buffer | undefined;

  if (req.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return jsonBadRequest('Dữ liệu ký phát hành không hợp lệ.');
    requestId = String(form.get('requestId') || '').trim();
    operationId = String(form.get('operationId') || '').trim();
    file = form.get('file') instanceof File ? form.get('file') as File : undefined;
    const bytes = file ? Buffer.from(await file.arrayBuffer()) : Buffer.alloc(0);
    fileBuffer = bytes;
    input = {
      action: 'SIGN',
      issueDate: String(form.get('issueDate') || '').trim(),
      expiryDate: String(form.get('expiryDate') || '').trim(),
      fileName: String(file?.name || '').trim(),
      fileSize: bytes.byteLength,
      mimeType: String(file?.type || '').trim(),
      pdfHeaderValid: bytes.subarray(0, 5).toString('ascii') === '%PDF-',
    };
    if (!isPgdStorageConfigured()) return jsonServerError('Chưa cấu hình private storage PGD để lưu bản PDF ký cuối cùng.');
  } else {
    const body = await req.json().catch(() => ({}));
    requestId = String(body?.requestId || '').trim();
    operationId = String(body?.operationId || '').trim();
    const action = String(body?.action || '').trim().toUpperCase();
    if (action === 'DELIVER') input = { action, deliveredTo: String(body?.deliveredTo || '').trim() };
    else if (action === 'ARCHIVE') input = { action };
    else return jsonBadRequest('Thao tác phát hành PGD không hợp lệ.');
  }

  if (!requestId || !operationId || operationId.length > 120) return jsonBadRequest('Thiếu mã hồ sơ hoặc mã thao tác phát hành PGD.');
  let uploadedBucketName: string | undefined;
  let uploadedObjectPath: string | undefined;

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      if (request.workflowSchemaVersion !== 2 && request.workflowSnapshot?.workflowSchemaVersion !== 2) throw Object.assign(new Error('Phát hành B7 áp dụng cho hồ sơ theo workflow v2.'), { statusCode: 409 });

      const assignmentResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.assignments, requestId],
      );
      const assignment = assignmentResult.rows[0] ? mapDocumentRow(assignmentResult.rows[0]) as PgdInspectionAssignment : undefined;
      const manager = !getPgdAssignmentApprovalDenial('APPROVED', actor);
      const requiredCapability = input.action === 'ARCHIVE' ? 'ARCHIVE' : 'OFFICE_ISSUANCE';
      if (!manager && !hasPgdDossierCapability(assignment, actor.username, requiredCapability)) {
        throw Object.assign(new Error(`Tài khoản chưa được phân công capability ${requiredCapability} trên hồ sơ này.`), { statusCode: 403 });
      }

      const certificateResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.certificates, requestId],
      );
      if (!certificateResult.rows[0]) throw Object.assign(new Error('Không tìm thấy chứng thư PGD.'), { statusCode: 404 });
      const certificate = mapDocumentRow(certificateResult.rows[0]) as PgdInspectionCertificate;
      if ((certificate.issuanceOperationIds || []).includes(operationId)) return { request, certificate, idempotent: true };

      const denial = validatePgdIssuanceAction(request, certificate, input);
      if (denial) throw Object.assign(new Error(denial), { statusCode: 409 });

      const now = new Date().toISOString();
      const operationIds = [...(certificate.issuanceOperationIds || []), operationId].slice(-50);
      let nextRequest = request;
      let nextCertificate: PgdInspectionCertificate;

      if (input.action === 'SIGN') {
        if (!file || !fileBuffer) throw Object.assign(new Error('Cần tải lên bản PDF đã ký, in và đóng dấu.'), { statusCode: 400 });
        const checksum = createHash('sha256').update(fileBuffer).digest('hex');
        const assetId = `pgd-file-${checksum.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
        const bucketName = getPgdStorageBucket();
        const fileName = sanitizePcnPathSegment(file.name);
        const objectPath = `pgd/issuance/${sanitizePcnPathSegment(requestId)}/${assetId}-${checksum}-${fileName}`;
        const storage = getPgdStorageClient();
        await storage.ensurePrivateBucket(bucketName, 20 * 1024 * 1024);
        await storage.uploadObject({ bucketName, objectPath, body: fileBuffer, mimeType: 'application/pdf' });
        uploadedBucketName = bucketName;
        uploadedObjectPath = objectPath;
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, $4, $5, 'issuanceFileAssetId', 'application/pdf', $6, $7)`,
          [assetId, bucketName, objectPath, PGD_COLLECTIONS.certificates, certificate.id, fileBuffer.byteLength, checksum],
        );
        nextCertificate = {
          ...certificate,
          status: 'SIGNED',
          issuanceFileAssetId: assetId,
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          signedByUsername: actor.username,
          signedAt: now,
          issuanceOperationIds: operationIds,
          updatedAt: now,
        };
        nextRequest = { ...request, status: 'SIGNED', updatedAt: now };
      } else if (input.action === 'DELIVER') {
        nextCertificate = {
          ...certificate,
          deliveredAt: now,
          deliveredTo: input.deliveredTo.trim(),
          deliveredByUsername: actor.username,
          issuanceOperationIds: operationIds,
          updatedAt: now,
        };
        nextRequest = { ...request, status: 'RESULT_RETURNED', updatedAt: now };
      } else {
        nextCertificate = {
          ...certificate,
          archivistUsername: actor.username,
          archivedAt: now,
          issuanceOperationIds: operationIds,
          updatedAt: now,
        };
        nextRequest = { ...request, status: 'ARCHIVED', updatedAt: now };
      }

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.certificates, JSON.stringify(getDocumentPayload(nextCertificate)), certificate.id],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), requestId],
      );
      const summary = input.action === 'SIGN'
        ? `Đã ký và phát hành chứng thư ${request.requestCode}`
        : input.action === 'DELIVER'
          ? `Đã bàn giao kết quả ${request.requestCode} cho ${input.deliveredTo}`
          : `Đã lưu trữ hồ sơ ${request.requestCode}`;
      await writePgdActivity(client, actor, {
        action: 'STATUS_CHANGED',
        entityId: certificate.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary,
        idSuffix: `issuance-${operationId}`,
        notify: buildPgdNotificationDraft({ entityType: 'PGD_CERTIFICATE', action: 'STATUS_CHANGED', entityId: certificate.id, entityLabel: request.requestCode, requestCode: request.requestCode, previousStatus: request.status, nextStatus: nextRequest.status, actorName: actor.name || actor.username, targetUsernames: [assignment?.leadInspectorUsername, assignment?.technicalReviewerUsername, assignment?.leadershipUsername, assignment?.officeIssuanceUsername, assignment?.archivistUsername].filter((username): username is string => Boolean(username)) }),
      });
      return { request: nextRequest, certificate: nextCertificate };
    });
    return jsonOk(result);
  } catch (error: any) {
    if (uploadedBucketName && uploadedObjectPath) await getPgdStorageClient().deleteObject({ bucketName: uploadedBucketName, objectPath: uploadedObjectPath }).catch(() => undefined);
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
