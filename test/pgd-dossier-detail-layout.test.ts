import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierFlow, { PgdDossierStageGate } from '../components/PgdDossierFlow';
import PgdDossierDocumentReader, { getPgdDossierPreviewKind } from '../components/PgdDossierDocumentReader';
import { PGD_COLLECTIONS, PGD_DOMAIN } from '../utils/pgdDomain';
import type { PgdDossierDocument } from '../utils/pgdDossier';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const workspace = read('../components/PgdWorkspace.tsx');
const detail = workspace.slice(workspace.indexOf('function PgdRequestDetail'), workspace.indexOf('export type PgdWorkspaceProps'));

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
  assert.doesNotMatch(markup, /min-w-\[(?:11rem|13\.5rem)\]/);
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
  assert.match(detail, /<PgdDossierStageGate[\s\S]*?stageId="review-assignment"[\s\S]*?Phân công theo năng lực/);
  assert.match(detail, /<PgdDossierStageGate[\s\S]*?stageId="execution"[\s\S]*?Hiện trường, lấy mẫu và bàn giao PTN/);
  assert.match(detail, /<PgdDossierStageGate[\s\S]*?stageId="results-evaluation"[\s\S]*?Tiếp nhận KQTN/);
  assert.match(detail, /<PgdDossierStageGate[\s\S]*?stageId="reporting-approval"[\s\S]*?Báo cáo \/ chứng thư/);

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
  assert.equal(getPgdDossierPreviewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'report.docx'), 'UNSUPPORTED');

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

  assert.match(markup, /Báo cáo giám định/);
  assert.match(markup, /Định dạng này chưa hỗ trợ xem trực tiếp trong trình duyệt/);
  assert.match(markup, /href="\/api\/pgd\/dossier-documents\/docx-report\/download" download="report\.docx"/);
  assert.match(markup, /Tải tệp xuống để mở bằng ứng dụng phù hợp/);
  assert.doesNotMatch(markup, /target="_blank"/);
  assert.doesNotMatch(markup, /<iframe|<img/);

  const readerSource = read('../components/PgdDossierDocumentReader.tsx');
  assert.match(readerSource, /fetch\(getPgdDossierDocumentDownloadUrl\(selected\.id\)[\s\S]*credentials: 'same-origin'/);
  assert.match(readerSource, /href=\{previewUrl\} target="_blank"/);
  assert.match(readerSource, /previewKind === 'PDF'[\s\S]*<iframe/);
  assert.match(readerSource, /<img src=\{previewUrl\}/);
});
