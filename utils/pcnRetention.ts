import type { PcnRetentionMetadata, PcnRetentionState } from '../types.ts';

export const PCN_RETENTION_POLICY_VERSION = 'PCN-REFERENCE-2026-08';
export const PCN_PAPER_RETENTION_YEARS = 1;
export const PCN_DIGITAL_RETENTION_YEARS = 10;

function addCalendarYears(value: string, years: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Ngày bắt đầu lưu trữ PCN không hợp lệ.');
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}

export function buildPcnRetentionMetadata(archivedAt: string): PcnRetentionMetadata {
  const retentionStartAt = new Date(archivedAt);
  if (!Number.isFinite(retentionStartAt.getTime())) throw new Error('Ngày bắt đầu lưu trữ PCN không hợp lệ.');
  const start = retentionStartAt.toISOString();
  return {
    policyVersion: PCN_RETENTION_POLICY_VERSION,
    retentionStartAt: start,
    paperRetentionUntil: addCalendarYears(start, PCN_PAPER_RETENTION_YEARS),
    digitalRetentionUntil: addCalendarYears(start, PCN_DIGITAL_RETENTION_YEARS),
    legalHold: false,
  };
}

export function getPcnRetentionState(
  retention: PcnRetentionMetadata,
  asOf: string = new Date().toISOString(),
): PcnRetentionState {
  if (retention.legalHold) return 'LEGAL_HOLD';
  const timestamp = Date.parse(asOf);
  if (!Number.isFinite(timestamp)) throw new Error('Thời điểm kiểm tra lưu trữ PCN không hợp lệ.');
  if (timestamp >= Date.parse(retention.digitalRetentionUntil)) return 'DIGITAL_REVIEW_DUE';
  if (timestamp >= Date.parse(retention.paperRetentionUntil)) return 'PAPER_REVIEW_DUE';
  return 'ACTIVE';
}

export function updatePcnLegalHold(
  retention: PcnRetentionMetadata,
  input: { legalHold: boolean; reason?: string; actorUsername?: string; at?: string },
): PcnRetentionMetadata {
  if (!input.legalHold) {
    if (!retention.legalHold && !retention.legalHoldReason && !retention.legalHoldBy && !retention.legalHoldAt) return retention;
    const { legalHoldReason: _reason, legalHoldBy: _actor, legalHoldAt: _at, ...released } = retention;
    return { ...released, legalHold: false };
  }
  const reason = String(input.reason || '').trim();
  if (!reason) throw new Error('Đặt giữ pháp lý phải có lý do.');
  if (retention.legalHold && retention.legalHoldReason === reason) return retention;
  const at = input.at || new Date().toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error('Thời điểm giữ pháp lý không hợp lệ.');
  return {
    ...retention,
    legalHold: true,
    legalHoldReason: reason,
    ...(input.actorUsername ? { legalHoldBy: input.actorUsername } : {}),
    legalHoldAt: at,
  };
}

// --- End of pcnRetention.ts ---
