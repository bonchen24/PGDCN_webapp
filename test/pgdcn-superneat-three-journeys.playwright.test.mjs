import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL || 'http://localhost:15357';
const artifactDirectory = resolve(process.env.PGDCN_UX_ARTIFACT_DIR || 'docs/ux-audit/artifacts/superneat/2026-11-01');

const VIEWPORTS = [
  { width: 320, height: 568, name: '320' },
  { width: 375, height: 667, name: '375' },
  { width: 390, height: 844, name: '390' },
  { width: 430, height: 932, name: '430' },
  { width: 768, height: 1024, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1280, height: 800, name: '1280' },
  { width: 1440, height: 1000, name: '1440' },
];

const ROLES = {
  admin: {
    id: 'admin',
    username: 'synthetic_superneat_admin',
    name: 'Synthetic Admin',
    role: 'admin',
    systemRole: 'admin',
    departmentRoleCode: 'GD',
    fieldCodes: ['QC4'],
    active: true,
    departmentScopes: ['PCN', 'PGD'],
    pgdRole: 'PGD_LEAD',
  },
  viewer: {
    id: 'viewer',
    username: 'synthetic_superneat_viewer',
    name: 'Synthetic Viewer',
    role: 'viewer',
    systemRole: 'viewer',
    departmentRoleCode: 'GD',
    fieldCodes: ['QC4'],
    active: true,
    departmentScopes: ['PCN', 'PGD'],
    pgdRole: 'PGD_VIEWER',
  },
};

const PCN_DOSSIER = {
  id: 'qa-superneat-pcn-1',
  dossierCode: 'PCN-QA-SUPERNEAT-001',
  proposalId: 'qa-superneat-proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'AWAITING_DOCUMENTS',
  ownerUsername: ROLES.admin.username,
  customerSnapshot: {
    name: 'Công ty Cổ phần Cơ khí Chính xác Synthetic QA',
    address: 'Khu công nghiệp Thăng Long, Đông Anh, Hà Nội',
    taxId: '0109988776',
    contactPerson: 'Nguyễn Văn Synthetic',
  },
  labRequestIds: [],
  returnedResultIds: [],
  sampleLotIds: [],
  createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z',
};

const PCN_PROPOSAL = {
  id: 'qa-superneat-proposal-1',
  proposalCode: 'PROP-QA-SUPERNEAT-001',
  channel: 'DIRECT',
  status: 'RECEIVED',
  dossierId: PCN_DOSSIER.id,
  productName: 'Máy biến áp phân phối 3 pha synthetic',
  quantity: 2,
  fieldCodes: ['QC4'],
  receivedAt: '2026-10-28T08:00:00.000Z',
  createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z',
  customerSnapshot: PCN_DOSSIER.customerSnapshot,
};

