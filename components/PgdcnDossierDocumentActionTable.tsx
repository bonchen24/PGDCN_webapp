'use client';

import type { ReactNode } from 'react';

export type PgdcnDossierDocumentActionRow = {
  id: string;
  step: string;
  title: string;
  required: boolean;
  status: string;
  statusTone?: 'success' | 'warning' | 'neutral' | 'danger';
  detail?: ReactNode;
  action: ReactNode;
};

type Props = {
  rows: readonly PgdcnDossierDocumentActionRow[];
  testId: string;
  emptyLabel?: string;
  renderRow?: (row: PgdcnDossierDocumentActionRow) => ReactNode;
};

const STATUS_TONE_CLASS: Record<NonNullable<PgdcnDossierDocumentActionRow['statusTone']>, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
};

export default function PgdcnDossierDocumentActionTable({ rows, testId, emptyLabel = 'Chưa có tài liệu cần xử lý ở bước này.', renderRow }: Props) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white" data-testid={testId}>
      {rows.length > 0 ? (
        <>
          {renderRow ? (
            <span id={`${testId}-render-row-scroll-help`} className="sr-only">Kéo ngang để xem thêm các cột.</span>
          ) : null}
          <div
            className={renderRow
              ? 'mobile-scroll-x min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x rounded-b-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500'
              : 'min-w-0 max-w-full'}
            role={renderRow ? 'region' : undefined}
            aria-label={renderRow ? 'Bảng tài liệu cần xử lý, cuộn ngang để xem các cột khác' : undefined}
            aria-describedby={renderRow ? `${testId}-render-row-scroll-help` : undefined}
            tabIndex={renderRow ? 0 : undefined}
          >
            <table className={renderRow
              ? 'w-full min-w-0 border-collapse text-left text-xs'
              : 'block w-full min-w-0 border-collapse text-left text-xs md:table'}>
              <caption className="sr-only">Danh sách tài liệu cần hoàn thiện</caption>
              <thead className={renderRow
                ? 'bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500'
                : 'sr-only bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500 md:not-sr-only md:table-header-group'}>
                <tr>
                  <th scope="col" className="border-b border-slate-200 px-2.5 py-1.5">Tài liệu cần có</th>
                  <th scope="col" className="w-24 border-b border-slate-200 px-2.5 py-1.5">Trạng thái</th>
                  <th scope="col" className="w-40 border-b border-slate-200 px-2.5 py-1.5">Hành động</th>
                </tr>
              </thead>
              <tbody className={renderRow ? undefined : 'block space-y-2 md:table-row-group md:space-y-0'}>
                {rows.map((row) => renderRow ? renderRow(row) : (
                  <tr key={row.id} className="block min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition-colors hover:bg-blue-50/40 md:table-row md:rounded-none md:border-0 md:p-0 md:shadow-none">
                    <th scope="row" className="block min-w-0 break-words border-0 px-0 py-1 font-semibold text-slate-800 md:table-cell md:border-b md:border-slate-100 md:px-2.5 md:py-1.5">
                      <span aria-hidden="true" className="mb-0.5 block text-xs font-black uppercase tracking-wide text-slate-500 md:hidden">Tài liệu cần có</span>
                      <span>{row.title}{row.required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}</span>
                      {row.required ? <span className="ml-1.5 text-[11px] font-normal text-rose-600">Bắt buộc</span> : <span className="ml-1.5 text-[11px] font-normal text-slate-500">Tùy chọn</span>}
                      {row.detail ? <div className="mt-0.5 break-words text-[11px] font-normal leading-4 text-slate-500">{row.detail}</div> : null}
                    </th>
                    <td className="flex min-w-0 items-center gap-2 border-0 px-0 py-1 md:table-cell md:border-b md:border-slate-100 md:px-2.5 md:py-1.5">
                      <span aria-hidden="true" className="w-24 shrink-0 text-xs font-black uppercase tracking-wide text-slate-500 md:hidden">Trạng thái</span>
                      {row.status ? <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold max-w-full whitespace-normal break-words ${STATUS_TONE_CLASS[row.statusTone || 'neutral']}`}>{row.status}</span> : null}
                    </td>
                    <td className="flex min-w-0 flex-wrap items-center gap-1.5 border-0 px-0 py-1 md:table-cell md:border-b md:border-slate-100 md:px-2.5 md:py-1.5">
                      {row.action !== null && row.action !== undefined ? (
                        <>
                          <span aria-hidden="true" className="w-24 shrink-0 text-xs font-black uppercase tracking-wide text-slate-500 md:hidden">Hành động</span>
                          <div className="min-w-0 max-w-full flex-1 md:flex-none">{row.action}</div>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="p-4 text-xs text-slate-500">{emptyLabel}</p>}
    </div>
  );
}
