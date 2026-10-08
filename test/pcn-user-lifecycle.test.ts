import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const serverSource = read('server.legacy.ts');
const userApiSource = read('utils/pcnUserApi.ts');
const storeSource = read('store-pcn.ts');
const userViewSource = read('components/PcnUserManagementView.tsx');
const schemaSource = read('sql/pcn-schema.sql');

test('PCN user deletion is a dedicated admin boundary with reference protection and audit', () => {
  assert.match(serverSource, /app\.delete\('\/api\/pcn\/users\/:id'/);
  assert.match(serverSource, /requirePcnAdmin\(req, res\)/);
  assert.match(serverSource, /systemUsers/);
  assert.match(serverSource, /certificationDossiers/);
  assert.match(serverSource, /pcnTasks/);
  assert.match(serverSource, /writePcnUserActivity\(req, client, 'DELETED'/);
});

test('PCN user management exposes delete through the same guarded client flow', () => {
  assert.match(userApiSource, /deletePcnUser/);
  assert.match(storeSource, /deletePcnUser/);
  assert.match(userViewSource, /onDelete/);
  assert.match(userViewSource, /Xóa/);
});

test('the invalid duplicate account is not part of the future PCN bootstrap seed', () => {
  assert.doesNotMatch(schemaSource, /\('systemUsers',\s*'nguyenthivananh'/);
});
