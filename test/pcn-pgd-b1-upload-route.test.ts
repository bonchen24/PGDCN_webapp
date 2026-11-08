import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import fs from 'node:fs';
import test from 'node:test';
import { installDocumentDatabase, multipartRouteRequest, routeRequest } from './helpers/document-route-database.ts';
import * as pgdDossierRequirements from '../utils/pgdDossier.ts';

const pcnSupplementary = await import('../app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts');
const pcnCollection = await import('../app/api/db/[collection]/route.ts');
const pgdDossierDocuments = await import('../app/api/pgd/requests/[requestId]/dossier-documents/route.ts');
const pcnAttachmentMapping = await import('../app/api/pcn/dossiers/[dossierId]/attachment-mapping/route.ts');
const pgdAttachmentMapping = await import('../app/api/pgd/requests/[requestId]/attachment-mapping/route.ts');
const pcnFileDownload = await import('../app/api/pcn/files/[assetId]/route.ts');
const pgdFileDownload = await import('../app/api/pgd/dossier-documents/[documentId]/download/route.ts');

const pcnCreator = { username: 'b1-creator', name: 'B1 Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'] };
const pgdCreator = { username: 'pgd-b1-creator', name: 'PGD Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_STAFF' };

function usePrivateStorageMock(t: import('node:test').TestContext, options: { failFirstUpload?: boolean } = {}) {
  const baseUrl = 'http://private-storage.test';
  const oldUrl = process.env.SUPABASE_STORAGE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_STORAGE_URL = baseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';
  const uploads: Array<{ url: string; bytes: Buffer }> = [];
  const storedObjects = new Map<string, { bytes: Buffer; contentType: string }>();
  let failFirstUpload = Boolean(options.failFirstUpload);
  const actualFetch = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(baseUrl)) return actualFetch(input, init);
    if (url.endsWith('/bucket')) return new Response(null, { status: 200 });
    if (init?.method === 'GET') {
      const stored = storedObjects.get(url);
      return stored
        ? new Response(stored.bytes, { status: 200, headers: { 'content-type': stored.contentType } })
        : new Response('not found', { status: 404 });
    }
    if (init?.method === 'DELETE') {
      storedObjects.delete(url);
      return new Response(null, { status: 204 });
    }
    if (failFirstUpload) {
      failFirstUpload = false;
      return new Response('temporary storage failure', { status: 503 });
    }
    const body = init?.body;
    const bytes = Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body as Uint8Array);
    const headers = new Headers(init?.headers);
    storedObjects.set(url, { bytes, contentType: headers.get('content-type') || 'application/octet-stream' });
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

function makePcnFileForm(id: string, name: string, bytes: Buffer, category: string, mimeType = 'application/pdf') {
  const form = new FormData();
  form.set('stageId', 'intake');
  form.set('title', `${category} · ${name}`);
  form.set('description', `B1: ${category}`);
  form.set('supplementaryItemId', `pcn-b1-${id}`);
  form.set('file', new File([bytes], name, { type: mimeType }));
  return form;
}

function makePgdFileForm(id: string, name: string, bytes: Buffer, category: string, mimeType = 'application/pdf') {
  const form = new FormData();
  form.set('supplementaryStageId', 'intake');
  form.set('stageId', 'B1');
  form.set('supplementaryItemId', `pgd-b1-${id}`);
  form.set('requirementId', 'PENDING_MAPPING');
  form.set('requirementCode', 'PENDING_MAPPING');
  form.set('title', `${category} · ${name}`);
  form.set('note', `B1: ${category}`);
  form.set('file', new File([bytes], name, { type: mimeType }));
  return form;
}

