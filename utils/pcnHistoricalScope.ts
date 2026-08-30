// Author: Codex
// OS support: Web/Node
// Description: Browser-safe presentation helper for source-only historical test-scope hints

export type PcnHistoricalScopeKind = 'FULL_TEST_SCOPE' | 'REDUCED_TEST_SCOPE' | 'SOURCE_VARIANT' | 'UNKNOWN';

export interface PcnHistoricalScopeNotice {
  kind: PcnHistoricalScopeKind;
  label: string;
  message: string;
  sourceHint?: string;
}

export interface PcnHistoricalScopeInput {
  variantHint?: string;
  sourceFamily?: 'QC4' | 'QC9';
  sourceFolderName?: string;
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function extractSourceHint(input: PcnHistoricalScopeInput): string {
  const explicit = clean(input.variantHint);
  if (explicit) return explicit;

  const folderName = clean(input.sourceFolderName);
  if (!folderName) return '';
  const markerPattern = input.sourceFamily === 'QC9'
    ? /(?:^|\s)(TF\s*ok|PF(?:\s*NEW)?(?:\s*CHƯA\s*IN)?|ko\s*dat|chưa\s*in|thiếu\s*ảnh)\s*$/i
    : /(?:^|[\s-])(Full|giảm)\s*$/i;
  return clean(folderName.match(markerPattern)?.[1]);
}

/**
 * Turns a marker observed in a historical source folder into a clearly
 * qualified UI notice. It never reports procedural completeness.
 */
export function getPcnHistoricalScopeNotice(input: PcnHistoricalScopeInput = {}): PcnHistoricalScopeNotice {
  const sourceHint = extractSourceHint(input);
  const normalized = normalize(sourceHint);

  if (/\bfull\b/.test(normalized)) {
    return {
      kind: 'FULL_TEST_SCOPE',
      label: 'Full chỉ tiêu',
      message: `Chỉ dấu “${sourceHint}” từ nguồn biểu thị phạm vi thử nghiệm, không đồng nghĩa bộ hồ sơ đủ thủ tục.`,
      sourceHint,
    };
  }

  if (/\bgiam\b/.test(normalized)) {
    return {
      kind: 'REDUCED_TEST_SCOPE',
      label: 'Giảm chỉ tiêu',
      message: `Chỉ dấu “${sourceHint}” từ nguồn biểu thị phạm vi thử nghiệm, không đồng nghĩa bộ hồ sơ đủ thủ tục.`,
      sourceHint,
    };
  }

  if (sourceHint) {
    return {
      kind: 'SOURCE_VARIANT',
      label: `Nguồn ghi: ${sourceHint}`,
      message: `Chỉ dấu “${sourceHint}” chỉ là thông tin từ nguồn; chưa kết luận bộ hồ sơ đủ thủ tục.`,
      sourceHint,
    };
  }

  return {
    kind: 'UNKNOWN',
    label: 'Chưa xác định phạm vi',
    message: 'Chưa có chỉ dấu phạm vi thử nghiệm từ nguồn; cần rà soát hồ sơ thủ tục riêng.',
  };
}

// --- End of pcnHistoricalScope.ts ---
