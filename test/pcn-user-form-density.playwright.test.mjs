import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;
const artifactRoot = resolve('docs/ux-audit/artifacts/density/next-batch/d12');
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
];

function emptyPgdBootstrap() {
  return {
    customers: [], users: [], catalog: [], requests: [], assignments: [], fieldInspections: [], samples: [],
    labRequests: [], labResults: [], templates: [], documentTemplates: [], reports: [], certificates: [],
    approvals: [], dossierDocuments: [], documents: [], inspectionPlans: [], caseEvents: [],
    fieldActivityLogs: [], labResultReviews: [], dossierIndexes: [], calibrationInstruments: [],
    workflowTemplates: [],
  };
}

async function installUserFormRoutes(page, origin, audit) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (url.origin !== origin) {
      audit.externalRequests.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (method !== 'GET') {
      audit.apiMutations.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }
    if (url.pathname === '/api/auth/pcn-session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        authenticated: true,
        user: {
          username: 'synthetic_admin', name: 'Synthetic QA Admin', role: 'admin', systemRole: 'admin',
          departmentRoleCode: 'UNASSIGNED', fieldCodes: ['QC4', 'QC9'], active: true,
          departmentScopes: ['PCN', 'PGD'], pgdRole: 'PGD_ADMIN',
        },
      }) });
      return;
    }
    if (url.pathname === '/api/pgd/bootstrap') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPgdBootstrap()) });
      return;
    }
    if (url.pathname === '/api/pcn/users' || url.pathname === '/api/pcn/department-roles') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      return;
    }
    if (url.pathname === '/api/db-meta') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: {} }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

async function openUserForm(page, base, audit) {
  await installUserFormRoutes(page, base.origin, audit);
  await page.goto(new URL('/pgdcn/pgd', base).toString(), { waitUntil: 'domcontentloaded' });
  if (page.viewportSize().width < 1024) await page.getByRole('button', { name: 'Mở menu phòng' }).click();
  await page.getByRole('button', { name: 'Cài đặt hệ thống', exact: true }).click();
  const surface = page.getByTestId('pcn-user-management-surface');
  await surface.waitFor({ state: 'visible', timeout: 20000 });
  await surface.getByRole('button', { name: 'Thêm nhân sự', exact: true }).click();
  const form = surface.locator('form');
  await form.waitFor({ state: 'visible' });
  return { surface, form };
}

async function captureForm(page, form, phase, viewport, audit, pageErrors) {
  const formControls = form.locator('input, select, textarea');
  const surfaceControls = page.getByTestId('pcn-user-management-surface').locator('input, select, textarea');
  const metrics = await page.evaluate(({ width, height, formElement, surfaceElement }) => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height };
    };
    const form = document.querySelector(formElement);
    const surface = document.querySelector(surfaceElement);
    const details = Array.from(form?.querySelectorAll('details') || []);
    const controls = Array.from(form?.querySelectorAll('input, select, textarea') || []);
    const visible = (element) => Boolean(element.getClientRects().length && !element.closest('details:not([open])'));
    return {
      width, height,
      formTop: rect(form).top,
      formHeight: rect(form).height,
      formControlCount: controls.length,
      visibleFormControlCount: controls.filter(visible).length,
      surfaceControlCount: surface?.querySelectorAll('input, select, textarea').length ?? 0,
      disclosureCount: details.length,
      openDisclosureCount: details.filter((element) => element.open).length,
      disclosureSummaries: details.map((element) => element.querySelector(':scope > summary')?.textContent?.trim()),
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth,
      bodyScrollHeight: document.body.scrollHeight,
    };
  }, { width: viewport.width, height: viewport.height, formElement: '[data-testid="pcn-user-management-surface"] form', surfaceElement: '[data-testid="pcn-user-management-surface"]' });
  metrics.formControlCount = await formControls.count();
  metrics.surfaceControlCount = await surfaceControls.count();
  metrics.pageErrors = [...pageErrors];
  audit.viewports.push(metrics);

  const directory = resolve(artifactRoot, phase);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `admin-${viewport.width}x${viewport.height}.png`), animations: 'disabled', fullPage: true });
  return metrics;
}

