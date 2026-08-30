import assert from 'node:assert/strict';
import test from 'node:test';

import { getPcnImportBackupGateErrors, isPcnImportBackupCandidate } from '../utils/pcnImportBackupGate.ts';
import { getLatestPcnCustomerImportCheckpoint, getPcnCustomerImportAuditChanges } from '../utils/pcnCustomerImportAudit.ts';

const validBackup = {
  filename: 'pcn_certification_auto_20260829-032312.zip',
  createdAt: '2026-08-29T03:23:12.000Z',
  sizeBytes: 381966092,
};

const validVerification = {
  filename: validBackup.filename,
  format: 'zip' as const,
  sizeBytes: validBackup.sizeBytes,
  databaseDumpPresent: true,
  manifestPresent: true,
  manifestObjectCount: 634,
  objectEntryCount: 634,
  verifiedObjectCount: 634,
  missingObjectCount: 0,
  invalidObjectCount: 0,
  pgToolAvailable: true,
  dumpReadable: true,
  status: 'VALID' as const,
  ok: true,
  errors: [],
};

test('PCN import backup gate accepts only a full archive created before the checkpoint', () => {
  assert.equal(isPcnImportBackupCandidate(validBackup, '2026-08-29T03:30:00.000Z'), true);
  assert.equal(isPcnImportBackupCandidate(validBackup, '2026-08-29T03:20:00.000Z'), false);
  assert.equal(isPcnImportBackupCandidate({ ...validBackup, filename: 'ddt_lab_auto_20260829-032312.zip' }, '2026-08-29T03:30:00.000Z'), false);
  assert.equal(isPcnImportBackupCandidate({ ...validBackup, filename: 'pcn_certification_auto_20260829-032312.dump' }, '2026-08-29T03:30:00.000Z'), false);
});

test('PCN import backup gate reports verification failures without exposing backup bytes', () => {
  assert.deepEqual(getPcnImportBackupGateErrors(validBackup, validVerification, '2026-08-29T03:30:00.000Z'), []);

  const errors = getPcnImportBackupGateErrors(validBackup, {
    ...validVerification,
    ok: false,
    status: 'INVALID' as const,
    errors: ['Archive thiếu storage/manifest.json.'],
  }, '2026-08-29T03:30:00.000Z');

  assert.match(errors.join(' '), /storage\/manifest\.json/);
  assert.equal(errors.some((error) => /381966092|byteSize|contact|phone|email/i.test(error)), false);
});

test('customer import audit records the backup checkpoint without file bytes or contact data', () => {
  const changes = getPcnCustomerImportAuditChanges({
    filename: validBackup.filename,
    createdAt: validBackup.createdAt,
    status: 'VALID',
  });

  assert.deepEqual(changes, [
    { field: 'backupCheckpoint.filename', before: null, after: validBackup.filename },
    { field: 'backupCheckpoint.createdAt', before: null, after: validBackup.createdAt },
    { field: 'backupCheckpoint.status', before: null, after: 'VALID' },
  ]);
  assert.equal(JSON.stringify(changes).includes(String(validBackup.sizeBytes)), false);
  assert.equal(JSON.stringify(changes).match(/phone|email|contact/i), null);
});

test('cutover snapshot extracts the newest complete customer-import checkpoint only', () => {
  const checkpoint = getLatestPcnCustomerImportCheckpoint([
    {
      id: 'old-import',
      createdAt: '2026-08-29T03:00:00.000Z',
      actorName: 'PCN customer import job',
      action: 'IMPORTED',
      entityType: 'PCN_CUSTOMER',
      summary: 'Nhập danh mục',
      source: 'IMPORT',
      idempotencyFingerprint: 'a'.repeat(64),
      changes: getPcnCustomerImportAuditChanges({ filename: validBackup.filename, createdAt: validBackup.createdAt, status: 'VALID' }),
    },
    {
      id: 'incomplete-import',
      createdAt: '2026-08-29T04:00:00.000Z',
      actorName: 'PCN customer import job',
      action: 'IMPORTED',
      entityType: 'PCN_CUSTOMER',
      summary: 'Nhập danh mục',
      source: 'IMPORT',
      idempotencyFingerprint: 'b'.repeat(64),
      changes: [{ field: 'backupCheckpoint.filename', before: null, after: validBackup.filename }],
    },
    {
      id: 'new-import',
      createdAt: '2026-08-29T05:00:00.000Z',
      actorName: 'PCN customer import job',
      action: 'IMPORTED',
      entityType: 'PCN_CUSTOMER',
      summary: 'Nhập danh mục',
      source: 'IMPORT',
      idempotencyFingerprint: 'c'.repeat(64),
      changes: getPcnCustomerImportAuditChanges({ filename: validBackup.filename, createdAt: validBackup.createdAt, status: 'VALID' }),
    },
  ]);

  assert.deepEqual(checkpoint, {
    filename: validBackup.filename,
    createdAt: validBackup.createdAt,
    status: 'VALID',
    sourceFingerprint: 'c'.repeat(64),
    auditCreatedAt: '2026-08-29T05:00:00.000Z',
  });
});

test('cutover checkpoint ignores a backup timestamp that is after its import audit', () => {
  const checkpoint = getLatestPcnCustomerImportCheckpoint([
    {
      id: 'future-backup-import',
      createdAt: '2026-08-29T05:00:00.000Z',
      actorName: 'PCN customer import job',
      action: 'IMPORTED',
      entityType: 'PCN_CUSTOMER',
      summary: 'Nhập danh mục',
      source: 'IMPORT',
      idempotencyFingerprint: 'd'.repeat(64),
      changes: getPcnCustomerImportAuditChanges({
        filename: validBackup.filename,
        createdAt: '2026-08-29T05:00:01.000Z',
        status: 'VALID',
      }),
    },
  ]);

  assert.equal(checkpoint, undefined);
});