test('PCN B1 intake accepts PDF and DOCX bytes, persists attachments, and makes retries idempotent', async (t) => {
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

  const requestFor = (id: string, name: string, bytes: Buffer, category: string, mimeType?: string) => multipartRouteRequest(
    `/api/pcn/dossiers/${dossierId}/supplementary-attachments`,
    makePcnFileForm(id, name, bytes, category, mimeType),
    pcnCreator,
  );
  const contractBytes = Buffer.from('%PDF-1.7 contract bytes');
  const invoiceBytes = Buffer.from('%PDF-1.7 invoice bytes');
  const docxBytes = fs.readFileSync(new URL('../revised_templates/pcn/PCN_PYC_gui_PTN.docx', import.meta.url));
  for (const [id, name, bytes, category, mimeType] of [
    ['contract-1', 'contract.pdf', contractBytes, 'Hợp đồng', 'application/pdf'],
    ['invoice-1', 'invoice.pdf', invoiceBytes, 'Hóa đơn', 'application/pdf'],
    ['proposal-1', 'proposal.docx', docxBytes, 'Đề nghị', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ] as const) {
    const response = await pcnSupplementary.POST(requestFor(id, name, bytes, category, mimeType), { params: Promise.resolve({ dossierId }) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).attachment.byteSize, bytes.byteLength);
  }

  const retry = await pcnSupplementary.POST(requestFor('contract-1', 'contract.pdf', contractBytes, 'Hợp đồng'), { params: Promise.resolve({ dossierId }) });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).idempotent, true);
  const persisted = db.list('dossierAttachments').map((row) => row.data);
  assert.equal(persisted.length, 3);
  assert.deepEqual(new Set(persisted.map((item) => item.description)), new Set(['B1: Hợp đồng', 'B1: Hóa đơn', 'B1: Đề nghị']));
  assert.equal(db.assets.size, 3);
  assert.equal(uploads.length, 3);
  assert.ok([contractBytes, invoiceBytes, docxBytes].every((bytes) => uploads.some((item) => item.bytes.equals(bytes))));

  const persistedContract = db.list('dossierAttachments').find((row) => row.data.originalFileName === 'contract.pdf');
  assert.ok(persistedContract?.data.fileAssetId);
  const downloadedContract = await pcnFileDownload.GET(
    routeRequest(`/api/pcn/files/${persistedContract.data.fileAssetId}`, 'GET', undefined, pcnCreator),
    { params: Promise.resolve({ assetId: persistedContract.data.fileAssetId }) },
  );
  assert.equal(downloadedContract.status, 200);
  assert.match(downloadedContract.headers.get('content-disposition') || '', /filename\*=UTF-8''contract\.pdf/);
  assert.deepEqual(Buffer.from(await downloadedContract.arrayBuffer()), contractBytes);

  const persistedDocx = db.list('dossierAttachments').find((row) => row.data.originalFileName === 'proposal.docx');
  assert.ok(persistedDocx?.data.fileAssetId);
  const downloadedDocx = await pcnFileDownload.GET(
    routeRequest(`/api/pcn/files/${persistedDocx.data.fileAssetId}`, 'GET', undefined, pcnCreator),
    { params: Promise.resolve({ assetId: persistedDocx.data.fileAssetId }) },
  );
  assert.equal(downloadedDocx.status, 200);
  assert.deepEqual(Buffer.from(await downloadedDocx.arrayBuffer()), docxBytes);

  const reload = await pcnCollection.GET(routeRequest('/api/db/dossierAttachments', 'GET', {}, pcnCreator), { params: Promise.resolve({ collection: 'dossierAttachments' }) });
  assert.equal(reload.status, 200);
  const reloadedItems = (await reload.json()).items;
  assert.equal(reloadedItems.filter((item: any) => item.dossierId === dossierId).length, 3);
});

test('PGD template B1 upload persists canonical links, multiple files, SINGLE history, and exact display metadata', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const requestId = 'pgd-template-b1-metadata';
  const multipleId = 'pgd-custom-photos';
  const singleId = 'pgd-custom-spec';
  const templateId = 'pgd-custom-template-v7';
  const definitions = [
    { id: multipleId, domain: 'PGD', code: 'PHOTO', name: 'Ảnh hiện trường', level: 'OPTIONAL', source: 'UPLOAD_EXTERNAL', ownerRole: 'CUSTOMER', multiplicity: 'MULTIPLE' },
    { id: singleId, domain: 'PGD', code: 'SPEC', name: 'Bản thông số phiên bản 7', level: 'REQUIRED', source: 'UPLOAD_EXTERNAL', ownerRole: 'CUSTOMER', multiplicity: 'SINGLE' },
  ];
  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-B1-META-007',
    productGroup: 'OTHER',
    status: 'DRAFT',
    workflowTemplateId: templateId,
    workflowTemplateVersion: 7,
    workflowSnapshot: {
      templateId,
      templateVersion: 7,
      requirementDefinitions: definitions,
      stages: [],
      nodes: [{ id: 'request', active: true, requirementCodes: [multipleId, singleId] }],
    },
    dossierChecklist: [],
  });

  const upload = (id: string, requirementId: string, name: string, bytes: string) => {
    const form = new FormData();
    form.set('supplementaryStageId', 'intake');
    form.set('stageId', 'B1');
    form.set('supplementaryItemId', `pgd-b1-${id}`);
    form.set('requirementId', requirementId);
    form.set('requirementCode', requirementId);
    form.set('title', 'Client supplied label is not authoritative');
    form.set('documentKind', 'CLIENT_VALUE');
    form.set('file', new File([Buffer.from(bytes)], name, { type: 'application/pdf' }));
    return pgdDossierDocuments.POST(
      multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, form, pgdCreator),
      { params: Promise.resolve({ requestId }) },
    );
  };

  const multi1 = await upload('photo-1', multipleId, 'field photo 1.pdf', 'photo-1');
  const multi2 = await upload('photo-2', multipleId, 'field photo 2.pdf', 'photo-2');
  const multi1v2 = await upload('photo-1', multipleId, 'field photo 1 revised.pdf', 'photo-1-revised');
  const single1 = await upload('spec-1', singleId, 'original-name-v1.pdf', 'spec-v1');
  const single2 = await upload('spec-2', singleId, 'original-name-v2.pdf', 'spec-v2');
  for (const response of [multi1, multi2, multi1v2, single1, single2]) assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));

  const persisted = db.list('pgdDossierDocuments').map((row) => ({ ...row.data, id: row.document_id } as any));
  assert.equal(persisted.length, 5);
  assert.ok(persisted.every((document) => document.domain === 'pgd' && document.dossierId === requestId && document.requestId === requestId));
  assert.ok(persisted.every((document) => document.templateId === templateId && document.templateVersion === 7 && document.stageId === 'B1'));
  assert.ok(persisted.every((document) => document.originalFileName && document.fileAssetId && document.checksum && document.uploadedByUsername === pgdCreator.username && document.uploadedAt));
  assert.ok(persisted.filter((document) => document.requirementId === multipleId).every((document) => document.displayName === 'Ảnh hiện trường' && document.documentKind === 'PHOTO' && document.multiplicity === 'MULTIPLE'));
  const singleRows = persisted.filter((document) => document.requirementId === singleId).sort((a, b) => a.version - b.version);
  assert.deepEqual(singleRows.map((document) => [document.displayName, document.originalFileName, document.version, document.status]), [
    ['Bản thông số phiên bản 7', 'original-name-v1.pdf', 1, 'SUPERSEDED'],
    ['Bản thông số phiên bản 7', 'original-name-v2.pdf', 2, 'PRESENT'],
  ]);
  assert.equal(singleRows[1].supersedesDocumentId, singleRows[0].id);
  const multiRows = persisted.filter((document) => document.requirementId === multipleId).sort((a, b) => a.version - b.version);
  assert.deepEqual(multiRows.map((document) => [document.originalFileName, document.version, document.status]), [
    ['field photo 1.pdf', 1, 'SUPERSEDED'],
    ['field photo 2.pdf', 1, 'PRESENT'],
    ['field photo 1 revised.pdf', 2, 'PRESENT'],
  ]);
  assert.equal(multiRows[2].supersedesDocumentId, multiRows[0].id);

  const loaded = await pgdDossierDocuments.GET(
    routeRequest(`/api/pgd/requests/${requestId}/dossier-documents`, 'GET', {}, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  const loadedDocs = (await loaded.json()).dossierDocuments;
  const currentDocs = pgdDossierRequirements.getCurrentPgdDossierDocuments(loadedDocs, definitions.map((definition) => ({ code: definition.id, multiplicity: definition.multiplicity })));
  assert.equal(currentDocs.filter((document: any) => document.requirementId === multipleId).length, 2);
  assert.equal(currentDocs.filter((document: any) => document.requirementId === singleId).length, 1);
  assert.equal(uploads.length, 5);
});

