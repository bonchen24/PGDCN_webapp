import type { DepartmentScope } from '../types.ts';

export interface PgdcnNavigationItem {
  id: string;
  label: string;
  kind: 'shared' | 'domain';
  domain?: DepartmentScope;
}

const sharedItems: PgdcnNavigationItem[] = [
  { id: 'department-dashboard', label: 'Tổng quan phòng', kind: 'shared' },
  { id: 'customers', label: 'Khách hàng', kind: 'shared' },
  { id: 'assistant', label: 'Trợ lý AI', kind: 'shared' },
  { id: 'activity-logs', label: 'Nhật ký hoạt động', kind: 'shared' },
  { id: 'system-settings', label: 'Cài đặt hệ thống', kind: 'shared' },
];

export function getPgdcnVisibleNavigation(scopes: readonly DepartmentScope[]): PgdcnNavigationItem[] {
  const items = [...sharedItems];
  if (scopes.includes('PCN')) items.push({ id: 'pcn', label: 'CHỨNG NHẬN (PCN)', kind: 'domain', domain: 'PCN' });
  if (scopes.includes('PGD')) items.push({ id: 'pgd', label: 'GIÁM ĐỊNH (PGD)', kind: 'domain', domain: 'PGD' });
  return items;
}
