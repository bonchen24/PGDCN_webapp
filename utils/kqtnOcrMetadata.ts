// Author: Codex
// OS support: Web/Node
// Description: Deterministic parsing helpers for shared PaddleOCR KQTN text.

export interface KqtnOcrMetadata {
  sampleCode: string;
  model: string;
  brand: string;
}

export interface KqtnFooterPageNumber {
  currentPage: number;
  totalPages: number;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function removeDynamicFooterParts(value: string): string {
  const withoutDate = value
    .replace(/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g, '')
    .replace(/\b\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}\b/g, '');
  return cleanLine(withoutDate
    .replace(/\b(?:trang|page|p\.)\s*[:#]?\s*\d+(?:\s*[/\-]\s*\d+)?\b/gi, '')
    .replace(/(?:^|[\s|])\d+\s*\/\s*\d+\s*$/g, '')
    .replace(/\s*\/\s*\d+\s*$/g, ''));
}

function footerCandidateScore(value: string): number {
  const normalized = stripDiacritics(value).toUpperCase();
  let score = Math.min(normalized.length, 40) / 100;
  if (/\d/.test(normalized)) score += 2;
  if (/[A-Z]{2,}[-_/]\w+/i.test(normalized)) score += 3;
  if (/\b(?:ITD|EMC|KQTN|TCVN)\b/i.test(normalized)) score += 4;
  if (/\b(?:ITD|EMC|KQTN)\b/i.test(normalized)) score += 8;
  return score;
}

export function extractKqtnFooterKey(text: string): string {
  const candidates = text
    .split(/\r?\n/)
    .map(cleanLine)
    .map(removeDynamicFooterParts)
    .filter((line) => line.length >= 3)
    .filter((line) => /[A-Za-zÀ-ỹ]/.test(line))
    .filter((line) => /\d/.test(line));

  const best = [...new Set(candidates)]
    .sort((left, right) => footerCandidateScore(right) - footerCandidateScore(left))[0];
  return best ? stripDiacritics(best).toUpperCase() : '';
}

export function extractKqtnFooterPageNumber(text: string): KqtnFooterPageNumber | undefined {
  const normalized = stripDiacritics(String(text || '')).toUpperCase();
  const matches = [...normalized.matchAll(/(?<![\d/.-])(?:\b(?:TRANG|PAGE|P)\s*)?(\d{1,3})\s*\/\s*(\d{1,3})(?!\s*[/.-]\s*\d)/g)]
    .map((match) => ({ currentPage: Number(match[1]), totalPages: Number(match[2]) }))
    .filter(({ currentPage, totalPages }) => currentPage >= 1 && totalPages >= currentPage && totalPages >= 2 && totalPages <= 500);
  return matches.at(-1);
}

export function extractKqtnReportKey(text: string): string {
  const normalized = stripDiacritics(String(text || ''))
    .toUpperCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const detailed = normalized.match(/\b(ITD|EMC|KQTN)\s*[-:]?\s*(\d{2,6})\s*[- ]\s*(\d{1,4})\s*[- ]\s*M\s*0?(\d{1,2})\b/);
  if (detailed) {
    return `${detailed[1]}-${detailed[2]}-${detailed[3]}-M${String(Number(detailed[4])).padStart(2, '0')}`;
  }
  const simple = normalized.match(/\b(ITD|EMC|KQTN)\s*[-:]\s*[A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+)*/);
  return simple
    ? simple[0].replace(/\s*[-_]\s*/g, '-').replace(/\s+/g, '')
    : '';
}

const FIELD_LABELS: Record<keyof KqtnOcrMetadata, string[]> = {
  sampleCode: [
    'so ma hoa',
    'ma mau',
    'ma hieu',
    'ma san pham',
    'ma sp',
    'ma shn phn',
    'ma sin phsm',
    'ms sin phsm',
    'ms sin phin',
    'ms shn phin',
    'encode no',
    'sample code',
    'samplecode',
    'product code',
  ],
  model: ['model', 'modtl', 'modcl', 'kieu loai', 'type'],
  brand: ['hang san xuat', 'nhan hieu', 'manufacturer', 'brand'],
};

function normalizeFieldLabel(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFieldValue(lines: string[], labels: string[]): string {
  const normalizedLabels = labels.map(normalizeFieldLabel);
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);
    const normalizedLine = normalizeFieldLabel(line);
    const matchedLabel = normalizedLabels.find((label) => normalizedLine.includes(label));
    if (!matchedLabel) continue;

    const inlineValue = line.match(/[:：|]\s*(.+)$/)?.[1]?.trim();
    if (inlineValue) return inlineValue;

    const nextLine = cleanLine(lines[index + 1] || '');
    if (nextLine && !/[:：]/.test(nextLine)) return nextLine;
  }
  return '';
}

export function parseKqtnOcrMetadata(text: string): KqtnOcrMetadata {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  return {
    sampleCode: findFieldValue(lines, FIELD_LABELS.sampleCode),
    model: findFieldValue(lines, FIELD_LABELS.model),
    brand: findFieldValue(lines, FIELD_LABELS.brand),
  };
}

// --- End of kqtnOcrMetadata.ts ---
