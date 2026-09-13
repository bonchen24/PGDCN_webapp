import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { orderPgdTemplateCells } from '../utils/pgdDocumentTemplates';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('PGD document fields follow the template position order and use a dense desktop grid', () => {
  const view = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(view, /orderPgdTemplateCells\(formCells\)/);
  assert.match(view, /xl:grid-cols-5/);
  assert.match(view, /gap-1\.5 p-2/);
});

test('PGD template ordering keeps section appearance and then row/column order', () => {
  const ordered = orderPgdTemplateCells([
    { key: 'a2', sectionCode: 'thong-tin', row: 2, column: 1 },
    { key: 'b2', sectionCode: 'mau', row: 2, column: 1 },
    { key: 'b1', sectionCode: 'mau', row: 1, column: 2 },
    { key: 'b0', sectionCode: 'mau', row: 1, column: 1 },
    { key: 'a1', sectionCode: 'thong-tin', row: 1, column: 1 },
  ]);
  assert.deepEqual(ordered.map((cell) => cell.key), ['a1', 'a2', 'b0', 'b1', 'b2']);
});

test('PCN operational forms expose template order metadata and compact multi-column layout', () => {
  const view = read('components/PcnOperationalFormModal.tsx');
  assert.match(view, /getPcnOperationalFormFieldOrder\(kind\)/);
  assert.match(view, /lg:grid-cols-4/);
  assert.match(view, /gap-2 p-3/);
});

test('summary registers keep many columns visible while reducing row height', () => {
  const view = read('components/PgdcnDossierSummaryGrid.tsx');
  assert.match(view, /min-w-\[1400px\]/);
  assert.match(view, /px-2 py-1\.5/);
});
