export const DOSSIER_WORKSPACE_TABS = [
  { id: 'information', label: 'Thông tin' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'work', label: 'Công việc' },
  { id: 'history', label: 'Lịch sử' },
] as const;

export type DossierWorkspaceTab = typeof DOSSIER_WORKSPACE_TABS[number]['id'];

/** Legacy notification and drafting links retain their existing domain destinations. */
export function getWorkspaceTabForPcnDetail(area?: string): DossierWorkspaceTab {
  if (area === 'overview' || area === 'proposal') return 'information';
  if (area === 'documents' || area === 'attachments' || area === 'generation') return 'documents';
  if (area === 'history') return 'history';
  return 'work';
}

export function getWorkspaceTabForKey(active: DossierWorkspaceTab, key: string): DossierWorkspaceTab | undefined {
  const index = DOSSIER_WORKSPACE_TABS.findIndex((tab) => tab.id === active);
  if (key === 'Home') return DOSSIER_WORKSPACE_TABS[0].id;
  if (key === 'End') return DOSSIER_WORKSPACE_TABS[DOSSIER_WORKSPACE_TABS.length - 1].id;
  if (key === 'ArrowRight') return DOSSIER_WORKSPACE_TABS[(index + 1) % DOSSIER_WORKSPACE_TABS.length].id;
  if (key === 'ArrowLeft') return DOSSIER_WORKSPACE_TABS[(index + DOSSIER_WORKSPACE_TABS.length - 1) % DOSSIER_WORKSPACE_TABS.length].id;
  return undefined;
}
