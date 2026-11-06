import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qaScriptPath = resolve(repositoryRoot, 'scripts', 'qa-dossier.mjs');
const pgdcnHtml = '<!doctype html><html lang="vi"><head><title>PGDCN • TVCI</title><script src="/_next/static/chunks/app.js"></script></head><body><div id="root"></div></body></html>';
const loginHtml = `<!doctype html>
<html lang="vi">
  <body>
    <form id="login-form">
      <label for="login-username">Tên đăng nhập</label>
      <input id="login-username" name="username" type="text" required>
      <label for="login-password">Mật khẩu</label>
      <input id="login-password" name="password" type="password" required>
      <label><input type="checkbox"><span>Lưu mật khẩu</span></label>
      <button type="submit">Đăng nhập hệ thống</button>
    </form>
    <script>
      document.querySelector('#login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.querySelector('#login-username').value;
        const password = document.querySelector('#login-password').value;
        await fetch('/api/auth/pcn-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
      });
    </script>
  </body>
</html>`;

function readRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function runQaScript(env, testPassword) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [qaScriptPath], {
      cwd: repositoryRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      const safeOutput = output
        .split(testPassword).join('[đã ẩn]')
        .split('luongxuanhung').join('[đã ẩn username]');
      resolveRun({ exitCode, output, safeOutput });
    });
  });
}

test('qa dossier fills labeled login fields, observes the POST callback, and stays on login after 401', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  let authPost;
  let rootGetCount = 0;
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      rootGetCount += 1;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/login') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(loginHtml);
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      let body = {};
      try {
        body = JSON.parse(await readRequestBody(request));
      } catch {
        // The captured fields stay as booleans so test output cannot expose the submitted value.
      }
      authPost = {
        method: request.method,
        path: requestUrl.pathname,
        usernameMatches: body.username === 'luongxuanhung',
        passwordMatches: body.password === testPassword,
      };
      response.writeHead(401, { 'content-type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ error: 'Tài khoản hoặc mật khẩu không chính xác.' }));
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: baseUrl,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: '',
    PGDCN_QA_SCREENSHOT_DIR: '',
    PGDCN_QA_AUTH_MODE: 'ui',
  };
  const result = await runQaScript(env, testPassword);

  assert.equal(result.exitCode, 1, `mock auth must be rejected; output: ${result.safeOutput}`);
  assert.equal(result.safeOutput.includes('HTTP 401'), true, `QA script must report the POST response status; output: ${result.safeOutput}`);
  assert.equal(result.output.includes(testPassword), false, 'QA output must not expose the submitted value');
  assert.equal(authPost?.method, 'POST');
  assert.equal(authPost?.path, '/api/auth/pcn-session');
  assert.equal(authPost?.usernameMatches, true);
  assert.equal(authPost?.passwordMatches, true);
  assert.equal(rootGetCount, 1, 'a rejected POST must not trigger the post-login root navigation');
});

const dossierHtml = `<!doctype html>
<html lang="vi">
  <head><title>PGDCN • TVCI</title></head>
  <body>
    <div id="root">
      <div data-testid="pcn-dossier-focus-shell">
        <div data-testid="pcn-dossier-native-flow">
          <button data-testid="pcn-stage-tab" aria-setsize="7">1</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">2</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">3</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">4</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">5</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">6</button>
          <button data-testid="pcn-stage-tab" aria-setsize="7">7</button>
        </div>
        <div data-testid="pcn-node-work-panel">
          <table>
            <tbody>
              <tr data-testid="pcn-node-document-1"><td>Tài liệu 1</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>`;

test('qa dossier uses API login by default, shares Set-Cookie with browser context, opens dossier directly, and redacts secrets', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  const secretCookie = `pcn_session_token=${randomBytes(24).toString('base64url')}`;
  let postReceived = false;
  let getSessionCookieReceived = false;
  let dossierVisitedDirectly = false;

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const cookieHeader = request.headers.cookie || '';

    if (request.method === 'GET' && requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname.startsWith('/_next/static/')) {
      response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }).end('');
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      postReceived = true;
      const body = JSON.parse(await readRequestBody(request));
      if (body.username === 'luongxuanhung' && body.password === testPassword) {
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'set-cookie': `${secretCookie}; Path=/; HttpOnly; SameSite=Lax`,
        }).end(JSON.stringify({
          authenticated: true,
          user: { active: true, departmentScopes: ['PCN'], role: 'staff' },
        }));
        return;
      }
      response.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/auth/pcn-session') {
      if (cookieHeader.includes(secretCookie)) {
        getSessionCookieReceived = true;
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify({
          authenticated: true,
          user: { active: true, departmentScopes: ['PCN'], role: 'staff' },
        }));
        return;
      }
      response.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'no session cookie' }));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/pgdcn/pcn/dossiers/qa-fixture') {
      if (cookieHeader.includes(secretCookie)) {
        dossierVisitedDirectly = true;
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(dossierHtml);
        return;
      }
      response.writeHead(302, { Location: '/login' }).end();
      return;
    }

    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: baseUrl,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: '',
    PGDCN_QA_SCREENSHOT_DIR: '',
  };

  const result = await runQaScript(env, testPassword);
  assert.equal(result.exitCode, 0, `QA script should succeed in default API auth mode; output: ${result.safeOutput}`);
  assert.equal(postReceived, true, 'POST /api/auth/pcn-session should be invoked');
  assert.equal(getSessionCookieReceived, true, 'GET /api/auth/pcn-session from page should receive cookie');
  assert.equal(dossierVisitedDirectly, true, 'dossier page should be opened with cookie');
  assert.equal(result.safeOutput.includes('[REAL QA] PASS authenticated UI verification for 1 dossier(s)'), true);
  assert.equal(result.output.includes(testPassword), false, 'password must never appear in log');
  assert.equal(result.output.includes(secretCookie), false, 'session cookie must never appear in log');
});

