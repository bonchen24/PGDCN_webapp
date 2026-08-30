import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_ACTIVE_COLLECTIONS,
  buildPcnCutoverReconciliation,
  verifyPcnCutoverSnapshot,
} from '../utils/pcnCutoverVerification.ts';
import { buildSafePcnCutoverSnapshot } from '../utils/pcnCutoverReport.ts';

const verificationScript = fs.readFileSync(new URL('../scripts/verifyPcnCutover.ts', import.meta.url), 'utf8');
const verificationService = fs.readFileSync(new URL('../utils/pcnCutoverService.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};

test('PCN cutover verification accepts an isolated healthy snapshot', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: ['pcnCertificationFields', 'customers', 'activityLogs'],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 156,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, {
    expectedDatabase: 'pcn_certification',
    expectedCustomerCount: 156,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(PCN_ACTIVE_COLLECTIONS.includes('customers'));
});

test('PCN cutover allowlist includes active department and template collections', () => {
  assert.ok(PCN_ACTIVE_COLLECTIONS.includes('pcnDepartmentRoles'));
  assert.ok(PCN_ACTIVE_COLLECTIONS.includes('pcnTemplateDefinitions'));
  assert.ok(PCN_ACTIVE_COLLECTIONS.includes('pcnSignerDelegations'));
});

test('PCN cutover verification rejects DDT collections and missing controls', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'ddt_lab',
    collectionNames: ['customers', 'requests', 'kqtnRecords'],
    fieldCodes: ['QC4'],
    customerCount: 155,
    hasActivityLogAppendOnlyTrigger: false,
    hasFileAssetsTable: false,
  }, {
    expectedDatabase: 'pcn_certification',
    expectedCustomerCount: 156,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /database|requests|kqtnRecords|QC9|156|append-only|file_assets/i);
});

test('PCN cutover verification reports the explicit DDT boundary evidence', () => {
  const healthy = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: ['customers'],
    ddtCollectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification' });
  assert.equal(healthy.ok, true);

  const leaked = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: ['customers'],
    ddtCollectionNames: ['requests'],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification' });
  assert.equal(leaked.ok, false);
  assert.match(leaked.errors.join('\n'), /DDT.*requests|requests.*DDT/i);
});

test('PCN cutover verification explains customer key mismatches in the failure summary', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: ['customers'],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 156,
    customerHash: 'target-hash',
    customerKeyReconciliation: {
      missingKeyCount: 1,
      extraKeyCount: 1,
      changedKeyCount: 0,
      duplicateSourceKeyCount: 0,
      duplicateTargetKeyCount: 0,
    },
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, {
    expectedDatabase: 'pcn_certification',
    expectedCustomerCount: 156,
    expectedCustomerHash: 'source-hash',
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Hash danh mục khách hàng không khớp/);
  assert.match(result.errors.join('\n'), /đối soát khóa: thiếu 1, thừa 1, khác trường 0/i);
});

test('PCN cutover verification reports empty customer records separately from key mismatches', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 1,
    customerDataIntegrity: { emptyTargetRecordCount: 1 },
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification' });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /1 bản ghi khách hàng không có dữ liệu nghiệp vụ/i);
});

test('PCN cutover verification explains known legacy collection remediation without mutating it', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: ['pcnSchemeBranches'],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
    legacyCollectionReconciliation: [{
      legacyCollection: 'pcnSchemeBranches',
      canonicalCollection: 'pcnCertificationFields',
      legacyCount: 2,
      matchingCount: 2,
      missingCanonicalCount: 0,
      conflictingCount: 0,
      safeToRemove: true,
    }],
  }, { expectedDatabase: 'pcn_certification' });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /pcnSchemeBranches.*pcnCertificationFields.*2.*an toàn để dọn/i);
});

test('PCN cutover can require a verified backup archive before readiness is granted', () => {
  const missing = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification', requireVerifiedBackup: true });

  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /backup|archive/i);
});

