// QA MODE: SYNTHETIC/MOCK — auth/session and API routes are stubbed; this is not real authenticated UI QA.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;
const artifactRoot = resolve(process.env.PGDCN_DENSITY_ARTIFACT_ROOT || 'docs/ux-audit/artifacts/density/next-batch', 'd09');

const ROLES = [
  { id: 'admin', role: 'admin', systemRole: 'admin', pgdRole: 'PGD_LEAD' },
  { id: 'staff', role: 'staff', systemRole: 'staff', pgdRole: 'PGD_INSPECTOR' },
  { id: 'viewer', role: 'viewer', systemRole: 'viewer', pgdRole: 'PGD_VIEWER' },
];

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1440, height: 1000 },
];

const LONG_REQUEST_FIXTURE = {
  domain: 'pgd',
  id: 'qa-pgd-1',
  requestCode: 'PGD-DEMO-001',
  intakeChannel: 'DIRECT',
  requester: { name: 'Đơn vị kiểm thử synthetic PGDCN với tên dài để kiểm tra xuống dòng' },
  customerSnapshot: {
    name: 'Công ty TNHH Khách hàng kiểm thử hồ sơ giám định có tên dài ở nhiều dòng',
    address: 'Số 123 đường Kiểm thử giao diện, phường Trung Hòa, quận Cầu Giấy, thành phố Hà Nội',
  },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'qa-catalog',
  productName: 'Thép cuộn cán nóng kiểm thử giao diện với mô tả hàng hóa dài nhiều dòng',
  lotCode: 'LO-THU-NGHIEM-2026-VERY-LONG-CODE-001',
  quantity: 125,
  unit: 'tấn',
  weight: 125,
  weightUnit: 'tấn',
  inspectionScope: 'Kiểm tra tổng hợp theo hồ sơ synthetic, đối chiếu thông tin sản phẩm và tiêu chuẩn kỹ thuật trong phạm vi được yêu cầu.',
  inspectionLocation: 'Kho hàng kiểm thử PGDCN, khu vực tiếp nhận synthetic',
  standards: ['TCVN QA 001', 'ASTM QA 002'],
  status: 'WAITING_LAB_RESULTS',
  documentPointers: [],
  sampleIds: [],
  labRequestIds: [],
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
  dossierChecklist: [],
};

const SYNTHETIC_REQUIREMENTS = [
  { domain: 'PGD', group: 'REQUEST', code: 'REQUEST_PYC', title: 'Phiếu yêu cầu giám định', required: true },
  { domain: 'PGD', group: 'REQUEST', code: 'REQUEST_SUPPORTING', title: 'Tài liệu tiếp nhận và thông tin PYC', required: true },
  { domain: 'PGD', group: 'COMMERCIAL_CUSTOMS', code: 'COMMERCIAL_CONTRACT', title: 'Hợp đồng', required: false },
  { domain: 'PGD', group: 'TECHNICAL', code: 'INSPECTION_PLAN', title: 'Kế hoạch giám định', required: true },
  { domain: 'PGD', group: 'TECHNICAL', code: 'TECHNICAL_SPECIFICATION', title: 'Hồ sơ kỹ thuật / catalogue', required: false },
  { domain: 'PGD', group: 'RESULT_ISSUANCE', code: 'LAB_RESULT', title: 'Kết quả PTN', required: true },
  { domain: 'PGD', group: 'RESULT_ISSUANCE', code: 'LAB_RESULT_REVIEW', title: 'Phiếu xem xét kết quả PTN', required: false },
];

