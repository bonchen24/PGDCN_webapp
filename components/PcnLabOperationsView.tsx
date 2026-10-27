'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

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
  return value ? (formatDateTimeDdMmYyyy(value) || value) : '';
}

function rowHasAtLab(row: PcnSampleRegisterRow): boolean {
  return /phòng thử|ptn/i.test(row.currentLocation) || Object.values(row.labCells).some((cell) => cell && ['SENT', 'RECEIVED'].includes(cell.routeStatus));
}

function rowIsWaitingForPyc(row: PcnSampleRegisterRow): boolean {
  const cells = Object.values(row.labCells);
  return cells.length === 0 || cells.some((cell) => cell && !cell.pycNumber && !cell.externalRequestCode);
}

function rowIsWaitingForResult(row: PcnSampleRegisterRow): boolean {
  return Object.values(row.labCells).some((cell) => cell && ['SENT', 'RECEIVED'].includes(cell.routeStatus) && !cell.resultId);
}

function rowHasIssue(row: PcnSampleRegisterRow): boolean {
  return row.lotStatus === 'ISSUE' || Object.values(row.labCells).some((cell) => cell && (cell.routeStatus === 'ISSUE' || cell.dispatchStatus === 'ERROR' || cell.dispatchStatus === 'RECONCILE_REQUIRED' || cell.executionStatus === 'BLOCKED'));
}

