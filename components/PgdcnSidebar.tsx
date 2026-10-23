'use client';

import { useEffect, useRef, useState, type ElementType } from 'react';
import {
  Activity,
  Award,
  Bot,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileEdit,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  X,
} from 'lucide-react';

import type { PcnUserAccount } from '../types';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS } from '../types';
import type { PgdSection } from './PgdSidebar';
import type { PcnSection } from '../utils/pcnNavigation';
import { canViewSystemSettings } from '../utils/systemSettingsPolicy';
import { isPcnSystemManager } from '../utils/pcnRbac';

export type PgdcnSharedSection = 'department-dashboard' | 'my-work' | 'customers' | 'assistant' | 'activityLogs' | 'system-settings' | 'dossier-templates' | 'document-drafting';
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

const isTargetActive = (active: PgdcnNavigationTarget, target: PgdcnNavigationTarget): boolean => (
  active.domain === target.domain && active.section === target.section
);

/* Canonical PGD route labels: { section: 'requests', label: 'Hồ sơ PYC' } · { section: 'operations', label: 'Sổ tổng hợp' } · { section: 'templates', label: 'Soạn thảo tài liệu' }. */

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
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseMobileRef = useRef(onCloseMobile);
  onCloseMobileRef.current = onCloseMobile;
  const scopes = currentUser.departmentScopes || [];
  const hasPcn = scopes.includes('PCN');
  const hasPgd = scopes.includes('PGD');
  const hasBothScopes = hasPcn && hasPgd;

  const canManageSettings = canViewSystemSettings(currentUser);
  const canManageDossierTemplates = scopes.some((scope) => scope === 'PCN' || scope === 'PGD')
    && (isPcnSystemManager(currentUser) || ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(currentUser.pgdRole || '').toUpperCase()));
  const managementLabel = ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === currentUser.managementRoleCode)?.name || 'Chưa phân công chức danh';
  const professionalLabel = (currentUser.professionalRoleCodes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code).join(', ');

  useEffect(() => {
    if (activeTarget.domain === 'PCN') setPcnOpen(true);
    if (activeTarget.domain === 'PGD') setPgdOpen(true);
  }, [activeTarget.domain]);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return undefined;
    const mobileViewport = window.matchMedia('(max-width: 1023px)');
    const syncMobileVisibility = () => {
      const closedOnMobile = mobileViewport.matches && !mobileOpen;
      sidebar.toggleAttribute('inert', closedOnMobile);
      if (closedOnMobile) sidebar.setAttribute('aria-hidden', 'true');
      else sidebar.removeAttribute('aria-hidden');
    };
    syncMobileVisibility();
    mobileViewport.addEventListener('change', syncMobileVisibility);
    return () => mobileViewport.removeEventListener('change', syncMobileVisibility);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobileRef.current();
        return;
      }
      if (event.key !== 'Tab' || !sidebarRef.current) return;
      const items = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )).filter((element) => element.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sidebarRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sidebarRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [mobileOpen]);

  const buttonClass = (active: boolean, tone: 'shared' | 'pcn' | 'pgd' = 'shared') => {
    const toneClasses = {
      shared: { active: 'bg-slate-700 text-white font-semibold', ring: 'focus-visible:ring-slate-400' },
      pcn: { active: 'bg-emerald-700 text-white font-semibold', ring: 'focus-visible:ring-emerald-500' },
      pgd: { active: 'bg-blue-600 text-white font-semibold', ring: 'focus-visible:ring-blue-500' },
    };
    const selectedTone = toneClasses[tone];
    return `mobile-touch-target group flex min-h-11 w-full items-center rounded-md text-left transition-colors ${expanded ? 'gap-2 px-2 py-1' : 'justify-center px-1 py-1'} ${active ? selectedTone.active : 'font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white'} focus-visible:outline-none focus-visible:ring-2 ${selectedTone.ring} focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 lg:min-h-9`;
  };
  const renderSharedButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'department' }>) => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return (
      <button type="button" key={target.section} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
        <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
        {expanded && <span className="min-w-0 flex-1 whitespace-normal break-words text-[11px] leading-4">{label}</span>}
      </button>
    );
  };

  const renderDomainButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'PCN' | 'PGD' }>, tone: 'pcn' | 'pgd') => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return (
      <button type="button" key={`${target.domain}-${target.section}`} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active, tone)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
        <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
        {expanded && <span className="min-w-0 flex-1 whitespace-normal break-words text-[11px] leading-4">{label}</span>}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && <button type="button" data-testid="pgdcn-sidebar-backdrop" aria-label="Đóng menu phòng" title="Đóng menu phòng" tabIndex={-1} onClick={() => onCloseMobileRef.current()} className="fixed inset-0 z-40 cursor-default bg-slate-950/55 lg:hidden" />}
      <aside ref={sidebarRef} id="pgdcn-sidebar" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? 'true' : undefined} aria-label={mobileOpen ? 'Điều hướng PGDCN' : undefined} className={`app-compact-sidebar ddt-compact-sidebar fixed left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-64 max-w-[calc(100vw-1rem)] flex-col border-r border-slate-800 bg-slate-900 text-slate-200 shadow-sm transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:static lg:max-h-[100dvh] lg:max-w-none lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex min-h-14 shrink-0 items-center border-b border-slate-800 px-3 py-2 ${expanded ? 'gap-3' : 'justify-center'}`}>
        <img src="/icons/iemm-logo-192.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        {expanded && (
          <div className="min-w-0">
            <div className="truncate text-xs font-bold tracking-wide text-white">IEMM • TVCI</div>
            <div title="PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG" className="mt-0.5 whitespace-normal break-words text-[10px] font-medium leading-4 text-slate-400">Giám định · Chứng nhận</div>
          </div>
        )}
        <button ref={closeButtonRef} type="button" onClick={onCloseMobile} aria-label="Đóng menu phòng" aria-expanded={mobileOpen} aria-controls="pgdcn-sidebar" className="pgdcn-mobile-nav mobile-touch-target ml-auto min-h-11 min-w-11 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden">
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="mobile-scroll-y min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 py-2" aria-label="Điều hướng PGDCN">
        <section className="space-y-0.5" aria-label="Dùng chung">
          {expanded && <p className="mb-1 px-2 text-[11px] font-semibold text-slate-400">Dùng chung</p>}
          {renderSharedButton('Tổng quan', LayoutDashboard, { domain: 'department', section: 'department-dashboard' })}
          {renderSharedButton('Khách hàng', Building2, { domain: 'department', section: 'customers' })}
          {renderSharedButton('Trợ lý AI', Bot, { domain: 'department', section: 'assistant' })}
          {renderSharedButton('Nhật ký hệ thống', Activity, { domain: 'department', section: 'activityLogs' })}
          {renderSharedButton('Soạn thảo văn bản', FileEdit, { domain: 'department', section: 'document-drafting' })}
        </section>

        {hasPcn && (
          <section className="space-y-0.5" aria-label="Chứng nhận PCN">
            {expanded && (
              <button type="button" onClick={() => setPcnOpen((open) => !open)} aria-expanded={pcnOpen} aria-controls="pgdcn-pcn-navigation" title="Chứng nhận PCN" className={`mobile-touch-target flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 lg:min-h-9 ${activeTarget.domain === 'PCN' ? 'text-emerald-200' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}>
                <span className="min-w-0 flex-1 whitespace-normal break-words leading-4">Chứng nhận · PCN</span>
                <ChevronRight aria-hidden="true" size={14} className={`shrink-0 transition-transform motion-reduce:transition-none ${pcnOpen ? 'rotate-90' : ''}`} />
              </button>
            )}
            <div id="pgdcn-pcn-navigation" hidden={expanded && !pcnOpen} className={expanded ? 'ml-2 space-y-0.5 border-l border-slate-800 pl-2' : 'space-y-0.5'}>
              {renderDomainButton('Chứng nhận', Award, { domain: 'PCN', section: 'proposals' }, 'pcn')}
              {renderDomainButton(hasBothScopes ? 'Sổ dữ liệu PCN' : 'Sổ dữ liệu', ClipboardList, { domain: 'PCN', section: 'operations' }, 'pcn')}
              {renderDomainButton(hasBothScopes ? 'Sổ quản lý mẫu PCN' : 'Sổ quản lý mẫu', FlaskConical, { domain: 'PCN', section: 'lab-operations' }, 'pcn')}
            </div>
          </section>
        )}

        {hasPgd && (
          <section className="space-y-0.5" aria-label="Giám định PGD">
            {expanded && (
              <button type="button" onClick={() => setPgdOpen((open) => !open)} aria-expanded={pgdOpen} aria-controls="pgdcn-pgd-navigation" title="Giám định PGD" className={`mobile-touch-target flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 lg:min-h-9 ${activeTarget.domain === 'PGD' ? 'text-blue-200' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}>
                <span className="min-w-0 flex-1 whitespace-normal break-words leading-4">Giám định · PGD</span>
                <ChevronRight aria-hidden="true" size={14} className={`shrink-0 transition-transform motion-reduce:transition-none ${pgdOpen ? 'rotate-90' : ''}`} />
              </button>
            )}
            <div id="pgdcn-pgd-navigation" hidden={expanded && !pgdOpen} className={expanded ? 'ml-2 space-y-0.5 border-l border-slate-800 pl-2' : 'space-y-0.5'}>
              {renderDomainButton('Giám định', ClipboardCheck, { domain: 'PGD', section: 'requests' }, 'pgd')}
              {renderDomainButton(hasBothScopes ? 'Sổ dữ liệu PGD' : 'Sổ dữ liệu', ClipboardCheck, { domain: 'PGD', section: 'operations' }, 'pgd')}
              {renderDomainButton(hasBothScopes ? 'Sổ quản lý mẫu PGD' : 'Sổ quản lý mẫu', FlaskConical, { domain: 'PGD', section: 'sample-operations' }, 'pgd')}
            </div>
          </section>
        )}

        {(canManageDossierTemplates || canManageSettings) && (
          <section className="space-y-0.5" aria-label="Quản trị">
            {expanded && <p className="mb-1 px-2 pt-1 text-[11px] font-semibold text-slate-400">Quản trị</p>}
            {canManageDossierTemplates && renderSharedButton('Hồ sơ mẫu', GitBranch, { domain: 'department', section: 'dossier-templates' })}
            {canManageSettings && renderSharedButton('Cài đặt hệ thống', Settings, { domain: 'department', section: 'system-settings' })}
          </section>
        )}
      </nav>

      <div className="shrink-0 space-y-1.5 border-t border-slate-800 bg-slate-950/95 p-2.5">
        <div className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'} p-1`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-400 uppercase">
            {currentUser.name ? currentUser.name.trim().split(/\s+/).pop()?.slice(0, 2).toUpperCase() : 'US'}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="whitespace-normal break-words text-xs font-semibold leading-4 text-slate-200">{currentUser.name || currentUser.username}</div>
              <div className="mt-0.5 whitespace-normal break-words text-[10px] leading-4 text-slate-400">{managementLabel} · {currentUser.systemRole || currentUser.role}</div>
              {professionalLabel && <div className="whitespace-normal break-words text-[10px] leading-4 text-violet-300">{professionalLabel}</div>}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onOpenPersonalSettings}
            className="mobile-touch-target flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:min-h-9 lg:min-w-0"
            title="Thiết lập cá nhân"
            aria-label="Thiết lập cá nhân"
          >
            <User aria-hidden="true" size={16} />
            {expanded && <span className="min-w-0 whitespace-normal break-words text-[11px] leading-4">Thiết lập cá nhân</span>}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mobile-touch-target flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:min-h-9 lg:min-w-0"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut aria-hidden="true" size={16} />
            {expanded && <span className="min-w-0 whitespace-normal break-words text-[11px] leading-4">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
