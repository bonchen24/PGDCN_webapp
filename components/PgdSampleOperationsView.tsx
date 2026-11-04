'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Copy, FlaskConical, Search, Send, Clock, Boxes, AlertTriangle, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

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

async function copyIdentifier(value: string, label: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API không khả dụng.');
    await navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}.`);
  } catch {
    toast.error(`Không thể sao chép ${label}.`);
  }
}

function CopyableIdentifier({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 max-w-full">
      <span className="block min-w-0 max-w-[6rem] truncate whitespace-nowrap font-mono text-xs font-black text-slate-800" title={value}>
        {value}
      </span>
      <div className="mt-1 flex max-w-full flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void copyIdentifier(value, label)}
          aria-label={`Sao chép ${label}: ${value}`}
          className="mobile-touch-target inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:bg-slate-50 hover:text-blue-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Copy size={11} aria-hidden="true" />
          <span>Sao chép</span>
        </button>
        <details className="min-w-0 max-w-full">
          <summary className="mobile-touch-target inline-flex min-h-7 max-w-full cursor-pointer items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span>Xem đầy đủ</span>
            <span className="sr-only">{label}</span>
            <ChevronDown size={11} aria-hidden="true" />
          </summary>
          <code className="mt-1 block max-w-[6rem] whitespace-normal break-all rounded bg-slate-100 p-1 font-mono text-[9px] leading-4 text-slate-700">
            {value}
          </code>
        </details>
      </div>
    </div>
  );
}

const labStatusTone = (status?: PgdLabRequest['status'], issue?: string) => {
  if (issue || status === 'ISSUE') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'RESULT_RECEIVED' || status === 'CLOSED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'RECEIVED') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const displayDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';

function Metric({ label, value, tone = 'text-slate-800', icon: Icon = FlaskConical, bgTone = 'bg-slate-100 text-slate-600' }: { label: string; value: number; tone?: string; icon?: any; bgTone?: string }) {
  return (
    <div className="pgdcn-kpi-card flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgTone}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-black leading-tight ${tone}`}>{value}</div>
        <div className="truncate text-[10px] font-black uppercase tracking-wider text-slate-400 mt-0.5" title={label}>{label}</div>
      </div>
    </div>
  );
}

