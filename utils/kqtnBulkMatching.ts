// Author: Gemini
// OS support: Web/Node
// Description: Deterministic matching rules for bulk KQTN PDF assignment.

import { normalizeKqtnSampleKey } from './kqtnIdentity';

export interface KqtnBulkCandidate {
  id: string;
  sampleCode: string;
  sampleKey: string;
  reportNo?: string;
  sampleName?: string;
  model: string;
  brand?: string;
  sealStamp?: string;
  hasPdf: boolean;
  isPending?: boolean;
}

export interface KqtnBulkFileInspection {
  fileName: string;
  sampleCode?: string;
  reportNo?: string;
  model?: string;
  brand?: string;
  sealStamp?: string;
}

export interface KqtnBulkMatch {
  candidateId?: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  needsManualSelection: boolean;
  reason: string;
}

function normalizedModel(value: string | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizedValue(value: string | undefined): string {
  return normalizeKqtnSampleKey(value);
}

function findUniqueByIdentity(value: string | undefined, candidates: KqtnBulkCandidate[]): KqtnBulkCandidate[] {
  const normalized = normalizedValue(value);
  if (!normalized) return [];
  return candidates.filter((candidate) => [candidate.sampleKey, candidate.sampleCode, candidate.reportNo]
    .some((candidateValue) => normalizedValue(candidateValue) === normalized));
}

function brandMatches(left: string | undefined, right: string | undefined): boolean {
  return normalizedModel(left) !== '' && normalizedModel(left) === normalizedModel(right);
}

export function matchKqtnBulkFile(
  file: KqtnBulkFileInspection,
  candidates: KqtnBulkCandidate[],
): KqtnBulkMatch {
  for (const identity of [file.sampleCode, file.reportNo]) {
    const identityMatches = findUniqueByIdentity(identity, candidates);
    if (identityMatches.length === 1) {
      return {
        candidateId: identityMatches[0].id,
        confidence: 'high',
        needsManualSelection: false,
        reason: identity === file.reportNo ? 'Khớp chính xác số báo cáo.' : 'Khớp chính xác mã hóa đầu mẫu.',
      };
    }
    if (identityMatches.length > 1) {
      return {
        confidence: 'low',
        needsManualSelection: true,
        reason: 'Có nhiều đầu mẫu cùng mã hóa hoặc số báo cáo sau khi chuẩn hóa.',
      };
    }
  }

  const sealMatches = candidates.filter((candidate) => normalizedValue(candidate.sealStamp) === normalizedValue(file.sealStamp) && normalizedValue(file.sealStamp));
  if (sealMatches.length === 1) {
    return {
      candidateId: sealMatches[0].id,
      confidence: 'high',
      needsManualSelection: false,
      reason: 'Khớp chính xác tem niêm phong.',
    };
  }
  if (sealMatches.length > 1) {
    return {
      confidence: 'low',
      needsManualSelection: true,
      reason: 'Tem niêm phong khớp nhiều đầu mẫu, cần người dùng chọn.',
    };
  }

  const fileModel = normalizedModel(file.model);
  if (fileModel) {
    const modelMatches = candidates.filter((candidate) => normalizedModel(candidate.model) === fileModel);
    const modelBrandMatches = modelMatches.filter((candidate) => brandMatches(file.brand, candidate.brand));
    if (modelBrandMatches.length === 1) {
      return {
        candidateId: modelBrandMatches[0].id,
        confidence: 'medium',
        needsManualSelection: false,
        reason: 'Khớp chính xác model và hãng; mã hóa chưa được xác định.',
      };
    }
    if (modelMatches.length > 1) {
      return {
        confidence: 'low',
        needsManualSelection: true,
        reason: 'Model khớp nhiều đầu mẫu, cần người dùng chọn.',
      };
    }
    if (modelMatches.length === 1) {
      return {
        candidateId: modelMatches[0].id,
        confidence: 'low',
        needsManualSelection: true,
        reason: 'Chỉ khớp model; cần người dùng rà soát đầu mẫu.',
      };
    }
  }

  return {
    confidence: 'none',
    needsManualSelection: true,
    reason: 'Không đủ thông tin để xác định đầu mẫu.',
  };
}

// --- End of kqtnBulkMatching.ts ---
