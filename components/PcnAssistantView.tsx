'use client';

import { AlertCircle, CheckCircle2, ExternalLink, FileDown, FileWarning, Loader2, Play, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnDocumentRequirement, PcnDossierDocument, PcnSampleItem, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types';
import type { PcnApprovalCriterionResult, PcnApprovalReviewCandidate } from '../utils/pcnApprovalReview';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { classifyPcnAssistantError, type PcnAssistantErrorView } from '../utils/pcnAssistantUi';
import { buildPcnBusinessBlockers, buildPcnSampleEvidence, resolvePcnEvidenceNextAction } from '../utils/pcnBusinessWorkspace';

type Props = {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  labRequests: OutboundLabRequest[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  returnedResults: ReturnedTestResult[];
  onOpenDossier: (dossier: CertificationDossier, initialTab?: 'documents' | 'lab' | 'results' | 'issuance') => void;
  initialDossierId?: string;
};

type ReviewEvent = {
  type?: string;
  message?: string;
  error?: string;
  code?: string;
  runId?: string;
  index?: number;
  criterion?: PcnApprovalCriterionResult;
  summary?: { pass: number; warning: number; error: number; notEvaluable: number; conclusion: string };
};

const fields = ['QC4', 'QC9'] as const;
const criterionOrder = ['ENTRY_GATE', 'COMPLETENESS', 'IDENTITY', 'COMMERCIAL', 'FIELD_EVALUATION', 'SAMPLE_PYC', 'LAB_RESULTS', 'TECHNICAL_ASSESSMENT', 'CERTIFICATE_DECISION', 'DOCUMENT_QUALITY', 'SYSTEM_LOGIC'];

const statusLabel: Record<PcnApprovalCriterionResult['status'], string> = { PASS: 'Đạt', WARNING: 'Cảnh báo', ERROR: 'Lỗi', NOT_EVALUABLE: 'Chưa đủ căn cứ' };
const statusClass: Record<PcnApprovalCriterionResult['status'], string> = { PASS: 'border-emerald-200 bg-emerald-50 text-emerald-800', WARNING: 'border-amber-200 bg-amber-50 text-amber-800', ERROR: 'border-rose-200 bg-rose-50 text-rose-800', NOT_EVALUABLE: 'border-slate-300 bg-slate-100 text-slate-700' };

function reviewTab(tab: string): 'documents' | 'lab' | 'results' | 'issuance' {
  if (tab === 'results') return 'results';
  if (tab === 'sampling') return 'lab';
  if (tab === 'approval') return 'issuance';
  return 'documents';
}

export default function PcnAssistantView(props: Props) {
  const [viewState, setViewState] = useState<'loading' | 'ready' | 'running' | 'completed' | 'error'>('loading');
  const [fieldCode, setFieldCode] = useState<(typeof fields)[number]>('QC4');
  const [candidates, setCandidates] = useState<PcnApprovalReviewCandidate[]>([]);
  const [selectedDossierId, setSelectedDossierId] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState('');
  const [runMessage, setRunMessage] = useState('');
  const [runErrorView, setRunErrorView] = useState<PcnAssistantErrorView>();
  const [runErrorDetail, setRunErrorDetail] = useState('');
  const [pcnQuickAnswer, setPcnQuickAnswer] = useState('');
  const [criteria, setCriteria] = useState<PcnApprovalCriterionResult[]>([]);
  const [summary, setSummary] = useState<ReviewEvent['summary']>();
  const [currentCriterion, setCurrentCriterion] = useState({ index: -1, title: '' });
  const [completedCriterionCount, setCompletedCriterionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingCandidates(true);
    setViewState('loading');
    setRunErrorView(undefined);
    setRunErrorDetail('');
    setSelectedDossierId('');
    setCandidates([]);
    setCriteria([]);
    setSummary(undefined);
    setRunId('');
    setRunMessage('');
    fetch(`/api/pcn/approval-assistant/candidates?fieldCode=${encodeURIComponent(fieldCode)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Không thể tải danh sách hồ sơ cần kiểm duyệt.');
        return Array.isArray(payload?.items) ? payload.items as PcnApprovalReviewCandidate[] : [];
      })
      .then((items) => { if (!cancelled) { setCandidates(items); setViewState('ready'); } })
      .catch((error: any) => {
        if (!cancelled) {
          const mapped = classifyPcnAssistantError({ message: error?.message || 'Không thể tải danh sách hồ sơ cần kiểm duyệt.' });
          setRunErrorView(mapped);
          setRunErrorDetail(mapped.detail || '');
          setViewState('error');
        }
      })
      .finally(() => { if (!cancelled) setLoadingCandidates(false); });
    return () => { cancelled = true; };
  }, [fieldCode]);

  useEffect(() => {
    if (props.initialDossierId && candidates.some((candidate) => candidate.dossierId === props.initialDossierId)) setSelectedDossierId(props.initialDossierId);
  }, [candidates, props.initialDossierId]);

  const filteredCandidates = useMemo(() => {
    const query = candidateQuery.trim().toLocaleLowerCase('vi-VN');
    if (!query) return candidates;
    return candidates.filter((candidate) => [candidate.dossierCode, candidate.customerName, candidate.productName, candidate.ownerUsername, candidate.status].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(query));
  }, [candidateQuery, candidates]);
  const selectedCandidate = candidates.find((candidate) => candidate.dossierId === selectedDossierId);
  const selectedPcnProjection = useMemo(() => {
    const dossier = props.dossiers.find((item) => item.id === selectedDossierId);
    if (!dossier) return undefined;
    const lotIds = new Set(props.sampleLots.filter((lot) => lot.dossierId === dossier.id).map((lot) => lot.id));
    const facts = {
      dossier,
      proposal: props.proposals.find((proposal) => proposal.id === dossier.proposalId),
      requirements: props.requirements.filter((requirement) => dossier.fieldCodes.includes(requirement.fieldCode)),
      documents: props.documents.filter((document) => document.dossierId === dossier.id),
      sampleLots: props.sampleLots.filter((lot) => lot.dossierId === dossier.id),
      sampleItems: props.sampleItems.filter((item) => lotIds.has(item.sampleLotId)),
      sampleRoutes: props.sampleRoutes.filter((route) => lotIds.has(route.sampleLotId)),
      labRequests: props.labRequests.filter((request) => request.dossierId === dossier.id),
      results: props.returnedResults.filter((result) => result.dossierId === dossier.id),
    };
    return { dossier, facts, sample: buildPcnSampleEvidence(facts), blockers: buildPcnBusinessBlockers(facts), nextAction: resolvePcnEvidenceNextAction(facts) };
  }, [props.dossiers, props.proposals, props.requirements, props.documents, props.sampleLots, props.sampleItems, props.sampleRoutes, props.labRequests, props.returnedResults, selectedDossierId]);
  const selectedFile = useMemo(() => {
    const document = props.documents.find((item) => item.dossierId === selectedDossierId && item.status === 'PRESENT');
    if (!document) return undefined;
    const version = document.versions.find((item) => item.assetId === document.currentVersionId) || document.versions[document.versions.length - 1];
    return version ? { assetId: version.assetId, fileName: version.fileName } : undefined;
  }, [props.documents, selectedDossierId]);
  const runError = '';

  const runPcnQuickAction = (action: 'missing' | 'review' | 'results' | 'summary' | 'report') => {
    const projection = selectedPcnProjection;
    if (!projection) return;
    const missingDocuments = projection.blockers.filter((blocker) => blocker.target === 'DOCUMENTS');
    if (action === 'missing') {
      setPcnQuickAnswer(missingDocuments.length > 0
        ? 'Còn ' + missingDocuments.length + ' nhóm tài liệu bắt buộc cần bổ sung hoặc đối chiếu.'
        : 'Không phát hiện tài liệu bắt buộc đang thiếu trong dữ liệu tổng hợp hiện hành.');
      props.onOpenDossier(projection.dossier, 'documents');
      return;
    }
    if (action === 'review') {
      setPcnQuickAnswer('Trước thẩm xét: ' + projection.blockers.length + ' trở ngại có bằng chứng. Hành động ưu tiên: ' + projection.nextAction.label + '.');
      props.onOpenDossier(projection.dossier, 'documents');
      return;
    }
    if (action === 'results') {
      setPcnQuickAnswer('KQTN: ' + projection.sample.resultCount + '/' + projection.sample.sampledSampleCount + ' mẫu đã có kết quả; còn ' + projection.sample.pendingResultCount + ' mẫu cần tiếp nhận. ' + projection.nextAction.label + '.');
      props.onOpenDossier(projection.dossier, 'results');
      return;
    }
    if (action === 'report') {
      setPcnQuickAnswer('Hồ sơ đã sẵn sàng để mở vùng soạn báo cáo theo dữ liệu hiện hành. Hành động tiếp theo: ' + projection.nextAction.label + '.');
      props.onOpenDossier(projection.dossier, 'documents');
      return;
    }
    setPcnQuickAnswer('Hồ sơ ' + (selectedCandidate?.dossierCode || projection.dossier.id) + ': ' + projection.sample.sampledSampleCount + ' mẫu, ' + projection.sample.resultCount + ' KQTN, ' + projection.blockers.length + ' trở ngại. Hành động tiếp theo: ' + projection.nextAction.label + '.');
  };

  const setAssistantError = (input: { code?: unknown; message?: unknown }) => {
    const mapped = classifyPcnAssistantError(input);
    setRunErrorView(mapped);
    setRunErrorDetail(mapped.detail || '');
    setViewState('error');
  };

  const consumeReviewEvent = (event: ReviewEvent) => {
    if (event.type === 'run_started') {
      setViewState('running');
      setRunId(event.runId || '');
      setRunMessage(event.message || 'Đã mở phiên hỗ trợ.');
    }
    if (event.type === 'criterion_started') {
      const index = Number(event.index || 0);
      setCurrentCriterion({ index, title: event.criterion?.title || `Tiêu chí ${index + 1}` });
      setRunMessage(`Đang đánh giá tiêu chí ${index + 1}/11...`);
    }
    if (event.type === 'criterion_result' && event.criterion) {
      setCriteria((current) => [...current.filter((item) => item.id !== event.criterion?.id), event.criterion!].sort((left, right) => criterionOrder.indexOf(left.id) - criterionOrder.indexOf(right.id)));
      setCompletedCriterionCount((current) => Math.max(current, Number(event.index || 0) + 1));
    }
    if (event.type === 'run_completed') {
      setViewState('completed');
      setRunId(event.runId || runId);
      setSummary(event.summary);
      setCompletedCriterionCount(11);
      setRunMessage(event.message || 'Đã hoàn tất phiên hỗ trợ.');
    }
    if (event.type === 'run_error') setAssistantError({ code: event.code, message: event.message || event.error || 'Phiên hỗ trợ đã dừng.' });
  };

  const startReview = async () => {
    if (!selectedDossierId || starting) return;
    setStarting(true); setViewState('running'); setCriteria([]); setSummary(undefined); setRunId(''); setRunErrorView(undefined); setRunErrorDetail(''); setCurrentCriterion({ index: -1, title: '' }); setCompletedCriterionCount(0); setRunMessage('Đang chuẩn bị đọc các tệp riêng...');
    try {
      const response = await fetch('/api/pcn/approval-assistant/review', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fieldCode, dossierId: selectedDossierId }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload?.error || 'Không thể bắt đầu phiên hỗ trợ.'); }
      if (!response.body) throw new Error('Máy chủ không trả về luồng kết quả.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) if (line.trim()) { try { consumeReviewEvent(JSON.parse(line) as ReviewEvent); } catch { /* ignore malformed heartbeat */ } }
        if (chunk.done) break;
      }
      if (buffer.trim()) { try { consumeReviewEvent(JSON.parse(buffer) as ReviewEvent); } catch { /* ignore trailing heartbeat */ } }
    } catch (error: any) { setAssistantError({ message: error?.message || 'Không thể chạy trợ lý kiểm duyệt.' }); } finally { setStarting(false); }
  };

  const openEvidence = (assetId: string, tab: string, page?: number) => {
    const dossier = props.dossiers.find((item) => item.id === selectedDossierId);
    if (dossier) props.onOpenDossier(dossier, reviewTab(tab));
    if (assetId) window.open(`${getPcnFileUrl(assetId)}${page ? `#page=${page}` : ''}`, '_blank', 'noopener,noreferrer');
  };

  const openSelectedDossier = () => {
    const dossier = props.dossiers.find((item) => item.id === selectedDossierId);
    if (dossier) props.onOpenDossier(dossier, 'documents');
  };

  const openSelectedFile = () => {
    if (selectedFile) window.open(getPcnFileUrl(selectedFile.assetId), '_blank', 'noopener,noreferrer');
  };

  const exportReport = async (format: 'PDF' | 'DOCX') => {
    if (!runId || !selectedCandidate) return;
    try {
      const response = await fetch('/api/pcn/approval-assistant/export', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId, format }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); setAssistantError({ message: payload?.error || 'Không thể xuất báo cáo.' }); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `bao-cao-ho-tro-${selectedCandidate.dossierCode}.${format.toLowerCase()}`; link.click(); URL.revokeObjectURL(url);
    } catch (error: any) { setAssistantError({ message: error?.message || 'Không thể xuất báo cáo.' }); }
  };

  return (
    <div className="pcn-page-surface app-compact min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 md:p-5 mobile-safe-bottom">
      <header className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><ShieldCheck size={21} /></span><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Trợ lý phê duyệt</p><h1 className="mt-1 text-xl font-black text-slate-900">Hỗ trợ kiểm duyệt hồ sơ</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">Chọn Lĩnh vực, chọn đúng một bộ hồ sơ để bắt đầu soát xét bằng AI. Trợ lý chỉ đọc hồ sơ và đưa ra đánh giá hỗ trợ; không xác nhận hay thay đổi trạng thái hồ sơ.</p></div></header>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Lĩnh vực hồ sơ</span>{fields.map((field) => <button key={field} type="button" onClick={() => setFieldCode(field)} className={`rounded-md px-3 py-1.5 text-[11px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${fieldCode === field ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>{field}</button>)}<span className="ml-auto rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold text-indigo-700">Chỉ đọc • QC4/QC9 v1</span></div><div className="relative mt-3"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Tìm hồ sơ kiểm duyệt" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] outline-none focus:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1" /></div><div className="mt-3 space-y-2">{loadingCandidates && <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500"><Loader2 size={14} className="animate-spin" /> Đang tải danh sách hồ sơ...</div>}{!loadingCandidates && filteredCandidates.map((candidate) => <label key={candidate.dossierId} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${selectedDossierId === candidate.dossierId ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-indigo-200'}`}><input type="radio" name="approval-assistant-dossier" checked={selectedDossierId === candidate.dossierId} onChange={() => { setSelectedDossierId(candidate.dossierId); setPcnQuickAnswer(''); }} className="mt-1 h-4 w-4 accent-indigo-600" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-800">{candidate.dossierCode}</span><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-indigo-700">{candidate.status === 'WAITING_APPROVAL' ? 'Chờ phê duyệt' : 'Soát xét kỹ thuật'}</span><span className="text-[11px] text-slate-500">Đủ hồ sơ {candidate.completenessScore}%</span></span><span className="mt-1 block text-[11px] text-slate-600">{candidate.customerName || 'Chưa có khách hàng'}{candidate.productName ? ` • ${candidate.productName}` : ''}</span>{candidate.missingDocuments.length > 0 && <span className="mt-1 block text-[11px] text-rose-700">Còn thiếu: {candidate.missingDocuments.join(', ')}</span>}</span></label>)}{!loadingCandidates && filteredCandidates.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[11px] text-slate-500">Không có bộ hồ sơ QC đang thuộc phạm vi trợ lý.</div>}</div><div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"><button type="button" onClick={() => void startReview()} disabled={!selectedDossierId || starting} className="mobile-touch-target min-h-11 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-base font-black leading-5 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><Play size={13} /> {starting ? 'Đang soát xét bằng AI...' : 'Bắt đầu soát xét bằng AI'}</button><p className="text-sm leading-5 text-slate-600">Chỉ đọc: AI đọc hồ sơ và đánh giá hỗ trợ; không xác nhận hồ sơ hoặc thay đổi trạng thái.</p>{selectedCandidate && <span className="text-xs text-slate-500">Đã chọn: <strong>{selectedCandidate.dossierCode}</strong>.</span>}</div></section>
      {selectedCandidate && selectedPcnProjection && <section className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm" data-testid="pcn-assistant-quick-actions" aria-labelledby="pcn-assistant-quick-actions-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="pcn-assistant-quick-actions-title" className="text-[11px] font-black uppercase tracking-wide text-slate-700">Ngữ cảnh hồ sơ · chỉ đọc</h2><p className="mt-1 text-[11px] leading-4 text-slate-500">Dữ liệu tổng hợp hiện hành từ tài liệu, mẫu/PYC, KQTN và trở ngại; không phê duyệt, không đổi trạng thái.</p></div><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{selectedPcnProjection.nextAction.label}</span></div><div className="mt-2 grid gap-1.5 sm:grid-cols-2"><button type="button" onClick={() => runPcnQuickAction('missing')} className="mobile-touch-target min-h-11 rounded-md border border-rose-200 bg-rose-50 px-2 text-left text-[11px] font-black text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Hồ sơ còn thiếu</button><button type="button" onClick={() => runPcnQuickAction('review')} className="mobile-touch-target min-h-11 rounded-md border border-sky-200 bg-sky-50 px-2 text-left text-[11px] font-black text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Kiểm tra trước thẩm xét</button><button type="button" onClick={() => runPcnQuickAction('results')} className="mobile-touch-target min-h-11 rounded-md border border-blue-200 bg-blue-50 px-2 text-left text-[11px] font-black text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">KQTN đã đủ chưa?</button><button type="button" onClick={() => runPcnQuickAction('summary')} className="mobile-touch-target min-h-11 rounded-md border border-slate-200 bg-slate-50 px-2 text-left text-[11px] font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Tóm tắt hồ sơ</button><button type="button" onClick={() => runPcnQuickAction('report')} className="mobile-touch-target min-h-11 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-left text-[11px] font-black text-emerald-800 sm:col-span-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Mở soạn báo cáo</button></div>{pcnQuickAnswer && <p className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-2 text-[11px] leading-4 text-emerald-950" role="status" aria-live="polite">{pcnQuickAnswer}</p>}</section>}      {viewState === 'running' && <div className="rounded-lg border border-blue-200 bg-white p-3" role="status" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-blue-800"><span>{currentCriterion.title ? `Đang đánh giá tiêu chí ${currentCriterion.index + 1}/11: ${currentCriterion.title}` : 'Đang chuẩn bị đọc bằng chứng...'}</span><span>Tiêu chí đã hoàn tất: {completedCriterionCount}/11</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, (completedCriterionCount / 11) * 100)}%` }} /></div></div>}
      {runErrorView && <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] leading-4 text-rose-900" role="alert" aria-live="assertive"><FileWarning size={17} className="mt-0.5 shrink-0 text-rose-600" /><div className="min-w-0 flex-1"><h2 className="font-black">{runErrorView.title}</h2><p className="mt-1 font-bold text-rose-800">{runErrorView.action}</p>{runErrorDetail && <details className="mt-2 text-[9px] text-rose-700"><summary className="cursor-pointer font-bold">Chi tiết phiên</summary><p className="mt-1 break-words">{runErrorDetail}</p></details>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={openSelectedDossier} disabled={!selectedCandidate} className="mobile-touch-target inline-flex min-h-9 items-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Mở hồ sơ</button><button type="button" onClick={openSelectedFile} disabled={!selectedFile} className="mobile-touch-target inline-flex min-h-9 items-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Mở tệp</button><button type="button" onClick={() => void startReview()} disabled={!selectedCandidate || starting} className="mobile-touch-target inline-flex min-h-9 items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><RefreshCw size={12} /> Thử lại</button></div></div></div>}
      {(runMessage || runError || criteria.length > 0) && <section className="space-y-3">{runMessage && <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-800" role="status" aria-live="polite">{starting && <Loader2 size={13} className="animate-spin" />}{runMessage}</div>}{runError && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-4 text-rose-800" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{runError}</span></div>}{summary && viewState === 'completed' && <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="Đạt" value={summary.pass} tone="text-emerald-700 bg-emerald-50" /><Metric label="Cảnh báo" value={summary.warning} tone="text-amber-700 bg-amber-50" /><Metric label="Lỗi" value={summary.error} tone="text-rose-700 bg-rose-50" /><Metric label="Chưa đủ căn cứ" value={summary.notEvaluable} tone="text-slate-700 bg-slate-100" /><div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2"><div className="text-[11px] font-bold text-indigo-600">Kết luận hỗ trợ</div><div className="mt-1 text-[11px] font-black text-indigo-900">{summary.conclusion}</div></div></div>}<div className="space-y-2">{criteria.map((criterion) => <CriterionCard key={criterion.id} criterion={criterion} onOpenEvidence={openEvidence} />)}</div>{summary && runId && viewState === 'completed' && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"><FileDown size={14} className="text-indigo-600" /><span className="mr-2 text-[11px] font-bold text-slate-600">Xuất bản chụp phiên hỗ trợ</span><button type="button" onClick={() => void exportReport('PDF')} className="mobile-touch-target rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">PDF</button><button type="button" onClick={() => void exportReport('DOCX')} className="mobile-touch-target rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">DOCX</button><span className="text-[9px] text-slate-400">Báo cáo tạm thời, không ghi vào hồ sơ.</span></div>}</section>}
    </div>
  );
}

function CriterionCard({ criterion, onOpenEvidence }: { criterion: PcnApprovalCriterionResult; onOpenEvidence: (assetId: string, tab: string, page?: number) => void }) {
  return <article className={`rounded-xl border p-3 shadow-sm ${statusClass[criterion.status]}`}><div className="flex items-start gap-2"><div className="mt-0.5">{criterion.status === 'PASS' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xs font-black">{criterion.title}</h2><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black">{statusLabel[criterion.status]}</span><span className="text-[9px] font-bold opacity-70">{criterion.source === 'AI' ? 'AI ngữ nghĩa' : criterion.source === 'RULE_AND_AI' ? 'Luật + AI' : 'Luật kiểm tra'}</span></div><p className="mt-1 text-[11px] leading-4">{criterion.summary}</p>{criterion.findings.length > 0 && <div className="mt-2 space-y-2">{criterion.findings.map((finding) => <div key={finding.id} className="rounded-lg border border-white/70 bg-white/60 p-2"><p className="text-[11px] font-black">{finding.message}</p>{finding.detail && <p className="mt-1 text-[11px] leading-4 opacity-80">{finding.detail}</p>}{finding.suggestedAction && <p className="mt-1 text-[11px] leading-4"><strong>Đối chiếu:</strong> {finding.suggestedAction}</p>}{finding.evidence.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{finding.evidence.map((evidence) => <button key={`${finding.id}-${evidence.assetId}-${evidence.page || 0}`} type="button" onClick={() => onOpenEvidence(evidence.assetId, evidence.tab, evidence.page)} className="inline-flex items-center gap-1 rounded-md border border-white bg-white/80 px-2 py-1 text-[11px] font-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><ExternalLink size={11} /> Mở bằng chứng {evidence.fileName}{evidence.page ? ` • trang ${evidence.page}` : ''}</button>)}</div>}</div>)}</div>}</div></div></article>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`rounded-lg border border-white p-2 ${tone}`}><div className="text-[11px] font-bold opacity-70">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>; }
