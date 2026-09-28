'use client';

import { ArrowLeft, CheckCircle2, FileDown, FilePlus2, FolderOpen, LockKeyhole, RefreshCw, Save, Settings2, Sparkles, UnlockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnDocumentRequirement, PcnDraftFormKind, PcnDraftWorkspace, PcnDossierDocument, PcnSampleLot, PcnSampleRoute, PcnTemplateDefinition, PcnTemplateReviewAction, ReturnedTestResult } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { confirmPcnDraftOutput, fetchPcnDraftWorkspaces, generatePcnDraftWorkspace, savePcnDraftWorkspace } from '../utils/pcnDraftApi';
import { buildPcnDraftSourceValues, getPcnDraftFieldDefinitions, getPcnDraftFieldSection, hasPcnDeepContext, validatePcnDraftAction } from '../utils/pcnDrafting';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, getPcnDocumentRequirements, getPcnDraftFormRequirementCode } from '../utils/pcnDossierDocuments';
import { buildPcnDossierInspection } from '../utils/pcnDossierInspection';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { getPcnOperationalTemplates, type PcnOperationalTemplateDefinition } from '../utils/pcnOperationalTemplateCatalog';
import { buildPcnDossierReturnRoute, sanitizeInternalReturnTo } from '../utils/draftingNavigation';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PcnDocxSettingsModal from './PcnDocxSettingsModal';
import { DraftingContextStatusBar, DraftingFieldSection, DraftingHeader, DraftingOutputReviewShell, DraftingReadinessPanel, DraftingStickyActionBar, DraftingWorkflowOrientation, type DraftingReadinessIssue } from './PgdcnDraftingPrimitives';
import { PgdcnDateInput } from './PgdcnDateInput';

type Props = { proposals: CertificationProposal[]; dossiers: CertificationDossier[]; templates: PcnTemplateDefinition[]; documentRequirements?: PcnDocumentRequirement[]; dossierDocuments?: PcnDossierDocument[]; onUploadTemplate: (templateId: string, file: File) => Promise<unknown>; onReviewTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>; sampleLots?: PcnSampleLot[]; sampleRoutes?: PcnSampleRoute[]; labRequests?: OutboundLabRequest[]; returnedResults?: ReturnedTestResult[]; initialDossierId?: string; initialRequirementId?: string; initialNodeId?: string; initialKind?: PcnDraftFormKind; initialReturnTo?: string; onToast?: (message: string, type?: 'success' | 'error') => void };

const FORM_OPTIONS: Array<{ kind: PcnDraftFormKind; label: string }> = [
  { kind: 'PROPOSAL_FORM', label: 'Đề nghị chứng nhận' },
  { kind: 'DOSSIER_COVER', label: 'Bìa và mục lục hồ sơ' },
  { kind: 'ASSIGNMENT_FORM', label: 'Phiếu phân công chứng nhận' },
  { kind: 'EVALUATION_PLAN', label: 'Kế hoạch đánh giá CNSP' },
  { kind: 'FIELD_INSPECTION', label: 'Biên bản kiểm tra tại hiện trường' },
  { kind: 'SAMPLE_TAKING', label: 'Biên bản lấy mẫu' },
  { kind: 'SAMPLE_CODING', label: 'Biên bản mã hóa mẫu theo lô' },
  { kind: 'SAMPLE_HANDOVER', label: 'Biên bản giao nhận mẫu' },
  { kind: 'LAB_REQUEST', label: 'PYC gửi phòng thử nghiệm' },
  { kind: 'EVALUATION_REPORT', label: 'Báo cáo đánh giá chứng nhận' },
  { kind: 'CERTIFICATION_RESULT', label: 'Kết quả chứng nhận / phụ lục' },
  { kind: 'COMMERCIAL', label: 'Hợp đồng dịch vụ chứng nhận' },
  { kind: 'CLIENT_PACKAGE', label: 'Hồ sơ gửi khách hàng' },
];

function titleForKind(kind: PcnDraftFormKind): string { return FORM_OPTIONS.find((item) => item.kind === kind)?.label || kind; }

type PcnDraftingState = 'EMPTY' | 'EDITING' | 'SAVED' | 'GENERATING' | 'READY' | 'CONFIRMED' | 'ATTACHED' | 'BLOCKED' | 'ERROR';
type PcnDocumentUiStatus = 'DRAFT' | 'GENERATED' | 'CONFIRMED' | 'ATTACHED';
type BusyAction = 'SAVE' | 'GENERATE' | 'CONFIRM' | null;

const PCN_DRAFTING_STATE_LABELS: Record<PcnDraftingState, string> = {
  EMPTY: 'Chưa chọn hồ sơ',
  EDITING: 'Đang soạn',
  SAVED: 'Đã lưu bản nháp',
  GENERATING: 'Đang sinh tài liệu',
  READY: 'Đã sinh, chờ soát xét',
  CONFIRMED: 'Đã xác nhận, chờ gắn hồ sơ',
  ATTACHED: 'Đã gắn vào hồ sơ',
  BLOCKED: 'Cần bổ sung dữ liệu',
  ERROR: 'Có lỗi, cần thử lại',
};

const PCN_DOCUMENT_STATUS_LABELS: Record<PcnDocumentUiStatus, string> = {
  DRAFT: 'Bản nháp',
  GENERATED: 'Đã sinh',
  CONFIRMED: 'Đã xác nhận',
  ATTACHED: 'Đã gắn hồ sơ',
};

const PCN_DOCUMENT_STATUS_CLASSES: Record<PcnDocumentUiStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  GENERATED: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  CONFIRMED: 'border-teal-200 bg-teal-50 text-teal-800',
  ATTACHED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

function draftWorkspaceStatusLabel(status: string): string {
  return PCN_DOCUMENT_STATUS_LABELS[status as PcnDocumentUiStatus] || status;
}

function checklistStatusLabel(status: 'MISSING' | 'PRESENT' | 'WAIVED'): string {
  return status === 'PRESENT' ? 'Đã có' : status === 'WAIVED' ? 'Đã miễn' : 'Còn thiếu';
}

