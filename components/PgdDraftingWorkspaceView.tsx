'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import { FileDown, FilePlus2, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDocumentDownloadUrl } from '../utils/pgdApi';
import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdDocumentTemplateFormat } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PgdDocumentGenerationPanel, { PGD_DOCUMENT_KIND_LABELS } from './PgdDocumentGenerationPanel';
import { getCurrentPgdDossierDocuments, getPgdDossierRequirementForTemplate, getPgdDossierRequirementStationKey, getPgdDossierRequirements } from '../utils/pgdDossier';

export type PgdDraftSession = {
  id: string;
  requestId: string;
  title: string;
  templateId: string;
  format: PgdDocumentTemplateFormat;
  cellValues: Record<string, unknown>;
  updatedAt: string;
};

type PgdDraftSaveInput = Pick<PgdDraftSession, 'templateId' | 'format' | 'cellValues'> & { title?: string };

type PgdDraftingWorkspaceViewProps = {
  templates: PgdDocumentTemplate[];
  documents: PgdGeneratedDocument[];
  canMutate: boolean;
  onOpenSettings?: () => void;
  initialRequestId?: string;
  initialRequirementCode?: string;
  initialTemplateKind?: PgdDocumentTemplateKind;
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

export default function PgdDraftingWorkspaceView({ templates, documents, canMutate, onOpenSettings, initialRequestId, initialRequirementCode, initialTemplateKind }: PgdDraftingWorkspaceViewProps) {
  const requests = usePgdStore((state) => state.requests.filter((request) => !request.deletedAt));
  const dossierDocuments = usePgdStore((state) => state.dossierDocuments);
  const fetchDossierDocuments = usePgdStore((state) => state.fetchDossierDocuments);
  const [requestId, setRequestId] = useState(initialRequestId || '');
  const [draftId, setDraftId] = useState<string>();
  const [draftTitle, setDraftTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selectedRequirementCode, setSelectedRequirementCode] = useState(initialRequirementCode || '');
  const [drafts, setDrafts] = useState<PgdDraftSession[]>([]);
  const [checklistError, setChecklistError] = useState('');

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
  const activeDraft = drafts.find((draft) => draft.id === draftId);
  const selectedTemplate = catalogTemplates.find((template) => template.id === templateId);
  const selectedTemplateRequirementCode = request
    ? getPgdDossierRequirementForTemplate((selectedTemplate?.kind || 'INTAKE_REQUEST') as PgdDocumentTemplateKind, request.productGroup)?.code
    : undefined;
  const activeRequirementCode = selectedRequirementCode || selectedTemplateRequirementCode;
  const selectedDocuments = useMemo(() => documents
    .filter((document) => document.requestId === request?.id)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)), [documents, request?.id]);

  useEffect(() => {
    if (requestId && !request) {
      setRequestId('');
      setDraftId(undefined);
      setDraftTitle('');
      setTemplateId('');
    }
  }, [request, requestId]);

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
    if (!initialRequestId) return;
    setRequestId(initialRequestId);
    setDraftId(undefined);
    setDraftTitle('');
  }, [initialRequestId]);

  useEffect(() => {
    if (!request) return;
    if (initialRequirementCode && requirements.some((item) => item.code === initialRequirementCode)) {
      setSelectedRequirementCode(initialRequirementCode);
      const matchingTemplate = availableTemplates.find((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === initialRequirementCode);
      if (matchingTemplate) setTemplateId(matchingTemplate.id);
    }
  }, [availableTemplates, initialRequirementCode, request, requirements]);

  useEffect(() => {
    if (activeDraft) {
      setDraftTitle(activeDraft.title);
      setTemplateId(activeDraft.templateId);
      return;
    }
    if (request && !availableTemplates.some((template) => template.id === templateId)) {
      setTemplateId(availableTemplates.find((template) => template.kind === initialTemplateKind)?.id || availableTemplates[0]?.id || '');
    }
  }, [activeDraft, availableTemplates, initialTemplateKind, request, templateId]);

  const loadDraft = (draft: PgdDraftSession) => {
    setDraftId(draft.id);
    setRequestId(draft.requestId);
    setDraftTitle(draft.title);
    setTemplateId(draft.templateId);
  };

  const newDraft = () => {
    setDraftId(undefined);
    setRequestId('');
    setDraftTitle('');
    setTemplateId('');
    setSelectedRequirementCode('');
  };

  const handleRequestChange = (nextRequestId: string) => {
    const nextRequest = requests.find((item) => item.id === nextRequestId);
    setRequestId(nextRequestId);
    setDraftId(undefined);
    setDraftTitle('');
    const nextTemplate = catalogTemplates.find((template) => template.productGroups.includes(nextRequest?.productGroup || 'OTHER'));
    setTemplateId(nextTemplate?.id || '');
    setSelectedRequirementCode(nextTemplate && nextRequest ? getPgdDossierRequirementForTemplate(nextTemplate.kind, nextRequest.productGroup)?.code || '' : '');
  };

  const handleTemplateChange = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    setDraftId(undefined);
    setDraftTitle('');
    const nextTemplate = catalogTemplates.find((template) => template.id === nextTemplateId);
    setSelectedRequirementCode(nextTemplate && request ? getPgdDossierRequirementForTemplate(nextTemplate.kind, request.productGroup)?.code || '' : '');
  };

  const selectRequirement = (requirementCode: string) => {
    if (!request) return;
    setSelectedRequirementCode(requirementCode);
    const matchingTemplate = availableTemplates.find((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === requirementCode);
    if (matchingTemplate) {
      setTemplateId(matchingTemplate.id);
      setDraftId(undefined);
      setDraftTitle('');
    }
  };

  const attachGenerated = async (document: PgdGeneratedDocument) => {
    if (!request) return;
    const requirement = getPgdDossierRequirementForTemplate(document.kind as PgdDocumentTemplateKind, request.productGroup);
    if (!requirement) throw new Error('Tài liệu này chưa có ánh xạ vào checklist PGD.');
    await usePgdStore.getState().attachGeneratedDocument(request.id, { documentId: document.id, requirementCode: requirement.code });
    toast.success(`Đã xác nhận ${document.fileName} vào bộ hồ sơ.`);
  };

  const saveDraft = (input: PgdDraftSaveInput) => {
    if (!request) return;
    const nextDraft: PgdDraftSession = {
      id: draftId || makeDraftId(),
      requestId: request.id,
      title: input.title?.trim() || `${request.requestCode} · ${templateTitle(catalogTemplates.find((template) => template.id === input.templateId))}`,
      templateId: input.templateId,
      format: input.format,
      cellValues: input.cellValues,
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => [nextDraft, ...current.filter((draft) => draft.id !== nextDraft.id)]);
    setDraftId(nextDraft.id);
    setDraftTitle(nextDraft.title);
    toast.success('Đã lưu bản soạn trong phiên hiện tại.');
  };

  return <div data-testid="pgd-drafting-workspace" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 pb-5 mobile-safe-bottom md:p-5">
    <header data-testid="pgd-drafting-header" className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Workspace độc lập · PGD</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Soạn thảo tài liệu PGD</h1>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Tự chọn hồ sơ cần tạo biên bản, nhập phần còn thiếu và sinh DOCX/PDF. Không làm hồ sơ chuyển bước.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onOpenSettings && <button type="button" onClick={onOpenSettings} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[10px] font-black text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Settings2 size={14} /> Cài đặt DOCX</button>}
        <button type="button" onClick={newDraft} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><FilePlus2 size={14} /> Bản soạn mới</button>
      </div>
    </header>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
      <aside aria-label="Bản đã lưu và checklist tài liệu" className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Bản đã lưu</h2><p className="mt-0.5 text-[9px] text-slate-400">Trong phiên hiện tại</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{drafts.length}</span></div>
        {drafts.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Chưa có bản soạn. Chọn hồ sơ và lưu lại để tiếp tục sau.</p> : <div className="space-y-1.5">{drafts.map((draft) => <button type="button" key={draft.id} onClick={() => loadDraft(draft)} className={`mobile-touch-target min-h-11 w-full min-w-0 rounded-lg border p-2 text-left transition ${draft.id === draftId ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/40'}`}><div className="break-words text-[10px] font-black text-slate-700">{draft.title}</div><div className="mt-1 text-[9px] text-slate-500">{draft.format} · {formatWorkspaceDate(draft.updatedAt)}</div></button>)}</div>}
        <section data-testid="pgd-drafting-checklist" className="border-t border-slate-100 pt-3" aria-label="Checklist tài liệu PGD">
          <div className="flex items-start justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Checklist tài liệu</h2><p className="mt-0.5 text-[9px] leading-4 text-slate-400">Chọn đúng mục hồ sơ để mở mẫu theo từng bước.</p></div>{request && <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{currentDossierDocuments.length}/{requirements.length}</span>}</div>
          {!request ? <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-3 text-[9px] leading-4 text-slate-400">Chọn PYC/hồ sơ nguồn để nạp checklist.</p> : <div className="mt-2 space-y-1.5">{requirements.map((requirement) => {
            const currentDocument = currentDossierDocuments.find((document) => document.requirementCode === requirement.code);
            const checklistItem = checklistByCode.get(requirement.code);
            const status = currentDocument ? 'PRESENT' : checklistItem?.status === 'WAIVED' ? 'WAIVED' : 'MISSING';
            const matchingTemplate = availableTemplates.find((template) => getPgdDossierRequirementForTemplate(template.kind, request.productGroup)?.code === requirement.code);
            const selected = activeRequirementCode === requirement.code;
            return <div key={requirement.code} className={`rounded-lg border p-2 ${selected ? 'border-blue-300 bg-blue-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
              <button type="button" onClick={() => selectRequirement(requirement.code)} className="mobile-touch-target flex min-h-10 w-full items-start gap-2 text-left" aria-current={selected ? 'step' : undefined}>
                <span className={`mt-0.5 inline-flex shrink-0 rounded-md border px-1.5 py-1 text-[8px] font-black ${checklistStatusClass(status)}`}>{status}</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-[10px] font-black text-slate-700">{requirement.title}{requirement.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span><span className="mt-0.5 block text-[8px] text-slate-400">{requirement.code} · {getPgdDossierRequirementStationKey(requirement.code)}</span></span>
              </button>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 pl-0.5 text-[8px]"><span className="text-slate-500">{checklistStatusLabel(status)}</span>{matchingTemplate ? <span className="font-bold text-blue-700">Có mẫu · chọn để soạn</span> : <span className="font-bold text-amber-700">Bổ sung tệp ngoại sinh</span>}</div>
            </div>;
          })}</div>}
          {checklistError && <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800">{checklistError}</p>}
        </section>
      </aside>

      <main className="min-w-0">
        <section data-testid="pgd-drafting-form" className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Form soạn thảo tài liệu PGD">
          <div className="grid gap-2 sm:grid-cols-2">
            <label><span className="block text-[10px] font-black text-slate-500">Tên bản soạn</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} disabled={!canMutate} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50" /></label>
            <label><span className="block text-[10px] font-black text-slate-500">Loại tài liệu</span><select aria-label="Loại tài liệu PGD" value={templateId} onChange={(event) => handleTemplateChange(event.target.value)} disabled={!canMutate || !request} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50"><option value="">Chưa có mẫu phù hợp</option>{templateOptions.map((template) => <option key={template.id} value={template.id}>{PGD_DOCUMENT_KIND_LABELS[template.kind]} · {template.code} · v{template.version}</option>)}</select></label>
          </div>

           <section data-testid="pgd-drafting-context" className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5" aria-label="Nguồn hồ sơ PGD">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Chọn hồ sơ nguồn</h2><p className="mt-0.5 text-[10px] text-slate-500">Chọn một PYC/hồ sơ; dữ liệu phù hợp sẽ tự điền vào biểu mẫu.</p></div>{request && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{request.requestCode}</span>}</div>
            <div className="mt-2"><PcnCatalogCombobox id="pgd-draft-source" label="Chọn hồ sơ PGD" hideLabel value={requestId} options={sourceOptions} onChange={handleRequestChange} disabled={!canMutate && sourceOptions.length === 0} /></div>
            {request && <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4"><div className="min-w-0 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Khách hàng</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.customerSnapshot.name}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Sản phẩm</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.productName}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Lô / số lượng</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.lotCode || 'Chưa ghi nhận'} · {request.quantity} {request.unit || ''}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Phương thức</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.method || 'Chưa chọn'}</div></div></div>}
          </section>

          {request ? <div data-testid="pgd-drafting-readiness" className="min-w-0"><div className="mb-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[10px] font-bold text-blue-900">Nguồn: <span className="font-mono">{request.requestCode}</span> · Mục hồ sơ: <span className="font-mono">{activeRequirementCode || 'Chưa ánh xạ'}</span>. Tệp chỉ hoàn tất sau khi soát nội dung và xác nhận vào bộ hồ sơ.</div><PgdDocumentGenerationPanel key={`${request.id}:${activeDraft?.id || 'new'}:${templateId}`} request={request} templates={catalogTemplates} canMutate={canMutate} initialTemplateId={templateId} initialFormat={activeDraft?.format} initialCellValues={activeDraft?.cellValues} onSaveDraft={(input) => saveDraft({ ...input, title: draftTitle })} onAttachGenerated={attachGenerated} showTemplateSelector={false} /></div> : <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center text-[11px] text-slate-400">Chọn một hồ sơ PGD để bắt đầu soạn tài liệu.</section>}
        </section>
      </main>

      <aside aria-label="Kết quả sinh tệp" className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div><h2 className="text-xs font-black text-slate-800">Kết quả sinh tệp</h2><p className="mt-0.5 text-[9px] text-slate-400">Theo hồ sơ đang chọn</p></div>
        {!request ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Kết quả DOCX/PDF sẽ hiện ở đây.</p> : selectedDocuments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Hồ sơ này chưa có tệp được sinh.</p> : <div className="space-y-1.5">{selectedDocuments.map((document) => <div key={document.id} className="min-w-0 rounded-lg border border-slate-100 p-2"><div className="break-words text-[10px] font-bold text-slate-700">{document.fileName}</div><div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-400"><span>{document.format} · {formatWorkspaceDate(document.generatedAt)}</span>{document.fileAssetId ? <a href={getPgdDocumentDownloadUrl(document.id)} download={document.fileName} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 px-2 text-[9px] font-black text-blue-700 hover:bg-blue-50"><FileDown size={12} /> Tải lại</a> : <span>Tệp trực tiếp ở lần sinh</span>}</div></div>)}</div>}
      </aside>
    </div>
  </div>;
}
