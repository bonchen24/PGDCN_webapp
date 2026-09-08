'use client';

import { AlertCircle, CheckCircle2, CircleDashed, FileDown, FilePlus2, FolderOpen, Loader2, RefreshCw, Save, Search, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnDraftFormKind, PcnDraftWorkspace, PcnSampleLot, PcnSampleRoute, PcnTemplateDefinition, PcnTemplateReviewAction, ReturnedTestResult } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { fetchPcnDraftWorkspaces, generatePcnDraftWorkspace, savePcnDraftWorkspace } from '../utils/pcnDraftApi';
import { buildPcnDraftSourceValues, getPcnDraftFieldDefinitions, validatePcnDraftAction } from '../utils/pcnDrafting';
import { getPcnOperationalTemplates, type PcnOperationalTemplateDefinition } from '../utils/pcnOperationalTemplateCatalog';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PcnDocxSettingsModal from './PcnDocxSettingsModal';
import { PgdcnDateInput } from './PgdcnDateInput';

type Props = { proposals: CertificationProposal[]; dossiers: CertificationDossier[]; templates: PcnTemplateDefinition[]; onUploadTemplate: (templateId: string, file: File) => Promise<unknown>; onReviewTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>; sampleLots?: PcnSampleLot[]; sampleRoutes?: PcnSampleRoute[]; labRequests?: OutboundLabRequest[]; returnedResults?: ReturnedTestResult[]; initialDossierId?: string; initialRequirementId?: string; initialNodeId?: string; initialKind?: PcnDraftFormKind; onToast?: (message: string, type?: 'success' | 'error') => void };

const FORM_OPTIONS: Array<{ kind: PcnDraftFormKind; label: string }> = [
  { kind: 'PROPOSAL_FORM', label: 'Đề nghị chứng nhận' }, { kind: 'DOSSIER_COVER', label: 'Bìa và mục lục hồ sơ' }, { kind: 'ASSIGNMENT_FORM', label: 'Phiếu phân công chứng nhận' }, { kind: 'EVALUATION_PLAN', label: 'Kế hoạch đánh giá CNSP' }, { kind: 'FIELD_INSPECTION', label: 'Biên bản kiểm tra tại hiện trường' }, { kind: 'SAMPLE_TAKING', label: 'Biên bản lấy mẫu' }, { kind: 'SAMPLE_CODING', label: 'Biên bản mã hóa mẫu theo lô' }, { kind: 'SAMPLE_HANDOVER', label: 'Biên bản giao nhận mẫu' }, { kind: 'LAB_REQUEST', label: 'PYC gửi phòng thử nghiệm' }, { kind: 'EVALUATION_REPORT', label: 'Báo cáo đánh giá chứng nhận' }, { kind: 'CERTIFICATION_RESULT', label: 'Kết quả chứng nhận / phụ lục' }, { kind: 'COMMERCIAL', label: 'Hợp đồng dịch vụ chứng nhận' }, { kind: 'CLIENT_PACKAGE', label: 'Hồ sơ gửi khách hàng' },
];

function titleForKind(kind: PcnDraftFormKind): string { return FORM_OPTIONS.find((item) => item.kind === kind)?.label || kind; }

type PcnDraftingState = 'EMPTY' | 'EDITING' | 'SAVED' | 'GENERATING' | 'READY' | 'BLOCKED' | 'ERROR';

const PCN_DRAFTING_STATE_LABELS: Record<PcnDraftingState, string> = {
  EMPTY: 'Chưa chọn nguồn',
  EDITING: 'Đang soạn',
  SAVED: 'Đã lưu bản nháp',
  GENERATING: 'Đang sinh tài liệu',
  READY: 'Đã sẵn sàng',
  BLOCKED: 'Cần bổ sung dữ liệu',
  ERROR: 'Có lỗi, cần thử lại',
};

