import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;
const artifactRootBase = resolve('docs/ux-audit/artifacts/density/coverage-2026-10-28');
const artifactSet = String(process.env.PGDCN_COVERAGE_ARTIFACT_SET || '').trim();
assert.ok(!artifactSet || /^[a-z0-9-]+$/iu.test(artifactSet), `Invalid artifact set name: ${artifactSet}`);
const artifactRoot = resolve(artifactRootBase, artifactSet);
const d13Mode = process.env.PGDCN_COVERAGE_D13_MODE === 'before' ? 'before' : 'after';
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
];

function requestedViewports() {
  const raw = String(process.env.PGDCN_COVERAGE_VIEWPORTS || '').trim();
  if (!raw) return VIEWPORTS;
  return raw.split(',').map((entry) => {
    const [width, height] = entry.trim().split('x').map(Number);
    assert.ok(Number.isInteger(width) && width >= 240 && width <= 3000, `Invalid viewport width: ${entry}`);
    assert.ok(Number.isInteger(height) && height >= 400 && height <= 3000, `Invalid viewport height: ${entry}`);
    return { width, height };
  });
}

const ROLES = {
  admin: {
    id: 'admin', username: 'synthetic_density_admin', name: 'Synthetic Admin', role: 'admin', systemRole: 'admin',
    departmentRoleCode: 'GD', fieldCodes: ['QC4'], active: true, departmentScopes: ['PCN', 'PGD'], pgdRole: 'PGD_LEAD',
  },
  staff: {
    id: 'staff', username: 'synthetic_density_staff', name: 'Synthetic Staff', role: 'staff', systemRole: 'staff',
    departmentRoleCode: 'GD', fieldCodes: ['QC4'], active: true, departmentScopes: ['PCN', 'PGD'], pgdRole: 'PGD_INSPECTOR',
  },
  viewer: {
    id: 'viewer', username: 'synthetic_density_viewer', name: 'Synthetic Viewer', role: 'viewer', systemRole: 'viewer',
    departmentRoleCode: 'GD', fieldCodes: ['QC4'], active: true, departmentScopes: ['PCN'], pgdRole: 'PGD_VIEWER',
  },
};

const EMPTY_PGD_BOOTSTRAP = {
  customers: [], users: [], catalog: [], requests: [], assignments: [], fieldInspections: [], samples: [],
  labRequests: [], labResults: [], templates: [], documentTemplates: [], reports: [], certificates: [],
  approvals: [], dossierDocuments: [], documents: [], inspectionPlans: [], caseEvents: [], fieldActivityLogs: [],
  labResultReviews: [], dossierIndexes: [], calibrationInstruments: [], workflowTemplates: [],
};

const PCN_DOSSIER = {
  id: 'qa-density-pcn', dossierCode: 'PCN-QA-DENSITY-001', proposalId: 'qa-density-proposal', fieldCodes: ['QC4'],
  method: 'METHOD_1', status: 'IN_PROGRESS', ownerUsername: ROLES.admin.username,
  customerSnapshot: { name: 'Doanh nghiệp synthetic kiểm thử giao diện', address: 'Hà Nội', taxId: '0100000001' },
  labRequestIds: [], returnedResultIds: [], sampleLotIds: [], createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-10-28T08:00:00.000Z',
};

const PCN_PROPOSAL = {
  id: 'qa-density-proposal', proposalCode: 'PROP-QA-DENSITY-001', channel: 'DIRECT', status: 'CONVERTED',
  dossierId: PCN_DOSSIER.id, productName: 'Thiết bị synthetic kiểm thử mật độ giao diện', quantity: 1,
  fieldCodes: ['QC4'], receivedAt: '2026-10-28T08:00:00.000Z', createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z', customerSnapshot: PCN_DOSSIER.customerSnapshot,
};

