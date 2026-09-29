'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  FileWarning,
  Search,
  UserRound,
  LayoutGrid,
  List,
  Building2,
  Package,
  Layers,
  FolderOpen,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PgdcnStatusBadge } from './PgdcnUiPrimitives';

export interface PgdDossierQueueRow {
  requestId: string;
  requestCode: string;
  customerName: string;
  productName: string;
  status: string;
  statusLabel: string;
  currentStepNumber: number;
  currentStepLabel: string;
  nextActionLabel?: string;
  requiredDocumentPresent: number;
  requiredDocumentTotal: number;
  missingRequiredCount: number;
  ownerUsername?: string;
  ownerDisplayName?: string;
  productGroup: string;
  catalogLabel: string;
}

export interface PgdDossierQueueViewProps {
  rows: PgdDossierQueueRow[];
  onOpenDossier: (requestId: string) => void;
}

function Metric({ label, value, icon: Icon, className }: { label: string; value: number; icon: LucideIcon; className: string }) {
  return (
    <div className={`pgdcn-kpi-card ${className}`}>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold text-slate-600" title={label}>
          {label}
        </span>
        <p className="mt-0.5 text-xl font-bold leading-5 text-slate-950">{value}</p>
      </div>
      <Icon size={17} aria-hidden="true" />
    </div>
  );
}

const PGD_FILTER_CHIPS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'STEEL', label: 'Thép/Kim loại' },
  { id: 'MACHINE', label: 'Máy móc' },
  { id: 'COAL', label: 'Than' },
  { id: 'INTAKE', label: 'Tiếp nhận' },
  { id: 'IN_PROGRESS', label: 'Đang xử lý' },
  { id: 'OVERDUE', label: 'Quá hạn' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
] as const;

type PgdFilterChipId = typeof PGD_FILTER_CHIPS[number]['id'];

