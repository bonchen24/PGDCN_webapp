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
    <div className="mobile-scroll-x overflow-x-auto rounded-lg border border-slate-200 bg-white" data-testid={testId}>
      {rows.length > 0 ? (
        <table className="min-w-[760px] w-full border-collapse text-left text-[10px]">
          <caption className="sr-only">Danh sách tài liệu cần hoàn thiện</caption>
          <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="w-36 border-b border-slate-200 px-3 py-2">Bước</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Tài liệu cần có</th>
              <th scope="col" className="w-28 border-b border-slate-200 px-3 py-2">Trạng thái</th>
              <th scope="col" className="w-56 border-b border-slate-200 px-3 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => renderRow ? renderRow(row) : (
              <tr key={row.id} className="align-top transition-colors hover:bg-blue-50/40">
                <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-500">{row.step}</td>
                <th scope="row" className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-800">
                  <span>{row.title}{row.required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}</span>
                  {row.required ? <span className="ml-2 text-[9px] font-normal text-rose-600">Bắt buộc</span> : <span className="ml-2 text-[9px] font-normal text-slate-400">Tùy chọn</span>}
                  {row.detail ? <div className="mt-1 text-[9px] font-normal leading-4 text-slate-500">{row.detail}</div> : null}
                </th>
                <td className="border-b border-slate-100 px-3 py-2.5"><span className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-[9px] font-black ${STATUS_TONE_CLASS[row.statusTone || 'neutral']}`}>{row.status}</span></td>
                <td className="border-b border-slate-100 px-3 py-2.5">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="p-4 text-xs text-slate-500">{emptyLabel}</p>}
    </div>
  );
}
