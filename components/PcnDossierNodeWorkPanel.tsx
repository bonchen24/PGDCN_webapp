'use client';

import React, { useMemo, useState } from 'react';

import type { PcnDossierDocument } from '../types';
import type {
  PcnDossierNodeBusinessFact,
  PcnDossierNodeDocumentItem,
  PcnDossierNodeWorkProjection,
} from '../utils/pcnDossierNodeWork';
import { getPcnFileUrl } from '../utils/pcnFileApi';

export interface PcnDossierNodeWorkPanelProps {
  projection: PcnDossierNodeWorkProjection;
  taskId?: string;
  documents?: readonly PcnDossierDocument[];
  canEdit?: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, expectedCycleNo?: number) => Promise<void>;
  onUploadDocument?: (requirementId: string, file: File) => Promise<void>;
  onCreateFromForm?: (requirementId: string) => void | Promise<void>;
  onOpenDrafting?: (item: PcnDossierNodeDocumentItem) => string | undefined;
  onGenerateAndAttach?: (requirementId: string) => Promise<void>;
  onRemoveCurrent?: (requirementId: string) => Promise<void>;
  onWaive?: (requirementId: string, reason: string) => Promise<void>;
  onClearWaiver?: (requirementId: string) => Promise<void>;
  onOpenBusiness?: (fact: PcnDossierNodeBusinessFact) => void;
  onClose?: () => void;
}

const STATUS_LABELS: Record<PcnDossierNodeWorkProjection['status'], string> = {
  LOCKED: 'Chưa mở',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang xử lý',
  WAITING: 'Đang chờ',
  RETURNED: 'Cần xử lý lại',
  COMPLETED: 'Đã hoàn tất',
  SKIPPED: 'Đã bỏ qua',
  STALE: 'Cần cập nhật',
  CANCELLED: 'Đã hủy',
};

const DOCUMENT_STATUS_LABELS: Record<PcnDossierNodeDocumentItem['status'], string> = {
  PRESENT: 'Đã có',
  MISSING: 'Chưa có',
  WAIVED: 'Bỏ qua',
};

function actionLabel(action: PcnDossierNodeDocumentItem['actions'][number]): string {
  switch (action) {
    case 'VIEW': return 'Xem tài liệu';
    case 'REPLACE': return 'Thay phiên bản';
    case 'REMOVE_CURRENT': return 'Xóa tài liệu hiện tại';
    case 'UPLOAD': return 'Upload tài liệu';
    case 'CREATE_FROM_FORM': return 'Tạo theo biểu mẫu';
    case 'CLEAR_WAIVER': return 'Bỏ trạng thái bỏ qua';
  }
}

function documentRecord(documents: readonly PcnDossierDocument[], item: PcnDossierNodeDocumentItem): PcnDossierDocument | undefined {
  return documents.find((document) => document.requirementId === item.requirementId);
}

