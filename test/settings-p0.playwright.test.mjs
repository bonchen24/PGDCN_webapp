import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.PGDCN_TEST_BASE_URL || 'http://127.0.0.1:2365';
const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../qa-artifacts/settings-p0');

function userFor(role) {
  const shared = {
    username: `synthetic-${role}`,
    name: `Synthetic ${role}`,
    active: true,
    departmentScopes: ['PCN'],
    professionalRoleCodes: [],
    fieldCodes: [],
    departmentRoleCode: 'GENERAL',
  };

  if (role === 'admin') {
    return { ...shared, role: 'admin', systemRole: 'admin', departmentScopes: ['PCN', 'PGD'] };
  }
  if (role === 'manager' || role === 'manager-pcn-only') {
    return {
      ...shared,
      role: 'user',
      systemRole: 'staff',
      managementRoleCode: 'DEPARTMENT_HEAD',
      departmentScopes: role === 'manager' ? ['PCN', 'PGD'] : ['PCN'],
    };
  }
  if (role === 'viewer') {
    return { ...shared, role: 'viewer', systemRole: 'viewer' };
  }
  return { ...shared, role: 'user', systemRole: 'staff', managementRoleCode: 'NONE' };
}

async function openSettings(browser, role, width, backupRequests, errors, backupStatus = 200) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  let sessionRequests = 0;
  const syntheticDirectory = [
    { username: 'synthetic-admin', name: 'Synthetic Admin', role: 'admin', systemRole: 'admin', managementRoleCode: 'NONE', departmentScopes: ['PCN', 'PGD'], active: true, fieldCodes: [], professionalRoleCodes: [] },
    { username: 'synthetic-leader', name: 'Synthetic Leader', role: 'user', systemRole: 'staff', managementRoleCode: 'DEPARTMENT_HEAD', departmentScopes: ['PCN', 'PGD'], active: true, fieldCodes: [], professionalRoleCodes: [] },
    { username: 'synthetic-staff', name: 'Synthetic Staff', role: 'user', systemRole: 'staff', managementRoleCode: 'NONE', departmentScopes: ['PCN'], active: true, fieldCodes: [], professionalRoleCodes: [] },
  ];

  page.on('pageerror', (error) => errors.push(`${role}: ${error.message}`));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/pcn-session' && request.method() === 'GET') {
      sessionRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, user: userFor(role) }),
      });
      return;
    }

    if (url.pathname.startsWith('/api/backups')) {
      backupRequests.push({ role, method: request.method() });
      if (url.pathname !== '/api/backups' || request.method() !== 'GET') {
        await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Read-only QA route' }) });
        return;
      }
      await route.fulfill({
        status: backupStatus,
        contentType: 'application/json',
        body: JSON.stringify(backupStatus === 200 ? { items: [], pgToolAvailable: false } : { error: `Synthetic HTTP ${backupStatus}` }),
      });
      return;
    }

    if (url.pathname === '/api/pcn/users' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: syntheticDirectory }) });
      return;
    }

    // Keep all data reads synthetic. No request reaches a real API or database.
    if (url.pathname === '/api/pgd/bootstrap') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.pathname.startsWith('/api/db/') || url.pathname.startsWith('/api/pcn/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const response = await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${role} settings route should render successfully`);
  if (role === 'staff' || role === 'viewer' || role === 'manager-pcn-only') {
    await page.getByText('Tài khoản hiện tại không có quyền xem Cài đặt hệ thống.').waitFor();
  } else {
    await page.getByRole('heading', { name: 'Cài đặt hệ thống' }).waitFor();
    await page.locator('.pcn-page-surface > header h1').waitFor();
  }

  return {
    context,
    page,
    getSessionRequests: () => sessionRequests,
  };
}

