import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { getPcnStorageBucket, getPcnStorageClient, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnDraftOutput,
  PcnDraftWorkspace,
  PcnGeneratedDocumentFormat,
  PcnSampleLot,
  PcnSampleRoute,
} from '@/types';
import { validatePcnDraftAction, buildPcnDraftManualSource } from '@/utils/pcnDrafting';
import { getPcnOperationalTemplateForKind } from '@/utils/pcnOperationalTemplateCatalog';
import { validatePcnDraftSourceSelection } from '@/utils/pcnDraftSourcePolicy';
import { buildPcnDossierDocumentContext } from '@/utils/pcnDocumentGeneration';
import { renderPcnOperationalTemplateDocx } from '@/utils/pcnOperationalTemplateGeneration';
import { renderPcnDocxToPdf } from '@/utils/pcnPdfRenderer';
import { jsonBadRequest, jsonCreated, jsonNotFound, jsonServerError } from '@/lib/server/response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const profile = (process.env.DATABASE_PROFILE || 'pcn').trim();
  if (profile !== 'pcn') {
    return jsonNotFound('Soạn thảo PCN chỉ khả dụng trong profile PCN.');
  }

  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const actor = getPcnSessionUser(req)!;
  const { draftId: rawDraftId } = await params;
  const draftId = String(rawDraftId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requestedFormats = Array.isArray(body?.formats) && body.formats.length > 0 ? body.formats : ['DOCX', 'PDF'];
  const formats = [...new Set(requestedFormats.map((format: unknown) => String(format).trim().toUpperCase()))] as PcnGeneratedDocumentFormat[];

  if (!draftId || draftId.length > 240 || formats.length === 0 || formats.some((format) => !['DOCX', 'PDF'].includes(format))) {
    return jsonBadRequest('Bản soạn thảo hoặc định dạng file không hợp lệ.');
  }

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const result = await withPgTransaction(async (client) => {
      const draftResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDraftWorkspaces' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [draftId],
      );
      if (!draftResult.rows[0]) throw Object.assign(new Error('Không tìm thấy bản soạn thảo PCN.'), { statusCode: 404 });
      const draft = mapDocumentRow(draftResult.rows[0]) as PcnDraftWorkspace;

      const draftValidation = validatePcnDraftAction(draft.formKind, draft.values, 'GENERATE');
      if (!draftValidation.valid) {
        throw Object.assign(new Error(`Chưa thể tạo file. Còn thiếu: ${draftValidation.missingKeys.join(', ')}`), { statusCode: 400 });
      }

      const template = getPcnOperationalTemplateForKind(draft.formKind as any, draft.fieldCodes);
      if (!template || template.usage === 'REFERENCE_ONLY') {
        throw Object.assign(new Error('Template này chỉ để tham chiếu hoặc chưa có bản sinh vận hành.'), { statusCode: 409 });
      }

      let proposal: CertificationProposal | undefined;
      let dossier: CertificationDossier | undefined;
      if (draft.sourceDossierId) {
        const dossierResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
          [draft.sourceDossierId],
        );
        dossier = dossierResult.rows[0] ? (mapDocumentRow(dossierResult.rows[0]) as CertificationDossier) : undefined;
      }
      const proposalId = draft.sourceProposalId || dossier?.proposalId;
      if (proposalId) {
        const proposalResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationProposals' AND document_id = $1 LIMIT 1`,
          [proposalId],
        );
        proposal = proposalResult.rows[0] ? (mapDocumentRow(proposalResult.rows[0]) as CertificationProposal) : undefined;
      }
      if (!dossier && proposal?.dossierId) {
        const dossierResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
          [proposal.dossierId],
        );
        dossier = dossierResult.rows[0] ? (mapDocumentRow(dossierResult.rows[0]) as CertificationDossier) : undefined;
      }

      validatePcnDraftSourceSelection({ sourceProposalId: draft.sourceProposalId, sourceDossierId: draft.sourceDossierId, proposal, dossier });

      const manualSource = !draft.sourceProposalId && !draft.sourceDossierId
        ? buildPcnDraftManualSource(draft, new Date().toISOString())
        : undefined;

      if (!proposal && manualSource) {
        proposal = manualSource.proposal;
        if (!dossier) dossier = manualSource.dossier;
      }

      if (!proposal) throw Object.assign(new Error('Không đủ nguồn dữ liệu để tạo tài liệu. Hãy chọn số Đề nghị/Hồ sơ hoặc nhập đầy đủ thông tin form.'), { statusCode: 400 });
      if (!dossier) {
        dossier = {
          id: `draft-source-${draft.id}`,
          dossierCode: String(draft.values.ma_ho_so || '').trim() || `DRAFT-${draft.id.slice(-8)}`,
          proposalId: proposal.id,
          fieldCodes: draft.fieldCodes.length ? draft.fieldCodes : proposal.fieldCodes,
          method: 'METHOD_1',
          status: 'INTAKE_REVIEW',
          labRequestIds: [],
          returnedResultIds: [],
        };
      }

      const fieldCodes = dossier.fieldCodes.length ? dossier.fieldCodes : proposal.fieldCodes;
      const [fieldsResult, requirementsResult, documentsResult, attachmentsResult, lotsResult, routesResult, requestsResult] = await Promise.all([
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnCertificationFields' AND data->>'code' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true AND data->>'fieldCode' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes'`),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND data->>'dossierId' = $1`, [dossier.id]),
      ]);

      const context = buildPcnDossierDocumentContext({
        dossier,
        proposal,
        fields: fieldsResult.rows.map(mapDocumentRow) as PcnCertificationField[],
        documents: documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[],
        documentRequirements: requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[],
        attachments: attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[],
        sampleLots: lotsResult.rows.map(mapDocumentRow) as PcnSampleLot[],
        sampleRoutes: routesResult.rows.map(mapDocumentRow) as PcnSampleRoute[],
        labRequests: requestsResult.rows.map(mapDocumentRow) as OutboundLabRequest[],
      });

      const contextHash = createHash('sha256').update(JSON.stringify({ contextHash: context.contextHash, draftId: draft.id, formKind: draft.formKind, values: draft.values })).digest('hex');
      const sourceTemplateDocx = renderPcnOperationalTemplateDocx(draft.formKind as any, context, {
        ...draft.values,
        ...(manualSource ? { method_label: String(draft.values.method_label || '') } : {}),
      });

      if (!sourceTemplateDocx) throw Object.assign(new Error('Không thể dựng DOCX từ template PCN đã chọn.'), { statusCode: 409 });

      const storage = getPcnStorageClient();
      const bucketName = getPcnStorageBucket();
      await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);

      const outputs: PcnDraftOutput[] = [];
      const safeDraftId = sanitizePcnPathSegment(draft.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48) || 'draft';
      const safeTitle = sanitizePcnPathSegment(draft.title).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80) || 'pcn-draft';

      for (const format of formats) {
        const body = format === 'DOCX' ? sourceTemplateDocx : await renderPcnDocxToPdf(sourceTemplateDocx, `${safeTitle}.docx`);
        const sha256 = createHash('sha256').update(body).digest('hex');
        const extension = format.toLowerCase();
        const mimeType = format === 'DOCX' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
        const outputId = `pcn-draft-output-${safeDraftId}-${contextHash.slice(0, 16)}-${extension}`;
        const assetId = `pcn-file-draft-${safeDraftId}-${contextHash.slice(0, 16)}-${extension}`;
        const objectPath = `pcnDraftWorkspaces/${safeDraftId}/${contextHash}/${extension}`;
        const fileName = `${safeTitle}.${extension}`;

        const assetResult = await client.query(
          `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256 FROM file_assets WHERE id = $1 LIMIT 1`,
          [assetId],
        );
        const existingAsset = assetResult.rows[0];
        if (
          existingAsset &&
          (existingAsset.bucket_name !== bucketName ||
            existingAsset.object_path !== objectPath ||
            existingAsset.source_collection !== 'pcnDraftWorkspaces' ||
            existingAsset.source_document_id !== draft.id ||
            existingAsset.source_json_path !== 'outputs' ||
            existingAsset.mime_type !== mimeType ||
            Number(existingAsset.byte_size) !== body.length ||
            String(existingAsset.sha256).toLowerCase() !== sha256)
        ) {
          throw new Error('Asset bản soạn thảo không khớp metadata provenance.');
        }

        if (!existingAsset) {
          await storage.uploadObject({ bucketName, objectPath, body, mimeType });
          uploadedObjects.push({ bucketName, objectPath });
          await client.query(
            `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256) VALUES ($1, $2, $3, 'pcnDraftWorkspaces', $4, 'outputs', $5, $6, $7)`,
            [assetId, bucketName, objectPath, draft.id, mimeType, body.length, sha256],
          );
        }
        outputs.push({ id: outputId, format, fileAssetId: assetId, fileName, mimeType, byteSize: body.length, sha256, generatedAt: new Date().toISOString() });
      }

      const now = new Date().toISOString();
      const nextDraft: PcnDraftWorkspace = {
        ...draft,
        status: 'GENERATED',
        outputAssetIds: outputs.map((output) => output.fileAssetId),
        outputs,
        updatedByUsername: actor.username,
        updatedAt: now,
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnDraftWorkspaces' AND document_id = $1`,
        [draft.id, JSON.stringify(getDocumentPayload(nextDraft))],
      );

      const activityLog = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_DRAFT',
        entityId: draft.id,
        entityLabel: draft.title,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: `Sinh ${outputs.map((output) => output.format).join(' + ')} từ bản soạn thảo PCN`,
        source: 'UI',
        createdAt: now,
        groupId: contextHash,
      });

      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw new Error(validationError);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP) ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );

      return { draft: nextDraft, activityLog };
    });

    return jsonCreated(result);
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      try {
        await getPcnStorageClient().deleteObject(uploaded);
      } catch {
        /* keep original error */
      }
    }
    console.error('PCN drafting generation error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
