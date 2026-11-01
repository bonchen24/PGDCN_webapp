import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;
const artifactRoot = resolve('docs/ux-audit/artifacts/density/next-batch/d09');

const ROLES = [
  { id: 'admin', role: 'admin', systemRole: 'admin', pgdRole: 'PGD_LEAD' },
  { id: 'staff', role: 'staff', systemRole: 'staff', pgdRole: 'PGD_INSPECTOR' },
  { id: 'viewer', role: 'viewer', systemRole: 'viewer', pgdRole: 'PGD_VIEWER' },
];

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
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
    const priority = detail?.querySelector('[data-testid="pgd-dossier-priority-action"]') || null;
    const priorityCta = detail?.querySelector('[data-testid="pgd-dossier-priority-cta"]') || null;
    const stepDetails = detail?.querySelector('[data-testid="pgd-dossier-step-work-disclosure"]') || null;
    const stepPanel = detail?.querySelector('[data-testid="pgd-dossier-step-work-panel"]') || null;
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
    const title = priority?.querySelector('h2');
    const priorityGate = detail?.querySelector('[data-testid="pgd-dossier-priority-gate"]') || null;
    const globalEvidence = detail?.querySelector('[data-testid="pgd-dossier-global-evidence-disclosure"]') || null;
    const missingResultRow = Array.from(detail?.querySelectorAll('[data-testid="pgd-dossier-document-action-table"] tbody tr') || []).find((row) => /Kết quả PTN/iu.test(row.textContent || '')) || null;
    const missingResultAction = missingResultRow?.querySelector('a, button, [role="button"]') || null;
    return {
      role: roleId,
      width: screen.width,
      height: screen.height,
      currentStepHeading: title?.textContent?.trim() || null,
      priorityVisible: visible(priority),
      priorityBounds: rect(priority),
      primaryCtaVisible: visible(priorityCta),
      primaryCtaBounds: rect(priorityCta),
      primaryCtaDisabled: priorityCta ? priorityCta.hasAttribute('disabled') : null,
      primaryCtaText: priorityCta?.textContent?.trim() || null,
      priorityGateText: priorityGate?.textContent?.trim() || null,
      priorityCtaHasOneReadableBlocker: Boolean(priorityGate?.textContent?.trim()) && !/SAMPLE_HANDOVER|LAB_REQUEST|,/u.test(priorityGate?.textContent || ''),
      globalEvidenceCollapsed: Boolean(globalEvidence && !globalEvidence.hasAttribute('open')),
      missingResultActionText: missingResultAction?.textContent?.trim() || '',
      missingResultActionAccessibleName: missingResultAction?.getAttribute('aria-label') || missingResultAction?.getAttribute('title') || '',
      stepDetailsOpen: stepDetails?.hasAttribute('open') ?? null,
      stepDetailsHeight: rect(stepDetails)?.height ?? null,
      stepPanelVisible: visible(stepPanel),
      stepPanelHeight: visible(stepPanel) ? rect(stepPanel)?.height ?? null : 0,
      buttonsDom: allButtons.length,
      buttonsVisible: visibleButtons.length,
      fieldsDom: allFields.length,
      fieldsVisible: visibleFields.length,
      tablesDom: allTables.length,
      tablesVisible: visibleTables.length,
      workflowDisclosureCount: detail?.querySelectorAll('details').length ?? 0,
      openDisclosureCount: detail?.querySelectorAll('details[open]').length ?? 0,
      documentOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth,
      pageScrollerHeight: detail?.querySelector('[data-testid="pgd-dossier-scroll-area"]')?.scrollHeight ?? null,
      pageScrollerTop: detail?.querySelector('[data-testid="pgd-dossier-scroll-area"]')?.scrollTop ?? null,
    };
  }, { roleId: role.id, screen: viewport });
  metrics.pageErrors = [...pageErrors];
  return metrics;
}

