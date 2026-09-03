'use client';

import { useMemo } from 'react';
import { Bell, Check, CheckCheck, Inbox, X } from 'lucide-react';

import type { AppNotification, UserAccount } from '../types';
import { canViewPgdcnNotification, normalizePgdcnNotification } from '../utils/pgdcnNotification';

interface PgdcnNotificationDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
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
  if (!Number.isFinite(timestamp)) return 'Vừa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp);
}

function canMutateNotifications(user: UserAccount | null): boolean {
  return Boolean(user && user.role !== 'viewer' && user.systemRole !== 'viewer');
}

export function PgdcnNotificationDropdown({
  isOpen,
  onToggle,
  onClose,
  notifications,
  currentUser,
  onMarkRead,
  onMarkAllRead,
  onClear,
  onSelect,
}: PgdcnNotificationDropdownProps) {
  const visibleNotifications = useMemo(() => notifications
    .filter((notification) => canViewPgdcnNotification(notification, currentUser))
    .map(normalizePgdcnNotification)
    .slice(0, 50), [currentUser, notifications]);
  const unreadCount = visibleNotifications.filter((notification) => !notification.read).length;
  const canMutate = canMutateNotifications(currentUser);

  const selectNotification = (notification: AppNotification) => {
    if (!notification.read && canMutate) void onMarkRead(notification.id);
    onSelect(notification);
    onClose();
  };

  return <div className="relative shrink-0">
    <button
      type="button"
      onClick={onToggle}
      aria-label="Thông báo phòng"
      aria-expanded={isOpen}
      title="Thông báo phòng"
      className="mobile-touch-target relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
    >
      <Bell size={17} />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {isOpen && <div role="dialog" aria-label="Danh sách thông báo phòng" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0"><h2 className="text-xs font-black text-slate-900">Thông báo phòng</h2><p className="text-[10px] text-slate-400">{unreadCount ? `${unreadCount} chưa đọc` : 'Đã xem hết'}</p></div>
        <div className="flex shrink-0 items-center gap-1">
          {canMutate && <><button type="button" onClick={() => void onMarkAllRead()} aria-label="Đọc tất cả" title="Đọc tất cả" className="mobile-touch-target rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"><CheckCheck size={15} /></button><button type="button" onClick={() => void onClear()} aria-label="Xóa thông báo" title="Xóa thông báo" className="mobile-touch-target rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button></>}
          <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="mobile-touch-target rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={15} /></button>
        </div>
      </div>
      <div className="mobile-scroll-y max-h-[min(30rem,calc(100vh-8rem))] overflow-y-auto">
        {visibleNotifications.length === 0 && <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-400"><Inbox size={24} /><p className="text-[11px]">Chưa có thông báo phòng.</p></div>}
        {visibleNotifications.map((notification) => {
          const domainLabel = notification.domain === 'PGD' ? 'PGD' : 'PCN';
          return <button
          key={notification.id}
          type="button"
          aria-label={notification.read ? 'Đã đọc' : 'Đánh dấu đã đọc'}
          onClick={() => selectNotification(notification)}
          className={`mobile-touch-target flex min-h-16 w-full min-w-0 items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 ${notification.read ? '' : 'bg-emerald-50/50'}`}
        >
          <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${domainLabel === 'PGD' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{domainLabel}</span>
          <span className="min-w-0 flex-1"><span className="flex items-start gap-1"><b className="min-w-0 flex-1 text-[11px] font-black text-slate-800">{notification.title}</b>{!notification.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Chưa đọc" />}</span><span className="mt-0.5 block break-words text-[10px] leading-4 text-slate-500">{notification.message}</span><span className="mt-1 block text-[9px] text-slate-400">{timeLabel(notification.createdAt)}{notification.targetUsernames?.length ? ` · ${notification.targetUsernames.length} người được giao` : ''}</span></span>
          {notification.read && <Check size={13} className="mt-1 shrink-0 text-slate-300" aria-label="Đã đọc" />}
        </button>;
        })}
      </div>
    </div>}
  </div>;
}
