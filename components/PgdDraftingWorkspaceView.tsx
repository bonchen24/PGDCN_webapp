'use client';

import { FileDown, FilePlus2, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDocumentDownloadUrl } from '../utils/pgdApi';
import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdDocumentTemplateFormat } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PgdDocumentGenerationPanel from './PgdDocumentGenerationPanel';

export type PgdDraftSession = {
  id: string;
  requestId: string;
  title: string;
  templateId: string;
  format: PgdDocumentTemplateFormat;
  cellValues: Record<string, unknown>;
  updatedAt: string;
};

type PgdDraftSaveInput = Pick<PgdDraftSession, 'templateId' | 'format' | 'cellValues'>;

type PgdDraftingWorkspaceViewProps = {
  templates: PgdDocumentTemplate[];
  documents: PgdGeneratedDocument[];
  canMutate: boolean;
  onOpenSettings?: () => void;
};

function formatWorkspaceDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời điểm' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
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

export default function PgdDraftingWorkspaceView({ templates, documents, canMutate, onOpenSettings }: PgdDraftingWorkspaceViewProps) {
  const requests = usePgdStore((state) => state.requests.filter((request) => !request.deletedAt));
  const [requestId, setRequestId] = useState('');
  const [draftId, setDraftId] = useState<string>();
  const [drafts, setDrafts] = useState<PgdDraftSession[]>([]);

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
  const activeDraft = drafts.find((draft) => draft.id === draftId);
  const selectedDocuments = useMemo(() => documents
    .filter((document) => document.requestId === request?.id)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)), [documents, request?.id]);

  useEffect(() => {
    if (requestId && !request) {
      setRequestId('');
      setDraftId(undefined);
    }
  }, [request, requestId]);

  const loadDraft = (draft: PgdDraftSession) => {
    setDraftId(draft.id);
    setRequestId(draft.requestId);
  };

  const newDraft = () => {
    setDraftId(undefined);
    setRequestId('');
  };

  const saveDraft = (input: PgdDraftSaveInput) => {
    if (!request) return;
    const nextDraft: PgdDraftSession = {
      id: draftId || makeDraftId(),
      requestId: request.id,
      title: `${request.requestCode} · ${templateTitle(catalogTemplates.find((template) => template.id === input.templateId))}`,
      templateId: input.templateId,
      format: input.format,
      cellValues: input.cellValues,
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => [nextDraft, ...current.filter((draft) => draft.id !== nextDraft.id)]);
    setDraftId(nextDraft.id);
    toast.success('Đã lưu bản soạn trong phiên hiện tại.');
  };

  return <div className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Workspace độc lập · PGD</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Soạn thảo tài liệu</h1>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Tự chọn hồ sơ cần tạo biên bản, nhập phần còn thiếu và sinh DOCX/PDF. Không làm hồ sơ chuyển bước.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onOpenSettings && <button type="button" onClick={onOpenSettings} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[10px] font-black text-blue-700 shadow-sm hover:bg-blue-50"><Settings2 size={14} /> Cài đặt DOCX</button>}
        <button type="button" onClick={newDraft} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-blue-500"><FilePlus2 size={14} /> Bản soạn mới</button>
      </div>
    </header>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
      <aside aria-label="Bản đã lưu" className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Bản đã lưu</h2><p className="mt-0.5 text-[9px] text-slate-400">Trong phiên hiện tại</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{drafts.length}</span></div>
        {drafts.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Chưa có bản soạn. Chọn hồ sơ và lưu lại để tiếp tục sau.</p> : <div className="space-y-1.5">{drafts.map((draft) => <button type="button" key={draft.id} onClick={() => loadDraft(draft)} className={`w-full min-w-0 rounded-lg border p-2 text-left transition ${draft.id === draftId ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/40'}`}><div className="break-words text-[10px] font-black text-slate-700">{draft.title}</div><div className="mt-1 text-[9px] text-slate-500">{draft.format} · {formatWorkspaceDate(draft.updatedAt)}</div></button>)}</div>}
      </aside>

      <main className="min-w-0 space-y-3">
        <section className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm" aria-label="Nguồn hồ sơ PGD">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Chọn hồ sơ nguồn</h2><p className="mt-0.5 text-[10px] text-slate-500">Chọn một PYC/hồ sơ; dữ liệu phù hợp sẽ tự điền vào biểu mẫu.</p></div>{request && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{request.requestCode}</span>}</div>
          <div className="mt-2"><PcnCatalogCombobox id="pgd-draft-source" label="Chọn hồ sơ PGD" hideLabel value={requestId} options={sourceOptions} placeholder={sourceOptions.length > 0 ? 'Tìm PYC, khách hàng, sản phẩm hoặc số lô...' : 'Không có hồ sơ PGD'} onChange={(nextRequestId) => { setRequestId(nextRequestId); setDraftId(undefined); }} disabled={false} /></div>
          {request && <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4"><div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Khách hàng</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.customerSnapshot.name}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Sản phẩm</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.productName}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Lô / số lượng</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.lotCode || 'Chưa ghi nhận'} · {request.quantity} {request.unit || ''}</div></div><div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"><div className="text-[9px] font-black uppercase text-slate-400">Phương thức</div><div className="mt-1 break-words text-[10px] font-bold text-slate-700">{request.method || 'Chưa chọn'}</div></div></div>}
        </section>
        {request ? <PgdDocumentGenerationPanel key={`${request.id}:${activeDraft?.id || 'new'}`} request={request} templates={templates} canMutate={canMutate} initialTemplateId={activeDraft?.templateId} initialFormat={activeDraft?.format} initialCellValues={activeDraft?.cellValues} onSaveDraft={saveDraft} /> : <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-[11px] text-slate-400">Chọn một hồ sơ PGD để bắt đầu soạn tài liệu.</section>}
      </main>

      <aside aria-label="Kết quả sinh file" className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div><h2 className="text-xs font-black text-slate-800">Kết quả sinh file</h2><p className="mt-0.5 text-[9px] text-slate-400">Theo hồ sơ đang chọn</p></div>
        {!request ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Kết quả DOCX/PDF sẽ hiện ở đây.</p> : selectedDocuments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-4 text-[10px] leading-4 text-slate-400">Hồ sơ này chưa có file được sinh.</p> : <div className="space-y-1.5">{selectedDocuments.map((document) => <div key={document.id} className="min-w-0 rounded-lg border border-slate-100 p-2"><div className="break-words text-[10px] font-bold text-slate-700">{document.fileName}</div><div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-400"><span>{document.format} · {formatWorkspaceDate(document.generatedAt)}</span>{document.fileAssetId ? <a href={getPgdDocumentDownloadUrl(document.id)} download={document.fileName} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 px-2 text-[9px] font-black text-blue-700 hover:bg-blue-50"><FileDown size={12} /> Tải lại</a> : <span>File trực tiếp ở lần sinh</span>}</div></div>)}</div>}
      </aside>
    </div>
  </div>;
}
