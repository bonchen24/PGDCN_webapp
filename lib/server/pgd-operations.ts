import { PoolClient } from 'pg';
import {
  ActivityLog,
  ActivityLogAction,
  ActivityLogChange,
  ActivityLogEntityType,
  PcnUserAccount,
} from '@/types';
import { buildActivityLog } from '@/utils/activityLog';
import { getDocumentPayload } from './collections';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import { hasPgdDossierCapability, type PgdDossierCapability } from '@/utils/pgdDossierCapabilities';
import {
  PgdDocumentTemplate,
  PgdDocumentTemplateKind,
  getPgdDocumentTemplates,
} from '@/utils/pgdDocumentTemplates';
import { getPgdAssignmentApprovalDenial, getPgdPostSignatureMutationDenial, PgdOperationalStationKey, getPgdOperationalStepAccess } from '@/utils/pgdWorkflow';

export { getPgdOperationalStepAccess };

export type PgdActivityInput = {
  action: ActivityLogAction;
  entityId: string;
  entityLabel?: string;
  requestCode?: string;
  summary: string;
  changes?: ActivityLogChange[];
  entityType?: ActivityLogEntityType;
  idSuffix?: string;
  notify?: any;
};

export async function writePgdActivity(
  client: PoolClient,
  actor: PcnUserAccount | null,
  input: PgdActivityInput,
): Promise<ActivityLog> {
  const activityId = `pgd-activity-${input.entityId}-${input.idSuffix || input.action}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const activity = buildActivityLog({
    domain: 'PGD',
    id: activityId,
    actorUsername: actor?.username,
    actorName: actor?.name,
    actorRole: actor?.systemRole || actor?.role,
    action: input.action,
    entityType: input.entityType || 'SYSTEM',
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    requestCode: input.requestCode,
    summary: input.summary,
    changes: input.changes,
    source: 'UI',
    createdAt,
    groupId: input.requestCode || input.entityId,
  });
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    [PGD_COLLECTIONS.activityLogs, activity.id, JSON.stringify({ ...getDocumentPayload(activity), domain: 'pgd' })],
  );
  if (input.notify) {
    const notification = {
      ...input.notify,
      id: `pgd-notif-${activity.id}`,
      domain: 'PGD' as const,
      createdAt: activity.createdAt,
      read: false,
    };
    await client.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id) DO NOTHING`,
      ['notifications', notification.id, JSON.stringify(notification)],
    );
  }
  return activity;
}

export function assertPgdRequestStationMutationAllowed(
  request: PgdInspectionRequest,
  targetStationKey: PgdOperationalStationKey,
): void {
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey });
  if (!access.editable) throw Object.assign(new Error(access.reason || 'Thao tác PGD đang bị khóa theo trạm hồ sơ.'), { statusCode: 409 });
}

export function getPgdGeneratedDocumentStationKey(kind: PgdDocumentTemplateKind): PgdOperationalStationKey {
  if (kind === 'INTAKE_REQUEST') return 'INTAKE_CAPABILITY';
  if (kind === 'ASSIGNMENT' || kind === 'INSPECTION_PLAN') return 'PREPARATION';
  if (
    kind === 'FIELD_INSPECTION'
    || kind === 'SAMPLE_TAKING'
    || kind === 'LAB_REQUEST'
    || kind === 'CASE_TIMELINE'
    || kind === 'FIELD_ACTIVITY_LOG'
    || kind === 'INSPECTION_MINUTES'
    || kind === 'SAMPLE_HANDOVER'
  ) return 'FIELD_SAMPLING';
  if (kind === 'LAB_RESULT_REVIEW') return 'LAB_RESULTS';
  return 'REPORT_APPROVAL_RETURN';
}

export function isPgdDocumentTemplateRecordAllowed(item: any): boolean {
  return Boolean(item && typeof item === 'object' && item.id && item.kind && item.domain === 'pgd');
}

export function normalizePgdDocumentTemplate(item: any): PgdDocumentTemplate {
  return {
    ...item,
    id: String(item.id),
    code: String(item.code || item.id),
    name: String(item.name || item.code || item.id),
    kind: item.kind,
    version: Number(item.version || 1),
    active: item.active !== false,
    status: item.status || 'ACTIVE',
  } as PgdDocumentTemplate;
}

