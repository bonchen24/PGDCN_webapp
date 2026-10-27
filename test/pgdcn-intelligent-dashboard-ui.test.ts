import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';

import PgdcnDashboardView from '../components/PgdcnDashboardView';

const dashboardProps = (overrides: Record<string, unknown> = {}) => ({
  scopes: ['PCN', 'PGD'],
  pcnDossiers: [],
  pgdRequests: [],
  currentUser: { username: 'lan', name: 'Lan', role: 'staff' },
  notifications: [],
  onOpenPcn: () => undefined,
  onOpenPgd: () => undefined,
  onOpenPcnWorkspace: () => undefined,
  onOpenPgdWorkspace: () => undefined,
  onOpenNotifications: () => undefined,
  onSelectNotification: () => undefined,
  ...overrides,
} as never);

const renderDashboard = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PgdcnDashboardView, dashboardProps(overrides)));

const dossier = (overrides: Record<string, unknown> = {}) => ({
  id: 'pcn-1',
  dossierCode: 'HS-PCN-001',
  status: 'AWAITING_DOCUMENTS',
  ownerUsername: 'lan',
  targetDate: '2000-01-01',
  customerSnapshot: { name: 'Công ty An Bình' },
  ...overrides,
});

const expectMarkup = (markup: string, pattern: RegExp, message: string) => {
  assert.ok(pattern.test(markup), message);
};

const myWorkMarkup = (markup: string) => markup.match(/<section data-testid="pgdcn-dashboard-my-work"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
const attentionQueueMarkup = (markup: string) => markup.match(/<section data-testid="pgdcn-dashboard-attention-queue"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
const textContent = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const renderedHostElements = (node: unknown, tagName: string): Array<{ type: unknown; props: Record<string, unknown> }> => {
  if (Array.isArray(node)) return node.flatMap((child) => renderedHostElements(child, tagName));
  if (!node || typeof node !== 'object' || !('type' in node)) return [];
  const element = node as { type: unknown; props: Record<string, unknown> };
  if (typeof element.type === 'function') {
    return renderedHostElements((element.type as (props: Record<string, unknown>) => unknown)(element.props), tagName);
  }
  return [
    ...(element.type === tagName ? [element] : []),
    ...renderedHostElements(element.props.children, tagName),
  ];
};
const reactTextContent = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactTextContent).join(' ');
  if (node && typeof node === 'object' && 'props' in node) {
    return reactTextContent((node as { props: { children?: unknown } }).props.children);
  }
  return '';
};

test('next-step guidance is distinct from the button that opens the dossier', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier()] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Bước tiếp theo: Bổ sung hồ sơ/, 'The projected business step should be visible as guidance.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Mở hồ sơ · Bổ sung hồ sơ/, 'The primary button should describe opening the dossier and its destination context.');
  expectMarkup(markup, /aria-describedby="pgdcn-action-hint-PCN-pcn-1"/, 'Assistive technology should receive a description that the button opens the dossier.');
  expectMarkup(markup, /Chọn để mở hồ sơ và thực hiện bước tiếp theo: Bổ sung hồ sơ\./, 'The accessible description should name the navigation behavior.');
});

test('overdue work shows a textual overdue marker alongside its due date', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier()] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Quá hạn · 01\/01\/2000/, 'The work row should show an overdue text label beside the due date.');
});

test('overdue dossier assigned to current user stays in my work and is excluded from attention queue', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier()] });

  expectMarkup(textContent(myWorkMarkup(markup)), /HS-PCN-001/, 'The assigned overdue dossier should remain visible in my work.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Quá hạn · 01\/01\/2000/, 'The overdue meaning should remain visible in my work.');
  assert.equal(textContent(attentionQueueMarkup(markup)).includes('HS-PCN-001'), false, 'The actionable overdue dossier should not also render in the attention queue.');
});

