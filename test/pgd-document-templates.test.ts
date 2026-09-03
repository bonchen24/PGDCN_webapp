import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PGD_DOCUMENT_TEMPLATES,
  getPgdDocumentTemplate,
  normalizePgdTemplateCells,
  validatePgdTemplateCells,
  normalizePgdCellValues,
  validatePgdCellValues,
  snapshotPgdDocumentTemplate,
  type PgdDocumentTemplate,
} from '../utils/pgdDocumentTemplates.ts';

test('PGD catalog contains the operational document set derived from department forms', () => {
  assert.equal(DEFAULT_PGD_DOCUMENT_TEMPLATES.length, 9);
  assert.deepEqual(DEFAULT_PGD_DOCUMENT_TEMPLATES.map((template) => template.kind), [
    'INTAKE_REQUEST',
    'ASSIGNMENT',
    'INSPECTION_PLAN',
    'FIELD_INSPECTION',
    'SAMPLE_TAKING',
    'LAB_REQUEST',
    'INSPECTION_REPORT',
    'DECISION',
    'INSPECTION_CERTIFICATE',
  ]);
  for (const template of DEFAULT_PGD_DOCUMENT_TEMPLATES) {
    assert.equal(template.domain, 'pgd');
    assert.ok(template.cells.length > 0);
    assert.doesNotMatch(JSON.stringify(template), /QC20|Desktop|TVCI_NAS|\\\\/i);
  }
  assert.equal(getPgdDocumentTemplate('INSPECTION_CERTIFICATE', 'STEEL_METAL')?.methodCodes?.includes('TT58'), true);
  assert.equal(getPgdDocumentTemplate('INSPECTION_CERTIFICATE', 'STEEL_METAL')?.methodCodes?.includes('QT-GĐ-14'), true);
  assert.equal(getPgdDocumentTemplate('DECISION', 'STEEL_METAL')?.methodCodes?.includes('QT-GĐ-14'), true);
});

test('PGD decision output has an independent approval document contract', () => {
  const decision = getPgdDocumentTemplate('DECISION', 'STEEL_METAL')!;
  assert.equal(decision.code, 'PGD-BM-09');
  assert.equal(decision.cells.find((cell) => cell.key === 'decisionNumber')?.required, true);
  assert.equal(decision.cells.find((cell) => cell.key === 'decisionText')?.required, true);
  assert.equal(decision.cells.some((cell) => cell.key === 'paymentStatus' || cell.key === 'quotation'), false);
});

test('QT-GĐ-14 exposes its lot sampling inputs in intake and sample-taking cells', () => {
  const intake = getPgdDocumentTemplate('INTAKE_REQUEST', 'STEEL_METAL')!;
  const sampleTaking = getPgdDocumentTemplate('SAMPLE_TAKING', 'STEEL_METAL')!;
  for (const template of [intake, sampleTaking]) {
    assert.equal(template.cells.find((cell) => cell.key === 'steelLotSize')?.binding, 'request.productDetails.steelLotSize');
    assert.equal(template.cells.find((cell) => cell.key === 'steelSameGradeMultiProduct')?.binding, 'request.productDetails.steelSameGradeMultiProduct');
    assert.equal(template.cells.find((cell) => cell.key === 'steelManualSamplingPlanNote')?.binding, 'request.productDetails.steelManualSamplingPlanNote');
    assert.equal(template.placeholderKeys.includes('steelLotSize'), true);
    assert.equal(template.placeholderKeys.includes('steelSameGradeMultiProduct'), true);
    assert.equal(template.placeholderKeys.includes('steelManualSamplingPlanNote'), true);
  }
});

test('TT58 keeps the source-derived conformity assessment method as a dedicated cell', () => {
  for (const kind of ['INTAKE_REQUEST', 'INSPECTION_PLAN', 'SAMPLE_TAKING', 'INSPECTION_REPORT', 'DECISION', 'INSPECTION_CERTIFICATE'] as const) {
    const template = getPgdDocumentTemplate(kind, 'STEEL_METAL')!;
    const assessmentMethod = template.cells.find((cell) => cell.key === 'assessmentMethod');
    assert.equal(assessmentMethod?.binding, 'request.assessmentMethod');
    assert.equal(template.placeholderKeys.includes('assessmentMethod'), true);
  }
});

