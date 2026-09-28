import { NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, PGD_COLLECTIONS, requirePgdCollectionMutation } from '@/lib/server/pgd';
import {
  getPgdStorageBucket,
  getPgdStorageClient,
  isPgdStorageConfigured,
} from '@/lib/server/storage';
import { jsonBadRequest, jsonCreated, jsonError, jsonNotFound } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import {
  PgdDocumentTemplate,
  PgdDocumentTemplateFormat,
  PgdDocumentTemplateKind,
} from '@/utils/pgdDocumentTemplates';
import {
  PgdFieldInspection,
  PgdGeneratedDocument,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
} from '@/utils/pgdDomain';
import {
  PgdCaseEvent,
  PgdDossierIndex,
  PgdFieldActivityLog,
  PgdInspectionPlan,
  PgdLabResultReview,
} from '@/utils/pgdArtifacts';
import { buildPgdDocumentContext, buildPgdDocumentOutput } from '@/utils/pgdDocumentGeneration';
import {
  assertPgdRequestStationMutationAllowed,
  getPgdDocumentTemplate,
  getPgdGeneratedDocumentStationKey,
  isPgdDocumentTemplateRecordAllowed,
  normalizePgdDocumentTemplate,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export async function POST(req: NextRequest) {
  const permError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.documents, 'write');
  if (permError) return permError;

  const actor = getPgdSessionUser(req)!;
  const bodyJson = await req.json().catch(() => ({}));
  const requestId = String(bodyJson?.requestId || '').trim();
  const kind = String(bodyJson?.kind || '').trim().toUpperCase() as PgdDocumentTemplateKind;
  const format = String(bodyJson?.format || '').trim().toUpperCase() as PgdDocumentTemplateFormat;

  if (!requestId || !kind || !['DOCX', 'PDF'].includes(format)) {
    return jsonBadRequest('Cần có hồ sơ PGD, loại template và định dạng DOCX/PDF.');
  }

  if (
    bodyJson?.cellValues !== undefined &&
    !Array.isArray(bodyJson.cellValues) &&
    (!bodyJson.cellValues || typeof bodyJson.cellValues !== 'object')
  ) {
    return jsonBadRequest('Dữ liệu cell PGD phải là object hoặc danh sách key/value.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để sinh tài liệu.'), { statusCode: 404 });
      }
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestStationMutationAllowed(request, getPgdGeneratedDocumentStationKey(kind));

      const sourceRows = await Promise.all([
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.assignments, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.fieldInspections, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY document_id`, [PGD_COLLECTIONS.samples, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.labRequests, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.labResults, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.reports, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.certificates, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.inspectionPlans, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY data->>'occurredAt', document_id`, [PGD_COLLECTIONS.caseEvents, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.fieldActivityLogs, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.labResultReviews, requestId]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.dossierIndexes, requestId]),
      ]);

      let template: PgdDocumentTemplate | undefined;
      const requestedTemplateId = String(bodyJson?.templateId || '').trim();
      if (requestedTemplateId) {
        const templateResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
          [PGD_COLLECTIONS.documentTemplates, requestedTemplateId],
        );
        if (templateResult.rows[0]) {
          const candidate = mapDocumentRow(templateResult.rows[0]);
          if (isPgdDocumentTemplateRecordAllowed(candidate)) template = normalizePgdDocumentTemplate(candidate);
        }
      }
      template = template || getPgdDocumentTemplate(kind, request.productGroup, request.method);
      if (!template || template.kind !== kind || template.status === 'RETIRED' || !template.active) {
        throw Object.assign(new Error('Không tìm thấy template tài liệu PGD phù hợp.'), { statusCode: 404 });
      }

      const now = new Date().toISOString();
      const context = buildPgdDocumentContext({
        template,
        request,
        assignment: sourceRows[0].rows[0] ? mapDocumentRow(sourceRows[0].rows[0]) as PgdInspectionAssignment : undefined,
        inspectionPlan: sourceRows[7].rows[0] ? mapDocumentRow(sourceRows[7].rows[0]) as PgdInspectionPlan : undefined,
        caseEvents: sourceRows[8].rows.map((row: any) => mapDocumentRow(row) as PgdCaseEvent),
        fieldActivityLogs: sourceRows[9].rows.map((row: any) => mapDocumentRow(row) as PgdFieldActivityLog),
        fieldInspection: sourceRows[1].rows[0] ? mapDocumentRow(sourceRows[1].rows[0]) as PgdFieldInspection : undefined,
        samples: sourceRows[2].rows.map((row: any) => mapDocumentRow(row)),
        labRequests: sourceRows[3].rows.map((row: any) => mapDocumentRow(row)),
        labResults: sourceRows[4].rows.map((row: any) => mapDocumentRow(row)),
        labResultReview: sourceRows[10].rows[0] ? mapDocumentRow(sourceRows[10].rows[0]) as PgdLabResultReview : undefined,
        dossierIndex: sourceRows[11].rows[0] ? mapDocumentRow(sourceRows[11].rows[0]) as PgdDossierIndex : undefined,
        report: sourceRows[5].rows[0] ? mapDocumentRow(sourceRows[5].rows[0]) as PgdInspectionReport : undefined,
        certificate: sourceRows[6].rows[0] ? mapDocumentRow(sourceRows[6].rows[0]) as PgdInspectionCertificate : undefined,
        cellValues: bodyJson?.cellValues || {},
        now,
      });

      const output = await buildPgdDocumentOutput(context, format);
      const documentId = `pgd-document-${randomUUID()}`;
      let fileAssetId: string | undefined;

      if (isPgdStorageConfigured()) {
        const bucketName = getPgdStorageBucket();
        const objectPath = `pgd/documents/${requestId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'request'}/${documentId}.${format === 'DOCX' ? 'docx' : 'pdf'}`;
        const storage = getPgdStorageClient();
        await storage.ensurePrivateBucket(bucketName, 20 * 1024 * 1024);
        await storage.uploadObject({ bucketName, objectPath, body: output.bytes, mimeType: output.mimeType });
        fileAssetId = `pgd-file-${randomUUID()}`;
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, $4, $5, 'output', $6, $7, $8)`,
          [fileAssetId, bucketName, objectPath, PGD_COLLECTIONS.documents, documentId, output.mimeType, output.bytes.length, createHash('sha256').update(output.bytes).digest('hex')],
        );
      }

      const metadata: PgdGeneratedDocument = {
        id: documentId,
        domain: 'pgd',
        requestId,
        requestCode: request.requestCode,
        kind: template.kind,
        templateId: template.id,
        templateCode: template.code,
        templateVersion: template.version,
        templateSnapshot: output.templateSnapshot,
        cellValues: context.cellValues,
        format,
        fileName: output.fileName,
        mimeType: output.mimeType,
        byteSize: output.bytes.length,
        sha256: createHash('sha256').update(output.bytes).digest('hex'),
        ...(fileAssetId ? { fileAssetId } : {}),
        contextHash: output.contextHash,
        sourceCollection: PGD_COLLECTIONS.requests,
        sourceDocumentId: requestId,
        generatedByUsername: actor.username,
        generatedAt: now,
        status: request.status === 'SIGNED' || request.status === 'RESULT_RETURNED' || request.status === 'ARCHIVED' ? 'ISSUED' : 'DRAFT',
        ...(request.status === 'SIGNED' || request.status === 'RESULT_RETURNED' || request.status === 'ARCHIVED' ? { lockedAt: now } : {}),
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`,
        [PGD_COLLECTIONS.documents, documentId, JSON.stringify(getDocumentPayload(metadata))],
      );

      await writePgdActivity(client, actor, {
        action: 'CREATED',
        entityId: documentId,
        entityLabel: output.fileName,
        requestCode: request.requestCode,
        summary: `Sinh ${format} từ template PGD ${template.code} cho ${request.requestCode}`,
        idSuffix: `generated-document-${documentId}`,
      });

      return { document: metadata, contentBase64: output.bytes.toString('base64') };
    });

    return jsonCreated(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || 400);
  }
}
