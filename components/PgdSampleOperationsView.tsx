'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FlaskConical, Search } from 'lucide-react';

import {
  getPgdStatusLabel,
  type PgdInspectionRequest,
  type PgdLabRequest,
  type PgdLabResult,
  type PgdSample,
} from '../utils/pgdDomain';
import { PgdcnPageHeader } from './PgdcnUiPrimitives';

type Props = {
  requests: PgdInspectionRequest[];
  samples: PgdSample[];
  labRequests: PgdLabRequest[];
  labResults: PgdLabResult[];
  onOpenRequest: (requestId: string) => void;
};

type RegisterRow = {
  sample: PgdSample;
  request?: PgdInspectionRequest;
  labRequest?: PgdLabRequest;
  labResult?: PgdLabResult;
};

const LAB_STATUS_LABELS: Record<PgdLabRequest['status'], string> = {
  DRAFT: 'Nháp PYC PTN',
  SENT: 'Đã gửi PTN',
  RECEIVED: 'PTN đã nhận',
  RESULT_RECEIVED: 'Đã nhận KQ',
  ISSUE: 'Có sự cố',
  CLOSED: 'Đã đóng',
};

const dispositionLabel = (value: PgdSample['disposition']) => value === 'RETAINED' ? 'Lưu mẫu' : 'Gửi PTN';

