export type PcnSection =
  | 'dashboard'
  | 'proposals'
  | 'operations'
  | 'lab-operations'
  | 'drafting'
  | 'assistant'
  | 'customers'
  | 'users'
  | 'activityLogs'
  | 'settings';

export type PcnNavigationGroupKey = 'records' | 'admin';

export type PcnNavigationGroup = {
  key: PcnNavigationGroupKey;
  label: string;
  items: PcnSection[];
};

/** Active PCN work surfaces. They are projections/workspaces, not extra lifecycle steps. */
export const PCN_WORKSPACE_NAVIGATION: readonly PcnSection[] = [
  'dashboard',
  'proposals',
  'operations',
  'lab-operations',
  'drafting',
  'assistant',
  'customers',
];

/**
 * Activity logs are available to every authenticated PCN account while
 * personnel management and settings remain Admin-only.
 */
export const PCN_MORE_NAVIGATION_GROUPS: readonly PcnNavigationGroup[] = [
  {
    key: 'admin',
    label: 'Quản trị',
    items: ['users', 'activityLogs', 'settings'],
  },
];

export const PCN_NAVIGATION_GROUPS: readonly PcnNavigationGroup[] = [
  {
    key: 'records',
    label: 'Lối vào chính',
    items: [...PCN_WORKSPACE_NAVIGATION],
  },
  {
    key: 'admin',
    label: 'Quản trị',
    items: [...PCN_MORE_NAVIGATION_GROUPS[0].items],
  },
];

export const PCN_PRIMARY_NAVIGATION: readonly PcnSection[] = [...PCN_WORKSPACE_NAVIGATION];

export const PCN_MOBILE_NAVIGATION: readonly PcnSection[] = ['dashboard', 'proposals', 'operations', 'drafting', 'customers'];

export function getPcnMoreNavigationGroups(isPcnAdmin: boolean): PcnNavigationGroup[] {
  return PCN_MORE_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isPcnAdmin || item === 'activityLogs'),
  })).filter((group) => group.items.length > 0);
}

export function getPcnNavigationGroups(isPcnAdmin: boolean): PcnNavigationGroup[] {
  return PCN_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.key === 'admin'
      ? group.items.filter((item) => isPcnAdmin || item === 'activityLogs')
      : [...group.items],
  })).filter((group) => group.items.length > 0);
}

export function getPcnNavigationGroupForSection(section: PcnSection, isPcnAdmin: boolean): PcnNavigationGroup | undefined {
  return getPcnNavigationGroups(isPcnAdmin).find((group) => group.items.includes(section));
}
