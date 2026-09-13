'use client';

import { ArrowRight, ClipboardList, FileWarning, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { PcnOperationsRegisterRow } from '../utils/pcnOperationsRegister';

export interface PcnDossierQueueViewProps {
  rows: PcnOperationsRegisterRow[];
  onOpenDossier: (dossierId: string) => void;
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function isActionable(row: PcnOperationsRegisterRow): boolean {
  return row.missingRequiredCount > 0 || !row.ownerUsername || !['ARCHIVED', 'CANCELLED'].includes(row.dossierStatus);
}

function metric(label: string, value: number, icon: typeof ClipboardList, className: string) {
  const Icon = icon;
  return <div className={`rounded-xl border bg-white p-4 ${className}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-600">{label}</span><Icon size={18} aria-hidden="true" /></div><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
}

export default function PcnDossierQueueView({ rows, onOpenDossier }: PcnDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return rows;
    return rows.filter((row) => [row.registrationCode, row.dossierCode, row.customerName, row.productName, row.stationTitle, row.ownerUsername].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(needle));
  }, [query, rows]);
  const actionCount = rows.filter(isActionable).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((row) => !row.ownerUsername).length;

  return (
    <section className="min-w-0 space-y-4" aria-label="Hàng đợi hồ sơ PCN">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metric('Tổng hồ sơ', rows.length, ClipboardList, 'border-slate-200 text-slate-600')}
        {metric('Cần xử lý', actionCount, ArrowRight, 'border-blue-200 text-blue-700')}
        {metric('Còn thiếu tài liệu', incompleteCount, FileWarning, 'border-amber-200 text-amber-700')}
        {metric('Chưa phân công', unassignedCount, UserRound, 'border-violet-200 text-violet-700')}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Hàng đợi hồ sơ</h2>
          <p className="mt-1 text-sm text-slate-600">Đối chiếu nhanh các hồ sơ đang cần xử lý và mở đúng bộ hồ sơ khi cần.</p>
        </div>
        <label className="block w-full sm:w-80">
          <span className="mb-1 block text-[10px] font-black text-slate-600">Tìm trong hàng đợi hồ sơ</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input type="search" aria-label="Tìm trong hàng đợi hồ sơ" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
          </div>
        </label>
      </div>

      {filteredRows.length > 0 ? (
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
                    <div className="min-w-[150px]"><p className="font-mono text-xs font-bold text-slate-950">{row.dossierCode}</p><p className="mt-1 text-xs text-slate-500">Đề nghị {row.registrationCode}</p><span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{statusLabel(row.dossierStatus)}</span></div>
                  </th>
                  <td className="max-w-[190px] px-3 py-3 align-top text-sm font-medium text-slate-900"><span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span></td>
                  <td className="max-w-[190px] px-3 py-3 align-top text-sm text-slate-700"><span className="line-clamp-2">{row.productName || 'Chưa có sản phẩm'}</span></td>
                  <td className="px-3 py-3 align-top"><p className="font-semibold text-blue-900">{row.stationTitle}</p><p className="mt-1 text-xs text-slate-500">{row.stationActionLabel}</p></td>
                  <td className="whitespace-nowrap px-3 py-3 align-top"><span className="font-semibold text-slate-900">{row.completenessScore}%</span><p className="mt-1 text-xs text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</p></td>
                  <td className="max-w-[230px] px-3 py-3 align-top"><span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>{row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu bắt buộc'}</span></td>
                  <td className="px-3 py-3 align-top text-sm text-slate-700">{row.ownerUsername || 'Chưa phân công'}</td>
                  <td className="px-3 py-3 align-top text-right"><button type="button" className="mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={() => onOpenDossier(row.dossierId)}>Mở hồ sơ<ArrowRight size={16} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><p className="text-sm font-semibold text-slate-900">Không có hồ sơ trong hàng đợi</p><p className="mt-1 text-sm text-slate-500">Hãy thử đổi từ khóa hoặc bộ lọc ở phía trên.</p></div>
      )}
    </section>
  );
}
