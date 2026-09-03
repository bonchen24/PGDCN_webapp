// Author: Codex
// OS support: Node/Web
// Description: Controlled PCN official-template catalog and generation readiness gate

import type {
  PcnOfficialDocumentKind,
  PcnTemplateDefinition,
} from '../types.ts';

/**
 * A catalog of the source templates surveyed from the PCN reference pack.
 * It intentionally contains metadata only; Desktop files are never a runtime dependency.
 */
export const PCN_TEMPLATE_CATALOG: PcnTemplateDefinition[] = [
  {
    id: 'pcn-qc4-certificate-tool',
    fieldCode: 'QC4',
    documentKind: 'CERTIFICATE',
    displayName: 'GCN QC4 — mẫu công cụ',
    sourceLabel: 'QCVN4 2026 / Tool QC4 / Nhập data / GCN.docx',
    format: 'DOCX',
    status: 'DISCOVERED',
    placeholderKeys: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN'],
    requiredPlaceholderKeys: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN'],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx',
      byteSize: 572939,
      sha256: '08bd13498296f719b162783ea4963b2e1b458acc91cde900b66af7fa13b389a0',
    },
  },
  {
    id: 'pcn-qc4-decision-tool',
    fieldCode: 'QC4',
    documentKind: 'DECISION',
    displayName: 'Quyết định QC4 — mẫu công cụ',
    sourceLabel: 'QCVN4 2026 / Tool QC4 / Nhập data / Quyet dinh.docx',
    format: 'DOCX',
    status: 'DISCOVERED',
    placeholderKeys: ['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN', 'ngay_qd'],
    requiredPlaceholderKeys: ['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN', 'ngay_qd'],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/Quyet dinh.docx',
      byteSize: 52378,
      sha256: '41b44628ce817dc746ce4b0c54d71fe0d86a99377241bd340ed24bf262ddee0a',
    },
  },
  {
    id: 'pcn-qc4-sample-handover-tool',
    fieldCode: 'QC4',
    documentKind: 'SAMPLE_HANDOVER',
    displayName: 'Biên bản QC4 — mẫu công cụ',
    sourceLabel: 'QCVN4 2026 / Tool QC4 / Nhập data / Bien Ban.docx',
    format: 'DOCX',
    status: 'DISCOVERED',
    placeholderKeys: [
      'so_dang_ky',
      'ten_cong_ty',
      'ngay_dk',
      'dia_chi_kho',
      'ngay_lay_mau',
      'loai_sp',
      'model',
      'nhan_hieu',
      'tieu_chuan',
      'so_ITD',
      'ngay_ITD',
    ],
    requiredPlaceholderKeys: ['so_dang_ky', 'ten_cong_ty', 'ngay_lay_mau', 'loai_sp', 'model', 'nhan_hieu'],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/Bien Ban.docx',
      byteSize: 182454,
      sha256: '7cabb1e25a0db36d16b77a4442e6b509200d1f315ac1d1bb18cb76ff83961756',
    },
  },
  {
    id: 'pcn-qc4-proposal-pt7',
    fieldCode: 'QC4',
    documentKind: 'PROPOSAL',
    method: 'METHOD_7',
    variant: 'PT7',
    displayName: 'Đề nghị chứng nhận QC4 theo PT7',
    sourceLabel: 'QCVN4 2026 / Biểu mẫu biên bản thực hiện / Form ĐK và GCN QC4 / BM-QT-06-05a',
    format: 'DOC',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: [],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Biểu mẫu biên bản thực hiện/Form ĐK và GCN QC4/BM-QT-06-05a-De nghi CNSP theo PT7 QC4.doc',
      byteSize: 162816,
      sha256: '880e339a497ff2cd2bec79ff7611f54e739d985a85e805acd84fe6865d92693d',
    },
  },
  {
    id: 'pcn-qc9-certificate-method-1',
    fieldCode: 'QC9',
    documentKind: 'CERTIFICATE',
    method: 'METHOD_1',
    displayName: 'GCN QC9 theo phương thức 1',
    sourceLabel: 'QCVN9 2026 / File kết quả mẫu / BM-QT-03-02a — GCN',
    format: 'DOCX',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN'],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-03-02a - GCN  (theo phương thức 1).docx',
      byteSize: 578076,
      sha256: '2588a065673d9e617d49eb724f292e9f84ba0f0f585cb63173e4df168d8076ab',
    },
  },
  {
    id: 'pcn-qc9-decision-method-1',
    fieldCode: 'QC9',
    documentKind: 'DECISION',
    method: 'METHOD_1',
    displayName: 'Quyết định QC9 theo phương thức 1',
    sourceLabel: 'QCVN9 2026 / File kết quả mẫu / BM-QĐ-03-01a — Quyết định',
    format: 'DOC',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: ['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN', 'ngay_qd'],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QĐ-03-01a - Quyet dinh (theo phương thức 1).doc',
      byteSize: 69632,
      sha256: '91c0d03f2c4d26fdeb14505e183699f077fa55f1482afcc0469cbd43b390679c',
    },
  },
  {
    id: 'pcn-qc9-proposal-method-1-tdc',
    fieldCode: 'QC9',
    documentKind: 'PROPOSAL',
    method: 'METHOD_1',
    displayName: 'Đề nghị chứng nhận QC9 — biểu mẫu TĐC',
    sourceLabel: 'QCVN9 2026 / mẫu PYC bên TĐC / BM-02-32 Mẫu yêu cầu CNSP PT1',
    format: 'DOCX',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: [],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/mẫu pyc bên TĐC/BM-02-32 Mẫu yêu cầu CNSP PT1.docx',
      byteSize: 580076,
      sha256: 'b6002ca96027524c599e6b5fb71fe8d9fbd900e164efda6a9552460a774da6e4',
    },
  },
  {
    id: 'pcn-qc9-proposal-method-1',
    fieldCode: 'QC9',
    documentKind: 'PROPOSAL',
    method: 'METHOD_1',
    displayName: 'Đề nghị chứng nhận QC9 theo phương thức 1',
    sourceLabel: 'QCVN9 2026 / File kết quả mẫu / BM-QT-06-05a — Đề nghị chứng nhận',
    format: 'DOC',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: [],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-06-05a De nghi chung nhan san pham theo phuong thuc 1.doc',
      byteSize: 194048,
      sha256: '273173e77710363628be3cecc268540430cf511f5dfa221e02f2a3e307d8e288',
    },
  },
  {
    id: 'pcn-qc9-evaluation-report-method-1-7',
    fieldCode: 'QC9',
    documentKind: 'EVALUATION_REPORT',
    method: 'METHOD_1',
    variant: 'METHOD_1_7',
    displayName: 'Báo cáo đánh giá QC9 theo PT1 và PT7',
    sourceLabel: 'QCVN9 2026 / File kết quả mẫu / BM-QT-09-09a — Báo cáo đánh giá',
    format: 'DOC',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: [],
    sourceFingerprint: {
      sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu/BM-QT-09-09a-BC đánh giá CNSP theo pt1 và 7.doc',
      byteSize: 159232,
      sha256: '57c00e0ba5ee682cf863a8bc1b76b2ad2b2c481d09fce2b2c5b84df28f4917c8',
    },
  },
];

