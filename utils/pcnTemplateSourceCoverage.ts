// Author: Codex
// OS support: Node
// Description: Read-only batch inspection of the controlled PCN template source catalog

import fs from 'node:fs';
import path from 'node:path';

import type { PcnTemplateDefinition } from '../types.ts';
import { PCN_TEMPLATE_CATALOG, getPcnTemplateRequiredPlaceholderKeys } from './pcnTemplateCatalog.ts';
import { inspectPcnTemplateSource, type PcnTemplateInspection } from './pcnTemplateDiscovery.ts';
import { resolvePcnTemplateImportSourceRelativePath, resolvePcnTemplateSourceFile } from './pcnTemplateSource.ts';

export type PcnTemplateSourceCoverageStatus =
  | 'FOUND'
  | 'MISSING'
  | 'FINGERPRINT_MISMATCH'
  | 'NEEDS_ANNOTATION'
  | 'READY_TO_APPLY';

export interface PcnTemplateSourceCoverageRow {
  templateId: string;
  fieldCode: PcnTemplateDefinition['fieldCode'];
  displayName: string;
  sourceRelativePath: string;
  status: PcnTemplateSourceCoverageStatus;
  inspection?: PcnTemplateInspection;
  expectedByteSize?: number;
  expectedSha256?: string;
  missingRequiredKeys: string[];
  message: string;
}

export interface PcnTemplateSourceCoverageCounts {
  total: number;
  found: number;
  missing: number;
  fingerprintMismatch: number;
  needsAnnotation: number;
  readyToApply: number;
}

export interface PcnTemplateSourceCoverageSummary extends PcnTemplateSourceCoverageCounts {
  byField: Record<'QC4' | 'QC9', PcnTemplateSourceCoverageCounts>;
}

