import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierFlow, { PgdDossierStageGate } from '../components/PgdDossierFlow';
import PgdDossierDocumentReader, { getPgdDossierPreviewKind } from '../components/PgdDossierDocumentReader';
import { PGD_COLLECTIONS, PGD_DOMAIN } from '../utils/pgdDomain';
import { buildPgdDossierDocument, type PgdDossierDocument } from '../utils/pgdDossier';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const workspace = read('../components/PgdWorkspace.tsx');
const detail = workspace.slice(workspace.indexOf('function PgdRequestDetail'), workspace.indexOf('export type PgdWorkspaceProps'));
const stepWorkPanel = read('../components/PgdDossierStepWorkPanel.tsx');
const stationForms = read('../components/PgdStationFormsPanel.tsx');

test('the PGD detail flow presents seven compact numbered stage controls', () => {
  const markup = renderToStaticMarkup(createElement(PgdDossierFlow, {
    status: 'DRAFT',
    selectedStepId: 'intake',
    onSelectStep: () => undefined,
  }));

  const tabs = Array.from(markup.matchAll(/<button\b[^>]*role="tab"[\s\S]*?<\/button>/g), (match) => match[0]);
  assert.equal(tabs.length, 7);
  assert.deepEqual(tabs.map((tab) => tab.match(/>\s*(0[1-7])\s*<\/span>/)?.[1]), ['01', '02', '03', '04', '05', '06', '07']);
  assert.match(markup, /Bước xử lý/);
  assert.match(markup, /aria-label="Các giai đoạn xử lý hồ sơ PGD"/);
  assert.match(markup, /min-h-11 min-w-11/);
  assert.doesNotMatch(markup, /line-clamp-2/);
  assert.doesNotMatch(markup, /min-w-\[(?:11rem|13\.5rem)\]/);
});

test('PGD stages accept supplementary files outside the required checklist and use the pencil drafting action', () => {
  const workPanel = read('../components/PgdDossierStepWorkPanel.tsx');
  const route = read('../app/api/pgd/requests/[requestId]/dossier-documents/route.ts');

  assert.match(workPanel, /onUploadSupplementary/);
  assert.match(workPanel, /aria-label=/);
  assert.match(workPanel, /<Pencil size=/);
  assert.match(workPanel, /accept="\.pdf,\.docx,\.png,\.jpg,\.jpeg,\.gif,\.webp,\.avif"/);
  assert.doesNotMatch(workPanel, /accept="[^"]*\.doc,/);
  assert.match(detail, /onUploadSupplementary=\{/);
  assert.match(route, /supplementaryStageId/);
  assert.match(route, /if \(!isSupplementary\)[\s\S]*markPgdDossierChecklistPresent/);
});

test('PGD supplementary document metadata retains its stage while using a non-checklist code', () => {
  const supplementary = buildPgdDossierDocument({
    id: 'supplement-1',
    requestId: 'request-1',
    requirementCode: 'PGD_SUPPLEMENTARY_EXECUTION_RANDOM',
    title: 'Tệp phụ trợ · field.pdf',
    fileName: 'field.pdf',
    version: 1,
    checksum: 'b'.repeat(64),
    uploadedByUsername: 'operator',
    fileAssetId: 'asset-1',
    supplementaryStageId: 'execution',
  });

  assert.equal(supplementary.supplementaryStageId, 'execution');
  assert.match(supplementary.requirementCode, /^PGD_SUPPLEMENTARY_/);
});

test('legacy step ids reveal only their canonical stage content', () => {
  const visible = renderToStaticMarkup(createElement(PgdDossierStageGate, {
    selectedStepId: 'assignment',
    stageId: 'review-assignment',
  }, createElement('p', null, 'Phân công giám định')));
  const hidden = renderToStaticMarkup(createElement(PgdDossierStageGate, {
    selectedStepId: 'assignment',
    stageId: 'execution',
  }, createElement('p', null, 'Biên bản hiện trường')));

  assert.match(visible, /Phân công giám định/);
  assert.equal(hidden, '');
});

