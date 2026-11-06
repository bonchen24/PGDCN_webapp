'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PcnUserAccount } from '../types';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { hasPgdDossierCapability } from '../utils/pgdDossierCapabilities';
import { isPcnSystemManager } from '../utils/pcnRbac';
import { usePgdStore } from '../store-pgd';
import { PgdcnDateInput } from './PgdcnDateInput';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newOperationId(): string {
  return globalThis.crypto?.randomUUID?.() || `pgd-issuance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PgdIssuancePanel({ request, currentUser }: { request: PgdInspectionRequest; currentUser: PcnUserAccount }) {
  const pgd = usePgdStore();
  const liveRequest = pgd.requests.find((item) => item.id === request.id) || request;
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const isManager = isPcnSystemManager(currentUser) || currentUser.pgdRole === 'PGD_ADMIN' || currentUser.pgdRole === 'PGD_MANAGER';
  const canIssue = isManager || hasPgdDossierCapability(assignment, currentUser.username, 'OFFICE_ISSUANCE');
  const canArchive = isManager || hasPgdDossierCapability(assignment, currentUser.username, 'ARCHIVE');
  const [issueDate, setIssueDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState('');
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [deliveredTo, setDeliveredTo] = useState('');
  const [busy, setBusy] = useState(false);
  const operationId = useRef<{ action: string; id: string } | null>(null);

  const run = async (action: 'SIGN' | 'DELIVER' | 'ARCHIVE') => {
    if (!operationId.current || operationId.current.action !== action) operationId.current = { action, id: newOperationId() };
    const id = operationId.current.id;
    setBusy(true);
    try {
      if (action === 'SIGN') {
        if (!signedFile || !issueDate || !expiryDate) {
          toast.error('Chọn PDF bản cuối và nhập ngày cấp, ngày hết hạn.');
          return;
        }
        await pgd.saveIssuance({ requestId: request.id, action, operationId: id, issueDate, expiryDate, file: signedFile });
        toast.success('Đã lưu bản ký và phát hành chứng thư.');
      } else if (action === 'DELIVER') {
        if (!deliveredTo.trim()) {
          toast.error('Nhập người nhận kết quả.');
          return;
        }
        await pgd.saveIssuance({ requestId: request.id, action, operationId: id, deliveredTo: deliveredTo.trim() });
        toast.success('Đã ghi nhận bàn giao kết quả.');
      } else {
        await pgd.saveIssuance({ requestId: request.id, action, operationId: id });
        toast.success('Đã lưu trữ hồ sơ.');
      }
      operationId.current = null;
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật phát hành hồ sơ.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-100';
  return <section className="rounded-xl border border-slate-200 bg-white p-3" data-testid="pgd-issuance-actions">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="text-xs font-black text-slate-900">Phát hành kết quả</h4>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Bản PDF ký cuối, ngày cấp/hết hạn, người nhận và người lưu trữ được ghi thành các mốc riêng.</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{liveRequest.status}</span>
    </div>

    {liveRequest.status === 'APPROVED_FOR_ISSUANCE' && <div className="mt-3 space-y-2">
      {!canIssue && <p className="text-xs text-amber-800">Chỉ văn phòng được phân công mới có thể ghi nhận ký và phát hành.</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="block text-[11px] font-bold text-slate-600">Ngày cấp<PgdcnDateInput className={inputClass} required disabled={!canIssue || busy} value={issueDate} onChange={setIssueDate} /></label>
        <label className="block text-[11px] font-bold text-slate-600">Ngày hết hạn<PgdcnDateInput className={inputClass} required disabled={!canIssue || busy} value={expiryDate} onChange={setExpiryDate} /></label>
        <label className="block text-[11px] font-bold text-slate-600 sm:col-span-2">PDF đã ký, in và đóng dấu<input className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-[10px]`} type="file" accept="application/pdf,.pdf" disabled={!canIssue || busy} onChange={(event) => setSignedFile(event.target.files?.[0] || null)} /></label>
      </div>
      <button type="button" disabled={!canIssue || busy || !signedFile || !issueDate || !expiryDate} onClick={() => void run('SIGN')} className="mobile-touch-target min-h-11 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu PDF và phát hành'}</button>
    </div>}

    {liveRequest.status === 'SIGNED' && <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600"><span>Ngày cấp: <b>{certificate?.issueDate || '—'}</b></span><span>Hết hạn: <b>{certificate?.expiryDate || '—'}</b></span>{certificate?.issuanceFileAssetId && <a className="mobile-touch-target inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 font-bold text-blue-700" href={`/api/pgd/issuance/${encodeURIComponent(request.id)}/file`}>Tải PDF bản ký</a>}</div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-[11px] font-bold text-slate-600">Người nhận kết quả<input className={inputClass} value={deliveredTo} onChange={(event) => setDeliveredTo(event.target.value)} placeholder="Tên người nhận hoặc đại diện khách hàng" disabled={!canIssue || busy} /></label>
        <button type="button" disabled={!canIssue || busy || !deliveredTo.trim()} onClick={() => void run('DELIVER')} className="mobile-touch-target min-h-11 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-50">Ghi nhận bàn giao</button>
      </div>
    </div>}

    {liveRequest.status === 'RESULT_RETURNED' && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-900">
      <span>Đã bàn giao cho <b>{certificate?.deliveredTo || '—'}</b> lúc {certificate?.deliveredAt ? new Date(certificate.deliveredAt).toLocaleString('vi-VN') : '—'}.</span>
      <button type="button" disabled={!canArchive || busy} onClick={() => void run('ARCHIVE')} className="mobile-touch-target min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50">{canArchive ? 'Hoàn tất lưu trữ' : 'Chờ người lưu trữ được phân công'}</button>
    </div>}

    {liveRequest.status === 'ARCHIVED' && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-[11px] font-bold text-emerald-900">Đã lưu trữ bởi {certificate?.archivistUsername || '—'} lúc {certificate?.archivedAt ? new Date(certificate.archivedAt).toLocaleString('vi-VN') : '—'}.</p>}
    {!['APPROVED_FOR_ISSUANCE', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(liveRequest.status) && <p className="mt-3 text-xs text-slate-500">B7 mở sau khi lãnh đạo phê duyệt B6.</p>}
  </section>;
}
