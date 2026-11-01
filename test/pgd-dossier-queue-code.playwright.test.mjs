import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
      await page.getByRole('button', { name: 'Sổ dữ liệu PGD', exact: true }).click();

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

const D05_VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 844 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

const D05_ROLES = [
  { id: 'admin', role: 'admin', systemRole: 'admin', pgdRole: 'PGD_LEAD' },
  { id: 'staff', role: 'staff', systemRole: 'staff', pgdRole: 'PGD_INSPECTOR' },
  { id: 'viewer', role: 'viewer', systemRole: 'viewer', pgdRole: 'PGD_VIEWER' },
];

const D05_ARTIFACT_ROOT = resolve(
  'docs/ux-audit/artifacts/density/next-batch/d05',
);

async function routePgdQueueQaRequests(page, baseOrigin, observations, role) {
  await page.route('**/*', async (route) => {
    const req = route.request();
    const reqUrl = new URL(req.url());
    const method = req.method().toUpperCase();

    if (reqUrl.origin !== baseOrigin) {
      if (reqUrl.hostname.includes('googleapis.com') || reqUrl.hostname.includes('gstatic.com')) {
        await route.abort('blockedbyclient');
        return;
      }
      observations.externalRequests.push({ url: req.url(), method });
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
                username: `synthetic_${role.id}`,
                name: `Synthetic ${role.id}`,
                role: role.role,
                systemRole: role.systemRole,
                departmentRoleCode: 'GD',
                fieldCodes: ['KN'],
                active: true,
                departmentScopes: ['PGD'],
                pgdRole: role.pgdRole,
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

      observations.apiMutations.push({ url: req.url(), method });
      await route.abort('blockedbyclient');
      return;
    }

    await route.continue();
  });
}

async function openPgdQueue(page, width, baseOrigin, observations, role) {
  await routePgdQueueQaRequests(page, baseOrigin, observations, role);
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  await page.goto(new URL('/pgdcn/pgd', base).toString(), {
    waitUntil: 'domcontentloaded',
  });

  if (width < 1024) {
    await page.getByRole('button', { name: 'Mở menu phòng' }).click();
  }
  await page.getByRole('button', { name: 'Sổ dữ liệu PGD', exact: true }).click();
  await page.getByRole('region', { name: 'Hàng đợi hồ sơ PGD' }).waitFor({ state: 'visible' });
}

function getD05CapturePhase() {
  const phase = process.env.PGDCN_DENSITY_PHASE;
  return phase === 'before' || phase === 'after' ? phase : null;
}

