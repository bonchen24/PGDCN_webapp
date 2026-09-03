import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';

import {
  buildPgdDocumentContext,
  buildPgdDocumentOutput,
  type PgdDocumentContext,
} from '../utils/pgdDocumentGeneration.ts';
import { getPgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import type { PgdInspectionRequest, PgdLabRequest, PgdSample } from '../utils/pgdDomain.ts';
import type { PgdCaseEvent, PgdInspectionPlan } from '../utils/pgdArtifacts.ts';

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

test('PGD source artifacts bind into matching document cells', () => {
  const timelineTemplate = getPgdDocumentTemplate('CASE_TIMELINE', 'STEEL_METAL')!;
  const event: PgdCaseEvent = {
    id: 'event-1', domain: 'pgd', requestId: request.id, occurredAt: '2026-09-02T02:30:00.000Z',
    activity: 'Kiểm tra nhãn và kích thước', actorUsername: 'giamdinhvien', createdAt: '2026-09-02T02:30:00.000Z', updatedAt: '2026-09-02T02:30:00.000Z',
  };
  const plan: PgdInspectionPlan = {
    id: 'plan-1', domain: 'pgd', requestId: request.id, inspectionDate: '2026-09-02',
    team: [{ username: 'giamdinhvien', role: 'LEAD' }], productLines: [{ productName: 'Thép cuộn', standard: 'JIS G 3141' }],
    schedule: [{ startTime: '08:30', endTime: '09:00', activity: 'Họp khai mạc' }], createdAt: '2026-09-02T01:00:00.000Z', updatedAt: '2026-09-02T01:00:00.000Z', status: 'CONFIRMED',
  };
  const context = buildPgdDocumentContext({ template: timelineTemplate, request, caseEvents: [event], inspectionPlan: plan, cellValues: {}, now: '2026-09-02T05:00:00.000Z' });
  assert.equal(context.sourceSnapshots.inspectionPlanId, 'plan-1');
  assert.deepEqual(context.sourceSnapshots.caseEventIds, ['event-1']);
  assert.equal(context.cellValues.eventDate, '2026-09-02');
  assert.deepEqual(context.cellValues.eventRows, [{ time: '09:30', activity: 'Kiểm tra nhãn và kích thước', actor: 'giamdinhvien', note: null }]);
});

test('source-derived inspection minutes and sample handover templates bind current PGD facts', () => {
  const minutesTemplate = getPgdDocumentTemplate('INSPECTION_MINUTES', 'STEEL_METAL')!;
  const handoverTemplate = getPgdDocumentTemplate('SAMPLE_HANDOVER', 'STEEL_METAL')!;
  assert.equal(minutesTemplate.domain, 'pgd');
  assert.equal(handoverTemplate.domain, 'pgd');
  assert.ok(minutesTemplate.cells.some((cell) => cell.key === 'inspectionResult'));
  assert.ok(handoverTemplate.cells.some((cell) => cell.key === 'laboratoryCode'));

  const samples: PgdSample[] = [
    { id: 'sample-1', domain: 'pgd', requestId: request.id, sampleCode: 'PYC-GD-2026-001-M01', description: 'Thép cuộn M01', quantity: 1, disposition: 'LAB' },
    { id: 'sample-2', domain: 'pgd', requestId: request.id, sampleCode: 'PYC-GD-2026-001-M02', description: 'Thép cuộn M02', quantity: 1, disposition: 'LAB' },
  ];
  const labRequests: PgdLabRequest[] = [
    { id: 'lab-1', domain: 'pgd', requestId: request.id, sampleId: 'sample-1', status: 'SENT', laboratoryName: 'PTN Vật liệu – NDT', laboratoryCode: 'VILAS182', senderUnit: 'Phòng Giám định - Chứng nhận', testItems: ['Kích thước', 'Hóa học'], testMethods: ['QCVN 7:2019/BKHCN'], handover: { sentAt: '2026-09-03T08:00:00.000Z', senderUsername: 'nam', receiverName: 'PTN Vật liệu – NDT', quantity: 1 } },
    { id: 'lab-2', domain: 'pgd', requestId: request.id, sampleId: 'sample-2', status: 'SENT', laboratoryName: 'PTN Vật liệu – NDT', laboratoryCode: 'VILAS182', senderUnit: 'Phòng Giám định - Chứng nhận', testItems: ['Cơ tính'], testMethods: ['GB/T 24238-2017'], handover: { sentAt: '2026-09-03T08:00:00.000Z', senderUsername: 'nam', receiverName: 'PTN Vật liệu – NDT', quantity: 1 } },
  ];
  const context = buildPgdDocumentContext({ template: handoverTemplate, request, samples, labRequests, cellValues: {}, now: '2026-09-03T09:00:00.000Z' });
  assert.equal(context.cellValues.laboratoryCode, 'VILAS182');
  assert.deepEqual(context.cellValues.handoverRows, [
    { sampleCode: 'PYC-GD-2026-001-M01', description: 'Thép cuộn M01', quantity: 1, unit: null, testItems: 'Kích thước; Hóa học', methods: 'QCVN 7:2019/BKHCN' },
    { sampleCode: 'PYC-GD-2026-001-M02', description: 'Thép cuộn M02', quantity: 1, unit: null, testItems: 'Cơ tính', methods: 'GB/T 24238-2017' },
  ]);
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
