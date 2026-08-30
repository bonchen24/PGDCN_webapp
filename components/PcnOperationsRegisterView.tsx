'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Search } from 'lucide-react';

import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  OutboundLabRequest,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleLot,
  PcnSampleRoute,
  PcnUserAccount,
  ReturnedTestResult,
} from '../types';
import {
  buildPcnOperationsRegisterRows,
  filterPcnOperationsRegisterRows,
  toPcnOperationsRegisterCsv,
  type PcnOperationsRegisterFilter,
} from '../utils/pcnOperationsRegister';
import { getPcnDossierStationTab, type PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';

const statusOptions: Array<{ code: CertificationDossier['status']; label: string }> = [
  { code: 'DRAFT', label: 'Bản nháp' },
  { code: 'INTAKE_REVIEW', label: 'Kiểm tra Đề nghị' },
  { code: 'AWAITING_DOCUMENTS', label: 'Chờ bổ sung hồ sơ' },
  { code: 'ASSIGNED', label: 'Đã phân công' },
  { code: 'PLAN_PENDING_APPROVAL', label: 'Chờ duyệt kế hoạch' },
  { code: 'FIELD_EVALUATION', label: 'Đang đánh giá' },
  { code: 'AWAITING_SAMPLING', label: 'Chờ lấy mẫu' },
  { code: 'SENT_TO_LAB', label: 'Đã gửi PTN' },
  { code: 'AWAITING_RESULTS', label: 'Chờ KQTN' },
  { code: 'CORRECTIVE_ACTION', label: 'Đang khắc phục' },
  { code: 'TECHNICAL_REVIEW', label: 'Soát xét kỹ thuật' },
  { code: 'WAITING_APPROVAL', label: 'Chờ phê duyệt' },
  { code: 'APPROVED', label: 'Đã phê duyệt' },
  { code: 'ISSUED', label: 'Đã phát hành' },
  { code: 'DELIVERED', label: 'Đã giao khách hàng' },
  { code: 'ARCHIVED', label: 'Đã lưu trữ' },
  { code: 'REJECTED', label: 'Từ chối / trả lại' },
  { code: 'CANCELLED', label: 'Đã hủy' },
  { code: 'ON_HOLD', label: 'Tạm dừng' },
];

const statusLabel = new Map(statusOptions.map((item) => [item.code, item.label]));

function formatDate(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN');
}

function outcomeLabel(value?: ReturnedTestResult['outcome']): string {
  if (value === 'PASS') return 'Đạt';
  if (value === 'FAIL') return 'Không đạt';
  if (value === 'PENDING') return 'Đang chờ';
  return 'Chưa cập nhật';
}

function statusClass(status: CertificationDossier['status']): string {
  if (['ISSUED', 'DELIVERED', 'ARCHIVED', 'APPROVED'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['REJECTED', 'CANCELLED'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (['AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'WAITING_APPROVAL'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function missingDocumentSummary(row: ReturnType<typeof buildPcnOperationsRegisterRows>[number]): string {
  return row.missingRequiredByStage
    .map((group) => `${group.label}: ${group.labels.join(', ')}`)
    .join(' · ');
}

interface PcnOperationsRegisterViewProps {
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
  onOpenDossier: (dossier: CertificationDossier, initialTab?: PcnDossierDetailTab) => void;
}

export function PcnOperationsRegisterView({
  fields,
  proposals,
  dossiers,
  sampleLots,
  sampleRoutes,
  labRequests,
  returnedResults,
  issuancePackages,
  documentRequirements,
  dossierDocuments,
  users,
  onOpenDossier,
}: PcnOperationsRegisterViewProps) {
  const allRows = useMemo(() => buildPcnOperationsRegisterRows({ fields, proposals, dossiers, sampleLots, sampleRoutes, labRequests, returnedResults, issuancePackages, documentRequirements, dossierDocuments }), [fields, proposals, dossiers, sampleLots, sampleRoutes, labRequests, returnedResults, issuancePackages, documentRequirements, dossierDocuments]);
  const availableYears = useMemo(() => [...new Set(allRows.map((row) => row.receivedAt?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [allRows]);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [fieldCode, setFieldCode] = useState('');
  const [status, setStatus] = useState<CertificationDossier['status'] | ''>('');
  const [completeness, setCompleteness] = useState<NonNullable<PcnOperationsRegisterFilter['completeness']>>('ALL');
  const [assignment, setAssignment] = useState<NonNullable<PcnOperationsRegisterFilter['assignment']>>('ALL');
  const rows = useMemo(() => filterPcnOperationsRegisterRows(allRows, { query, year, fieldCode, status: status || undefined, completeness, assignment }), [allRows, query, year, fieldCode, status, completeness, assignment]);
  const fieldNames = useMemo(() => new Map(fields.map((field) => [field.code, field.name])), [fields]);
  const issuedCount = rows.filter((row) => ['ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus)).length;
  const resultCount = rows.filter((row) => row.lastResultReceivedAt).length;
  const waitingCount = rows.filter((row) => ['AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'WAITING_APPROVAL'].includes(row.dossierStatus)).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;

  const downloadCsv = () => {
    const blob = new Blob([toPcnOperationsRegisterCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `so-dieu-hanh-pcn-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openRegisterDossier = (row: ReturnType<typeof buildPcnOperationsRegisterRows>[number]) => {
    const dossier = dossiers.find((candidate) => candidate.id === row.dossierId);
    if (!dossier) return;
    const proposal = proposals.find((candidate) => candidate.id === dossier.proposalId);
    const hasHistoricalReview = Boolean(dossier.historicalImport || proposal?.historicalImport);
    onOpenDossier(dossier, getPcnDossierStationTab(row.stationKey, hasHistoricalReview));
  };

  return <div className="h-full overflow-y-auto bg-slate-50/60 p-3 md:p-5 mobile-safe-bottom">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><FileSpreadsheet size={19} className="text-emerald-600" /><h1 className="text-xl font-black text-slate-900">Sổ điều hành</h1></div>
        <p className="mt-1 text-[11px] text-slate-500">Bảng tổng hợp dẫn xuất từ hồ sơ PCN, giúp theo dõi mã đăng ký, mẫu, KQTN và phát hành.</p>
      </div>
      <button type="button" onClick={downloadCsv} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Download size={14} /> Xuất CSV ({rows.length})</button>
    </div>

    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
      <Metric label="Hồ sơ theo bộ lọc" value={rows.length} />
      <Metric label="Đã có KQTN" value={resultCount} tone="text-blue-700" />
      <Metric label="Đang chờ xử lý" value={waitingCount} tone="text-amber-700" />
      <Metric label="Đã phát hành / lưu" value={issuedCount} tone="text-emerald-700" />
      <Metric label="Còn thiếu tài liệu bắt buộc" value={incompleteCount} tone="text-rose-700" />
    </div>

    <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(220px,1.5fr)_120px_180px_200px_220px_180px]">
      <label className="relative block"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã đăng ký, khách hàng, sản phẩm, model, KQTN..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] outline-none focus:border-emerald-400" /></label>
      <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-400"><option value="">Tất cả năm</option>{availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={fieldCode} onChange={(event) => setFieldCode(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-400"><option value="">Tất cả lĩnh vực</option>{fields.filter((field) => field.active).map((field) => <option key={field.code} value={field.code}>{field.name}</option>)}</select>
      <select value={status} onChange={(event) => setStatus(event.target.value as CertificationDossier['status'] | '')} className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-400"><option value="">Tất cả trạng thái</option>{statusOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
      <select aria-label="Tình trạng hoàn thiện hồ sơ" value={completeness} onChange={(event) => setCompleteness(event.target.value as NonNullable<PcnOperationsRegisterFilter['completeness']>) } className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-400"><option value="ALL">Tất cả mức hoàn thiện</option><option value="INCOMPLETE">Còn thiếu tài liệu bắt buộc</option><option value="COMPLETE">Đã đủ tài liệu bắt buộc</option></select>
      <select aria-label="Tình trạng phân công chủ hồ sơ" value={assignment} onChange={(event) => setAssignment(event.target.value as NonNullable<PcnOperationsRegisterFilter['assignment']>) } className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-400"><option value="ALL">Tất cả chủ hồ sơ</option><option value="UNASSIGNED">Chưa phân công</option><option value="ASSIGNED">Đã phân công</option></select>
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[2180px] w-full border-collapse text-left text-[10px]">
          <thead className="bg-slate-900 text-[9px] font-black uppercase tracking-wider text-slate-300"><tr><th className="sticky left-0 z-10 bg-slate-900 px-3 py-3">Mã đăng ký / hồ sơ</th><th className="px-3 py-3">Bước hiện tại / Mức hoàn thiện</th><th className="px-3 py-3">Khách hàng</th><th className="px-3 py-3">Sản phẩm / model</th><th className="px-3 py-3">Số lượng mẫu</th><th className="px-3 py-3">Tiêu chuẩn</th><th className="px-3 py-3">Trưởng đoàn / Ngày đánh giá / Ngày hiệu lực</th><th className="px-3 py-3">Lĩnh vực</th><th className="px-3 py-3">Nhận hồ sơ</th><th className="px-3 py-3">Nhận mẫu</th><th className="px-3 py-3">Nơi nhận/đang giữ mẫu</th><th className="px-3 py-3">Chỉ tiêu thử</th><th className="px-3 py-3">KQTN gần nhất</th><th className="px-3 py-3">Tuyến PTN</th><th className="px-3 py-3">Trạng thái hồ sơ</th><th className="px-3 py-3">Phát hành / trả mẫu</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.dossierId} className="align-top hover:bg-emerald-50/40">
            <td className="sticky left-0 z-[1] bg-white px-3 py-3"><button type="button" onClick={() => openRegisterDossier(row)} className="group text-left"><span className="block font-black text-emerald-700 group-hover:underline">{row.registrationCode}</span><span className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">{row.dossierCode}<ExternalLink size={10} /></span></button></td>
            <td className="min-w-[220px] px-3 py-3"><div className="flex items-start justify-between gap-2"><div className="font-black text-slate-800">{row.stationTitle}</div><span className={`whitespace-nowrap font-black ${row.completenessScore < 70 ? 'text-amber-700' : 'text-emerald-700'}`}>{row.completenessScore}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label={`Mức hoàn thiện ${row.completenessScore}%`}><div className={`h-full rounded-full ${row.completenessScore < 50 ? 'bg-rose-500' : row.completenessScore < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${row.completenessScore}%` }} /></div><div className="mt-1 flex items-center gap-1 text-[9px] text-slate-500"><span>Chủ hồ sơ: {getPcnUserDisplayName(row.ownerUsername, users)}</span></div><div className={`mt-1 flex items-center gap-1 text-[9px] font-bold ${row.missingRequiredCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{row.missingRequiredCount > 0 ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}<span>Đủ {row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc · còn thiếu {row.missingRequiredCount}</span></div>{row.stationMissingLabels.length > 0 && <div className="mt-1 max-w-[210px] truncate text-[9px] text-amber-700" title={row.stationMissingLabels.join(', ')}>Bước cần xử lý: {row.stationMissingLabels.join(', ')}</div>}{row.missingRequiredByStage.length > 0 && <div className="mt-1 max-w-[210px] truncate text-[9px] text-rose-700" title={missingDocumentSummary(row)}>Tài liệu bắt buộc còn thiếu: {missingDocumentSummary(row)}</div>}</td>
            <td className="max-w-[180px] px-3 py-3"><div className="font-bold text-slate-800">{row.customerName}</div><div className="mt-0.5 text-slate-400">{row.customerAddress || 'Địa chỉ chưa cập nhật'}</div></td>
            <td className="max-w-[240px] px-3 py-3"><div className="font-bold text-slate-800">{row.productName}</div><div className="mt-0.5 text-slate-500">{[row.brand, row.model].filter(Boolean).join(' • ') || 'Model chưa cập nhật'}</div></td>
            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.sampleQuantity ?? 'Chưa cập nhật'}</td>
            <td className="max-w-[190px] px-3 py-3 text-slate-600">{row.standardRefs.length > 0 ? row.standardRefs.map((item) => <div key={item}>{item}</div>) : 'Chưa cập nhật'}</td>
            <td className="whitespace-nowrap px-3 py-3"><div className="font-bold text-slate-700">{row.evaluatorUsername ? getPcnUserDisplayName(row.evaluatorUsername, users) : 'Chưa phân công'}</div><div className="mt-0.5 text-slate-500">Ngày đánh giá: {formatDate(row.evaluationAt)}</div><div className="mt-0.5 text-slate-400">Ngày hiệu lực: {formatDate(row.effectiveAt)}</div></td>
            <td className="px-3 py-3"><div className="flex max-w-[130px] flex-wrap gap-1">{row.fieldCodes.map((code) => <span key={code} className="rounded bg-indigo-50 px-1.5 py-0.5 font-black text-indigo-700">{fieldNames.get(code) || code}</span>)}</div></td>
            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(row.receivedAt)}</td>
            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(row.sampleReceivedAt)}</td>
            <td className="max-w-[190px] px-3 py-3 text-slate-600">{row.sampleLocations.length > 0 ? row.sampleLocations.map((item) => <div key={item}>{item}</div>) : 'Chưa cập nhật'}</td>
            <td className="max-w-[220px] px-3 py-3 text-slate-600">{row.testCriteria.length > 0 ? row.testCriteria.map((item) => <div key={item}>{item}</div>) : 'Chưa cập nhật'}</td>
            <td className="px-3 py-3"><div className="font-bold text-slate-700">{outcomeLabel(row.lastResultOutcome)}</div><div className="mt-0.5 text-slate-500">{row.reportNumbers.join(', ') || 'Chưa có số báo cáo'}</div><div className="mt-0.5 text-slate-400">{formatDate(row.lastResultReceivedAt)}</div></td>
            <td className="max-w-[190px] px-3 py-3 text-slate-600">{row.labStatuses.length > 0 ? row.labStatuses.map((item) => <div key={item}>{item}</div>) : 'Chưa cập nhật'}</td>
            <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-black ${statusClass(row.dossierStatus)}`}>{statusLabel.get(row.dossierStatus) || row.dossierStatus}</span></td>
            <td className="px-3 py-3"><div className="font-bold text-slate-700">{row.issuanceNumber || 'Chưa cấp số'}</div><div className="mt-0.5 text-slate-500">{formatDate(row.issuedAt)}</div><div className="mt-0.5 text-slate-400">Trả mẫu: {formatDate(row.sampleReturnedAt)}</div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="p-10 text-center"><FileSpreadsheet size={28} className="mx-auto text-slate-300" /><div className="mt-2 text-xs font-black text-slate-700">Không có hồ sơ phù hợp</div><div className="mt-1 text-[10px] text-slate-500">Thử bỏ bớt điều kiện lọc hoặc mở Đề nghị để tạo hồ sơ mới.</div></div>}
    </div>
    <p className="mt-2 text-[10px] text-slate-400">Sổ chỉ hiển thị dữ liệu đã ghi nhận trong PCN; ô chưa có dữ liệu không được suy diễn từ tên file hoặc ghi chú.</p>
  </div>;
}

function Metric({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 text-xl font-black ${tone}`}>{value}</div></div>;
}

// --- End of PcnOperationsRegisterView.tsx ---
