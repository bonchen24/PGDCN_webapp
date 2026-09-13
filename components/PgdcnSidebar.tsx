'use client';

import { useEffect, useState, type ElementType } from 'react';
import {
  Activity,
  Award,
  Bot,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FlaskConical,
  FilePenLine,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';

import type { PcnUserAccount } from '../types';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS } from '../types';
import type { PgdSection } from './PgdSidebar';
import type { PcnSection } from '../utils/pcnNavigation';
import { canViewSystemSettings } from '../utils/systemSettingsPolicy';
import { isPcnSystemManager } from '../utils/pcnRbac';

export type PgdcnSharedSection = 'department-dashboard' | 'customers' | 'assistant' | 'activityLogs' | 'system-settings' | 'dossier-templates';
export type PgdcnDomain = 'department' | 'PCN' | 'PGD';
export type PgdcnNavigationTarget =
  | { domain: 'department'; section: PgdcnSharedSection }
  | { domain: 'PCN'; section: PcnSection }
  | { domain: 'PGD'; section: PgdSection };

type PgdcnSidebarProps = {
  currentUser: PcnUserAccount;
  activeTarget: PgdcnNavigationTarget;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onNavigate: (target: PgdcnNavigationTarget) => void;
  onCloseMobile: () => void;
  onOpenPersonalSettings?: () => void;
  onLogout: () => void;
};

const PCN_ITEMS: Array<{ section: PcnSection; label: string; icon: ElementType }> = [
  { section: 'proposals', label: 'Đề nghị', icon: FilePlus2 },
  { section: 'operations', label: 'Sổ tổng hợp', icon: ClipboardList },
  { section: 'lab-operations', label: 'Sổ quản lý mẫu', icon: FlaskConical },
  { section: 'drafting', label: 'Soạn thảo tài liệu', icon: FilePenLine },
];

const PGD_ITEMS: Array<{ section: PgdSection; label: string; icon: ElementType }> = [
  { section: 'requests', label: 'Hồ sơ PYC', icon: ClipboardList },
  { section: 'operations', label: 'Sổ tổng hợp', icon: ClipboardCheck },
  { section: 'templates', label: 'Soạn thảo tài liệu', icon: FilePenLine },
];

const isTargetActive = (active: PgdcnNavigationTarget, target: PgdcnNavigationTarget): boolean => (
  active.domain === target.domain && active.section === target.section
);