test('PGD work card gates operation forms by stage and reserves the right column for its reader', () => {
  assert.match(detail, /stageId="review-assignment">[\s\S]*?<details[^>]*data-testid="pgd-workspace-assignment-forms"[\s\S]*?<\/details>/);
  assert.match(detail, /stageId="execution">[\s\S]*?<details[^>]*data-testid="pgd-workspace-execution-forms"[\s\S]*?<\/details>/);
  assert.match(detail, /data-testid="pgd-workspace-results-forms"[\s\S]*?stageId="results-evaluation"[\s\S]*?stageId="reporting-approval"/);
  assert.match(detail, /data-testid="pgd-dossier-step-work-panel"[\s\S]*?<PgdDossierFlow[\s\S]*?<PgdDossierStepWorkPanel/);
  assert.doesNotMatch(detail, /Lô \/ số lượng|Ngày tiếp nhận/);
  assert.match(detail, /<PgdDossierStageGate[^>]*stageId="review-assignment"/);
  assert.match(detail, /<PgdDossierStageGate[^>]*stageId="execution"/);
  assert.match(detail, /<PgdDossierStageGate[^>]*stageId="results-evaluation"/);
  assert.match(detail, /<PgdDossierStageGate[^>]*stageId="reporting-approval"/);
  assert.match(stepWorkPanel, /const stageEditable = canMutate && !approvalOnlyStage/);
  assert.match(stepWorkPanel, /const approvalOnlyStage = workflowSchemaVersion === 2 && \['results-evaluation', 'reporting-approval'\]/);
  assert.match(stepWorkPanel, /PgdAssignmentStepPanel/);
  assert.match(stepWorkPanel, /PgdFieldInspectionStepPanel/);
  assert.match(stepWorkPanel, /PgdResultsStepPanel/);
  assert.match(detail, /data-testid="pgd-workspace-assignment-forms"[\s\S]*?Phân công đã ghi nhận/);
  assert.match(detail, /data-testid="pgd-workspace-execution-forms"[\s\S]*?Hiện trường, lấy mẫu và bàn giao PTN/);
  assert.match(detail, /Kết quả PTN và báo cáo \/ chứng thư linh hoạt/);
  assert.match(stationForms, /getPgdUserCapabilities\(user\)\.includes\('OFFICE_ISSUANCE'\)/);
  assert.match(stationForms, /getPgdUserCapabilities\(user\)\.includes\('ARCHIVE'\)/);

  const readerLabel = detail.indexOf('aria-label="Đọc tài liệu hồ sơ PGD"');
  const readerStart = detail.lastIndexOf('<aside', readerLabel);
  assert.notEqual(readerStart, -1);
  const readerAside = detail.slice(readerStart, detail.indexOf('</aside>', readerStart));
  assert.match(readerAside, /<PgdDossierDocumentReader/);
  assert.doesNotMatch(readerAside, /PgdDossierBusinessWorkspace|PgdCaseEvidencePanel|PgdSourceFormsPanel|Trợ lý hồ sơ/);
  assert.match(detail, /aria-label="Chuyển vùng hồ sơ PGD"[\s\S]*?Công việc[\s\S]*?Tài liệu/);
});

test('PGD dossier reader previews safe raster and PDF files, opens previews in a new tab, and downloads DOCX', () => {
  assert.equal(getPgdDossierPreviewKind('application/pdf', 'report.pdf'), 'PDF');
  assert.equal(getPgdDossierPreviewKind('image/png', 'field.png'), 'IMAGE');
  assert.equal(getPgdDossierPreviewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'report.docx'), 'DOCX');

  const docx: PgdDossierDocument = {
    id: 'docx-report',
    domain: PGD_DOMAIN,
    requestId: 'request-1',
    requirementCode: 'REPORT',
    title: 'Báo cáo giám định',
    fileName: 'report.docx',
    sourceCollection: PGD_COLLECTIONS.dossierDocuments,
    sourceDocumentId: 'docx-report',
    version: 1,
    checksum: 'checksum-1',
    uploadedByUsername: 'reviewer',
    uploadedAt: '2026-11-05T00:00:00.000Z',
    fileAssetId: 'asset-1',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const markup = renderToStaticMarkup(createElement(PgdDossierDocumentReader, { documents: [docx] }));

  assert.match(markup, /report\.docx/);
  assert.match(markup, /Đang đọc tài liệu DOCX/);
  assert.match(markup, /href="\/api\/pgd\/dossier-documents\/docx-report\/download\?inline=1" target="_blank"/);
  assert.match(markup, /href="\/api\/pgd\/dossier-documents\/docx-report\/download" download="report\.docx"/);
  assert.match(markup, /target="_blank"/);
  assert.doesNotMatch(markup, /<iframe|<img/);

  const supplementary = buildPgdDossierDocument({
    ...docx,
    id: 'supplementary-execution',
    sourceDocumentId: 'supplementary-execution',
    requirementCode: 'PGD_SUPPLEMENTARY_EXECUTION_RANDOM',
    title: 'Tệp phụ trợ · field.pdf',
    fileName: 'field.pdf',
    checksum: 'c'.repeat(64),
    supplementaryStageId: 'execution',
  });
  const supplementaryMarkup = renderToStaticMarkup(createElement(PgdDossierDocumentReader, { documents: [supplementary] }));
  assert.match(supplementaryMarkup, /field\.pdf/);
  assert.doesNotMatch(supplementaryMarkup, /Từ bước:|Nguồn:/);

  const readerSource = read('../components/PgdDossierDocumentReader.tsx');
  assert.match(readerSource, /fetch\(getPgdDossierDocumentDownloadUrl\(selected\.id\)[\s\S]*credentials: 'same-origin'/);
  assert.match(readerSource, /href=\{previewKind === 'DOCX' \? inlineUrl : previewUrl\} target="_blank"/);
  assert.match(readerSource, /previewKind === 'PDF'[\s\S]*<iframe/);
  assert.match(readerSource, /<img src=\{previewUrl\}/);
});
