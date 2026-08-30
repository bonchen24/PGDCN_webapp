import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnHistoricalReview, type PcnHistoricalReviewInput } from '../utils/pcnHistoricalReview.ts';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../components/PcnHistoricalReviewPanel.tsx', import.meta.url), 'utf8');
const discovery = fs.readFileSync(new URL('../components/PcnHistoricalDiscoveryView.tsx', import.meta.url), 'utf8');
const scopeBadge = fs.readFileSync(new URL('../components/PcnHistoricalScopeBadge.tsx', import.meta.url), 'utf8');

const proposal = {
  id: 'proposal-history-review',
  proposalCode: 'DN-QC9-2026-0105-01',
  channel: 'OTHER' as const,
  status: 'CONVERTED' as const,
  dossierId: 'dossier-history-review',
  customerSnapshot: { name: 'Tên tạm', address: '' },
  productName: 'Sản phẩm theo hồ sơ',
  quantity: 1,
  fieldCodes: ['QC9'],
  receivedAt: '2026-08-28T00:00:00.000Z',
  historicalImport: {
    batchId: 'pcn-history-pilot-v1',
    sourceFamily: 'QC9' as const,
    sourceFolderName: 'IEMM 0105-01 Tên tạm',
    sourceRelativePath: 'KQ chứng nhận QC9-26/IEMM 0105-01 Tên tạm',
    reviewStatus: 'PENDING_REVIEW' as const,
    unresolvedFields: ['productName', 'method'],
    importedAt: '2026-08-28T00:00:00.000Z',
  },
};

const dossier = {
  id: 'dossier-history-review',
  dossierCode: 'QC9-2026-0105-01',
  proposalId: proposal.id,
  customerSnapshot: { ...proposal.customerSnapshot },
  fieldCodes: ['QC9'],
  method: 'METHOD_1' as const,
  status: 'ON_HOLD' as const,
  labRequestIds: [],
  returnedResultIds: [],
  historicalImport: proposal.historicalImport,
};

const reviewedInput: PcnHistoricalReviewInput = {
  customerName: 'Công ty TNHH Đã rà soát',
  customerAddress: 'Hà Nội',
  customerTaxId: '0101234567',
  customerPhone: '0900000000',
  customerEmail: 'contact@example.com',
  customerContactPerson: 'Nguyễn Văn A',
  productName: 'Quạt điện treo tường',
  model: 'Q-2026',
  brand: 'PCN Brand',
  manufacturer: 'Nhà sản xuất A',
  manufacturerAddress: 'Hà Nội',
  method: 'METHOD_5',
};

test('historical review updates both linked records and preserves ON_HOLD', () => {
  const result = buildPcnHistoricalReview(proposal, dossier, reviewedInput, '2026-08-28T03:30:00.000Z');

  assert.equal(result.proposal.dossierId, dossier.id);
  assert.equal(result.dossier.proposalId, proposal.id);
  assert.equal(result.proposal.productName, 'Quạt điện treo tường');
  assert.equal(result.dossier.method, 'METHOD_5');
  assert.equal(result.dossier.status, 'ON_HOLD');
  assert.equal(result.proposal.updatedAt, '2026-08-28T03:30:00.000Z');
  assert.equal(result.dossier.updatedAt, '2026-08-28T03:30:00.000Z');
  assert.equal(result.proposal.historicalImport?.reviewStatus, 'REVIEWED');
  assert.equal(result.dossier.historicalImport?.reviewStatus, 'REVIEWED');
  assert.deepEqual(result.dossier.historicalImport?.unresolvedFields, []);
  assert.deepEqual(result.dossier.customerSnapshot, result.proposal.customerSnapshot);
});

test('historical review keeps unresolved placeholders visible for another review', () => {
  const result = buildPcnHistoricalReview(
    proposal,
    dossier,
    { ...reviewedInput, productName: 'Sản phẩm theo hồ sơ', method: 'METHOD_1' },
    '2026-08-28T03:31:00.000Z',
  );

  assert.equal(result.proposal.historicalImport?.reviewStatus, 'REVIEWED');
  assert.deepEqual(result.proposal.historicalImport?.unresolvedFields, ['productName']);
  assert.equal(result.proposal.productName, 'Sản phẩm theo hồ sơ');
});

test('historical review keeps the dossier customer snapshot as the canonical fallback', () => {
  const proposalWithStaleCustomer = {
    ...proposal,
    customerSnapshot: { name: 'Tên cũ từ Đề nghị', address: 'Địa chỉ cũ', phone: '0900000000' },
  };
  const dossierWithReviewedCustomer = {
    ...dossier,
    customerSnapshot: { name: 'Tên chuẩn hóa trong Hồ sơ', address: 'Địa chỉ chuẩn hóa', phone: '0911111111' },
  };

  const result = buildPcnHistoricalReview(
    proposalWithStaleCustomer,
    dossierWithReviewedCustomer,
    { ...reviewedInput, customerName: '', customerAddress: '', customerPhone: '' },
    '2026-08-28T03:32:00.000Z',
  );

  assert.deepEqual(result.dossier.customerSnapshot, {
    name: 'Tên chuẩn hóa trong Hồ sơ',
    address: 'Địa chỉ chuẩn hóa',
    taxId: '0101234567',
    phone: '0911111111',
    email: 'contact@example.com',
    contactPerson: 'Nguyễn Văn A',
  });
  assert.deepEqual(result.proposal.customerSnapshot, result.dossier.customerSnapshot);
});

test('historical review uses an atomic PCN endpoint and has an explicit review UI', () => {
  assert.match(server, /app\.post\('\/api\/pcn\/historical-review'/);
  assert.match(server, /withPgTransaction/);
  assert.match(server, /FOR UPDATE/);
  assert.match(server, /source: 'USER_REVIEW'/);
  assert.match(server, /UPDATE app_documents/);
  assert.match(store, /reviewHistoricalDossier:/);
  assert.match(store, /reviewPcnHistoricalDossier/);
  assert.match(detail, /Rà soát nhập lịch sử/);
  assert.match(detail, /onReviewHistorical/);
  assert.match(panel, /customerName/);
  assert.match(panel, /productName/);
  assert.match(panel, /METHOD_1/);
  assert.match(panel, /sourceRelativePath/);
  assert.match(panel, /getPcnHistoricalScopeNotice/);
  assert.match(discovery, /getPcnHistoricalScopeNotice/);
  assert.match(discovery, /scopeNotice\.message/);
  assert.match(scopeBadge, /scopeNotice\.message/);
});

// --- End of pcn-historical-review.test.ts ---
