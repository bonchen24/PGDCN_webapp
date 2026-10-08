// Author: Codex
// OS support: Web/Node
// Description: Contract tests for the shared TVCI PaddleOCR page/footer service.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tvciOcrSource = fs.readFileSync(new URL('../../TVCI_APP/ocr_service/main.py', import.meta.url), 'utf8');
const tvciRequirementsSource = fs.readFileSync(new URL('../../TVCI_APP/ocr_service/requirements.txt', import.meta.url), 'utf8');
const tvciComposeSource = fs.readFileSync(new URL('../../TVCI_APP/docker-compose.yml', import.meta.url), 'utf8');
const ddtComposeSource = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
const ddtEnvExampleSource = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const ddtServerSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('shared PaddleOCR service exposes page and footer PDF OCR endpoints', () => {
  assert.match(tvciOcrSource, /@app\.post\("\/ocr\/pdf\/footer"/);
  assert.match(tvciOcrSource, /@app\.post\("\/ocr\/pdf\/page"/);
  assert.match(tvciOcrSource, /footer_ratio/);
  assert.match(tvciOcrSource, /first_page=/);
  assert.match(tvciOcrSource, /last_page=/);
  assert.match(tvciOcrSource, /processing_time_s/);
});

test('shared PaddleOCR service exposes a chunked footer batch endpoint for large scans', () => {
  assert.match(tvciOcrSource, /@app\.post\("\/ocr\/pdf\/footer-batch"/);
  assert.match(tvciOcrSource, /chunk_size/);
  assert.match(tvciOcrSource, /pdfinfo_from_bytes/);
  assert.match(tvciOcrSource, /max.*100/);
  assert.match(tvciOcrSource, /footer_ratio/);
});

test('footer OCR crops the single-page image and DDT pre-crops the batch PDF', () => {
  const pageStart = tvciOcrSource.indexOf('def ocr_pdf_page(');
  const pageEnd = tvciOcrSource.indexOf('\n\n# ─── Routes', pageStart);
  const pageBlock = tvciOcrSource.slice(pageStart, pageEnd);
  assert.match(pageBlock, /image\s*=\s*image\.crop/);
  assert.match(pageBlock, /footer_ratio/);
  assert.match(ddtServerSource, /async function createKqtnFooterOnlyPdfWindows/);
  assert.match(ddtServerSource, /KQTN_FOOTER_WINDOW_OVERLAP/);
  assert.match(ddtServerSource, /page\.setMediaBox\(x, y, cropWidth, cropHeight\)/);
  assert.match(ddtServerSource, /page\.setCropBox\(x, y, cropWidth, cropHeight\)/);
  assert.match(ddtServerSource, /rotation === 270/);
  assert.match(ddtServerSource, /KQTN_FOOTER_RATIO\s*=\s*0\.08/);
  assert.match(tvciOcrSource, /_ocr_inference_lock\s*=\s*threading\.Lock\(\)/);
  assert.match(tvciOcrSource, /with\s+_ocr_inference_lock:/);
});

test('fast scan OCR prefers the native text layer and OCRs only full-page candidates', () => {
  const fastStart = tvciOcrSource.indexOf('@app.post("/ocr/pdf/footer-fast"');
  const fastEnd = tvciOcrSource.indexOf('@app.post("/ocr/pdf/footer-batch"', fastStart);
  const fastBlock = tvciOcrSource.slice(fastStart, fastEnd);
  assert.notEqual(fastStart, -1);
  assert.match(tvciOcrSource, /pdftotext/);
  assert.match(fastBlock, /native-text/);
  assert.match(fastBlock, /visual-candidates/);
  assert.match(fastBlock, /candidate/);
  assert.match(fastBlock, /ocr_images/);
  assert.match(fastBlock, /FAST_SCAN_OCR_BATCH_SIZE/);
  assert.doesNotMatch(fastBlock, /image\.crop/);
  assert.match(fastBlock, /MAX_CANDIDATES/);
  assert.match(tvciOcrSource, /minimum_gap/);
});

test('shared PaddleOCR service joins the DDT Supabase network', () => {
  const ocrServiceBlock = tvciComposeSource.slice(tvciComposeSource.indexOf('ocr_service:'), tvciComposeSource.indexOf('  # TVCI_APP'));
  assert.match(ocrServiceBlock, /supabase_default/);
  assert.match(ddtComposeSource, /OCR_SERVICE_URL.*tvci_ocr_service:8100/);
});

test('host development can reach shared PaddleOCR through loopback only', () => {
  const ocrServiceBlock = tvciComposeSource.slice(tvciComposeSource.indexOf('ocr_service:'), tvciComposeSource.indexOf('  # TVCI_APP'));
  assert.match(ocrServiceBlock, /127\.0\.0\.1:8100:8100/);
  assert.match(ddtEnvExampleSource, /^OCR_SERVICE_URL=http:\/\/127\.0\.0\.1:8100$/m);
  assert.match(ddtServerSource, /NODE_ENV.*127\.0\.0\.1:8100/);
});

test('shared PaddleOCR uses the lightweight model pair and disables expensive orientation pipelines', () => {
  assert.match(tvciOcrSource, /use_doc_orientation_classify=False/);
  assert.match(tvciOcrSource, /use_doc_unwarping=False/);
  assert.match(tvciOcrSource, /use_textline_orientation=False/);
  assert.match(tvciOcrSource, /text_detection_model_name=.*PP-OCRv5_mobile_det/);
  assert.match(tvciOcrSource, /text_recognition_model_name=.*PP-OCRv5_mobile_rec/);
});

test('shared PaddleOCR warms the model and persists downloaded model caches', () => {
  assert.match(tvciOcrSource, /OCR_WARMUP/);
  assert.match(tvciOcrSource, /asyncio\.to_thread\(get_ocr_engine\)/);
  const ocrServiceBlock = tvciComposeSource.slice(tvciComposeSource.indexOf('ocr_service:'), tvciComposeSource.indexOf('  # TVCI_APP'));
  assert.match(ocrServiceBlock, /ocr_model_cache/);
  assert.match(ocrServiceBlock, /ocr_paddlex_cache/);
});

test('shared PaddleOCR pins a CPU-compatible Paddle runtime pair', () => {
  assert.match(tvciRequirementsSource, /^paddleocr==3\.7\.0$/m);
  assert.match(tvciRequirementsSource, /^paddlepaddle==3\.2\.0$/m);
});

test('DDT requests a lower OCR DPI for responsive bulk inspection', () => {
  assert.match(ddtServerSource, /mode === "footer" \? "120" : "150"/);
});

// --- End of kqtn-paddleocr-contract.test.ts ---
