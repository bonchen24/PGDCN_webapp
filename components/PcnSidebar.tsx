'use client';

import { useEffect, useState, type ElementType } from 'react';
import {
  Activity,
  Building2,
  Bot,
  ClipboardList,
  FilePlus2,
  FilePenLine,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  Users,
  UserRound,
  X,
} from 'lucide-react';

import type { UserAccount } from '../types';
import {
  getPcnMoreNavigationGroups,
  PCN_WORKSPACE_NAVIGATION,
  type PcnSection,
} from '../utils/pcnNavigation';

export const PCN_SECTION_ICONS: Record<PcnSection, ElementType> = {
  dashboard: LayoutDashboard,
  proposals: FilePlus2,
  operations: ClipboardList,
  'lab-operations': FlaskConical,
  drafting: FilePenLine,
  assistant: Bot,
  customers: Building2,
  users: Users,
  activityLogs: Activity,
  settings: Settings,
};

type PcnSidebarProps = {
  currentUser: UserAccount;
  activeSection: PcnSection;
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
  onOpenPersonalSettings: () => void;
  onLogout: () => void;
};

export default function PcnSidebar({
  currentUser,
  activeSection,
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
  onOpenPersonalSettings,
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

      <nav className="flex-1 mobile-scroll-y space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu Sidebar">
        {PCN_WORKSPACE_NAVIGATION.map(renderSectionButton)}
        {moreSections.length > 0 && <div className="pt-1">
          <button
            type="button"
            onClick={handleMoreClick}
            className={`group flex w-full items-center rounded-xl py-2.5 text-left transition-all ${showExpandedLabels ? 'gap-3 px-3.5' : 'justify-center px-1'} ${moreSections.includes(activeSection) ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
            title="Quản trị"
            aria-expanded={showExpandedLabels ? moreOpen : undefined}
            data-testid="pcn-admin-navigation-trigger"
          >
            <MoreHorizontal size={16} className={moreSections.includes(activeSection) ? 'text-emerald-300' : 'text-slate-400'} />
            {showExpandedLabels && <><span className="min-w-0 flex-1 truncate text-[11px] font-black">Quản trị</span><span className={`text-[9px] transition-transform ${moreOpen ? 'rotate-90' : ''}`}>›</span></>}
          </button>
          {showExpandedLabels && moreOpen && <div className="mt-1 space-y-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1.5" data-testid="pcn-admin-navigation">
            {moreSections.map(renderSectionButton)}
          </div>}
        </div>}
      </nav>

      <div className={`shrink-0 border-t border-slate-800 bg-slate-950/20 p-3 ${showExpandedLabels ? 'space-y-2' : ''}`}>
        <button type="button" onClick={onOpenPersonalSettings} aria-label="Mở thiết lập cá nhân" title="Thiết lập cá nhân" className={`flex w-full items-center rounded-lg text-left hover:bg-slate-800/70 ${showExpandedLabels ? 'gap-3 p-1' : 'justify-center p-1'}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-black uppercase text-emerald-400">{currentUser.name ? currentUser.name.split(' ').pop()?.slice(0, 2) : 'US'}</span>
          {showExpandedLabels && <div className="min-w-0 flex-1"><div className="truncate text-xs font-black leading-tight text-slate-200">{currentUser.name || 'Người dùng hệ thống'}</div><div className="mt-1 truncate text-[9px] text-slate-500">{systemRoleLabel} • {departmentRoleLabel}</div></div>}
          {showExpandedLabels && <UserRound size={14} className="shrink-0 text-slate-500" />}
        </button>
        {showExpandedLabels && <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><LogOut size={14} /> Đăng xuất</button>}
      </div>
    </aside>
  );
}
