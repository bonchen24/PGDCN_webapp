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

// --- End of kqtn-pdf-api-contract.test.ts ---
