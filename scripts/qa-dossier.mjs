import { execFileSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import {
  assertAuthenticatedSession,
  assertDossierUiEvidence,
  assertPathOutsideRepository,
  assertPcnAppFingerprint,
  collectDossierTargets,
  findListeningPids,
  resolveAuthentication,
  selectBaseUrl,
} from './qa-dossier-harness.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-390', width: 390, height: 844 },
];

function selectedPort(url) {
  const parsed = new URL(url);
  return Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
}

function inspectLocalListener(baseUrl) {
  const url = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname.toLowerCase())) {
    return { port: selectedPort(baseUrl), processes: ['remote listener'] };
  }

  let netstat;
  try {
    netstat = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(`Không xác minh được process đang nghe cổng ${selectedPort(baseUrl)} bằng netstat.exe.`);
  }

  const port = selectedPort(baseUrl);
  const pids = findListeningPids(netstat, port);
  if (pids.length === 0) {
    throw new Error(`Không tìm thấy process LISTENING trên cổng ${port}; kiểm tra PGDCN_UX_BASE_URL hoặc khởi động server bằng PORT=${port}.`);
  }

  const processes = pids.map((pid) => {
    try {
      const output = execFileSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output.match(/^"([^\"]+)"/m)?.[1] || `PID ${pid}`;
    } catch {
      return `PID ${pid}`;
    }
  });

  return { port, processes };
}