const PCN_TEMPLATE = {
  id: 'qa-density-template-long-code-2026', displayName: 'Biểu mẫu chứng nhận đối chiếu quy trình kiểm định an toàn kỹ thuật mở rộng cho sản phẩm hàng hóa đặc thù',
  fieldCode: 'QC4', documentKind: 'DECISION', variant: '2.4', format: 'DOCX', status: 'APPROVED', placeholderKeys: [],
  requiredPlaceholderKeys: [], sourceFingerprint: { sha256: '0'.repeat(64), byteSize: 1024, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  importedAt: '2026-10-28T08:00:00.000Z', importedByUsername: ROLES.admin.username,
};

function makePgdRequest(id, status = 'WAITING_LAB_RESULTS', index = 1) {
  const suffix = String(index).padStart(3, '0');
  return {
    domain: 'pgd', id, requestCode: `PGD-DENSITY-${suffix}-LONG-SYNTHETIC-CODE`, intakeChannel: 'DIRECT',
    requester: { name: `Đơn vị yêu cầu kiểm thử synthetic số ${suffix} với tên dài nhiều thành phần` },
    customerSnapshot: { name: `Công ty kiểm thử synthetic số ${suffix} với tên doanh nghiệp rất dài để xem cắt cụt`, address: 'Số 123 đường Kiểm thử giao diện, quận Cầu Giấy, thành phố Hà Nội', taxId: `010000${suffix}` },
    productGroup: 'STEEL_METAL', catalogItemId: 'qa-catalog', productName: `Sản phẩm kiểm thử giao diện PGD ${suffix} với tên hàng hóa có nhiều từ và mã nhận diện dài`,
    lotCode: `LO-THU-NGHIEM-2026-VERY-LONG-CODE-${suffix}`, quantity: 125 + index, unit: 'tấn', weight: 125 + index,
    inspectionScope: 'Kiểm tra tổng hợp theo fixture synthetic; đối chiếu hồ sơ, sản phẩm và tiêu chuẩn kỹ thuật trong toàn bộ phạm vi yêu cầu.',
    inspectionLocation: 'Kho kiểm thử PGDCN, khu vực tiếp nhận synthetic', standards: ['TCVN QA 001', 'ASTM QA 002'], status,
    documentPointers: [], sampleIds: [], labRequestIds: [], createdAt: `2026-10-${String(10 + (index % 18)).padStart(2, '0')}T08:00:00.000Z`,
    updatedAt: '2026-10-28T08:00:00.000Z', dossierChecklist: [],
  };
}

function makePgdSample(index, requestId) {
  const suffix = String(index).padStart(3, '0');
  return {
    id: `qa-density-sample-${suffix}`, domain: 'PGD', requestId, sampleCode: `MẪU-QA-${suffix}-MÃ-THỬ-NGHIỆM-RẤT-DÀI`,
    sampleTypeLabel: `Mẫu kiểm thử số ${suffix}`, customLabel: `Hàng hóa synthetic ${suffix} với mô tả có nhiều từ`,
    description: 'Dòng mô tả synthetic dài để kiểm tra nội dung bảng, cắt cụt, vùng cuộn và trạng thái hành động.',
    quantity: 2 + index, unit: 'mẫu', disposition: index % 2 ? 'LAB' : 'RETAINED', sealNumber: `SEAL-QA-${suffix}-LONG-CODE`,
    laboratoryName: 'Phòng thử nghiệm synthetic với tên dài để kiểm tra giao diện',
  };
}

const CUSTOMER_FIXTURES = Array.from({ length: 18 }, (_, index) => ({
  name: `Công ty synthetic ${String(index + 1).padStart(2, '0')} có tên dài để kiểm tra layout và cắt cụt trên màn hình nhỏ`,
  address: 'Số 123 đường Kiểm thử giao diện, phường Trung Hòa, quận Cầu Giấy, thành phố Hà Nội',
  taxId: `01012345${String(index + 1).padStart(2, '0')}`, phone: '024-5555-0123', email: `qa-${index + 1}@example.invalid`,
  contactPerson: 'Nguyễn Thị Synthetic QA', customerCode: `KH-QA-DENSITY-${String(index + 1).padStart(3, '0')}`,
}));

const NOTIFICATION_FIXTURES = Array.from({ length: 32 }, (_, index) => ({
  id: `qa-density-notification-${index + 1}`, domain: index % 2 ? 'PGD' : 'PCN', type: 'STATUS_CHANGE',
  title: `Thông báo synthetic ${index + 1}: hồ sơ có cập nhật trạng thái và nội dung dài để kiểm tra vùng đọc`,
  message: 'Nội dung synthetic nhiều dòng cho audit: vui lòng mở hồ sơ đúng phân hệ, kiểm tra hạn xử lý, bước hiện tại, người phụ trách và hành động kế tiếp theo phạm vi được cấp.',
  entityType: index % 2 ? 'PGD_REQUEST' : 'PCN_DOSSIER', entityId: index % 2 ? 'qa-density-pgd' : PCN_DOSSIER.id,
  entityLabel: `HỒ SƠ-QA-${String(index + 1).padStart(3, '0')}`, createdAt: `2026-10-28T08:${String(index % 60).padStart(2, '0')}:00.000Z`,
  read: index % 4 === 0, targetRole: 'all', targetUsernames: [],
}));

function makeLongPgdBootstrap() {
  const requests = Array.from({ length: 18 }, (_, index) => makePgdRequest(`qa-density-pgd-${index + 1}`, index % 3 ? 'WAITING_LAB_RESULTS' : 'RESULTS_REVIEW', index + 1));
  return {
    ...EMPTY_PGD_BOOTSTRAP,
    catalog: [{ id: 'qa-catalog', domain: 'PGD', code: 'GĐ-QA-01', name: 'Danh mục kiểm thử synthetic', productGroup: 'STEEL_METAL', inspectionTypes: ['Kiểm tra synthetic'], methodOptions: [{ code: 'QA-01', name: 'Phương pháp synthetic' }], defaultStandards: ['TCVN QA 001'], slaLabel: '5–7 ngày', active: true }],
    requests,
    samples: Array.from({ length: 28 }, (_, index) => makePgdSample(index + 1, requests[index % requests.length].id)),
  };
}

function collectionItems(pathname, options) {
  const path = pathname.toLowerCase();
  if (path.includes('certificationdossiers')) return options.pcnDossiers || [];
  if (path.includes('certificationproposals')) return options.pcnProposals || [];
  if (path.includes('dossierdocuments')) return options.pcnDocuments || [];
  if (path.includes('pcntemplatedefinitions') || path.includes('pcntemplates')) return options.pcnTemplates || [];
  if (path.includes('customer')) return options.customers || [];
  if (path.includes('samplelots')) return options.pcnSampleLots || [];
  if (path.includes('sampleitems')) return options.pcnSampleItems || [];
  if (path.includes('sampleroutes')) return options.pcnSampleRoutes || [];
  if (path.includes('labrequests')) return options.pcnLabRequests || [];
  if (path.includes('returnedtestresults')) return options.pcnResults || [];
  if (path.includes('sample-request-bundles')) return options.pcnSampleBundles || [];
  return [];
}

async function installMocks(page, baseOrigin, role, options, audit) {
  page.on('pageerror', (error) => audit.pageErrors.push({ scenario: options.scenario, message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') audit.consoleErrors.push({ scenario: options.scenario, message: message.text() });
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (url.origin !== baseOrigin) {
      audit.externalRequests.push({ scenario: options.scenario, url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    audit.apiGets.push({ scenario: options.scenario, path: url.pathname, statusMode: options.errorPath === url.pathname ? 'error' : options.loadingPath === url.pathname ? 'loading' : 'fixture' });
    if (method !== 'GET') {
      audit.apiMutationAttempts.push({ scenario: options.scenario, url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }
    if (url.pathname === '/api/auth/pcn-session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, user: role }) });
      return;
    }
    if (options.loadingPath === url.pathname) await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
    if (options.errorPath === url.pathname) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: `Synthetic QA error for ${options.scenario}` }) });
      return;
    }
    if (url.pathname === '/api/db-meta') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: {} }) });
      return;
    }
    if (url.pathname === '/api/pgd/bootstrap') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.pgdBootstrap || EMPTY_PGD_BOOTSTRAP) });
      return;
    }
    if (url.pathname === '/api/pgdcn/notifications' || url.pathname === '/api/pcn/notifications') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: options.notifications || [] }) });
      return;
    }
    if (url.pathname === '/api/pcn/approval-assistant/candidates') {
      const items = options.aiCandidates || (options.pcnDossiers || []).map((dossier) => ({
        dossierId: dossier.id,
        dossierCode: dossier.dossierCode,
        fieldCode: dossier.fieldCodes?.[0] || 'QC4',
        status: dossier.status,
        customerName: dossier.customerSnapshot?.name || 'Chưa có khách hàng',
        productName: dossier.productName || 'Sản phẩm synthetic',
        ownerUsername: dossier.ownerUsername || role.username,
        targetDate: '2026-11-02',
        missingDocuments: [],
        completenessScore: 88,
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
      return;
    }
    if (url.pathname.endsWith('/dossier-documents') && url.pathname.startsWith('/api/pgd/requests/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dossierDocuments: [], requirements: [] }) });
      return;
    }
    if (url.pathname.startsWith('/api/db/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: collectionItems(url.pathname, options) }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function openMobileMenu(page, viewport) {
  if (viewport.width >= 1024) return;
  const trigger = page.getByRole('button', { name: 'Mở menu phòng' });
  if (await trigger.isVisible().catch(() => false)) await trigger.click();
}

async function navigateShell(page, viewport, label) {
  await openMobileMenu(page, viewport);
  const target = page.getByRole('button', { name: label, exact: true });
  try {
    await target.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    const visibleButtons = await page.locator('button').evaluateAll((buttons) => buttons.filter((button) => button.getClientRects().length).map((button) => (button.getAttribute('aria-label') || button.innerText || '').trim().replace(/\s+/g, ' ')).slice(0, 80));
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 700);
    throw new Error(`Menu item not visible: ${label}; buttons=${JSON.stringify(visibleButtons)}; body=${JSON.stringify(bodyText)}`);
  }
  await target.click();
  await page.waitForTimeout(220);
}

async function selectDraftingDomain(page, domain) {
  const label = domain === 'PGD' ? 'Giám định (PGD)' : 'Chứng nhận (PCN)';
  const radio = page.getByRole('radio', { name: label, exact: true });
  if (await radio.count()) await radio.check();
  else {
    const button = page.getByRole('button', { name: label, exact: true });
    if (await button.count()) await button.click();
  }
  await page.waitForTimeout(180);
}

async function openPgdDataTable(page) {
  const tab = page.getByRole('tab', { name: 'Sổ dữ liệu', exact: true });
  if (await tab.count()) await tab.click();
  await page.waitForTimeout(180);
}

async function collectPageMetrics(page, role, scenario, viewport, fixtureMarkers = []) {
  return page.evaluate(({ roleId, scenarioId, screen, expectedFixtureMarkers }) => {
    const visible = (element) => {
      if (!element.getClientRects().length) return false;
      if (element.closest('details:not([open])')) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const nameOf = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    const bounds = (element) => {
      const r = element.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right) };
    };
    const allButtons = Array.from(document.querySelectorAll('button')).filter(visible);
    const allLinks = Array.from(document.querySelectorAll('a[href]')).filter(visible);
    const allFields = Array.from(document.querySelectorAll('input, select, textarea')).filter(visible);
    const actions = allButtons.map((button) => ({ name: nameOf(button), disabled: button.disabled, bounds: bounds(button) }));
    const mutationPattern = /^(tạo|lưu|xóa|gửi|cập nhật|sửa|phê duyệt|từ chối|hoàn tất|cấp số|thu hồi|đánh dấu|đọc tất cả)/iu;
    const mutationLike = actions.filter((action) => mutationPattern.test(action.name));
    const root = document.documentElement;
    const body = document.body;
    const visibleBodyText = body.innerText.replace(/\s+/g, ' ').trim();
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
    const clipped = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!visible(element) || !element.textContent?.trim()) return false;
      const style = getComputedStyle(element);
      const hiddenOverflow = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
      const clamp = style.webkitLineClamp && style.webkitLineClamp !== 'none';
      return (hiddenOverflow || clamp) && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2);
    }).slice(0, 30).map((element) => ({ name: nameOf(element), bounds: bounds(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, className: String(element.className || '').slice(0, 100) }));
    const scrollContainers = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!visible(element) || element.scrollWidth <= element.clientWidth + 2) return false;
      const x = getComputedStyle(element).overflowX;
      return x === 'auto' || x === 'scroll';
    }).slice(0, 20).map((element) => ({ name: nameOf(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX, bounds: bounds(element) }));
    const sticky = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!visible(element)) return false;
      const position = getComputedStyle(element).position;
      return (position === 'fixed' || position === 'sticky') && bounds(element).height > 0;
    }).slice(0, 30).map((element) => ({ name: nameOf(element), position: getComputedStyle(element).position, zIndex: getComputedStyle(element).zIndex, bounds: bounds(element) }));
    const active = document.activeElement;
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]')).filter(visible).map(nameOf).filter(Boolean).slice(0, 40);
    const fieldNames = allFields.map((field) => ({
      name: field.getAttribute('aria-label') || field.labels?.[0]?.innerText?.trim() || field.getAttribute('placeholder') || field.name || field.id || field.type || field.tagName.toLowerCase(),
      type: field.type || field.tagName.toLowerCase(), required: Boolean(field.required), disabled: Boolean(field.disabled), bounds: bounds(field),
    }));
    const documentWidth = Math.max(root.scrollWidth, body.scrollWidth);
    return {
      role: roleId, scenario: scenarioId, state: scenarioId.split('-').slice(-1)[0], viewport: screen,
      url: location.pathname + location.search, title: document.title, headings,
      nextActionCandidates: actions.filter((action) => /mở hồ sơ|tiếp theo|bắt đầu|tạo pyc|xem hồ sơ|xử lý|cấp chứng chỉ|ban hành|trả kết quả/iu.test(action.name)),
      visibleActions: actions, visibleLinks: allLinks.map((link) => ({ name: nameOf(link), href: link.getAttribute('href'), bounds: bounds(link) })),
      visibleFields: fieldNames, visibleFieldControlCount: fieldNames.length, visibleButtonCount: actions.length, visibleLinkCount: allLinks.length,
      mutationLikeButtons: mutationLike, documentClientWidth: root.clientWidth, documentScrollWidth: documentWidth,
      horizontalOverflowPx: Math.max(0, documentWidth - root.clientWidth), scrollContainers, clippedOrTruncated: clipped, stickyElements: sticky,
      focus: active ? { tag: active.tagName.toLowerCase(), role: active.getAttribute('role'), name: nameOf(active), bounds: bounds(active), outlineStyle: getComputedStyle(active).outlineStyle, outlineWidth: getComputedStyle(active).outlineWidth } : null,
      tableCount: Array.from(document.querySelectorAll('table')).filter(visible).length,
      tableRowCount: Array.from(document.querySelectorAll('table tbody tr')).filter(visible).length,
      cardCount: Array.from(document.querySelectorAll('article,[role="listitem"]')).filter(visible).length,
      notificationItemCount: dialogs.reduce((total, dialog) => total + dialog.querySelectorAll('button[aria-label^="Đánh dấu đã đọc"],button[aria-label^="Đã đọc"]').length, 0),
      assistantCandidateCount: document.querySelectorAll('input[type="radio"][name="approval-assistant-dossier"]').length,
      fixtureMarkersExpected: expectedFixtureMarkers,
      fixtureMarkersVisible: expectedFixtureMarkers.filter((marker) => visibleBodyText.includes(marker)),
      visibleTextExcerpt: visibleBodyText.slice(0, 700),
      stateTextEvidence: Array.from(document.querySelectorAll('[role="alert"],[role="status"], [aria-live]')).filter(visible).map(nameOf).filter(Boolean).slice(0, 20),
    };
  }, { roleId: role.id, scenarioId: scenario.id || scenario, screen: viewport, expectedFixtureMarkers: fixtureMarkers });
}

