// Author: Gemini
// OS support: Web/Node
// Description: Node-compatible red/green contract for personal identity and CSV boundaries

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('personal settings and sync no longer contain the legacy display-name/CSV coupling', () => {
  const modal = read('components/UserSettingsModal.tsx');
  const store = read('store.ts');

  assert.doesNotMatch(modal, /setDisplayName|displayName:\s*displayName|Tên hiển thị/);
  assert.doesNotMatch(store, /prefs\.displayName|userPreferences\[['"]admin['"]\]\?\.displayName/);
  assert.match(store, /preloadCsvCatalogs/);
  assert.ok(read('App.tsx').indexOf('await preloadCsvCatalogs()') < read('App.tsx').indexOf('await fetchData()'));
  const syncStart = store.indexOf('syncTwoWay: async');
  const syncEnd = store.indexOf('  addCustomer:', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  assert.doesNotMatch(store.slice(syncStart, syncEnd), /loadCSVFallback|data\.json/);
  const preloadStart = store.indexOf('preloadCsvCatalogs: async');
  const preloadEnd = store.indexOf('  addUser:', preloadStart);
  assert.ok(preloadStart >= 0 && preloadEnd > preloadStart);
  assert.doesNotMatch(store.slice(preloadStart, preloadEnd), /batchSaveToPostgres|saveDocToPostgres|syncTwoWay/);
  assert.match(store, /csvCatalogBaseline/);
});

// --- End of user-settings-csv-runtime-boundary.test.mjs ---
