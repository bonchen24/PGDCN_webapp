import assert from 'node:assert/strict';
import test from 'node:test';

import PizZip from 'pizzip';

import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';
import {
  buildPcnOfficialContextHash,
  buildPcnOfficialTemplateData,
  getPcnOfficialGenerationReadiness,
  renderPcnOfficialDocx,
} from '../utils/pcnOfficialTemplateGeneration.ts';

function makeTemplate(keys: string[]): Buffer {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${keys.map((key) => `<w:r><w:t>[[${key}]]</w:t></w:r>`).join('')}</w:p></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

const context = {
  dossierId: 'dossier-qc4-0665',
  dossierCode: 'QC4-0665',
  proposalCode: 'P-0665',
  customerName: 'Công ty A',
  customerAddress: 'Hà Nội',
  customerTaxId: '',
  customerContactPerson: '',
  customerPhone: '',
  customerEmail: '',
  productName: 'Dây điện hạ thế',
  productType: 'Dây điện',
  specifications: '',
  warehouseAddress: '',
  model: 'M-01',
  brand: 'Brand A',
  manufacturer: '',
  manufacturerAddress: '',
  quantity: 1,
  method: 'METHOD_7' as const,
  status: 'APPROVED' as const,
  fieldNames: ['Quy chuẩn 4'],
  reviewStatus: '',
  unresolvedFields: [],
  checklist: [],
  attachments: [],
  contextHash: 'base-context-hash',
};

const issuance = {
  issuanceNumber: 'GCN-0665/2026',
  issuedAt: '2026-08-28T00:00:00.000Z',
  signerUsername: 'leader',
};

test('QC4 official data mapping is linked to dossier context and issuance fields', () => {
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });

  assert.deepEqual(data, {
    loai_sp: 'Dây điện hạ thế',
    ten_cong_ty: 'Công ty A',
    dia_chi_ct: 'Hà Nội',
    so_dang_ky: 'GCN-0665/2026',
    so_gcn: 'GCN-0665/2026',
    ngay_cap_CN: '28/08/2026',
    ngay_cap_gcn: '28/08/2026',
  });
});

test('official mapping does not allow free-text overrides of linked issuance data', () => {
  const data = buildPcnOfficialTemplateData({
    context,
    issuance,
    documentKind: 'CERTIFICATE',
    overrides: { ten_cong_ty: 'Tên giả', so_dang_ky: 'Số giả', arbitrary: 'Không được dùng' },
  });
  assert.equal(data.ten_cong_ty, context.customerName);
  assert.equal(data.so_dang_ky, issuance.issuanceNumber);
  assert.equal(data.arbitrary, undefined);
});

test('official generation readiness blocks missing data and unapproved templates', () => {
  const source = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });
  const blocked = getPcnOfficialGenerationReadiness(source, data);
  assert.equal(blocked.ready, false);
  assert.ok(blocked.reasons.includes('STATUS_NOT_APPROVED'));
  assert.ok(blocked.reasons.includes('MISSING_PRIVATE_ASSET'));

  const approved = { ...source, status: 'APPROVED' as const, fileAssetId: 'asset-template', storageScope: 'PCN_PRIVATE' as const };
  const missing = getPcnOfficialGenerationReadiness(approved, { ...data, so_dang_ky: '' });
  assert.equal(missing.ready, false);
  assert.ok(missing.reasons.includes('MISSING_REQUIRED_DATA'));
  assert.equal(getPcnOfficialGenerationReadiness(approved, data).ready, true);
});

test('official generation readiness ignores legacy review metadata for new PCN work', () => {
  const source = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
  const approved = { ...source, status: 'APPROVED' as const, fileAssetId: 'asset-template', storageScope: 'PCN_PRIVATE' as const };
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });

  assert.equal(getPcnOfficialGenerationReadiness(approved, data).ready, true);
  assert.doesNotMatch(JSON.stringify(getPcnOfficialGenerationReadiness(approved, data)), /HISTORICAL|REVIEW_INCOMPLETE/i);
});

test('DOCX renderer replaces QC4 delimiters and preserves the template package', () => {
  const template = makeTemplate(['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN']);
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });
  const rendered = renderPcnOfficialDocx(template, data);
  const xml = new PizZip(rendered).file('word/document.xml')!.asText();

  assert.match(xml, /GCN-0665\/2026/);
  assert.match(xml, /Dây điện hạ thế/);
  assert.match(xml, /Công ty A/);
  assert.doesNotMatch(xml, /\[\[/);
});

test('official mapper supplies canonical certificate and decision aliases', () => {
  const certificate = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });
  const decision = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'DECISION' });
  assert.equal(certificate.so_gcn, issuance.issuanceNumber);
  assert.equal(certificate.ngay_cap_gcn, '28/08/2026');
  assert.equal(decision.so_quyet_dinh, issuance.issuanceNumber);
  assert.equal(decision.ngay_qd, '28/08/2026');

  const rendered = renderPcnOfficialDocx(makeTemplate(['so_gcn', 'ngay_cap_gcn', 'so_quyet_dinh', 'ngay_qd']), { ...certificate, ...decision });
  const xml = new PizZip(rendered).file('word/document.xml')!.asText();
  assert.doesNotMatch(xml, /\[\[/);
});

test('official context hash is deterministic and changes when issuance data changes', () => {
  const template = PCN_TEMPLATE_CATALOG.find((item) => item.id === 'pcn-qc4-certificate-tool')!;
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });
  const first = buildPcnOfficialContextHash(context.contextHash, template, data);
  const second = buildPcnOfficialContextHash(context.contextHash, template, data);
  const changed = buildPcnOfficialContextHash(context.contextHash, template, { ...data, so_dang_ky: 'GCN-OTHER' });

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, changed);
});

test('official context hash binds template placeholder mapping metadata', () => {
  const template = PCN_TEMPLATE_CATALOG.find((item) => item.id === 'pcn-qc4-certificate-tool')!;
  const data = buildPcnOfficialTemplateData({ context, issuance, documentKind: 'CERTIFICATE' });
  const first = buildPcnOfficialContextHash(context.contextHash, template, data);
  const changedMapping = buildPcnOfficialContextHash(context.contextHash, {
    ...template,
    placeholderKeys: [...template.placeholderKeys, 'mapped_label'],
    annotation: {
      sourceAssetId: 'asset-annotated',
      sourceSha256: 'b'.repeat(64),
      appliedAt: '2026-08-28T00:00:00.000Z',
      appliedBy: 'admin-01',
      mappings: [{ key: 'mapped_label', sourceText: 'Nhãn mới' }],
    },
  }, data);

  assert.notEqual(first, changedMapping);
});

// --- End of pcn-official-template-generation.test.ts ---
