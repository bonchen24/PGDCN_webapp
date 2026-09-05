'use client';

import { AlertCircle, CheckCircle2, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleLot,
  PcnSampleRoute,
  PcnUserAccount,
  ReturnedTestResult,
} from '../types';
import type {
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from '../utils/pgdDomain';
import { buildPgdAssistantReview, getPgdAssistantCandidates, type PgdAssistantCriterionStatus } from '../utils/pgdAssistant';
import PcnAssistantView from './PcnAssistantView';

type Props = {
  currentUser: PcnUserAccount;
  pcnDossiers: CertificationDossier[];
  pcnProposals: CertificationProposal[];
  pcnRequirements: PcnDocumentRequirement[];
  pcnDocuments: PcnDossierDocument[];
  pcnLabRequests: OutboundLabRequest[];
  pcnSampleLots: PcnSampleLot[];
  pcnSampleRoutes: PcnSampleRoute[];
  pcnReturnedResults: ReturnedTestResult[];
  pgdRequests: PgdInspectionRequest[];
  pgdAssignments: PgdInspectionAssignment[];
  pgdFieldInspections: PgdFieldInspection[];
  pgdSamples: PgdSample[];
  pgdLabRequests: PgdLabRequest[];
  pgdLabResults: PgdLabResult[];
  pgdReports: PgdInspectionReport[];
  pgdCertificates: PgdInspectionCertificate[];
  pgdApprovals: Array<{ requestId: string }>;
  onOpenPcn: (dossierId: string) => void;
  onOpenPgd: (requestId: string) => void;
};

const statusLabel: Record<PgdAssistantCriterionStatus, string> = { PASS: 'Đạt', WARNING: 'Cảnh báo', ERROR: 'Lỗi', NOT_EVALUABLE: 'Chưa đủ căn cứ' };
const statusClass: Record<PgdAssistantCriterionStatus, string> = {
  PASS: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  ERROR: 'border-rose-200 bg-rose-50 text-rose-800',
  NOT_EVALUABLE: 'border-slate-300 bg-slate-100 text-slate-700',
};
const PGD_ASSISTANT_STATIONS = ['Tiếp nhận & năng lực', 'Chuẩn bị & phân công', 'Hiện trường & lấy mẫu', 'PTN & xem xét kết quả', 'Báo cáo, phê duyệt & trả kết quả'];

export default function PgdcnAssistantView(props: Props) {
  const [domain, setDomain] = useState<'PCN' | 'PGD'>('PCN');

  return <div className="min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <header className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"><ShieldCheck size={21} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Trợ lý AI PGDCN</p><h1 className="mt-1 text-xl font-black text-slate-900">Soát xét hồ sơ theo hai lĩnh vực</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">AI hỗ trợ đọc bằng chứng và chỉ ra điểm cần đối chiếu cho Chứng nhận và Giám định. Kết quả là read-only, không phê duyệt, không đổi trạng thái hồ sơ.</p></div></header>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Lĩnh vực hỗ trợ</span><button type="button" onClick={() => setDomain('PCN')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${domain === 'PCN' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>Chứng nhận (PCN)</button><button type="button" onClick={() => setDomain('PGD')} className={`rounded-lg px-3 py-2 text-[10px] font-black ${domain === 'PGD' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>Giám định (PGD)</button><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">Chế độ chỉ đọc</span></div>
    {domain === 'PCN' ? <PcnAssistantView dossiers={props.pcnDossiers} proposals={props.pcnProposals} requirements={props.pcnRequirements} documents={props.pcnDocuments} labRequests={props.pcnLabRequests} sampleLots={props.pcnSampleLots} sampleRoutes={props.pcnSampleRoutes} returnedResults={props.pcnReturnedResults} onOpenDossier={(dossier) => props.onOpenPcn(dossier.id)} /> : <PgdAssistantPanel {...props} />}
  </div>;
}

function PgdAssistantPanel(props: Props) {
  const [query, setQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const candidates = useMemo(() => getPgdAssistantCandidates(props.pgdRequests), [props.pgdRequests]);
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return candidates;
    return candidates.filter((item) => [item.requestCode, item.customerName, item.productName, item.status].join(' ').toLocaleLowerCase('vi-VN').includes(normalized));
  }, [candidates, query]);
  const selectedRequest = props.pgdRequests.find((item) => item.id === selectedRequestId);
  const review = selectedRequest ? buildPgdAssistantReview({ request: selectedRequest, assignments: props.pgdAssignments, fieldInspections: props.pgdFieldInspections, samples: props.pgdSamples, labRequests: props.pgdLabRequests, labResults: props.pgdLabResults, reports: props.pgdReports, certificates: props.pgdCertificates }) : undefined;

  return <section className="space-y-3" aria-label="Trợ lý AI Giám định PGD"><div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Trợ lý Giám định (PGD)</p><h2 className="mt-1 text-sm font-black text-blue-950">Soát xét theo 5 trạm nghiệp vụ</h2></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-blue-700">Luật + AI ngữ nghĩa · read-only</span></div><p className="mt-2 text-[10px] leading-4 text-blue-900">Các profile thép/kim loại, máy móc/dây chuyền, than, giám định ngoài và hàng hóa khác được đối chiếu theo nhóm từ PYC, phân công, hiện trường, mẫu, PTN, báo cáo và chứng thư; tiêu chuẩn và bằng chứng chỉ được đọc từ snapshot hồ sơ.</p><div className="mt-3 flex flex-wrap gap-1.5">{PGD_ASSISTANT_STATIONS.map((station) => <span key={station} className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[9px] font-bold text-blue-800">{station}</span>)}</div></div>
    <div className="grid gap-3 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]"><section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h3 className="text-xs font-black text-slate-800">Hồ sơ PGD cần soát xét</h3><p className="mt-1 text-[9px] text-slate-500">Không bao gồm hồ sơ đã ký, trả kết quả hoặc lưu trữ.</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{candidates.length}</span></div><div className="relative mt-3"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm hồ sơ trợ lý PGD" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm PYC, khách hàng, hàng hóa..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] outline-none focus:border-blue-400" /></div><div className="mt-3 space-y-2">{filteredCandidates.map((candidate) => <label key={candidate.requestId} className={`block cursor-pointer rounded-lg border p-2.5 transition ${selectedRequestId === candidate.requestId ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-200'}`}><span className="flex items-start gap-2"><input type="radio" name="pgd-assistant-request" checked={selectedRequestId === candidate.requestId} onChange={() => setSelectedRequestId(candidate.requestId)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-black text-slate-800">{candidate.requestCode}</span><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{candidate.status}</span></span><span className="mt-1 block text-[10px] text-slate-600">{candidate.customerName || 'Chưa có khách hàng'} · {candidate.productName || 'Chưa có hàng hóa'}</span></span></span></label>)}{filteredCandidates.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[10px] text-slate-500">Không có PYC PGD thuộc phạm vi trợ lý.</div>}</div></section><section className="space-y-3">{review ? <><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div><p className="text-[10px] font-black uppercase tracking-wide text-blue-600">Phiên hỗ trợ PGD</p><h3 className="mt-1 text-sm font-black text-slate-900">{selectedRequest?.requestCode}</h3></div><button type="button" onClick={() => props.onOpenPgd(selectedRequestId)} className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-50">Mở hồ sơ chuẩn</button></div><div className="grid grid-cols-2 gap-2 md:grid-cols-5"><SummaryCell label="Đạt" value={review.summary.pass} tone="text-emerald-700" /><SummaryCell label="Cảnh báo" value={review.summary.warning} tone="text-amber-700" /><SummaryCell label="Lỗi" value={review.summary.error} tone="text-rose-700" /><SummaryCell label="NOT_EVALUABLE" value={review.summary.notEvaluable} tone="text-slate-700" /><div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2"><div className="text-[9px] font-bold text-indigo-600">Kết luận</div><div className="mt-1 text-[10px] font-black text-indigo-900">{review.summary.conclusion}</div></div></div><div className="space-y-2">{review.criteria.map((item) => <PgdCriterionCard key={item.id} criterion={item} />)}</div></> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-[11px] text-slate-500">Chọn một PYC PGD để mở phiên soát xét chỉ đọc.</div>}</section></div></section>;
}

function SummaryCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2"><div className="text-[9px] font-bold text-slate-500">{label}</div><div className={`mt-1 text-lg font-black ${tone}`}>{value}</div></div>;
}

function PgdCriterionCard({ criterion }: { criterion: ReturnType<typeof buildPgdAssistantReview>['criteria'][number] }) {
  return <article className={`rounded-xl border p-3 shadow-sm ${statusClass[criterion.status]}`}><div className="flex items-start gap-2"><div className="mt-0.5">{criterion.status === 'PASS' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-black">{criterion.title}</h3><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black">{statusLabel[criterion.status]}</span><span className="text-[9px] font-bold opacity-70">Luật kiểm tra</span></div><p className="mt-1 text-[10px] leading-4">{criterion.summary}</p>{criterion.findings.map((finding) => <div key={finding.id} className="mt-2 rounded-lg border border-white/70 bg-white/60 p-2"><p className="text-[10px] font-black">{finding.message}</p>{finding.suggestedAction && <p className="mt-1 text-[9px] leading-4"><strong>Đối chiếu:</strong> {finding.suggestedAction}</p>}</div>)}<p className="mt-2 text-[9px] opacity-70">Nguồn: {criterion.provenance.join(' · ')}</p></div></div></article>;
}
