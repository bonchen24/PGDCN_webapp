'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Search,
  RefreshCw,
  Home,
} from 'lucide-react';

import { useSidebar } from '@/hooks/use-sidebar';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { NotificationBell } from './notification-bell';
import { UserNav } from './user-nav';
import type { PcnUserAccount } from '@/types';
import { toast } from 'sonner';

interface AppHeaderProps {
  currentUser: PcnUserAccount;
  onOpenCommand: () => void;
  onRefreshData?: () => void;
}

export function AppHeader({ currentUser, onOpenCommand, onRefreshData }: AppHeaderProps) {
  const pathname = usePathname();
  const { collapsed, toggleCollapse, openMobile } = useSidebar();
  const breadcrumbs = useBreadcrumbs();

  const domainPill = useMemo(() => {
    if (pathname.startsWith('/pcn')) {
      return { text: 'PCN · CHỨNG NHẬN', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (pathname.startsWith('/pgd')) {
      return { text: 'PGD · GIÁM ĐỊNH', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (pathname.startsWith('/templates')) {
      return { text: 'QUY TRÌNH & BỘ MẪU', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    if (pathname.startsWith('/drafting')) {
      return { text: 'SOẠN THẢO VĂN BẢN', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (pathname.startsWith('/settings')) {
      return { text: 'QUẢN TRỊ HỆ THỐNG', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    return { text: 'TỔNG QUAN PHÒNG', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }, [pathname]);

  const handleRefresh = () => {
    if (onRefreshData) {
      onRefreshData();
    } else {
      window.location.reload();
    }
    toast.success('Đang làm mới dữ liệu...');
  };

  return (
    <header className="app-compact-header sticky top-0 z-40 flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-2.5 backdrop-blur-xs shadow-3xs md:px-4">
      {/* Left: Mobile trigger, Collapse toggle, Subsystem Pill, Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={openMobile}
          aria-label="Mở menu di động"
          className="mobile-touch-target flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden cursor-pointer"
        >
          <Menu size={17} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:flex transition-colors cursor-pointer"
          title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>

        {/* Subsystem context pill */}
        <span
          className={`hidden md:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${domainPill.color}`}
        >
          {domainPill.text}
        </span>

        {/* Dynamic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={11} className="shrink-0 text-slate-400" aria-hidden="true" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate font-medium text-slate-600 hover:text-emerald-700 hover:underline transition-colors max-w-[140px] sm:max-w-[200px]"
                >
                  {crumb.label === 'Trang chủ' ? (
                    <span className="flex items-center gap-1">
                      <Home size={11} />
                      <span className="hidden sm:inline">Trang chủ</span>
                    </span>
                  ) : (
                    crumb.label
                  )}
                </Link>
              ) : (
                <span
                  className="truncate font-bold text-slate-900 max-w-[160px] sm:max-w-[260px]"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Quick Search Button, Reload, Notifications, User Nav */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Command Palette Trigger Button */}
        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Tìm kiếm nhanh hồ sơ, khách hàng (Ctrl+K)"
          className="mobile-touch-target flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-3xs cursor-pointer"
        >
          <Search size={13} className="text-slate-400 shrink-0" />
          <span className="hidden sm:inline text-[11px] font-medium text-slate-600">Tìm kiếm...</span>
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-white px-1 py-0.2 text-[9px] font-mono text-slate-500">
            Ctrl+K
          </kbd>
        </button>

        {/* Data Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Làm mới dữ liệu"
          title="Làm mới dữ liệu"
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer shadow-3xs"
        >
          <RefreshCw size={13} />
        </button>

        {/* Notification Bell Badge & Dropdown */}
        <NotificationBell currentUser={currentUser} />

        {/* User Navigation Dropdown */}
        <UserNav currentUser={currentUser} />
      </div>
    </header>
  );
}