test('PCN cutover accepts a verified archive only when dump and objects pass checks', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
    backupVerification: {
      filename: 'pcn_certification_auto_20260829-032312.zip',
      format: 'zip',
      sizeBytes: 381966092,
      databaseDumpPresent: true,
      manifestPresent: true,
      manifestObjectCount: 2,
      objectEntryCount: 2,
      verifiedObjectCount: 2,
      missingObjectCount: 0,
      invalidObjectCount: 0,
      pgToolAvailable: true,
      dumpReadable: true,
      status: 'VALID',
      ok: true,
      errors: [],
    },
  }, { expectedDatabase: 'pcn_certification', requireVerifiedBackup: true });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('PCN customer cutover can require an explicit pre-import checkpoint', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    backupVerification: {
      filename: 'pcn_certification_auto_20260829-040000.zip',
      format: 'zip',
      sizeBytes: 1,
      databaseDumpPresent: true,
      manifestPresent: true,
      manifestObjectCount: 0,
      objectEntryCount: 0,
      verifiedObjectCount: 0,
      missingObjectCount: 0,
      invalidObjectCount: 0,
      pgToolAvailable: true,
      dumpReadable: true,
      status: 'VALID',
      ok: true,
      errors: [],
    },
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification', requireVerifiedBackup: true, requireCustomerImportCheckpoint: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /checkpoint.*import|import.*checkpoint/i);
});

test('PCN cutover rejects an import checkpoint whose referenced archive was not re-verified', () => {
  const result = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    latestCustomerImportCheckpoint: {
      filename: 'pcn_certification_auto_20260829-032312.zip',
      createdAt: '2026-08-29T03:23:12.000Z',
      status: 'VALID',
      sourceFingerprint: 'a'.repeat(64),
      auditCreatedAt: '2026-08-29T03:30:00.000Z',
    },
    backupVerification: {
      filename: 'pcn_certification_auto_20260829-040000.zip',
      format: 'zip',
      sizeBytes: 1,
      databaseDumpPresent: true,
      manifestPresent: true,
      manifestObjectCount: 0,
      objectEntryCount: 0,
      verifiedObjectCount: 0,
      missingObjectCount: 0,
      invalidObjectCount: 0,
      pgToolAvailable: true,
      dumpReadable: true,
      status: 'VALID',
      ok: true,
      errors: [],
    },
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
  }, { expectedDatabase: 'pcn_certification', requireVerifiedBackup: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /checkpoint.*archive|archive.*checkpoint|tham chiếu.*kiểm chứng/i);
});

