import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertAuthenticatedSession,
  assertDossierUiEvidence,
  assertPathOutsideRepository,
  assertPcnAppFingerprint,
  collectDossierTargets,
  findListeningPids,
  resolveAuthentication,
  selectBaseUrl,
} from '../scripts/qa-dossier-harness.mjs';

const fingerprintHtml = `<!doctype html><html lang="vi"><head><title>Phòng Giám định - Chứng nhận - TVCI</title><script src="/_next/static/chunks/app.js"></script></head><body><div id="root"></div></body></html>`;

test('QA login selectors match the actual PGDCN username and password inputs', () => {
  const loginPage = readFileSync(new URL('../app/(auth)/login/page.tsx', import.meta.url), 'utf8');
  const qaScript = readFileSync(new URL('../scripts/qa-dossier.mjs', import.meta.url), 'utf8');

  assert.match(loginPage, /id="login-username"/);
  assert.match(loginPage, /id="login-password"/);
  assert.match(loginPage, /htmlFor="login-username"[\s\S]*?Tên đăng nhập/);
  assert.match(loginPage, /htmlFor="login-password"[\s\S]*?Mật khẩu/);
  assert.equal(/#pcn-username|#pcn-password/.test(qaScript), false, 'QA automation must not use stale login selectors');
  assert.equal(/getByLabel\('Tên đăng nhập', \{ exact: true \}\)/.test(qaScript), true);
  assert.equal(/getByLabel\('Mật khẩu', \{ exact: true \}\)/.test(qaScript), true);
  assert.equal(/locator\('#login-username'\)/.test(qaScript), true);
  assert.equal(/locator\('#login-password'\)/.test(qaScript), true);

  const loginResponseHandling = qaScript.slice(qaScript.indexOf('const response = await loginResponse'), qaScript.indexOf('function redactSecrets'));
  assert.equal(qaScript.includes("&& response.request().method() === 'POST'"), true);
  assert.equal(/if \(!response\.ok\(\)\)[\s\S]*?await page\.goto\(new URL\('\/'/.test(loginResponseHandling), true);
  const loginFailureMessage = qaScript.match(/throw new Error\(`Đăng nhập UI QA trả HTTP[^`]*`/);
  assert.ok(loginFailureMessage);
  assert.doesNotMatch(loginFailureMessage[0], /scope/i);
});

test('defaults to the known local dev port and respects an explicit base URL', () => {
  assert.equal(selectBaseUrl({}), 'http://127.0.0.1:1357');
  assert.equal(selectBaseUrl({ PGDCN_UX_BASE_URL: 'http://localhost:1358/' }), 'http://localhost:1358');
});

test('rejects base URLs that cannot identify one exact HTTP origin', () => {
  assert.throws(() => selectBaseUrl({ PGDCN_UX_BASE_URL: 'http://user:pass@example.test' }), /không được chứa thông tin đăng nhập/i);
  assert.throws(() => selectBaseUrl({ PGDCN_UX_BASE_URL: 'http://example.test/qa' }), /chỉ hỗ trợ origin/i);
});

test('accepts the PGDCN fingerprint only from the selected origin and app shell', () => {
  assert.equal(assertPcnAppFingerprint({
    baseUrl: 'http://127.0.0.1:1357',
    responseUrl: 'http://127.0.0.1:1357/',
    status: 200,
    contentType: 'text/html; charset=utf-8',
    html: fingerprintHtml,
  }).port, '1357');

  assert.throws(() => assertPcnAppFingerprint({
    baseUrl: 'http://127.0.0.1:1357',
    responseUrl: 'http://127.0.0.1:2357/',
    status: 200,
    contentType: 'text/html',
    html: fingerprintHtml,
  }), /origin.*không khớp|cổng.*không khớp/i);

  assert.throws(() => assertPcnAppFingerprint({
    baseUrl: 'http://127.0.0.1:1357',
    responseUrl: 'http://127.0.0.1:1357/',
    status: 200,
    contentType: 'text/html',
    html: '<html><head><title>Other app</title></head><body>hello</body></html>',
  }), /không phải giao diện PGDCN/i);
});

test('matches the selected port to its listening Windows process IDs', () => {
  const netstat = [
    '  TCP    0.0.0.0:1357      0.0.0.0:0      LISTENING       1234',
    '  TCP    [::]:1357         [::]:0         LISTENING       1234',
    '  TCP    0.0.0.0:1358      0.0.0.0:0      LISTENING       5678',
    '  TCP    0.0.0.0:1357      0.0.0.0:0      ESTABLISHED     9999',
  ].join('\n');
  assert.deepEqual(findListeningPids(netstat, 1357), ['1234']);
  assert.deepEqual(findListeningPids(netstat, 2357), []);
});

test('requires an explicit trusted storage state or a complete credential pair', () => {
  assert.throws(() => resolveAuthentication({}), /Cần phiên đăng nhập QA hợp lệ/i);
  assert.throws(() => resolveAuthentication({ PGDCN_QA_USERNAME: 'qa-user' }), /cần cả PGDCN_QA_USERNAME và PGDCN_QA_PASSWORD/i);
  assert.deepEqual(resolveAuthentication({ PGDCN_QA_STORAGE_STATE: 'C:/Temp/qa-state.json' }), {
    kind: 'storageState',
    path: 'C:/Temp/qa-state.json',
    mode: 'api',
  });

  assert.deepEqual(resolveAuthentication({
    PGDCN_QA_STORAGE_STATE: 'C:/Temp/qa-state.json',
    PGDCN_QA_USERNAME: 'qa-user',
    PGDCN_QA_PASSWORD: 'qa-test-secret',
  }), {
    kind: 'storageState',
    path: 'C:/Temp/qa-state.json',
    credentials: { username: 'qa-user', password: 'qa-test-secret' },
    mode: 'api',
  });

  const credentials = resolveAuthentication({ PGDCN_QA_USERNAME: ' qa-user ', PGDCN_QA_PASSWORD: '  qa-test-secret  ' });
  assert.equal(credentials.kind, 'credentials');
  assert.equal(credentials.username, 'qa-user');
  assert.equal(credentials.password, '  qa-test-secret  ');
  assert.equal(credentials.mode, 'api');

  const uiSmoke = resolveAuthentication({
    PGDCN_QA_AUTH_MODE: 'ui',
    PGDCN_QA_USERNAME: 'qa-user',
    PGDCN_QA_PASSWORD: 'qa-test-secret',
  });
  assert.equal(uiSmoke.mode, 'ui');
  assert.throws(() => resolveAuthentication({ PGDCN_QA_AUTH_MODE: 'unknown' }), /PGDCN_QA_AUTH_MODE/i);
  assert.throws(() => resolveAuthentication({ PGDCN_QA_AUTH_MODE: 'ui', PGDCN_QA_STORAGE_STATE: 'C:/Temp/state.json' }), /UI smoke/i);
});

test('requires an authenticated session with a role and matching department scope', () => {
  const session = {
    status: 200,
    payload: {
      authenticated: true,
      user: { systemRole: 'staff', departmentScopes: ['PCN'], pgdRole: 'PGD_TECHNICAL' },
    },
  };
  assert.equal(assertAuthenticatedSession(session, 'PCN'), 'staff');
  assert.equal(assertAuthenticatedSession({
    status: 200,
    payload: { authenticated: true, user: { systemRole: 'admin', departmentScopes: ['PGD'] } },
  }, 'PGD'), 'admin');
  assert.throws(() => assertAuthenticatedSession({ status: 401, payload: {} }, 'PCN'), /HTTP 401/i);
  assert.throws(() => assertAuthenticatedSession({
    status: 200,
    payload: { authenticated: false, user: { systemRole: 'staff', departmentScopes: ['PCN'] } },
  }, 'PCN'), /chưa xác thực/i);
  assert.throws(() => assertAuthenticatedSession({
    status: 200,
    payload: { authenticated: true, user: { systemRole: 'staff', departmentScopes: ['PCN'] } },
  }, 'PGD'), /không có scope PGD/i);
  assert.throws(() => assertAuthenticatedSession({
    status: 200,
    payload: { authenticated: true, user: { systemRole: 'staff', departmentScopes: ['PGD'] } },
  }, 'PGD'), /không có role PGD phù hợp/i);
});

test('accepts only explicitly supplied safe PCN and PGD dossier IDs', () => {
  assert.deepEqual(collectDossierTargets({
    PGDCN_QA_PCN_DOSSIER_ID: 'pcn-123',
    PGDCN_QA_PGD_DOSSIER_ID: 'pgd_456',
  }), [
    { department: 'PCN', id: 'pcn-123', pathname: '/pgdcn/pcn/dossiers/pcn-123' },
    { department: 'PGD', id: 'pgd_456', pathname: '/pgdcn/pgd/dossiers/pgd_456' },
  ]);
  assert.throws(() => collectDossierTargets({}), /cần truyền ít nhất một mã hồ sơ QA/i);
  assert.throws(() => collectDossierTargets({ PGDCN_QA_PCN_DOSSIER_ID: '../other' }), /không an toàn/i);
});

test('requires seven workflow stages and the dossier document action surface', () => {
  assert.deepEqual(assertDossierUiEvidence({ department: 'PCN', stageCount: 7, documentPanel: true, documentRows: 2 }), {
    department: 'PCN',
    stageCount: 7,
    documentRows: 2,
  });
  assert.throws(() => assertDossierUiEvidence({ department: 'PGD', stageCount: 6, documentPanel: true }), /chỉ tìm thấy 6\/7 giai đoạn/i);
  assert.throws(() => assertDossierUiEvidence({ department: 'PCN', stageCount: 7, documentPanel: false, documentRows: 0 }), /không thấy bảng thao tác tài liệu/i);
});

test('keeps storage state and screenshot paths outside the repository', () => {
  assert.equal(assertPathOutsideRepository('C:/Temp/qa-state.json', 'C:/repo', 'storage state'), resolve('C:/Temp/qa-state.json'));
  assert.throws(() => assertPathOutsideRepository('C:/repo/tmp/qa-state.json', 'C:/repo', 'storage state'), /phải nằm ngoài repo/i);
});
