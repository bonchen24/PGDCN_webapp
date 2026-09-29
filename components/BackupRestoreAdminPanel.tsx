'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  HardDriveDownload,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import type { UserAccount } from '../types';
import {
  deleteBackupFile,
  downloadBackupFile,
  fetchBackupList,
  restoreServerBackup,
  triggerServerBackup,
  verifyBackupFile,
  type ServerBackupInfo,
  type ServerBackupVerification,
} from '../utils/backupApi';
import { formatDateTimeDdMmYyyy } from '../utils/formatter';

interface BackupRestoreAdminPanelProps {
  currentUser: UserAccount | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function BackupRestoreAdminPanel({ currentUser }: BackupRestoreAdminPanelProps) {
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [pgToolAvailable, setPgToolAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<ServerBackupVerification | null>(null);

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<ServerBackupInfo | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Delete State
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const username = currentUser?.username || 'admin';
  const isAdmin = currentUser?.systemRole === 'admin' || currentUser?.role === 'admin';

  const loadBackups = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetchBackupList(username);
      setBackups(res.items || []);
      setPgToolAvailable(res.pgToolAvailable ?? true);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải danh sách bản sao lưu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, [username, isAdmin]);

  const handleCreateBackup = async () => {
    if (runningBackup) return;
    setRunningBackup(true);
    try {
      const result = await triggerServerBackup(username);
      toast.success(`Đã tạo bản sao lưu ${result.filename} thành công!`);
      await loadBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Tạo bản sao lưu thất bại.');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleVerify = async (filename: string) => {
    setVerifyingFile(filename);
    try {
      const result = await verifyBackupFile(username, filename);
      setVerificationResult(result);
      if (result.ok && result.status === 'VALID') {
        toast.success(`Bản sao lưu ${filename} hợp lệ (VALID).`);
      } else {
        toast.error(`Bản sao lưu ${filename} không hợp lệ hoặc thiếu tệp tin.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Kiểm chứng bản sao lưu thất bại.');
    } finally {
      setVerifyingFile(null);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await downloadBackupFile(username, filename);
      toast.success(`Đang tải xuống ${filename}...`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải xuống tệp sao lưu.');
    }
  };

  const handleDelete = async (filename: string) => {
    if (deletingFile) return;
    if (typeof window !== 'undefined' && !window.confirm(`Xác nhận xóa vĩnh viễn tệp sao lưu ${filename}?`)) {
      return;
    }
    setDeletingFile(filename);
    try {
      await deleteBackupFile(username, filename);
      toast.success(`Đã xóa tệp sao lưu ${filename}.`);
      await loadBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa tệp sao lưu.');
    } finally {
      setDeletingFile(null);
    }
  };

  const executeRestore = async () => {
    if (!restoreTarget || restoring || restoreConfirmText.trim() !== 'KHOIPHUC') return;
    setRestoring(true);
    try {
      await restoreServerBackup(username, restoreTarget.filename);
      toast.success(`Đã khôi phục dữ liệu từ ${restoreTarget.filename} thành công!`);
      setRestoreTarget(null);
      setRestoreConfirmText('');
    } catch (err: any) {
      toast.error(err?.message || 'Khôi phục dữ liệu thất bại.');
    } finally {
      setRestoring(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <section
      data-testid="backup-restore-admin-panel"
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4 space-y-3"
      aria-label="Quản lý sao lưu và phục hồi dữ liệu hệ thống"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <Database size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800">Sao lưu &amp; Phục hồi hệ thống</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Quản trị bản sao lưu cơ sở dữ liệu PostgreSQL và tài liệu lưu trữ máy chủ.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadBackups()}
            disabled={loading}
            className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={runningBackup || !pgToolAvailable}
            className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {runningBackup ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Tạo bản sao lưu ngay
          </button>
        </div>
      </div>

      {!pgToolAvailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Công cụ PostgreSQL (`pg_dump` / `pg_restore`) chưa khả dụng trên máy chủ. Chức năng sao lưu có thể bị giới hạn.</span>
        </div>
      )}

      {/* Danh sách bản sao lưu */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5">Tên tệp sao lưu</th>
                <th className="px-3 py-2.5">Dung lượng</th>
                <th className="px-3 py-2.5">Thời điểm tạo</th>
                <th className="px-3.5 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[11px] text-slate-400">
                    {loading ? 'Đang tải danh sách bản sao lưu…' : 'Chưa có bản sao lưu nào trong kho lưu trữ.'}
                  </td>
                </tr>
              ) : (
                backups.map((item) => (
                  <tr key={item.filename} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileArchive size={15} className="shrink-0 text-emerald-600" />
                        <span className="font-mono text-xs font-bold">{item.filename}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {formatBytes(item.sizeBytes)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {formatDateTimeDdMmYyyy(item.createdAt) || item.createdAt}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={verifyingFile === item.filename}
                          onClick={() => void handleVerify(item.filename)}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50"
                          title="Kiểm tra tính toàn vẹn"
                        >
                          {verifyingFile === item.filename ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          Kiểm chứng
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDownload(item.filename)}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-emerald-300"
                          title="Tải về máy tính"
                        >
                          <Download size={12} /> Tải về
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRestoreTarget(item);
                            setRestoreConfirmText('');
                          }}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                          title="Phục hồi dữ liệu từ bản sao lưu này"
                        >
                          <HardDriveDownload size={12} /> Phục hồi
                        </button>

                        <button
                          type="button"
                          disabled={deletingFile === item.filename}
                          onClick={() => void handleDelete(item.filename)}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          title="Xóa tệp sao lưu"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kết quả kiểm chứng chi tiết */}
      {verificationResult && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              {verificationResult.ok && verificationResult.status === 'VALID' ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <XCircle size={16} className="text-rose-600" />
              )}
              Kết quả kiểm chứng: <span className="font-mono">{verificationResult.filename}</span>
            </div>
            <button
              type="button"
              onClick={() => setVerificationResult(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 md:grid-cols-4 text-[11px] text-slate-600">
            <div>Định dạng: <b className="text-slate-800">{verificationResult.format}</b></div>
            <div>Dung lượng: <b className="text-slate-800">{formatBytes(verificationResult.sizeBytes)}</b></div>
            <div>Bản dump CSDL: <b className={verificationResult.databaseDumpPresent ? 'text-emerald-700' : 'text-rose-700'}>{verificationResult.databaseDumpPresent ? 'Có' : 'Không'}</b></div>
            <div>Tệp Manifest: <b className={verificationResult.manifestPresent ? 'text-emerald-700' : 'text-rose-700'}>{verificationResult.manifestPresent ? 'Có' : 'Không'}</b></div>
            <div>Số đối tượng tệp: <b className="text-slate-800">{verificationResult.verifiedObjectCount}/{verificationResult.manifestObjectCount || verificationResult.objectEntryCount}</b></div>
            <div>Trạng thái chung: <span className={`inline-block rounded px-1.5 py-0.5 font-bold ${verificationResult.status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{verificationResult.status}</span></div>
          </div>
          {verificationResult.errors && verificationResult.errors.length > 0 && (
            <div className="mt-2 text-rose-700">
              <span className="font-bold">Lỗi phát hiện:</span>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[11px]">
                {verificationResult.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal Phục hồi CSDL yêu cầu gõ KHOIPHUC */}
      {restoreTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !restoring) setRestoreTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-amber-300 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-black text-sm">
                <ShieldAlert size={18} />
                <h3 id="restore-modal-title">Cảnh báo Phục hồi Dữ liệu</h3>
              </div>
              <button
                type="button"
                disabled={restoring}
                onClick={() => setRestoreTarget(null)}
                className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700"
                aria-label="Đóng hộp thoại"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p>
                Bạn đang chuẩn bị phục hồi hệ thống từ bản sao lưu:
              </p>
              <p className="rounded-lg bg-slate-100 p-2 font-mono text-[11px] font-bold text-slate-800 break-all">
                {restoreTarget.filename} ({formatBytes(restoreTarget.sizeBytes)})
              </p>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800 font-medium">
                ⚠️ Thao tác này sẽ ghi đè toàn bộ cơ sở dữ liệu hiện tại bằng dữ liệu của bản sao lưu. Các thay đổi sau thời điểm tạo bản sao lưu này có thể bị mất.
              </div>
              <p className="font-bold text-slate-800 pt-1">
                Để xác nhận, vui lòng gõ chính xác chữ <span className="font-mono text-rose-600 select-all">KHOIPHUC</span> vào ô dưới đây:
              </p>
              <input
                type="text"
                autoFocus
                disabled={restoring}
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                placeholder="Nhập KHOIPHUC..."
                className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setRestoreTarget(null)}
                className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={restoring || restoreConfirmText.trim() !== 'KHOIPHUC'}
                onClick={() => void executeRestore()}
                className="mobile-touch-target min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500 disabled:opacity-40 transition-colors"
              >
                {restoring ? 'Đang phục hồi…' : 'Xác nhận Phục hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default BackupRestoreAdminPanel;