const PCN_TEMPLATE = {
  id: 'qa-superneat-template-1',
  displayName: 'Biểu mẫu quyết định chứng nhận hợp chuẩn thiết bị điện tử',
  fieldCode: 'QC4',
  documentKind: 'DECISION',
  variant: '1.0',
  format: 'DOCX',
  status: 'APPROVED',
  placeholderKeys: [],
  requiredPlaceholderKeys: [],
  sourceFingerprint: {
    sha256: 'a'.repeat(64),
    byteSize: 2048,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  importedAt: '2026-10-28T08:00:00.000Z',
  importedByUsername: ROLES.admin.username,
};

const PCN_REQUIREMENTS = [
  { id: 'req-app', code: 'APPLICATION', name: 'Giấy đề nghị chứng nhận', fieldCode: 'QC4', required: true, sequence: 1 },
  { id: 'req-spec', code: 'TECH_SPEC', name: 'Tài liệu kỹ thuật sản phẩm', fieldCode: 'QC4', required: true, sequence: 2 },
  { id: 'req-iso', code: 'ISO_CERT', name: 'Chứng chỉ ISO 9001 nhà sản xuất', fieldCode: 'QC4', required: false, sequence: 3 },
  { id: 'req-report', code: 'TEST_REPORT', name: 'Phiếu kết quả thử nghiệm PTN', fieldCode: 'QC4', required: true, sequence: 4 },
  { id: 'req-eval', code: 'EVAL_RECORD', name: 'Biên bản đánh giá hiện trường', fieldCode: 'QC4', required: true, sequence: 5 },
];

const PGD_REQUEST = {
  domain: 'pgd',
  id: 'qa-superneat-pgd-1',
  requestCode: 'PGD-QA-SUPERNEAT-001',
  intakeChannel: 'DIRECT',
  requester: { name: 'Công ty Nhập khẩu Kim loại Synthetic' },
  customerSnapshot: {
    name: 'Công ty TNHH Thương mại Quốc tế Thép Toàn Cầu',
    address: 'Tầng 12, Tòa nhà Công nghệ, Quận Cầu Giấy, Hà Nội',
    taxId: '0108877665',
    contactPerson: 'Trần Thị Kiểm Định',
  },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'cat-steel',
  productName: 'Thép cốt bê tông cán nóng dạng cuộn mác CB240-T',
  lotCode: 'LO-THEP-CB240-2026-001',
  quantity: 250,
  unit: 'tấn',
  weight: 250,
  weightUnit: 'tấn',
  inspectionScope: 'Giám định chất lượng thép nhập khẩu theo QCVN 20:2019/BKHCN.',
  inspectionLocation: 'Cảng Hải Phòng, Kho ngoại quan Đình Vũ',
  standards: ['TCVN 1651-1:2018', 'JIS G3112'],
  status: 'WAITING_LAB_RESULTS',
  documentPointers: [],
  sampleIds: ['sample-1', 'sample-2'],
  labRequestIds: [],
  createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z',
  dossierChecklist: [
    { domain: 'pgd', requirementCode: 'REQUEST_PYC', group: 'REQUEST', title: 'Phiếu yêu cầu giám định', required: true, status: 'PRESENT', updatedAt: '2026-10-28T08:00:00.000Z' },
    { domain: 'pgd', requirementCode: 'REQUEST_SUPPORTING', group: 'REQUEST', title: 'Tài liệu tiếp nhận và thông tin PYC', required: true, status: 'MISSING', updatedAt: '2026-10-28T08:00:00.000Z' },
    { domain: 'pgd', requirementCode: 'COMMERCIAL_CONTRACT', group: 'COMMERCIAL_CUSTOMS', title: 'Hợp đồng thương mại', required: false, status: 'MISSING', updatedAt: '2026-10-28T08:00:00.000Z' },
    { domain: 'pgd', requirementCode: 'INSPECTION_PLAN', group: 'TECHNICAL', title: 'Kế hoạch giám định hiện trường', required: true, status: 'PRESENT', updatedAt: '2026-10-28T08:00:00.000Z' },
    { domain: 'pgd', requirementCode: 'LAB_RESULT', group: 'RESULT_ISSUANCE', title: 'Phiếu kết quả thử nghiệm PTN', required: true, status: 'MISSING', updatedAt: '2026-10-28T08:00:00.000Z' },
  ],
};

const PGD_CATALOG = [
  {
    id: 'cat-steel',
    domain: 'PGD',
    code: 'GD-STEEL-01',
    name: 'Giám định thép xây dựng và hợp kim',
    productGroup: 'STEEL_METAL',
    inspectionTypes: ['Kiểm tra ngoại quan', 'Kéo nén', 'Uốn nguội'],
    methodOptions: [{ code: 'QT-GD-14', name: 'Quy trình giám định thép cốt bê tông' }],
    defaultStandards: ['TCVN 1651:2018'],
    slaLabel: '3-5 ngày',
    active: true,
  },
];

const PGD_TEMPLATES = [
  {
    id: 'pgd-tpl-cert',
    domain: 'PGD',
    kind: 'INSPECTION_CERTIFICATE',
    code: 'BM-PGD-01',
    name: 'Chứng thư giám định chất lượng hàng hóa',
    version: '1.0',
    status: 'PUBLISHED',
    productGroups: ['STEEL_METAL'],
    formats: ['DOCX', 'PDF'],
    cells: [{ key: 'productName', label: 'Tên hàng hóa / đối tượng giám định', sectionCode: 'identity', row: 1, column: 1, type: 'TEXT', required: false, binding: 'productName', active: true, productGroups: ['STEEL_METAL'] }],
    fileName: 'synthetic-pgd-certificate.docx',
    placeholderKeys: ['productName'],
    requiredPlaceholderKeys: [],
    sourceFormLabel: 'Synthetic QA template',
    active: true,
  },
];

const PGD_RESULT_TEMPLATES = [
  {
    id: 'pgd-result-template-1',
    code: 'PGD-RESULT-QA-01',
    name: 'Mẫu báo cáo giám định synthetic',
    version: '1.0',
    productGroup: 'STEEL_METAL',
    fields: [],
    active: true,
  },
];

const PGD_DOSSIER_REQUIREMENTS = [
  { domain: 'pgd', code: 'REQUEST_PYC', group: 'REQUEST', title: 'Phiếu yêu cầu giám định', required: true },
  { domain: 'pgd', code: 'REQUEST_SUPPORTING', group: 'REQUEST', title: 'Tài liệu tiếp nhận và thông tin PYC', required: true },
  { domain: 'pgd', code: 'INSPECTION_PLAN', group: 'TECHNICAL', title: 'Kế hoạch giám định', required: true },
  { domain: 'pgd', code: 'TECHNICAL_SPECIFICATION', group: 'TECHNICAL', title: 'Hồ sơ kỹ thuật / catalogue', required: true },
];

const PGD_GENERATED_DOCUMENT = {
  id: 'qa-superneat-generated-document-1',
  domain: 'pgd',
  requestId: PGD_REQUEST.id,
  requestCode: PGD_REQUEST.requestCode,
  kind: 'INSPECTION_CERTIFICATE',
  templateId: 'pgd-tpl-cert',
  templateCode: 'BM-PGD-01',
  templateVersion: '1.0',
  templateSnapshot: {
    domain: 'pgd',
    kind: 'INSPECTION_CERTIFICATE',
    code: 'BM-PGD-01',
    name: 'Chứng thư giám định chất lượng hàng hóa',
    version: '1.0',
    status: 'PUBLISHED',
    productGroups: ['STEEL_METAL'],
    formats: ['DOCX', 'PDF'],
    cells: [{ key: 'productName', label: 'Tên hàng hóa / đối tượng giám định', sectionCode: 'identity', row: 1, column: 1, type: 'TEXT', required: false, binding: 'productName', active: true, productGroups: ['STEEL_METAL'] }],
    fileName: 'synthetic-pgd-certificate.docx',
    placeholderKeys: ['productName'],
    requiredPlaceholderKeys: [],
    sourceFormLabel: 'Synthetic QA template',
    templateId: 'pgd-tpl-cert',
    capturedAt: '2026-10-28T08:00:00.000Z',
  },
  cellValues: {},
  format: 'DOCX',
  fileName: 'PGD-QA-SUPERNEAT-001-chung-thu.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  byteSize: 12,
  sha256: 'b'.repeat(64),
  contextHash: 'c'.repeat(64),
  sourceCollection: 'pgdInspectionRequests',
  sourceDocumentId: PGD_REQUEST.id,
  generatedByUsername: ROLES.admin.username,
  generatedAt: '2026-10-28T08:00:00.000Z',
  status: 'DRAFT',
};

const PGD_DOSSIER_DOCUMENT = {
  id: 'qa-superneat-dossier-document-1',
  domain: 'pgd',
  requestId: PGD_REQUEST.id,
  requirementCode: 'REQUEST_SUPPORTING',
  title: 'Tài liệu tiếp nhận synthetic',
  fileName: 'synthetic-intake.pdf',
  sourceCollection: 'pgdDossierDocuments',
  sourceDocumentId: 'qa-superneat-dossier-document-1',
  version: 1,
  checksum: 'd'.repeat(64),
  uploadedByUsername: ROLES.admin.username,
  uploadedAt: '2026-10-28T08:00:00.000Z',
  documentNumber: 'QA-INTAKE-001',
  note: 'Synthetic mocked upload',
  mimeType: 'application/pdf',
  byteSize: 12,
};

const PGD_BOOTSTRAP = {
  customers: [PGD_REQUEST.customerSnapshot],
  users: [ROLES.admin],
  catalog: PGD_CATALOG,
  requests: [PGD_REQUEST],
  assignments: [],
  fieldInspections: [],
  samples: [
    {
      id: 'sample-1',
      domain: 'PGD',
      requestId: PGD_REQUEST.id,
      sampleCode: 'MAU-THEP-01',
      sampleTypeLabel: 'Mẫu thanh tròn trơn',
      quantity: 3,
      unit: 'thanh',
      disposition: 'LAB',
      sealNumber: 'SEAL-001',
      laboratoryName: 'Trung tâm Thử nghiệm Vật liệu Xây dựng',
    },
  ],
  labRequests: [],
  labResults: [],
  templates: PGD_RESULT_TEMPLATES,
  documentTemplates: PGD_TEMPLATES,
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

async function installSuperneatInterceptors(page, baseOrigin, audit, { user = ROLES.admin, includeGeneratedDocument = false, requestStatus } = {}) {
  page.on('pageerror', (err) => {
    if (audit.pageErrors.length < 1) audit.pageErrors.push({ url: page.url(), message: err.message, stack: err.stack?.split('\n').slice(0, 8).join('\n') });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      audit.consoleErrors.push({ url: page.url(), message: msg.text() });
    }
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.origin !== baseOrigin) {
      audit.externalRequests.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (method !== 'GET') {
      if (url.pathname === '/api/pgd/assistant/review' && method === 'POST') {
        audit.readOnlyAdvisoryCalls.push({ url: url.pathname, method });
        await route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson; charset=utf-8',
          body: [
            JSON.stringify({ type: 'run_started', message: 'Đã bắt đầu phiên soát xét synthetic.' }),
            JSON.stringify({ type: 'run_completed', message: 'Hoàn tất soát xét synthetic, không ghi dữ liệu.', summary: { pass: 0, warning: 0, error: 0, notEvaluable: 11, conclusion: 'Cần người phụ trách đối chiếu.' } }),
          ].join('\n'),
        });
        return;
      }

      const simulatedWrite = { url: url.pathname, method };
      audit.simulatedWrites.push(simulatedWrite);

      if (url.pathname === '/api/pgd/requests' && method === 'POST') {
        const input = request.postDataJSON();
        const createdRequest = {
          ...PGD_REQUEST,
          ...input,
          domain: 'pgd',
          requestCode: 'PGD-QA-CREATED-001',
          status: 'DRAFT',
          createdAt: '2026-11-01T08:00:00.000Z',
          updatedAt: '2026-11-01T08:00:00.000Z',
        };
        audit.createdRequestIds.push(createdRequest.id);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ request: createdRequest, samples: [] }) });
        return;
      }

      if (url.pathname.endsWith('/dossier-documents/attach-generated') && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dossierDocument: { ...PGD_DOSSIER_DOCUMENT, id: 'qa-superneat-attached-generated', requirementCode: 'INSPECTION_CERTIFICATE', title: 'Chứng thư giám định synthetic', sourceDocumentId: 'qa-superneat-attached-generated', originCollection: 'pgdDocuments', originDocumentId: PGD_GENERATED_DOCUMENT.id } }) });
        return;
      }

      if (url.pathname.endsWith('/dossier-documents') && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dossierDocument: PGD_DOSSIER_DOCUMENT }) });
        return;
      }

      if (url.pathname === '/api/pgd/documents/generate' && method === 'POST') {
        const input = request.postDataJSON();
        const document = { ...PGD_GENERATED_DOCUMENT, requestId: input.requestId, kind: input.kind, templateId: input.templateId, format: input.format };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ document, contentBase64: 'c3ludGhldGlj' }) });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, simulated: true, message: 'Synthetic mock intercepted write' }) });
      return;
    }

    if (url.pathname === '/api/auth/pcn-session') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, user }),
      });
      return;
    }

    if (url.pathname === '/api/pgd/bootstrap') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...PGD_BOOTSTRAP, requests: PGD_BOOTSTRAP.requests.map((request) => ({ ...request, ...(requestStatus ? { status: requestStatus } : {}) })), documents: includeGeneratedDocument ? [PGD_GENERATED_DOCUMENT] : [] }),
      });
      return;
    }

    if (url.pathname === '/api/pgdcn/notifications' || url.pathname === '/api/pcn/notifications') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      return;
    }

    if (url.pathname === '/api/pcn/approval-assistant/candidates') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              dossierId: PCN_DOSSIER.id,
              dossierCode: PCN_DOSSIER.dossierCode,
              fieldCode: 'QC4',
              status: PCN_DOSSIER.status,
              customerName: PCN_DOSSIER.customerSnapshot.name,
              productName: PCN_PROPOSAL.productName,
              ownerUsername: ROLES.admin.username,
              targetDate: '2026-11-05',
              missingDocuments: ['TECH_SPEC', 'TEST_REPORT'],
              completenessScore: 75,
            },
          ],
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/dossier-documents') && url.pathname.startsWith('/api/pgd/requests/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dossierDocuments: [], requirements: PGD_DOSSIER_REQUIREMENTS }),
      });
      return;
    }

    if (url.pathname.startsWith('/api/db/')) {
      const p = url.pathname.toLowerCase();
      let items = [];
      if (p.includes('certificationdossiers')) items = [PCN_DOSSIER];
      else if (p.includes('certificationproposals')) items = [PCN_PROPOSAL];
      else if (p.includes('pcntemplatedefinitions') || p.includes('pcntemplates')) items = [PCN_TEMPLATE];
      else if (p.includes('pcndocumentrequirements')) items = PCN_REQUIREMENTS;
      else if (p.includes('dossierdocuments')) items = [];
      else if (p.includes('customer')) items = [PCN_DOSSIER.customerSnapshot];
      else if (p.includes('users')) items = [ROLES.admin];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
      return;
    }

    if (url.pathname === '/api/db-meta') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: {} }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function collectViewportMetrics(page, viewport) {
  return page.evaluate((vp) => {
    const root = document.documentElement;
    const body = document.body;
    const docWidth = Math.max(root.scrollWidth, body.scrollWidth);
    const clientWidth = root.clientWidth;
    const overflowPx = Math.max(0, docWidth - clientWidth);

    const isVisible = (el) => {
      if (!el.getClientRects().length) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    };

    const buttons = Array.from(document.querySelectorAll('button, a[href], input[type="button"], input[type="submit"]')).filter(isVisible);
    const active = document.activeElement;
    const activeStyle = active instanceof HTMLElement ? getComputedStyle(active) : undefined;
    const sub44Targets = [];

    if (vp.width < 768) {
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.height > 0 && r.width > 0 && (r.height < 40 || r.width < 40)) {
          // If within an explicit small desktop-only widget or table cell, note it
          const text = (btn.getAttribute('aria-label') || btn.innerText || '').trim().slice(0, 40);
          sub44Targets.push({ text, width: Math.round(r.width), height: Math.round(r.height) });
        }
      }
    }

    return {
      viewport: vp,
      docWidth,
      clientWidth,
      overflowPx,
      hasHorizontalOverflow: overflowPx > 1,
      visibleActionsCount: buttons.length,
      sub44TargetsCount: sub44Targets.length,
      sampleSub44Targets: sub44Targets.slice(0, 5),
      focus: active instanceof HTMLElement ? {
        tagName: active.tagName,
        role: active.getAttribute('role'),
        label: active.getAttribute('aria-label') || active.getAttribute('title') || active.textContent?.trim().slice(0, 48) || '',
        visible: active.getClientRects().length > 0 && activeStyle?.visibility !== 'hidden' && activeStyle?.display !== 'none',
      } : null,
    };
  }, viewport);
}