export function PcnDossierNodeWorkPanel({
  projection,
  taskId,
  documents = [],
  canEdit = false,
  onStartTask,
  onCompleteTask,
  onUploadDocument,
  onCreateFromForm,
  onOpenDrafting,
  onGenerateAndAttach,
  onRemoveCurrent,
  onWaive,
  onClearWaiver,
  onOpenBusiness,
  onClose,
}: PcnDossierNodeWorkPanelProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [waiverReasons, setWaiverReasons] = useState<Record<string, string>>({});

  const documentByRequirementId = useMemo(() => new Map(documents.map((document) => [document.requirementId, document])), [documents]);
  const canStart = Boolean(taskId && onStartTask && ['READY', 'RETURNED'].includes(projection.status));
  const canContinue = Boolean(taskId && onCompleteTask && projection.canContinue);

  async function run(key: string, callback: () => Promise<void>) {
    setBusyKey(key);
    try {
      await callback();
    } finally {
      setBusyKey(null);
    }
  }

  function handleUpload(item: PcnDossierNodeDocumentItem, file: File | undefined) {
    if (!file || !onUploadDocument) return;
    void run(`upload:${item.requirementId}`, () => onUploadDocument(item.requirementId, file));
  }

  function renderDocument(item: PcnDossierNodeDocumentItem) {
    const document = documentByRequirementId.get(item.requirementId);
    const version = item.currentVersionId && document
      ? document.versions.find((candidate) => candidate.assetId === item.currentVersionId)
      : undefined;
    const inputId = `pcn-upload-${projection.nodeId}-${item.requirementId}`;
    const reason = waiverReasons[item.requirementId] || '';
    const editable = canEdit && projection.isEditable;
    const draftingHref = editable ? onOpenDrafting?.(item) : undefined;

    return (
      <li key={item.requirementId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" data-testid={`pcn-node-document-${item.requirementId}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.required ? 'Bắt buộc' : 'Tùy chọn'} · {DOCUMENT_STATUS_LABELS[item.status]}</p>
            {item.status === 'WAIVED' && item.waiverReason ? <p className="mt-2 text-xs text-amber-700">Lý do: {item.waiverReason}</p> : null}
            {projection.requiresReworkOnMutation ? <p className="mt-2 text-xs text-violet-700">Cập nhật mục này sẽ tạo vòng xử lý lại và đánh dấu các node sau cần rà soát.</p> : null}
          </div>
          {item.status === 'PRESENT' && version ? (
            <a className="shrink-0 text-xs font-medium text-blue-700 hover:underline" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer">
              {version.fileName || 'Tài liệu hiện tại'}
            </a>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.actions.includes('VIEW') && version ? (
            <a className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer">{actionLabel('VIEW')}</a>
          ) : null}
          {item.actions.includes('REPLACE') && editable ? (
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">
              {actionLabel('REPLACE')}
              <input className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} />
            </label>
          ) : null}
          {item.actions.includes('REMOVE_CURRENT') && editable ? (
            <button type="button" className="min-h-10 rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" disabled={busyKey === `remove:${item.requirementId}`} onClick={() => onRemoveCurrent && void run(`remove:${item.requirementId}`, () => onRemoveCurrent(item.requirementId))}>
              {actionLabel('REMOVE_CURRENT')}
            </button>
          ) : null}
          {item.actions.includes('UPLOAD') && editable ? (
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {actionLabel('UPLOAD')}
              <input id={inputId} className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} />
            </label>
          ) : null}
          {item.actions.includes('CREATE_FROM_FORM') && editable && (onGenerateAndAttach || onCreateFromForm) ? (
            <button type="button" className="min-h-10 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100" disabled={busyKey === `generate:${item.requirementId}`} onClick={() => void run(`generate:${item.requirementId}`, async () => {
              if (onGenerateAndAttach) await onGenerateAndAttach(item.requirementId);
              else await onCreateFromForm!(item.requirementId);
            })}>
              {busyKey === `generate:${item.requirementId}` ? 'Đang tạo và gắn…' : (onGenerateAndAttach ? 'Tạo & gắn tài liệu' : actionLabel('CREATE_FROM_FORM'))}
            </button>
          ) : null}
          {item.actions.includes('CREATE_FROM_FORM') && draftingHref ? (
            <a href={draftingHref} target="_blank" rel="noreferrer" className="mobile-touch-target inline-flex min-h-11 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
              Tạo DOCX
            </a>
          ) : null}
          {item.actions.includes('CLEAR_WAIVER') && editable && onClearWaiver ? (
            <button type="button" className="min-h-10 rounded-md border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50" disabled={busyKey === `clear-waiver:${item.requirementId}`} onClick={() => void run(`clear-waiver:${item.requirementId}`, () => onClearWaiver(item.requirementId))}>
              {actionLabel('CLEAR_WAIVER')}
            </button>
          ) : null}
        </div>

        {item.actions.includes('WAIVE') && editable && onWaive ? (
          <div className="mt-3 rounded-md bg-amber-50 p-3">
            <label className="block text-xs font-medium text-amber-900" htmlFor={`pcn-waive-${projection.nodeId}-${item.requirementId}`}>Lý do bỏ qua</label>
            <textarea
              id={`pcn-waive-${projection.nodeId}-${item.requirementId}`}
              className="mt-2 min-h-20 w-full rounded-md border border-amber-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-amber-500"
              value={reason}
              onChange={(event) => setWaiverReasons((current) => ({ ...current, [item.requirementId]: event.target.value }))}
              placeholder="Nhập lý do và kế hoạch bổ sung sau"
            />
            <button
              type="button"
              className="mt-2 min-h-10 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!reason.trim() || busyKey === `waive:${item.requirementId}`}
              onClick={() => void run(`waive:${item.requirementId}`, () => onWaive(item.requirementId, reason.trim()))}
            >
              Bỏ qua mục này
            </button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 shadow-sm" data-testid="pcn-node-work-panel" aria-label={`Công việc node ${projection.nodeLabel}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Công việc theo node</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{projection.nodeLabel}</h2>
          <p className="mt-1 text-xs text-slate-500">{STATUS_LABELS[projection.status]} · Vòng {projection.cycleNo} · {projection.documents.length - projection.unresolvedRequiredCount}/{projection.documents.length} mục đã xử lý</p>
        </div>
        {onClose ? <button type="button" className="min-h-10 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng panel">Đóng</button> : null}
      </div>

      {projection.blockedReason || projection.suggestions.length > 0 ? (
        <div className="border-b border-slate-200 bg-amber-50 px-4 py-3" data-testid="pcn-node-suggestions">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Gợi ý xử lý</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {projection.blockedReason ? <li>{projection.blockedReason}</li> : null}
            {projection.suggestions.map((suggestion) => <li key={suggestion}>• {suggestion}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="min-h-0 space-y-4 overflow-y-auto p-4">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Tài liệu và hồ sơ liên quan</h3>
            <span className="text-xs text-slate-500">{projection.documents.length} mục</span>
          </div>
          {projection.documents.length > 0 ? <ul className="mt-3 space-y-3">{projection.documents.map(renderDocument)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Node này không có đầu mục tài liệu.</p>}
        </section>

        {projection.businessFacts.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Việc nghiệp vụ</h3>
            <ul className="mt-3 space-y-2">
              {projection.businessFacts.map((fact) => (
                <li key={fact.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <p className="font-medium text-slate-900">{fact.label}</p>
                    {fact.reason ? <p className="mt-1 text-xs text-slate-500">{fact.reason}</p> : <p className="mt-1 text-xs text-emerald-700">Đã ghi nhận</p>}
                  </div>
                  {onOpenBusiness ? <button type="button" className="min-h-10 shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => onOpenBusiness(fact)}>{fact.actionLabel || 'Mở'}</button> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(canStart || canContinue) ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
            {canStart ? <button type="button" className="min-h-10 rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50" disabled={busyKey === 'start'} onClick={() => void run('start', () => onStartTask!(taskId!))}>Bắt đầu xử lý</button> : null}
            {canContinue ? <button type="button" className="min-h-10 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={busyKey === 'continue'} onClick={() => void run('continue', () => onCompleteTask!(taskId!, projection.cycleNo))}>Tiếp tục</button> : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default PcnDossierNodeWorkPanel;
