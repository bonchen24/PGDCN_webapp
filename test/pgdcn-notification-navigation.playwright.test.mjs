import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;

const VIEWPORT_CASES = [
  { mode: 'desktop', width: 1280, height: 900, isMobile: false },
  { mode: 'mobile', width: 390, height: 844, isMobile: true },
];

test('F1 notification panel regression: closes after sidebar section navigation', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const targetUrl = new URL('/pgdcn/pcn', base).toString();
  const baseOrigin = base.origin;

  const apiMutations = [];
  const externalRequests = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const { mode, width, height, isMobile } of VIEWPORT_CASES) {
      const page = await browser.newPage({
        viewport: { width, height },
      });

      try {
        await page.route('**/*', async (route) => {
          const req = route.request();
          const reqUrl = new URL(req.url());
          const method = req.method().toUpperCase();

          if (reqUrl.origin !== baseOrigin) {
            if (reqUrl.hostname.includes('googleapis.com') || reqUrl.hostname.includes('gstatic.com')) {
              await route.abort('blockedbyclient');
              return;
            }
            externalRequests.push({ mode, url: req.url(), method });
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

              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),
              });
              return;
            }

            apiMutations.push({ mode, url: req.url(), method });
            await route.abort('blockedbyclient');
            return;
          }

          await route.continue();
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        const bell = page.getByRole('button', { name: 'Thông báo phòng' });
        let menuTrigger;

        if (isMobile) {
          menuTrigger = page.getByRole('button', { name: 'Mở menu phòng' });
          await menuTrigger.waitFor({ state: 'visible', timeout: 15000 });
          await menuTrigger.click();

          // Open the notification dialog
          await bell.dispatchEvent('click');
        } else {
          await bell.waitFor({ state: 'visible', timeout: 15000 });
          await bell.click();
        }

        const notificationDialog = page.getByRole('dialog', { name: 'Danh sách thông báo phòng' });
        await notificationDialog.waitFor({ state: 'visible', timeout: 5000 });

        const sidebarItem = page.getByRole('button', { name: 'Sổ dữ liệu PCN' });
        await sidebarItem.waitFor({ state: 'visible', timeout: 5000 });
        await sidebarItem.click();

        const isDialogVisible = await notificationDialog.isVisible().catch(() => false);
        assert.equal(
          isDialogVisible,
          false,
          `Notification panel (role=dialog) must be closed after sidebar section navigation (${mode})`,
        );

        const bellExpanded = await bell.getAttribute('aria-expanded');
        assert.equal(
          bellExpanded,
          'false',
          `Expected notification bell aria-expanded="false" after sidebar navigation (${mode}), but received "${bellExpanded}"`,
        );

        const destinationItem = page.getByRole('button', { name: 'Sổ dữ liệu PCN', includeHidden: true });
        const sidebarAriaCurrent = await destinationItem.getAttribute('aria-current');
        assert.equal(
          sidebarAriaCurrent,
          'page',
          `Expected destination sidebar item aria-current="page" (${mode}), but received "${sidebarAriaCurrent}"`,
        );

        if (isMobile) {
          const isMenuTriggerFocused = await menuTrigger.evaluate((el) => el === document.activeElement);
          const actualFocus = await page.evaluate(() => {
            const el = document.activeElement;
            return el
              ? {
                  tagName: el.tagName,
                  ariaLabel: el.getAttribute('aria-label'),
                  name: el.getAttribute('name'),
                  id: el.id,
                  text: el.innerText?.slice(0, 50),
                }
              : null;
          });
          assert.equal(
            isMenuTriggerFocused,
            true,
            `Mobile focus must return to the "Mở menu phòng" trigger after sidebar navigation. Actual focus: ${JSON.stringify(actualFocus)}`,
          );
        } else {
          const isSidebarFocused = await sidebarItem.evaluate((el) => el === document.activeElement);
          assert.equal(
            isSidebarFocused,
            true,
            'Selected sidebar item must be the focused element after navigation (desktop)',
          );
        }
      } finally {
        await page.close();
      }
    }

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
