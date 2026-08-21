// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for report and KQTN identifier ordering and seal-stamp quick selection

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const reportView = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
const kqtnView = fs.readFileSync(new URL('../components/KQTNView.tsx', import.meta.url), 'utf8');

test('puts coding number first and removes the standalone report number field', () => {
  assert.doesNotMatch(reportView, />Số \(Nº\)<\/label>/);
  assert.ok(reportView.indexOf('>Số mã hóa</label>') < reportView.indexOf('>Ngày Phiếu YC</label>'));
  assert.doesNotMatch(reportView, /📅 Báo cáo:/);
});

test('provides seal-stamp quick selection while preserving manual entry', () => {
  assert.match(reportView, /list="sealStampCodesList"/);
  assert.match(reportView, /id="sealStampCodesList"/);
  assert.match(reportView, /MAHOA_CODES\.map/);
  assert.match(kqtnView, /list="kqtnSealStampCodesList"/);
  assert.match(kqtnView, /id="kqtnSealStampCodesList"/);
});

test('removes report number from the default KQTN presentation', () => {
  const defaultColumns = kqtnView.slice(kqtnView.indexOf('const DEFAULT_COLUMNS'), kqtnView.indexOf('];', kqtnView.indexOf('const DEFAULT_COLUMNS')) + 2);
  assert.doesNotMatch(defaultColumns, /id: 'reportNo'/);
  assert.ok(defaultColumns.indexOf("id: 'sampleCode'") < defaultColumns.indexOf("id: 'sealStamp'"));
  assert.doesNotMatch(kqtnView, /Số KQTN:/);
});

test('uses the coding number as the internal report identifier when saving', () => {
  assert.match(reportView, /reportNo:\s*reportMeta\.codingNumber\s*\|\|\s*reportMeta\.reportNo/);
});

// --- End of test/report-kqtn-identifier-ui.test.ts ---