test('PGD upload failure can retry the same file without a duplicate document or asset', async (t) => {
  const uploads = usePrivateStorageMock(t, { failFirstUpload: true });
  const db = installDocumentDatabase(t);
  const requestId = 'pgd-upload-failure-retry';
  db.seed('pgdInspectionRequests', requestId, {
    id: requestId, domain: 'pgd', requestCode: 'PGD-RETRY-01', productGroup: 'OTHER', status: 'DRAFT',
    workflowTemplateId: 'pgd-retry-v1', workflowTemplateVersion: 1,
    workflowSnapshot: { templateId: 'pgd-retry-v1', templateVersion: 1, requirementDefinitions: [], stages: [], nodes: [{ id: 'request', active: true, requirementCodes: ['REQUEST_PYC'] }] },
    dossierChecklist: [],
  });
  const form = makePgdFileForm('retry-file', 'retry-original.pdf', Buffer.from('retry bytes'), 'Tài liệu bổ sung khác');
  form.set('requirementId', 'PENDING_MAPPING');
  form.set('requirementCode', 'PENDING_MAPPING');
  form.set('stageId', 'B1');
  const send = () => pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, form, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );

  const failed = await send();
  assert.equal(failed.status, 500, JSON.stringify(await failed.clone().json()));
  assert.equal(db.list('pgdDossierDocuments').length, 0);
  assert.equal(db.assets.size, 0);
  const retried = await send();
  assert.equal(retried.status, 201);
  assert.equal(db.list('pgdDossierDocuments').length, 1);
  assert.equal(db.assets.size, 1);
  assert.equal(uploads.length, 1);
});

