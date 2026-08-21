// Author: Gemini
// OS support: Web/Node
// Description: Shared report date formatting and nameplate OCR normalization helpers

export const REPORT_MISSING_VALUE = 'N/A';

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface ReportDateParts {
  year: number;
  month: number;
  day: number;
}

const isValidDateParts = ({ year, month, day }: ReportDateParts): boolean => {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const parseReportDate = (value: unknown): ReportDateParts | null => {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    return isValidDateParts(parts) ? parts : null;
  }

  match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (match) {
    const parts = { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
    return isValidDateParts(parts) ? parts : null;
  }

  return null;
};

export const formatReportEnglishDate = (value: unknown): string => {
  const parts = parseReportDate(value);
  if (!parts) return '';
  return `${ENGLISH_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
};

export const formatBilingualReportDate = (value: unknown): string => {
  const parts = parseReportDate(value);
  if (!parts) return '';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const englishDate = formatReportEnglishDate(value);
  return `Hà Nội, ngày ${day} tháng ${month} năm ${parts.year} (Hanoi, ${englishDate})`;
};

export interface NameplateOcrValuesInput {
  manufacturer?: unknown;
  countryOfOrigin?: unknown;
  origin?: unknown;
  power?: unknown;
  voltage?: unknown;
  current?: unknown;
  frequency?: unknown;
  clockFreq?: unknown;
}

export interface NormalizedNameplateOcrValues {
  manufacturer: string;
  countryOfOrigin: string;
  power: string;
  voltage: string;
  current: string;
  frequency: string;
  clockFreq: string;
}

const normalizeReportValue = (value: unknown): string => {
  if (value === null || value === undefined) return REPORT_MISSING_VALUE;
  const normalized = String(value).trim();
  return normalized || REPORT_MISSING_VALUE;
};

export const normalizeNameplateOcrValues = (
  input: NameplateOcrValuesInput = {},
): NormalizedNameplateOcrValues => ({
  manufacturer: normalizeReportValue(input.manufacturer),
  countryOfOrigin: normalizeReportValue(input.countryOfOrigin ?? input.origin),
  power: normalizeReportValue(input.power),
  voltage: normalizeReportValue(input.voltage),
  current: normalizeReportValue(input.current),
  frequency: normalizeReportValue(input.frequency),
  clockFreq: normalizeReportValue(input.clockFreq),
});

// --- End of lib/reportFormatting.ts ---
