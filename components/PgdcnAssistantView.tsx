'use client';

import { AlertCircle, CheckCircle2, ExternalLink, FileWarning, Loader2, Play, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  PcnUserAccount,
  ReturnedTestResult,
} from '../types';
import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from '../utils/pgdDomain';
import { getPgdStatusLabel } from '../utils/pgdDomain';
import type { PgdCaseEvent, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from '../utils/pgdArtifacts';
import { buildPgdBusinessTimeline, buildPgdSampleEvidence, resolvePgdEvidenceNextAction } from '../utils/pgdBusinessWorkspace';
import { getPgdAssistantCandidates, PGD_ASSISTANT_CRITERION_DEFINITIONS, PGD_ASSISTANT_CRITERION_ORDER, type PgdAssistantCriterion, type PgdAssistantCriterionStatus, type PgdAssistantEvidence, type PgdAssistantReview } from '../utils/pgdAssistant';
import { classifyPcnAssistantError, type PcnAssistantErrorView } from '../utils/pcnAssistantUi';
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
  pcnSampleItems: PcnSampleItem[];
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
  pgdApprovals: PgdApprovalStep[];
  pgdInspectionPlans?: PgdInspectionPlan[];
  pgdCaseEvents?: PgdCaseEvent[];
  pgdFieldActivityLogs?: PgdFieldActivityLog[];
  pgdLabResultReviews?: PgdLabResultReview[];
  onOpenPcn: (dossierId: string, initialTab?: 'documents' | 'lab' | 'results' | 'issuance') => void;
  onOpenPgd: (requestId: string) => void;
  initialDomain?: 'PCN' | 'PGD';
  initialPcnDossierId?: string;
  initialPgdRequestId?: string;
};

const statusLabel: Record<PgdAssistantCriterionStatus, string> = { PASS: 'Đạt', WARNING: 'Cảnh báo', ERROR: 'Lỗi', NOT_EVALUABLE: 'Chưa đủ căn cứ' };
const statusClass: Record<PgdAssistantCriterionStatus, string> = {
  PASS: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  ERROR: 'border-rose-200 bg-rose-50 text-rose-800',
  NOT_EVALUABLE: 'border-slate-300 bg-slate-100 text-slate-700',
};
const PGD_ASSISTANT_CRITERIA_TOTAL = PGD_ASSISTANT_CRITERION_ORDER.length;

export function countCompletedPgdAssistantCriteria(criteria: readonly Pick<PgdAssistantCriterion, 'id'>[]): number {
  return new Set(criteria.map((criterion) => criterion.id)).size;
}

export default function PgdcnAssistantView(props: Props) {
  const [domain, setDomain] = useState<'PCN' | 'PGD'>(props.initialDomain || 'PCN');

  useEffect(() => {
    if (props.initialDomain) setDomain(props.initialDomain);
  }, [props.initialDomain]);

  return <div className="pcn-page-surface app-compact min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 md:p-5 mobile-safe-bottom" aria-live="polite">
    <header className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><ShieldCheck size={21} /></span><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Trợ lý AI PGDCN</p><h1 className="mt-1 text-xl font-black text-slate-900">Soát xét hồ sơ theo hai lĩnh vực</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">AI chỉ đọc bằng chứng và gợi ý điểm cần đối chiếu cho Chứng nhận và Giám định. Người phụ trách tự xem xét; kết quả không phê duyệt, không đổi trạng thái hồ sơ và không tạo nội dung chính thức.</p></div></header>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Lĩnh vực hỗ trợ</span><button type="button" onClick={() => setDomain('PCN')} className={`mobile-touch-target rounded-lg px-3 py-2 text-[11px] font-black ${domain === 'PCN' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1`}>Chứng nhận (PCN)</button><button type="button" onClick={() => setDomain('PGD')} className={`mobile-touch-target rounded-lg px-3 py-2 text-[11px] font-black ${domain === 'PGD' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1`}>Giám định (PGD)</button><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">Chế độ chỉ đọc</span></div>
    {domain === 'PCN' ? <PcnAssistantView dossiers={props.pcnDossiers} proposals={props.pcnProposals} requirements={props.pcnRequirements} documents={props.pcnDocuments} labRequests={props.pcnLabRequests} sampleLots={props.pcnSampleLots} sampleItems={props.pcnSampleItems} sampleRoutes={props.pcnSampleRoutes} returnedResults={props.pcnReturnedResults} initialDossierId={props.initialPcnDossierId} onOpenDossier={(dossier, initialTab) => props.onOpenPcn(dossier.id, initialTab)} /> : <PgdAssistantPanel {...props} />}
  </div>;
}

