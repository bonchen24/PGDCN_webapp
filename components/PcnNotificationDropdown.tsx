'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Bell, CheckCheck, FileText, Inbox, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AppNotification, UserAccount } from '../types';
import { canViewNotification } from '../utils/notificationEvents';
import { formatDateDdMmYyyy } from '../utils/formatter';

interface PcnNotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  currentUser: UserAccount | null;
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onSelect: (notification: AppNotification) => void;
}

function timeLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Chưa xác định';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return formatDateDdMmYyyy(new Date(timestamp));
}

export function PcnNotificationDropdown({ isOpen, onClose, notifications, currentUser, onMarkRead, onMarkAllRead, onClear, onSelect }: PcnNotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => canViewNotification(notification, currentUser)).slice(0, 50),
    [currentUser, notifications],
  );
  const unreadCount = visibleNotifications.filter((notification) => !notification.read).length;
  const canManageNotifications = currentUser?.systemRole !== 'viewer' && currentUser?.role !== 'viewer';
  const [busyNotificationAction, setBusyNotificationAction] = useState<string | null>(null);

  const runNotificationAction = async (actionId: string, action: () => void | Promise<void>, fallbackMessage: string) => {
    if (busyNotificationAction !== null) return;
    setBusyNotificationAction(actionId);
    try {
      await action();
    } catch (error: any) {
      toast.error(error?.message || fallbackMessage);
    } finally {
      setBusyNotificationAction(null);
    }
  };

  const markNotificationRead = (notification: AppNotification) => {
    if (!canManageNotifications) {
      onSelect(notification);
      onClose();
      return;
    }
    void runNotificationAction(`read:${notification.id}`, async () => {
      await onMarkRead(notification.id);
      onSelect(notification);
      onClose();
    }, 'Không thể đánh dấu thông báo đã đọc.');
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2.5 text-white">
        <div className="flex items-center gap-2"><span className="rounded-lg bg-amber-500/20 p-1.5 text-amber-300"><Bell size={15} /></span><div><div className="text-xs font-black">Thông báo PCN</div><div className="text-[10px] text-slate-400">Tiến độ hồ sơ và công việc nghiệp vụ</div></div></div>
        <div className="flex items-center gap-2"><span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black">{unreadCount} mới</span><button type="button" onClick={onClose} aria-label="Đóng thông báo" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={15} /></button></div>
      </div>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600"><span>{visibleNotifications.length} thông báo</span><div className="flex items-center gap-2">{!canManageNotifications && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-500">Chỉ xem</span>}{canManageNotifications && unreadCount > 0 && <button type="button" disabled={busyNotificationAction !== null} onClick={() => void runNotificationAction('mark-all', onMarkAllRead, 'Không thể đánh dấu thông báo đã đọc.')} className="inline-flex items-center gap-1 text-emerald-700 hover:underline disabled:cursor-wait disabled:opacity-50"><CheckCheck size={12} /> Đọc tất cả</button>}{canManageNotifications && visibleNotifications.length > 0 && <button type="button" disabled={busyNotificationAction !== null} onClick={() => void runNotificationAction('clear', onClear, 'Không thể xóa thông báo.')} className="text-slate-400 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50">Xóa</button>}</div></div>
      <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {visibleNotifications.length === 0 ? <div className="flex flex-col items-center px-4 py-10 text-center text-slate-400"><Inbox size={30} className="mb-2 text-slate-300" /><p className="text-xs font-bold text-slate-500">Chưa có thông báo PCN</p><p className="mt-1 text-[10px]">Thông báo sẽ xuất hiện khi hồ sơ có thay đổi nghiệp vụ lớn.</p></div> : visibleNotifications.map((notification) => <button type="button" key={notification.id} disabled={busyNotificationAction !== null} onClick={() => markNotificationRead(notification)} className={`flex w-full gap-2.5 px-3 py-3 text-left transition-colors hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60 ${notification.read ? 'bg-white' : 'bg-amber-50/60'}`}><span className={`mt-0.5 rounded-lg p-1.5 ${notification.read ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-700'}`}><FileText size={14} /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-[11px] font-black text-slate-800">{notification.title}</span><span className="shrink-0 text-[9px] font-medium text-slate-400">{timeLabel(notification.createdAt)}</span></span><span className="mt-1 block text-[10px] leading-4 text-slate-600">{notification.message}</span>{notification.entityLabel && <span className="mt-1 block font-mono text-[9px] font-bold text-emerald-700">{notification.entityLabel}</span>}</span></button>)}
      </div>
    </div>
  );
}

// --- End of PcnNotificationDropdown.tsx ---
