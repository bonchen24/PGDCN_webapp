import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';

import {
  buildPgdDocumentContext,
  buildPgdDocumentOutput,
  type PgdDocumentContext,
} from '../utils/pgdDocumentGeneration.ts';
import { getPgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import type { PgdInspectionRequest } from '../utils/pgdDomain.ts';

const request: PgdInspectionRequest = {
  id: 'request-1',
  domain: 'pgd',
  requestCode: 'PYC-GD-2026-001',
  intakeChannel: 'DIRECT',
  requester: { name: 'Nguyễn Văn A' },
  customerSnapshot: { name: 'Công ty Thép A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'STEEL_LOT_INSPECTION',
  productName: 'Thép cuộn',
  quantity: 12,
  unit: 'tấn',
  lotCode: 'LOT-001',
  inspectionScope: 'Nhận dạng, kích thước và chất lượng',
  inspectionLocation: 'Kho số 1',
  standards: ['JIS G 3141'],
  sampleIds: ['sample-1'],
  labRequestIds: ['lab-1'],
  status: 'RESULTS_REVIEW',
  documentPointers: [],
  payment: { status: 'PENDING' },
  createdAt: '2026-09-02T01:00:00.000Z',
  updatedAt: '2026-09-02T04:00:00.000Z',
};

test('PGD document context is deterministic and contains source snapshots plus cell values', () => {
  const template = getPgdDocumentTemplate('INSPECTION_REPORT', 'STEEL_METAL')!;
  const input = {
    template,
    request,
    cellValues: {
      reportNumber: 'BC-GD-001',
      labResults: [{ item: 'Ngoại quan', result: 'Phù hợp' }],
      conclusion: 'Phù hợp',
    },
    now: '2026-09-02T05:00:00.000Z',
  };
  const first = buildPgdDocumentContext(input);
  const second = buildPgdDocumentContext(input);
  assert.equal(first.domain, 'pgd');
  assert.equal(first.templateSnapshot.templateId, template.id);
  assert.deepEqual(first.cellValues.labResults, [{ item: 'Ngoại quan', result: 'Phù hợp' }]);
  assert.equal(first.contextHash, second.contextHash);
  assert.match(first.contextHash, /^[a-f0-9]{64}$/);
});

test('PGD document output produces downloadable DOCX and PDF with the same context hash', async () => {
  const template = getPgdDocumentTemplate('INSPECTION_CERTIFICATE', 'STEEL_METAL')!;
  const context: PgdDocumentContext = buildPgdDocumentContext({
    template,
    request,
    cellValues: { documentNumber: 'CT-GD-001', conclusion: 'Phù hợp' },
    now: '2026-09-02T05:00:00.000Z',
  });
  const docx = await buildPgdDocumentOutput(context, 'DOCX');
  const pdf = await buildPgdDocumentOutput(context, 'PDF');
  assert.equal(docx.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.ok(docx.bytes.length > 200);
  assert.ok(pdf.bytes.length > 200);
  assert.equal(docx.contextHash, context.contextHash);
  assert.equal(pdf.contextHash, context.contextHash);
  assert.match(docx.fileName, /CT-GD-001.*\.docx$/);
  assert.match(pdf.fileName, /CT-GD-001.*\.pdf$/);
});

test('inactive PGD cells remain in the snapshot but are excluded from generated output and required validation', async () => {
  const base = getPgdDocumentTemplate('INSPECTION_CERTIFICATE', 'STEEL_METAL')!;
  const template = {
    ...base,
    cells: [
      ...base.cells,
      { key: 'internalNote', label: 'Ghi chú nội bộ không xuất', sectionCode: 'internal', row: 99, column: 1, type: 'TEXT' as const, required: true, active: false },
    ],
  };
  const context = buildPgdDocumentContext({ template, request, cellValues: { documentNumber: 'CT-GD-002', conclusion: 'Phù hợp' }, now: '2026-09-02T05:00:00.000Z' });
  const docx = await buildPgdDocumentOutput(context, 'DOCX');
  const documentXml = new PizZip(docx.bytes).file('word/document.xml')?.asText() || '';
  assert.equal(context.templateSnapshot.cells.find((cell) => cell.key === 'internalNote')?.active, false);
  assert.doesNotMatch(documentXml, /Ghi chú nội bộ không xuất/);
});