export default function PgdDossierQueueView({ rows, onOpenDossier }: PgdDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [activeChip, setActiveChip] = useState<PgdFilterChipId>('ALL');
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    let result = rows;
    if (activeChip === 'STEEL') {
      result = result.filter((r) => /thép|kim loại/i.test(`${r.productName || ''} ${r.catalogLabel || ''}`));
    } else if (activeChip === 'MACHINE') {
      result = result.filter((r) => /máy/i.test(`${r.productName || ''} ${r.catalogLabel || ''}`));
    } else if (activeChip === 'COAL') {
      result = result.filter((r) => /than/i.test(`${r.productName || ''} ${r.catalogLabel || ''}`));
    } else if (activeChip === 'INTAKE') {
      result = result.filter((r) => /tiếp nhận/i.test(`${r.currentStepLabel || ''} ${r.statusLabel || ''}`));
    } else if (activeChip === 'IN_PROGRESS') {
      result = result.filter((r) => !['Đã hoàn thành', 'Đã lưu trữ', 'Đã hủy'].includes(r.statusLabel));
    } else if (activeChip === 'OVERDUE') {
      result = result.filter((r) => Boolean((r as any).isOverdue));
    } else if (activeChip === 'COMPLETED') {
      result = result.filter((r) => ['Đã hoàn thành', 'Đã lưu trữ', 'Đã ký', 'Đã trả kết quả'].includes(r.statusLabel));
    }

    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return result;
    return result.filter((row) =>
      [row.requestCode, row.customerName, row.productName, row.catalogLabel, row.currentStepLabel, row.ownerDisplayName, row.ownerUsername, row.statusLabel]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(needle)
    );
  }, [query, rows, activeChip]);

  const actionCount = rows.filter((row) => row.missingRequiredCount > 0 || !row.ownerUsername || !['Đã lưu trữ', 'Đã hủy'].includes(row.statusLabel)).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((row) => !row.ownerUsername).length;

  return (
    <section className="min-w-0 space-y-4 p-3 md:p-5" aria-label="Hàng đợi hồ sơ PGD">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Tổng hồ sơ" value={rows.length} icon={ClipboardList} className="border-slate-200 text-slate-600" />
        <Metric label="Cần xử lý" value={actionCount} icon={ArrowRight} className="border-blue-200 text-blue-700" />
        <Metric label="Còn thiếu tài liệu" value={incompleteCount} icon={FileWarning} className="border-amber-200 text-amber-700" />
        <Metric label="Chưa phân công" value={unassignedCount} icon={UserRound} className="border-violet-200 text-violet-700" />
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">PGD · Hàng đợi công việc</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Mở đúng hồ sơ, xử lý đúng việc</h2>
          <p className="mt-1 text-sm text-slate-600">Danh sách tập trung vào bước hiện tại, tài liệu còn thiếu và người phụ trách.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-3xs">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem dạng thẻ chuẩn DdT"
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">Dạng thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem bảng truyền thống"
            >
              <List size={13} />
              <span className="hidden sm:inline">Dạng bảng</span>
            </button>
          </div>

          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Tìm trong hàng đợi hồ sơ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm trong hàng đợi hồ sơ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* Filter Chips Toolbar theo Mục 3.1.1 (Mục 6) */}
      <div className="mobile-scroll-x flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
        {PGD_FILTER_CHIPS.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveChip(chip.id)}
              className={`mobile-touch-target inline-flex min-h-8 shrink-0 items-center rounded-xl px-3 py-1 text-[11px] font-black uppercase tracking-wider transition-colors ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {filteredRows.length > 0 ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRows.map((row) => {
              const score = row.requiredDocumentTotal > 0 ? Math.round((row.requiredDocumentPresent / row.requiredDocumentTotal) * 100) : 100;
              return (
                <div
                  key={row.requestId}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div>
                    {/* Header: Request Code and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDossier(row.requestId)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] font-black text-white shadow-3xs transition-colors hover:bg-slate-800 cursor-pointer"
                      >
                        <Layers size={11} className="text-blue-400" />
                        {row.requestCode}
                      </button>
                      <PgdcnStatusBadge domain="PGD" status={row.status} label={row.statusLabel} />
                    </div>

                    {/* Customer and Product */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <Building2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
                        <h3 className="line-clamp-1 text-xs font-black text-slate-800" title={row.customerName}>
                          {row.customerName || 'Chưa có khách hàng'}
                        </h3>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-600">
                        <Package size={12} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-1 text-xs font-medium" title={row.productName}>
                          {row.productName || 'Chưa có đối tượng'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate" title={row.catalogLabel}>
                        {row.catalogLabel} · {row.productGroup}
                      </div>
                    </div>

                    {/* Step / Current Station */}
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-black text-blue-900">
                          Bước {row.currentStepNumber} · {row.currentStepLabel}
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700">{row.nextActionLabel || 'Tiếp tục hồ sơ'}</span>
                      </div>
                    </div>

                    {/* Completeness & Missing docs */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          Tài liệu bắt buộc: <strong>{row.requiredDocumentPresent}/{row.requiredDocumentTotal}</strong>
                        </span>
                        <span className="font-bold text-slate-700">{score}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            score === 100
                              ? 'bg-emerald-500'
                              : score >= 60
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      {row.missingRequiredCount > 0 ? (
                        <p className="text-[10px] font-semibold text-amber-800">
                          <><AlertTriangle size={13} aria-hidden="true" /> Thiếu {row.missingRequiredCount} mục tài liệu bắt buộc</>
                        </p>
                      ) : (
                        <p className="text-[10px] font-semibold text-emerald-700">
                          <><CheckCircle2 size={13} aria-hidden="true" /> Đầy đủ tài liệu theo quy trình</>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Owner and Open Action */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500 truncate max-w-[150px]" title={row.ownerDisplayName || row.ownerUsername || 'Chưa phân công'}>
                        Chủ hồ sơ: <strong className="text-slate-700">{row.ownerDisplayName || row.ownerUsername || 'Chưa phân công'}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCard(row.requestId)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-700 cursor-pointer"
                      >
                        {expandedCardIds.has(row.requestId) ? 'Thu gọn' : 'Xem chi tiết'}
                        <ChevronDown size={12} className={`transition-transform ${expandedCardIds.has(row.requestId) ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenDossier(row.requestId)}
                      className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-black text-white shadow-3xs hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      <FolderOpen size={13} />
                      Mở hồ sơ
                      <ArrowRight size={11} className="opacity-70" />
                    </button>
                  </div>

                  {/* Accordion Panel */}
                  {expandedCardIds.has(row.requestId) && (
                    <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Tài liệu hiện có:</span>
                        <strong className="text-slate-800">{row.requiredDocumentPresent} / {row.requiredDocumentTotal}</strong>
                      </div>
                      {row.missingRequiredCount > 0 && (
                        <div className="text-amber-800 font-bold">
                          Thiếu {row.missingRequiredCount} mục tài liệu cần bổ sung.
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Phân loại: {row.catalogLabel} · Nhóm: {row.productGroup}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mobile-scroll-x min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table aria-label="Bảng hàng đợi hồ sơ PGD" className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ PGD đang cần xử lý</caption>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Mã PYC</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Đối tượng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Loại hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Việc hiện tại</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu còn thiếu</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.requestId} className="align-top transition-colors hover:bg-blue-50/40">
                    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal">
                      <div className="min-w-[150px]">
                        <button type="button" onClick={() => onOpenDossier(row.requestId)} className="mobile-touch-target min-h-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">
                          <p className="font-mono text-xs font-bold text-blue-700">{row.requestCode}</p>
                          <PgdcnStatusBadge compact domain="PGD" status={row.status} label={row.statusLabel} />
                        </button>
                      </div>
                    </th>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm font-medium text-slate-900"><span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span></td>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm text-slate-700"><span className="line-clamp-2">{row.productName || 'Chưa có đối tượng'}</span><span className="mt-1 block text-xs text-slate-500">{row.productGroup}</span></td>
                    <td className="max-w-[220px] px-3 py-3 align-top text-xs font-semibold text-slate-700"><span className="line-clamp-2">{row.catalogLabel}</span></td>
                    <td className="px-3 py-3 align-top"><p className="font-semibold text-blue-900">Bước {row.currentStepNumber} · {row.currentStepLabel}</p><p className="mt-1 text-xs text-slate-500">{row.nextActionLabel || 'Tiếp tục hồ sơ'}</p></td>
                    <td className="whitespace-nowrap px-3 py-3 align-top"><span className="font-semibold text-slate-900">{row.requiredDocumentPresent}/{row.requiredDocumentTotal}</span><p className="mt-1 text-xs text-slate-500">tài liệu bắt buộc</p></td>
                    <td className="max-w-[230px] px-3 py-3 align-top"><span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>{row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu bắt buộc'}</span></td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700">{row.ownerDisplayName || row.ownerUsername || 'Chưa phân công'}</td>
                    <td className="px-3 py-3 align-top text-right"><button type="button" className="mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={() => onOpenDossier(row.requestId)}>Mở hồ sơ<ArrowRight size={16} aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-900">Không có hồ sơ trong hàng đợi</p>
          <p className="mt-1 text-sm text-slate-500">Hãy thử đổi từ khóa hoặc mở Sổ dữ liệu để kiểm tra toàn bộ hồ sơ.</p>
        </div>
      )}
    </section>
  );
}
