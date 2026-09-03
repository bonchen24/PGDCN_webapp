import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_TEMPLATE_CATALOG,
  getPcnTemplateApprovalReadiness,
  getPcnTemplateReadiness,
  getPcnTemplateRequiredPlaceholderKeys,
  getPcnTemplatesForFields,
  mergePcnTemplateCatalog,
  mergePcnTemplateRuntimeProjection,
} from '../utils/pcnTemplateCatalog.ts';

test('PCN template catalog is separate from the legacy DDT template catalog', () => {
  const source = fs.readFileSync(new URL('../utils/pcnTemplateCatalog.ts', import.meta.url), 'utf8');
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

  assert.ok(PCN_TEMPLATE_CATALOG.length >= 6);
  assert.ok(PCN_TEMPLATE_CATALOG.every((template) => template.id.startsWith('pcn-')));
  assert.doesNotMatch(source, /REPORT_TEMPLATES_CATALOG/);
  assert.match(serverSource, /REPORT_TEMPLATES_CATALOG/);
  assert.match(panelSource, /getPcnTemplateReadiness/);
  assert.match(panelSource, /const readiness = getPcnTemplateReadiness\(template, \{ availablePlaceholderKeys: template\.placeholderKeys, requireVerifiedPrivateAsset: true \}\)/);
  assert.match(panelSource, /Biểu mẫu phát hành chính thức/);
  assert.ok(PCN_TEMPLATE_CATALOG.every((template) => !template.sourceFingerprint.sourceRelativePath.includes('Desktop')));
  assert.ok(PCN_TEMPLATE_CATALOG.every((template) => !template.sourceFingerprint.sourceRelativePath.includes('dist')));
});

test('PCN template import defaults to the private PCN Storage bucket', () => {
  const importSource = fs.readFileSync(new URL('../scripts/importPcnTemplate.ts', import.meta.url), 'utf8');
  const bucketFunction = importSource.slice(importSource.indexOf('function getStorageBucket'), importSource.indexOf('function stableJson'));

  assert.match(bucketFunction, /PCN_STORAGE_BUCKET/);
  assert.match(bucketFunction, /'pcn-files'/);
  assert.doesNotMatch(bucketFunction, /SUPABASE_STORAGE_BUCKET/);
  assert.doesNotMatch(bucketFunction, /'ddt-files'/);
});

test('PCN template import is exposed as a locked maintenance command', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.['import:pcn-template'], 'node ./scripts/run-pcn-tsx.cjs scripts/importPcnTemplate.ts');
});

test('PCN template approval revalidates the complete private asset provenance', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const reviewRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/templates/:templateId/review'"),
    serverSource.indexOf("app.post('/api/pcn/templates/:templateId/annotate'"),
  );

  assert.match(reviewRoute, /String\(asset\.bucket_name\) !== getPcnStorageBucket\(\)/);
  assert.match(reviewRoute, /asset\.mime_type/);
  assert.match(reviewRoute, /Number\(asset\.byte_size\)/);
  assert.match(reviewRoute, /sourceFingerprint\.sha256/);
});