export function getPgdDocumentTemplate(
  kind: PgdDocumentTemplateKind,
  productGroup?: string,
  method?: string,
): PgdDocumentTemplate | undefined {
  const templates = getPgdDocumentTemplates();
  return templates.find((t) => t.kind === kind);
}

export function assertPgdRequestEvidenceMutationAllowed(request: PgdInspectionRequest): void {
  const denial = getPgdPostSignatureMutationDenial(request.status);
  if (denial) throw Object.assign(new Error(denial), { statusCode: 409 });
}

export async function assertPgdAssessmentRoundAllowed(
  client: any,
  request: PgdInspectionRequest,
  assessmentRoundId: string | undefined,
  actor: PcnUserAccount,
  capability: PgdDossierCapability = 'ASSESSOR',
): Promise<any | undefined> {
  const isV2 = request.workflowSchemaVersion === 2 || request.workflowSnapshot?.workflowSchemaVersion === 2;
  const roundId = String(assessmentRoundId || '').trim();
  if (!isV2 && !roundId) return undefined;
  if (!roundId) throw Object.assign(new Error('Cần chọn đợt đánh giá đang mở cho hồ sơ workflow v2.'), { statusCode: 400 });
  const roundResult = await client.query(
    `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'requestId' = $3 AND data->>'status' = 'OPEN' AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
    [PGD_COLLECTIONS.assessmentRounds, roundId, request.id],
  );
  if (!roundResult.rows[0]) throw Object.assign(new Error('Đợt đánh giá đã đóng hoặc không thuộc hồ sơ này.'), { statusCode: 409 });
  if (request.currentAssessmentRoundId && request.currentAssessmentRoundId !== roundId) throw Object.assign(new Error('Chỉ có thể cập nhật bằng chứng của đợt đánh giá hiện hành.'), { statusCode: 409 });
  const manager = !getPgdAssignmentApprovalDenial('APPROVED', actor);
  if (!manager) {
    const assignmentResult = await client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.assignments, request.id]);
    const assignment = assignmentResult.rows[0]?.data;
    if (!hasPgdDossierCapability(assignment, actor.username, capability) && !hasPgdDossierCapability(assignment, actor.username, 'TEAM_LEAD')) {
      throw Object.assign(new Error('Tài khoản chưa được phân công capability thao tác đợt đánh giá này.'), { statusCode: 403 });
    }
  }
  return roundResult.rows[0].data;
}

export async function readPgdTransitionContext(client: any, requestId: string, assessmentRoundId?: string): Promise<any> {
  const [assignmentResult, fieldResult, sampleResult, labResult, reportResult, certificateResult, labReviewResult, planResult, roundResult] = await Promise.all([
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.assignments, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.fieldInspections, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY document_id`, [PGD_COLLECTIONS.samples, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY document_id`, [PGD_COLLECTIONS.labRequests, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.reports, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.certificates, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC`, [PGD_COLLECTIONS.labResultReviews, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.inspectionPlans, requestId]),
    client.query(`SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY document_id`, [PGD_COLLECTIONS.assessmentRounds, requestId]),
  ]);
  const assignments = assignmentResult.rows.map((row: any) => row.data || {});
  const allFields = fieldResult.rows.map((row: any) => row.data || {});
  const allSamples = sampleResult.rows.map((row: any) => row.data || {});
  const allLabRequests = labResult.rows.map((row: any) => row.data || {});
  const reports = reportResult.rows.map((row: any) => row.data || {});
  const certificates = certificateResult.rows.map((row: any) => row.data || {});
  const fields = assessmentRoundId ? allFields.filter((field: any) => field.assessmentRoundId === assessmentRoundId) : allFields;
  const samples = assessmentRoundId ? allSamples.filter((sample: any) => sample.assessmentRoundId === assessmentRoundId) : allSamples;
  const labRequests = assessmentRoundId ? allLabRequests.filter((item: any) => item.assessmentRoundId === assessmentRoundId) : allLabRequests;
  const labSamples = samples.filter((sample: any) => sample.disposition === 'LAB');
  const labReview = labReviewResult.rows.map((row: any) => row.data || {}).find((review: any) => !assessmentRoundId || review.assessmentRoundId === assessmentRoundId);
  return {
    hasApprovedAssignment: assignments.some((assignment: any) => assignment.status === 'APPROVED'),
    hasFieldInspection: fields.some((inspection: any) => inspection.completed === true),
    hasSampleHandover: labSamples.length > 0 && labSamples.every((sample: any) => Boolean(sample.handedOverAt)),
    labRequests,
    reportReady: reports.some((report: any) => Boolean(String(report.conclusion || '').trim()) && ['DRAFT', 'APPROVED'].includes(report.status)),
    hasCertificate: certificates.length > 0,
    signed: certificates.some((certificate: any) => certificate.status === 'SIGNED' && Boolean(certificate.signedAt)),
    hasAcceptedPlan: planResult.rows.some((row: any) => row.data?.acceptance?.status === 'ACCEPTED'),
    hasOpenAssessmentRounds: roundResult.rows.some((row: any) => row.data?.status === 'OPEN'),
    labResultReview: labReview
      ? {
          status: labReview.status,
          conformity: labReview.conformity,
          retestRequired: labReview.retestRequired === true,
        }
      : undefined,
  };
}

