import test from 'node:test';
import assert from 'node:assert/strict';

import type { CertificationDossier, CertificationProposal } from '../types';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { buildPgdSummaryRegisterRows, filterPgdSummaryRegisterRows, getPgdSummaryCellUpdate, getPgdSummaryReceivedAtYears } from '../utils/pgdSummaryRegister';
import { getPcnSummaryCellUpdate } from '../utils/pcnOperationsRegister';
import { mergeColumnConfig } from '../utils/columnConfigPersistence';
import { sortSummaryRows, toggleSummarySort } from '../utils/summaryRegister';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as cheerio from 'cheerio';
import PgdcnDossierSummaryGrid from '../components/PgdcnDossierSummaryGrid';
import PgdSummaryRegisterView from '../components/PgdSummaryRegisterView';
import PcnOperationsRegisterView from '../components/PcnOperationsRegisterView';

const pgdRequestFixture = {
  domain: 'pgd',
  id: 'pgd-request-1',
  requestCode: 'PGD-001',
  intakeChannel: 'DIRECT',
  requester: {
    name: 'Nguyễn Văn A',
    address: 'Hà Nội',
    contactPerson: 'Nguyễn Văn A',
    phone: '0900000000',
    email: 'a@example.com',
  },
  customerSnapshot: {
    name: 'Công ty A',
    address: 'Hà Nội',
    taxId: '0100000000',
    contactPerson: 'Nguyễn Văn A',
    phone: '0900000000',
    email: 'a@example.com',
  },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'STEEL-001',
  productName: 'Thép cuộn',
  productDetails: {
    grade: 'SS400',
    origin: 'Nhật Bản',
    manufacturer: 'Nhà máy A',
  },
  quantity: 12,
  unit: 'tấn',
  inspectionScope: 'Kiểm tra chất lượng',
  inspectionLocation: 'Kho Hà Nội',
  standards: ['TCVN 1234'],
  registryMetadata: {
    registrationNumber: 'DK-001',
    receivedAt: '2026-09-01',
    documents: [{ kind: 'CONTRACT', number: 'HD-001', date: '2026-08-30' }],
  },
  ownerUsername: 'owner-1',
  status: 'DRAFT',
  documentPointers: [],
  sampleIds: [],
  labRequestIds: [],
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
} as PgdInspectionRequest;

const pcnProposalFixture = {
  id: 'proposal-1',
  proposalCode: 'PCN-001',
  channel: 'DIRECT',
  status: 'DRAFT',
  customerSnapshot: { name: 'Công ty B', address: 'Đà Nẵng' },
  productName: 'Sản phẩm B',
  model: 'M-01',
  brand: 'Brand B',
  quantity: 3,
  fieldCodes: ['PCN_FIELD'],
  receivedAt: '2026-09-01',
} as CertificationProposal;

const pcnDossierFixture = {
  id: 'dossier-1',
  dossierCode: 'HS-001',
  proposalId: 'proposal-1',
  fieldCodes: ['PCN_FIELD'],
  method: 'METHOD_1',
  status: 'INTAKE_REVIEW',
  targetDate: '2026-09-15',
  ownerUsername: 'owner-1',
  evaluatorUsername: 'evaluator-1',
  labRequestIds: [],
  returnedResultIds: [],
} as CertificationDossier;