test('qa dossier reports HTTP 401 on API login authentication failure and redacts secrets', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname.startsWith('/_next/static/')) {
      response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }).end('');
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      response.writeHead(401, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: 'Tài khoản hoặc mật khẩu không chính xác.' }));
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: baseUrl,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: '',
    PGDCN_QA_SCREENSHOT_DIR: '',
  };

  const result = await runQaScript(env, testPassword);
  assert.equal(result.exitCode, 1);
  assert.equal(result.safeOutput.includes('HTTP 401'), true, `must report HTTP 401; output: ${result.safeOutput}`);
  assert.equal(result.output.includes(testPassword), false, 'password must never appear in log');
});

test('qa dossier reports HTTP 403 on API login permission failure', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      response.writeHead(403, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: 'Tài khoản không có quyền truy cập.' }));
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: baseUrl,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: '',
    PGDCN_QA_SCREENSHOT_DIR: '',
  };

  const result = await runQaScript(env, testPassword);
  assert.equal(result.exitCode, 1);
  assert.equal(result.safeOutput.includes('HTTP 403'), true, `must report HTTP 403; output: ${result.safeOutput}`);
});

test('qa dossier reports scope mismatch when session lacks the target department', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  const secretCookie = `pcn_session_token=${randomBytes(24).toString('base64url')}`;
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': `${secretCookie}; Path=/; HttpOnly; SameSite=Lax`,
      }).end(JSON.stringify({
        authenticated: true,
        user: { active: true, departmentScopes: ['PGD'], systemRole: 'admin', role: 'admin' },
      }));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/api/auth/pcn-session') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify({
        authenticated: true,
        user: { active: true, departmentScopes: ['PGD'], systemRole: 'admin', role: 'admin' },
      }));
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: baseUrl,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: '',
    PGDCN_QA_SCREENSHOT_DIR: '',
  };

  const result = await runQaScript(env, testPassword);
  assert.equal(result.exitCode, 1);
  assert.match(result.safeOutput, /scope PCN/i);
});

test('qa dossier refreshes an expired external storage state exactly once and persists the trusted state', async (t) => {
  const testPassword = randomBytes(32).toString('base64url');
  const secretCookie = `pcn_session_token=${randomBytes(24).toString('base64url')}`;
  const stateDirectory = mkdtempSync(join(tmpdir(), 'pgdcn-qa-state-'));
  const storageStatePath = join(stateDirectory, 'storage-state.json');
  writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  t.after(() => rmSync(stateDirectory, { recursive: true, force: true }));

  let loginPostCount = 0;
  let sessionGetCount = 0;
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const cookieHeader = request.headers.cookie || '';
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pgdcnHtml);
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname.startsWith('/_next/static/')) {
      response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }).end('');
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/auth/pcn-session') {
      loginPostCount += 1;
      const body = JSON.parse(await readRequestBody(request));
      if (body.username === 'luongxuanhung' && body.password === testPassword) {
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'set-cookie': `${secretCookie}; Path=/; HttpOnly; SameSite=Lax`,
        }).end(JSON.stringify({ authenticated: true, user: { active: true, departmentScopes: ['PCN'], role: 'staff' } }));
        return;
      }
      response.writeHead(401).end();
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/api/auth/pcn-session') {
      sessionGetCount += 1;
      if (cookieHeader.includes(secretCookie)) {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          .end(JSON.stringify({ authenticated: true, user: { active: true, departmentScopes: ['PCN'], role: 'staff' } }));
      } else {
        response.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ authenticated: false }));
      }
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/pgdcn/pcn/dossiers/qa-fixture' && cookieHeader.includes(secretCookie)) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(dossierHtml);
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  t.after(() => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const env = {
    PATH: process.env.Path || process.env.PATH || '',
    PATHEXT: process.env.PATHEXT || '',
    SystemRoot: process.env.SystemRoot || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',
    LOCALAPPDATA: process.env.LOCALAPPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    PGDCN_UX_BASE_URL: `http://127.0.0.1:${address.port}`,
    PGDCN_QA_USERNAME: 'luongxuanhung',
    PGDCN_QA_PASSWORD: testPassword,
    PGDCN_QA_PCN_DOSSIER_ID: 'qa-fixture',
    PGDCN_QA_PGD_DOSSIER_ID: '',
    PGDCN_QA_STORAGE_STATE: storageStatePath,
  };

  const result = await runQaScript(env, testPassword);
  assert.equal(result.exitCode, 0, `expired trusted storage state should refresh once; output: ${result.safeOutput}`);
  assert.equal(loginPostCount, 1);
  assert.ok(sessionGetCount >= 2, 'the browser must observe the expired session and validate its refreshed cookie');
  const refreshedState = JSON.parse(readFileSync(storageStatePath, 'utf8'));
  assert.equal(refreshedState.cookies.some((cookie) => cookie.name === 'pcn_session_token'), true);
  assert.equal(result.output.includes(testPassword), false);
  assert.equal(result.output.includes(secretCookie), false);
});
