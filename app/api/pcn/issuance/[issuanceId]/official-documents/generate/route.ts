import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation, requirePcnSession } from '@/lib/server/auth';
import { getPcnStorageClient, getPcnStorageBucket, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnGeneratedDocumentFormat,
  PcnOfficialDocumentKind,
  PcnOfficialGeneratedDocument,
} from '@/types';
import { buildPcnDossierDocumentContext } from '@/utils/pcnDocumentGeneration';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import {
  buildPcnOfficialContextHash,
  buildPcnOfficialGenerationContextHash,
  buildPcnOfficialTemplateData,
  getPcnOfficialGenerationReadiness,
  renderPcnOfficialDocx,
} from '@/utils/pcnOfficialTemplateGeneration';
import {
  buildPcnOfficialDocumentId,
  buildPcnOfficialFileAssetId,
  buildPcnOfficialFileName,
  getPcnOfficialSourceUpdatedAt,
  selectPcnOfficialTemplate,
} from '@/utils/pcnOfficialDocumentPolicy';
import { getPcnPdfRendererReadiness, renderPcnDocxToPdf } from '@/utils/pcnPdfRenderer';
import { mergePcnTemplateCatalog } from '@/utils/pcnTemplateCatalog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Sinh tài liệu phát hành PCN chỉ khả dụng trong profile PCN.');
  }

  const { issuanceId: rawIssuanceId } = await params;
  const issuanceId = String(rawIssuanceId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const dryRun = bodyJson?.dryRun === true;

  if (dryRun) {
    const sessionError = requirePcnSession(req);
    if (sessionError) return sessionError;
  } else {
    const mutationError = requirePcnMutation(req);
    if (mutationError) return mutationError;
  }

  const actor = getPcnSessionUser(req)!;
  const expectedContextHash = typeof bodyJson?.expectedContextHash === 'string'
    ? bodyJson.expectedContextHash.trim().toLowerCase()
    : '';

  const requestedKinds = Array.isArray(bodyJson?.documentKinds) && bodyJson.documentKinds.length > 0
    ? bodyJson.documentKinds.map((value: unknown) => String(value).trim().toUpperCase())
    : ['CERTIFICATE', 'DECISION'];
  const requestedFormats = Array.isArray(bodyJson?.formats) && bodyJson.formats.length > 0
    ? bodyJson.formats.map((value: unknown) => String(value).trim().toUpperCase())
    : ['DOCX'];

  const validKinds = requestedKinds.every((value: string) => ['CERTIFICATE', 'DECISION'].includes(value));
  const validFormats = requestedFormats.every((value: string) => ['DOCX', 'PDF'].includes(value));
  const kinds = [...new Set(requestedKinds)] as PcnOfficialDocumentKind[];
  const formats = [...new Set(requestedFormats)] as PcnGeneratedDocumentFormat[];

  if (!issuanceId || !validKinds || !validFormats || kinds.length === 0 || formats.length === 0) {
    return jsonBadRequest('Thiếu mã bộ phát hành, loại tài liệu hoặc định dạng không hợp lệ.');
  }

  if (expectedContextHash && !/^[a-f0-9]{64}$/.test(expectedContextHash)) {
    return jsonBadRequest('expectedContextHash không hợp lệ.');
  }

  if (!dryRun && !expectedContextHash) {
    return jsonBadRequest('Sinh tài liệu chính thức bắt buộc phải gửi expectedContextHash từ bước kiểm tra dữ liệu.');
  }

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const storage = dryRun ? null : getPcnStorageClient();
    const bucketName = dryRun ? '' : getPcnStorageBucket();
    if (storage) await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);
    const lockClause = dryRun ? '' : ' FOR UPDATE';

    const result = await withPgTransaction(async (client) => {
      if (!dryRun) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-official-generate:${issuanceId}`]);
      }

      const issuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND document_id = $1
         LIMIT 1${lockClause}`,
        [issuanceId],
      );
      if (issuanceResult.rows.length === 0) throw new Error('Không tìm thấy bộ phát hành PCN.');
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;

      if (!['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status)) {
        throw new Error('Bộ phát hành chưa ở trạng thái cho phép sinh tài liệu chính thức.');
      }
      if (!String(issuance.issuanceNumber || '').trim() || !String(issuance.issuedAt || '').trim()) {
        throw new Error('Bộ phát hành phải có số và ngày cấp trước khi sinh tài liệu chính thức.');
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1${lockClause}`,
        [issuance.dossierId],
      );
      if (dossierResult.rows.length === 0) throw new Error('Không tìm thấy hồ sơ liên kết với bộ phát hành.');
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const proposalId = String(dossier.proposalId || '').trim();
      const proposalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals' AND document_id = $1
         LIMIT 1${lockClause}`,
        [proposalId],
      );
      if (proposalResult.rows.length === 0) throw new Error('Không tìm thấy Đề nghị liên kết với hồ sơ.');
      const proposal = mapDocumentRow(proposalResult.rows[0]) as CertificationProposal;

      const fieldCodes = Array.isArray(dossier.fieldCodes)
        ? dossier.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
        : [];

      const [fieldsResult, requirementsResult, documentsResult, attachmentsResult, templateResult] = await Promise.all([
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnCertificationFields' AND data->>'code' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true AND data->>'fieldCode' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnTemplateDefinitions' AND data->>'fieldCode' = ANY($1::text[])`, [fieldCodes]),
      ]);

      const context = buildPcnDossierDocumentContext({
        dossier,
        proposal,
        fields: fieldsResult.rows.map(mapDocumentRow) as PcnCertificationField[],
        documents: documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[],
        documentRequirements: requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[],
        attachments: attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[],
      });

      const templates = mergePcnTemplateCatalog(templateResult.rows.map((row: any) => ({ ...row.data, id: row.document_id })) as any[]);
      const officialTemplateAssetIds = new Set(
        templates
          .filter((template) => fieldCodes.includes(String(template.fieldCode).trim().toUpperCase()) && kinds.includes(template.documentKind))
          .map((template) => template.fileAssetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
      );

      const officialTemplateAssetResult = await client.query(
        `SELECT id, bucket_name, source_collection, source_document_id, source_json_path, mime_type
         FROM file_assets WHERE id = ANY($1::text[])`,
        [[...officialTemplateAssetIds]],
      );

      const verifiedOfficialTemplateAssetIds = new Set<string>();
      for (const template of templates) {
        const asset = officialTemplateAssetResult.rows.find((row: any) => row.id === template.fileAssetId);
        if (asset
          && String(asset.bucket_name) === getPcnStorageBucket()
          && asset.source_collection === 'pcnTemplateDefinitions'
          && asset.source_document_id === template.id
          && asset.source_json_path === 'fileAssetId'
          && asset.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          verifiedOfficialTemplateAssetIds.add(String(asset.id));
        }
      }

      const pdfReadiness = formats.includes('PDF') ? getPcnPdfRendererReadiness() : undefined;
      const preflightEntries = kinds.map((documentKind) => {
        const template = selectPcnOfficialTemplate(templates, fieldCodes, dossier.method, documentKind);
        if (!template) {
          return {
            documentKind,
            template: undefined,
            data: {},
            ready: false,
            reasons: ['TEMPLATE_MISSING'],
            officialContextHash: '',
          };
        }
        const data = buildPcnOfficialTemplateData({ context, issuance, documentKind });
        const readiness = getPcnOfficialGenerationReadiness(template, data);
        const reasons = [...readiness.reasons] as string[];
        if (!template.fileAssetId || !verifiedOfficialTemplateAssetIds.has(template.fileAssetId)) reasons.push('MISSING_PRIVATE_ASSET');
        if (pdfReadiness && !pdfReadiness.ready) reasons.push('PDF_RENDERER_UNAVAILABLE');
        const officialContextHash = buildPcnOfficialContextHash(context.contextHash, template, data);
        return {
          documentKind,
          template,
          data,
          ready: reasons.length === 0,
          reasons: [...new Set(reasons)],
          officialContextHash,
        };
      });

      const generationContextHash = buildPcnOfficialGenerationContextHash(
        preflightEntries.map((entry) => ({ documentKind: entry.documentKind, contextHash: entry.officialContextHash })),
        formats,
      );

      const preflight = preflightEntries.map((entry) => ({
        documentKind: entry.documentKind,
        ready: entry.ready,
        reasons: entry.reasons,
        ...(entry.template ? { templateId: entry.template.id, templateDisplayName: entry.template.displayName } : {}),
        ...(entry.officialContextHash ? { officialContextHash: entry.officialContextHash } : {}),
      }));

      if (dryRun) {
        return { issuance, documents: [], activityLogs: [], contextHash: generationContextHash, preflight };
      }

      if (!storage) throw new Error('Storage PCN chưa được cấu hình.');
      if (expectedContextHash && expectedContextHash !== generationContextHash) {
        throw Object.assign(new Error('Dữ liệu phát hành đã thay đổi sau bước kiểm tra; vui lòng kiểm tra lại trước khi sinh tài liệu.'), { statusCode: 409 });
      }

      const blocked = preflightEntries.find((entry) => !entry.ready);
      if (blocked) {
        const detail = blocked.reasons.join(', ');
        throw new Error(blocked.template
          ? `Template ${blocked.template.displayName} chưa sẵn sàng: ${detail}.`
          : `Chưa có template ${blocked.documentKind} cho lĩnh vực/phương thức của hồ sơ.`);
      }

      const generatedDocuments: PcnOfficialGeneratedDocument[] = [];
      const createdActivityLogs: ReturnType<typeof buildActivityLog>[] = [];
      const generatedAt = new Date().toISOString();
      let createdAny = false;

      for (const documentKind of kinds) {
        const preflightEntry = preflightEntries.find((entry) => entry.documentKind === documentKind);
        if (!preflightEntry?.template) throw new Error(`Chưa có template ${documentKind} cho lĩnh vực/phương thức của hồ sơ.`);
        const template = preflightEntry.template;
        const { data, officialContextHash } = preflightEntry;
        let renderedDocx: Buffer | undefined;

        const loadRenderedDocx = async (): Promise<Buffer> => {
          if (renderedDocx) return renderedDocx;
          if (!storage) throw new Error('Storage PCN chưa được cấu hình.');
          const templateAssetResult = await client.query(
            `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256 FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
            [template.fileAssetId],
          );
          const templateAsset = templateAssetResult.rows[0];
          if (!templateAsset
            || templateAsset.bucket_name !== bucketName
            || templateAsset.mime_type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || Number(templateAsset.byte_size) !== Number(template.sourceFingerprint.byteSize)
            || String(templateAsset.sha256).toLowerCase() !== String(template.sourceFingerprint.sha256).toLowerCase()
            || templateAsset.source_collection !== 'pcnTemplateDefinitions'
            || templateAsset.source_document_id !== template.id
            || templateAsset.source_json_path !== 'fileAssetId') {
            throw new Error(`Không tìm thấy asset private của template ${template.displayName}.`);
          }
          const downloadedTemplate = await storage.downloadObject({ bucketName: templateAsset.bucket_name, objectPath: templateAsset.object_path });
          const templateSha256 = createHash('sha256').update(downloadedTemplate.body).digest('hex');
          if (downloadedTemplate.body.length !== Number(templateAsset.byte_size)
            || templateSha256 !== String(templateAsset.sha256).toLowerCase()) {
            throw new Error(`Object template ${template.displayName} không khớp byte size/SHA-256 fingerprint.`);
          }
          renderedDocx = renderPcnOfficialDocx(downloadedTemplate.body, data);
          return renderedDocx;
        };

        for (const format of formats) {
          const documentId = buildPcnOfficialDocumentId(issuance.id, template.id, format, officialContextHash);
          const objectPath = `pcnOfficial/${sanitizePcnPathSegment(issuance.id)}/${sanitizePcnPathSegment(template.id)}/${officialContextHash}/${format.toLowerCase()}`;
          const existingResult = await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnOfficialGeneratedDocuments' AND document_id = $1 LIMIT 1${lockClause}`,
            [documentId],
          );

          if (existingResult.rows.length > 0) {
            const existing = mapDocumentRow(existingResult.rows[0]) as PcnOfficialGeneratedDocument;
            const existingAssetResult = await client.query(
              `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
               FROM file_assets WHERE id = $1 LIMIT 1${lockClause}`,
              [existing.fileAssetId],
            );
            const existingAsset = existingAssetResult.rows[0];
            if (!existingAsset
              || existingAsset.bucket_name !== bucketName
              || existingAsset.object_path !== objectPath
              || existingAsset.source_collection !== 'pcnOfficialGeneratedDocuments'
              || existingAsset.source_document_id !== existing.id
              || existingAsset.source_json_path !== 'fileAssetId'
              || existingAsset.mime_type !== existing.mimeType
              || Number(existingAsset.byte_size) !== Number(existing.byteSize)
              || String(existingAsset.sha256).toLowerCase() !== String(existing.sha256).toLowerCase()) {
              throw new Error('Asset tài liệu chính thức không khớp metadata provenance; cần rà soát trước khi tái sử dụng.');
            }
            if (!storage) throw new Error('Storage PCN chưa được cấu hình.');
            const existingDownloaded = await storage.downloadObject({ bucketName: existingAsset.bucket_name, objectPath: existingAsset.object_path });
            const existingSha256 = createHash('sha256').update(existingDownloaded.body).digest('hex');
            if (existingDownloaded.body.length !== Number(existing.byteSize)
              || existingSha256 !== String(existing.sha256).toLowerCase()) {
              throw new Error('Object tài liệu chính thức không khớp byte size/SHA-256 metadata; cần rà soát trước khi tái sử dụng.');
            }
            generatedDocuments.push(existing);
            continue;
          }

          const docxBody = await loadRenderedDocx();
          const body = format === 'DOCX'
            ? docxBody
            : await renderPcnDocxToPdf(docxBody, buildPcnOfficialFileName(dossier.dossierCode, documentKind, 'DOCX'));
          const sha256 = createHash('sha256').update(body).digest('hex');
          const fileAssetId = buildPcnOfficialFileAssetId(sha256, documentId);
          const mimeType = format === 'DOCX'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';

          const generatedAssetResult = await client.query(`SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256 FROM file_assets WHERE id = $1 LIMIT 1${lockClause}`, [fileAssetId]);
          const generatedAsset = generatedAssetResult.rows[0];
          if (generatedAsset && (
            generatedAsset.bucket_name !== bucketName
            || generatedAsset.object_path !== objectPath
            || String(generatedAsset.sha256).toLowerCase() !== sha256
            || generatedAsset.source_collection !== 'pcnOfficialGeneratedDocuments'
            || generatedAsset.source_document_id !== documentId
            || generatedAsset.source_json_path !== 'fileAssetId'
            || generatedAsset.mime_type !== mimeType
            || Number(generatedAsset.byte_size) !== body.length
          )) {
            throw new Error('Asset tài liệu chính thức trùng mã nhưng metadata không khớp.');
          }

          if (!generatedAsset) {
            await storage.uploadObject({ bucketName, objectPath, body, mimeType });
            uploadedObjects.push({ bucketName, objectPath });
            await client.query(
              `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
               VALUES ($1, $2, $3, 'pcnOfficialGeneratedDocuments', $4, 'fileAssetId', $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [fileAssetId, bucketName, objectPath, documentId, mimeType, body.length, sha256],
            );
          }

          const persistedGeneratedAssetResult = await client.query(`SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256 FROM file_assets WHERE id = $1 LIMIT 1${lockClause}`, [fileAssetId]);
          const persistedGeneratedAsset = persistedGeneratedAssetResult.rows[0];
          if (!persistedGeneratedAsset
            || persistedGeneratedAsset.bucket_name !== bucketName
            || persistedGeneratedAsset.object_path !== objectPath
            || String(persistedGeneratedAsset.sha256).toLowerCase() !== sha256
            || persistedGeneratedAsset.source_collection !== 'pcnOfficialGeneratedDocuments'
            || persistedGeneratedAsset.source_document_id !== documentId
            || persistedGeneratedAsset.source_json_path !== 'fileAssetId'
            || persistedGeneratedAsset.mime_type !== mimeType
            || Number(persistedGeneratedAsset.byte_size) !== body.length) {
            throw new Error('Asset tài liệu chính thức sau insert không khớp metadata provenance.');
          }

          const sourceUpdatedAt = getPcnOfficialSourceUpdatedAt(issuance.updatedAt, dossier.updatedAt, proposal.updatedAt);
          const generated: PcnOfficialGeneratedDocument = {
            id: documentId,
            issuanceId: issuance.id,
            dossierId: dossier.id,
            templateId: template.id,
            documentKind,
            format,
            fileAssetId,
            fileName: buildPcnOfficialFileName(dossier.dossierCode, documentKind, format),
            mimeType,
            byteSize: body.length,
            sha256,
            contextHash: officialContextHash,
            ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
            generatedAt,
            generatedBy: actor.username,
          };

          const write = await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('pcnOfficialGeneratedDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (collection_name, document_id) DO NOTHING
             RETURNING document_id, data`,
            [generated.id, JSON.stringify(getDocumentPayload(generated))],
          );
          const saved = write.rows[0] ? mapDocumentRow(write.rows[0]) as PcnOfficialGeneratedDocument : generated;
          generatedDocuments.push(saved);
          createdAny = true;
        }
      }

      if (createdAny) {
        const now = new Date().toISOString();
        const log = buildActivityLog({
          action: 'CREATED',
          entityType: 'PCN_ISSUANCE',
          entityId: issuance.id,
          entityLabel: issuance.issuanceNumber,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: `Sinh tài liệu phát hành chính thức ${formats.join('/')} từ template PCN đã duyệt`,
          source: 'UI',
          groupId: context.contextHash,
          createdAt: now,
        });
        const validationError = validateActivityLogPayload(log);
        if (validationError) throw new Error(validationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [log.id, JSON.stringify(getDocumentPayload(log))],
        );
        createdActivityLogs.push(log);
      }

      return { issuance, documents: generatedDocuments, activityLogs: createdActivityLogs, contextHash: generationContextHash, preflight };
    });

    return jsonOk(result, { status: result.activityLogs.length > 0 ? 201 : 200 });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      await getPcnStorageClient().deleteObject(uploaded).catch(() => undefined);
    }
    console.error('PCN official document generation error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const status = Number(error?.statusCode) || (normalizedMessage.includes('storage is not configured')
      || normalizedMessage.includes('chưa sẵn sàng')
      || normalizedMessage.includes('renderer pdf')
      ? 503
      : normalizedMessage.includes('không tìm thấy')
        ? 404
        : 409);
    return jsonError(message, status);
  }
}
