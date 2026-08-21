// Author: Gemini
// OS support: Web/Node
// Description: Deterministic matching rules for bulk KQTN PDF assignment.

import { normalizeKqtnSampleKey } from './kqtnIdentity';

export interface KqtnBulkCandidate {
  id: string;
  sampleCode: string;
  sampleKey: string;
  model: string;
  hasPdf: boolean;
}

export interface KqtnBulkFileInspection {
  fileName: string;
  sampleCode?: string;
  model?: string;
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

export function matchKqtnBulkFile(
  file: KqtnBulkFileInspection,
  candidates: KqtnBulkCandidate[],
): KqtnBulkMatch {
  const fileSampleKey = normalizeKqtnSampleKey(file.sampleCode);
  if (fileSampleKey) {
    const codeMatches = candidates.filter((candidate) => candidate.sampleKey === fileSampleKey);
    if (codeMatches.length === 1) {
      return {
        candidateId: codeMatches[0].id,
        confidence: 'high',
        needsManualSelection: false,
        reason: 'Khớp chính xác mã hóa đầu mẫu.',
      };
    }
    if (codeMatches.length > 1) {
      return {
        confidence: 'low',
        needsManualSelection: true,
        reason: 'Có nhiều đầu mẫu cùng mã hóa sau khi chuẩn hóa.',
      };
    }
  }

  const fileModel = normalizedModel(file.model);
  if (fileModel) {
    const modelMatches = candidates.filter((candidate) => normalizedModel(candidate.model) === fileModel);
    if (modelMatches.length === 1) {
      return {
        candidateId: modelMatches[0].id,
        confidence: 'medium',
        needsManualSelection: false,
        reason: 'Khớp chính xác model; mã hóa chưa được xác định.',
      };
    }
    if (modelMatches.length > 1) {
      return {
        confidence: 'low',
        needsManualSelection: true,
        reason: 'Model khớp nhiều đầu mẫu, cần người dùng chọn.',
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
