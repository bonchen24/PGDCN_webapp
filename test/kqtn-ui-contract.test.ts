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
  assert.match(source, /extractKqtnBulkFooter/);
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
  assert.match(source, /PDF đơn \(nhiều file\)/);
  assert.match(source, /PDF ghép \(1 file, nhiều kết quả\)/);
  assert.match(source, /Mỗi file PDF là một kết quả, không tách/);
  assert.match(source, /Cắt theo nhóm trang rồi gán mẫu đích/);
});

test('closing the modal keeps the active bulk session without resetting it', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const closeSection = source.match(/const handleClose = \(\) => \{[\s\S]*?\n  \};/u)?.[0] || '';
  assert.match(closeSection, /onClose\(\)/);
  assert.doesNotMatch(closeSection, /resetState\(\)/);
  assert.match(source, /Xóa phiên/);
});

test('switching the PDF mode does not silently clear the active session', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const modeSection = source.match(/const selectMode = \(nextMode: UploadMode\) => \{[\s\S]*?\n  \};/u)?.[0] || '';
  assert.doesNotMatch(modeSection, /resetState\(\)/);
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

test('combined flow materializes child PDFs before uploading them to selected targets', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /splitFile\?: File/);
  assert.match(source, /const splitCombinedSegments/);
  assert.match(source, /splitFileReady: true/);
  assert.match(source, /Lưu các PDF con vào mẫu đích/);
  assert.match(source, /hasUnsplitSegments \? 'Tách PDF con và lưu vào mẫu đích'/);
});

test('bulk target mapping and ranges are locked while upload is in flight', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /const renderCandidateSelect = \(value: string \| undefined, onChange: \(value: string\) => void, disabled = false\)/);
  assert.match(source, /disabled=\{disabled\}/);
  assert.match(source, /disabled=\{isUploading \|\| segment\.status === 'uploaded'\}/);
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



test('combined scan uses footer batches before manual fallback', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(source, /const FOOTER_BATCH_SIZE = 6/);
  assert.match(analyzeSection, /extractKqtnBulkFooter/);
  assert.match(analyzeSection, /buildKqtnFooterSegments/);
  assert.doesNotMatch(analyzeSection, /extractKqtnBulkStructure/);
});

test('combined structure timeout switches directly to manual split', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(source, /const FOOTER_BATCH_SIZE = 6/);
  assert.match(analyzeSection, /isKqtnStructureTimeoutError\(error\)/);
  assert.match(analyzeSection, /if \(isKqtnStructureTimeoutError\(error\)\) \{[\s\S]*?structureFailed = true;[\s\S]*?break;/);
});

test('combined mapping OCRs only each detected segment first page', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /extractKqtnPdfMetadata/);
  assert.match(analyzeSection, /draft\.pageStart, draft\.pageStart/);
  assert.match(analyzeSection, /first-page|trang đầu/i);
});

test('bulk file selection waits for explicit confirmation before AI analysis', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const singleSelectionSection = source.slice(source.indexOf('const handleSingleFiles'), source.indexOf('const analyzeSingleFiles'));
  const combinedSelectionSection = source.slice(source.indexOf('const handleCombinedFile'), source.indexOf('const confirmPendingAnalysis'));
  assert.doesNotMatch(singleSelectionSection, /extractKqtnPdfMetadata|setIsInspectingAi|analyzeSingleFiles/);
  assert.doesNotMatch(combinedSelectionSection, /analyzeCombinedFile/);
  assert.match(source, /Xác nhận và bắt đầu phân tích/);
  assert.match(source, /const confirmPendingAnalysis/);
  assert.match(source, /analyzeSingleFiles\(files\)/);
  assert.match(source, /analyzeCombinedFile\(file\)/);
});

// --- End of kqtn-ui-contract.test.ts ---
