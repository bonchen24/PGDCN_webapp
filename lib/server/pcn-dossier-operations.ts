import { createHash } from 'node:crypto';
import { PoolClient } from 'pg';
import {
  CertificationDossier,
  IssuancePackage,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnDraftWorkspace,
  PcnGeneratedDocument,
  PcnGeneratedDocumentKind,
  PcnUserAccount,
} from '@/types';
import { getDocumentPayload, mapDocumentRow } from './collections';
import { getPcnDossierOperatorDenial } from '@/utils/pcnDossierAssignment';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { getPcnWorkflowForDossier } from '@/utils/pcnWorkflowTemplate';
import { applyPcnWorkflowDocumentRework } from '@/utils/pcnWorkflowRuntime';
import {
  canProcessPcnDossierRequirement,
  getPcnRequirementReopenStatus,
  getPcnRequirementWorkflowStageIndex,
} from '@/utils/pcnDossierStageGate';
import { getPcnWorkflowStage, getPcnWorkflowStageIndex } from '@/utils/pcnWorkflowStages';
import {
  buildPcnAssignmentFormDocx,
  buildPcnDossierDocumentContext,
  buildPcnEvaluationPlanDocx,
  buildPcnFieldInspectionDocx,
  buildPcnLabRequestDocx,
  buildPcnProposalFormDocx,
  buildPcnSampleCodingDocx,
  buildPcnSampleHandoverDocx,
  buildPcnSampleReturnDocx,
} from '@/utils/pcnDocumentGeneration';
import { renderPcnOperationalTemplateDocx } from '@/utils/pcnOperationalTemplateGeneration';
import { sanitizePcnPathSegment } from './pcn-files';
import {
  buildPcnDossierDocumentId,
  buildPcnGeneratedDossierAttachment,
  getPcnDraftFormRequirementCode,
  getPcnGeneratedDocumentRequirementCode,
} from '@/utils/pcnDossierDocuments';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { getPcnEffectiveApprovalSteps } from '@/utils/pcnApproval';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { getPcnStorageBucket, getPcnStorageClient, PCN_FILE_MAX_BYTES } from './storage';

export function assertPcnDossierOperator(
  dossier: Pick<CertificationDossier, 'ownerUsername'>,
  actor: PcnUserAccount,
): void {
  const denial = getPcnDossierOperatorDenial({
    ownerUsername: dossier.ownerUsername,
    actorUsername: actor.username,
    actorIsSystemManager: isPcnSystemManager(actor),
  });
  if (denial) throw Object.assign(new Error(denial), { statusCode: 403 });
}

