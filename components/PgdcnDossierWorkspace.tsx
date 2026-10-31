'use client';

import { useId, useRef, type ReactNode } from 'react';
import { DOSSIER_WORKSPACE_TABS, getWorkspaceTabForKey, type DossierWorkspaceTab } from '../utils/pgdcnDossierWorkspace.ts';

export interface PgdcnDossierWorkspaceProps {
  domain: 'PCN' | 'PGD';
  dossierId: string;
  activeTab: DossierWorkspaceTab;
  onTabChange: (tab: DossierWorkspaceTab) => void;
  ownerLabel: string;
  nextActionLabel: string;
  onOpenNextAction?: () => void;
  panels: Record<DossierWorkspaceTab, ReactNode>;
}

export default function PgdcnDossierWorkspace(props: PgdcnDossierWorkspaceProps) {
  const instanceId = useId();
  const prefix = `${instanceId}-${props.domain}-${encodeURIComponent(props.dossierId)}`;
  const tabRefs = useRef<Partial<Record<DossierWorkspaceTab, HTMLButtonElement>>>({});
  return <div data-testid="pgdcn-dossier-workspace" data-domain={props.domain} data-dossier-id={props.dossierId} className="min-w-0 space-y-3">
    <div aria-label="Chủ hồ sơ và việc tiếp theo" className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center">
      <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Chủ hồ sơ</p><p className="mt-1 break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{props.ownerLabel}</p></div>
      <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Việc tiếp theo</p><p className="mt-1 break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{props.nextActionLabel}</p></div>
      {props.onOpenNextAction && <button type="button" onClick={props.onOpenNextAction} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Mở việc cần làm</button>}
    </div>
    <div role="tablist" aria-label={`Nội dung hồ sơ ${props.domain}`} className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-4">
      {DOSSIER_WORKSPACE_TABS.map((tab) => <button key={tab.id} ref={(element) => { tabRefs.current[tab.id] = element; }} id={`${prefix}-tab-${tab.id}`} type="button" role="tab" aria-selected={props.activeTab === tab.id} aria-controls={`${prefix}-panel-${tab.id}`} tabIndex={props.activeTab === tab.id ? 0 : -1} onClick={() => props.onTabChange(tab.id)} onKeyDown={(event) => {
        const nextTab = getWorkspaceTabForKey(tab.id, event.key);
        if (!nextTab) return;
        event.preventDefault();
        props.onTabChange(nextTab);
        tabRefs.current[nextTab]?.focus();
      }} className={`min-h-11 min-w-0 break-words rounded-lg px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${props.activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{tab.label}</button>)}
    </div>
    {DOSSIER_WORKSPACE_TABS.map((tab) => <section key={tab.id} id={`${prefix}-panel-${tab.id}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${tab.id}`} hidden={props.activeTab !== tab.id} tabIndex={0} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{props.panels[tab.id]}</section>)}
  </div>;
}
