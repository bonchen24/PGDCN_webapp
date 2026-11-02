import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getPcnStorageClient, getPcnStorageBucket, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/helpers';
import {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnGeneratedDocument,
  PcnSampleLot,
  PcnSampleRoute,
  PcnUserAccount,
} from '@/types';
import {
  buildPcnDossierDocumentContext,
} from '@/utils/pcnDocumentGeneration';
import {
  buildPcnDossierDocumentId,
  buildPcnGeneratedDossierAttachment,
} from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnDossierRequirement } from '@/utils/pcnDossierStageGate';
import { getPcnNodeDocumentGenerationKind } from '@/utils/pcnDossierNodeWork';
import { buildActivityLog, diffActivityFields, validateActivityLogPayload } from '@/utils/activityLog';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import {
  applyPcnDossierDocumentRework,
  assertPcnDossierNodeOperator,
  renderPcnNodeGeneratedDocx,
} from '@/lib/server/pcn-dossier-operations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string; nodeId: string }> },
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const actor = getPcnSessionUser(req)! as PcnUserAccount;
  const { dossierId: rawDossierId, nodeId: rawNodeId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  const nodeId = String(rawNodeId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const requirementId = String(bodyJson?.requirementId || '').trim();
  const requestedKind = String(bodyJson?.kind || '').trim().toUpperCase();

  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(nodeId) || !isSafePcnSampleKey(requirementId)) {
    return jsonBadRequest('Mã hồ sơ, node hoặc requirement không hợp lệ.');
  }

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const storage = getPcnStorageClient();
    const bucketName = getPcnStorageBucket();
    await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);

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
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi sinh tài liệu.'), { statusCode: 409 });
      }
      if (!dossier.workflowSnapshot) {
        throw Object.assign(new Error('Hồ sơ chưa có snapshot lưu trình để xử lý theo node.'), { statusCode: 409 });
      }

      const node = dossier.workflowSnapshot.nodes.find((candidate) => candidate.id === nodeId && candidate.active !== false);
      if (!node || !node.requirementIds.includes(requirementId)) {
        throw Object.assign(new Error('Requirement không thuộc node đang chọn.'), { statusCode: 400 });
      }

      const taskResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1 AND data->>'nodeId' = $2
         LIMIT 1 FOR UPDATE`,
        [dossierId, nodeId],
      );
      const task = taskResult.rows[0] ? mapDocumentRow(taskResult.rows[0]) as PcnDossierWorkflowTask : undefined;
      if (!task || !['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED', 'COMPLETED'].includes(task.status)) {
        throw Object.assign(new Error('Node chưa sẵn sàng để sinh tài liệu.'), { statusCode: 409 });
      }

      await assertPcnDossierNodeOperator(client, dossier, requirementId, actor);

      const requirementResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDocumentRequirements' AND document_id = $1
         LIMIT 1`,
        [requirementId],
      );
      const requirement = requirementResult.rows[0] ? mapDocumentRow(requirementResult.rows[0]) as PcnDocumentRequirement : undefined;
      const fieldCodes = Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean) : [];
      if (!requirement || requirement.active !== true || !fieldCodes.includes(String(requirement.fieldCode || '').trim().toUpperCase())) {
        throw Object.assign(new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ PCN.'), { statusCode: 400 });
      }
      if (!canProcessPcnDossierRequirement(dossier, requirement)) {
        throw Object.assign(new Error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
      }

      const kind = getPcnNodeDocumentGenerationKind(requirement.code);
      if (!kind || (requestedKind && requestedKind !== kind)) {
        throw Object.assign(new Error('Requirement này chưa có biểu mẫu sinh tự động tương ứng.'), { statusCode: 400 });
      }

      const documentId = buildPcnDossierDocumentId(dossierId, requirementId);
      const existingDocumentResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      const previous = existingDocumentResult.rows[0]?.data || {};

      const proposalId = String(dossier.proposalId || '').trim();
      const proposalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals' AND document_id = $1
         LIMIT 1`,
        [proposalId],
      );
      if (!proposalResult.rows[0]) throw Object.assign(new Error('Không tìm thấy Đề nghị liên kết với hồ sơ.'), { statusCode: 404 });
      const proposal = mapDocumentRow(proposalResult.rows[0]) as CertificationProposal;

      const [fieldsResult, requirementsResult, documentsResult, attachmentsResult, lotsResult, routesResult, requestsResult] = await Promise.all([
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnCertificationFields' AND data->>'code' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true AND data->>'fieldCode' = ANY($1::text[])`, [fieldCodes]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND data->>'dossierId' = $1`, [dossier.id]),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes'`),
        client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND data->>'dossierId' = $1`, [dossier.id]),
      ]);

      const fields = fieldsResult.rows.map(mapDocumentRow) as PcnCertificationField[];
      const requirements = requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[];
      const documents = documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[];
      const attachments = attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[];
      const sampleLots = lotsResult.rows.map(mapDocumentRow) as PcnSampleLot[];
      const sampleRoutes = routesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
      const labRequests = requestsResult.rows.map(mapDocumentRow) as OutboundLabRequest[];

      const dossierRoute = sampleRoutes.find((route) => sampleLots.some((lot) => lot.id === route.sampleLotId));
      const dossierRequest = labRequests.find((request) => request.fieldCode === requirement.fieldCode) || labRequests[0];
      if (['SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(kind) && !dossierRoute) {
        throw Object.assign(new Error('Chưa có tuyến mẫu thuộc hồ sơ để sinh tài liệu.'), { statusCode: 409 });
      }
      if (kind === 'LAB_REQUEST' && !dossierRequest) {
        throw Object.assign(new Error('Chưa có PYC thuộc hồ sơ để sinh tài liệu.'), { statusCode: 409 });
      }

      const context = buildPcnDossierDocumentContext({
        dossier,
        proposal,
        fields,
        documents,
        documentRequirements: requirements,
        attachments,
        sampleLots,
        sampleRoutes,
        labRequests,
        ...(kind === 'SAMPLE_CODING' || kind === 'SAMPLE_HANDOVER' || kind === 'SAMPLE_RETURN' ? { sampleRouteId: dossierRoute?.id } : {}),
        ...(kind === 'LAB_REQUEST' ? { labRequestId: dossierRequest?.id } : {}),
      });

      const body = renderPcnNodeGeneratedDocx(kind, context);
      const sha256 = createHash('sha256').update(body).digest('hex');
      const safeDossierId = sanitizePcnPathSegment(dossier.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 36) || 'dossier';
      const safeNodeId = sanitizePcnPathSegment(nodeId).toLowerCase().slice(0, 40) || 'node';
      const kindSlug = kind.toLowerCase().replace(/_/g, '-');
      const generatedId = `pcn-generated-node-${safeDossierId}-${safeNodeId}-${sha256.slice(0, 16)}`;
      const generatedAssetId = `pcn-file-generated-${safeDossierId}-${safeNodeId}-${kindSlug}-${sha256.slice(0, 16)}`;
      const generatedObjectPath = `pcnGenerated/${safeDossierId}/node-work/${safeNodeId}/${sha256}/docx`;
      const fileName = `${sanitizePcnPathSegment(dossier.dossierCode || dossier.id)}-${kindSlug}.docx`;

      const existingAssetResult = await client.query(
        `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [generatedAssetId],
      );
      const existingAsset = existingAssetResult.rows[0];
      if (existingAsset && (
        existingAsset.bucket_name !== bucketName
        || existingAsset.object_path !== generatedObjectPath
        || existingAsset.source_collection !== 'pcnGeneratedDocuments'
        || existingAsset.source_document_id !== generatedId
        || existingAsset.source_json_path !== 'fileAssetId'
        || existingAsset.mime_type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || Number(existingAsset.byte_size) !== body.length
        || String(existingAsset.sha256).toLowerCase() !== sha256
      )) {
        throw new Error('Asset bản sinh node trùng mã nhưng metadata provenance không khớp.');
      }

      if (!existingAsset) {
        await storage.uploadObject({ bucketName, objectPath: generatedObjectPath, body, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        uploadedObjects.push({ bucketName, objectPath: generatedObjectPath });
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, 'pcnGeneratedDocuments', $4, 'fileAssetId', $5, $6, $7)`,
          [generatedAssetId, bucketName, generatedObjectPath, generatedId, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body.length, sha256],
        );
      }

      const now = new Date().toISOString();
      const generated: PcnGeneratedDocument = {
        id: generatedId,
        dossierId: dossier.id,
        kind,
        format: 'DOCX',
        ...(dossierRoute?.id ? { sampleRouteId: dossierRoute.id } : {}),
        ...(dossierRequest?.id ? { labRequestId: dossierRequest.id } : {}),
        fileAssetId: generatedAssetId,
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        byteSize: body.length,
        sha256,
        contextHash: context.contextHash,
        generatedAt: now,
        ...(actor.username ? { generatedBy: actor.username } : {}),
      };

      const generatedWrite = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnGeneratedDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [generatedId, JSON.stringify(getDocumentPayload(generated))],
      );
      const persistedGenerated = generatedWrite.rows[0] ? mapDocumentRow(generatedWrite.rows[0]) as PcnGeneratedDocument : generated;

      const dossierAssetId = `pcn-file-confirm-${createHash('sha256').update(`${dossierId}\u0000${generatedId}\u0000${requirementId}\u0000${sha256}`).digest('hex').slice(0, 32)}`;
      const dossierObjectPath = `pcnFiles/dossierDocuments/${sanitizePcnPathSegment(documentId)}/${sanitizePcnPathSegment(requirementId)}/${dossierAssetId}-${sha256}-${sanitizePcnPathSegment(fileName)}`;
      const previousVersions = Array.isArray(previous.versions) ? previous.versions : [];

      const existingDossierAssetResult = await client.query(
        `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [dossierAssetId],
      );
      const existingDossierAsset = existingDossierAssetResult.rows[0];

      if (previous.currentVersionId) {
        const currentVersion = previousVersions.find((version: any) => version?.assetId === previous.currentVersionId);
        if (!currentVersion?.note?.includes(generatedId)) {
          throw Object.assign(new Error('Tài liệu hiện tại đã tồn tại; hãy dùng thao tác thay phiên bản.'), { statusCode: 409 });
        }
        const existingAttachmentResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierAttachments' AND document_id = $1 LIMIT 1 FOR UPDATE`,
          [`pcn-attachment-generated-${dossierAssetId}`],
        );
        if (!existingDossierAsset || !existingAttachmentResult.rows[0]) {
          throw new Error('Checklist tự gắn đã có phiên nhưng thiếu provenance; cần rà soát trước khi retry.');
        }
        const existingAssetRow = existingDossierAsset;
        return {
          generated: persistedGenerated,
          document: mapDocumentRow(existingDocumentResult.rows[0]) as PcnDossierDocument,
          attachment: mapDocumentRow(existingAttachmentResult.rows[0]) as PcnDossierAttachment,
          dossier,
          asset: {
            id: existingAssetRow.id,
            bucketName: existingAssetRow.bucket_name,
            objectPath: existingAssetRow.object_path,
            sourceCollection: existingAssetRow.source_collection,
            sourceDocumentId: existingAssetRow.source_document_id,
            sourceJsonPath: existingAssetRow.source_json_path,
            mimeType: existingAssetRow.mime_type,
            byteSize: Number(existingAssetRow.byte_size || 0),
            sha256: existingAssetRow.sha256,
          },
          idempotent: true as const,
        };
      }

      if (existingDossierAsset && (
        existingDossierAsset.bucket_name !== bucketName
        || existingDossierAsset.object_path !== dossierObjectPath
        || existingDossierAsset.source_collection !== 'dossierDocuments'
        || existingDossierAsset.source_document_id !== documentId
        || existingDossierAsset.source_json_path !== requirementId
        || existingDossierAsset.mime_type !== generated.mimeType
        || Number(existingDossierAsset.byte_size) !== body.length
        || String(existingDossierAsset.sha256).toLowerCase() !== sha256
      )) {
        throw new Error('Asset checklist tự gắn trùng mã nhưng metadata provenance không khớp.');
      }

      if (!existingDossierAsset) {
        await storage.uploadObject({ bucketName, objectPath: dossierObjectPath, body, mimeType: generated.mimeType });
        uploadedObjects.push({ bucketName, objectPath: dossierObjectPath });
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, 'dossierDocuments', $4, $5, $6, $7, $8)`,
          [dossierAssetId, bucketName, dossierObjectPath, documentId, requirementId, generated.mimeType, body.length, sha256],
        );
      }

      const nextDocument: PcnDossierDocument = {
        ...previous,
        id: documentId,
        dossierId,
        requirementId,
        fieldCode: requirement.fieldCode,
        currentVersionId: dossierAssetId,
        versions: [
          ...previousVersions,
          {
            assetId: dossierAssetId,
            fileName,
            mimeType: generated.mimeType,
            byteSize: body.length,
            sha256,
            uploadedAt: now,
            uploadedBy: actor.username,
            note: `Tự sinh và gắn từ node ${nodeId} (${generatedId}).`,
          },
        ],
        status: 'PRESENT',
        ...(dossier.workflowSnapshot?.requirementDefinitions?.some((item) => item.domain === 'PCN' && item.id === requirement.id) ? { lifecycleStatus: 'GENERATED' as const } : {}),
        createdAt: previous.createdAt || now,
        updatedAt: now,
      };
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('dossierDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [documentId, JSON.stringify(getDocumentPayload(nextDocument))],
      );

      const attachment = buildPcnGeneratedDossierAttachment({ dossierId, requirement, generated: persistedGenerated, assetId: dossierAssetId });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [attachment.id, JSON.stringify(getDocumentPayload(attachment))],
      );

      const workflowRework = await applyPcnDossierDocumentRework(client, dossier, requirement, actor, now);
      const nextDossier: CertificationDossier = { ...workflowRework.dossier, updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [dossierId, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const activityLog = buildActivityLog({
        action: 'CREATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossierId,
        entityLabel: dossier.dossierCode || dossierId,
        actorUsername: actor.username,
        actorName: actor.name || 'Người dùng PCN',
        actorRole: actor.systemRole || actor.role,
        summary: `Tự sinh và gắn ${fileName} vào node ${nodeId}`,
        source: 'USER_REVIEW',
        groupId: generatedId,
        changes: diffActivityFields(dossier, nextDossier, ['updatedAt', 'status']),
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

      const asset = existingDossierAsset || {
        id: dossierAssetId,
        bucket_name: bucketName,
        object_path: dossierObjectPath,
        source_collection: 'dossierDocuments',
        source_document_id: documentId,
        source_json_path: requirementId,
        mime_type: generated.mimeType,
        byte_size: body.length,
        sha256,
      };

      return {
        generated: persistedGenerated,
        document: nextDocument,
        attachment,
        dossier: nextDossier,
        asset: {
          id: asset.id,
          bucketName: asset.bucket_name,
          objectPath: asset.object_path,
          sourceCollection: asset.source_collection,
          sourceDocumentId: asset.source_document_id,
          sourceJsonPath: asset.source_json_path,
          mimeType: asset.mime_type,
          byteSize: Number(asset.byte_size || 0),
          sha256: asset.sha256,
        },
        ...(workflowRework.workflowTasks ? { workflowTasks: workflowRework.workflowTasks } : {}),
        activityLog,
        idempotent: false as const,
      };
    });

    return jsonOk(result, { status: result.idempotent ? 200 : 201 });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      try {
        await getPcnStorageClient().deleteObject(uploaded);
      } catch {
        // preserve original error
      }
    }
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || (message.toLowerCase().includes('không tìm thấy') ? 404 : 400));
  }
}
