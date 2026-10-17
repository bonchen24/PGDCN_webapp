'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import { ArrowLeft, CheckCircle2, FileDown, FilePlus2, LockKeyhole, Settings2, UnlockKeyhole } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdDraftWorkspace, PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdStatusLabel } from '../utils/pgdDomain';
import { fetchPgdDraftWorkspaces, getPgdDossierDocumentDownloadUrl, getPgdDocumentDownloadUrl, savePgdDraftWorkspace } from '../utils/pgdApi';
import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdDocumentTemplateFormat } from '../utils/pgdDocumentTemplates';
import { buildPgdDossierReturnRoute, getPgdDossierStepForRequirement, sanitizeInternalReturnTo } from '../utils/draftingNavigation';
import { getPgdDocumentRequirementCode, getPgdDocumentsForRequirement, hasPgdDeepContext, resolvePgdDraftingContext } from '../utils/pgdDrafting';
import { usePgdStore } from '../store-pgd';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PgdDocumentGenerationPanel, { PGD_DOCUMENT_KIND_LABELS } from './PgdDocumentGenerationPanel';
import { DraftingContextStatusBar, DraftingHeader, DraftingOutputReviewShell, DraftingReadinessPanel, DraftingWorkflowOrientation, type DraftingReadinessIssue, type DraftingState } from './PgdcnDraftingPrimitives';
import { getCurrentPgdDossierDocuments, getPgdDossierRequirementForTemplate, getPgdDossierRequirementStationKey, getPgdDossierRequirements } from '../utils/pgdDossier';

export type PgdDraftSession = PgdDraftWorkspace;

type PgdDraftSaveInput = Pick<PgdDraftSession, 'templateId' | 'format' | 'cellValues'> & { title?: string };

type PgdDraftingWorkspaceViewProps = {
  templates: PgdDocumentTemplate[];
  documents: PgdGeneratedDocument[];
  canMutate: boolean;
  onOpenSettings?: () => void;
  initialRequestId?: string;
  initialRequirementCode?: string;
  initialTemplateKind?: PgdDocumentTemplateKind;
  initialReturnTo?: string;
};

function formatWorkspaceDate(value: string): string {
  return formatDateTimeDdMmYyyy(value) || 'Chưa có thời điểm';
}

function makeDraftId(): string {
  return `pgd-draft-${Date.now().toString(36)}`;
}

function templateTitle(template: PgdDocumentTemplate | undefined): string {
  return template?.name || template?.code || 'Bản soạn PGD';
}

function requestSummary(request: PgdInspectionRequest): string {
  return [request.customerSnapshot.name, request.productName, request.lotCode].filter(Boolean).join(' · ');
}

function checklistStatusLabel(status: 'MISSING' | 'PRESENT' | 'WAIVED'): string {
  return status === 'PRESENT' ? 'Đã xác nhận' : status === 'WAIVED' ? 'Đã miễn' : 'Cần hoàn thiện';
}

function checklistStatusClass(status: 'MISSING' | 'PRESENT' | 'WAIVED'): string {
  return status === 'PRESENT'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'WAIVED'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-rose-200 bg-rose-50 text-rose-700';
}

function documentKindLabel(kind: string): string {
  return PGD_DOCUMENT_KIND_LABELS[kind as PgdDocumentTemplateKind] || kind;
}

type PgdDraftSaveContext = {
  request?: PgdInspectionRequest;
  activeRequirementCode?: string;
  template?: PgdDocumentTemplate;
};

export function requirePgdDraftSaveContext(context: PgdDraftSaveContext): Required<PgdDraftSaveContext> {
  if (!context.request) throw new Error('Không thể lưu bản nháp: chưa chọn hồ sơ/PYC PGD.');
  if (!context.activeRequirementCode) throw new Error('Không thể lưu bản nháp: chưa xác định mục tài liệu trong hồ sơ PGD.');
  if (!context.template) throw new Error('Không thể lưu bản nháp: chưa có biểu mẫu hợp lệ trong danh mục PGD.');
  return {
    request: context.request,
    activeRequirementCode: context.activeRequirementCode,
    template: context.template,
  };
}

export function confirmPgdDraftTitleDiscard(
  currentTitle: string,
  savedOrLoadedTitle: string,
  confirmDiscard: (message: string) => boolean,
): boolean {
  if (currentTitle === savedOrLoadedTitle) return true;
  return confirmDiscard('Tên bản soạn đã thay đổi kể từ lần lưu hoặc nạp gần nhất. Bạn có muốn tiếp tục và bỏ thay đổi tiêu đề này không?');
}

export function confirmPgdDraftContextSwitch(
  currentTitle: string,
  savedOrLoadedTitle: string,
  documentDirty: boolean,
  confirmDiscard: (message: string) => boolean,
): boolean {
  if (currentTitle === savedOrLoadedTitle && !documentDirty) return true;
  return confirmDiscard('Tiêu đề hoặc nội dung tài liệu đã thay đổi kể từ lần lưu hoặc nạp gần nhất. Bạn có muốn tiếp tục và bỏ các thay đổi này không?');
}

