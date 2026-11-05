// QA MODE: SYNTHETIC/MOCK — auth/session and API routes are stubbed; this is not real authenticated UI QA.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const rawBaseUrl = process.env.PGDCN_UX_BASE_URL;
const artifactRoot = resolve('docs/ux-audit/artifacts/density/next-batch/d10');
const PHASE = process.env.PGDCN_DENSITY_PHASE === 'before' ? 'before' : 'after';
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1440, height: 1000 },
];
const ROLES = [
  { id: 'admin', role: 'admin', systemRole: 'admin', pgdRole: 'PGD_ADMIN' },
  { id: 'staff', role: 'staff', systemRole: 'staff', pgdRole: 'PGD_INSPECTOR' },
  { id: 'viewer', role: 'viewer', systemRole: 'viewer', pgdRole: 'PGD_VIEWER' },
];

const DOSSIER = {
  id: 'qa-d10',
  dossierCode: 'DEMO-PCN-D10',
  proposalId: 'proposal-d10',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'INTAKE_REVIEW',
  ownerUsername: 'synthetic_admin',
  labRequestIds: [],
  returnedResultIds: [],
  sampleLotIds: [],
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

const PROPOSAL = {
  id: 'proposal-d10',
  proposalCode: 'PROP-PCN-D10',
  status: 'CONVERTED',
  dossierId: 'qa-d10',
  fieldCodes: ['QC4'],
  productName: 'Sản phẩm synthetic D10',
  quantity: 1,
  createdAt: '2026-10-27T08:00:00.000Z',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

function documentFixture(requirementId) {
  return {
    id: `qa-d10-document-${requirementId}`,
    dossierId: 'qa-d10',
    requirementId,
    fieldCode: 'QC4',
    status: 'PRESENT',
    currentVersionId: `asset-${requirementId}`,
    versions: [{
      assetId: `asset-${requirementId}`,
      fileName: `synthetic-${requirementId.toLowerCase()}.pdf`,
      uploadedAt: '2026-10-27T08:00:00.000Z',
      uploadedBy: 'synthetic_admin',
    }],
  };
}

async function installRoutes(page, origin, role, documents, audit) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (url.origin !== origin) {
      if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
        await route.abort('blockedbyclient');
        return;
      }
      audit.externalRequests.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (method !== 'GET') {
      audit.apiMutations.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.pathname === '/api/auth/pcn-session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        authenticated: true,
        user: {
          username: `synthetic_${role.id}`,
          name: `Synthetic ${role.id}`,
          role: role.role,
          systemRole: role.systemRole,
          departmentRoleCode: 'GD',
          fieldCodes: ['QC4'],
          active: true,
          departmentScopes: ['PCN'],
          pgdRole: role.pgdRole,
        },
      }) });
      return;
    }
    if (url.pathname === '/api/db/certificationDossiers') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [DOSSIER] }) });
      return;
    }
    if (url.pathname === '/api/db/certificationProposals') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [PROPOSAL] }) });
      return;
    }
    if (url.pathname === '/api/db/dossierDocuments') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: documents }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