function createBootstrap() {
  return {
    customers: [],
    users: [],
    catalog: [],
    requests: [LONG_REQUEST_FIXTURE],
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
}

async function installD09Routes(page, baseOrigin, role, audit, dossierMode = 'loaded') {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.origin !== baseOrigin) {
      if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
        await route.abort('blockedbyclient');
        return;
      }
      audit.externalRequests.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      if (method !== 'GET') {
        audit.apiMutations.push({ url: request.url(), method });
        await route.abort('blockedbyclient');
        return;
      }

      if (url.pathname === '/api/auth/pcn-session') {
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

      if (url.pathname === '/api/pgd/bootstrap') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createBootstrap()),
        });
        return;
      }

      if (url.pathname === '/api/pgd/requests/qa-pgd-1/dossier-documents') {
        if (dossierMode === 'loading') await new Promise((resolveLoad) => setTimeout(resolveLoad, 800));
        if (dossierMode === 'error') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Synthetic QA documents unavailable' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ dossierDocuments: [], requirements: SYNTHETIC_REQUIREMENTS }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }

    await route.continue();
  });
}

async function openD09Detail(page, base, role, audit, dossierMode = 'loaded') {
  await installD09Routes(page, base.origin, role, audit, dossierMode);
  await page.goto(new URL('/pgdcn/pgd/dossiers/qa-pgd-1', base).toString(), { waitUntil: 'domcontentloaded' });
  await page.getByTestId('pgd-dossier-focus-shell').waitFor({ state: 'visible', timeout: 20000 });
}

async function saveScreenshot(page, phase, role, viewport, suffix = '') {
  if (phase !== 'before' && phase !== 'after') return;
  const directory = resolve(artifactRoot, phase);
  await mkdir(directory, { recursive: true });
  const tail = suffix ? `-${suffix}` : '';
  await page.screenshot({
    path: resolve(directory, `${role}-${viewport.width}x${viewport.height}${tail}.png`),
    animations: 'disabled',
    fullPage: false,
  });
}

