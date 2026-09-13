// Author: Codex
// OS support: Web/Node
// Description: Canonical PCN proposal and sample-lot identifiers

const PCN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export const PCN_PROPOSAL_CODE_PATTERN = /^PCN-(\d{6})-(\d{2})$/;
export const PCN_SAMPLE_LOT_CODE_PATTERN = /^CN (\d{4})-(\d{2})$/;

type PcnDateInput = Date | string | number;

interface PcnVietnamDateParts {
  year: string;
  month: string;
  day: string;
}

function toDate(value: PcnDateInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('PCN identifier date must be valid.');
  return date;
}

function getVietnamDateParts(value: PcnDateInput): PcnVietnamDateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PCN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(toDate(value));
  const result = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  if (typeof result.year !== 'string' || typeof result.month !== 'string' || typeof result.day !== 'string') {
    throw new Error('Không thể xác định ngày Việt Nam cho mã PCN.');
  }
  return { year: result.year, month: result.month, day: result.day };
}

export function getPcnVietnamDateKey(value: PcnDateInput): string {
  const parts = getVietnamDateParts(value);
  return `${parts.year.slice(-2)}${parts.month}${parts.day}`;
}

export function getPcnVietnamYearKey(value: PcnDateInput): string {
  return getVietnamDateParts(value).year;
}

function assertSerial(serial: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(serial) || serial < min || serial > max) {
    throw new Error(`${label} serial must be between ${String(min).padStart(2, '0')} and ${max}.`);
  }
}

export function formatPcnProposalCode(serial: number, date: PcnDateInput = new Date()): string {
  assertSerial(serial, 1, 99, 'PCN proposal');
  return `PCN-${getPcnVietnamDateKey(date)}-${String(serial).padStart(2, '0')}`;
}

/**
 * Build the dossier code after the server has allocated the proposal code.
 * Intake forms intentionally do not let the browser choose this identifier;
 * keeping the derivation here makes retries and UI projections deterministic.
 */
export function formatPcnDossierCode(proposalCode: string, date: PcnDateInput = new Date()): string {
  const normalizedProposalCode = String(proposalCode || '').trim();
  if (!normalizedProposalCode) throw new Error('PCN dossier code requires a proposal code.');
  const safeProposalCode = normalizedProposalCode
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-48);
  if (!safeProposalCode) throw new Error('PCN proposal code is not usable for a dossier code.');
  return `HS-${getPcnVietnamYearKey(date)}-${safeProposalCode}`;
}

export function formatPcnSampleLotCode(serial: number, date: PcnDateInput = new Date()): string {
  assertSerial(serial, 1, 9999, 'PCN sample-lot');
  return `CN ${String(serial).padStart(4, '0')}-${getPcnVietnamYearKey(date).slice(-2)}`;
}

function requiredTimestamp(values: unknown[], label: string): { value: string; milliseconds: number } {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined;
  const milliseconds = value ? Date.parse(value) : Number.NaN;
  if (!value || Number.isNaN(milliseconds)) throw new Error(`${label} phải có mốc thời gian hợp lệ để cấp lại mã PCN.`);
  return { value, milliseconds };
}

function compareMigrationRecords(
  left: { id: string; primaryDate?: string; fallbackDate?: string },
  right: { id: string; primaryDate?: string; fallbackDate?: string },
): number {
  const leftTimestamp = requiredTimestamp([left.primaryDate, left.fallbackDate], 'Bản ghi PCN').milliseconds;
  const rightTimestamp = requiredTimestamp([right.primaryDate, right.fallbackDate], 'Bản ghi PCN').milliseconds;
  return leftTimestamp - rightTimestamp || left.id.localeCompare(right.id);
}

export function resequencePcnProposalCodes<T extends { id: string; proposalCode: string; receivedAt?: string; createdAt?: string }>(records: readonly T[]): T[] {
  const counters = new Map<string, number>();
  return [...records]
    .map((record) => ({ record, timestamp: requiredTimestamp([record.receivedAt, record.createdAt], `Đề nghị ${record.id}`) }))
    .sort((left, right) => compareMigrationRecords(
      { id: left.record.id, primaryDate: left.timestamp.value },
      { id: right.record.id, primaryDate: right.timestamp.value },
    ))
    .map(({ record, timestamp }) => {
      const dateKey = getPcnVietnamDateKey(timestamp.value);
      const serial = (counters.get(dateKey) || 0) + 1;
      counters.set(dateKey, serial);
      return { ...record, proposalCode: formatPcnProposalCode(serial, timestamp.value) };
    });
}

export function resequencePcnSampleLotCodes<T extends { id: string; lotCode: string; createdAt?: string }>(records: readonly T[]): T[] {
  const counters = new Map<string, number>();
  return [...records]
    .map((record) => ({ record, timestamp: requiredTimestamp([record.createdAt], `Lô mẫu ${record.id}`) }))
    .sort((left, right) => compareMigrationRecords(
      { id: left.record.id, primaryDate: left.timestamp.value },
      { id: right.record.id, primaryDate: right.timestamp.value },
    ))
    .map(({ record, timestamp }) => {
      const yearKey = getPcnVietnamYearKey(timestamp.value);
      const serial = (counters.get(yearKey) || 0) + 1;
      counters.set(yearKey, serial);
      return { ...record, lotCode: formatPcnSampleLotCode(serial, timestamp.value) };
    });
}

// --- End of pcnIdentifier.ts ---
