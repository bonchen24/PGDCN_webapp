// Author: Gemini
// OS support: Web/Node
// Description: Regression checks for OCR data flowing into report fields

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const emcSource = fs.readFileSync(new URL('../components/EmcBepDien1VungNauForm.tsx', import.meta.url), 'utf8');
const reportSource = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('EMC form exposes a callback for OCR manufacturer and country values', () => {
  assert.match(emcSource, /onNameplateOcr\?:/);
  assert.match(emcSource, /normalizeNameplateOcrValues/);
  assert.match(emcSource, /onNameplateOcr\?\.\(/);
});

test('report generator passes the OCR metadata callback into the EMC form', () => {
  assert.match(reportSource, /onNameplateOcr=/);
  assert.match(reportSource, /reportMeta\.manufacturer/);
  assert.match(reportSource, /reportMeta\.countryOfOrigin/);
});

test('Gemini OCR schema names countryOfOrigin and keeps origin compatibility', () => {
  assert.match(serverSource, /countryOfOrigin:\s*\{\s*type:\s*Type\.STRING/);
  assert.match(serverSource, /origin:\s*\{\s*type:\s*Type\.STRING/);
});

// --- End of report-ocr-integration.test.ts ---
