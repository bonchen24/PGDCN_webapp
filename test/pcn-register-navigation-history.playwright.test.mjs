import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;

const SYNTHETIC_DOSSIER = {
  id: 'qa-pcn-1',
  dossierCode: 'DEMO-PCN-001',
  proposalId: 'qa-prop-1',
  fieldCodes: ['KN'],
  method: '1',
  status: 'IN_PROGRESS',
  ownerUsername: 'synthetic_admin',
  customerSnapshot: {
    name: 'Khách hàng PCN QA',
    address: 'Hà Nội',
    taxId: '0101234567',
  },
  labRequestIds: [],
  returnedResultIds: [],
  sampleLotIds: [],
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

const SYNTHETIC_PROPOSAL = {
  id: 'qa-prop-1',
  proposalCode: 'PROP-QA-001',
  channel: 'DIRECT',
  status: 'CONVERTED',
  dossierId: 'qa-pcn-1',
  productName: 'Sản phẩm mẫu QA',
  quantity: 1,
  fieldCodes: ['KN'],
  receivedAt: '2026-10-27T08:00:00.000Z',
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
  customerSnapshot: {
    name: 'Khách hàng PCN QA',
    address: 'Hà Nội',
    taxId: '0101234567',
  },
};

const SYNTHETIC_USER = {
  username: 'synthetic_admin',
  name: 'Synthetic Admin',
  role: 'admin',
  systemRole: 'admin',
  departmentRoleCode: 'GD',
  fieldCodes: ['KN'],
  active: true,
  departmentScopes: ['PCN', 'PGD'],
  pgdRole: 'PGD_LEAD',
};

test('F4 PCN register navigation preserves target section query and browser history', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const targetUrl = new URL('/pgdcn/pcn/dossiers/qa-pcn-1', base).toString();
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
                user: SYNTHETIC_USER,
              }),
            });
            return;
          }

          if (reqUrl.pathname === '/api/db/certificationDossiers') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [SYNTHETIC_DOSSIER] }),
            });
            return;
          }

          if (reqUrl.pathname === '/api/db/certificationProposals') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [SYNTHETIC_PROPOSAL] }),
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

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the synthetic dossier detail to load and show DEMO-PCN-001
    const dossierCodeElement = page.getByText('DEMO-PCN-001').first();
    await dossierCodeElement.waitFor({ state: 'visible', timeout: 15000 });

    // Click visible shell menu button 'Sổ dữ liệu PCN'
    const registerNavButton = page.getByRole('button', { name: 'Sổ dữ liệu PCN' });
    await registerNavButton.waitFor({ state: 'visible', timeout: 5000 });
    await registerNavButton.click();

    // Wait for route transition away from /dossiers/
    await page.waitForURL((url) => !url.pathname.includes('/dossiers/'), { timeout: 10000 });
    await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 10000 });

    // Assert landing screen has heading 'Sổ tổng hợp PCN'
    const operationsHeading = page.getByRole('heading', { name: 'Sổ tổng hợp PCN' });
    const hasOperationsHeading = await operationsHeading.isVisible().catch(() => false);
    assert.equal(
      hasOperationsHeading,
      true,
      'Landing screen must display heading "Sổ tổng hợp PCN"',
    );

    // Assert URL preserves target section=operations query
    const operationsUrl = new URL(page.url());
    assert.equal(
      operationsUrl.pathname,
      '/pgdcn/pcn',
      'Expected URL pathname to be /pgdcn/pcn',
    );
    assert.equal(
      operationsUrl.searchParams.get('section'),
      'operations',
      'Expected URL query to preserve target section=operations',
    );

    // Exercise browser back to the same dossier detail
    await page.goBack();
    await page.waitForURL((url) => url.pathname.includes('/dossiers/qa-pcn-1'), { timeout: 10000 });
    const dossierCodeBack = page.getByText('DEMO-PCN-001').first();
    await dossierCodeBack.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await dossierCodeBack.isVisible().catch(() => false),
      true,
      'Browser back must restore the dossier detail view for DEMO-PCN-001',
    );

    // Exercise browser forward to Sổ tổng hợp PCN again
    await page.goForward();
    await page.waitForURL((url) => !url.pathname.includes('/dossiers/'), { timeout: 10000 });
    const forwardOperationsHeading = page.getByRole('heading', { name: 'Sổ tổng hợp PCN' });
    await forwardOperationsHeading.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await forwardOperationsHeading.isVisible().catch(() => false),
      true,
      'Browser forward must restore landing screen with heading "Sổ tổng hợp PCN"',
    );
    const forwardUrl = new URL(page.url());
    assert.equal(
      forwardUrl.searchParams.get('section'),
      'operations',
      'Browser forward must preserve target section=operations',
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
