import type { CustomerRef } from '../types.ts';
import { formatPhoneNumber, formatTaxId } from './formatter.ts';

export function normalizeCustomerRecord(
  input: Partial<CustomerRef>,
  previous?: CustomerRef,
  now: string = new Date().toISOString(),
): CustomerRef {
  const merged = { ...(previous || {}), ...input };
  return {
    ...merged,
    name: String(merged.name || '').trim(),
    address: String(merged.address || '').trim(),
    customerCode: String(merged.customerCode || '').trim(),
    taxId: merged.taxId ? formatTaxId(merged.taxId) : '',
    phone: merged.phone ? formatPhoneNumber(merged.phone) : '',
    email: String(merged.email || '').trim(),
    contactPerson: String(merged.contactPerson || '').trim(),
    createdAt: previous?.createdAt || merged.createdAt || now,
    updatedAt: now,
  };
}
