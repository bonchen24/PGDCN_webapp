import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnQualityDocument } from '../types.ts';
import {
  buildPcnQualityDocument,
  getPcnQualityDocumentCategoryLabel,
  getPcnQualityDocumentWarning,
} from '../utils/pcnQualityDocuments.ts';
import { createPcnQualityDocument, updatePcnQualityDocument, attachPcnQualityDocumentFile } from '../utils/pcnQualityDocumentApi.ts';
import { PCN_ADMIN_ONLY_COLLECTIONS } from '../utils/pcnRbac.ts';

const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../components/PcnQualityDocumentsView.tsx', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const NOW = '2026-08-28T04:00:00.000Z';

test('quality document builder normalizes controlled metadata and keeps file pointer-only', () => {
  const document = buildPcnQualityDocument({
    id: 'quality-1',
    documentCode: '  QL-QC4-001 ',
    title: ' Giấy phép chỉ định QC4 ',
    category: 'DESIGNATION',
    fieldCodes: ['qc4', 'QC9'],
    version: ' 02 ',
    effectiveFrom: '2026-08-01',
    validUntil: '2027-08-01',
    ownerUsername: ' admin ',
    fileAssetId: 'asset-private-1',
    fileName: 'giay-phep.docx',
  }, NOW);

  assert.deepEqual(document, {
    id: 'quality-1',
    documentCode: 'QL-QC4-001',
    title: 'Giấy phép chỉ định QC4',
    category: 'DESIGNATION',
    fieldCodes: ['QC4', 'QC9'],
    version: '02',
    status: 'DRAFT',
    effectiveFrom: '2026-08-01',
    validUntil: '2027-08-01',
    ownerUsername: 'admin',
    fileAssetId: 'asset-private-1',
    fileName: 'giay-phep.docx',
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal('bytes' in document, false);
  assert.equal('absolutePath' in document, false);
});

test('quality document warning is advisory and does not mutate explicit status', () => {
  const document: PcnQualityDocument = {
    id: 'quality-2',
    documentCode: 'ISO-9001',
    title: 'Quy trình chất lượng',
    category: 'ISO',
    version: '01',
    status: 'ACTIVE',
    validUntil: '2026-08-20',
  };
  assert.equal(getPcnQualityDocumentWarning(document, NOW), 'EXPIRED_ADVISORY');
  assert.equal(document.status, 'ACTIVE');
  assert.equal(getPcnQualityDocumentWarning({ ...document, validUntil: '2026-09-10' }, NOW), 'EXPIRING_SOON_ADVISORY');
  assert.equal(getPcnQualityDocumentWarning({ ...document, validUntil: undefined }, NOW), null);
  assert.equal(getPcnQualityDocumentCategoryLabel('VICAS'), 'VICAS / đánh giá công nhận');
});

test('quality document registry is a PCN admin-only module separated from dossiers and KQTN', () => {
  assert.ok(PCN_ADMIN_ONLY_COLLECTIONS.has('pcnQualityDocuments'));
  assert.match(designSource, /pcnQualityDocuments/);
  assert.match(designSource, /PCN_QUALITY_DOCUMENT/);
  assert.match(schemaSource, /app_documents/);
  assert.match(workspaceSource, /PcnQualityDocumentsView/);
  assert.match(workspaceSource, /qualityDocuments/);
  assert.match(storeSource, /pcnQualityDocuments/);
  assert.match(serverSource, /pcnQualityDocuments/);
});

test('quality document mutations use dedicated admin transactions and private file pointers', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/quality-documents'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/quality-documents\/:documentId'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/quality-documents\/:documentId\/file'/);
  const qualityMethods = ['addQualityDocument', 'updateQualityDocument', 'retireQualityDocument'];
  for (const method of qualityMethods) {
    const start = storeSource.indexOf(`${method}: async`);
    const end = storeSource.indexOf('\n  },', start);
    assert.doesNotMatch(storeSource.slice(start, end), /saveDoc\('pcnQualityDocuments'/);
    assert.doesNotMatch(storeSource.slice(start, end), /writePcnActivity/);
  }
  assert.match(designSource, /POST \/api\/pcn\/quality-documents/);
});

test('quality document API clients preserve the metadata and file-pointer boundaries', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ document: { id: 'quality-1' }, activityLog: null });
  }) as typeof fetch;
  try {
    await createPcnQualityDocument({ id: 'quality-1', documentCode: 'ISO-1', title: 'ISO', category: 'ISO', version: '01' });
    await updatePcnQualityDocument('quality-1', { status: 'ACTIVE' });
    await attachPcnQualityDocumentFile('quality-1', 'pcn-file-1', 'iso.pdf');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map((call) => [call.url, JSON.parse(String(call.init?.body))]), [
    ['/api/pcn/quality-documents', { document: { id: 'quality-1', documentCode: 'ISO-1', title: 'ISO', category: 'ISO', version: '01' } }],
    ['/api/pcn/quality-documents/quality-1', { updates: { status: 'ACTIVE' } }],
    ['/api/pcn/quality-documents/quality-1/file', { assetId: 'pcn-file-1', fileName: 'iso.pdf' }],
  ]);
});

test('quality document UI locks save and retire mutations while a request is pending', () => {
  assert.match(viewSource, /if \(saving\) return/);
  assert.match(viewSource, /const \[busyRetireId, setBusyRetireId\]/);
  assert.match(viewSource, /if \(busyRetireId === document\.id\) return/);
  assert.match(viewSource, /disabled=\{saving\}/);
  assert.match(viewSource, /disabled=\{busyRetireId === document\.id\}/);
  assert.match(viewSource, /finally \{\s*setBusyRetireId\(undefined\)/s);
});
