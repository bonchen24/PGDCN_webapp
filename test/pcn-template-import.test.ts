import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildPcnTemplateAssetId,
  buildPcnTemplateImportPlan,
  mergePcnTemplateDefinition,
} from '../utils/pcnTemplateImport.ts';
import type { PcnTemplateDefinition } from '../types.ts';
import type { PcnTemplateDiscoveryWarning } from '../utils/pcnTemplateDiscovery.ts';

const template: PcnTemplateDefinition = {
  id: 'pcn-qc4-certificate-test',
  fieldCode: 'QC4',
  documentKind: 'CERTIFICATE',
  displayName: 'GCN QC4 test',
  sourceLabel: 'QC4 / GCN.docx',
  format: 'DOCX',
  status: 'DISCOVERED',
  placeholderKeys: ['loai_sp', 'ten_cong_ty'],
  requiredPlaceholderKeys: ['loai_sp', 'ten_cong_ty'],
  sourceFingerprint: { sourceRelativePath: 'QC4/GCN.docx', byteSize: 11, sha256: 'a'.repeat(64) },
};

const inspection = {
  fileName: 'GCN.docx',
  sourceRelativePath: 'QC4/GCN.docx',
  format: 'DOCX' as const,
  byteSize: 11,
  sha256: 'a'.repeat(64),
  placeholderKeys: ['loai_sp', 'ten_cong_ty'],
  suggestedStatus: 'DISCOVERED' as const,
  warnings: [] as PcnTemplateDiscoveryWarning[],
};

test('template import plan derives stable private asset/object identifiers from SHA-256', () => {
  const plan = buildPcnTemplateImportPlan(template, inspection);
  assert.equal(plan.assetId, buildPcnTemplateAssetId(inspection.sha256));
  assert.equal(plan.objectPath, `pcnTemplates/QC4/${template.id}/${inspection.sha256}/GCN.docx`);
  assert.equal(plan.definition.fileAssetId, plan.assetId);
  assert.equal(plan.definition.storageScope, 'PCN_PRIVATE');
  assert.equal(plan.definition.status, 'DISCOVERED');
  assert.equal(plan.definition.sourceFingerprint.sha256, inspection.sha256);
});

test('template object paths transliterate Vietnamese source names before sanitizing', () => {
  const sourceRelativePath = 'QC9/BM-QT-03-02a - GCN  (theo phương thức 1).docx';
  const unicodeTemplate: PcnTemplateDefinition = {
    ...template,
    id: 'pcn-qc9-certificate-test',
    fieldCode: 'QC9',
    sourceFingerprint: { ...template.sourceFingerprint, sourceRelativePath },
  };
  const plan = buildPcnTemplateImportPlan(unicodeTemplate, { ...inspection, sourceRelativePath });
  assert.equal(plan.objectPath, `pcnTemplates/QC9/${unicodeTemplate.id}/${inspection.sha256}/BM-QT-03-02a_-_GCN_theo_phuong_thuc_1_.docx`);
});

test('template import refuses fingerprint/placeholder drift and requires explicit approval', () => {
  assert.throws(() => buildPcnTemplateImportPlan(template, { ...inspection, sha256: 'b'.repeat(64) }), /fingerprint|SHA/i);
  assert.throws(() => buildPcnTemplateImportPlan(template, { ...inspection, placeholderKeys: ['loai_sp'] }), /placeholder/i);
  assert.throws(() => buildPcnTemplateImportPlan({ ...template, format: 'DOC' }, { ...inspection, format: 'DOC' }), /DOCX|legacy|allow|chú thích/i);

  const approved = buildPcnTemplateImportPlan(template, inspection, { approve: true });
  assert.equal(approved.definition.status, 'APPROVED');
  assert.ok(approved.definition.approvedAt);
});

test('template import can explicitly retain a warned DOCX for annotation but never approve it', () => {
  const warnedInspection = {
    ...inspection,
    placeholderKeys: [],
    suggestedStatus: 'NEEDS_ANNOTATION' as const,
    warnings: ['NO_MACHINE_PLACEHOLDERS'] as PcnTemplateDiscoveryWarning[],
  };

  assert.throws(() => buildPcnTemplateImportPlan(template, warnedInspection), /cảnh báo|placeholder/i);
  const retained = buildPcnTemplateImportPlan(template, warnedInspection, { allowAnnotation: true });
  assert.equal(retained.definition.status, 'NEEDS_ANNOTATION');
  assert.deepEqual(retained.definition.placeholderKeys, []);
  assert.throws(
    () => buildPcnTemplateImportPlan(template, warnedInspection, { allowAnnotation: true, approve: true }),
    /phê duyệt|approve|annotation/i,
  );
});