async function collectDetailMetrics(page, role, viewport, pageErrors) {
  const metrics = await page.evaluate(({ roleId, screen }) => {
    const detail = document.querySelector('[data-testid="pgd-dossier-focus-shell"]');
    const workCard = detail?.querySelector('[data-testid="pgd-dossier-step-work-panel"][aria-label="Bước xử lý hồ sơ PGD"]') || null;
    const selectedStepPanel = detail?.querySelector('[data-testid="pgd-dossier-selected-step-panel"]') || null;
    const flow = workCard?.querySelector('[role="tablist"][aria-label="Các giai đoạn xử lý hồ sơ PGD"]') || null;
    const flowScroll = workCard?.querySelector('[data-testid="pgd-dossier-flow-scroll"]') || null;
    const stageTabs = Array.from(flow?.querySelectorAll('[role="tab"]') || []);
    const relatedDocuments = selectedStepPanel?.querySelector('[aria-label="Danh sách tài liệu cần hoàn thiện PGD"]') || null;
    const reader = detail?.querySelector('[data-testid="pgd-dossier-document-reader"]') || null;
    const mobileTabList = detail?.querySelector('[role="tablist"][aria-label="Chuyển vùng hồ sơ PGD"]') || null;
    const rect = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        height: bounds.height,
        visibleInViewport: bounds.bottom > 0 && bounds.top < window.innerHeight,
      };
    };
    const visible = (element) => Boolean(element?.getClientRects().length && !element.closest('details:not([open])'));
    const allButtons = Array.from(detail?.querySelectorAll('button') || []);
    const visibleButtons = allButtons.filter(visible);
    const allFields = Array.from(detail?.querySelectorAll('input, select, textarea') || []);
    const visibleFields = allFields.filter(visible);
    const allTables = Array.from(detail?.querySelectorAll('table') || []);
    const visibleTables = allTables.filter(visible);
    const doc = document.documentElement;
    const body = document.body;
    const workBounds = workCard?.getBoundingClientRect();
    const readerBounds = reader?.parentElement?.getBoundingClientRect();
    return {
      role: roleId,
      width: screen.width,
      height: screen.height,
      workCardCount: detail?.querySelectorAll('[data-testid="pgd-dossier-step-work-panel"]').length ?? 0,
      workCardVisible: visible(workCard),
      workCardBounds: rect(workCard),
      selectedStepPanelCount: detail?.querySelectorAll('[data-testid="pgd-dossier-selected-step-panel"]').length ?? 0,
      selectedStepPanelVisible: visible(selectedStepPanel),
      flowStageCount: stageTabs.length,
      flowStageNumbers: stageTabs.map((tab) => tab.querySelector('span')?.textContent?.trim() || ''),
      flowScrollBounds: rect(flowScroll),
      flowScrollWidth: flowScroll?.scrollWidth ?? null,
      flowScrollClientWidth: flowScroll?.clientWidth ?? null,
      selectedFlowStageCount: stageTabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').length,
      relatedDocumentsVisible: visible(relatedDocuments),
      relatedDocumentsHeading: relatedDocuments?.querySelector('h3')?.textContent?.trim() || null,
      relatedDocumentsTableCount: relatedDocuments?.querySelectorAll('table').length ?? 0,
      readerCount: detail?.querySelectorAll('[data-testid="pgd-dossier-document-reader"]').length ?? 0,
      readerVisible: visible(reader),
      readerIsRightColumn: reader?.parentElement?.tagName === 'ASIDE',
      readerBounds: rect(reader?.parentElement || null),
      workToReaderRatio: workBounds && readerBounds ? workBounds.width / (workBounds.width + readerBounds.width) : null,
      mobileTabCount: mobileTabList?.querySelectorAll('[role="tab"]').length ?? 0,
      mobileReaderTabHeight: rect(mobileTabList?.querySelector('#pgd-dossier-mobile-tab-reader'))?.height ?? null,
      buttonsDom: allButtons.length,
      buttonsVisible: visibleButtons.length,
      fieldsDom: allFields.length,
      fieldsVisible: visibleFields.length,
      tablesDom: allTables.length,
      tablesVisible: visibleTables.length,
      workflowDisclosureCount: detail?.querySelectorAll('details').length ?? 0,
      openDisclosureCount: detail?.querySelectorAll('details[open]').length ?? 0,
      documentOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth,
      documentScrollWidth: doc.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      overflowingElements: Array.from(document.querySelectorAll('body *')).flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.right > window.innerWidth + 1 ? [{
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          testId: element.getAttribute('data-testid'),
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }] : [];
      }).slice(0, 12),
      pageScrollerHeight: detail?.querySelector('[data-testid="pgd-dossier-scroll-area"]')?.scrollHeight ?? null,
      pageScrollerTop: detail?.querySelector('[data-testid="pgd-dossier-scroll-area"]')?.scrollTop ?? null,
    };
  }, { roleId: role.id, screen: viewport });
  metrics.pageErrors = [...pageErrors];
  return metrics;
}

