import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildPcnDossierPackageManifest,
  buildPcnDossierPackageDownloadName,
  buildPcnDossierPackageSummary,
  type PcnDossierPackagePointer,
} from '../utils/pcnDossierPackage.ts';
import { getPcnDossierPackageUrl } from '../utils/pcnDossierPackageApi.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const packageSource = fs.readFileSync(new URL('../utils/pcnDossierPackage.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

test('dossier package manifest deduplicates assets and creates safe provenance paths', () => {
  const pointers: PcnDossierPackagePointer[] = [
    {
      assetId: 'pcn-file-a',
      sourceCollection: 'dossierDocuments',
      sourceDocumentId: 'dossier-document-1',
      sourceJsonPath: 'QC4-PROPOSAL',
      fileName: '../Đề nghị\u0000.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      byteSize: 12,
      sha256: 'a'.repeat(64),
      category: 'CHECKLIST',
    },
    {
      assetId: 'pcn-file-a',
      sourceCollection: 'dossierAttachments',
      sourceDocumentId: 'dossier-1',
      sourceJsonPath: 'attachments.PROPOSAL',
      fileName: 'same-file.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      byteSize: 12,
      sha256: 'a'.repeat(64),
      category: 'HISTORICAL',
    },
    {
      assetId: 'pcn-file-b',
      sourceCollection: 'returnedResults',
      sourceDocumentId: 'result-1',
      sourceJsonPath: 'fileAssetId',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      byteSize: 20,
      sha256: 'b'.repeat(64),
      category: 'RESULT',
      kind: 'EVALUATION_REPORT',
      format: 'PDF',
      contextHash: 'ctx-evaluation-1',
      sourceUpdatedAt: '2026-08-28T05:00:00.000Z',
    },
  ];

  const entries = buildPcnDossierPackageManifest({ dossierCode: 'HS/2026/01', pointers });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].assetId, 'pcn-file-a');
  assert.match(entries[0].archivePath, /^01-checklist\/[^/]+\/[^/]+$/);
  assert.doesNotMatch(entries[0].archivePath, /\.\.|\u0000/);
  assert.equal(entries[0].sourceDocumentId, 'dossier-document-1');
  assert.equal(entries[1].assetId, 'pcn-file-b');
  assert.match(entries[1].archivePath, /^05-results\/[^/]+\/[^/]+$/);
  assert.equal(entries[1].kind, 'EVALUATION_REPORT');
  assert.equal(entries[1].format, 'PDF');
  assert.equal(entries[1].contextHash, 'ctx-evaluation-1');
  assert.equal(entries[1].sourceUpdatedAt, '2026-08-28T05:00:00.000Z');
});

test('dossier package manifest refuses a pointer from a non-PCN source collection', () => {
  assert.throws(
    () => buildPcnDossierPackageManifest({
      dossierCode: 'HS-2026-01',
      pointers: [{
        assetId: 'ddt-file-1',
        sourceCollection: 'kqtnRecords',
        sourceDocumentId: 'record-1',
        sourceJsonPath: 'resultPdf',
        fileName: 'legacy.pdf',
        mimeType: 'application/pdf',
        byteSize: 10,
        sha256: 'c'.repeat(64),
        category: 'RESULT',
      }],
    }),
    /nguồn file PCN không được phép/i,
  );
});