test('legacy DOC templates can be retained as private reference assets only with annotation mode', () => {
  const legacyTemplate = { ...template, format: 'DOC' as const };
  const legacyInspection = { ...inspection, fileName: 'GCN.doc', format: 'DOC' as const };

  assert.throws(() => buildPcnTemplateImportPlan(legacyTemplate, legacyInspection), /legacy|allow|chú thích/i);
  const retained = buildPcnTemplateImportPlan(legacyTemplate, legacyInspection, { allowAnnotation: true });
  assert.equal(retained.definition.status, 'NEEDS_ANNOTATION');
  assert.equal(retained.mimeType, 'application/msword');
  assert.throws(
    () => buildPcnTemplateImportPlan(legacyTemplate, legacyInspection, { allowAnnotation: true, approve: true }),
    /phê duyệt|approve|annotation/i,
  );
});

test('template definition merge is idempotent and never silently downgrades approval', () => {
  const imported = buildPcnTemplateImportPlan(template, inspection).definition;
  assert.deepEqual(mergePcnTemplateDefinition(undefined, imported), imported);
  assert.deepEqual(mergePcnTemplateDefinition(imported, imported), imported);

  const approved = buildPcnTemplateImportPlan(template, inspection, { approve: true }).definition;
  const rerunWithoutApproval = mergePcnTemplateDefinition(approved, imported);
  assert.equal(rerunWithoutApproval.status, 'APPROVED');
  assert.equal(rerunWithoutApproval.approvedAt, approved.approvedAt);
  assert.equal(rerunWithoutApproval.fileAssetId, imported.fileAssetId);

  const rerunWithApproval = buildPcnTemplateImportPlan(template, inspection, { approve: true, approvedAt: '2099-01-01T00:00:00.000Z' }).definition;
  const mergedApprovedRerun = mergePcnTemplateDefinition(approved, rerunWithApproval);
  assert.equal(mergedApprovedRerun.status, 'APPROVED');
  assert.equal(mergedApprovedRerun.approvedAt, approved.approvedAt);
});

test('template import CLI is dry-run first, explicit apply/approve, and has no Desktop watcher', () => {
  const source = fs.readFileSync(new URL('../scripts/importPcnTemplate.ts', import.meta.url), 'utf8');
  assert.match(source, /mode: options\.apply \? 'APPLY' : 'DRY_RUN'/);
  assert.match(source, /options\.approve && !options\.apply/);
  assert.match(source, /allowAnnotation/);
  assert.match(source, /allow-annotation/);
  assert.match(source, /pcnTemplateDefinitions/);
  assert.doesNotMatch(source, /watchFile|watch\(/);
});

test('template import CLI does not combine Apply with self-approval', () => {
  const source = fs.readFileSync(new URL('../scripts/importPcnTemplate.ts', import.meta.url), 'utf8');
  assert.match(source, /Không thể nhập và tự phê duyệt template/);
  assert.match(source, /boundary review|review riêng/i);
});

test('template import CLI locks the complete private asset provenance tuple before reuse', () => {
  const source = fs.readFileSync(new URL('../scripts/importPcnTemplate.ts', import.meta.url), 'utf8');
  assert.match(source, /String\(asset\.bucket_name\) !== bucketName/);
  assert.match(source, /String\(asset\.object_path\) !== plan\.objectPath/);
  assert.match(source, /asset\.source_json_path !== 'fileAssetId'/);
  assert.match(source, /asset\.mime_type !== plan\.mimeType/);
  assert.match(source, /Number\(asset\.byte_size\) !== plan\.bytes\.length/);
});

test('template import serializes retries for the deterministic asset id', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /pcn-template-asset:/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
});

test('server activity validation allowlists every PCN template and quality-document mutation', () => {
  const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const allowlist = source.slice(source.indexOf('const ACTIVITY_LOG_ENTITY_TYPES'), source.indexOf('const ACTIVITY_LOG_SOURCES'));
  assert.match(allowlist, /"PCN_TEMPLATE"/);
  assert.match(allowlist, /"PCN_QUALITY_DOCUMENT"/);
});

// --- End of pcn-template-import.test.ts ---