const labStatusTone = (status?: PgdLabRequest['status'], issue?: string) => {
  if (issue || status === 'ISSUE') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'RESULT_RECEIVED' || status === 'CLOSED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'RECEIVED') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const displayDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';

function Metric({ label, value, tone = 'text-slate-800' }: { label: string; value: number; tone?: string }) {
  return <div className="pgdcn-kpi-card"><FlaskConical size={14} className="shrink-0 text-slate-400" /><div className="min-w-0"><div className={`text-lg font-black leading-5 ${tone}`}>{value}</div><div className="truncate text-[9px] font-bold text-slate-500" title={label}>{label}</div></div></div>;
}

function LaboratoryCell({ row }: { row: RegisterRow }) {
  if (!row.labRequest) return <span className="text-[10px] text-slate-400">Chưa chuyển PTN</span>;

  const labRequest = row.labRequest;
  const result = row.labResult;
  return <div className="min-w-[11rem] space-y-1">
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-[10px] font-black text-slate-700" title={labRequest.laboratoryName}>{labRequest.laboratoryName}</p>
      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${labStatusTone(labRequest.status, result?.issue)}`}>{LAB_STATUS_LABELS[labRequest.status]}</span>
    </div>
    <details className="rounded-md border border-slate-100 bg-slate-50/70 px-1.5 py-1">
      <summary className="mobile-touch-target flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 text-[9px] font-black text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <span>Chi tiết PTN</span><ChevronDown size={12} className="text-slate-400" />
      </summary>
      <div className="mt-1 space-y-1 border-t border-slate-200 pt-1 text-[9px] text-slate-600">
        {labRequest.laboratoryCode && <p>Mã PTN: <span className="font-mono font-bold">{labRequest.laboratoryCode}</span></p>}
        <p>Chỉ tiêu: <span className="font-bold text-slate-700">{labRequest.testItems.join(', ') || 'Chưa khai báo'}</span></p>
        {labRequest.handover && <p>Bàn giao: {displayDate(labRequest.handover.sentAt)} · {labRequest.handover.quantity} mẫu</p>}
        {result?.reportNumber && <p>Số phiếu KQ: <span className="font-mono font-bold">{result.reportNumber}</span></p>}
        {result?.receivedAt && <p>Nhận KQ: {displayDate(result.receivedAt)}</p>}
        {result?.issue && <p className="font-bold text-rose-700">Sự cố: {result.issue}</p>}
      </div>
    </details>
  </div>;
}

export default function PgdSampleOperationsView({ requests, samples, labRequests, labResults, onOpenRequest }: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo<RegisterRow[]>(() => samples.map((sample) => {
    const request = requests.find((candidate) => candidate.id === sample.requestId);
    const labRequest = labRequests.find((candidate) => candidate.sampleId === sample.id);
    const labResult = labRequest ? labResults.find((candidate) => candidate.labRequestId === labRequest.id) : undefined;
    return { sample, request, labRequest, labResult };
  }), [labRequests, labResults, requests, samples]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return rows;
    return rows.filter(({ sample, request, labRequest }) => [
      sample.sampleCode,
      sample.sampleTypeLabel,
      sample.customLabel,
      sample.description,
      sample.laboratoryName,
      request?.requestCode,
      request?.customerSnapshot.name,
      request?.productName,
      labRequest?.laboratoryName,
      labRequest?.laboratoryCode,
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized));
  }, [query, rows]);

  const sentCount = rows.filter(({ labRequest }) => labRequest && labRequest.status !== 'DRAFT').length;
  const waitingResultCount = rows.filter(({ labRequest, labResult }) => labRequest && !labResult && !['CLOSED', 'ISSUE'].includes(labRequest.status)).length;
  const retainedCount = rows.filter(({ sample }) => sample.disposition === 'RETAINED').length;
  const issueCount = rows.filter(({ labRequest, labResult }) => labRequest?.status === 'ISSUE' || Boolean(labResult?.issue)).length;

  return <div data-testid="pgd-sample-register" className="min-w-0 space-y-3 bg-slate-50/60 p-3 md:p-5">
    <PgdcnPageHeader eyebrow="PGD · Sổ vận hành" title="Sổ quản lý mẫu" description="Theo dõi từng mẫu, tuyến PTN và kết quả. Thông tin dài được mở khi cần để bảng luôn gọn." />
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="Tổng mẫu" value={rows.length} /><Metric label="Đã chuyển PTN" value={sentCount} tone="text-blue-700" /><Metric label="Chờ KQTN" value={waitingResultCount} tone="text-amber-700" /><Metric label="Lưu mẫu" value={retainedCount} tone="text-slate-700" /><Metric label="Có sự cố" value={issueCount} tone="text-rose-700" /></div>
    <div className="pgdcn-toolbar-nowrap rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="pgdcn-toolbar-search block min-w-0"><span className="mb-1 block text-[10px] font-black text-slate-600">Tìm mẫu, hồ sơ hoặc PTN</span><div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm mẫu, hồ sơ hoặc PTN" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã mẫu, mã PYC, khách hàng, PTN..." className="min-h-9 w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[10px] outline-none focus:border-blue-400" /></div></label>
      <span className="pgdcn-toolbar-count text-[10px] font-bold text-slate-400">{visibleRows.length}/{rows.length} mẫu</span>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="mobile-scroll-x overflow-x-auto"><table className="min-w-[1120px] w-full border-collapse text-left text-[10px]"><thead><tr className="border-b border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500"><th className="min-w-[110px] px-3 py-2">Mã mẫu</th><th className="min-w-[190px] px-3 py-2">Loại / mô tả</th><th className="min-w-[205px] px-3 py-2">Hồ sơ / khách hàng</th><th className="min-w-[85px] px-3 py-2">Số lượng</th><th className="min-w-[100px] px-3 py-2">Phân loại</th><th className="min-w-[245px] px-3 py-2">PTN liên kết</th><th className="min-w-[110px] px-3 py-2">Trạng thái hồ sơ</th><th className="min-w-[100px] px-3 py-2">Hành động</th></tr></thead><tbody>{visibleRows.map(({ sample, request, labRequest, labResult }) => <tr key={sample.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70"><td className="px-3 py-2"><p className="font-mono font-black text-slate-800">{sample.sampleCode}</p>{sample.sealNumber && <p className="mt-1 text-[9px] text-slate-500">Niêm phong: {sample.sealNumber}</p>}</td><td className="px-3 py-2"><p className="font-black text-slate-700">{sample.customLabel || sample.sampleTypeLabel || 'Mẫu PGD'}</p><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{sample.description || 'Chưa có mô tả'}</p></td><td className="px-3 py-2"><p className="font-mono font-black text-slate-700">{request?.requestCode || '—'}</p><p className="mt-1 line-clamp-2 text-[9px] text-slate-600">{request?.customerSnapshot.name || 'Hồ sơ không còn trong sổ'}{request?.productName ? ` · ${request.productName}` : ''}</p></td><td className="px-3 py-2 font-black text-slate-700">{sample.quantity} {sample.unit || 'mẫu'}</td><td className="px-3 py-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black text-slate-600">{dispositionLabel(sample.disposition)}</span></td><td className="px-3 py-2"><LaboratoryCell row={{ sample, request, labRequest, labResult }} /></td><td className="px-3 py-2"><span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700">{request ? getPgdStatusLabel(request.status) : 'Thiếu hồ sơ'}</span></td><td className="px-3 py-2">{request ? <button type="button" onClick={() => onOpenRequest(request.id)} className="mobile-touch-target min-h-8 rounded-md border border-blue-200 bg-white px-2 text-[9px] font-black text-blue-700 hover:bg-blue-50">Mở hồ sơ</button> : <span className="text-[9px] text-slate-400">—</span>}</td></tr>)}</tbody></table></div>
      {visibleRows.length === 0 && <div className="border-t border-dashed border-slate-200 p-10 text-center text-[11px] text-slate-500">Chưa có mẫu PGD phù hợp.</div>}
    </section>
  </div>;
}