export default function PgdcnSidebar({
  currentUser,
  activeTarget,
  collapsed,
  mobileOpen,
  onToggle,
  onNavigate,
  onCloseMobile,
  onOpenPersonalSettings,
  onLogout,
}: PgdcnSidebarProps) {
  const [pcnOpen, setPcnOpen] = useState(activeTarget.domain === 'PCN');
  const [pgdOpen, setPgdOpen] = useState(activeTarget.domain === 'PGD');
  const expanded = !collapsed || mobileOpen;
  const scopes = currentUser.departmentScopes || [];
  const canManageSettings = canViewSystemSettings(currentUser);
  const canManageDossierTemplates = scopes.some((scope) => scope === 'PCN' || scope === 'PGD')
    && (isPcnSystemManager(currentUser) || ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(currentUser.pgdRole || '').toUpperCase()));
  const managementLabel = ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === currentUser.managementRoleCode)?.name || 'Chưa phân công chức danh';
  const professionalLabel = (currentUser.professionalRoleCodes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code).join(', ');

  useEffect(() => {
    if (activeTarget.domain === 'PCN') setPcnOpen(true);
    if (activeTarget.domain === 'PGD') setPgdOpen(true);
  }, [activeTarget.domain]);

  const buttonClass = (active: boolean, tone: 'shared' | 'pcn' | 'pgd' = 'shared') => {
    const activeTone = tone === 'pcn' ? 'bg-emerald-600 text-white' : tone === 'pgd' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white';
    return `mobile-touch-target group flex min-h-9 w-full items-center rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-2 px-2.5' : 'justify-center px-1'} ${active ? `${activeTone} shadow-sm` : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'}`;
  };

  const renderSharedButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'department' }>) => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return <button type="button" key={target.section} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}><Icon size={16} />{expanded && <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{label}</span>}</button>;
  };

  const renderDomainButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'PCN' | 'PGD' }>, tone: 'pcn' | 'pgd') => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return <button type="button" key={`${target.domain}-${target.section}`} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active, tone)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}><Icon size={15} />{expanded && <span className="min-w-0 flex-1 truncate text-[10px] font-bold">{label}</span>}</button>;
  };

  return <aside className={`app-compact-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 shadow-sm lg:static lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className={`flex h-16 items-center border-b border-slate-800 p-4 ${expanded ? 'gap-3' : 'justify-center'}`}>
      <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
      {expanded && <div className="min-w-0"><div className="truncate text-xs font-black uppercase tracking-wide text-white">IEMM • TVCI</div><div className="mt-1 truncate text-[9px] font-bold leading-none tracking-widest text-slate-400">PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG</div></div>}
      <button type="button" onClick={onCloseMobile} aria-label="Đóng menu phòng" className="mobile-touch-target ml-auto rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden"><X aria-hidden="true" size={18} /></button>
    </div>

    <nav className="mobile-scroll-y flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Menu Phòng Giám định, Chứng nhận, Phát triển thị trường">
      {renderSharedButton('Tổng quan phòng', LayoutDashboard, { domain: 'department', section: 'department-dashboard' })}
      {renderSharedButton('Khách hàng', Building2, { domain: 'department', section: 'customers' })}
      {renderSharedButton('Trợ lý AI', Bot, { domain: 'department', section: 'assistant' })}
      {renderSharedButton('Nhật ký hoạt động', Activity, { domain: 'department', section: 'activityLogs' })}
      {canManageDossierTemplates && renderSharedButton('Hồ sơ mẫu', GitBranch, { domain: 'department', section: 'dossier-templates' })}
      {canManageSettings && renderSharedButton('Cài đặt hệ thống', Settings, { domain: 'department', section: 'system-settings' })}

      {scopes.includes('PCN') && <div className="pt-2">
        <button type="button" onClick={() => { if (collapsed && !mobileOpen) onToggle(); setPcnOpen(value => !value); }} className={`mobile-touch-target flex min-h-9 w-full items-center rounded-lg text-left text-emerald-300 transition-colors hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-2 px-2.5' : 'justify-center px-1'}`} aria-expanded={pcnOpen} aria-label="Mở hoặc thu gọn nhóm Chứng nhận PCN" title="CHỨNG NHẬN (PCN)"><Award aria-hidden="true" size={16} /><span className={expanded ? 'flex-1 text-[10px] font-black tracking-wide' : 'sr-only'}>CHỨNG NHẬN (PCN)</span>{expanded && <ChevronRight aria-hidden="true" size={14} className={pcnOpen ? 'rotate-90' : ''} />}</button>
        {expanded && pcnOpen && <div className="mt-0.5 space-y-0.5 border-l border-emerald-500/30 pl-1">{PCN_ITEMS.map(item => renderDomainButton(item.label, item.icon, { domain: 'PCN', section: item.section }, 'pcn'))}</div>}
      </div>}

      {scopes.includes('PGD') && <div className="pt-2">
        <button type="button" onClick={() => { if (collapsed && !mobileOpen) onToggle(); setPgdOpen(value => !value); }} className={`mobile-touch-target flex min-h-9 w-full items-center rounded-lg text-left text-blue-300 transition-colors hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-2 px-2.5' : 'justify-center px-1'}`} aria-expanded={pgdOpen} aria-label="Mở hoặc thu gọn nhóm Giám định PGD" title="GIÁM ĐỊNH (PGD)"><ClipboardCheck aria-hidden="true" size={16} /><span className={expanded ? 'flex-1 text-[10px] font-black tracking-wide' : 'sr-only'}>GIÁM ĐỊNH (PGD)</span>{expanded && <ChevronRight aria-hidden="true" size={14} className={pgdOpen ? 'rotate-90' : ''} />}</button>
        {expanded && pgdOpen && <div className="mt-0.5 space-y-0.5 border-l border-blue-500/30 pl-1">{PGD_ITEMS.map(item => renderDomainButton(item.label, item.icon, { domain: 'PGD', section: item.section }, 'pgd'))}</div>}
      </div>}
    </nav>

    <div className={`shrink-0 border-t border-slate-800 p-2 ${expanded ? 'space-y-1' : ''}`}>
      <button type="button" onClick={onToggle} aria-label={expanded ? 'Thu gọn menu' : 'Mở rộng menu'} className={`mobile-touch-target hidden min-h-9 w-full items-center rounded-lg text-left text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:flex ${expanded ? 'gap-2 px-2' : 'justify-center'}`} title={expanded ? 'Thu gọn menu' : 'Mở rộng menu'}><Menu aria-hidden="true" size={15} />{expanded && 'Thu gọn menu'}</button>
      <button type="button" onClick={onOpenPersonalSettings} aria-label="Mở thiết lập cá nhân" className={`mobile-touch-target flex min-h-9 w-full items-center rounded-lg text-left transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-2 p-1' : 'justify-center p-1'}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-black uppercase text-slate-200">{currentUser.name.split(' ').pop()?.slice(0, 2) || 'PG'}</span>{expanded && <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-200">{currentUser.name}</div><div className="mt-1 truncate text-[9px] text-slate-500">{managementLabel} · {currentUser.systemRole || currentUser.role}</div>{professionalLabel && <div className="truncate text-[9px] text-violet-300">{professionalLabel}</div>}</div>}</button>
      {expanded && <button type="button" onClick={onLogout} className="mobile-touch-target flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[10px] font-bold text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"><LogOut aria-hidden="true" size={14} /> Đăng xuất</button>}
    </div>
  </aside>;
}
