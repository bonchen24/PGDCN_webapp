import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnDossierInspection } from '../utils/pcnDossierInspection.ts';
import { getPcnFilePreviewKind } from '../utils/pcnFilePreview.ts';

test('classifies only safe PDF and raster image types for inline preview', () => {
  assert.equal(getPcnFilePreviewKind('application/pdf', 'bien-ban.pdf'), 'PDF');
  assert.equal(getPcnFilePreviewKind('image/jpeg', 'anh-mau.jpg'), 'IMAGE');
  assert.equal(getPcnFilePreviewKind(undefined, 'bien-ban.pdf'), 'PDF');
  assert.equal(getPcnFilePreviewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'bien-ban.docx'), 'UNSUPPORTED');
  assert.equal(getPcnFilePreviewKind('image/svg+xml', 'so-do.svg'), 'UNSUPPORTED');
});

test('builds stage and exact-station visual checklists from current versioned documents', () => {
  const inspection = buildPcnDossierInspection({
    dossierId: 'DOSSIER-1',
    fieldCodes: ['QC4'],
    requirements: [
      { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
      { id: 'QC4-COMMERCIAL', fieldCode: 'QC4', code: 'COMMERCIAL', name: 'Báo giá', stages: ['INTAKE'], required: true, active: true, sortOrder: 20 },
      { id: 'QC4-OPTIONAL', fieldCode: 'QC4', code: 'OPTIONAL', name: 'Tài liệu phát sinh', stages: ['TECHNICAL_REVIEW'], required: false, active: true, sortOrder: 30 },
    ],
    documents: [
      {
        id: 'doc-1', dossierId: 'DOSSIER-1', requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4', status: 'PRESENT', currentVersionId: 'asset-1',
        versions: [{ assetId: 'asset-1', fileName: 'de-nghi.pdf', uploadedAt: '2026-08-29T01:00:00.000Z', uploadedBy: 'staff-1' }],
      },
      {
        id: 'doc-2', dossierId: 'DOSSIER-1', requirementId: 'QC4-COMMERCIAL', fieldCode: 'QC4', status: 'PRESENT', currentVersionId: 'asset-missing',
        versions: [{ assetId: 'asset-old', fileName: 'bao-gia-cu.pdf', uploadedAt: '2026-08-28T01:00:00.000Z' }],
      },
    ],
  });

  assert.deepEqual(inspection.summary, {
    total: 3,
    present: 1,
    missing: 2,
    requiredTotal: 2,
    requiredPresent: 1,
    requiredMissing: 1,
  });
  assert.deepEqual(inspection.stages.map((stage) => [stage.stage, stage.label, stage.present, stage.total]), [
    ['INTAKE', 'Tiếp nhận & đầu vào', 1, 2],
    ['TECHNICAL_REVIEW', 'KQTN & soát xét', 0, 1],
  ]);
  assert.deepEqual(inspection.stations.map((station) => [station.key, station.label, station.present, station.total, station.stationScore]), [
    ['INTAKE', 'Tiếp nhận Đề nghị', 1, 2, 50],
    ['TECHNICAL_REVIEW', 'Soát xét kỹ thuật', 0, 1, null],
  ]);
  assert.equal(inspection.stages[0].items[0].currentVersion?.fileName, 'de-nghi.pdf');
  assert.equal(inspection.stages[0].items[1].status, 'MISSING');
  assert.equal(inspection.stages[0].items[1].versionCount, 1);
});

test('exact station routing keeps operational forms out of the broad intake group', () => {
  const inspection = buildPcnDossierInspection({
    dossierId: 'DOSSIER-2',
    fieldCodes: ['QC4'],
    requirements: [
      { id: 'QC4-ASSIGNMENT_FORM', fieldCode: 'QC4', code: 'ASSIGNMENT_FORM', name: 'Phiếu phân công', stages: ['INTAKE'], stationKeys: ['ASSIGNMENT'], required: true, active: true, sortOrder: 25 },
      { id: 'QC4-EVALUATION_PLAN', fieldCode: 'QC4', code: 'EVALUATION_PLAN', name: 'Kế hoạch đánh giá', stages: ['INTAKE'], stationKeys: ['EVALUATION'], required: true, active: true, sortOrder: 26 },
    ],
    documents: [],
  });

  assert.deepEqual(inspection.stations.map((station) => [station.key, station.items.map((item) => item.requirement.code)]), [
    ['ASSIGNMENT', ['ASSIGNMENT_FORM']],
    ['EVALUATION', ['EVALUATION_PLAN']],
  ]);
});

test('visual checklist is exposed in dossier detail without replacing the upload boundary', () => {
  const detailView = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
  const previewView = fs.readFileSync(new URL('../components/PcnDossierFilePreview.tsx', import.meta.url), 'utf8');

  assert.match(detailView, /buildPcnDossierInspection/);
  assert.match(detailView, /Kiểm tra trực quan hồ sơ/);
  assert.match(detailView, /Mục đã có/);
  assert.match(detailView, /Còn thiếu/);
  assert.match(detailView, /Mở file/);
  assert.match(detailView, /PcnFilePreviewButton/);
  assert.match(detailView, /step\.stationScore/);
  assert.match(detailView, /inspection\.stations/);
  assert.match(detailView, /activeWorkflowNodeKey/);
  assert.match(detailView, /open=\{step\.key === activeWorkflowNodeKey\}/);
  assert.match(detailView, /Bước hiện tại mở sẵn/);
  assert.match(previewView, /Xem nhanh/);
  assert.match(previewView, /private boundary/);
  assert.match(detailView, /item\.currentVersion\.uploadedBy/);
  assert.match(detailView, /Người tải/);
  assert.match(detailView, /formatDateTime\(item\.currentVersion\.uploadedAt\)/);
  assert.match(detailView, /onUploadDocument/);
  assert.match(detailView, /requiredMissing/);
  assert.doesNotMatch(detailView, /document\?\.status !== 'PRESENT'/);
  assert.doesNotMatch(detailView, /versions\.find\(\(version\) => version\.assetId === document\?\.currentVersionId\) \|\| versions\[versions\.length - 1\]/);
  assert.match(detailView, /getPcnDocumentRequirements/);
  assert.doesNotMatch(detailView, /documentRequirements\.filter\(\(item\) => dossier\.fieldCodes\.includes\(item\.fieldCode\)\)/);
});