test('D09 PGD detail leads with the current step and gated next action for all roles and target widths', {
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
      await page.getByTestId('pgd-dossier-priority-gate').waitFor({ state: 'visible', timeout: 5000 });
      if (role.id === 'admin') await page.getByRole('button', { name: 'Bổ sung tệp' }).first().waitFor({ state: 'visible', timeout: 5000 });

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

    console.log('D09 PGD detail observations:', JSON.stringify(audit.screens));
    assert.deepEqual(audit.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected zero external requests: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.screens.every((item) => item.pageErrors.length === 0), `Expected no page errors: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => !item.documentOverflow), `Expected no document horizontal overflow: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => item.globalEvidenceCollapsed), `Secondary whole-dossier evidence must be collapsed outside the selected step workbench: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => item.primaryCtaDisabled === false && /Mở|Xem|Bổ sung/iu.test(item.primaryCtaText || '')), `A blocked step must lead to one usable remediation/navigation action: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => item.priorityCtaHasOneReadableBlocker), `The priority message must explain one blocker in user-facing language: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.filter((item) => item.role === 'admin').every((item) => item.missingResultActionText && /Bổ sung|Tải|Mở|Tạo/iu.test(item.missingResultActionText)), `A missing result row needs one visible, named primary action: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((item) => item.priorityVisible && item.primaryCtaVisible), `Expected current step and primary action to be visible for every role and viewport: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.filter((item) => item.width <= 430).every((item) => item.priorityBounds.top < 360 && item.primaryCtaBounds.height >= 44), `Expected the current step and a 44px primary action near the top on mobile: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.filter((item) => item.role === 'viewer').every((item) => /Xem|Mở/iu.test(item.primaryCtaText || '')), `Read-only users must receive a navigation action instead of a disabled mutation: ${JSON.stringify(audit.screens)}`);
  } finally {
    await browser.close();
  }
});

