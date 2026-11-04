'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, Activity } from 'lucide-react';

import type { PcnUserAccount } from '@/types';
import { clearPcnSession } from '@/utils/pcnAuthApi';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS } from '@/types';

interface UserNavProps {
  currentUser: PcnUserAccount;
}

export function UserNav({ currentUser }: UserNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);

  const managementRoleName = useMemo(() => {
    return (
      ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((r) => r.code === currentUser.managementRoleCode)?.name ||
      currentUser.position ||
      'Cán bộ chuyên môn'
    );
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    try {
      await clearPcnSession();
    } catch {}
    clearCurrentUser();
    router.replace('/login');
  };

  const initials = useMemo(() => {
    if (!currentUser.name) return 'US';
    const parts = currentUser.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }, [currentUser.name]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Menu tài khoản người dùng"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-2.5 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-3xs cursor-pointer"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">
          {initials}
        </div>
        <span className="hidden sm:inline-block max-w-[120px] truncate font-bold text-slate-900">
          {currentUser.name || currentUser.username}
        </span>
        {currentUser.systemRole === 'admin' && (
          <span className="hidden sm:inline-block rounded bg-rose-50 border border-rose-200 px-1 py-0.2 text-[9px] font-black text-rose-700 uppercase">
            Quản trị
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          role="menu"
          aria-label="Tùy chọn tài khoản"
          className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-1 text-xs"
        >
          {/* Identity Header */}
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="font-black text-slate-900">{currentUser.name || currentUser.username}</p>
            <p className="text-[11px] text-slate-500">@{currentUser.username}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                {managementRoleName}
              </span>
              <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 uppercase">
                {currentUser.systemRole === 'admin' ? 'Quản trị viên' : 'Chuyên viên'}
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push('/activity-logs');
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <Activity size={14} className="text-slate-400" />
              <span>Nhật ký của tôi</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push('/settings');
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <Settings size={14} className="text-slate-400" />
              <span>Thiết lập & Cài đặt</span>
            </button>
          </div>

          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
            >
              <LogOut size={14} className="text-rose-500" />
              <span>Đăng xuất hệ thống</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
