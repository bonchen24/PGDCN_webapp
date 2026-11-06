import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test from 'node:test';
import { installDocumentDatabase, multipartRouteRequest, routeRequest } from './helpers/document-route-database.ts';

const pcnSupplementary = await import('../app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts');
const pcnCollection = await import('../app/api/db/[collection]/route.ts');
const pgdDossierDocuments = await import('../app/api/pgd/requests/[requestId]/dossier-documents/route.ts');

const pcnCreator = { username: 'b1-creator', name: 'B1 Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'] };
const pgdCreator = { username: 'pgd-b1-creator', name: 'PGD Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_STAFF' };

function usePrivateStorageMock(t: import('node:test').TestContext) {
  const baseUrl = 'http://private-storage.test';
  const oldUrl = process.env.SUPABASE_STORAGE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_STORAGE_URL = baseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';
  const uploads: Array<{ url: string; bytes: Buffer }> = [];
  const actualFetch = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(baseUrl)) return actualFetch(input, init);
    if (url.endsWith('/bucket')) return new Response(null, { status: 200 });
    const body = init?.body;
    const bytes = Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body as Uint8Array);
    uploads.push({ url, bytes });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_STORAGE_URL;
    else process.env.SUPABASE_STORAGE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  return uploads;
}

function makePcnFileForm(id: string, name: string, bytes: Buffer, category: string) {
  const form = new FormData();
  form.set('stageId', 'intake');
  form.set('title', `${category} · ${name}`);
  form.set('description', `B1: ${category}`);
  form.set('supplementaryItemId', `pcn-b1-${id}`);
  form.set('file', new File([bytes], name, { type: 'application/pdf' }));
  return form;
}

function makePgdFileForm(id: string, name: string, bytes: Buffer, category: string) {
  const form = new FormData();
  form.set('supplementaryStageId', 'intake');
  form.set('requirementCode', `PGD_SUPPLEMENTARY_INTAKE_${id}`);
  form.set('title', `${category} · ${name}`);
  form.set('note', `B1: ${category}`);
  form.set('file', new File([bytes], name, { type: 'application/pdf' }));
  return form;
}

test('PCN intake accepts actual file bytes, persists attachments, and makes retries idempotent', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-pcn-b1-byte-test';
  db.seed('certificationDossiers', dossierId, {
    id: dossierId,
    dossierCode: 'HS-2026-PCN-B1',
    proposalId: 'proposal-pcn-b1-byte-test',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    intakeCreatedByUsername: pcnCreator.username,
    workflowSnapshot: { nodes: [{ id: 'intake', label: 'Tiếp nhận', active: true }] },
  });
  db.seed('pcnDossierWorkflowTasks', 'pcn-task-b1-intake', { id: 'pcn-task-b1-intake', dossierId, nodeId: 'intake', status: 'READY' });

  const requestFor = (id: string, name: string, bytes: Buffer, category: string) => multipartRouteRequest(
    `/api/pcn/dossiers/${dossierId}/supplementary-attachments`,
    makePcnFileForm(id, name, bytes, category),
    pcnCreator,
  );
  const contractBytes = Buffer.from('%PDF-1.7 contract bytes');
  const invoiceBytes = Buffer.from('%PDF-1.7 invoice bytes');
  for (const [id, name, bytes, category] of [
    ['contract-1', 'contract.pdf', contractBytes, 'Hợp đồng'],
    ['invoice-1', 'invoice.pdf', invoiceBytes, 'Hóa đơn'],
  ] as const) {
    const response = await pcnSupplementary.POST(requestFor(id, name, bytes, category), { params: Promise.resolve({ dossierId }) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).attachment.byteSize, bytes.byteLength);
  }

  const retry = await pcnSupplementary.POST(requestFor('contract-1', 'contract.pdf', contractBytes, 'Hợp đồng'), { params: Promise.resolve({ dossierId }) });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).idempotent, true);
  const persisted = db.list('dossierAttachments').map((row) => row.data);
  assert.equal(persisted.length, 2);
  assert.deepEqual(new Set(persisted.map((item) => item.description)), new Set(['B1: Hợp đồng', 'B1: Hóa đơn']));
  assert.equal(db.assets.size, 2);
  assert.equal(uploads.length, 2);
  assert.deepEqual(new Set(uploads.map((item) => item.bytes.toString())), new Set([contractBytes.toString(), invoiceBytes.toString()]));

  const reload = await pcnCollection.GET(routeRequest('/api/db/dossierAttachments', 'GET', {}, pcnCreator), { params: Promise.resolve({ collection: 'dossierAttachments' }) });
  assert.equal(reload.status, 200);
  const reloadedItems = (await reload.json()).items;
  assert.equal(reloadedItems.filter((item: any) => item.dossierId === dossierId).length, 2);
});