test('PGD summary rows flatten customer, product, and registry fields into cells', () => {
  const rows = buildPgdSummaryRegisterRows({
    requests: [pgdRequestFixture],
    assignments: [],
    samples: [],
    labRequests: [],
    labResults: [],
    reports: [],
    certificates: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, pgdRequestFixture.id);
  assert.equal(rows[0].cells.customerName, 'Công ty A');
  assert.equal(rows[0].cells.productGrade, 'SS400');
  assert.equal(rows[0].cells.contractNumber, 'HD-001');
  assert.match(rows[0].searchText, /PGD-001/);
});

test('PGD summary view declares a unique cell id for every configured column', () => {
  const source = readFileSync(new URL('../components/PgdSummaryRegisterView.tsx', import.meta.url), 'utf8');
  const columnsBlock = source.match(/const columns: SummaryGridColumn\[\] = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(columnsBlock, 'PGD summary column configuration is present');
  const ids = [...columnsBlock.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'column ids must not alias separate request and registry fields');
});

test('PGD milestone columns are present and remain read-only projections', () => {
  const source = readFileSync(new URL('../components/PgdSummaryRegisterView.tsx', import.meta.url), 'utf8');
  const columnsBlock = source.match(/const columns: SummaryGridColumn\[\] = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(columnsBlock, 'PGD summary column configuration is present');
  const configured = new Map([...columnsBlock.matchAll(/\{\s*id: '([^']+)'([^\n]*)/g)].map((match) => [match[1], match[2]]));
  const projectionIds = [
    'currentStepLabel', 'currentStationLabel', 'sampledAt', 'lastSampledAt', 'sampledBy', 'labSampleCount', 'retainedSampleCount',
    'laboratoryNames', 'labSenderUnits', 'labHandoverAt', 'latestLabReportNumber', 'latestLabReceivedAt',
    'latestLabAcceptedAt', 'latestReportNumber', 'latestReportStatus', 'latestReportDate', 'decisionNumber', 'decisionDate', 'certificateNumber',
    'certificateSignedAt', 'certificateReturnedAt', 'requiredDocumentCount', 'satisfiedRequiredDocumentCount',
    'missingRequiredCount', 'completionPercent', 'completionLabel',
  ];
  for (const id of projectionIds) {
    assert.ok(configured.has(id), `missing PGD milestone column ${id}`);
    assert.doesNotMatch(configured.get(id)!, /editable:\s*true/, `${id} must stay read-only`);
  }
});

test('PGD summary renders completion and explicit received-year filters and saves their values', () => {
  const markup = renderToStaticMarkup(createElement(PgdSummaryRegisterView, {
    requests: [pgdRequestFixture, { ...pgdRequestFixture, id: 'no-received-date', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: undefined }, createdAt: '2028-01-01T00:00:00Z' } as PgdInspectionRequest],
    assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [],
    catalog: [], users: [], canEdit: false,
    onOpenRequest: () => undefined,
    onUpdateRequest: async () => pgdRequestFixture,
    onAssignOwner: async () => pgdRequestFixture,
  }));
  assert.match(markup, /aria-label="Lọc mức hoàn thiện Sổ tổng hợp PGD"/);
  assert.match(markup, /Đủ hồ sơ/);
  assert.match(markup, /Còn thiếu/);
  const yearOptions = markup.match(/<select[^>]*aria-label="Lọc năm tiếp nhận Sổ tổng hợp PGD"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(yearOptions, 'received-year filter is rendered');
  assert.match(yearOptions, /Chưa có ngày tiếp nhận/);
  assert.match(yearOptions, />2026</);
  assert.doesNotMatch(yearOptions, />2028</, 'createdAt must not be presented as a received year');

  const source = readFileSync(new URL('../components/PgdSummaryRegisterView.tsx', import.meta.url), 'utf8');
  assert.match(source, /values:\s*\{[^}]*completion[^}]*receivedYear/);
  assert.match(source, /setCompletion\([^)]*values\.completion/);
  assert.match(source, /setReceivedYear\([^)]*values\.receivedYear/);
});

test('PGD summary keeps mobile layout bounded and its filters accessible and touch sized', () => {
  const markup = renderToStaticMarkup(createElement(PgdSummaryRegisterView, {
    requests: [pgdRequestFixture],
    assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [],
    catalog: [], users: [], canEdit: false,
    onOpenRequest: () => undefined,
    onUpdateRequest: async () => pgdRequestFixture,
    onAssignOwner: async () => pgdRequestFixture,
  }));

  assert.match(markup, /class="min-w-0 max-w-full"/);
  assert.match(markup, /class="[^"]*sm:hidden"[^>]*>Vuốt ngang để xem thêm cột/);
  const filterSelects = [...markup.matchAll(/<select aria-label="(Lọc [^"]+ Sổ tổng hợp PGD)"([^>]*)>/g)];
  assert.equal(filterSelects.length, 6, 'all six PGD filters have explicit accessible names');
  for (const [, label, attributes] of filterSelects) {
    assert.match(attributes, /class="pgdcn-toolbar-filter min-w-0 w-full min-h-11 /, `${label} has a mobile touch target`);
    assert.match(attributes, /focus-visible:ring-2 focus-visible:ring-emerald-500/, `${label} has a visible keyboard focus ring`);
  }
});

test('PGD request invoice remains read-only while registry invoice has its own editable cell', () => {
  const request = {
    ...pgdRequestFixture,
    invoiceNumber: 'REQUEST-INVOICE-01',
  } as PgdInspectionRequest;
  const [row] = buildPgdSummaryRegisterRows({
    requests: [request],
    assignments: [],
    samples: [],
    labRequests: [],
    labResults: [],
    reports: [],
    certificates: [],
  });

  assert.equal(row.cells.invoiceNumber, 'REQUEST-INVOICE-01');
  assert.equal(row.cells.invoiceDocumentNumber, '');
  assert.throws(() => getPgdSummaryCellUpdate(request, 'invoiceNumber', 'EDIT-MUST-BE-DENIED'), /không được phép chỉnh sửa/);
  assert.deepEqual(getPgdSummaryCellUpdate(request, 'invoiceDocumentNumber', 'REGISTRY-INVOICE-02'), {
    kind: 'request',
    patch: {
      registryMetadata: {
        ...pgdRequestFixture.registryMetadata,
        documents: [
          ...pgdRequestFixture.registryMetadata.documents,
          { kind: 'INVOICE', number: 'REGISTRY-INVOICE-02' },
        ],
      },
    },
  });
});
test('PGD operational milestones and checklist completion aggregate deterministically from canonical records', () => {
  const request = {
    ...pgdRequestFixture,
    status: 'WAITING_LAB_RESULTS',
    dossierChecklist: [
      { domain: 'pgd', requirementCode: 'R1', group: 'REQUEST', title: 'PYC', required: true, status: 'PRESENT', updatedAt: '2026-04-01T00:00:00Z' },
      { domain: 'pgd', requirementCode: 'R2', group: 'COMMERCIAL_CUSTOMS', title: 'Hóa đơn', required: true, status: 'WAIVED', updatedAt: '2026-04-01T00:00:00Z' },
      { domain: 'pgd', requirementCode: 'R3', group: 'FIELD', title: 'Biên bản', required: true, status: 'MISSING', updatedAt: '2026-04-01T00:00:00Z' },
      { domain: 'pgd', requirementCode: 'R4', group: 'ARCHIVE', title: 'Bản lưu', required: false, status: 'MISSING', updatedAt: '2026-04-01T00:00:00Z' },
    ],
  } as PgdInspectionRequest;
  const samples = [
    { id: 'sample-1', domain: 'pgd', requestId: request.id, sampleCode: 'S-1', description: 'Mẫu 1', quantity: 2, disposition: 'LAB', sampledAt: '2026-04-04T09:00:00.000Z', sampledByUsername: 'linh', laboratoryName: 'PTN cũ', handedOverAt: '2026-04-05T09:00:00.000Z' },
    { id: 'sample-2', domain: 'pgd', requestId: request.id, sampleCode: 'S-2', description: 'Mẫu 2', quantity: 1, disposition: 'LAB', sampledAt: '2026-04-07T10:00:00.000Z', sampledByUsername: 'minh', handedOverAt: '2026-04-08T10:00:00.000Z' },
    { id: 'sample-3', domain: 'pgd', requestId: request.id, sampleCode: 'S-3', description: 'Mẫu 3', quantity: 1, disposition: 'RETAINED', sampledAt: '2026-04-10T11:00:00.000Z', sampledByUsername: 'phuong' },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['samples'];
  const labRequests = [
    { id: 'lab-1', domain: 'pgd', requestId: request.id, sampleId: 'sample-1', status: 'SENT', laboratoryName: 'PTN A', senderUnit: 'PGD Hà Nội', testItems: [], handover: { sentAt: '2026-04-05T07:00:00.000Z', quantity: 2 } },
    { id: 'lab-2', domain: 'pgd', requestId: request.id, sampleId: 'sample-2', status: 'SENT', laboratoryName: 'PTN B', senderUnit: 'PGD Hải Phòng', testItems: [] },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['labRequests'];
  const labResults = [
    { id: 'result-old', domain: 'pgd', requestId: request.id, labRequestId: 'lab-1', reportNumber: 'PTN-OLD', receivedAt: '2026-04-10T09:00:00.000Z', values: [], acceptedAt: '2026-04-11T09:00:00.000Z' },
    { id: 'result-new', domain: 'pgd', requestId: request.id, labRequestId: 'lab-2', reportNumber: 'PTN-NEW', receivedAt: '2026-04-13T09:00:00.000Z', values: [], acceptedAt: '2026-04-15T09:00:00.000Z' },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['labResults'];
  const reports = [
    { id: 'report-old', domain: 'pgd', requestId: request.id, reportNumber: 'BC-OLD', title: 'Cũ', standardSnapshot: [], values: [], conclusion: '', status: 'DRAFT', createdAt: '2026-04-20T09:00:00.000Z', updatedAt: '2026-04-21T09:00:00.000Z' },
    { id: 'report-z', domain: 'pgd', requestId: request.id, reportNumber: 'BC-Z', title: 'Mới Z', standardSnapshot: [], values: [], conclusion: '', status: 'RETURNED', createdAt: '2026-04-22T09:00:00.000Z', updatedAt: '2026-04-24T12:00:00.000Z' },
    { id: 'report-a', domain: 'pgd', requestId: request.id, reportNumber: 'BC-A', title: 'Mới A', standardSnapshot: [], values: [], conclusion: '', status: 'APPROVED', createdAt: '2026-04-22T09:00:00.000Z', updatedAt: '2026-04-24T12:00:00.000Z' },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['reports'];
  const certificates = [
    { id: 'cert-old', domain: 'pgd', requestId: request.id, documentNumber: 'GCN-OLD', title: 'Cũ', conclusion: '', status: 'SIGNED', signedAt: '2026-04-26T09:00:00.000Z', returnedAt: '2026-04-28T09:00:00.000Z', createdAt: '2026-04-25T09:00:00.000Z', updatedAt: '2026-04-28T09:00:00.000Z' },
    { id: 'cert-new', domain: 'pgd', requestId: request.id, documentNumber: 'GCN-NEW', title: 'Mới', conclusion: '', status: 'SIGNED', signedAt: '2026-04-30T09:00:00.000Z', returnedAt: '2026-05-02T09:00:00.000Z', createdAt: '2026-04-29T09:00:00.000Z', updatedAt: '2026-05-02T09:00:00.000Z' },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['certificates'];
  const build = (reverse: boolean) => buildPgdSummaryRegisterRows({
    requests: [request], assignments: [],
    samples: reverse ? [...samples].reverse() : samples,
    labRequests: reverse ? [...labRequests].reverse() : labRequests,
    labResults: reverse ? [...labResults].reverse() : labResults,
    reports: reverse ? [...reports].reverse() : reports,
    certificates: reverse ? [...certificates].reverse() : certificates,
  })[0].cells;
  const cells = build(false);
  const reversedCells = build(true);

  assert.deepEqual({
    sampledAt: cells.sampledAt,
    lastSampledAt: cells.lastSampledAt,
    sampledBy: cells.sampledBy,
    labSampleCount: cells.labSampleCount,
    retainedSampleCount: cells.retainedSampleCount,
    laboratoryNames: cells.laboratoryNames,
    labSenderUnits: cells.labSenderUnits,
    labHandoverAt: cells.labHandoverAt,
    latestLabReportNumber: cells.latestLabReportNumber,
    latestLabReceivedAt: cells.latestLabReceivedAt,
    latestLabAcceptedAt: cells.latestLabAcceptedAt,
    latestReportNumber: cells.latestReportNumber,
    latestReportStatus: cells.latestReportStatus,
    latestReportDate: cells.latestReportDate,
    certificateNumber: cells.certificateNumber,
    certificateSignedAt: cells.certificateSignedAt,
    certificateReturnedAt: cells.certificateReturnedAt,
    currentStationLabel: cells.currentStationLabel,
    requiredDocumentCount: cells.requiredDocumentCount,
    satisfiedRequiredDocumentCount: cells.satisfiedRequiredDocumentCount,
    missingRequiredCount: cells.missingRequiredCount,
    completionPercent: cells.completionPercent,
    completionLabel: cells.completionLabel,
  }, {
    sampledAt: '2026-04-04T09:00:00.000Z',
    lastSampledAt: '2026-04-10T11:00:00.000Z',
    sampledBy: 'linh; minh; phuong',
    labSampleCount: 2,
    retainedSampleCount: 1,
    laboratoryNames: 'PTN A; PTN B',
    labSenderUnits: 'PGD Hà Nội; PGD Hải Phòng',
    labHandoverAt: '2026-04-05T07:00:00.000Z',
    latestLabReportNumber: 'PTN-NEW',
    latestLabReceivedAt: '2026-04-13T09:00:00.000Z',
    latestLabAcceptedAt: '2026-04-15T09:00:00.000Z',
    latestReportNumber: 'BC-A',
    latestReportStatus: 'APPROVED',
    latestReportDate: '2026-04-24T12:00:00.000Z',
    certificateNumber: 'GCN-NEW',
    certificateSignedAt: '2026-04-30T09:00:00.000Z',
    certificateReturnedAt: '2026-05-02T09:00:00.000Z',
    currentStationLabel: 'PTN & xem xét kết quả',
    requiredDocumentCount: 3,
    satisfiedRequiredDocumentCount: 2,
    missingRequiredCount: 1,
    completionPercent: 67,
    completionLabel: 'Còn thiếu',
  });
  assert.deepEqual(reversedCells, cells, 'milestone selections must not depend on entity array order');
});
test('PGD decision projection uses the latest issued canonical DECISION document only', () => {
  const makeDecision = (id: string, generatedAt: string, status = 'ISSUED', kind = 'DECISION', number = id, date = generatedAt.slice(0, 10)) => ({
    id, domain: 'pgd', requestId: pgdRequestFixture.id, requestCode: pgdRequestFixture.requestCode, kind,
    templateId: 'pgd-template-decision', templateCode: 'PGD-BM-09', templateVersion: '1', templateSnapshot: {},
    cellValues: { decisionNumber: number, decisionDate: date }, format: 'PDF', fileName: `${id}.pdf`, mimeType: 'application/pdf',
    byteSize: 1, sha256: 'checksum', contextHash: 'context', sourceCollection: 'pgdRequests', sourceDocumentId: pgdRequestFixture.id,
    generatedByUsername: 'operator', generatedAt, status,
  });
  const documents = [
    makeDecision('decision-old', '2026-04-01T09:00:00.000Z', 'ISSUED', 'DECISION', 'QD-OLD', '2026-04-01'),
    makeDecision('decision-new', '2026-04-05T09:00:00.000Z', 'ISSUED', 'DECISION', 'QD-NEW', '2026-04-05'),
    makeDecision('decision-draft', '2026-04-08T09:00:00.000Z', 'DRAFT', 'DECISION', 'QD-DRAFT', '2026-04-08'),
    makeDecision('report', '2026-04-09T09:00:00.000Z', 'ISSUED', 'INSPECTION_REPORT', 'NOT-A-DECISION', '2026-04-09'),
  ];
  const build = (reverse: boolean) => buildPgdSummaryRegisterRows({
    requests: [pgdRequestFixture], assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [],
    documents: (reverse ? [...documents].reverse() : documents) as never[],
  } as Parameters<typeof buildPgdSummaryRegisterRows>[0])[0].cells;

  const cells = build(false);
  assert.equal(cells.decisionNumber, 'QD-NEW');
  assert.equal(cells.decisionDate, '2026-04-05');
  assert.deepEqual(build(true), cells);
});
test('PGD lab handover uses sample.handedOverAt when no PTN handover timestamp exists', () => {
  const sample = { id: 'sample-fallback', domain: 'pgd', requestId: pgdRequestFixture.id, sampleCode: 'S-FALLBACK', description: 'Mẫu gửi thử', quantity: 1, disposition: 'LAB', handedOverAt: '2026-04-08T10:00:00.000Z' } as Parameters<typeof buildPgdSummaryRegisterRows>[0]['samples'][number];
  const [row] = buildPgdSummaryRegisterRows({
    requests: [pgdRequestFixture], assignments: [], samples: [sample], labRequests: [], labResults: [], reports: [], certificates: [],
  });
  assert.equal(row.cells.labHandoverAt, '2026-04-08T10:00:00.000Z');
});
test('PGD equal-time PTN handovers select the same timestamp when source arrays are reversed', () => {
  const sample = { id: 'sample-1', domain: 'pgd', requestId: pgdRequestFixture.id, sampleCode: 'S-1', description: 'Mẫu', quantity: 1, disposition: 'LAB', handedOverAt: '2026-04-12T09:00:00.000Z' } as Parameters<typeof buildPgdSummaryRegisterRows>[0]['samples'][number];
  const labRequests = [
    { id: 'lab-a', domain: 'pgd', requestId: pgdRequestFixture.id, sampleId: sample.id, status: 'SENT', laboratoryName: 'PTN A', testItems: [], handover: { sentAt: '2026-04-08T10:00:00.000Z', quantity: 1 } },
    { id: 'lab-b', domain: 'pgd', requestId: pgdRequestFixture.id, sampleId: sample.id, status: 'SENT', laboratoryName: 'PTN B', testItems: [], handover: { sentAt: '2026-04-08T11:00:00+01:00', quantity: 1 } },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['labRequests'];
  const build = (reverse: boolean) => buildPgdSummaryRegisterRows({
    requests: [pgdRequestFixture], assignments: [], samples: [sample], labRequests: reverse ? [...labRequests].reverse() : labRequests,
    labResults: [], reports: [], certificates: [],
  })[0].cells.labHandoverAt;
  assert.equal(build(false), '2026-04-08T10:00:00.000Z');
  assert.equal(build(true), build(false));
});

test('PGD PTN name aggregation is stable when Vietnamese collation considers names equal', () => {
  const labRequests = [
    { id: 'lab-e', domain: 'pgd', requestId: pgdRequestFixture.id, sampleId: 'sample-e', status: 'SENT', laboratoryName: 'PTN E', testItems: [] },
    { id: 'lab-accent', domain: 'pgd', requestId: pgdRequestFixture.id, sampleId: 'sample-accent', status: 'SENT', laboratoryName: 'PTN É', testItems: [] },
  ] as Parameters<typeof buildPgdSummaryRegisterRows>[0]['labRequests'];
  const build = (reverse: boolean) => buildPgdSummaryRegisterRows({
    requests: [pgdRequestFixture], assignments: [], samples: [], labRequests: reverse ? [...labRequests].reverse() : labRequests,
    labResults: [], reports: [], certificates: [],
  })[0].cells.laboratoryNames;
  assert.equal(build(false), 'PTN E; PTN É');
  assert.equal(build(true), build(false));
});
test('PGD completion and received-year filters use checklist gaps and explicit registry dates only', () => {
  const checklist = (status: 'MISSING' | 'PRESENT' | 'WAIVED', required = true) => [
    { domain: 'pgd', requirementCode: 'R1', group: 'REQUEST', title: 'PYC', required, status, updatedAt: '2026-01-01T00:00:00Z' },
  ];
  const requests = [
    { ...pgdRequestFixture, id: 'complete-2026', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: '2026-08-10' }, dossierChecklist: checklist('PRESENT') },
    { ...pgdRequestFixture, id: 'waived-2025', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: '2025-02-04' }, dossierChecklist: checklist('WAIVED') },
    { ...pgdRequestFixture, id: 'missing-no-date', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: undefined }, createdAt: '2026-03-02T00:00:00Z', dossierChecklist: checklist('MISSING') },
    { ...pgdRequestFixture, id: 'optional-gap-2026', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: '2026-01-01' }, dossierChecklist: checklist('PRESENT').concat(checklist('MISSING', false)) },
    { ...pgdRequestFixture, id: 'timestamp-received-2024', registryMetadata: { ...pgdRequestFixture.registryMetadata!, receivedAt: '2024-12-31T23:00:00-05:00' }, dossierChecklist: checklist('PRESENT') },
  ] as PgdInspectionRequest[];
  const rows = buildPgdSummaryRegisterRows({ requests, assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [] });

  assert.deepEqual(filterPgdSummaryRegisterRows(rows, { completion: 'COMPLETE', receivedYear: 'ALL' }).map((row) => row.id), ['complete-2026', 'waived-2025', 'optional-gap-2026', 'timestamp-received-2024']);
  assert.deepEqual(filterPgdSummaryRegisterRows(rows, { completion: 'INCOMPLETE', receivedYear: 'ALL' }).map((row) => row.id), ['missing-no-date']);
  assert.deepEqual(filterPgdSummaryRegisterRows(rows, { completion: 'ALL', receivedYear: '2026' }).map((row) => row.id), ['complete-2026', 'optional-gap-2026']);
  assert.deepEqual(filterPgdSummaryRegisterRows(rows, { completion: 'ALL', receivedYear: 'NO_DATE' }).map((row) => row.id), ['missing-no-date']);
  assert.deepEqual(filterPgdSummaryRegisterRows(rows, { completion: 'ALL', receivedYear: '2024' }).map((row) => row.id), ['timestamp-received-2024']);
  assert.deepEqual(getPgdSummaryReceivedAtYears(rows), ['2026', '2025', '2024']);
});
test('PGD summary cell updates preserve nested customer data and support owner assignment', () => {
  const customerUpdate = getPgdSummaryCellUpdate(pgdRequestFixture, 'customerName', 'Công ty A2');
  assert.deepEqual(customerUpdate, {
    kind: 'request',
    patch: { customerSnapshot: { ...pgdRequestFixture.customerSnapshot, name: 'Công ty A2' } },
  });

  assert.deepEqual(getPgdSummaryCellUpdate(pgdRequestFixture, 'ownerUsername', 'owner-2'), {
    kind: 'owner',
    ownerUsername: 'owner-2',
  });
});

test('PCN summary cell mapping routes proposal and dossier fields to their owning boundary', () => {
  assert.deepEqual(getPcnSummaryCellUpdate(pcnProposalFixture, pcnDossierFixture, 'model', 'M-02'), {
    target: 'proposal',
    updates: { model: 'M-02' },
  });

  assert.deepEqual(getPcnSummaryCellUpdate(pcnProposalFixture, pcnDossierFixture, 'targetDate', '2026-09-20'), {
    target: 'dossier',
    updates: { targetDate: '2026-09-20' },
  });
});

test('PCN summary register renders owner assignment separately while evaluator and reviewer remain editable', () => {
  const currentUser = {
    username: 'pcn-manager', name: 'Quản lý PCN', role: 'admin', systemRole: 'admin',
    managementRoleCode: 'DEPARTMENT_HEAD', departmentRoleCode: 'PCN_MANAGER',
    departmentScopes: ['PCN'], fieldCodes: ['PCN_FIELD'], active: true,
  } as any;
  const users = [
    currentUser,
    { username: 'owner-1', name: 'Nhân viên phụ trách', role: 'staff', systemRole: 'staff', departmentRoleCode: 'PCN_TECHNICAL', departmentScopes: ['PCN'], fieldCodes: ['PCN_FIELD'], active: true },
    { username: 'evaluator-1', name: 'Đánh giá viên', role: 'staff', systemRole: 'staff', departmentRoleCode: 'PCN_TECHNICAL', departmentScopes: ['PCN'], fieldCodes: ['PCN_FIELD'], active: true },
    { username: 'reviewer-1', name: 'Người soát xét', role: 'staff', systemRole: 'staff', departmentRoleCode: 'PCN_TECHNICAL', departmentScopes: ['PCN'], fieldCodes: ['PCN_FIELD'], active: true },
  ];
  const markup = renderToStaticMarkup(createElement(PcnOperationsRegisterView, {
    fields: [], proposals: [pcnProposalFixture],
    dossiers: [{ ...pcnDossierFixture, ownerUsername: '', reviewerUsername: 'reviewer-1' }],
    sampleLots: [], sampleRoutes: [], labRequests: [], returnedResults: [], issuancePackages: [],
    documentRequirements: [], dossierDocuments: [], users, currentUser,
    currentUsername: currentUser.username, canEdit: true,
    onOpenDossier: () => undefined, onUpdateProposal: async () => undefined, onUpdateDossier: async () => undefined,
  }));
  const $ = cheerio.load(markup);
  const grid = $('[data-testid="dossier-summary-grid"]');
  const headerCells = grid.find('thead th').toArray();
  const rowCells = grid.find('tbody tr').first().children('td');
  const cellFor = (label: string) => {
    const index = headerCells.findIndex((cell) => $(cell).text().includes(label));
    assert.ok(index >= 0, `the ${label} column should remain visible`);
    return rowCells.eq(index);
  };
  const ownerCell = cellFor('Chủ hồ sơ');
  assert.match(ownerCell.text(), /Chưa phân công/);
  assert.match(ownerCell.text(), /Giao hồ sơ/);
  assert.equal(ownerCell.attr('tabindex'), undefined, 'owner is not opened as the generic inline editor');
  assert.equal(cellFor('Đánh giá viên').attr('tabindex'), '0', 'evaluator remains independently editable');
  assert.equal(cellFor('Người soát xét').attr('tabindex'), '0', 'reviewer remains independently editable');
});

test('shared summary search input uses the caller-provided placeholder', () => {
  const markup = renderToStaticMarkup(createElement(PgdcnDossierSummaryGrid, {
    domain: 'PGD',
    columns: [{ id: 'requestCode', label: 'Mã', width: 100 }],
    rows: [{ id: 'row-1', cells: { requestCode: 'PGD-001' }, searchText: 'PGD-001' }],
    canEdit: false,
    onOpenRow: () => undefined,
    onCommitCell: async () => undefined,
    searchPlaceholder: 'Tìm số đăng ký riêng',
  }));
  assert.match(markup, /placeholder="Tìm số đăng ký riêng"/);
});
test('shared summary sorting handles numeric, date, and natural text values with stable ties and toggle states', () => {
  const numericRows = [
    { id: 'n-10', cells: { amount: 10 }, searchText: '' },
    { id: 'n-2', cells: { amount: 2 }, searchText: '' },
    { id: 'n-1', cells: { amount: 2 }, searchText: '' },
    { id: 'n-empty', cells: { amount: null }, searchText: '' },
  ];
  assert.deepEqual(sortSummaryRows(numericRows, { id: 'amount' }, 'asc').map((row) => row.id), ['n-1', 'n-2', 'n-10', 'n-empty']);
  assert.deepEqual(sortSummaryRows(numericRows, { id: 'amount' }, 'desc').map((row) => row.id), ['n-10', 'n-1', 'n-2', 'n-empty']);

  const dateRows = [
    { id: 'd-late', cells: { receivedAt: '2026-10-01' }, searchText: '' },
    { id: 'd-early-b', cells: { receivedAt: '2026-02-01' }, searchText: '' },
    { id: 'd-early-a', cells: { receivedAt: '2026-02-01' }, searchText: '' },
  ];
  assert.deepEqual(sortSummaryRows(dateRows, { id: 'receivedAt', inputType: 'date' }, 'asc').map((row) => row.id), ['d-early-a', 'd-early-b', 'd-late']);

  const collationTieRows = [
    { id: 'same-a', cells: { amount: 2 }, searchText: '' },
    { id: 'same-A', cells: { amount: 2 }, searchText: '' },
  ];
  assert.deepEqual(sortSummaryRows(collationTieRows, { id: 'amount' }, 'asc').map((row) => row.id), ['same-A', 'same-a']);
  assert.deepEqual(sortSummaryRows([...collationTieRows].reverse(), { id: 'amount' }, 'asc').map((row) => row.id), ['same-A', 'same-a']);
  const textRows = [
    { id: 't-10', cells: { name: 'Mẫu 10' }, searchText: '' },
    { id: 't-2', cells: { name: 'Mẫu 2' }, searchText: '' },
    { id: 't-1', cells: { name: 'Mẫu 1' }, searchText: '' },
  ];
  assert.deepEqual(sortSummaryRows(textRows, { id: 'name' }, 'asc').map((row) => row.id), ['t-1', 't-2', 't-10']);

  let sortState = toggleSummarySort(null, 'amount');
  assert.deepEqual(sortState, { columnId: 'amount', direction: 'asc' });
  sortState = toggleSummarySort(sortState, 'amount');
  assert.deepEqual(sortState, { columnId: 'amount', direction: 'desc' });
  assert.equal(toggleSummarySort(sortState, 'amount'), null);
  assert.deepEqual(toggleSummarySort(sortState, 'name'), { columnId: 'name', direction: 'asc' });
});
test('shared summary sort controls expose accessible state and sort before pagination', () => {
  const markup = renderToStaticMarkup(createElement(PgdcnDossierSummaryGrid, {
    domain: 'PGD',
    columns: [{ id: 'receivedAt', label: 'Ngày nhận', width: 120, inputType: 'date' }],
    rows: [
      { id: 'late', cells: { receivedAt: '2026-10-01' }, searchText: 'late' },
      { id: 'early', cells: { receivedAt: '2026-02-01' }, searchText: 'early' },
    ],
    canEdit: false,
    onOpenRow: () => undefined,
    onCommitCell: async () => undefined,
  }));
  assert.match(markup, /aria-sort="none"/);
  assert.match(markup, /aria-label="Sắp xếp theo Ngày nhận \(chưa sắp xếp\)"/);
  const source = readFileSync(new URL('../components/PgdcnDossierSummaryGrid.tsx', import.meta.url), 'utf8');
  assert.match(source, /const sortedRows = useMemo\([\s\S]*sortSummaryRows\(filteredRows/);
  assert.match(source, /return sortedRows\.slice\(start, start \+ pageSize\)/);
  assert.match(source, /if \(pageSize === 'ALL'\) return sortedRows/);
  assert.match(source, /onClick=\{\(\) => setSortState\(\(current\) => toggleSummarySort\(current, column\.id\)\)\}/);
});
test('shared summary grid exposes the spreadsheet interaction contract', () => {
  const source = readFileSync(new URL('../components/PgdcnDossierSummaryGrid.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-testid=["']dossier-summary-grid/);
  assert.match(source, /mergeColumnConfig/);
  assert.match(source, /summary_grid_cols_/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /onMouseDown/);
  assert.deepEqual(mergeColumnConfig(
    [{ id: 'requestCode', label: 'Mã', width: 120, visible: true }, { id: 'status', label: 'Trạng thái', width: 120, visible: true }],
    [{ id: 'status', label: 'Trạng thái', width: 220 }],
  ).map((column) => [column.id, column.width]), [['status', 220], ['requestCode', 120]]);
});

test('PCN and PGD workspaces route operations to separate summary-register views', () => {
  const pcnView = readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');
  const pgdView = readFileSync(new URL('../components/PgdSummaryRegisterView.tsx', import.meta.url), 'utf8');
  const pgdWorkspace = readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(pcnView, /Sổ tổng hợp/);
  assert.match(pcnView, /PgdcnDossierSummaryGrid/);
  assert.match(pgdView, /PgdcnDossierSummaryGrid/);
  assert.match(pgdWorkspace, /PgdSummaryRegisterView/);
  assert.match(pgdWorkspace, /PgdSummaryRegisterView[^>]*documents=/);
  assert.doesNotMatch(pgdWorkspace, /operationProjection[\s\S]*RequestCard/);
});