export async function getPgdArtifactRequest(client: any, requestId: string, stationKey: PgdOperationalStationKey): Promise<PgdInspectionRequest> {
  const { mapDocumentRow } = require('./collections');
  const result = await client.query(
    `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
    [PGD_COLLECTIONS.requests, requestId],
  );
  if (!result.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của biểu mẫu.'), { statusCode: 404 });
  const request = mapDocumentRow(result.rows[0]) as PgdInspectionRequest;
  assertPgdRequestEvidenceMutationAllowed(request);
  assertPgdRequestStationMutationAllowed(request, stationKey);
  return request;
}

export async function persistPgdArtifact(client: any, collection: string, artifact: { id: string; domain: 'pgd'; requestId: string }): Promise<void> {
  const existing = await client.query(
    `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
    [collection, artifact.id],
  );
  const existingData = existing.rows[0]?.data as Record<string, any> | undefined;
  if (existingData && (existingData.domain !== 'pgd' || existingData.requestId !== artifact.requestId)) {
    throw Object.assign(new Error('Không thể ghi đè artifact PGD thuộc miền khác hoặc hồ sơ PGD khác.'), { statusCode: 409 });
  }
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
    [collection, artifact.id, JSON.stringify(getDocumentPayload(artifact))],
  );
}

export type PgdDossierPackageSnapshot = {
  manifest: any;
  assetsById: Map<string, any>;
};

