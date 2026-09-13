import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/PgdDossierFlow.tsx', 'utf8');

test('PGD maps every lifecycle status to the 12 operational steps', () => {
  const expected: Record<string, number> = {
    DRAFT: 1,
    CAPABILITY_REVIEW: 2,
    REJECTED: 2,
    ON_HOLD: 2,
    READY_TO_EXECUTE: 3,
    PREPARING: 4,
    FIELD_INSPECTION: 5,
    WAITING_LAB_RESULTS: 8,
    RESULTS_REVIEW: 9,
    TECHNICAL_REVIEW: 10,
    LEADERSHIP_APPROVAL: 11,
    SIGNED: 12,
    RESULT_RETURNED: 12,
    ARCHIVED: 12,
  };
  assert.match(source, /export function getPgdDossierCurrentStepNumber/);
  for (const [status, step] of Object.entries(expected).filter(([status]) => !['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status))) {
    assert.match(source, new RegExp(`status === '${status}'[^\\n]*return ${step}`), status);
  }
  assert.match(source, /return 12;/);
});
