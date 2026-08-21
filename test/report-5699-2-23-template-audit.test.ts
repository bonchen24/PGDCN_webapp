// Author: Gemini
// OS support: Web/Node
// Description: Regression coverage for all missing rows found in the 5699-2-23 DOCX template audit

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const standards = fs.readFileSync(new URL('../lib/standards.ts', import.meta.url), 'utf8');
const hairDryerClauses = standards.slice(
  standards.indexOf('export const SKIN_HAIR_CARE_CLAUSES'),
  standards.indexOf('export const SKIN_HAIR_CARE_REDUCED_CLAUSES')
);

test('5699-2-23 includes every missing DOCX template evaluation row', () => {
  for (const clauseId of [
    '13.1_1',
    '22.2_1',
    '22.2_2',
    '22.2_3',
    '22.2_4',
    '22.14_1',
    '22.32_1',
    '22.36_1',
    '24.2_1',
    '24.2_2',
    '24.2_3',
    '27.1_1',
    '27.1_2',
    '27.3_1',
    '30.1_1',
    '30.2_1',
  ]) {
    assert.match(hairDryerClauses, new RegExp(`id: "${clauseId}"`));
  }
});

// --- End of test/report-5699-2-23-template-audit.test.ts ---
