import test from 'node:test';
import assert from 'node:assert/strict';

import type { CertificationDossier, CertificationProposal } from '../types';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { buildPgdSummaryRegisterRows, getPgdSummaryCellUpdate } from '../utils/pgdSummaryRegister';
import { getPcnSummaryCellUpdate } from '../utils/pcnOperationsRegister';
import { mergeColumnConfig } from '../utils/columnConfigPersistence';
import { readFileSync } from 'node:fs';

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
  assert.doesNotMatch(pgdWorkspace, /operationProjection[\s\S]*RequestCard/);
});
