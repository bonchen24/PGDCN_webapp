import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapPcnCustomerAliasCustomer,
  PCN_ALIAS_KEEP_SOURCE_KEY,
  PCN_ALIAS_MAP_TO_TARGET,
  validatePcnCustomerAliasDecisions,
} from '../utils/pcnCustomerImportAlias.ts';
import { buildPcnCustomerMigrationPreview } from '../utils/pcnCustomerMigration.ts';
import { preparePcnCustomerImportAliasDecisions } from '../utils/pcnCustomerImportService.ts';

const candidates = [{ sourceKey: 'ttp', targetKey: 'công ty cổ phần chứng nhận và giám định ttp' }];

test('customer alias decisions require one explicit decision per candidate', () => {
  assert.deepEqual(validatePcnCustomerAliasDecisions(candidates, [{
    sourceKey: 'ttp',
    mode: PCN_ALIAS_KEEP_SOURCE_KEY,
  }]), [{
    sourceKey: 'ttp',
    mode: PCN_ALIAS_KEEP_SOURCE_KEY,
  }]);

  assert.throws(
    () => validatePcnCustomerAliasDecisions(candidates, []),
    /phải quyết định|decision/i,
  );
  assert.throws(
    () => validatePcnCustomerAliasDecisions(candidates, [{ sourceKey: 'other', mode: PCN_ALIAS_KEEP_SOURCE_KEY }]),
    /không khớp|candidate/i,
  );
});

test('customer alias mapping must point to the unique candidate target', () => {
  assert.deepEqual(validatePcnCustomerAliasDecisions(candidates, [{
    sourceKey: 'TTP',
    mode: PCN_ALIAS_MAP_TO_TARGET,
    targetKey: 'CÔNG TY CỔ PHẦN CHỨNG NHẬN VÀ GIÁM ĐỊNH TTP',
  }]), [{
    sourceKey: 'ttp',
    mode: PCN_ALIAS_MAP_TO_TARGET,
    targetKey: 'công ty cổ phần chứng nhận và giám định ttp',
  }]);
  assert.throws(
    () => validatePcnCustomerAliasDecisions(candidates, [{
      sourceKey: 'ttp',
      mode: PCN_ALIAS_MAP_TO_TARGET,
      targetKey: 'another-customer',
    }]),
    /không khớp|target/i,
  );
});

test('mapped alias keeps the canonical target identity while carrying source fields', () => {
  const mapped = mapPcnCustomerAliasCustomer(
    { name: 'TTP', address: '', phone: '0901000000' },
    { name: 'Công ty cổ phần chứng nhận và giám định TTP', address: '', customerCode: '' },
    { sourceKey: 'ttp', mode: PCN_ALIAS_MAP_TO_TARGET, targetKey: 'công ty cổ phần chứng nhận và giám định ttp' },
  );

  assert.equal(mapped.name, 'Công ty cổ phần chứng nhận và giám định TTP');
  assert.equal(mapped.customerCode, '');
  assert.equal(mapped.phone, '0901000000');
});

test('server import preparation applies the explicit alias decision before writing', () => {
  const existing = [{ name: 'Công ty cổ phần chứng nhận và giám định TTP', customerCode: '', address: 'Hà Nội' }];
  const preview = buildPcnCustomerMigrationPreview([{ name: 'TTP', phone: '0901000000' }], existing, {
    sourceLabel: 'customers.csv',
    generatedAt: '2026-08-30T01:00:00.000Z',
  });
  const prepared = preparePcnCustomerImportAliasDecisions(preview, existing, [{
    sourceKey: 'ttp',
    mode: PCN_ALIAS_MAP_TO_TARGET,
    targetKey: 'công ty cổ phần chứng nhận và giám định ttp',
  }]);

  assert.equal(prepared.decisions[0].mode, PCN_ALIAS_MAP_TO_TARGET);
  assert.equal(prepared.preview.acceptedCustomers[0].name, existing[0].name);
  assert.equal(prepared.preview.acceptedCustomers[0].phone, '0901000000');
});

test('customer import alias validation marks incomplete decisions as a conflict', () => {
  const existing = [{ name: 'Công ty Cổ phần Chứng nhận và Giám định TTP', address: 'A' }];
  const preview = buildPcnCustomerMigrationPreview([{ name: 'TTP', address: 'B' }], existing, { sourceLabel: 'customers.csv' });
  assert.throws(
    () => preparePcnCustomerImportAliasDecisions(preview, existing, []),
    (error: any) => error?.statusCode === 409,
  );
});

// --- End of pcn-customer-import-alias.test.ts ---