const PGD_WORKSPACE_STATE_LABELS: Record<DraftingState, string> = {
  EMPTY: 'Chưa chọn hồ sơ hoặc biểu mẫu',
  EDITING: 'Đang soạn tài liệu',
  SAVED: 'Đã lưu bản soạn',
  GENERATING: 'Đang sinh tài liệu',
  READY: 'Đã sinh, chờ soát xét',
  CONFIRMED: 'Đã xác nhận, chờ gắn hồ sơ',
  ATTACHED: 'Đã gắn vào hồ sơ',
  BLOCKED: 'Cần bổ sung dữ liệu hoặc mẫu',
  ERROR: 'Có lỗi, cần thử lại',
};

export default function PgdDraftingWorkspaceView({ templates, documents, canMutate, onOpenSettings, initialRequestId, initialRequirementCode, initialTemplateKind, initialReturnTo }: PgdDraftingWorkspaceViewProps) {
  const requests = usePgdStore((state) => state.requests.filter((request) => !request.deletedAt));
  const isLoaded = usePgdStore((state) => state.isLoaded);
  const dossierDocuments = usePgdStore((state) => state.dossierDocuments);
  const fetchDossierDocuments = usePgdStore((state) => state.fetchDossierDocuments);
  const [requestId, setRequestId] = useState(initialRequestId || '');
  const [draftId, setDraftId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState('');
  const savedOrLoadedTitleRef = useRef('');
  const draftDirtyRef = useRef(false);
  const [templateId, setTemplateId] = useState('');
  const [selectedRequirementCode, setSelectedRequirementCode] = useState(initialRequirementCode || '');
  const [draftPanelRevision, setDraftPanelRevision] = useState(0);
  const [drafts, setDrafts] = useState<PgdDraftSession[]>([]);
  const [checklistError, setChecklistError] = useState('');
  const [contextUnlocked, setContextUnlocked] = useState(false);
  const [reviewedDocumentIds, setReviewedDocumentIds] = useState<string[]>([]);
  const [attachingDocumentId, setAttachingDocumentId] = useState<string>();
  const [generationState, setGenerationState] = useState<{ state: DraftingState; stateLabel: string; message: string; issues: DraftingReadinessIssue[] }>({ state: 'EMPTY', stateLabel: 'Chưa chọn biểu mẫu', message: 'Chọn hồ sơ và biểu mẫu để bắt đầu.', issues: [] });
  const [focusReviewAfterGenerate, setFocusReviewAfterGenerate] = useState(false);
  const [routeReturnTo] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') || undefined : undefined);

  const deepContextProvided = hasPgdDeepContext({ requestId: initialRequestId, requirementCode: initialRequirementCode, templateKind: initialTemplateKind });
  const contextLocked = deepContextProvided && !contextUnlocked;
  const catalogTemplates = useMemo(() => {
    const source = templates.length > 0 ? templates : getPgdDocumentTemplates();
    return source.filter((template) => template.active && template.status !== 'RETIRED');
  }, [templates]);
  const sourceOptions = useMemo<PcnCatalogOption[]>(() => requests.map((request) => ({
    value: request.id,
    label: `${request.requestCode} · ${request.productName}`,
    description: requestSummary(request),
    searchText: [request.requestCode, request.customerSnapshot.name, request.productName, request.lotCode, request.inspectionLocation].filter(Boolean).join(' '),
  })), [requests]);
  const request = requests.find((item) => item.id === requestId);
  const availableTemplates = useMemo(() => catalogTemplates.filter((template) => template.productGroups.includes(request?.productGroup || 'OTHER')), [catalogTemplates, request?.productGroup]);
  const requirements = useMemo(() => request ? getPgdDossierRequirements(request.productGroup) : [], [request?.productGroup]);
  const currentDossierDocuments = useMemo(() => getCurrentPgdDossierDocuments(dossierDocuments.filter((document) => document.requestId === request?.id)), [dossierDocuments, request?.id]);
  const checklistByCode = useMemo(() => new Map((request?.dossierChecklist || []).map((item) => [item.requirementCode, item])), [request?.dossierChecklist]);
  const templateOptions = useMemo(() => {
    const byKind = new Map<string, PgdDocumentTemplate>();
    for (const template of availableTemplates) {
      if (!byKind.has(template.kind)) byKind.set(template.kind, template);
    }
    return [...byKind.values()];
  }, [availableTemplates]);
  const activeDraft = drafts.find((draft) => draft.id === draftId && draft.requestId === requestId);
  const resolvedContext = useMemo(() => resolvePgdDraftingContext({
    request,
    requirements,
    templates: availableTemplates,
    selectedRequirementCode,
    templateId,
    initialRequirementCode,
    initialTemplateKind,
    activeDraft,
  }), [activeDraft, availableTemplates, initialRequirementCode, initialTemplateKind, request, requirements, selectedRequirementCode, templateId]);
  const selectedTemplate = resolvedContext.selectedTemplate;
  const deepRequirement = initialRequirementCode ? requirements.find((item) => item.code === initialRequirementCode) : undefined;
  const deepTemplate = initialTemplateKind ? availableTemplates.find((template) => template.kind === initialTemplateKind) : undefined;
  const deepRequirementTemplate = resolvedContext.requirementTemplate;
  const isDeepContextRequest = Boolean(request && (!initialRequestId || request.id === initialRequestId));
  const deepContextUnavailable = Boolean(request && isDeepContextRequest && resolvedContext.invalidDeepContext);
  const activeRequirementCode = resolvedContext.activeRequirementCode;
  const handleDraftDirtyChange = useCallback((dirty: boolean) => {
    draftDirtyRef.current = dirty;
  }, []);
  const confirmContextSwitch = () => confirmPgdDraftContextSwitch(
    draftTitle,
    savedOrLoadedTitleRef.current,
    draftDirtyRef.current,
    (message) => typeof window !== 'undefined' && window.confirm(message),
  );
  const selectedDocuments = useMemo(() => request && activeRequirementCode
    ? getPgdDocumentsForRequirement({ documents, requestId: request.id, requirementCode: activeRequirementCode, productGroup: request.productGroup })
    : [], [activeRequirementCode, documents, request]);
  const attachedDocumentIds = useMemo(() => new Set(currentDossierDocuments.map((document) => document.originDocumentId).filter(Boolean)), [currentDossierDocuments]);
  const hasReviewOutput = selectedDocuments.length > 0;
  const hasAttachedOutput = Boolean(activeRequirementCode && currentDossierDocuments.some((document) => document.requirementCode === activeRequirementCode));
  const workspaceState: DraftingState = !request
    ? 'EMPTY'
    : generationState.state === 'GENERATING'
      ? 'GENERATING'
      : generationState.state === 'ERROR'
        ? 'ERROR'
        : hasAttachedOutput
          ? 'ATTACHED'
          : hasReviewOutput
            ? 'READY'
            : !selectedTemplate
              ? 'BLOCKED'
              : generationState.state === 'BLOCKED'
                ? 'BLOCKED'
                : activeDraft || generationState.state === 'SAVED'
                  ? 'SAVED'
                  : 'EDITING';
  const documentUiState = PGD_WORKSPACE_STATE_LABELS[workspaceState];
  const workspaceReadinessMessage = workspaceState === 'EMPTY'
    ? 'Chọn một hồ sơ PGD để nạp checklist và dữ liệu nguồn.'
    : workspaceState === 'BLOCKED'
      ? generationState.message || 'Bổ sung dữ liệu bắt buộc hoặc chọn mẫu phù hợp trước khi sinh tài liệu.'
      : workspaceState === 'GENERATING'
        ? 'Đang tạo tệp từ dữ liệu đã kiểm tra. Vui lòng chờ kết quả.'
        : workspaceState === 'ERROR'
          ? generationState.message
          : workspaceState === 'READY'
            ? 'Tài liệu đã sinh. Mở vùng soát xét để kiểm tra trước khi gắn vào đúng mục hồ sơ.'
            : workspaceState === 'ATTACHED'
              ? 'Tài liệu đã được xác nhận và gắn vào đúng mục hồ sơ.'
              : generationState.message || 'Kiểm tra các trường còn thiếu rồi lưu hoặc sinh tài liệu.';
  const draftingActiveStep: 1 | 2 | 3 | 4 = !request ? 1 : activeRequirementCode && currentDossierDocuments.some((document) => document.requirementCode === activeRequirementCode) ? 4 : hasReviewOutput ? 3 : 2;
  const draftingCompletedThrough: 0 | 1 | 2 | 3 | 4 = draftingActiveStep === 1 ? 0 : draftingActiveStep === 2 ? 1 : draftingActiveStep === 3 ? 2 : 3;

  const returnToDossier = () => {
    if (typeof window === 'undefined') return;
    if (!confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    const target = sanitizeInternalReturnTo(initialReturnTo || routeReturnTo) || (request ? buildPgdDossierReturnRoute(request.id, { step: activeRequirementCode ? getPgdDossierStepForRequirement(activeRequirementCode) : undefined }) : '/pgdcn/pgd');
    window.location.replace(target);
  };

  const focusOutputReview = useCallback(() => {
    const output = document.getElementById('pgd-drafting-outputs');
    output?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    output?.focus({ preventScroll: true });
  }, []);

  const focusPgdField = useCallback((key: string) => {
    const field = document.getElementById(`pgd-document-${key}`) || document.querySelector<HTMLElement>(`[data-pgd-field="${key}"]`);
    if (!field) return;
    const details = field.closest('details');
    if (details) details.open = true;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => field.focus({ preventScroll: true }), 100);
  }, []);

  const handleGenerationStateChange = useCallback((next: { state: DraftingState; stateLabel: string; message: string; issues: DraftingReadinessIssue[] }) => {
    setGenerationState(next);
  }, []);

  const handleGenerated = useCallback(() => setFocusReviewAfterGenerate(true), []);

  useEffect(() => {
    if (!focusReviewAfterGenerate || !hasReviewOutput) return;
    const frame = window.requestAnimationFrame(() => {
      focusOutputReview();
      setFocusReviewAfterGenerate(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOutputReview, focusReviewAfterGenerate, hasReviewOutput]);

  useEffect(() => {
    if (requestId && !request && isLoaded) {
      setRequestId('');
      setDraftId(undefined);
      setDraftTitle('');
      savedOrLoadedTitleRef.current = '';
      setTemplateId('');
      setSelectedRequirementCode('');
    }
  }, [isLoaded, request, requestId]);

  useEffect(() => {
    if (!request) {
      setChecklistError('');
      return;
    }
    let cancelled = false;
    void fetchDossierDocuments(request.id).then(() => {
      if (!cancelled) setChecklistError('');
    }).catch((error: any) => {
      if (!cancelled) setChecklistError(error?.message || 'Không tải được checklist hồ sơ PGD.');
    });
    return () => { cancelled = true; };
  }, [fetchDossierDocuments, request?.id]);

  useEffect(() => {
    if (!request) {
      setDrafts([]);
      setDraftId(undefined);
      return;
    }
    let cancelled = false;
    setDrafts([]);
    setDraftId(undefined);
    void fetchPgdDraftWorkspaces(request.id).then((items) => {
      if (!cancelled) setDrafts(items);
    }).catch((error: any) => {
      if (!cancelled) setChecklistError(error?.message || 'Không tải được bản nháp PGD đã lưu.');
    });
    return () => { cancelled = true; };
  }, [request?.id]);

  useEffect(() => {
    if (!initialRequestId) return;
    setRequestId(initialRequestId);
    setDraftId(undefined);
    setDraftTitle('');
    savedOrLoadedTitleRef.current = '';
    setTemplateId('');
    setSelectedRequirementCode(initialRequirementCode || '');
    setContextUnlocked(false);
  }, [initialRequestId, initialRequirementCode, initialTemplateKind]);

  useEffect(() => {
    if (!request || activeDraft || !isDeepContextRequest || contextUnlocked) return;
    const nextTemplate = deepTemplate || deepRequirementTemplate;
    setTemplateId(nextTemplate?.id || (initialTemplateKind || initialRequirementCode ? '' : availableTemplates[0]?.id || ''));
    setSelectedRequirementCode(deepRequirement?.code || (nextTemplate ? getPgdDossierRequirementForTemplate(nextTemplate.kind, request.productGroup)?.code || '' : ''));
  }, [activeDraft, availableTemplates, contextUnlocked, deepRequirement, deepRequirementTemplate, deepTemplate, initialRequirementCode, initialTemplateKind, isDeepContextRequest, request]);

  useEffect(() => {
    if (activeDraft) {
      setDraftTitle(activeDraft.title);
      savedOrLoadedTitleRef.current = activeDraft.title;
      setTemplateId(activeDraft.templateId);
      const draftTemplate = catalogTemplates.find((template) => template.id === activeDraft.templateId);
      setSelectedRequirementCode(draftTemplate && request ? getPgdDossierRequirementForTemplate(draftTemplate.kind, request.productGroup)?.code || '' : '');
      return;
    }
    if (request && !contextLocked && !deepContextUnavailable && (!selectedRequirementCode || availableTemplates.some((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === selectedRequirementCode)) && !availableTemplates.some((template) => template.id === templateId)) {
      const fallback = initialTemplateKind ? availableTemplates.find((template) => template.kind === initialTemplateKind) : availableTemplates[0];
      setTemplateId(fallback?.id || '');
      setSelectedRequirementCode(fallback && request ? getPgdDossierRequirementForTemplate(fallback.kind, request.productGroup)?.code || '' : '');
    }
  }, [activeDraft, availableTemplates, catalogTemplates, contextLocked, deepContextUnavailable, initialTemplateKind, request, templateId]);

  useEffect(() => {
    setReviewedDocumentIds([]);
  }, [request?.id]);

  const loadDraft = (draft: PgdDraftSession) => {
    if (draft.id === draftId && draft.requestId === requestId) return;
    if (!confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    setContextUnlocked(true);
    setDraftId(draft.id);
    setRequestId(draft.requestId);
    setDraftTitle(draft.title);
    savedOrLoadedTitleRef.current = draft.title;
    setTemplateId(draft.templateId);
    setSelectedRequirementCode(draft.requirementCode);
  };

  const newDraft = () => {
    if (!confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    setDraftPanelRevision((revision) => revision + 1);
    savedOrLoadedTitleRef.current = '';
    if (hasPgdDeepContext({ requestId: initialRequestId, requirementCode: initialRequirementCode, templateKind: initialTemplateKind }) && request) {
      const preservedTemplate = deepTemplate || deepRequirementTemplate || selectedTemplate;
      setContextUnlocked(false);
      setDraftId(undefined);
      setDraftTitle('');
      setTemplateId(preservedTemplate?.id || '');
      setSelectedRequirementCode(initialRequirementCode || (preservedTemplate ? getPgdDossierRequirementForTemplate(preservedTemplate.kind, request.productGroup)?.code || '' : ''));
      return;
    }
    setContextUnlocked(true);
    setDraftId(undefined);
    setRequestId('');
    setDraftTitle('');
    setTemplateId('');
    setSelectedRequirementCode('');
  };

  const handleRequestChange = (nextRequestId: string) => {
    if (contextLocked) return;
    if (nextRequestId === requestId || !confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    setDraftPanelRevision((revision) => revision + 1);
    const nextRequest = requests.find((item) => item.id === nextRequestId);
    setRequestId(nextRequestId);
    setDraftId(undefined);
    setDraftTitle('');
    savedOrLoadedTitleRef.current = '';
    const nextTemplate = catalogTemplates.find((template) => template.productGroups.includes(nextRequest?.productGroup || 'OTHER'));
    setTemplateId(nextTemplate?.id || '');
    setSelectedRequirementCode(nextTemplate && nextRequest ? getPgdDossierRequirementForTemplate(nextTemplate.kind, nextRequest.productGroup)?.code || '' : '');
  };

  const handleTemplateChange = (nextTemplateId: string) => {
    if (contextLocked) return;
    if (nextTemplateId === templateId || !confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    setDraftPanelRevision((revision) => revision + 1);
    setTemplateId(nextTemplateId);
    setDraftId(undefined);
    setDraftTitle('');
    savedOrLoadedTitleRef.current = '';
    const nextTemplate = catalogTemplates.find((template) => template.id === nextTemplateId);
    setSelectedRequirementCode(nextTemplate && request ? getPgdDossierRequirementForTemplate(nextTemplate.kind, request.productGroup)?.code || '' : '');
  };

  const selectRequirement = (requirementCode: string) => {
    if (!request || contextLocked) return;
    if (requirementCode === activeRequirementCode || !confirmContextSwitch()) return;
    handleDraftDirtyChange(false);
    setDraftPanelRevision((revision) => revision + 1);
    setSelectedRequirementCode(requirementCode);
    const matchingTemplate = availableTemplates.find((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === requirementCode);
    setTemplateId(matchingTemplate?.id || '');
    setDraftId(undefined);
    setDraftTitle('');
    savedOrLoadedTitleRef.current = '';
  };

  const attachGenerated = async (document: PgdGeneratedDocument) => {
    if (!request) return;
    const documentRequirementCode = getPgdDocumentRequirementCode(document, request.productGroup);
    if (!documentRequirementCode) throw new Error('Tài liệu này chưa có ánh xạ vào checklist PGD.');
    if (document.requestId !== request.id) throw new Error('Tài liệu không thuộc hồ sơ PGD đang mở; không thể gắn.');
    if (!activeRequirementCode || documentRequirementCode !== activeRequirementCode) throw new Error(`Tài liệu thuộc mục ${documentRequirementCode}, không khớp mục hồ sơ đang mở ${activeRequirementCode || 'chưa xác định'}; không thể gắn.`);
    await usePgdStore.getState().attachGeneratedDocument(request.id, { documentId: document.id, requirementCode: activeRequirementCode });
    toast.success(`Đã xác nhận ${document.fileName} vào bộ hồ sơ.`);
  };

  const saveDraft = async (input: PgdDraftSaveInput) => {
    const template = catalogTemplates.find((candidate) => candidate.id === input.templateId);
    let saveContext: Required<PgdDraftSaveContext>;
    try {
      saveContext = requirePgdDraftSaveContext({ request, activeRequirementCode, template });
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu bản nháp PGD.');
      throw error;
    }
    const { request: saveRequest, activeRequirementCode: saveRequirementCode, template: saveTemplate } = saveContext;
    const nextDraft: PgdDraftSession = {
      id: draftId || makeDraftId(),
      domain: 'pgd',
      requestId: saveRequest.id,
      requirementCode: saveRequirementCode,
      title: input.title?.trim() || `${saveRequest.requestCode} · ${templateTitle(saveTemplate)}`,
      templateId: input.templateId,
      templateKind: saveTemplate.kind,
      templateVersion: saveTemplate.version,
      format: input.format,
      cellValues: input.cellValues,
      createdAt: activeDraft?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'DRAFT',
    };
    try {
      const saved = await savePgdDraftWorkspace(nextDraft);
      setDrafts((current) => [saved, ...current.filter((draft) => draft.id !== saved.id)]);
      setDraftId(saved.id);
      setDraftTitle(saved.title);
      savedOrLoadedTitleRef.current = saved.title;
      if (!draftId) handleDraftDirtyChange(false);
      toast.success('Đã lưu bản nháp PGD.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu bản nháp PGD.');
      throw error;
    }
  };

  const reviewDocument = (documentId: string) => setReviewedDocumentIds((current) => current.includes(documentId) ? current : [...current, documentId]);

  const attachDocument = async (document: PgdGeneratedDocument) => {
    setAttachingDocumentId(document.id);
    try {
      await attachGenerated(document);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gắn tài liệu vào bộ hồ sơ.');
    } finally {
      setAttachingDocumentId(undefined);
    }
  };

  const templateEmptyMessage = deepContextUnavailable
    ? `Chưa có mẫu PGD phù hợp với bối cảnh đã mở${initialTemplateKind ? ` (${PGD_DOCUMENT_KIND_LABELS[initialTemplateKind] || initialTemplateKind})` : ''}.`
    : 'Chưa có mẫu PGD đang hoạt động cho nhóm sản phẩm / đối tượng này.';

  return <div data-testid="pgd-drafting-workspace" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 mobile-safe-bottom md:p-5">
    <DraftingHeader domain="PGD" testId="pgd-drafting-header" title="Soạn thảo tài liệu PGD" description="Bắt đầu từ đúng hồ sơ, kiểm tra dữ liệu còn thiếu, soạn và sinh tài liệu, soát xét rồi gắn vào mục hồ sơ." actions={<>
      {request && <button type="button" onClick={returnToDossier} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[12px] font-black text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowLeft size={14} aria-hidden="true" /> Quay lại hồ sơ</button>}
      {onOpenSettings && <button type="button" onClick={onOpenSettings} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[12px] font-black text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Settings2 size={14} aria-hidden="true" /> Cài đặt DOCX</button>}
      <button type="button" onClick={newDraft} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-black text-white shadow-sm hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><FilePlus2 size={14} aria-hidden="true" /> Bản soạn mới</button>
    </>} />
    <DraftingWorkflowOrientation activeStep={draftingActiveStep} completedThrough={draftingCompletedThrough} accent="blue" testId="pgd-drafting-orientation" />
    <DraftingContextStatusBar domain="PGD" testId="pgd-drafting-context-status" sourceLabel={request ? `${request.requestCode} · ${request.customerSnapshot.name}` : 'Chưa chọn PYC hoặc hồ sơ nguồn'} documentLabel={selectedTemplate ? `${selectedTemplate.name} · ${selectedTemplate.code} · v${selectedTemplate.version}` : 'Chưa có mẫu phù hợp'} statusLabel={request ? `Hồ sơ: ${getPgdStatusLabel(request.status)} · ${documentUiState}` : 'Chưa có bối cảnh'} description="Mã PYC, khách hàng, sản phẩm/đối tượng và trạng thái hồ sơ được giữ trong bối cảnh hiện tại." metadata={request ? <span className="max-w-full break-words rounded-md border border-blue-200 bg-white/80 px-2 py-1 text-blue-800">Sản phẩm / đối tượng: {request.productName}</span> : null} advancedMetadata={<><div><span className="text-slate-400">Mã mục hồ sơ:</span> <span className="font-mono text-slate-700">{activeRequirementCode || 'Chưa ánh xạ'}</span></div><div><span className="text-slate-400">Trạm nghiệp vụ:</span> <span className="font-mono text-slate-700">{activeRequirementCode ? getPgdDossierRequirementStationKey(activeRequirementCode) : 'Chưa xác định'}</span></div><div><span className="text-slate-400">Template:</span> <span className="font-mono text-slate-700">{selectedTemplate ? `${selectedTemplate.id} · v${selectedTemplate.version}` : 'Chưa chọn'}</span></div><div><span className="text-slate-400">Persistence:</span> <span className="font-bold text-slate-700">Bản nháp đã lưu</span></div></>} />

    <DraftingReadinessPanel state={workspaceState} stateLabel={PGD_WORKSPACE_STATE_LABELS[workspaceState]} message={workspaceReadinessMessage} issueCount={generationState.issues.length} issues={generationState.issues} onIssueClick={(issue) => focusPgdField(issue.key)} metadata={selectedTemplate ? <span className="max-w-full break-words rounded-md border border-current/15 bg-white/70 px-2 py-1">Biểu mẫu: {selectedTemplate.name}</span> : null} testId="pgd-drafting-readiness" stateTestId="pgd-drafting-state" />

    {/* PCN parity fallback remains a two-region grid: xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]. */}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
      <aside aria-label="Điều hướng tài liệu trong hồ sơ PGD" className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4">
        <div className="flex items-start justify-between gap-2"><div><h2 className="text-[13px] font-black text-slate-800">Bộ hồ sơ & tài liệu</h2><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Điều hướng theo PYC, checklist và phiên soạn.</p></div>{request && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{currentDossierDocuments.length}/{requirements.length}</span>}</div>
        <section aria-label="Phiên soạn PGD" className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5"><div className="flex items-center justify-between gap-2"><div><h3 className="text-[12px] font-black text-blue-950">Phiên soạn / Bản đã lưu</h3><p className="mt-0.5 text-[11px] text-blue-800">Bản nháp đã lưu</p></div><span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-blue-700">{drafts.length}</span></div>{drafts.length === 0 ? <p className="mt-2 rounded-lg border border-dashed border-blue-200 px-2.5 py-3 text-[11px] leading-4 text-blue-900/65">Chưa có bản nháp đã lưu cho mục hồ sơ này.</p> : <div data-testid="pgd-drafting-session-drafts" className="mt-2 space-y-1.5">{drafts.map((draft) => <button type="button" key={draft.id} onClick={() => loadDraft(draft)} className={`mobile-touch-target min-h-11 w-full min-w-0 rounded-lg border p-2 text-left transition ${draft.id === draftId ? 'border-blue-300 bg-white' : 'border-blue-100 bg-white/70 hover:border-blue-300'}`}><div className="break-words text-[12px] font-black text-slate-700">{draft.title}</div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span>{draft.format} · {formatWorkspaceDate(draft.updatedAt)}</span><span className="font-bold text-blue-700">Tiếp tục soạn</span></div></button>)}</div>}</section>
        <section data-testid="pgd-drafting-checklist" className="border-t border-slate-100 pt-3" aria-label="Checklist tài liệu PGD"><div className="flex items-start justify-between gap-2"><div><h3 className="text-[12px] font-black text-slate-800">Checklist tài liệu trong hồ sơ</h3><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Chọn một tài liệu để mở đúng form và mục hồ sơ.</p></div></div>{!request ? <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-3 text-[11px] leading-4 text-slate-400">Chọn PYC/hồ sơ nguồn để nạp checklist.</p> : <div className="mt-2 space-y-1.5">{requirements.map((requirement) => {
          const currentDocument = currentDossierDocuments.find((document) => document.requirementCode === requirement.code);
          const checklistItem = checklistByCode.get(requirement.code);
          const status = currentDocument ? 'PRESENT' : checklistItem?.status === 'WAIVED' ? 'WAIVED' : 'MISSING';
          const matchingTemplate = availableTemplates.find((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === requirement.code);
          const selected = activeRequirementCode === requirement.code;
          return <div key={requirement.code} className={`rounded-lg border p-2 ${selected ? 'border-blue-300 bg-blue-50/60' : 'border-slate-100 bg-slate-50/60'}`}><button type="button" onClick={() => selectRequirement(requirement.code)} disabled={contextLocked} className={`mobile-touch-target flex min-h-10 w-full items-start gap-2 text-left ${contextLocked ? 'cursor-not-allowed opacity-80' : ''}`} aria-current={selected ? 'step' : undefined}><span className={`mt-0.5 inline-flex shrink-0 rounded-md border px-1.5 py-1 text-[11px] font-black ${checklistStatusClass(status)}`}>{checklistStatusLabel(status)}</span><span className="min-w-0 flex-1"><span className="block break-words text-[12px] font-black text-slate-700">{requirement.title}{requirement.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span></span></button><details className="mt-0.5 text-[11px] text-slate-500"><summary className="cursor-pointer text-[11px] font-bold text-slate-400">Thông tin kỹ thuật</summary><span className="font-mono">{requirement.code} · {getPgdDossierRequirementStationKey(requirement.code)}</span></details><div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 pl-0.5 text-[11px]"><span className="text-slate-500">{matchingTemplate ? 'Soạn tài liệu' : 'Bổ sung tệp'}</span>{currentDocument?.fileAssetId && <a href={getPgdDossierDocumentDownloadUrl(currentDocument.id)} target="_blank" rel="noreferrer" download={currentDocument.fileName} className="font-black text-blue-700 underline">Xem tài liệu</a>}<span className={`font-bold ${status === 'PRESENT' ? 'text-emerald-700' : 'text-amber-700'}`}>{status === 'PRESENT' ? 'Xem tài liệu' : matchingTemplate ? 'Soạn tài liệu' : 'Bổ sung tệp'}</span></div></div>;
        })}</div>}{checklistError && <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800">{checklistError}</p>}</section>
        {contextLocked && <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-2.5 py-2 text-[11px] leading-4 text-emerald-900"><p className="flex items-center gap-1 font-bold"><LockKeyhole size={13} aria-hidden="true" /> Hồ sơ và mục tài liệu được giữ theo đường dẫn đã mở.</p>{canMutate && <button type="button" onClick={() => setContextUnlocked(true)} title="Cho phép chọn hồ sơ hoặc tài liệu khác trong phiên này" className="mt-1 inline-flex min-h-9 items-center gap-1 font-black text-emerald-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><UnlockKeyhole size={12} aria-hidden="true" /> Cho phép đổi bối cảnh</button>}</div>}
      </aside>

      <main className="min-w-0"><section data-testid="pgd-drafting-form" className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Form soạn thảo tài liệu PGD"><div className="grid gap-2 sm:grid-cols-2"><label><span className="block text-[12px] font-black text-slate-600">Tên bản soạn</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} disabled={!canMutate} className="mt-1 min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-blue-400 disabled:bg-slate-50" /></label><label><span className="block text-[12px] font-black text-slate-600">Loại tài liệu {contextLocked ? '(tự chọn theo bối cảnh)' : ''}</span><select aria-label="Loại tài liệu PGD" value={templateId} onChange={(event) => handleTemplateChange(event.target.value)} disabled={!canMutate || !request || contextLocked} className="mt-1 min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none focus:border-blue-400 disabled:bg-slate-50">{!templateId && <option value="">Chưa có mẫu phù hợp</option>}{templateOptions.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.code} · v{template.version}</option>)}</select></label></div>
        <section data-testid="pgd-drafting-context" className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5" aria-label="Nguồn hồ sơ PGD"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-[13px] font-black text-slate-800">{contextLocked ? 'Bối cảnh hồ sơ đã mở sẵn' : 'Hồ sơ nguồn'}</h2><p className="mt-0.5 text-[12px] leading-5 text-slate-600">{contextLocked ? 'PYC, mục tài liệu và biểu mẫu được giữ theo đường dẫn nghiệp vụ.' : 'Chọn một PYC/hồ sơ; dữ liệu phù hợp sẽ tự điền vào biểu mẫu.'}</p></div></div><div className="mt-2"><PcnCatalogCombobox id="pgd-draft-source" label="Chọn hồ sơ PGD" hideLabel value={requestId} options={sourceOptions} onChange={handleRequestChange} disabled={Boolean(initialRequestId) && !contextUnlocked} /></div></section>
      {request ? deepContextUnavailable || !selectedTemplate ? <section data-testid="pgd-drafting-no-template" className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-6 text-center"><div className="mx-auto max-w-xl"><h2 className="text-[16px] font-black text-amber-950">Không có mẫu phù hợp</h2><p className="mt-2 text-[13px] leading-5 text-amber-900">{templateEmptyMessage} Không thể sinh tài liệu cho tới khi có biểu mẫu đúng nhóm sản phẩm và mục hồ sơ. Nếu đã có tệp do bên ngoài cung cấp, hãy dùng đúng luồng bổ sung ngoại sinh của hồ sơ này.</p>{request && <button type="button" onClick={returnToDossier} title="Quay về đúng hồ sơ và mục tài liệu để bổ sung tệp ngoại sinh" className="mobile-touch-target mt-4 mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-[13px] font-black text-white hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"><ArrowLeft size={14} aria-hidden="true" /> Bổ sung tệp ngoại sinh</button>}{onOpenSettings && <button type="button" onClick={onOpenSettings} title="Mở cài đặt mẫu DOCX theo quyền hiện tại" className="mobile-touch-target mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[13px] font-black text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"><Settings2 size={15} aria-hidden="true" /> Mở cài đặt mẫu</button>}</div></section> : <div data-testid="pgd-drafting-work-area" className="min-w-0"><div className="mb-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[12px] font-bold leading-5 text-blue-900">Tài liệu <b>{selectedTemplate.name}</b> đang được soạn cho mục hồ sơ tương ứng. Tài liệu chỉ hoàn tất sau khi soát nội dung và xác nhận vào bộ hồ sơ.</div><PgdDocumentGenerationPanel key={`${request.id}:${activeDraft?.id || 'new'}:${templateId}:${draftPanelRevision}`} request={request} templates={catalogTemplates} canMutate={canMutate} initialTemplateId={templateId} initialFormat={activeDraft?.format} initialCellValues={activeDraft?.cellValues} onSaveDraft={(input) => saveDraft({ ...input, title: draftTitle })} onDraftDirtyChange={handleDraftDirtyChange} onAttachGenerated={attachGenerated} showTemplateSelector={false} showContextStatus={false} showReadiness={false} showOutputReview={false} showA4Preview={true} onReviewOutput={focusOutputReview} onGenerated={handleGenerated} onStateChange={handleGenerationStateChange} /></div> : <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center text-[12px] leading-5 text-slate-500">Chọn một PYC PGD để bắt đầu soạn tài liệu.</section>}
      </section>

      {hasReviewOutput && <DraftingOutputReviewShell testId="pgd-drafting-outputs" accent="blue" title="Soát xét & kết quả" description="Kiểm tra định danh tài liệu trước khi xác nhận và gắn vào đúng mục hồ sơ."><div data-testid="pgd-drafting-review-context" className="rounded-lg border border-blue-100 bg-blue-50/60 p-3"><p className="text-[12px] font-black text-blue-950">Soát xét trước khi gắn</p><p className="mt-1 text-[11px] leading-4 text-blue-900">Nguồn PYC: <b>{request?.requestCode}</b> · khách hàng <b>{request?.customerSnapshot.name}</b> · sản phẩm/đối tượng <b>{request?.productName}</b>.</p><p className="mt-1 text-[11px] leading-4 text-blue-900">Trạng thái: <b>Đã sinh, chờ soát xét</b>. Chỉ thao tác gắn sau khi đã kiểm tra định danh và phiên bản mẫu.</p></div><div className="mt-3 space-y-2">{selectedDocuments.map((document) => { const attached = attachedDocumentIds.has(document.id); const reviewed = attached || reviewedDocumentIds.includes(document.id); return <article key={document.id} data-testid={`pgd-draft-output-${document.id}`} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-[13px] font-black text-slate-800">{documentKindLabel(document.kind)} · {document.fileName}</p><details className="mt-1 text-[11px] text-slate-500"><summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1">Thông tin tệp và phiên bản</summary><p className="mt-1 break-words">Nguồn: {document.requestCode || request?.requestCode} · mẫu <span className="font-mono">{document.templateCode} · v{document.templateVersion}</span> · {document.format} · {formatWorkspaceDate(document.generatedAt)}</p></details><p className="mt-1 break-words text-[11px] text-slate-500">Trạng thái hồ sơ: {request ? getPgdStatusLabel(request.status) : 'Chưa có hồ sơ'}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${attached ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : reviewed ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{attached ? 'Đã gắn vào hồ sơ' : reviewed ? 'Đã soát xét' : 'Chờ soát xét'}</span></div><div className="mt-3 flex flex-wrap gap-2">{document.fileAssetId ? <a href={getPgdDocumentDownloadUrl(document.id)} download={document.fileName} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><FileDown size={14} aria-hidden="true" /> Mở tệp</a> : <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">Tệp đã sinh trong phiên hiện tại</span>}{!reviewed && <button type="button" onClick={() => reviewDocument(document.id)} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-black text-teal-800 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> Xác nhận đã soát xét</button>}{reviewed && !attached && <button type="button" title={!canMutate ? 'Tài khoản hiện tại không có quyền gắn tài liệu' : attachingDocumentId === document.id ? 'Đang gắn tài liệu' : undefined} onClick={() => void attachDocument(document)} disabled={attachingDocumentId === document.id || !canMutate} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><CheckCircle2 size={14} aria-hidden="true" /> {attachingDocumentId === document.id ? 'Đang gắn…' : 'Xác nhận & gắn vào bộ hồ sơ'}</button>}{attached && <span data-testid="pgd-drafting-attach-success" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-800"><CheckCircle2 size={14} aria-hidden="true" /> Đã gắn: {getPgdDossierRequirementForTemplate(document.kind as PgdDocumentTemplateKind, request?.productGroup || 'OTHER')?.title || 'mục checklist'}</span>}{attached && <button type="button" onClick={returnToDossier} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-[12px] font-black text-white hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowLeft size={14} aria-hidden="true" /> Quay lại hồ sơ</button>}</div></article>; })}</div></DraftingOutputReviewShell>}
      </main>
    </div>
  </div>;
}
