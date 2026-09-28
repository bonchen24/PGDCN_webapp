import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { getPcnStorageClient, getPcnStorageBucket, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import { PcnTemplateAnnotationMapping, PcnTemplateDefinition } from '@/types';
import {
  getPcnTemplateRequiredPlaceholderKeys,
  toPcnTemplateRuntimeProjection,
} from '@/utils/pcnTemplateCatalog';
import { annotatePcnDocxTemplate } from '@/utils/pcnTemplateAnnotation';
import { buildPcnTemplateAssetId } from '@/utils/pcnTemplateImport';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  const { templateId: rawTemplateId } = await params;
  const templateId = decodeURIComponent(String(rawTemplateId || '')).trim();

  const bodyJson = await req.json().catch(() => ({}));
  const rawMappings = bodyJson?.mappings;

  if (!templateId || !Array.isArray(rawMappings) || rawMappings.length === 0 || rawMappings.length > 50) {
    return jsonBadRequest('Thiếu mã template hoặc danh sách mapping chú thích không hợp lệ.');
  }

  const mappings = rawMappings.map((item: any) => ({
    key: String(item?.key || ''),
    sourceText: String(item?.sourceText || ''),
    ...(item?.occurrence === undefined ? {} : { occurrence: Number(item.occurrence) }),
  })) as PcnTemplateAnnotationMapping[];

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const actor = getPcnSessionUser(req)!;
    const storage = getPcnStorageClient();
    const bucketName = getPcnStorageBucket();
    await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);

    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-template-asset:${templateId}`]);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [templateId],
      );
      if (existingResult.rows.length === 0) throw new Error('Không tìm thấy template PCN đã import để chú thích.');
      const existing = { ...(existingResult.rows[0].data || {}), id: existingResult.rows[0].document_id } as PcnTemplateDefinition;
      const runtimeExisting = toPcnTemplateRuntimeProjection(existing);

      if (runtimeExisting.format !== 'DOCX') throw new Error('Chỉ template DOCX mới có thể chú thích tự động; DOC legacy chỉ lưu tham chiếu.');
      if (runtimeExisting.status !== 'NEEDS_ANNOTATION') throw new Error('Template phải ở trạng thái NEEDS_ANNOTATION trước khi chú thích.');
      if (!runtimeExisting.fileAssetId || runtimeExisting.storageScope !== 'PCN_PRIVATE') throw new Error('Template chưa có asset private để chú thích.');

      const assetResult = await client.query(
        `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 LIMIT 1`,
        [existing.fileAssetId],
      );
      const sourceAsset = assetResult.rows[0];
      if (!sourceAsset
        || sourceAsset.source_collection !== 'pcnTemplateDefinitions'
        || sourceAsset.source_document_id !== existing.id
        || sourceAsset.source_json_path !== 'fileAssetId'
        || !String(sourceAsset.mime_type || '').toLowerCase().includes('wordprocessingml')) {
        throw new Error('Asset private của template không hợp lệ hoặc không còn khớp metadata.');
      }

      const source = await storage.downloadObject({ bucketName: sourceAsset.bucket_name, objectPath: sourceAsset.object_path });
      const annotated = annotatePcnDocxTemplate(source.body, mappings);
      const annotatedSha256 = createHash('sha256').update(annotated.bytes).digest('hex');
      const annotatedAssetId = buildPcnTemplateAssetId(annotatedSha256);
      const annotatedObjectPath = `pcnTemplates/${sanitizePcnPathSegment(existing.fieldCode)}/${sanitizePcnPathSegment(existing.id)}/${annotatedSha256}/annotated.docx`;

      const existingAnnotatedAssetResult = await client.query(
        `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 LIMIT 1`,
        [annotatedAssetId],
      );
      const existingAnnotatedAsset = existingAnnotatedAssetResult.rows[0];
      if (existingAnnotatedAsset && (
        String(existingAnnotatedAsset.sha256 || '').toLowerCase() !== annotatedSha256
        || existingAnnotatedAsset.source_collection !== 'pcnTemplateDefinitions'
        || existingAnnotatedAsset.source_document_id !== existing.id
        || existingAnnotatedAsset.source_json_path !== 'fileAssetId'
      )) {
        throw new Error('Asset DOCX chú thích trùng mã nhưng metadata không khớp.');
      }

      if (!existingAnnotatedAsset) {
        await storage.uploadObject({ bucketName, objectPath: annotatedObjectPath, body: annotated.bytes, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        uploadedObjects.push({ bucketName, objectPath: annotatedObjectPath });
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, 'pcnTemplateDefinitions', $4, 'fileAssetId', $5, $6, $7)`,
          [annotatedAssetId, bucketName, annotatedObjectPath, existing.id, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', annotated.bytes.length, annotatedSha256],
        );
      }

      const now = new Date().toISOString();
      const sourceOriginalFingerprint = runtimeExisting.sourceOriginalFingerprint || runtimeExisting.sourceFingerprint;
      const next: PcnTemplateDefinition = {
        ...runtimeExisting,
        status: 'NEEDS_ANNOTATION',
        approvedAt: undefined,
        placeholderKeys: annotated.placeholderKeys,
        requiredPlaceholderKeys: getPcnTemplateRequiredPlaceholderKeys(runtimeExisting),
        sourceOriginalFingerprint,
        sourceFingerprint: { ...runtimeExisting.sourceFingerprint, byteSize: annotated.bytes.length, sha256: annotatedSha256 },
        fileAssetId: annotatedAssetId,
        storageScope: 'PCN_PRIVATE',
        annotation: {
          sourceAssetId: existing.fileAssetId,
          sourceSha256: String(sourceAsset.sha256 || runtimeExisting.sourceFingerprint.sha256 || '').toLowerCase(),
          appliedAt: now,
          appliedBy: actor.username,
          mappings: annotated.appliedMappings,
        },
      };

      const sameAnnotation = existing.fileAssetId === next.fileAssetId
        && JSON.stringify(existing.placeholderKeys || []) === JSON.stringify(next.placeholderKeys)
        && JSON.stringify(existing.annotation?.mappings || []) === JSON.stringify(next.annotation?.mappings || []);
      if (sameAnnotation) return { template: runtimeExisting, activityLog: undefined };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1`,
        [existing.id, JSON.stringify(getDocumentPayload(next))],
      );

      const log = buildActivityLog({
        action: 'CONFIGURED',
        entityType: 'PCN_TEMPLATE',
        entityId: next.id,
        entityLabel: next.displayName,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: `Chú thích DOCX template ${next.displayName}`,
        changes: diffActivityFields(runtimeExisting, next, ['status', 'approvedAt', 'placeholderKeys', 'requiredPlaceholderKeys', 'sourceFingerprint', 'sourceOriginalFingerprint', 'fileAssetId', 'annotation']),
        source: 'UI',
      });
      const validationError = validateActivityLogPayload(log);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );

      return { template: next, activityLog: log };
    });

    return jsonOk({ ...result, template: toPcnTemplateRuntimeProjection(result.template) });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      await getPcnStorageClient().deleteObject(uploaded).catch(() => undefined);
    }
    console.error('PCN template annotation error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const status = normalizedMessage.includes('không tìm thấy')
      ? 404
      : normalizedMessage.includes('không hợp lệ') || normalizedMessage.includes('không trống') || normalizedMessage.includes('không duy nhất') || normalizedMessage.includes('placeholder') || normalizedMessage.includes('doc legacy')
        ? 400
        : 409;
    return jsonError(message, status);
  }
}