test('D05 PGD queue keeps the card and primary action near the top across viewports', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const observations = { apiMutations: [], externalRequests: [], viewports: [] };
  const phase = getD05CapturePhase();
  const outputDirectory = phase ? resolve(D05_ARTIFACT_ROOT, phase) : null;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of D05_ROLES) {
      for (const viewport of D05_VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openPgdQueue(page, viewport.width, base.origin, observations, role);

      const search = page.getByRole('searchbox', { name: 'Tìm trong hàng đợi hồ sơ' });
      const statusGroup = page.getByRole('group', { name: 'Trạng thái / tiến độ hồ sơ' });
      const productGroup = page.locator('[role="group"][aria-labelledby="pgd-queue-product-filter-label"]');
      const productDisclosure = page.getByRole('button', { name: /Bộ lọc sản phẩm/i });
      const card = page.getByTestId('pgdcn-dossier-card').filter({ hasText: 'PGD-DEMO-001' }).first();
      await card.waitFor({ state: 'visible', timeout: 15000 });
      const heading = card.getByRole('heading', { name: 'PGD-DEMO-001' });
      const cta = card.getByRole('button', { name: 'Mở hồ sơ PGD-DEMO-001' });
      await cta.waitFor({ state: 'visible', timeout: 5000 });

      const metric = await page.evaluate(({ cardElement, headingElement, ctaElement, statusElement, productElement }) => {
        const rect = (element) => {
          if (!element) return null;
          const bounds = element.getBoundingClientRect();
          return {
            top: bounds.top + window.scrollY,
            left: bounds.left,
            right: bounds.right,
            height: bounds.height,
            bottom: bounds.bottom,
          };
        };
        const stateButtons = statusElement ? Array.from(statusElement.querySelectorAll('button')) : [];
        const stateRows = [...new Set(stateButtons.map((button) => Math.round(button.getBoundingClientRect().top)))];
        const doc = document.documentElement;
        const body = document.body;
        return {
          cardFirstTop: rect(cardElement)?.top ?? null,
          productFilterHeight: rect(productElement)?.height ?? null,
          productFilterVisible: Boolean(productElement && getComputedStyle(productElement).display !== 'none' && productElement.getClientRects().length),
          statusFilterHeight: rect(statusElement)?.height ?? null,
          statusChipCount: stateButtons.length,
          statusChipRows: stateRows.length,
          statusFilterScrollWidth: statusElement?.scrollWidth ?? null,
          statusFilterClientWidth: statusElement?.clientWidth ?? null,
          searchVisible: Boolean(document.querySelector('input[aria-label="Tìm trong hàng đợi hồ sơ"]')?.getClientRects().length),
          fullCode: headingElement?.textContent?.trim() ?? null,
          codeLineCount: headingElement ? Array.from((() => {
            const range = document.createRange();
            range.selectNodeContents(headingElement);
            return range.getClientRects();
          })()).filter((item) => item.width > 0 && item.height > 0).length : null,
          cta: rect(ctaElement),
          documentOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth,
        };
      }, {
        cardElement: await card.elementHandle(),
        headingElement: await heading.elementHandle(),
        ctaElement: await cta.elementHandle(),
        statusElement: await statusGroup.elementHandle(),
        productElement: await productGroup.elementHandle().catch(() => null),
      });

      metric.width = viewport.width;
      metric.height = viewport.height;
      metric.role = role.id;
      metric.searchVisible = await search.isVisible();
      metric.productDisclosureExists = (await productDisclosure.count()) > 0;
      metric.productDisclosureExpanded = metric.productDisclosureExists
        ? (await productDisclosure.getAttribute('aria-expanded')) === 'true'
        : null;
      metric.pageErrors = [...pageErrors];
      observations.viewports.push(metric);

      if (outputDirectory) {
        await mkdir(outputDirectory, { recursive: true });
        await page.screenshot({
          path: resolve(outputDirectory, `${role.id}-${viewport.width}x${viewport.height}.png`),
          fullPage: true,
        });
      }
      await page.close();
      }
    }

    if (outputDirectory) {
      await writeFile(resolve(outputDirectory, 'metrics.json'), `${JSON.stringify({
        phase,
        capturedAt: new Date().toISOString(),
        ...observations,
      }, null, 2)}\n`, 'utf8');
    }

    console.log('D05 PGD queue observations:', JSON.stringify(observations.viewports));
    assert.deepEqual(observations.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(observations.apiMutations)}`);
    assert.deepEqual(observations.externalRequests, [], `Expected zero external requests: ${JSON.stringify(observations.externalRequests)}`);
    assert.ok(observations.viewports.every((item) => item.pageErrors.length === 0), `Expected no page errors: ${JSON.stringify(observations.viewports)}`);

    const mobile = observations.viewports.filter((item) => item.width <= 430);
    assert.ok(mobile.every((item) => item.cardFirstTop <= 480), `Expected the first mobile card at or above y=480: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.every((item) => item.searchVisible && item.statusChipCount === 6 && item.statusChipRows === 1 && item.statusFilterScrollWidth > item.statusFilterClientWidth), `Expected search and six core status filters in one horizontal scroll row: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.every((item) => item.productDisclosureExists && !item.productDisclosureExpanded && !item.productFilterVisible), `Expected secondary product filters collapsed by default on mobile: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.every((item) => item.fullCode === 'PGD-DEMO-001' && item.codeLineCount <= 2), `Expected the full request code to remain readable: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.every((item) => item.cta.height >= 44 && item.cta.left >= 0 && item.cta.right <= item.width), `Expected the primary CTA to remain within the viewport and at least 44px high: ${JSON.stringify(mobile)}`);
    assert.ok(observations.viewports.every((item) => !item.documentOverflow), `Expected no document horizontal overflow: ${JSON.stringify(observations.viewports)}`);
    assert.ok(observations.viewports.filter((item) => item.width >= 768).every((item) => item.productFilterVisible && item.statusChipCount === 6), `Expected both filter groups to remain available at tablet/desktop widths: ${JSON.stringify(observations.viewports)}`);
  } finally {
    await browser.close();
  }
});

test('D05 product-filter disclosure preserves its selected filter when closed and reopened', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const observations = { apiMutations: [], externalRequests: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openPgdQueue(page, 390, base.origin, observations, D05_ROLES[0]);
    const disclosure = page.getByRole('button', { name: /Bộ lọc sản phẩm/i });
    assert.equal(await disclosure.count(), 1, 'Expected an accessible product-filter disclosure with an active-filter badge');

    await disclosure.click();
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
    const productGroup = page.getByRole('group', { name: 'Nhóm sản phẩm PGD' });
    const steelFilter = productGroup.getByRole('button', { name: /Thép\/Kim loại/i });
    await steelFilter.click();
    assert.equal(await steelFilter.getAttribute('aria-pressed'), 'true');

    await disclosure.click();
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');
    await disclosure.click();
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
    assert.equal(await steelFilter.getAttribute('aria-pressed'), 'true');
    assert.match(await disclosure.getAttribute('aria-label') || '', /1/, 'Expected the active-filter badge to report the selected product filter');
    assert.equal(await page.getByTestId('pgdcn-dossier-card').filter({ hasText: 'PGD-DEMO-001' }).count(), 1);
    assert.deepEqual(observations.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(observations.apiMutations)}`);
    assert.deepEqual(observations.externalRequests, [], `Expected zero external requests: ${JSON.stringify(observations.externalRequests)}`);
    await page.close();
  } finally {
    await browser.close();
  }
});