test('D09 PGD detail has one seven-stage work card, a related-documents table, and a private reader', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const phase = process.env.PGDCN_DENSITY_PHASE;
  const capturePhase = phase === 'before' || phase === 'after' ? phase : null;
  const audit = { apiMutations: [], externalRequests: [], screens: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ROLES) {
      const page = await browser.newPage({ viewport: VIEWPORTS[0] });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openD09Detail(page, base, role, audit);

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(80);
        const metrics = await collectDetailMetrics(page, role, viewport, pageErrors);
        audit.screens.push(metrics);
        await saveScreenshot(page, capturePhase, role.id, viewport);
      }
      await page.close();
    }

    if (capturePhase) {
      const directory = resolve(artifactRoot, capturePhase);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'metrics.json'), `${JSON.stringify({
        phase: capturePhase,
        capturedAt: new Date().toISOString(),
        apiMutations: audit.apiMutations,
        externalRequests: audit.externalRequests,
        screens: audit.screens,
      }, null, 2)}\n`, 'utf8');
    }

    console.log('D09 PGD viewport/rail metrics:', JSON.stringify(audit.screens.map(({ role, width, documentScrollWidth, documentOverflow, flowScrollBounds, flowScrollWidth, flowScrollClientWidth }) => ({ role, width, documentScrollWidth, documentOverflow, flowScrollBounds, flowScrollWidth, flowScrollClientWidth }))));
    assert.deepEqual(audit.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected zero external requests: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.screens.every((item) => item.pageErrors.length === 0), `Expected no page errors: ${JSON.stringify(audit.screens)}`);
    const documentOverflowScreens = audit.screens.filter((item) => item.documentOverflow).map(({ role, width, documentScrollWidth, flowScrollBounds, overflowingElements }) => ({ role, width, documentScrollWidth, flowScrollBounds, overflowingElements }));
    assert.deepEqual(documentOverflowScreens, [], `Expected no document horizontal overflow at all viewport widths: ${JSON.stringify(documentOverflowScreens)}`);
    assert.ok(audit.screens.filter((item) => item.width <= 430).every((item) => item.flowScrollBounds?.left >= 0 && item.flowScrollBounds?.right <= item.width + 1), `Expected the seven-stage rail to stay inside the mobile viewport: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => item.workCardVisible && item.workCardCount === 1), 'Expected exactly one visible Bước xử lý card');
    assert.ok(audit.screens.every((item) => item.selectedStepPanelVisible && item.selectedStepPanelCount === 1), 'Expected one selected-step panel inside the work card');
    assert.ok(audit.screens.every((item) => item.flowStageCount === 7 && item.flowStageNumbers.join(',') === '01,02,03,04,05,06,07' && item.selectedFlowStageCount === 1), 'Expected exactly seven numbered 01–07 stages');
    assert.ok(audit.screens.every((item) => item.relatedDocumentsVisible && item.relatedDocumentsHeading === 'Tài liệu và hồ sơ liên quan' && item.relatedDocumentsTableCount === 1), 'Expected one prominent related-documents table below the selected stage');
    assert.ok(audit.screens.every((item) => item.readerCount === 1 && item.readerIsRightColumn), 'Expected the right column to contain one private document reader');
    assert.ok(audit.screens.filter((item) => item.width <= 430).every((item) => item.mobileTabCount === 2 && item.mobileReaderTabHeight >= 44), 'Expected 44px Work/Reader tabs on mobile');
    assert.ok(audit.screens.filter((item) => item.width >= 1024).every((item) => item.workToReaderRatio >= 0.58 && item.workToReaderRatio <= 0.62), 'Expected a roughly 60/40 work-to-reader layout on desktop');
  } finally {
    await browser.close();
  }
});

test('D09 keyboard navigation preserves the selected stage and mobile Work/Reader tabs', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const audit = { apiMutations: [], externalRequests: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ROLES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openD09Detail(page, base, role, audit);

      const workCard = page.getByTestId('pgd-dossier-step-work-panel');
      assert.equal(await workCard.count(), 1, role.id + ': one Bước xử lý card owns the stage navigation');
      const flow = workCard.getByRole('tablist', { name: 'Các giai đoạn xử lý hồ sơ PGD' });
      const stageTabs = flow.getByRole('tab');
      assert.equal(await stageTabs.count(), 7, role.id + ': all seven stages remain available for review');
      const selectedBefore = await stageTabs.evaluateAll((tabs) => tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
      assert.ok(selectedBefore > 0, role.id + ': the fixture exposes an earlier stage for keyboard navigation');
      await stageTabs.nth(selectedBefore).focus();
      await page.keyboard.press('ArrowLeft');
      const selectedAfterLeft = await stageTabs.evaluateAll((tabs) => tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
      assert.equal(selectedAfterLeft, selectedBefore - 1, role.id + ': keyboard can inspect the prior stage');
      await page.keyboard.press('ArrowRight');
      const selectedAfterRight = await stageTabs.evaluateAll((tabs) => tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
      assert.equal(selectedAfterRight, selectedBefore, role.id + ': keyboard can return to the selected stage');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab'), true, role.id + ': workflow keyboard focus remains on a tab');
      assert.equal(await page.getByTestId('pgd-dossier-selected-step-panel').isVisible(), true, role.id + ': selected-step work remains visible after keyboard navigation');

      const uploadButtonCount = await page.getByRole('button', { name: /Tải tệp phụ trợ cho giai đoạn/ }).count();
      assert.equal(uploadButtonCount > 0, role.id !== 'viewer', role.id + ': supplementary upload follows the role permission');

      const mobileReaderTab = page.locator('#pgd-dossier-mobile-tab-reader');
      assert.equal(await mobileReaderTab.getAttribute('aria-selected'), 'false', role.id + ': work starts selected on mobile');
      await mobileReaderTab.click();
      assert.equal(await mobileReaderTab.getAttribute('aria-selected'), 'true', role.id + ': mobile Reader tab becomes selected');
      await page.getByTestId('pgd-dossier-document-reader').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#pgd-dossier-work-region').isVisible(), false, role.id + ': mobile Reader view hides the work region');
      await page.locator('#pgd-dossier-mobile-tab-work').click();
      assert.equal(await page.locator('#pgd-dossier-work-region').isVisible(), true, role.id + ': mobile Work tab returns to the stage card');
      assert.deepEqual(pageErrors, [], role.id + ': no browser runtime errors');

      if (role.id === 'admin') {
        await page.evaluate(() => {
          const scrollArea = document.querySelector('[data-testid="pgd-dossier-scroll-area"]');
          const main = document.querySelector('#pgdcn-main-content');
          if (scrollArea) scrollArea.scrollTop = 0;
          if (main) main.scrollTop = 0;
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(80);
        await saveScreenshot(page, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'reader-work');
        await collectDetailMetrics(page, role, { width: 390, height: 844 }, pageErrors);
      }
      await page.close();
    }

    assert.deepEqual(audit.apiMutations, [], 'Expected zero API mutations: ' + JSON.stringify(audit.apiMutations));
    assert.deepEqual(audit.externalRequests, [], 'Expected zero external requests: ' + JSON.stringify(audit.externalRequests));
  } finally {
    await browser.close();
  }
});

test('D09 loading and evidence errors remain visible while the next action stays gated', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const role = ROLES[0];
  const audit = { apiMutations: [], externalRequests: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const loadingPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openD09Detail(loadingPage, base, role, audit, 'loading');
    const loadingStatus = loadingPage.getByRole('status').filter({ hasText: 'Đang tải trạng thái chứng từ hồ sơ' });
    await loadingStatus.waitFor({ state: 'visible', timeout: 5000 });
    const loadingStep = loadingPage.getByTestId('pgd-dossier-selected-step-panel');
    assert.equal(await loadingStep.count(), 1, 'The current stage stays visible while evidence is loading');
    assert.equal(await loadingStep.locator('header button').first().isDisabled(), true, 'The current-stage action remains gated while evidence is loading');
    await saveScreenshot(loadingPage, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'loading');
    await loadingStatus.waitFor({ state: 'hidden', timeout: 5000 });
    await loadingPage.close();

    const errorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openD09Detail(errorPage, base, role, audit, 'error');
    const loadError = errorPage.getByRole('alert').filter({ hasText: 'Không thể tải trạng thái chứng từ' });
    await loadError.waitFor({ state: 'visible', timeout: 5000 });
    const errorStep = errorPage.getByTestId('pgd-dossier-selected-step-panel');
    assert.equal(await errorStep.count(), 1, 'The current stage stays visible while evidence is unavailable');
    assert.equal(await errorStep.locator('header button').first().isDisabled(), true, 'The current-stage action stays gated while evidence is unavailable');
    assert.equal(await errorPage.getByRole('button', { name: 'Tải lại tài liệu' }).isVisible(), true);
    await saveScreenshot(errorPage, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'error');
    await errorPage.close();

    assert.deepEqual(audit.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected zero external requests: ${JSON.stringify(audit.externalRequests)}`);
  } finally {
    await browser.close();
  }
});
