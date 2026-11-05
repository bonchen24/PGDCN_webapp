'use client';

import React, { useMemo, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

type NavTone = 'pcn' | 'pgd' | 'shared';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  tone?: NavTone;
  badge?: string | number;
  badgeColor?: string;
  exact?: boolean;
}

interface NavGroup {
  groupTitle: string;
  visible: boolean;
  tone?: NavTone;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

function AppSidebarInner({ currentUser }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { collapsed, mobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);

  const [pcnOpen, setPcnOpen] = useState(() => pathname.startsWith('/pcn'));
  const [pgdOpen, setPgdOpen] = useState(() => pathname.startsWith('/pgd'));

  const scopes = currentUser.departmentScopes || [];
  const hasPcn = scopes.length === 0 || scopes.includes('PCN') || currentUser.systemRole === 'admin';
  const hasPgd = scopes.length === 0 || scopes.includes('PGD') || currentUser.systemRole === 'admin';

  const canManageTemplates =
    scopes.some((scope) => scope === 'PCN' || scope === 'PGD') &&
    (isPcnSystemManager(currentUser) ||
      ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(currentUser.pgdRole || '').toUpperCase()));

  const canManageSettings = canViewSystemSettings(currentUser);

  const managementRoleName = useMemo(() => {
    return (
      ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((r) => r.code === currentUser.managementRoleCode)?.name ||
      currentUser.position ||
      'Cán bộ nghiệp vụ'
    );
  }, [currentUser]);

  // Sync accordion expansion when pathname changes
  useEffect(() => {
    if (pathname.startsWith('/pcn')) setPcnOpen(true);
    if (pathname.startsWith('/pgd')) setPgdOpen(true);
  }, [pathname]);

