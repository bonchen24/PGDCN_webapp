import type { CustomerRef } from '../types.ts';
import { normalizeCustomerRecord } from './customerRecord.ts';
import { removeAccents } from './formatter.ts';
import { getPcnDocumentId } from './pcnStorePolicy.ts';

export const PCN_CUSTOMER_FIELDS = ['name', 'address', 'customerCode', 'taxId', 'phone', 'email', 'contactPerson'] as const;

export type PcnCustomerField = (typeof PCN_CUSTOMER_FIELDS)[number];

export interface PcnCustomerImportIssue {
  sourceIndex: number;
  reason: string;
}

export interface PcnCustomerImportInspection {
  sourceCount: number;
  validCount: number;
  acceptedCount: number;
  rejected: PcnCustomerImportIssue[];
  duplicateKeys: string[];
  acceptedCustomers: CustomerRef[];
}

export interface PcnCustomerReconciliationReport {
  sourceCount: number;
  targetCount: number;
  sourceUniqueKeyCount: number;
  targetUniqueKeyCount: number;
  sourceUnkeyedCount: number;
  targetUnkeyedCount: number;
  duplicateSourceKeys: string[];
  duplicateTargetKeys: string[];
  missingKeys: string[];
  extraKeys: string[];
  changedKeys: string[];
  changedFieldsByKey: Array<{ key: string; fields: PcnCustomerField[] }>;
  fieldDifferenceCounts: Record<PcnCustomerField, number>;
  possibleAliasMatches: Array<{
    sourceKey: string;
    targetKey: string;
    reason: 'SHORT_NAME_FOUND_IN_TARGET_NAME';
  }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_./-]+/g, '');
}

function valueFrom(record: Record<string, unknown>, field: PcnCustomerField): unknown {
  const aliases: Record<PcnCustomerField, string[]> = {
    name: ['name', 'tên khách hàng', 'tên công ty', 'khách hàng', 'tenkhachhang', 'tencongty', 'khachhang'],
    address: ['address', 'địa chỉ', 'diachi', 'địa chỉ khách hàng', 'diachikhachhang'],
    customerCode: ['customercode', 'mã khách hàng', 'ma khach hang', 'makhachhang', 'mã kh', 'makh'],
    taxId: ['taxid', 'mst', 'mã số thuế', 'masothue', 'tax code', 'taxcode'],
    phone: ['phone', 'số điện thoại', 'sodienthoai', 'điện thoại', 'dienthoai', 'tel'],
    email: ['email', 'e-mail', 'thư điện tử', 'thudientu'],
    contactPerson: ['contactperson', 'người liên hệ', 'nguoilienhe', 'contact', 'đầu mối liên hệ', 'daumoilienhe'],
  };
  const matchingEntry = Object.entries(record).find(([key]) => {
    const normalizedKey = normalizeHeader(key);
    return aliases[field].some((alias) => normalizeHeader(alias) === normalizedKey);
  });
  return matchingEntry?.[1];
}

function toCustomerRecord(value: unknown, now: string): CustomerRef | null {
  const record = asRecord(value);
  if (!record) return null;
  const mapped = Object.fromEntries(
    PCN_CUSTOMER_FIELDS.map((field) => [field, valueFrom(record, field)]),
  ) as Partial<CustomerRef>;
  const timestamps = {
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
  const customer = normalizeCustomerRecord({ ...mapped, ...timestamps }, undefined, now);
  return getPcnDocumentId(customer) ? customer : null;
}

export function parsePcnCustomerCsv(csv: string): Record<string, string>[] {
  const text = String(csv || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(field);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.some((item) => item.trim())) rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() || ''])));
}