async function captureScenario(browser, base, scenario, viewport, audit) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(10000);
  const role = scenario.role;
  await installMocks(page, base.origin, role, { ...scenario, scenario: scenario.id }, audit);
  try {
    console.log(`[coverage] start ${scenario.id} ${viewport.width}x${viewport.height}`);
    await page.goto(new URL(scenario.path || '/pgdcn', base).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.body.innerText.includes('Đang xác thực phiên PGDCN...'), null, { timeout: 15000 }).catch(() => undefined);
    if (scenario.menu) await navigateShell(page, viewport, scenario.menu);
    if (scenario.openNotifications) {
      const trigger = page.locator('button[aria-label*="Thông báo" i]').first();
      if (await trigger.count()) await trigger.click();
      await page.getByRole('dialog', { name: 'Danh sách thông báo phòng' }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
    }
    if (scenario.draftingDomain) await selectDraftingDomain(page, scenario.draftingDomain);
    if (scenario.dataTable) await openPgdDataTable(page);
    if (scenario.selectDraftSource) {
      const source = page.getByRole('combobox', { name: scenario.selectDraftSource.label });
      await source.waitFor({ state: 'visible', timeout: 5000 });
      await source.fill(scenario.selectDraftSource.query);
      await source.press('ArrowDown');
      await source.press('Enter');
      await page.waitForTimeout(220);
    }
    if (scenario.openDocxSettings) {
      await page.getByRole('button', { name: /Cài đặt DOCX/ }).click();
      await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 });
    }
    if (scenario.invalidModal) scenario.intakeModal = await captureIntakeModal(page, scenario, viewport, audit);
    if (scenario.pcnIntakeModal) scenario.intakeModal = await capturePcnIntakeModal(page, viewport);
    else await page.waitForTimeout(scenario.loadingPath ? 160 : 260);

    if (scenario.waitForPgdDossier) {
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('[role="status"]')).some((element) => element.getClientRects().length && element.innerText.includes('Đang tải trạng thái chứng từ hồ sơ')), null, { timeout: 8000 });
    }
    if (scenario.errorPath) {
      await page.waitForTimeout(450);
      const matchingErrorRequest = audit.apiGets.some((item) => item.scenario === scenario.id && item.path === scenario.errorPath && item.statusMode === 'error');
      assert.ok(matchingErrorRequest, `${scenario.id} must hit its synthetic error route ${scenario.errorPath}`);
    }
    if (scenario.pgdLoadState && d13Mode === 'before') {
      assert.ok(await page.getByText('Chưa có hồ sơ PGD trong hàng đợi', { exact: false }).count(), `Baseline must expose the empty-state during PGD ${scenario.pgdLoadState}`);
    } else if (scenario.pgdLoadState === 'empty') {
      assert.ok(await page.getByText('Chưa có hồ sơ PGD trong hàng đợi', { exact: false }).count(), 'Confirmed empty queue must appear after a successful empty PGD bootstrap');
      assert.equal(await page.getByRole('status').filter({ hasText: 'Đang tải dữ liệu PGD' }).count(), 0, 'Confirmed empty state must not retain a loading message');
      assert.equal(await page.getByRole('alert').filter({ hasText: 'Không thể tải dữ liệu PGD' }).count(), 0, 'Confirmed empty state must not retain a bootstrap error');
    } else if (scenario.pgdLoadState) {
      const message = scenario.pgdLoadState === 'loading' ? 'Đang tải dữ liệu PGD' : 'Không thể tải dữ liệu PGD';
      const messageRole = scenario.pgdLoadState === 'loading' ? 'status' : 'alert';
      assert.ok(await page.getByRole(messageRole).filter({ hasText: message }).count(), `PGD ${scenario.pgdLoadState} must have a visible ${messageRole} message`);
      assert.equal(await page.getByText('Chưa có hồ sơ PGD trong hàng đợi', { exact: false }).count(), 0, 'Do not show the empty queue while PGD bootstrap is pending or failed');
      if (scenario.pgdLoadState === 'error') assert.ok(await page.getByRole('button', { name: 'Thử tải lại dữ liệu PGD' }).count(), 'PGD bootstrap error must offer a retry action');
    }
    let keyboardEvidence = null;
    if (scenario.keyboardRetry && d13Mode === 'after') {
      const retry = page.getByRole('button', { name: 'Thử tải lại dữ liệu PGD' });
      await retry.focus();
      const before = await retry.evaluate((button) => ({ focused: document.activeElement === button, height: Math.round(button.getBoundingClientRect().height), outlineWidth: getComputedStyle(button).outlineWidth }));
      const requestCount = audit.apiGets.filter((item) => item.scenario === scenario.id && item.path === '/api/pgd/bootstrap').length;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const afterCount = audit.apiGets.filter((item) => item.scenario === scenario.id && item.path === '/api/pgd/bootstrap').length;
      keyboardEvidence = { ...before, retryRequestSent: afterCount > requestCount };
      assert.equal(keyboardEvidence.focused, true, 'Retry action must receive keyboard focus');
      assert.equal(keyboardEvidence.retryRequestSent, true, 'Enter must activate retry without submitting a mutation');
    }

    if (scenario.viewerMenu) {
      await openMobileMenu(page, viewport);
      const navButtons = await page.locator('#pgdcn-sidebar button').evaluateAll((buttons) => buttons.filter((button) => button.getClientRects().length).map((button) => (button.getAttribute('aria-label') || button.innerText || '').trim().replace(/\s+/g, ' ')));
      const fixtureHasPcn = role.departmentScopes.includes('PCN');
      const fixtureHasPgd = role.departmentScopes.includes('PGD');
      assert.equal(fixtureHasPcn, true, 'Viewer fixture must have PCN scope');
      assert.equal(fixtureHasPgd, false, 'Viewer fixture must not have PGD scope');
      scenario.menuObservation = { navButtons, pcnVisible: navButtons.some((label) => /Sổ dữ liệu|Chứng nhận/u.test(label)), pgdVisible: navButtons.some((label) => /Giám định|PGD/u.test(label)), settingsVisible: navButtons.some((label) => /Cài đặt hệ thống/u.test(label)) };
      assert.equal(scenario.menuObservation.pcnVisible, true, 'Viewer must retain PCN navigation');
      assert.equal(scenario.menuObservation.pgdVisible, false, 'Viewer must not receive PGD navigation');
      assert.equal(scenario.menuObservation.settingsVisible, false, 'Viewer must not receive system settings navigation');
    }

    const metrics = await collectPageMetrics(page, role, scenario, viewport, scenario.fixtureMarkers || []);
    metrics.apiRouteModes = [...new Map(audit.apiGets.filter((item) => item.scenario === scenario.id).map((item) => [`${item.path}:${item.statusMode}`, { path: item.path, statusMode: item.statusMode }])).values()];
    if (scenario.menuObservation) metrics.menuObservation = scenario.menuObservation;
    if (scenario.intakeModal) metrics.intakeModal = scenario.intakeModal;
    if (keyboardEvidence) metrics.keyboardEvidence = keyboardEvidence;
    if (scenario.fixtureMarkers?.length) assert.ok(metrics.fixtureMarkersVisible.length > 0, `${scenario.id} must render at least one long-fixture marker`);
    if (scenario.id === 'viewer-pcn-detail-readonly') assert.equal(metrics.mutationLikeButtons.length, 0, 'Viewer dossier detail must have no mutation-like actions');
    if (scenario.id === 'pgd-register-long') assert.ok(metrics.tableRowCount >= 18, 'PGD summary register must render all 18 synthetic long-fixture rows');
    if (scenario.id === 'pgd-samples-long') assert.ok(metrics.tableRowCount >= 28, 'PGD sample register must render all 28 synthetic sample rows');
    if (scenario.id === 'pcn-samples-long') assert.ok(metrics.tableRowCount >= 24, 'PCN sample register must render all 24 synthetic sample rows');
    if (scenario.id === 'pcn-intake-modal') {
      assert.equal(scenario.intakeModal.fileInputRequired, false, 'PCN B1 file input must stay optional');
      assert.equal(scenario.intakeModal.fileInputMultiple, true, 'PCN B1 file input must accept multiple files');
      assert.deepEqual(scenario.intakeModal.selectedFileNames, ['pcn-intake-test.pdf', 'pcn-intake-test.docx']);
      assert.equal(scenario.intakeModal.horizontalOverflow, false, 'PCN intake modal must not overflow either viewport');
      assert.equal(scenario.intakeModal.footerVisible, true, 'PCN create action must remain visible in the modal footer');
    }
    if (scenario.id === 'assistant-long') assert.ok(metrics.assistantCandidateCount >= 12, 'Read-only AI assistant must render all 12 synthetic candidates');
    if (scenario.id === 'notifications-long') assert.ok(metrics.notificationItemCount >= 32, 'Notifications panel must render all 32 synthetic notification items');
    metrics.mode = 'QA_MOCKED';
    metrics.scopeFixture = role.departmentScopes;
    metrics.pageErrors = audit.pageErrors.filter((item) => item.scenario === scenario.id).map((item) => item.message);
    metrics.consoleErrors = audit.consoleErrors.filter((item) => item.scenario === scenario.id).map((item) => item.message);
    const screenshotDirectory = resolve(artifactRoot, scenario.id);
    await mkdir(screenshotDirectory, { recursive: true });
    const screenshotPath = resolve(screenshotDirectory, `${role.id}-${viewport.width}x${viewport.height}.png`);
    await page.addStyleTag({ content: '.nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: screenshotPath, animations: 'disabled', fullPage: false });
    metrics.screenshot = relative(process.cwd(), screenshotPath).replace(/\\/g, '/');
    audit.observations.push(metrics);
    console.log(`[coverage] captured ${scenario.id} ${viewport.width}x${viewport.height}`);
    return metrics;
  } finally {
    await page.close();
  }
}

