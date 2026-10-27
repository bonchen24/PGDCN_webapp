import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL || 'http://127.0.0.1:2367';
const baseUrl = new URL(rawBaseUrl);

if (baseUrl.hostname !== '127.0.0.1' && baseUrl.hostname !== 'localhost') {
  throw new Error(`Security violation: Only loopback base URLs permitted. Received: ${rawBaseUrl}`);
}

const baseOrigin = baseUrl.origin;

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

const QA_ADMIN_USER = {
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

const EMPTY_BOOTSTRAP = {
  customers: [],
  users: [],
  catalog: [],
  requests: [],
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

const F3_REQUEST_FIXTURE = {
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

const F3_BOOTSTRAP = {
  ...EMPTY_BOOTSTRAP,
  requests: [F3_REQUEST_FIXTURE],
};

const F4_DOSSIER_FIXTURE = {
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

const F4_PROPOSAL_FIXTURE = {
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

const F5_TEMPLATE_ID = 'qa-pcn-reference-template-long-code-2026';
const F5_TEMPLATE_NAME = 'Biểu mẫu chứng nhận đối chiếu quy trình kiểm định an toàn kỹ thuật mở rộng cho sản phẩm hàng hóa đặc thù';

const F5_TEMPLATE_FIXTURE = {
  id: F5_TEMPLATE_ID,
  displayName: F5_TEMPLATE_NAME,
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

function buildSyntheticCustomerWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Tên khách hàng'],
    ['Công ty QA Tổng hợp'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function setupPageNetwork(page, customRoutes = {}) {
  const apiMutations = [];
  const externalRequests = [];
  const pageErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
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
              user: QA_ADMIN_USER,
            }),
          });
          return;
        }

        if (Object.prototype.hasOwnProperty.call(customRoutes, reqUrl.pathname)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(customRoutes[reqUrl.pathname]),
          });
          return;
        }

        if (reqUrl.pathname === '/api/pgd/bootstrap') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(EMPTY_BOOTSTRAP),
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

  return { apiMutations, externalRequests, pageErrors };
}

async function checkHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
}

