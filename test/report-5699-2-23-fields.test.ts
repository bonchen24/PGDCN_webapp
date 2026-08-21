// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for the complete TCVN 5699-2-23 report form fields

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const standards = fs.readFileSync(new URL('../lib/standards.ts', import.meta.url), 'utf8');
const reportView = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');

const hairDryerClauses = standards.slice(
  standards.indexOf('export const SKIN_HAIR_CARE_CLAUSES'),
  standards.indexOf('export const SKIN_HAIR_CARE_REDUCED_CLAUSES')
);

test('5699-2-23 includes the missing nested clause input rows', () => {
  for (const clauseId of ['22.32_1', '24.2_1', '24.2_2', '24.2_3', '30.2_1']) {
    assert.match(hairDryerClauses, new RegExp(`id: "${clauseId}"`));
  }
});

test('5699-2-23 initializes the needle-flame detail input rows', () => {
  const heatFireInitialization = reportView.slice(
    reportView.indexOf("clause.subTable === 'HEAT_FIRE'"),
    reportView.indexOf("clause.subTable === 'CLAUSE_32'")
  );

  assert.match(heatFireInitialization, /standard\.id === 'hair_dryer'/);
  assert.match(heatFireInitialization, /Thử nghiệm ngọn lửa hình kim/);
  assert.match(heatFireInitialization, /limit: '≤ 30'/);
  assert.match(heatFireInitialization, /limit: '≤ 15'/);
});

// --- End of test/report-5699-2-23-fields.test.ts ---
