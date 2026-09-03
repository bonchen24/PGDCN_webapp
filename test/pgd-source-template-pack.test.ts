import test from 'node:test';
import assert from 'node:assert/strict';

import { getPgdDocumentTemplate, snapshotPgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import { inspectPgdTemplateSource } from '../utils/pgdTemplatePack.ts';

test('exposes the four source-derived PGD template kinds with packaged DOCX files', () => {
  for (const kind of ['DOSSIER_COVER', 'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW', 'INSPECTION_MINUTES', 'SAMPLE_HANDOVER'] as const) {
    const template = getPgdDocumentTemplate(kind, 'STEEL_METAL');
    assert.ok(template);
    assert.equal(template.domain, 'pgd');
    assert.equal(inspectPgdTemplateSource(template).status, 'READY');
  }
});

test('preserves table column labels and row limits in a template snapshot', () => {
  const template = getPgdDocumentTemplate('CASE_TIMELINE', 'STEEL_METAL')!;
  const cell = template.cells.find((item) => item.key === 'eventRows')!;
  assert.equal(cell.tableColumnLabels?.time, 'Thời gian');
  assert.equal(cell.validation?.minRows, 1);
  assert.equal(snapshotPgdDocumentTemplate(template, '2026-09-03T00:00:00.000Z').cells.find((item) => item.key === 'eventRows')?.tableColumns?.includes('activity'), true);
});
