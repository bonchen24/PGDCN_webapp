import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;

const SINGLE_REQUEST_FIXTURE = {
  domain: 'pgd',
  id: 'qa-pgd-1',
  requestCode: 'PGD-DEMO-001',
  intakeChannel: 'DIRECT',
  requester: { name: 'Đơn vị QA' },
  customerSnapshot: { name: 'Khách hàng tổng hợp QA' },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'qa-catalog',
  productName: 'Thép cuộn QA',
  quantity: 1,
  inspectionScope: 'Kiểm tra tổng hợp',
  inspectionLocation: 'Phòng QA',
  standards: ['TCVN QA'],
  status: 'CAPABILITY_REVIEW',
  documentPointers: [],
  sampleIds: [],
  labRequestIds: [],
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
  dossierChecklist: [],
};

const SYNTHETIC_BOOTSTRAP = {
  customers: [],
  users: [],
  catalog: [],
  requests: [SINGLE_REQUEST_FIXTURE],
  assignments: [],
  fieldInspections: [],
  samples: [],
  labRequests: [],
  labResults: [],
  templates: [],
  documentTemplates: [],
  reports: [],
  certificates: [],
  approvals: [],
  dossierDocuments: [],
  documents: [],
  inspectionPlans: [],
  caseEvents: [],
  fieldActivityLogs: [],
  labResultReviews: [],
  dossierIndexes: [],
  calibrationInstruments: [],
  workflowTemplates: [],
};

test('F3 PGD queue code remains readable at narrow mobile widths without overflow', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const targetUrl = new URL('/pgdcn/pgd', base).toString();
  const baseOrigin = base.origin;
  const observations = [];
  const apiMutations = [];
  const externalRequests = [];
  const widths = [320, 375, 390, 430];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const width of widths) {
      const page = await browser.newPage({
        viewport: { width, height: width === 320 ? 800 : 844 },
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
          externalRequests.push({ width, url: req.url(), method });
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
                    departmentScopes: ['PGD'],
                    pgdRole: 'PGD_LEAD',
                  },
                }),
              });
              return;
            }

            if (reqUrl.pathname === '/api/pgd/bootstrap') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(SYNTHETIC_BOOTSTRAP),
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

          apiMutations.push({ width, url: req.url(), method });
          await route.abort('blockedbyclient');
          return;
        }

        await route.continue();
      });

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mở menu phòng' }).click();
      await page.getByRole('button', { name: 'Sổ dữ liệu', exact: true }).click();

      const card = page.locator('[data-testid="pgdcn-dossier-card"]')
        .filter({ hasText: 'PGD-DEMO-001' })
        .first();
      await card.waitFor({ state: 'visible', timeout: 15000 });

      const heading = card.getByRole('heading', { name: 'PGD-DEMO-001' });
      await heading.waitFor({ state: 'attached', timeout: 5000 });
      const lineCount = await heading.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0,
        ).length;
      });
      const fullCode = (await heading.textContent())?.trim();

      const cta = card.getByRole('button', { name: 'Mở hồ sơ PGD-DEMO-001' });
      await cta.waitFor({ state: 'visible', timeout: 5000 });
      await cta.focus();
      const ctaMetrics = await cta.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          height: rect.height,
          left: rect.left,
          right: rect.right,
          focused: document.activeElement === el,
        };
      });
      const hasHorizontalOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });

      observations.push({
        width,
        lineCount,
        fullCode,
        cta: ctaMetrics,
        hasHorizontalOverflow,
      });
      await page.close();
    }

    console.log('F3 responsive observations:', JSON.stringify(observations));

    assert.ok(
      observations.every((item) => item.lineCount <= 2),
      `Expected request code to fit in at most two lines at every viewport: ${JSON.stringify(observations)}`,
    );
    assert.ok(
      observations.every((item) => item.fullCode === 'PGD-DEMO-001'),
      `Expected the complete request code in every queue card: ${JSON.stringify(observations)}`,
    );
    assert.ok(
      observations.every((item) => item.cta.height >= 44 && item.cta.left >= 0 && item.cta.right <= item.width && item.cta.focused),
      `Expected a visible, focusable CTA at least 44px high and inside each viewport: ${JSON.stringify(observations)}`,
    );
    assert.ok(
      observations.every((item) => !item.hasHorizontalOverflow),
      `Expected no horizontal page overflow: ${JSON.stringify(observations)}`,
    );
    assert.deepEqual(apiMutations, [], `Expected no non-GET API requests: ${JSON.stringify(apiMutations)}`);
    assert.deepEqual(externalRequests, [], `Expected no external-origin requests: ${JSON.stringify(externalRequests)}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});