async function verifySessionRedirectAndRetry(browser) {
  const expiredContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 900 } });
  const expiredPage = await expiredContext.newPage();
  let expiredRequests = 0;
  await expiredPage.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/auth/pcn-session') {
      expiredRequests += 1;
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthenticated' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await expiredPage.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
  await expiredPage.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('reason') === 'session-expired');
  await expiredPage.getByRole('status').getByText('Phiên đăng nhập hết hạn').waitFor();
  assert.equal(new URL(expiredPage.url()).searchParams.get('returnTo'), '/settings');
  assert.equal(expiredRequests, 1, '401 should not trigger an automatic session retry');

  const retryContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 900 } });
  const retryPage = await retryContext.newPage();
  let retryRequests = 0;
  await retryPage.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/auth/pcn-session') {
      retryRequests += 1;
      if (retryRequests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic unavailable' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, user: userFor('admin') }) });
      }
      return;
    }
    if (new URL(route.request().url()).pathname.startsWith('/api/db/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await retryPage.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
  await retryPage.getByRole('heading', { name: 'Không thể xác thực phiên làm việc' }).waitFor();
  assert.equal(retryRequests, 1, 'network/server errors should not auto retry');
  await retryPage.getByRole('button', { name: 'Thử lại' }).click();
  await retryPage.getByRole('heading', { name: 'Cài đặt hệ thống' }).waitFor();
  assert.equal(retryRequests, 2, 'one manual retry should issue one new session request');

  await expiredContext.close();
  await retryContext.close();
}

test('settings roles, backup gating, keyboard access, and responsive widths', { timeout: 120_000 }, async () => {
  await mkdir(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const backupRequests = [];
  const pageErrors = [];
  const contexts = [];

  try {
    const admin = await openSettings(browser, 'admin', 1366, backupRequests, pageErrors);
    contexts.push(admin.context);

    assert.equal(admin.getSessionRequests(), 1, 'workspace mount should issue one session request');
    assert.equal(backupRequests.length, 0, 'admin opening Settings must not fetch backup data before selecting its tab');
    await admin.page.getByRole('tablist', { name: 'Phân hệ cài đặt hệ thống' }).waitFor();
    await admin.page.getByRole('tab', { name: 'Nhân sự & phân quyền' }).waitFor();
    await admin.page.screenshot({ path: path.join(artifactDir, 'admin-personnel-1366.png'), fullPage: true });
    await admin.page.getByRole('row').filter({ hasText: 'synthetic-admin' }).getByRole('button', { name: 'Sửa' }).waitFor();

    for (const width of [320, 390, 1366, 1440]) {
      await admin.page.setViewportSize({ width, height: 900 });
      await admin.page.waitForTimeout(100);
      const overflow = await admin.page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(overflow.document <= overflow.viewport, `document overflow at ${width}px: ${JSON.stringify(overflow)}`);
      assert.ok(overflow.body <= overflow.viewport, `body overflow at ${width}px: ${JSON.stringify(overflow)}`);
      if (width === 320 || width === 390) {
        assert.equal(await admin.page.getByTestId('mobile-user-card-synthetic-admin').isVisible(), true, `mobile account cards should be visible at ${width}px`);
        assert.equal(await admin.page.locator('[data-testid="user-directory-table"]').isVisible(), false, `wide account table should be hidden at ${width}px`);
        await admin.page.screenshot({ path: path.join(artifactDir, `admin-personnel-${width}.png`), fullPage: true });
      }
    }

    const personnelTab = admin.page.getByRole('tab', { name: 'Nhân sự & phân quyền' });
    await personnelTab.focus();
    await personnelTab.press('ArrowRight');
    const backupTab = admin.page.getByRole('tab', { name: 'Sao lưu & dữ liệu' });
    await assert.doesNotReject(() => backupTab.waitFor({ state: 'visible' }));
    await backupTab.waitFor({ state: 'visible' });
    await admin.page.waitForFunction(() => document.querySelector('#tab-backup')?.getAttribute('aria-selected') === 'true');
    await admin.page.waitForFunction(() => document.querySelector('[role="tabpanel"]')?.textContent?.includes('Sao lưu'));
    await admin.page.waitForFunction(() => document.querySelector('#panel-backup')?.hidden === false);
    await admin.page.waitForFunction(() => document.querySelector('[role="alert"]') || document.querySelector('table'));
    assert.equal(backupRequests.length, 1, 'opening backup tab should make exactly one read-only GET');
    assert.deepEqual(backupRequests, [{ role: 'admin', method: 'GET' }], 'QA must never invoke backup mutations');
    await admin.page.screenshot({ path: path.join(artifactDir, 'admin-backup-1366.png'), fullPage: true });

    await personnelTab.click();
    await backupTab.click();
    await admin.page.waitForTimeout(150);
    assert.equal(backupRequests.length, 1, 'hiding and reopening the panel must not refetch backups');

    const manager = await openSettings(browser, 'manager', 390, backupRequests, pageErrors);
    contexts.push(manager.context);
    assert.equal(manager.getSessionRequests(), 1);
    assert.equal(await manager.page.getByRole('tablist').count(), 0, 'manager sees no admin tablist');
    assert.equal(await manager.page.locator('#panel-backup').count(), 0, 'manager never mounts backup controls');
    assert.equal(await manager.page.locator('#panel-personnel[role="tabpanel"]').count(), 0, 'manager panel must not reference a hidden admin tab');
    const managerAdminCard = manager.page.getByTestId('mobile-user-card-synthetic-admin');
    const managerLeaderCard = manager.page.getByTestId('mobile-user-card-synthetic-leader');
    const managerStaffCard = manager.page.getByTestId('mobile-user-card-synthetic-staff');
    await managerAdminCard.waitFor();
    await managerLeaderCard.waitFor();
    assert.equal(await managerAdminCard.getByRole('button').count(), 0, 'manager cannot mutate the Admin account');
    assert.equal(await managerLeaderCard.getByRole('button').count(), 0, 'manager cannot mutate a leadership account');
    await managerStaffCard.getByRole('button', { name: 'Sửa' }).waitFor();
    await manager.page.screenshot({ path: path.join(artifactDir, 'manager-personnel-390.png'), fullPage: true });

    await manager.page.getByRole('button', { name: 'Thêm nhân sự' }).click();
    const managerPermissions = manager.page.getByTestId('user-form-permissions');
    if (!(await managerPermissions.evaluate((element) => element.open))) {
      await managerPermissions.locator('summary').click();
    }
    assert.equal(await manager.page.getByLabel('Vai trò hệ thống').locator('option[value="admin"]').count(), 0, 'manager UI must not offer Admin assignment');
    assert.deepEqual(
      await manager.page.getByLabel('Chức danh quản lý').locator('option').evaluateAll((options) => options.map((option) => option.value)),
      ['NONE'],
      'manager UI must not offer a leadership promotion',
    );

    for (const role of ['staff', 'viewer', 'manager-pcn-only']) {
      const denied = await openSettings(browser, role, 1366, backupRequests, pageErrors);
      contexts.push(denied.context);
      assert.equal(denied.getSessionRequests(), 1);
      assert.equal(await denied.page.getByRole('tablist').count(), 0, `${role} must not see tabs`);
      assert.equal(await denied.page.locator('#panel-backup').count(), 0, `${role} must not mount backup controls`);
      assert.match(await denied.page.locator('.pcn-page-surface').innerText(), /không có quyền xem Cài đặt hệ thống/i);
      await denied.page.screenshot({ path: path.join(artifactDir, `${role}-denied-1366.png`), fullPage: true });
    }

    assert.deepEqual(backupRequests, [{ role: 'admin', method: 'GET' }], 'only the authorized admin tab may read backups');
    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);

    for (const status of [401, 403, 404]) {
      const errorRequests = [];
      const errorAdmin = await openSettings(browser, 'admin', 390, errorRequests, pageErrors, status);
      contexts.push(errorAdmin.context);
      await errorAdmin.page.getByRole('tab', { name: 'Sao lưu & dữ liệu' }).click();
      const alert = errorAdmin.page.locator('#panel-backup [role="alert"]').first();
      await alert.waitFor();
      assert.match(await alert.innerText(), new RegExp(`HTTP ${status}`));
      assert.equal(await errorAdmin.page.locator('#panel-backup button').filter({ hasText: 'Thử lại' }).count(), 1, 'retry action must not be duplicated in the table');
      await errorAdmin.page.screenshot({ path: path.join(artifactDir, `admin-backup-${status}-390.png`), fullPage: true });
      await alert.getByRole('button', { name: 'Thử lại' }).click();
      await errorAdmin.page.waitForFunction((expected) => document.querySelectorAll('#panel-backup [role="alert"]').length > 0 && document.querySelector('#panel-backup [role="alert"]')?.textContent?.includes(`HTTP ${expected}`), status);
      assert.deepEqual(errorRequests, [{ role: 'admin', method: 'GET' }, { role: 'admin', method: 'GET' }]);
    }

    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);
    await verifySessionRedirectAndRetry(browser);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await browser.close();
  }
});
