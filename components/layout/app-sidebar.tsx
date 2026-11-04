'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Award,
  ClipboardList,
  FlaskConical,
  ClipboardCheck,
  Layers,
  GitBranch,
  FileEdit,
  Building2,
  Activity,
  Settings,
  ChevronDown,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useSidebar } from '@/hooks/use-sidebar';
import type { PcnUserAccount } from '@/types';
import { canViewSystemSettings } from '@/utils/systemSettingsPolicy';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { clearPcnSession } from '@/utils/pcnAuthApi';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS } from '@/types';

interface AppSidebarProps {
  currentUser: PcnUserAccount;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: string;
  exact?: boolean;
}

interface NavGroup {
  groupTitle: string;
  visible: boolean;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function AppSidebar({ currentUser }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, mobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);

  const [pcnOpen, setPcnOpen] = useState(() => pathname.startsWith('/pcn'));
  const [pgdOpen, setPgdOpen] = useState(() => pathname.startsWith('/pgd'));

  const scopes = currentUser.departmentScopes || [];
  const hasPcn = scopes.length === 0 || scopes.includes('PCN') || currentUser.systemRole === 'admin';
  const hasPgd = scopes.length === 0 || scopes.includes('PGD') || currentUser.systemRole === 'admin';

  const canManageTemplates = scopes.some((scope) => scope === 'PCN' || scope === 'PGD')
    && (isPcnSystemManager(currentUser) || ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(currentUser.pgdRole || '').toUpperCase()));

  const canManageSettings = canViewSystemSettings(currentUser);

  const managementRoleName = useMemo(() => {
    return (
      ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((r) => r.code === currentUser.managementRoleCode)?.name ||
      currentUser.position ||
      'Cán bộ nghiệp vụ'
    );
  }, [currentUser]);

  // Keep accordion open when navigating to respective domain
  useEffect(() => {
    if (pathname.startsWith('/pcn')) setPcnOpen(true);
    if (pathname.startsWith('/pgd')) setPgdOpen(true);
  }, [pathname]);

  const navGroups: NavGroup[] = [
    {
      groupTitle: 'Tổng quan',
      visible: true,
      items: [
        {
          title: 'Bàn làm việc',
          href: '/',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      groupTitle: 'Chứng nhận · PCN',
      visible: hasPcn,
      collapsible: true,
      defaultOpen: pcnOpen,
      items: [
        {
          title: 'Hàng đợi hồ sơ PCN',
          href: '/pcn',
          icon: Award,
          exact: true,
        },
        {
          title: 'Sổ tổng hợp PCN',
          href: '/pcn?tab=operations',
          icon: ClipboardList,
        },
        {
          title: 'Sổ quản lý mẫu PCN',
          href: '/pcn?tab=samples',
          icon: FlaskConical,
        },
      ],
    },
    {
      groupTitle: 'Giám định · PGD',
      visible: hasPgd,
      collapsible: true,
      defaultOpen: pgdOpen,
      items: [
        {
          title: 'Hàng đợi PYC Giám định',
          href: '/pgd',
          icon: ClipboardCheck,
          exact: true,
        },
        {
          title: 'Sổ tổng hợp PGD',
          href: '/pgd?tab=operations',
          icon: Layers,
        },
        {
          title: 'Sổ quản lý mẫu PGD',
          href: '/pgd?tab=samples',
          icon: FlaskConical,
        },
      ],
    },
    {
      groupTitle: 'Bộ mẫu & Quy trình',
      visible: canManageTemplates,
      items: [
        {
          title: 'Hồ sơ mẫu & Quy trình',
          href: '/templates',
          icon: GitBranch,
        },
      ],
    },
    {
      groupTitle: 'Soạn thảo văn bản',
      visible: true,
      items: [
        {
          title: 'Studio soạn thảo DOCX',
          href: '/drafting',
          icon: FileEdit,
        },
      ],
    },
    {
      groupTitle: 'Quản trị hệ thống',
      visible: true,
      items: [
        {
          title: 'Danh bạ khách hàng',
          href: '/customers',
          icon: Building2,
        },
        {
          title: 'Nhật ký hoạt động',
          href: '/activity-logs',
          icon: Activity,
        },
        ...(canManageSettings
          ? [
              {
                title: 'Cài đặt & RBAC',
                href: '/settings',
                icon: Settings,
              },
            ]
          : []),
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await clearPcnSession();
    } catch {}
    clearCurrentUser();
    router.replace('/login');
  };

  const isItemActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    const [baseUrl] = href.split('?');
    return pathname.startsWith(baseUrl) && (baseUrl !== '/' || pathname === '/');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      {/* Brand Header */}
      <div className={`flex h-13 shrink-0 items-center border-b border-slate-800 px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/icons/iemm-logo-192.png"
            alt="TVCI Logo"
            className="h-7 w-7 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm"
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-wider text-white uppercase">PGDCN • TVCI</span>
              <span className="text-[10px] font-medium text-slate-400">Giám định & Chứng nhận</span>
            </div>
          )}
        </Link>
        {mobileOpen && (
          <button
            type="button"
            onClick={closeMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer"
            aria-label="Đóng thanh điều hướng"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation Group List */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Điều hướng chính">
        {navGroups
          .filter((group) => group.visible)
          .map((group, groupIdx) => {
            const isPcnGroup = group.groupTitle.includes('PCN');
            const isPgdGroup = group.groupTitle.includes('PGD');
            const isOpen = isPcnGroup ? pcnOpen : isPgdGroup ? pgdOpen : true;
            const setIsOpen = isPcnGroup ? setPcnOpen : isPgdGroup ? setPgdOpen : undefined;

            return (
              <div key={groupIdx} className="space-y-1">
                {!collapsed && (
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {group.groupTitle}
                    </span>
                    {group.collapsible && setIsOpen && (
                      <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                        aria-label={`Mở rộng ${group.groupTitle}`}
                      >
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>
                )}

                {/* Items */}
                {isOpen && (
                  <div className="space-y-0.5">
                    {group.items.map((item, itemIdx) => {
                      const active = isItemActive(item.href, item.exact);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={itemIdx}
                          href={item.href}
                          onClick={() => {
                            if (mobileOpen) closeMobile();
                          }}
                          title={collapsed ? item.title : undefined}
                          className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          } ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                          <Icon
                            size={16}
                            className={`shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
                          />
                          {!collapsed && (
                            <span className="truncate text-[11px] leading-tight">{item.title}</span>
                          )}
                          {!collapsed && item.badge && (
                            <span
                              className={`ml-auto rounded-full px-1.5 py-0.2 text-[9px] font-bold text-white ${
                                item.badgeColor || 'bg-slate-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Footer Profile & Collapse Toggle */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 p-2">
        <div className={`flex items-center gap-2 p-1 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 uppercase ring-1 ring-emerald-500/40">
            {currentUser.name ? currentUser.name.trim().split(/\s+/).pop()?.slice(0, 2).toUpperCase() : 'US'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-100">{currentUser.name || currentUser.username}</p>
              <p className="truncate text-[10px] text-slate-400">{managementRoleName}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>

        {/* Desktop Collapse Toggle Button */}
        <div className="mt-1 hidden lg:block">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
            title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span>Thu gọn thanh bên</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer (Slide-over with Backdrop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside
            id="mobile-sidebar"
            aria-label="Menu điều hướng phòng ban"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-3rem)] shadow-2xl transition-transform"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-sidebar"
        aria-label="Thanh điều hướng chính"
        className={`hidden shrink-0 border-r border-slate-800 transition-[width] duration-200 ease-out lg:block ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
