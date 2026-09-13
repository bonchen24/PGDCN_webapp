import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const workspace = read('components/PcnWorkspace.tsx');
const pipeline = read('components/PcnPipelineBoard.tsx');
const workQueue = read('components/PcnWorkQueueView.tsx');
const dossierQueue = read('components/PcnDossierQueueView.tsx');
const dossierDetail = read('components/PcnDossierDetailView.tsx');
const pgdDossierFlow = read('components/PgdDossierFlow.tsx');
const design = read('design.md');

test('PCN proposal list renders a semantic table without moving dossier actions out of the list', () => {
  assert.match(workspace, /<table[\s\S]*aria-label="Danh sách Đề nghị PCN"/);
  assert.match(workspace, /<th[\s\S]*Mã Đề nghị/);
  assert.match(workspace, /<th[\s\S]*Mã hồ sơ/);
  assert.match(workspace, /Mở hồ sơ chuẩn/);
  assert.match(workspace, /overflow-x-auto|mobile-scroll-x/);
});

test('PCN dossier queue renders rows with the existing search and dossier action', () => {
  assert.match(dossierQueue, /<table[\s\S]*aria-label="Bảng hàng đợi hồ sơ PCN"/);
  assert.match(dossierQueue, /<th[\s\S]*Bước hiện tại/);
  assert.match(dossierQueue, /<th[\s\S]*Tài liệu/);
  assert.match(dossierQueue, /onOpenDossier\(row\.dossierId\)/);
  assert.match(dossierQueue, /overflow-x-auto|mobile-scroll-x/);
});

test('PCN management opens dossier detail when the dossier code is clicked', () => {
  const summaryGrid = read('components/PgdcnDossierSummaryGrid.tsx');
  assert.match(summaryGrid, /domain === 'PCN' && column\.id === 'dossierCode'/);
  assert.match(summaryGrid, /aria-label=\{`Mở chi tiết hồ sơ/);
  assert.match(summaryGrid, /onOpenRow\(row\.id\)/);
});

test('PCN work queue and workflow projection render dossier tables while preserving assignment controls', () => {
  assert.match(workQueue, /<table[\s\S]*aria-label="Bảng hàng đợi cần xử lý"/);
  assert.match(workQueue, /<th[\s\S]*Ưu tiên/);
  assert.match(workQueue, /<th[\s\S]*Chủ hồ sơ/);
  assert.match(workQueue, /PcnDossierAssignmentControl/);
  assert.match(pipeline, /<table[\s\S]*aria-label="Bảng hồ sơ theo lưu trình"/);
  assert.match(pipeline, /<th[\s\S]*Bước hiện tại/);
  assert.match(pipeline, /PcnDossierAssignmentControl/);
});

test('table mode is list-only and does not replace PCN or PGD dossier detail surfaces', () => {
  assert.match(design, /Ngoại lệ bắt buộc: không chuyển trang chi tiết hồ sơ PCN hoặc PGD sang bảng/);
  assert.doesNotMatch(dossierDetail, /aria-label="Bảng hồ sơ theo lưu trình"|aria-label="Bảng hàng đợi cần xử lý"/);
  assert.doesNotMatch(pgdDossierFlow, /aria-label="Bảng hồ sơ theo lưu trình"|aria-label="Bảng hàng đợi cần xử lý"/);
});

// --- End of pcn-dossier-table-ui.test.ts ---
