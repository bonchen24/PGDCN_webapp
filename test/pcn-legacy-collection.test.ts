import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_LEGACY_COLLECTION_MAPPINGS,
  planPcnLegacyCollectionReconciliation,
} from '../utils/pcnLegacyCollectionPolicy.ts';

const scriptSource = fs.readFileSync(new URL('../scripts/reconcilePcnLegacyCollections.ts', import.meta.url), 'utf8');

test('legacy collection cleanup only removes exact canonical duplicates', () => {
  const plan = planPcnLegacyCollectionReconciliation({
    ...PCN_LEGACY_COLLECTION_MAPPINGS[0],
    legacyDocuments: [{ documentId: 'QC4', data: { name: 'Quy chuẩn 4', code: 'QC4' } }],
    canonicalDocuments: [{ documentId: 'QC4', data: { code: 'QC4', name: 'Quy chuẩn 4' } }],
  });
  assert.equal(plan.safeToRemove, true);
  assert.deepEqual(plan.matchingIds, ['QC4']);
  assert.deepEqual(plan.missingCanonicalIds, []);
  assert.deepEqual(plan.conflictingIds, []);
});

test('legacy cleanup refuses missing or conflicting canonical rows', () => {
  const missing = planPcnLegacyCollectionReconciliation({
    ...PCN_LEGACY_COLLECTION_MAPPINGS[0],
    legacyDocuments: [{ documentId: 'QC9', data: { code: 'QC9' } }],
    canonicalDocuments: [],
  });
  assert.equal(missing.safeToRemove, false);
  assert.deepEqual(missing.missingCanonicalIds, ['QC9']);

  const conflict = planPcnLegacyCollectionReconciliation({
    ...PCN_LEGACY_COLLECTION_MAPPINGS[0],
    legacyDocuments: [{ documentId: 'QC4', data: { code: 'QC4', name: 'Sai khác' } }],
    canonicalDocuments: [{ documentId: 'QC4', data: { code: 'QC4', name: 'Quy chuẩn 4' } }],
  });
  assert.equal(conflict.safeToRemove, false);
  assert.deepEqual(conflict.conflictingIds, ['QC4']);
});

test('legacy cleanup is dry-run by default and auditable when explicitly applied', () => {
  assert.match(scriptSource, /argv\.includes\('--apply'\)/);
  assert.match(scriptSource, /mode: 'DRY_RUN'/);
  assert.match(scriptSource, /mode: 'APPLIED'/);
  assert.match(scriptSource, /buildActivityLog/);
  assert.match(scriptSource, /DELETE FROM app_documents/);
  assert.match(scriptSource, /if \(!apply\)/);
});

test('legacy cleanup requires an existing backup and explicit confirmation before apply', () => {
  assert.match(scriptSource, /--backup=/);
  assert.match(scriptSource, /--confirm=/);
  assert.match(scriptSource, /getBackupPath/);
  assert.match(scriptSource, /pcn_certification_\[a-z0-9._-\]\+\\\.zip/i);
  assert.match(scriptSource, /verifyBackupArchive/);
  assert.match(scriptSource, /backupVerification\.ok/);
  assert.match(scriptSource, /backupVerification\.status !== 'VALID'/);
  assert.match(scriptSource, /PCN_LEGACY_CLEANUP/);
});

// --- End of pcn-legacy-collection.test.ts ---
