'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  type PgdCatalogItem,
  type PgdInspectionRequest,
  type PgdTransitionContext,
} from '../utils/pgdDomain';
import { PGD_OPERATIONAL_STATIONS, getPgdOperationalStationByKey, type PgdOperationalStationKey } from '../utils/pgdWorkflow';
import PgdDossierSelector from './PgdDossierSelector';

export type PgdOperationalStationWorkspaceProps = {
  station: PgdOperationalStationKey;
  requests: PgdInspectionRequest[];
  catalog?: readonly PgdCatalogItem[];
  selectedRequestId?: string;
  onSelectRequest: (requestId: string) => void;
  onOpenFullDossier: (requestId: string) => void;
  children: (request: PgdInspectionRequest) => ReactNode;
  getEvidence: (requestId: string) => PgdTransitionContext;
};

function formatQuantity(request: PgdInspectionRequest): string {
  return `${request.quantity} ${request.unit || ''}${request.weight ? ` · ${request.weight} ${request.weightUnit || ''}` : ''}`.trim();
}

function PgdDossierSummary({ request }: { request: PgdInspectionRequest }) {
  return <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tóm tắt bộ hồ sơ PGD">
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">PYC / khách hàng</div><div className="mt-1 font-mono text-[10px] font-black text-blue-700">{request.requestCode}</div><div className="mt-1 text-xs font-black text-slate-800">{request.customerSnapshot.name}</div></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Đối tượng giám định</div><div className="mt-1 text-xs font-black text-slate-800">{request.productName}</div><div className="mt-1 text-[10px] text-slate-500">{request.lotCode || 'Chưa có mã lô'} · {formatQuantity(request)}</div></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Hiện trường / phương thức</div><div className="mt-1 line-clamp-2 text-[10px] font-bold text-slate-700">{request.inspectionLocation || 'Chưa đặt địa điểm'}</div><div className="mt-1 text-[10px] text-slate-500">{request.method || 'Chưa chọn phương thức'}</div></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Phụ trách xuyên suốt</div><div className="mt-1 text-xs font-black text-slate-800">{request.ownerUsername || 'Chưa gán'}</div><div className="mt-1 text-[10px] text-slate-500">{request.standards.join(' · ') || 'Chưa ghi tiêu chuẩn'}</div></div>
  </section>;
}

function EmptySelection() {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div className="text-sm font-black text-slate-700">Chưa chọn hồ sơ PGD</div><p className="mt-1 text-[11px] text-slate-400">Chọn một PYC ở bộ chọn phía trên để mở biểu mẫu của trạm.</p></div>;
}

export default function PgdOperationalStationWorkspace({ station, requests, catalog, selectedRequestId, onSelectRequest, onOpenFullDossier, children }: PgdOperationalStationWorkspaceProps) {
  const selectedRequest = requests.find((request) => request.id === selectedRequestId);
  const stationDefinition = getPgdOperationalStationByKey(station);
  const currentStatus = selectedRequest?.status;

  return <div className="space-y-3 p-3 md:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Trạm {stationDefinition.number}/5</div><h1 className="mt-1 text-xl font-black text-slate-900">{stationDefinition.title}</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">{stationDefinition.description} Mỗi PYC là một bộ hồ sơ; chọn hồ sơ trước rồi thực hiện biểu mẫu và bằng chứng tại trạm.</p></div><div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">{requests.length} bộ hồ sơ PGD</div></header>
    <div aria-label="Bộ chọn hồ sơ PGD"><PgdDossierSelector requests={requests} catalog={catalog} selectedRequestId={selectedRequestId} onSelect={onSelectRequest} /></div>
    {selectedRequest ? <>
      <PgdDossierSummary request={selectedRequest} />
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600"><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">{stationDefinition.number}/5</span><ArrowRight size={13} className="text-slate-400" /><span>{stationDefinition.title}</span>{currentStatus && <span className="font-normal text-slate-400">· {currentStatus}</span>}</div><button type="button" onClick={() => onOpenFullDossier(selectedRequest.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"><ExternalLink size={13} /> Mở hồ sơ đầy đủ</button></div>
      <section aria-label={`Trạm ${stationDefinition.title}`} className="space-y-3">{children(selectedRequest)}</section>
    </> : <EmptySelection />}
  </div>;
}

export { PGD_OPERATIONAL_STATIONS };
