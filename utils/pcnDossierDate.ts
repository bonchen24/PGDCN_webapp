// Author: Codex
// OS support: Web/Node
// Description: Browser-safe validation for confirmed PCN dossier calendar dates

/**
 * PCN milestone inputs are calendar dates rather than timestamps. Keeping the
 * format strict prevents JavaScript Date.parse from silently normalizing an
 * impossible date such as 2026-02-30.
 */
export function getPcnDossierDateDenial(label: string, value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${label} phải có định dạng YYYY-MM-DD.`;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return `${label} không phải là ngày lịch hợp lệ.`;
  }
  return null;
}

/**
 * Validate event timestamps that are persisted with a PCN handover.
 * A timezone is mandatory so a browser cannot silently reinterpret a local
 * time differently from the server or another workstation.
 */
export function getPcnTimestampDenial(label: string, value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(normalized);
  if (!match) return `${label} phải là timestamp ISO-8601 UTC hợp lệ.`;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number((match[7] || '').padEnd(3, '0') || 0);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
    || date.getUTCSeconds() !== second
    || date.getUTCMilliseconds() !== milliseconds
  ) {
    return `${label} không phải là timestamp lịch hợp lệ.`;
  }
  return null;
}

/**
 * Normalize PCN event dates at the mutation boundary. The UI may submit a
 * calendar date, while persisted issuance/delivery metadata always uses an
 * explicit UTC timestamp.
 */
export function normalizePcnUtcTimestamp(label: string, value: unknown): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const denial = getPcnDossierDateDenial(label, normalized);
    if (denial) throw new Error(denial);
    return `${normalized}T00:00:00.000Z`;
  }
  const denial = getPcnTimestampDenial(label, normalized);
  if (denial) throw new Error(denial);
  return new Date(normalized).toISOString();
}

export function normalizePcnIssuanceTimestamp(value: unknown): string {
  return normalizePcnUtcTimestamp('Ngày cấp', value);
}

// --- End of pcnDossierDate.ts ---