function PcnDraftingStateSummary({ state, sourceLabel, templateLabel, missingCount, message }: { state: PcnDraftingState; sourceLabel: string; templateLabel: string; missingCount: number; message: string }) {
  const tone = state === 'READY' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : state === 'BLOCKED' ? 'border-amber-200 bg-amber-50 text-amber-900' : state === 'ERROR' ? 'border-rose-200 bg-rose-50 text-rose-900' : state === 'GENERATING' ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-800';
  const Icon = state === 'READY' ? CheckCircle2 : state === 'BLOCKED' ? AlertCircle : state === 'ERROR' ? AlertCircle : state === 'GENERATING' ? Loader2 : CircleDashed;
  return <section data-testid="pcn-drafting-readiness" className={`rounded-xl border p-3 ${tone}`} aria-label="Trạng thái bản soạn thảo"><div className="flex flex-wrap items-start gap-2"><Icon size={16} className={state === 'GENERATING' ? 'animate-spin' : 'mt-0.5'} /><div className="min-w-0 flex-1"><div data-testid="pcn-drafting-state" aria-live="polite" className="text-[10px] font-black uppercase tracking-[0.12em]">{PCN_DRAFTING_STATE_LABELS[state]}</div><p className="mt-1 text-[10px] leading-4">{state === 'EMPTY' ? 'Chọn một Đề nghị hoặc hồ sơ để khởi tạo dữ liệu cho biểu mẫu.' : state === 'BLOCKED' ? `Chưa thể sinh file: còn ${missingCount} trường bắt buộc.` : state === 'GENERATING' ? 'Đang tạo file từ snapshot hiện tại. Vui lòng giữ nguyên cửa sổ này.' : state === 'READY' ? 'Bản soạn đã có output; có thể mở hoặc tải file ở cột kết quả.' : message || 'Có thể tiếp tục nhập, lưu bản nháp hoặc kiểm tra readiness.'}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold"><span className="max-w-full truncate rounded-md border border-current/15 bg-white/70 px-2 py-1" title={sourceLabel}>Nguồn: {sourceLabel}</span><span className="max-w-full truncate rounded-md border border-current/15 bg-white/70 px-2 py-1" title={templateLabel}>Template: {templateLabel}</span>{missingCount > 0 && <span className="rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-amber-800">Thiếu {missingCount} trường</span>}</div></div></div></section>;
}

