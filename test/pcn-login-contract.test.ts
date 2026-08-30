import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loginSource = readFileSync(new URL('../components/LoginScreen.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../store.ts', import.meta.url), 'utf8');

test('PCN login mode does not initialize the legacy KQTN session', () => {
  assert.match(loginSource, /LoginScreen[^=]*mode\?:\s*'legacy'\s*\|\s*'pcn'/);
  assert.match(loginSource, /mode\s*!==\s*'pcn'[\s\S]*establishKqtnSession/);
assert.match(loginSource, /mode\s*!==\s*'pcn'[\s\S]*fetchData\(false\)/);
assert.match(loginSource, /mode\s*!==\s*'pcn'[\s\S]*syncTwoWay/);
assert.match(loginSource, /login\(username, password, \{\s*skipLegacyFetch:/);
assert.match(storeSource, /skipLegacyFetch/);
assert.match(storeSource, /skipLegacySession/);
assert.match(workspaceSource, /logout\(\{\s*skipLegacySession:\s*true\s*\}\)/);
  assert.match(workspaceSource, /<LoginScreen\s+mode="pcn"\s*\/>/);
});

test('PCN login reads its own system users without seeding or syncing DDT', () => {
  assert.match(loginSource, /establishPcnSession/);
  assert.match(loginSource, /useStore\.setState\(\{\s*currentUser:\s*session\.user/);
  assert.match(loginSource, /mode\s*===\s*'pcn'/);
  assert.doesNotMatch(loginSource, /fetchCollection/);
  assert.doesNotMatch(loginSource, /mode\s*===\s*'pcn'[\s\S]*syncTwoWay\(/);
});

test('password visibility control has an accessible name', () => {
  assert.match(loginSource, /type="button"[\s\S]*aria-label=\{showPassword \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
});