// ---------------------------------------------------------------------------
// Finding 1: Notification panel regression
// ---------------------------------------------------------------------------
async function captureF1(browser, viewport, outPath) {
  const page = await browser.newPage({ viewport });
  const { apiMutations, externalRequests, pageErrors } = await setupPageNetwork(page);

  try {
    const targetUrl = new URL('/pgdcn/pcn', baseUrl).toString();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const bell = page.getByRole('button', { name: 'Thông báo phòng' });
    await bell.waitFor({ state: 'visible', timeout: 15000 });
    await bell.click();

    const notificationDialog = page.getByRole('dialog', { name: 'Danh sách thông báo phòng' });
    await notificationDialog.waitFor({ state: 'visible', timeout: 5000 });

    if (viewport.width < 1024) {
      const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
      await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
      await menuBtn.click();
    }

    const sidebarItem = page.getByRole('button', { name: 'Sổ dữ liệu PCN' });
    await sidebarItem.waitFor({ state: 'visible', timeout: 5000 });
    await sidebarItem.click();

    const isDialogVisible = await notificationDialog.isVisible().catch(() => false);
    const dialogCount = await page.getByRole('dialog', { name: 'Danh sách thông báo phòng' }).count();
    const bellExpanded = await bell.getAttribute('aria-expanded');

    const targetInfo = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Sổ dữ liệu PCN'));
      return {
        ariaCurrent: btn?.getAttribute('aria-current') || null,
        isFocused: btn ? document.activeElement === btn : false,
      };
    });

    const targetAriaCurrent = targetInfo.ariaCurrent;
    const targetFocused = targetInfo.isFocused;
    const hasHorizontalOverflow = await checkHorizontalOverflow(page);

    await page.screenshot({ path: outPath, fullPage: true });

    assert.equal(isDialogVisible, false, 'F1: Notification panel must be closed after navigation');
    assert.equal(bellExpanded, 'false', 'F1: Bell aria-expanded must be false');
    assert.equal(hasHorizontalOverflow, false, 'F1: No horizontal page overflow allowed');
    assert.equal(apiMutations.length, 0, 'F1: Zero API mutations expected');
    assert.equal(externalRequests.length, 0, 'F1: Zero external requests expected');
    assert.equal(pageErrors.length, 0, 'F1: Zero page errors expected');

    return {
      findingId: 'F1',
      viewport,
      screenshotPath: path.relative(path.resolve('docs/ux-audit/artifacts/after-fixes'), outPath).replace(/\\/g, '/'),
      mode: 'QA_MOCKED',
      measuredDomValues: {
        isDialogVisible,
        dialogCount,
        bellExpanded,
        targetAriaCurrent,
        targetFocused,
        hasHorizontalOverflow,
      },
      mutationCount: apiMutations.length,
      externalRequestCount: externalRequests.length,
      pageErrorCount: pageErrors.length,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Finding 2: Customer import preview dialog semantics & focus
// ---------------------------------------------------------------------------
async function captureF2(browser, viewport, outPath, workbookBuffer) {
  const page = await browser.newPage({ viewport });
  const { apiMutations, externalRequests, pageErrors } = await setupPageNetwork(page);

  try {
    const targetUrl = new URL('/pgdcn', baseUrl).toString();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    let importTrigger = page.getByRole('button', { name: 'Nhập Excel' });
    if (!(await importTrigger.isVisible().catch(() => false))) {
      if (viewport.width < 1024) {
        const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
        await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
        await menuBtn.click();
      }
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
    await dialog.waitFor({ state: 'visible', timeout: 10000 });

    const role = await dialog.getAttribute('role');
    const ariaModal = await dialog.getAttribute('aria-modal');
    const dialogName = await dialog.evaluate((el) => {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent?.trim() || '';
      }
      return el.getAttribute('aria-label') || '';
    });
    const focusInDialog = await dialog.evaluate((el) => {
      return document.activeElement === el || el.contains(document.activeElement);
    });
    const hasHorizontalOverflow = await checkHorizontalOverflow(page);

    await page.screenshot({ path: outPath, fullPage: true });

    assert.equal(ariaModal, 'true', 'F2: Expected preview dialog to have aria-modal="true"');
    assert.equal(focusInDialog, true, 'F2: Expected focus inside dialog');
    assert.equal(role, 'dialog', 'F2: Expected dialog role');
    assert.ok(dialogName && dialogName.includes('Xem trước'), 'F2: Expected dialog accessible name');
    assert.equal(hasHorizontalOverflow, false, 'F2: No horizontal page overflow allowed');
    assert.equal(apiMutations.length, 0, 'F2: Zero API mutations expected');
    assert.equal(externalRequests.length, 0, 'F2: Zero external requests expected');
    assert.equal(pageErrors.length, 0, 'F2: Zero page errors expected');

    return {
      findingId: 'F2',
      viewport,
      screenshotPath: path.relative(path.resolve('docs/ux-audit/artifacts/after-fixes'), outPath).replace(/\\/g, '/'),
      mode: 'QA_MOCKED',
      measuredDomValues: {
        role,
        name: dialogName,
        ariaModal,
        focusInDialog,
        hasHorizontalOverflow,
      },
      mutationCount: apiMutations.length,
      externalRequestCount: externalRequests.length,
      pageErrorCount: pageErrors.length,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Finding 3: PGD dossier queue code readability & CTA sizing
// ---------------------------------------------------------------------------
async function captureF3(browser, viewport, outPath) {
  const page = await browser.newPage({ viewport });
  const { apiMutations, externalRequests, pageErrors } = await setupPageNetwork(page, {
    '/api/pgd/bootstrap': F3_BOOTSTRAP,
  });

  try {
    const targetUrl = new URL('/pgdcn/pgd', baseUrl).toString();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    if (viewport.width < 1024) {
      const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
      await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
      await menuBtn.click();
    }

    const registerNav = page.getByRole('button', { name: 'Sổ dữ liệu PGD' });
    await registerNav.waitFor({ state: 'visible', timeout: 10000 });
    await registerNav.click();

    const card = page
      .locator('[data-testid="pgdcn-dossier-card"]')
      .filter({ hasText: 'PGD-DEMO-001' })
      .first();
    await card.waitFor({ state: 'visible', timeout: 15000 });

    const heading = card.getByRole('heading', { name: 'PGD-DEMO-001' });
    await heading.waitFor({ state: 'attached', timeout: 5000 });

    const lineCount = await heading.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      const tops = [];
      for (const r of rects) {
        if (!tops.some((top) => Math.abs(top - r.top) < 3)) {
          tops.push(r.top);
        }
      }
      return Math.max(tops.length, 1);
    });

    const fullCode = (await heading.textContent())?.trim();

    const cardBounds = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });

    const cta = card.getByRole('button', { name: 'Mở hồ sơ PGD-DEMO-001' });
    await cta.waitFor({ state: 'visible', timeout: 5000 });
    const ctaMetrics = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        height: r.height,
        width: r.width,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    });

    const hasHorizontalOverflow = await checkHorizontalOverflow(page);

    await page.screenshot({ path: outPath, fullPage: true });

    assert.ok(lineCount <= 2, `F3: Expected lineCount <= 2, got ${lineCount}`);
    assert.equal(fullCode, 'PGD-DEMO-001', 'F3: Complete request code expected');
    if (viewport.width < 768) {
      assert.ok(ctaMetrics.height >= 44, `F3: Expected CTA height >= 44px on <768, got ${ctaMetrics.height}`);
    }
    assert.equal(hasHorizontalOverflow, false, 'F3: No horizontal page overflow allowed');
    assert.equal(apiMutations.length, 0, 'F3: Zero API mutations expected');
    assert.equal(externalRequests.length, 0, 'F3: Zero external requests expected');
    assert.equal(pageErrors.length, 0, 'F3: Zero page errors expected');

    return {
      findingId: 'F3',
      viewport,
      screenshotPath: path.relative(path.resolve('docs/ux-audit/artifacts/after-fixes'), outPath).replace(/\\/g, '/'),
      mode: 'QA_MOCKED',
      measuredDomValues: {
        lineCount,
        fullCode,
        cardBounds,
        ctaMetrics,
        hasHorizontalOverflow,
      },
      mutationCount: apiMutations.length,
      externalRequestCount: externalRequests.length,
      pageErrorCount: pageErrors.length,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Finding 4: PCN register navigation query & operations heading
// ---------------------------------------------------------------------------
async function captureF4(browser, viewport, outPath) {
  const page = await browser.newPage({ viewport });
  const { apiMutations, externalRequests, pageErrors } = await setupPageNetwork(page, {
    '/api/db/certificationDossiers': { items: [F4_DOSSIER_FIXTURE] },
    '/api/db/certificationProposals': { items: [F4_PROPOSAL_FIXTURE] },
  });

  try {
    const targetUrl = new URL('/pgdcn/pcn/dossiers/qa-pcn-1', baseUrl).toString();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const dossierCodeElement = page.getByText('DEMO-PCN-001').first();
    await dossierCodeElement.waitFor({ state: 'visible', timeout: 15000 });

    if (viewport.width < 1024) {
      const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
      await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
      await menuBtn.click();
    }

    const registerNavButton = page.getByRole('button', { name: 'Sổ dữ liệu PCN' });
    await registerNavButton.waitFor({ state: 'visible', timeout: 5000 });
    await registerNavButton.click();

    await page.waitForURL(
      (url) => !url.pathname.includes('/dossiers/') && url.searchParams.get('section') === 'operations',
      { timeout: 15000 },
    );

    const operationsHeading = page.getByRole('heading', { name: 'Sổ tổng hợp PCN' });
    await operationsHeading.waitFor({ state: 'visible', timeout: 10000 });

    const landingUrl = page.url();
    const headingText = (await operationsHeading.textContent())?.trim();
    const hasHorizontalOverflow = await checkHorizontalOverflow(page);

    await page.screenshot({ path: outPath, fullPage: true });

    const parsedLanding = new URL(landingUrl);
    assert.equal(parsedLanding.pathname, '/pgdcn/pcn', 'F4: Landing path must be /pgdcn/pcn');
    assert.equal(parsedLanding.searchParams.get('section'), 'operations', 'F4: section must be operations');
    assert.equal(headingText, 'Sổ tổng hợp PCN', 'F4: Heading must be Sổ tổng hợp PCN');
    assert.equal(hasHorizontalOverflow, false, 'F4: No horizontal page overflow allowed');
    assert.equal(apiMutations.length, 0, 'F4: Zero API mutations expected');
    assert.equal(externalRequests.length, 0, 'F4: Zero external requests expected');
    assert.equal(pageErrors.length, 0, 'F4: Zero page errors expected');

    return {
      findingId: 'F4',
      viewport,
      screenshotPath: path.relative(path.resolve('docs/ux-audit/artifacts/after-fixes'), outPath).replace(/\\/g, '/'),
      mode: 'QA_MOCKED',
      measuredDomValues: {
        landingUrl,
        headingText,
        hasHorizontalOverflow,
      },
      mutationCount: apiMutations.length,
      externalRequestCount: externalRequests.length,
      pageErrorCount: pageErrors.length,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Finding 5: PCN DOCX template list mobile responsiveness
// ---------------------------------------------------------------------------
async function captureF5(browser, viewport, outPath) {
  const page = await browser.newPage({ viewport });
  const { apiMutations, externalRequests, pageErrors } = await setupPageNetwork(page, {
    '/api/db/pcnTemplateDefinitions': { items: [F5_TEMPLATE_FIXTURE] },
  });

  try {
    const targetUrl = new URL('/pgdcn', baseUrl).toString();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    if (viewport.width < 1024) {
      const menuBtn = page.getByRole('button', { name: 'Mở menu phòng' });
      await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
      await menuBtn.click();
    }

    const draftingNavBtn = page.getByRole('button', { name: 'Soạn thảo văn bản' });
    await draftingNavBtn.waitFor({ state: 'visible', timeout: 10000 });
    await draftingNavBtn.click();

    const pcnRadio = page.getByRole('radio', { name: 'Chứng nhận (PCN)' });
    await pcnRadio.waitFor({ state: 'visible', timeout: 10000 });
    await pcnRadio.click();

    const docxTab = page.getByRole('tab', { name: /Danh sách biểu mẫu DOCX/ });
    await docxTab.waitFor({ state: 'visible', timeout: 10000 });
    await docxTab.click();

    const rowOrCard = page
      .locator('tr, [data-testid*="template"], [role="row"], [role="listitem"], li, article')
      .filter({ hasText: F5_TEMPLATE_ID })
      .locator('visible=true')
      .first();
    await rowOrCard.waitFor({ state: 'visible', timeout: 15000 });

    const codeElement = rowOrCard
      .getByText(F5_TEMPLATE_ID, { exact: true })
      .locator('visible=true')
      .first();
    await codeElement.waitFor({ state: 'visible', timeout: 5000 });

    const hasCode = await rowOrCard.getByText(F5_TEMPLATE_ID, { exact: true }).isVisible();
    const nameLocator = rowOrCard.getByText(F5_TEMPLATE_NAME, { exact: false });
    const hasName = await nameLocator.isVisible();
    const hasVersion = await rowOrCard.getByText('v2.4', { exact: true }).isVisible();
    const hasFieldCode = await rowOrCard.getByText('QC4', { exact: true }).isVisible();
    const hasStatus = await rowOrCard.getByText('Đã duyệt', { exact: true }).isVisible();

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

    const primaryAction = rowOrCard
      .getByRole('button', { name: /cập nhật/i })
      .or(rowOrCard.locator('button[title*="Cập nhật"]'))
      .or(rowOrCard.locator('button:not([disabled])'))
      .first();
    await primaryAction.waitFor({ state: 'attached', timeout: 5000 });
    const actionMetrics = await primaryAction.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        height: r.height,
        width: r.width,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    });

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

    const hasHorizontalOverflow = await checkHorizontalOverflow(page);

    await page.screenshot({ path: outPath, fullPage: true });

    assert.ok(
      hasCode && hasName && hasVersion && hasFieldCode && hasStatus,
      'F5: All template fields must be visible',
    );
    assert.ok(codeLineCount <= 2, `F5: Expected code line count <= 2, got ${codeLineCount}`);
    assert.ok(nameLineCount <= 3, `F5: Expected name line count <= 3, got ${nameLineCount}`);
    if (viewport.width < 768) {
      assert.ok(
        actionMetrics.height >= 44,
        `F5: Expected primary action height >= 44px on <768, got ${actionMetrics.height}`,
      );
      assert.ok(
        !listScrollMetrics.hasHorizontalScroll,
        'F5: Expected no horizontal scrolling on template list container below 768px',
      );
    }
    assert.equal(hasHorizontalOverflow, false, 'F5: No horizontal page overflow allowed');
    assert.equal(apiMutations.length, 0, 'F5: Zero API mutations expected');
    assert.equal(externalRequests.length, 0, 'F5: Zero external requests expected');
    assert.equal(pageErrors.length, 0, 'F5: Zero page errors expected');

    return {
      findingId: 'F5',
      viewport,
      screenshotPath: path.relative(path.resolve('docs/ux-audit/artifacts/after-fixes'), outPath).replace(/\\/g, '/'),
      mode: 'QA_MOCKED',
      measuredDomValues: {
        hasCode,
        hasName,
        hasVersion,
        hasFieldCode,
        hasStatus,
        codeLineCount,
        nameLineCount,
        actionMetrics,
        listScrollMetrics,
        hasHorizontalOverflow,
      },
      mutationCount: apiMutations.length,
      externalRequestCount: externalRequests.length,
      pageErrorCount: pageErrors.length,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Main Orchestration
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Starting QA after-fixes capture against isolated server: ${rawBaseUrl}`);

  const outputRoot = path.resolve('docs/ux-audit/artifacts/after-fixes');
  fs.mkdirSync(outputRoot, { recursive: true });

  for (const fid of ['f1', 'f2', 'f3', 'f4', 'f5']) {
    fs.mkdirSync(path.join(outputRoot, fid), { recursive: true });
  }

  const workbookBuffer = buildSyntheticCustomerWorkbook();
  const observations = [];

  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of VIEWPORTS) {
      const tag = `${vp.width}x${vp.height}`;
      console.log(`\n--- Capturing viewport ${tag} ---`);

      // F1
      console.log(`[F1] ${tag}`);
      const f1Path = path.join(outputRoot, 'f1', `${tag}.png`);
      const obs1 = await captureF1(browser, vp, f1Path);
      observations.push(obs1);

      // F2
      console.log(`[F2] ${tag}`);
      const f2Path = path.join(outputRoot, 'f2', `${tag}.png`);
      const obs2 = await captureF2(browser, vp, f2Path, workbookBuffer);
      observations.push(obs2);

      // F3
      console.log(`[F3] ${tag}`);
      const f3Path = path.join(outputRoot, 'f3', `${tag}.png`);
      const obs3 = await captureF3(browser, vp, f3Path);
      observations.push(obs3);

      // F4
      console.log(`[F4] ${tag}`);
      const f4Path = path.join(outputRoot, 'f4', `${tag}.png`);
      const obs4 = await captureF4(browser, vp, f4Path);
      observations.push(obs4);

      // F5
      console.log(`[F5] ${tag}`);
      const f5Path = path.join(outputRoot, 'f5', `${tag}.png`);
      const obs5 = await captureF5(browser, vp, f5Path);
      observations.push(obs5);
    }

    const totalMutations = observations.reduce((acc, o) => acc + o.mutationCount, 0);
    const totalExternal = observations.reduce((acc, o) => acc + o.externalRequestCount, 0);
    const totalPageErrors = observations.reduce((acc, o) => acc + o.pageErrorCount, 0);

    const metricsPayload = {
      mode: 'QA_MOCKED',
      generatedAt: new Date().toISOString(),
      baseUrl: rawBaseUrl,
      totalScreenshots: observations.length,
      mutationCount: totalMutations,
      externalRequestCount: totalExternal,
      pageErrorCount: totalPageErrors,
      observations,
    };

    const metricsPath = path.join(outputRoot, 'metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(metricsPayload, null, 2), 'utf-8');

    console.log(`\nCompleted QA after-fixes capture successfully.`);
    console.log(`Screenshots captured: ${observations.length}`);
    console.log(`Metrics written to: ${metricsPath}`);
    console.log(`Summary: mutations=${totalMutations}, external=${totalExternal}, pageErrors=${totalPageErrors}`);

    if (totalMutations > 0 || totalExternal > 0 || totalPageErrors > 0) {
      throw new Error(`QA isolation criteria violated: mutations=${totalMutations}, external=${totalExternal}, errors=${totalPageErrors}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('QA capture error:', err);
  process.exit(1);
});