export interface PcnTemplateSourceCoverageReport {
  rows: PcnTemplateSourceCoverageRow[];
  summary: PcnTemplateSourceCoverageSummary;
  readOnly: true;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function validateSourceRoot(sourceRoot: string): void {
  const rawRoot = normalize(sourceRoot);
  if (!rawRoot) throw new Error('Thiếu sourceRoot: hãy chọn thư mục nguồn PCN.');
  let stat: fs.Stats;
  try {
    stat = fs.statSync(path.resolve(rawRoot));
  } catch {
    throw new Error('Không tìm thấy thư mục nguồn PCN.');
  }
  if (!stat.isDirectory()) throw new Error('SourceRoot PCN không phải thư mục.');
}

function sourceWasImported(template: PcnTemplateDefinition, expectedTemplate: PcnTemplateDefinition, inspection: PcnTemplateInspection): boolean {
  const importedHashes = [template.sourceFingerprint.sha256, template.sourceOriginalFingerprint?.sha256]
    .map((value) => normalize(value).toLowerCase())
    .filter(Boolean);
  return Boolean(template.fileAssetId
    && template.storageScope === 'PCN_PRIVATE'
    && (importedHashes.includes(inspection.sha256.toLowerCase()) || normalize(expectedTemplate.sourceFingerprint.sha256).toLowerCase() === inspection.sha256.toLowerCase()));
}

function hasCompleteRuntimeAnnotation(template: PcnTemplateDefinition, requiredKeys: string[]): boolean {
  if (template.format !== 'DOCX' || requiredKeys.length === 0) return false;
  const activePlaceholders = new Set(template.placeholderKeys.map(normalize));
  const mappedKeys = new Set((template.annotation?.mappings || []).map((mapping) => normalize(mapping.key)));
  return requiredKeys.every((key) => activePlaceholders.has(normalize(key)) && mappedKeys.has(normalize(key)));
}

function fingerprintMatches(template: PcnTemplateDefinition, inspection: PcnTemplateInspection): boolean {
  const expectedSize = Number(template.sourceFingerprint.byteSize || 0);
  const expectedSha = normalize(template.sourceFingerprint.sha256).toLowerCase();
  return template.format === inspection.format
    && (!expectedSize || expectedSize === inspection.byteSize)
    && (!expectedSha || expectedSha === inspection.sha256.toLowerCase());
}

function needsAnnotation(template: PcnTemplateDefinition, inspection: PcnTemplateInspection, missingRequiredKeys: string[]): boolean {
  return template.status === 'NEEDS_ANNOTATION'
    || inspection.format === 'DOC'
    || inspection.warnings.length > 0
    || inspection.suggestedStatus !== 'DISCOVERED'
    || missingRequiredKeys.length > 0
    || getPcnTemplateRequiredPlaceholderKeys(template).length === 0 && inspection.placeholderKeys.length === 0;
}

function missingSourceRow(template: PcnTemplateDefinition, expectedTemplate: PcnTemplateDefinition, sourceRelativePath: string): PcnTemplateSourceCoverageRow {
  return {
    templateId: template.id,
    fieldCode: template.fieldCode,
    displayName: template.displayName,
    sourceRelativePath,
    status: 'MISSING',
    expectedByteSize: expectedTemplate.sourceFingerprint.byteSize || undefined,
    ...(expectedTemplate.sourceFingerprint.sha256 ? { expectedSha256: expectedTemplate.sourceFingerprint.sha256 } : {}),
    missingRequiredKeys: [],
    message: 'Không tìm thấy hoặc không thể đọc file nguồn trong thư mục PCN.',
  };
}

export function buildPcnTemplateSourceCoverage(
  sourceRoot: string,
  templates: PcnTemplateDefinition[] = PCN_TEMPLATE_CATALOG,
  baselineTemplates: PcnTemplateDefinition[] = PCN_TEMPLATE_CATALOG,
): PcnTemplateSourceCoverageReport {
  validateSourceRoot(sourceRoot);
  const baselineById = new Map(baselineTemplates.map((template) => [template.id, template]));
  const rows = templates.map((template) => {
    const baseline = baselineById.get(template.id) || template;
    const sourceRelativePath = resolvePcnTemplateImportSourceRelativePath(
      template.sourceFingerprint.sourceRelativePath,
      baseline.sourceFingerprint.sourceRelativePath,
      baseline.fieldCode,
    );
    let sourcePath: string;
    try {
      sourcePath = resolvePcnTemplateSourceFile(sourceRoot, sourceRelativePath);
    } catch {
      return missingSourceRow(template, baseline, sourceRelativePath);
    }

    let inspection: PcnTemplateInspection;
    try {
      inspection = inspectPcnTemplateSource({
        fileName: path.basename(sourcePath),
        sourceRelativePath,
        bytes: fs.readFileSync(sourcePath),
      });
    } catch {
      return missingSourceRow(template, baseline, sourceRelativePath);
    }
    const requiredKeys = getPcnTemplateRequiredPlaceholderKeys(baseline);
    const discoveredKeys = new Set(inspection.placeholderKeys.map(normalize));
    const missingRequiredKeys = requiredKeys.filter((key) => !discoveredKeys.has(normalize(key)));
    const imported = sourceWasImported(template, baseline, inspection);
    const runtimeAnnotationComplete = imported && hasCompleteRuntimeAnnotation(template, requiredKeys);
    if (!fingerprintMatches(baseline, inspection)) {
      return {
        templateId: template.id,
        fieldCode: template.fieldCode,
        displayName: template.displayName,
        sourceRelativePath,
        status: 'FINGERPRINT_MISMATCH' as const,
        inspection,
        expectedByteSize: baseline.sourceFingerprint.byteSize || undefined,
        ...(baseline.sourceFingerprint.sha256 ? { expectedSha256: baseline.sourceFingerprint.sha256 } : {}),
        missingRequiredKeys,
        message: 'Nguồn tồn tại nhưng fingerprint hoặc định dạng không khớp catalog.',
      };
    }

    if (needsAnnotation(baseline, inspection, missingRequiredKeys) && !runtimeAnnotationComplete) {
      return {
        templateId: template.id,
        fieldCode: template.fieldCode,
        displayName: template.displayName,
        sourceRelativePath,
        status: 'NEEDS_ANNOTATION' as const,
        inspection,
        expectedByteSize: baseline.sourceFingerprint.byteSize || undefined,
        ...(baseline.sourceFingerprint.sha256 ? { expectedSha256: baseline.sourceFingerprint.sha256 } : {}),
        missingRequiredKeys,
        message: 'Nguồn tồn tại nhưng cần chú thích hoặc rà soát trước khi dùng.',
      };
    }

    return {
      templateId: template.id,
      fieldCode: template.fieldCode,
      displayName: template.displayName,
      sourceRelativePath,
      status: imported ? 'FOUND' as const : 'READY_TO_APPLY' as const,
      inspection,
      expectedByteSize: baseline.sourceFingerprint.byteSize || undefined,
      ...(baseline.sourceFingerprint.sha256 ? { expectedSha256: baseline.sourceFingerprint.sha256 } : {}),
      missingRequiredKeys,
      message: imported
        ? runtimeAnnotationComplete && template.status === 'NEEDS_ANNOTATION'
          ? 'Nguồn đã được import và chú thích vào kho riêng PCN; bản template còn chờ Admin phê duyệt.'
          : 'Nguồn đã được import vào kho riêng PCN.'
        : 'Nguồn hợp lệ, sẵn sàng Apply vào kho riêng PCN.',
    };
  });
  const emptyCounts = (): PcnTemplateSourceCoverageCounts => ({ total: 0, found: 0, missing: 0, fingerprintMismatch: 0, needsAnnotation: 0, readyToApply: 0 });
  const summary = rows.reduce<PcnTemplateSourceCoverageSummary>((result, row) => {
    result.total += 1;
    if (row.status === 'FOUND') result.found += 1;
    if (row.status === 'MISSING') result.missing += 1;
    if (row.status === 'FINGERPRINT_MISMATCH') result.fingerprintMismatch += 1;
    if (row.status === 'NEEDS_ANNOTATION') result.needsAnnotation += 1;
    if (row.status === 'READY_TO_APPLY') result.readyToApply += 1;
    const fieldSummary = result.byField[row.fieldCode];
    fieldSummary.total += 1;
    if (row.status === 'FOUND') fieldSummary.found += 1;
    if (row.status === 'MISSING') fieldSummary.missing += 1;
    if (row.status === 'FINGERPRINT_MISMATCH') fieldSummary.fingerprintMismatch += 1;
    if (row.status === 'NEEDS_ANNOTATION') fieldSummary.needsAnnotation += 1;
    if (row.status === 'READY_TO_APPLY') fieldSummary.readyToApply += 1;
    return result;
  }, { ...emptyCounts(), byField: { QC4: emptyCounts(), QC9: emptyCounts() } });
  return { rows, summary, readOnly: true };
}

// --- End of pcnTemplateSourceCoverage.ts ---