export function inspectPcnCustomerImport(
  incoming: unknown[],
  now = new Date().toISOString(),
): PcnCustomerImportInspection {
  const rejected: PcnCustomerImportIssue[] = [];
  const candidates: CustomerRef[] = [];
  for (const [offset, item] of (incoming || []).entries()) {
    const customer = toCustomerRecord(item, now);
    if (!customer) {
      rejected.push({ sourceIndex: offset + 1, reason: 'Thiếu mã khách hàng hoặc tên khách hàng hợp lệ' });
      continue;
    }
    candidates.push(customer);
  }
  const counts = new Map<string, number>();
  for (const customer of candidates) {
    const key = getPcnDocumentId(customer).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicateKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
  const acceptedByKey = new Map<string, CustomerRef>();
  for (const customer of candidates) {
    const key = getPcnDocumentId(customer).toLowerCase();
    if (!acceptedByKey.has(key)) acceptedByKey.set(key, customer);
  }
  return {
    sourceCount: (incoming || []).length,
    validCount: candidates.length,
    acceptedCount: acceptedByKey.size,
    rejected,
    duplicateKeys,
    acceptedCustomers: [...acceptedByKey.values()],
  };
}

export function normalizePcnCustomerImport(value: unknown, now = new Date().toISOString()): CustomerRef | null {
  return toCustomerRecord(value, now);
}

function customerFieldValue(customer: CustomerRef, field: PcnCustomerField): string {
  const value = String(customer[field] || '').trim();
  return field === 'customerCode' ? value.toLowerCase() : value;
}

function normalizeAliasText(value: unknown): string {
  return removeAccents(String(value || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isLikelyShortAlias(customer: CustomerRef): boolean {
  if (String(customer.customerCode || '').trim()) return false;
  const name = String(customer.name || '').trim();
  return /^[A-Z0-9][A-Z0-9._/-]{1,11}$/.test(name) && normalizeAliasText(name).split(' ').length === 1;
}

function indexCustomers(customers: CustomerRef[]): {
  byKey: Map<string, CustomerRef>;
  duplicateKeys: string[];
  unkeyedCount: number;
} {
  const byKey = new Map<string, CustomerRef>();
  const counts = new Map<string, number>();
  let unkeyedCount = 0;
  for (const customer of customers) {
    const key = getPcnDocumentId(customer).toLowerCase();
    if (!key) {
      unkeyedCount += 1;
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!byKey.has(key)) byKey.set(key, customer);
  }
  return {
    byKey,
    duplicateKeys: [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key).sort(),
    unkeyedCount,
  };
}

export function buildPcnCustomerReconciliation(
  source: CustomerRef[] = [],
  target: CustomerRef[] = [],
): PcnCustomerReconciliationReport {
  const sourceIndex = indexCustomers(source);
  const targetIndex = indexCustomers(target);
  const sourceKeys = new Set(sourceIndex.byKey.keys());
  const targetKeys = new Set(targetIndex.byKey.keys());
  const missingKeys = [...sourceKeys].filter((key) => !targetKeys.has(key)).sort();
  const extraKeys = [...targetKeys].filter((key) => !sourceKeys.has(key)).sort();
  const possibleAliasMatches = missingKeys.flatMap((sourceKey) => {
    const sourceCustomer = sourceIndex.byKey.get(sourceKey);
    if (!sourceCustomer || !isLikelyShortAlias(sourceCustomer)) return [];
    const aliasToken = normalizeAliasText(sourceCustomer.name);
    if (!aliasToken) return [];
    const matches = [...targetIndex.byKey.entries()].filter(([, targetCustomer]) => {
      const targetTokens = new Set(normalizeAliasText(targetCustomer.name).split(' ').filter(Boolean));
      return targetTokens.has(aliasToken);
    });
    if (matches.length !== 1) return [];
    return [{
      sourceKey,
      targetKey: matches[0][0],
      reason: 'SHORT_NAME_FOUND_IN_TARGET_NAME' as const,
    }];
  });
  const changedFieldsByKey: Array<{ key: string; fields: PcnCustomerField[] }> = [];
  const fieldDifferenceCounts = Object.fromEntries(
    PCN_CUSTOMER_FIELDS.map((field) => [field, 0]),
  ) as Record<PcnCustomerField, number>;

  for (const key of [...sourceKeys].filter((item) => targetKeys.has(item)).sort()) {
    const sourceCustomer = sourceIndex.byKey.get(key)!;
    const targetCustomer = targetIndex.byKey.get(key)!;
    const fields = PCN_CUSTOMER_FIELDS.filter((field) => (
      customerFieldValue(sourceCustomer, field) !== customerFieldValue(targetCustomer, field)
    ));
    if (fields.length === 0) continue;
    changedFieldsByKey.push({ key, fields });
    for (const field of fields) fieldDifferenceCounts[field] += 1;
  }

  return {
    sourceCount: source.length,
    targetCount: target.length,
    sourceUniqueKeyCount: sourceIndex.byKey.size,
    targetUniqueKeyCount: targetIndex.byKey.size,
    sourceUnkeyedCount: sourceIndex.unkeyedCount,
    targetUnkeyedCount: targetIndex.unkeyedCount,
    duplicateSourceKeys: sourceIndex.duplicateKeys,
    duplicateTargetKeys: targetIndex.duplicateKeys,
    missingKeys,
    extraKeys,
    changedKeys: changedFieldsByKey.map(({ key }) => key),
    changedFieldsByKey,
    fieldDifferenceCounts,
    possibleAliasMatches,
  };
}

// --- End of pcnCustomerReconciliation.ts ---
