'use client';

import React, { useMemo, useState } from 'react';
import { Eye, FileText, MoreHorizontal, Upload } from 'lucide-react';

import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PCN_DEPARTMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS } from '../types';
import type { PcnDossierDocument, UserAccount } from '../types';
import type {
  PcnDossierNodeBusinessFact,
  PcnDossierNodeDocumentItem,
  PcnDossierNodeWorkProjection,
} from '../utils/pcnDossierNodeWork';
import { getPcnNodeDocumentGenerationKind } from '../utils/pcnDossierNodeWork';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import PgdcnDossierDocumentActionTable from './PgdcnDossierDocumentActionTable';

export interface PcnDossierNodeWorkPanelProps {
  projection: PcnDossierNodeWorkProjection;
  panelId?: string;
  taskId?: string;
  documents?: readonly PcnDossierDocument[];
  currentUser?: UserAccount;
  canEdit?: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, expectedCycleNo?: number) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  returnTargets?: Array<{ id: string; label: string }>;
  onOpenDocuments?: () => void;
  onUploadDocument?: (requirementId: string, file: File) => Promise<void>;
  onCreateFromForm?: (requirementId: string) => void | Promise<void>;
  onOpenDrafting?: (item: PcnDossierNodeDocumentItem) => string | undefined;
  onGenerateAndAttach?: (requirementId: string) => Promise<void>;
  onConfirmDocument?: (requirementId: string) => Promise<void>;
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

const DOCUMENT_STATUS_LABELS: Partial<Record<PcnDossierNodeDocumentItem['status'], string>> = {
  PRESENT: 'Đã có',
  MISSING: 'Chưa có',
  WAIVED: 'Bỏ qua',
};

Object.assign(DOCUMENT_STATUS_LABELS, {
  UPLOADED: 'Đã tải lên · chờ xác nhận',
  GENERATED: 'Đã sinh · chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
});

const WORKFLOW_BLOCKED_REASON_LABELS: Record<NonNullable<PcnDossierNodeWorkProjection['blockedReason']>, string> = {
  MISSING_DOCUMENT: 'Bước đang chờ tài liệu bắt buộc.',
  PREDECESSOR: 'Bước trước chưa hoàn tất.',
  CONDITION: 'Điều kiện chuyển bước chưa được đáp ứng.',
  JOIN_POLICY: 'Các bước liên quan chưa đáp ứng quy tắc kết hợp.',
};

function actionLabel(action: PcnDossierNodeDocumentItem['actions'][number]): string {
  if (action === 'CONFIRM') return 'Xác nhận tài liệu';
  switch (action) {
    case 'VIEW': return 'Xem tài liệu';
    case 'REPLACE': return 'Thay phiên bản';
    case 'REMOVE_CURRENT': return 'Xóa tài liệu hiện tại';
    case 'UPLOAD': return 'Bổ sung tệp';
    case 'CREATE_FROM_FORM': return 'Tạo theo biểu mẫu';
    case 'CLEAR_WAIVER': return 'Bỏ trạng thái bỏ qua';
  }
}

function documentRecord(documents: readonly PcnDossierDocument[], item: PcnDossierNodeDocumentItem): PcnDossierDocument | undefined {
  return documents.find((document) => document.requirementId === item.requirementId);
}

