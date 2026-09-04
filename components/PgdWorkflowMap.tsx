'use client';

import { ClipboardList } from 'lucide-react';

import {
  PGD_OPERATIONAL_STATIONS,
  getPgdOperationalStation,
  getPgdOperationalStepAccess,
  type PgdOperationalStationKey,
} from '../utils/pgdWorkflow';
import { getPgdStatusLabel, type PgdInspectionStatus, type PgdTransitionContext } from '../utils/pgdDomain';

export default function PgdWorkflowMap({ status, evidence }: { status: PgdInspectionStatus; evidence: PgdTransitionContext }) {
  const currentStation = getPgdOperationalStation(status);
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Bản đồ 5 trạm hồ sơ PGD">
    <div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><ClipboardList size={15} className="text-blue-600" /> Bản đồ thao tác PGD</h3><p className="mt-1 text-[10px] text-slate-500">Học theo workflow PCN: trạm sau chỉ mở khi trạm hiện tại có đủ bằng chứng.</p></div><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">Trạm {currentStation.number}/5</span></div>
    <div className="grid gap-1.5 md:grid-cols-5">{PGD_OPERATIONAL_STATIONS.map((station) => {
      const access = getPgdOperationalStepAccess({ status, targetStationKey: station.key as PgdOperationalStationKey });
      const active = station.key === currentStation.key;
      const complete = station.number < currentStation.number;
      return <div key={station.key} aria-current={active ? 'step' : undefined} className={`rounded-lg border px-2 py-2 ${active ? 'border-blue-300 bg-blue-50' : complete ? 'border-emerald-200 bg-emerald-50/60' : access.locked ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}><div className="flex items-center gap-1.5"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${active ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-400'}`}>{complete ? '✓' : station.number}</span><span className={`text-[10px] font-black ${active ? 'text-blue-800' : complete ? 'text-emerald-800' : 'text-slate-500'}`}>{station.title}</span></div><p className="mt-1 text-[9px] leading-3 text-slate-500">{station.description}</p>{active && <div className="mt-1 text-[9px] font-bold text-blue-700">{getPgdStatusLabel(status)}</div>}{access.requiresWithdrawal && <div className="mt-1 text-[9px] font-bold text-amber-700">Đã khóa sau ký</div>}</div>;
    })}</div>
  </section>;
}