async function captureScenario(browser, base, role, viewport, scenario, audit) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installRoutes(page, base.origin, role, scenario.documents, audit);
  await page.goto(new URL('/pgdcn/pcn/dossiers/qa-d10?tab=documents', base).toString(), { waitUntil: 'domcontentloaded' });
  await page.getByTestId('pcn-dossier-mobile-header').getByText('DEMO-PCN-D10', { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('[aria-labelledby="pcn-visual-checklist-title"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(120);

  const metrics = await page.evaluate(({ roleId, screen, scenarioId }) => {
    const header = document.querySelector('[data-testid="pcn-dossier-mobile-header"]');
    const context = document.querySelector('[data-testid="pcn-dossier-context-summary"]');
    const visual = document.querySelector('[aria-labelledby="pcn-visual-checklist-title"]');
    const step = document.querySelector('[data-testid="pcn-legacy-work-panel"]');
    const headerText = header?.innerText || '';
    const contextText = context?.innerText || '';
    const visualText = visual?.innerText || '';
    const stepText = step?.innerText || '';
    const headerMatch = contextText.match(/Còn\s+(\d+)\s+tài liệu bắt buộc/iu);
    const globalMatch = visualText.match(/Bắt buộc còn thiếu\s+(\d+)\s*\/\s*(\d+)/iu);
    const stationMatch = stepText.match(/Tài liệu bước\s+(\d+)\s*\/\s*(\d+)\s+tài liệu bắt buộc/iu);
    const box = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      role: roleId,
      scenario: scenarioId,
      width: screen.width,
      height: screen.height,
      headerGlobalMissingCount: headerMatch ? Number(headerMatch[1]) : null,
      headerRetainsMissingBadge: header?.innerText.includes('Thiếu tài liệu') ?? false,
      globalChecklistMissingCount: globalMatch ? Number(globalMatch[1]) : null,
      globalChecklistRequiredTotal: globalMatch ? Number(globalMatch[2]) : null,
      currentStepRequiredPresent: stationMatch ? Number(stationMatch[1]) : null,
      currentStepRequiredTotal: stationMatch ? Number(stationMatch[2]) : null,
      headerBounds: box(document.querySelector('[data-testid="pcn-dossier-mobile-header"]')),
      checklistBounds: box(visual),
      bodyOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    };
  }, { roleId: role.id, screen: viewport, scenarioId: scenario.id });
  metrics.pageErrors = [...pageErrors];

  const directory = resolve(artifactRoot, PHASE);
  await mkdir(directory, { recursive: true });
  const suffix = scenario.id === 'missing' ? '' : `-${scenario.id}`;
  await page.screenshot({
    path: resolve(directory, `${role.id}-${viewport.width}x${viewport.height}${suffix}.png`),
    animations: 'disabled',
    fullPage: false,
  });
  if (role.id === 'admin' && viewport.width === 390) {
    await page.locator('[aria-labelledby="pcn-visual-checklist-title"]').evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(80);
    await page.screenshot({
      path: resolve(directory, `${role.id}-${viewport.width}x${viewport.height}-checklist${suffix}.png`),
      animations: 'disabled',
      fullPage: false,
    });
  }
  audit.screens.push(metrics);
  await page.close();
  return metrics;
}

test('D10 PCN detail distinguishes global missing documents from the current-step checklist', {
  skip: !rawBaseUrl ? 'PGDCN_UX_BASE_URL is unset; test is opt-in' : false,
}, async () => {
  const base = new URL(rawBaseUrl || 'http://127.0.0.1:2367');
  const audit = { phase: PHASE, apiMutations: [], externalRequests: [], screens: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ROLES) {
      for (const viewport of VIEWPORTS) {
        await captureScenario(browser, base, role, viewport, { id: 'missing', documents: [] }, audit);
      }
      await captureScenario(browser, base, role, VIEWPORTS[1], {
        id: 'one-present',
        documents: [documentFixture('QC4-PROPOSAL')],
      }, audit);
    }

    const directory = resolve(artifactRoot, PHASE);
    await writeFile(resolve(directory, 'metrics.json'), `${JSON.stringify({ capturedAt: new Date().toISOString(), ...audit }, null, 2)}\n`, 'utf8');
    assert.deepEqual(audit.apiMutations, [], `Synthetic QA must not call mutation APIs: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Synthetic QA must not call external services: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.screens.every((screen) => screen.pageErrors.length === 0), `No browser runtime errors expected: ${JSON.stringify(audit.screens)}`);
    assert.ok(audit.screens.every((screen) => !screen.bodyOverflow), `No body overflow expected: ${JSON.stringify(audit.screens)}`);

    const missing = audit.screens.filter((screen) => screen.scenario === 'missing');
    const onePresent = audit.screens.filter((screen) => screen.scenario === 'one-present');
    assert.equal(missing.length, ROLES.length * VIEWPORTS.length);
    assert.equal(onePresent.length, ROLES.length);
    for (const screen of missing) {
      assert.equal(screen.globalChecklistMissingCount, 14, `Global missing count for ${screen.role}/${screen.width}`);
      assert.equal(screen.globalChecklistRequiredTotal, 14, `Global required total for ${screen.role}/${screen.width}`);
      assert.equal(screen.currentStepRequiredPresent, 0, `Current-step present count for ${screen.role}/${screen.width}`);
      assert.equal(screen.currentStepRequiredTotal, 5, `Current-step required total for ${screen.role}/${screen.width}`);
      assert.equal(screen.headerGlobalMissingCount, null, `The documents tab must not repeat the global count in its header for ${screen.role}/${screen.width}`);
      assert.equal(screen.headerRetainsMissingBadge, true, `The qualitative missing-document badge remains for ${screen.role}/${screen.width}`);
    }
    for (const screen of onePresent) {
      assert.equal(screen.globalChecklistMissingCount, 13, `Global missing count for ${screen.role} with one document`);
      assert.equal(screen.globalChecklistRequiredTotal, 14, `Global required total for ${screen.role} with one document`);
      assert.equal(screen.currentStepRequiredPresent, 1, `Current-step present count for ${screen.role} with one document`);
      assert.equal(screen.currentStepRequiredTotal, 5, `Current-step required total for ${screen.role} with one document`);
      assert.equal(screen.headerGlobalMissingCount, null, `The documents tab must not repeat the global count in its header for ${screen.role}`);
      assert.equal(screen.headerRetainsMissingBadge, true, `The qualitative missing-document badge remains for ${screen.role}`);
    }
  } finally {
    await browser.close();
  }
});