test('PGD cell definitions are normalized and duplicate or unsafe cells are rejected', () => {
  const cells = normalizePgdTemplateCells([
    { key: ' lotCode ', label: ' Số lô ', sectionCode: 'lot', row: 2, column: 1, type: 'TEXT', required: true },
    { key: 'quantity', label: 'Khối lượng', sectionCode: 'lot', row: 1, column: 2, type: 'NUMBER', required: false, unit: 'tấn' },
    { key: 'optionalNote', label: 'Ghi chú tùy chọn', sectionCode: 'note', row: 3, column: 1, type: 'TEXT', required: true, active: false },
  ]);
  assert.deepEqual(cells.map((cell) => cell.key), ['quantity', 'lotCode', 'optionalNote']);
  assert.equal(cells[1].label, 'Số lô');
  assert.equal(cells.find((cell) => cell.key === 'optionalNote')?.active, false);
  assert.equal(cells.find((cell) => cell.key === 'quantity')?.active, true);

  const issues = validatePgdTemplateCells([
    { key: 'lotCode', label: 'Số lô', sectionCode: 'lot', row: 0, column: 1, type: 'TEXT', required: true },
    { key: 'lotCode', label: 'Số lô khác', sectionCode: 'lot', row: 1, column: 1, type: 'TEXT', required: false },
  ]);
  assert.deepEqual(issues.map((issue) => issue.code), ['DUPLICATE_KEY', 'INVALID_POSITION']);
});

test('PGD cell values are coerced to their schema types and required values are checked', () => {
  const template = getPgdDocumentTemplate('FIELD_INSPECTION', 'STEEL_METAL')!;
 const values = normalizePgdCellValues(template.cells, {
    requestCode: 'PYC-GD-001',
    customerName: 'Công ty A',
    customerAddress: 'Hà Nội',
    productName: 'Thép cuộn',
   lotObservation: ' Bao gói nguyên vẹn ',
    performedAt: '2026-09-02',
    location: 'Kho A',
    packaging: 'Nguyên vẹn',
    labeling: 'Có số lô',
   measurements: [{ dimension: 'Dày', value: 1.2 }],
   nonconformities: [],
    sampleRows: [{ sampleCode: 'M01', quantity: 1, disposition: 'LAB' }],
 });
  assert.equal(values.find((value) => value.key === 'lotObservation')?.value, 'Bao gói nguyên vẹn');
  assert.deepEqual(values.find((value) => value.key === 'measurements')?.value, [{ dimension: 'Dày', value: 1.2 }]);
  assert.deepEqual(validatePgdCellValues(template.cells, values), []);

  const missing = validatePgdCellValues(template.cells, normalizePgdCellValues(template.cells, {}));
  assert.ok(missing.some((issue) => issue.key === 'lotObservation' && issue.code === 'REQUIRED'));

  const inactiveRequired = [{ key: 'inactive', label: 'Không dùng', sectionCode: 'note', row: 1, column: 1, type: 'TEXT' as const, required: true, active: false }];
  assert.deepEqual(validatePgdCellValues(inactiveRequired, normalizePgdCellValues(inactiveRequired, {})), []);
});

test('PGD template snapshots are immutable copies with a captured version and timestamp', () => {
  const template = getPgdDocumentTemplate('LAB_REQUEST', 'STEEL_METAL')!;
  const snapshot = snapshotPgdDocumentTemplate(template, '2026-09-02T05:00:00.000Z');
  assert.equal(snapshot.templateId, template.id);
  assert.equal(snapshot.version, template.version);
  assert.equal(snapshot.capturedAt, '2026-09-02T05:00:00.000Z');
  assert.notEqual(snapshot.cells, template.cells);
  assert.notEqual(snapshot.cells[0], template.cells[0]);
  assert.equal((snapshot as unknown as PgdDocumentTemplate).active, undefined);
});
