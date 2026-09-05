import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createPcnSessionToken,
  findPcnUser,
  toPcnUserAccount,
  verifyPcnPassword,
  verifyPcnSessionToken,
} from '../utils/pcnAuth.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const loginSource = fs.readFileSync(new URL('../components/LoginScreen.tsx', import.meta.url), 'utf8');
const pcnStoreSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8')) as { icons?: Array<{ src?: string; type?: string }> };

const userRows = [
  {
    documentId: 'pcn-user-01',
    data: {
      username: 'nguyen.van.a',
      'Họ và Tên': 'Nguyễn Văn A',
      password: 'MatKhau-01',
      role: 'viewer',
      position: 'Chuyên viên',
    },
  },
];

test('PCN user lookup supports document id, username and email aliases', () => {
  assert.equal(findPcnUser(userRows, 'pcn-user-01')?.documentId, 'pcn-user-01');
  assert.equal(findPcnUser(userRows, 'nguyen.van.a')?.documentId, 'pcn-user-01');
  assert.equal(findPcnUser([{ ...userRows[0], data: { ...userRows[0].data, email: 'nguyen.van.a@tvci.test' } }], 'nguyen.van.a@tvci.test')?.documentId, 'pcn-user-01');
  assert.equal(findPcnUser(userRows, 'missing-user'), null);
});

test('PCN password verification supports configured password and legacy default only when blank', () => {
  assert.equal(verifyPcnPassword(userRows[0], 'MatKhau-01'), true);
  assert.equal(verifyPcnPassword(userRows[0], 'wrong'), false);
  assert.equal(verifyPcnPassword({ documentId: 'blank', data: {} }, 'Abc123456'), true);
  assert.equal(verifyPcnPassword({ documentId: 'blank', data: {} }, 'admin'), false);
});

test('PCN session token preserves a safe user snapshot and rejects tampering/expiry', () => {
  const user = toPcnUserAccount(userRows[0]);
  const token = createPcnSessionToken(user, 'pcn-test-secret', 1_000, 60);
  assert.deepEqual(verifyPcnSessionToken(token, 'pcn-test-secret', 1_500), user);
  assert.equal(verifyPcnSessionToken(`${token}tampered`, 'pcn-test-secret', 1_500), null);
  assert.equal(verifyPcnSessionToken(token, 'pcn-test-secret', 62_000), null);
  assert.equal((user as unknown as Record<string, unknown>).password, undefined);
});

test('PCN login uses a server session and PCN data/file APIs require that session', () => {
  assert.match(serverSource, /\/api\/auth\/pcn-session/);
  assert.match(serverSource, /PCN_SESSION_COOKIE/);
  assert.match(serverSource, /requirePcnSession/);
  assert.match(serverSource, /app\.post\("\/api\/pcn\/files"/);
  assert.match(serverSource, /app\.get\("\/api\/pcn\/files\/:assetId"/);
  assert.match(loginSource, /establishPcnSession/);
  assert.doesNotMatch(loginSource, /fetchCollection<any>\('systemUsers'/);
});

test('PCN login resolves common identities with a targeted system-user lookup before legacy fallback', () => {
  assert.match(serverSource, /collection_name = 'systemUsers'[\s\S]{0,700}lower\(document_id\) = ANY\(\$1::text\[\]\)/);
  assert.match(serverSource, /data->>'username'/);
  assert.match(serverSource, /data->>'Tên đăng nhập'/);
  assert.match(serverSource, /findPcnUser/);
});

test('PCN login exposes the IEMM identity instead of the generic shield mark', () => {
  assert.match(loginSource, /mode === 'pcn' \? <div[\s\S]*?<img/);
  assert.match(loginSource, /\/icons\/iemm-logo-32\.png/);
  assert.match(loginSource, /alt="IEMM • TVCI"/);
  assert.match(loginSource, /IEMM • TVCI/);
});

test('PCN uses the supplied IEMM logo consistently across shell, metadata, PWA and service-worker cache', () => {
  assert.equal(fs.existsSync(new URL('../public/icons/iemm-logo.jpg', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../public/icons/iemm-logo-32.png', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../public/icons/iemm-logo-192.png', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../public/icons/iemm-logo-512.png', import.meta.url)), true);
  assert.match(workspaceSource, /\/icons\/iemm-logo-32\.png/);
  assert.match(layoutSource, /\/icons\/iemm-logo-32\.png/);
  assert.match(layoutSource, /\/icons\/iemm-logo-192\.png/);
  assert.deepEqual(manifest.icons?.map((icon) => icon.src), ['/icons/iemm-logo-192.png', '/icons/iemm-logo-512.png']);
  assert.match(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), /\/icons\/iemm-logo-512\.png/);
});

test('PCN session teardown resets in-memory business data before the next login', () => {
  assert.match(pcnStoreSource, /reset:\s*\(\)\s*=>\s*void/);
  assert.match(workspaceSource, /resetPcn\(\)/);
});

// --- End of pcn-auth.test.ts ---