test('PCN reconciliation reports stable hashes and catches broken links, pointers, and namespaces', () => {
  const healthy = buildPcnCutoverReconciliation({
    proposals: [{ id: 'proposal-1', dossierId: 'dossier-1', proposalCode: 'DN-001' }],
    dossiers: [{ id: 'dossier-1', proposalId: 'proposal-1', dossierCode: 'HS-001' }],
    fileAssets: [{
      id: 'asset-1', bucketName: 'pcn-files', objectPath: 'dossier/asset-1.pdf',
      sourceCollection: 'dossierDocuments', sourceDocumentId: 'document-1', sourceJsonPath: 'fileAssetId',
      mimeType: 'application/pdf', byteSize: 12, sha256: 'a'.repeat(64),
    }],
    notifications: [{ id: 'pcn-notif-activity-1', entityType: 'PCN_DOSSIER' }],
    activityLogs: [{ id: 'activity-1', entityType: 'PCN_DOSSIER' }],
  });

  assert.deepEqual({
    proposalCount: healthy.proposalCount,
    dossierCount: healthy.dossierCount,
    fileAssetCount: healthy.fileAssetCount,
    notificationCount: healthy.notificationCount,
    activityLogCount: healthy.activityLogCount,
    orphanProposalLinkCount: healthy.orphanProposalLinkCount,
    orphanDossierLinkCount: healthy.orphanDossierLinkCount,
    invalidFilePointerCount: healthy.invalidFilePointerCount,
    invalidNotificationCount: healthy.invalidNotificationCount,
    invalidActivityLogCount: healthy.invalidActivityLogCount,
  }, {
    proposalCount: 1,
    dossierCount: 1,
    fileAssetCount: 1,
    notificationCount: 1,
    activityLogCount: 1,
    orphanProposalLinkCount: 0,
    orphanDossierLinkCount: 0,
    invalidFilePointerCount: 0,
    invalidNotificationCount: 0,
    invalidActivityLogCount: 0,
  });
  assert.match(healthy.proposalHash, /^[a-f0-9]{64}$/);
  assert.match(healthy.fileAssetHash, /^[a-f0-9]{64}$/);
  assert.equal(healthy.ok, true);

  const broken = buildPcnCutoverReconciliation({
    proposals: [{ id: 'proposal-1', dossierId: 'missing-dossier' }],
    dossiers: [{ id: 'dossier-1', proposalId: 'missing-proposal' }],
    fileAssets: [{ id: 'asset-1', bucketName: '', objectPath: '', sourceCollection: '', sourceDocumentId: '', sourceJsonPath: '', mimeType: '', byteSize: -1, sha256: 'bad' }],
    notifications: [{ id: 'notif-ddt-1', entityType: 'REQUEST' }],
    activityLogs: [{ id: 'activity-1', entityType: 'REQUEST' }],
  });

  assert.equal(broken.ok, false);
  assert.equal(broken.orphanProposalLinkCount, 1);
  assert.equal(broken.orphanDossierLinkCount, 1);
  assert.equal(broken.invalidFilePointerCount, 1);
  assert.equal(broken.invalidNotificationCount, 1);
  assert.equal(broken.invalidActivityLogCount, 1);

  const verification = verifyPcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [...PCN_ACTIVE_COLLECTIONS],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
    reconciliation: broken,
  }, { expectedDatabase: 'pcn_certification' });
  assert.equal(verification.ok, false);
  assert.match(verification.errors.join('\n'), /mồ côi|pointer|namespace|allowlist/i);
});

test('PCN cutover verification script is read-only, PCN-only, and exposed as an npm command', () => {
  assert.match(packageJson.scripts?.['verify:pcn-cutover'] || '', /verifyPcnCutover/);
  assert.match(verificationScript, /APP_PROFILE.*pcn/);
  assert.match(verificationService, /SELECT DISTINCT collection_name/);
  assert.doesNotMatch(verificationScript, /INSERT INTO|UPDATE app_documents|DELETE FROM/);
  assert.doesNotMatch(verificationService, /INSERT INTO|UPDATE app_documents|DELETE FROM/);
  assert.doesNotMatch(verificationScript, /requests|handoverDocs|kqtnRecords/);
});

test('PCN cutover CLI report uses a safe snapshot projection without archive byte size', () => {
  assert.match(verificationScript, /buildSafePcnCutoverSnapshot/);
  assert.match(verificationScript, /safeSnapshot/);

  const safe = buildSafePcnCutoverSnapshot({
    profile: 'pcn',
    database: 'pcn_certification',
    collectionNames: [],
    fieldCodes: ['QC4', 'QC9'],
    customerCount: 0,
    hasActivityLogAppendOnlyTrigger: true,
    hasFileAssetsTable: true,
    backupVerification: {
      filename: 'pcn_certification_auto_20260830-034442.zip',
      format: 'zip',
      sizeBytes: 383230942,
      databaseDumpPresent: true,
      manifestPresent: true,
      manifestObjectCount: 637,
      objectEntryCount: 637,
      verifiedObjectCount: 637,
      missingObjectCount: 0,
      invalidObjectCount: 0,
      pgToolAvailable: true,
      dumpReadable: true,
      status: 'VALID',
      ok: true,
      errors: [],
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(safe.backupVerification || {}, 'sizeBytes'), false);
  assert.equal(safe.backupVerification?.filename, 'pcn_certification_auto_20260830-034442.zip');
});

// --- End of pcn-cutover.test.ts ---
