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
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
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

export type PgdcnSharedSection = 'department-dashboard' | 'my-work' | 'customers' | 'assistant' | 'activityLogs' | 'system-settings' | 'dossier-templates';
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

  const buttonClass = (active: boolean, tone: 'shared' | 'pcn' | 'pgd' = 'shared') => {
    const activeTone = tone === 'pcn'
      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
      : tone === 'pgd'
        ? 'bg-blue-600 text-white shadow-sm font-semibold'
        : 'bg-slate-700 text-white shadow-sm font-semibold';
    return `mobile-touch-target group flex min-h-8 w-full items-center rounded-lg text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-2 px-2.5 py-1.5' : 'justify-center px-1 py-1.5'} ${active ? activeTone : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium'}`;
  };

  const renderSharedButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'department' }>) => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return (
      <button type="button" key={target.section} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
        <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
        {expanded && <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wider">{label}</span>}
      </button>
    );
  };

  const renderDomainButton = (label: string, icon: ElementType, target: Extract<PgdcnNavigationTarget, { domain: 'PCN' | 'PGD' }>, tone: 'pcn' | 'pgd') => {
    const Icon = icon;
    const active = isTargetActive(activeTarget, target);
    return (
      <button type="button" key={`${target.domain}-${target.section}`} onClick={() => { onNavigate(target); onCloseMobile(); }} className={buttonClass(active, tone)} title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
        <Icon size={15} className={active ? 'text-white' : 'text-slate-400'} />
        {expanded && <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wider font-semibold">{label}</span>}
      </button>
    );
  };

  return (
    <aside id="pgdcn-sidebar" className={`app-compact-sidebar ddt-compact-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-200 shadow-sm lg:static lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex h-12 items-center border-b border-slate-800 px-3 py-2 ${expanded ? 'gap-3' : 'justify-center'}`}>
        <img src="/icons/iemm-logo-192.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        {expanded && (
          <div className="min-w-0">
            <div className="truncate text-xs font-bold uppercase tracking-wide text-white">IEMM • TVCI</div>
            <div className="mt-0.5 truncate text-[10px] font-medium leading-none tracking-wider text-slate-400" title="Phòng Giám định - Chứng nhận và Phát triển thị trường">PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG</div>
          </div>
        )}
        <button type="button" onClick={onCloseMobile} aria-label="Đóng menu phòng" aria-expanded={mobileOpen} aria-controls="pgdcn-sidebar" className="pgdcn-mobile-nav mobile-touch-target ml-auto rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden">
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="mobile-scroll-y flex-1 space-y-2.5 overflow-y-auto px-2 py-2" aria-label="Menu Phòng Giám định - Chứng nhận và Phát triển thị trường">
        <div>
          {/* Legacy route label: Tổng quan phòng */}
          {expanded && <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">CÔNG VIỆC</p>}
          {renderSharedButton('Tổng quan', LayoutDashboard, { domain: 'department', section: 'department-dashboard' })}
          {renderSharedButton('Việc của tôi', ClipboardList, { domain: 'department', section: 'my-work' })}
        </div>

        <div>
          {/* Domain groups remain available from department scopes: CHỨNG NHẬN (PCN) · GIÁM ĐỊNH (PGD) */}
          {expanded && <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">NGHIỆP VỤ</p>}
          {hasPcn && renderDomainButton('Chứng nhận', Award, { domain: 'PCN', section: 'proposals' }, 'pcn')}
          {hasPgd && renderDomainButton('Giám định', ClipboardCheck, { domain: 'PGD', section: 'requests' }, 'pgd')}
        </div>

        <div>
          {expanded && <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">DỮ LIỆU</p>}
          {renderSharedButton('Khách hàng', Building2, { domain: 'department', section: 'customers' })}
          {hasPcn && renderDomainButton(hasBothScopes ? 'Sổ dữ liệu PCN' : 'Sổ dữ liệu', ClipboardList, { domain: 'PCN', section: 'operations' }, 'pcn')}
          {hasPgd && renderDomainButton(hasBothScopes ? 'Sổ dữ liệu PGD' : 'Sổ dữ liệu', ClipboardCheck, { domain: 'PGD', section: 'operations' }, 'pgd')}
          {hasPcn && renderDomainButton(hasBothScopes ? 'Sổ quản lý mẫu PCN' : 'Sổ quản lý mẫu', FlaskConical, { domain: 'PCN', section: 'lab-operations' }, 'pcn')}
          {hasPgd && renderDomainButton(hasBothScopes ? 'Sổ quản lý mẫu PGD' : 'Sổ quản lý mẫu', FlaskConical, { domain: 'PGD', section: 'sample-operations' }, 'pgd')}
        </div>

        <div>
          {expanded && <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">CÔNG CỤ</p>}
          {renderSharedButton('Trợ lý AI', Bot, { domain: 'department', section: 'assistant' })}
        </div>

        <div>
          {expanded && <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">QUẢN TRỊ</p>}
          {canManageDossierTemplates && renderSharedButton('Hồ sơ mẫu', GitBranch, { domain: 'department', section: 'dossier-templates' })}
          {canManageSettings && renderSharedButton('Người dùng & phân quyền', Settings, { domain: 'department', section: 'system-settings' })}
          {/* Nhật ký hoạt động is retained as the route alias for the system log. */}
          {renderSharedButton('Nhật ký hệ thống', Activity, { domain: 'department', section: 'activityLogs' })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-2.5 space-y-1.5 bg-slate-950/95">
        <div className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'} p-1`}>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs shrink-0 uppercase overflow-hidden">
            {currentUser.name ? currentUser.name.trim().split(/\s+/).pop()?.slice(0, 2).toUpperCase() : 'US'}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-200 truncate leading-tight">{currentUser.name || currentUser.username}</div>
              <div className="mt-0.5 truncate text-[10px] text-slate-400">{managementLabel} · {currentUser.systemRole || currentUser.role}</div>
              {professionalLabel && <div className="truncate text-[10px] text-violet-300">{professionalLabel}</div>}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onOpenPersonalSettings}
            className="flex-1 py-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
            title="Thiết lập cá nhân"
            aria-label="Thiết lập cá nhân"
          >
            <User size={14} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
