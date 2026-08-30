'use client';

import { useEffect, useState, type ElementType } from 'react';
import {
  Activity,
  Archive,
  Bot,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSearch,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import type { PcnCertificationField, UserAccount } from '../types';
import {
  getPcnMoreNavigationGroups,
  PCN_WORKSPACE_NAVIGATION,
  type PcnSection,
} from '../utils/pcnNavigation';

export const PCN_SECTION_ICONS: Record<PcnSection, ElementType> = {
  dashboard: LayoutDashboard,
  dataIntegrity: ShieldAlert,
  cutover: ShieldCheck,
  operationsRegister: FileSpreadsheet,
  historicalDiscovery: FileSearch,
  agent: Bot,
  proposals: FilePlus2,
  fields: ClipboardList,
  samples: Boxes,
  customers: Building2,
  labRequests: Send,
  results: ClipboardCheck,
  issuance: FileCheck2,
  templates: FileText,
  qualityDocuments: ShieldCheck,
  haimy: FileSpreadsheet,
  backup: Archive,
  archive: Archive,
  activityLogs: Activity,
  users: Users,
};

type PcnSidebarProps = {
  currentUser: UserAccount;
  activeSection: PcnSection;
  fields: PcnCertificationField[];
  sectionLabels: Record<PcnSection, string>;
  isPcnAdmin: boolean;
  isSidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  sidebarWidthClass: 'w-16' | 'w-64';
  systemRoleLabel: string;
  departmentRoleLabel: string;
  onToggleSidebar: () => void;
  onOpenSection: (section: PcnSection, entityKey?: string) => void;
  onCloseMobileMenu: () => void;
  onLogout: () => void;
};

export default function PcnSidebar({
  currentUser,
  activeSection,
  fields,
  sectionLabels,
  isPcnAdmin,
  isSidebarCollapsed,
  mobileMenuOpen,
  sidebarWidthClass,
  systemRoleLabel,
  departmentRoleLabel,
  onToggleSidebar,
  onOpenSection,
  onCloseMobileMenu,
  onLogout,
}: PcnSidebarProps) {
  const moreGroups = getPcnMoreNavigationGroups(isPcnAdmin);
  const moreSections = moreGroups.flatMap((group) => group.items);
  const [moreOpen, setMoreOpen] = useState(false);
  const showExpandedLabels = !isSidebarCollapsed || mobileMenuOpen;

  useEffect(() => {
    setMoreOpen(false);
  }, [activeSection]);

  const handleMoreClick = () => {
    if (isSidebarCollapsed && !mobileMenuOpen) {
      onToggleSidebar();
    }
    setMoreOpen((current) => !current);
  };

  const renderSectionButton = (section: PcnSection) => {
    const Icon = PCN_SECTION_ICONS[section];
    const isActive = activeSection === section;
    const isFieldSection = section === 'fields';
    return (
      <button
        type="button"
        key={section}
        onClick={() => onOpenSection(section)}
        className={`group flex w-full items-center rounded-xl py-2.5 text-left transition-all ${showExpandedLabels ? 'gap-3 px-3.5' : 'justify-center px-1'} ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
        title={sectionLabels[section]}
        aria-label={sectionLabels[section]}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
        {showExpandedLabels && <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{sectionLabels[section]}</span>}
        {showExpandedLabels && isFieldSection && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">{fields.length}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`ddt-compact-sidebar fixed inset-y-0 left-0 z-50 flex ${sidebarWidthClass === 'w-16' ? 'lg:w-16' : 'lg:w-64'} w-64 flex-col bg-slate-900 text-slate-200 shadow-2xl transition-all duration-300 lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className={`flex h-16 items-center border-b border-slate-800 p-4 ${showExpandedLabels ? 'gap-3' : 'justify-center'}`}>
        <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        {showExpandedLabels && <div className="min-w-0"><div className="truncate text-xs font-black uppercase tracking-wide text-white">IEMM • TVCI</div><div className="mt-1 truncate text-[9px] font-bold leading-none tracking-widest text-emerald-400">PHÒNG CHỨNG NHẬN</div></div>}
        <button type="button" className="ml-auto text-slate-400 lg:hidden" aria-label="Đóng menu PCN" onClick={onCloseMobileMenu}><X size={18} /></button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu Sidebar">
        {PCN_WORKSPACE_NAVIGATION.map(renderSectionButton)}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleMoreClick}
            className={`group flex w-full items-center rounded-xl py-2.5 text-left transition-all ${showExpandedLabels ? 'gap-3 px-3.5' : 'justify-center px-1'} ${moreSections.includes(activeSection) ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
            title="Thêm"
            aria-expanded={showExpandedLabels ? moreOpen : undefined}
            data-testid="pcn-more-navigation-trigger"
          >
            <MoreHorizontal size={16} className={moreSections.includes(activeSection) ? 'text-emerald-300' : 'text-slate-400'} />
            {showExpandedLabels && <><span className="min-w-0 flex-1 truncate text-[11px] font-black">Thêm</span><span className={`text-[9px] transition-transform ${moreOpen ? 'rotate-90' : ''}`}>›</span></>}
          </button>
          {showExpandedLabels && moreOpen && <div className="mt-1 space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-1.5" data-testid="pcn-more-navigation">
            {moreGroups.map((group) => <div key={group.key}>
              <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{group.label}</div>
              <div className="space-y-1">{group.items.map(renderSectionButton)}</div>
            </div>)}
          </div>}
        </div>
      </nav>

      <div className={`shrink-0 border-t border-slate-800 bg-slate-950/20 p-3 ${showExpandedLabels ? 'space-y-2' : ''}`}>
        <div className={`flex items-center ${showExpandedLabels ? 'gap-3' : 'justify-center'} p-1`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-black uppercase text-emerald-400">{currentUser.name ? currentUser.name.split(' ').pop()?.slice(0, 2) : 'US'}</span>
          {showExpandedLabels && <div className="min-w-0 flex-1"><div className="truncate text-xs font-black leading-tight text-slate-200">{currentUser.name || 'Người dùng hệ thống'}</div><div className="mt-1 truncate text-[9px] text-slate-500">{systemRoleLabel} • {departmentRoleLabel}</div></div>}
        </div>
        {showExpandedLabels && <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><LogOut size={14} /> Đăng xuất</button>}
      </div>
    </aside>
  );
}