test('PGD intake rejects legacy synthetic requirement codes instead of marking them mapped', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const requestId = 'pgd-legacy-synthetic-intake';
  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-LEGACY-INTAKE-01',
    productGroup: 'OTHER',
    status: 'DRAFT',
    workflowSnapshot: { requirementDefinitions: [], stages: [] },
    dossierChecklist: [],
  });

  const form = makePgdFileForm('legacy-synthetic', 'legacy.pdf', Buffer.from('legacy bytes'), 'Tài liệu bổ sung khác');
  form.set('requirementId', 'PGD_SUPPLEMENTARY_INTAKE_legacy');
  form.set('requirementCode', 'PGD_SUPPLEMENTARY_INTAKE_legacy');
  form.set('stageId', '');
  const response = await pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, form, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );

  assert.equal(response.status, 400);
  assert.equal(uploads.length, 0);
  assert.equal(db.list('pgdDossierDocuments').length, 0);
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

  const send = (id: string, name: string, bytes: Buffer, category: string, mimeType = 'application/pdf') => pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, makePgdFileForm(id, name, bytes, category, mimeType), pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  const requestBytes = Buffer.from('%PDF-1.7 PYC bytes');
  const technicalBytes = Buffer.from('%PDF-1.7 technical bytes');
  const docxBytes = fs.readFileSync(new URL('../revised_templates/pgd/PGD-BM-01.docx', import.meta.url));
  for (const [id, name, bytes, category, mimeType] of [
    ['request-1', 'pyc.pdf', requestBytes, 'Phiếu / đề nghị', 'application/pdf'],
    ['technical-1', 'technical.pdf', technicalBytes, 'Tài liệu kỹ thuật', 'application/pdf'],
    ['report-1', 'inspection.docx', docxBytes, 'Biên bản', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ] as const) {
    const response = await send(id, name, bytes, category, mimeType);
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
  assert.equal(reloaded.length, 3);
  assert.ok(reloaded.every((document: any) => document.domain === 'pgd'));
  assert.equal(db.assets.size, 3);
  assert.equal(uploads.length, 3);
  assert.ok([requestBytes, technicalBytes, docxBytes].every((bytes) => uploads.some((item) => item.bytes.equals(bytes))));

  const persistedPyc = db.list('pgdDossierDocuments').find((row) => row.data.originalFileName === 'pyc.pdf');
  assert.ok(persistedPyc);
  const downloadedPyc = await pgdFileDownload.GET(
    routeRequest(`/api/pgd/dossier-documents/${persistedPyc.document_id}/download`, 'GET', undefined, pgdCreator),
    { params: Promise.resolve({ documentId: persistedPyc.document_id }) },
  );
  assert.equal(downloadedPyc.status, 200);
  assert.match(downloadedPyc.headers.get('content-disposition') || '', /filename\*=UTF-8''pyc\.pdf/);
  assert.deepEqual(Buffer.from(await downloadedPyc.arrayBuffer()), requestBytes);

  const persistedDocx = db.list('pgdDossierDocuments').find((row) => row.data.originalFileName === 'inspection.docx');
  assert.ok(persistedDocx);
  const downloadedDocx = await pgdFileDownload.GET(
    routeRequest(`/api/pgd/dossier-documents/${persistedDocx.document_id}/download`, 'GET', undefined, pgdCreator),
    { params: Promise.resolve({ documentId: persistedDocx.document_id }) },
  );
  assert.equal(downloadedDocx.status, 200);
  assert.deepEqual(Buffer.from(await downloadedDocx.arrayBuffer()), docxBytes);
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
  const pcnDownloadDenied = await pcnFileDownload.GET(
    routeRequest('/api/pcn/files/pcn-file-denied-00000000-0000', 'GET', {}, pgdCreator),
    { params: Promise.resolve({ assetId: 'pcn-file-denied-00000000-0000' }) },
  );
  assert.equal(pcnDownloadDenied.status, 403);
  const pgdDownloadDenied = await pgdFileDownload.GET(
    routeRequest('/api/pgd/dossier-documents/pgd-doc-denied/download', 'GET', {}, pcnCreator),
    { params: Promise.resolve({ documentId: 'pgd-doc-denied' }) },
  );
  assert.equal(pgdDownloadDenied.status, 403);
  assert.equal(db.assets.size, 0);
});

test('cross-domain requirement/template mismatch rejected before storage', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-pcn-cross-test';
  const requestId = 'pgd-request-cross-test';

  db.seed('certificationDossiers', dossierId, {
    id: dossierId,
    dossierCode: 'HS-PCN-CROSS',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    intakeCreatedByUsername: pcnCreator.username,
    workflowSnapshot: { nodes: [{ id: 'intake', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL', 'QC4-COMMERCIAL'], active: true }] },
  });
  db.seed('pcnDossierWorkflowTasks', 'pcn-task-cross-intake', { id: 'pcn-task-cross-intake', dossierId, nodeId: 'intake', status: 'READY' });

  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-CROSS-001',
    productGroup: 'OTHER',
    status: 'DRAFT',
    workflowSnapshot: { requirementDefinitions: [], stages: [] },
    dossierChecklist: [],
  });

  // PCN rejects PGD requirement
  const pcnForm = makePcnFileForm('cross-1', 'bad.pdf', Buffer.from('bad bytes'), 'Khác');
  pcnForm.set('requirementId', 'REQUEST_PYC');
  const pcnRes = await pcnSupplementary.POST(
    multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, pcnForm, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnRes.status, 400);

  // PGD rejects PCN requirement
  const pgdForm = makePgdFileForm('cross-2', 'bad.pdf', Buffer.from('bad bytes'), 'Khác');
  pgdForm.set('requirementId', 'QC4-PROPOSAL');
  pgdForm.set('requirementCode', 'QC4-PROPOSAL');
  const pgdRes = await pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, pgdForm, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdRes.status, 400);

  assert.equal(uploads.length, 0);
  assert.equal(db.assets.size, 0);
});