/**
 * Remove one-time authoring provenance before a template enters the PCN
 * runtime. The checked-in baseline still keeps its research metadata for the
 * locked authoring/import command, but stores, API responses and UI cards
 * must only receive operational asset metadata.
 */
export function toPcnTemplateRuntimeProjection(template: PcnTemplateDefinition): PcnTemplateDefinition {
  const {
    sourceLabel: _sourceLabel,
    sourceFingerprint,
    sourceOriginalFingerprint,
    ...runtime
  } = template;
  return {
    ...runtime,
    sourceFingerprint: {
      byteSize: sourceFingerprint.byteSize,
      ...(sourceFingerprint.sha256 ? { sha256: sourceFingerprint.sha256 } : {}),
    },
    ...(sourceOriginalFingerprint ? {
      sourceOriginalFingerprint: {
        byteSize: sourceOriginalFingerprint.byteSize,
        ...(sourceOriginalFingerprint.sha256 ? { sha256: sourceOriginalFingerprint.sha256 } : {}),
      },
    } : {}),
  };
}

export type PcnTemplateReadinessReason =
  | 'STATUS_NOT_APPROVED'
  | 'LEGACY_FORMAT'
  | 'MISSING_PRIVATE_ASSET'
  | 'MISSING_REQUIRED_PLACEHOLDERS';

export const PCN_CANONICAL_REQUIRED_PLACEHOLDER_KEYS: Record<PcnOfficialDocumentKind, string[]> = {
  PROPOSAL: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct'],
  CERTIFICATE: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'so_dang_ky', 'ngay_cap_CN'],
  DECISION: ['so_dang_ky', 'loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'ngay_cap_CN', 'ngay_qd'],
  SAMPLE_HANDOVER: ['so_dang_ky', 'ten_cong_ty', 'ngay_lay_mau', 'loai_sp', 'model', 'nhan_hieu'],
  EVALUATION_REPORT: ['loai_sp', 'ten_cong_ty', 'dia_chi_ct', 'model', 'nhan_hieu', 'tieu_chuan'],
};

export interface PcnTemplateReadiness {
  ready: boolean;
  reasons: PcnTemplateReadinessReason[];
}

