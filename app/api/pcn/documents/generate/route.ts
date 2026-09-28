import { canProcessPcnGeneratedDocument } from '@/utils/pcnWorkflowStages';
import { getPcnDocumentContextConflict } from '@/utils/pcnDocumentFreshness';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getPcnStorageClient, getPcnStorageBucket, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import {
  CertificationDossier,
  CertificationProposal,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnGeneratedDocument,
  PcnGeneratedDocumentFormat,
  PcnGeneratedDocumentKind,
  PcnSampleLot,
  PcnSampleRoute,
  OutboundLabRequest,
} from '@/types';
import {
  buildPcnAssignmentFormDocx,
  buildPcnAssignmentFormPdf,
  buildPcnDossierCoverDocx,
  buildPcnDossierCoverPdf,
  buildPcnDossierDocumentContext,
  buildPcnEvaluationPlanDocx,
  buildPcnEvaluationPlanPdf,
  buildPcnEvaluationReportDocx,
  buildPcnEvaluationReportPdf,
  buildPcnFieldInspectionDocx,
  buildPcnFieldInspectionPdf,
  buildPcnLabRequestDocx,
  buildPcnLabRequestPdf,
  buildPcnProposalFormDocx,
  buildPcnProposalFormPdf,
  buildPcnProposalSummaryDocx,
  buildPcnProposalSummaryPdf,
  buildPcnSampleCodingDocx,
  buildPcnSampleCodingPdf,
  buildPcnSampleHandoverDocx,
  buildPcnSampleHandoverPdf,
  buildPcnSampleReturnDocx,
  buildPcnSampleReturnPdf,
  buildPcnSampleTakingDocx,
  buildPcnSampleTakingPdf,
  getPcnDocumentSourceUpdatedAt,
} from '@/utils/pcnDocumentGeneration';
import { renderPcnOperationalTemplateDocx } from '@/utils/pcnOperationalTemplateGeneration';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Sinh tài liệu PCN chỉ khả dụng trong profile PCN.');
  }

  const user = getPcnSessionUser(req);
  if (!user) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  const bodyJson = await req.json().catch(() => ({}));
  const dryRun = bodyJson?.dryRun === true;
  if (!dryRun) {
    const authError = requirePcnMutation(req);
    if (authError) return authError;
  }

  const dossierId = String(bodyJson?.dossierId || '').trim();
  const kind = String(bodyJson?.kind || 'DOSSIER_COVER').trim().toUpperCase() as PcnGeneratedDocumentKind;
  const sampleRouteId = String(bodyJson?.sampleRouteId || '').trim();
  const labRequestId = String(bodyJson?.labRequestId || '').trim();
  const expectedContextHash = String(bodyJson?.expectedContextHash || '').trim();
  const requestedFormats = Array.isArray(bodyJson?.formats) && bodyJson.formats.length > 0
    ? bodyJson.formats
    : ['DOCX', 'PDF'];
  const invalidFormat = requestedFormats.some((format: unknown) => !['DOCX', 'PDF'].includes(String(format).trim().toUpperCase()));
  const formats = Array.from(new Set(requestedFormats.map((format: unknown) => String(format).trim().toUpperCase()))) as PcnGeneratedDocumentFormat[];

  if (
    !dossierId ||
    !['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST'].includes(kind) ||
    ((kind === 'SAMPLE_TAKING' || kind === 'SAMPLE_HANDOVER' || kind === 'SAMPLE_RETURN' || kind === 'SAMPLE_CODING') && !sampleRouteId) ||
    (kind === 'LAB_REQUEST' && !labRequestId) ||
    invalidFormat ||
    formats.length === 0 ||
    (expectedContextHash && !/^[a-f0-9]{64}$/i.test(expectedContextHash))
  ) {
    return jsonBadRequest('Thiếu mã hồ sơ hoặc định dạng tài liệu PCN không hợp lệ.');
  }

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const storage = dryRun ? undefined : getPcnStorageClient();
    const bucketName = dryRun ? '' : getPcnStorageBucket();
    if (storage) await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);

    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1${dryRun ? '' : ' FOR UPDATE'}`,
        [dossierId],
      );
      if (dossierResult.rows.length === 0) throw new Error('Không tìm thấy hồ sơ cần sinh tài liệu.');
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      if (!dryRun && !canProcessPcnGeneratedDocument(dossier, kind)) {
        throw Object.assign(new Error('Biểu mẫu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      const proposalId = String(dossier.proposalId || '').trim();
      if (!proposalId) throw new Error('Hồ sơ chưa có Đề nghị liên kết để sinh tài liệu.');

      const proposalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals' AND document_id = $1
         LIMIT 1${dryRun ? '' : ' FOR UPDATE'}`,
        [proposalId],
      );
      if (proposalResult.rows.length === 0) throw new Error('Không tìm thấy Đề nghị liên kết với hồ sơ.');
      const proposal = mapDocumentRow(proposalResult.rows[0]) as CertificationProposal;

      const fieldCodes = Array.isArray(dossier.fieldCodes)
        ? dossier.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
        : [];

      const [fieldsResult, requirementsResult, documentsResult, attachmentsResult, sampleLotsResult, sampleRoutesResult, labRequestsResult] = await Promise.all([
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnCertificationFields' AND data->>'code' = ANY($1::text[])`,
          [fieldCodes],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnDocumentRequirements'
             AND COALESCE((data->>'active')::boolean, false) = true
             AND data->>'fieldCode' = ANY($1::text[])`,
          [fieldCodes],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleLots' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes'`,
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'labRequests' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
      ]);

      const fields = fieldsResult.rows.map(mapDocumentRow) as PcnCertificationField[];
      const documentRequirements = requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[];
      const documents = documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[];
      const attachments = attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[];
      const sampleLots = sampleLotsResult.rows.map(mapDocumentRow) as PcnSampleLot[];
      const sampleRoutes = sampleRoutesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
      const labRequests = labRequestsResult.rows.map(mapDocumentRow) as OutboundLabRequest[];

      const context = buildPcnDossierDocumentContext({
        dossier,
        proposal,
        fields,
        documents,
        documentRequirements,
        attachments,
        sampleLots,
        sampleRoutes,
        labRequests,
        ...(['SAMPLE_TAKING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'SAMPLE_CODING'].includes(kind) ? { sampleRouteId } : {}),
        ...(kind === 'LAB_REQUEST' ? { labRequestId } : {}),
      });

      const contextConflict = getPcnDocumentContextConflict(expectedContextHash || undefined, context.contextHash);
      if (contextConflict) throw Object.assign(new Error(contextConflict.message), { statusCode: 409, code: contextConflict.code });
      if (dryRun) return { context, documents: [], activityLogs: [] };
      if (!storage) throw new Error('Storage PCN chưa được cấu hình để sinh tài liệu.');

      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnGeneratedDocuments'
           AND data->>'dossierId' = $1
           AND data->>'kind' = $3
           AND data->>'contextHash' = $2`,
        [dossier.id, context.contextHash, kind],
      );

      const existingByFormat = new Map<string, PcnGeneratedDocument>(
        existingResult.rows.map((row: any) => [String(row.data?.format || '').toUpperCase(), mapDocumentRow(row) as PcnGeneratedDocument]),
      );
      const generatedDocuments: PcnGeneratedDocument[] = [];
      const createdActivityLogs: ReturnType<typeof buildActivityLog>[] = [];
      const generatedAt = new Date().toISOString();
      let createdAny = false;
      const safeDossierId = sanitizePcnPathSegment(dossier.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 36) || 'dossier';
      const safeDossierCode = sanitizePcnPathSegment(dossier.dossierCode || dossier.id).toLowerCase();

      for (const format of formats) {
        const existing = existingByFormat.get(format);
        if (existing?.fileAssetId) {
          const existingAssetResult = await client.query(
            `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
             FROM file_assets WHERE id = $1 LIMIT 1`,
            [existing.fileAssetId],
          );
          const existingAsset = existingAssetResult.rows[0];
          if (!existingAsset
            || existingAsset.source_collection !== 'pcnGeneratedDocuments'
            || existingAsset.source_document_id !== existing.id
            || existingAsset.source_json_path !== 'fileAssetId'
            || existingAsset.mime_type !== existing.mimeType
            || Number(existingAsset.byte_size) !== Number(existing.byteSize)
            || String(existingAsset.sha256).toLowerCase() !== String(existing.sha256).toLowerCase()) {
            throw new Error('Asset bản sinh tài liệu không khớp metadata provenance; cần rà soát trước khi tái sử dụng.');
          }
          generatedDocuments.push(existing);
          continue;
        }

        const sourceTemplateDocx = format === 'DOCX' ? renderPcnOperationalTemplateDocx(kind, context) : undefined;
        const body = kind === 'DOSSIER_COVER'
          ? format === 'DOCX' ? sourceTemplateDocx || buildPcnDossierCoverDocx(context) : await buildPcnDossierCoverPdf(context)
          : kind === 'PROPOSAL_SUMMARY'
            ? format === 'DOCX' ? buildPcnProposalSummaryDocx(context) : await buildPcnProposalSummaryPdf(context)
            : kind === 'PROPOSAL_FORM'
            ? format === 'DOCX' ? sourceTemplateDocx || buildPcnProposalFormDocx(context) : await buildPcnProposalFormPdf(context)
            : kind === 'ASSIGNMENT_FORM'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnAssignmentFormDocx(context) : await buildPcnAssignmentFormPdf(context)
            : kind === 'EVALUATION_PLAN'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnEvaluationPlanDocx(context) : await buildPcnEvaluationPlanPdf(context)
            : kind === 'FIELD_INSPECTION'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnFieldInspectionDocx(context) : await buildPcnFieldInspectionPdf(context)
            : kind === 'SAMPLE_TAKING'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnSampleTakingDocx(context) : await buildPcnSampleTakingPdf(context)
            : kind === 'SAMPLE_CODING'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnSampleCodingDocx(context) : await buildPcnSampleCodingPdf(context)
            : kind === 'EVALUATION_REPORT'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnEvaluationReportDocx(context) : await buildPcnEvaluationReportPdf(context)
              : kind === 'SAMPLE_HANDOVER'
              ? format === 'DOCX' ? sourceTemplateDocx || buildPcnSampleHandoverDocx(context) : await buildPcnSampleHandoverPdf(context)
              : kind === 'SAMPLE_RETURN'
              ? format === 'DOCX' ? buildPcnSampleReturnDocx(context) : await buildPcnSampleReturnPdf(context)
              : format === 'DOCX' ? sourceTemplateDocx || buildPcnLabRequestDocx(context) : await buildPcnLabRequestPdf(context);

        const sha256 = createHash('sha256').update(body).digest('hex');
        const extension = format.toLowerCase();
        const mimeType = format === 'DOCX'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf';
        const kindSlug = kind === 'DOSSIER_COVER' ? 'cover' : kind === 'PROPOSAL_SUMMARY' ? 'proposal-summary' : kind === 'PROPOSAL_FORM' ? 'proposal-form' : kind === 'ASSIGNMENT_FORM' ? 'assignment-form' : kind === 'EVALUATION_PLAN' ? 'evaluation-plan' : kind === 'FIELD_INSPECTION' ? 'field-inspection' : kind === 'SAMPLE_TAKING' ? 'sample-taking' : kind === 'SAMPLE_CODING' ? 'sample-coding' : kind === 'EVALUATION_REPORT' ? 'evaluation-report' : kind === 'SAMPLE_HANDOVER' ? 'sample-handover' : kind === 'SAMPLE_RETURN' ? 'sample-return' : 'lab-request';
        const kindFileName = kind === 'DOSSIER_COVER' ? 'bia-muc-luc' : kind === 'PROPOSAL_SUMMARY' ? 'phieu-tom-tat-de-nghi' : kind === 'PROPOSAL_FORM' ? 'de-nghi-chung-nhan' : kind === 'ASSIGNMENT_FORM' ? 'phieu-phan-cong-chung-nhan' : kind === 'EVALUATION_PLAN' ? 'ke-hoach-danh-gia-cnsp' : kind === 'FIELD_INSPECTION' ? 'bien-ban-kiem-tra-hien-truong' : kind === 'SAMPLE_TAKING' ? 'bien-ban-lay-mau' : kind === 'SAMPLE_CODING' ? 'bien-ban-ma-hoa-mau' : kind === 'EVALUATION_REPORT' ? 'bao-cao-danh-gia-ho-so' : kind === 'SAMPLE_HANDOVER' ? 'bien-ban-giao-nhan-mau' : kind === 'SAMPLE_RETURN' ? 'bien-ban-tra-mau' : 'phieu-yeu-cau-thu-nghiem';
        const sourceLot = context.sampleHandover?.lotId
          ? sampleLots.find((lot) => lot.id === context.sampleHandover?.lotId)
          : context.labRequest?.sampleLotId ? sampleLots.find((lot) => lot.id === context.labRequest?.sampleLotId) : undefined;
        const sourceRoute = context.sampleHandover?.routeId
          ? sampleRoutes.find((route) => route.id === context.sampleHandover?.routeId)
          : context.labRequest?.sampleRouteId ? sampleRoutes.find((route) => route.id === context.labRequest?.sampleRouteId) : undefined;
        const sourcePyc = context.sampleHandover?.labRequestId
          ? labRequests.find((request) => request.id === context.sampleHandover?.labRequestId)
          : context.labRequest?.requestId ? labRequests.find((request) => request.id === context.labRequest?.requestId) : undefined;
        const assetId = `pcn-file-generated-${safeDossierId}-${kindSlug}-${extension}-${context.contextHash.slice(0, 16)}`;
        const documentId = `pcn-generated-${safeDossierId}-${kindSlug}-${extension}-${context.contextHash.slice(0, 16)}`;
        const objectPath = `pcnGenerated/${safeDossierId}/${kind}/${context.contextHash}/${extension}`;
        const selectionSuffix = context.sampleHandover
          ? `-${sanitizePcnPathSegment(context.sampleHandover.routeId).toLowerCase().slice(0, 24)}`
          : context.labRequest ? `-${sanitizePcnPathSegment(context.labRequest.pycNumber || context.labRequest.requestId).toLowerCase().slice(0, 24)}` : '';
        const fileName = `${safeDossierCode}-${kindFileName}${selectionSuffix}.${extension}`;
        const sourceUpdatedAt = getPcnDocumentSourceUpdatedAt(dossier.updatedAt, proposal.updatedAt, sourceLot?.updatedAt, sourceRoute?.updatedAt, sourcePyc?.updatedAt, context.labRequest?.updatedAt, context.labRequest?.sampleLotUpdatedAt, context.labRequest?.routeUpdatedAt);

        const assetResult = await client.query(
          `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
           FROM file_assets WHERE id = $1 LIMIT 1`,
          [assetId],
        );
        const existingAsset = assetResult.rows[0];
        if (existingAsset && (
          existingAsset.bucket_name !== bucketName
          || existingAsset.object_path !== objectPath
          || existingAsset.source_collection !== 'pcnGeneratedDocuments'
          || existingAsset.source_document_id !== documentId
          || existingAsset.source_json_path !== 'fileAssetId'
          || existingAsset.mime_type !== mimeType
          || Number(existingAsset.byte_size) !== body.length
          || String(existingAsset.sha256).toLowerCase() !== sha256
        )) {
          throw new Error('Asset bản sinh tài liệu trùng mã nhưng metadata provenance không khớp.');
        }

        if (!existingAsset) {
          await storage.uploadObject({ bucketName, objectPath, body, mimeType });
          uploadedObjects.push({ bucketName, objectPath });
          await client.query(
            `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
             VALUES ($1, $2, $3, 'pcnGeneratedDocuments', $4, 'fileAssetId', $5, $6, $7)`,
            [assetId, bucketName, objectPath, documentId, mimeType, body.length, sha256],
          );
        }

        const generated: PcnGeneratedDocument = {
          id: documentId,
          dossierId: dossier.id,
          kind,
          format,
          ...(context.labRequest?.requestId ? { labRequestId: context.labRequest.requestId } : {}),
          ...(context.sampleHandover?.lotId ? { sampleLotId: context.sampleHandover.lotId } : {}),
          ...(context.sampleHandover?.routeId ? { sampleRouteId: context.sampleHandover.routeId } : {}),
          fileAssetId: assetId,
          fileName,
          mimeType,
          byteSize: body.length,
          sha256,
          contextHash: context.contextHash,
          ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
          generatedAt,
          ...(user?.username ? { generatedBy: user.username } : {}),
        };

        const write = await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnGeneratedDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING
           RETURNING document_id, data`,
          [generated.id, JSON.stringify(getDocumentPayload(generated))],
        );
        if (write.rows.length > 0) {
          createdAny = true;
          generatedDocuments.push(mapDocumentRow(write.rows[0]) as PcnGeneratedDocument);
        } else {
          const concurrent = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'pcnGeneratedDocuments' AND document_id = $1 LIMIT 1`,
            [generated.id],
          );
          generatedDocuments.push((concurrent.rows[0] ? mapDocumentRow(concurrent.rows[0]) : generated) as PcnGeneratedDocument);
        }
      }

      if (createdAny) {
        const log = buildActivityLog({
          action: 'CREATED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: user?.username,
          actorName: user?.name || 'Người dùng PCN',
          actorRole: user?.role,
          summary: kind === 'DOSSIER_COVER'
            ? 'Sinh bìa và mục lục hồ sơ Word/PDF'
            : kind === 'PROPOSAL_SUMMARY'
              ? 'Sinh phiếu tóm tắt Đề nghị Word/PDF'
              : kind === 'PROPOSAL_FORM'
              ? 'Sinh Đề nghị chứng nhận đầy đủ Word/PDF'
              : kind === 'ASSIGNMENT_FORM'
              ? 'Sinh phiếu phân công chứng nhận Word/PDF'
              : kind === 'EVALUATION_PLAN'
              ? 'Sinh kế hoạch đánh giá CNSP Word/PDF'
              : kind === 'FIELD_INSPECTION'
              ? 'Sinh biên bản kiểm tra tại hiện trường Word/PDF'
              : kind === 'SAMPLE_TAKING'
              ? 'Sinh biên bản lấy mẫu Word/PDF'
              : kind === 'SAMPLE_CODING'
              ? 'Sinh biên bản mã hóa mẫu Word/PDF'
                : kind === 'EVALUATION_REPORT'
                  ? 'Sinh báo cáo đánh giá hồ sơ PCN Word/PDF'
                : kind === 'SAMPLE_HANDOVER'
                ? 'Sinh biên bản giao/nhận mẫu Word/PDF'
                : kind === 'SAMPLE_RETURN'
                ? 'Sinh biên bản trả mẫu Word/PDF'
                : 'Sinh phiếu yêu cầu thử nghiệm PCN Word/PDF',
          source: 'UI',
          groupId: context.contextHash,
          createdAt: generatedAt,
        });
        const validationError = validateActivityLogPayload(log);
        if (validationError) throw new Error(validationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [log.id, JSON.stringify(getDocumentPayload(log))],
        );
        createdActivityLogs.push(log);
      }

      return { context, documents: generatedDocuments, activityLogs: createdActivityLogs };
    });

    return jsonOk(result, { status: result.activityLogs.length > 0 ? 201 : 200 });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      try {
        const storage = getPcnStorageClient();
        await storage.deleteObject(uploaded);
      } catch {
        // cleanup best effort
      }
    }
    console.error('PCN document generation error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const status = Number(error?.statusCode) || (normalizedMessage.includes('storage is not configured') ? 503 : normalizedMessage.includes('không tìm thấy') || normalizedMessage.includes('chưa có đề nghị') ? 404 : 500);
    return jsonError(message, status);
  }
}
