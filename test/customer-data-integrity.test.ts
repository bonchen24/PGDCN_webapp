import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal } from '../types.ts';
import { normalizeCustomerRecord } from '../utils/customerRecord.ts';
import { ensurePcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy.ts';
import { mergePcnCustomers } from '../utils/pcnStorePolicy.ts';

test('normalizes a new customer without dropping contact and audit fields', () => {
  const customer = normalizeCustomerRecord({
    name: 'Công ty A',
    address: 'Hà Nội',
    customerCode: 'KH-001',
    taxId: '1234567890',
    phone: '0912 345 678',
    email: 'contact@example.test',
    contactPerson: 'Nguyễn Văn A',
    normalizedSearchStr: 'cong ty a ha noi',
  }, undefined, '2026-08-27T01:00:00.000Z');

  assert.deepEqual(customer, {
    name: 'Công ty A',
    address: 'Hà Nội',
    customerCode: 'KH-001',
    taxId: '1234567890',
    phone: '0912345678',
    email: 'contact@example.test',
    contactPerson: 'Nguyễn Văn A',
    normalizedSearchStr: 'cong ty a ha noi',
    createdAt: '2026-08-27T01:00:00.000Z',
    updatedAt: '2026-08-27T01:00:00.000Z',
  });
});

test('merging a partial customer edit preserves untouched fields', () => {
  const previous = normalizeCustomerRecord({
    name: 'Công ty B',
    address: 'Đà Nẵng',
    customerCode: 'KH-002',
    taxId: '0987654321',
    phone: '0901 222 333',
    email: 'old@example.test',
    contactPerson: 'Trần B',
    createdAt: '2026-08-01T01:00:00.000Z',
  }, undefined, '2026-08-01T01:00:00.000Z');
  const updated = normalizeCustomerRecord({ phone: '0909 888 777' }, previous, '2026-08-27T01:00:00.000Z');

  assert.equal(updated.phone, '0909888777');
  assert.equal(updated.email, 'old@example.test');
  assert.equal(updated.contactPerson, 'Trần B');
  assert.equal(updated.customerCode, 'KH-002');
  assert.equal(updated.createdAt, '2026-08-01T01:00:00.000Z');
  assert.equal(updated.updatedAt, '2026-08-27T01:00:00.000Z');
});

test('customer catalog survives reload and dossier history keeps its customer snapshot', () => {
  const customer = normalizeCustomerRecord({
    name: 'Công ty C', address: 'Hải Phòng', customerCode: 'KH-003', phone: '0903 444 555',
  }, undefined, '2026-08-27T01:00:00.000Z');
  const reloadedCustomers = mergePcnCustomers([], [customer]);
  assert.equal(reloadedCustomers.length, 1);
  assert.equal(reloadedCustomers[0].customerCode, 'KH-003');

  const proposal: CertificationProposal = {
    id: 'proposal-003', proposalCode: 'DN-2026-003', channel: 'DIRECT', status: 'RECEIVED',
    customerId: 'KH-003', customerSnapshot: { name: customer.name, address: customer.address, taxId: '', phone: customer.phone, email: '', contactPerson: '' },
    productName: 'Thiết bị C', quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-08-27T01:00:00.000Z',
  };
  const dossier: CertificationDossier = {
    id: 'dossier-003', dossierCode: 'HS-2026-003', proposalId: proposal.id, fieldCodes: ['QC4'], method: 'METHOD_1', status: 'DRAFT', labRequestIds: [], returnedResultIds: [],
  };
  const persisted = ensurePcnDossierCustomerSnapshot(dossier, proposal);
  proposal.customerSnapshot.name = 'Tên khách hàng mới';

  assert.equal(persisted.customerSnapshot?.name, 'Công ty C');
  assert.equal(reloadedCustomers[0].name, 'Công ty C');
});

// --- End of customer-data-integrity.test.ts ---