test('two files on one requirement under SINGLE keeps one current and retains immutable history', async (t) => {
  usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-single-cardinality';

  db.seed('certificationDossiers', dossierId, {
    id: dossierId,
    dossierCode: 'HS-SINGLE-CARD',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    intakeCreatedByUsername: pcnCreator.username,
    workflowSnapshot: {
      nodes: [{ id: 'intake', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL', 'QC4-COMMERCIAL'], active: true }],
      requirementDefinitions: [
        { id: 'QC4-PROPOSAL', domain: 'PCN', code: 'PROPOSAL', name: 'Đề nghị / đơn đăng ký', level: 'REQUIRED', multiplicity: 'SINGLE' },
      ],
    },
  });
  db.seed('pcnDossierWorkflowTasks', 'task-single-card', { id: 'task-single-card', dossierId, nodeId: 'intake', status: 'READY' });

  const sendFile = (name: string, bytesStr: string) => {
    const form = makePcnFileForm(name, `${name}.pdf`, Buffer.from(bytesStr), 'Đơn đăng ký');
    form.set('requirementId', 'QC4-PROPOSAL');
    return pcnSupplementary.POST(
      multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, form, pcnCreator),
      { params: Promise.resolve({ dossierId }) },
    );
  };

  const res1 = await sendFile('file-v1', 'version 1 content');
  assert.equal(res1.status, 201);
  const json1 = await res1.json();
  assert.equal(json1.attachment.version, 1);
  assert.equal(json1.attachment.status, 'ACTIVE');

  const res2 = await sendFile('file-v2', 'version 2 content');
  assert.equal(res2.status, 201);
  const json2 = await res2.json();
  assert.equal(json2.attachment.version, 2);
  assert.equal(json2.attachment.status, 'ACTIVE');
  assert.equal(json2.attachment.supersedesAttachmentId, json1.attachment.id);

  const all = db.list('dossierAttachments').map((d) => ({ ...d.data, id: d.document_id } as any)).filter((d) => d.dossierId === dossierId);
  assert.equal(all.length, 2);
  const prior = all.find((d) => d.id === json1.attachment.id);
  const current = all.find((d) => d.id === json2.attachment.id);
  assert.equal(prior?.status, 'SUPERSEDED');
  assert.equal(current?.status, 'ACTIVE');
});

test('two files on one requirement under MULTIPLE keeps all independent files current', async (t) => {
  usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-multiple-cardinality';

  db.seed('certificationDossiers', dossierId, {
    id: dossierId,
    dossierCode: 'HS-MULT-CARD',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    intakeCreatedByUsername: pcnCreator.username,
    workflowSnapshot: {
      nodes: [{ id: 'intake', label: 'Tiếp nhận', requirementIds: ['pcn-custom-photos'], active: true }],
      requirementDefinitions: [
        { id: 'pcn-custom-photos', domain: 'PCN', code: 'PHOTOS', name: 'Ảnh hiện trường', level: 'OPTIONAL', multiplicity: 'MULTIPLE' },
      ],
    },
  });
  db.seed('pcnDossierWorkflowTasks', 'task-mult-card', { id: 'task-mult-card', dossierId, nodeId: 'intake', status: 'READY' });

  const sendFile = (name: string, bytesStr: string) => {
    const form = makePcnFileForm(name, `${name}.png`, Buffer.from(bytesStr), 'Ảnh hiện trường');
    form.set('requirementId', 'pcn-custom-photos');
    return pcnSupplementary.POST(
      multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, form, pcnCreator),
      { params: Promise.resolve({ dossierId }) },
    );
  };

  const res1 = await sendFile('photo-1', 'photo 1 data');
  assert.equal(res1.status, 201);
  const json1 = await res1.json();
  assert.equal(json1.attachment.status, 'ACTIVE');

  const res2 = await sendFile('photo-2', 'photo 2 data');
  assert.equal(res2.status, 201);
  const json2 = await res2.json();
  assert.equal(json2.attachment.status, 'ACTIVE');
  assert.equal(json2.attachment.supersedesAttachmentId, undefined);

  const all = db.list('dossierAttachments').map((d) => d.data).filter((d) => d.dossierId === dossierId);
  assert.equal(all.length, 2);
  assert.ok(all.every((d) => d.status === 'ACTIVE'));
});

test('PGD assessment-round separation and request/document version increment', async (t) => {
  usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const requestId = 'pgd-round-separation-test';

  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-ROUND-001',
    productGroup: 'OTHER',
    status: 'FIELD_INSPECTION',
    workflowSchemaVersion: 2,
    currentAssessmentRoundId: 'round-1',
    workflowSnapshot: { workflowSchemaVersion: 2, requirementDefinitions: [], stages: [] },
    dossierChecklist: [],
  });
  db.seed('pgdAssessmentRounds', 'round-1', {
    id: 'round-1', requestId, roundNumber: 1, status: 'OPEN', domain: 'pgd',
  });
  db.seed('pgdInspectionAssignments', `assignment-${requestId}`, {
    requestId, domain: 'pgd', assignedToUsername: pgdCreator.username, leadAssessorUsername: pgdCreator.username,
    roleAssignments: [{ username: pgdCreator.username, capability: 'ASSESSOR' }],
  });

  const seedExistingStageItem = (roundId: string, name: string) => {
    const requirementCode = `PGD_SUPPLEMENTARY_EXECUTION_${name}`;
    const supplementaryItemId = `pgd-b1-${name}`;
    db.seed('pgdDossierDocuments', `existing-${name}`, {
      id: `existing-${name}`,
      requestId,
      domain: 'pgd',
      assessmentRoundId: roundId,
      requirementCode,
      title: `Existing ${name}`,
      fileName: `old-${name}.pdf`,
      originalFileName: `old-${name}.pdf`,
      version: 1,
      checksum: `old-checksum-${name}`,
      supplementaryStageId: 'execution',
      supplementaryItemId,
      status: 'PRESENT',
    });
  };
  seedExistingStageItem('round-1', 'doc-r1');

  const sendInRound = (name: string, roundId: string) => {
    const form = makePgdFileForm(name, `${name}.pdf`, Buffer.from(`bytes for ${name}`), 'Khác');
    form.set('supplementaryStageId', 'execution');
    const requirementCode = `PGD_SUPPLEMENTARY_EXECUTION_${name}`;
    form.set('requirementId', requirementCode);
    form.set('requirementCode', requirementCode);
    form.set('assessmentRoundId', roundId);
    return pgdDossierDocuments.POST(
      multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, form, pgdCreator),
      { params: Promise.resolve({ requestId }) },
    );
  };

  const res1 = await sendInRound('doc-r1', 'round-1');
  assert.equal(res1.status, 201, JSON.stringify(await res1.clone().json()));
  const json1 = await res1.json();
  assert.equal(json1.dossierDocument.assessmentRoundId, 'round-1');
  assert.equal(json1.dossierDocument.version, 2);
  assert.equal(db.list('pgdDossierDocuments').find((row) => row.document_id === 'existing-doc-r1')?.data.status, 'SUPERSEDED');

  // Move to round 2
  db.seed('pgdAssessmentRounds', 'round-2', {
    id: 'round-2', requestId, roundNumber: 2, status: 'OPEN', domain: 'pgd',
  });
  db.seed('pgdInspectionRequests', requestId, {
    id: requestId, domain: 'pgd', requestCode: 'PGD-ROUND-001', productGroup: 'OTHER',
    status: 'FIELD_INSPECTION', workflowSchemaVersion: 2, currentAssessmentRoundId: 'round-2',
    workflowSnapshot: { workflowSchemaVersion: 2, requirementDefinitions: [], stages: [] }, dossierChecklist: [],
  });
  seedExistingStageItem('round-2', 'doc-r2');

  const res2 = await sendInRound('doc-r2', 'round-2');
  assert.equal(res2.status, 201);
  const json2 = await res2.json();
  assert.equal(json2.dossierDocument.assessmentRoundId, 'round-2');
  assert.equal(json2.dossierDocument.version, 2);

  const reloaded = db.list('pgdDossierDocuments').map((d) => d.data).filter((d) => d.requestId === requestId);
  assert.equal(reloaded.filter((document) => document.status !== 'SUPERSEDED').length, 2);
  assert.deepEqual(new Set(reloaded.filter((document) => document.status !== 'SUPERSEDED').map((document) => document.assessmentRoundId)), new Set(['round-1', 'round-2']));
});

