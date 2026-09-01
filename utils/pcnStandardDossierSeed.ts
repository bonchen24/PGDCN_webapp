// Author: Codex
// OS support: Node maintenance command and tests only
// Description: Add-only seed plans for inspecting source-surveyed PCN dossiers in the active app.

import { createHash } from 'node:crypto';

import type {
  ActivityLog,
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  OutboundLabRequest,
  PcnApprovalStep,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnSampleFlowEvent,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { buildActivityLog } from './activityLog.ts';
import { buildPcnDossierDocumentId, buildPcnUploadedDossierAttachment, getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import { buildPcnSampleFlowEvent } from './pcnSampleFlow.ts';
import { buildPcnStandardDossierFlow, type PcnStandardDossierFixture } from './pcnStandardDossierFlow.ts';

export const PCN_STANDARD_SEED_NAMESPACE = 'pcnStandardTest';
const SEED_UPLOADED_AT = '2026-08-31T07:30:00.000Z';

export interface PcnStandardSeedSourceFile {
  sourceFileName: string;
  sourceRelativePath: string;
  /** Used only by the maintenance command while reading the source folder. */
  absolutePath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

export interface PcnStandardSeedAsset {
  assetId: string;
  bucketName: string;
  objectPath: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceCollection: 'dossierDocuments' | 'dossierAttachments' | 'returnedResults';
  sourceDocumentId: string;
  sourceJsonPath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

export interface PcnStandardSeedRecord {
  action: 'INSERT_OR_VERIFY';
  collectionName: string;
  documentId: string;
  data: Record<string, unknown>;
}

export interface PcnStandardDossierSeedPlan {
  namespace: typeof PCN_STANDARD_SEED_NAMESPACE;
  fixture: PcnStandardDossierFixture;
  checkpoint: 'TECHNICAL_REVIEW' | 'WAITING_APPROVAL';
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  documents: PcnDossierDocument[];
  attachments: PcnDossierAttachment[];
  sampleLot: PcnSampleLot;
  sampleRoutes: PcnSampleRoute[];
  sampleFlowEvents: PcnSampleFlowEvent[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  approvalSteps: PcnApprovalStep[];
  issuance?: IssuancePackage;
  waivedRequirementIds: string[];
  activityLog: ActivityLog;
  assets: PcnStandardSeedAsset[];
  records: PcnStandardSeedRecord[];
  /** Explicitly empty by contract: this seed never deletes or overwrites. */
  destructiveOperations: string[];
}

function sanitizeSegment(value: string): string {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

function stableKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function stripId<T extends { id: string }>(record: T): Record<string, unknown> {
  const { id: _ignoredId, ...data } = record;
  return data as Record<string, unknown>;
}

function sourceByName(sourceFiles: readonly PcnStandardSeedSourceFile[], sourceFileName: string): PcnStandardSeedSourceFile {
  const matches = sourceFiles.filter((source) => source.sourceFileName === sourceFileName);
  if (matches.length !== 1) {
    throw new Error(`Nguồn seed phải có đúng một tệp ${sourceFileName}; nhận được ${matches.length}.`);
  }
  return matches[0];
}

function addRecord(records: PcnStandardSeedRecord[], collectionName: string, record: { id: string }): void {
  records.push({
    action: 'INSERT_OR_VERIFY',
    collectionName,
    documentId: record.id,
    data: stripId(record),
  });
}

function createAsset(input: {
  dossierId: string;
  bucketName: string;
  source: PcnStandardSeedSourceFile;
  sourceCollection: PcnStandardSeedAsset['sourceCollection'];
  sourceDocumentId: string;
  sourceJsonPath: string;
}): PcnStandardSeedAsset {
  const assetKey = stableKey([
    input.dossierId,
    input.sourceCollection,
    input.sourceDocumentId,
    input.sourceJsonPath,
    input.source.sourceRelativePath,
    input.source.sha256,
  ].join('|'));
  const assetId = `pcn-file-${assetKey}`;
  const fileName = input.source.sourceFileName.slice(0, 255);
  return {
    assetId,
    bucketName: input.bucketName,
    objectPath: `${PCN_STANDARD_SEED_NAMESPACE}/${sanitizeSegment(input.dossierId)}/${sanitizeSegment(input.sourceCollection)}/${sanitizeSegment(input.sourceDocumentId)}/${assetId}-${sanitizeSegment(fileName)}`,
    sourcePath: input.source.absolutePath,
    sourceRelativePath: input.source.sourceRelativePath,
    sourceCollection: input.sourceCollection,
    sourceDocumentId: input.sourceDocumentId,
    sourceJsonPath: input.sourceJsonPath,
    fileName,
    mimeType: input.source.mimeType,
    byteSize: input.source.byteSize,
    sha256: input.source.sha256.toLowerCase(),
  };
}

function createAttachment(input: {
  dossierId: string;
  fieldCode: PcnDossierAttachment['fieldCode'];
  requirementId: string;
  asset: PcnStandardSeedAsset;
  source: PcnStandardSeedSourceFile;
}): PcnDossierAttachment {
  return {
    id: `pcn-attachment-upload-${input.asset.assetId}`,
    dossierId: input.dossierId,
    fieldCode: input.fieldCode,
    kind: 'OTHER',
    requirementId: input.requirementId,
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Tệp nguồn bộ chuẩn được gắn vào ${input.requirementId}.`,
    fileName: input.asset.fileName,
    sourceRelativePath: `${PCN_STANDARD_SEED_NAMESPACE}/${sanitizeSegment(input.dossierId)}/${sanitizeSegment(input.requirementId)}/${sanitizeSegment(input.asset.fileName)}`.slice(0, 255),
    assetId: input.asset.assetId,
    mimeType: input.asset.mimeType,
    byteSize: input.asset.byteSize,
    sha256: input.asset.sha256,
    importedAt: SEED_UPLOADED_AT,
    note: 'Tệp mẫu chuẩn PCN được nạp để kiểm tra flow trên môi trường ứng dụng.',
  };
}

function buildSampleFlowEvents(
  dossierId: string,
  sampleLot: PcnSampleLot,
  sampleRoutes: readonly PcnSampleRoute[],
  labRequests: readonly OutboundLabRequest[],
): PcnSampleFlowEvent[] {
  return sampleRoutes.flatMap((route) => {
    const request = labRequests.find((item) => item.sampleRouteId === route.id);
    if (!request) throw new Error(`Không tìm thấy PYC cho tuyến mẫu ${route.id}.`);
    const base = `${dossierId}-${route.labCode.toLowerCase()}`;
    return [
      buildPcnSampleFlowEvent({ id: `standard-sample-event-${base}-sent`, sampleLotId: sampleLot.id, routeId: route.id, labRequestId: request.id, type: 'SENT_TO_LAB', fromStatus: 'PENDING', toStatus: 'SENT', location: request.laboratoryName, note: 'Đã gửi mẫu chuẩn tới phòng thử nghiệm.', actorUsername: 'tranhoangphuong' }, '2026-08-31T02:00:00.000Z'),
      buildPcnSampleFlowEvent({ id: `standard-sample-event-${base}-received`, sampleLotId: sampleLot.id, routeId: route.id, labRequestId: request.id, type: 'LAB_RECEIVED', fromStatus: 'SENT', toStatus: 'RECEIVED', location: request.laboratoryName, note: 'Phòng thử nghiệm đã nhận mẫu.', actorUsername: 'tranhoangphuong' }, '2026-08-31T03:00:00.000Z'),
      buildPcnSampleFlowEvent({ id: `standard-sample-event-${base}-result`, sampleLotId: sampleLot.id, routeId: route.id, labRequestId: request.id, type: 'RESULT_RETURNED', fromStatus: 'RECEIVED', toStatus: 'RESULT_RETURNED', location: 'PCN', note: 'Đã nhận bản scan KQTN và chờ/đã xác nhận OCR.', actorUsername: 'tranhoangphuong' }, '2026-08-31T04:00:00.000Z'),
      buildPcnSampleFlowEvent({ id: `standard-sample-event-${base}-returned`, sampleLotId: sampleLot.id, routeId: route.id, labRequestId: request.id, type: 'SAMPLE_RETURNED', fromStatus: 'RESULT_RETURNED', toStatus: 'RETURNED_TO_PCN', location: 'Kho PCN', note: 'Mẫu đã luân chuyển trả về PCN.', actorUsername: 'tranhoangphuong' }, '2026-08-31T05:00:00.000Z'),
      buildPcnSampleFlowEvent({ id: `standard-sample-event-${base}-closed`, sampleLotId: sampleLot.id, routeId: route.id, labRequestId: request.id, type: 'CLOSED', fromStatus: 'RETURNED_TO_PCN', toStatus: 'CLOSED', location: 'Kho PCN', note: 'Tuyến mẫu chuẩn đã đóng.', actorUsername: 'tranhoangphuong' }, '2026-08-31T05:05:00.000Z'),
    ];
  });
}

function buildSeedActivityLog(dossier: CertificationDossier, fixture: PcnStandardDossierFixture): ActivityLog {
  return buildActivityLog({
    id: `activity-pcn-standard-seed-${sanitizeSegment(dossier.id)}`,
    createdAt: SEED_UPLOADED_AT,
    actorUsername: 'luongxuanhung',
    actorName: 'Lương Xuân Hùng',
    actorRole: 'admin',
    action: 'IMPORTED',
    entityType: 'PCN_DOSSIER',
    entityId: dossier.id,
    entityLabel: dossier.dossierCode,
    summary: `Nạp bộ hồ sơ chuẩn ${fixture.sourceLabel} để kiểm tra flow PCN.`,
    source: 'IMPORT',
    groupId: PCN_STANDARD_SEED_NAMESPACE,
    idempotencyKey: `${PCN_STANDARD_SEED_NAMESPACE}:${dossier.id}`,
  });
}

export function buildPcnStandardDossierSeedPlan(
  fixture: PcnStandardDossierFixture,
  sourceFiles: readonly PcnStandardSeedSourceFile[],
  bucketName = 'pcn-files',
): PcnStandardDossierSeedPlan {
  const flow = buildPcnStandardDossierFlow(fixture);
  const checkpoint = fixture.fieldCode === 'QC4' ? 'TECHNICAL_REVIEW' : 'WAITING_APPROVAL';
  const dossierId = flow.dossier.id;
  const requirements = new Map(getPcnDocumentRequirements([fixture.fieldCode]).map((item) => [item.id, item]));
  const assets: PcnStandardSeedAsset[] = [];
  const attachments: PcnDossierAttachment[] = [];
  const documents = flow.documents.map((document) => {
    const requirement = requirements.get(document.requirementId);
    const sourceNames = requirement ? (fixture.sourceFiles[requirement.code] || []) : [];
    if (!requirement || sourceNames.length === 0) return document;
    const primarySource = sourceByName(sourceFiles, sourceNames[0]);
    const primaryAsset = createAsset({ dossierId, bucketName, source: primarySource, sourceCollection: 'dossierDocuments', sourceDocumentId: document.id, sourceJsonPath: requirement.id });
    assets.push(primaryAsset);
    const primaryVersion = {
      assetId: primaryAsset.assetId,
      fileName: primaryAsset.fileName,
      mimeType: primaryAsset.mimeType,
      byteSize: primaryAsset.byteSize,
      sha256: primaryAsset.sha256,
      uploadedAt: SEED_UPLOADED_AT,
      uploadedBy: 'luongxuanhung',
      note: 'Tệp chuẩn PCN nạp để kiểm tra tài liệu trong card hồ sơ.',
    };
    const primaryAttachmentAsset = createAsset({ dossierId, bucketName, source: primarySource, sourceCollection: 'dossierAttachments', sourceDocumentId: `pcn-attachment-upload-${primaryAsset.assetId}`, sourceJsonPath: requirement.id });
    assets.push(primaryAttachmentAsset);
    attachments.push({
      ...buildPcnUploadedDossierAttachment({ dossierId, requirement, assetId: primaryAttachmentAsset.assetId, fileName: primaryAttachmentAsset.fileName, mimeType: primaryAttachmentAsset.mimeType, byteSize: primaryAttachmentAsset.byteSize, sha256: primaryAttachmentAsset.sha256, uploadedAt: SEED_UPLOADED_AT, uploadedBy: 'luongxuanhung' }),
      sourceRelativePath: `${PCN_STANDARD_SEED_NAMESPACE}/${sanitizeSegment(dossierId)}/${sanitizeSegment(requirement.id)}/${sanitizeSegment(primaryAsset.fileName)}`.slice(0, 255),
      note: 'Tệp chuẩn PCN được nạp để kiểm tra tài liệu trong card hồ sơ.',
    });
    for (const [index, sourceName] of sourceNames.slice(1).entries()) {
      const source = sourceByName(sourceFiles, sourceName);
      const attachmentKey = `${document.id}:attachment:${index + 1}`;
      const attachmentAsset = createAsset({ dossierId, bucketName, source, sourceCollection: 'dossierAttachments', sourceDocumentId: `pcn-attachment-standard-${stableKey(attachmentKey)}`, sourceJsonPath: requirement.id });
      assets.push(attachmentAsset);
      attachments.push(createAttachment({ dossierId, fieldCode: requirement.fieldCode, requirementId: requirement.id, asset: attachmentAsset, source }));
    }
    return { ...document, currentVersionId: primaryAsset.assetId, versions: [primaryVersion], status: 'PRESENT' as const, updatedAt: SEED_UPLOADED_AT };
  });

  const seenPycNumbers = new Set<string>();
  const routeById = new Map(flow.sampleRoutes.map((route) => [route.id, route]));
  const requests = flow.labRequests.map((request) => {
    const route = routeById.get(String(request.sampleRouteId || ''));
    const sourcePycNumber = request.pycNumber;
    const normalizedPycNumber = sourcePycNumber.toLocaleLowerCase('vi-VN');
    const pycNumber = seenPycNumbers.has(normalizedPycNumber)
      ? `${sourcePycNumber} [${route?.labCode || 'ROUTE'}]`
      : sourcePycNumber;
    seenPycNumbers.add(pycNumber.toLocaleLowerCase('vi-VN'));
    const result = flow.returnedResults.find((item) => item.labRequestId === request.id);
    return {
      ...request,
      pycNumber,
      status: 'RESULT_RETURNED' as const,
      ...(result ? { receivedAt: result.receivedAt, returnedResultId: result.id } : {}),
      updatedAt: SEED_UPLOADED_AT,
    };
  });
  const routes = flow.sampleRoutes.map((route) => ({ ...route, updatedAt: SEED_UPLOADED_AT }));
  const sampleFlowEvents = buildSampleFlowEvents(dossierId, flow.sampleLot, routes, requests);
  const results = flow.returnedResults.map((result) => {
    const request = requests.find((item) => item.id === result.labRequestId);
    const route = routes.find((item) => item.id === request?.sampleRouteId);
    const artifact = fixture.labArtifacts.find((item) => item.labCode === route?.labCode);
    if (!artifact) throw new Error(`Không tìm thấy nguồn KQTN cho ${result.id}.`);
    const source = sourceByName(sourceFiles, artifact.sourceFileName);
    const asset = createAsset({ dossierId, bucketName, source, sourceCollection: 'returnedResults', sourceDocumentId: result.id, sourceJsonPath: 'fileAssetId' });
    assets.push(asset);
    return { ...result, fileAssetId: asset.assetId, updatedAt: SEED_UPLOADED_AT };
  });

  let dossier: CertificationDossier;
  let approvalSteps: PcnApprovalStep[] = [];
  let issuance: IssuancePackage | undefined;
  if (checkpoint === 'TECHNICAL_REVIEW') {
    const { issuancePackageId: _ignoredIssuancePackageId, ...withoutIssuance } = flow.dossier;
    dossier = { ...withoutIssuance, status: checkpoint, updatedAt: SEED_UPLOADED_AT };
  } else {
    dossier = { ...flow.dossier, status: checkpoint, updatedAt: SEED_UPLOADED_AT };
    approvalSteps = flow.approvalSteps.map((step) => {
      const { comment: _ignoredComment, actedAt: _ignoredActedAt, ...withoutDecision } = step;
      return { ...withoutDecision, status: 'PENDING' as const };
    });
    const { issuanceNumber: _ignoredIssuanceNumber, issuedAt: _ignoredIssuedAt, signerUsername: _ignoredSignerUsername, deliveryRecipient: _ignoredDeliveryRecipient, deliveryNote: _ignoredDeliveryNote, deliveredAt: _ignoredDeliveredAt, archivedAt: _ignoredArchivedAt, ...withoutIssuedState } = flow.issuance;
    issuance = { ...withoutIssuedState, status: 'PENDING_APPROVAL' };
  }

  const activityLog = buildSeedActivityLog(dossier, fixture);
  const records: PcnStandardSeedRecord[] = [];
  addRecord(records, 'certificationProposals', flow.proposal);
  addRecord(records, 'certificationDossiers', dossier);
  for (const document of documents) addRecord(records, 'dossierDocuments', document);
  for (const attachment of attachments) addRecord(records, 'dossierAttachments', attachment);
  addRecord(records, 'pcnSampleLots', flow.sampleLot);
  for (const route of routes) addRecord(records, 'pcnSampleRoutes', route);
  for (const event of sampleFlowEvents) addRecord(records, 'pcnSampleFlowEvents', event);
  for (const request of requests) addRecord(records, 'labRequests', request);
  for (const result of results) addRecord(records, 'returnedResults', result);
  for (const step of approvalSteps) addRecord(records, 'approvalSteps', step);
  if (issuance) addRecord(records, 'issuancePackages', issuance);
  addRecord(records, 'activityLogs', activityLog);

  return {
    namespace: PCN_STANDARD_SEED_NAMESPACE,
    fixture,
    checkpoint,
    proposal: flow.proposal,
    dossier,
    documents,
    attachments,
    sampleLot: flow.sampleLot,
    sampleRoutes: routes,
    sampleFlowEvents,
    labRequests: requests,
    returnedResults: results,
    approvalSteps,
    ...(issuance ? { issuance } : {}),
    waivedRequirementIds: Object.keys(fixture.waivers).sort(),
    activityLog,
    assets,
    records,
    destructiveOperations: [],
  };
}

// --- End of pcnStandardDossierSeed.ts ---
