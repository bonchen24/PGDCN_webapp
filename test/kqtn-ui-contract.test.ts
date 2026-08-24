// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for KQTN PDF actions and bulk-upload entry point.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('KQTN view exposes a PDF column and bulk upload control', () => {
  const source = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');
  assert.match(source, /id: 'resultPdf'/);
  assert.match(source, /Bulk Upload/);
  assert.match(source, /getKqtnPdfUrl/);
  assert.match(source, /uploadKqtnPdf/);
  assert.match(source, /window\.confirm/);
});

test('bulk modal exposes automatic matching and manual candidate selection', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /matchKqtnBulkFile/);
  assert.match(source, /Chọn đầu mẫu/);
  assert.match(source, /uploadKqtnPdf/);
  assert.match(source, /extractKqtnPdfMetadata/);
});

test('bulk modal supports combined PDF review, page ranges, preview, and retry', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /extractKqtnBulkStructure/);
  assert.match(source, /buildKqtnBulkSegments/);
  assert.match(source, /pageStart/);
  assert.match(source, /pageEnd/);
  assert.match(source, /Xem PDF con/);
  assert.match(source, /Retry/);
  assert.match(source, /needs-review/);
  assert.match(source, /onBulkCompleted/);
});

test('KQTN view records an aggregate activity entry for bulk upload', () => {
  const source = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');
  assert.match(source, /logBulkKqtnUpload/);
  assert.match(source, /onBulkCompleted={handleBulkCompleted}/);
});

test('bulk mode controls explain whether the source is split', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /Mỗi file = 1 KQTN, không cắt/);
  assert.match(source, /Một PDF ghép/);
  assert.match(source, /không cắt/);
  assert.match(source, /cắt theo nhóm trang/);
});

test('closing the modal keeps the active bulk session until the user clears it', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const closeSection = source.match(/const handleClose = \(\) => \{[\s\S]*?\n  \};/u)?.[0] || '';
  assert.match(closeSection, /preserveSessionOnResetRef\.current = true/);
  assert.match(source, /Xóa phiên/);
});

test('pending sample heads are visible but cannot be selected as upload targets', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /isPending/);
  assert.match(source, /Chưa có KQTN/);
  assert.match(source, /Tách PDF con và lưu vào mẫu đích/);
});

test('combined upload locks the session while PDF children are being created', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const uploadSection = source.slice(source.indexOf('const uploadCombinedSegments'), source.indexOf('const renderCandidateSelect'));
  assert.match(uploadSection, /setIsUploading\(true\)/);
  assert.match(uploadSection, /setIsUploading\(false\)/);
});

test('single upload also rejects pending target flags', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /isKqtnBulkUploadTarget/);
});


test('new combined source starts a fresh activity group', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /combinedGroupIdRef\.current = null/);
});


// --- End of kqtn-ui-contract.test.ts ---
