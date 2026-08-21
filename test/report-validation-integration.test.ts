// Author: Gemini
// OS support: Web/Node
// Description: Regression checks for ReportGenerator validation wiring and action guards

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');

test('report generator derives report consistency validation from form state', () => {
  assert.match(source, /validateReportConsistency/);
  assert.match(source, /reportValidation/);
  assert.match(source, /selectedSample/);
});

test('report generator guards save and DOCX actions when validation has errors', () => {
  assert.match(source, /if \(reportValidation\.hasErrors\)[\s\S]*Lưu báo cáo/);
  assert.match(source, /if \(reportValidation\.hasErrors\)[\s\S]*xuất báo cáo DOCX/);
  assert.match(source, /disabled=\{isSavingReport \|\| isGeneratingDocx \|\| reportValidation\.hasErrors\}/);
  assert.match(source, /disabled=\{isGeneratingDocx \|\| isSavingReport \|\| reportValidation\.hasErrors\}/);
});

test('report generator explains where blocking DOCX errors must be fixed', () => {
  assert.match(source, /Xuất DOCX đang bị chặn/);
  assert.match(source, /Cần xử lý:/);
  assert.match(source, /reportValidation\.issues\.filter\(issue => issue\.severity === 'error'\)/);
});

test('report generator explains that mismatch warnings do not block DOCX', () => {
  assert.match(source, /Có cảnh báo đối soát/);
  assert.match(source, /Vẫn có thể xuất DOCX/);
});

test('report generator preserves detailed form data when saving a report', () => {
  assert.match(source, /testResultsData: JSON\.parse\(JSON\.stringify\(testResults\)\)/);
  assert.match(source, /emcData: JSON\.parse\(JSON\.stringify\(emcData\)\)/);
  assert.match(source, /dayCapDienData: JSON\.parse\(JSON\.stringify\(dayCapDienData\)\)/);
});

// --- End of report-validation-integration.test.ts ---
