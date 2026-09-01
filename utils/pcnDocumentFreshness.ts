// Author: Codex
// OS support: Web/Node
// Description: Browser-safe freshness rule shared by PCN document generation UI and server

import { getPcnTimestampDenial } from './pcnDossierDate.ts';
import type { PcnDossierDocument, PcnGeneratedDocumentKind } from '../types.ts';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function parseValidPcnTimestamp(value: string): number | undefined {
  if (getPcnTimestampDenial('Mốc nguồn', value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function getPcnDocumentSourceUpdatedAt(...values: Array<string | undefined>): string | undefined {
  return values
    .map((value) => clean(value))
    .filter((value) => value && parseValidPcnTimestamp(value) !== undefined)
    .sort((left, right) => (parseValidPcnTimestamp(right)! - parseValidPcnTimestamp(left)!) || right.localeCompare(left))[0];
}

export type PcnDocumentPreflightIssueSeverity = 'WARNING' | 'BLOCKING';

export interface PcnDocumentPreflightIssue {
  severity: PcnDocumentPreflightIssueSeverity;
  code: 'MISSING_REQUIRED_CHECKLIST' | 'SAMPLE_ROUTE_REQUIRED' | 'LAB_REQUEST_REQUIRED' | 'CONTEXT_CHANGED';
  message: string;
}

export function getPcnDocumentContextConflict(expectedContextHash: string | undefined, actualContextHash: string): PcnDocumentPreflightIssue | undefined {
  const expected = clean(expectedContextHash);
  const actual = clean(actualContextHash);
  if (!expected || expected === actual) return undefined;
  return {
    severity: 'BLOCKING',
    code: 'CONTEXT_CHANGED',
    message: 'Dữ liệu hồ sơ đã thay đổi sau preflight; hãy kiểm tra lại trước khi sinh tài liệu.',
  };
}

export interface PcnDocumentPreflightChecklistItem {
  name: string;
  required: boolean;
  status: PcnDossierDocument['status'];
}

export function getPcnDocumentPreflightIssues(input: {
  kind: PcnGeneratedDocumentKind;
  hasSampleRoute: boolean;
  hasLabRequest?: boolean;
  checklist: PcnDocumentPreflightChecklistItem[];
}): PcnDocumentPreflightIssue[] {
  const issues: PcnDocumentPreflightIssue[] = [];
  if ((input.kind === 'SAMPLE_TAKING' || input.kind === 'SAMPLE_HANDOVER' || input.kind === 'SAMPLE_RETURN' || input.kind === 'SAMPLE_CODING') && !input.hasSampleRoute) {
    issues.push({
      severity: 'BLOCKING',
      code: 'SAMPLE_ROUTE_REQUIRED',
        message: input.kind === 'SAMPLE_RETURN'
        ? 'Biên bản trả mẫu cần chọn một tuyến mẫu hợp lệ.'
        : input.kind === 'SAMPLE_TAKING'
          ? 'Biên bản lấy mẫu cần chọn một tuyến mẫu hợp lệ.'
          : input.kind === 'SAMPLE_CODING'
            ? 'Biên bản mã hóa mẫu cần chọn một tuyến mẫu hợp lệ.'
            : 'Biên bản giao/nhận mẫu cần chọn một tuyến mẫu hợp lệ.',
    });
  }
  if (input.kind === 'LAB_REQUEST' && !input.hasLabRequest) {
    issues.push({
      severity: 'BLOCKING',
      code: 'LAB_REQUEST_REQUIRED',
      message: 'PYC gửi PTN cần chọn một PYC thuộc hồ sơ.',
    });
  }
  const missingRequired = input.checklist
    .filter((item) => item.required && item.status !== 'PRESENT')
    .map((item) => clean(item.name))
    .filter(Boolean);
  if (missingRequired.length > 0) {
    issues.push({
      severity: 'WARNING',
      code: 'MISSING_REQUIRED_CHECKLIST',
      message: `Thiếu tài liệu bắt buộc: ${missingRequired.join(', ')}.`,
    });
  }
  return issues;
}

// --- End of pcnDocumentFreshness.ts ---
