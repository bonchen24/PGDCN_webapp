import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';
import { buildPgdDocumentContext, buildPgdDocumentOutput } from '../utils/pgdDocumentGeneration.ts';
import { getPgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';

const root = path.resolve(process.cwd());

test('PGD ships real DOCX templates whose placeholders are the form contract', () => {
  const manifestPath = path.join(root, 'templates', 'pgd', 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    templates: Array<{ id: string; fileName: string; placeholderKeys: string[] }>;
  };
  const runtimeTemplates = getPgdDocumentTemplates();

  assert.equal(manifest.templates.length, runtimeTemplates.length);
  for (const entry of manifest.templates) {
    const template = runtimeTemplates.find((candidate) => candidate.id === entry.id);
    assert.ok(template, `missing runtime template ${entry.id}`);
    assert.equal(template.fileName, entry.fileName);
    const filePath = path.join(root, 'templates', 'pgd', entry.fileName);
    assert.equal(fs.existsSync(filePath), true);
    const keys = extractPcnTemplatePlaceholderKeys(fs.readFileSync(filePath));
    assert.deepEqual(keys, [...entry.placeholderKeys].sort((left, right) => left.localeCompare(right)));
    assert.deepEqual(template.placeholderKeys, keys);
  }
});

test('PGD DOCX output fills the real form and does not emit the legacy Cell/Giá trị table', async () => {
  const request = {
    id: 'request-docx-template',
    domain: 'pgd' as const,
    requestCode: 'PYC-GD-DOCX-001',
    intakeChannel: 'DIRECT' as const,
    requester: { name: 'Người yêu cầu', phone: '0900000000' },
    productGroup: 'STEEL_METAL' as const,
    catalogItemId: 'steel-coil',
    productName: 'Thép cuộn',
    customerSnapshot: { name: 'Công ty Mẫu', address: 'Hà Nội' },
    lotCode: 'LOT-01',
    quantity: 10,
    unit: 'tấn',
    inspectionScope: 'Kiểm tra chất lượng',
    inspectionLocation: 'Kho A',
    method: 'TT58',
    standards: ['JIS G 3141'],
    sampleIds: [],
    labRequestIds: [],
    status: 'RESULTS_REVIEW' as const,
    documentPointers: [],
    payment: { status: 'PENDING' as const },
    createdAt: '2026-09-02T01:00:00.000Z',
    updatedAt: '2026-09-02T04:00:00.000Z',
  };
  const template = getPgdDocumentTemplate('INSPECTION_REPORT', 'STEEL_METAL')!;
  const context = buildPgdDocumentContext({
    template,
    request,
    cellValues: { reportNumber: 'BC-GD-DOCX-001', conclusion: 'Phù hợp' },
    now: '2026-09-02T05:00:00.000Z',
  });
  const output = await buildPgdDocumentOutput(context, 'DOCX');
  const documentXml = new PizZip(output.bytes).file('word/document.xml')?.asText() || '';

  assert.match(documentXml, /BC-GD-DOCX-001/);
  assert.match(documentXml, /BÁO CÁO/);
  assert.doesNotMatch(documentXml, /<w:t[^>]*>Cell<\/w:t>/);
  assert.doesNotMatch(documentXml, /\[\[[a-zA-Z][a-zA-Z0-9_]*\]\]/);
});
