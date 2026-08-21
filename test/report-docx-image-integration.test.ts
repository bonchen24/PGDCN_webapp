// Author: Gemini
// OS support: Web/Node
// Description: Regression checks for wiring dynamic label photos into the DOCX server route

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('DOCX generation uses the dynamic label-to-slot mapping', () => {
  assert.match(source, /reportDocxImageMapping/);
  assert.match(source, /buildReportDocxImageSlots\(/);
  assert.match(source, /Object\.assign\(data, buildReportDocxImageSlots\(/);
});

test('DOCX generation uses normalized metadata and fixed graph sizing', () => {
  assert.match(source, /reportDocxMetadata/);
  assert.match(source, /buildReportDocxMetadata\(/);
  assert.match(source, /reportDocxImageSizing/);
  assert.match(source, /getDocxGraphSize\(/);
  assert.doesNotMatch(source, /const targetW = 560;/);
});


test('DOCX generation combines dynamic labels and keeps anh_1 as their only target', () => {
  assert.match(source, /combineReportDocxLabelImages\(/);
  assert.match(source, /getReportDocxLabelImages\(/);
  assert.match(source, /combinedLabelImage/);
  const mappingIndex = source.indexOf('Object.assign(data, buildReportDocxImageSlots(');
  assert.ok(mappingIndex >= 0);
  assert.doesNotMatch(source.slice(mappingIndex), /data\.anh_[1-6]\s*=/);
});

// --- End of report-docx-image-integration.test.ts ---