  const navGroups: NavGroup[] = [
    {
      groupTitle: 'Tổng quan',
      visible: true,
      tone: 'shared',
      items: [
        {
          title: 'Bàn làm việc',
          href: '/',
          icon: LayoutDashboard,
          tone: 'shared',
          exact: true,
        },
      ],
    },
    {
      groupTitle: 'Chứng nhận · PCN',
      visible: hasPcn,
      tone: 'pcn',
      collapsible: true,
      defaultOpen: pcnOpen,
      items: [
        {
          title: 'Hàng đợi hồ sơ PCN',
          href: '/pcn',
          icon: Award,
          tone: 'pcn',
          exact: true,
        },
        {
          title: 'Sổ tổng hợp PCN',
          href: '/pcn?tab=operations',
          icon: ClipboardList,
          tone: 'pcn',
        },
        {
          title: 'Sổ quản lý mẫu PCN',
          href: '/pcn?tab=samples',
          icon: FlaskConical,
          tone: 'pcn',
        },
      ],
    },
    {
      groupTitle: 'Giám định · PGD',
      visible: hasPgd,
      tone: 'pgd',
      collapsible: true,
      defaultOpen: pgdOpen,
      items: [
        {
          title: 'Hàng đợi PYC Giám định',
          href: '/pgd',
          icon: ClipboardCheck,
          tone: 'pgd',
          exact: true,
        },
        {
          title: 'Sổ tổng hợp PGD',
          href: '/pgd?tab=operations',
          icon: Layers,
          tone: 'pgd',
        },
        {
          title: 'Sổ quản lý mẫu PGD',
          href: '/pgd?tab=samples',
          icon: FlaskConical,
          tone: 'pgd',
        },
      ],
    },
    {
      groupTitle: 'Bộ mẫu & Quy trình',
      visible: canManageTemplates,
      tone: 'shared',
      items: [
        {
          title: 'Hồ sơ mẫu & Quy trình',
          href: '/templates',
          icon: GitBranch,
          tone: 'shared',
        },
      ],
    },
    {
      groupTitle: 'Soạn thảo văn bản',
      visible: true,
      tone: 'shared',
      items: [
        {
          title: 'Studio soạn thảo DOCX',
          href: '/drafting',
          icon: FileEdit,
          tone: 'shared',
        },
      ],
    },
    {
      groupTitle: 'Quản trị hệ thống',
      visible: true,
      tone: 'shared',
      items: [
        {
          title: 'Danh bạ khách hàng',
          href: '/customers',
          icon: Building2,
          tone: 'shared',
        },
        {
          title: 'Nhật ký hoạt động',
          href: '/activity-logs',
          icon: Activity,
          tone: 'shared',
        },
        ...(canManageSettings
          ? [
              {
                title: 'Cài đặt & RBAC',
                href: '/settings',
                icon: Settings,
                tone: 'shared' as NavTone,
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

  /**
   * Deterministic active detection supporting query params (tab=...)
   */
  const isItemActive = (href: string, exact = false) => {
    const [baseUrl, query] = href.split('?');
    const targetParams = new URLSearchParams(query || '');
    const targetTab = targetParams.get('tab');

    if (baseUrl === '/pcn' || baseUrl === '/pgd') {
      const isBaseMatch = pathname === baseUrl || pathname.startsWith(`${baseUrl}/`);
      if (!isBaseMatch) return false;

      const currentTab = searchParams?.get('tab') || null;
      if (targetTab) {
        return currentTab === targetTab;
      }
      return !currentTab || currentTab === 'queue';
    }

    if (exact) return pathname === href;
    return pathname.startsWith(baseUrl) && (baseUrl !== '/' || pathname === '/');
  };

  /**
   * Visual style mapping adhering to ui-ux-pro-max standard
   */
  const getItemStyles = (active: boolean, tone: NavTone = 'shared') => {
    if (!active) {
      return {
        container: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium',
        icon: 'text-slate-400 group-hover:text-slate-200',
        indicator: '',
      };
    }

    if (tone === 'pcn') {
      return {
        container: 'bg-emerald-600 text-white font-semibold shadow-2xs',
        icon: 'text-white',
        indicator: '',
      };
    }

    if (tone === 'pgd') {
      return {
        container: 'bg-blue-600 text-white font-semibold shadow-2xs',
        icon: 'text-white',
        indicator: '',
      };
    }

    // Shared default
    return {
      container: 'bg-slate-800 text-white font-semibold ring-1 ring-slate-700/80 shadow-2xs',
      icon: 'text-emerald-400',
      indicator: '',
    };
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200 select-none">
      {/* Brand Header */}
      <div
        className={`flex h-11 shrink-0 items-center border-b border-slate-800/80 px-2.5 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1"
          title="Về trang chủ PGDCN"
        >
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-0.5 shadow-2xs ring-1 ring-slate-700/60">
            <img
              src="/icons/iemm-logo-192.png"
              alt="TVCI Logo"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black tracking-wider text-white uppercase truncate">
                PGDCN · TVCI
              </span>
              <span className="text-[10px] font-medium text-slate-400 truncate">
                Giám định & Chứng nhận
              </span>
            </div>
          )}
        </Link>

        {mobileOpen && (
          <button
            type="button"
            onClick={closeMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Đóng thanh điều hướng"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation Group List */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-slate-800" aria-label="Điều hướng chính">
        {navGroups
          .filter((group) => group.visible)
          .map((group, groupIdx) => {
            const isPcnGroup = group.groupTitle.includes('PCN');
            const isPgdGroup = group.groupTitle.includes('PGD');
            const isOpen = isPcnGroup ? pcnOpen : isPgdGroup ? pgdOpen : true;
            const setIsOpen = isPcnGroup ? setPcnOpen : isPgdGroup ? setPgdOpen : undefined;

            return (
              <div key={groupIdx} className={`${groupIdx > 0 ? 'pt-1.5 border-t border-slate-800/40' : ''}`}>
                {!collapsed && (
                  group.collapsible && setIsOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsOpen(!isOpen)}
                      aria-expanded={isOpen}
                      className="group/btn flex w-full items-center justify-between px-2 py-1 mb-0.5 rounded-md text-left transition-colors hover:bg-slate-800/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label={`Mở rộng hoặc thu gọn ${group.groupTitle}`}
                    >
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 group-hover/btn:text-slate-200 uppercase transition-colors">
                        {group.groupTitle}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`text-slate-400 group-hover/btn:text-slate-200 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="flex items-center justify-between px-2 py-0.5 mb-0.5">
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        {group.groupTitle}
                      </span>
                    </div>
                  )
                )}

                {/* Items */}
                {isOpen && (
                  <div className="space-y-0.5">
                    {group.items.map((item, itemIdx) => {
                      const active = isItemActive(item.href, item.exact);
                      const Icon = item.icon;
                      const styles = getItemStyles(active, item.tone || group.tone);

                      return (
                        <div key={itemIdx} className="relative group">
                          <Link
                            href={item.href}
                            onClick={() => {
                              if (mobileOpen) closeMobile();
                            }}
                            aria-current={active ? 'page' : undefined}
                            className={`relative flex items-center rounded-lg text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                              styles.container
                            } ${
                              collapsed
                                ? 'h-8 w-8 mx-auto justify-center p-0'
                                : 'gap-2 px-2 py-1.5'
                            }`}
                          >
                            <Icon
                              size={15}
                              className={`shrink-0 transition-colors ${styles.icon}`}
                            />
                            {!collapsed && (
                              <span className="truncate text-[11px] leading-tight">
                                {item.title}
                              </span>
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

                          {/* Floating Tooltip in Collapsed Mode */}
                          {collapsed && (
                            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-xl z-50 group-hover:block transition-opacity">
                              {item.title}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Footer Profile & Collapse Toggle */}
      <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/70 p-2 backdrop-blur-xs">
        <div className={`flex items-center gap-2 p-0.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-[11px] font-bold text-emerald-400 uppercase ring-1 ring-emerald-500/30">
            {currentUser.name
              ? currentUser.name.trim().split(/\s+/).pop()?.slice(0, 2).toUpperCase()
              : 'US'}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-100">
                {currentUser.name || currentUser.username}
              </p>
              <p className="truncate text-[10px] text-slate-400 font-medium">
                {managementRoleName}
              </p>
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-colors cursor-pointer"
            title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
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
            className="fixed inset-y-0 left-0 z-50 w-64 max-w-[calc(100vw-3rem)] shadow-2xl transition-transform"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-sidebar"
        aria-label="Thanh điều hướng chính"
        className={`hidden shrink-0 border-r border-slate-800/80 transition-[width] duration-200 ease-out lg:block ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Suspense
      fallback={
        <aside className="hidden lg:block w-56 shrink-0 bg-slate-900 border-r border-slate-800" />
      }
    >
      <AppSidebarInner {...props} />
    </Suspense>
  );
}