export async function assertPcnDossierNodeOperator(
  client: PoolClient,
  dossier: CertificationDossier,
  requirementId: string,
  actor: PcnUserAccount,
): Promise<void> {
  if (isPcnSystemManager(actor) || String(dossier.ownerUsername || '').trim().toLowerCase() === String(actor.username || '').trim().toLowerCase()) return;
  const node = dossier.workflowSnapshot?.nodes.find((candidate) => candidate.active !== false && candidate.requirementIds.includes(requirementId));
  if (!node) throw Object.assign(new Error('Tài liệu không thuộc node workflow được phép xử lý.'), { statusCode: 403 });
  const taskResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnDossierWorkflowTasks'
       AND data->>'dossierId' = $1 AND data->>'nodeId' = $2
     LIMIT 1 FOR UPDATE`,
    [dossier.id, node.id],
  );
  const task = taskResult.rows[0] ? mapDocumentRow(taskResult.rows[0]) as PcnDossierWorkflowTask : undefined;
  if (task?.assignedUsername && String(task.assignedUsername).trim().toLowerCase() === String(actor.username || '').trim().toLowerCase()) return;
  throw Object.assign(new Error('Bạn không được phân công node tài liệu này.'), { statusCode: 403 });
}

export async function applyPcnDossierDocumentRework(
  client: PoolClient,
  dossier: CertificationDossier,
  requirement: PcnDocumentRequirement,
  actor: PcnUserAccount,
  now: string,
): Promise<{ dossier: CertificationDossier; workflowTasks?: PcnDossierWorkflowTask[]; reopenedNodeId?: string }> {
  if (!dossier.workflowSnapshot) return { dossier };
  const node = dossier.workflowSnapshot.nodes.find((candidate) => candidate.active !== false && candidate.requirementIds.includes(requirement.id));
  if (!node) return { dossier };
  const taskResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1 ORDER BY document_id FOR UPDATE`, [dossier.id]);
  const currentTasks = taskResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierWorkflowTask);
  const sourceTask = currentTasks.find((task) => task.nodeId === node.id);
  if (!sourceTask || !['COMPLETED', 'SKIPPED'].includes(sourceTask.status)) return { dossier, workflowTasks: currentTasks };
  const workflow = getPcnWorkflowForDossier(dossier);
  const rework = applyPcnWorkflowDocumentRework({ workflow, tasks: currentTasks, sourceNodeId: node.id, actor: actor.username, now });
  for (const nextTask of rework.tasks) {
    await client.query(
      `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnDossierWorkflowTasks' AND document_id = $1`,
      [nextTask.id, JSON.stringify(getDocumentPayload(nextTask))],
    );
  }
  const reopenStatus = getPcnRequirementReopenStatus(requirement);
  const currentStageIndex = getPcnWorkflowStageIndex(getPcnWorkflowStage(dossier.status)?.key || 'INTAKE');
  const requirementStageIndex = getPcnRequirementWorkflowStageIndex(requirement);
  const shouldRollback = Boolean(reopenStatus && requirementStageIndex >= 0 && requirementStageIndex < currentStageIndex);
  return {
    dossier: { ...dossier, ...(shouldRollback ? { status: reopenStatus } : {}), updatedAt: now },
    workflowTasks: rework.tasks,
    reopenedNodeId: node.id,
  };
}

export function renderPcnNodeGeneratedDocx(
  kind: PcnGeneratedDocumentKind,
  context: ReturnType<typeof buildPcnDossierDocumentContext>,
): Buffer {
  const templated = renderPcnOperationalTemplateDocx(kind, context);
  if (templated) return templated;
  switch (kind) {
    case 'PROPOSAL_FORM': return buildPcnProposalFormDocx(context);
    case 'ASSIGNMENT_FORM': return buildPcnAssignmentFormDocx(context);
    case 'EVALUATION_PLAN': return buildPcnEvaluationPlanDocx(context);
    case 'FIELD_INSPECTION': return buildPcnFieldInspectionDocx(context);
    case 'SAMPLE_CODING': return buildPcnSampleCodingDocx(context);
    case 'SAMPLE_HANDOVER': return buildPcnSampleHandoverDocx(context);
    case 'SAMPLE_RETURN': return buildPcnSampleReturnDocx(context);
    case 'LAB_REQUEST': return buildPcnLabRequestDocx(context);
    default: throw Object.assign(new Error('Mục tài liệu này chưa có biểu mẫu sinh tự động.'), { statusCode: 400 });
  }
}

export interface ConfirmDocumentParams {
  actor: PcnUserAccount;
  dossierId: string;
  requirementId: string;
  generatedDocumentId?: string;
  draftId?: string;
  outputId?: string;
  nodeId?: string;
}

