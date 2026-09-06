// Author: Codex
// OS support: Web/Node
// Description: Pure validation and projection helpers for the PCN sample-request bundle.

import type {
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnSampleRequestBundleLineDraft,
  PcnSampleRequestBundleDispatch,
} from '../types.ts';

export const PCN_SAMPLE_REQUEST_BUNDLE_MAPPING_VERSION = 'pcn-lab-map-v1';

export interface PcnSampleRequestBundleValidationIssue {
  code: 'CUSTOMER_MISMATCH' | 'DUPLICATE_LOT_CODE' | 'DUPLICATE_SAMPLE_CODE' | 'EMPTY_LINES' | 'MISSING_LAB' | 'INVALID_CODE';
  path: string;
  message: string;
}

export interface PcnSampleRequestBundleValidationContext {
  existingLotCodes: string[];
  existingSampleCodes: string[];
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleUpperCase('vi-VN');
}

function customerKey(value: Record<string, unknown> | undefined): string {
  if (!value) return '';
  return [value.name, value.taxId, value.address, value.phone, value.email]
    .map(normalize)
    .join('|');
}

function collectCodes(lines: PcnSampleRequestBundleLineDraft[], selector: (line: PcnSampleRequestBundleLineDraft) => string): Set<string> {
  return new Set(lines.map((line) => normalize(selector(line))).filter(Boolean));
}

export function validateSampleRequestBundleDraft(
  draft: PcnSampleRequestBundleDraft,
  context: PcnSampleRequestBundleValidationContext,
): PcnSampleRequestBundleValidationIssue[] {
  const issues: PcnSampleRequestBundleValidationIssue[] = [];
  if (!draft.lines.length) issues.push({ code: 'EMPTY_LINES', path: 'lines', message: 'PYC tổng phải có ít nhất một mẫu.' });
  const bundleCustomer = customerKey(draft.customerSnapshot as unknown as Record<string, unknown>);
  const lotCodes = collectCodes(draft.lines, (line) => line.lotCode);
  const sampleCodes = collectCodes(draft.lines, (line) => line.sampleCode);
  const persistedLotCodes = new Set(context.existingLotCodes.map(normalize));
  const persistedSampleCodes = new Set(context.existingSampleCodes.map(normalize));

  draft.lines.forEach((line, index) => {
    const path = `lines.${index}`;
    if (line.customerSnapshot && customerKey(line.customerSnapshot as unknown as Record<string, unknown>) !== bundleCustomer) {
      issues.push({ code: 'CUSTOMER_MISMATCH', path: `${path}.customerSnapshot`, message: 'Các mẫu trong PYC tổng phải thuộc cùng một khách hàng.' });
    }
    const lotCode = normalize(line.lotCode);
    const sampleCode = normalize(line.sampleCode);
    if (!lotCode || !sampleCode) issues.push({ code: 'INVALID_CODE', path, message: 'Mã lô và mã mẫu không được để trống.' });
    if (lotCodes.has(lotCode) && draft.lines.filter((candidate) => normalize(candidate.lotCode) === lotCode).length > 1) {
      issues.push({ code: 'DUPLICATE_LOT_CODE', path: `${path}.lotCode`, message: `Mã lô ${line.lotCode} bị trùng trong PYC tổng.` });
    } else if (persistedLotCodes.has(lotCode)) {
      issues.push({ code: 'DUPLICATE_LOT_CODE', path: `${path}.lotCode`, message: `Mã lô ${line.lotCode} đã tồn tại trong PCN.` });
    }
    if (sampleCodes.has(sampleCode) && draft.lines.filter((candidate) => normalize(candidate.sampleCode) === sampleCode).length > 1) {
      issues.push({ code: 'DUPLICATE_SAMPLE_CODE', path: `${path}.sampleCode`, message: `Mã mẫu ${line.sampleCode} bị trùng trong PYC tổng.` });
    } else if (persistedSampleCodes.has(sampleCode)) {
      issues.push({ code: 'DUPLICATE_SAMPLE_CODE', path: `${path}.sampleCode`, message: `Mã mẫu ${line.sampleCode} đã tồn tại trong PCN.` });
    }
    if (!line.labCodes.length) issues.push({ code: 'MISSING_LAB', path: `${path}.labCodes`, message: 'Mỗi mẫu phải được gán ít nhất một phòng thử nghiệm.' });
  });
  return issues;
}

function makeDispatch(bundleId: string, labCode: PcnSampleRequestBundleDispatch['labCode'], lines: PcnSampleRequestBundleLineDraft[]): PcnSampleRequestBundleDispatch {
  const matchingLines = lines.filter((line) => line.labCodes.includes(labCode));
  return {
    id: `${bundleId}-dispatch-${labCode.toLowerCase()}`,
    bundleId,
    targetSystemCode: `PCN_${labCode}`,
    labCode,
    routeIds: Array.from(new Set(matchingLines.flatMap((line) => line.routeIdsByLab?.[labCode] || []))),
    labRequestIds: [],
    status: 'DRAFT',
    mappingVersion: PCN_SAMPLE_REQUEST_BUNDLE_MAPPING_VERSION,
  };
}

export function buildSampleRequestBundleDraft(input: PcnSampleRequestBundleDraft, now: string = new Date().toISOString()): PcnSampleRequestBundle {
  const labCodes = Array.from(new Set(input.lines.flatMap((line) => line.labCodes)));
  const dispatches = labCodes.map((labCode) => makeDispatch(input.id, labCode, input.lines));
  return {
    id: input.id,
    parentPycNumber: input.parentPycNumber.trim(),
    customerSnapshot: input.customerSnapshot,
    sourceRefs: input.sourceRefs,
    sampleItemIds: input.lines.map((line) => line.sampleItemId).filter((value): value is string => Boolean(value)),
    sampleLotIds: Array.from(new Set(input.lines.map((line) => line.sampleLotId).filter((value): value is string => Boolean(value)))),
    fieldCodes: Array.from(new Set(input.fieldCodes)),
    ...(input.targetDate?.trim() ? { targetDate: input.targetDate.trim() } : {}),
    ...(input.criteria?.trim() ? { criteria: input.criteria.trim() } : {}),
    status: 'DRAFT',
    dispatches,
    mappingVersion: PCN_SAMPLE_REQUEST_BUNDLE_MAPPING_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

// --- End of pcnSampleRequestBundle.ts ---
