'use client';

import { ClipboardList, Filter, Plus, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleItem,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { buildSampleRegisterRows, type PcnSampleRegisterLabCell, type PcnSampleRegisterRow } from '../utils/pcnSampleRegister';
import PcnSampleRequestBundleModal from './PcnSampleRequestBundleModal';

type Props = {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  sampleRequestBundles: PcnSampleRequestBundle[];
  returnedResults: ReturnedTestResult[];
  canEdit: boolean;
  onSaveBundle: (draft: PcnSampleRequestBundleDraft) => Promise<PcnSampleRequestBundle>;
  onSendBundle: (bundleId: string) => Promise<PcnSampleRequestBundle>;
  onRetryBundleDispatch: (bundleId: string, dispatchId: string) => Promise<PcnSampleRequestBundle>;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: 'lab' | 'results') => void;
};

const labTone: Record<PcnSampleLabCode, { header: string; cell: string; badge: string }> = {
  PERFORMANCE: { header: 'bg-sky-100 text-sky-800', cell: 'bg-sky-50/80', badge: 'bg-sky-100 text-sky-800' },
  EMC: { header: 'bg-violet-100 text-violet-800', cell: 'bg-violet-50/80', badge: 'bg-violet-100 text-violet-800' },
  ELECTRICAL_SAFETY: { header: 'bg-amber-100 text-amber-800', cell: 'bg-amber-50/80', badge: 'bg-amber-100 text-amber-800' },
  CHEMICAL_ANALYSIS: { header: 'bg-emerald-100 text-emerald-800', cell: 'bg-emerald-50/80', badge: 'bg-emerald-100 text-emerald-800' },
};

function statusLabel(value?: string): string {
  const labels: Record<string, string> = { PENDING: 'Chờ gửi', SENT: 'Đã gửi', RECEIVED: 'PTN đã nhận', RESULT_RETURNED: 'Đã trả KQ', RETURNED_TO_PCN: 'Đã trả mẫu', CLOSED: 'Đóng', ISSUE: 'Có sự cố', CANCELLED: 'Hủy' };
  return labels[String(value || '')] || value || 'Chưa có tuyến';
}

function executionStatusLabel(value?: string): string {
  const labels: Record<string, string> = { UNSCHEDULED: 'Chưa xếp lịch', SCHEDULED: 'Đã xếp lịch', IN_PROGRESS: 'Đang thử', COMPLETED: 'Đã thử xong', BLOCKED: 'Bị chặn', CANCELLED: 'Đã hủy' };
  return labels[String(value || '')] || value || '';
}

function conditionLabel(code?: string, note?: string): string {
  const labels: Record<string, string> = { INTACT: 'Nguyên vẹn', DAMAGED: 'Hư hỏng', INCOMPLETE: 'Thiếu mẫu', SEAL_BROKEN: 'Rách tem', OTHER: 'Khác' };
  return [labels[String(code || '').toUpperCase()] || code, note].filter(Boolean).join(' · ');
}

function displayDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export default function PcnLabOperationsView({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, sampleRequestBundles, returnedResults, canEdit, onSaveBundle, onSendBundle, onRetryBundleDispatch, onOpenDossier }: Props) {
  const [query, setQuery] = useState('');
  const [labFilter, setLabFilter] = useState<PcnSampleLabCode | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const rows = useMemo(() => buildSampleRegisterRows({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, bundles: sampleRequestBundles, returnedResults }), [dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, sampleRequestBundles, returnedResults]);
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return rows.filter((row) => {
      if (labFilter && !row.labCells[labFilter]) return false;
      if (!normalized) return true;
      return [row.lotCode, row.sampleCode, row.sampleType, row.model, row.customerName, row.dossierCode, row.proposalCode, row.currentLocation, ...Object.values(row.labCells).flatMap((cell) => [cell?.labName, cell?.pycNumber, cell?.externalRequestCode, cell?.routeStatus, cell?.executionStatus, cell?.labSampleCode, cell?.sampleConditionCode, cell?.sampleConditionNote])].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized);
    });
  }, [labFilter, query, rows]);
  const assignedCells = rows.reduce((total, row) => total + Object.keys(row.labCells).length, 0);
  const returnedCells = rows.reduce((total, row) => total + Object.values(row.labCells).filter((cell) => cell?.resultId).length, 0);

  return <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Chứng nhận (PCN)</p><h1 className="mt-1 text-xl font-black text-slate-900">Sổ quản lý mẫu</h1><p className="mt-1 max-w-4xl text-[11px] text-slate-500">Mỗi dòng là một mẫu thử. Mỗi cell PTN là một tuyến/PYC riêng; màu nền giúp nhận diện ngay nơi đang xử lý và phản hồi.</p></div>{canEdit && <button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Tạo Phiếu yêu cầu thử nghiệm</button>}</div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Mẫu thử" value={rows.length} /><Metric label="Cell PTN" value={assignedCells} /><Metric label="Đã có phản hồi" value={returnedCells} tone="emerald" /><Metric label="PYC tổng" value={sampleRequestBundles.length} tone="indigo" /></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-col gap-2 md:flex-row md:items-center"><div className="relative min-w-0 flex-1"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm trong Sổ quản lý mẫu" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã lô, mã mẫu, khách hàng, hồ sơ, PYC..." className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[11px] outline-none focus:border-emerald-400" /></div><div className="flex items-center gap-1.5"><Filter size={13} className="text-slate-400" /><select aria-label="Lọc theo phòng thử nghiệm" value={labFilter} onChange={(event) => setLabFilter(event.target.value as PcnSampleLabCode | '')} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600"><option value="">Tất cả PTN</option>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <option key={lab.code} value={lab.code}>{lab.name}</option>)}</select></div><span className="text-[10px] font-bold text-slate-400">{visibleRows.length}/{rows.length} dòng</span></div></div>
    <div data-testid="sample-register-grid" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1500px] w-full border-collapse text-left text-[10px]"><thead><tr className="border-b border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500"><th className="sticky left-0 z-10 min-w-[250px] border-r border-slate-200 bg-slate-100 px-3 py-2">Mẫu thử / mã hóa</th><th className="min-w-[175px] px-3 py-2">Khách hàng</th><th className="min-w-[125px] px-3 py-2">Hồ sơ / Đề nghị</th><th className="min-w-[145px] px-3 py-2">Số lượng / vị trí</th>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <th key={lab.code} className={`min-w-[210px] border-l border-white px-3 py-2 ${labTone[lab.code].header}`}>{lab.name}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <RegisterRow key={row.id} row={row} dossiers={dossiers} onOpenDossier={onOpenDossier} onRetryBundleDispatch={onRetryBundleDispatch} />)}</tbody></table></div>{visibleRows.length === 0 && <div className="border-t border-dashed border-slate-200 p-10 text-center text-[11px] text-slate-500">Chưa có mẫu thử phù hợp.</div>}</div>
    <PcnSampleRequestBundleModal open={modalOpen} dossiers={dossiers} proposals={proposals} sampleLots={sampleLots} sampleItems={sampleItems} onClose={() => setModalOpen(false)} onSave={onSaveBundle} onSend={onSendBundle} />
  </div>;
}

function RegisterRow({ row, dossiers, onOpenDossier, onRetryBundleDispatch }: { row: PcnSampleRegisterRow; dossiers: CertificationDossier[]; onOpenDossier: Props['onOpenDossier']; onRetryBundleDispatch: Props['onRetryBundleDispatch'] }) {
  const dossier = dossiers.find((candidate) => candidate.dossierCode === row.dossierCode || candidate.id === row.dossierCode);
  return <tr className="group border-t border-slate-100 align-top hover:bg-slate-50/70"><td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-3 py-2 group-hover:bg-slate-50"><button type="button" onClick={() => dossier && onOpenDossier(dossier, Object.values(row.labCells).some((cell) => cell?.resultId) ? 'results' : 'lab')} className="text-left"><p className="font-mono text-[11px] font-black text-slate-900 group-hover:text-emerald-700">{row.sampleCode}</p><p className="mt-0.5 font-mono text-[9px] font-bold text-slate-500">Lô {row.lotCode}</p><p className="mt-1 text-[9px] text-slate-500">{row.sampleType} · {row.model}</p></button></td><td className="px-3 py-2"><p className="font-black text-slate-700">{row.customerName}</p><p className="mt-1 text-[9px] text-slate-500">{row.proposalCode}</p></td><td className="px-3 py-2"><p className="font-mono font-black text-slate-700">{row.dossierCode}</p><span className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{row.lotStatus}</span></td><td className="px-3 py-2"><p className="font-black text-slate-700">{row.quantity} {row.unit || 'mẫu'}</p><p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500"><Send size={10} />{row.currentLocation}</p></td>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <LabCell key={lab.code} labCode={lab.code} cell={row.labCells[lab.code]} onRetryBundleDispatch={onRetryBundleDispatch} />)}</tr>;
}

