'use client';

import { Download, ExternalLink, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { CertificationDossier, CertificationProposal, PcnCertificationField, PcnDocumentRequirement, PcnDossierDocument, PcnUserAccount, PcnSampleLot, PcnSampleRoute, OutboundLabRequest, ReturnedTestResult, IssuancePackage } from '../types';
import { buildPcnOperationsRegisterRows, filterPcnOperationsRegisterRows, toPcnOperationsRegisterCsv } from '../utils/pcnOperationsRegister';
import { getPcnWorkflowStage } from '../utils/pcnWorkflowStages';
import { PgdcnPageHeader, PgdcnStatePanel, PgdcnToolbar } from './PgdcnUiPrimitives';

type Props = {
  fields: PcnCertificationField[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  issuancePackages: IssuancePackage[];
  documentRequirements: PcnDocumentRequirement[];
  dossierDocuments: PcnDossierDocument[];
  users: PcnUserAccount[];
  onOpenDossier: (dossier: CertificationDossier, initialTab?: 'documents' | 'lab' | 'results' | 'issuance') => void;
};

function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

export default function PcnOperationsRegisterView(props: Props) {
  const [query, setQuery] = useState('');
  const [completeness, setCompleteness] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETE'>('ALL');
  const [assignment, setAssignment] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [fieldCode, setFieldCode] = useState('');
  const rows = useMemo(() => buildPcnOperationsRegisterRows(props), [props]);
  const visibleRows = useMemo(() => filterPcnOperationsRegisterRows(rows, { query, fieldCode, completeness, assignment }), [rows, query, fieldCode, completeness, assignment]);

  const exportCsv = () => {
    const blob = new Blob([toPcnOperationsRegisterCsv(visibleRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `so-dieu-hanh-pcn-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
      <PgdcnPageHeader eyebrow="Quản lý PCN" title="Sổ điều hành" description="Một dòng là một bộ hồ sơ. Số liệu lấy từ card hồ sơ chuẩn và chỉ đọc." actions={<button type="button" onClick={exportCsv} className="mobile-touch-target inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-700"><Download size={14} /> Xuất CSV</button>} />
      <PgdcnToolbar actions={<span className="text-right text-[10px] font-bold text-slate-500">{visibleRows.length}/{rows.length} hồ sơ</span>}>
        <label className="relative block"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm Sổ điều hành" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã Đề nghị, hồ sơ, khách hàng, sản phẩm..." className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[11px] outline-none focus:border-emerald-400" /></label>
        <select aria-label="Lọc mức hoàn thiện" value={completeness} onChange={(event) => setCompleteness(event.target.value as typeof completeness)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]"><option value="ALL">Tất cả hoàn thiện</option><option value="INCOMPLETE">Còn thiếu tài liệu</option><option value="COMPLETE">Đủ tài liệu bắt buộc</option></select>
        <select aria-label="Lọc phân công" value={assignment} onChange={(event) => setAssignment(event.target.value as typeof assignment)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]"><option value="ALL">Tất cả chủ hồ sơ</option><option value="ASSIGNED">Đã phân công</option><option value="UNASSIGNED">Chưa phân công</option></select>
        <select aria-label="Lọc lĩnh vực Sổ điều hành" value={fieldCode} onChange={(event) => setFieldCode(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]"><option value="">Tất cả Lĩnh vực</option>{props.fields.map((field) => <option key={field.code} value={field.code}>{field.code} · {field.name}</option>)}</select>
      </PgdcnToolbar>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1120px] text-left"><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Đề nghị / hồ sơ</th><th className="px-3 py-2">Khách hàng / sản phẩm</th><th className="px-3 py-2">Bước hiện tại</th><th className="px-3 py-2">Hoàn thiện</th><th className="px-3 py-2">Mẫu / PTN</th><th className="px-3 py-2">Hạn / chủ hồ sơ</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row) => { const stage = getPcnWorkflowStage(row.dossierStatus); const dossier = props.dossiers.find((item) => item.id === row.dossierId); return <tr key={row.dossierId} className="hover:bg-emerald-50/30"><td className="px-3 py-2.5"><div className="font-mono text-[11px] font-black text-slate-800">{row.registrationCode}</div><div className="mt-0.5 font-mono text-[10px] text-slate-500">{row.dossierCode}</div></td><td className="max-w-[220px] px-3 py-2.5"><div className="truncate text-[11px] font-bold text-slate-700">{row.customerName}</div><div className="truncate text-[10px] text-slate-500">{row.productName}{row.model ? ` · ${row.model}` : ''}</div></td><td className="px-3 py-2.5"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Bước {stage.number} · {stage.title}</span><div className="mt-1 text-[10px] text-slate-500">{row.dossierStatus}</div></td><td className="px-3 py-2.5"><div className="text-[11px] font-black text-slate-700">{row.completenessScore}%</div><div className="text-[9px] text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} · thiếu {row.missingRequiredCount}</div></td><td className="px-3 py-2.5"><div className="text-[10px] font-bold text-slate-700">{row.sampleQuantity ?? '—'} {row.sampleQuantity ? 'mẫu' : ''}</div><div className="max-w-[180px] truncate text-[9px] text-slate-500">{row.labStatuses.join(' · ') || 'Chưa có tuyến'}</div></td><td className="px-3 py-2.5"><div className="text-[10px] font-bold text-slate-700">{row.ownerUsername || 'Chưa phân công'}</div><div className="text-[9px] text-slate-500">Nhận {date(row.receivedAt)}</div></td><td className="px-3 py-2.5 text-right"><button type="button" onClick={() => dossier && props.onOpenDossier(dossier, 'documents')} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[9px] font-black text-emerald-700 hover:border-emerald-300"><ExternalLink size={12} /> Mở hồ sơ</button></td></tr>; })}</tbody></table></div>
        <div className="divide-y divide-slate-100 md:hidden">{visibleRows.map((row) => { const stage = getPcnWorkflowStage(row.dossierStatus); const dossier = props.dossiers.find((item) => item.id === row.dossierId); return <button type="button" key={row.dossierId} onClick={() => dossier && props.onOpenDossier(dossier, 'documents')} className="block w-full p-3 text-left hover:bg-emerald-50/30"><div className="flex items-start justify-between gap-2"><div><div className="font-mono text-[11px] font-black text-slate-800">{row.registrationCode}</div><div className="text-[10px] text-slate-500">{row.customerName} · {row.productName}</div></div><span className="rounded-full bg-emerald-50 px-1.5 py-1 text-[9px] font-black text-emerald-700">Bước {stage.number}</span></div><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{stage.title}</span><span className="font-black text-slate-700">{row.completenessScore}% · thiếu {row.missingRequiredCount}</span></div></button>; })}</div>
        {visibleRows.length === 0 && <PgdcnStatePanel tone="empty" title="Không có hồ sơ phù hợp bộ lọc" description="Hãy điều chỉnh từ khóa hoặc bộ lọc để xem lại danh sách hồ sơ." />}
      </div>
    </div>
  );
}
