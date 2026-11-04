import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const baseUrl = process.env.PGDCN_UX_BASE_URL;

function emptyPgdBootstrap() {
  return {
    customers: [], users: [], catalog: [], requests: [], assignments: [], fieldInspections: [], samples: [],
    labRequests: [], labResults: [], templates: [], documentTemplates: [], reports: [], certificates: [],
    approvals: [], dossierDocuments: [], documents: [], inspectionPlans: [], caseEvents: [],
    fieldActivityLogs: [], labResultReviews: [], dossierIndexes: [], calibrationInstruments: [], workflowTemplates: [],
  };
}

async function installReadOnlyRoutes(page, origin) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      await route.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (request.method().toUpperCase() !== 'GET') {
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

test('PCN intake modal returns keyboard focus to its create button after Escape', {
  skip: !baseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(baseUrl || 'http://localhost:1357');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installReadOnlyRoutes(page, base.origin);
    await page.goto(new URL('/pgdcn/pcn', base).toString(), { waitUntil: 'domcontentloaded' });

    const opener = page.getByRole('button', { name: 'Nhận Phiếu / Tạo Đề nghị', exact: true });
    await opener.waitFor({ state: 'visible', timeout: 20000 });
    const openerHandle = await opener.elementHandle();
    assert.ok(openerHandle, 'PCN intake opener exists');
    await opener.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'PCN modal declares modal semantics');
    const titleId = await dialog.getAttribute('aria-labelledby');
    assert.ok(titleId && await page.locator(`#${titleId}`).isVisible(), 'PCN modal is labelled by its title');
    assert.equal(
      await openerHandle.evaluate((element) => element.isConnected),
      true,
      'The modal opener stays mounted while its dialog is open',
    );

    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction((element) => document.activeElement === element, openerHandle, { timeout: 1000 });
    assert.equal(
      await openerHandle.evaluate((element) => document.activeElement === element),
      true,
      'Keyboard focus returns to the same PCN intake opener after closing',
    );
  } finally {
    await browser.close();
  }
});

test('PGD intake keeps optional registry fields collapsed and preserves date and suggested samples', {
  skip: !baseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(baseUrl || 'http://localhost:1357');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installReadOnlyRoutes(page, base.origin);
    await page.goto(new URL('/pgdcn/pgd', base).toString(), { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Nhận Phiếu / Tạo PYC', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'PGD modal declares modal semantics');
    const titleId = await dialog.getAttribute('aria-labelledby');
    assert.ok(titleId && await page.locator(`#${titleId}`).isVisible(), 'PGD modal is labelled by its title');
    const registry = dialog.getByTestId('pgd-intake-registry-disclosure');
    assert.equal(await registry.count(), 1, 'Optional registry fields have a dedicated disclosure');
    assert.equal(await registry.evaluate((element) => element.open), false, 'Optional registry fields start collapsed');
    assert.equal(
      await registry.locator('input, select, textarea').evaluateAll((elements) => elements.some((element) => element.required)),
      false,
      'The collapsed registry section does not hide required inputs',
    );

    const scrollArea = dialog.locator('.mobile-scroll-y.overflow-y-auto');
    const collapsedHeight = await scrollArea.evaluate((element) => element.scrollHeight);
    assert.ok(collapsedHeight < 5000, `Collapsed form reduces mobile scroll length: ${collapsedHeight}px`);

    const registrySummary = registry.locator('summary');
    await registrySummary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await registry.evaluate((element) => element.open), true, 'Keyboard activates the registry disclosure');
    const receivedAt = dialog.getByRole('textbox', { name: 'Ngày tiếp nhận' });
    assert.match(await receivedAt.inputValue(), /^\d{2}\/\d{2}\/\d{4}$/, 'Date stays in dd/mm/yyyy format');

    await dialog.getByRole('button', { name: 'Thêm mẫu', exact: true }).click();
    assert.equal(await dialog.getByRole('textbox', { name: 'Mã mẫu dòng 1' }).inputValue(), 'M01');
    assert.equal(await dialog.getByRole('textbox', { name: 'Tên/mô tả mẫu dòng 1' }).inputValue(), 'Thép cuộn');
    assert.equal(await dialog.getByRole('textbox', { name: 'Đơn vị mẫu dòng 1' }).inputValue(), 'kg');
  } finally {
    await browser.close();
  }
});