export async function buildPgdDossierPackageSnapshot(
  client: any,
  request: PgdInspectionRequest,
  now = new Date().toISOString(),
): Promise<PgdDossierPackageSnapshot> {
  const { mapDocumentRow } = require('./collections');
  const { reconcilePgdDossierChecklist } = require('@/utils/pgdDossier');
  const { buildPgdDossierPackageManifest } = require('@/utils/pgdDossierPackage');

  const dossierResult = await client.query(
    `SELECT document_id, data
       FROM (
         SELECT document_id, data,
                ROW_NUMBER() OVER (
                  PARTITION BY data->>'requirementCode', COALESCE(data->>'assessmentRoundId', '')
                  ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC
                ) AS current_row
           FROM app_documents
          WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd'
       ) current_documents
      WHERE current_row = 1
      ORDER BY data->>'requirementCode', COALESCE(data->>'assessmentRoundId', ''), document_id`,
    [PGD_COLLECTIONS.dossierDocuments, request.id],
  );
  const dossierDocuments = dossierResult.rows.map((row: any) => mapDocumentRow(row));
  const generatedDocumentIds = Array.from(
    new Set(
      dossierDocuments
        .filter((document: any) => document.originCollection === PGD_COLLECTIONS.documents && document.originDocumentId)
        .map((document: any) => document.originDocumentId!),
    ),
  );
  const generatedResult =
    generatedDocumentIds.length > 0
      ? await client.query(
          `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = ANY($2::text[]) AND data->>'domain' = 'pgd'`,
          [PGD_COLLECTIONS.documents, generatedDocumentIds],
        )
      : { rows: [] as any[] };
  const generatedDocumentsById = new Map<string, any>(
    generatedResult.rows.map((row: any) => {
      const document = mapDocumentRow(row);
      return [document.id, document];
    }),
  );
  const pointers: any[] = [];
  for (const document of dossierDocuments) {
    const generated = document.originDocumentId ? generatedDocumentsById.get(document.originDocumentId) : undefined;
    if (document.originCollection === PGD_COLLECTIONS.documents && (!generated || generated.requestId !== request.id)) {
      throw Object.assign(new Error(`Tài liệu checklist ${document.id} thiếu tài liệu sinh nguồn hợp lệ.`), { statusCode: 409 });
    }
    if (
      generated &&
      (document.checksum.toLowerCase() !== generated.sha256.toLowerCase() ||
        Number(document.byteSize) !== Number(generated.byteSize) ||
        String(document.fileAssetId || '') !== String(generated.fileAssetId || ''))
    ) {
      throw Object.assign(new Error(`Tài liệu checklist ${document.id} không khớp snapshot tài liệu sinh.`), { statusCode: 409 });
    }
    pointers.push({
      id: document.id,
      domain: 'pgd',
      requestId: request.id,
      ...(document.assessmentRoundId ? { assessmentRoundId: document.assessmentRoundId } : {}),
      fileName: document.fileName,
      sourceCollection: document.originCollection || PGD_COLLECTIONS.dossierDocuments,
      sourceDocumentId: document.originDocumentId || document.id,
      version: document.version,
      checksum: document.checksum,
      ...(document.fileAssetId ? { fileAssetId: document.fileAssetId } : {}),
      ...(document.mimeType ? { mimeType: document.mimeType } : {}),
      ...(Number.isFinite(document.byteSize) ? { byteSize: document.byteSize } : {}),
      kind: generated ? 'GENERATED_DOCUMENT' : 'DOSSIER_DOCUMENT',
      ...(generated?.contextHash ? { contextHash: generated.contextHash } : {}),
    });
  }
  const checklist = reconcilePgdDossierChecklist(request.productGroup, request.dossierChecklist, dossierDocuments, now);
  const candidateManifest = buildPgdDossierPackageManifest({
    dossierCode: request.requestCode,
    ownerUsername: request.ownerUsername,
    now,
    pointers,
    checklist,
  });
  if (!candidateManifest.complete) return { manifest: candidateManifest, assetsById: new Map() };

  const assetIds = candidateManifest.entries.map((entry: any) => entry.assetId);
  const assetResult =
    assetIds.length > 0
      ? await client.query(
          `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = ANY($1::text[])`,
          [assetIds],
        )
      : { rows: [] as any[] };
  const assetsById = new Map<string, any>(assetResult.rows.map((asset: any) => [String(asset.id), asset] as [string, any]));
  for (const entry of candidateManifest.entries) {
    const asset = assetsById.get(entry.assetId);
    const expectedSourceJsonPath = entry.sourceCollection === PGD_COLLECTIONS.documents ? 'output' : 'fileAssetId';
    if (
      !asset ||
      String(asset.source_collection || '') !== entry.sourceCollection ||
      String(asset.source_document_id || '') !== entry.sourceDocumentId ||
      String(asset.source_json_path || '') !== expectedSourceJsonPath ||
      String(asset.sha256 || '').toLowerCase() !== entry.checksum ||
      Number(asset.byte_size) !== entry.byteSize
    ) {
      throw Object.assign(new Error(`Provenance file asset ${entry.assetId} không khớp hồ sơ PGD.`), {
        statusCode: 409,
        assetId: entry.assetId,
        manifest: candidateManifest,
      });
    }
  }
  const verifiedPointers = pointers.map((pointer) => {
    const asset = assetsById.get(String(pointer.fileAssetId));
    return {
      ...pointer,
      mimeType: String(asset?.mime_type || pointer.mimeType || 'application/octet-stream'),
      byteSize: Number(asset?.byte_size ?? pointer.byteSize ?? 0),
      checksum: String(asset?.sha256 || pointer.checksum).trim().toLowerCase(),
    };
  });
  return {
    manifest: buildPgdDossierPackageManifest({
      dossierCode: request.requestCode,
      ownerUsername: request.ownerUsername,
      now,
      pointers: verifiedPointers,
      checklist,
    }),
    assetsById,
  };
}