test('overdue dossier owned by another user remains visible in attention queue', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier({ ownerUsername: 'mai' })] });

  expectMarkup(textContent(attentionQueueMarkup(markup)), /HS-PCN-001/, 'The overdue dossier owned by another user should appear in the attention queue.');
  expectMarkup(textContent(attentionQueueMarkup(markup)), /Quá hạn · 01\/01\/2000/, 'The overdue marker should remain visible in the attention queue.');
});

test('unknown workflow status explains that the employee should inspect the dossier', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier({ status: 'UNRECOGNIZED_STATUS' })] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Trạng thái chưa xác định\. Mở hồ sơ để kiểm tra bước phù hợp\./, 'Unknown workflow states should explain the next safe step.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Tiếp tục hồ sơ/, 'Unknown workflow states should retain the projection fallback action.');
});

test('empty work state distinguishes no assigned work from dossiers waiting on another person', () => {
  const markup = renderDashboard({
    pcnDossiers: [dossier({ ownerUsername: 'mai', targetDate: undefined })],
  });

  expectMarkup(textContent(myWorkMarkup(markup)), /Hiện chưa có hồ sơ đến lượt bạn xử lý\./, 'An empty actionable queue should not imply that there are no records at all.');
  expectMarkup(textContent(myWorkMarkup(markup)), /1 hồ sơ đang chờ người khác xử lý/, 'The empty message should identify work waiting on another person.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Đang chờ người khác · 1 hồ sơ/, 'Waiting work should remain available through the existing disclosure.');
});

test('waiting disclosure includes every dossier and names the handler or shows the unassigned fallback', () => {
  const waitingDossiers = Array.from({ length: 9 }, (_, index) => dossier({
    id: `pcn-waiting-${index + 1}`,
    dossierCode: `HS-PCN-WAIT-${String(index + 1).padStart(3, '0')}`,
    ownerUsername: index === 8 ? undefined : 'mai',
    targetDate: undefined,
  }));
  const waitingRequests = Array.from({ length: 3 }, (_, index) => ({
    id: `pgd-waiting-${index + 1}`,
    requestCode: `PYC-PGD-WAIT-${String(index + 1).padStart(3, '0')}`,
    status: 'CAPABILITY_REVIEW',
    ownerUsername: 'mai',
  }));
  const markup = renderDashboard({ pcnDossiers: waitingDossiers, pgdRequests: waitingRequests });
  const waitingMarkup = myWorkMarkup(markup);
  const waitingText = textContent(waitingMarkup);

  for (let index = 1; index <= waitingDossiers.length; index += 1) {
    expectMarkup(waitingText, new RegExp(`HS-PCN-WAIT-${String(index).padStart(3, '0')}`), `Waiting dossier ${index} should remain visible beyond the first six.`);
  }
  for (let index = 1; index <= waitingRequests.length; index += 1) {
    expectMarkup(waitingText, new RegExp(`PYC-PGD-WAIT-${String(index).padStart(3, '0')}`), `Waiting request ${index} should remain visible beyond the first six across domains.`);
  }
  expectMarkup(waitingText, /Chờ bổ sung hồ sơ/, 'Each waiting dossier should retain its current workflow status.');
  expectMarkup(waitingText, /Người xử lý: mai/, 'The existing assigned username should be identified as the handler.');
  expectMarkup(waitingText, /Người xử lý: Chưa phân công/, 'Missing assignment data should use the explicit unassigned fallback.');
  expectMarkup(waitingMarkup, /<summary class="mobile-touch-target min-h-11[^\"]*">Xem thêm 6 hồ sơ<\/summary>/, 'The disclosure should reveal additional dossiers through a compact, keyboard-operable show-more control.');
  expectMarkup(waitingMarkup, /<button type="button"[^>]*mobile-touch-target min-h-11[^>]*focus-visible:ring-2/, 'Waiting dossiers should remain keyboard-focusable buttons with a full touch target.');
});

test('waiting dossier actions open the matching PCN or PGD record', () => {
  const openedPcn: string[] = [];
  const openedPgd: string[] = [];
  const component = PgdcnDashboardView as unknown as (props: Record<string, unknown>) => unknown;
  const tree = component(dashboardProps({
    pcnDossiers: [dossier({ id: 'pcn-wait-callback', dossierCode: 'HS-PCN-WAIT-CALLBACK', ownerUsername: 'mai', targetDate: undefined })],
    pgdRequests: [{ id: 'pgd-wait-callback', requestCode: 'PYC-PGD-WAIT-CALLBACK', status: 'CAPABILITY_REVIEW', ownerUsername: 'mai' }],
    onOpenPcn: (id: string) => openedPcn.push(id),
    onOpenPgd: (id: string) => openedPgd.push(id),
  }));
  const waitingButtons = renderedHostElements(tree, 'button');
  const pcnButton = waitingButtons.find((button) => reactTextContent(button.props.children).includes('HS-PCN-WAIT-CALLBACK'));
  const pgdButton = waitingButtons.find((button) => reactTextContent(button.props.children).includes('PYC-PGD-WAIT-CALLBACK'));

  assert.ok(pcnButton, 'The PCN waiting record should render as an action button.');
  assert.ok(pgdButton, 'The PGD waiting record should render as an action button.');
  (pcnButton.props.onClick as () => void)();
  (pgdButton.props.onClick as () => void)();
  assert.deepEqual(openedPcn, ['pcn-wait-callback']);
  assert.deepEqual(openedPgd, ['pgd-wait-callback']);
});

test('dashboard work and no-scope states use clear headings and permission language', () => {
  const markup = renderDashboard({ scopes: [], pcnDossiers: [], pgdRequests: [] });

  expectMarkup(markup, /<h2[^>]*>Việc của tôi<\/h2>/, 'My work should be a real section heading.');
  expectMarkup(markup, /chưa được cấp quyền truy cập miền PCN hoặc PGD/i, 'An empty domain list should explain that no domain scope is available.');
  expectMarkup(myWorkMarkup(markup), /Bạn chưa có hồ sơ đến lượt xử lý\./, 'The empty actionable queue should explain that no work is assigned now.');
});

test('work rows remain mobile-first and keyboard reachable with accessible table headings', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier(), dossier({ id: 'pcn-2', ownerUsername: 'mai' })] });

  expectMarkup(markup, /grid-cols-1[^\"]*lg:grid-cols-\[/, 'Work rows should stack at mobile widths and gain columns on wide screens.');
  expectMarkup(markup, /mobile-touch-target[^\"]*min-h-11[^\"]*w-full/, 'The primary work action should remain a full-width touch target on mobile.');
  expectMarkup(markup, /focus-visible:ring-2/, 'Keyboard users should see focus on work actions.');
  expectMarkup(markup, /<summary class="mobile-touch-target min-h-11 w-full[^\"]*focus-visible:ring-2/, 'The waiting-work disclosure should remain keyboard operable and visibly focused.');
  expectMarkup(markup, /role="row" class="sr-only lg:not-sr-only[^\"]*"[^>]*>[\s\S]*?role="columnheader"/, 'Table labels should remain available to screen readers when hidden visually on mobile.');
  expectMarkup(markup, /role="row" class="grid min-w-0 grid-cols-1[^\"]*py-2[^\"]*lg:grid-cols-\[[^\]]+\][^\"]*lg:py-1\.5/, 'Work rows should keep complete mobile content while using compact vertical spacing at both breakpoints.');
});

const rawUxBaseUrl = process.env.PGDCN_UX_BASE_URL;

const QA_VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

const QA_EMPTY_BOOTSTRAP = {
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

const QA_PCN_DOSSIER = {
  id: 'qa-pcn-1',
  dossierCode: 'DEMO-PCN-001',
  proposalId: 'qa-prop-1',
  fieldCodes: ['KN'],
  method: '1',
  status: 'AWAITING_DOCUMENTS',
  ownerUsername: 'synthetic_admin',
  targetDate: '2026-10-20',
  customerSnapshot: {
    name: 'Công ty Cổ phần Năng lượng và Thiết bị Chiếu sáng Demo QA Toàn Cầu',
    address: 'Hà Nội',
    taxId: '0101234567',
  },
  labRequestIds: [],
  returnedResultIds: [],
  sampleLotIds: [],
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
};

const QA_PCN_PROPOSAL = {
  id: 'qa-prop-1',
  proposalCode: 'PROP-DEMO-001',
  channel: 'DIRECT',
  status: 'CONVERTED',
  dossierId: 'qa-pcn-1',
  productName: 'Hệ thống thiết bị chiếu sáng công nghiệp Demo QA',
  fieldCodes: ['KN'],
  customerSnapshot: {
    name: 'Công ty Cổ phần Năng lượng và Thiết bị Chiếu sáng Demo QA Toàn Cầu',
    address: 'Hà Nội',
    taxId: '0101234567',
  },
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
};

const QA_PGD_REQUEST = {
  domain: 'pgd',
  id: 'qa-pgd-1',
  requestCode: 'PGD-DEMO-001',
  intakeChannel: 'DIRECT',
  requester: { name: 'Đơn vị QA' },
  customerSnapshot: { name: 'Tập đoàn Cơ khí Giám định và Đo lường Kỹ thuật Demo QA' },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'qa-catalog',
  productName: 'Thép kết cấu xây dựng Demo QA',
  quantity: 1,
  inspectionScope: 'Giám định toàn diện',
  inspectionLocation: 'Phòng QA',
  standards: ['TCVN QA'],
  status: 'CAPABILITY_REVIEW',
  ownerUsername: 'synthetic_admin',
  documentPointers: [],
  sampleIds: [],
  labRequestIds: [],
  createdAt: '2026-10-15T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  dossierChecklist: [],
};

const QA_ROLES = [
  {
    role: 'admin' as const,
    username: 'synthetic_admin',
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
    customRoutes: {
      '/api/db/certificationDossiers': { items: [QA_PCN_DOSSIER] },
      '/api/db/certificationProposals': { items: [QA_PCN_PROPOSAL] },
      '/api/pgd/bootstrap': { ...QA_EMPTY_BOOTSTRAP, requests: [QA_PGD_REQUEST] },
    },
  },
  {
    role: 'staff' as const,
    username: 'staff_demo',
    user: {
      username: 'staff_demo',
      name: 'Staff Demo',
      role: 'staff',
      systemRole: 'staff',
      departmentRoleCode: 'CV',
      fieldCodes: ['KN'],
      active: true,
      departmentScopes: ['PCN', 'PGD'],
      pgdRole: 'INSPECTOR',
    },
    customRoutes: {
      '/api/db/certificationDossiers': { items: [QA_PCN_DOSSIER] },
      '/api/db/certificationProposals': { items: [QA_PCN_PROPOSAL] },
      '/api/pgd/bootstrap': { ...QA_EMPTY_BOOTSTRAP, requests: [QA_PGD_REQUEST] },
    },
  },
  {
    role: 'viewer' as const,
    username: 'viewer_demo',
    user: {
      username: 'viewer_demo',
      name: 'Viewer Demo',
      role: 'viewer',
      systemRole: 'viewer',
      departmentRoleCode: 'CV',
      fieldCodes: ['KN'],
      active: true,
      departmentScopes: ['PCN'],
    },
    customRoutes: {
      '/api/db/certificationDossiers': { items: [QA_PCN_DOSSIER] },
      '/api/db/certificationProposals': { items: [QA_PCN_PROPOSAL] },
      '/api/pgd/bootstrap': QA_EMPTY_BOOTSTRAP,
    },
  },
];

test('D01 optional real Chromium QA capture for intelligent dashboard attention overlap', {
  skip: !rawUxBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
  timeout: 240000,
}, async () => {
  const baseUrl = new URL(rawUxBaseUrl || 'http://127.0.0.1:2367');
  if (baseUrl.hostname !== '127.0.0.1' && baseUrl.hostname !== 'localhost') {
    throw new Error(`Security violation: Only loopback base URLs permitted. Received: ${rawUxBaseUrl}`);
  }

  const baseOrigin = baseUrl.origin;
  const outputDir = path.resolve(process.env.PGDCN_UX_OUTPUT_DIR || 'docs/ux-audit/artifacts/d01-qa');
  fs.mkdirSync(outputDir, { recursive: true });

  const expectUniqueAttention = process.env.PGDCN_UX_EXPECT_UNIQUE_ATTENTION !== 'false';
  const browser = await chromium.launch({ headless: true });
  const observations: Array<Record<string, unknown>> = [];

  try {
    for (const roleConfig of QA_ROLES) {
      for (const viewport of QA_VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const apiMutations: Array<{ url: string; method: string }> = [];
        const externalRequests: Array<{ url: string; method: string }> = [];
        const pageErrors: string[] = [];

        page.on('pageerror', (err) => {
          pageErrors.push(err.message || String(err));
        });

        const customRoutes: Record<string, unknown> = {
          '/api/auth/pcn-session': { authenticated: true, user: roleConfig.user },
          ...roleConfig.customRoutes,
        };

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
                  body: JSON.stringify(QA_EMPTY_BOOTSTRAP),
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

        const targetUrl = new URL('/pgdcn', baseUrl).toString();
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        await page.locator('[data-testid="pgdcn-dashboard-kpi-grid"]').waitFor({ state: 'visible', timeout: 15000 });
        const fixtureSection = roleConfig.role === 'admin' ? 'my-work' : 'attention-queue';
        await page.locator(`[data-testid="pgdcn-dashboard-${fixtureSection}"]`).getByText('DEMO-PCN-001', { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });

        const hasHorizontalOverflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth;
        });

        const visibleButtonCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          }).length;
        });

        const headings = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
            .map((el) => ({
              level: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().replace(/\s+/g, ' '),
            }));
        });

        const visibleModalCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')).filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          }).length;
        });

        const recordCodes = await page.evaluate(() => {
          const myWorkEl = document.querySelector('[data-testid="pgdcn-dashboard-my-work"]');
          const attentionEl = document.querySelector('[data-testid="pgdcn-dashboard-attention-queue"]');
          const myWorkText = myWorkEl?.textContent || '';
          const actionableText = Array.from(myWorkEl?.querySelectorAll('[role="table"] [role="row"]:not(.sr-only)') || [])
            .map((row) => row.textContent || '')
            .join(' ');
          const attentionText = attentionEl?.textContent || '';
          const allText = document.body?.textContent || '';
          const candidates = ['DEMO-PCN-001', 'PGD-DEMO-001'];
          return {
            myWork: candidates.filter((code) => myWorkText.includes(code)),
            actionableWork: candidates.filter((code) => actionableText.includes(code)),
            attention: candidates.filter((code) => attentionText.includes(code)),
            all: candidates.filter((code) => allText.includes(code)),
          };
        });

        await page.keyboard.press('Tab');
        const primaryFocusAfterTab = await page.evaluate(() => {
          const active = document.activeElement;
          if (!active || active === document.body) return null;
          return {
            tagName: active.tagName.toLowerCase(),
            text: (active.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            ariaLabel: active.getAttribute('aria-label') || null,
            role: active.getAttribute('role') || null,
            id: active.id || null,
          };
        });

        const screenshotFileName = `${roleConfig.role}-${viewport.width}x${viewport.height}.png`;
        const screenshotFullPath = path.join(outputDir, screenshotFileName);
        await page.screenshot({ path: screenshotFullPath, fullPage: true });

        assert.equal(hasHorizontalOverflow, false, `${roleConfig.role} ${viewport.width}x${viewport.height}: No horizontal overflow allowed`);
        assert.equal(apiMutations.length, 0, `${roleConfig.role} ${viewport.width}x${viewport.height}: Zero API mutations expected`);
        assert.equal(externalRequests.length, 0, `${roleConfig.role} ${viewport.width}x${viewport.height}: Zero external requests expected`);
        assert.equal(pageErrors.length, 0, `${roleConfig.role} ${viewport.width}x${viewport.height}: Zero page errors expected`);

        if (roleConfig.role === 'admin') {
          assert.ok(recordCodes.actionableWork.includes('DEMO-PCN-001'), 'Admin: DEMO-PCN-001 must be actionable in My Work');
          assert.ok(recordCodes.actionableWork.includes('PGD-DEMO-001'), 'Admin: PGD-DEMO-001 must be actionable in My Work');
          if (expectUniqueAttention) {
            assert.equal(recordCodes.attention.includes('DEMO-PCN-001'), false, 'Admin (unique): DEMO-PCN-001 must NOT be in Attention');
            assert.equal(recordCodes.attention.includes('PGD-DEMO-001'), false, 'Admin (unique): PGD-DEMO-001 must NOT be in Attention');
          } else {
            assert.ok(recordCodes.attention.includes('DEMO-PCN-001'), 'Admin (pre-fix baseline): DEMO-PCN-001 overlap in Attention');
            assert.ok(recordCodes.attention.includes('PGD-DEMO-001'), 'Admin (pre-fix baseline): PGD-DEMO-001 overlap in Attention');
          }
        } else if (roleConfig.role === 'staff') {
          assert.ok(recordCodes.attention.includes('DEMO-PCN-001'), 'Staff: DEMO-PCN-001 unassigned must be in Attention');
          assert.ok(recordCodes.attention.includes('PGD-DEMO-001'), 'Staff: PGD-DEMO-001 unassigned must be in Attention');
          assert.ok(recordCodes.myWork.includes('DEMO-PCN-001'), 'Staff: waiting PCN dossier must remain available in the collapsed waiting list');
          assert.ok(recordCodes.myWork.includes('PGD-DEMO-001'), 'Staff: waiting PGD dossier must remain available in the collapsed waiting list');
          assert.equal(recordCodes.actionableWork.includes('DEMO-PCN-001'), false, 'Staff: waiting PCN dossier must not be counted as actionable My Work');
          assert.equal(recordCodes.actionableWork.includes('PGD-DEMO-001'), false, 'Staff: waiting PGD dossier must not be counted as actionable My Work');
        } else if (roleConfig.role === 'viewer') {
          assert.ok(recordCodes.attention.includes('DEMO-PCN-001'), 'Viewer: DEMO-PCN-001 in-scope PCN attention must be visible');
          assert.equal(recordCodes.attention.includes('PGD-DEMO-001'), false, 'Viewer: PGD-DEMO-001 must NOT be in Attention');
          assert.equal(recordCodes.actionableWork.includes('DEMO-PCN-001'), false, 'Viewer: read-only PCN dossier must not appear as actionable My Work');
          assert.equal(recordCodes.actionableWork.includes('PGD-DEMO-001'), false, 'Viewer: PGD-DEMO-001 must NOT be in actionable My Work');
          assert.equal(recordCodes.all.includes('PGD-DEMO-001'), false, 'Viewer: PGD-DEMO-001 must NEVER appear for PCN-only viewer');
        }

        observations.push({
          mode: 'QA_MOCKED',
          timestamp: new Date().toISOString(),
          role: roleConfig.role,
          viewport,
          screenshotPath: screenshotFileName,
          measuredDomValues: {
            dashboardRendered: true,
            hasHorizontalOverflow,
            visibleButtonCount,
            headings,
            primaryFocusAfterTab,
            visibleModalCount,
            recordCodesInMyWork: recordCodes.myWork,
            recordCodesInActionableWork: recordCodes.actionableWork,
            recordCodesInAttention: recordCodes.attention,
          },
          mutationCount: apiMutations.length,
          externalRequestCount: externalRequests.length,
          pageErrorCount: pageErrors.length,
          pageErrors,
        });

        await context.close();
      }
    }

    const metricsPayload = {
      mode: 'QA_MOCKED',
      timestamp: new Date().toISOString(),
      baseUrl: rawUxBaseUrl,
      expectUniqueAttention,
      totalScreenshots: observations.length,
      totalRoles: QA_ROLES.length,
      totalViewports: QA_VIEWPORTS.length,
      observations,
    };

    fs.writeFileSync(path.join(outputDir, 'metrics.json'), JSON.stringify(metricsPayload, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
});
