import type { DepartmentScope, PcnUserAccount } from '../types.ts';
import type { PgdcnNavigationTarget, PgdcnSharedSection } from '../components/PgdcnSidebar';
import type { PgdSection } from '../components/PgdSidebar';
import type { PcnSection } from './pcnNavigation';
import { canViewSystemSettings } from './systemSettingsPolicy.ts';
import { isPcnSystemManager } from './pcnRbac.ts';

export interface PgdcnNavigationItem {
  id: string;
  label: string;
  kind: 'shared' | 'domain';
  domain?: 'department' | 'PCN' | 'PGD';
  section?: string;
}

export const SHARED_NAVIGATION_ITEMS: readonly PgdcnNavigationItem[] = [
  { id: 'department-dashboard', label: 'Tổng quan', kind: 'shared', domain: 'department', section: 'department-dashboard' },
  { id: 'customers', label: 'Khách hàng', kind: 'shared', domain: 'department', section: 'customers' },
  { id: 'assistant', label: 'Trợ lý AI', kind: 'shared', domain: 'department', section: 'assistant' },
  { id: 'activityLogs', label: 'Nhật ký hệ thống', kind: 'shared', domain: 'department', section: 'activityLogs' },
  { id: 'document-drafting', label: 'Soạn thảo văn bản', kind: 'shared', domain: 'department', section: 'document-drafting' },
];

export const PCN_NAVIGATION_ITEMS: readonly PgdcnNavigationItem[] = [
  { id: 'pcn-proposals', label: 'Chứng nhận', kind: 'domain', domain: 'PCN', section: 'proposals' },
  { id: 'pcn-operations', label: 'Sổ dữ liệu PCN', kind: 'domain', domain: 'PCN', section: 'operations' },
  { id: 'pcn-lab-operations', label: 'Sổ quản lý mẫu PCN', kind: 'domain', domain: 'PCN', section: 'lab-operations' },
];

export const PGD_NAVIGATION_ITEMS: readonly PgdcnNavigationItem[] = [
  { id: 'pgd-requests', label: 'Giám định', kind: 'domain', domain: 'PGD', section: 'requests' },
  { id: 'pgd-operations', label: 'Sổ dữ liệu PGD', kind: 'domain', domain: 'PGD', section: 'operations' },
  { id: 'pgd-sample-operations', label: 'Sổ quản lý mẫu PGD', kind: 'domain', domain: 'PGD', section: 'sample-operations' },
];

const DEPARTMENT_ROUTE_SECTIONS = new Set<PgdcnSharedSection>([
  'department-dashboard', 'my-work', 'customers', 'assistant', 'activityLogs',
  'system-settings', 'dossier-templates', 'document-drafting',
]);
const PCN_ROUTE_SECTIONS = new Set<PcnSection>(['proposals', 'operations', 'lab-operations', 'drafting']);
const PGD_ROUTE_SECTIONS = new Set<PgdSection>(['requests', 'operations', 'sample-operations', 'templates']);

export function getPgdcnNavigationTargetForLocation(pathname: string, search = ''): PgdcnNavigationTarget | undefined {
  if (pathname === '/pgdcn/drafting') return { domain: 'department', section: 'document-drafting' };

  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const section = query.get('section') || '';

  if (pathname === '/pgdcn/pcn') {
    return { domain: 'PCN', section: PCN_ROUTE_SECTIONS.has(section as PcnSection) ? section as PcnSection : 'proposals' };
  }
  if (pathname === '/pgdcn/pgd') {
    return { domain: 'PGD', section: PGD_ROUTE_SECTIONS.has(section as PgdSection) ? section as PgdSection : 'requests' };
  }
  if (pathname === '/pgdcn') {
    return { domain: 'department', section: DEPARTMENT_ROUTE_SECTIONS.has(section as PgdcnSharedSection) ? section as PgdcnSharedSection : 'department-dashboard' };
  }
  return undefined;
}

export function canManagePgdcnDossierTemplates(user: PcnUserAccount | null | undefined, scopes: readonly DepartmentScope[]): boolean {
  if (!user) return false;
  const hasScope = scopes.some((scope) => scope === 'PCN' || scope === 'PGD');
  if (!hasScope) return false;
  return isPcnSystemManager(user) || ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(user.pgdRole || '').toUpperCase());
}

export function getPgdcnVisibleNavigation(
  scopes: readonly DepartmentScope[],
  user?: PcnUserAccount | null,
): PgdcnNavigationItem[] {
  const items: PgdcnNavigationItem[] = [...SHARED_NAVIGATION_ITEMS];

  if (scopes.includes('PCN')) {
    items.push(...PCN_NAVIGATION_ITEMS);
  }

  if (scopes.includes('PGD')) {
    items.push(...PGD_NAVIGATION_ITEMS);
  }

  if (user) {
    if (canManagePgdcnDossierTemplates(user, scopes)) {
      items.push({ id: 'dossier-templates', label: 'Hồ sơ mẫu', kind: 'shared', domain: 'department', section: 'dossier-templates' });
    }
    if (canViewSystemSettings(user)) {
      items.push({ id: 'system-settings', label: 'Cài đặt hệ thống', kind: 'shared', domain: 'department', section: 'system-settings' });
    }
  }

  return items;
}

export function getActiveContextLabel(target: { domain: string; section?: string }): string {
  if (target.domain === 'department') {
    if (target.section === 'department-dashboard' || target.section === 'my-work') return 'Tổng quan';
    if (target.section === 'customers') return 'Khách hàng';
    if (target.section === 'assistant') return 'Trợ lý AI';
    if (target.section === 'activityLogs') return 'Nhật ký hệ thống';
    if (target.section === 'dossier-templates') return 'Hồ sơ mẫu';
    if (target.section === 'document-drafting') return 'Soạn thảo văn bản';
    if (target.section === 'system-settings') return 'Cài đặt hệ thống';
    return 'Tổng quan';
  }
  if (target.domain === 'PCN') {
    if (target.section === 'proposals') return 'Chứng nhận';
    if (target.section === 'operations') return 'Sổ dữ liệu PCN';
    if (target.section === 'lab-operations') return 'Sổ quản lý mẫu PCN';
    return 'Soạn thảo tài liệu';
  }
  if (target.domain === 'PGD') {
    if (target.section === 'requests') return 'Giám định';
    if (target.section === 'operations') return 'Sổ dữ liệu PGD';
    if (target.section === 'sample-operations') return 'Sổ quản lý mẫu PGD';
    return 'Soạn thảo tài liệu';
  }
  return 'Tổng quan';
}
