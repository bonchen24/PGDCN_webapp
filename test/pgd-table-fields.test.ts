import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPgdTableRow,
  getPgdTableColumnInputType,
  getPgdTableColumnLabel,
  normalizePgdTableRows,
  removePgdTableRow,
  updatePgdTableCell,
} from '../utils/pgdTableFields.ts';

test('PGD table fields expose readable column labels and input types', () => {
  assert.equal(getPgdTableColumnLabel('sampleCode'), 'Mã mẫu');
  assert.equal(getPgdTableColumnLabel('unknownColumn'), 'Unknown column');
  assert.equal(getPgdTableColumnInputType('quantity'), 'number');
  assert.equal(getPgdTableColumnInputType('date'), 'date');
  assert.equal(getPgdTableColumnInputType('activity'), 'text');
});

test('PGD table rows support add, edit, remove and column-safe normalization', () => {
  const columns = ['item', 'quantity', 'unit'];
  const first = createPgdTableRow(columns);
  assert.deepEqual(first, { item: '', quantity: '', unit: '' });
  const edited = updatePgdTableCell([first], 0, 'item', 'Thép cuộn');
  const withSecond = [...edited, createPgdTableRow(columns, { quantity: 4, ignored: 'x' })];
  assert.deepEqual(normalizePgdTableRows(withSecond, columns), [
    { item: 'Thép cuộn', quantity: '', unit: '' },
    { item: '', quantity: 4, unit: '' },
  ]);
  assert.deepEqual(removePgdTableRow(withSecond, 0), [{ item: '', quantity: 4, unit: '' }]);
});
