// Author: Gemini
// OS support: Web/Node
// Description: Regression checks for wiring dynamic label photos into the DOCX server route

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

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

test('DOCX generation maps managerName and managerNam to reportMeta.managerName', () => {
  assert.match(source, /managerName:\s*reportMeta\?\.managerName/);
  assert.match(source, /managerNam:\s*reportMeta\?\.managerName/);
});

test('DOCX generation limits power disturbance tables to at most 1 row', () => {
  assert.match(source, /table_6_3_1_1:\s*subOptionTitle[\s\S]*?\(emcData\?\.tablePower\s*\|\|\s*\[\]\)\.slice\(0,\s*1\)/);
  assert.match(source, /table_6_3_2_1:\s*subOptionTitle[\s\S]*?\(emcData\?\.tablePower_2\s*\|\|\s*\[\]\)\.slice\(0,\s*1\)/);
  assert.match(source, /tablePower:\s*\(emcData\?\.tablePower\s*\|\|\s*\[\]\)\.slice\(0,\s*1\)/);
});

// --- End of report-docx-image-integration.test.ts ---
