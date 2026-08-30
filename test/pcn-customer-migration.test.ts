import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildPcnCustomerMigrationPreview,
  buildPcnCustomerReconciliation,
  hashPcnCustomers,
  hasPcnCustomerBusinessChanges,
  mergePcnImportedCustomer,
  parsePcnCustomerCsv,
} from '../utils/pcnCustomerMigration.ts';
import { inspectPcnCustomerImport } from '../utils/pcnCustomerReconciliation.ts';

const migrationScript = fs.readFileSync(new URL('../scripts/migratePcnCustomers.ts', import.meta.url), 'utf8');
const migrationUtility = fs.readFileSync(new URL('../utils/pcnCustomerMigration.ts', import.meta.url), 'utf8');
const migrationService = fs.readFileSync(new URL('../utils/pcnCustomerImportService.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};

test('customer migration preview normalizes Vietnamese exports and reports duplicates', () => {
  const preview = buildPcnCustomerMigrationPreview([
    { 'Mã khách hàng': 'KH-001', 'Tên khách hàng': 'Công ty A', 'MST': '1234567890', 'Số điện thoại': '0912 345 678' },
    { 'Mã khách hàng': 'KH-001', 'Tên khách hàng': 'Công ty A cập nhật' },
    { 'Mã khách hàng': 'KH-002', 'Tên khách hàng': 'Công ty B' },
  ], [
    { customerCode: 'KH-002', name: 'Công ty B cũ', address: 'Hà Nội' },
  ], { sourceLabel: 'ddt-export.csv', generatedAt: '2026-08-27T01:00:00.000Z' });

  assert.equal(preview.sourceCount, 3);
  assert.equal(preview.validCount, 3);
  assert.equal(preview.acceptedCount, 2);
  assert.deepEqual(preview.duplicateKeys, ['kh-001']);
  assert.equal(preview.existingConflictCount, 1);
  assert.match(preview.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(preview.acceptedCustomers[0].phone, '0912345678');
  assert.equal(preview.acceptedCustomers[0].taxId, '1234567890');
  assert.equal(preview.targetHashBefore.length, 64);
  assert.equal(preview.targetHashAfter.length, 64);
});

test('customer migration preview rejects rows without a stable key', () => {
  const preview = buildPcnCustomerMigrationPreview([
    { address: 'Hà Nội' },
  ], [], { generatedAt: '2026-08-27T01:00:00.000Z' });

  assert.equal(preview.acceptedCount, 0);
  assert.equal(preview.rejected[0].sourceIndex, 1);
  assert.match(preview.rejected[0].reason, /mã khách hàng|tên khách hàng/i);
});

test('customer CSV parser supports quoted commas and semicolon exports', () => {
  assert.deepEqual(parsePcnCustomerCsv('Mã khách hàng,Tên khách hàng,Địa chỉ\nKH-1,"Công ty, A",Hà Nội'), [
    { 'Mã khách hàng': 'KH-1', 'Tên khách hàng': 'Công ty, A', 'Địa chỉ': 'Hà Nội' },
  ]);
  assert.deepEqual(parsePcnCustomerCsv('Mã khách hàng;Tên khách hàng\nKH-2;Công ty B'), [
    { 'Mã khách hàng': 'KH-2', 'Tên khách hàng': 'Công ty B' },
  ]);
});

test('customer import merge does not erase existing contact data with blank source cells', () => {
  const merged = mergePcnImportedCustomer({
    customerCode: 'KH-3', name: 'Công ty C', address: 'Đà Nẵng', phone: '0901222333', email: 'c@example.test', contactPerson: 'Chị C',
  }, {
    customerCode: 'KH-3', name: 'Công ty C mới', address: '', phone: '', email: '', contactPerson: '',
  }, '2026-08-27T01:00:00.000Z');

  assert.equal(merged.name, 'Công ty C mới');
  assert.equal(merged.address, 'Đà Nẵng');
  assert.equal(merged.phone, '0901222333');
  assert.equal(merged.email, 'c@example.test');
  assert.equal(merged.contactPerson, 'Chị C');
});

test('customer migration preview target hash follows the non-destructive import merge', () => {
  const existing = {
    customerCode: 'KH-3',
    name: 'Công ty C',
    address: 'Đà Nẵng',
    phone: '0901222333',
    email: 'c@example.test',
    contactPerson: 'Chị C',
  };
  const preview = buildPcnCustomerMigrationPreview([
    { 'Mã khách hàng': 'KH-3', 'Tên khách hàng': 'Công ty C mới' },
  ], [existing], { generatedAt: '2026-08-27T01:00:00.000Z' });
  const merged = mergePcnImportedCustomer(existing, preview.acceptedCustomers[0], preview.generatedAt);

  assert.equal(preview.targetHashAfter, hashPcnCustomers([merged]));
  assert.equal(merged.phone, existing.phone);
  assert.equal(merged.email, existing.email);
});

test('customer import retry ignores timestamps when business fields are unchanged', () => {
  const existing = {
    customerCode: 'KH-4',
    name: 'Công ty D',
    address: 'Hà Nội',
    taxId: '0123456789',
    phone: '0901000000',
    email: 'd@example.test',
    contactPerson: 'Anh D',
    createdAt: '2026-08-27T01:00:00.000Z',
    updatedAt: '2026-08-27T01:00:00.000Z',
  };
  const retried = { ...existing, updatedAt: '2026-08-28T01:00:00.000Z' };
  assert.equal(hasPcnCustomerBusinessChanges(existing, retried), false);
  assert.equal(hasPcnCustomerBusinessChanges(existing, { ...retried, phone: '0901999999' }), true);
});

test('customer reconciliation reports key and field differences without exposing field values', () => {
  const report = buildPcnCustomerReconciliation([
    { customerCode: 'KH-001', name: 'Công ty A', address: 'Hà Nội', phone: '0901000001' },
    { customerCode: 'KH-002', name: 'Công ty B', address: 'Đà Nẵng' },
  ], [
    { customerCode: 'kh-001', name: 'Công ty A', address: 'Hồ Chí Minh', phone: '0901000001' },
    { customerCode: 'KH-003', name: 'Công ty C', address: 'Cần Thơ' },
  ]);

  assert.equal(report.sourceCount, 2);
  assert.equal(report.targetCount, 2);
  assert.deepEqual(report.missingKeys, ['kh-002']);
  assert.deepEqual(report.extraKeys, ['kh-003']);
  assert.deepEqual(report.changedKeys, ['kh-001']);
  assert.deepEqual(report.changedFieldsByKey, [{ key: 'kh-001', fields: ['address'] }]);
  assert.equal(report.fieldDifferenceCounts.address, 1);
  assert.equal(report.fieldDifferenceCounts.name, 0);
  assert.equal(JSON.stringify(report).includes('Hà Nội'), false);
  assert.equal(JSON.stringify(report).includes('Hồ Chí Minh'), false);
});

test('customer reconciliation separates a unique short-name alias from an unresolved key', () => {
  const report = buildPcnCustomerReconciliation(
    [{ name: 'TTP', address: '', customerCode: '' }],
    [{ name: 'CÔNG TY CỔ PHẦN CHỨNG NHẬN VÀ GIÁM ĐỊNH TTP', address: '', customerCode: '' }],
  );

  assert.deepEqual(report.missingKeys, ['ttp']);
  assert.deepEqual(report.possibleAliasMatches, [{
    sourceKey: 'ttp',
    targetKey: 'công ty cổ phần chứng nhận và giám định ttp',
    reason: 'SHORT_NAME_FOUND_IN_TARGET_NAME',
  }]);
});

test('browser customer inspection keeps normalization and duplicate reporting free of server-only hashing', () => {
  const inspection = inspectPcnCustomerImport([
    { 'Mã khách hàng': 'KH-010', 'Tên khách hàng': 'Công ty X', 'Số điện thoại': '0901 000 010' },
    { 'Mã khách hàng': 'KH-010', 'Tên khách hàng': 'Công ty X trùng' },
    { 'Địa chỉ': 'Hà Nội' },
  ], '2026-08-28T01:00:00.000Z');

  assert.equal(inspection.sourceCount, 3);
  assert.equal(inspection.validCount, 2);
  assert.equal(inspection.acceptedCount, 1);
  assert.deepEqual(inspection.duplicateKeys, ['kh-010']);
  assert.equal(inspection.rejected.length, 1);
  assert.equal(inspection.acceptedCustomers[0].phone, '0901000010');
});

test('customer migration reuses the canonical parser and reconciliation utility', () => {
  assert.match(migrationUtility, /from ['"]\.\/pcnCustomerReconciliation\.ts['"]/);
  assert.match(migrationUtility, /export \{[^}]*buildPcnCustomerReconciliation/s);
  assert.match(migrationUtility, /export \{[^}]*parsePcnCustomerCsv/s);
  assert.doesNotMatch(migrationUtility, /export function parsePcnCustomerCsv/);
  assert.doesNotMatch(migrationUtility, /export function buildPcnCustomerReconciliation/);
});

test('customer migration CLI is PCN-only, dry-run first, and preserves audit append-only writes', () => {
  assert.match(migrationScript, /APP_PROFILE.*pcn/);
  assert.match(packageJson.scripts?.['migrate:pcn-customers'] || '', /run-pcn-tsx\.cjs/);
  assert.match(migrationScript, /--apply/);
  assert.match(migrationScript, /--confirm=KHOI_TAO_DANH_MUC_PCN/);
  assert.match(migrationScript, /--keep-alias=/);
  assert.match(migrationScript, /--map-alias=/);
  assert.match(migrationScript, /aliasDecisions/);
  assert.match(migrationScript, /requirePcnImportBackup/);
  assert.match(migrationService, /verifyBackupArchive/);
  assert.match(migrationService, /ON CONFLICT \(collection_name, document_id\)\s+DO UPDATE/);
  assert.match(migrationService, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
  assert.match(migrationService, /hasPcnCustomerBusinessChanges/);
  assert.doesNotMatch(migrationScript, /requests|handoverDocs|kqtnRecords/);
  assert.equal((migrationScript.match(/await pool\.end\(\)/g) || []).length, 1);
});

test('customer migration CLI delegates apply mechanics to the shared PCN import service', () => {
  assert.match(migrationScript, /applyPcnCustomerImport/);
  assert.match(migrationScript, /loadPcnCustomersForImport/);
  assert.match(migrationService, /ON CONFLICT \(collection_name, document_id\)\s+DO UPDATE/);
  assert.match(migrationService, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
  assert.match(migrationService, /const importGroupId = .*backupCheckpoint\.filename/);
  assert.doesNotMatch(migrationScript, /async function applyCustomerImport/);
});

// --- End of pcn-customer-migration.test.ts ---