test('D09 disclosures keep checklist evidence available and keyboard navigation can return to the current step', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const audit = { apiMutations: [], externalRequests: [] };
  const browser = await chromium.launch({ headless: true });
  const expandedMetrics = [];
  try {
    for (const role of ROLES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openD09Detail(page, base, role, audit);

      const priority = page.getByTestId('pgd-dossier-priority-action');
      assert.equal(await priority.count(), 1, `${role.id}: the current-step priority panel is present`);
      await priority.waitFor({ state: 'visible', timeout: 5000 });
      const priorityCta = page.getByTestId('pgd-dossier-priority-cta');
      assert.equal(await priorityCta.isVisible(), true, `${role.id}: the primary action stays visible`);
      if (role.id === 'viewer') {
        assert.equal(await priorityCta.isDisabled(), false, 'viewer: navigation to the current step remains available');
        assert.match(await priorityCta.textContent(), /Xem bước hiện tại/iu, 'viewer: the CTA is navigation rather than a mutation');
      }
      const priorityGuidance = page.locator('#pgd-dossier-priority-guidance');
      if (role.id === 'viewer') {
        await priorityGuidance.getByText(/Chỉ xem hồ sơ/).waitFor({ state: 'visible' });
      } else {
        assert.equal(await priorityGuidance.getByText(/Chỉ xem hồ sơ/).count(), 0, `${role.id}: authorized role is not labeled read-only`);
      }

      const workDetails = page.getByTestId('pgd-dossier-step-work-disclosure');
      assert.equal(await workDetails.count(), 1, `${role.id}: the current-step checklist disclosure is present`);
      assert.equal(await workDetails.evaluate((element) => element.open), true, `${role.id}: the current-step checklist is available by default`);
      const workSummary = workDetails.locator(':scope > summary');
      await workSummary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await workDetails.evaluate((element) => element.open), false, `${role.id}: keyboard can close the current-step checklist disclosure`);
      await page.keyboard.press('Enter');
      assert.equal(await workDetails.evaluate((element) => element.open), true, `${role.id}: keyboard reopens the current-step checklist disclosure`);
      await page.getByRole('heading', { name: 'Tài liệu cần hoàn thiện' }).waitFor({ state: 'visible' });
      await page.getByText(/Soát xét bước này/).waitFor({ state: 'visible' });

      const businessDetails = page.getByTestId('pgd-dossier-business-disclosure');
      await businessDetails.locator(':scope > summary').click();
      assert.equal(await businessDetails.evaluate((element) => element.open), true, `${role.id}: the dossier, samples, and history disclosure opens`);
      await page.getByText(/Event Timeline \/ Work Log/).waitFor({ state: 'visible' });
      const sampleTracker = businessDetails.getByTestId('dossier-sample-tracker');
      await sampleTracker.locator(':scope > summary').click();
      await page.getByText(/Chưa có mẫu entity/).waitFor({ state: 'visible' });
      const eventTimeline = businessDetails.getByTestId('dossier-event-timeline');
      await eventTimeline.locator(':scope > summary').click();
      await page.getByText(/Chưa có sự kiện nghiệp vụ/).waitFor({ state: 'visible' });

      const workflowRail = page.getByTestId('pgd-dossier-workflow-rail');
      await workflowRail.waitFor({ state: 'visible' });
      const flow = page.getByRole('tablist', { name: 'Các việc xử lý hồ sơ PGD' });
      const currentTab = flow.getByRole('tab', { name: /Tiếp nhận KQTN/ });
      const intakeTab = flow.getByRole('tab', { name: /Giao mẫu \/ lập PYC PTN/ });
      assert.equal(await currentTab.getAttribute('aria-selected'), 'true', `${role.id}: the fixture remains at the current workflow step`);
      await currentTab.focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await intakeTab.getAttribute('aria-selected'), 'true', `${role.id}: keyboard can inspect the prior step`);
      await page.keyboard.press('ArrowRight');
      assert.equal(await currentTab.getAttribute('aria-selected'), 'true', `${role.id}: keyboard can return to the current step`);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab'), true, `${role.id}: workflow keyboard focus remains on a tab`);
      assert.equal(await priorityCta.isVisible(), true, `${role.id}: the current action remains visible after returning to its step`);
      assert.equal(await page.getByTestId('pgd-dossier-step-work-state').textContent(), 'Đang mở');
      assert.equal(await page.getByTestId('pgd-dossier-business-state').textContent(), 'Đang mở');
      assert.equal(await workflowRail.isVisible(), true, `${role.id}: the selected-step rail remains visible after review`);
      assert.deepEqual(pageErrors, [], `${role.id}: no browser runtime errors`);

      if (role.id === 'admin') {
        await page.evaluate(() => {
          const scrollArea = document.querySelector('[data-testid="pgd-dossier-scroll-area"]');
          const main = document.querySelector('#pgdcn-main-content');
          if (scrollArea) scrollArea.scrollTop = 0;
          if (main) main.scrollTop = 0;
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(80);
        await saveScreenshot(page, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'panels-open');
        expandedMetrics.push(await collectDetailMetrics(page, role, { width: 390, height: 844 }, pageErrors));
      }
      await page.close();
    }

    if (expandedMetrics.length) {
      const phase = process.env.PGDCN_DENSITY_PHASE;
      const directory = resolve(artifactRoot, phase);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'panels-open-metrics.json'), `${JSON.stringify(expandedMetrics, null, 2)}\n`, 'utf8');
    }

    assert.deepEqual(audit.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected zero external requests: ${JSON.stringify(audit.externalRequests)}`);
  } finally {
    await browser.close();
  }
});

test('D09 loading and evidence errors keep navigation available while completion mutations stay gated', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const role = ROLES[0];
  const audit = { apiMutations: [], externalRequests: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const loadingPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openD09Detail(loadingPage, base, role, audit, 'loading');
    const loadingStatus = loadingPage.getByTestId('pgd-dossier-priority-action').getByRole('status');
    await loadingStatus.waitFor({ state: 'visible', timeout: 5000 });
    const loadingCta = loadingPage.getByTestId('pgd-dossier-priority-cta');
    assert.equal(await loadingCta.count(), 1, 'The primary action stays visible while evidence is loading');
    assert.equal(await loadingCta.isDisabled(), false, 'Navigation remains available while evidence is loading');
    assert.match(await loadingCta.textContent(), /Mở|Xem/iu);
    await saveScreenshot(loadingPage, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'loading');
    await loadingStatus.waitFor({ state: 'hidden', timeout: 5000 });
    await loadingPage.close();

    const errorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openD09Detail(errorPage, base, role, audit, 'error');
    const loadError = errorPage.getByTestId('pgd-dossier-priority-action').getByRole('alert');
    await loadError.waitFor({ state: 'visible', timeout: 5000 });
    const errorCta = errorPage.getByTestId('pgd-dossier-priority-cta');
    assert.equal(await errorCta.count(), 1, 'The primary action stays visible while evidence is unavailable');
    assert.equal(await errorCta.isDisabled(), false, 'Navigation remains available while evidence is unavailable');
    assert.match(await errorCta.textContent(), /Mở|Xem/iu);
    assert.equal(await errorPage.getByTestId('pgd-dossier-priority-action').getByRole('button', { name: 'Tải lại tài liệu' }).isVisible(), true);
    await saveScreenshot(errorPage, process.env.PGDCN_DENSITY_PHASE, role.id, { width: 390, height: 844 }, 'error');
    await errorPage.close();

    assert.deepEqual(audit.apiMutations, [], `Expected zero API mutations: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Expected zero external requests: ${JSON.stringify(audit.externalRequests)}`);
  } finally {
    await browser.close();
  }
});
