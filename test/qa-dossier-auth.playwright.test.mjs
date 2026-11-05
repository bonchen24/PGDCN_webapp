import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
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
