import { createHash, randomUUID } from 'crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import { PcnSignerDelegation, PcnUserAccount } from '@/types';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { getPcnSignerAuthorization } from '@/utils/pcnSignerAuthorization';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';

export const PCN_CERTIFICATION_FIELD_CODES = ['QC4', 'QC9'] as const;

export function stablePcnMutationId(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex')}`;
}

export function isSafePcnSampleKey(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[a-zA-Z0-9._-]+$/.test(value);
}

export function validatePcnSignerDelegationInput(input: Record<string, any>): {
  data?: Omit<PcnSignerDelegation, 'id' | 'createdAt' | 'updatedAt'>;
  error?: string;
} {
  const grantorUsername = String(input.grantorUsername || '').trim().toLowerCase();
  const delegateUsername = String(input.delegateUsername || '').trim().toLowerCase();
  const approvedByUsername = String(input.approvedByUsername || '').trim().toLowerCase();
  const fieldCodes = Array.isArray(input.fieldCodes)
    ? [...new Set(input.fieldCodes.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean))]
    : [];
  const effectiveFrom = String(input.effectiveFrom || '').trim();
  const effectiveUntil = String(input.effectiveUntil || '').trim();
  const reason = String(input.reason || '').trim();

  if (!grantorUsername || !delegateUsername || !approvedByUsername) {
    return { error: 'Ủy quyền phải có người ủy quyền, người được ủy quyền và người phê duyệt.' };
  }
  if (grantorUsername === delegateUsername) {
    return { error: 'Người ủy quyền và người được ủy quyền không được trùng nhau.' };
  }
  if (
    fieldCodes.length === 0 ||
    fieldCodes.some((code) => !PCN_CERTIFICATION_FIELD_CODES.includes(code as any))
  ) {
    return { error: 'Ủy quyền phải chỉ rõ ít nhất một Lĩnh vực QC4 hoặc QC9.' };
  }

  const from = Date.parse(effectiveFrom);
  const until = Date.parse(effectiveUntil);
  if (Number.isNaN(from) || Number.isNaN(until) || until <= from) {
    return { error: 'Khoảng thời gian hiệu lực của ủy quyền không hợp lệ.' };
  }
  if (!reason) {
    return { error: 'Ủy quyền phải có lý do.' };
  }

  return {
    data: {
      grantorUsername,
      delegateUsername,
      approvedByUsername,
      fieldCodes: fieldCodes as any,
      effectiveFrom,
      effectiveUntil,
      reason,
      status: 'ACTIVE',
    },
  };
}
