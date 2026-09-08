'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  PGD_WORKFLOW_STATES,
  getPgdStatusLabel,
  isPgdV1ProductGroup,
  type PgdInspectionRequest,
  type PgdInspectionRequestInput,
  type PgdInspectionStatus,
  type PgdProductGroup,
} from '../utils/pgdDomain';
import { getPgdOperationalStation } from '../utils/pgdWorkflow';

export type PgdDossierSelectorProps = {
  requests: PgdInspectionRequest[];
  selectedRequestId?: string;
  onSelect: (requestId: string) => void;
  group?: PgdInspectionRequestInput['productGroup'] | 'ALL';
  onGroupChange?: (group: PgdInspectionRequestInput['productGroup'] | 'ALL') => void;
  status?: PgdInspectionStatus | 'ALL';
  onStatusChange?: (status: PgdInspectionStatus | 'ALL') => void;
  label?: string;
};

const GROUP_LABELS: Record<'ALL' | PgdProductGroup, string> = {
  ALL: 'Tất cả nhóm',
  STEEL_METAL: 'Thép / kim loại',
  MACHINERY_LINE: 'Máy / dây chuyền',
  COAL: 'Than',
  OTHER: 'Hàng hóa khác',
};

function searchableText(request: PgdInspectionRequest): string {
  return [
    request.requestCode,
    request.registryMetadata?.registrationNumber,
    request.customerSnapshot.name,
    request.productName,
    request.lotCode,
    request.inspectionLocation,
    request.method,
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export default function PgdDossierSelector({ requests, selectedRequestId, onSelect, group = 'ALL', onGroupChange, status = 'ALL', onStatusChange, label = 'Chọn bộ hồ sơ PYC' }: PgdDossierSelectorProps) {
  const [query, setQuery] = useState('');
  const activeGroup: 'ALL' | PgdProductGroup = group;
  const visibleRequests = useMemo(() => requests.filter((request) => isPgdV1ProductGroup(request.productGroup)), [requests]);
  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return visibleRequests.filter((request) => (
      (activeGroup === 'ALL' || request.productGroup === activeGroup)
      && (status === 'ALL' || request.status === status)
      && (!normalized || searchableText(request).includes(normalized))
    ));
  }, [activeGroup, query, status, visibleRequests]);
  const selectedRequest = visibleRequests.find((request) => request.id === selectedRequestId);

  return <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Bộ chọn hồ sơ PGD">
    <div data-testid="pgd-dossier-selector-filters" className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(10rem,10rem)_minmax(11rem,11rem)] md:items-end">
      <label className="min-w-0 flex-1"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span><div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm bộ hồ sơ PGD" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm PYC, khách hàng, lô, hiện trường..." className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[10px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div></label>
      <label className="w-full sm:w-40"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">Nhóm sản phẩm</span><select aria-label="Lọc nhóm sản phẩm PGD" value={activeGroup} onChange={(event) => onGroupChange?.(event.target.value as PgdDossierSelectorProps['group'])} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold outline-none focus:border-blue-400">{Object.entries(GROUP_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      <label className="w-full sm:w-44"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-500">Trạng thái</span><select aria-label="Lọc trạng thái hồ sơ PGD" value={status} onChange={(event) => onStatusChange?.(event.target.value as PgdDossierSelectorProps['status'])} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400"><option value="ALL">Tất cả trạng thái</option>{PGD_WORKFLOW_STATES.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>
    </div>
    <div className="mt-3 grid gap-1.5" role="list" aria-label="Danh sách bộ hồ sơ PGD">{filteredRequests.map((request) => {
      const station = getPgdOperationalStation(request.status);
      const active = request.id === selectedRequestId;
      return <button type="button" role="listitem" key={request.id} onClick={() => onSelect(request.id)} aria-pressed={active} className={`w-full rounded-xl border p-2.5 text-left transition ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-100 bg-slate-50/70 hover:border-blue-200 hover:bg-blue-50/50'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-[10px] font-black text-blue-700">{request.requestCode}</span><span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{request.productGroup}</span></div><div className="mt-1 truncate text-[10px] font-black text-slate-800">{request.customerSnapshot.name} · {request.productName}</div><div className="mt-1 truncate text-[9px] text-slate-500">{request.lotCode || 'Chưa có mã lô'} · {request.inspectionLocation || 'Chưa có địa điểm'} · {request.method || 'Chưa chọn phương thức'}</div></div><span className="shrink-0 rounded-full border border-blue-200 bg-white px-2 py-1 text-[9px] font-black text-blue-700">{getPgdStatusLabel(request.status)}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400"><span>Trạm tiếp theo: <b className="text-slate-600">{station.title}</b></span><span>Phụ trách: <b className="text-slate-600">{request.ownerUsername || 'Chưa gán'}</b></span></div></button>;
    })}{filteredRequests.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[10px] text-slate-400">Không có bộ hồ sơ phù hợp bộ lọc.</div>}</div>
    {selectedRequest && <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[10px] text-blue-900"><b>Đang chọn:</b> {selectedRequest.requestCode} · {selectedRequest.productName}</div>}
  </section>;
}
