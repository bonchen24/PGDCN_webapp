import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPcnDocumentId,
  mergePcnCustomers,
} from '../utils/pcnStorePolicy.ts';

test('uses the customer code as the stable PCN document id', () => {
  assert.equal(getPcnDocumentId({ customerCode: ' KH-001 ', name: 'Công ty A' }), 'KH-001');
  assert.equal(getPcnDocumentId({ name: 'Công ty A' }), 'Công ty A');
});

test('merges PCN customer imports by code without losing the complete record', () => {
  const merged = mergePcnCustomers(
    [{ name: 'Công ty A', address: 'Hà Nội', customerCode: 'KH-001', phone: '0901' }],
    [{ name: 'Công ty A mới', address: 'Hà Nội', customerCode: 'KH-001', phone: '0902', email: 'a@example.test' }],
  );

  assert.deepEqual(merged, [{
    name: 'Công ty A mới',
    address: 'Hà Nội',
    customerCode: 'KH-001',
    phone: '0902',
    email: 'a@example.test',
  }]);
});

// --- End of pcn-store-policy.test.ts ---
