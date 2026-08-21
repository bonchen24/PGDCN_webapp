// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for the RequestModal database sync boundary
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const requestModalSource = fs.readFileSync(new URL('../components/RequestModal.tsx', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');

const getBlock = (source: string, startMarker: string, endMarker: string): string => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
};

test('RequestModal uses a targeted request pre-check before saving', () => {
  const handleSubmit = getBlock(requestModalSource, '  const handleSubmit = async', '  if (!isOpen) return null;');
  assert.match(handleSubmit, /fetchLatestRequests/);
  assert.doesNotMatch(handleSubmit, /syncWithCloud\(true\)/);
});

test('RequestModal performs one post-save full sync while addRequests skips its own sync', () => {
  const executeSave = getBlock(requestModalSource, '  const executeSaveRequests = async', '  const proceedToSave = async');
  assert.match(executeSave, /await addRequests\(requestsToCreate, true\)/);
  assert.equal((executeSave.match(/syncWithCloud\(true\)/g) || []).length, 1);
});

test('addRequests supports a scoped skipSync option and keeps default persistence', () => {
  const addRequests = getBlock(storeSource, '  addRequests: async', '  deleteRequest: async');
  assert.match(storeSource, /fetchLatestRequests: async/);
  assert.match(addRequests, /newReqs, skipSync = false/);
  assert.match(addRequests, /if \(!skipSync\)\s*\{[\s\S]*?syncWithCloud\(true\)/);
});

// --- End of request-save-sync-contract.test.ts ---
