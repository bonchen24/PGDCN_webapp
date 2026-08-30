import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policyPath = new URL('../utils/pcnOrphanResultCleanup.ts', import.meta.url);
const scriptPath = new URL('../scripts/reconcilePcnOrphanResults.ts', import.meta.url);
const policySource = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, 'utf8') : '';
const scriptSource = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';

test('PCN orphan result cleanup plans only empty records with zero references', async () => {
  let planPcnOrphanResultCleanup: (records: Array<Record<string, unknown>>) => { safeToRemove: boolean; candidateIds: string[]; blockedIds: string[] };
  try {
    ({ planPcnOrphanResultCleanup } = await import('../utils/pcnOrphanResultCleanup.ts'));
  } catch {
    assert.fail('PCN orphan cleanup policy is not implemented yet.');
  }

  const plan = planPcnOrphanResultCleanup([
    {
      documentId: 'empty-orphan',
      data: {},
      dossierReferenceCount: 0,
      labRequestReferenceCount: 0,
      fileAssetCount: 0,
      activityReferenceCount: 0,
    },
    {
      documentId: 'linked-record',
      data: {},
      dossierReferenceCount: 1,
      labRequestReferenceCount: 0,
      fileAssetCount: 0,
      activityReferenceCount: 0,
    },
  ]);

  assert.equal(plan.safeToRemove, false);
  assert.deepEqual(plan.candidateIds, ['empty-orphan']);
  assert.deepEqual(plan.blockedIds, ['linked-record']);
});

test('PCN orphan result cleanup only plans completely empty, unlinked records', () => {
  assert.match(policySource, /export function planPcnOrphanResultCleanup/);
  assert.match(policySource, /Object\.keys\(data\)\.length/);
  assert.match(policySource, /dossierReferenceCount/);
  assert.match(policySource, /labRequestReferenceCount/);
  assert.match(policySource, /fileAssetCount/);
  assert.match(policySource, /safeToRemove/);
});

test('PCN orphan result cleanup is dry-run first and backup-gated on apply', () => {
  assert.match(scriptSource, /PCN_ORPHAN_RESULT_CLEANUP/);
  assert.match(scriptSource, /verifyBackupArchive/);
  assert.match(scriptSource, /mode: 'DRY_RUN'/);
  assert.match(scriptSource, /mode: 'APPLIED'/);
  assert.match(scriptSource, /entityType: 'SYSTEM'/);
});