test('PCN baseline template paths stay relative to the surveyed source-family roots', () => {
  const expectedPaths = new Map([
    ['pcn-qc4-certificate-tool', 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx'],
    ['pcn-qc4-decision-tool', 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/Quyet dinh.docx'],
    ['pcn-qc4-sample-handover-tool', 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/Bien Ban.docx'],
    ['pcn-qc4-proposal-pt7', 'Hồ sơ chứng nhận QCVN4 2026/Biểu mẫu biên bản thực hiện/Form ĐK và GCN QC4/BM-QT-06-05a-De nghi CNSP theo PT7 QC4.doc'],
    ['pcn-qc9-certificate-method-1', 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-03-02a - GCN  (theo phương thức 1).docx'],
    ['pcn-qc9-decision-method-1', 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QĐ-03-01a - Quyet dinh (theo phương thức 1).doc'],
    ['pcn-qc9-proposal-method-1-tdc', 'Hồ sơ chứng nhận QCVN9 2026/mẫu pyc bên TĐC/BM-02-32 Mẫu yêu cầu CNSP PT1.docx'],
    ['pcn-qc9-proposal-method-1', 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-06-05a De nghi chung nhan san pham theo phuong thuc 1.doc'],
    ['pcn-qc9-evaluation-report-method-1-7', 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-09-09a-BC đánh giá CNSP theo pt1 và 7.doc'],
  ]);

  for (const template of PCN_TEMPLATE_CATALOG) {
    assert.equal(template.sourceFingerprint.sourceRelativePath, expectedPaths.get(template.id), template.id);
    assert.match(template.sourceFingerprint.sourceRelativePath, /^Hồ sơ chứng nhận QCVN[49] 2026\//);
  }
});

test('QC9 TDC request form is cataloged as a proposal and stays review-gated', () => {
  const template = PCN_TEMPLATE_CATALOG.find((item) => item.id === 'pcn-qc9-proposal-method-1-tdc');

  assert.ok(template);
  assert.equal(template.fieldCode, 'QC9');
  assert.equal(template.documentKind, 'PROPOSAL');
  assert.equal(template.method, 'METHOD_1');
  assert.equal(template.format, 'DOCX');
  assert.equal(template.status, 'NEEDS_ANNOTATION');
  assert.deepEqual(template.requiredPlaceholderKeys, []);
  assert.equal(template.sourceFingerprint.byteSize, 580076);
  assert.equal(template.sourceFingerprint.sha256, 'b6002ca96027524c599e6b5fb71fe8d9fbd900e164efda6a9552460a774da6e4');
  assert.equal(template.sourceFingerprint.sourceRelativePath, 'Hồ sơ chứng nhận QCVN9 2026/mẫu pyc bên TĐC/BM-02-32 Mẫu yêu cầu CNSP PT1.docx');
});

test('QC4 catalog preserves the machine-readable keys found in the source templates', () => {
  const gcn = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool');
  const decision = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-decision-tool');
  const handover = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-sample-handover-tool');

  assert.deepEqual(gcn?.requiredPlaceholderKeys, ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN']);
  assert.deepEqual(decision?.requiredPlaceholderKeys, ['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN', 'ngay_qd']);
  assert.ok(handover?.placeholderKeys.includes('nhan_hieu'));
  assert.equal(gcn?.format, 'DOCX');
  assert.equal(gcn?.status, 'DISCOVERED');
});

test('QC9 legacy/example files stay blocked until annotated and approved', () => {
  const qc9 = getPcnTemplatesForFields(['QC9']);
  const certificate = qc9.find((template) => template.documentKind === 'CERTIFICATE');
  const decision = qc9.find((template) => template.documentKind === 'DECISION');
  const proposal = qc9.find((template) => template.id === 'pcn-qc9-proposal-method-1');
  const tdcProposal = qc9.find((template) => template.id === 'pcn-qc9-proposal-method-1-tdc');

  assert.equal(certificate?.format, 'DOCX');
  assert.equal(certificate?.status, 'NEEDS_ANNOTATION');
  assert.equal(decision?.format, 'DOC');
  assert.equal(decision?.status, 'NEEDS_ANNOTATION');
  assert.equal(proposal?.format, 'DOC');
  assert.equal(proposal?.status, 'NEEDS_ANNOTATION');
  assert.equal(tdcProposal?.format, 'DOCX');
  assert.equal(tdcProposal?.status, 'NEEDS_ANNOTATION');
  assert.ok(qc9.filter((template) => template.status !== 'APPROVED').length >= 4);
});

test('official generation readiness blocks unsafe templates and requires private Storage asset', () => {
  const discovered = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
  const blocked = getPcnTemplateReadiness(discovered, { availablePlaceholderKeys: discovered.placeholderKeys });
  assert.equal(blocked.ready, false);
  assert.ok(blocked.reasons.includes('STATUS_NOT_APPROVED'));
  assert.ok(blocked.reasons.includes('MISSING_PRIVATE_ASSET'));

  const approved = {
    ...discovered,
    status: 'APPROVED' as const,
    fileAssetId: 'asset-private-qc4-certificate',
    storageScope: 'PCN_PRIVATE' as const,
  };
  const ready = getPcnTemplateReadiness(approved, { availablePlaceholderKeys: approved.placeholderKeys });
  assert.deepEqual(ready, { ready: true, reasons: [] });

  const unverified = getPcnTemplateReadiness(approved, {
    availablePlaceholderKeys: approved.placeholderKeys,
    requireVerifiedPrivateAsset: true,
  });
  assert.equal(unverified.ready, false);
  assert.ok(unverified.reasons.includes('MISSING_PRIVATE_ASSET'));
  const verified = getPcnTemplateReadiness({ ...approved, privateAssetVerified: true }, {
    availablePlaceholderKeys: approved.placeholderKeys,
    requireVerifiedPrivateAsset: true,
  });
  assert.deepEqual(verified, { ready: true, reasons: [] });

  const missingField = getPcnTemplateReadiness(approved, {
    availablePlaceholderKeys: ['loai_sp', 'ten_cong_ty'],
  });
  assert.equal(missingField.ready, false);
  assert.ok(missingField.reasons.includes('MISSING_REQUIRED_PLACEHOLDERS'));
});

test('approval readiness evaluates an imported discovered template as the approval projection', () => {
  const discovered = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
  const approvalReadiness = getPcnTemplateApprovalReadiness({
    ...discovered,
    fileAssetId: 'asset-private-qc4-certificate',
    storageScope: 'PCN_PRIVATE',
    privateAssetVerified: true,
  }, { availablePlaceholderKeys: discovered.placeholderKeys, requireVerifiedPrivateAsset: true });

  assert.deepEqual(approvalReadiness, { ready: true, reasons: [] });
  assert.equal(getPcnTemplateReadiness(discovered, { availablePlaceholderKeys: discovered.placeholderKeys }).ready, false);
});

test('legacy DOC templates remain blocked even if their status is accidentally changed', () => {
  const legacy = PCN_TEMPLATE_CATALOG.find((template) => template.format === 'DOC')!;
  const result = getPcnTemplateReadiness({
    ...legacy,
    status: 'APPROVED',
    fileAssetId: 'asset-private-legacy',
  }, { availablePlaceholderKeys: legacy.placeholderKeys });

  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('LEGACY_FORMAT'));
});

test('QC9 runtime definitions with legacy empty required lists still use the canonical gate', () => {
  const result = getPcnTemplateReadiness({
    ...PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc9-certificate-method-1')!,
    requiredPlaceholderKeys: [],
    placeholderKeys: [],
    status: 'APPROVED',
    fileAssetId: 'asset-private-qc9',
    storageScope: 'PCN_PRIVATE',
  }, { availablePlaceholderKeys: [] });

  assert.deepEqual(getPcnTemplateRequiredPlaceholderKeys({
    ...PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc9-certificate-method-1')!,
    requiredPlaceholderKeys: [],
  }), ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN']);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('MISSING_REQUIRED_PLACEHOLDERS'));
});

test('runtime template metadata overrides the baseline by id without mixing fields', () => {
  const baseline = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
  const runtime = { ...baseline, status: 'APPROVED' as const, fileAssetId: 'pcn-template-runtime', storageScope: 'PCN_PRIVATE' as const };
  const merged = mergePcnTemplateCatalog([runtime]);

  assert.equal(merged.filter((template) => template.id === baseline.id).length, 1);
  assert.equal(merged.find((template) => template.id === baseline.id)?.status, 'APPROVED');
  assert.equal(getPcnTemplatesForFields(['QC9'], merged).every((template) => template.fieldCode === 'QC9'), true);
});

test('template mutation responses preserve runtime asset verification only when the pointer is unchanged', () => {
  const current = {
    ...PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!,
    status: 'APPROVED' as const,
    fileAssetId: 'asset-verified',
    storageScope: 'PCN_PRIVATE' as const,
    privateAssetVerified: true,
    privateAssetVerificationIssue: undefined,
  };
  const reviewed = mergePcnTemplateRuntimeProjection(current, { ...current, status: 'RETIRED' as const, privateAssetVerified: undefined });
  assert.equal(reviewed.privateAssetVerified, true);
  const annotated = mergePcnTemplateRuntimeProjection(current, { ...current, fileAssetId: 'asset-new', privateAssetVerified: undefined });
  assert.equal(annotated.privateAssetVerified, undefined);
});

test('template mutation responses preserve the read-only asset verification reason with the same pointer', () => {
  const current = {
    ...PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!,
    status: 'NEEDS_ANNOTATION' as const,
    fileAssetId: 'asset-conflict',
    storageScope: 'PCN_PRIVATE' as const,
    privateAssetVerified: false,
    privateAssetVerificationIssue: 'SHA256_MISMATCH' as const,
  };
  const next = mergePcnTemplateRuntimeProjection(current, { ...current, status: 'RETIRED' as const, privateAssetVerified: undefined, privateAssetVerificationIssue: undefined });

  assert.equal(next.privateAssetVerified, false);
  assert.equal(next.privateAssetVerificationIssue, 'SHA256_MISMATCH');
});

// --- End of pcn-template-catalog.test.ts ---
