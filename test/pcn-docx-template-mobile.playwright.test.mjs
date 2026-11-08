import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;

const TEMPLATE_ID = 'qa-pcn-reference-template-long-code-2026';
const TEMPLATE_NAME = 'Biểu mẫu chứng nhận đối chiếu quy trình kiểm định an toàn kỹ thuật mở rộng cho sản phẩm hàng hóa đặc thù';

const SYNTHETIC_TEMPLATE = {
  id: TEMPLATE_ID,
  displayName: TEMPLATE_NAME,
  fieldCode: 'QC4',
  documentKind: 'DECISION',
  variant: '2.4',
  format: 'DOCX',
  status: 'APPROVED',
  placeholderKeys: [],
  requiredPlaceholderKeys: [],
  sourceFingerprint: {
    sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    byteSize: 1024,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  importedAt: '2026-10-27T08:00:00.000Z',
  importedByUsername: 'synthetic_admin',
};

const SYNTHETIC_USER = {
  username: 'synthetic_admin',
  name: 'Synthetic Admin',
  role: 'admin',
  systemRole: 'admin',
  departmentRoleCode: 'GD',
  fieldCodes: ['KN', 'QC4'],
  active: true,
  departmentScopes: ['PCN', 'PGD'],
  pgdRole: 'PGD_LEAD',
};

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

test(
  'F5 PCN DOCX template list mobile responsiveness: visibility, wrapping, action target size, and zero horizontal scrolling',
  { skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; browser test is opt-in' : false },
  async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const targetUrl = new URL('/pgdcn', base).toString();
  const baseOrigin = base.origin;

  const observations = [];
  const apiMutations = [];
  const externalRequests = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const { width, height } of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width, height },
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
                  user: SYNTHETIC_USER,
                }),
              });
              return;
            }

            if (reqUrl.pathname === '/api/db/pcnTemplateDefinitions') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [SYNTHETIC_TEMPLATE] }),
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

            if (reqUrl.pathname === '/api/db-meta') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ meta: {} }),
              });
              return;
            }

            if (reqUrl.pathname === '/api/pgd/bootstrap') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  requests: [],
                  assignments: [],
                  customers: [],
                  users: [],
                  catalog: [],
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
                }),
              });
              return;
            }

            // Fallback for all other same-origin GET APIs
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

      // Navigate through visible UI
      if (width < 1024) {
        const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
        await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
        await menuBtn.click();
      }

      const draftingNavBtn = page.getByRole('button', { name: 'Soạn thảo tài liệu' });
      await draftingNavBtn.waitFor({ state: 'visible', timeout: 10000 });
      await draftingNavBtn.click();

      // Select radio 'Chứng nhận (PCN)'
      const pcnRadio = page.getByRole('radio', { name: 'Chứng nhận (PCN)' });
      await pcnRadio.waitFor({ state: 'visible', timeout: 10000 });
      await pcnRadio.click();

      // Select tab 'Danh sách biểu mẫu DOCX'
      const docxTab = page.getByRole('tab', { name: /Danh sách biểu mẫu DOCX/ });
      await docxTab.waitFor({ state: 'visible', timeout: 10000 });
      await docxTab.click();

      // Inspect containing table row or responsive card (working with either visible desktop row or mobile card)
      const rowOrCard = page
        .locator('tr, [data-testid*="template"], [role="row"], [role="listitem"], li, article')
        .filter({ hasText: TEMPLATE_ID })
        .locator('visible=true')
        .first();
      await rowOrCard.waitFor({ state: 'visible', timeout: 15000 });

      // Locate visible synthetic template exact code within visible item
      const codeElement = rowOrCard
        .getByText(TEMPLATE_ID, { exact: true })
        .locator('visible=true')
        .first();
      await codeElement.waitFor({ state: 'visible', timeout: 5000 });

      // Assertions per item: code, name, version, fieldCode, status
      const hasCode = await rowOrCard.getByText(TEMPLATE_ID, { exact: true }).isVisible();
      const nameLocator = rowOrCard.getByText(TEMPLATE_NAME, { exact: false });
      const hasName = await nameLocator.isVisible();
      const hasVersion = await rowOrCard.getByText('v2.4', { exact: true }).isVisible();
      const hasFieldCode = await rowOrCard.getByText('QC4', { exact: true }).isVisible();
      const hasStatus = await rowOrCard.getByText('Đã duyệt', { exact: true }).isVisible();

      // Code line count measurement
      const codeLineCount = await codeElement.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        const tops = [];
        for (const r of rects) {
          if (!tops.some((top) => Math.abs(top - r.top) < 3)) {
            tops.push(r.top);
          }
        }
        return Math.max(tops.length, 1);
      });

      // Name line count measurement
      const nameLineCount = await nameLocator.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        const tops = [];
        for (const r of rects) {
          if (!tops.some((top) => Math.abs(top - r.top) < 3)) {
            tops.push(r.top);
          }
        }
        return Math.max(tops.length, 1);
      });

      // Primary action inspection
      const primaryAction = rowOrCard
        .getByRole('button', { name: /cập nhật/i })
        .or(rowOrCard.locator('button[title*="Cập nhật"]'))
        .or(rowOrCard.locator('button:not([disabled])'))
        .first();
      await primaryAction.waitFor({ state: 'attached', timeout: 5000 });
      const actionVisible = await primaryAction.isVisible();

      if (actionVisible) {
        await primaryAction.focus();
      }

      const actionMetrics = await primaryAction.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          focused: document.activeElement === el,
        };
      });

      const actionWithinViewport = actionVisible &&
        actionMetrics.left >= 0 &&
        actionMetrics.right <= width &&
        actionMetrics.top >= 0 &&
        actionMetrics.bottom <= height;

      // Inspect whether template list container has horizontal scrolling
      const listScrollMetrics = await rowOrCard.evaluate((el) => {
        let cur = el.parentElement;
        while (cur && cur !== document.body && !cur.classList.contains('flex-1')) {
          const style = window.getComputedStyle(cur);
          if (cur.scrollWidth > cur.clientWidth + 1) {
            return {
              hasHorizontalScroll: true,
              scrollWidth: cur.scrollWidth,
              clientWidth: cur.clientWidth,
              overflowX: style.overflowX,
            };
          }
          cur = cur.parentElement;
        }
        return {
          hasHorizontalScroll: false,
          scrollWidth: 0,
          clientWidth: 0,
          overflowX: 'visible',
        };
      });

      const hasPageHorizontalOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });

      observations.push({
        width,
        height,
        hasCode,
        hasName,
        hasVersion,
        hasFieldCode,
        hasStatus,
        codeLineCount,
        nameLineCount,
        actionVisible,
        actionFocused: actionMetrics.focused,
        actionHeight: actionMetrics.height,
        actionWithinViewport,
        actionLeft: actionMetrics.left,
        actionRight: actionMetrics.right,
        listHasHorizontalScroll: listScrollMetrics.hasHorizontalScroll,
        listScrollWidth: listScrollMetrics.scrollWidth,
        listClientWidth: listScrollMetrics.clientWidth,
        hasPageHorizontalOverflow,
      });

      await page.close();
    }

    console.log('F5 DOCX mobile observations:\n' + JSON.stringify(observations, null, 2));

    // 1. Complete template fields visible
    assert.ok(
      observations.every((o) => o.hasCode && o.hasName && o.hasVersion && o.hasFieldCode && o.hasStatus),
      `Expected complete template code, name, version v2.4, QC4, and status Đã duyệt to be visible at all viewports: ${JSON.stringify(observations)}`,
    );

    // 2. Line counts: code at most 2, name at most 3
    assert.ok(
      observations.every((o) => o.codeLineCount <= 2),
      `Expected template code to occupy at most 2 lines: ${JSON.stringify(observations.map((o) => ({ width: o.width, codeLineCount: o.codeLineCount })))}`,
    );
    assert.ok(
      observations.every((o) => o.nameLineCount <= 3),
      `Expected template name to occupy at most 3 lines: ${JSON.stringify(observations.map((o) => ({ width: o.width, nameLineCount: o.nameLineCount })))}`,
    );

    // 3. Primary action: visible, focusable, within viewport, and >= 44px on mobile (< 768)
    const mobileObservations = observations.filter((o) => o.width < 768);
    assert.ok(
      observations.every((o) => o.actionVisible && o.actionFocused && o.actionWithinViewport),
      `Expected primary action to be visible, focusable, and within viewport: ${JSON.stringify(observations.map((o) => ({ width: o.width, visible: o.actionVisible, focused: o.actionFocused, withinViewport: o.actionWithinViewport, right: o.actionRight })))}`,
    );
    assert.ok(
      mobileObservations.every((o) => o.actionHeight >= 44),
      `Expected primary action to be at least 44px high on mobile widths (< 768): ${JSON.stringify(mobileObservations.map((o) => ({ width: o.width, actionHeight: o.actionHeight })))}`,
    );

    // 4. On widths below 768, template list itself has no horizontal scrolling/clipping
    assert.ok(
      mobileObservations.every((o) => !o.listHasHorizontalScroll),
      `Expected template list to have no horizontal scrolling below 768px: ${JSON.stringify(mobileObservations.map((o) => ({ width: o.width, listHasHorizontalScroll: o.listHasHorizontalScroll, scrollWidth: o.listScrollWidth, clientWidth: o.listClientWidth })))}`,
    );

    // 5. No page horizontal overflow
    assert.ok(
      observations.every((o) => !o.hasPageHorizontalOverflow),
      `Expected no horizontal page overflow at all viewports: ${JSON.stringify(observations.map((o) => ({ width: o.width, overflow: o.hasPageHorizontalOverflow })))}`,
    );

    // 6. Zero API mutations and zero external requests
    assert.deepEqual(apiMutations, [], `Expected no non-GET API requests: ${JSON.stringify(apiMutations)}`);
    assert.deepEqual(externalRequests, [], `Expected no external-origin requests: ${JSON.stringify(externalRequests)}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});
