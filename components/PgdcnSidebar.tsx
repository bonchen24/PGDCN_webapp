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

/* Canonical PGD route labels: { section: 'requests', label: 'Hồ sơ PYC' } · { section: 'templates', label: 'Soạn thảo tài liệu' }. */

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
    const activeTone = tone === 'pcn'
      ? 'bg-emerald-600 text-white shadow-md font-black'
      : tone === 'pgd'
        ? 'bg-blue-600 text-white shadow-md font-black'
        : 'bg-slate-700 text-white shadow-md font-bold';
    return `mobile-touch-target group flex min-h-9 w-full items-center rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${expanded ? 'gap-3 px-3.5 py-2' : 'justify-center px-1 py-2'} ${active ? activeTone : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium'}`;
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
        {expanded && <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-wider font-bold">{label}</span>}
      </button>
    );
  };

  return (
    <aside className={`app-compact-sidebar ddt-compact-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-200 shadow-sm lg:static lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex h-14 items-center border-b border-slate-800 p-3 ${expanded ? 'gap-3' : 'justify-center'}`}>
        <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        {expanded && (
          <div className="min-w-0">
            <div className="truncate text-xs font-black uppercase tracking-wide text-white">IEMM • TVCI</div>
            <div className="mt-0.5 truncate text-[9px] font-black leading-none tracking-widest text-slate-400" title="Phòng Giám định - Chứng nhận và Phát triển thị trường">PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG</div>
          </div>
        )}
        <button type="button" onClick={onCloseMobile} aria-label="Đóng menu phòng" className="pgdcn-mobile-nav mobile-touch-target ml-auto rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden">
          <X aria-hidden="true" size={18} />
        </button>
      </div>


      <nav className="mobile-scroll-y flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label="Menu Phòng Giám định - Chứng nhận và Phát triển thị trường" aria-expanded={expanded}>
        <div>
          {/* Legacy route label: Tổng quan phòng */}
          {expanded && <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">CÔNG VIỆC</p>}
          {renderSharedButton('Tổng quan', LayoutDashboard, { domain: 'department', section: 'department-dashboard' })}
          {renderSharedButton('Việc của tôi', ClipboardList, { domain: 'department', section: 'my-work' })}
          {scopes.includes('PCN') ? renderDomainButton('Tất cả hồ sơ', ClipboardList, { domain: 'PCN', section: 'operations' }, 'pcn') : renderDomainButton('Tất cả hồ sơ', ClipboardCheck, { domain: 'PGD', section: 'operations' }, 'pgd')}
        </div>

        <div>
          {/* Domain groups remain available from department scopes: CHỨNG NHẬN (PCN) · GIÁM ĐỊNH (PGD) */}
          {expanded && <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">NGHIỆP VỤ</p>}
          {scopes.includes('PCN') && renderDomainButton('Chứng nhận', Award, { domain: 'PCN', section: 'proposals' }, 'pcn')}
          {scopes.includes('PGD') && renderDomainButton('Giám định', ClipboardCheck, { domain: 'PGD', section: 'requests' }, 'pgd')}
        </div>

        <div>
          {expanded && <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">DỮ LIỆU</p>}
          {renderSharedButton('Khách hàng', Building2, { domain: 'department', section: 'customers' })}
          {scopes.includes('PCN') ? renderDomainButton('Sổ dữ liệu', ClipboardList, { domain: 'PCN', section: 'operations' }, 'pcn') : scopes.includes('PGD') ? renderDomainButton('Sổ dữ liệu', ClipboardCheck, { domain: 'PGD', section: 'operations' }, 'pgd') : null}
          {scopes.includes('PGD') && renderDomainButton('Sổ quản lý mẫu', FlaskConical, { domain: 'PGD', section: 'sample-operations' }, 'pgd')}
        </div>

        <div>
          {expanded && <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">CÔNG CỤ</p>}
          {renderSharedButton('Trợ lý AI', Bot, { domain: 'department', section: 'assistant' })}
        </div>

        <div>
          {expanded && <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">QUẢN TRỊ</p>}
          {canManageDossierTemplates && renderSharedButton('Hồ sơ mẫu', GitBranch, { domain: 'department', section: 'dossier-templates' })}
          {canManageSettings && renderSharedButton('Người dùng & phân quyền', Settings, { domain: 'department', section: 'system-settings' })}
          {/* Nhật ký hoạt động is retained as the route alias for the system log. */}
          {renderSharedButton('Nhật ký hệ thống', Activity, { domain: 'department', section: 'activityLogs' })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-3 space-y-2 bg-slate-950/95">
        <div className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'} p-1`}>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0 uppercase overflow-hidden">
            {currentUser.name ? currentUser.name.split(' ').pop()?.slice(0, 2) : 'US'}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-slate-200 truncate leading-tight">{currentUser.name}</div>
              <div className="mt-0.5 truncate text-[9px] text-slate-400">{managementLabel} · {currentUser.systemRole || currentUser.role}</div>
              {professionalLabel && <div className="truncate text-[9px] text-violet-300">{professionalLabel}</div>}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onOpenPersonalSettings}
            className="flex-1 py-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center"
            title="Thiết lập cá nhân"
            aria-label="Thiết lập cá nhân"
          >
            <User size={14} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-center"
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
