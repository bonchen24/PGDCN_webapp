import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('components/PcnOperationalFormModal.tsx', 'utf8');

test('PCN operational forms derive red required markers from the shared validation contract', () => {
  assert.match(source, /FORM_REQUIRED_FIELDS/);
  assert.match(source, /function FormField[\s\S]*text-rose-600/);
  assert.match(source, /const isRequired = \(field: string\)/);
  assert.match(source, /required=\{isRequired\(field\)\}/);
});

test('PCN operational date and scalar controls use visible Vietnamese labels without HTML placeholders', () => {
  assert.match(source, /PgdcnDateInput/);
  assert.doesNotMatch(source, /placeholder=/);
  assert.match(source, /text-rose-600/);
});