export default function PcnDraftingWorkspaceView({ proposals, dossiers, templates: managedTemplates, onUploadTemplate, onReviewTemplate, sampleLots = [], sampleRoutes = [], labRequests = [], returnedResults = [], initialDossierId, initialRequirementId, initialNodeId, initialKind, onToast }: Props) {
  const templates = useMemo(() => getPcnOperationalTemplates(), []);
  const [drafts, setDrafts] = useState<PcnDraftWorkspace[]>([]);
  const [draftId, setDraftId] = useState<string>();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PcnDraftFormKind>(initialKind || 'PROPOSAL_FORM');
  const [sourceKey, setSourceKey] = useState(initialDossierId ? `dossier:${initialDossierId}` : '');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [docxSettingsOpen, setDocxSettingsOpen] = useState(false);
  const source = sourceKey.startsWith('dossier:') ? { dossier: dossiers.find((item) => item.id === sourceKey.slice(8)), proposal: proposals.find((item) => item.id === dossiers.find((candidate) => candidate.id === sourceKey.slice(8))?.proposalId) } : { proposal: proposals.find((item) => item.id === sourceKey.slice(9)), dossier: dossiers.find((item) => item.proposalId === sourceKey.slice(9) || item.id === proposals.find((candidate) => candidate.id === sourceKey.slice(9))?.dossierId) };
  const template = templates.find((item) => item.generationKind === kind) as PcnOperationalTemplateDefinition | undefined;
  const fieldDefinitions = useMemo(() => getPcnDraftFieldDefinitions(kind), [kind]);
  const currentDraft = drafts.find((item) => item.id === draftId);
  const validation = useMemo(() => validatePcnDraftAction(kind, values, 'GENERATE'), [kind, values]);
  const draftingState: PcnDraftingState = busy ? 'GENERATING' : message && /lỗi|không thể/i.test(message) ? 'ERROR' : !sourceKey && !draftId ? 'EMPTY' : !template ? 'BLOCKED' : currentDraft?.outputs?.length ? 'READY' : draftId ? 'SAVED' : validation.valid ? 'EDITING' : 'BLOCKED';
  const sourceLabel = source.dossier?.dossierCode || source.proposal?.proposalCode || 'Chưa chọn hồ sơ';
  const templateLabel = template?.displayName || 'Chưa có template';
  const sourceOptions = useMemo<PcnCatalogOption[]>(() => {
    const proposalOptions = proposals.map((proposal) => ({
      key: `proposal:${proposal.id}`,
      label: `${proposal.proposalCode} · ${proposal.customerSnapshot.name} · ${proposal.productName}`,
      searchText: [proposal.proposalCode, proposal.customerSnapshot.name, proposal.productName, proposal.model, proposal.dossierId].filter(Boolean).join(' '),
    }));
    const dossierOptions = dossiers.map((dossier) => {
      const proposal = proposals.find((candidate) => candidate.id === dossier.proposalId);
      const customerName = proposal?.customerSnapshot.name || dossier.customerSnapshot?.name || 'Chưa có khách hàng';
      const productName = proposal?.productName || 'Chưa có tên sản phẩm';
      return {
        key: `dossier:${dossier.id}`,
        label: `Hồ sơ ${dossier.dossierCode} · ${customerName} · ${productName}`,
        searchText: [dossier.dossierCode, dossier.proposalId, customerName, productName, proposal?.proposalCode].filter(Boolean).join(' '),
      };
    });
    return [...proposalOptions, ...dossierOptions].map((sourceOption) => ({
      value: sourceOption.key,
      label: sourceOption.label,
      searchText: sourceOption.searchText,
    }));
  }, [dossiers, proposals]);

  useEffect(() => { fetchPcnDraftWorkspaces().then(setDrafts).catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    if (initialDossierId) setSourceKey(`dossier:${initialDossierId}`);
    if (initialKind) setKind(initialKind);
  }, [initialDossierId, initialKind]);
  const relatedSource = useMemo(() => ({ sampleLots, sampleRoutes, labRequests, returnedResults }), [labRequests, returnedResults, sampleLots, sampleRoutes]);
  useEffect(() => { if (sourceKey && !draftId) setValues((current) => ({ ...buildPcnDraftSourceValues(source.proposal, source.dossier, relatedSource), ...current })); }, [sourceKey, source.proposal, source.dossier, relatedSource, draftId]);

  const newDraft = () => { setDraftId(undefined); setTitle(''); setSourceKey(''); setKind('PROPOSAL_FORM'); setValues({}); setMessage('Đã mở bản soạn thảo mới.'); };
  const loadDraft = (draft: PcnDraftWorkspace) => { setDraftId(draft.id); setTitle(draft.title); setKind(draft.formKind); setSourceKey(draft.sourceDossierId ? `dossier:${draft.sourceDossierId}` : draft.sourceProposalId ? `proposal:${draft.sourceProposalId}` : ''); setValues(draft.values || {}); setMessage(`Đã mở bản soạn thảo ${draft.title}.`); };
  const save = async () => { setBusy(true); try { const saved = await savePcnDraftWorkspace({ ...(draftId ? { id: draftId } : {}), title: title.trim() || titleForKind(kind), formKind: kind, templateId: template?.id || `pcn-draft-${kind.toLowerCase()}`, sourceProposalId: source.proposal?.id, sourceDossierId: source.dossier?.id, fieldCodes: source.dossier?.fieldCodes || source.proposal?.fieldCodes || [], values }); setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setDraftId(saved.id); setMessage('Đã lưu bản soạn thảo. Có thể bổ sung trường còn thiếu trước khi tạo file.'); onToast?.('Đã lưu bản soạn thảo.', 'success'); return saved; } catch (error: any) { setMessage(error.message); onToast?.(error.message, 'error'); } finally { setBusy(false); } };
  const generate = async () => { const validation = validatePcnDraftAction(kind, values, 'GENERATE'); if (!validation.valid) { setMessage(`Chưa thể tạo file. Còn thiếu: ${validation.missingKeys.join(', ')}`); return; } let currentId = draftId; if (!currentId) { const saved = await save(); currentId = saved?.id; } if (!currentId) return; setBusy(true); try { const generated = await generatePcnDraftWorkspace(currentId); setDrafts((current) => [generated, ...current.filter((item) => item.id !== generated.id)]); setDraftId(generated.id); setMessage(`Đã sinh ${generated.outputs?.length || 0} file. Có thể tải từ danh sách kết quả.`); onToast?.('Đã sinh DOCX/PDF từ bản soạn thảo.', 'success'); } catch (error: any) { setMessage(error.message); onToast?.(error.message, 'error'); } finally { setBusy(false); } };

  return <>
<div data-testid="pcn-drafting-workspace" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 mobile-safe-bottom md:p-5">
<div className="flex flex-wrap items-start justify-between gap-3">
<div>
<p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Workspace độc lập</p>
<h1 className="mt-1 text-xl font-black text-slate-900">Soạn thảo tài liệu PCN</h1>
<p className="mt-1 text-[11px] text-slate-500">Lấy dữ liệu từ Đề nghị/hồ sơ, nhập form và tạo tài liệu gửi khách hàng hoặc mục đích khác. Không làm hồ sơ chuyển bước.</p>
</div>
<div className="flex flex-wrap gap-2">
<button type="button" onClick={() => setDocxSettingsOpen(true)} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
<Settings2 size={14} /> Cài đặt DOCX</button>
<button type="button" onClick={newDraft} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
<FilePlus2 size={14} /> Bản soạn mới</button>
</div>
</div>
 <PcnDraftingStateSummary state={draftingState} sourceLabel={sourceLabel} templateLabel={templateLabel} missingCount={validation.missingKeys.length} message={message} />
 {initialRequirementId && <div data-testid="pcn-drafting-focus-context" className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[10px] font-bold text-emerald-800">Đang soạn tài liệu từ node hồ sơ{initialNodeId ? ` · ${initialNodeId}` : ''}. Khi sinh file, kiểm tra lại nội dung rồi đính phiên vào đúng mục tài liệu.</div>}
<div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
<aside className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
<div className="flex items-center justify-between">
<h2 className="text-xs font-black text-slate-800">Bản đã lưu</h2>
<button type="button" onClick={() => fetchPcnDraftWorkspaces().then(setDrafts)} title="Tải lại" className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-emerald-600">
<RefreshCw size={13} />
</button>
</div>{drafts.length === 0 && <p className="py-4 text-[10px] text-slate-400">Chưa có bản soạn.</p>}{drafts.map((draft) => <button type="button" key={draft.id} onClick={() => loadDraft(draft)} className={`w-full rounded-lg border p-2 text-left ${draft.id === draftId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200'}`}>
<div className="truncate text-[10px] font-black text-slate-700">{draft.title}</div>
<div className="mt-1 text-[9px] text-slate-500">{titleForKind(draft.formKind)} · {draft.status}</div>{draft.outputs?.length ? <div className="mt-1 text-[9px] font-bold text-emerald-700">{draft.outputs.length} file đầu ra</div> : null}</button>)}</aside>
<section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
<label>
<span className="block text-[10px] font-black text-slate-500">Tên bản soạn</span>
<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" />
</label>
<label>
<span className="block text-[10px] font-black text-slate-500">Loại tài liệu</span>
<select value={kind} onChange={(event) => { const next = event.target.value as PcnDraftFormKind; setKind(next); setValues((current) => ({ ...buildPcnDraftSourceValues(source.proposal, source.dossier, relatedSource), ...current })); }} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400">{FORM_OPTIONS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select>
</label>
</div>
<div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5">
<div className="flex items-center gap-2 text-[10px] font-black text-indigo-800">
<FolderOpen size={14} /> Nguồn dữ liệu tùy chọn</div>
<div className="mt-2">
<PcnCatalogCombobox id="pcn-draft-source" label="Chọn nguồn soạn thảo" hideLabel value={sourceKey} options={sourceOptions} placeholder={sourceOptions.length > 0 ? 'Tìm số Đề nghị, hồ sơ, khách hàng hoặc sản phẩm...' : 'Không có nguồn hồ sơ'} onChange={(nextSourceKey) => { setSourceKey(nextSourceKey); setDraftId(undefined); }} disabled={busy} />
</div>{(source.proposal || source.dossier) && <p className="mt-1 text-[9px] text-indigo-700">Đang lấy từ {source.proposal ? source.proposal.proposalCode : 'nguồn hồ sơ'}{source.dossier ? ` · hồ sơ ${source.dossier.dossierCode}` : ''}. Bạn vẫn có thể sửa các trường trước khi sinh.</p>}</div>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{fieldDefinitions.map((field) => <label key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-2' : ''}>
<span className="block text-[10px] font-black text-slate-500">{field.label}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea rows={2} value={String(values[field.key] ?? '')} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" /> : field.type === 'date' ? <PgdcnDateInput value={String(values[field.key] ?? '')} onChange={(value) => setValues({ ...values, [field.key]: value })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" /> : <input type="text" value={String(values[field.key] ?? '')} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" />}</label>)}</div>
<div className="mobile-safe-bottom sticky bottom-0 z-10 flex flex-col items-stretch justify-between gap-2 border-t border-slate-200 bg-white py-3 sm:flex-row sm:items-center">
<div className="text-[10px] text-slate-500">{template ? `Template: ${template.displayName}` : 'Chưa có template tương ứng; cần cấu hình bổ sung.'}</div>
<div className="flex gap-2">
<button type="button" onClick={() => void save()} disabled={busy} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-50">
<Save size={13} /> Lưu bản nháp</button>
<button type="button" onClick={() => void generate()} disabled={busy} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">
<Sparkles size={14} /> {busy ? 'Đang xử lý...' : 'Tạo DOCX + PDF'}</button>
</div>
</div>{message && <div role="status" className="rounded-md bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-600">{message}</div>}</section>
<aside data-testid="pcn-drafting-outputs" className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
<h2 className="text-xs font-black text-slate-800">Kết quả sinh file</h2>{drafts.find((item) => item.id === draftId)?.outputs?.map((output) => <a key={output.id} href={getPcnFileUrl(output.fileAssetId)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-[10px] font-bold text-emerald-700 hover:border-emerald-200">
<FileDown size={14} /> <span className="min-w-0 truncate">{output.fileName}</span>
</a>)}{!drafts.find((item) => item.id === draftId)?.outputs?.length && <div className="py-5 text-[10px] text-slate-400">Chưa có file đầu ra.</div>}</aside>
</div>
</div>{docxSettingsOpen && <PcnDocxSettingsModal templates={managedTemplates} onUploadTemplate={onUploadTemplate} onReviewTemplate={onReviewTemplate} onClose={() => setDocxSettingsOpen(false)} />} </>;
}
