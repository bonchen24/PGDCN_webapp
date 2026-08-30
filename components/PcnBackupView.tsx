'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Download, Loader2, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
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

function isPcnAdmin(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.role === 'admin';
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 1024) return `${Math.max(0, value || 0)} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleString('vi-VN');
}

export function PcnBackupView({
  currentUser,
  onRestored,
}: {
  currentUser: UserAccount | null;
  onRestored: () => Promise<void>;
}) {
  const admin = isPcnAdmin(currentUser);
  const username = currentUser?.username;
  const [backups, setBackups] = useState<ServerBackupInfo[]>([]);
  const [pgToolAvailable, setPgToolAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [verificationByFilename, setVerificationByFilename] = useState<Record<string, ServerBackupVerification>>({});
  const [verifyingFilename, setVerifyingFilename] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBackups = useCallback(async () => {
    if (!admin || !username) return;
    setIsLoading(true);
    try {
      const response = await fetchBackupList(username);
      setBackups(response.items || []);
      setPgToolAvailable(response.pgToolAvailable);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải danh sách bản sao lưu');
    } finally {
      setIsLoading(false);
    }
  }, [admin, username]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  if (!admin || !username) return null;

  const handleRunBackup = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const created = await triggerServerBackup(username);
      setVerifyingFilename(created.filename);
      try {
        const verification = await verifyBackupFile(username, created.filename);
        setVerificationByFilename((previous) => ({ ...previous, [created.filename]: verification }));
        if (verification.ok) {
          toast.success(`Đã tạo và kiểm chứng checkpoint trước import: ${created.filename}`);
        } else {
          toast.error(`Đã tạo checkpoint ${created.filename}, nhưng archive chưa đạt cổng kiểm chứng.`);
        }
      } catch (error: any) {
        toast.error(`Đã tạo checkpoint ${created.filename}, nhưng chưa thể kiểm chứng archive: ${error?.message || error}`);
      } finally {
        setVerifyingFilename(null);
      }
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo bản sao lưu');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await downloadBackupFile(username, filename);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải bản sao lưu');
    }
  };

  const handleVerify = async (filename: string) => {
    if (verifyingFilename) return;
    setVerifyingFilename(filename);
    try {
      const result = await verifyBackupFile(username, filename);
      setVerificationByFilename((previous) => ({ ...previous, [filename]: result }));
      if (result.ok) toast.success('Archive hợp lệ: database dump và object Storage đã được kiểm tra.');
      else toast.error('Archive chưa đạt cổng kiểm tra. Xem chi tiết bên dưới.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể kiểm tra archive');
    } finally {
      setVerifyingFilename(null);
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    if (!restoreTarget || restoreConfirmText !== 'KHOIPHUC') {
      toast.error('Vui lòng gõ đúng "KHOIPHUC" để xác nhận.');
      return;
    }
    setIsRestoring(true);
    try {
      await restoreServerBackup(username, restoreTarget);
      await onRestored();
      toast.success('Đã khôi phục dữ liệu PCN và tải lại hồ sơ.');
      setRestoreTarget(null);
      setRestoreConfirmText('');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể khôi phục bản sao lưu');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBackupFile(username, deleteTarget);
      toast.success('Đã xóa bản sao lưu.');
      setDeleteTarget(null);
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa bản sao lưu');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-3 md:p-5 mobile-safe-bottom">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị dữ liệu PCN</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Sao lưu & khôi phục</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">Archive máy chủ gồm database PCN, metadata file và object PDF nghiệp vụ. Nút tạo bên dưới tạo checkpoint trước import và tự kiểm chứng archive vừa tạo; không bao gồm ảnh OCR hoặc dữ liệu tạm của trình duyệt.</p>
          </div>
          <button type="button" onClick={() => void loadBackups()} disabled={isLoading} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-emerald-600 disabled:opacity-50" title="Làm mới">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {!pgToolAvailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
            Máy chủ chưa có <code>pg_dump</code>/<code>pg_restore</code>; thao tác sao lưu và khôi phục archive tạm thời không khả dụng.
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Archive size={17} /></span>
              <div><h2 className="text-sm font-black text-slate-800">Archive trên máy chủ</h2><p className="text-[10px] text-slate-400">Chỉ Admin PCN được thao tác · dùng trước import/cutover mới.</p></div>
            </div>
            <button type="button" onClick={() => void handleRunBackup()} disabled={isRunning || !pgToolAvailable} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              {isRunning ? 'Đang tạo checkpoint...' : 'Tạo checkpoint trước import'}
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><Loader2 size={14} className="animate-spin text-emerald-500" /> Đang tải danh sách...</div>
          ) : backups.length === 0 ? (
            <div className="py-8 text-center text-[11px] italic text-slate-400">Chưa có archive PCN nào trên máy chủ.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {backups.map((backup) => {
                const verified = verificationByFilename[backup.filename]?.ok === true;
                return (
                <div key={backup.filename} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-mono text-[10px] font-bold text-slate-700" title={backup.filename}>{backup.filename}</p><p className="mt-1 text-[10px] text-slate-400">{formatBytes(backup.sizeBytes)} · {formatDate(backup.createdAt)}</p></div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => void handleDownload(backup.filename)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600" title="Tải xuống"><Download size={13} /></button>
                      <button type="button" onClick={() => void handleVerify(backup.filename)} disabled={Boolean(verifyingFilename)} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50" title="Kiểm tra archive"><ShieldCheck size={13} className={verifyingFilename === backup.filename ? 'animate-pulse' : ''} /></button>
                      <button type="button" onClick={() => { setRestoreTarget(backup.filename); setDeleteTarget(null); setRestoreConfirmText(''); }} disabled={!verified || isRestoring || isDeleting} className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50" title={verified ? 'Khôi phục' : 'Kiểm chứng archive trước khi khôi phục'}><RotateCcw size={13} /></button>
                      <button type="button" onClick={() => { setDeleteTarget(backup.filename); setRestoreTarget(null); }} disabled={isRestoring || isDeleting} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Xóa"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {verificationByFilename[backup.filename] && (
                    <div className={`mt-2 rounded-lg border p-2.5 text-[10px] leading-relaxed ${verificationByFilename[backup.filename].ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                      <p className="font-black">{verificationByFilename[backup.filename].ok ? 'Archive hợp lệ' : 'Archive chưa đạt kiểm tra'}</p>
                      <p className="mt-0.5">Database dump: {verificationByFilename[backup.filename].dumpReadable ? 'đọc được' : 'chưa kiểm chứng'} · Object: {verificationByFilename[backup.filename].verifiedObjectCount}/{verificationByFilename[backup.filename].manifestObjectCount} qua kiểm tra</p>
                      {verificationByFilename[backup.filename].errors.length > 0 && <ul className="mt-1 list-disc pl-4">{verificationByFilename[backup.filename].errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul>}
                    </div>
                  )}

                  {restoreTarget === backup.filename && (
                    <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-[10px] font-semibold leading-relaxed text-amber-800">Khôi phục sẽ ghi đè toàn bộ database và file PCN hiện tại. Gõ <code>KHOIPHUC</code> để xác nhận.</p>
                      <input value={restoreConfirmText} onChange={(event) => setRestoreConfirmText(event.target.value)} className="w-full rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-amber-500" placeholder="KHOIPHUC" aria-label="Chuỗi xác nhận khôi phục" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void handleRestore()} disabled={isRestoring || restoreConfirmText !== 'KHOIPHUC'} className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isRestoring && <Loader2 size={12} className="animate-spin" />} Xác nhận khôi phục</button>
                        <button type="button" onClick={() => { setRestoreTarget(null); setRestoreConfirmText(''); }} disabled={isRestoring} className="rounded-md bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100">Hủy</button>
                      </div>
                    </div>
                  )}

                  {deleteTarget === backup.filename && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                      <span className="text-[10px] font-semibold text-rose-800">Xóa archive này?</span>
                      <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-md bg-rose-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-rose-700 disabled:bg-slate-300">{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}</button>
                      <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="rounded-md bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100">Hủy</button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[10px] leading-relaxed text-slate-400">Ranh giới lưu trữ đang dùng profile PCN/database <code>pcn_certification</code>. Khôi phục chỉ thực hiện khi đã kiểm tra đúng file và có kế hoạch quay lui.</p>
      </div>
    </div>
  );
}

export default PcnBackupView;
