import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPcnHaimyDiscoveryReport,
  buildPcnHaimyImportPlan,
  comparePcnHaimyStagingRecords,
  type PcnHaimyExportRecord,
} from '../utils/pcnIntegration.ts';

const baseRecord: PcnHaimyExportRecord = {
  sourceSystem: 'HAIMY',
  externalRegistrationId: 'DK-2026-001',
  externalBatchId: 'LOT-001',
  customerName: 'Công ty Ánh Dương',
  productName: 'Nồi chiên không dầu',
  model: 'AD-01',
  brand: 'Ánh Dương',
  fieldCode: 'QC4',
  quantity: 2,
};

test('discovery report remains import-only when Haimy API and retry contract are not supplied', () => {
  const report = buildPcnHaimyDiscoveryReport({
    apiEndpoint: null,
    exportFormats: [],
    identifiers: [],
    retryContract: null,
    credentialConfigured: false,
  });

  assert.equal(report.status, 'UNCONFIGURED');
  assert.equal(report.canWriteUpstream, false);
  assert.deepEqual(report.unknownCapabilities, ['api', 'export', 'identifiers', 'retry', 'credentials']);
});

test('discovery report can confirm an import format without enabling upstream writes', () => {
  const report = buildPcnHaimyDiscoveryReport({
    apiEndpoint: null,
    exportFormats: ['csv'],
    identifiers: ['externalRegistrationId'],
    retryContract: null,
    credentialConfigured: false,
  });

  assert.equal(report.status, 'IMPORT_ONLY');
  assert.equal(report.importEnabled, true);
  assert.equal(report.canWriteUpstream, false);
  assert.deepEqual(report.confirmedCapabilities, ['export', 'identifiers']);
});

test('import plan stages records and never produces an upstream write action', () => {
  const plan = buildPcnHaimyImportPlan({
    batchId: 'batch-2026-08-28',
    records: [baseRecord],
  });

  assert.equal(plan.mode, 'STAGING_ONLY');
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].status, 'READY_FOR_REVIEW');
  assert.match(plan.items[0].idempotencyKey, /^pcn-haimy-/);
  assert.equal(plan.items[0].externalRegistrationId, 'DK-2026-001');
  assert.deepEqual(plan.upstreamActions, []);
});

test('records without an external registration id require review and use a payload fallback key', () => {
  const plan = buildPcnHaimyImportPlan({
    batchId: 'batch-2026-08-28',
    records: [{ ...baseRecord, externalRegistrationId: '' }],
  });

  assert.equal(plan.items[0].status, 'NEEDS_REVIEW');
  assert.ok(plan.items[0].issues.some((issue) => issue.code === 'MISSING_EXTERNAL_REGISTRATION_ID'));
  assert.match(plan.items[0].idempotencyKey, /^pcn-haimy-/);
});

test('malformed quantity and non-object export rows stay in staging review instead of aborting the batch', () => {
  const plan = buildPcnHaimyImportPlan({
    batchId: 'batch-2026-08-28',
    records: [
      { ...baseRecord, quantity: 'two' },
      null as unknown as PcnHaimyExportRecord,
    ],
  });

  assert.equal(plan.items.length, 2);
  assert.ok(plan.items[0].issues.some((issue) => issue.code === 'INVALID_QUANTITY'));
  assert.equal(plan.items[0].status, 'NEEDS_REVIEW');
  assert.equal(plan.items[1].status, 'NEEDS_REVIEW');
});

test('staging keeps only the approved import fields and does not carry upstream credentials', () => {
  const plan = buildPcnHaimyImportPlan({
    batchId: 'batch-2026-08-28',
    records: [{ ...baseRecord, password: 'do-not-store', apiKey: 'do-not-store' } as PcnHaimyExportRecord & Record<string, unknown>],
  });

  assert.equal('password' in plan.items[0], false);
  assert.equal('apiKey' in plan.items[0], false);
});

test('same external identity with different content is a conflict, not an overwrite', () => {
  const first = buildPcnHaimyImportPlan({ batchId: 'batch-a', records: [baseRecord] }).items[0];
  const second = buildPcnHaimyImportPlan({ batchId: 'batch-b', records: [{ ...baseRecord, model: 'AD-02' }] }).items[0];

  const comparison = comparePcnHaimyStagingRecords(first, second);
  assert.equal(comparison.sameIdentity, true);
  assert.equal(comparison.samePayload, false);
  assert.equal(comparison.action, 'CONFLICT');
});

test('duplicate identical records are idempotent no-ops', () => {
  const first = buildPcnHaimyImportPlan({ batchId: 'batch-a', records: [baseRecord] }).items[0];
  const second = buildPcnHaimyImportPlan({ batchId: 'batch-b', records: [baseRecord] }).items[0];

  assert.deepEqual(comparePcnHaimyStagingRecords(first, second), {
    sameIdentity: true,
    samePayload: true,
    action: 'NOOP',
  });
});

// --- End of pcn-integration-contract.test.ts ---
