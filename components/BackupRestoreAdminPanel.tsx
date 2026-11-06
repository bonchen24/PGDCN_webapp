'use client';

import React, { useEffect, useRef, useState } from 'react';
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

export interface DialogFocusTarget {
  focus: () => void;
  isConnected?: boolean;
}

export interface RestoreDialogFocusOptions {
  focusTarget?: 'opener' | 'fallback';
}

export function restoreDialogFocus(
  opener: DialogFocusTarget | null | undefined,
  fallback: DialogFocusTarget | null | undefined,
  options?: RestoreDialogFocusOptions,
): 'opener' | 'fallback' | 'none' {
  if (options?.focusTarget === 'fallback') {
    if (fallback && typeof fallback.focus === 'function') {
      fallback.focus();
      return 'fallback';
    }
    return 'none';
  }
  const isConnected = opener ? (typeof opener.isConnected === 'boolean' ? opener.isConnected : true) : false;
  if (opener && typeof opener.focus === 'function' && isConnected) {
    opener.focus();
    return 'opener';
  }
  if (fallback && typeof fallback.focus === 'function') {
    fallback.focus();
    return 'fallback';
  }
  return 'none';
}

export function isArchiveVerifiedForRestore(
  verified?: { ok?: boolean; status?: string } | null,
): boolean {
  if (!verified || !verified.ok) return false;
  if ('status' in verified && verified.status !== undefined && verified.status !== 'VALID') {
    return false;
  }
  return true;
}

export interface BackupActionHandlerOptions {
  type: 'delete' | 'restore';
  target: ServerBackupInfo | null;
  confirmInput: string;
  inFlightRef: { current: boolean };
  setBusy: (busy: boolean) => void;
  setDialogError: (error: string | null) => void;
  performApi: () => Promise<void>;
  onSuccess?: () => Promise<void> | void;
  forceCloseDialog: (options?: RestoreDialogFocusOptions) => void;
  onSuccessToast?: () => void;
  onErrorToast?: (msg: string) => void;
  defaultErrorMessage?: string;
}

