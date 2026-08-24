// Author: Gemini
// OS support: Web/Node
// Description: Admin reminder for complete server backups with portable export options
import React from 'react';
import { ShieldAlert, Download, FileSpreadsheet, RefreshCw, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { formatDateVN } from '../utils/formatter';
import { exportAllToCSV } from '../utils/exportCsv';
import { buildBackupPayload, downloadBackupJson } from '../utils/notificationBackup';
import { activityLogClient } from '../utils/activityLogApi';
import { triggerServerBackup } from '../utils/backupApi';
import { toast } from 'sonner';

export const AdminBackupReminder: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { settings, updateSettings, requests, handoverDocs, customers, products, brands, currentUser } = useStore();
  const [isServerBackingUp, setIsServerBackingUp] = React.useState(false);

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) return null;

  const lastBackup = settings.lastBackupDate;
  let daysSinceLastBackup = 0;
  if (lastBackup) {
    const diffMs = Date.now() - new Date(lastBackup).getTime();
    daysSinceLastBackup = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } else {
    daysSinceLastBackup = 7;
  }

  const handleJsonBackup = async () => {
    try {
      const state = useStore.getState();
      const backupTimestamp = new Date().toISOString();
      const activityLogs = await activityLogClient.fetchAll();
      const data = buildBackupPayload(state, backupTimestamp, activityLogs);
      downloadBackupJson(data);

      toast.success("Đã xuất JSON portable; để sao lưu cả file PDF, hãy dùng 'Sao lưu đầy đủ'.");
    } catch (error: any) {
      console.error('Complete JSON backup failed:', error);
      toast.error(`Không thể tạo file sao lưu: ${error?.message || error}`);
    }
  };

  const handleServerBackup = async () => {
    if (!currentUser?.username || isServerBackingUp) return;
    setIsServerBackingUp(true);
    try {
      await triggerServerBackup(currentUser.username);
      const nowIso = new Date().toISOString();
      updateSettings({ lastBackupDate: nowIso });
      toast.success('Đã sao lưu đầy đủ database và file PDF KQTN trên máy chủ!');
    } catch (error: any) {
      console.error('Complete server backup failed:', error);
      toast.error(`Không thể sao lưu đầy đủ trên máy chủ: ${error?.message || error}`);
    } finally {
      setIsServerBackingUp(false);
    }
  };

  const handleCsvExport = () => {
    try {
      exportAllToCSV(requests, handoverDocs, customers, products, brands);
      toast.success("Đã xuất danh mục CSV portable thành công.");
    } catch (err: any) {
      toast.error("Lỗi khi xuất CSV: " + err.message);
    }
  };

  const handleResetCounter = () => {
    const nowIso = new Date().toISOString();
    updateSettings({ lastBackupDate: nowIso });
    toast.success("Đã đặt lại bộ đếm ngày sao lưu hôm nay!");
  };

  const isWarning = daysSinceLastBackup >= 7;

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isWarning 
        ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300 shadow-sm' 
        : 'bg-emerald-50/70 border-emerald-200'
    } ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
            isWarning ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-600 text-white'
          }`}>
            {isWarning ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-slate-800 tracking-tight">
                Bộ đếm ngày & Nhắc nhở sao lưu đầy đủ (Admin)
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isWarning 
                  ? 'bg-amber-200/80 text-amber-900 border border-amber-300' 
                  : 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
              }`}>
                {daysSinceLastBackup === 0 ? 'Đã sao lưu hôm nay' : `Đã ${daysSinceLastBackup} ngày chưa xuất bản sao lưu`}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isWarning ? (
                <span className="font-semibold text-amber-800">
                  ⚠️ Đã {daysSinceLastBackup} ngày chưa chạy backup đầy đủ trên máy chủ. Backup này gồm database, metadata file và file PDF KQTN.
                </span>
              ) : (
                <span>Dữ liệu phòng thử nghiệm an toàn. Lần sao lưu gần nhất: <b>{lastBackup ? formatDateVN(lastBackup) : 'Hôm nay'}</b>.</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleServerBackup}
            disabled={isServerBackingUp}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:cursor-wait"
            title="Sao lưu database và toàn bộ file PDF KQTN lên máy chủ"
          >
            <Download size={14} />
            <span>{isServerBackingUp ? 'Đang sao lưu...' : 'Sao lưu đầy đủ'}</span>
          </button>

          <button
            onClick={handleJsonBackup}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Xuất bản lưu cấu trúc dữ liệu JSON đầy đủ"
          >
            <Download size={14} />
            <span>Xuất JSON</span>
          </button>

          <button
            onClick={handleCsvExport}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Xuất dữ liệu Yêu cầu, Khách hàng & Biên bản dạng file CSV"
          >
            <FileSpreadsheet size={14} />
            <span>Xuất CSV</span>
          </button>

          <button
            onClick={handleResetCounter}
            className="px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Đặt lại bộ đếm ngày hôm nay"
          >
            <RefreshCw size={13} />
            <span>Đặt lại 0 ngày</span>
          </button>
        </div>

      </div>
    </div>
  );
};

// --- End of AdminBackupReminder.tsx ---
