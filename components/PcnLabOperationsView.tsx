'use client';

import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, MapPin, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnSampleItem, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types';
import {
  buildPcnSampleFlowProjections,
  filterPcnSampleFlowProjections,
  getPcnLabRequestStatusLabel,
  getPcnSampleExecutionOutcomeLabel,
  getPcnSampleExecutionStatusLabel,
  getPcnSampleRouteStatusLabel,
} from '../utils/pcnLabOperations';

type Props = {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  onOpenDossier: (dossier: CertificationDossier, initialTab?: 'lab' | 'results') => void;
};

const date = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function PcnLabOperationsView({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, returnedResults, onOpenDossier }: Props) {
  const [query, setQuery] = useState('');
  const projections = useMemo(() => buildPcnSampleFlowProjections({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, returnedResults }), [dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, returnedResults]);
  const visibleProjections = useMemo(() => filterPcnSampleFlowProjections(projections, query), [projections, query]);
  const ready = visibleProjections.filter((projection) => projection.routes.some((route) => route.readiness === 'READY')).length;
  const inLab = visibleProjections.filter((projection) => projection.routes.some((route) => route.readiness === 'CURRENT')).length;
  const failed = visibleProjections.filter((projection) => projection.routes.some((route) => route.executionOutcome === 'FAIL')).length;
  const completed = visibleProjections.filter((projection) => projection.routes.length > 0 && projection.routes.every((route) => route.readiness === 'COMPLETED' || route.readiness === 'CANCELLED')).length;

  return <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Điều phối thử nghiệm</p>
      <h1 className="mt-1 text-xl font-black text-slate-900">Sổ mẫu thử & luân chuyển</h1>
      <p className="mt-1 max-w-3xl text-[11px] text-slate-500">Mỗi card là một mẫu/model trong lô; các phòng thử được xếp theo đúng thứ tự luân chuyển. Lịch thử, tiến độ và tín hiệu PASS/FAIL được nhận từ app phòng thử.</p>
    </div>

    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      <Metric label="Tổng mẫu/model" value={visibleProjections.length} icon={FlaskConical} />
      <Metric label="Sẵn sàng chuyển" value={ready} icon={Send} />
      <Metric label="Đang ở phòng thử" value={inLab} icon={MapPin} />
      <Metric label="Có FAIL / sự cố" value={failed} icon={AlertTriangle} tone="rose" />
      <Metric label="Đã hoàn tất" value={completed} icon={CheckCircle2} tone="emerald" />
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
        <input aria-label="Tìm mẫu, PYC và phòng thử" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lô mẫu, mã hồ sơ, PYC, khách hàng, phòng thử, vị trí..." className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[11px] outline-none focus:border-emerald-400" />
      </div>
    </div>

    <div className="space-y-3">
      {visibleProjections.map((projection) => {
        const dossier = dossiers.find((item) => item.id === projection.dossierId);
        const hasFailedRoute = projection.routes.some((route) => route.executionOutcome === 'FAIL');
        const cardTone = projection.hasDataIssue || hasFailedRoute ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-white';
        return <article key={projection.id} className={`rounded-xl border p-3 shadow-sm md:p-4 ${cardTone}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-black text-slate-900">{projection.lotCode}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">{projection.lotStatus}</span>
                {projection.activeRouteCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">Đang xử lý {projection.activeRouteCount} tuyến</span>}
              </div>
                <p className="mt-1 text-xs font-black text-slate-800">{projection.sampleCode} · {projection.sampleType} · Model {projection.model}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-600">Số lượng: {projection.quantity} {projection.unit || 'mẫu'} · Mã mẫu: {projection.sampleItemId}</p>
              <p className="mt-1 truncate text-[10px] font-bold text-slate-600">{projection.dossierCode} · {projection.customerName} · {projection.productName}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-700"><MapPin size={12} className="text-emerald-600" /> Vị trí hiện tại: {projection.currentLocation}</p>
            </div>
            <button type="button" onClick={() => dossier && onOpenDossier(dossier, projection.routes.some((route) => route.resultOutcome) ? 'results' : 'lab')} className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 hover:border-emerald-300">Mở card hồ sơ</button>
          </div>

          {projection.hasDataIssue && <div className="mt-3 flex items-start gap-2 rounded-md bg-rose-100 px-2.5 py-2 text-[10px] font-bold text-rose-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>Dữ liệu cần rà soát: có tuyến/PYC chưa khớp hoặc nhiều tuyến cùng được xem là đang xử lý.</span></div>}

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex min-w-max items-stretch gap-2">
              {projection.routes.length === 0 && <div className="rounded-lg border border-dashed border-rose-200 bg-white px-4 py-3 text-[10px] font-bold text-rose-700">Chưa có tuyến phòng thử</div>}
              {projection.routes.map((route) => <RouteNode key={route.routeId} route={route} />)}
            </div>
          </div>

          {projection.unlinkedPyc.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wide text-amber-800">PYC chưa gắn đúng tuyến mẫu</p><div className="mt-1 flex flex-wrap gap-2">{projection.unlinkedPyc.map((pyc) => <span key={pyc.requestId} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-900">{pyc.pycNumber} · {getPcnLabRequestStatusLabel(pyc.pycStatus)}</span>)}</div></div>}
        </article>;
      })}
    </div>
    {visibleProjections.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-[11px] text-slate-500">Chưa có lô mẫu/PYC phù hợp.</div>}
  </div>;
}

function RouteNode({ route }: { route: ReturnType<typeof buildPcnSampleFlowProjections>[number]['routes'][number] }) {
  const tone = route.executionOutcome === 'FAIL' || route.readiness === 'BLOCKED' ? 'border-rose-200 bg-rose-50/60' : route.readiness === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/60' : route.readiness === 'READY' ? 'border-amber-200 bg-amber-50/60' : 'border-sky-200 bg-sky-50/60';
  return <div className={`w-[245px] rounded-lg border p-3 ${tone}`}>
    <div className="flex items-start justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Bước {route.sequence}</div><p className="mt-0.5 text-xs font-black text-slate-900">{route.labName}</p></div><span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-black text-slate-700">{route.readiness}</span></div>
    <div className="mt-2 space-y-1.5 text-[10px]"><Line label="Luân chuyển" value={getPcnSampleRouteStatusLabel(route.routeStatus)} /><Line label="Thực hiện" value={getPcnSampleExecutionStatusLabel(route.executionStatus)} /><Line label="Lịch thử" value={date(route.executionScheduledDate)} /><Line label="KQ thực hiện" value={getPcnSampleExecutionOutcomeLabel(route.executionOutcome)} /><Line label="KQTN chính thức" value={route.resultReportNumber ? `${route.resultReportNumber} · ${route.resultOutcome}` : 'Chưa có KQ'} /></div>
    <div className="mt-2 border-t border-slate-200/70 pt-2 text-[9px] text-slate-600"><div className="flex items-center gap-1"><Clock3 size={11} /> Bắt đầu: {dateTime(route.executionStartedAt)}</div><div className="mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Hoàn tất: {dateTime(route.executionCompletedAt)}</div></div>
    <div className="mt-2 flex flex-wrap gap-1.5">{route.hasLabRequest ? <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{route.pycNumber || 'Đã có PYC'}</span> : <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-rose-700">Chưa có PYC</span>}{route.externalRequestCode && <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600">Ngoài: {route.externalRequestCode}</span>}{route.pycSyncStatus && <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600">Sync: {route.pycSyncStatus}</span>}</div>
    {route.issueDescription && <p className="mt-2 rounded bg-rose-100 px-2 py-1 text-[9px] font-bold text-rose-800">Sự cố: {route.issueDescription}</p>}
  </div>;
}

function Metric({ label, value, icon: Icon, tone = 'slate' }: { label: string; value: number; icon: typeof FlaskConical; tone?: 'slate' | 'rose' | 'emerald' }) { const iconTone = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-slate-600'; return <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"><Icon size={15} className={iconTone} /><div className="mt-1 text-lg font-black text-slate-800">{value}</div><div className="truncate text-[9px] font-bold text-slate-500">{label}</div></div>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-2"><span className="text-slate-500">{label}</span><span className="text-right font-black text-slate-700">{value}</span></div>; }

// --- End of PcnLabOperationsView.tsx ---
