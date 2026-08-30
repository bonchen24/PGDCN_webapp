import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import PizZip from 'pizzip';

import {
  buildPcnTemplateSourceCoverage,
} from '../utils/pcnTemplateSourceCoverage.ts';
import {
  resolvePcnTemplateSourceFile,
  resolvePcnTemplateImportSourceRelativePath,
} from '../utils/pcnTemplateSource.ts';
import type { PcnTemplateDefinition } from '../types.ts';

function makeDocxWithPlaceholder(key: string): Buffer {
  const zip = new PizZip();
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>[[${key}]]</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

function sourceTemplate(input: Partial<PcnTemplateDefinition> & Pick<PcnTemplateDefinition, 'id' | 'sourceFingerprint'>): PcnTemplateDefinition {
  return {
    fieldCode: 'QC4',
    documentKind: 'CERTIFICATE',
    displayName: input.id,
    sourceLabel: input.sourceFingerprint.sourceRelativePath,
    format: 'DOCX',
    status: 'DISCOVERED',
    placeholderKeys: ['loai_sp'],
    requiredPlaceholderKeys: ['loai_sp'],
    ...input,
  };
}

test('template source resolution keeps the catalog path inside the selected PCN root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-template-source-'));
  try {
    const relativePath = 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx';
    const filePath = path.join(root, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'template');

    assert.equal(resolvePcnTemplateSourceFile(root, relativePath), fs.realpathSync(filePath));
    assert.throws(() => resolvePcnTemplateSourceFile(root, '../outside.docx'), /ngoài|outside|relative/i);
    assert.throws(() => resolvePcnTemplateSourceFile('', relativePath), /sourceRoot|thư mục nguồn/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('template import restores the full catalog folder when runtime metadata has a legacy field prefix', () => {
  const baseline = 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx';
  assert.equal(
    resolvePcnTemplateImportSourceRelativePath('QC4/Tool QC4/Nhap data/GCN.docx', baseline, 'QC4'),
    baseline,
  );
  assert.equal(
    resolvePcnTemplateImportSourceRelativePath('QC9/File ket qua mau/GCN.docx', 'Hồ sơ chứng nhận QCVN9 2026/File ket qua mau/GCN.docx', 'QC9'),
    'Hồ sơ chứng nhận QCVN9 2026/File ket qua mau/GCN.docx',
  );
  assert.equal(resolvePcnTemplateImportSourceRelativePath(baseline, baseline, 'QC4'), baseline);
});

test('template source coverage is one read-only report with safe per-template statuses', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-template-coverage-'));
  try {
    const readyRelative = 'QC4/ready.docx';
    const readyBytes = makeDocxWithPlaceholder('loai_sp');
    const readyPath = path.join(root, ...readyRelative.split('/'));
    fs.mkdirSync(path.dirname(readyPath), { recursive: true });
    fs.writeFileSync(readyPath, readyBytes);
    const readySha = createHash('sha256').update(readyBytes).digest('hex');

    const legacyRelative = 'QC9/legacy.doc';
    const legacyBytes = Buffer.from('legacy-source');
    const legacyPath = path.join(root, ...legacyRelative.split('/'));
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, legacyBytes);

    const templates = [
      sourceTemplate({ id: 'ready', sourceFingerprint: { sourceRelativePath: readyRelative, byteSize: readyBytes.length, sha256: readySha } }),
      sourceTemplate({ id: 'missing', sourceFingerprint: { sourceRelativePath: 'QC4/missing.docx', byteSize: 1, sha256: 'a'.repeat(64) } }),
      sourceTemplate({ id: 'mismatch', sourceFingerprint: { sourceRelativePath: readyRelative, byteSize: readyBytes.length + 1, sha256: 'b'.repeat(64) } }),
      sourceTemplate({ id: 'legacy', fieldCode: 'QC9', format: 'DOC', sourceFingerprint: { sourceRelativePath: legacyRelative, byteSize: legacyBytes.length } }),
      sourceTemplate({ id: 'imported', fieldCode: 'QC9', fileAssetId: 'asset-imported', storageScope: 'PCN_PRIVATE', sourceFingerprint: { sourceRelativePath: readyRelative, byteSize: readyBytes.length, sha256: readySha } }),
    ];

    const report = buildPcnTemplateSourceCoverage(root, templates);
    assert.deepEqual(report.rows.map((row) => [row.templateId, row.status]), [
      ['ready', 'READY_TO_APPLY'],
      ['missing', 'MISSING'],
      ['mismatch', 'FINGERPRINT_MISMATCH'],
      ['legacy', 'NEEDS_ANNOTATION'],
      ['imported', 'FOUND'],
    ]);
    assert.deepEqual(report.summary, {
      total: 5,
      found: 1,
      missing: 1,
      fingerprintMismatch: 1,
      needsAnnotation: 1,
      readyToApply: 1,
      byField: {
        QC4: { total: 3, found: 0, missing: 1, fingerprintMismatch: 1, needsAnnotation: 0, readyToApply: 1 },
        QC9: { total: 2, found: 1, missing: 0, fingerprintMismatch: 0, needsAnnotation: 1, readyToApply: 0 },
      },
    });
    assert.equal(report.rows[0].sourceRelativePath, readyRelative);
    assert.equal('absolutePath' in report.rows[0], false);
    assert.equal(JSON.stringify(report).includes(root), false);
    assert.match(report.rows[2].message, /fingerprint|định dạng/i);
    assert.match(report.rows[3].inspection?.warnings.join(' ') || '', /LEGACY_FORMAT/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('template source coverage recognizes an imported runtime template after annotation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-template-annotated-'));
  try {
    const sourceRelativePath = 'QC9/annotated.docx';
    const bytes = makeDocxWithPlaceholder('loai_sp');
    const filePath = path.join(root, ...sourceRelativePath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, bytes);
    const fingerprint = {
      sourceRelativePath,
      byteSize: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    const baseline = sourceTemplate({
      id: 'annotated',
      fieldCode: 'QC9',
      status: 'NEEDS_ANNOTATION',
      sourceFingerprint: fingerprint,
    });
    const runtime = {
      ...baseline,
      fileAssetId: 'asset-annotated',
      storageScope: 'PCN_PRIVATE' as const,
      sourceOriginalFingerprint: fingerprint,
      annotation: {
        sourceAssetId: 'asset-annotated-source',
        sourceSha256: fingerprint.sha256,
        appliedAt: '2026-08-30T00:00:00.000Z',
        appliedBy: 'admin-01',
        mappings: [{ key: 'loai_sp', sourceText: 'Tên sản phẩm' }],
      },
    };

    const report = buildPcnTemplateSourceCoverage(root, [runtime], [baseline]);
    assert.equal(report.rows[0].status, 'FOUND');
    assert.match(report.rows[0].message, /import/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('template import UI is dry-run first and does not expose an arbitrary source path field', () => {
  const api = fs.readFileSync(new URL('../utils/pcnTemplateApi.ts', import.meta.url), 'utf8');
  const managementView = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(api, /importPcnTemplateOnServer/);
  assert.match(api, /preflightPcnTemplateSourcesOnServer/);
  assert.match(api, /preflight-all/);
  assert.match(api, /sourceRoot/);
  assert.match(api, /DRY_RUN/);
  assert.match(managementView, /sourceRoot/);
  assert.match(managementView, /Dry-run/);
  assert.match(managementView, /Apply/);
  assert.match(managementView, /Kiểm tra toàn bộ nguồn/);
  assert.match(managementView, /Độ phủ nguồn mẫu/);
  assert.match(managementView, /byField\.QC4/);
  assert.match(server, /app\.post\('\/api\/pcn\/templates\/import'/);
  assert.match(server, /app\.post\('\/api\/pcn\/templates\/preflight-all'/);
  assert.match(server, /buildPcnTemplateSourceCoverage/);
  assert.match(server, /resolvePcnTemplateSourceFile/);
  assert.match(server, /sourceRoot/);
  assert.match(server, /requirePcnAdmin\(req, res\)/);
});