async function capturePcnIntakeModal(page, viewport) {
  await page.getByRole('button', { name: 'Tạo Đề nghị', exact: true }).click();
  const modal = page.getByTestId('pcn-proposal-form-modal');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  const form = modal.locator('form');
  await form.waitFor({ state: 'visible', timeout: 5000 });
  const fileInput = form.locator('#pcn-proposal-attachment-input');
  const pdfBytes = await readFile(new URL('../revised_templates/_qa_reconciled/pcn-pyc/PCN_PYC_gui_PTN.pdf', import.meta.url));
  const docxBytes = await readFile(new URL('../revised_templates/pcn/PCN_PYC_gui_PTN.docx', import.meta.url));
  await fileInput.setInputFiles([
    { name: 'pcn-intake-test.pdf', mimeType: 'application/pdf', buffer: pdfBytes },
    { name: 'pcn-intake-test.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docxBytes },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="pcn-proposal-form-modal"] ul[aria-label*="B1"] li').length === 2);

  const metrics = await modal.evaluate((dialog) => {
    const rect = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { left: Math.round(bounds.left), right: Math.round(bounds.right), top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    };
    const input = dialog.querySelector('#pcn-proposal-attachment-input');
    const footerBounds = rect(dialog.querySelector('footer'));
    const selectedFileNames = Array.from(dialog.querySelectorAll('ul[aria-label*="B1"] li .truncate[title]')).map((item) => item.title);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialogBounds: rect(dialog),
      footerVisible: Boolean(footerBounds && footerBounds.top < innerHeight && footerBounds.bottom > 0),
      fileInputRequired: Boolean(input?.required),
      fileInputMultiple: Boolean(input?.multiple),
      fileInputAccept: input?.getAttribute('accept') || '',
      selectedFileNames,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      formValidityWithoutRequiredFields: dialog.querySelector('form')?.checkValidity() ?? null,
    };
  });
  const dir = resolve(artifactRoot, 'pcn-intake-modal');
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${viewport.width}x${viewport.height}.png`), animations: 'disabled', fullPage: false });
  return metrics;
}

async function captureIntakeModal(page, scenario, viewport, audit) {
  const trigger = page.getByRole('button', { name: /Nhận Phiếu \/ Tạo PYC|Tạo PYC/ }).first();
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.click();
  const modal = page.getByTestId('pgd-intake-modal');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  const form = modal.locator('form');
  await form.waitFor({ state: 'visible', timeout: 5000 });

  const measure = async (phase) => page.evaluate(({ phaseName }) => {
    const modal = document.querySelector('[data-testid="pgd-intake-modal"]');
    const form = modal?.querySelector('form');
    const visible = (element) => Boolean(element?.getClientRects().length && getComputedStyle(element).display !== 'none' && !element.closest('details:not([open])'));
    const nameOf = (element) => (element.getAttribute('aria-label') || element.labels?.[0]?.innerText?.trim() || element.getAttribute('placeholder') || element.getAttribute('name') || element.type || element.tagName.toLowerCase()).replace(/\s+/g, ' ');
    const rect = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) }; };
    const fields = Array.from(form?.querySelectorAll('input,select,textarea') || []);
    const visibleFields = fields.filter(visible);
    const visibleInputs = visibleFields.filter((field) => field.type !== 'hidden' && field.type !== 'file');
    const hiddenControls = fields.filter((field) => field.type === 'hidden' || field.type === 'file' || !visible(field));
    const fieldInventory = visibleInputs.map((field) => {
      const section = field.closest('section');
      const group = section?.querySelector('h2')?.innerText?.trim() || 'Không có tiêu đề nhóm';
      const enclosing = field.closest('[class*="rounded-lg"],label,fieldset') || field.parentElement;
      return { name: nameOf(field), group, type: field.type || field.tagName.toLowerCase(), required: Boolean(field.required), disabled: Boolean(field.disabled), conditional: Boolean(field.required && /ưu tiên|mác|sản phẩm|lô/iu.test(nameOf(field))), bounds: rect(field), context: (enclosing?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120) };
    });
    const uniqueFieldKeys = new Set(fieldInventory.map((field) => `${field.group}::${field.name}`));
    const labelCounts = new Map();
    for (const field of fieldInventory) labelCounts.set(field.name, (labelCounts.get(field.name) || 0) + 1);
    const footer = modal?.querySelector('[data-testid="pgd-intake-footer"]');
    const cta = modal?.querySelector('button[type="submit"]');
    const scrollContainers = Array.from(modal?.querySelectorAll('*') || []).filter((element) => {
      const style = getComputedStyle(element);
      return /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
    }).map((element) => ({ tag: element.tagName.toLowerCase(), className: String(element.className || '').slice(0, 120), scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, top: rect(element)?.top, bottom: rect(element)?.bottom }));
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const dialog = modal?.querySelector('[role="dialog"]') || modal;
    return {
      phase: phaseName, viewport: { width: innerWidth, height: innerHeight }, modalBounds: rect(modal), formHeight: form?.scrollHeight || 0,
      businessFieldControlCount: visibleInputs.length, uniqueBusinessFieldCount: uniqueFieldKeys.size,
      uniqueFieldLabelCount: labelCounts.size, repeatedFieldLabels: [...labelCounts.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count })),
      requiredFieldCount: fieldInventory.filter((field) => field.required).length, optionalFieldCount: fieldInventory.filter((field) => !field.required).length,
      conditionalRequiredFields: fieldInventory.filter((field) => field.conditional).map((field) => field.name),
      hiddenOrFileControlCount: hiddenControls.length, hiddenOrFileTypes: hiddenControls.map((field) => field.type),
      visibleButtons: Array.from(modal?.querySelectorAll('button') || []).filter(visible).map((button) => ({ name: nameOf(button), disabled: button.disabled, bounds: rect(button) })),
      fieldInventory, sectionHeadings: Array.from(form?.querySelectorAll('section h2') || []).map((heading) => heading.innerText.trim()),
      footer: { position: footerStyle?.position || null, bounds: rect(footer) }, submitCta: { name: cta ? nameOf(cta) : null, bounds: rect(cta), visibleInViewport: Boolean(cta && rect(cta).bottom > 0 && rect(cta).top < innerHeight) },
      scrollContainers, bodyScrollHeight: document.body.scrollHeight, documentOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      dialogRole: dialog?.getAttribute('role') || null, ariaModal: dialog?.getAttribute('aria-modal') || null,
    };
  }, { phaseName: phase });

  const topMetrics = await measure('top-before-submit');
  const dir = resolve(artifactRoot, 'pgd-intake-modal');
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `admin-${viewport.width}x${viewport.height}-top.png`), animations: 'disabled', fullPage: false });

  const priority = modal.getByRole('combobox', { name: /Mức ưu tiên/ });
  let urgentMetrics = null;
  if (await priority.count()) {
    await priority.click();
    await page.getByRole('option', { name: /Gấp \/ ưu tiên/ }).click();
    await page.waitForTimeout(80);
    urgentMetrics = await measure('urgent-conditional-required');
    await page.screenshot({ path: resolve(dir, `admin-${viewport.width}x${viewport.height}-urgent-conditional.png`), animations: 'disabled', fullPage: false });
    await priority.click();
    await page.getByRole('option', { name: /Bình thường/ }).click();
    await page.waitForTimeout(80);
  }

  const tabbables = modal.locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])').filter({ visible: true });
  const tabbableCount = await tabbables.count();
  if (tabbableCount > 0) {
    await tabbables.nth(tabbableCount - 1).focus();
    await page.keyboard.press('Tab');
  }
  const focusTrapEvidence = await modal.evaluate((element) => ({ focusInsideAfterTab: element.contains(document.activeElement), focusedName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText || document.activeElement?.tagName?.toLowerCase() }));

  const submit = modal.getByRole('button', { name: /Tạo PYC & mở hồ sơ/ });
  await submit.click();
  await page.waitForTimeout(120);
  const invalidEvidence = await form.evaluate((element) => ({ valid: element.checkValidity(), activeName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.labels?.[0]?.innerText?.trim() || document.activeElement?.tagName?.toLowerCase(), activeInsideForm: element.contains(document.activeElement) }));
  const modalBody = await modal.evaluate((element) => {
    const candidates = [element, ...Array.from(element.querySelectorAll('*'))].filter((item) => item.scrollHeight > item.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(item).overflowY));
    const body = candidates[0];
    if (body) body.scrollTop = body.scrollHeight;
    else window.scrollTo(0, document.body.scrollHeight);
    return { scrolledContainerFound: Boolean(body), modalScrollTop: body?.scrollTop || 0, modalScrollHeight: body?.scrollHeight || element.scrollHeight, modalClientHeight: body?.clientHeight || element.clientHeight };
  });
  await page.waitForTimeout(100);
  const bottomMetrics = await measure('bottom-after-invalid-submit');
  bottomMetrics.focusTrapEvidence = focusTrapEvidence;
  bottomMetrics.invalidSubmitFocus = invalidEvidence;
  bottomMetrics.bottomScroll = modalBody;
  await page.screenshot({ path: resolve(dir, `admin-${viewport.width}x${viewport.height}-footer-validation.png`), animations: 'disabled', fullPage: false });
  return { top: topMetrics, urgent: urgentMetrics, bottom: bottomMetrics };
}

function scenarios() {
  const longPgd = makeLongPgdBootstrap();
  const longPcnDossiers = Array.from({ length: 12 }, (_, index) => ({
    ...PCN_DOSSIER,
    id: `qa-density-pcn-long-${index + 1}`,
    dossierCode: `PCN-DENSITY-LONG-${String(index + 1).padStart(3, '0')}`,
    customerSnapshot: { ...PCN_DOSSIER.customerSnapshot, name: CUSTOMER_FIXTURES[index].name },
    productName: `Sản phẩm PCN synthetic ${index + 1} với mô tả rất dài để kiểm tra cách đọc hồ sơ`,
  }));
  const pgdTerminal = makePgdRequest('qa-density-pgd', 'ARCHIVED', 1);
  const pgdCancelled = makePgdRequest('qa-density-pgd', 'CANCELLED', 2);
  const pcnIssued = { ...PCN_DOSSIER, status: 'ISSUED' };
  const pcnCancelled = { ...PCN_DOSSIER, status: 'CANCELLED' };
  const pcnSamples = Array.from({ length: 24 }, (_, index) => {
    const id = `qa-density-lot-${index + 1}`;
    const itemId = `${id}-item`;
    const routeId = `${id}-emc`;
    return {
      id, dossierId: PCN_DOSSIER.id, lotCode: `LOT-QA-DENSITY-LONG-${String(index + 1).padStart(3, '0')}`,
      sampleName: `Mẫu PCN synthetic ${index + 1}`, quantity: 2, sampleItemIds: [itemId], fieldCodes: ['QC4'], routeIds: [routeId],
      status: 'PREPARED', currentLocation: 'Kho PCN', createdAt: '2026-10-28T08:00:00.000Z',
      item: { id: itemId, sampleLotId: id, sampleCode: `MẪU-PCN-QA-${String(index + 1).padStart(3, '0')}-MÃ-THỬ-NGHIỆM-RẤT-DÀI`, sampleType: `Thiết bị kiểm thử synthetic ${index + 1}`, model: `MODEL-QA-${index + 1}-LONG`, quantity: 2, unit: 'mẫu', testLabCodes: ['EMC'] },
      route: { id: routeId, sampleLotId: id, labCode: 'EMC', labName: 'Phòng thử EMC synthetic', status: 'PENDING', sequence: 1, sampleItemIds: [itemId] },
    };
  });
  const pcnSampleItems = pcnSamples.map((lot) => lot.item);
  const pcnSampleRoutes = pcnSamples.map((lot) => lot.route);
  const pcnSampleLots = pcnSamples.map(({ item, route, ...lot }) => lot);
  const base = [
    { id: 'staff-pcn-register', role: ROLES.staff, path: '/pgdcn/pcn?section=operations', menu: 'Sổ dữ liệu PCN', pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], fixtureMarkers: [PCN_DOSSIER.dossierCode] },
    { id: 'staff-pcn-samples', role: ROLES.staff, path: '/pgdcn/pcn', menu: 'Sổ quản lý mẫu PCN', pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], pcnSampleLots, pcnSampleItems, pcnSampleRoutes },
    { id: 'staff-pcn-drafting', role: ROLES.staff, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PCN', pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], pcnTemplates: [PCN_TEMPLATE] },
    { id: 'staff-customers', role: ROLES.staff, path: '/pgdcn', menu: 'Khách hàng', customers: [] },
    { id: 'customers-long', role: ROLES.admin, path: '/pgdcn', menu: 'Khách hàng', customers: CUSTOMER_FIXTURES, fixtureMarkers: [CUSTOMER_FIXTURES[0].customerCode, CUSTOMER_FIXTURES.at(-1).customerCode] },
    { id: 'viewer-pcn-register', role: ROLES.viewer, path: '/pgdcn/pcn', menu: 'Sổ dữ liệu', viewerMenu: true, pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL] },
    { id: 'viewer-pcn-detail-readonly', role: ROLES.viewer, path: `/pgdcn/pcn/dossiers/${PCN_DOSSIER.id}`, pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], pcnDocuments: [] },
    { id: 'pcn-issued-detail', role: ROLES.admin, path: `/pgdcn/pcn/dossiers/${PCN_DOSSIER.id}`, pcnDossiers: [pcnIssued], pcnProposals: [PCN_PROPOSAL] },
    { id: 'pcn-cancelled-detail', role: ROLES.admin, path: `/pgdcn/pcn/dossiers/${PCN_DOSSIER.id}`, pcnDossiers: [pcnCancelled], pcnProposals: [PCN_PROPOSAL] },
    { id: 'pgd-archived-detail', role: ROLES.admin, path: '/pgdcn/pgd/dossiers/qa-density-pgd', pgdBootstrap: { ...EMPTY_PGD_BOOTSTRAP, requests: [pgdTerminal] }, waitForPgdDossier: true, fixtureMarkers: ['PGD-DENSITY-001-LONG-SYNTHETIC-CODE'] },
    { id: 'pgd-cancelled-detail', role: ROLES.admin, path: '/pgdcn/pgd/dossiers/qa-density-pgd', pgdBootstrap: { ...EMPTY_PGD_BOOTSTRAP, requests: [pgdCancelled] }, waitForPgdDossier: true, fixtureMarkers: ['PGD-DENSITY-002-LONG-SYNTHETIC-CODE'] },
    { id: 'customers-empty', role: ROLES.staff, path: '/pgdcn', menu: 'Khách hàng', customers: [] },
    { id: 'pcn-samples-empty', role: ROLES.staff, path: '/pgdcn/pcn', menu: 'Sổ quản lý mẫu PCN', pcnDossiers: [], pcnProposals: [], pcnSampleLots: [], pcnSampleItems: [], pcnSampleRoutes: [] },
    { id: 'pgd-samples-empty', role: ROLES.staff, path: '/pgdcn/pgd', menu: 'Sổ quản lý mẫu PGD', pgdBootstrap: EMPTY_PGD_BOOTSTRAP },
    { id: 'pgd-intake-modal', role: ROLES.admin, path: '/pgdcn/pgd', invalidModal: true },
    { id: 'pcn-intake-modal', role: ROLES.admin, path: '/pgdcn/pcn', pcnIntakeModal: true },
  ];
  const stress = [
    { id: 'pgd-register-empty', role: ROLES.admin, path: '/pgdcn/pgd', menu: 'Sổ dữ liệu PGD', pgdBootstrap: EMPTY_PGD_BOOTSTRAP, pgdLoadState: 'empty' },
    { id: 'pgd-register-long', role: ROLES.admin, path: '/pgdcn/pgd', menu: 'Sổ dữ liệu PGD', dataTable: true, pgdBootstrap: longPgd },
    { id: 'pgd-samples-long', role: ROLES.admin, path: '/pgdcn/pgd', menu: 'Sổ quản lý mẫu PGD', pgdBootstrap: longPgd, fixtureMarkers: ['MẪU-QA-001-MÃ-THỬ-NGHIỆM-RẤT-DÀI', 'MẪU-QA-028-MÃ-THỬ-NGHIỆM-RẤT-DÀI'] },
    { id: 'pcn-samples-long', role: ROLES.admin, path: '/pgdcn/pcn', menu: 'Sổ quản lý mẫu PCN', pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], pcnSampleLots, pcnSampleItems, pcnSampleRoutes, fixtureMarkers: [pcnSampleItems[0].sampleCode, pcnSampleItems.at(-1).sampleCode] },
    { id: 'drafting-pcn-long', role: ROLES.admin, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PCN', selectDraftSource: { label: 'Chọn hồ sơ / Đề nghị', query: PCN_DOSSIER.dossierCode }, pcnDossiers: [PCN_DOSSIER], pcnProposals: [PCN_PROPOSAL], pcnTemplates: [PCN_TEMPLATE], fixtureMarkers: [PCN_DOSSIER.dossierCode] },
    { id: 'drafting-pcn-docx-settings-long', role: ROLES.admin, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PCN', openDocxSettings: true, pcnTemplates: Array.from({ length: 12 }, (_, i) => ({ ...PCN_TEMPLATE, id: `${PCN_TEMPLATE.id}-${i + 1}`, displayName: `${PCN_TEMPLATE.displayName} · mẫu ${i + 1}` })), fixtureMarkers: ['mẫu 12'] },
    { id: 'drafting-pgd-long', role: ROLES.admin, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PGD', selectDraftSource: { label: 'Chọn hồ sơ PGD', query: 'PGD-DENSITY-001-LONG-SYNTHETIC-CODE' }, pgdBootstrap: longPgd, fixtureMarkers: ['PGD-DENSITY-001-LONG-SYNTHETIC-CODE'] },
    { id: 'assistant-long', role: ROLES.admin, path: '/pgdcn', menu: 'Trợ lý AI', pcnDossiers: longPcnDossiers, fixtureMarkers: [longPcnDossiers[0].dossierCode, longPcnDossiers.at(-1).dossierCode] },
    { id: 'notifications-long', role: ROLES.admin, path: '/pgdcn', openNotifications: true, notifications: NOTIFICATION_FIXTURES, fixtureMarkers: ['Thông báo synthetic 1:', 'Thông báo synthetic 32:'] },
    { id: 'pgd-register-loading', role: ROLES.admin, path: '/pgdcn/pgd', menu: 'Sổ dữ liệu PGD', loadingPath: '/api/pgd/bootstrap', pgdBootstrap: longPgd, pgdLoadState: 'loading' },
    { id: 'pgd-register-error', role: ROLES.admin, path: '/pgdcn/pgd', menu: 'Sổ dữ liệu PGD', errorPath: '/api/pgd/bootstrap', pgdLoadState: 'error', keyboardRetry: true },
    { id: 'staff-pgd-register-error', role: ROLES.staff, path: '/pgdcn/pgd', menu: 'Sổ dữ liệu PGD', errorPath: '/api/pgd/bootstrap', pgdLoadState: 'error', keyboardRetry: true },
    { id: 'drafting-loading', role: ROLES.admin, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PCN', loadingPath: '/api/pcn/drafts' },
    { id: 'drafting-error', role: ROLES.admin, path: '/pgdcn', menu: 'Soạn thảo tài liệu', draftingDomain: 'PCN', errorPath: '/api/pcn/drafts' },
    { id: 'assistant-loading', role: ROLES.admin, path: '/pgdcn', menu: 'Trợ lý AI', draftingDomain: 'PGD', loadingPath: '/api/pcn/approval-assistant/candidates', pcnDossiers: [PCN_DOSSIER] },
    { id: 'assistant-error', role: ROLES.admin, path: '/pgdcn', menu: 'Trợ lý AI', errorPath: '/api/pcn/approval-assistant/candidates' },
    { id: 'notifications-loading', role: ROLES.admin, path: '/pgdcn', openNotifications: true, loadingPath: '/api/pgdcn/notifications', notifications: NOTIFICATION_FIXTURES },
    { id: 'notifications-error', role: ROLES.admin, path: '/pgdcn', openNotifications: true, errorPath: '/api/pgdcn/notifications' },
  ];
  return [...base, ...stress];
}

test('PGDCN density coverage captures missing roles, terminal states, intake, and stress fixtures', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
  timeout: 15 * 60 * 1000,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), `Only loopback preview allowed, got ${base.hostname}`);
  const audit = { mode: 'QA_MOCKED', baseUrl: base.origin, capturedAt: new Date().toISOString(), apiGets: [], apiMutationAttempts: [], externalRequests: [], pageErrors: [], consoleErrors: [], observations: [], captureErrors: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const scenarioFilter = String(process.env.PGDCN_COVERAGE_SCENARIOS || '').split(',').map((item) => item.trim()).filter(Boolean);
    const selectedScenarios = scenarios().filter((scenario) => scenarioFilter.length === 0 || scenarioFilter.includes(scenario.id));
    for (const scenario of selectedScenarios) {
      for (const viewport of requestedViewports()) {
        try {
          await captureScenario(browser, base, scenario, viewport, audit);
        } catch (error) {
          audit.captureErrors.push({ scenario: scenario.id, role: scenario.role.id, viewport, message: error?.stack || String(error) });
          console.error(`[coverage] failed ${scenario.id} ${viewport.width}x${viewport.height}: ${error?.message || error}`);
        }
        await mkdir(artifactRoot, { recursive: true });
        await writeFile(resolve(artifactRoot, 'metrics.partial.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
      }
    }
    const output = {
      ...audit,
      totalScreenshots: audit.observations.length,
      uniqueScenarios: new Set(audit.observations.map((item) => item.scenario)).size,
      roleCount: new Set(audit.observations.map((item) => item.role)).size,
      viewportCoverage: [...new Set(audit.observations.map((item) => `${item.viewport.width}x${item.viewport.height}`))],
    };
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(resolve(artifactRoot, 'metrics.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    assert.deepEqual(audit.apiMutationAttempts, [], `Unexpected mutation attempts: ${JSON.stringify(audit.apiMutationAttempts)}`);
    assert.deepEqual(audit.externalRequests, [], `Unexpected external requests: ${JSON.stringify(audit.externalRequests)}`);
    assert.deepEqual(audit.captureErrors, [], `Capture/navigation failures: ${JSON.stringify(audit.captureErrors, null, 2)}`);
    assert.equal(audit.pageErrors.length, 0, `Browser page errors: ${JSON.stringify(audit.pageErrors, null, 2)}`);
  } finally {
    await browser.close();
  }
});