export function PcnDossierNodeWorkPanel({
  projection,
  panelId,
  taskId,
  documents = [],
  currentUser,
  canEdit = false,
  onStartTask,
  onCompleteTask,
  onReturnTask,
  returnTargets = [],
  onOpenDocuments,
  onUploadDocument,
  onCreateFromForm,
  onOpenDrafting,
  onGenerateAndAttach,
  onConfirmDocument,
  onRemoveCurrent,
  onWaive,
  onClearWaiver,
  onOpenBusiness,
  onClose,
}: PcnDossierNodeWorkPanelProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [waiverReasons, setWaiverReasons] = useState<Record<string, string>>({});
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnTargetId, setReturnTargetId] = useState(returnTargets[0]?.id || '');
  const [returnReason, setReturnReason] = useState('');

  const documentByRequirementId = useMemo(() => new Map(documents.map((document) => [document.requirementId, document])), [documents]);
  const orderedDocuments = useMemo(
    () => [...projection.documents].sort((left, right) => Number(right.required) - Number(left.required)),
    [projection.documents],
  );
  const requiredDocuments = projection.documents.filter((item) => item.required);
  const optionalDocuments = projection.documents.filter((item) => !item.required);
  const unresolvedRequiredDocuments = requiredDocuments.filter((item) => !['PRESENT', 'CONFIRMED', 'WAIVED'].includes(item.status));
  const missingRequiredDocuments = unresolvedRequiredDocuments.filter((item) => item.status === 'MISSING');
  const pendingRequiredDocuments = unresolvedRequiredDocuments.filter((item) => item.status === 'UPLOADED' || item.status === 'GENERATED');
  const incompleteBusinessFacts = projection.businessFacts.filter((fact) => fact.status !== 'COMPLETED' && fact.status !== 'NOT_APPLICABLE');
  const requiredResolvedCount = requiredDocuments.length - unresolvedRequiredDocuments.length;
  const optionalCompletedCount = optionalDocuments.filter((item) => ['PRESENT', 'CONFIRMED'].includes(item.status)).length;
  const completionBlockReasons = [
    ...(projection.blockedReason ? [WORKFLOW_BLOCKED_REASON_LABELS[projection.blockedReason]] : []),
    ...pendingRequiredDocuments.map((item) => `${item.status === 'GENERATED' ? 'Rà soát và xác nhận bản sinh' : 'Xác nhận tệp'}: ${item.label}`),
    ...missingRequiredDocuments.map((item) => `Thiếu tài liệu bắt buộc: ${item.label}`),
    ...incompleteBusinessFacts.map((fact) => `${fact.actionLabel || fact.label}: ${fact.reason || 'Chưa hoàn tất.'}`),
  ];
  const canEditNode = canEdit && projection.isEditable;
  const canStart = Boolean(taskId && onStartTask && ['READY', 'RETURNED'].includes(projection.status));
  const canOfferContinue = Boolean(taskId && onCompleteTask && ['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED'].includes(projection.status));
  const canContinue = Boolean(canOfferContinue && projection.canContinue);
  const canReturn = Boolean(taskId && onReturnTask && canEdit && returnTargets.length > 0 && ['IN_PROGRESS', 'WAITING', 'RETURNED', 'COMPLETED'].includes(projection.status));
  const nextMissingRequiredDocument = canEditNode
    ? missingRequiredDocuments.find((item) => (
      (item.actions.includes('UPLOAD') && Boolean(onUploadDocument))
      || (item.actions.includes('CREATE_FROM_FORM') && Boolean(getPcnNodeDocumentGenerationKind(item.code)) && Boolean(onGenerateAndAttach || onCreateFromForm))
      || (item.actions.includes('WAIVE') && Boolean(onWaive))
    ))
    : undefined;
  const nextBusinessFact = onOpenBusiness ? incompleteBusinessFacts[0] : undefined;
  const nextActionSummary = canStart
    ? 'Bắt đầu xử lý bước này.'
    : canContinue
      ? 'Hoàn tất bước này để chuyển tiếp hồ sơ.'
      : canReturn
        ? 'Trả hồ sơ về bước cần xử lý.'
        : pendingRequiredDocuments[0]
          ? `Xác nhận tài liệu: ${pendingRequiredDocuments[0].label}`
        : nextMissingRequiredDocument
          ? `Bổ sung tài liệu bắt buộc: ${nextMissingRequiredDocument.label}`
          : nextBusinessFact
            ? nextBusinessFact.actionLabel || `Mở ${nextBusinessFact.label}`
            : completionBlockReasons.length > 0
              ? 'Xem các điều kiện chưa đạt bên dưới.'
              : 'Chưa có thao tác workflow khả dụng trong phiên hiện tại.';
  const completionBlockersId = `pcn-node-completion-blockers-${projection.nodeId}`;
  const completionReasonsForDisplay = completionBlockReasons.length > 0
    ? completionBlockReasons
    : ['Chưa đủ điều kiện hoàn tất bước này.'];
  const currentRole = currentUser?.professionalRoleCodes?.map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code).join(', ')
    || (currentUser?.managementRoleCode && currentUser.managementRoleCode !== 'NONE'
      ? ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === currentUser.managementRoleCode)?.name
      : undefined)
    || (currentUser?.departmentRoleCode
      ? PCN_DEPARTMENT_ROLE_OPTIONS.find((role) => role.code === currentUser.departmentRoleCode)?.name
      : undefined)
    || currentUser?.position
    || currentUser?.systemRole
    || 'Người xử lý hồ sơ';

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
    const canGenerateAndAttach = Boolean(getPcnNodeDocumentGenerationKind(item.code));

    return (
      <li key={item.requirementId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" data-testid={`pcn-node-document-${item.requirementId}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.required ? 'Bắt buộc' : 'Tùy chọn'} · {(DOCUMENT_STATUS_LABELS[item.status] || item.status)}</p>
            {item.status === 'WAIVED' && item.waiverReason ? <p className="mt-2 text-xs text-amber-700">Lý do: {item.waiverReason}</p> : null}
            {projection.requiresReworkOnMutation ? <p className="mt-2 text-xs text-violet-700">Cập nhật mục này sẽ tạo vòng xử lý lại và đánh dấu các bước sau cần rà soát.</p> : null}
          </div>
          {['PRESENT', 'CONFIRMED'].includes(item.status) && version ? (
            <a className="shrink-0 text-xs font-medium text-blue-700 hover:underline" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer">
              {version.fileName || 'Tài liệu hiện tại'}
            </a>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.actions.includes('VIEW') && version ? (
            <a className="mobile-touch-target min-h-11 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer">{actionLabel('VIEW')}</a>
          ) : null}
          {item.actions.includes('REPLACE') && editable ? (
            <label className="inline-flex mobile-touch-target min-h-11 cursor-pointer items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
              {actionLabel('REPLACE')}
              <input className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} />
            </label>
          ) : null}
          {item.actions.includes('REMOVE_CURRENT') && editable ? (
            <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" disabled={busyKey === `remove:${item.requirementId}`} onClick={() => onRemoveCurrent && void run(`remove:${item.requirementId}`, () => onRemoveCurrent(item.requirementId))}>
              {actionLabel('REMOVE_CURRENT')}
            </button>
          ) : null}
          {item.actions.includes('UPLOAD') && editable ? (
            <label className="inline-flex mobile-touch-target min-h-11 cursor-pointer items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
              {actionLabel('UPLOAD')}
              <input id={inputId} className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} />
            </label>
          ) : null}
          {item.actions.includes('CREATE_FROM_FORM') && draftingHref ? (
            <a href={draftingHref} title="Tạo DOCX từ biểu mẫu" aria-label="Soạn thảo tài liệu, tạo DOCX từ biểu mẫu" className="mobile-touch-target inline-flex min-h-11 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
              Soạn thảo tài liệu
            </a>
          ) : null}
          {item.actions.includes('CREATE_FROM_FORM') && canGenerateAndAttach && editable && (onGenerateAndAttach || onCreateFromForm) ? (
            <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100" disabled={busyKey === `generate:${item.requirementId}`} onClick={() => void run(`generate:${item.requirementId}`, async () => {
              if (onGenerateAndAttach) await onGenerateAndAttach(item.requirementId);
              else await onCreateFromForm!(item.requirementId);
            })}>
              {busyKey === `generate:${item.requirementId}` ? 'Đang tạo và gắn…' : (onGenerateAndAttach ? 'Tạo & gắn tài liệu' : actionLabel('CREATE_FROM_FORM'))}
            </button>
          ) : null}
          {item.actions.includes('CLEAR_WAIVER') && editable && onClearWaiver ? (
            <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50" disabled={busyKey === `clear-waiver:${item.requirementId}`} onClick={() => void run(`clear-waiver:${item.requirementId}`, () => onClearWaiver(item.requirementId))}>
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

            />
            <button
              type="button"
              className="mt-2 mobile-touch-target min-h-11 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
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

  function renderDocumentRow(item: PcnDossierNodeDocumentItem) {
    const document = documentByRequirementId.get(item.requirementId);
    const version = item.currentVersionId && document
      ? document.versions.find((candidate) => candidate.assetId === item.currentVersionId)
      : undefined;
    const inputId = `pcn-upload-${projection.nodeId}-${item.requirementId}`;
    const reason = waiverReasons[item.requirementId] || '';
    const editable = canEdit && projection.isEditable;
    const draftingHref = editable ? onOpenDrafting?.(item) : undefined;
    const canGenerateAndAttach = Boolean(getPcnNodeDocumentGenerationKind(item.code));
    const statusClass = ['PRESENT', 'CONFIRMED'].includes(item.status)
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : item.status === 'WAIVED'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : 'border-amber-200 bg-amber-50 text-amber-800';

    return (
      <tr key={item.requirementId} data-testid={`pcn-node-document-${item.requirementId}`}>
        <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-500">{projection.nodeLabel}</td>
        <th scope="row" className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span>{item.label}{item.required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}</span>
            <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${item.required ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
              {item.required ? 'Bắt buộc' : 'Tùy chọn'}
            </span>
          </div>
          {item.status === 'WAIVED' && item.waiverReason ? <p className="mt-1 text-[11px] font-normal text-amber-700">Lý do bỏ qua: {item.waiverReason}</p> : null}
          {projection.requiresReworkOnMutation ? <p className="mt-1 text-[11px] font-normal text-violet-700">Cập nhật mục này sẽ yêu cầu rà soát lại các bước sau.</p> : null}
        </th>
        <td className="border-b border-slate-100 px-3 py-2.5"><span className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-[9px] font-black ${statusClass}`}>{(DOCUMENT_STATUS_LABELS[item.status] || item.status)}</span></td>
        <td className="border-b border-slate-100 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {['PRESENT', 'CONFIRMED'].includes(item.status) && version && item.actions.includes('VIEW') ? <a className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer" title="Xem tài liệu" aria-label="Xem tài liệu"><Eye size={14} aria-hidden="true" /></a> : null}
            {item.status !== 'PRESENT' && item.actions.includes('CREATE_FROM_FORM') && draftingHref ? <a href={draftingHref} title="Soạn thảo tài liệu" aria-label="Soạn thảo tài liệu" className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><FileText size={14} aria-hidden="true" /></a> : null}
            {item.status !== 'PRESENT' && item.actions.includes('UPLOAD') && editable ? <label className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100" title="Bổ sung tệp" aria-label="Tải tài liệu"><Upload size={14} aria-hidden="true" /><input id={inputId} className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} /></label> : null}
            {['PRESENT', 'CONFIRMED'].includes(item.status) && version ? <a className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer" title="Mở tệp" aria-label="Mở tệp"><FileText size={14} aria-hidden="true" /></a> : null}
            {(item.actions.includes('CONFIRM') || item.actions.includes('REPLACE') || item.actions.includes('REMOVE_CURRENT') || item.actions.includes('CREATE_FROM_FORM') || item.actions.includes('CLEAR_WAIVER') || item.actions.includes('WAIVE')) ? <details className="relative">
              <summary className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Thao tác khác" aria-label="Thao tác khác"><MoreHorizontal size={14} aria-hidden="true" /></summary>
              <div className="absolute right-0 z-10 mt-1 flex min-w-48 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {item.actions.includes('CONFIRM') && editable && onConfirmDocument ? <button type="button" className="mobile-touch-target min-h-11 rounded-md bg-emerald-600 px-2.5 py-2 text-left text-[11px] font-bold text-white" disabled={busyKey === `confirm:${item.requirementId}`} onClick={() => void run(`confirm:${item.requirementId}`, () => onConfirmDocument(item.requirementId))}>{busyKey === `confirm:${item.requirementId}` ? '?ang x?c nh?n?' : actionLabel('CONFIRM')}</button> : null}
                {item.actions.includes('REPLACE') && editable ? <label className="inline-flex mobile-touch-target min-h-11 cursor-pointer items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">Thay phiên bản<input className="sr-only" type="file" onChange={(event) => handleUpload(item, event.target.files?.[0])} disabled={busyKey === `upload:${item.requirementId}`} /></label> : null}
                {item.actions.includes('CREATE_FROM_FORM') && canGenerateAndAttach && editable && (onGenerateAndAttach || onCreateFromForm) ? <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-left text-[11px] font-bold text-indigo-700" disabled={busyKey === `generate:${item.requirementId}`} onClick={() => void run(`generate:${item.requirementId}`, async () => { if (onGenerateAndAttach) await onGenerateAndAttach(item.requirementId); else await onCreateFromForm!(item.requirementId); })}>{busyKey === `generate:${item.requirementId}` ? 'Đang tạo và gắn…' : 'Tạo & gắn tài liệu'}</button> : null}
                {item.actions.includes('REMOVE_CURRENT') && editable ? <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-rose-200 px-2.5 py-2 text-left text-[11px] font-bold text-rose-700" disabled={busyKey === `remove:${item.requirementId}`} onClick={() => onRemoveCurrent && void run(`remove:${item.requirementId}`, () => onRemoveCurrent(item.requirementId))}>Xóa tài liệu hiện tại</button> : null}
                {item.actions.includes('CLEAR_WAIVER') && editable && onClearWaiver ? <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-[11px] font-bold text-amber-800" disabled={busyKey === `clear-waiver:${item.requirementId}`} onClick={() => void run(`clear-waiver:${item.requirementId}`, () => onClearWaiver(item.requirementId))}>Bỏ trạng thái bỏ qua</button> : null}
                {item.actions.includes('WAIVE') && editable && onWaive ? <div className="rounded-md bg-amber-50 p-2"><label className="block text-[11px] font-bold text-amber-900" htmlFor={`pcn-waive-${projection.nodeId}-${item.requirementId}`}>Lý do bỏ qua</label><textarea id={`pcn-waive-${projection.nodeId}-${item.requirementId}`} className="mt-1 min-h-16 w-full rounded-md border border-amber-200 bg-white p-2 text-[11px] text-slate-900 outline-none focus:border-amber-500" value={reason} onChange={(event) => setWaiverReasons((current) => ({ ...current, [item.requirementId]: event.target.value }))} /><button type="button" className="mt-1 mobile-touch-target min-h-11 rounded-md bg-amber-600 px-2.5 py-2 text-[11px] font-bold text-white disabled:opacity-50" disabled={!reason.trim() || busyKey === `waive:${item.requirementId}`} onClick={() => void run(`waive:${item.requirementId}`, () => onWaive(item.requirementId, reason.trim()))}>Bỏ qua mục này</button></div> : null}
              </div>
            </details> : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <aside id={panelId} role="tabpanel" className="flex min-h-0 min-w-0 flex-col rounded-xl border border-emerald-200 bg-white shadow-sm [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-blue-500" data-testid="pcn-node-work-panel" aria-label={`Công việc bước ${projection.nodeLabel}`}>
      <div className="flex items-start justify-between gap-3 border-b border-emerald-200 bg-white p-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-600">Việc đang chọn</p>
          <h2 className="mt-1 text-base font-black text-slate-950">{projection.nodeLabel}</h2>
          <p className="mt-1 text-xs text-slate-500">{STATUS_LABELS[projection.status]} · Vòng {projection.cycleNo}</p>
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Tiến độ tài liệu trong bước" data-testid="pcn-node-progress">
            <span data-testid="pcn-required-progress" className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
              <span className="font-semibold">Bắt buộc</span>
              <strong className="tabular-nums">{requiredResolvedCount}/{requiredDocuments.length}</strong>
              <span>đã xử lý</span>
            </span>
            <span data-testid="pcn-optional-progress" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">
              <span className="font-semibold">Tùy chọn</span>
              <strong className="tabular-nums">{optionalCompletedCount}/{optionalDocuments.length}</strong>
              <span>đã hoàn tất</span>
            </span>
          </div>
        </div>
        {onClose ? <button type="button" className="mobile-touch-target min-h-11 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng bảng chi tiết bước">Đóng</button> : null}
      </div>

      {projection.blockedReason || projection.suggestions.length > 0 ? (
        <details className="border-b border-slate-200 bg-amber-50" data-testid="pcn-node-suggestions">
          <summary className="mobile-touch-target cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-amber-900">Gợi ý xử lý <span className="ml-1 font-normal text-amber-900/70">(mở khi cần)</span></summary>
          <ul className="space-y-1 border-t border-amber-100 px-4 py-3 text-sm text-amber-900">
            {projection.blockedReason ? <li>{projection.blockedReason}</li> : null}
            {projection.suggestions.map((suggestion) => <li key={suggestion}>• {suggestion}</li>)}
          </ul>
        </details>
      ) : null}

      <section data-testid="pcn-dossier-review-summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-emerald-50/50 px-4 py-3 text-xs" aria-label="Soát xét hồ sơ PCN">
        <div><span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Soát xét</span><strong className="text-slate-800">{projection.unresolvedRequiredCount ? `Còn ${projection.unresolvedRequiredCount} mục bắt buộc chưa được xử lý` : 'Không thiếu mục bắt buộc'}</strong></div>
        <div role="group" aria-label="Vai trò và thao tác trong phiên hiện tại">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Vai trò hiện tại</span>
          <strong className="text-slate-800" data-testid="pcn-node-current-role">{currentRole}</strong>
        </div>
        <div>
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Thao tác tiếp theo</span>
          <strong className="text-slate-800" data-testid="pcn-node-next-action">{nextActionSummary}</strong>
        </div>
      </section>

      {!projection.canContinue && (completionBlockReasons.length > 0 || canOfferContinue) ? (
        <section id={completionBlockersId} tabIndex={-1} className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="pcn-node-completion-blockers" aria-label="Lý do chưa thể hoàn tất bước">
          <h3 className="font-semibold">Chưa thể hoàn tất bước</h3>
          {projection.unresolvedRequiredCount > 0 ? <p className="mt-1 text-xs">Còn {projection.unresolvedRequiredCount} mục bắt buộc chưa được xử lý.</p> : null}
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {completionReasonsForDisplay.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}
          </ul>
        </section>
      ) : null}

      <div className="min-h-0 space-y-4 p-4">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Tài liệu và hồ sơ liên quan</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{projection.documents.length} mục</span>
              {onOpenDocuments ? <button type="button" className="mobile-touch-target dossier-action-compact min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={onOpenDocuments}>Mở toàn bộ tài liệu</button> : null}
            </div>
          </div>
          <div className="mt-3">
            <PgdcnDossierDocumentActionTable
              testId="pcn-dossier-document-action-table"
              rows={orderedDocuments.map((item) => ({
                id: item.requirementId,
                step: projection.nodeLabel,
                title: item.label,
                required: item.required,
                status: (DOCUMENT_STATUS_LABELS[item.status] || item.status),
                statusTone: ['PRESENT', 'CONFIRMED'].includes(item.status) ? 'success' : item.status === 'WAIVED' ? 'neutral' : 'warning',
                action: null,
              }))}
              renderRow={(row) => renderDocumentRow(orderedDocuments.find((item) => item.requirementId === row.id)!)}
            />
          </div>
        </section>

        {projection.businessFacts.length > 0 ? (
          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="mobile-touch-target cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-900">Việc nghiệp vụ <span className="ml-1 text-xs font-normal text-slate-500">({projection.businessFacts.length})</span></summary>
            <section className="border-t border-slate-100 p-3">
            <ul className="mt-3 space-y-2">
              {projection.businessFacts.map((fact) => (
                <li key={fact.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <p className="font-medium text-slate-900">{fact.label}</p>
                    {fact.reason ? <p className="mt-1 text-xs text-slate-500">{fact.reason}</p> : <p className="mt-1 text-xs text-emerald-700">Đã ghi nhận</p>}
                  </div>
                  {onOpenBusiness ? <button type="button" className="mobile-touch-target min-h-11 shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => onOpenBusiness(fact)}>{fact.actionLabel || 'Mở'}</button> : null}
                </li>
              ))}
            </ul>
            </section>
          </details>
        ) : null}

        {(canStart || canOfferContinue || canReturn) ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
            {canStart ? <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={busyKey === 'start'} onClick={() => void run('start', () => onStartTask!(taskId!))}>{busyKey === 'start' ? 'Đang bắt đầu…' : 'Bắt đầu xử lý'}</button> : null}
            {canReturn ? <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={busyKey === 'return'} onClick={() => setShowReturnForm((current) => !current)}>{busyKey === 'return' ? 'Đang trả về…' : 'Trả về'}</button> : null}
            {canOfferContinue ? <button type="button" title={canContinue ? 'Tiếp tục sang bước kế tiếp' : completionReasonsForDisplay.join(' ')} aria-label="Hoàn tất bước, tiếp tục sang bước kế tiếp" aria-describedby={!canContinue ? completionBlockersId : undefined} className="mobile-touch-target min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canContinue || busyKey === 'continue'} onClick={() => void run('continue', () => onCompleteTask!(taskId!, projection.cycleNo))}>{busyKey === 'continue' ? 'Đang hoàn tất…' : 'Hoàn tất bước'}</button> : null}
            {!canContinue && canOfferContinue ? <a href={`#${completionBlockersId}`} className="mobile-touch-target inline-flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">Xem lý do chưa thể hoàn tất</a> : null}
          </div>
        ) : null}

        {showReturnForm && canReturn ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3" data-testid="pcn-node-return-form">
            <p className="text-sm font-semibold text-rose-950">Trả hồ sơ về bước cần xử lý</p>
            <label className="mt-3 block text-xs font-semibold text-rose-950" htmlFor={`pcn-return-target-${projection.nodeId}`}>Bước nhận lại</label>
            <select id={`pcn-return-target-${projection.nodeId}`} className="mt-1 min-h-11 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500" value={returnTargetId} onChange={(event) => setReturnTargetId(event.target.value)}>
              <option value="">Chọn bước nhận lại</option>
              {returnTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </select>
            <label className="mt-3 block text-xs font-semibold text-rose-950" htmlFor={`pcn-return-reason-${projection.nodeId}`}>Lý do trả lại</label>
            <textarea id={`pcn-return-reason-${projection.nodeId}`} className="mt-1 min-h-20 w-full rounded-md border border-rose-200 bg-white p-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" className="mobile-touch-target min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setShowReturnForm(false)}>Hủy</button>
              <button type="button" className="mobile-touch-target min-h-11 rounded-md bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!returnTargetId || !returnReason.trim() || busyKey === 'return'} onClick={() => void run('return', async () => { await onReturnTask!(taskId!, { targetNodeId: returnTargetId, reason: returnReason.trim() }); setShowReturnForm(false); setReturnReason(''); })}>Xác nhận trả về</button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default PcnDossierNodeWorkPanel;
