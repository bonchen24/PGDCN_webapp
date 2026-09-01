// Author: Codex
// OS support: Web/Node
// Description: Browser-safe normalization and review hints for observed PCN code families

export type PcnCodeFamily =
  | 'FIELD_REGISTRATION'
  | 'IEMM_REFERENCE'
  | 'PYC_REFERENCE'
  | 'CERTIFICATION_REFERENCE'
  | 'UNKNOWN';

export const PCN_CODE_FAMILY_LABELS: Record<PcnCodeFamily, string> = {
  FIELD_REGISTRATION: 'Mã hồ sơ / đăng ký',
  IEMM_REFERENCE: 'Mã IEMM',
  PYC_REFERENCE: 'Mã PYC',
  CERTIFICATION_REFERENCE: 'Mã GCN / Quyết định',
  UNKNOWN: 'Chưa nhận diện',
};

export function getPcnCodeFamilyLabel(family: PcnCodeFamily): string {
  return PCN_CODE_FAMILY_LABELS[family];
}

export interface PcnCodeClassification {
  source: string;
  normalized: string;
  family: PcnCodeFamily;
  recognized: boolean;
}

export interface PcnCodeReview extends PcnCodeClassification {
  needsReview: boolean;
  message: string;
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/** Keep leading zeroes and normalize only visual separators; do not invent a code. */
export function normalizePcnCode(value: unknown): string {
  return text(value)
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .toUpperCase();
}

function isFieldRegistrationCode(value: string): boolean {
  return /^\d{4}(?:-\d{2})?$/.test(value)
    || /^(?:DN|HS)-QC(?:4|9|20)-\d{4}-\d{4}(?:-\d{2})?$/.test(value);
}

function isIemmReference(value: string): boolean {
  return /^IEMM\s+\d{4}(?:-(?:SP-)?\d{2})?$/.test(value);
}

function isPycReference(value: string): boolean {
  return /^PYC\s+\d+(?:[_-]R\d+)?$/.test(value);
}

function isCertificationReference(value: string): boolean {
  return /^(?:GCN|Q[ĐD])\b/.test(value)
    || /\bQC(?:4|9|20)\.\d+(?:\.\d+)?\b/.test(value);
}

export function classifyPcnCode(fieldCode: unknown, value: unknown): PcnCodeClassification {
  const source = text(value);
  const normalized = normalizePcnCode(source);
  const field = text(fieldCode).toUpperCase();
  if (!normalized) return { source, normalized, family: 'UNKNOWN', recognized: false };
  if (isFieldRegistrationCode(normalized)) return { source, normalized, family: 'FIELD_REGISTRATION', recognized: true };
  if (isIemmReference(normalized)) return { source, normalized, family: 'IEMM_REFERENCE', recognized: true };
  if (isPycReference(normalized)) return { source, normalized, family: 'PYC_REFERENCE', recognized: true };
  if (isCertificationReference(normalized) && ['QC4', 'QC9', 'QC20'].includes(field)) {
    return { source, normalized, family: 'CERTIFICATION_REFERENCE', recognized: true };
  }
  return { source, normalized, family: 'UNKNOWN', recognized: false };
}

/** Review hint only. Intake remains usable because the final code may arrive from an external register. */
export function reviewPcnCode(fieldCode: unknown, value: unknown): PcnCodeReview {
  const classification = classifyPcnCode(fieldCode, value);
  if (!classification.normalized) {
    return {
      ...classification,
      needsReview: true,
      message: 'Chưa có mã nguồn PCN; cần đối chiếu trước khi phát hành.',
    };
  }
  if (!classification.recognized) {
    return {
      ...classification,
      needsReview: true,
      message: 'Mã chưa nhận diện theo mẫu nguồn PCN; cần đối chiếu mã nguồn trước khi phát hành.',
    };
  }
  return { ...classification, needsReview: false, message: '' };
}

/** Review a code against every linked field; a dossier has no primary field. */
export function reviewPcnCodes(fieldCodes: readonly unknown[], value: unknown): PcnCodeReview {
  const fields = fieldCodes.map((fieldCode) => text(fieldCode)).filter(Boolean);
  const reviews = fields.map((fieldCode) => reviewPcnCode(fieldCode, value));
  const recognized = reviews.find((review) => !review.needsReview);
  return recognized || reviewPcnCode(fields[0], value);
}

// --- End of pcnCodePolicy.ts ---
