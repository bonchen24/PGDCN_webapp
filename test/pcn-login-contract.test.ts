import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pcnLoginSource = readFileSync(new URL('../components/PcnLoginScreen.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('active PCN login uses only the PCN server session', () => {
  assert.match(pcnLoginSource, /establishPcnSession/);
  assert.match(pcnLoginSource, /usePcnSessionStore\.getState\(\)\.setCurrentUser\(session\.user\)/);
  assert.doesNotMatch(pcnLoginSource, /establishKqtnSession|syncTwoWay|fetchData|useStore|saveDocToPostgres/);
  assert.match(workspaceSource, /PcnLoginScreen/);
  assert.doesNotMatch(workspaceSource, /<LoginScreen/);
});

test('PCN login reads its own system users without seeding or syncing DDT', () => {
  assert.match(pcnLoginSource, /Hệ thống chứng nhận/);
  assert.match(pcnLoginSource, /Phòng Chứng nhận/);
  assert.doesNotMatch(pcnLoginSource, /fetchCollection|syncTwoWay|systemUsers|Phòng Điện - Điện tử/);
});

test('PCN password visibility control has an accessible name', () => {
  assert.match(pcnLoginSource, /type="button"[\s\S]*aria-label=\{showPassword \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
});
