'use client';

import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
import { getPgdAssistantCandidates, type PgdAssistantCriterion, type PgdAssistantCriterionStatus, type PgdAssistantEvidence, type PgdAssistantReview } from '../utils/pgdAssistant';
import { getPgdDossierDocumentDownloadUrl, getPgdDocumentDownloadUrl } from '../utils/pgdApi';
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

  return <div className="pcn-page-surface ddt-compact min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 md:p-5 mobile-safe-bottom" aria-live="polite">
    <header className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"><ShieldCheck size={21} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Trợ lý AI PGDCN</p><h1 className="mt-1 text-xl font-black text-slate-900">Soát xét hồ sơ theo hai lĩnh vực</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">AI hỗ trợ đọc bằng chứng và chỉ ra điểm cần đối chiếu cho Chứng nhận và Giám định. Kết quả là read-only, không phê duyệt, không đổi trạng thái hồ sơ.</p></div></header>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Lĩnh vực hỗ trợ</span><button type="button" onClick={() => setDomain('PCN')} className={`mobile-touch-target rounded-lg px-3 py-2 text-[10px] font-black ${domain === 'PCN' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>Chứng nhận (PCN)</button><button type="button" onClick={() => setDomain('PGD')} className={`mobile-touch-target rounded-lg px-3 py-2 text-[10px] font-black ${domain === 'PGD' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>Giám định (PGD)</button><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">Chế độ chỉ đọc</span></div>
    {domain === 'PCN' ? <PcnAssistantView dossiers={props.pcnDossiers} proposals={props.pcnProposals} requirements={props.pcnRequirements} documents={props.pcnDocuments} labRequests={props.pcnLabRequests} sampleLots={props.pcnSampleLots} sampleRoutes={props.pcnSampleRoutes} returnedResults={props.pcnReturnedResults} onOpenDossier={(dossier) => props.onOpenPcn(dossier.id)} /> : <PgdAssistantPanel {...props} />}
  </div>;
}

function PgdAssistantPanel(props: Props) {
  const [query, setQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [criteria, setCriteria] = useState<PgdAssistantCriterion[]>([]);
  const [summary, setSummary] = useState<PgdAssistantReview['summary']>();
  const [review, setReview] = useState<PgdAssistantReview>();
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [runError, setRunError] = useState('');
  const [currentStation, setCurrentStation] = useState({ index: -1, title: '' });
  const [completedStationCount, setCompletedStationCount] = useState(0);
  const candidates = useMemo(() => getPgdAssistantCandidates(props.pgdRequests), [props.pgdRequests]);
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return candidates;
    return candidates.filter((item) => [item.requestCode, item.customerName, item.productName, item.status].join(' ').toLocaleLowerCase('vi-VN').includes(normalized));
  }, [candidates, query]);
  const selectedRequest = props.pgdRequests.find((item) => item.id === selectedRequestId);
  const displayedCriteria = review?.criteria || criteria;

  const selectRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    setCriteria([]);
    setSummary(undefined);
    setReview(undefined);
    setRunError('');
    setRunMessage('');
    setCurrentStation({ index: -1, title: '' });
    setCompletedStationCount(0);
  };

  const consumeReviewEvent = (event: PgdReviewEvent) => {
    if (event.type === 'run_started') {
      setRunning(true);
      setRunMessage(event.message || 'Đã mở phiên hỗ trợ PGD.');
      setRunError('');
    }
    if (event.type === 'criterion_started') {
      const index = Number(event.index || 0);
      setCurrentStation({ index, title: event.criterion?.title || `Trạm ${index + 1}` });
      setRunMessage(`Đang soát xét trạm ${index + 1}/5: ${event.criterion?.title || ''}`);
    }
    if (event.type === 'criterion_result' && event.criterion) {
      setCriteria((current) => [...current.filter((item) => item.id !== event.criterion?.id), event.criterion!].sort((left, right) => left.id.localeCompare(right.id)));
      setCompletedStationCount((current) => Math.max(current, Number(event.index || 0) + 1));
    }
    if (event.type === 'run_completed') {
      setRunning(false);
      setReview(event.review);
      setSummary(event.summary || event.review?.summary);
      setCompletedStationCount(5);
      setRunMessage(event.message || 'Đã hoàn tất phiên hỗ trợ PGD.');
    }
    if (event.type === 'run_error') {
      setRunning(false);
      setRunError(event.message || event.error || 'Phiên hỗ trợ PGD đã dừng.');
      setRunMessage('');
    }
  };

  const startReview = async () => {
    if (!selectedRequestId || running) return;
    setRunning(true);
    setCriteria([]);
    setSummary(undefined);
    setReview(undefined);
    setRunError('');
    setCurrentStation({ index: -1, title: '' });
    setCompletedStationCount(0);
    setRunMessage('Đang chuẩn bị đọc các tệp private của hồ sơ PGD...');
    try {
      const response = await fetch('/api/pgd/assistant/review', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: selectedRequestId }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Không thể bắt đầu phiên hỗ trợ PGD.');
      }
      if (!response.body) throw new Error('Máy chủ không trả về luồng kết quả PGD.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) if (line.trim()) {
          try { consumeReviewEvent(JSON.parse(line) as PgdReviewEvent); } catch { /* ignore malformed heartbeat */ }
        }
        if (chunk.done) break;
      }
      if (buffer.trim()) {
        try { consumeReviewEvent(JSON.parse(buffer) as PgdReviewEvent); } catch { /* ignore trailing heartbeat */ }
      }
    } catch (error: any) {
      setRunning(false);
      setRunError(error?.message || 'Không thể chạy trợ lý PGD.');
      setRunMessage('');
    }
  };

  const openEvidence = (evidence: PgdAssistantEvidence) => {
    props.onOpenPgd(selectedRequestId);
    if (!evidence.documentId) return;
    const baseUrl = evidence.documentType === 'GENERATED' ? getPgdDocumentDownloadUrl(evidence.documentId) : getPgdDossierDocumentDownloadUrl(evidence.documentId);
    window.open(`${baseUrl}${evidence.page ? `#page=${evidence.page}` : ''}`, '_blank', 'noopener,noreferrer');
  };

  return <section className="space-y-3" aria-label="Trợ lý AI Giám định PGD"><div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Trợ lý Giám định (PGD)</p><h2 className="mt-1 text-sm font-black text-blue-950">Soát xét theo 5 trạm nghiệp vụ</h2></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-blue-700">Luật + AI ngữ nghĩa · read-only</span></div><p className="mt-2 text-[10px] leading-4 text-blue-900">AI đọc hồ sơ PGD theo phạm vi được cấp, kết hợp luật nghiệp vụ và AI ngữ nghĩa. Kết quả chỉ là gợi ý đối chiếu; không phê duyệt, không đổi trạng thái và không ghi ngược vào hồ sơ.</p><div className="mt-3 flex flex-wrap gap-1.5">{PGD_ASSISTANT_STATIONS.map((station) => <span key={station} className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[9px] font-bold text-blue-800">{station}</span>)}</div></div>
    <div className="grid gap-3 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]"><section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h3 className="text-xs font-black text-slate-800">Hồ sơ PGD cần soát xét</h3><p className="mt-1 text-[9px] text-slate-500">Không bao gồm hồ sơ đã ký, trả kết quả hoặc lưu trữ.</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{candidates.length}</span></div><div className="relative mt-3"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm hồ sơ trợ lý PGD" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm PYC, khách hàng, hàng hóa..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] outline-none focus:border-blue-400" /></div><p className="mt-3 text-[9px] leading-4 text-slate-500">Phạm vi nghiệp vụ: thép/kim loại, máy móc/dây chuyền, than, giám định ngoài và hàng hóa khác.</p><div className="mt-3 space-y-2">{filteredCandidates.map((candidate) => <label key={candidate.requestId} className={`block cursor-pointer rounded-lg border p-2.5 transition ${selectedRequestId === candidate.requestId ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-200'}`}><span className="flex items-start gap-2"><input type="radio" name="pgd-assistant-request" checked={selectedRequestId === candidate.requestId} onChange={() => selectRequest(candidate.requestId)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-black text-slate-800">{candidate.requestCode}</span><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{candidate.status}</span></span><span className="mt-1 block text-[10px] text-slate-600">{candidate.customerName || 'Chưa có khách hàng'} · {candidate.productName || 'Chưa có hàng hóa'}</span></span></span></label>)}{filteredCandidates.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[10px] text-slate-500">Không có PYC PGD thuộc phạm vi trợ lý.</div>}</div><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void startReview()} disabled={!selectedRequestId || running} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[10px] font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Play size={13} /> {running ? 'Đang soát xét...' : 'Bắt đầu soát xét hồ sơ'}</button>{selectedRequest && <span className="text-[10px] text-slate-500">Đã chọn: <strong>{selectedRequest.requestCode}</strong>. Phiên chỉ đọc.</span>}</div></section><section className="space-y-3">{(runMessage || running) && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] text-blue-800" role="status" aria-live="polite"><span className="inline-flex items-center gap-2">{running && <Loader2 size={13} className="animate-spin" />}{runMessage || 'Đang xử lý hồ sơ PGD...'}</span>{running && <><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, (completedStationCount / 5) * 100)}%` }} /></div><div className="mt-1 text-[9px] font-bold">{currentStation.title ? `Trạm ${currentStation.index + 1}/5: ${currentStation.title}` : 'Đang chuẩn bị đọc bằng chứng...'}</div></>}</div>}{runError && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] leading-4 text-rose-800" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{runError}</span><button type="button" onClick={() => void startReview()} disabled={!selectedRequestId || running} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 font-black"><RefreshCw size={11} /> Thử lại</button></div>}{(review || criteria.length > 0) ? <><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div><p className="text-[10px] font-black uppercase tracking-wide text-blue-600">Phiên hỗ trợ PGD</p><h3 className="mt-1 text-sm font-black text-slate-900">{selectedRequest?.requestCode}</h3></div><button type="button" onClick={() => props.onOpenPgd(selectedRequestId)} className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-50">Mở hồ sơ chuẩn</button></div>{summary && <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><SummaryCell label="Đạt" value={summary.pass} tone="text-emerald-700" /><SummaryCell label="Cảnh báo" value={summary.warning} tone="text-amber-700" /><SummaryCell label="Lỗi" value={summary.error} tone="text-rose-700" /><SummaryCell label="NOT_EVALUABLE" value={summary.notEvaluable} tone="text-slate-700" /><div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2"><div className="text-[9px] font-bold text-indigo-600">Kết luận</div><div className="mt-1 text-[10px] font-black text-indigo-900">{summary.conclusion}</div></div></div>}<div className="space-y-2">{displayedCriteria.map((item) => <PgdCriterionCard key={item.id} criterion={item} onOpenEvidence={openEvidence} />)}</div></> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-[11px] text-slate-500">Chọn một PYC PGD, sau đó bấm “Bắt đầu soát xét hồ sơ”.</div>}</section></div></section>;
}

function SummaryCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2"><div className="text-[9px] font-bold text-slate-500">{label}</div><div className={`mt-1 text-lg font-black ${tone}`}>{value}</div></div>;
}

function PgdCriterionCard({ criterion, onOpenEvidence }: { criterion: PgdAssistantCriterion; onOpenEvidence: (evidence: PgdAssistantEvidence) => void }) {
  const sourceLabel = criterion.source === 'AI' ? 'AI ngữ nghĩa' : criterion.source === 'RULES_AND_AI' ? 'Luật + AI ngữ nghĩa' : 'Luật kiểm tra';
  return <article className={`rounded-xl border p-3 shadow-sm ${statusClass[criterion.status]}`}><div className="flex items-start gap-2"><div className="mt-0.5">{criterion.status === 'PASS' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-black">{criterion.title}</h3><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black">{statusLabel[criterion.status]}</span><span className="text-[9px] font-bold opacity-70">{sourceLabel}</span></div><p className="mt-1 text-[10px] leading-4">{criterion.summary}</p>{criterion.findings.map((finding) => <div key={finding.id} className="mt-2 rounded-lg border border-white/70 bg-white/60 p-2"><p className="text-[10px] font-black">{finding.message}</p>{finding.detail && <p className="mt-1 text-[9px] leading-4 opacity-80">{finding.detail}</p>}{finding.suggestedAction && <p className="mt-1 text-[9px] leading-4"><strong>Đối chiếu:</strong> {finding.suggestedAction}</p>}{finding.evidence && finding.evidence.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{finding.evidence.map((evidence) => <button key={`${finding.id}-${evidence.assetId}-${evidence.page || 0}`} type="button" onClick={() => onOpenEvidence(evidence)} className="inline-flex items-center gap-1 rounded-md border border-white bg-white/80 px-2 py-1 text-[9px] font-black hover:bg-white"><ExternalLink size={11} /> Mở bằng chứng · {evidence.fileName}{evidence.page ? ` · trang ${evidence.page}` : ''}</button>)}</div>}</div>)}<p className="mt-2 text-[9px] opacity-70">Nguồn: {criterion.provenance.join(' · ')}</p></div></div></article>;
}

type PgdReviewEvent = {
  type?: string;
  message?: string;
  error?: string;
  code?: string;
  index?: number;
  criterion?: PgdAssistantCriterion;
  summary?: PgdAssistantReview['summary'];
  review?: PgdAssistantReview;
};