function LaboratoryCell({ row }: { row: RegisterRow }) {
  if (!row.labRequest) return <span className="text-xs text-slate-400 italic">Chưa chuyển PTN</span>;

  const labRequest = row.labRequest;
  const result = row.labResult;
  return (
    <div className="min-w-[12rem] space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-black text-slate-800" title={labRequest.laboratoryName}>{labRequest.laboratoryName}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${labStatusTone(labRequest.status, result?.issue)}`}>
          {LAB_STATUS_LABELS[labRequest.status]}
        </span>
      </div>
      <details className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1">
        <summary className="mobile-touch-target flex min-h-7 cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span>Chi tiết PTN</span>
          <ChevronDown size={12} className="text-slate-400" />
        </summary>
        <div className="mt-1 space-y-1 border-t border-slate-200 pt-1 text-[10px] text-slate-600">
          {labRequest.laboratoryCode && <p>Mã PTN: <span className="font-mono font-bold text-slate-800">{labRequest.laboratoryCode}</span></p>}
          <p>Chỉ tiêu: <span className="font-bold text-slate-700">{labRequest.testItems.join(', ') || 'Chưa khai báo'}</span></p>
          {labRequest.handover && <p>Bàn giao: {displayDate(labRequest.handover.sentAt)} · {labRequest.handover.quantity} mẫu</p>}
          {result?.reportNumber && <p>Số phiếu KQ: <span className="font-mono font-bold text-blue-700">{result.reportNumber}</span></p>}
          {result?.receivedAt && <p>Nhận KQ: {displayDate(result.receivedAt)}</p>}
          {result?.issue && <p className="font-bold text-rose-700">Sự cố: {result.issue}</p>}
        </div>
      </details>
    </div>
  );
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

  return (
    <div data-testid="pgd-sample-register" className="min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
      <PgdcnPageHeader eyebrow="PGD · Sổ vận hành" title="Sổ quản lý mẫu" description="Theo dõi từng mẫu, tuyến PTN và kết quả. Thông tin dài được mở khi cần để bảng luôn gọn." />
      
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Metric label="Tổng mẫu" value={rows.length} icon={FlaskConical} tone="text-indigo-900" bgTone="bg-indigo-50 text-indigo-700 border border-indigo-100" />
        <Metric label="Đã chuyển PTN" value={sentCount} tone="text-blue-700" icon={Send} bgTone="bg-blue-50 text-blue-600 border border-blue-100" />
        <Metric label="Chờ KQTN" value={waitingResultCount} tone="text-amber-700" icon={Clock} bgTone="bg-amber-50 text-amber-600 border border-amber-100" />
        <Metric label="Lưu mẫu" value={retainedCount} tone="text-purple-700" icon={Boxes} bgTone="bg-purple-50 text-purple-600 border border-purple-100" />
        <Metric label="Có sự cố" value={issueCount} tone="text-rose-700" icon={AlertTriangle} bgTone="bg-rose-50 text-rose-600 border border-rose-100" />
      </div>

      {/* Toolbar */}
      <div className="pgdcn-toolbar-nowrap rounded-xl border border-slate-200 bg-white p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="pgdcn-toolbar-search relative min-w-0 flex-1 max-w-md">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm mẫu, hồ sơ hoặc PTN"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã mẫu, mã PYC, khách hàng, PTN..."
            className="mobile-touch-target min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-bold shadow-2xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
        <span className="pgdcn-toolbar-count rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          {visibleRows.length}/{rows.length} mẫu
        </span>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="mobile-scroll-x overflow-x-auto">
          <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="min-w-[120px] px-3.5 py-3 text-indigo-950 bg-indigo-50/40">Mã mẫu</th>
                <th className="min-w-[190px] px-3.5 py-3 text-slate-700">Loại / mô tả</th>
                <th className="min-w-[210px] px-3.5 py-3 text-amber-950 bg-amber-50/40">Hồ sơ / khách hàng</th>
                <th className="min-w-[90px] px-3.5 py-3 text-center">Số lượng</th>
                <th className="min-w-[100px] px-3.5 py-3">Phân loại</th>
                <th className="min-w-[245px] px-3.5 py-3 text-blue-950 bg-blue-50/40">PTN liên kết</th>
                <th className="min-w-[120px] px-3.5 py-3 text-emerald-950 bg-emerald-50/40">Trạng thái hồ sơ</th>
                <th className="min-w-[100px] px-3.5 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map(({ sample, request, labRequest, labResult }) => (
                <tr key={sample.id} className="align-top transition-colors hover:bg-slate-50/70 border-b border-slate-100 last:border-0">
                  <td className="px-3.5 py-3">
                    <CopyableIdentifier value={sample.sampleCode} label="mã mẫu" />
                    {sample.sealNumber && (
                      <div className="mt-2 min-w-0">
                        <p className="mb-0.5 text-[10px] text-slate-400 font-semibold">Niêm phong:</p>
                        <CopyableIdentifier value={sample.sealNumber} label="mã niêm phong" />
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <p className="font-black text-slate-800 text-xs">{sample.customLabel || sample.sampleTypeLabel || 'Mẫu PGD'}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{sample.description || 'Chưa có mô tả'}</p>
                  </td>
                  <td className="px-3.5 py-3">
                    <p className="font-mono font-black text-slate-800 text-xs">{request?.requestCode || '—'}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{request?.customerSnapshot.name || 'Hồ sơ không còn trong sổ'}{request?.productName ? ` · ${request.productName}` : ''}</p>
                  </td>
                  <td className="px-3.5 py-3 text-center font-black text-slate-800 text-xs">
                    {sample.quantity} {sample.unit || 'mẫu'}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">
                      {dispositionLabel(sample.disposition)}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <LaboratoryCell row={{ sample, request, labRequest, labResult }} />
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700">
                      {request ? getPgdStatusLabel(request.status) : 'Thiếu hồ sơ'}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    {request ? (
                      <button
                        type="button"
                        onClick={() => onOpenRequest(request.id)}
                        aria-label={`Mở hồ sơ ${request.requestCode}`}
                        className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <FolderOpen size={13} aria-hidden="true" />
                        <span>Mở hồ sơ</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleRows.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400">
            <FlaskConical size={32} className="mx-auto text-slate-300 mb-2" />
            Chưa có mẫu PGD phù hợp.
          </div>
        )}
      </section>
    </div>
  );
}
