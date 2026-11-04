import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnDossierAttachment } from '../types.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, buildPcnDossierChecklist } from '../utils/pcnDossierDocuments.ts';
import { classifyPcnHistoricalFile } from '../utils/pcnHistoricalImport.ts';
import { mapPcnHistoricalAttachmentManually, reconcilePcnHistoricalAttachmentMapping } from '../utils/pcnHistoricalAttachmentMapping.ts';

const NOW = '2026-08-28T04:00:00.000Z';
const reconcileScript = fs.readFileSync(new URL('../scripts/reconcilePcnHistoricalAttachments.ts', import.meta.url), 'utf8');
const importScript = fs.readFileSync(new URL('../scripts/importPcnHistoricalPilot.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };
const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const mappingApiSource = fs.readFileSync(new URL('../utils/pcnHistoricalAttachmentMappingApi.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

function attachment(input: Partial<PcnDossierAttachment> & Pick<PcnDossierAttachment, 'id' | 'kind' | 'fileName' | 'sourceRelativePath' | 'assetId'>): PcnDossierAttachment {
  return {
    dossierId: 'dossier-qc4-0665',
    fieldCode: 'QC4',
    mimeType: 'application/pdf',
    byteSize: 100,
    sha256: 'a'.repeat(64),
    importedAt: NOW,
    ...input,
  };
}

test('historical classifier keeps non-certificate content and failed test reports out of certificate mapping', () => {
  assert.equal(classifyPcnHistoricalFile('IEMM 0105/Loại nội dung dài.docx'), 'OTHER');
  assert.equal(classifyPcnHistoricalFile('IEMM 0105/EMC 037-26-M01 (0105)-ko dat.docx'), 'TEST_REPORT');
});

test('QC4 corrective action is attachment-only and cannot satisfy certification result', () => {
  const input = attachment({
    id: 'attachment-qc4-corrective',
    kind: 'CORRECTIVE_ACTION',
    fileName: 'CV_Khac_Phuc.doc',
    sourceRelativePath: 'CV_Khac_Phuc.doc',
    assetId: 'asset-qc4-corrective',
  });
  const result = reconcilePcnHistoricalAttachmentMapping({
    dossierId: input.dossierId,
    fieldCodes: ['QC4'],
    attachments: [input],
    existingDocuments: buildPcnDossierChecklist(input.dossierId, ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS, NOW),
    now: NOW,
  });

  assert.equal(result.attachments[0].requirementId, undefined);
  assert.equal(result.attachments[0].mappingStatus, 'UNMAPPED');
  assert.match(result.attachments[0].mappingReason || '', /QC4/);
  assert.equal(result.documents.find((item) => item.requirementId === 'QC4-CERTIFICATION_RESULT')?.status, 'MISSING');
});

test('deterministic historical mapping preserves every file as a document version without embedding bytes', () => {
  const first = attachment({
    id: 'attachment-proposal-a',
    kind: 'PROPOSAL',
    fileName: 'De nghi a.docx',
    sourceRelativePath: '02/De nghi a.docx',
    assetId: 'asset-proposal-a',
    byteSize: 200,
    sha256: 'b'.repeat(64),
  });
  const second = attachment({
    id: 'attachment-proposal-b',
    kind: 'PROPOSAL',
    fileName: 'De nghi b.docx',
    sourceRelativePath: '01/De nghi b.docx',
    assetId: 'asset-proposal-b',
    byteSize: 300,
    sha256: 'c'.repeat(64),
  });
  const result = reconcilePcnHistoricalAttachmentMapping({
    dossierId: first.dossierId,
    fieldCodes: ['QC4'],
    attachments: [first, second],
    existingDocuments: buildPcnDossierChecklist(first.dossierId, ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS, NOW),
    now: NOW,
  });

  assert.ok(result.attachments.every((item) => item.requirementId === 'QC4-PROPOSAL'));
  assert.ok(result.attachments.every((item) => item.mappingStatus === 'AUTO_MAPPED'));
  const document = result.documents.find((item) => item.requirementId === 'QC4-PROPOSAL');
  assert.ok(document);
  assert.equal(document?.status, 'PRESENT');
  assert.deepEqual(document?.versions.map((item) => item.assetId), ['asset-proposal-b', 'asset-proposal-a']);
  assert.equal(document?.currentVersionId, 'asset-proposal-b');
  assert.ok(document?.versions.every((item) => !('bytes' in item)));
  assert.equal(document?.versions.find((item) => item.assetId === 'asset-proposal-a')?.sha256, 'b'.repeat(64));
  assert.equal(result.attachments.find((item) => item.assetId === 'asset-proposal-a')?.byteSize, 200);
});

test('reconcile removes stale auto-mapped historical versions but preserves a user-uploaded version', () => {
  const current = attachment({
    id: 'attachment-qc4-other',
    kind: 'OTHER',
    fileName: 'Khac.pdf',
    sourceRelativePath: 'Khac.pdf',
    assetId: 'asset-qc4-other',
  });
  const checklist = buildPcnDossierChecklist(current.dossierId, ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS, NOW);
  const proposalDocument = checklist.find((item) => item.requirementId === 'QC4-PROPOSAL');
  assert.ok(proposalDocument);
  const existing = checklist.map((item) => item.requirementId === 'QC4-PROPOSAL' ? {
    ...item,
    status: 'PRESENT' as const,
    currentVersionId: 'asset-user-proposal',
    versions: [
      { assetId: 'asset-old-auto', fileName: 'old.docx', uploadedAt: NOW, note: 'Phiên tài liệu lịch sử đã nhập.' },
      { assetId: 'asset-user-proposal', fileName: 'current.docx', uploadedAt: NOW, uploadedBy: 'operator' },
    ],
  } : item);
  const result = reconcilePcnHistoricalAttachmentMapping({
    dossierId: current.dossierId,
    fieldCodes: ['QC4'],
    attachments: [current],
    existingDocuments: existing,
    now: NOW,
  });

  const proposal = result.documents.find((item) => item.requirementId === 'QC4-PROPOSAL');
  assert.deepEqual(proposal?.versions.map((item) => item.assetId), ['asset-user-proposal']);
  assert.equal(proposal?.currentVersionId, 'asset-user-proposal');
  assert.equal(proposal?.status, 'PRESENT');
});

test('historical reconcile is idempotent across runs with different timestamps', () => {
  const input = attachment({
    id: 'attachment-idempotent-proposal',
    kind: 'PROPOSAL',
    fileName: 'de-nghi.docx',
    sourceRelativePath: '01/de-nghi.docx',
    assetId: 'asset-idempotent-proposal',
  });
  const baseline = buildPcnDossierChecklist(input.dossierId, ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS, NOW);
  const first = reconcilePcnHistoricalAttachmentMapping({
    dossierId: input.dossierId,
    fieldCodes: ['QC4'],
    attachments: [input],
    existingDocuments: baseline,
    now: NOW,
  });
  const roundTripAttachments = JSON.parse(JSON.stringify(first.attachments)) as PcnDossierAttachment[];
  const roundTripDocuments = JSON.parse(JSON.stringify(first.documents));
  const second = reconcilePcnHistoricalAttachmentMapping({
    dossierId: input.dossierId,
    fieldCodes: ['QC4'],
    attachments: roundTripAttachments,
    existingDocuments: roundTripDocuments,
    now: '2026-08-28T05:00:00.000Z',
  });

  assert.deepEqual(second.attachments, roundTripAttachments);
  assert.deepEqual(second.documents, roundTripDocuments);
});

test('historical attachment reconcile CLI is PCN-only, dry-run first, and updates metadata only', () => {
  assert.match(packageJson.scripts?.['reconcile:pcn-history-attachments'] || '', /reconcilePcnHistoricalAttachments/);
  assert.match(reconcileScript, /APP_PROFILE.*pcn/);
  assert.match(reconcileScript, /--dry-run/);
  assert.match(reconcileScript, /--apply/);
  assert.match(reconcileScript, /dossierAttachments/);
  assert.match(reconcileScript, /dossierDocuments/);
  assert.match(reconcileScript, /certificationDossiers/);
  assert.match(reconcileScript, /updatedAt/);
  assert.doesNotMatch(reconcileScript, /storage\.(upload|delete)|uploadObject|deleteObject/);
});

test('dossier attachment UI exposes mapping state and reason beside the read-only source path', () => {
  assert.match(detailSource, /mappingStatus/);
  assert.match(detailSource, /mappingReason/);
  assert.match(detailSource, /Chưa nối checklist/);
});

test('historical import dry-run reports mapping counts for operator review', () => {
  assert.match(importScript, /autoMappedFiles/);
  assert.match(importScript, /unmappedFiles/);
  assert.match(importScript, /unmappedByKind/);
});

test('manual mapping marks an attachment without changing its immutable file metadata', () => {
  const input = attachment({
    id: 'attachment-photo',
    kind: 'PHOTO',
    fileName: 'anh-san-pham.jpg',
    sourceRelativePath: 'anh/anh-san-pham.jpg',
    assetId: 'asset-photo',
    byteSize: 321,
    sha256: 'd'.repeat(64),
    mappingStatus: 'UNMAPPED',
  });
  const result = mapPcnHistoricalAttachmentManually({
    attachment: input,
    requirement: DEFAULT_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === 'QC4-CERTIFICATION_RESULT')!,
  });

  assert.equal(result.requirementId, 'QC4-CERTIFICATION_RESULT');
  assert.equal(result.mappingStatus, 'MANUAL_MAPPED');
  assert.match(result.mappingReason || '', /thủ công/);
  assert.equal(result.assetId, input.assetId);
  assert.equal(result.byteSize, input.byteSize);
  assert.equal(result.sha256, input.sha256);
  assert.equal(result.sourceRelativePath, input.sourceRelativePath);
});

test('manual attachment mapping has a PCN endpoint, audit source, and no file byte mutation path', () => {
  const mappingRoute = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/historical-attachment-mapping'"), serverSource.indexOf("app.post('/api/pcn/documents/generate'"));
  assert.match(mappingRoute, /app\.post\('\/api\/pcn\/historical-attachment-mapping'/);
  assert.match(serverSource, /attachmentId/);
  assert.match(serverSource, /requirementId/);
  assert.match(mappingRoute, /source: 'USER_REVIEW'/);
  assert.match(mappingRoute, /certificationDossiers/);
  assert.match(mappingRoute, /source_json_path/);
  assert.match(mappingRoute, /attachments\.\$\{attachment\.kind\}/);
  assert.match(mappingRoute, /updatedAt/);
  assert.doesNotMatch(mappingRoute, /file_assets\s+SET|uploadObject|deleteObject/);
});

test('manual mapping API and PCN store expose an atomic attachment action', () => {
  assert.match(mappingApiSource, /\/api\/pcn\/historical-attachment-mapping/);
  assert.match(mappingApiSource, /credentials: 'same-origin'/);
  assert.match(storeSource, /mapHistoricalAttachment/);
  assert.match(detailSource, /onMapHistoricalAttachment/);
  assert.match(detailSource, /Nối/);
});