export async function runBackupAction({
  type,
  target,
  confirmInput,
  inFlightRef,
  setBusy,
  setDialogError,
  performApi,
  onSuccess,
  forceCloseDialog,
  onSuccessToast,
  onErrorToast,
  defaultErrorMessage = 'Thao tác thất bại.',
}: BackupActionHandlerOptions): Promise<boolean> {
  if (inFlightRef.current || !target || confirmInput !== 'XAC NHAN') {
    return false;
  }
  inFlightRef.current = true;
  setBusy(true);
  setDialogError(null);
  try {
    await performApi();
    forceCloseDialog({ focusTarget: type === 'delete' ? 'fallback' : 'opener' });
    onSuccessToast?.();
  } catch (err: any) {
    const msg = err?.message || defaultErrorMessage;
    setDialogError(msg);
    onErrorToast?.(msg);
    return false;
  } finally {
    setBusy(false);
    inFlightRef.current = false;
  }

  if (onSuccess) {
    try {
      await onSuccess();
    } catch {
      // Refresh error must not reopen dialog or report as failed mutation
    }
  }

  return true;
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
  const [loadError, setLoadError] = useState<{ status?: number; message: string; isNetwork?: boolean } | null>(null);
  const [runningBackup, setRunningBackup] = useState(false);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<ServerBackupVerification | null>(null);
  const [verifiedFiles, setVerifiedFiles] = useState<Record<string, ServerBackupVerification>>({});

  // Dialog targets and state
  const [deleteTarget, setDeleteTarget] = useState<ServerBackupInfo | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ServerBackupInfo | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Focus & A11y management
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const actionInFlightRef = useRef(false);

  const isAdmin = currentUser?.active !== false && currentUser?.systemRole === 'admin';
  const isBusy = deleting || restoring || actionInFlightRef.current;

  const loadBackups = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchBackupList();
      setBackups(res.items || []);
      setPgToolAvailable(res.pgToolAvailable ?? true);
    } catch (err: any) {
      const rawMsg = err?.message || 'Không thể tải danh sách bản sao lưu.';
      const statusMatch = rawMsg.match(/HTTP\s*(\d+)/i) || (typeof err?.status === 'number' ? [null, err.status] : null);
      const status = statusMatch ? Number(statusMatch[1]) : undefined;
      const isNetwork = !status && (rawMsg.includes('Failed to fetch') || rawMsg.includes('network') || rawMsg.includes('Network') || rawMsg.includes('kết nối'));
      setLoadError({ status, message: rawMsg, isNetwork });
      toast.error(rawMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, [isAdmin]);

  // Reset confirmation input when target changes
  useEffect(() => {
    setConfirmInput('');
  }, [deleteTarget?.filename, restoreTarget?.filename]);

  // Initial focus into dialog input
  useEffect(() => {
    if (deleteTarget || restoreTarget) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [deleteTarget, restoreTarget]);

  const isArchiveVerified = (filename: string): boolean => {
    const verified = verifiedFiles[filename] || (verificationResult?.filename === filename ? verificationResult : null);
    return isArchiveVerifiedForRestore(verified);
  };

  const handleCreateBackup = async () => {
    if (runningBackup || isBusy) return;
    setRunningBackup(true);
    try {
      const result = await triggerServerBackup();
      toast.success(`Đã tạo bản sao lưu ${result.filename} thành công!`);
      await loadBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Tạo bản sao lưu thất bại.');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleVerify = async (filename: string) => {
    if (isBusy) return;
    setVerifyingFile(filename);
    try {
      const result = await verifyBackupFile(filename);
      setVerificationResult(result);
      setVerifiedFiles((prev) => ({ ...prev, [filename]: result }));
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
    if (isBusy) return;
    try {
      await downloadBackupFile(filename);
      toast.success(`Đang tải xuống ${filename}...`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải xuống tệp sao lưu.');
    }
  };

  const forceCloseDialog = (options?: RestoreDialogFocusOptions) => {
    setDeleteTarget(null);
    setRestoreTarget(null);
    setConfirmInput('');
    setDialogError(null);
    restoreDialogFocus(lastFocusedElementRef.current, panelRef.current, options);
  };

  const closeDialog = () => {
    if (deleting || restoring || actionInFlightRef.current) return;
    forceCloseDialog();
  };

  const handleOpenDelete = (item: ServerBackupInfo, triggerEl?: HTMLElement | null) => {
    if (isBusy) return;
    lastFocusedElementRef.current = triggerEl || (document.activeElement as HTMLElement | null);
    setRestoreTarget(null);
    setConfirmInput('');
    setDialogError(null);
    setDeleteTarget(item);
  };

  const handleOpenRestore = (item: ServerBackupInfo, triggerEl?: HTMLElement | null) => {
    if (isBusy) return;
    if (!isArchiveVerified(item.filename)) {
      toast.error('Bản sao lưu cần được kiểm chứng thành công (yêu cầu ok=true và status=VALID khi có trả về status) trước khi mở bước khôi phục. Vui lòng bấm "Kiểm chứng" trước.');
      return;
    }
    lastFocusedElementRef.current = triggerEl || (document.activeElement as HTMLElement | null);
    setDeleteTarget(null);
    setConfirmInput('');
    setDialogError(null);
    setRestoreTarget(item);
  };

  const executeDelete = async () => {
    if (!deleteTarget || deleting || confirmInput !== 'XAC NHAN') return;
    const targetFilename = deleteTarget.filename;
    await runBackupAction({
      type: 'delete',
      target: deleteTarget,
      confirmInput,
      inFlightRef: actionInFlightRef,
      setBusy: setDeleting,
      setDialogError,
      performApi: () => deleteBackupFile(targetFilename),
      onSuccess: async () => {
        await loadBackups();
      },
      forceCloseDialog,
      onSuccessToast: () => toast.success(`Đã xóa tệp sao lưu ${targetFilename}.`),
      onErrorToast: (msg) => toast.error(msg),
      defaultErrorMessage: 'Không thể xóa tệp sao lưu.',
    });
  };

  const executeRestore = async () => {
    if (!restoreTarget || restoring || confirmInput !== 'XAC NHAN') return;
    const targetFilename = restoreTarget.filename;
    await runBackupAction({
      type: 'restore',
      target: restoreTarget,
      confirmInput,
      inFlightRef: actionInFlightRef,
      setBusy: setRestoring,
      setDialogError,
      performApi: () => restoreServerBackup(targetFilename),
      forceCloseDialog,
      onSuccessToast: () => toast.success(`Đã khôi phục dữ liệu từ ${targetFilename} thành công!`),
      onErrorToast: (msg) => toast.error(msg),
      defaultErrorMessage: 'Khôi phục dữ liệu thất bại.',
    });
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (deleting || restoring || actionInFlightRef.current) {
        return;
      }
      closeDialog();
      return;
    }
    if (e.key === 'Tab') {
      if (!dialogRef.current) return;
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
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
            disabled={loading || isBusy}
            className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={runningBackup || isBusy || !pgToolAvailable}
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

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">
                  {loadError.status === 401
                    ? 'Phiên làm việc hết hạn hoặc chưa xác thực (HTTP 401).'
                    : loadError.status === 403
                    ? 'Tài khoản không có quyền truy cập sao lưu hệ thống (HTTP 403).'
                    : loadError.status === 404
                    ? 'Không tìm thấy dịch vụ sao lưu dữ liệu (HTTP 404).'
                    : loadError.isNetwork
                    ? 'Lỗi kết nối mạng đến máy chủ sao lưu.'
                    : `Lỗi tải danh sách bản sao lưu: ${loadError.message}`}
                </p>
                <p className="mt-0.5 text-[11px] text-rose-600">
                  {loadError.status === 404
                    ? 'Dịch vụ sao lưu chưa được đăng ký hoặc không tìm thấy trên hệ thống.'
                    : 'Vui lòng kiểm tra lại kết nối mạng hoặc thử tải lại dữ liệu.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadBackups()}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-100/50 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Thử lại</span>
            </button>
          </div>
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
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[11px] text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-slate-600" />
                      <span className="font-semibold">Đang tải danh sách bản sao lưu...</span>
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[11px] text-rose-600">
                    <p className="font-semibold">Danh sách hiện chưa khả dụng. Hãy dùng nút thử lại phía trên.</p>
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[11px] text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <FileArchive size={24} className="text-slate-400 mb-1" />
                      <span className="font-semibold text-slate-700">Chưa có bản sao lưu nào trong kho lưu trữ</span>
                      <span className="text-[10px] text-slate-400">Nhấn &quot;Tạo bản sao lưu ngay&quot; để sao lưu dữ liệu.</span>
                    </div>
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
                          disabled={verifyingFile === item.filename || isBusy}
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
                          disabled={isBusy}
                          onClick={() => void handleDownload(item.filename)}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50"
                          title="Tải về máy tính"
                        >
                          <Download size={12} /> Tải về
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => handleOpenRestore(item, e.currentTarget)}
                          className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          title={isArchiveVerified(item.filename) ? 'Phục hồi dữ liệu từ bản sao lưu này' : 'Bản sao lưu chưa qua kiểm chứng hợp lệ (yêu cầu ok=true và status=VALID khi có trả về status). Vui lòng bấm "Kiểm chứng" trước khi phục hồi'}
                        >
                          <HardDriveDownload size={12} /> Phục hồi
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => handleOpenDelete(item, e.currentTarget)}
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
              disabled={isBusy}
              onClick={() => setVerificationResult(null)}
              className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
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

      {/* Modal Xác nhận Xóa Bản sao lưu */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-backup-modal-title"
          aria-describedby="delete-backup-modal-desc"
          aria-busy={deleting}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onKeyDown={handleDialogKeyDown}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-xl border border-rose-300 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <Trash2 size={18} />
                <h3 id="delete-backup-modal-title">Xác nhận xóa bản sao lưu</h3>
              </div>
              <button
                type="button"
                disabled={deleting || isBusy}
                onClick={closeDialog}
                className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                aria-label="Đóng hộp thoại"
              >
                <X size={16} />
              </button>
            </div>

            <div id="delete-backup-modal-desc" className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p>Bạn đang chuẩn bị xóa tệp sao lưu sau khỏi máy chủ:</p>
              <p className="rounded-lg bg-slate-100 p-2 font-mono text-[11px] font-bold text-slate-800 break-all">
                {deleteTarget.filename} ({formatBytes(deleteTarget.sizeBytes)})
              </p>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800 font-medium">
                ⚠️ Thao tác này sẽ xóa vĩnh viễn tệp sao lưu này khỏi kho lưu trữ máy chủ. Bạn sẽ không thể tải về hoặc khôi phục từ bản sao lưu này trong tương lai. Thao tác này không làm thay đổi cơ sở dữ liệu hiện tại.
              </div>
              {dialogError && (
                <div role="alert" className="rounded-lg border border-rose-300 bg-rose-100/70 p-2.5 text-[11px] font-bold text-rose-800">
                  {dialogError}
                </div>
              )}
              <div className="pt-1 space-y-1.5">
                <label htmlFor="delete-backup-confirm-input" className="block font-bold text-slate-800">
                  Để xác nhận, vui lòng nhập chính xác chuỗi <span className="font-mono text-rose-600 select-all">XAC NHAN</span> vào ô bên dưới:
                </label>
                <input
                  id="delete-backup-confirm-input"
                  ref={inputRef}
                  type="text"
                  autoFocus
                  disabled={deleting || isBusy}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="XAC NHAN"
                  aria-label="Nhập XAC NHAN để xóa bản sao lưu"
                  className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-rose-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleting || isBusy}
                onClick={closeDialog}
                className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="button"
                title={confirmInput !== 'XAC NHAN' ? 'Nhập chính xác XAC NHAN để mở khóa nút xóa' : 'Xóa bản sao lưu vĩnh viễn'}
                disabled={deleting || confirmInput !== 'XAC NHAN'}
                onClick={() => void executeDelete()}
                className="mobile-touch-target min-h-11 rounded-lg bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Đang xóa…' : 'Xóa bản sao lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh báo Khôi phục Dữ liệu */}
      {restoreTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-modal-title"
          aria-describedby="restore-modal-desc"
          aria-busy={restoring}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onKeyDown={handleDialogKeyDown}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-xl border border-amber-300 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-black text-sm">
                <ShieldAlert size={18} />
                <h3 id="restore-modal-title">Cảnh báo khôi phục dữ liệu hệ thống</h3>
              </div>
              <button
                type="button"
                disabled={restoring || isBusy}
                onClick={closeDialog}
                className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                aria-label="Đóng hộp thoại"
              >
                <X size={16} />
              </button>
            </div>

            <div id="restore-modal-desc" className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p>Bạn đang chuẩn bị phục hồi hệ thống từ bản sao lưu:</p>
              <p className="rounded-lg bg-slate-100 p-2 font-mono text-[11px] font-bold text-slate-800 break-all">
                {restoreTarget.filename} ({formatBytes(restoreTarget.sizeBytes)})
              </p>
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 font-medium leading-normal">
                ⚠️ Thao tác này sẽ ghi đè toàn bộ cơ sở dữ liệu và tệp tin hiện tại bằng dữ liệu của bản sao lưu được chọn. Các dữ liệu và thay đổi phát sinh sau thời điểm tạo bản sao lưu có thể bị mất hoàn toàn.
              </div>
              {dialogError && (
                <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-800">
                  {dialogError}
                </div>
              )}
              <div className="pt-1 space-y-1.5">
                <label htmlFor="restore-confirm-input" className="block font-bold text-slate-800">
                  Để xác nhận, vui lòng nhập chính xác chuỗi <span className="font-mono text-amber-700 select-all">XAC NHAN</span> vào ô bên dưới:
                </label>
                <input
                  id="restore-confirm-input"
                  ref={inputRef}
                  type="text"
                  autoFocus
                  disabled={restoring || isBusy}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="XAC NHAN"
                  aria-label="Nhập XAC NHAN để khôi phục dữ liệu"
                  className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={restoring || isBusy}
                onClick={closeDialog}
                className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="button"
                title={confirmInput !== 'XAC NHAN' ? 'Nhập chính xác XAC NHAN để mở khóa nút khôi phục' : 'Khôi phục hệ thống từ bản sao lưu'}
                disabled={restoring || confirmInput !== 'XAC NHAN'}
                onClick={() => void executeRestore()}
                className="mobile-touch-target min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500 disabled:opacity-40 transition-colors"
              >
                {restoring ? 'Đang khôi phục…' : 'Khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default BackupRestoreAdminPanel;
