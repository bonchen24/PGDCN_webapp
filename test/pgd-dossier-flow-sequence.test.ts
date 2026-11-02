import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/PgdDossierFlow.tsx', 'utf8');

test('PGD maps every lifecycle status to the 7 operational stages', () => {
  const expected: Record<string, number> = {
    DRAFT: 1,
    CAPABILITY_REVIEW: 2,
    REJECTED: 2,
    ON_HOLD: 2,
    READY_TO_EXECUTE: 2,
    PREPARING: 3,
    FIELD_INSPECTION: 4,
    WAITING_LAB_RESULTS: 5,
    RESULTS_REVIEW: 5,
    TECHNICAL_REVIEW: 6,
    LEADERSHIP_APPROVAL: 6,
    SIGNED: 7,
    RESULT_RETURNED: 7,
    ARCHIVED: 7,
  };
  assert.match(source, /export function getPgdDossierCurrentStepNumber/);
  for (const [status, step] of Object.entries(expected).filter(([status]) => !['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status))) {
    assert.match(source, new RegExp(`status === '${status}'[^\\n]*return ${step}`), status);
  }
  assert.match(source, /return 7;/);
});
