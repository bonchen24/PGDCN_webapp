// Author: Codex
// OS support: Node
// Description: Pure planning and idempotent merge rules for controlled PCN template import

import type { PcnTemplateDefinition } from '../types.ts';
import { validatePcnTemplateRelativePath, type PcnTemplateInspection } from './pcnTemplateDiscovery.ts';

export interface PcnTemplateImportPlan {
  definition: PcnTemplateDefinition;
  assetId: string;
  objectPath: string;
  mimeType: string;
}

function transliterateAscii(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (character) => character === 'Đ' ? 'D' : 'd');
}

function sanitizeSegment(value: string): string {
  return transliterateAscii(value).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'template';
}

function sourceFileName(relativePath: string): string {
  return relativePath.split('/').pop() || 'template.docx';
}

export function buildPcnTemplateAssetId(sha256: string): string {
  const normalized = String(sha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('SHA-256 template PCN không hợp lệ.');
  return `pcn-template-${normalized.slice(0, 32)}`;
}

export function buildPcnTemplateImportPlan(
  template: PcnTemplateDefinition,
  inspection: PcnTemplateInspection,
  options: { approve?: boolean; allowAnnotation?: boolean; approvedAt?: string } = {},
): PcnTemplateImportPlan {
  const sourceRelativePath = validatePcnTemplateRelativePath(inspection.sourceRelativePath);
  if (sourceRelativePath !== validatePcnTemplateRelativePath(template.sourceFingerprint.sourceRelativePath)) {
    throw new Error('Fingerprint template không khớp đường dẫn nguồn trong catalog.');
  }
  if (inspection.format !== template.format) {
    throw new Error('Định dạng template không khớp fingerprint trong catalog.');
  }
  const requiresAnnotation = inspection.format === 'DOC'
    || inspection.warnings.length > 0
    || inspection.suggestedStatus !== 'DISCOVERED';
  if (requiresAnnotation && options.approve) {
    throw new Error('Không thể phê duyệt template còn cảnh báo hoặc cần chú thích.');
  }
  if (requiresAnnotation && !options.allowAnnotation) {
    throw new Error('Template chưa đủ điều kiện nhập: cần xử lý cảnh báo/chú thích placeholder trước hoặc dùng --allow-annotation để lưu bản tham chiếu.');
  }
  if (template.sourceFingerprint.byteSize > 0 && template.sourceFingerprint.byteSize !== inspection.byteSize) {
    throw new Error('Byte size template không khớp fingerprint trong catalog.');
  }
  if (template.sourceFingerprint.sha256 && template.sourceFingerprint.sha256.toLowerCase() !== inspection.sha256.toLowerCase()) {
    throw new Error('SHA-256 template không khớp fingerprint trong catalog.');
  }
  const discovered = new Set(inspection.placeholderKeys.map((key) => String(key).trim()));
  const missing = template.requiredPlaceholderKeys.filter((key) => !discovered.has(String(key).trim()));
  if (missing.length > 0 && !(options.allowAnnotation && requiresAnnotation)) {
    throw new Error(`Template thiếu placeholder bắt buộc: ${missing.join(', ')}`);
  }

  const assetId = buildPcnTemplateAssetId(inspection.sha256);
  const status = options.approve ? 'APPROVED' : requiresAnnotation ? 'NEEDS_ANNOTATION' : template.status;
  const definition: PcnTemplateDefinition = {
    ...template,
    status,
    placeholderKeys: [...inspection.placeholderKeys],
    sourceFingerprint: {
      ...template.sourceFingerprint,
      sourceRelativePath,
      byteSize: inspection.byteSize,
      sha256: inspection.sha256.toLowerCase(),
    },
    fileAssetId: assetId,
    storageScope: 'PCN_PRIVATE',
    ...(options.approve ? { approvedAt: options.approvedAt || new Date().toISOString() } : {}),
  };
  return {
    definition,
    assetId,
    objectPath: `pcnTemplates/${sanitizeSegment(template.fieldCode)}/${sanitizeSegment(template.id)}/${inspection.sha256.toLowerCase()}/${sanitizeSegment(sourceFileName(sourceRelativePath))}`,
    mimeType: inspection.format === 'DOC'
      ? 'application/msword'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

export function mergePcnTemplateDefinition(
  existing: PcnTemplateDefinition | undefined,
  incoming: PcnTemplateDefinition,
): PcnTemplateDefinition {
  if (!existing) return incoming;
  if (existing.id !== incoming.id) throw new Error('Không thể merge hai template khác mã.');
  const existingHash = existing.sourceFingerprint.sha256?.toLowerCase();
  const incomingHash = incoming.sourceFingerprint.sha256?.toLowerCase();
  if (existingHash && incomingHash && existingHash !== incomingHash) {
    throw new Error('Không thể thay thế template đã lưu bằng fingerprint khác mà không tạo mã mới.');
  }
  const preserveApproval = existing.status === 'APPROVED' && existingHash === incomingHash;
  return {
    ...existing,
    ...incoming,
    ...(preserveApproval ? { status: 'APPROVED' as const, approvedAt: existing.approvedAt } : {}),
  };
}

export function replacePcnTemplateFileDefinition(
  current: PcnTemplateDefinition,
  input: {
    assetId: string;
    byteSize: number;
    sha256: string;
    placeholderKeys: string[];
    importedByUsername: string;
    importedAt: string;
    sourceRelativePath?: string;
  },
): PcnTemplateDefinition {
  const {
    privateAssetVerified: _privateAssetVerified,
    privateAssetVerificationIssue: _privateAssetVerificationIssue,
    sourceOriginalFingerprint: _sourceOriginalFingerprint,
    annotation: _annotation,
    ...base
  } = current;
  return {
    ...base,
    fileAssetId: input.assetId,
    storageScope: 'PCN_PRIVATE',
    placeholderKeys: [...input.placeholderKeys],
    sourceFingerprint: {
      ...current.sourceFingerprint,
      ...(input.sourceRelativePath ? { sourceRelativePath: input.sourceRelativePath } : {}),
      byteSize: input.byteSize,
      sha256: input.sha256.toLowerCase(),
    },
    importedByUsername: input.importedByUsername,
    importedAt: input.importedAt,
  };
}

// --- End of pcnTemplateImport.ts ---