function PgdAssistantPanel(props: Props) {
  const [viewState, setViewState] = useState<'loading' | 'ready' | 'running' | 'completed' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [criteria, setCriteria] = useState<PgdAssistantCriterion[]>([]);
  const [summary, setSummary] = useState<PgdAssistantReview['summary']>();
  const [review, setReview] = useState<PgdAssistantReview>();
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [runErrorView, setRunErrorView] = useState<PcnAssistantErrorView>();
  const [runErrorDetail, setRunErrorDetail] = useState('');
  const [currentCriterion, setCurrentCriterion] = useState({ index: -1, title: '' });
  const [quickAnswer, setQuickAnswer] = useState('');
  const reviewRunRef = useRef(0);
  const initialRequestContextRef = useRef<string | undefined>(undefined);
  const initialRequestAppliedRef = useRef<string | undefined>(undefined);

  const selectRequest = useCallback((requestId: string) => {
    reviewRunRef.current += 1;
    setViewState('ready');
    setSelectedRequestId(requestId);
    setRunning(false);
    setCriteria([]);
    setSummary(undefined);
    setReview(undefined);
    setRunErrorView(undefined);
    setRunErrorDetail('');
    setRunMessage('');
    setQuickAnswer('');
    setCurrentCriterion({ index: -1, title: '' });
  }, []);

  useEffect(() => {
    setViewState('loading');
    const timer = window.setTimeout(() => setViewState('ready'), 0);
    return () => window.clearTimeout(timer);
  }, [props.pgdRequests]);

  const candidates = useMemo(() => getPgdAssistantCandidates(props.pgdRequests), [props.pgdRequests]);
  useEffect(() => {
    const initialRequestId = props.initialPgdRequestId;
    const contextChanged = initialRequestContextRef.current !== initialRequestId;
    if (contextChanged) {
      initialRequestContextRef.current = initialRequestId;
      initialRequestAppliedRef.current = undefined;
    }
    if (!initialRequestId) return;
    if (!candidates.some((item) => item.requestId === initialRequestId)) {
      if (contextChanged) selectRequest('');
      return;
    }
    if (!contextChanged && initialRequestAppliedRef.current === initialRequestId) return;
    initialRequestAppliedRef.current = initialRequestId;
    selectRequest(initialRequestId);
  }, [candidates, props.initialPgdRequestId, selectRequest]);
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return candidates;
    return candidates.filter((item) => [item.requestCode, item.customerName, item.productName, item.status].join(' ').toLocaleLowerCase('vi-VN').includes(normalized));
  }, [candidates, query]);
  const selectedRequest = props.pgdRequests.find((item) => item.id === selectedRequestId);
  const selectedBusinessFacts = useMemo(() => selectedRequest ? ({
    request: selectedRequest,
    inspectionPlans: props.pgdInspectionPlans,
    assignments: props.pgdAssignments,
    fieldInspections: props.pgdFieldInspections,
    caseEvents: props.pgdCaseEvents,
    fieldActivityLogs: props.pgdFieldActivityLogs,
    samples: props.pgdSamples,
    labRequests: props.pgdLabRequests,
    labResults: props.pgdLabResults,
    labResultReview: props.pgdLabResultReviews?.find((item) => item.requestId === selectedRequest.id),
    reports: props.pgdReports,
    certificates: props.pgdCertificates,
    approvals: props.pgdApprovals,
  }) : undefined, [selectedRequest, props.pgdInspectionPlans, props.pgdAssignments, props.pgdFieldInspections, props.pgdCaseEvents, props.pgdFieldActivityLogs, props.pgdSamples, props.pgdLabRequests, props.pgdLabResults, props.pgdLabResultReviews, props.pgdReports, props.pgdCertificates, props.pgdApprovals]);
  const selectedSampleEvidence = useMemo(() => selectedBusinessFacts ? buildPgdSampleEvidence(selectedBusinessFacts) : undefined, [selectedBusinessFacts]);
  const selectedTimeline = useMemo(() => selectedBusinessFacts ? buildPgdBusinessTimeline(selectedBusinessFacts) : [], [selectedBusinessFacts]);
  const selectedNextAction = useMemo(() => selectedBusinessFacts ? resolvePgdEvidenceNextAction(selectedBusinessFacts) : undefined, [selectedBusinessFacts]);
  const displayedCriteria = review?.criteria || criteria;
  const completedCriterionCount = countCompletedPgdAssistantCriteria(review?.criteria ?? criteria);
  const selectedEvidence = useMemo(() => {
    for (const criterion of displayedCriteria) {
      for (const finding of criterion.findings) {
        const evidence = finding.evidence?.find((item) => Boolean(item.documentId));
        if (evidence) return evidence;
      }
    }
    return undefined;
  }, [displayedCriteria]);

  const setAssistantError = (input: { code?: unknown; message?: unknown }) => {
    const mapped = classifyPcnAssistantError(input);
    setRunErrorView(mapped);
    setRunErrorDetail(mapped.detail || '');
    setViewState('error');
  };

  const consumeReviewEvent = (event: PgdReviewEvent) => {
    if (event.type === 'run_started') {
      setRunning(true);
      setViewState('running');
      setRunMessage(event.message || 'Đã mở phiên hỗ trợ PGD.');
      setRunErrorView(undefined);
      setRunErrorDetail('');
    }
    if (event.type === 'criterion_started') {
      const index = Number(event.index || 0);
      const total = Number(event.total || PGD_ASSISTANT_CRITERIA_TOTAL);
      setCurrentCriterion({ index, title: event.criterion?.title || `Tiêu chí ${index + 1}` });
      setRunMessage(`Đang soát xét tiêu chí ${index + 1}/${total}: ${event.criterion?.title || ''}`);
    }
    if (event.type === 'criterion_result' && event.criterion) {
      setCriteria((current) => [...current.filter((item) => item.id !== event.criterion?.id), event.criterion!].sort((left, right) => PGD_ASSISTANT_CRITERION_ORDER.indexOf(left.id) - PGD_ASSISTANT_CRITERION_ORDER.indexOf(right.id)));
    }
    if (event.type === 'criterion_completed') {
      setRunMessage('Đã nhận kết quả của tiêu chí vừa soát xét.');
    }
    if (event.type === 'run_completed') {
      setRunning(false);
      setViewState('completed');
      setReview(event.review);
      setSummary(event.summary || event.review?.summary);
      setRunMessage(event.message || 'Đã hoàn tất phiên hỗ trợ PGD.');
    }
    if (event.type === 'run_error') {
      setRunning(false);
      setAssistantError({ code: event.code, message: event.message || event.error || 'Phiên hỗ trợ PGD đã dừng.' });
      setRunMessage('');
    }
  };

  const startReview = async () => {
    if (!selectedRequestId || running) return;
    const requestId = selectedRequestId;
    const runId = reviewRunRef.current + 1;
    reviewRunRef.current = runId;
    setViewState('running');
    setRunning(true);
    setCriteria([]);
    setSummary(undefined);
    setReview(undefined);
    setRunErrorView(undefined);
    setRunErrorDetail('');
    setCurrentCriterion({ index: -1, title: '' });
    setRunMessage('Đang chuẩn bị đọc các tệp riêng của hồ sơ PGD...');
    try {
      const response = await fetch('/api/pgd/assistant/review', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload?.error || 'Không thể bắt đầu phiên hỗ trợ PGD.') as Error & { code?: string };
        error.code = payload?.code;
        throw error;
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
          try {
            if (reviewRunRef.current === runId) consumeReviewEvent(JSON.parse(line) as PgdReviewEvent);
          } catch { /* ignore malformed heartbeat */ }
        }
        if (chunk.done) break;
      }
      if (buffer.trim()) {
        try {
          if (reviewRunRef.current === runId) consumeReviewEvent(JSON.parse(buffer) as PgdReviewEvent);
        } catch { /* ignore trailing heartbeat */ }
      }
    } catch (error: any) {
      if (reviewRunRef.current !== runId) return;
      setRunning(false);
      setAssistantError({ code: error?.code, message: error?.message || 'Không thể chạy trợ lý PGD.' });
      setRunMessage('');
    }
  };

  const openEvidence = (evidence: PgdAssistantEvidence) => {
    props.onOpenPgd(selectedRequestId);
    if (!evidence.documentId) return;
    const baseUrl = evidence.documentType === 'GENERATED' ? getPgdDocumentDownloadUrl(evidence.documentId) : getPgdDossierDocumentDownloadUrl(evidence.documentId);
    window.open(`${baseUrl}${evidence.page ? `#page=${evidence.page}` : ''}`, '_blank', 'noopener,noreferrer');
  };

  const openSelectedFile = () => {
    if (selectedEvidence) openEvidence(selectedEvidence);
  };

  const runQuickAction = (action: 'sessions' | 'samples' | 'results' | 'summary' | 'report') => {
    if (!selectedRequest || !selectedSampleEvidence) return;
    if (action === 'sessions') {
      setQuickAnswer('Hồ sơ ' + selectedRequest.requestCode + ' có ' + props.pgdFieldInspections.filter((item) => item.requestId === selectedRequest.id).length + ' phiên hiện trường; timeline hiện có ' + selectedTimeline.length + ' sự kiện nghiệp vụ.');
    } else if (action === 'samples') {
      setQuickAnswer(selectedSampleEvidence.expectedUnits === undefined ? 'Chưa xác định số lượng mẫu dự kiến vì hồ sơ chưa có samplingLines.' : 'Dự kiến ' + selectedSampleEvidence.expectedUnits + ' đơn vị, đã lấy ' + selectedSampleEvidence.sampledUnits + '; còn ' + Math.max(0, selectedSampleEvidence.expectedUnits - selectedSampleEvidence.sampledUnits) + ' đơn vị cần lấy.');
    } else if (action === 'results') {
      setQuickAnswer('Có ' + selectedSampleEvidence.labRequestCount + ' PYC PTN, ' + selectedSampleEvidence.resultCount + ' kết quả đã nhận và ' + selectedSampleEvidence.pendingLabRequestCount + ' PYC còn chờ KQTN.');
    } else if (action === 'summary') {
      setQuickAnswer('Tóm tắt ' + selectedRequest.requestCode + ': ' + (selectedRequest.customerSnapshot.name || 'chưa có khách hàng') + ' · ' + (selectedRequest.productName || 'chưa có hàng hóa') + ' · trạng thái ' + getPgdStatusLabel(selectedRequest.status) + '. Hướng xử lý tiếp theo: ' + (selectedNextAction?.label || 'chưa xác định') + '.');
    } else {
      setQuickAnswer('Đang mở hồ sơ PGD ' + selectedRequest.requestCode + '. Nút này không mở trực tiếp trình soạn báo cáo.');
    }
    if (action === 'report') props.onOpenPgd(selectedRequest.id);
  };

  return <section className="space-y-3" aria-label="Trợ lý AI Giám định PGD">
    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Trợ lý Giám định (PGD)</p><h2 className="mt-1 text-sm font-black text-blue-950">Hỗ trợ kiểm tra hồ sơ theo 11 tiêu chí</h2></div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-blue-700">Luật + AI ngữ nghĩa · Chỉ đọc</span>
      </div>
      <p className="mt-2 max-w-3xl text-[11px] leading-4 text-blue-900">Chọn một hồ sơ để AI đọc tài liệu theo 11 tiêu chí, gợi ý điểm cần kiểm tra và dẫn bằng chứng để người phụ trách đối chiếu. AI chỉ hỗ trợ tham khảo: không phê duyệt, không đổi trạng thái, không tạo nội dung chính thức và không ghi vào hồ sơ.</p>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="11 tiêu chí PGD">{PGD_ASSISTANT_CRITERION_DEFINITIONS.map((definition, index) => <span key={definition.id} className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-800">{index + 1}. {definition.title}</span>)}</div>
    </div>
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><div><h3 className="text-xs font-black text-slate-800">Hồ sơ PGD cần soát xét</h3><p className="mt-1 text-[11px] text-slate-500">Không bao gồm hồ sơ đã ký, trả kết quả hoặc lưu trữ.</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{candidates.length}</span></div>
        <div className="relative mt-3"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm hồ sơ trợ lý PGD" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] outline-none transition focus:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1" /></div>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">Phạm vi nghiệp vụ: thép/kim loại, máy móc/dây chuyền, than, giám định ngoài và hàng hóa khác.</p>
        {viewState === 'loading' && <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500" role="status" aria-live="polite"><Loader2 size={14} className="animate-spin" /> Đang tải danh sách hồ sơ PGD...</div>}
        {viewState !== 'loading' && <div className="mt-3 space-y-2">{filteredCandidates.map((candidate) => <label key={candidate.requestId} className={`block min-w-0 cursor-pointer rounded-lg border p-3 transition ${selectedRequestId === candidate.requestId ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white hover:border-blue-200'}`}><span className="flex items-start gap-2"><input type="radio" name="pgd-assistant-request" checked={selectedRequestId === candidate.requestId} onChange={() => selectRequest(candidate.requestId)} className="mobile-touch-target mt-0.5 h-4 w-4 accent-blue-600" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-black text-slate-800">{candidate.requestCode}</span><span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold text-blue-700">{getPgdStatusLabel(candidate.status)}</span></span><span className="mt-1 block text-[11px] text-slate-600">{candidate.customerName || 'Chưa có khách hàng'} · {candidate.productName || 'Chưa có hàng hóa'}</span></span></span></label>)}{filteredCandidates.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[11px] text-slate-500">Không có PYC PGD thuộc phạm vi trợ lý.</div>}</div>}
        {selectedRequest && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-2.5" aria-label="Hồ sơ đang chọn"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-black uppercase tracking-wide text-blue-700">Hồ sơ đang chọn</p><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700">Chỉ đọc</span></div><p className="mt-1 text-xs font-black text-slate-900">{selectedRequest.requestCode}</p><p className="mt-1 text-[11px] text-slate-600">{selectedRequest.customerSnapshot.name || 'Chưa có khách hàng'} · {selectedRequest.productName || 'Chưa có hàng hóa'}</p></div>}
        {selectedRequest && selectedSampleEvidence && <section className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5" data-testid="pgd-assistant-quick-actions" aria-labelledby="pgd-assistant-quick-actions-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="pgd-assistant-quick-actions-title" className="text-[11px] font-black uppercase tracking-wide text-slate-700">Thao tác nhanh · chỉ đọc</h3><p className="mt-1 text-[11px] leading-4 text-slate-500">Dùng dữ liệu hiện có để tra cứu nhanh hoặc mở hồ sơ. Trợ lý chỉ đọc và gợi ý, không thay đổi dữ liệu.</p></div><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{selectedNextAction?.label || 'Đang đọc dữ liệu'}</span></div><div className="mt-2 grid gap-1.5 sm:grid-cols-2"><button type="button" onClick={() => runQuickAction('sessions')} className="mobile-touch-target min-h-11 rounded-md border border-blue-200 bg-blue-50 px-2 text-left text-[11px] font-black text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Tổng hợp phiên hiện trường</button><button type="button" onClick={() => runQuickAction('samples')} className="mobile-touch-target min-h-11 rounded-md border border-amber-200 bg-amber-50 px-2 text-left text-[11px] font-black text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Còn mẫu chưa lấy?</button><button type="button" onClick={() => runQuickAction('results')} className="mobile-touch-target min-h-11 rounded-md border border-sky-200 bg-sky-50 px-2 text-left text-[11px] font-black text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Còn KQTN chưa về?</button><button type="button" onClick={() => runQuickAction('summary')} className="mobile-touch-target min-h-11 rounded-md border border-slate-200 bg-slate-50 px-2 text-left text-[11px] font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Tóm tắt vụ giám định</button><button type="button" onClick={() => runQuickAction('report')} className="mobile-touch-target min-h-11 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-left text-[11px] font-black text-emerald-800 sm:col-span-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Mở hồ sơ PGD</button></div>{quickAnswer && <p className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 p-2 text-[11px] leading-4 text-blue-950" role="status" aria-live="polite">{quickAnswer}</p>}</section>}        <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void startReview()} disabled={!selectedRequestId || running} className="mobile-touch-target min-h-11 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"><Play size={13} /> {running ? 'Đang soát xét...' : 'Bắt đầu soát xét hồ sơ'}</button>{selectedRequest && <span className="text-[11px] text-slate-500">Đã chọn: <strong>{selectedRequest.requestCode}</strong>. Phiên chỉ đọc.</span>}</div>
      </section>
      <section className="min-w-0 space-y-3">
        {viewState === 'running' && <div className="rounded-lg border border-blue-300 bg-white p-3" role="status" aria-live="polite"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm font-bold text-blue-950"><span>{currentCriterion.title ? `Đang soát xét tiêu chí ${currentCriterion.index + 1}/${PGD_ASSISTANT_CRITERIA_TOTAL}: ${currentCriterion.title}` : 'Đang chuẩn bị đọc bằng chứng...'}</span><span className="font-black text-slate-950">Tiêu chí đã hoàn tất: {completedCriterionCount}/{PGD_ASSISTANT_CRITERIA_TOTAL}</span></div><div role="progressbar" aria-label="Tiến độ soát xét PGD" aria-valuemin={0} aria-valuemax={PGD_ASSISTANT_CRITERIA_TOTAL} aria-valuenow={completedCriterionCount} aria-valuetext={`${completedCriterionCount} trên ${PGD_ASSISTANT_CRITERIA_TOTAL} tiêu chí đã hoàn tất`} className="mt-3 h-3 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${Math.min(100, (completedCriterionCount / PGD_ASSISTANT_CRITERIA_TOTAL) * 100)}%` }} /></div></div>}
        {runErrorView && <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] leading-4 text-rose-900" role="alert" aria-live="assertive"><FileWarning size={17} className="mt-0.5 shrink-0 text-rose-600" /><div className="min-w-0 flex-1"><h2 className="font-black">{runErrorView.title}</h2><p className="mt-1 font-bold text-rose-800">{runErrorView.action}</p>{runErrorDetail && <details className="mt-2 text-[11px] text-rose-700"><summary className="cursor-pointer font-bold">Chi tiết phiên</summary><p className="mt-1 break-words">{runErrorDetail}</p></details>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => props.onOpenPgd(selectedRequestId)} disabled={!selectedRequest} className="mobile-touch-target inline-flex min-h-11 items-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-black text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50">Mở hồ sơ</button><button type="button" onClick={openSelectedFile} disabled={!selectedEvidence} className="mobile-touch-target inline-flex min-h-11 items-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-black text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50">Mở tệp</button><button type="button" onClick={() => void startReview()} disabled={!selectedRequestId || running} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={12} /> Thử lại</button></div></div></div>}
        {runMessage && viewState !== 'error' && <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950" role="status" aria-live="polite">{running && <Loader2 size={13} className="animate-spin" />}{runMessage}</div>}
        {(review || criteria.length > 0) ? <><div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-blue-600">Phiên hỗ trợ PGD · 11 tiêu chí</p><h3 className="mt-1 truncate text-sm font-black text-slate-900">{selectedRequest?.requestCode}</h3></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${viewState === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{viewState === 'completed' ? 'Đã hoàn tất' : 'Đang cập nhật'}</span><button type="button" onClick={() => props.onOpenPgd(selectedRequestId)} className="mobile-touch-target rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-black text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Mở hồ sơ PGD</button></div></div>{summary && viewState === 'completed' && <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><SummaryCell label="Đạt" value={summary.pass} tone="text-emerald-700 bg-emerald-50" /><SummaryCell label="Cảnh báo" value={summary.warning} tone="text-amber-700 bg-amber-50" /><SummaryCell label="Lỗi" value={summary.error} tone="text-rose-700 bg-rose-50" /><SummaryCell label="Chưa đủ căn cứ" value={summary.notEvaluable} tone="text-slate-700 bg-slate-100" /><div className="rounded-lg border border-blue-200 bg-blue-50 p-2"><div className="text-[11px] font-bold text-blue-700">Gợi ý tổng hợp</div><div className="mt-1 text-[11px] font-black text-blue-950">{summary.conclusion}</div></div></div>}<div className="space-y-2">{displayedCriteria.map((item) => <PgdCriterionCard key={item.id} criterion={item} onOpenEvidence={openEvidence} />)}</div></> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-[11px] text-slate-500">Chọn một PYC PGD, sau đó bấm “Bắt đầu soát xét hồ sơ”. AI sẽ đọc và đối chiếu lần lượt 11 tiêu chí, nêu điểm cần sửa và dẫn chứng.</div>}
      </section>
    </div>
  </section>;
}

function SummaryCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-lg border border-white p-2 ${tone}`}><div className="text-[11px] font-bold opacity-70">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;
}

function PgdCriterionCard({ criterion, onOpenEvidence }: { criterion: PgdAssistantCriterion; onOpenEvidence: (evidence: PgdAssistantEvidence) => void }) {
  const sourceLabel = criterion.source === 'AI' ? 'AI ngữ nghĩa' : criterion.source === 'RULES_AND_AI' ? 'Luật + AI ngữ nghĩa' : 'Luật kiểm tra';
  return <article className={`rounded-xl border p-3 shadow-sm ${statusClass[criterion.status]}`}><div className="flex items-start gap-2"><div className="mt-0.5">{criterion.status === 'PASS' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-black">{criterion.title}</h3><span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">{statusLabel[criterion.status]}</span><span className="text-[11px] font-bold opacity-70">{sourceLabel}</span></div><p className="mt-1 text-[11px] leading-4">{criterion.summary}</p>{criterion.findings.length > 0 ? <div className="mt-2 space-y-2"><p className="text-[11px] font-black uppercase tracking-wide opacity-70">Điểm cần sửa / đối chiếu</p>{criterion.findings.map((finding) => <div key={finding.id} className="rounded-lg border border-white/70 bg-white/60 p-2"><p className="text-[11px] font-black">{finding.message}</p>{finding.detail && <p className="mt-1 text-[11px] leading-4 opacity-80">{finding.detail}</p>}{finding.suggestedAction && <p className="mt-1 text-[11px] leading-4"><strong>Điểm cần sửa/đối chiếu:</strong> {finding.suggestedAction}</p>}{finding.evidence && finding.evidence.length > 0 && <div className="mt-2"><p className="mb-1 text-[11px] font-black uppercase tracking-wide opacity-70">Dẫn chứng</p><div className="flex flex-wrap gap-1.5">{finding.evidence.map((evidence) => <button key={`${finding.id}-${evidence.assetId}-${evidence.page || 0}`} type="button" onClick={() => onOpenEvidence(evidence)} className="mobile-touch-target inline-flex items-center gap-1 rounded-md border border-white bg-white/80 px-2 py-1 text-[11px] font-black transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"><ExternalLink size={11} /> Mở bằng chứng · {evidence.fileName}{evidence.page ? ` · trang ${evidence.page}` : ''}</button>)}</div></div>}</div>)}</div> : <p className="mt-2 rounded-lg border border-white/70 bg-white/50 p-2 text-[11px] font-bold opacity-70">Không phát hiện điểm cần sửa ở tiêu chí này.</p>}<p className="mt-2 text-[11px] opacity-70">Nguồn: {criterion.provenance.join(' · ')}</p></div></div></article>;
}

type PgdReviewEvent = {
  type?: string;
  message?: string;
  error?: string;
  code?: string;
  index?: number;
  total?: number;
  criterion?: PgdAssistantCriterion;
  summary?: PgdAssistantReview['summary'];
  review?: PgdAssistantReview;
};