export async function executeConfirmPcnDossierDocument(
  client: PoolClient,
  params: ConfirmDocumentParams,
  uploadedObjects: Array<{ bucketName: string; objectPath: string }>,
) {
  const { actor, dossierId, requirementId, generatedDocumentId, draftId, outputId, nodeId } = params;
  const confirmingDraftOutput = Boolean(draftId || outputId);

  const storage = getPcnStorageClient();
  const bucketName = getPcnStorageBucket();
  await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);

  const dossierResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'certificationDossiers' AND document_id = $1
     LIMIT 1 FOR UPDATE`,
    [dossierId],
  );
  if (dossierResult.rows.length === 0) throw new Error('Không tìm thấy hồ sơ PCN.');
  const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
  if (isPcnDossierPostApprovalLocked(dossier.status)) {
    throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi xác nhận tài liệu.'), { statusCode: 409 });
  }
  if (!confirmingDraftOutput) assertPcnDossierOperator(dossier, actor);
  const dossierFieldCodes = Array.isArray(dossier.fieldCodes)
    ? dossier.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean)
    : [];

  const requirementResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnDocumentRequirements' AND document_id = $1
     LIMIT 1`,
    [requirementId],
  );
  const requirement = requirementResult.rows[0]
    ? mapDocumentRow(requirementResult.rows[0]) as PcnDocumentRequirement
    : undefined;
  const requirementCode = String(requirement?.code || '').trim().toUpperCase();
  const requirementFieldCode = String(requirement?.fieldCode || '').trim().toUpperCase();
  if (!requirement || requirement.active !== true || !requirementCode || !dossierFieldCodes.includes(requirementFieldCode)) {
    throw new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ PCN.');
  }
  if (confirmingDraftOutput) {
    if (String(nodeId || '').trim()) await assertPcnDossierNodeOperator(client, dossier, requirementId, actor);
    else assertPcnDossierOperator(dossier, actor);
  }
  if (!canProcessPcnDossierRequirement(dossier, requirement)) {
    throw Object.assign(new Error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.'), { statusCode: 409 });
  }

  let generated: PcnGeneratedDocument;
  let generatedAssetSourceCollection = 'pcnGeneratedDocuments';
  let generatedAssetSourceDocumentId = '';
  let generatedAssetSourceJsonPath = 'fileAssetId';
  let expectedRequirementCode: string | undefined;

  if (confirmingDraftOutput) {
    const draftResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDraftWorkspaces' AND document_id = $1
       LIMIT 1 FOR UPDATE`,
      [draftId],
    );
    if (draftResult.rows.length === 0) throw new Error('Không tìm thấy bản soạn thảo PCN.');
    const draft = mapDocumentRow(draftResult.rows[0]) as PcnDraftWorkspace;
    if (draft.sourceDossierId !== dossierId) throw new Error('Bản soạn thảo không thuộc hồ sơ PCN đang mở.');
    const output = draft.outputs?.find((candidate) => candidate.id === outputId);
    if (!output) throw new Error('Không tìm thấy file đầu ra của bản soạn thảo.');
    const syntheticKind = (draft.formKind === 'CERTIFICATION_RESULT' ? 'EVALUATION_REPORT' : draft.formKind === 'COMMERCIAL' || draft.formKind === 'CLIENT_PACKAGE' ? 'DOSSIER_COVER' : draft.formKind) as PcnGeneratedDocumentKind;
    generated = { id: `pcn-draft-output-${draft.id}-${output.id}`, dossierId, kind: syntheticKind, format: output.format, fileAssetId: output.fileAssetId, fileName: output.fileName, mimeType: output.mimeType, byteSize: output.byteSize, sha256: output.sha256, contextHash: output.sha256, generatedAt: output.generatedAt, generatedBy: draft.updatedByUsername };
    generatedAssetSourceCollection = 'pcnDraftWorkspaces';
    generatedAssetSourceDocumentId = draft.id;
    generatedAssetSourceJsonPath = 'outputs';
    expectedRequirementCode = getPcnDraftFormRequirementCode(draft.formKind);
    if (!expectedRequirementCode || requirementCode !== expectedRequirementCode) throw new Error('Bản soạn không có ánh xạ 1-1 với mã tài liệu checklist đã chọn.');
  } else {
    const generatedResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnGeneratedDocuments'
         AND document_id = $1
         AND data->>'dossierId' = $2
       LIMIT 1 FOR UPDATE`,
      [generatedDocumentId, dossierId],
    );
    if (generatedResult.rows.length === 0) throw new Error('Không tìm thấy bản sinh thuộc hồ sơ PCN.');
    generated = mapDocumentRow(generatedResult.rows[0]) as PcnGeneratedDocument;
    expectedRequirementCode = getPcnGeneratedDocumentRequirementCode(generated.kind);
  }

  if (!expectedRequirementCode || requirementCode !== expectedRequirementCode) {
    throw new Error('Bản sinh không có ánh xạ 1-1 với mã tài liệu checklist đã chọn.');
  }
  if (generated.dossierId !== dossier.id || !String(generated.fileAssetId || '').trim() || !generated.fileName || !generated.sha256 || !/^[a-f0-9]{64}$/i.test(generated.sha256)) {
    throw new Error('Metadata bản sinh không hợp lệ hoặc không thuộc hồ sơ PCN.');
  }
  const expectedMimeType = generated.format === 'PDF'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (!['DOCX', 'PDF'].includes(generated.format) || generated.mimeType !== expectedMimeType || !Number.isFinite(Number(generated.byteSize)) || Number(generated.byteSize) <= 0) {
    throw new Error('Metadata định dạng bản sinh không hợp lệ.');
  }

  const generatedAssetResult = await client.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
     FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
    [generated.fileAssetId],
  );
  const generatedAsset = generatedAssetResult.rows[0];
  if (!generatedAsset
    || generatedAsset.bucket_name !== bucketName
    || generatedAsset.source_collection !== generatedAssetSourceCollection
    || generatedAsset.source_document_id !== (confirmingDraftOutput ? generatedAssetSourceDocumentId : generated.id)
    || generatedAsset.source_json_path !== generatedAssetSourceJsonPath
    || generatedAsset.mime_type !== generated.mimeType
    || Number(generatedAsset.byte_size) !== Number(generated.byteSize)
    || String(generatedAsset.sha256).toLowerCase() !== String(generated.sha256).toLowerCase()) {
    throw new Error('Asset bản sinh không khớp metadata provenance; không thể xác nhận vào checklist.');
  }

  const documentId = buildPcnDossierDocumentId(dossierId, requirementId);
  const existingDocumentResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'dossierDocuments' AND document_id = $1
     LIMIT 1 FOR UPDATE`,
    [documentId],
  );
  const previous = existingDocumentResult.rows[0]?.data || {};
  const previousVersions = Array.isArray(previous.versions) ? previous.versions : [];
  const confirmationNote = `Xác nhận từ bản sinh ${generated.id}.`;
  const confirmationFingerprint = createHash('sha256')
    .update(`${dossierId}\u0000${generated.id}\u0000${requirementId}\u0000${generated.sha256}`)
    .digest('hex');
  const assetId = `pcn-file-confirm-${confirmationFingerprint.slice(0, 32)}`;
  const safeFileName = sanitizePcnPathSegment(generated.fileName);
  const objectPath = `pcnFiles/dossierDocuments/${sanitizePcnPathSegment(documentId)}/${sanitizePcnPathSegment(requirementId)}/${assetId}-${generated.sha256}-${safeFileName}`;

  const assetResult = await client.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
     FROM file_assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
    [assetId],
  );
  const existingAsset = assetResult.rows[0];
  if (existingAsset && (
    existingAsset.bucket_name !== bucketName
    || existingAsset.object_path !== objectPath
    || existingAsset.source_collection !== 'dossierDocuments'
    || existingAsset.source_document_id !== documentId
    || existingAsset.source_json_path !== requirementId
    || existingAsset.mime_type !== generated.mimeType
    || Number(existingAsset.byte_size) !== Number(generated.byteSize)
    || String(existingAsset.sha256).toLowerCase() !== String(generated.sha256).toLowerCase()
  )) {
    throw new Error('Asset checklist xác nhận trùng mã nhưng metadata provenance không khớp.');
  }

  const attachmentId = `pcn-attachment-generated-${assetId}`;
  const existingAttachmentResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'dossierAttachments' AND document_id = $1
     LIMIT 1 FOR UPDATE`,
    [attachmentId],
  );
  const existingAttachment = existingAttachmentResult.rows[0]
    ? mapDocumentRow(existingAttachmentResult.rows[0]) as PcnDossierAttachment
    : undefined;

  const hasVersion = previousVersions.some((version: any) => String(version?.assetId || '') === assetId || String(version?.note || '') === confirmationNote);
  if (hasVersion && existingAttachment && existingAsset) {
    return {
      document: mapDocumentRow(existingDocumentResult.rows[0]),
      asset: {
        id: existingAsset.id,
        bucketName: existingAsset.bucket_name,
        objectPath: existingAsset.object_path,
        sourceCollection: existingAsset.source_collection,
        sourceDocumentId: existingAsset.source_document_id,
        sourceJsonPath: existingAsset.source_json_path,
        mimeType: existingAsset.mime_type,
        byteSize: Number(existingAsset.byte_size || 0),
        sha256: existingAsset.sha256,
      },
      dossier,
      attachment: existingAttachment,
      idempotent: true as const,
    };
  }

  let asset = existingAsset;
  if (!asset) {
    const downloaded = await storage.downloadObject({ bucketName: generatedAsset.bucket_name, objectPath: generatedAsset.object_path });
    const downloadedSha256 = createHash('sha256').update(downloaded.body).digest('hex');
    if (downloaded.body.length !== Number(generated.byteSize) || downloadedSha256.toLowerCase() !== String(generated.sha256).toLowerCase()) {
      throw new Error('Bytes bản sinh trong Storage không khớp SHA-256 hoặc byte size đã ghi.');
    }
    await storage.uploadObject({ bucketName, objectPath, body: downloaded.body, mimeType: generated.mimeType });
    uploadedObjects.push({ bucketName, objectPath });
    await client.query(
      `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
       VALUES ($1, $2, $3, 'dossierDocuments', $4, $5, $6, $7, $8)`,
      [assetId, bucketName, objectPath, documentId, requirementId, generated.mimeType, downloaded.body.length, downloadedSha256],
    );
    asset = {
      id: assetId,
      bucket_name: bucketName,
      object_path: objectPath,
      source_collection: 'dossierDocuments',
      source_document_id: documentId,
      source_json_path: requirementId,
      mime_type: generated.mimeType,
      byte_size: downloaded.body.length,
      sha256: downloadedSha256,
    };
  }

  const now = new Date().toISOString();
  let persistedDocument: PcnDossierDocument;
  if (hasVersion && existingDocumentResult.rows.length > 0) {
    persistedDocument = mapDocumentRow(existingDocumentResult.rows[0]) as PcnDossierDocument;
  } else {
    const version = {
      assetId,
      fileName: generated.fileName.slice(0, 255),
      mimeType: generated.mimeType,
      byteSize: Number(generated.byteSize),
      sha256: generated.sha256,
      uploadedAt: now,
      uploadedBy: actor.username,
      note: confirmationNote,
    };
    const next = {
      ...previous,
      dossierId,
      requirementId,
      fieldCode: requirementFieldCode,
      currentVersionId: assetId,
      versions: [...previousVersions, version],
      status: 'PRESENT',
      createdAt: previous.createdAt || now,
      updatedAt: now,
    };
    const write = await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ('dossierDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
       RETURNING document_id, data`,
      [documentId, JSON.stringify(getDocumentPayload(next))],
    );
    persistedDocument = mapDocumentRow(write.rows[0]) as PcnDossierDocument;
  }

  const generatedAttachment = existingAttachment || buildPcnGeneratedDossierAttachment({ dossierId, requirement, generated, assetId });
  if (!existingAttachment) {
    await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ('dossierAttachments', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
      [generatedAttachment.id, JSON.stringify(getDocumentPayload(generatedAttachment))],
    );
  }

  const workflowRework = await applyPcnDossierDocumentRework(client, dossier, requirement!, actor, now);
  const currentStageIndex = getPcnWorkflowStageIndex(getPcnWorkflowStage(dossier.status)?.key || 'INTAKE');
  const requirementStageIndex = getPcnRequirementWorkflowStageIndex(requirement!);
  const needsDownstreamReview = dossier.status === 'WAITING_APPROVAL'
    && requirementStageIndex >= 0
    && requirementStageIndex < currentStageIndex;
  const reopenStatus = getPcnRequirementReopenStatus(requirement!) || 'TECHNICAL_REVIEW';
  let nextApprovalSteps: PcnApprovalStep[] | undefined;

  if (needsDownstreamReview) {
    const approvalResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
       ORDER BY COALESCE((data->>'sequence')::int, 999), document_id
       FOR UPDATE`,
      [dossier.id],
    );
    const allSteps = approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
    const effectiveStepIds = new Set(getPcnEffectiveApprovalSteps(allSteps).map((step) => step.id));
    nextApprovalSteps = allSteps.map((step) => effectiveStepIds.has(step.id)
      ? { ...step, status: 'PENDING' as const, actedAt: undefined }
      : step);
    for (const step of nextApprovalSteps) {
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'approvalSteps' AND document_id = $1`,
        [step.id, JSON.stringify(getDocumentPayload(step))],
      );
    }
    const issuanceResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1
       LIMIT 1 FOR UPDATE`,
      [dossier.id],
    );
    if (issuanceResult.rows[0]) {
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;
      const nextIssuance: IssuancePackage = { ...issuance, status: 'RETURNED', updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'issuancePackages' AND document_id = $1`,
        [nextIssuance.id, JSON.stringify(getDocumentPayload(nextIssuance))],
      );
    }
  }

  const nextDossier: CertificationDossier = {
    ...workflowRework.dossier,
    ...(needsDownstreamReview ? { status: reopenStatus } : {}),
    updatedAt: now,
  };
  await client.query(
    `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
    [dossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
  );

  const log = buildActivityLog({
    action: 'UPDATED',
    entityType: 'PCN_DOSSIER',
    entityId: dossierId,
    entityLabel: dossier.dossierCode || dossierId,
    actorUsername: actor.username,
    actorName: actor.name || 'Người dùng PCN',
    actorRole: actor.systemRole || actor.role,
    summary: needsDownstreamReview
      ? `Xác nhận bản sinh ${generated.fileName.slice(0, 120)} và mở lại ${getPcnWorkflowStage(reopenStatus)?.title || 'bước bị ảnh hưởng'} để rà soát`
      : workflowRework.reopenedNodeId
        ? `Xác nhận bản sinh ${generated.fileName.slice(0, 120)} và mở lại node ${workflowRework.reopenedNodeId} theo vòng xử lý mới`
      : `Xác nhận bản sinh ${generated.fileName.slice(0, 120)} vào checklist ${requirement.name}`,
    source: 'USER_REVIEW',
    groupId: dossier.id,
    changes: diffActivityFields(dossier, nextDossier, ['updatedAt']),
    createdAt: now,
  });
  const validationError = validateActivityLogPayload(log);
  if (validationError) throw new Error(validationError);
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [log.id, JSON.stringify(getDocumentPayload(log))],
  );

  return {
    document: persistedDocument,
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
    dossier: nextDossier,
    attachment: generatedAttachment,
    ...(nextApprovalSteps ? { approvalSteps: nextApprovalSteps } : {}),
    ...(workflowRework.workflowTasks ? { workflowTasks: workflowRework.workflowTasks } : {}),
    activityLog: log,
    idempotent: false as const,
  };
}