function checklistStatusClass(status: 'MISSING' | 'PRESENT' | 'WAIVED'): string {
  return status === 'PRESENT' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'WAIVED' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-amber-200 bg-amber-50 text-amber-800';
}

function DraftLifecycleStatus({ status }: { status: PcnDocumentUiStatus }) {
  return <section data-testid="pcn-draft-document-status" aria-label="Trạng thái tài liệu PCN" className="rounded-lg border border-slate-200 bg-white p-2.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] font-black text-slate-800">Trạng thái tài liệu</p>
      <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${PCN_DOCUMENT_STATUS_CLASSES[status]}`}>{PCN_DOCUMENT_STATUS_LABELS[status]}</span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {(['DRAFT', 'GENERATED', 'CONFIRMED', 'ATTACHED'] as PcnDocumentUiStatus[]).map((item) => <span key={item} className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-bold ${item === status ? PCN_DOCUMENT_STATUS_CLASSES[item] : 'border-slate-100 bg-slate-50 text-slate-400'}`}>{PCN_DOCUMENT_STATUS_LABELS[item]}<span className="sr-only"> · {item}</span></span>)}
    </div>
  </section>;
}

export default function PcnDraftingWorkspaceView({ proposals, dossiers, templates: managedTemplates, documentRequirements = DEFAULT_PCN_DOCUMENT_REQUIREMENTS, dossierDocuments = [], onUploadTemplate, onReviewTemplate, sampleLots = [], sampleRoutes = [], labRequests = [], returnedResults = [], initialDossierId, initialRequirementId, initialNodeId, initialKind, initialReturnTo, onToast }: Props) {
  const templates = useMemo(() => getPcnOperationalTemplates(), []);
  const [drafts, setDrafts] = useState<PcnDraftWorkspace[]>([]);
  const [draftId, setDraftId] = useState<string>();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PcnDraftFormKind>(initialKind || 'PROPOSAL_FORM');
  const [sourceKey, setSourceKey] = useState(initialDossierId ? `dossier:${initialDossierId}` : '');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attachedOutputIds, setAttachedOutputIds] = useState<string[]>([]);
  const [reviewedOutputIds, setReviewedOutputIds] = useState<string[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState(initialRequirementId || '');
  const [docxSettingsOpen, setDocxSettingsOpen] = useState(false);
  const [allowSourceEditing, setAllowSourceEditing] = useState(false);
  const [contextLocked, setContextLocked] = useState(() => hasPcnDeepContext({ dossierId: initialDossierId, requirementId: initialRequirementId, kind: initialKind }));
  const [routeReturnTo] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') || undefined : undefined);
  const hydratedSourceRef = useRef('');

  const source = useMemo(() => {
    if (sourceKey.startsWith('dossier:')) {
      const dossier = dossiers.find((item) => item.id === sourceKey.slice(8));
      return { dossier, proposal: dossier ? proposals.find((item) => item.id === dossier.proposalId) : undefined };
    }
    if (sourceKey.startsWith('proposal:')) {
      const proposal = proposals.find((item) => item.id === sourceKey.slice(9));
      return { proposal, dossier: proposal ? dossiers.find((item) => item.proposalId === proposal.id || item.id === proposal.dossierId) : undefined };
    }
    return { dossier: undefined, proposal: undefined };
  }, [dossiers, proposals, sourceKey]);
  const dossierRequirements = useMemo(() => source.dossier ? getPcnDocumentRequirements(source.dossier.fieldCodes, documentRequirements) : [], [documentRequirements, source.dossier]);
  const dossierInspection = useMemo(() => source.dossier ? buildPcnDossierInspection({ dossierId: source.dossier.id, fieldCodes: source.dossier.fieldCodes, requirements: dossierRequirements, documents: dossierDocuments, documentWaivers: source.dossier.documentWaivers, compact: true }) : undefined, [dossierDocuments, dossierRequirements, source.dossier]);
  const fieldDefinitions = useMemo(() => getPcnDraftFieldDefinitions(kind), [kind]);
  const relatedSource = useMemo(() => ({ sampleLots, sampleRoutes, labRequests, returnedResults }), [labRequests, returnedResults, sampleLots, sampleRoutes]);
  const sourceValues = useMemo(() => buildPcnDraftSourceValues(source.proposal, source.dossier, relatedSource), [relatedSource, source.dossier, source.proposal]);
  const sourceFieldKeys = useMemo(() => new Set(Object.entries(sourceValues).filter(([, value]) => String(value ?? '').trim()).map(([key]) => key)), [sourceValues]);
  const fieldGroups = useMemo(() => {
    const groups = new Map<string, { section: { key: string; label: string }; fields: typeof fieldDefinitions; missingCount: number; autoFilledCount: number }>();
    for (const field of fieldDefinitions) {
      const section = field.section || getPcnDraftFieldSection(field.key);
      const current = groups.get(section.key);
      const missing = Boolean(field.required && !String(values[field.key] ?? '').trim());
      const autoFilled = sourceFieldKeys.has(field.key);
      if (current) {
        current.fields.push(field);
        current.missingCount += missing ? 1 : 0;
        current.autoFilledCount += autoFilled ? 1 : 0;
      } else groups.set(section.key, { section, fields: [field], missingCount: missing ? 1 : 0, autoFilledCount: autoFilled ? 1 : 0 });
    }
    return [...groups.values()].map((group) => ({ ...group, fields: [...group.fields].sort((left, right) => Number(Boolean(right.required && !String(values[right.key] ?? '').trim())) - Number(Boolean(left.required && !String(values[left.key] ?? '').trim()))) })).sort((left, right) => Number(right.missingCount > 0) - Number(left.missingCount > 0));
  }, [fieldDefinitions, sourceFieldKeys, values]);
  const currentDraft = drafts.find((item) => item.id === draftId);
  const currentOutputs = currentDraft?.outputs || [];
  const validation = useMemo(() => validatePcnDraftAction(kind, values, 'GENERATE'), [kind, values]);
  const templateRequirementCode = getPcnDraftFormRequirementCode(kind);
  const selectedRequirement = dossierRequirements.find((requirement) => requirement.id === selectedRequirementId);
  const selectedRequirementHasForm = !selectedRequirement || FORM_OPTIONS.some((option) => getPcnDraftFormRequirementCode(option.kind) === selectedRequirement.code);
  const template = selectedRequirementHasForm ? templates.find((item) => item.generationKind === kind) as PcnOperationalTemplateDefinition | undefined : undefined;
  const activeRequirement = selectedRequirement || dossierRequirements.find((requirement) => requirement.code === templateRequirementCode);
  const persistedAttachedOutputIds = useMemo(() => {
    if (!source.dossier || !activeRequirement) return [];
    const attachedAssetIds = new Set(dossierDocuments.filter((document) => document.dossierId === source.dossier?.id && document.requirementId === activeRequirement.id && document.status === 'PRESENT').flatMap((document) => document.versions.map((version) => version.assetId)));
    return currentOutputs.filter((output) => attachedAssetIds.has(output.fileAssetId)).map((output) => output.id);
  }, [activeRequirement, currentOutputs, dossierDocuments, source.dossier]);
  const attachedOutputIdSet = useMemo(() => new Set([...persistedAttachedOutputIds, ...attachedOutputIds]), [attachedOutputIds, persistedAttachedOutputIds]);
  const hasAttachedOutput = currentOutputs.some((output) => attachedOutputIdSet.has(output.id));
  const hasConfirmedOutput = currentOutputs.some((output) => reviewedOutputIds.includes(output.id) || attachedOutputIdSet.has(output.id));
  const hasSelectedSource = Boolean(source.dossier || source.proposal);
  const hasContext = Boolean(hasSelectedSource || draftId);
  const draftingState: PcnDraftingState = busyAction === 'GENERATE'
    ? 'GENERATING'
    : errorMessage
      ? 'ERROR'
      : !hasContext
        ? 'EMPTY'
        : hasAttachedOutput
          ? 'ATTACHED'
          : hasConfirmedOutput
            ? 'CONFIRMED'
            : currentOutputs.length > 0
              ? 'READY'
              : !template || !validation.valid
                ? 'BLOCKED'
                : draftId
                  ? 'SAVED'
                  : 'EDITING';
  const documentStatus: PcnDocumentUiStatus = hasAttachedOutput ? 'ATTACHED' : hasConfirmedOutput ? 'CONFIRMED' : currentOutputs.length > 0 ? 'GENERATED' : 'DRAFT';
  const sourceLabel = source.dossier?.dossierCode || source.proposal?.proposalCode || 'Chưa chọn hồ sơ';
  const customerLabel = source.dossier?.customerSnapshot?.name || source.proposal?.customerSnapshot?.name || 'Chưa có khách hàng';
  const productLabel = source.proposal?.productName || 'Chưa có sản phẩm';
  const templateLabel = template?.displayName || titleForKind(kind);
  const dossierStatusLabel = source.dossier ? getPcnDossierStatusLabel(source.dossier.status) : 'Chưa gắn hồ sơ';
  const readinessIssues: DraftingReadinessIssue[] = validation.missingKeys.map((key) => ({ key, label: fieldDefinitions.find((field) => field.key === key)?.label || key, message: 'Bổ sung trường bắt buộc trước khi sinh tài liệu.' }));
  const draftingActiveStep: 1 | 2 | 3 | 4 = !hasContext ? 1 : !validation.valid ? 2 : hasAttachedOutput ? 4 : currentOutputs.length > 0 ? 3 : 2;
  const draftingCompletedThrough: 0 | 1 | 2 | 3 | 4 = draftingActiveStep === 1 ? 0 : draftingActiveStep === 2 ? 1 : draftingActiveStep === 3 ? 2 : 3;
  const relatedDrafts = useMemo(() => drafts.filter((draft) => (source.dossier ? draft.sourceDossierId === source.dossier?.id : source.proposal ? draft.sourceProposalId === source.proposal.id : false) && draft.formKind === kind), [drafts, kind, source.dossier, source.proposal]);
  const preferredOutput = currentOutputs.find((output) => output.format === 'PDF' && !attachedOutputIdSet.has(output.id)) || currentOutputs.find((output) => !attachedOutputIdSet.has(output.id)) || currentOutputs[0];
  const busy = busyAction !== null;

  useEffect(() => {
    let active = true;
    fetchPcnDraftWorkspaces().then((items) => { if (active) setDrafts(items); }).catch((error) => { if (active) { setErrorMessage(error.message); setMessage(error.message); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const initialDossier = initialDossierId ? dossiers.find((dossier) => dossier.id === initialDossierId) : undefined;
    const initialRequirements = initialDossier ? getPcnDocumentRequirements(initialDossier.fieldCodes, documentRequirements) : [];
    const requirementFromProps = initialRequirementId ? initialRequirements.find((requirement) => requirement.id === initialRequirementId) : undefined;
    const kindFromRequirement = requirementFromProps ? FORM_OPTIONS.find((option) => getPcnDraftFormRequirementCode(option.kind) === requirementFromProps.code)?.kind : undefined;
    const nextKind = initialKind || kindFromRequirement;
    if (initialDossierId) setSourceKey(`dossier:${initialDossierId}`);
    if (nextKind) setKind(nextKind);
    const requirementForKind = nextKind ? initialRequirements.find((requirement) => requirement.code === getPcnDraftFormRequirementCode(nextKind)) : undefined;
    const nextRequirementId = requirementFromProps?.id || requirementForKind?.id;
    if (nextRequirementId) setSelectedRequirementId(nextRequirementId);
    if (hasPcnDeepContext({ dossierId: initialDossierId, requirementId: initialRequirementId, kind: initialKind })) setContextLocked(true);
  }, [documentRequirements, dossiers, initialDossierId, initialKind, initialRequirementId]);

  useEffect(() => {
    if (!sourceKey || draftId || hydratedSourceRef.current === sourceKey || !hasSelectedSource) return;
    setValues(sourceValues);
    hydratedSourceRef.current = sourceKey;
  }, [draftId, hasSelectedSource, sourceKey, sourceValues]);

  const focusField = (key: string) => {
    const element = document.getElementById(`pcn-draft-${key}`) as HTMLElement | null;
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => element.focus({ preventScroll: true }), 100);
  };

  const focusFirstMissingField = () => {
    const first = readinessIssues[0];
    if (first) focusField(first.key);
  };

  const focusOutputReview = () => {
    document.getElementById('pcn-drafting-outputs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const returnToDossier = () => {
    if (typeof window === 'undefined') return;
    const target = sanitizeInternalReturnTo(initialReturnTo || routeReturnTo) || (source.dossier ? buildPcnDossierReturnRoute(source.dossier.id, { tab: 'documents', nodeId: initialNodeId }) : '/pgdcn/pcn');
    window.location.replace(target);
  };

  const updateValue = (key: string, value: string) => {
    setErrorMessage('');
    setMessage('');
    setValues((current) => ({ ...current, [key]: value }));
  };

  const newDraft = () => {
    if (hasPcnDeepContext({ dossierId: initialDossierId, requirementId: initialRequirementId, kind: initialKind }) && source.dossier) {
      setDraftId(undefined);
      setTitle('');
      setValues(sourceValues);
      setAttachedOutputIds([]);
      setReviewedOutputIds([]);
      setAllowSourceEditing(false);
      setContextLocked(true);
      setErrorMessage('');
      setMessage('Đã mở bản soạn mới cho hồ sơ đang mở. Bối cảnh tài liệu được giữ nguyên.');
      return;
    }
    setDraftId(undefined);
    setTitle('');
    setSourceKey('');
    setKind('PROPOSAL_FORM');
    setSelectedRequirementId('');
    setValues({});
    hydratedSourceRef.current = '';
    setAttachedOutputIds([]);
    setReviewedOutputIds([]);
    setAllowSourceEditing(false);
    setContextLocked(false);
    setErrorMessage('');
    setMessage('Đã mở phiên soạn thảo mới. Chọn hồ sơ để tiếp tục.');
  };

  const loadDraft = (draft: PcnDraftWorkspace) => {
    setDraftId(draft.id);
    setTitle(draft.title);
    setKind(draft.formKind);
    setSelectedRequirementId('');
    setSourceKey(draft.sourceDossierId ? `dossier:${draft.sourceDossierId}` : draft.sourceProposalId ? `proposal:${draft.sourceProposalId}` : '');
    setValues(draft.values || {});
    setAttachedOutputIds([]);
    setReviewedOutputIds([]);
    setContextLocked(false);
    setErrorMessage('');
    setMessage(`Đã mở ${draftWorkspaceStatusLabel(draft.status).toLowerCase()}: ${draft.title}.`);
  };

  const selectRequirement = (requirementId: string) => {
    const requirement = dossierRequirements.find((item) => item.id === requirementId);
    if (!requirement) return;
    setSelectedRequirementId(requirement.id);
    const nextKind = FORM_OPTIONS.find((item) => getPcnDraftFormRequirementCode(item.kind) === requirement.code)?.kind;
    if (nextKind) {
      setKind(nextKind);
      setValues((current) => ({ ...sourceValues, ...current }));
      setDraftId(undefined);
    }
    setContextLocked(false);
    setErrorMessage('');
    setMessage(`Đã mở tài liệu trong hồ sơ: ${requirement.name}.`);
  };

  const save = async () => {
    if (busyAction) return undefined;
    if (!hasSelectedSource) {
      setMessage('Hãy chọn hồ sơ trước khi lưu bản nháp.');
      setErrorMessage('');
      document.getElementById('pcn-draft-source')?.focus();
      return undefined;
    }
    setBusyAction('SAVE');
    setErrorMessage('');
    try {
      const saved = await savePcnDraftWorkspace({ ...(draftId ? { id: draftId } : {}), title: title.trim() || titleForKind(kind), formKind: kind, templateId: template?.id || `pcn-draft-${kind.toLowerCase()}`, sourceProposalId: source.proposal?.id, sourceDossierId: source.dossier?.id, fieldCodes: source.dossier?.fieldCodes || source.proposal?.fieldCodes || [], values });
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setDraftId(saved.id);
      setMessage('Đã lưu bản nháp. Có thể tiếp tục bổ sung dữ liệu hoặc sinh tài liệu.');
      onToast?.('Đã lưu bản soạn thảo.', 'success');
      return saved;
    } catch (error: any) {
      setErrorMessage(error.message);
      setMessage(error.message);
      onToast?.(error.message, 'error');
      return undefined;
    } finally {
      setBusyAction(null);
    }
  };

  const generate = async () => {
    if (busyAction) return;
    if (!hasSelectedSource) {
      setMessage('Hãy chọn hồ sơ trước khi sinh tài liệu.');
      document.getElementById('pcn-draft-source')?.focus();
      return;
    }
    const nextValidation = validatePcnDraftAction(kind, values, 'GENERATE');
    if (!template || !nextValidation.valid) {
      setErrorMessage('');
      setMessage(`Chưa thể sinh tài liệu. Còn thiếu: ${nextValidation.missingKeys.map((key) => fieldDefinitions.find((field) => field.key === key)?.label || key).join(', ') || 'mẫu vận hành phù hợp'}.`);
      focusFirstMissingField();
      return;
    }
    let currentId = draftId;
    if (!currentId) {
      const saved = await save();
      currentId = saved?.id;
    }
    if (!currentId) return;
    setBusyAction('GENERATE');
    setErrorMessage('');
    try {
      const generated = await generatePcnDraftWorkspace(currentId);
      setDrafts((current) => [generated, ...current.filter((item) => item.id !== generated.id)]);
      setDraftId(generated.id);
      setAttachedOutputIds([]);
      setReviewedOutputIds([]);
      setMessage(`Đã sinh ${generated.outputs?.length || 0} tệp. Hãy soát xét trước khi gắn vào hồ sơ.`);
      onToast?.('Đã sinh DOCX/PDF từ bản soạn thảo.', 'success');
    } catch (error: any) {
      setErrorMessage(error.message);
      setMessage(error.message);
      onToast?.(error.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const reviewOutput = (outputId: string) => {
    setReviewedOutputIds((current) => current.includes(outputId) ? current : [...current, outputId]);
    setErrorMessage('');
    setMessage('Đã xác nhận đã soát xét tệp. Có thể gắn bản này vào đúng mục hồ sơ.');
  };

  const confirmOutput = async (outputId: string) => {
    if (!source.dossier?.id || !activeRequirement?.id || !draftId || busyAction) return;
    if (!reviewedOutputIds.includes(outputId) && !attachedOutputIdSet.has(outputId)) {
      reviewOutput(outputId);
      return;
    }
    setBusyAction('CONFIRM');
    setErrorMessage('');
    try {
      await confirmPcnDraftOutput({ dossierId: source.dossier.id, draftId, outputId, requirementId: activeRequirement.id, nodeId: initialNodeId });
      setAttachedOutputIds((current) => current.includes(outputId) ? current : [...current, outputId]);
      setReviewedOutputIds((current) => current.includes(outputId) ? current : [...current, outputId]);
      setMessage(`Đã soát xét và gắn bản tài liệu vào mục hồ sơ: ${activeRequirement.name}.`);
      onToast?.('Đã xác nhận & gắn vào bộ hồ sơ.', 'success');
    } catch (error: any) {
      setErrorMessage(error.message);
      setMessage(error.message);
      onToast?.(error.message, 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const sourceOptions = useMemo<PcnCatalogOption[]>(() => {
    const dossierOptions = dossiers.map((dossier) => {
      const proposal = proposals.find((candidate) => candidate.id === dossier.proposalId);
      const customerName = proposal?.customerSnapshot.name || dossier.customerSnapshot?.name || 'Chưa có khách hàng';
      const productName = proposal?.productName || 'Chưa có tên sản phẩm';
      return { value: `dossier:${dossier.id}`, label: `Hồ sơ ${dossier.dossierCode} · ${customerName} · ${productName}`, searchText: [dossier.dossierCode, dossier.proposalId, customerName, productName, proposal?.proposalCode].filter(Boolean).join(' ') };
    });
    const proposalOptions = proposals.filter((proposal) => !dossiers.some((dossier) => dossier.proposalId === proposal.id)).map((proposal) => ({ value: `proposal:${proposal.id}`, label: `Đề nghị ${proposal.proposalCode} · ${proposal.customerSnapshot.name} · ${proposal.productName}`, searchText: [proposal.proposalCode, proposal.customerSnapshot.name, proposal.productName, proposal.model].filter(Boolean).join(' ') }));
    return [...dossierOptions, ...proposalOptions];
  }, [dossiers, proposals]);

  return <>
    <div data-testid="pcn-drafting-workspace" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 pb-20 md:p-5">
    <DraftingHeader domain="PCN" testId="pcn-drafting-header" title="Soạn thảo tài liệu PCN" description="Bắt đầu từ đúng hồ sơ, kiểm tra dữ liệu còn thiếu, soạn và sinh tài liệu, soát xét rồi gắn vào mục hồ sơ." actions={<>
        {source.dossier && <button type="button" onClick={returnToDossier} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[12px] font-black text-emerald-700 shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><ArrowLeft size={14} aria-hidden="true" /> Quay lại hồ sơ</button>}
        <button type="button" onClick={() => setDocxSettingsOpen(true)} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[12px] font-black text-emerald-700 shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><Settings2 size={14} aria-hidden="true" /> Cài đặt DOCX</button>
        <button type="button" onClick={newDraft} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-black text-white shadow-sm hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><FilePlus2 size={14} aria-hidden="true" /> Bản soạn mới</button>
      </>} />
      <DraftingWorkflowOrientation activeStep={draftingActiveStep} completedThrough={draftingCompletedThrough} accent="emerald" testId="pcn-drafting-orientation" />
      <DraftingContextStatusBar domain="PCN" testId="pcn-drafting-context-status" sourceLabel={sourceLabel} documentLabel={templateLabel} statusLabel={PCN_DRAFTING_STATE_LABELS[draftingState]} description="Dữ liệu hồ sơ đã có được giữ ở lớp phụ; trường còn thiếu nằm trong vùng công việc." metadata={<><span className="max-w-full break-words rounded-md border border-white/80 bg-white/80 px-2 py-1 text-slate-700">Khách hàng: {customerLabel}</span><span className="max-w-full break-words rounded-md border border-white/80 bg-white/80 px-2 py-1 text-slate-700">Sản phẩm: {productLabel}</span><span className="max-w-full break-words rounded-md border border-emerald-200 bg-white/80 px-2 py-1 text-emerald-800">Hồ sơ: {dossierStatusLabel}</span></>} advancedMetadata={<><div><span className="text-slate-400">Mã yêu cầu:</span> <span className="font-mono text-slate-700">{activeRequirement?.code || 'Chưa ánh xạ'}</span></div><div><span className="text-slate-400">Node xử lý:</span> <span className="font-mono text-slate-700">{initialNodeId || 'Không có'}</span></div><div><span className="text-slate-400">Template:</span> <span className="font-mono text-slate-700">{template?.id || 'Chưa có'}</span></div></>} />
      <DraftingReadinessPanel state={draftingState} stateLabel={PCN_DRAFTING_STATE_LABELS[draftingState]} testId="pcn-drafting-readiness" stateTestId="pcn-drafting-state" issueCount={readinessIssues.length} issues={readinessIssues} onIssueClick={(issue) => focusField(issue.key)} message={draftingState === 'EMPTY' ? 'Chọn một hồ sơ để nạp dữ liệu nguồn và tài liệu cần xử lý.' : draftingState === 'BLOCKED' ? `Chưa thể sinh tệp: còn ${readinessIssues.length} trường bắt buộc.` : draftingState === 'GENERATING' ? 'Đang tạo tệp từ dữ liệu hiện tại. Vui lòng chờ kết quả.' : draftingState === 'READY' ? 'Tệp đã sinh; mở vùng soát xét để kiểm tra định danh, dữ liệu và thao tác gắn hồ sơ.' : draftingState === 'CONFIRMED' ? 'Tệp đã được người dùng xác nhận đã soát xét; tiếp tục thao tác gắn vào đúng mục hồ sơ.' : draftingState === 'ATTACHED' ? 'Tài liệu đã được gắn vào hồ sơ. Có thể quay về hồ sơ để tiếp tục node.' : errorMessage || message || 'Có thể tiếp tục nhập dữ liệu hoặc lưu bản nháp.'} metadata={<><span className="max-w-full break-words rounded-md border border-current/15 bg-white/70 px-2 py-1">Hồ sơ: {sourceLabel}</span><span className="max-w-full break-words rounded-md border border-current/15 bg-white/70 px-2 py-1">Tài liệu: {templateLabel}</span></>} />
      {/* Responsive parity token: xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside data-testid="pcn-document-navigation" aria-label="Điều hướng tài liệu trong hồ sơ PCN" className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2"><FolderOpen size={17} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /><div className="min-w-0"><h2 className="text-[13px] font-black text-slate-900">Điều hướng tài liệu hồ sơ</h2><p className="mt-1 text-[11px] leading-4 text-slate-500">Mở đúng chứng từ trong hồ sơ; phiên soạn nằm ngay dưới tài liệu tương ứng.</p></div></div>
          {!source.dossier && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5"><PcnCatalogCombobox id="pcn-draft-source" label="Chọn hồ sơ / Đề nghị" value={sourceKey} options={sourceOptions} onChange={(nextSourceKey) => { setSourceKey(nextSourceKey); hydratedSourceRef.current = ''; setDraftId(undefined); setSelectedRequirementId(''); setValues({}); setAttachedOutputIds([]); setReviewedOutputIds([]); setContextLocked(false); setErrorMessage(''); }} disabled={busy || contextLocked} /><p className="mt-1.5 text-[11px] leading-4 text-amber-900">Hồ sơ được ưu tiên. Khi mở từ node, bối cảnh đã chọn sẵn và ô này bị khóa để tránh gắn nhầm hồ sơ.</p></div>}
          {source.dossier && <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">Hồ sơ đang mở</p><p className="mt-1 break-words text-[14px] font-black text-slate-900">{source.dossier.dossierCode}</p><p className="mt-1 break-words text-[11px] text-slate-600">Chọn tài liệu trong checklist bên dưới.</p>{contextLocked && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-800"><LockKeyhole size={12} aria-hidden="true" /> Bối cảnh từ bước hồ sơ đã được giữ cố định</p>}{!contextLocked && <button type="button" onClick={() => { setSourceKey(''); hydratedSourceRef.current = ''; setDraftId(undefined); setSelectedRequirementId(''); setValues({}); }} className="mobile-touch-target mt-2 min-h-11 items-center gap-1 text-[11px] font-black text-emerald-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><UnlockKeyhole size={12} aria-hidden="true" /> Đổi hồ sơ</button>}</div>}
          {source.dossier && dossierInspection && <section data-testid="pcn-drafting-checklist" aria-label="Checklist tài liệu PCN" className="border-t border-slate-200 pt-3"><div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-black text-slate-800">Checklist tài liệu trong hồ sơ</h3><span className="text-[11px] font-bold text-slate-500">{dossierInspection.summary.present}/{dossierInspection.summary.total}</span></div><p className="mt-1 text-[11px] leading-4 text-slate-500">Chọn tài liệu để mở form; mục không có mẫu dùng Bổ sung tệp ngoại sinh.</p><div className="mt-2 space-y-1.5">{dossierInspection.stations.flatMap((station) => station.items).filter((item, index, all) => all.findIndex((candidate) => candidate.requirement.id === item.requirement.id) === index).map((item) => <div key={item.requirement.id} className={`rounded-lg border p-2.5 transition ${activeRequirement?.id === item.requirement.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100'}`}><button type="button" aria-current={activeRequirement?.id === item.requirement.id ? 'page' : undefined} onClick={() => selectRequirement(item.requirement.id)} className="mobile-touch-target w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><div className="flex items-start justify-between gap-2"><span className="min-w-0 text-[12px] font-bold leading-4 text-slate-700">{item.requirement.name}{item.requirement.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span><span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-black ${checklistStatusClass(item.status)}`}>{checklistStatusLabel(item.status)}</span></div></button><div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500"><details className="text-left"><summary className="cursor-pointer text-[11px] font-bold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">Thông tin kỹ thuật</summary><span className="font-mono text-[11px]">{item.requirement.code}</span></details><span>•</span>{item.status === 'PRESENT' ? <span className="font-bold text-blue-700">Xem tài liệu</span> : FORM_OPTIONS.some((option) => getPcnDraftFormRequirementCode(option.kind) === item.requirement.code) ? <span className="font-bold text-emerald-700">Có mẫu nội bộ</span> : <span className="font-bold text-amber-700">Bổ sung tệp ngoại sinh</span>}</div></div>)}</div></section>}
          {source.dossier && <section className="border-t border-slate-200 pt-3"><div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-black text-slate-800">Phiên soạn của tài liệu này</h3><button type="button" onClick={() => fetchPcnDraftWorkspaces().then(setDrafts)} title="Tải lại phiên soạn" aria-label="Tải lại phiên soạn" className="mobile-touch-target inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><RefreshCw size={13} aria-hidden="true" /></button></div>{relatedDrafts.length === 0 ? <p className="py-3 text-[11px] leading-4 text-slate-400">Chưa có phiên soạn cho tài liệu đang mở.</p> : <div className="mt-2 space-y-1.5">{relatedDrafts.map((draft) => <button type="button" key={draft.id} onClick={() => loadDraft(draft)} className={`w-full rounded-lg border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${draft.id === draftId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200'}`}><div className="truncate text-[12px] font-black text-slate-700">{draft.title}</div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span>{titleForKind(draft.formKind)}</span><span>·</span><span className={`rounded-full border px-1.5 py-0.5 font-bold ${PCN_DOCUMENT_STATUS_CLASSES[draft.outputs?.length ? 'GENERATED' : 'DRAFT']}`}>{draft.outputs?.length ? 'Xem tài liệu' : 'Tiếp tục soạn'}</span></div></button>)}</div>}</section>}
          {!hasSelectedSource && <div data-testid="pcn-drafting-empty" className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[12px] leading-5 text-slate-600">Chưa có hồ sơ trong workspace. Chọn hồ sơ ở trên để mở tài liệu và dữ liệu nguồn.</div>}
        </aside>
        <main className="min-w-0 space-y-4">
          {!hasSelectedSource ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mx-auto max-w-2xl text-center"><FolderOpen size={26} className="mx-auto text-emerald-600" aria-hidden="true" /><h2 className="mt-2 text-[16px] font-black text-slate-950">Chọn hồ sơ để bắt đầu</h2><p className="mt-1 text-[13px] leading-5 text-slate-600">Workspace sẽ tự nạp khách hàng, sản phẩm, dữ liệu PYC/KQTN và tài liệu cần xử lý. Bạn không cần nhập lại dữ liệu đã có.</p><button type="button" onClick={() => document.getElementById('pcn-draft-source')?.focus()} className="mobile-touch-target mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-black text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><FolderOpen size={15} aria-hidden="true" /> Chọn hồ sơ</button></div></section> : <>
            {selectedRequirementHasForm ? <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Biểu mẫu soạn thảo PCN">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-black text-slate-950">{templateLabel}</h2><p className="mt-1 text-[12px] leading-5 text-slate-600">Chỉ ưu tiên nhập các mục còn thiếu; dữ liệu đã xác nhận từ hồ sơ hiển thị ở lớp phụ.</p></div><DraftLifecycleStatus status={documentStatus} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="block text-[12px] font-black text-slate-600">Tên bản soạn</span><input value={title} onChange={(event) => { setTitle(event.target.value); setErrorMessage(''); }} className="mt-1 min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label><label className="block"><span className="block text-[12px] font-black text-slate-600">Loại tài liệu / template</span><select aria-label="Loại tài liệu PCN" value={kind} onChange={(event) => { const next = event.target.value as PcnDraftFormKind; setKind(next); setSelectedRequirementId(dossierRequirements.find((requirement) => requirement.code === getPcnDraftFormRequirementCode(next))?.id || ''); setValues((current) => ({ ...sourceValues, ...current })); setDraftId(undefined); setErrorMessage(''); }} disabled={busy || contextLocked} className="mt-1 min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100">{FORM_OPTIONS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select>{contextLocked && <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700"><LockKeyhole size={12} aria-hidden="true" /> Tự chọn theo deep context</span>}</label></div>
              {contextLocked && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2.5 py-2 text-[11px] text-emerald-900"><span>Đã mở từ hồ sơ/node: {sourceLabel}{activeRequirement ? ` · ${activeRequirement.name}` : ''}.</span><button type="button" onClick={() => setContextLocked(false)} className="inline-flex min-h-10 items-center gap-1 font-black text-emerald-700 underline underline-offset-2"><UnlockKeyhole size={12} aria-hidden="true" /> Cho phép đổi tài liệu</button></div>}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"><p className="text-[11px] leading-4 text-slate-600">Dữ liệu nguồn từ <b>{sourceLabel}</b> được tự điền và readonly mặc định. Chỉ bật chỉnh sửa khi cần hiệu chỉnh bản soạn.</p><button type="button" onClick={() => setAllowSourceEditing((current) => !current)} className="mobile-touch-target inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{allowSourceEditing ? <UnlockKeyhole size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{allowSourceEditing ? 'Khóa lại dữ liệu nguồn' : 'Cho phép sửa dữ liệu nguồn'}</button></div>
              <div data-testid="pcn-draft-field-sections" className="space-y-3">{fieldGroups.map((group) => <DraftingFieldSection key={group.section.key} testId={`pcn-draft-section-${group.section.key}`} title={group.section.label} collapsible defaultOpen={group.missingCount > 0 || group.autoFilledCount < group.fields.length} missingCount={group.missingCount}><div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">{group.fields.map((field) => { const fieldId = `pcn-draft-${field.key}`; const missing = Boolean(field.required && !String(values[field.key] ?? '').trim()); const autoFilled = sourceFieldKeys.has(field.key); const readOnly = autoFilled && !allowSourceEditing; const inputClass = `mt-1 min-h-11 w-full rounded-md border px-2.5 py-2 text-[13px] outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100 ${missing ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'} ${readOnly ? 'cursor-default bg-slate-100 text-slate-600' : 'bg-white'}`; return <label key={field.key} htmlFor={fieldId} className={`block min-w-0 ${field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-2' : ''} ${missing ? 'scroll-mt-24 scroll-mb-28' : ''}`}><span className="block text-[12px] font-black text-slate-600">{field.label}{field.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{field.type === 'textarea' ? <textarea id={fieldId} required={field.required} aria-required={field.required || undefined} aria-invalid={missing || undefined} readOnly={readOnly} rows={2} value={String(values[field.key] ?? '')} onChange={(event) => updateValue(field.key, event.target.value)} className={`${inputClass} leading-5`} /> : field.type === 'date' ? <PgdcnDateInput id={fieldId} required={field.required} aria-required={field.required || undefined} aria-invalid={missing || undefined} readOnly={readOnly} value={String(values[field.key] ?? '')} onChange={(value) => updateValue(field.key, value)} className={inputClass} /> : <input id={fieldId} required={field.required} aria-required={field.required || undefined} aria-invalid={missing || undefined} readOnly={readOnly} type="text" value={String(values[field.key] ?? '')} onChange={(event) => updateValue(field.key, event.target.value)} className={inputClass} />}{autoFilled && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{readOnly ? 'Tự điền từ hồ sơ · readonly' : 'Giá trị nguồn · đang cho phép hiệu chỉnh'}</span>}{missing && <span className="mt-1 block text-[11px] font-bold leading-4 text-amber-800">Bắt buộc: bổ sung trước khi sinh tài liệu.</span>}</label>; })}</div></DraftingFieldSection>)}</div>
              <DraftingStickyActionBar testId="pcn-drafting-actions" accent="emerald" metadata={<span>Hồ sơ <b>{sourceLabel}</b> · {template ? `Mẫu ${template.displayName}` : 'chưa có mẫu vận hành'}</span>}>
                {draftingState === 'EMPTY' && <button type="button" onClick={() => document.getElementById('pcn-draft-source')?.focus()} disabled={busy} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-black text-white disabled:opacity-50"><FolderOpen size={14} aria-hidden="true" /> Chọn hồ sơ</button>}
                {draftingState === 'BLOCKED' && <button type="button" onClick={focusFirstMissingField} disabled={busy || readinessIssues.length === 0} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[13px] font-black text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">Đi tới trường còn thiếu</button>}
                {(draftingState === 'EDITING' || draftingState === 'SAVED' || draftingState === 'ERROR') && <><button type="button" onClick={() => void save()} disabled={busy} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Save size={13} aria-hidden="true" /> Lưu bản nháp</button><button type="button" onClick={() => void generate()} disabled={busy || !template || !validation.valid} title={!template ? 'Chưa có mẫu phù hợp' : !validation.valid ? 'Bổ sung các trường bắt buộc trước khi tạo tệp' : undefined} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={14} aria-hidden="true" /> Lưu & sinh DOCX + PDF</button></>}
                {draftingState === 'GENERATING' && <button type="button" disabled className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[13px] font-black text-white disabled:cursor-wait disabled:opacity-70"><Sparkles size={14} aria-hidden="true" /> Đang sinh tài liệu…</button>}
                {draftingState === 'READY' && <button type="button" onClick={focusOutputReview} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-black text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> Soát xét tài liệu</button>}
                {draftingState === 'CONFIRMED' && preferredOutput && <button type="button" onClick={() => void confirmOutput(preferredOutput.id)} disabled={busy || !activeRequirement || !source.dossier} title={!activeRequirement || !source.dossier ? 'Cần hồ sơ và mục checklist để gắn tài liệu' : busy ? 'Đang xử lý thao tác trước đó' : undefined} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-black text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> Xác nhận & gắn hồ sơ</button>}
                {draftingState === 'ATTACHED' && <button type="button" onClick={returnToDossier} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[13px] font-black text-white hover:bg-emerald-600"><ArrowLeft size={14} aria-hidden="true" /> Quay lại hồ sơ</button>}
              </DraftingStickyActionBar>
              {message && <div role={errorMessage ? 'alert' : 'status'} className={`rounded-md px-2.5 py-2 text-[12px] font-bold ${errorMessage ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'}`}>{message}</div>}
            </section> : <section data-testid="pcn-drafting-template-missing" className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><h2 className="text-[15px] font-black text-amber-950">Chưa cấu hình mẫu cho tài liệu này</h2><p className="mt-2 text-[12px] leading-5 text-amber-900">Mục hồ sơ này chưa có mẫu soạn thảo nội bộ. Hãy dùng <b>Bổ sung tệp</b> để đính kèm tài liệu đã có; workspace không mở biểu mẫu trống.</p>{source.dossier && <button type="button" onClick={returnToDossier} className="mobile-touch-target mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-[12px] font-black text-white hover:bg-amber-600"><ArrowLeft size={14} aria-hidden="true" /> Bổ sung tệp ngoại sinh</button>}</section>}
            {currentOutputs.length > 0 && <div id="pcn-drafting-outputs"><DraftingOutputReviewShell testId="pcn-drafting-outputs" accent="emerald" title="Soát xét & kết quả" description="Kiểm tra định danh tài liệu và nguồn hồ sơ trước khi xác nhận, rồi gắn vào đúng requirement."><div data-testid="pcn-drafting-review-context" className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-black text-emerald-900">Soát xét trước khi gắn</p><p className="mt-1 text-[11px] leading-4 text-emerald-800">Định danh: <b>{templateLabel}</b> · nguồn hồ sơ <b>{sourceLabel}</b> · khách hàng <b>{customerLabel}</b> · sản phẩm <b>{productLabel}</b>.</p></div><span className="shrink-0 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-black text-emerald-800">Trạng thái: Đủ dữ liệu</span></div><p className="mt-2 text-[11px] leading-4 text-emerald-800">Mục hồ sơ đích: <b>{activeRequirement?.name || 'Chưa ánh xạ'}</b>{source.dossier ? ` · hồ sơ ${source.dossier.dossierCode}` : ' · cần hồ sơ để gắn'}</p></div><div className="mt-3 space-y-2">{currentOutputs.map((output) => { const outputAttached = attachedOutputIdSet.has(output.id); const outputConfirmed = outputAttached || reviewedOutputIds.includes(output.id); const outputStatus: PcnDocumentUiStatus = outputAttached ? 'ATTACHED' : outputConfirmed ? 'CONFIRMED' : 'GENERATED'; return <article key={output.id} data-testid={`pcn-draft-output-${output.id}`} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-[13px] font-black text-slate-800">{output.fileName}</p><details className="mt-1 text-[11px] text-slate-500"><summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">Thông tin tệp</summary><p className="mt-1">{output.format} · {output.byteSize} byte · sinh lúc {output.generatedAt}</p></details></div><span className={`rounded-full border px-2 py-1 text-[11px] font-black ${PCN_DOCUMENT_STATUS_CLASSES[outputStatus]}`}>{PCN_DOCUMENT_STATUS_LABELS[outputStatus]}</span></div><div className="mt-3 flex flex-wrap gap-2"><a href={getPcnFileUrl(output.fileAssetId)} target="_blank" rel="noreferrer" className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><FileDown size={14} aria-hidden="true" /> Mở tệp</a>{!outputConfirmed && <button type="button" onClick={() => reviewOutput(output.id)} disabled={busy} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-black text-teal-800 hover:bg-teal-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> Xác nhận đã soát xét</button>}{outputConfirmed && !outputAttached && <button type="button" onClick={() => void confirmOutput(output.id)} disabled={busy || !activeRequirement || !source.dossier} title={!activeRequirement || !source.dossier ? 'Cần hồ sơ và mục checklist để gắn tài liệu' : busy ? 'Đang xử lý thao tác trước đó' : undefined} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> {busyAction === 'CONFIRM' ? 'Đang gắn…' : 'Xác nhận & gắn vào bộ hồ sơ'}</button>}{outputAttached && <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-800"><CheckCircle2 size={14} aria-hidden="true" /> Đã gắn đúng mục hồ sơ</span>}</div></article>; })}</div></DraftingOutputReviewShell></div>}
          </>}
        </main>
      </div>
    </div>
    {docxSettingsOpen && <PcnDocxSettingsModal templates={managedTemplates} onUploadTemplate={onUploadTemplate} onReviewTemplate={onReviewTemplate} onClose={() => setDocxSettingsOpen(false)} />}
  </>;
}
