// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for private KQTN PDF storage routes.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('server exposes upload, inline view, download, and delete routes for KQTN PDFs', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /\/api\/kqtn\/:recordId\/pdf/);
  assert.match(source, /file_assets/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /SUPABASE_STORAGE_URL/);
  assert.match(source, /KQTN_PDF_MAX_BYTES/);
  assert.match(source, /\/api\/gemini\/extract-kqtn-metadata/);
  assert.match(source, /\/api\/gemini\/extract-kqtn-bulk-structure/);
  assert.match(source, /isReportCover/);
  assert.match(source, /pageOffset/);
});

test('browser client exposes combined-PDF structure extraction', () => {
  const source = fs.readFileSync(new URL('../utils/kqtnPdfClient.ts', import.meta.url), 'utf8');
  assert.match(source, /extractKqtnBulkStructure/);
  assert.match(source, /extract-kqtn-bulk-structure/);
  assert.match(source, /pageOffset/);
});

test('browser client exposes footer-only combined-PDF extraction', () => {
  const source = fs.readFileSync(new URL('../utils/kqtnPdfClient.ts', import.meta.url), 'utf8');
  assert.match(source, /extractKqtnBulkFooter/);
  assert.match(source, /mode: 'footer'/);
  assert.match(source, /footerKey/);
});

test('browser client exposes PaddleOCR page and footer extraction', () => {
  const source = fs.readFileSync(new URL('../utils/kqtnPdfClient.ts', import.meta.url), 'utf8');
  assert.match(source, /extractKqtnFooterWithPaddle/);
  assert.match(source, /extractKqtnPageTextWithPaddle/);
  assert.match(source, /\/api\/kqtn\/ocr\/footer/);
  assert.match(source, /\/api\/kqtn\/ocr\/page/);
});

test('browser client identifies proxy and API structure timeouts', () => {
  const source = fs.readFileSync(new URL('../utils/kqtnPdfClient.ts', import.meta.url), 'utf8');
  assert.match(source, /isKqtnStructureTimeoutError/);
  assert.match(source, /status === 504 \|\| status === 524/);
  assert.match(source, /KQTN_STRUCTURE_TIMEOUT/);
});

test('storage client supports downloading a private object', () => {
  const source = fs.readFileSync(new URL('../utils/supabaseStorage.ts', import.meta.url), 'utf8');
  assert.match(source, /downloadObject/);
  assert.match(source, /response\.arrayBuffer\(\)/);
});


test('bulk structure prompt handles rotated scans and ignores repeated footer identifiers', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /scan ảnh/);
  assert.match(source, /xoay/);
  assert.match(source, /footer/);
});

test('bulk structure extraction is bounded below the reverse-proxy timeout', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /KQTN_BULK_STRUCTURE_TIMEOUT_MS = 45_000/);
  assert.match(source, /getGeminiClient\(req, \{\s*timeout: KQTN_BULK_STRUCTURE_TIMEOUT_MS,\s*\}\)/);
  assert.match(source, /modelNames: \[preferredModel \|\| CANDIDATE_MODELS\[0\]\]/);
  assert.match(source, /attemptsPerModel: 1/);
  assert.match(source, /code: KQTN_STRUCTURE_TIMEOUT_CODE/);
  assert.match(source, /res\.status\(504\)/);
});

test('bulk structure endpoint supports a footer-only analysis mode', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /analysisMode/);
  assert.match(source, /mode === "footer"/);
  assert.match(source, /footerKey/);
  assert.match(source, /Không lấy số trang/);
});

test('bulk structure endpoint logs safe request diagnostics', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /KQTN \$\{analysisMode\} request/);
  assert.match(source, /pageOffset=\$\{safeOffset\}/);
  assert.match(source, /payloadBytes/);
});

test('server proxies KQTN page and footer OCR through the internal PaddleOCR service', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /OCR_SERVICE_URL/);
  assert.match(source, /\/api\/kqtn\/ocr\/footer/);
  assert.match(source, /\/api\/kqtn\/ocr\/page/);
  assert.match(source, /\/ocr\/pdf\/\$\{mode\}/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /AbortController/);
});

test('large scanned combined PDFs use one asynchronous multipart footer job', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /KQTN_BULK_SOURCE_MAX_BYTES/);
  assert.match(source, /footer-jobs/);
  assert.match(source, /multer/);
  assert.match(source, /jobId/);
  assert.match(source, /processedPages/);
  assert.match(source, /footer-batch/);
  assert.match(source, /extractKqtnFooterKey/);
  assert.match(source, /KQTN_FOOTER_JOB_MAX_ACTIVE/);
  assert.match(source, /KQTN_FOOTER_JOB_BUSY/);
});

test('large scan footer job uses bounded footer-only windows', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const jobStart = source.indexOf('const runKqtnFooterJob');
  const jobEnd = source.indexOf('const handleKqtnFooterJobUpload', jobStart);
  const jobBlock = source.slice(jobStart, jobEnd);
  assert.match(jobBlock, /\/ocr\/pdf\/footer-fast/);
  assert.match(jobBlock, /createKqtnFooterOnlyPdfWindows/);
  assert.match(jobBlock, /createKqtnFooterOnlyPdfPages/);
  assert.match(jobBlock, /getKqtnFooterBoundaryProbePages/);
  assert.match(source, /KQTN_FOOTER_BOUNDARY_PROBE_RADIUS/);
  assert.match(jobBlock, /chunk_size/);
  assert.match(jobBlock, /for \(const footerWindow of footerWindows\)/);
  assert.match(jobBlock, /\/ocr\/pdf\/footer-batch/);
  assert.match(jobBlock, /strategy/);
  assert.match(source, /type KqtnFooterJobStrategy = "footer-batch"/);
});

test('bulk footer job requests footer-only candidates with bounded render windows', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const jobStart = source.indexOf('const runKqtnFooterJob');
  const jobEnd = source.indexOf('const handleKqtnFooterJobUpload', jobStart);
  const jobBlock = source.slice(jobStart, jobEnd);
  assert.match(jobBlock, /searchParams\.set\("thumbnail_dpi", "90"\)/);
  assert.match(jobBlock, /searchParams\.set\("ocr_dpi", "150"\)/);
  assert.match(jobBlock, /searchParams\.set\("chunk_size", "8"\)/);
  assert.match(jobBlock, /searchParams\.set\("max_candidates", "32"\)/);
  assert.doesNotMatch(jobBlock, /footer_ratio/);
});

test('browser client exposes asynchronous footer-job start and polling', () => {
  const source = fs.readFileSync(new URL('../utils/kqtnPdfClient.ts', import.meta.url), 'utf8');
  assert.match(source, /startKqtnFooterJob/);
  assert.match(source, /getKqtnFooterJob/);
  assert.match(source, /FormData/);
  assert.match(source, /footer-jobs/);
  assert.match(source, /strategy/);
  assert.match(source, /page\?\.text/);
  assert.match(source, /candidateScore: Number\(page\?\.candidateScore/);
});

// --- End of kqtn-pdf-api-contract.test.ts ---