export default function PcnLabOperationsView({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, sampleRequestBundles, returnedResults, canEdit, onSaveBundle, onSendBundle, onRetryBundleDispatch, onOpenDossier }: Props) {
  const [query, setQuery] = useState('');
  const [labFilter, setLabFilter] = useState<PcnSampleLabCode | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSampleItemIds, setSelectedSampleItemIds] = useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = useState('');
  const rows = useMemo(() => buildSampleRegisterRows({ dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, bundles: sampleRequestBundles, returnedResults }), [dossiers, proposals, sampleLots, sampleItems, sampleRoutes, labRequests, sampleRequestBundles, returnedResults]);
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return rows.filter((row) => {
      if (labFilter && !row.labCells[labFilter]) return false;
      if (!normalized) return true;
      return [row.lotCode, row.sampleCode, row.sampleType, row.model, row.customerName, row.dossierCode, row.proposalCode, row.currentLocation, ...Object.values(row.labCells).flatMap((cell) => [cell?.labName, cell?.pycNumber, cell?.externalRequestCode, cell?.routeStatus, cell?.executionStatus, cell?.labSampleCode, cell?.sampleConditionCode, cell?.sampleConditionNote])].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized);
    });
  }, [labFilter, query, rows]);
  const rowsAtLab = rows.filter(rowHasAtLab).length;
  const rowsWaitingForPyc = rows.filter(rowIsWaitingForPyc).length;
  const rowsWaitingForResult = rows.filter(rowIsWaitingForResult).length;
  const rowsWithIssues = rows.filter(rowHasIssue).length;
  const selectedRows = rows.filter((row) => selectedSampleItemIds.has(row.sampleItemId));
  const toggleRowSelection = (row: PcnSampleRegisterRow) => {
    setSelectionError('');
    setSelectedSampleItemIds((current) => {
      const next = new Set(current);
      if (next.has(row.sampleItemId)) {
        next.delete(row.sampleItemId);
        return next;
      }
      const selectedCustomer = rows.find((candidate) => next.has(candidate.sampleItemId))?.customerName;
      if (selectedCustomer && selectedCustomer !== row.customerName) {
        setSelectionError(`Không thể chọn dòng của ${row.customerName}; PYC tổng hiện đã khóa theo khách hàng ${selectedCustomer}.`);
        return current;
      }
      next.add(row.sampleItemId);
      return next;
    });
  };
  const toggleVisibleSelection = () => {
    setSelectionError('');
    const visibleCustomers = new Set(visibleRows.map((row) => row.customerName));
    const selectedCustomer = selectedRows[0]?.customerName;
    if (visibleCustomers.size > 1 || (selectedCustomer && [...visibleCustomers].some((customer) => customer !== selectedCustomer))) {
      setSelectionError('Chỉ có thể chọn các dòng cùng một khách hàng để tạo PYC tổng.');
      return;
    }
    setSelectedSampleItemIds((current) => new Set([...current, ...visibleRows.map((row) => row.sampleItemId)]));
  };

  return <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Chứng nhận (PCN)</p><h1 className="mt-1 text-xl font-black text-slate-900">Sổ quản lý mẫu</h1><p className="mt-1 max-w-4xl text-[11px] text-slate-500">Mỗi dòng là một mẫu thử. Mỗi cell PTN là một tuyến/PYC riêng; màu nền giúp nhận diện ngay nơi đang xử lý và phản hồi.</p></div>{canEdit && <button type="button" onClick={() => { setSelectionError(''); setModalOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Tạo Phiếu yêu cầu thử nghiệm</button>}</div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="Mẫu thử" value={rows.length} /><Metric label="Đang ở PTN" value={rowsAtLab} tone="indigo" /><Metric label="Chờ tạo PYC" value={rowsWaitingForPyc} /><Metric label="Chờ KQTN" value={rowsWaitingForResult} tone="emerald" /><Metric label="Có sự cố" value={rowsWithIssues} tone="rose" /></div>
    <div data-testid="sample-register-toolbar" className="pgdcn-toolbar-nowrap rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><label className="pgdcn-toolbar-search block min-w-0"><span className="mb-1 block text-[10px] font-black text-slate-600">Tìm trong Sổ quản lý mẫu</span><div className="relative"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm trong Sổ quản lý mẫu" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-9 w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[11px] outline-none focus:border-emerald-400" /></div></label><div className="pgdcn-toolbar-filter flex min-w-0 items-center gap-1.5"><Filter size={13} className="shrink-0 text-slate-400" /><select aria-label="Lọc theo phòng thử nghiệm" value={labFilter} onChange={(event) => setLabFilter(event.target.value as PcnSampleLabCode | '')} className="min-h-9 min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600"><option value="">Tất cả PTN</option>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <option key={lab.code} value={lab.code}>{lab.name}</option>)}</select></div><span className="pgdcn-toolbar-count flex items-center text-[10px] font-bold text-slate-400">{visibleRows.length}/{rows.length} dòng</span></div>
    {selectionError && <div id="sample-register-selection-error" data-testid="sample-register-selection-error" role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">{selectionError}</div>}
    <div data-testid="sample-register-grid" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="mobile-scroll-x overflow-x-auto"><table className="min-w-[1880px] w-full border-collapse text-left text-[10px]"><thead><tr className="border-b border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500"><th className="sticky left-0 z-10 w-16 border-r border-slate-200 bg-slate-100 px-3 py-2"><button type="button" onClick={toggleVisibleSelection} aria-label="Chọn các dòng cùng khách hàng đang hiển thị" className="min-h-11 font-black text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Chọn</button></th><th className="sticky left-16 z-10 min-w-[135px] border-r border-slate-200 bg-slate-100 px-3 py-2">Mã lô</th><th className="sticky left-[13rem] z-10 min-w-[135px] border-r border-slate-200 bg-slate-100 px-3 py-2">Mã mẫu</th><th className="min-w-[175px] px-3 py-2">Khách hàng</th><th className="min-w-[145px] px-3 py-2">Đề nghị/biên bản</th><th className="min-w-[170px] px-3 py-2">Sản phẩm/kiểu loại</th><th className="min-w-[90px] px-3 py-2">Số lượng</th><th className="min-w-[150px] px-3 py-2">Vị trí hiện tại</th><th className="min-w-[130px] px-3 py-2">Trạng thái mẫu</th>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <th key={lab.code} className={`min-w-[210px] border-l border-white px-3 py-2 ${labTone[lab.code].header}`}>{lab.name}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <RegisterRow key={row.id} row={row} dossiers={dossiers} selected={selectedSampleItemIds.has(row.sampleItemId)} onToggleSelection={() => toggleRowSelection(row)} onOpenDossier={onOpenDossier} onRetryBundleDispatch={onRetryBundleDispatch} />)}</tbody></table></div>{visibleRows.length === 0 && <div className="border-t border-dashed border-slate-200 p-10 text-center text-[11px] text-slate-500">Chưa có mẫu thử phù hợp.</div>}</div>
    <PcnSampleRequestBundleModal open={modalOpen} initialSampleItemIds={[...selectedSampleItemIds]} dossiers={dossiers} proposals={proposals} sampleLots={sampleLots} sampleItems={sampleItems} sampleRoutes={sampleRoutes} onClose={() => setModalOpen(false)} onSave={onSaveBundle} onSend={onSendBundle} onRetryBundleDispatch={onRetryBundleDispatch} />
  </div>;
}

function RegisterRow({ row, dossiers, selected, onToggleSelection, onOpenDossier, onRetryBundleDispatch }: { row: PcnSampleRegisterRow; dossiers: CertificationDossier[]; selected: boolean; onToggleSelection: () => void; onOpenDossier: Props['onOpenDossier']; onRetryBundleDispatch: Props['onRetryBundleDispatch'] }) {
  const dossier = dossiers.find((candidate) => candidate.dossierCode === row.dossierCode || candidate.id === row.dossierCode);
  return <tr className={`group border-t border-slate-100 align-top hover:bg-slate-50/70 ${selected ? 'bg-emerald-50/40' : ''}`}><td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-3 py-2 group-hover:bg-slate-50"><input type="checkbox" checked={selected} onChange={onToggleSelection} aria-label={`Chọn mẫu ${row.sampleCode} của ${row.customerName}`} className="h-4 w-4 accent-emerald-600" /></td><td className="sticky left-16 z-[1] border-r border-slate-100 bg-white px-3 py-2 font-mono font-black text-slate-700 group-hover:bg-slate-50">{row.lotCode}</td><td className="sticky left-[13rem] z-[1] border-r border-slate-100 bg-white px-3 py-2 group-hover:bg-slate-50"><button type="button" onClick={() => dossier && onOpenDossier(dossier, Object.values(row.labCells).some((cell) => cell?.resultId) ? 'results' : 'lab')} className="min-h-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><p className="font-mono text-[11px] font-black text-slate-900 group-hover:text-emerald-700">{row.sampleCode}</p></button></td><td className="px-3 py-2"><p className="font-black text-slate-700">{row.customerName}</p></td><td className="px-3 py-2"><p className="font-mono font-black text-slate-700">{row.proposalCode}</p><p className="mt-1 text-[9px] text-slate-500">{row.dossierCode}</p></td><td className="px-3 py-2"><p className="font-black text-slate-700">{row.sampleType}</p><p className="mt-1 text-[9px] text-slate-500">{row.brand || '—'} · {row.model}</p></td><td className="px-3 py-2 font-black text-slate-700">{row.quantity} {row.unit || 'mẫu'}</td><td className="px-3 py-2"><p className="flex items-center gap-1 font-bold text-slate-600"><Send size={10} />{row.currentLocation}</p></td><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black ${rowHasIssue(row) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{rowHasIssue(row) ? 'Có sự cố' : statusLabel(row.lotStatus)}</span></td>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <LabCell key={lab.code} labCode={lab.code} cell={row.labCells[lab.code]} onRetryBundleDispatch={onRetryBundleDispatch} />)}</tr>;
}

function LabCell({ labCode, cell, onRetryBundleDispatch }: { labCode: PcnSampleLabCode; cell?: PcnSampleRegisterLabCell; onRetryBundleDispatch: Props['onRetryBundleDispatch'] }) {
  const tone = labTone[labCode];
  if (!cell) {
    return <td data-testid={`lab-cell-${labCode}`} className="border-l border-white bg-slate-50/40 px-3 py-2"><span className="text-[9px] text-slate-300">Không gán PTN</span></td>;
  }

  return <td data-testid={`lab-cell-${labCode}`} className={`border-l border-white px-3 py-2 ${tone.cell}`}>
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${tone.badge}`}>{statusLabel(cell.routeStatus)}</span>
        {cell.resultOutcome && <span className="text-[9px] font-black text-emerald-700">KQ: {cell.resultOutcome}</span>}
      </div>
      <p className="font-mono text-[10px] font-black text-slate-800">{cell.pycNumber || 'Chưa tạo PYC'}</p>
      {cell.labSampleCode && <p className="text-[9px] font-bold text-slate-700">Mã mẫu PTN: <span className="font-mono">{cell.labSampleCode}</span></p>}
      <details className="mt-1.5 rounded-md border border-white/70 bg-white/40 px-1.5 py-1">
        <summary className="mobile-touch-target flex min-h-8 w-full cursor-pointer list-none items-center justify-between gap-2 text-left text-[9px] font-black text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <span>Xem chi tiết PTN</span>
          <span className="text-[8px] font-bold text-slate-400">{cell.executionStatus ? 'Có thực thi' : 'Chưa có lịch'}</span>
        </summary>
        <div className="mt-1 space-y-1 border-t border-slate-100 pt-1">
          {cell.externalRequestCode && <p className="text-[9px] text-slate-600">Mã phiếu PTN: {cell.externalRequestCode}</p>}
          {cell.executionStatus && <p className="text-[9px] font-black text-indigo-700">Thực thi: {executionStatusLabel(cell.executionStatus)}{cell.executionOutcome ? ` · ${cell.executionOutcome}` : ''}</p>}
          {cell.executionScheduledDate && <p className="text-[9px] text-slate-600">Lịch thử: {displayDate(cell.executionScheduledDate)}</p>}
          {cell.executionStartedAt && <p className="text-[9px] text-slate-600">Bắt đầu: {displayDate(cell.executionStartedAt)}</p>}
          {cell.executionCompletedAt && <p className="text-[9px] text-slate-600">Thử xong: {displayDate(cell.executionCompletedAt)}</p>}
          {(cell.sampleConditionCode || cell.sampleConditionNote) && <p className="text-[9px] text-slate-600">Tình trạng: {conditionLabel(cell.sampleConditionCode, cell.sampleConditionNote)}</p>}
          {(cell.receivedAt || cell.receivedBy || cell.receivedQuantity !== undefined) && <p className="text-[9px] text-slate-600">PTN nhận: {cell.receivedAt ? displayDate(cell.receivedAt) : 'Đã ghi nhận'}{cell.receivedQuantity !== undefined ? ` · ${cell.receivedQuantity} ${cell.receivedUnit || 'mẫu'}` : ''}{cell.receivedBy ? ` · ${cell.receivedBy}` : ''}</p>}
          {cell.syncStatus && <p className="text-[9px] font-bold text-slate-500">Liên thông: {cell.syncStatus}</p>}
          {cell.dispatchStatus === 'ERROR' || cell.dispatchStatus === 'RECONCILE_REQUIRED' ? <button type="button" onClick={() => cell.bundleId && cell.dispatchId && void onRetryBundleDispatch(cell.bundleId, cell.dispatchId)} className="mobile-touch-target rounded bg-white px-2 py-1 text-[9px] font-black text-rose-700 shadow-sm hover:bg-rose-100">{/* Retry PTN */}Gửi lại PTN</button> : null}
        </div>
      </details>
    </div>
  </td>;
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'indigo' | 'rose' }) { const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'indigo' ? 'text-indigo-600' : tone === 'rose' ? 'text-rose-600' : 'text-slate-800'; return <div className="pgdcn-kpi-card"><ClipboardList size={15} className="shrink-0 text-slate-400" /><div className="min-w-0"><div className={`text-lg font-black leading-5 ${color}`}>{value}</div><div className="truncate text-[9px] font-bold text-slate-500" title={label}>{label}</div></div></div>; }
