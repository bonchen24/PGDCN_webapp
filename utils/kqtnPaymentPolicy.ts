// Author: Codex
// Description: Shared KQTN payment-unlock policy for UI and state mutations.

import type { KQTNRecord, UserAccount } from '../types';
import { isSystemSettingsManager } from './systemSettingsPolicy';

type UserRoleLike = Pick<UserAccount, 'role' | 'position'> | null | undefined;
export type KqtnPaymentState = Pick<KQTNRecord, 'customerPaymentConfirmed' | 'customerPaymentConfirmedAt' | 'customerPaymentConfirmedBy'>;

export const isKqtnPaymentManager = (user: UserRoleLike): boolean =>
  user?.role === 'admin' || user?.role === 'office_clerk' || isSystemSettingsManager(user);

export const canDownloadKqtnPdf = (
  record: Pick<KQTNRecord, 'customerPaymentConfirmed'>,
  user: UserRoleLike,
): boolean => Boolean(user) && (user?.role === 'admin' || Boolean(record.customerPaymentConfirmed));

const normalizePaymentValue = (value: unknown): string | boolean | null =>
  value === undefined || value === null ? null : typeof value === 'boolean' ? value : String(value);

export const isKqtnPaymentStateChanged = (
  current: KqtnPaymentState | null | undefined,
  next: Partial<KqtnPaymentState>,
): boolean => {
  const fields: Array<keyof KqtnPaymentState> = [
    'customerPaymentConfirmed',
    'customerPaymentConfirmedAt',
    'customerPaymentConfirmedBy',
  ];
  return fields.some(field => {
    if (!Object.prototype.hasOwnProperty.call(next, field)) return false;
    return field === 'customerPaymentConfirmed'
      ? (current?.customerPaymentConfirmed === true) !== (next.customerPaymentConfirmed === true)
      : normalizePaymentValue(current?.[field]) !== normalizePaymentValue(next[field]);
  });
};

// --- End of kqtnPaymentPolicy.ts ---
