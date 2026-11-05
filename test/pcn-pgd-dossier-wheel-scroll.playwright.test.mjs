// QA MODE: SYNTHETIC/MOCK — session and API responses are stubbed; this is not real authenticated dossier QA.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PizZip from 'pizzip';
import mammoth from 'mammoth';

const baseUrl = process.env.PGDCN_UX_BASE_URL || 'http://localhost:1357';
const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
];

const pcnDossier = {
  id: 'qa-wheel-pcn',
  dossierCode: 'DEMO-PCN-WHEEL',
  proposalId: 'proposal-wheel-pcn',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'INTAKE_REVIEW',
  ownerUsername: 'synthetic_admin',
  labRequestIds: [],
  returnedResultIds: [],
  sampleLotIds: [],
  createdAt: '2026-11-05T08:00:00.000Z',
  updatedAt: '2026-11-05T08:00:00.000Z',
};

const pcnProposal = {
  id: 'proposal-wheel-pcn',
  proposalCode: 'PROP-PCN-WHEEL',
  status: 'CONVERTED',
  dossierId: 'qa-wheel-pcn',
  fieldCodes: ['QC4'],
  customerSnapshot: { name: 'Khách hàng synthetic kiểm tra cuộn bánh xe', address: 'Địa chỉ synthetic' },
  productName: 'Sản phẩm synthetic kiểm tra cuộn bánh xe',
  quantity: 1,
  channel: 'DIRECT',
  receivedAt: '2026-11-05T08:00:00.000Z',
  createdAt: '2026-11-05T08:00:00.000Z',
  updatedAt: '2026-11-05T08:00:00.000Z',
};

const pcnDocuments = [{
  id: 'qa-wheel-pcn-document',
  dossierId: 'qa-wheel-pcn',
  requirementId: 'QC4-PROPOSAL',
  fieldCode: 'QC4',
  status: 'PRESENT',
  currentVersionId: 'qa-wheel-pcn-asset',
  versions: [{
    assetId: 'qa-wheel-pcn-asset',
    fileName: 'synthetic-wheel-pcn.pdf',
    mimeType: 'application/pdf',
    uploadedAt: '2026-11-05T08:00:00.000Z',
    uploadedBy: 'synthetic_admin',
  }],
}];

const pgdRequest = {
  domain: 'pgd',
  id: 'qa-wheel-pgd',
  requestCode: 'DEMO-PGD-WHEEL',
  intakeChannel: 'DIRECT',
  requester: { name: 'Đơn vị kiểm thử synthetic PGDCN' },
  customerSnapshot: { name: 'Khách hàng synthetic kiểm tra cuộn bánh xe', address: 'Địa chỉ synthetic' },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'qa-catalog',
  productName: 'Sản phẩm synthetic kiểm tra cuộn bánh xe',
  lotCode: 'QA-WHEEL-001',
  quantity: 12,
  unit: 'tấn',
  weight: 12,
  weightUnit: 'tấn',
  inspectionScope: 'Kiểm tra synthetic cho hồi quy cuộn hồ sơ.',
  inspectionLocation: 'Khu vực synthetic',
  standards: ['TCVN QA 001'],
  status: 'WAITING_LAB_RESULTS',
  documentPointers: [],
  sampleIds: [],
  labRequestIds: [],
  createdAt: '2026-11-05T08:00:00.000Z',
  updatedAt: '2026-11-05T08:00:00.000Z',
  dossierChecklist: [],
};

const pgdDocument = {
  id: 'qa-wheel-pgd-document',
  domain: 'pgd',
  requestId: 'qa-wheel-pgd',
  requirementCode: 'REQUEST_PYC',
  title: 'Phiếu yêu cầu synthetic',
  fileName: 'synthetic-wheel-pgd.pdf',
  sourceCollection: 'pgdDossierDocuments',
  sourceDocumentId: 'qa-wheel-pgd-document',
  version: 1,
  checksum: 'synthetic-wheel-checksum',
  uploadedByUsername: 'synthetic_admin',
  uploadedAt: '2026-11-05T08:00:00.000Z',
  fileAssetId: 'qa-wheel-pgd-asset',
  mimeType: 'application/pdf',
};

function sessionFor(department) {
  return {
    authenticated: true,
    user: {
      username: 'synthetic_admin',
      name: 'Synthetic QA',
      role: 'admin',
      systemRole: 'admin',
      departmentRoleCode: 'GD',
      fieldCodes: department === 'PCN' ? ['QC4'] : ['KN'],
      active: true,
      departmentScopes: [department],
      pgdRole: 'PGD_ADMIN',
    },
  };
}

async function createPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Synthetic dossier PDF for wheel-scroll QA - page ${pageNumber}`, {
      x: 48,
      y: 740,
      size: 18,
      font,
      color: rgb(0.1, 0.2, 0.4),
    });
  }
  return Buffer.from(await pdf.save());
}

async function createDocx() {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic DOCX preview</w:t></w:r></w:p></w:body></w:document>');
  const bytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  const extracted = await mammoth.extractRawText({ buffer: bytes });
  assert.match(extracted.value, /Synthetic DOCX preview/, 'The synthetic fixture is a readable DOCX package');
  return bytes;
}

function readMultipartField(body, name) {
  return body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r\\n]*)`))?.[1] || '';
}

