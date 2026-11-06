import { NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/helpers';
import { jsonBadRequest, jsonConflict, jsonCreated, jsonError, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { getPcnStorageBucket, getPcnStorageClient, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { CertificationDossier, PcnDossierAttachment, PcnDossierWorkflowTask } from '@/types';
import { buildPcnSupplementaryDossierAttachment, buildPcnSupplementaryDossierMetadata } from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { buildActivityLog, validateActivityLogPayload } from '@/utils/activityLog';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';

const EDITABLE_NODE_TASK_STATUSES = new Set(['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED', 'COMPLETED']);
const SUPPORTED_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ dossierId: string }> }) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;
  const actor = getPcnSessionUser(req)!;
  if (!isPcnSystemManager(actor) && !actor.departmentScopes?.includes('PCN')) {
    return jsonForbidden('Tài khoản chưa được cấp phạm vi PCN.');
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonBadRequest('Yêu cầu phải là multipart/form-data.');
  }

  const file = formData.get('file') as File | null;
  const stageId = String(formData.get('stageId') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const supplementaryItemId = String(formData.get('supplementaryItemId') || '').trim();
  const originalName = String(file?.name || '').trim();
  const extension = originalName.toLowerCase().split('.').pop() || '';
  if (!stageId || stageId.length > 200 || title.length > 255 || description.length > 2000 || supplementaryItemId.length > 200) {
    return jsonBadRequest('Thiếu giai đoạn hoặc thông tin đầu mục phụ trợ PCN không hợp lệ.');
  }
  if (!file && (!title || supplementaryItemId)) {
    return jsonBadRequest(supplementaryItemId ? 'Cần chọn tệp để bổ sung vào đầu mục hiện có.' : 'Cần có tiêu đề cho đầu mục phụ trợ PCN.');
  }
  if (file && !SUPPORTED_FILE_EXTENSIONS.has(extension)) {
    return jsonBadRequest('Tệp phụ trợ PCN cần dùng PDF, DOCX hoặc ảnh được hỗ trợ.');
  }
  if (file && (file.size <= 0 || file.size > PCN_FILE_MAX_BYTES)) {
    return jsonBadRequest(`Kích thước tệp PCN phải từ 1 byte đến ${PCN_FILE_MAX_BYTES} byte.`);
  }

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  if (!dossierId) return jsonBadRequest('Thiếu mã hồ sơ PCN.');
  let uploadedBucketName: string | undefined;
  let uploadedObjectPath: string | undefined;

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
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; cần thu hồi có lý do trước khi bổ sung tệp.'), { statusCode: 409 });
      }

      const node = dossier.workflowSnapshot?.nodes.find((item) => item.id === stageId && item.active !== false);
      if (!node) throw Object.assign(new Error('Bước phụ trợ không thuộc workflow PCN của hồ sơ.'), { statusCode: 400 });
      const taskResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDossierWorkflowTasks'
           AND data->>'dossierId' = $1 AND data->>'nodeId' = $2
         LIMIT 1 FOR UPDATE`,
        [dossier.id, node.id],
      );
      const task = taskResult.rows[0] ? mapDocumentRow(taskResult.rows[0]) as PcnDossierWorkflowTask : undefined;
      if (!task || !EDITABLE_NODE_TASK_STATUSES.has(task.status)) {
        throw Object.assign(new Error('Bước PCN đang khóa theo workflow.'), { statusCode: 409 });
      }
      const actorUsername = String(actor.username || '').trim().toLowerCase();
      const ownerUsername = String(dossier.ownerUsername || '').trim().toLowerCase();
      const assignedUsername = String(task.assignedUsername || '').trim().toLowerCase();
      const intakeCreatorMayAttachB1 = node.id === 'intake' && String(dossier.intakeCreatedByUsername || '').trim().toLowerCase() === actorUsername;
      if (!isPcnSystemManager(actor) && ownerUsername !== actorUsername && assignedUsername !== actorUsername && !intakeCreatorMayAttachB1) {
        throw Object.assign(new Error('Bạn chưa được phân công xử lý bước PCN này.'), { statusCode: 403 });
      }
      const fieldCode = dossier.fieldCodes?.[0];
      if (!fieldCode) throw Object.assign(new Error('Hồ sơ PCN chưa có lĩnh vực để gắn tệp phụ trợ.'), { statusCode: 409 });
      const now = new Date().toISOString();
      const fileBuffer = file ? Buffer.from(await file.arrayBuffer()) : undefined;
      const sha256 = fileBuffer ? createHash('sha256').update(fileBuffer).digest('hex') : undefined;
      let attachment: ReturnType<typeof buildPcnSupplementaryDossierAttachment> | ReturnType<typeof buildPcnSupplementaryDossierMetadata>;
      let safeFileName = '';

      if (!file) {
        const id = `pcn-supplementary-item-${randomUUID()}`;
        attachment = buildPcnSupplementaryDossierMetadata({
          id,
          dossierId: dossier.id,
          fieldCode,
          stageId: node.id,
          stageLabel: node.label,
          title,
          description,
          createdAt: now,
        });
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [attachment.id, JSON.stringify(getDocumentPayload(attachment))],
        );
      } else {
        let itemId = supplementaryItemId;
        let supersedesAttachmentId: string | undefined;
        if (itemId) {
          const itemResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'dossierAttachments'
               AND data->>'dossierId' = $1 AND data->>'supplementaryStageId' = $2
               AND (data->>'supplementaryItemId' = $3 OR document_id = $3)
             ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [dossier.id, node.id, itemId],
          );
          const item = itemResult.rows[0] ? mapDocumentRow(itemResult.rows[0]) as PcnDossierAttachment : undefined;
          if (!item && !/^pcn-b1-[a-z0-9-]{1,100}$/i.test(itemId)) {
            throw Object.assign(new Error('Không tìm thấy đầu mục phụ trợ PCN để thêm phiên bản.'), { statusCode: 404 });
          }
          const latestFile = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'dossierAttachments'
               AND data->>'dossierId' = $1 AND data->>'supplementaryStageId' = $2
               AND (data->>'supplementaryItemId' = $3 OR document_id = $3)
               AND COALESCE(data->>'metadataOnly', 'false') <> 'true'
             ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [dossier.id, node.id, itemId],
          );
          const latest = latestFile.rows[0] ? mapDocumentRow(latestFile.rows[0]) as PcnDossierAttachment : undefined;
          safeFileName = sanitizePcnPathSegment(originalName);
          if (latest && latest.sha256 === sha256 && latest.fileName === safeFileName && latest.title === title && latest.description === description) {
            return { attachment: latest, idempotent: true as const };
          }
          supersedesAttachmentId = latest?.id;
        } else {
          itemId = `pcn-supplementary-item-${randomUUID()}`;
        }

        if (!fileBuffer || !sha256) throw Object.assign(new Error('Không đọc được byte của tệp PCN.'), { statusCode: 400 });
        const assetId = `pcn-file-${sha256.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
        safeFileName = safeFileName || sanitizePcnPathSegment(originalName);
        const attachmentId = `pcn-attachment-supplementary-${assetId}`;
        const bucketName = getPcnStorageBucket();
        const objectPath = `pcnFiles/dossierAttachments/${sanitizePcnPathSegment(dossier.id)}/${sanitizePcnPathSegment(node.id)}/${assetId}-${sha256}-${safeFileName}`;
        const mimeType = String(file.type || 'application/octet-stream').toLowerCase();
        uploadedBucketName = bucketName;
        uploadedObjectPath = objectPath;

        const storage = getPcnStorageClient();
        await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);
        await storage.uploadObject({ bucketName, objectPath, body: fileBuffer, mimeType });
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, 'dossierAttachments', $4, 'assetId', $5, $6, $7)`,
          [assetId, bucketName, objectPath, attachmentId, mimeType, fileBuffer.byteLength, sha256],
        );

        attachment = buildPcnSupplementaryDossierAttachment({
          dossierId: dossier.id,
          fieldCode,
          stageId: node.id,
          stageLabel: node.label,
          assetId,
          fileName: safeFileName,
          mimeType,
          byteSize: fileBuffer.byteLength,
          sha256,
          uploadedAt: now,
          title,
          description,
          supplementaryItemId: itemId,
          supersedesAttachmentId,
        });
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [attachment.id, JSON.stringify(getDocumentPayload(attachment))],
        );
      }

      const activityLog = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossier.id,
        entityLabel: dossier.dossierCode || dossier.id,
        actorUsername: actor.username,
        actorName: actor.name || 'Người dùng PCN',
        actorRole: actor.systemRole || actor.role,
        summary: file
          ? `Tải phiên bản ${safeFileName.slice(0, 120)} vào đầu mục phụ trợ ${title || attachment.title || ''} của bước ${node.label}`
          : `Tạo đầu mục phụ trợ ${title.slice(0, 120)} tại bước ${node.label}`,
        source: 'UI',
        groupId: dossier.id,
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

      return { attachment, activityLog };
    });

    return 'idempotent' in result && result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    if (uploadedBucketName && uploadedObjectPath) {
      await getPcnStorageClient().deleteObject({ bucketName: uploadedBucketName, objectPath: uploadedObjectPath }).catch(() => undefined);
    }
    const message = String(error?.message || error);
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(message);
    if (status === 409) return jsonConflict(message);
    return jsonError(message, status);
  }
}