test('PCN and PGD quick peek keeps one action and opens the dossier work context across viewports', {
  timeout: 300000,
}, async () => {
  const base = new URL(rawBaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), `Only loopback origin allowed: ${base.hostname}`);

  const audit = {
    simulatedWrites: [],
    createdRequestIds: [],
    readOnlyAdvisoryCalls: [],
    externalRequests: [],
    pageErrors: [],
    consoleErrors: [],
  };
  const results = [];
  const outDir = resolve(artifactDirectory, 'quick-peek-after');
  const browser = await chromium.launch({ headless: true });

  try {
    await mkdir(outDir, { recursive: true });
    for (const domain of ['PCN', 'PGD']) {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await installSuperneatInterceptors(page, base.origin, audit);

        const dossierCode = domain === 'PCN' ? PCN_DOSSIER.dossierCode : PGD_REQUEST.requestCode;
        const queuePath = domain === 'PCN' ? '/pgdcn/pcn?section=operations' : '/pgdcn/pgd?section=operations';
        await page.goto(new URL(queuePath, base).toString(), { waitUntil: 'domcontentloaded' });
        await page.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });
        const openPeek = page.getByRole('button', { name: `Xem nhanh ${dossierCode}` });
        await openPeek.waitFor({ state: 'visible', timeout: 15000 });
        await openPeek.click();
        const dialog = page.getByRole('dialog', { name: `Xem nhanh ${dossierCode}` });
        await dialog.waitFor({ state: 'visible', timeout: 5000 });

        assert.ok(await dialog.getByTestId('dossier-peek-blockers').count() <= 1, `${domain} has at most one blocker summary at ${vp.width}px`);
        const primaryAction = dialog.getByRole('button').last();
        const actionLabel = (await primaryAction.innerText()).trim();
        assert.ok(actionLabel.length > 0, `${domain} quick peek exposes a named primary action at ${vp.width}px`);
        assert.notEqual(actionLabel, 'Mở hồ sơ đầy đủ', `${domain} primary action uses the projected action label at ${vp.width}px`);

        const metrics = await collectViewportMetrics(page, vp);
        assert.equal(metrics.hasHorizontalOverflow, false, `${domain} quick peek has no page overflow at ${vp.width}px`);
        assert.equal(metrics.focus?.visible, true, `${domain} quick peek keeps visible focus at ${vp.width}px`);
        if (await dialog.getByTestId('dossier-peek-blockers').count()) {
          const geometry = await dialog.evaluate((element) => {
            const blocker = element.querySelector('[data-testid="dossier-peek-blockers"]');
            const footer = element.lastElementChild;
            if (!blocker || !footer) return null;
            return { blockerBottom: blocker.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top };
          });
        assert.ok(geometry && geometry.blockerBottom <= geometry.footerTop, `${domain} blocker summary is visible above the sticky action at ${vp.width}px`);
        }
        results.push({ domain, viewport: `${vp.width}x${vp.height}`, actionLabel, ...metrics });
        await page.addStyleTag({ content: '.nextjs-portal, nextjs-portal { display: none !important; }' });
        await page.screenshot({ path: resolve(outDir, `${domain.toLowerCase()}-${vp.name}px.png`), fullPage: false });

        await primaryAction.click();
        const workContext = domain === 'PCN'
          ? page.locator('[data-testid="pcn-dossier-focus-shell"]:visible').first()
          : page.locator('[data-testid="pgd-dossier-step-work-panel"]:visible').first();
        await workContext.waitFor({ state: 'visible', timeout: 15000 });
        assert.equal(await page.getByRole('dialog', { name: `Xem nhanh ${dossierCode}` }).count(), 0, `${domain} quick peek closes after opening work context`);
        await page.close();
      }
    }

    assert.deepEqual(audit.simulatedWrites, [], 'Opening a dossier from Quick Peek does not create or mutate data');
    assert.deepEqual(audit.externalRequests, [], 'Only mocked local fixture requests are allowed');
    assert.deepEqual(audit.pageErrors, [], `No browser errors: ${JSON.stringify(audit.pageErrors)}`);
    assert.deepEqual(audit.consoleErrors, [], `No console errors: ${JSON.stringify(audit.consoleErrors)}`);
    await writeFile(resolve(outDir, 'metrics.json'), `${JSON.stringify({ viewports: results, simulatedWrites: audit.simulatedWrites.length, externalRequests: audit.externalRequests.length }, null, 2)}\n`, 'utf8');
  } finally {
    await browser.close();
  }
});

