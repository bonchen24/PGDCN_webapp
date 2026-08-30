export type PcnSection =
  | 'dashboard'
  | 'dataIntegrity'
  | 'cutover'
  | 'operationsRegister'
  | 'historicalDiscovery'
  | 'agent'
  | 'proposals'
  | 'fields'
  | 'samples'
  | 'customers'
  | 'labRequests'
  | 'results'
  | 'issuance'
  | 'templates'
  | 'qualityDocuments'
  | 'haimy'
  | 'backup'
  | 'archive'
  | 'activityLogs'
  | 'users';

export type PcnNavigationGroupKey = 'records' | 'execution' | 'catalogs' | 'oversight';

export type PcnNavigationGroup = {
  key: PcnNavigationGroupKey;
  label: string;
  items: PcnSection[];
};

/**
 * Workspaces operators visit most often. These stay visible as one flat list
 * in the sidebar so a user never has to open a nested group to start work.
 */
export const PCN_WORKSPACE_NAVIGATION: readonly PcnSection[] = [
  'dashboard',
  'proposals',
  'fields',
  'samples',
  'labRequests',
  'results',
  'issuance',
  'archive',
  'agent',
];

/**
 * Low-frequency catalog and oversight screens. The sidebar renders these in
 * one compact "Thêm" panel without nested expandable branches.
 */
export const PCN_MORE_NAVIGATION_GROUPS: readonly PcnNavigationGroup[] = [
  {
    key: 'catalogs',
    label: 'Danh mục',
    items: ['customers', 'templates', 'qualityDocuments'],
  },
  {
    key: 'oversight',
    label: 'Theo dõi & quản trị',
    items: ['operationsRegister', 'historicalDiscovery', 'dataIntegrity', 'cutover', 'haimy', 'backup', 'activityLogs', 'users'],
  },
];

export const PCN_NAVIGATION_GROUPS: readonly PcnNavigationGroup[] = [
  {
    key: 'records',
    label: 'Hồ sơ',
    items: ['proposals', 'fields', 'archive'],
  },
  {
    key: 'execution',
    label: 'Thực hiện',
    items: ['samples', 'labRequests', 'results', 'issuance'],
  },
  {
    key: 'catalogs',
    label: 'Danh mục',
    items: [...PCN_MORE_NAVIGATION_GROUPS[0].items],
  },
  {
    key: 'oversight',
    label: 'Theo dõi & quản trị',
    items: [...PCN_MORE_NAVIGATION_GROUPS[1].items],
  },
];

export const PCN_PRIMARY_NAVIGATION: readonly PcnSection[] = ['dashboard', 'agent'];

export const PCN_MOBILE_NAVIGATION: readonly PcnSection[] = ['dashboard', 'proposals', 'agent', 'issuance'];

export function getPcnMoreNavigationGroups(isPcnAdmin: boolean): PcnNavigationGroup[] {
  return PCN_MORE_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((section) => isPcnAdmin || !['cutover', 'backup'].includes(section)),
  })).filter((group) => group.items.length > 0);
}

export function getPcnNavigationGroups(isPcnAdmin: boolean): PcnNavigationGroup[] {
  return PCN_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((section) => isPcnAdmin || !['cutover', 'backup'].includes(section)),
  })).filter((group) => group.items.length > 0);
}

export function getPcnNavigationGroupForSection(section: PcnSection, isPcnAdmin: boolean): PcnNavigationGroup | undefined {
  return getPcnNavigationGroups(isPcnAdmin).find((group) => group.items.includes(section));
}
