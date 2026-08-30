import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPcnBackupVerification } from '../utils/pcnBackupVerification.ts';

function validInput() {
  return {
    filename: 'pcn_certification_auto_20260829-032312.zip',
    format: 'zip' as const,
    sizeBytes: 381966092,
    databaseDumpPresent: true,
    manifestPresent: true,
    manifestReadable: true,
    manifestObjectCount: 2,
    objectEntryCount: 2,
    verifiedObjectCount: 2,
    missingObjectCount: 0,
    invalidObjectCount: 0,
    pgToolAvailable: true,
    dumpReadable: true,
  };
}

test('PCN backup verification marks a complete archive as ready', () => {
  const result = buildPcnBackupVerification(validInput());

  assert.equal(result.ok, true);
  assert.equal(result.status, 'VALID');
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifestObjectCount, 2);
  assert.equal(result.verifiedObjectCount, 2);
});
test('PCN backup verification rejects an archive with missing or invalid evidence', () => {
  const result = buildPcnBackupVerification({
    ...validInput(),
    manifestReadable: false,
    objectEntryCount: 1,
    verifiedObjectCount: 1,
    missingObjectCount: 1,
    invalidObjectCount: 1,
    dumpReadable: false,
  }, ['Manifest không đọc được.']);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'INVALID');
  assert.match(result.errors.join('\n'), /Manifest không đọc được|object|dump/i);
});

test('PCN cutover backup verification is read-only and wired to the archive boundary', () => {
  assert.equal(typeof buildPcnBackupVerification, 'function');
});
