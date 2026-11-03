'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Trash2, X, Inbox } from 'lucide-react';

import type { AppNotification, PcnUserAccount } from '@/types';
import {
  fetchPgdcnNotifications,
  markPgdcnNotificationRead,
  markAllPgdcnNotificationsRead,
  clearPgdcnNotifications,
} from '@/utils/pgdcnNotificationApi';
import { formatDateTimeDdMmYyyy } from '@/utils/formatter';
import { toast } from 'sonner';

interface NotificationBellProps {
  currentUser: PcnUserAccount;
}

export function NotificationBell({ currentUser }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const items = await fetchPgdcnNotifications();
      setNotifications(items);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // 1-minute auto poll
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllPgdcnNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Đã đánh dấu đọc tất cả thông báo');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể đánh dấu đọc');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearPgdcnNotifications();
      setNotifications([]);
      toast.success('Đã xóa danh sách thông báo');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa thông báo');
    }
  };

  const handleSelectNotification = async (notif: AppNotification) => {
    if (!notif.read) {
      try {
        await markPgdcnNotificationRead(notif.id);
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      } catch {}
    }

    setOpen(false);

    // Route target navigation
    if (notif.domain === 'PGD') {
      if (notif.entityId) {
        router.push(`/pgd/dossiers/${notif.entityId}`);
      } else {
        router.push('/pgd');
      }
    } else {
      if (notif.entityId) {
        router.push(`/pcn/dossiers/${notif.entityId}`);
      } else {
        router.push('/pcn');
      }
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Thông báo phòng ban"
        aria-expanded={open}
        title="Thông báo phòng ban"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-3xs cursor-pointer"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Danh sách thông báo phòng ban"
          className="absolute right-0 top-10 z-50 w-80 sm:w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
            <div>
              <h3 className="text-xs font-black text-slate-900">Thông báo phòng ban</h3>
              <p className="text-[10px] text-slate-500">
                {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Đánh dấu tất cả đã đọc"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                <CheckCheck size={14} />
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                title="Xóa tất cả thông báo"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Đóng"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <Inbox size={24} className="mb-1 text-slate-300" />
                <p className="text-xs">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isPgd = item.domain === 'PGD';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNotification(item)}
                    className={`flex w-full items-start gap-2.5 p-3 text-left transition-colors hover:bg-slate-50 cursor-pointer ${
                      item.read ? 'bg-white opacity-85' : 'bg-emerald-50/40'
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isPgd ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.domain || 'PCN'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs font-bold text-slate-900">{item.title}</span>
                        {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{item.message}</p>
                      <span className="mt-1 block text-[9px] text-slate-400">
                        {formatDateTimeDdMmYyyy(item.createdAt) || 'Vừa xong'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
