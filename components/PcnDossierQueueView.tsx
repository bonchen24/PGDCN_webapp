'use client';

import {
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  FileWarning,
  Search,
  UserRound,
  LayoutGrid,
  List,
  Building2,
  Package,
  Clock,
  Layers,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import type { PcnOperationsRegisterRow } from '../utils/pcnOperationsRegister';
import { getPgdcnDashboardStatusLabel } from '../utils/pgdcnDashboard';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';

export interface PcnDossierQueueViewProps {
  rows: PcnOperationsRegisterRow[];
  onOpenDossier: (dossierId: string) => void;
  filterControls?: ReactNode;
}

function statusLabel(value: string): string {
  return getPgdcnDashboardStatusLabel('PCN', value);
}

function isActionable(row: PcnOperationsRegisterRow): boolean {
  return row.missingRequiredCount > 0 || !row.ownerUsername || !['ARCHIVED', 'CANCELLED'].includes(row.dossierStatus);
}

function metric(label: string, value: number, icon: typeof ClipboardList, className: string) {
  const Icon = icon;
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

export default function PcnDossierQueueView({ rows, onOpenDossier, filterControls }: PcnDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.registrationCode, row.dossierCode, row.customerName, row.productName, row.stationTitle, row.ownerUsername]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(needle)
    );
  }, [query, rows]);

  const actionCount = rows.filter(isActionable).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((row) => !row.ownerUsername).length;

  return (
    <section data-testid="pcn-dossier-queue" className="min-w-0 space-y-3.5 p-3 md:p-5" aria-label="Hàng đợi hồ sơ PCN">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metric('Tổng hồ sơ', rows.length, ClipboardList, 'border-slate-200 text-slate-600')}
        {metric('Cần xử lý', actionCount, ArrowRight, 'border-blue-200 text-blue-700')}
        {metric('Còn thiếu tài liệu', incompleteCount, FileWarning, 'border-amber-200 text-amber-700')}
        {metric('Chưa phân công', unassignedCount, UserRound, 'border-violet-200 text-violet-700')}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">PCN · Hàng đợi công việc</p>
          <h2 className="mt-1 text-base font-black text-slate-950">Mở đúng hồ sơ, xử lý đúng việc</h2>
          <p className="mt-1 text-xs text-slate-600">
            Phòng Giám định - Chứng nhận và Phát triển thị trường · Danh sách tập trung vào bước hiện tại, tài liệu còn thiếu và người phụ trách.
          </p>
        </div>

        {/* View Switcher */}
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

        <div className="pgdcn-toolbar-nowrap w-full rounded-xl border border-slate-200 bg-slate-50 p-2">
          <label className="pgdcn-toolbar-search block">
            <span className="mb-1 block text-[10px] font-black text-slate-600">Tìm trong hàng đợi hồ sơ</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Tìm trong hàng đợi hồ sơ"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </label>
          {filterControls}
        </div>
      </div>

      {filteredRows.length > 0 ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRows.map((row) => (
              <div
                key={row.dossierId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all"
              >
                <div>
                  {/* Card Header: Codes and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenDossier(row.dossierId)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-white shadow-3xs transition-colors hover:bg-slate-800"
                      >
                        <Layers size={11} className="text-emerald-400" />
                        {row.dossierCode}
                      </button>
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                        ĐN: {row.registrationCode}
                      </span>
                    </div>

                    <PgdcnStatusBadge domain="PCN" status={row.dossierStatus} label={statusLabel(row.dossierStatus)} />
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
                        {row.productName || 'Chưa có sản phẩm'}
                      </span>
                    </div>
                  </div>

                  {/* Current Station / Step */}
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-black text-blue-900">{row.stationTitle}</span>
                      <span className="text-[10px] font-semibold text-blue-700">{row.stationActionLabel}</span>
                    </div>
                  </div>

                  {/* Completeness & Missing documents warning */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        Hồ sơ bắt buộc: <strong>{row.requiredDocumentPresent}/{row.requiredDocumentTotal}</strong>
                      </span>
                      <span className="font-bold text-slate-700">{row.completenessScore}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          row.completenessScore === 100
                            ? 'bg-emerald-500'
                            : row.completenessScore >= 60
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${row.completenessScore}%` }}
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

                {/* Footer: Owner and Open Action */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="text-[11px] text-slate-500 truncate max-w-[150px]" title={row.ownerUsername || 'Chưa phân công'}>
                    Chủ hồ sơ: <strong className="text-slate-700">{row.ownerUsername || 'Chưa phân công'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDossier(row.dossierId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white shadow-3xs hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    <FolderOpen size={13} />
                    Mở hồ sơ
                    <ArrowRight size={11} className="opacity-70" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mobile-scroll-x min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table aria-label="Bảng hàng đợi hồ sơ PCN" className="w-full min-w-[980px] border-collapse text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ PCN đang chờ xử lý</caption>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Hồ sơ / Đề nghị</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Sản phẩm</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Bước hiện tại</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.dossierId} className="align-top transition-colors hover:bg-blue-50/40">
                    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal">
                      <div className="min-w-[150px]"><button type="button" onClick={() => onOpenDossier(row.dossierId)} aria-label={`Mở chi tiết hồ sơ ${row.dossierCode}`} className="font-mono text-xs font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">{row.dossierCode}</button><p className="mt-1 text-xs text-slate-500">Đề nghị {row.registrationCode}</p><PgdcnStatusBadge compact domain="PCN" status={row.dossierStatus} label={statusLabel(row.dossierStatus)} /></div>
                    </th>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm font-medium text-slate-900"><span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span></td>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm text-slate-700"><span className="line-clamp-2">{row.productName || 'Chưa có sản phẩm'}</span></td>
                    <td className="px-3 py-3 align-top"><p className="font-semibold text-blue-900">{row.stationTitle}</p><p className="mt-1 text-xs text-slate-500">{row.stationActionLabel}</p></td>
                    <td className="whitespace-nowrap px-3 py-3 align-top"><span className="font-semibold text-slate-900">{row.completenessScore}%</span><p className="mt-1 text-xs text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</p></td>
                    <td className="max-w-[230px] px-3 py-3 align-top"><span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>{row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu bắt buộc'}</span></td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700">{row.ownerUsername || 'Chưa phân công'}</td>
                    <td className="px-3 py-3 align-top text-right"><button type="button" className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[10px] font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={() => onOpenDossier(row.dossierId)}>{row.stationActionLabel}<ArrowRight size={14} aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><p className="text-sm font-semibold text-slate-900">Không có hồ sơ trong hàng đợi</p><p className="mt-1 text-sm text-slate-500">Hãy thử đổi từ khóa hoặc bộ lọc ở phía trên.</p></div>
      )}
    </section>
  );
}
