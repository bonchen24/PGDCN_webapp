import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;

test('F2 customer import preview dialog regression: dialog semantics, initial focus, focus trap, and escape key', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const targetUrl = new URL('/pgdcn', base).toString();
  const baseOrigin = base.origin;

  const apiMutations = [];
  const externalRequests = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });

    await page.route('**/*', async (route) => {
      const req = route.request();
      const reqUrl = new URL(req.url());
      const method = req.method().toUpperCase();

      if (reqUrl.origin !== baseOrigin) {
        if (reqUrl.hostname.includes('googleapis.com') || reqUrl.hostname.includes('gstatic.com')) {
          await route.abort('blockedbyclient');
          return;
        }
        externalRequests.push({ url: req.url(), method });
        await route.abort('blockedbyclient');
        return;
      }

      if (reqUrl.pathname.startsWith('/api/')) {
        if (method === 'GET') {
          if (reqUrl.pathname === '/api/auth/pcn-session') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                authenticated: true,
                user: {
                  username: 'synthetic_admin',
                  name: 'Synthetic Admin',
                  role: 'admin',
                  systemRole: 'admin',
                  departmentRoleCode: 'GD',
                  fieldCodes: ['KN'],
                  active: true,
                  departmentScopes: ['PCN', 'PGD'],
                  pgdRole: 'PGD_LEAD',
                },
              }),
            });
            return;
          }

          if (reqUrl.pathname === '/api/db-meta') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ meta: {} }),
            });
            return;
          }

          if (reqUrl.pathname.startsWith('/api/db/')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [] }),
            });
            return;
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }

        apiMutations.push({ url: req.url(), method });
        await route.abort('blockedbyclient');
        return;
      }

      await route.continue();
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên khách hàng'],
      ['Công ty QA Tổng hợp'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const workbookBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    let importTrigger = page.getByRole('button', { name: 'Nhập Excel' });
    if (!(await importTrigger.isVisible().catch(() => false))) {
      const customersNav = page.getByRole('button', { name: 'Khách hàng' });
      await customersNav.waitFor({ state: 'visible', timeout: 15000 });
      await customersNav.click();
    }
    await importTrigger.waitFor({ state: 'visible', timeout: 15000 });

    const hiddenFileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await importTrigger.click();
    await hiddenFileInput.setInputFiles({
      name: 'synthetic-customers.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbookBuffer,
    });

    const dialog = page.getByRole('dialog', { name: 'Xem trước nhập khách hàng từ Excel' });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const ariaModal = await dialog.getAttribute('aria-modal');
    assert.equal(
      ariaModal,
      'true',
      `Expected preview dialog to have aria-modal="true", but received "${ariaModal}"`,
    );

    const initialFocusedInside = await dialog.evaluate((el) => {
      return document.activeElement === el || el.contains(document.activeElement);
    });
    assert.equal(
      initialFocusedInside,
      true,
      'Dialog or an element inside dialog must receive initial focus',
    );

    const actions = await dialog.locator('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').all();
    assert.ok(actions.length >= 2, 'Dialog should contain at least two enabled action elements');

    const firstAction = actions[0];
    const lastAction = actions[actions.length - 1];

    await firstAction.focus();
    await page.keyboard.press('Shift+Tab');
    const focusedAfterShiftTab = await lastAction.evaluate((el) => el === document.activeElement);
    assert.equal(
      focusedAfterShiftTab,
      true,
      'Shift+Tab from first action must wrap focus to the last enabled dialog action',
    );

    await page.keyboard.press('Tab');
    const focusedAfterTab = await firstAction.evaluate((el) => el === document.activeElement);
    assert.equal(
      focusedAfterTab,
      true,
      'Tab from last action must wrap focus back to the first enabled dialog action',
    );

    await page.keyboard.press('Escape');

    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    const isDialogVisible = await dialog.isVisible().catch(() => false);
    assert.equal(
      isDialogVisible,
      false,
      'Preview dialog must be closed after pressing Escape',
    );

    const isTriggerFocused = await importTrigger.evaluate((el) => el === document.activeElement);
    assert.equal(
      isTriggerFocused,
      true,
      'Focus must return to the "Nhập Excel" trigger button after closing the dialog with Escape',
    );

    assert.equal(
      apiMutations.length,
      0,
      `Expected no non-GET API mutation requests, but recorded: ${JSON.stringify(apiMutations)}`,
    );

    assert.equal(
      externalRequests.length,
      0,
      `Expected no external-origin requests, but recorded: ${JSON.stringify(externalRequests)}`,
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});