async function installSyntheticRoutes(page, base, department, pdfBytes, audit, options = {}) {
  const activePgdDocument = options.docxBytes ? {
    ...pgdDocument,
    id: 'qa-wheel-pgd-docx',
    sourceDocumentId: 'qa-wheel-pgd-docx',
    title: 'Synthetic DOCX document',
    fileName: 'synthetic-wheel-pgd.docx',
    fileAssetId: 'qa-wheel-pgd-docx-asset',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  } : pgdDocument;
  const pgdDocuments = department === 'PGD' ? [activePgdDocument] : [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (['blob:', 'chrome:', 'chrome-extension:', 'data:', 'edge:', 'edge-extension:', 'moz-extension:', 'resource:'].includes(url.protocol)) {
      await route.continue();
      return;
    }

    if (url.origin !== base.origin) {
      if (!url.hostname.includes('googleapis.com') && !url.hostname.includes('gstatic.com')) {
        audit.externalRequests.push({ url: request.url(), method });
      }
      await route.abort('blockedbyclient');
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    audit.apiRequests.push({ method, pathname: url.pathname });

    if (method !== 'GET' && department === 'PGD' && options.supplementaryWriteMode
      && url.pathname === '/api/pgd/requests/qa-wheel-pgd/dossier-documents') {
      const body = request.postData() || '';
      const title = readMultipartField(body, 'title');
      const note = readMultipartField(body, 'note');
      const supplementaryStageId = readMultipartField(body, 'supplementaryStageId');
      audit.syntheticWrites.push({ method, title, note, supplementaryStageId, hasFile: /name="file"/.test(body) });
      if (options.supplementaryWriteMode === 'failure') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic supplementary save failed.' }) });
        return;
      }
      const document = {
        id: 'qa-wheel-pgd-supplementary',
        domain: 'pgd',
        requestId: 'qa-wheel-pgd',
        requirementCode: `PGD_SUPPLEMENTARY_${supplementaryStageId.toUpperCase().replace(/-/g, '_')}_SYNTHETIC`,
        title,
        fileName: 'pgd-dossier.meta',
        sourceCollection: 'pgdDossierDocuments',
        sourceDocumentId: 'qa-wheel-pgd-supplementary',
        version: 1,
        checksum: 'synthetic-metadata-checksum',
        uploadedByUsername: 'synthetic_admin',
        uploadedAt: '2026-11-05T08:00:00.000Z',
        note,
        supplementaryStageId,
      };
      pgdDocuments.push(document);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ dossierDocument: document }) });
      return;
    }

    if (method !== 'GET') {
      audit.apiMutations.push({ url: request.url(), method });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.pathname === '/api/auth/pcn-session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionFor(department)) });
      return;
    }

    if (url.pathname === '/api/pgd/bootstrap') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customers: [], users: [], catalog: [], requests: department === 'PGD' ? [pgdRequest] : [], assignments: [], fieldInspections: [],
          samples: [], labRequests: [], labResults: [], templates: [], documentTemplates: [], reports: [],
          certificates: [], approvals: [], dossierDocuments: pgdDocuments, documents: [], inspectionPlans: [],
          caseEvents: [], fieldActivityLogs: [], labResultReviews: [], dossierIndexes: [],
          calibrationInstruments: [], workflowTemplates: [],
        }),
      });
      return;
    }

    if (department === 'PCN') {
      if (url.pathname === '/api/db/certificationDossiers') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [pcnDossier] }) });
      } else if (url.pathname === '/api/db/certificationProposals') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [pcnProposal] }) });
      } else if (url.pathname === '/api/db/dossierDocuments') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: pcnDocuments }) });
      } else if (url.pathname.startsWith('/api/pcn/files/')) {
        await route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBytes });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      }
      return;
    }

    if (url.pathname === '/api/pgd/requests/qa-wheel-pgd/dossier-documents') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dossierDocuments: pgdDocuments, requirements: [] }),
      });
      return;
    }

    if (url.pathname.startsWith('/api/pgd/dossier-documents/')) {
      await route.fulfill({
        status: 200,
        contentType: options.docxBytes ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
        body: options.docxBytes || pdfBytes,
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function openDossier(page, base, department, pdfBytes, audit, options) {
  await installSyntheticRoutes(page, base, department, pdfBytes, audit, options);
  const pathname = department === 'PCN'
    ? '/pgdcn/pcn/dossiers/qa-wheel-pcn?tab=overview'
    : '/pgdcn/pgd/dossiers/qa-wheel-pgd';
  await page.goto(new URL(pathname, base).toString(), { waitUntil: 'domcontentloaded' });
  const shellTestId = department === 'PCN' ? 'pcn-dossier-focus-shell' : 'pgd-dossier-focus-shell';
  const dossierShell = page.getByTestId(shellTestId);
  try {
    await dossierShell.waitFor({ state: 'visible', timeout: 12000 });
  } catch (error) {
    const title = await page.title().catch(() => 'unavailable');
    const bodyText = await page.locator('body').innerText().catch(() => 'unavailable');
    const syntheticSessionReady = audit.apiResponses.slice(-20).some(({ pathname: apiPath, status }) => apiPath === '/api/auth/pcn-session' && status === 200);
    if (syntheticSessionReady && bodyText.includes('Đang xác thực phiên PGDCN...')) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      try {
        await dossierShell.waitFor({ state: 'visible', timeout: 12000 });
      } catch (retryError) {
        const retryBody = await page.locator('body').innerText().catch(() => 'unavailable');
        throw new Error(`${retryError.message}; firstAttempt=${error.message}; department=${department}; viewport=${JSON.stringify(page.viewportSize())}; title=${title}; url=${page.url()}; body=${retryBody.slice(0, 600)}; api=${JSON.stringify(audit.apiRequests.slice(-14))}; apiResponses=${JSON.stringify(audit.apiResponses.slice(-14))}`);
      }
    } else {
    const serviceWorkers = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.() || []).map((registration) => registration.scope)).catch(() => []);
      throw new Error(`${error.message}; department=${department}; viewport=${JSON.stringify(page.viewportSize())}; title=${title}; url=${page.url()}; body=${bodyText.slice(0, 800)}; api=${JSON.stringify(audit.apiRequests.slice(-14))}; apiResponses=${JSON.stringify(audit.apiResponses.slice(-14))}; browserApi=${JSON.stringify(audit.browserApiRequests.slice(-14))}; failed=${JSON.stringify(audit.failedRequests.slice(-8))}; pageErrors=${JSON.stringify(audit.pageErrors)}; serviceWorkers=${JSON.stringify(serviceWorkers)}; console=${JSON.stringify(audit.consoleErrors)}`);
    }
  }
  if (department === 'PCN') {
    const reader = page.getByTestId('pcn-dossier-document-reader');
    await reader.waitFor({ state: 'attached', timeout: 10000 });
    if (page.viewportSize().width < 1024) {
      await page.getByTestId('pcn-dossier-mobile-switcher').getByRole('button', { name: 'Xem tài liệu' }).click();
    }
    await reader.waitFor({ state: 'visible', timeout: 5000 });
  } else {
    const reader = page.getByTestId('pgd-dossier-document-reader');
    await reader.waitFor({ state: 'attached', timeout: 10000 });
    if (page.viewportSize().width < 1024) {
      await page.locator('#pgd-dossier-mobile-tab-reader').click({ timeout: 5000 });
    }
    await reader.waitFor({ state: 'visible', timeout: 5000 });
  }
  const pdfIframe = page.locator(`${department === 'PCN' ? '[data-testid="pcn-dossier-document-reader"]' : '[data-testid="pgd-dossier-document-reader"]'} iframe`);
  if (await pdfIframe.count()) {
    await pdfIframe.waitFor({ state: 'attached' });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(150);
}

function scrollerSelector(department) {
  return department === 'PCN' ? '.pcn-dossier-focus-scroll' : '[data-testid="pgd-dossier-scroll-area"]';
}

async function captureVisiblePdfRegion(page, iframe, viewportWidth) {
  const frame = await iframe.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const visible = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom) };
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) {
        visible.left = Math.max(visible.left, ancestorRect.left + ancestor.clientLeft);
        visible.top = Math.max(visible.top, ancestorRect.top + ancestor.clientTop);
        visible.right = Math.min(visible.right, ancestorRect.left + ancestor.clientLeft + ancestor.clientWidth);
        visible.bottom = Math.min(visible.bottom, ancestorRect.top + ancestor.clientTop + ancestor.clientHeight);
      }
    }
    return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, visible };
  });
  const clip = {
    x: Math.round(Math.max(frame.visible.left, frame.rect.x + 4)),
    y: Math.round(Math.max(frame.visible.top, frame.rect.y + 60)),
    width: Math.floor(frame.visible.right - Math.max(frame.visible.left, frame.rect.x + 4) - 4),
    height: viewportWidth <= 430 ? 160 : 300,
  };
  assert.ok(clip.width > 80 && clip.y + clip.height < frame.visible.bottom,
    `Expected a stable, visible PDF content region: ${JSON.stringify({ frame, clip })}`);
  return { image: await page.screenshot({ clip, animations: 'disabled' }), frame, clip };
}

