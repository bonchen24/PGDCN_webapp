import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

import { extractPcnTemplatePlaceholderKeys } from '../utils/pcnTemplateDiscovery.ts';
import { getPgdDocumentTemplates } from '../utils/pgdDocumentTemplates.ts';
import { buildPgdDocumentContext, buildPgdDocumentOutput } from '../utils/pgdDocumentGeneration.ts';
import { getPgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import { inspectPgdTemplateSource } from '../utils/pgdTemplatePack.ts';

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
  const intakeTemplate = runtimeTemplates.find((template) => template.kind === 'INTAKE_REQUEST')!;
  assert.ok(intakeTemplate.placeholderKeys.includes('registrationNumber'));
  assert.ok(intakeTemplate.placeholderKeys.includes('receivedAt'));
  assert.ok(intakeTemplate.placeholderKeys.includes('registryDocuments'));
  assert.ok(intakeTemplate.placeholderKeys.includes('technicalDossierNote'));
  assert.ok(intakeTemplate.placeholderKeys.includes('deficiencyNote'));
  assert.ok(intakeTemplate.placeholderKeys.includes('courierName'));
});

test('PGD source inspector detects missing files and placeholder drift', () => {
  const template = getPgdDocumentTemplate('INSPECTION_REPORT', 'STEEL_METAL')!;
  const ready = inspectPgdTemplateSource(template, root);
  assert.equal(ready.status, 'READY');
  assert.deepEqual(ready.placeholderKeys, template.placeholderKeys);

  const mismatch = inspectPgdTemplateSource({
    ...template,
    placeholderKeys: [...template.placeholderKeys, 'unexpectedPlaceholder'],
  }, root);
  assert.equal(mismatch.status, 'PLACEHOLDER_MISMATCH');
  assert.deepEqual(mismatch.missingPlaceholderKeys, ['unexpectedPlaceholder']);

  const missing = inspectPgdTemplateSource({ ...template, fileName: 'missing-pgd-source.docx' }, root);
  assert.equal(missing.status, 'MISSING');
  assert.match(missing.message || '', /Không tìm thấy file nguồn/);
});

test('PGD DOCX output fills the real form and does not emit the legacy Cell/Giá trị table', async () => {
  const request = {
    id: 'request-docx-template',
    domain: 'pgd' as const,
    requestCode: 'PGD-260905-01',
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
    assessmentMethod: 'METHOD_7' as const,
    standards: ['JIS G 3141'],
    registryMetadata: {
      registrationNumber: 'SĐK-001',
      receivedAt: '2026-09-02',
      documents: [{ kind: 'CONTRACT' as const, number: 'HD-001', date: '2026-09-01' }],
    },
    sampleIds: [],
    labRequestIds: [],
    status: 'RESULTS_REVIEW' as const,
    documentPointers: [],
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
  assert.match(documentXml, /METHOD_7/);
  assert.doesNotMatch(documentXml, /<w:t[^>]*>Cell<\/w:t>/);
  assert.doesNotMatch(documentXml, /\[\[[a-zA-Z][a-zA-Z0-9_]*\]\]/);

  const decisionTemplate = getPgdDocumentTemplate('DECISION', 'STEEL_METAL')!;
  const decisionContext = buildPgdDocumentContext({
    template: decisionTemplate,
    request,
    cellValues: {
      decisionNumber: 'QĐ-PGD-001',
      decisionDate: '2026-09-02',
      decisionBasis: 'Kết quả báo cáo và chuỗi phê duyệt PGD.',
      decisionText: 'Phê duyệt phát hành kết quả giám định.',
      decisionSigner: 'Trưởng phòng PGD',
      conclusion: 'Phù hợp',
    },
    now: '2026-09-02T05:00:00.000Z',
  });
  const decisionOutput = await buildPgdDocumentOutput(decisionContext, 'DOCX');
  const decisionXml = new PizZip(decisionOutput.bytes).file('word/document.xml')?.asText() || '';
  assert.match(decisionXml, /QĐ-PGD-001/);
  assert.match(decisionXml, /QUYẾT ĐỊNH/);
  assert.doesNotMatch(decisionXml, /Báo giá|Thanh toán|payment/i);
});

test('PGD intake template binds registry metadata into DOCX cells', () => {
  const request = {
    id: 'request-intake-registry',
    domain: 'pgd' as const,
    requestCode: 'PGD-260905-02',
    intakeChannel: 'EMAIL' as const,
    requester: { name: 'Người yêu cầu' },
    productGroup: 'STEEL_METAL' as const,
    catalogItemId: 'STEEL_LOT_INSPECTION',
    productName: 'Thép tấm',
    productDetails: { steelLotSize: 120, steelSameGradeMultiProduct: true, steelManualSamplingPlanNote: 'Không áp dụng; cỡ lô trong bảng nguồn.' },
    customerSnapshot: { name: 'Công ty Mẫu', address: 'Hà Nội' },
    quantity: 1,
    unit: 'lô',
    inspectionScope: 'Kiểm tra hồ sơ',
    inspectionLocation: 'Kho A',
    standards: ['ASTM'],
    method: 'QT-GĐ-14',
    registryMetadata: { registrationNumber: 'SĐK-001', receivedAt: '2026-09-02', documents: [{ kind: 'CONTRACT' as const, number: 'HD-001' }] },
    sampleIds: [], labRequestIds: [], status: 'DRAFT' as const, documentPointers: [],
    createdAt: '2026-09-02T01:00:00.000Z', updatedAt: '2026-09-02T01:00:00.000Z',
  };
  const template = getPgdDocumentTemplate('INTAKE_REQUEST', 'STEEL_METAL')!;
  const context = buildPgdDocumentContext({ template, request, cellValues: {}, now: '2026-09-02T02:00:00.000Z' });
  assert.equal(context.cellValues.registrationNumber, 'SĐK-001');
  assert.equal(context.cellValues.receivedAt, '2026-09-02');
  assert.deepEqual(context.cellValues.registryDocuments, [{ kind: 'CONTRACT', number: 'HD-001', date: null }]);
  assert.equal(context.cellValues.steelLotSize, 120);
  assert.equal(context.cellValues.steelSameGradeMultiProduct, true);
  assert.equal(context.cellValues.steelManualSamplingPlanNote, 'Không áp dụng; cỡ lô trong bảng nguồn.');
});
