import type { PcnHistoricalPilotSpec } from './pcnHistoricalImport.ts';
import { normalizePcnHistoricalCode } from './pcnHistoricalImport.ts';
import type { PcnHistoricalSourceCandidate } from './pcnHistoricalSourceDiscovery.ts';

export interface PcnHistoricalCandidateSelector {
  fieldCode: 'QC4' | 'QC9';
  businessCode: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function selectorKey(selector: PcnHistoricalCandidateSelector): string {
  return `${selector.fieldCode}:${selector.businessCode}`;
}

export function parsePcnHistoricalCandidateSelectors(values: string[]): PcnHistoricalCandidateSelector[] {
  const result: PcnHistoricalCandidateSelector[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const rawValue = clean(value);
    if (!rawValue) throw new Error('Candidate phải có dạng FIELD:BUSINESS_CODE, ví dụ QC4:0665 hoặc QC9:0105-01.');
    for (const rawPart of rawValue.split(',')) {
      const part = rawPart.trim();
      if (!part) throw new Error('Candidate phải có dạng FIELD:BUSINESS_CODE, ví dụ QC4:0665 hoặc QC9:0105-01.');
      const match = part.match(/^([^:]+):(.+)$/);
      const fieldCode = clean(match?.[1]).toUpperCase();
      const businessCode = normalizePcnHistoricalCode(clean(match?.[2]));
      if (!match || !['QC4', 'QC9'].includes(fieldCode) || !businessCode) {
        throw new Error(`Candidate phải có dạng FIELD:BUSINESS_CODE, ví dụ QC4:0665 hoặc QC9:0105-01.`);
      }
      const selector = { fieldCode: fieldCode as 'QC4' | 'QC9', businessCode };
      const key = selectorKey(selector);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(selector);
      }
    }
  }
  return result;
}

export function resolvePcnHistoricalCandidates(
  candidates: PcnHistoricalSourceCandidate[],
  selectorValues: string[],
): PcnHistoricalSourceCandidate[] {
  const selectors = parsePcnHistoricalCandidateSelectors(selectorValues);
  return selectors.map((selector) => {
    const matches = candidates.filter((candidate) => candidate.fieldCode === selector.fieldCode && candidate.businessCode === selector.businessCode);
    if (matches.length === 0) throw new Error(`Candidate ${selectorKey(selector)} không tồn tại trong các scan root PCN đã allowlist.`);
    if (matches.length > 1) throw new Error(`Candidate ${selectorKey(selector)} bị trùng hoặc không duy nhất; hãy rà soát lại kết quả kiểm kê.`);
    return matches[0];
  });
}

export function buildPcnHistoricalSpecFromCandidate(candidate: PcnHistoricalSourceCandidate, sourceYear = '2026'): PcnHistoricalPilotSpec {
  const year = clean(sourceYear);
  const fieldCode = clean(candidate.fieldCode).toUpperCase();
  const businessCode = normalizePcnHistoricalCode(candidate.businessCode);
  if (!/^\d{4}$/.test(year)) throw new Error('Năm hồ sơ lịch sử phải có dạng YYYY.');
  if (!['QC4', 'QC9'].includes(fieldCode)) throw new Error('Candidate lịch sử chỉ hỗ trợ QC4 hoặc QC9.');
  if (!businessCode) throw new Error('Candidate lịch sử không có business code hợp lệ.');
  const dossierCode = `${fieldCode}-${year}-${businessCode}`;
  return {
    fieldCode: fieldCode as 'QC4' | 'QC9',
    businessCode,
    dossierCode,
    proposalCode: `DN-${dossierCode}`,
    folderName: candidate.folderName,
    sourceRelativePath: candidate.sourceRelativePath,
  };
}

export function normalizePcnHistoricalBatchId(value: unknown): string {
  const batchId = clean(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/.test(batchId)) {
    throw new Error('batchId phải là chuỗi ổn định 3-120 ký tự, chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  }
  return batchId;
}

// --- End of pcnHistoricalSelection.ts ---