function LabCell({ labCode, cell, onRetryBundleDispatch }: { labCode: PcnSampleLabCode; cell?: PcnSampleRegisterLabCell; onRetryBundleDispatch: Props['onRetryBundleDispatch'] }) {
  const tone = labTone[labCode];
  return <td data-testid={`lab-cell-${labCode}`} className={`border-l border-white px-3 py-2 ${cell ? tone.cell : 'bg-slate-50/40'}`}>{cell ? <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${tone.badge}`}>{statusLabel(cell.routeStatus)}</span>{cell.resultOutcome && <span className="text-[9px] font-black text-emerald-700">KQ: {cell.resultOutcome}</span>}</div><p className="font-mono text-[10px] font-black text-slate-800">{cell.pycNumber || 'Chưa tạo PYC'}</p>{cell.externalRequestCode && <p className="text-[9px] text-slate-600">Mã phiếu PTN: {cell.externalRequestCode}</p>}{cell.labSampleCode && <p className="text-[9px] font-bold text-slate-700">Mã mẫu PTN: <span className="font-mono">{cell.labSampleCode}</span></p>}{cell.executionStatus && <p className="text-[9px] font-black text-indigo-700">Thực thi: {executionStatusLabel(cell.executionStatus)}{cell.executionOutcome ? ` · ${cell.executionOutcome}` : ''}</p>}{cell.executionScheduledDate && <p className="text-[9px] text-slate-600">Lịch thử: {displayDate(cell.executionScheduledDate)}</p>}{cell.executionStartedAt && <p className="text-[9px] text-slate-600">Bắt đầu: {displayDate(cell.executionStartedAt)}</p>}{cell.executionCompletedAt && <p className="text-[9px] text-slate-600">Thử xong: {displayDate(cell.executionCompletedAt)}</p>}{(cell.sampleConditionCode || cell.sampleConditionNote) && <p className="text-[9px] text-slate-600">Tình trạng: {conditionLabel(cell.sampleConditionCode, cell.sampleConditionNote)}</p>}{(cell.receivedAt || cell.receivedBy || cell.receivedQuantity !== undefined) && <p className="text-[9px] text-slate-600">PTN nhận: {cell.receivedAt ? displayDate(cell.receivedAt) : 'Đã ghi nhận'}{cell.receivedQuantity !== undefined ? ` · ${cell.receivedQuantity} ${cell.receivedUnit || 'mẫu'}` : ''}{cell.receivedBy ? ` · ${cell.receivedBy}` : ''}</p>}{cell.syncStatus && <p className="text-[9px] font-bold text-slate-500">Liên thông: {cell.syncStatus}</p>}{cell.dispatchStatus === 'ERROR' || cell.dispatchStatus === 'RECONCILE_REQUIRED' ? <button type="button" onClick={() => cell.bundleId && cell.dispatchId && void onRetryBundleDispatch(cell.bundleId, cell.dispatchId)} className="rounded bg-white px-2 py-1 text-[9px] font-black text-rose-700 shadow-sm hover:bg-rose-100">Retry PTN</button> : null}</div> : <span className="text-[9px] text-slate-300">Không gán PTN</span>}</td>;
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'indigo' }) { const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'indigo' ? 'text-indigo-600' : 'text-slate-800'; return <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"><ClipboardList size={15} className="text-slate-400" /><div className={`mt-1 text-lg font-black ${color}`}>{value}</div><div className="truncate text-[9px] font-bold text-slate-500">{label}</div></div>; }