export function getPcnTemplateRequiredPlaceholderKeys(template: PcnTemplateDefinition): string[] {
  const explicit = template.requiredPlaceholderKeys.map((key) => normalizePlaceholderKey(key)).filter(Boolean);
  return explicit.length > 0 ? explicit : [...(PCN_CANONICAL_REQUIRED_PLACEHOLDER_KEYS[template.documentKind] || [])];
}

function normalizeFieldCode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function normalizePlaceholderKey(value: string): string {
  return String(value || '').trim().replace(/^\[\[|\]\]$/g, '').trim();
}

export function getPcnTemplatesForFields(
  fieldCodes: string[],
  catalog: PcnTemplateDefinition[] = mergePcnTemplateCatalog([]),
): PcnTemplateDefinition[] {
  const selected = new Set(fieldCodes.map(normalizeFieldCode).filter(Boolean));
  return catalog
    .filter((template) => selected.has(normalizeFieldCode(template.fieldCode)))
    .map(toPcnTemplateRuntimeProjection);
}

export function mergePcnTemplateCatalog(
  runtimeTemplates: PcnTemplateDefinition[],
  baseline: PcnTemplateDefinition[] = PCN_TEMPLATE_CATALOG,
): PcnTemplateDefinition[] {
  const merged = new Map(baseline.map((template) => [template.id, toPcnTemplateRuntimeProjection(template)]));
  for (const template of runtimeTemplates) {
    if (template?.id && ['QC4', 'QC9'].includes(normalizeFieldCode(template.fieldCode))) merged.set(template.id, toPcnTemplateRuntimeProjection(template));
  }
  return [...merged.values()];
}

/**
 * Preserve the server-derived asset verification projection across a
 * metadata-only mutation response. A changed file pointer deliberately clears
 * the projection so the next server read must verify the new provenance tuple.
 */
export function mergePcnTemplateRuntimeProjection(
  current: PcnTemplateDefinition,
  next: PcnTemplateDefinition,
): PcnTemplateDefinition {
  const sameAssetPointer = current.fileAssetId === next.fileAssetId
    && current.storageScope === next.storageScope;
  if (!sameAssetPointer || next.privateAssetVerified !== undefined || current.privateAssetVerified === undefined) return next;
  return {
    ...next,
    privateAssetVerified: current.privateAssetVerified,
    privateAssetVerificationIssue: current.privateAssetVerificationIssue,
  };
}

export function getPcnTemplateReadiness(
  template: PcnTemplateDefinition,
  input: { availablePlaceholderKeys?: Iterable<string>; requireVerifiedPrivateAsset?: boolean } = {},
): PcnTemplateReadiness {
  const reasons: PcnTemplateReadinessReason[] = [];
  if (template.status !== 'APPROVED') reasons.push('STATUS_NOT_APPROVED');
  if (template.format !== 'DOCX') reasons.push('LEGACY_FORMAT');
  if (!template.fileAssetId || template.storageScope !== 'PCN_PRIVATE') reasons.push('MISSING_PRIVATE_ASSET');
  if (input.requireVerifiedPrivateAsset && template.privateAssetVerified !== true && !reasons.includes('MISSING_PRIVATE_ASSET')) reasons.push('MISSING_PRIVATE_ASSET');

  const templatePlaceholders = new Set(template.placeholderKeys.map(normalizePlaceholderKey));
  const available = new Set(Array.from(input.availablePlaceholderKeys ?? template.placeholderKeys).map(normalizePlaceholderKey));
  const missing = getPcnTemplateRequiredPlaceholderKeys(template)
    .map(normalizePlaceholderKey)
    .filter((key) => !templatePlaceholders.has(key) || !available.has(key));
  if (missing.length > 0) reasons.push('MISSING_REQUIRED_PLACEHOLDERS');

  return { ready: reasons.length === 0, reasons };
}

/**
 * Probe whether an imported template is eligible for a separate approval review.
 * The current lifecycle status is intentionally ignored for this probe: a
 * DISCOVERED/NEEDS_ANNOTATION record may be ready to approve after its asset
 * and placeholders have been verified, while the review boundary still owns
 * the actual status transition and separation-of-duties check.
 */
export function getPcnTemplateApprovalReadiness(
  template: PcnTemplateDefinition,
  input: { availablePlaceholderKeys?: Iterable<string>; requireVerifiedPrivateAsset?: boolean } = {},
): PcnTemplateReadiness {
  return getPcnTemplateReadiness({ ...template, status: 'APPROVED' }, input);
}

export function getPcnOfficialDocumentKindLabel(kind: PcnOfficialDocumentKind): string {
  switch (kind) {
    case 'PROPOSAL': return 'Đề nghị';
    case 'CERTIFICATE': return 'GCN';
    case 'DECISION': return 'Quyết định';
    case 'SAMPLE_HANDOVER': return 'Biên bản giao/nhận mẫu';
    case 'EVALUATION_REPORT': return 'Báo cáo đánh giá';
  }
}

// --- End of pcnTemplateCatalog.ts ---
