import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pcnSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');

test('PCN proposal and PGD PYC creation use the shared compact Windows modal', () => {
  assert.match(pcnSource, /PgdcnWindowsWorkflowModal/);
  assert.match(pgdSource, /PgdcnWindowsWorkflowModal/);
  for (const source of [pcnSource, pgdSource]) {
    assert.match(source, /onMinimize|Thu nhỏ cửa sổ/);
    assert.match(source, /PgdcnIntakeDropzone|PcnOcrPanel/);
    assert.match(source, /text-rose-600/);
  }
  assert.match(pgdSource, /PgdIntakeSampleTable/);
});