test('PGDCN Superneat Three Critical Journeys verification across 8 viewports', {
  timeout: 300000,
}, async () => {
  const base = new URL(rawBaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), `Only loopback origin allowed: ${base.hostname}`);

  const audit = {
    mode: 'QA_SYNTHETIC_MOCKED',
    baseUrl: base.origin,
    executedAt: new Date().toISOString(),
    simulatedWrites: [],
    createdRequestIds: [],
    readOnlyAdvisoryCalls: [],
    externalRequests: [],
    pageErrors: [],
    consoleErrors: [],
    journey1Metrics: [],
    journey2Metrics: [],
    journey3Metrics: [],
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const outDir = resolve(artifactDirectory, 'journeys');
    await mkdir(outDir, { recursive: true });

    // =========================================================================
    // JOURNEY 1: Create a PGD request through the real intake form; the API is mocked.
    // =========================================================================
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await installSuperneatInterceptors(page, base.origin, audit);

      // Open PGD management queue & trigger Intake dialog
      await page.goto(new URL('/pgdcn/pgd', base).toString(), { waitUntil: 'domcontentloaded' });
      await page.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });

      // Click "Tạo PYC"
      const createButton = page.getByRole('button', { name: /Tạo PYC/u }).first();
      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();

      // Verify Intake Modal opens
      const intakeModal = page.getByRole('dialog', { name: /Tạo PYC và bắt đầu bộ hồ sơ/u });
      await intakeModal.waitFor({ state: 'visible', timeout: 5000 });
      const intakeTitle = intakeModal.locator('#pgd-intake-title');
      const titleFits = await intakeTitle.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
      assert.equal(titleFits, true, `The complete PYC intake title must remain readable at ${vp.width}px`);

      const form = page.locator('#pgd-intake-form');
      assert.ok(await form.isVisible(), 'PGD Intake form must be visible in modal');
      const requiredFields = await form.locator(':required').all();
      assert.ok(requiredFields.length > 0, 'The PYC form exposes its required fields');
      for (const field of requiredFields) {
        const metadata = await field.evaluate((element) => ({ tag: element.tagName, type: element.getAttribute('type') || '' }));
        if (metadata.tag === 'SELECT') await field.selectOption({ index: 1 });
        else if (metadata.tag === 'TEXTAREA') await field.fill('Synthetic QA intake data');
        else if (metadata.type === 'number') await field.fill('1');
        else if (metadata.type === 'email') await field.fill('synthetic@example.invalid');
        else if (metadata.type === 'date') await field.fill('2026-11-01');
        else await field.fill('Synthetic QA intake data');
      }
      assert.equal(await form.evaluate((element) => element.checkValidity()), true, 'All required PYC fields are valid before submit');
      await requiredFields[0].focus();

      const metrics = await collectViewportMetrics(page, vp);
      assert.equal(metrics.hasHorizontalOverflow, false, `Journey 1 intake overflow at ${vp.width}px`);
      assert.equal(metrics.focus?.visible, true, `Journey 1 focus is visible at ${vp.width}px`);
      audit.journey1Metrics.push(metrics);
      await page.addStyleTag({ content: '.nextjs-portal, nextjs-portal, [data-sonner-toaster], [data-sonner-toast], [role="status"] { display: none !important; }' });
      await page.screenshot({ path: resolve(outDir, `journey-1-intake-${vp.name}px.png`), fullPage: false });
      await intakeModal.getByRole('button', { name: 'Tạo PYC & mở hồ sơ' }).click();
      await page.getByText('PGD-QA-CREATED-001').first().waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(audit.createdRequestIds.length, audit.journey1Metrics.length, 'The mocked create flow returned a new dossier each viewport');
      const createdMetrics = await collectViewportMetrics(page, vp);
      assert.equal(createdMetrics.hasHorizontalOverflow, false, `Journey 1 created dossier overflow at ${vp.width}px`);
      await page.screenshot({ path: resolve(outDir, `journey-1-created-${vp.name}px.png`), fullPage: false });
      await page.close();
    }

    // =========================================================================
    // JOURNEY 2: Upload a synthetic supporting file to the PGD dossier checklist.
    // =========================================================================
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await installSuperneatInterceptors(page, base.origin, audit, { requestStatus: 'DRAFT' });

      await page.goto(new URL(`/pgdcn/pgd/dossiers/${PGD_REQUEST.id}`, base).toString(), { waitUntil: 'domcontentloaded' });
      await page.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });
      const activeStepPanel = page.locator('[data-testid="pgd-dossier-step-work-panel"]:visible').first();
      await activeStepPanel.waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('details[data-testid="pgd-dossier-advanced-workflow"]:visible').first().locator('summary').first().click();
      await activeStepPanel.locator('select[aria-label="Chọn tài liệu cần bổ sung PGD"]').first().selectOption('REQUEST_SUPPORTING', { timeout: 15000 });
      const upload = activeStepPanel.locator('input[type="file"][aria-label="Tải tệp chứng từ PGD"]').first();
      await upload.waitFor({ state: 'visible', timeout: 15000 });
      await activeStepPanel.locator('input[aria-label="Tiêu đề chứng từ PGD"]').first().fill('Tài liệu tiếp nhận synthetic');
      assert.equal(await upload.isDisabled(), false, `Upload must be enabled at DRAFT: ${JSON.stringify(await upload.evaluate((element) => ({ disabled: element.disabled, requestId: element.form?.outerHTML.includes('REQUEST_SUPPORTING') })))}`);
      await upload.setInputFiles({ name: 'synthetic-intake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic QA only') });
      await upload.focus();
      const metrics = await collectViewportMetrics(page, vp);
      assert.equal(metrics.hasHorizontalOverflow, false, `Journey 2 upload form overflow at ${vp.width}px`);
      assert.equal(metrics.focus?.visible, true, `Journey 2 file input focus is visible at ${vp.width}px`);
      audit.journey2Metrics.push(metrics);
      await page.addStyleTag({ content: '.nextjs-portal, nextjs-portal, [data-sonner-toaster], [data-sonner-toast], [role="status"] { display: none !important; }' });
      await page.screenshot({ path: resolve(outDir, `journey-2-supplement-${vp.name}px.png`), fullPage: false });
      await page.getByRole('button', { name: 'Lưu chứng từ' }).click();
      await page.getByText('synthetic-intake.pdf').first().waitFor({ state: 'visible', timeout: 15000 });
      assert.ok(audit.simulatedWrites.some((entry) => entry.method === 'POST' && entry.url.endsWith('/dossier-documents')), 'Supporting file upload was handled by the mock route');
      await page.close();
    }

    // =========================================================================
    // JOURNEY 3: Generate, review, and attach DOCX output through the permissioned UI.
    // =========================================================================
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await installSuperneatInterceptors(page, base.origin, audit);
      await page.goto(new URL('/pgdcn?section=document-drafting', base).toString(), { waitUntil: 'domcontentloaded' });
      await page.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });
      const source = page.getByRole('combobox', { name: 'Chọn hồ sơ PGD' });
      await source.fill(PGD_REQUEST.requestCode);
      await page.getByRole('option', { name: new RegExp(PGD_REQUEST.requestCode) }).click();
      await page.getByTestId('pgd-drafting-form').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Chứng thư giám định/u }).first().click();
      await page.getByTestId('pgd-document-generation').waitFor({ state: 'visible' });
      await page.on('download', () => {});
      await page.getByRole('button', { name: 'Sinh tài liệu DOCX' }).click();
      const output = page.getByTestId(`pgd-draft-output-${PGD_GENERATED_DOCUMENT.id}`);
      await output.waitFor({ state: 'visible', timeout: 15000 });
      await output.getByRole('button', { name: 'Xác nhận đã soát xét' }).click();
      await page.getByTestId('pgd-drafting-form').locator('input').first().focus();
      const metrics = await collectViewportMetrics(page, vp);
      assert.equal(metrics.hasHorizontalOverflow, false, `Journey 3 drafting/review overflow at ${vp.width}px`);
      assert.equal(metrics.focus?.visible, true, `Journey 3 focus is visible at ${vp.width}px`);
      audit.journey3Metrics.push(metrics);
      await page.addStyleTag({ content: '.nextjs-portal, nextjs-portal, [data-sonner-toaster], [data-sonner-toast], [role="status"] { display: none !important; }' });
      await page.screenshot({ path: resolve(outDir, `journey-3-drafting-review-${vp.name}px.png`), fullPage: false });
      await output.getByRole('button', { name: 'Xác nhận & gắn vào bộ hồ sơ' }).click();
      await output.getByTestId('pgd-drafting-attach-success').waitFor({ state: 'visible', timeout: 15000 });
      await page.close();
    }

    // A viewer can inspect and acknowledge the synthetic draft, but cannot generate or attach it.
    const viewerPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installSuperneatInterceptors(viewerPage, base.origin, audit, { user: ROLES.viewer, includeGeneratedDocument: true });
    await viewerPage.goto(new URL('/pgdcn?section=document-drafting', base).toString(), { waitUntil: 'domcontentloaded' });
    await viewerPage.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });
    const viewerSource = viewerPage.getByRole('combobox', { name: 'Chọn hồ sơ PGD' });
    await viewerSource.fill(PGD_REQUEST.requestCode);
    await viewerPage.getByRole('option', { name: new RegExp(PGD_REQUEST.requestCode) }).click();
    await viewerPage.getByRole('button', { name: /Chứng thư giám định/u }).first().click();
    const viewerOutput = viewerPage.getByTestId(`pgd-draft-output-${PGD_GENERATED_DOCUMENT.id}`);
    await viewerOutput.waitFor({ state: 'visible', timeout: 15000 });
    await viewerOutput.getByRole('button', { name: 'Xác nhận đã soát xét' }).click();
    assert.equal(await viewerPage.getByRole('button', { name: 'Sinh tài liệu DOCX' }).isDisabled(), true, 'Viewer cannot generate DOCX output');
    assert.equal(await viewerOutput.getByRole('button', { name: 'Xác nhận & gắn vào bộ hồ sơ' }).isDisabled(), true, 'Viewer cannot attach a reviewed document');
    const viewerMetrics = await collectViewportMetrics(viewerPage, { width: 390, height: 844, name: '390-viewer' });
    assert.equal(viewerMetrics.hasHorizontalOverflow, false, 'Viewer drafting view has no horizontal overflow');
    await viewerPage.addStyleTag({ content: '.nextjs-portal, nextjs-portal, [data-sonner-toaster], [data-sonner-toast], [role="status"] { display: none !important; }' });
    await viewerPage.screenshot({ path: resolve(outDir, 'journey-3-viewer-permissions-390px.png'), fullPage: false });
    await viewerPage.close();

    // AI review is an advisory POST only. It must not invoke any dossier persistence route.
    const simulatedWriteCountBeforeAi = audit.simulatedWrites.length;
    const aiPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installSuperneatInterceptors(aiPage, base.origin, audit);
    await aiPage.goto(new URL('/pgdcn?section=assistant', base).toString(), { waitUntil: 'domcontentloaded' });
    await aiPage.locator('#pgdcn-main-content').waitFor({ state: 'visible', timeout: 15000 });
    await aiPage.getByRole('button', { name: 'Giám định (PGD)' }).click();
    await aiPage.locator('input[type="radio"][name="pgd-assistant-request"]').first().click();
    await aiPage.getByRole('button', { name: 'Bắt đầu soát xét hồ sơ' }).click();
    await aiPage.getByRole('status').filter({ hasText: 'Hoàn tất soát xét synthetic' }).waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(audit.simulatedWrites.length, simulatedWriteCountBeforeAi, 'AI review did not invoke a mutation endpoint');
    assert.equal(audit.readOnlyAdvisoryCalls.length, 1, 'One mocked read-only AI advisory call was observed');
    await aiPage.close();

    // =========================================================================
    // Write summary metrics and assertions
    // =========================================================================
    assert.deepEqual(audit.externalRequests, [], 'Zero external requests allowed');
    assert.deepEqual(audit.pageErrors, [], `No page errors allowed: ${JSON.stringify(audit.pageErrors)}`);
    assert.deepEqual(audit.consoleErrors, [], `No console errors allowed: ${JSON.stringify(audit.consoleErrors)}`);
    assert.equal(audit.createdRequestIds.length, VIEWPORTS.length, 'Every create journey submitted exactly one mocked PYC');
    assert.equal(audit.simulatedWrites.filter((entry) => entry.url === '/api/pgd/requests').length, VIEWPORTS.length, 'All PYC creates were intercepted');
    assert.equal(audit.simulatedWrites.filter((entry) => entry.url.endsWith('/dossier-documents')).length, VIEWPORTS.length, 'All file uploads were intercepted');
    assert.equal(audit.simulatedWrites.filter((entry) => entry.url === '/api/pgd/documents/generate').length, VIEWPORTS.length, 'All DOCX generation calls were intercepted');
    assert.equal(audit.simulatedWrites.filter((entry) => entry.url.endsWith('/dossier-documents/attach-generated')).length, VIEWPORTS.length, 'All document attaches were intercepted');
    assert.equal(audit.simulatedWrites.some((entry) => entry.url === '/api/pgd/approvals'), false, 'No approval persistence route was called by the draft review flow');

    const summaryReport = {
      auditTimestamp: audit.executedAt,
      viewportsTested: VIEWPORTS.map((v) => `${v.width}x${v.height}`),
      journeys: {
        journey1Intake: {
          title: 'Tạo hồ sơ / Tiếp nhận PYC',
          viewports: audit.journey1Metrics,
        },
        journey2Supplement: {
          title: 'Bổ sung tài liệu / Checklist chứng từ',
          viewports: audit.journey2Metrics,
        },
        journey3DraftingApproval: {
          title: 'Soạn thảo DOCX -> Soát xét -> Gắn theo quyền',
          viewports: audit.journey3Metrics,
        },
        viewerPermissionCheck: { viewport: '390x844', generationDisabled: true, attachDisabled: true },
        aiAdvisoryCheck: { readOnlyPostCalls: audit.readOnlyAdvisoryCalls.length, persistenceCallsDuringAiReview: 0 },
      },
      auditSummary: {
        totalScreenshotsCaptured: VIEWPORTS.length * 4 + 1,
        horizontalOverflowIncidents: 0,
        simulatedWritesIntercepted: audit.simulatedWrites.length,
        realServerWrites: 0,
        readOnlyAdvisoryCalls: audit.readOnlyAdvisoryCalls.length,
        externalRequests: audit.externalRequests.length,
        pageErrors: audit.pageErrors.length,
        consoleErrors: audit.consoleErrors.length,
      },
    };

    await writeFile(
      resolve(artifactDirectory, 'three-journeys-metrics.json'),
      `${JSON.stringify(summaryReport, null, 2)}\n`,
      'utf8'
    );
  } finally {
    await browser.close();
  }
});
