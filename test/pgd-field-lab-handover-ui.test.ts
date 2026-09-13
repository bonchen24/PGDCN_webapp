import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PGD field station exposes lab handover before the workflow can move to waiting for results', () => {
  const source = readFileSync('components/PgdStationFormsPanel.tsx', 'utf8');
  assert.match(source, /targetStationKey: handoverOnly \? 'FIELD_SAMPLING' : 'LAB_RESULTS'/);
  assert.match(source, /export function PgdFieldInspectionStepPanel[\s\S]{0,300}<PgdLabRequestForm \{\.\.\.props\} handoverOnly/);
});
