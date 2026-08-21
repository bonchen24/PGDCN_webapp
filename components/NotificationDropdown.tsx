// Author: Gemini
// OS support: Web/Node
// Description: NotificationDropdown component filtering business notifications by audience and managing Windows system notifications

import React, { useRef, useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, X, FileText, Clock, User, ChevronRight, Inbox, Monitor, Volume2, ClipboardList, FlaskConical, CalendarDays, UserRoundPlus } from 'lucide-react';
import { useStore } from '../store';
import { AppNotification } from '../types';
import { formatDateVN } from '../utils/formatter';
import { canViewNotification } from '../utils/notificationEvents';
import { getNotificationDestination } from '../utils/notificationNavigation';
import { 
  getNotificationPermission, 
  requestWindowsNotificationPermission, 
  sendWindowsNotification 
} from '../utils/windowNotification';
import { toast } from 'sonner';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRequest?: (requestCode: string) => void;
  onSelectNotification?: (notification: AppNotification) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onSelectRequest,
  onSelectNotification,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [winPermission, setWinPermission] = useState<NotificationPermission>('default');

  const { 
    notifications = [], 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    clearNotifications,
    currentUser 
  } = useStore();

  useEffect(() => {
    setWinPermission(getNotificationPermission());
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const relevantNotifications = notifications.filter(n => {
    return canViewNotification(n, currentUser);
  });

  const unreadCount = relevantNotifications.filter(n => !n.read).length;

  const handleEnableWindowsNotif = async () => {
    const granted = await requestWindowsNotificationPermission();
    const updatedPerm = getNotificationPermission();
    setWinPermission(updatedPerm);
    if (granted) {
      toast.success("Đã bật thông báo Windows thành công!");
      sendWindowsNotification("DDT LAB Web App", {
        body: "Thông báo Windows hệ thống đã được kích hoạt thành công!"
      });
    } else {
      toast.error("Trình duyệt hoặc hệ thống chưa cấp quyền thông báo Windows.");
    }
  };

  const handleTestWindowsNotif = async () => {
    if (winPermission !== 'granted') {
      await handleEnableWindowsNotif();
      return;
    }
    const success = await sendWindowsNotification("Thử nghiệm thông báo Windows", {
      body: "Đây là thông báo mẫu trên màn hình Windows từ ứng dụng DDT LAB."
    });
    if (success) {
      toast.info("Đã gửi thông báo thử nghiệm tới Windows Notification Center!");
    } else {
      toast.error("Không thể hiển thị thông báo Windows.");
    }
  };

  const handleItemClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    if (onSelectNotification) {
      onSelectNotification(notif);
    } else if (notif.requestCode && onSelectRequest) {
      onSelectRequest(notif.requestCode);
    }
    onClose();
  };

  const getNotificationIcon = (notification: AppNotification) => {
    if (notification.entityType === 'HANDOVER_DOC') return <ClipboardList size={16} />;
    if (notification.entityType === 'KQTN_RECORD') return <FlaskConical size={16} />;
    if (notification.entityType === 'SCHEDULE') return <CalendarDays size={16} />;
    if (notification.action === 'ASSIGNED') return <UserRoundPlus size={16} />;
    return <FileText size={16} />;
  };

  const getNotificationReference = (notification: AppNotification) =>
    notification.entityLabel || notification.requestCode || notification.docNumber || notification.reportNo;

  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return formatDateVN(isoString);
    } catch {
      return isoString;
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-slate-900 text-white p-3 px-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
            <Bell size={16} />
          </div>
          <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">Thông báo nghiệp vụ</h3>
            <p className="text-[10px] text-slate-400">Phiếu, biên bản, KQTN, lịch và công việc được giao</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount} mới
            </span>
          )}
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
          <Monitor size={14} className="text-indigo-600" />
          <span>Thông báo Windows:</span>
          {winPermission === 'granted' ? (
            <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">Đã bật</span>
          ) : winPermission === 'denied' ? (
            <span className="text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">Bị chặn</span>
          ) : (
            <span className="text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">Chưa bật</span>
          )}
        </div>

        {winPermission === 'granted' ? (
          <button
            onClick={handleTestWindowsNotif}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
            title="Bấm để thử nghiệm hiển thị thông báo trên màn hình Windows"
          >
            <Volume2 size={12} />
            <span>Thử thông báo</span>
          </button>
        ) : (
          <button
            onClick={handleEnableWindowsNotif}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
            title="Bật tính năng đẩy thông báo trực tiếp lên Windows"
          >
            <Bell size={12} />
            <span>Kích hoạt ngay</span>
          </button>
        )}
      </div>

      <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-600">
        <span>Tổng cộng: {relevantNotifications.length} thông báo</span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllNotificationsAsRead()}
              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline transition-all"
              title="Đánh dấu tất cả là đã đọc"
            >
              <CheckCheck size={13} />
              <span>Đã đọc tất cả</span>
            </button>
          )}
          {relevantNotifications.length > 0 && (
            <button
              onClick={() => clearNotifications()}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors"
              title="Xóa tất cả thông báo"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {relevantNotifications.length === 0 ? (
          <div className="py-10 px-4 text-center text-slate-400 flex flex-col items-center justify-center">
            <Inbox size={32} className="mb-2 text-slate-300 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-500">Chưa có thông báo mới nào</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Thông báo sẽ xuất hiện khi có hoạt động phù hợp với tài khoản</p>
          </div>
        ) : (
          relevantNotifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`p-3 transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-100/80 ${
                !notif.read ? 'bg-amber-50/60 border-l-4 border-l-amber-500' : 'bg-white'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                !notif.read ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {getNotificationIcon(notif)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate">{notif.title}</span>
                    {getNotificationReference(notif) && (
                      <span className="font-mono text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                        {getNotificationReference(notif)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                    <Clock size={10} />
                    {formatTimeAgo(notif.createdAt)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight font-medium">
                  {notif.message}
                </p>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                  {notif.createdBy ? (
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      Tạo bởi: <strong className="text-slate-600">{notif.createdBy}</strong>
                    </span>
                  ) : <span />}
                  {getNotificationDestination(notif).kind !== 'none' && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Xem chi tiết <ChevronRight size={10} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- End of NotificationDropdown.tsx ---
