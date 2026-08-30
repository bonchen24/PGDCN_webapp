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

test('KQTN view exposes payment unlock state and role-gated actions', () => {
  const source = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');
  assert.match(source, /customerPaymentConfirmed/);
  assert.match(source, /isKqtnPaymentManager/);
  assert.match(source, /Đã thanh toán/);
  assert.match(source, /Chưa mở khóa tải/);
  assert.match(source, /downloadKqtnPdf/);
});

test('office clerk navigation is restricted to the KQTN workbench', () => {
  const source = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(source, /office_clerk/);
  assert.match(source, /id: 'kqtn',[\s\S]*?roles: \['admin', 'tester', 'viewer', 'office_clerk'\]/);
  assert.match(source, /currentUser\?\.role === 'office_clerk' \? 'kqtn'/);
});

test('office clerk notification clicks cannot open handover workflows', () => {
  const source = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const handleSelectNotification');
  const handlerEnd = source.indexOf('const handleCloseHandoverModal', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  const guardOffset = handler.indexOf("currentUser?.role === 'office_clerk'");
  const destinationOffset = handler.indexOf('const destination = getNotificationDestination');
  assert.ok(guardOffset >= 0 && guardOffset < destinationOffset);
  assert.match(handler, /currentUser\?\.role === 'office_clerk'[\s\S]*?setActiveTab\('kqtn'\)[\s\S]*?return/);
});

test('system management exposes the dedicated office clerk role', () => {
  const source = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
  assert.match(source, /value="office_clerk"/);
  assert.match(source, /Văn thư chuyên trách/);
});

test('login establishes the server session before privileged KQTN actions are used', () => {
  const source = fs.readFileSync(new URL('../components/LoginScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /establishKqtnSession/);
});

test('bulk modal exposes PaddleOCR matching and manual candidate selection', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const comboboxSource = fs.readFileSync(new URL('../components/KqtnCandidateCombobox.tsx', import.meta.url), 'utf8');
  assert.match(source, /matchKqtnBulkFile/);
  assert.match(comboboxSource, /Tìm và chọn đầu mẫu/);
  assert.match(source, /uploadKqtnPdf/);
  assert.match(source, /extractKqtnPageTextWithPaddle/);
  assert.doesNotMatch(source, /extractKqtnPdfMetadata/);
});

test('bulk modal supports combined PDF review, page ranges, preview, and retry', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /startKqtnFooterJob/);
  assert.match(source, /extractKqtnPageTextWithPaddle/);
  assert.match(source, /buildKqtnBulkSegments/);
  assert.match(source, /pageStart/);
  assert.match(source, /pageEnd/);
  assert.match(source, /Xem PDF con/);
  assert.match(source, /Retry/);
  assert.match(source, /needs-review/);
  assert.match(source, /onBulkCompleted/);
});

test('combined page range editors preserve a blank transient edit until blur', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /rangeInputValues/);
  assert.match(source, /handleCombinedRangeInput/);
  assert.match(source, /commitCombinedRangeInput/);
  assert.match(source, /rawValue\.trim\(\) === ''/);
  assert.match(source, /onBlur=\{\(\) => commitCombinedRangeInput/);
});

test('footer page-count mismatches warn without blocking split or save', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const splitSection = source.slice(source.indexOf('const splitCombinedSegments'), source.indexOf('const validateSingleItems'));
  const uploadSection = source.slice(source.indexOf('const uploadCombinedSegments'), source.indexOf('const renderCandidateSelect'));
  for (const section of [splitSection, uploadSection]) {
    assert.match(section, /if \(footerPageCountErrors\.length > 0\) \{\s*toast\.warning\(footerPageCountErrors\[0\]\);\s*\}/);
    assert.doesNotMatch(section, /footerPageCountErrors\[0\]\);\s*return/);
  }
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

test('pending sample heads remain selectable and show warnings instead of being locked', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const comboboxSource = fs.readFileSync(new URL('../components/KqtnCandidateCombobox.tsx', import.meta.url), 'utf8');
  assert.match(source + comboboxSource, /isPending/);
  assert.match(comboboxSource, /isPending/);
  assert.match(comboboxSource, /Chưa có KQTN/);
  assert.doesNotMatch(comboboxSource, /disabled=\{pending\}/);
  assert.match(source, /candidate\.hasPdf/);
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

test('bulk target mapping uses a searchable combobox and remains locked while upload is in flight', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const comboboxSource = fs.readFileSync(new URL('../components/KqtnCandidateCombobox.tsx', import.meta.url), 'utf8');
  assert.match(source, /KqtnCandidateCombobox/);
  assert.match(source, /renderCandidateCombobox/);
  assert.match(source, /disabled=\{disabled\}/);
  assert.match(comboboxSource, /role="combobox"/);
  assert.match(source, /disabled=\{isUploading \|\| segment\.status === 'uploaded'\}/);
});