test('dossier package summary deduplicates the same asset and keeps unknown byte metadata visible', () => {
  const summary = buildPcnDossierPackageSummary({
    documents: [{
      id: 'doc-1', dossierId: 'dossier-1', requirementId: 'REQ-1', fieldCode: 'QC4', status: 'PRESENT',
      versions: [
        { assetId: 'asset-a', fileName: 'a.docx', byteSize: 10, uploadedAt: '2026-08-28T00:00:00.000Z' },
        { assetId: 'asset-b', fileName: 'b.pdf', uploadedAt: '2026-08-28T00:00:00.000Z' },
      ],
    }],
    attachments: [{
      id: 'attachment-1', dossierId: 'dossier-1', fieldCode: 'QC4', kind: 'PROPOSAL',
      fileName: 'a-copy.docx', sourceRelativePath: '01/a-copy.docx', assetId: 'asset-a', mimeType: 'application/octet-stream', byteSize: 10, sha256: 'a'.repeat(64), importedAt: '2026-08-28T00:00:00.000Z',
    }, {
      id: 'attachment-2', dossierId: 'dossier-1', fieldCode: 'QC4', kind: 'PHOTO',
      fileName: 'photo.jpg', sourceRelativePath: '01/photo.jpg', assetId: 'asset-c', mimeType: 'image/jpeg', byteSize: 20, sha256: 'c'.repeat(64), importedAt: '2026-08-28T00:00:00.000Z',
    }],
    generatedDocuments: [{ id: 'generated-1', dossierId: 'dossier-1', kind: 'PROPOSAL_FORM', format: 'DOCX', fileAssetId: 'asset-d', fileName: 'proposal.docx', mimeType: 'application/octet-stream', byteSize: 30, sha256: 'd'.repeat(64), contextHash: 'ctx', generatedAt: '2026-08-28T00:00:00.000Z' }],
    returnedResults: [{ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-08-28T00:00:00.000Z', fileAssetId: 'asset-d' }],
    issuancePackages: [{ id: 'issuance-1', dossierId: 'dossier-1', certificateTemplateCode: 'CERT', decisionTemplateCode: 'DEC', documentType: 'CERTIFICATE', status: 'DRAFT', fileAssetIds: ['asset-e'] }],
  });

  assert.equal(summary.totalAssetCount, 5);
  assert.equal(summary.knownByteSize, 60);
  assert.equal(summary.unknownByteCount, 2);
  assert.deepEqual(summary.groups.map((group) => [group.category, group.assetCount]), [
    ['CHECKLIST', 2], ['HISTORICAL', 1], ['GENERATED', 1], ['OFFICIAL', 0], ['RESULT', 0], ['ISSUANCE', 1],
  ]);
  assert.equal(summary.groups.find((group) => group.category === 'ISSUANCE')?.unknownByteCount, 1);
});

test('server exposes a read-only dossier package route with a manifest boundary', () => {
  assert.match(serverSource, /app\.get\('\/api\/pcn\/dossiers\/:dossierId\/package'/);
  assert.match(serverSource, /buildPcnDossierPackageManifest/);
  assert.match(serverSource, /manifest\.json/);
  assert.match(serverSource, /sourceCollection: 'issuancePackages'[\s\S]{0,500}sourceJsonPath: 'fileAssetIds'/);
  assert.match(serverSource, /kind, format, contextHash, sourceUpdatedAt/);
  assert.match(packageSource, /dossierDocuments.*dossierAttachments.*pcnGeneratedDocuments.*pcnOfficialGeneratedDocuments.*returnedResults.*issuancePackages/s);
  assert.doesNotMatch(serverSource, /package.*req\.body.*asset/i);
});

test('dossier package download name cannot escape the browser download directory', () => {
  const fileName = buildPcnDossierPackageDownloadName('HS/2026/QC4:01');
  assert.equal(fileName, 'HS_2026_QC4_01-bo-ho-so.zip');
  assert.doesNotMatch(fileName, /[\\/]|\.\./);
});

test('dossier package API encodes the dossier id and rejects an empty id', () => {
  assert.equal(getPcnDossierPackageUrl('HS/2026/QC4 01'), '/api/pcn/dossiers/HS%2F2026%2FQC4%2001/package');
  assert.throws(() => getPcnDossierPackageUrl('  '), /mã hồ sơ/i);
});

test('PCN workspace and dossier detail expose the complete package download action', () => {
  assert.match(workspaceSource, /downloadPcnDossierPackage/);
  assert.match(workspaceSource, /onDownloadPackage=\{\(\) => downloadDossierPackage\(selectedDossier\)\}/);
  assert.doesNotMatch(workspaceSource, /onClick=\{onOpen\} title="Tải tài liệu hồ sơ"/);
  assert.match(detailSource, /onDownloadPackage/);
  assert.match(detailSource, /Tải bộ hồ sơ/);
  assert.match(detailSource, /Danh sách bộ hồ sơ/);
  assert.match(detailSource, /Tóm tắt thành phần/);
});

// --- End of pcn-dossier-package.test.ts ---
