// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for deletion persistence and cloud reload behavior

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const storeSource = fs.readFileSync(path.resolve(process.cwd(), 'store.ts'), 'utf8');

function getBlock(startMarker: string, endMarker: string): string {
  const start = storeSource.indexOf(startMarker);
  const end = storeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return storeSource.slice(start, end);
}

test('cloud reload does not clear deletion tombstones', () => {
  const reloadBlock = getBlock('  forceReload: async', '  runDetailedSyncDiagnostic:');

  assert.doesNotMatch(reloadBlock, /deletedRequestIds\s*:\s*\[\]/);
  assert.doesNotMatch(reloadBlock, /deletedHandoverDocIds\s*:\s*\[\]/);
  assert.doesNotMatch(reloadBlock, /deletedCustomerIds\s*:\s*\[\]/);
  assert.doesNotMatch(reloadBlock, /deletedBrandNames\s*:\s*\[\]/);
  assert.doesNotMatch(reloadBlock, /deletedProductNames\s*:\s*\[\]/);
});

test('two-way sync never bootstraps from an external Google source', () => {
  assert.doesNotMatch(storeSource, /canBootstrapFromGas|migrateGASDataToPostgres|\/api\/gas|Google Apps Script/);
});

test('request deletion waits for the persistence sync to complete', () => {
  const deleteRequestBlock = getBlock('deleteRequest: async', 'deleteRequestGroup: async');
  const deleteGroupBlock = getBlock('deleteRequestGroup: async', 'updateRequestStatus: async');

  assert.match(deleteRequestBlock, /await\s+get\(\)\.syncWithCloud\(true\)/);
  assert.match(deleteGroupBlock, /await\s+get\(\)\.syncWithCloud\(true\)/);
});

test('catalog, handover, and result deletions wait for the persistence sync to complete', () => {
  const deleteCustomerBlock = getBlock('deleteCustomer: async', 'addBrand:');
  const deleteBrandBlock = getBlock('deleteBrand: async', 'addProduct:');
  const deleteProductBlock = getBlock('deleteProduct: async', 'addRequest:');
  const deleteHandoverBlock = getBlock('  deleteHandoverDoc: async', '  runAutoSchedule:');
  const deleteKqtnBlock = getBlock('deleteKqtnRecord: async', 'setupRealtimeSync:');

  for (const block of [
    deleteCustomerBlock,
    deleteBrandBlock,
    deleteProductBlock,
    deleteHandoverBlock,
    deleteKqtnBlock
  ]) {
    assert.match(block, /await\s+get\(\)\.syncWithCloud\(true\)/);
  }
});

// --- End of deletion-regression.test.ts ---