async function probeApplication(baseUrl) {
  let response;
  try {
    response = await fetch(`${baseUrl}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'text/html' },
    });
  } catch (error) {
    throw new Error(`Không kết nối được ${baseUrl}/. Kiểm tra đúng cổng (dev mặc định 1357; Docker 2357) và server đang chạy. ${error.message}`);
  }

  const html = await response.text();
  const fingerprint = assertPcnAppFingerprint({
    baseUrl,
    responseUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    html,
  });
  const listener = inspectLocalListener(baseUrl);
  return { ...fingerprint, processes: listener.processes };
}

function sessionFromPage(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/pcn-session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Preserve the HTTP status so the caller can report an actionable auth error.
    }
    return { status: response.status, payload };
  });
}

async function signInThroughUi(page, baseUrl, credentials) {
  const loginUrl = new URL('/login', `${baseUrl}/`).toString();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const usernameField = page.getByLabel('Tên đăng nhập', { exact: true });
  if (await usernameField.count()) {
    await usernameField.fill(credentials.username);
  } else {
    await page.locator('#login-username').fill(credentials.username);
  }

  const passwordField = page.getByLabel('Mật khẩu', { exact: true });
  if (await passwordField.count()) {
    await passwordField.fill(credentials.password);
  } else {
    await page.locator('#login-password').fill(credentials.password);
  }

  const loginResponse = page.waitForResponse((response) => (
    response.url() === new URL('/api/auth/pcn-session', `${baseUrl}/`).toString()
    && response.request().method() === 'POST'
  ), { timeout: 12000 });
  await page.getByRole('button', { name: /Đăng nhập/i }).click();
  const response = await loginResponse;
  if (!response.ok()) {
    throw new Error(`Đăng nhập UI QA trả HTTP ${response.status()}; xác thực không thành công.`);
  }

  await page.goto(new URL('/', `${baseUrl}/`).toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
}

function redactSecrets(message, authentication) {
  let safeMessage = String(message || '');
  if (authentication.kind === 'credentials') {
    for (const secret of [authentication.password, authentication.username]) {
      if (secret) safeMessage = safeMessage.split(secret).join('[đã ẩn]');
    }
  }
  return safeMessage;
}

async function inspectDossier(page, baseUrl, target, screenshotDirectory, consoleErrors, authentication) {
  const detailUrl = new URL(target.pathname, `${baseUrl}/`).toString();
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await assertDossierPageIsAuthenticated(page, baseUrl, target.department);

  const detailSelector = target.department === 'PCN'
    ? '[data-testid="pcn-dossier-focus-shell"]'
    : '[data-testid="pgd-dossier-focus-shell"]';
  try {
    await page.locator(detailSelector).waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    await assertDossierPageIsAuthenticated(page, baseUrl, target.department);
    throw new Error(`Không thấy trang chi tiết hồ sơ ${target.department}. Kiểm tra mã hồ sơ tồn tại và tài khoản có quyền đọc hồ sơ đó.`);
  }

  const stageSelector = target.department === 'PCN'
    ? '[data-testid="pcn-dossier-native-flow"] [data-testid="pcn-stage-tab"][aria-setsize="7"]'
    : '[data-testid="pgd-dossier-native-flow"] [role="tab"][aria-setsize="7"]';
  const documentPanelSelector = target.department === 'PCN'
    ? '[data-testid="pcn-node-work-panel"] table'
    : '[data-testid="pgd-dossier-step-work-panel"]';
  const documentRowSelector = '[data-testid^="pcn-node-document-"]';
  const stageCount = await page.locator(stageSelector).count();
  const documentPanel = await page.locator(documentPanelSelector).count() > 0;
  const documentRows = target.department === 'PCN' ? await page.locator(documentRowSelector).count() : 0;
  const evidence = assertDossierUiEvidence({
    department: target.department,
    stageCount,
    documentPanel,
    documentRows,
  });

  const overflows = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.locator(detailSelector).waitFor({ state: 'visible', timeout: 5000 });
    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    if (metrics.documentScrollWidth > metrics.documentWidth + 1 || metrics.bodyScrollWidth > metrics.documentWidth + 1) {
      overflows.push(`${viewport.width}px: document=${metrics.documentWidth}px, documentScroll=${metrics.documentScrollWidth}px, bodyScroll=${metrics.bodyScrollWidth}px`);
    }

    if (screenshotDirectory) {
      const screenshotPath = join(screenshotDirectory, `${target.department.toLowerCase()}-${viewport.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
    }

    console.log(`[REAL QA] ${target.department} ${viewport.name}: stages=${evidence.stageCount}/7, documentRows=${evidence.documentRows}, viewport=${metrics.viewportWidth}px, document=${metrics.documentWidth}px, scrollWidth=${metrics.documentScrollWidth}px, bodyScrollWidth=${metrics.bodyScrollWidth}px, consoleErrors=${consoleErrors.length}`);
  }
  return overflows;
}

async function assertDossierPageIsAuthenticated(page, baseUrl, department) {
  const expectedOrigin = new URL(baseUrl).origin;
  const currentUrl = new URL(page.url());
  if (currentUrl.origin !== expectedOrigin) {
    throw new Error(`Trang hồ sơ ${department} bị chuyển khỏi origin QA ${expectedOrigin} sang ${currentUrl.origin}.`);
  }
  const isLoginRoute = currentUrl.pathname.replace(/\/$/, '').endsWith('/login');
  const loginFormVisible = await page.locator('#login-username').isVisible().catch(() => false);
  if (isLoginRoute || loginFormVisible) {
    throw new Error(`Bị chuyển về màn hình đăng nhập khi mở hồ sơ ${department}; phiên QA đã hết hạn hoặc thiếu scope.`);
  }
}

async function main() {
  const baseUrl = selectBaseUrl();
  const authentication = resolveAuthentication();
  const targets = collectDossierTargets();
  let storageStatePath;
  if (authentication.kind === 'storageState') {
    storageStatePath = assertPathOutsideRepository(authentication.path, repositoryRoot, 'storage state');
    try {
      await access(storageStatePath);
    } catch {
      throw new Error('Không đọc được file PGDCN_QA_STORAGE_STATE. Kiểm tra file storage state Playwright đáng tin cậy đã tồn tại và có quyền đọc.');
    }
  }

  const screenshotSetting = String(process.env.PGDCN_QA_SCREENSHOT_DIR || '').trim();
  const screenshotDirectory = screenshotSetting
    ? assertPathOutsideRepository(screenshotSetting, repositoryRoot, 'thư mục screenshot')
    : undefined;
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });

  const app = await probeApplication(baseUrl);
  console.log(`[REAL QA] app=PGDCN origin=${app.origin} port=${app.port} listener=${app.processes.join(', ')}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new Error('Không khởi chạy được Chromium Playwright. Cài browser bằng `npx playwright install chromium`, rồi chạy lại.');
  }

  let context;
  try {
    context = await browser.newContext({
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(redactSecrets(message.text(), authentication));
    });
    page.on('pageerror', (error) => consoleErrors.push(redactSecrets(error.message, authentication)));

    if (authentication.kind === 'credentials') {
      await signInThroughUi(page, baseUrl, authentication);
    } else {
      await page.goto(new URL('/', `${baseUrl}/`).toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    const session = await sessionFromPage(page);
    const roleResults = new Map();
    for (const target of targets) {
      if (!roleResults.has(target.department)) {
        roleResults.set(target.department, assertAuthenticatedSession(session, target.department));
      }
    }
    console.log(`[REAL QA] session=authenticated departments=${[...roleResults.keys()].join(',')} roles=${[...roleResults.values()].join(',')}`);

    const overflows = [];
    for (const target of targets) {
      overflows.push(...await inspectDossier(page, baseUrl, target, screenshotDirectory, consoleErrors, authentication));
    }

    if (overflows.length > 0) throw new Error(`Phát hiện tràn ngang: ${overflows.join('; ')}`);
    if (consoleErrors.length > 0) {
      const preview = consoleErrors.slice(0, 5).join(' | ');
      throw new Error(`Có ${consoleErrors.length} lỗi console Playwright: ${preview}`);
    }

    console.log(`[REAL QA] PASS authenticated UI verification for ${targets.length} dossier(s).`);
    if (screenshotDirectory) console.log(`[REAL QA] Screenshots saved outside repo: ${screenshotDirectory}`);
  } finally {
    await context?.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[REAL QA] BLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
