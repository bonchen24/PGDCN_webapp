export interface PcnCustomerLike {
  id?: string;
  customerCode?: string;
  name?: string;
}

export function getPcnDocumentId(record: PcnCustomerLike): string {
  return String(record.customerCode || record.name || record.id || '').trim();
}

export function mergePcnCustomers<T extends PcnCustomerLike>(existing: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();
  for (const customer of [...existing, ...incoming]) {
    const key = getPcnDocumentId(customer).toLowerCase();
    if (!key) continue;
    merged.set(key, { ...(merged.get(key) || {}), ...customer } as T);
  }
  return [...merged.values()];
}