test('single upload allows pending targets after the warning-only change', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Cần lưu kết quả KQTN trước khi nhận PDF/);
  assert.match(source, /ensureKqtnUploadTarget/);
});


test('new combined source starts a fresh activity group', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /combinedGroupIdRef\.current = null/);
});



test('combined scan submits one asynchronous footer job before manual fallback', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /startKqtnFooterJob/);
  assert.match(analyzeSection, /getKqtnFooterJob/);
  assert.match(analyzeSection, /processedPages/);
  assert.doesNotMatch(analyzeSection, /extractKqtnFooterWithPaddle/);
  assert.match(analyzeSection, /buildKqtnFooterCandidateSegments/);
  assert.doesNotMatch(analyzeSection, /extractKqtnBulkStructure/);
});

test('combined footer job failure switches directly to manual split', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /getKqtnFooterJob/);
  assert.match(analyzeSection, /status === 'failed'/);
  assert.match(analyzeSection, /structureFailed = true/);
});

test('combined scan maps footer OCR pages without full-page candidate classification', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /strategy/);
  assert.match(analyzeSection, /footer-batch/);
  assert.match(analyzeSection, /buildKqtnFooterCandidateSegments/);
  assert.doesNotMatch(analyzeSection, /visual-candidates/);
  assert.doesNotMatch(analyzeSection, /buildKqtnFastCandidateSegments/);
  assert.match(analyzeSection, /detectedFooterPages/);
  assert.match(fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8'), /Footer OCR/);
});

test('combined mapping uses footer identifiers and probes only group-leading pages for model', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  assert.match(analyzeSection, /footerKey/);
  assert.match(analyzeSection, /getKqtnModelProbePageNumbers/);
  assert.match(analyzeSection, /extractKqtnPageTextWithPaddle/);
  assert.match(analyzeSection, /extractKqtnModelFromProbeTexts/);
  assert.match(analyzeSection, /createPdfSegmentFile/);
  assert.doesNotMatch(analyzeSection, /extractKqtnPdfMetadata/);

  const combinedBuilderSection = source.slice(source.indexOf('function buildCombinedSegment'), source.indexOf('function statusLabel'));
  assert.match(combinedBuilderSection, /sampleCode: metadata\.sampleCode/);
  assert.match(combinedBuilderSection, /reportNo: metadata\.reportNo/);
  assert.match(combinedBuilderSection, /model: metadata\.model/);
  assert.doesNotMatch(combinedBuilderSection, /model: metadata\.footerKey/);
});

test('single-file mapping uses first-page PaddleOCR without Gemini fallback', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const analyzeSection = source.slice(source.indexOf('const analyzeSingleFiles'), source.indexOf('const analyzeCombinedFile'));
  assert.match(analyzeSection, /extractKqtnPageTextWithPaddle/);
  assert.match(analyzeSection, /parseKqtnOcrMetadata/);
  assert.doesNotMatch(analyzeSection, /extractKqtnPdfMetadata/);
  assert.match(analyzeSection, /PaddleOCR[\s\S]*?(manual mapping|mapping thủ công|chọn mẫu thủ công)/i);
});

test('missing PaddleOCR metadata keeps bulk mapping manual instead of blocking on Gemini', () => {
  const source = fs.readFileSync(new URL('../components/KqtnBulkPdfUploadModal.tsx', import.meta.url), 'utf8');
  const singleSection = source.slice(source.indexOf('const analyzeSingleFiles'), source.indexOf('const analyzeCombinedFile'));
  const combinedSection = source.slice(source.indexOf('const analyzeCombinedFile'), source.indexOf('const handleCombinedFile'));
  for (const section of [singleSection, combinedSection]) {
    assert.doesNotMatch(section, /extractKqtnPdfMetadata/);
    assert.match(section, /(manual mapping|mapping thủ công|chọn mẫu thủ công)/i);
  }
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
