// Author: Codex
// OS support: Browser/Node
// Description: Validated per-requirement skip decisions for the sequential PCN checklist gate.

import type { PcnDossierDocumentWaiver } from '../types.ts';

export type PcnDocumentWaiverPatchValue = { reason: string } | null;

export interface PcnDocumentWaiverPatchResult {
  values: Record<string, PcnDocumentWaiverPatchValue>;
  errors: Record<string, string>;
}

const MAX_WAIVER_REASON_LENGTH = 1000;

export function isPcnDocumentWaiverValid(waiver?: Partial<PcnDossierDocumentWaiver>): boolean {
  const decidedBy = String(waiver?.decidedBy || waiver?.decidedByUsername || '').trim();
  const decidedAt = String(waiver?.decidedAt || '').trim();
  return Boolean(
    String(waiver?.reason || '').trim()
      && decidedBy
      && decidedAt
      && Number.isFinite(Date.parse(decidedAt)),
  );
}

export function normalizePcnDocumentWaiverPatch(input: unknown): PcnDocumentWaiverPatchResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { values: {}, errors: { documentWaivers: 'Danh sách đánh dấu bỏ qua tài liệu không hợp lệ.' } };
  }

  const values: Record<string, PcnDocumentWaiverPatchValue> = {};
  const errors: Record<string, string> = {};
  for (const [rawRequirementId, rawValue] of Object.entries(input)) {
    const requirementId = rawRequirementId.trim();
    if (!requirementId) {
      errors[rawRequirementId] = 'Mã tài liệu không được để trống.';
      continue;
    }
    if (rawValue === null) {
      values[requirementId] = null;
      continue;
    }
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      errors[requirementId] = 'Quyết định bỏ qua tài liệu không hợp lệ.';
      continue;
    }
    const reason = String((rawValue as { reason?: unknown }).reason || '').trim();
    if (!reason) {
      errors[requirementId] = 'Lý do bỏ qua tài liệu là bắt buộc.';
      continue;
    }
    if (reason.length > MAX_WAIVER_REASON_LENGTH) {
      errors[requirementId] = `Lý do bỏ qua tài liệu vượt quá ${MAX_WAIVER_REASON_LENGTH} ký tự.`;
      continue;
    }
    values[requirementId] = { reason };
  }
  return { values, errors };
}

export function mergePcnDocumentWaivers(
  current: Record<string, PcnDossierDocumentWaiver> | undefined,
  patch: Record<string, PcnDocumentWaiverPatchValue>,
  decidedByUsername: string,
  decidedAt: string,
): Record<string, PcnDossierDocumentWaiver> {
  const next = { ...(current || {}) };
  for (const [requirementId, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[requirementId];
      continue;
    }
    next[requirementId] = {
      requirementId,
      reason: value.reason,
      decidedAt,
      decidedBy: decidedByUsername,
      decidedByUsername,
    };
  }
  return next;
}

// --- End of pcnDocumentWaivers.ts ---