test('D12 user creation form has clear identity, permission, and supplementary disclosure groups', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const phase = process.env.PGDCN_DENSITY_PHASE === 'before' ? 'before' : 'after';
  const audit = { apiMutations: [], externalRequests: [], viewports: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const { form } = await openUserForm(page, base, audit);
      await page.waitForTimeout(80);
      await captureForm(page, form, phase, viewport, audit, pageErrors);
      await page.close();
    }

    const directory = resolve(artifactRoot, phase);
    await writeFile(resolve(directory, 'metrics.json'), `${JSON.stringify({ phase, capturedAt: new Date().toISOString(), ...audit }, null, 2)}\n`, 'utf8');
    assert.deepEqual(audit.apiMutations, [], `Expected no API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected no external requests: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.viewports.every((item) => item.pageErrors.length === 0), `Expected no browser runtime errors: ${JSON.stringify(audit.viewports)}`);
    assert.ok(audit.viewports.every((item) => !item.horizontalOverflow), `Expected no horizontal body overflow: ${JSON.stringify(audit.viewports)}`);
    assert.ok(audit.viewports.every((item) => item.disclosureCount === 3), `Expected three progressive-disclosure groups: ${JSON.stringify(audit.viewports)}`);
    assert.ok(audit.viewports.every((item) => item.disclosureSummaries.some((text) => text.includes('Định danh & đăng nhập'))), 'Identity and login group must be present');
    assert.ok(audit.viewports.every((item) => item.disclosureSummaries.some((text) => text.includes('Quyền & phạm vi nghiệp vụ'))), 'Permissions and business scope group must be present');
    assert.ok(audit.viewports.every((item) => item.disclosureSummaries.some((text) => text.includes('Thông tin bổ sung'))), 'Supplementary information group must be present');
  } finally {
    await browser.close();
  }
});

test('D12 disclosure state preserves permissions and reports missing username with focus', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const audit = { apiMutations: [], externalRequests: [], viewports: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const { surface, form } = await openUserForm(page, base, audit);
    const identity = form.getByTestId('user-form-identity');
    const permissions = form.getByTestId('user-form-permissions');
    const additional = form.getByTestId('user-form-additional');
    assert.equal(await identity.evaluate((element) => element.open), true, 'Identity section is initially open');
    assert.equal(await permissions.evaluate((element) => element.open), false, 'Permission section starts collapsed');
    assert.equal(await additional.evaluate((element) => element.open), false, 'Additional section starts collapsed');
    assert.equal(await form.getByTestId('user-form-identity-state').textContent(), 'Đang mở');
    assert.equal(await form.getByTestId('user-form-permissions-state').textContent(), 'Mở để xem');
    await identity.locator(':scope > summary').click();
    assert.equal(await identity.evaluate((element) => element.open), true, 'Required identity fields stay visible while empty');

    const permissionSummary = permissions.locator(':scope > summary');
    await permissionSummary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await permissions.evaluate((element) => element.open), true, 'Keyboard opens the permission group');
    await form.getByTestId('user-form-permissions-state').getByText('Đang mở', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await form.getByTestId('user-form-permissions-state').textContent(), 'Đang mở');
    const pgdScope = permissions.getByRole('checkbox', { name: 'PGD' });
    await pgdScope.check();
    const pgdRole = permissions.getByRole('combobox', { name: 'Vai trò nghiệp vụ PGD' });
    assert.equal(await pgdRole.inputValue(), 'PGD_FIELD_INSPECTOR');
    assert.equal(await form.locator('input, select, textarea').count(), 16, 'All 16 account form controls are present after PGD scope is added');

    await permissionSummary.click();
    assert.equal(await permissions.evaluate((element) => element.open), false, 'Permission group closes');
    await form.getByTestId('user-form-permissions-state').getByText('Mở để xem', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await form.getByTestId('user-form-permissions-state').textContent(), 'Mở để xem');
    await permissionSummary.click();
    assert.equal(await permissions.evaluate((element) => element.open), true, 'Permission group reopens');
    await form.getByTestId('user-form-permissions-state').getByText('Đang mở', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await form.getByTestId('user-form-permissions-state').textContent(), 'Đang mở');
    assert.equal(await pgdScope.isChecked(), true, 'PGD scope selection is preserved');
    assert.equal(await pgdRole.inputValue(), 'PGD_FIELD_INSPECTOR', 'PGD role selection is preserved');

    const additionalSummary = additional.locator(':scope > summary');
    await additionalSummary.click();
    await form.getByTestId('user-form-additional-state').getByText('Đang mở', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await form.getByTestId('user-form-additional-state').textContent(), 'Đang mở');
    const phone = additional.getByRole('textbox', { name: 'Số điện thoại' });
    await phone.fill('0900000000');
    await additionalSummary.click();
    await additionalSummary.click();
    assert.equal(await phone.inputValue(), '0900000000', 'Supplementary information is preserved after closing and reopening');

    const name = identity.getByRole('textbox', { name: 'Họ và tên' });
    await name.fill('Synthetic QA User');
    await form.getByRole('button', { name: 'Thêm nhân sự', exact: true }).click();
    await page.getByText('Vui lòng nhập tên đăng nhập và họ tên.').waitFor({ state: 'visible' });
    assert.equal(await identity.getByRole('textbox', { name: 'Tên đăng nhập' }).evaluate((element) => document.activeElement === element), true, 'Missing username validation moves focus to the username field');
    assert.equal(await page.getByTestId('pcn-user-management-surface').locator('input, select, textarea').count(), 19, 'The whole surface contains 16 form controls plus three list filters');
    const permissionStateMetrics = await page.evaluate(() => {
      const form = document.querySelector('[data-testid="pcn-user-management-surface"] form');
      const surface = document.querySelector('[data-testid="pcn-user-management-surface"]');
      const visible = (element) => Boolean(element.getClientRects().length && !element.closest('details:not([open])'));
      const controls = Array.from(form?.querySelectorAll('input, select, textarea') || []);
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        formControlCount: controls.length,
        visibleFormControlCount: controls.filter(visible).length,
        surfaceControlCount: surface?.querySelectorAll('input, select, textarea').length ?? 0,
        openGroups: Array.from(form?.querySelectorAll('details[open]') || []).map((element) => element.querySelector(':scope > summary')?.textContent?.trim()),
        closedGroups: Array.from(form?.querySelectorAll('details:not([open])') || []).map((element) => element.querySelector(':scope > summary')?.textContent?.trim()),
        focusedInputLabel: document.activeElement?.getAttribute('aria-label') || document.activeElement?.getAttribute('name') || null,
        validationMessageVisible: document.body.innerText.includes('Vui lòng nhập tên đăng nhập và họ tên.'),
        horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth,
      };
    });
    assert.equal(permissionStateMetrics.formControlCount, 16);
    assert.equal(permissionStateMetrics.surfaceControlCount, 19);
    assert.equal(permissionStateMetrics.horizontalOverflow, false);
    const artifactDirectory = resolve(artifactRoot, 'after');
    await mkdir(artifactDirectory, { recursive: true });
    await page.screenshot({ path: resolve(artifactDirectory, 'admin-390x844-permissions-open-validation.png'), animations: 'disabled', fullPage: true });
    await writeFile(resolve(artifactDirectory, 'permission-state-metrics.json'), `${JSON.stringify({ capturedAt: new Date().toISOString(), ...permissionStateMetrics }, null, 2)}\n`, 'utf8');
    assert.deepEqual(pageErrors, [], `Expected no browser errors: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(audit.apiMutations, [], `Expected no API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected no external requests: ${JSON.stringify(audit.externalRequests)}`);
    await page.close();
  } finally {
    await browser.close();
  }
});