test('PGD intake uploads real bytes, reloads only PGD documents, and retries without duplicate versions', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const requestId = 'pgd-request-b1-byte-test';
  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-B1-001',
    productGroup: 'OTHER',
    status: 'DRAFT',
    workflowSnapshot: { requirementDefinitions: [], stages: [] },
    dossierChecklist: [],
  });

  const send = (id: string, name: string, bytes: Buffer, category: string) => pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, makePgdFileForm(id, name, bytes, category), pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  const requestBytes = Buffer.from('%PDF-1.7 PYC bytes');
  const technicalBytes = Buffer.from('%PDF-1.7 technical bytes');
  for (const [id, name, bytes, category] of [
    ['request-1', 'pyc.pdf', requestBytes, 'Phiếu / đề nghị'],
    ['technical-1', 'technical.pdf', technicalBytes, 'Tài liệu kỹ thuật'],
  ] as const) {
    const response = await send(id, name, bytes, category);
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).dossierDocument.byteSize, bytes.byteLength);
  }

  const retry = await send('request-1', 'pyc.pdf', requestBytes, 'Phiếu / đề nghị');
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).idempotent, true);
  db.seed('pgdDossierDocuments', 'cross-domain-pcn-document', {
    id: 'cross-domain-pcn-document', domain: 'pcn', requestId, requirementCode: 'PCN_ONLY', title: 'Do not return',
  });
  const reload = await pgdDossierDocuments.GET(
    routeRequest(`/api/pgd/requests/${requestId}/dossier-documents`, 'GET', {}, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(reload.status, 200);
  const reloaded = (await reload.json()).dossierDocuments;
  assert.equal(reloaded.length, 2);
  assert.ok(reloaded.every((document: any) => document.domain === 'pgd'));
  assert.equal(db.assets.size, 2);
  assert.equal(uploads.length, 2);
  assert.deepEqual(new Set(uploads.map((item) => item.bytes.toString())), new Set([requestBytes.toString(), technicalBytes.toString()]));
});

test('PCN and PGD upload boundaries deny accounts that only have access to the other domain', async (t) => {
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-domain-isolation';
  const requestId = 'pgd-request-domain-isolation';
  db.seed('certificationDossiers', dossierId, { id: dossierId, dossierCode: dossierId, fieldCodes: ['QC4'], status: 'INTAKE_REVIEW', workflowSnapshot: { nodes: [{ id: 'intake', label: 'Tiếp nhận', active: true }] } });
  db.seed('pgdInspectionRequests', requestId, { id: requestId, domain: 'pgd', requestCode: requestId, productGroup: 'OTHER', status: 'DRAFT', workflowSnapshot: { requirementDefinitions: [], stages: [] }, dossierChecklist: [] });

  const pcnDenied = await pcnSupplementary.POST(multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, makePcnFileForm('denied', 'denied.pdf', Buffer.from('bytes'), 'Khác'), pgdCreator), { params: Promise.resolve({ dossierId }) });
  assert.equal(pcnDenied.status, 403);
  const pcnReadDenied = await pcnCollection.GET(routeRequest('/api/db/dossierAttachments', 'GET', {}, pgdCreator), { params: Promise.resolve({ collection: 'dossierAttachments' }) });
  assert.equal(pcnReadDenied.status, 403);
  const pgdDenied = await pgdDossierDocuments.POST(multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, makePgdFileForm('denied', 'denied.pdf', Buffer.from('bytes'), 'Khác'), pcnCreator), { params: Promise.resolve({ requestId }) });
  assert.equal(pgdDenied.status, 403);
  const pgdReadDenied = await pgdDossierDocuments.GET(routeRequest(`/api/pgd/requests/${requestId}/dossier-documents`, 'GET', {}, pcnCreator), { params: Promise.resolve({ requestId }) });
  assert.equal(pgdReadDenied.status, 403);
  assert.equal(db.assets.size, 0);
});
