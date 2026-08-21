// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for personal identity and CSV/PostgreSQL boundaries

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const modal = read('components/UserSettingsModal.tsx');
const store = read('store.ts');
const app = read('App.tsx');

test('personal settings no longer expose or persist a display name', () => {
  assert.doesNotMatch(modal, /setDisplayName|displayName:\s*displayName|Tên hiển thị/);
  assert.doesNotMatch(store, /prefs\.displayName|userPreferences\[['"]admin['"]\]\?\.displayName/);
  assert.doesNotMatch(read('types.ts'), /displayName\?:\s*string/);
});

test('system users are read from PostgreSQL and rendered from store state', () => {
  assert.match(store, /fetchCollection\("systemUsers", true\)/);
  assert.match(read('components/SettingsModal.tsx'), /systemUsers\.map/);
});

test('CSV preload is owned by startup and is not part of two-way sync', () => {
  assert.match(store, /preloadCsvCatalogs/);
  assert.match(app, /preloadCsvCatalogs/);
  assert.ok(app.indexOf('await preloadCsvCatalogs()') < app.indexOf('await fetchData()'));
  const syncStart = store.indexOf('syncTwoWay: async');
  const syncEnd = store.indexOf('  addCustomer:', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  assert.doesNotMatch(store.slice(syncStart, syncEnd), /loadCSVFallback|data\.json/);
  const preloadStart = store.indexOf('preloadCsvCatalogs: async');
  const preloadEnd = store.indexOf('  addUser:', preloadStart);
  assert.ok(preloadStart >= 0 && preloadEnd > preloadStart);
  assert.doesNotMatch(store.slice(preloadStart, preloadEnd), /batchSaveToPostgres|saveDocToPostgres|syncTwoWay/);
});

test('CSV seed rows are excluded from catalog write batches until changed', () => {
  assert.match(store, /csvCatalogBaseline/);
  assert.match(store, /filterCatalogWrites|shouldPersistCatalog/);
});

test('catalog CRUD methods still trigger the existing DB sync path', () => {
  assert.match(store, /addCustomer:[\s\S]*syncWithCloud/);
  assert.match(store, /addProduct:[\s\S]*syncWithCloud/);
  assert.match(store, /addBrand:[\s\S]*syncWithCloud/);
});

// --- End of user-settings-csv-runtime-boundary.test.ts ---