async function addSyntheticOverflow(page, selector) {
  return page.locator(selector).evaluate((area) => {
    const fixture = document.createElement('div');
    fixture.dataset.syntheticScrollFixture = 'true';
    fixture.style.cssText = 'min-height: 1800px; padding: 20px; background: #f8fafc;';
    const table = document.createElement('table');
    table.dataset.syntheticScrollTable = 'true';
    table.style.cssText = 'width: 100%; border-collapse: collapse;';
    const body = document.createElement('tbody');
    for (let row = 0; row < 24; row += 1) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="padding:12px;border:1px solid #cbd5e1">Synthetic row ${row + 1}</td><td style="padding:12px;border:1px solid #cbd5e1">Scroll probe</td>`;
      body.appendChild(tr);
    }
    table.appendChild(body);
    fixture.appendChild(table);
    area.appendChild(fixture);
    return { scrollHeight: area.scrollHeight, clientHeight: area.clientHeight };
  });
}

async function readPointDiagnostics(page, selector) {
  return page.evaluate((scrollSelector) => {
    const scroller = document.querySelector(scrollSelector);
    const shell = document.querySelector('[data-testid="pcn-dossier-focus-shell"], [data-testid="pgd-dossier-focus-shell"]');
    const header = document.querySelector('[data-testid="pcn-dossier-mobile-header"], [data-testid="pgd-dossier-mobile-header"]');
    const table = document.querySelector('[data-synthetic-scroll-table], table');
    const reader = document.querySelector('[data-testid="pcn-dossier-document-reader"], [data-testid="pgd-dossier-document-reader"]');
    const iframe = reader?.querySelector('iframe');
    const pointFor = (element, xRatio = 0.5, yRatio = 0.5) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const x = Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width * xRatio));
      const y = Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height * yRatio));
      const hit = document.elementFromPoint(x, y);
      const ancestors = [];
      for (let node = hit; node && ancestors.length < 8; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (node.scrollHeight > node.clientHeight + 1 || ['auto', 'scroll', 'hidden'].includes(style.overflowY)) {
          ancestors.push({
            tag: node.tagName.toLowerCase(),
            testId: node.getAttribute('data-testid'),
            className: typeof node.className === 'string' ? node.className : '',
            scrollTop: node.scrollTop,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
            overflowY: style.overflowY,
            overscrollY: style.overscrollBehaviorY,
          });
        }
      }
      return {
        x, y,
        hit: hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}${hit.getAttribute('data-testid') ? `[data-testid=${hit.getAttribute('data-testid')}]` : ''}` : null,
        ancestors,
        scroller: scroller ? { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight } : null,
        main: document.querySelector('main') ? {
          scrollTop: document.querySelector('main').scrollTop,
          scrollHeight: document.querySelector('main').scrollHeight,
          clientHeight: document.querySelector('main').clientHeight,
        } : null,
        document: { scrollTop: document.scrollingElement?.scrollTop ?? null },
      };
    };

    const rect = scroller?.getBoundingClientRect();
    const blankPoint = rect ? {
      x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + 4)),
      y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + Math.min(48, rect.height / 2))),
    } : null;
    const describeAt = (point) => {
      if (!point) return null;
      const hit = document.elementFromPoint(point.x, point.y);
      const ancestors = [];
      for (let node = hit; node && ancestors.length < 8; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (node.scrollHeight > node.clientHeight + 1 || ['auto', 'scroll', 'hidden'].includes(style.overflowY)) {
          ancestors.push({
            tag: node.tagName.toLowerCase(),
            testId: node.getAttribute('data-testid'),
            className: typeof node.className === 'string' ? node.className : '',
            scrollTop: node.scrollTop,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
            overflowY: style.overflowY,
            overscrollY: style.overscrollBehaviorY,
          });
        }
      }
      return { ...point, hit: hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}` : null, ancestors };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroller: scroller ? {
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        overflowY: getComputedStyle(scroller).overflowY,
        overscrollY: getComputedStyle(scroller).overscrollBehaviorY,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
      } : null,
      shellZIndex: shell ? getComputedStyle(shell).zIndex : null,
      hits: {
        header: pointFor(header),
        blank: describeAt(blankPoint),
        table: pointFor(table),
        reader: pointFor(reader),
        iframe: pointFor(iframe),
      },
    };
  }, selector);
}

async function pointWithinViewport(page, locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'Expected an element with a visible browser bounding box');
  const viewport = page.viewportSize();
  const visibleTop = Math.max(0, box.y);
  const visibleBottom = Math.min(viewport.height, box.y + box.height);
  assert.ok(visibleBottom > visibleTop, 'Expected the target element to intersect the viewport');
  const point = {
    x: Math.max(1, Math.min(viewport.width - 1, box.x + box.width / 2)),
    y: Math.max(1, Math.min(viewport.height - 1, (visibleTop + visibleBottom) / 2)),
  };
  return page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      hitTag: hit?.tagName.toLowerCase() || null,
      insideSyntheticTable: Boolean(hit?.closest('table[data-synthetic-scroll-table]')),
      insideDialog: Boolean(hit?.closest('[role="dialog"]')),
    };
  }, point);
}

function compactPoint(point) {
  if (!point) return null;
  const nearestScrollNode = point.ancestors?.find(({ overflowY }) => ['auto', 'scroll'].includes(overflowY));
  const main = point.main || point.ancestors?.find(({ tag }) => tag === 'main');
  return {
    hit: point.hit,
    x: point.x,
    y: point.y,
    nearestScrollNode: nearestScrollNode ? { tag: nearestScrollNode.tag, testId: nearestScrollNode.testId, scrollTop: nearestScrollNode.scrollTop, scrollHeight: nearestScrollNode.scrollHeight, clientHeight: nearestScrollNode.clientHeight, overscrollY: nearestScrollNode.overscrollY } : null,
    main: main ? { scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight } : null,
  };
}

test('synthetic PCN/PGD dossiers scroll with the mouse wheel without moving the page at a scroll boundary', async () => {
  const base = new URL(baseUrl);
  const appResponse = await fetch(base);
  assert.equal(appResponse.status, 200, `Expected PGDCN app at ${base.origin}`);
  assert.match(await appResponse.text(), /PGDCN|Phòng Giám định|TVCI/i, 'Expected the PGDCN application fingerprint');

  const pdfBytes = await createPdf();
  const audit = { label: 'SYNTHETIC/MOCK — not authenticated session QA', apiRequests: [], apiResponses: [], browserApiRequests: [], failedRequests: [], pageErrors: [], hydrationWarnings: [], apiMutations: [], externalRequests: [], consoleErrors: [], cases: [] };
  const browser = await chromium.launch({ headless: true });

  try {
    for (const department of ['PCN', 'PGD']) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        const pageErrors = [];
        page.on('pageerror', (error) => {
          const message = error.stack || error.message;
          if (message.includes("Hydration failed because the server rendered HTML didn't match the client")) {
            audit.hydrationWarnings.push({ department, viewport, message });
            return;
          }
          pageErrors.push(message);
          audit.pageErrors.push(message);
        });
        page.on('console', (message) => { if (message.type() === 'error') audit.consoleErrors.push(message.text()); });
        page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) audit.browserApiRequests.push({ method: request.method(), url: request.url() }); });
        page.on('response', (response) => { const pathname = new URL(response.url()).pathname; if (pathname.startsWith('/api/')) audit.apiResponses.push({ pathname, status: response.status() }); });
        page.on('requestfailed', (request) => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
        await openDossier(page, base, department, pdfBytes, audit);
        const selector = scrollerSelector(department);
        const initial = await readPointDiagnostics(page, selector);
        if (process.env.PGDCN_SCROLL_SCREENSHOT_DIR && viewport.width === 1366) {
          await mkdir(process.env.PGDCN_SCROLL_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: join(process.env.PGDCN_SCROLL_SCREENSHOT_DIR, `synthetic-${department.toLowerCase()}-1366x768.png`) });
        }
        const header = initial.hits.header;
        let headerHover = null;
        if (header) {
          await page.mouse.move(header.x, header.y);
          headerHover = await page.evaluate(({ x, y }) => {
            const hit = document.elementFromPoint(x, y);
            return hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}${hit.getAttribute('data-testid') ? `[data-testid=${hit.getAttribute('data-testid')}]` : ''}` : null;
          }, { x: header.x, y: header.y });
          assert.equal(headerHover, header.hit, `${department} ${viewport.width}: header hover did not match its elementFromPoint diagnostic`);
        }
        const expanded = await addSyntheticOverflow(page, selector);
        const beforeDown = await page.locator(selector).evaluate((area) => ({ scrollTop: area.scrollTop, scrollHeight: area.scrollHeight, clientHeight: area.clientHeight }));
        const blank = initial.hits.blank;
        assert.ok(blank, `${department} ${viewport.width}: expected a hit-test point in the dossier content`);
        await page.mouse.move(blank.x, blank.y);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(100);
        const afterDown = await page.locator(selector).evaluate((area) => area.scrollTop);
        assert.ok(afterDown > beforeDown.scrollTop, `${department} ${viewport.width}: mouse wheel down did not scroll the dossier area. initial=${JSON.stringify(initial)} expanded=${JSON.stringify(expanded)}`);

        await page.locator(selector).evaluate((area) => { area.scrollTop = area.scrollHeight; });
        const atBottom = await page.locator(selector).evaluate((area) => area.scrollTop);
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(100);
        const afterUp = await page.locator(selector).evaluate((area) => area.scrollTop);
        assert.ok(afterUp < atBottom, `${department} ${viewport.width}: mouse wheel up did not scroll the dossier area`);

        const tableRow = page.locator('[data-synthetic-scroll-table] tbody tr').nth(12);
        await tableRow.scrollIntoViewIfNeeded();
        const tablePoint = await pointWithinViewport(page, tableRow);
        assert.ok(tablePoint.insideSyntheticTable, `${department} ${viewport.width}: hit test missed the synthetic table: ${JSON.stringify(tablePoint)}`);
        const beforeTableWheel = await page.locator(selector).evaluate((area) => area.scrollTop);
        await page.mouse.move(tablePoint.x, tablePoint.y);
        await page.mouse.wheel(0, 360);
        await page.waitForTimeout(100);
        const afterTableWheel = await page.locator(selector).evaluate((area) => area.scrollTop);
        assert.ok(afterTableWheel > beforeTableWheel, `${department} ${viewport.width}: wheel over a table did not scroll the dossier area`);

        const iframe = page.locator(`${department === 'PCN' ? '[data-testid="pcn-dossier-document-reader"]' : '[data-testid="pgd-dossier-document-reader"]'} iframe`);
        let iframeWheel = null;
        if (await iframe.isVisible().catch(() => false)) {
          await iframe.scrollIntoViewIfNeeded();
          const iframePoint = await pointWithinViewport(page, iframe);
          assert.equal(iframePoint.hitTag, 'iframe', `${department} ${viewport.width}: PDF wheel hit test missed the iframe: ${JSON.stringify(iframePoint)}`);
          const beforeIframeWheel = await page.locator(selector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0 }));
          const pdfElement = await iframe.elementHandle();
          const pdfFrame = await pdfElement?.contentFrame();
          const readPdfFrameMetrics = async () => pdfFrame?.evaluate(() => {
            const scrollport = document.scrollingElement;
            return {
              url: location.href,
              contentType: document.contentType,
              scrollTop: scrollport?.scrollTop ?? null,
              scrollHeight: scrollport?.scrollHeight ?? null,
              clientHeight: scrollport?.clientHeight ?? null,
            };
          }).catch(() => null) || null;
          const pdfFrameBefore = await readPdfFrameMetrics();
          await page.mouse.move(iframePoint.x, iframePoint.y);
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(150);
          const afterIframeWheel = await page.locator(selector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0 }));
          const pdfFrameAfter = await readPdfFrameMetrics();
          assert.equal(afterIframeWheel.mainScrollTop, beforeIframeWheel.mainScrollTop, `${department} ${viewport.width}: wheel over the PDF iframe moved the app page`);
          const dossierMoved = afterIframeWheel.scrollTop !== beforeIframeWheel.scrollTop;
          const pdfMoved = pdfFrameBefore && pdfFrameAfter && pdfFrameAfter.scrollTop !== pdfFrameBefore.scrollTop;
          assert.ok(dossierMoved || pdfMoved, `${department} ${viewport.width}: wheel over the PDF iframe had no observable effect in either the reader or its dossier scroller. pdf=${JSON.stringify({ before: pdfFrameBefore, after: pdfFrameAfter })}`);
          iframeWheel = { point: iframePoint, dossierBefore: beforeIframeWheel, dossierAfter: afterIframeWheel, pdfBefore: pdfFrameBefore, pdfAfter: pdfFrameAfter };
        }

        let overlayWheel = null;
        if (department === 'PCN') {
          const previewButton = page.getByRole('button', { name: 'Xem nhanh' });
          await previewButton.click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor({ state: 'visible' });
          const dialogHeader = dialog.locator('header');
          const dialogPoint = await pointWithinViewport(page, dialogHeader);
          assert.ok(dialogPoint.insideDialog, `${department} ${viewport.width}: overlay hit test missed the preview dialog`);
          const beforeOverlayWheel = await page.locator(selector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0, bodyOverflow: document.body.style.overflow }));
          await page.mouse.move(dialogPoint.x, dialogPoint.y);
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(100);
          const afterOverlayWheel = await page.locator(selector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0, bodyOverflow: document.body.style.overflow }));
          assert.equal(afterOverlayWheel.scrollTop, beforeOverlayWheel.scrollTop, `${department} ${viewport.width}: wheel over the preview overlay moved the background dossier`);
          assert.equal(afterOverlayWheel.mainScrollTop, beforeOverlayWheel.mainScrollTop, `${department} ${viewport.width}: wheel over the preview overlay moved the page`);
          assert.equal(afterOverlayWheel.bodyOverflow, 'hidden', `${department} ${viewport.width}: expected the preview to keep its body scroll lock`);
          overlayWheel = { point: dialogPoint, before: beforeOverlayWheel, after: afterOverlayWheel };
          await dialog.getByRole('button', { name: 'Đóng xem nhanh' }).click();
          await dialog.waitFor({ state: 'hidden' });
          assert.notEqual(await page.locator('body').evaluate((body) => body.style.overflow), 'hidden', `${department} ${viewport.width}: closing preview did not release its scroll lock`);
        }

        await page.locator(selector).evaluate((area) => { area.replaceChildren(); area.scrollTop = 0; });
        const emptyBefore = await readPointDiagnostics(page, selector);
        assert.ok(emptyBefore.scroller.scrollHeight <= emptyBefore.scroller.clientHeight + 1, `${department} ${viewport.width}: expected a no-overflow case`);
        await page.mouse.move(blank.x, blank.y);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(100);
        const emptyAfter = await readPointDiagnostics(page, selector);
        assert.ok(emptyAfter.scroller, `${department} ${viewport.width}: empty dossier scroller disappeared: ${JSON.stringify({ url: page.url(), title: await page.title(), errors: pageErrors })}`);
        assert.equal(emptyAfter.scroller.scrollTop, emptyBefore.scroller.scrollTop, `${department} ${viewport.width}: empty dossier scroller moved`);
        assert.equal(emptyAfter.hits.blank?.ancestors.find((node) => node.tag === 'main')?.scrollTop ?? 0,
          emptyBefore.hits.blank?.ancestors.find((node) => node.tag === 'main')?.scrollTop ?? 0,
          `${department} ${viewport.width}: wheel at an empty dossier region moved the page`);

        audit.cases.push({
          department,
          viewport,
          initial: { scroller: initial.scroller, hits: Object.fromEntries(Object.entries(initial.hits).map(([name, point]) => [name, compactPoint(point)])) },
          headerHover,
          expanded,
          afterDown,
          afterUp,
          tableWheel: { point: tablePoint, before: beforeTableWheel, after: afterTableWheel },
          iframeWheel,
          overlayWheel,
          noOverflow: {
            before: { scroller: emptyBefore.scroller, mainScrollTop: emptyBefore.hits.blank?.ancestors.find((node) => node.tag === 'main')?.scrollTop ?? 0 },
            after: { scroller: emptyAfter.scroller, mainScrollTop: emptyAfter.hits.blank?.ancestors.find((node) => node.tag === 'main')?.scrollTop ?? 0 },
          },
          pageErrors,
        });
        await page.close();
      }
    }

    assert.deepEqual(audit.apiMutations, [], `Synthetic QA must not invoke mutating APIs: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Synthetic QA must not call external services: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.cases.every((item) => item.pageErrors.length === 0), `Expected no browser runtime errors: ${JSON.stringify(audit.cases)}`);
    console.log(JSON.stringify({
      label: audit.label,
      cases: audit.cases.map(({ department, viewport, initial, headerHover, expanded, afterDown, afterUp, tableWheel, iframeWheel, overlayWheel, noOverflow, pageErrors }) => ({
        department,
        viewport,
        scrollerAtLoad: { scrollTop: initial.scroller.scrollTop, scrollHeight: initial.scroller.scrollHeight, clientHeight: initial.scroller.clientHeight, overflowY: initial.scroller.overflowY },
        elementFromPoint: Object.fromEntries(Object.entries(initial.hits).map(([name, point]) => [name, point ? { hit: point.hit, scrollNode: point.nearestScrollNode?.testId || point.nearestScrollNode?.tag || null } : null])),
        headerHover,
        syntheticOverflow: expanded,
        wheelDownScrollTop: afterDown,
        wheelUpScrollTop: afterUp,
        tableWheel: { hit: tableWheel.point.hitTag, before: tableWheel.before, after: tableWheel.after },
        iframeWheel: iframeWheel ? { hit: iframeWheel.point.hitTag, dossierBefore: iframeWheel.dossierBefore, dossierAfter: iframeWheel.dossierAfter, pdfBefore: iframeWheel.pdfBefore, pdfAfter: iframeWheel.pdfAfter } : null,
        overlayWheel: overlayWheel ? { hit: overlayWheel.point.hitTag, before: overlayWheel.before, after: overlayWheel.after } : null,
        noOverflow: { scrollerTopBefore: noOverflow.before.scroller.scrollTop, scrollerTopAfter: noOverflow.after.scroller.scrollTop, mainBefore: noOverflow.before.mainScrollTop, mainAfter: noOverflow.after.mainScrollTop },
        pageErrorCount: pageErrors.length,
      })),
      syntheticAuthHydrationWarningCount: audit.hydrationWarnings.length,
      apiReadCount: audit.apiRequests.length,
      apiMutations: audit.apiMutations,
      externalRequests: audit.externalRequests,
      failedRequests: audit.failedRequests.filter(({ error }) => error !== 'net::ERR_ABORTED'),
      consoleWarningCount: audit.consoleErrors.length,
      consoleWarnings: audit.consoleErrors.map((message) => message.slice(0, 180)),
    }, null, 2));
  } finally {
    await browser.close();
  }
});

test('synthetic PGD document actions separate reader, new tab, download, and supplementary modal states', async () => {
  const base = new URL(baseUrl);
  const pdfBytes = await createPdf();
  const audit = { apiRequests: [], apiResponses: [], browserApiRequests: [], failedRequests: [], pageErrors: [], hydrationWarnings: [], apiMutations: [], syntheticWrites: [], externalRequests: [], consoleErrors: [], cases: [] };
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('download', (download) => { audit.unexpectedDownloads = [...(audit.unexpectedDownloads || []), { url: download.url(), fileName: download.suggestedFilename() }]; });
    await openDossier(page, base, 'PGD', pdfBytes, audit, { supplementaryWriteMode: 'failure' });
    await page.locator('#pgd-dossier-mobile-tab-work').click();
    await page.getByTestId('pgd-dossier-native-flow').getByRole('tab').first().click();

    const documentTable = page.getByTestId('pgd-dossier-document-action-table');
    const documentRow = documentTable.getByRole('row').filter({ hasText: pgdDocument.fileName });
    assert.equal(await documentRow.count(), 1, 'The fixture document appears in the intake-stage table');
    assert.ok(await documentRow.getByRole('button', { name: `Xem ${pgdDocument.title}` }).count(), 'The document row exposes the Eye control');
    const eye = documentRow.getByRole('button', { name: `Xem ${pgdDocument.title}` });
    const downloadsBeforeEye = audit.unexpectedDownloads?.length || 0;
    await eye.click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#pgd-dossier-mobile-tab-reader').getAttribute('aria-selected'), 'true', 'Eye selects the Reader tab on mobile');
    assert.equal(page.context().pages().length, 1, 'Eye does not open a second tab');
    assert.ok(await page.getByTestId('pgd-dossier-document-reader').locator('iframe').isVisible(), 'Eye selects the PDF in the in-page reader');
    assert.equal(audit.unexpectedDownloads?.length || 0, downloadsBeforeEye, `Eye does not trigger a download: ${JSON.stringify(audit.unexpectedDownloads || [])}`);

    await page.locator('#pgd-dossier-mobile-tab-work').click();
    await page.context().route('**/api/pgd/dossier-documents/*/download*', async (route) => {
      audit.syntheticPreviewGets = (audit.syntheticPreviewGets || 0) + 1;
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBytes });
    });
    const openInNewTab = page.getByRole('link', { name: `Mở ${pgdDocument.title} trong tab mới` });
    const inlineHref = new URL(await openInNewTab.getAttribute('href'), base);
    assert.equal(inlineHref.origin, base.origin, 'External open stays on the authenticated same origin');
    assert.equal(inlineHref.searchParams.get('inline'), '1', 'External open requests inline MIME disposition');
    const popupPromise = page.waitForEvent('popup');
    await openInNewTab.click();
    const popup = await popupPromise;
    await popup.waitForTimeout(100);
    assert.equal(page.context().pages().length, 2, 'FileText opens a distinct tab');
    await popup.close();

    const downloadPromise = page.waitForEvent('download');
    await documentRow.getByRole('link', { name: 'Tải xuống' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), pgdDocument.fileName, 'Download keeps the original file name');

    await page.getByTestId('pgd-supplementary-trigger').click();
    const dialog = page.getByRole('dialog', { name: /Thêm đầu mục tài liệu phụ trợ/ });
    await dialog.waitFor({ state: 'visible' });
    await page.getByTestId('pgd-supplementary-submit').click();
    assert.ok(await dialog.getByRole('alert').isVisible(), 'Empty title validation stays inline');
    await page.getByLabel('Tên tài liệu phụ trợ').fill('Synthetic metadata only');
    await page.getByLabel('Mô tả tài liệu phụ trợ').fill('Synthetic description retained on failure');
    await page.getByTestId('pgd-supplementary-submit').click();
    assert.ok(await dialog.isVisible(), 'A failed metadata save keeps the modal open');
    assert.match(await dialog.getByRole('alert').innerText(), /Synthetic supplementary save failed/i);
    assert.equal(await page.getByLabel('Tên tài liệu phụ trợ').inputValue(), 'Synthetic metadata only');
    assert.equal(await page.getByLabel('Mô tả tài liệu phụ trợ').inputValue(), 'Synthetic description retained on failure');
    await dialog.getByRole('button', { name: 'Hủy' }).click();

    await page.close();
    const successPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    successPage.on('pageerror', (error) => pageErrors.push(error.message));
    await openDossier(successPage, base, 'PGD', pdfBytes, audit, { supplementaryWriteMode: 'success' });
    await successPage.locator('#pgd-dossier-mobile-tab-work').click();
    await successPage.getByTestId('pgd-dossier-native-flow').getByRole('tab').first().click();
    await successPage.getByTestId('pgd-supplementary-trigger').click();
    await successPage.getByLabel('Tên tài liệu phụ trợ').fill('Synthetic metadata saved');
    await successPage.getByLabel('Mô tả tài liệu phụ trợ').fill('No file is required for a metadata-only item');
    await successPage.getByTestId('pgd-supplementary-submit').click();
    await successPage.getByRole('row', { name: /Synthetic metadata saved/ }).waitFor({ state: 'visible' });
    assert.equal(await successPage.getByRole('dialog', { name: /Thêm đầu mục tài liệu phụ trợ/ }).count(), 0, 'Successful save closes the modal');

    assert.deepEqual(audit.apiMutations, [], 'Every API write was intercepted by the synthetic mock');
    assert.deepEqual(audit.externalRequests, [], 'Synthetic UI QA does not call external services');
    assert.deepEqual(audit.syntheticWrites.map(({ method, title, note, supplementaryStageId, hasFile }) => ({ method, title, note, supplementaryStageId, hasFile })), [
      { method: 'POST', title: 'Synthetic metadata only', note: 'Synthetic description retained on failure', supplementaryStageId: 'intake', hasFile: false },
      { method: 'POST', title: 'Synthetic metadata saved', note: 'No file is required for a metadata-only item', supplementaryStageId: 'intake', hasFile: false },
    ], 'The mock receives the expected stage and text with no file bytes');
    assert.equal(audit.syntheticPreviewGets, 1, 'The external tab uses the inline, same-origin preview endpoint');
    assert.deepEqual(pageErrors, [], 'No browser runtime errors occur');
  } finally {
    await browser.close();
  }
});

test('synthetic DOCX preview renders private file text inside the dossier reader', async () => {
  const base = new URL(baseUrl);
  const docxBytes = await createDocx();
  const audit = { apiRequests: [], apiResponses: [], browserApiRequests: [], failedRequests: [], pageErrors: [], hydrationWarnings: [], apiMutations: [], externalRequests: [], consoleErrors: [], cases: [] };
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (error) => audit.pageErrors.push(error.message));
    await openDossier(page, base, 'PGD', Buffer.alloc(0), audit, { docxBytes });
    const preview = page.locator('[aria-label="Bản xem chỉ đọc: synthetic-wheel-pgd.docx"]');
    await preview.waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await preview.innerText(), /Synthetic DOCX preview/);
    const openInNewTab = page.getByRole('link', { name: 'Mở bản xem' });
    assert.equal(await openInNewTab.getAttribute('href'), '/api/pgd/dossier-documents/qa-wheel-pgd-docx/download?inline=1');
    assert.deepEqual(audit.apiMutations, [], 'DOCX preview is read-only');
    assert.deepEqual(audit.externalRequests, [], 'Private DOCX bytes stay on the same origin');
    assert.deepEqual(audit.pageErrors, [], 'No browser runtime errors occur');
    await page.close();
  } finally {
    await browser.close();
  }
});

test('native PDF readers consume focused wheel input in PCN and PGD', {
  skip: process.env.PGDCN_NATIVE_PDF_QA !== '1' ? 'Set PGDCN_NATIVE_PDF_QA=1 to run the headful native PDF viewer check' : false,
}, async () => {
  const base = new URL(baseUrl);
  const pdfBytes = await createPdf();
  const audit = { apiRequests: [], apiResponses: [], browserApiRequests: [], failedRequests: [], pageErrors: [], hydrationWarnings: [], apiMutations: [], externalRequests: [], consoleErrors: [], cases: [] };
  const browser = await chromium.launch({ headless: false, ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'] });
  const context = await browser.newContext();

  try {
    for (const department of ['PCN', 'PGD']) {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        page.on('pageerror', (error) => audit.pageErrors.push(error.message));
        page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) audit.browserApiRequests.push({ method: request.method(), url: request.url() }); });
        page.on('response', (response) => { const pathname = new URL(response.url()).pathname; if (pathname.startsWith('/api/')) audit.apiResponses.push({ pathname, status: response.status() }); });
        page.on('requestfailed', (request) => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
        await openDossier(page, base, department, pdfBytes, audit);

        if (viewport.width <= 430) {
          if (department === 'PCN') await page.getByTestId('pcn-dossier-mobile-switcher').getByRole('button', { name: 'Xem tài liệu' }).click();
          else await page.locator('#pgd-dossier-mobile-tab-reader').click();
        }

        const readerId = department === 'PCN' ? 'pcn-dossier-document-reader' : 'pgd-dossier-document-reader';
        const iframe = page.getByTestId(readerId).locator('iframe');
        await iframe.waitFor({ state: 'visible', timeout: 15000 });
        await iframe.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
        const scrollSelector = scrollerSelector(department);
        const beforeCapture = await captureVisiblePdfRegion(page, iframe, viewport.width);
        const point = { x: beforeCapture.clip.x + beforeCapture.clip.width / 2, y: beforeCapture.clip.y + beforeCapture.clip.height / 2 };
        await page.mouse.move(point.x, point.y);
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(250);
        const dossierBefore = await page.locator(scrollSelector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0 }));
        const hitAtWheelPoint = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName.toLowerCase() || null, point);
        const beforeImage = beforeCapture.image;
        const beforeHash = createHash('sha256').update(beforeImage).digest('hex');
        const pdfFrame = await (await iframe.elementHandle())?.contentFrame();
        const iframeRectBefore = beforeCapture.frame.rect;
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(1000);
        const dossierAfterWheel = await page.locator(scrollSelector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0 }));
        const afterCapture = await captureVisiblePdfRegion(page, iframe, viewport.width);
        const afterImage = afterCapture.image;
        const afterHash = createHash('sha256').update(afterImage).digest('hex');
        const iframeRectAfter = afterCapture.frame.rect;
        const dossierAfter = await page.locator(scrollSelector).evaluate((area) => ({ scrollTop: area.scrollTop, mainScrollTop: document.querySelector('main')?.scrollTop || 0 }));
        if (process.env.PGDCN_NATIVE_PDF_ARTIFACT_DIR) {
          await mkdir(process.env.PGDCN_NATIVE_PDF_ARTIFACT_DIR, { recursive: true });
          await writeFile(join(process.env.PGDCN_NATIVE_PDF_ARTIFACT_DIR, `${department.toLowerCase()}-${viewport.width}-before.png`), beforeImage);
          await writeFile(join(process.env.PGDCN_NATIVE_PDF_ARTIFACT_DIR, `${department.toLowerCase()}-${viewport.width}-after.png`), afterImage);
        }
        const frameContentType = await pdfFrame?.evaluate(() => document.contentType).catch(() => null);
        const nativeViewerDebug = { department, viewport, src: await iframe.getAttribute('src'), frameUrl: pdfFrame?.url() || null, frameContentType, hitAtWheelPoint, beforeHash, afterHash, dossierBefore, dossierAfterWheel, dossierAfter, iframeRectBefore, iframeRectAfter, recentApiResponses: audit.apiResponses.slice(-5), externalRequests: audit.externalRequests.slice(-5), failedRequests: audit.failedRequests.slice(-5) };
        nativeViewerDebug.captureBefore = beforeCapture.clip;
        nativeViewerDebug.captureAfter = afterCapture.clip;
        console.log('Native PDF wheel diagnostic:', JSON.stringify(nativeViewerDebug));

        assert.equal(hitAtWheelPoint, 'iframe', `${department}/${viewport.width}: wheel target was not the embedded PDF frame`);
        assert.equal(frameContentType, 'application/pdf', `${department}/${viewport.width}: the reader did not load a real PDF`);
        assert.notEqual(afterHash, beforeHash, `${department}/${viewport.width}: native PDF viewer did not visibly move after a focused wheel event`);
        assert.deepEqual(dossierAfter, dossierAfterWheel, `${department}/${viewport.width}: PDF capture itself changed dossier scroll position`);
        audit.cases.push({ department, viewport, beforeHash, afterHash, dossierBefore, dossierAfterWheel, dossierAfter });
        await page.close();
      }
    }

    assert.deepEqual(audit.apiMutations, [], `Native PDF QA must not invoke mutating APIs: ${JSON.stringify(audit.apiMutations)}`);
    assert.deepEqual(audit.externalRequests, [], `Native PDF QA must not call external services: ${JSON.stringify(audit.externalRequests)}`);
    assert.ok(audit.pageErrors.length === 0, `Expected no browser runtime errors: ${JSON.stringify(audit.pageErrors)}`);
    console.log('Native PDF wheel observations:', JSON.stringify(audit.cases));
  } finally {
    await context.close();
    await browser.close();
  }
});