test('pending mapping followed by authorized explicit map', async (t) => {
  const uploads = usePrivateStorageMock(t);
  const db = installDocumentDatabase(t);
  const dossierId = 'dossier-pending-mapping';
  const requestId = 'pgd-pending-mapping';

  db.seed('certificationDossiers', dossierId, {
    id: dossierId,
    dossierCode: 'HS-PCN-PENDING',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    intakeCreatedByUsername: pcnCreator.username,
    workflowSnapshot: { nodes: [{ id: 'intake', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL', 'QC4-COMMERCIAL'], active: true }] },
  });
  db.seed('pcnDossierWorkflowTasks', 'task-pending-intake', { id: 'task-pending-intake', dossierId, nodeId: 'intake', status: 'READY' });

  db.seed('pgdInspectionRequests', requestId, {
    id: requestId,
    domain: 'pgd',
    requestCode: 'PGD-PENDING-001',
    productGroup: 'OTHER',
    status: 'DRAFT',
    workflowSnapshot: { requirementDefinitions: [], stages: [] },
    dossierChecklist: [],
  });

  Object.assign(db.documents.get(`certificationDossiers:${dossierId}`)!.data, {
    workflowTemplateId: 'pcn-qc4-pending-v1',
    workflowTemplateVersion: 1,
    workflowSnapshot: {
      templateId: 'pcn-qc4-pending-v1',
      templateVersion: 1,
      requirementDefinitions: [{ id: 'PCN-COMMERCIAL-EXTRA', domain: 'PCN', code: 'COMMERCIAL_EXTRA', name: 'Commercial appendix', level: 'OPTIONAL', source: 'UPLOAD_EXTERNAL', ownerRole: 'CUSTOMER', multiplicity: 'SINGLE' }],
      nodes: [
        { id: 'intake', stageId: 'B1', requirementIds: ['QC4-PROPOSAL', 'QC4-COMMERCIAL'], active: true },
        { id: 'commercial-review', stageId: 'B3', requirementIds: ['PCN-COMMERCIAL-EXTRA'], active: true },
      ],
    },
  });
  Object.assign(db.documents.get(`pgdInspectionRequests:${requestId}`)!.data, {
    workflowTemplateId: 'pgd-request-pending-v1',
    workflowTemplateVersion: 1,
    workflowSnapshot: {
      templateId: 'pgd-request-pending-v1',
      templateVersion: 1,
      requirementDefinitions: [{ id: 'PGD-COMMERCIAL-EXTRA', domain: 'PGD', code: 'COMMERCIAL_EXTRA', name: 'Commercial appendix', level: 'OPTIONAL', source: 'UPLOAD_EXTERNAL', ownerRole: 'CUSTOMER', multiplicity: 'SINGLE' }],
      stages: [
        { id: 'B1', label: 'Request', requirementIds: ['REQUEST_PYC', 'REQUEST_SUPPORTING'] },
        { id: 'B4', label: 'Commercial review', requirementIds: ['PGD-COMMERCIAL-EXTRA'] },
      ],
      nodes: [
        { id: 'request', stageId: 'B1', active: true, requirementCodes: ['REQUEST_PYC', 'REQUEST_SUPPORTING'] },
        { id: 'commercial', stageId: 'B4', active: true, requirementCodes: ['PGD-COMMERCIAL-EXTRA'] },
      ],
    },
  });

  const pcnWrongStageUploadForm = makePcnFileForm('wrong-stage-pcn', 'commercial.pdf', Buffer.from('wrong stage bytes'), 'Commercial appendix');
  pcnWrongStageUploadForm.set('requirementId', 'PCN-COMMERCIAL-EXTRA');
  const pcnWrongStageUpload = await pcnSupplementary.POST(
    multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, pcnWrongStageUploadForm, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnWrongStageUpload.status, 400);
  assert.equal(uploads.length, 0);

  const pcnConflictingMappingForm = makePcnFileForm('conflicting-pcn', 'conflicting.pdf', Buffer.from('conflicting bytes'), 'PYC');
  pcnConflictingMappingForm.set('requirementId', 'PENDING_MAPPING');
  pcnConflictingMappingForm.set('requirementCode', 'QC4-PROPOSAL');
  const pcnConflictingMapping = await pcnSupplementary.POST(
    multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, pcnConflictingMappingForm, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnConflictingMapping.status, 400);
  assert.equal(uploads.length, 0);

  // 1. PCN upload pending mapping
  const pcnDocxBytes = fs.readFileSync(new URL('../revised_templates/pcn/PCN_PYC_gui_PTN.docx', import.meta.url));
  const pgdDocxBytes = fs.readFileSync(new URL('../revised_templates/pgd/PGD-BM-01.docx', import.meta.url));
  const pcnPendingForm = makePcnFileForm('other-pcn', 'other.docx', pcnDocxBytes, 'Khác', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  pcnPendingForm.set('requirementId', 'PENDING_MAPPING');
  const pcnUploadRes = await pcnSupplementary.POST(
    multipartRouteRequest(`/api/pcn/dossiers/${dossierId}/supplementary-attachments`, pcnPendingForm, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnUploadRes.status, 201);
  const pcnAttachment = (await pcnUploadRes.json()).attachment;
  assert.equal(pcnAttachment.mappingStatus, 'PENDING_MAPPING');
  assert.equal(pcnAttachment.displayName, 'Tài liệu bổ sung khác');

  const pcnUnassignedMap = await pcnAttachmentMapping.POST(
    routeRequest(`/api/pcn/dossiers/${dossierId}/attachment-mapping`, 'POST', { attachmentId: pcnAttachment.id, requirementId: 'QC4-PROPOSAL' }, {
      username: 'pcn-unassigned', name: 'PCN Unassigned', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'],
    }),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnUnassignedMap.status, 403);

  // Unauthorized user cannot map PCN attachment
  const pcnMapDenied = await pcnAttachmentMapping.POST(
    routeRequest(`/api/pcn/dossiers/${dossierId}/attachment-mapping`, 'POST', { attachmentId: pcnAttachment.id, requirementId: 'QC4-PROPOSAL' }, pgdCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnMapDenied.status, 403);

  const pcnWrongStageMap = await pcnAttachmentMapping.POST(
    routeRequest(`/api/pcn/dossiers/${dossierId}/attachment-mapping`, 'POST', { attachmentId: pcnAttachment.id, requirementId: 'PCN-COMMERCIAL-EXTRA' }, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnWrongStageMap.status, 400);
  assert.equal(db.list('dossierAttachments').find((row) => row.document_id === pcnAttachment.id)?.data.mappingStatus, 'PENDING_MAPPING');

  // Authorized user maps PCN attachment
  const pcnMapSuccess = await pcnAttachmentMapping.POST(
    routeRequest(`/api/pcn/dossiers/${dossierId}/attachment-mapping`, 'POST', { attachmentId: pcnAttachment.id, requirementId: 'QC4-PROPOSAL' }, pcnCreator),
    { params: Promise.resolve({ dossierId }) },
  );
  assert.equal(pcnMapSuccess.status, 200);
  const mappedPcn = (await pcnMapSuccess.json()).attachment;
  assert.equal(mappedPcn.mappingStatus, 'MAPPED');
  assert.equal(mappedPcn.requirementId, 'QC4-PROPOSAL');
  assert.equal(mappedPcn.requirementCode, 'PROPOSAL');
  assert.equal(mappedPcn.displayName, 'Đề nghị / đơn đăng ký');
  assert.equal(mappedPcn.stageId, 'B1');
  assert.equal(mappedPcn.templateId, 'pcn-qc4-pending-v1');
  assert.equal(mappedPcn.templateVersion, 1);
  assert.equal(mappedPcn.status, 'ACTIVE');
  const downloadedMappedPcn = await pcnFileDownload.GET(
    routeRequest(`/api/pcn/files/${mappedPcn.fileAssetId}`, 'GET', undefined, pcnCreator),
    { params: Promise.resolve({ assetId: mappedPcn.fileAssetId }) },
  );
  assert.equal(downloadedMappedPcn.status, 200);
  assert.deepEqual(Buffer.from(await downloadedMappedPcn.arrayBuffer()), pcnDocxBytes);
  const reloadedPcnAttachments = await pcnCollection.GET(
    routeRequest('/api/db/dossierAttachments', 'GET', {}, pcnCreator),
    { params: Promise.resolve({ collection: 'dossierAttachments' }) },
  );
  const reloadedMappedPcn = (await reloadedPcnAttachments.json()).items.find((item: any) => item.id === mappedPcn.id);
  assert.equal(reloadedMappedPcn.requirementId, 'QC4-PROPOSAL');
  assert.equal(reloadedMappedPcn.requirementCode, 'PROPOSAL');
  assert.equal(reloadedMappedPcn.templateVersion, 1);

  // 2. PGD upload pending mapping
  const pgdPendingForm = makePgdFileForm('other-pgd', 'other.docx', pgdDocxBytes, 'Khác', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  pgdPendingForm.set('requirementCode', 'PENDING_MAPPING');
  const pgdUploadRes = await pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, pgdPendingForm, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdUploadRes.status, 201, JSON.stringify(await pgdUploadRes.clone().json()));
  const pgdDoc = (await pgdUploadRes.json()).dossierDocument;
  assert.equal(pgdDoc.mappingStatus, 'PENDING_MAPPING');
  assert.equal(pcnAttachment.displayName, 'Tài liệu bổ sung khác');

  db.seed('pgdDossierDocuments', 'pgd-existing-other-round', {
    id: 'pgd-existing-other-round',
    requestId,
    domain: 'pgd',
    assessmentRoundId: 'round-previous',
    requirementCode: 'REQUEST_PYC',
    title: 'PYC ở đợt trước',
    fileName: 'previous.pdf',
    version: 1,
    status: 'PRESENT',
  });

  const pgdConflictingMappingForm = makePgdFileForm('conflicting-pgd', 'conflicting.pdf', Buffer.from('conflicting bytes'), 'PYC');
  pgdConflictingMappingForm.set('requirementCode', 'REQUEST_PYC');
  const pgdConflictingMapping = await pgdDossierDocuments.POST(
    multipartRouteRequest(`/api/pgd/requests/${requestId}/dossier-documents`, pgdConflictingMappingForm, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdConflictingMapping.status, 400);

  // Unauthorized user cannot map PGD document
  const pgdMapDenied = await pgdAttachmentMapping.POST(
    routeRequest(`/api/pgd/requests/${requestId}/attachment-mapping`, 'POST', { documentId: pgdDoc.id, requirementCode: 'REQUEST_PYC' }, pcnCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdMapDenied.status, 403);

  const pgdWrongStageMap = await pgdAttachmentMapping.POST(
    routeRequest(`/api/pgd/requests/${requestId}/attachment-mapping`, 'POST', { documentId: pgdDoc.id, requirementCode: 'PGD-COMMERCIAL-EXTRA' }, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdWrongStageMap.status, 400);
  assert.equal(db.list('pgdDossierDocuments').find((row) => row.document_id === pgdDoc.id)?.data.mappingStatus, 'PENDING_MAPPING');

  // Authorized user maps PGD document
  const pgdMapSuccess = await pgdAttachmentMapping.POST(
    routeRequest(`/api/pgd/requests/${requestId}/attachment-mapping`, 'POST', { documentId: pgdDoc.id, requirementCode: 'REQUEST_PYC' }, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(pgdMapSuccess.status, 200, JSON.stringify(await pgdMapSuccess.clone().json()));
  const mappedPgd = (await pgdMapSuccess.json()).dossierDocument;
  assert.equal(mappedPgd.mappingStatus, 'MAPPED');
  assert.equal(mappedPgd.requirementCode, 'REQUEST_PYC');
  assert.equal(mappedPgd.requirementId, 'REQUEST_PYC');
  assert.equal(mappedPgd.displayName, 'Phiếu yêu cầu giám định');
  assert.equal(mappedPgd.stageId, 'B1');
  assert.equal(mappedPgd.templateId, 'pgd-request-pending-v1');
  assert.equal(mappedPgd.templateVersion, 1);
  assert.equal(mappedPgd.status, 'PRESENT');
  assert.equal(db.list('pgdDossierDocuments').find((row) => row.document_id === 'pgd-existing-other-round')?.data.status, 'PRESENT');
  const downloadedMappedPgd = await pgdFileDownload.GET(
    routeRequest(`/api/pgd/dossier-documents/${mappedPgd.id}/download`, 'GET', undefined, pgdCreator),
    { params: Promise.resolve({ documentId: mappedPgd.id }) },
  );
  assert.equal(downloadedMappedPgd.status, 200);
  assert.deepEqual(Buffer.from(await downloadedMappedPgd.arrayBuffer()), pgdDocxBytes);
  const reloadedMappedPgdResponse = await pgdDossierDocuments.GET(
    routeRequest(`/api/pgd/requests/${requestId}/dossier-documents`, 'GET', {}, pgdCreator),
    { params: Promise.resolve({ requestId }) },
  );
  const reloadedMappedPgd = (await reloadedMappedPgdResponse.json()).dossierDocuments.find((item: any) => item.id === mappedPgd.id);
  assert.equal(reloadedMappedPgd.requirementCode, 'REQUEST_PYC');
  assert.equal(reloadedMappedPgd.templateVersion, 1);

  // 3. RBAC denies unauthorized private-file reads/downloads
  const pcnDownloadDenied = await pcnFileDownload.GET(
    routeRequest(`/api/pcn/files/${pcnAttachment.fileAssetId}`, 'GET', undefined, pgdCreator),
    { params: Promise.resolve({ assetId: pcnAttachment.fileAssetId }) },
  );
  assert.equal(pcnDownloadDenied.status, 403);

  const pgdDownloadDenied = await pgdFileDownload.GET(
    routeRequest(`/api/pgd/dossier-documents/${pgdDoc.id}/download`, 'GET', undefined, pcnCreator),
    { params: Promise.resolve({ documentId: pgdDoc.id }) },
  );
  assert.equal(pgdDownloadDenied.status, 403);
});
