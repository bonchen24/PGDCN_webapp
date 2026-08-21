// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for audit coverage across Zustand business mutations

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diffActivityFields } from '../utils/activityLog.ts';
import { isMajorRequestUpdate } from '../utils/notificationEvents.ts';

test('store contains append audit coverage for every business entity family', () => {
  const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
  for (const marker of [
    'appendActivityLog',
    "entityType: 'REQUEST'",
    "entityType: 'HANDOVER_DOC'",
    "entityType: 'KQTN_RECORD'",
    "entityType: 'SCHEDULE'",
    "entityType: 'USER'",
    "entityType: 'CUSTOMER'",
    "entityType: 'PRODUCT'",
    "entityType: 'BRAND'",
    "entityType: 'SYSTEM_SETTINGS'",
  ]) {
    assert.ok(storeSource.includes(marker), `Missing audit coverage marker: ${marker}`);
  }
});

test('small request edits are audited without becoming notifications', () => {
  assert.equal(isMajorRequestUpdate({ note: 'mới' }), false);
  assert.equal(isMajorRequestUpdate({ requestCode: 'PYC-02' }), false);
  assert.equal(isMajorRequestUpdate({ customerName: 'Tên mới' }), false);
  assert.deepEqual(diffActivityFields({ note: 'cũ' }, { note: 'mới' }, ['note']), [
    { field: 'note', before: 'cũ', after: 'mới' },
  ]);
});

test('updateTestResult classifies result activity as KQTN_RECORD', () => {
  const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
  const start = storeSource.indexOf('  updateTestResult: async');
  const end = storeSource.indexOf('  updateSettings:', start);
  assert.ok(start >= 0 && end > start);
  assert.match(storeSource.slice(start, end), /entityType: 'KQTN_RECORD'/);
});

test('bulk request creation writes one audit entity per created request', () => {
  const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
  const start = storeSource.indexOf('  addRequests: async');
  const end = storeSource.indexOf('  deleteRequest:', start);
  assert.ok(start >= 0 && end > start);
  const implementation = storeSource.slice(start, end);
  assert.match(implementation, /processedReqs\.forEach\(req => \{/);
  assert.match(implementation, /entityId: req\.id/);
});

// --- End of activity-log-store-contract.test.ts ---
