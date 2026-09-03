'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, Eye, FileText, PackageCheck, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import type { ActivityLog, CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnCertificationField, PcnCertificationMethod, PcnDocumentRequirement, PcnDossierAttachment, PcnDossierDocument, PcnDossierStatus, PcnGeneratedDocument, PcnGeneratedDocumentFormat, PcnGeneratedDocumentKind, PcnOfficialGeneratedDocument, PcnOperationalFormKind, PcnSampleHandoverDetails, PcnSampleItem, PcnSampleLot, PcnSampleRoute, PcnTemplateDefinition, PcnUserAccount, ReturnedTestResult, UserAccount } from '../types';
import { activityActionLabels, activityEntityLabels } from '../utils/activityLog';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { buildPcnDossierCompleteness, buildPcnDossierStationChecklist, getPcnDossierStationScore, getPcnPipelineStation, getPcnPipelineStationByKey, type PcnPipelineStationKey } from '../utils/pcnDossierPipeline';
import { getPcnDossierStationGenerationKind, getPcnDossierStationTab, type PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import { buildPcnDossierInspection } from '../utils/pcnDossierInspection';
import { buildPcnDossierPackageSummary, type PcnDossierPackageSummary } from '../utils/pcnDossierPackage';
import { getPcnDocumentRequirements } from '../utils/pcnDossierDocuments';
import { getPcnActorDisplayName, getPcnUserDisplayName, PCN_NEUTRAL_USER_LABEL } from '../utils/pcnUserIdentity';
import { getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment';
import { getPcnDossierExceptionReasonDenial, getPcnDossierManualNextStatuses, getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { getPcnCodeFamilyLabel } from '../utils/pcnCodePolicy';
import { PcnFilePreviewButton } from './PcnDossierFilePreview';
import { PcnSampleFlowView } from './PcnSampleFlowView';
import { PcnLabRequestView } from './PcnLabRequestView';
import { PcnResultReturnView } from './PcnResultReturnView';
import { PcnIssuanceView } from './PcnIssuanceView';
import { PcnDocumentOutputModal } from './PcnDocumentOutputModal';
import { PcnProposalDetailModal } from './PcnProposalDetailModal';
import { PcnSampleHandoverModal } from './PcnSampleHandoverModal';
import { PCN_OPERATIONAL_FORM_LABELS, PcnOperationalFormModal, type PcnOperationalFormValue } from './PcnOperationalFormModal';
import { PcnWorkflowMap } from './PcnWorkflowMap';
import { buildPcnDossierWorkflowMap, type PcnDossierWorkflowMapProjection, type PcnWorkflowNode } from '../utils/pcnWorkflowMap';
import { getPcnOperationalFormKey, mergePcnOperationalForm } from '../utils/pcnOperationalForms';
import { canCreatePcnLabRequest, canProcessPcnOperationalForm, canProcessPcnSampleFlow, getPcnWorkflowStage } from '../utils/pcnWorkflowStages';
import { canProcessPcnDossierRequirement, getPcnDossierStageGateDenial } from '../utils/pcnDossierStageGate';
import { getPcnDossierStepAccess } from '../utils/pcnDossierStepAccess';
import type { PcnDossierUpdateInput } from '../utils/pcnDossierApi';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';

function pcnUserCatalogOption(user: PcnUserAccount, users: PcnUserAccount[]): PcnCatalogOption {
  return {
    value: user.username,
    label: getPcnUserDisplayName(user.username, users),
    searchText: [user.username, user.name, user.position, user.departmentRoleCode, user.systemRole].filter(Boolean).join(' '),
    description: [user.position, user.username].filter(Boolean).join(' · '),
  };
}

function pcnUserCatalogOptions(userList: PcnUserAccount[], users: PcnUserAccount[]): PcnCatalogOption[] {
  return userList.map((user) => pcnUserCatalogOption(user, users));
}

function pcnUnmatchedUserOption(value: string, options: PcnCatalogOption[]): PcnCatalogOption | undefined {
  return value && !options.some((option) => option.value === value)
    ? { value, label: `${PCN_NEUTRAL_USER_LABEL} (cần rà soát)`, searchText: value, description: value, disabled: true }
    : undefined;
}
import type { PcnDossierDocumentContext } from '../utils/pcnDocumentGeneration';
import type { PcnSampleLotDraft, PcnSampleRouteUpdate } from '../utils/pcnSampleFlow';
import type { PcnSignerDelegationInput } from '../utils/pcnSignerDelegationApi';
import type { PcnOfficialPreflightResponse } from '../utils/pcnOfficialDocumentApi';
import { usePcnStore } from '../store-pcn';

type DetailTab = PcnDossierDetailTab;
type DetailTabSelection = DetailTab | 'generation' | 'proposal' | 'attachments' | 'history';
// Bước sau bị khóa cho đến khi bước hiện tại đủ checklist và điều kiện.

function normalizeDetailTab(tab: DetailTabSelection): DetailTab {
  if (tab === 'generation' || tab === 'attachments') return 'documents';
  if (tab === 'proposal' || tab === 'history') return 'overview';
  return tab;
}

const tabs: Array<{ key: DetailTab; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Tổng quan', icon: FileText },
  { key: 'documents', label: 'Tài liệu hồ sơ', icon: Upload },
  { key: 'lab', label: 'Mẫu & PYC', icon: ArrowRight },
  { key: 'results', label: 'KQTN', icon: CheckCircle2 },
  { key: 'issuance', label: 'Phê duyệt', icon: PackageCheck },
];

const OPERATIONAL_FORM_ACTIONS: Array<{ kind: PcnOperationalFormKind; documentKind?: PcnGeneratedDocumentKind }> = [
  { kind: 'ASSIGNMENT_FORM', documentKind: 'ASSIGNMENT_FORM' },
  { kind: 'EVALUATION_PLAN', documentKind: 'EVALUATION_PLAN' },
  { kind: 'FIELD_INSPECTION', documentKind: 'FIELD_INSPECTION' },
  { kind: 'SAMPLE_TAKING', documentKind: 'SAMPLE_TAKING' },
  { kind: 'SAMPLE_CODING', documentKind: 'SAMPLE_CODING' },
  { kind: 'EVALUATION_REPORT', documentKind: 'EVALUATION_REPORT' },
  { kind: 'COMMERCIAL' },
];

function formatDate(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
}

function formatActivityValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function fieldName(fields: PcnCertificationField[], code: string): string {
  return fields.find((field) => field.code === code)?.name || code;
}

function FieldValue({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-700">{value || 'Chưa cập nhật'}</div></div>;
}

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

function ActivityHistory({ logs, users = [] }: { logs: ActivityLog[]; users?: PcnUserAccount[] }) {
  if (logs.length === 0) return <EmptyTab text="Chưa có hoạt động nào được ghi nhận cho hồ sơ này." />;
  return <div className="space-y-2">{logs.map((log) => <article key={log.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{activityActionLabels[log.action]}</span><span className="text-[10px] font-bold text-slate-600">{activityEntityLabels[log.entityType]}</span>{log.entityLabel && <span className="font-mono text-[10px] text-slate-400">{log.entityLabel}</span>}</div><time className="text-[10px] text-slate-400" dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></div><p className="mt-1 text-[11px] font-bold text-slate-700">{log.summary}</p><p className="mt-1 text-[10px] text-slate-500">Thực hiện bởi: <span className="font-bold text-slate-700">{getPcnActorDisplayName(log.actorName, log.actorUsername, users)}</span>{log.actorRole ? ` • ${log.actorRole}` : ''}</p>{log.changes && log.changes.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">{log.changes.map((change) => <div key={`${log.id}-${change.field}`} className="grid gap-1 text-[10px] sm:grid-cols-[minmax(100px,0.7fr)_1fr]"><span className="font-bold text-slate-500">{change.field}</span><span className="text-slate-600"><span className="text-rose-600">{formatActivityValue(change.before)}</span><span className="mx-1 text-slate-300">→</span><span className="text-emerald-700">{formatActivityValue(change.after)}</span></span></div>)}</div>}</article>)}</div>;
}

function DossierVisualChecklist({ dossierId, activeWorkflowNodeKey, fieldCodes, fields, requirements, documents, documentWaivers, users }: { dossierId: string; activeWorkflowNodeKey: string; fieldCodes: string[]; fields: PcnCertificationField[]; requirements: PcnDocumentRequirement[]; documents: PcnDossierDocument[]; documentWaivers?: CertificationDossier['documentWaivers']; users: PcnUserAccount[] }) {
  const inspection = buildPcnDossierInspection({ dossierId, fieldCodes, requirements, documents, documentWaivers, compact: true });
  if (inspection.summary.total === 0) return null;
  const { summary } = inspection;

  return <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" aria-labelledby="pcn-visual-checklist-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2"><Eye size={16} className="mt-0.5 shrink-0 text-indigo-600" /><div><h3 id="pcn-visual-checklist-title" className="text-xs font-black text-slate-900">Kiểm tra trực quan hồ sơ</h3><p className="mt-1 text-[10px] leading-4 text-slate-600">Bảng kiểm read-only theo từng bước. Chỉ phiên hiện tại hợp lệ mới được tính là đã có; tên file hoặc ngày cập nhật không tự làm tài liệu hợp lệ.</p></div></div><span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black text-indigo-700">Quản lý • Chỉ xem</span>
    </div>
    <div className="mt-3 grid gap-1.5 text-[9px] font-bold sm:grid-cols-4"><div className="rounded-md border border-emerald-100 bg-white px-2 py-1.5 text-emerald-700">Mục đã có <span className="font-black">{summary.present}/{summary.total}</span></div><div className="rounded-md border border-amber-100 bg-white px-2 py-1.5 text-amber-700">Còn thiếu <span className="font-black">{summary.missing}</span></div><div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-600">Đã bỏ qua <span className="font-black">{summary.waived || 0}</span></div><div className="rounded-md border border-rose-100 bg-white px-2 py-1.5 text-rose-700">Bắt buộc còn thiếu <span className="font-black">{summary.requiredMissing}/{summary.requiredTotal}</span></div></div>
    <p className="mt-2 text-[9px] text-indigo-700">Bước hiện tại mở sẵn; các bước khác thu gọn để dễ quét nhanh. Mục bỏ qua vẫn hiển thị lý do và được tính là đã xử lý cho cổng chuyển bước.</p>
    <div className="mt-3 space-y-2">{inspection.stations.map((step) => <details key={step.key} open={step.key === activeWorkflowNodeKey} className="rounded-lg border border-white bg-white/80"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-black text-slate-700"><span>Bước {step.number || '—'} · {step.label}</span><span className="flex flex-wrap items-center justify-end gap-1.5"><span className={`rounded-full px-2 py-0.5 ${step.missing > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{step.present}/{step.total} đã có{step.waived ? ` · ${step.waived} bỏ qua` : ''}</span><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">Điểm bước: {step.stationScore === null ? 'Không áp dụng' : `${step.stationScore}%`}</span></span></summary><div className="grid gap-1 border-t border-slate-100 p-2 md:grid-cols-2">{step.items.map((item) => <div key={`${step.key}-${item.requirement.id}`} className={`rounded-md border px-2 py-1.5 ${item.status === 'PRESENT' ? 'border-emerald-100 bg-emerald-50/50' : item.status === 'WAIVED' ? 'border-indigo-100 bg-indigo-50/50' : 'border-amber-100 bg-amber-50/50'}`}><div className="flex items-start gap-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'PRESENT' ? 'bg-emerald-500' : item.status === 'WAIVED' ? 'bg-indigo-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-1"><p className="text-[10px] font-bold leading-4 text-slate-700">{item.requirement.name}</p><span className={`shrink-0 text-[9px] font-black ${item.status === 'PRESENT' ? 'text-emerald-700' : item.status === 'WAIVED' ? 'text-indigo-700' : 'text-amber-700'}`}>{item.status === 'PRESENT' ? 'Đã có' : item.status === 'WAIVED' ? 'Đã bỏ qua' : 'Còn thiếu'}</span></div><p className="mt-0.5 text-[8px] text-slate-500">{fieldName(fields, item.requirement.fieldCode)} • {item.requirement.required ? 'Bắt buộc' : 'Điều kiện'} • {item.versionCount} phiên</p>{item.currentVersion ? <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-600"><a href={getPcnFileUrl(item.currentVersion.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline underline-offset-2">Mở file</a><PcnFilePreviewButton version={item.currentVersion} /><span>{item.currentVersion.fileName} • {formatDateTime(item.currentVersion.uploadedAt)} • Người tải: {getPcnUserDisplayName(item.currentVersion.uploadedBy, users)}</span></p> : item.status === 'WAIVED' ? <p className="mt-0.5 text-[9px] text-indigo-700">Lý do: {item.waiver?.reason}</p> : item.versionCount > 0 ? <p className="mt-0.5 text-[9px] font-bold text-amber-700">Đã có phiên lưu, chưa có phiên hiện tại hợp lệ.</p> : <p className="mt-0.5 text-[9px] text-amber-700">Chưa có phiên tài liệu.</p>}</div></div></div>)}</div></details>)}</div>
  </section>;
}

function missingRequiredDocumentSummary(completeness: ReturnType<typeof buildPcnDossierCompleteness>): string {
  return completeness.missingRequiredByStage
    .map((group) => `${group.label}: ${group.labels.join(', ')}`)
    .join(' · ');
}

function DossierWorkflowSummaryOverview({
  station,
  completeness,
  ownerLabel,
  exceptionReason,
  canEdit,
  onOpenExceptionReason,
  onOpenStep,
  onOpenChecklist,
  onOpenGeneration,
  onOpenApprovalModule,
  onOpenProposal,
  onCompleteStep,
  completionDisabled,
  completionTitle,
}: {
  station: PcnWorkflowNode;
  completeness: ReturnType<typeof buildPcnDossierCompleteness>;
  ownerLabel: string;
  exceptionReason?: string;
  canEdit: boolean;
  onOpenExceptionReason: () => void;
  onOpenStep: () => void;
  onOpenChecklist: () => void;
  onOpenGeneration: () => void;
  onOpenApprovalModule: () => void;
  onOpenProposal?: () => void;
  onCompleteStep: () => void;
  completionDisabled?: boolean;
  completionTitle?: string;
}) {
  const stationMissing = completeness.stationMissingLabels;
  const globalMissing = missingRequiredDocumentSummary(completeness);
  const missing = [
    ...(stationMissing.length > 0 ? [`Tài liệu còn thiếu tại bước: ${stationMissing.join(' • ')}`] : []),
    ...(globalMissing ? [`Tài liệu bắt buộc còn thiếu: ${globalMissing}`] : []),
  ];
  const codeReview = completeness.codeReview;

  return (
    <section className="rounded-lg border border-emerald-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
              Bước {station.number || 'ngoại lệ'}
            </span>
            <h2 className="text-sm font-black text-slate-900">{station.title}</h2>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{station.description}</p>
          <p className="mt-2 text-[10px] font-bold text-slate-700"><b>Việc tiếp theo:</b> {station.actionLabel}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-right">
          <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Mức hoàn thiện</div>
          <div className="text-xl font-black text-emerald-800">{completeness.score}%</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-4">
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Chủ hồ sơ</div><div className="mt-0.5 font-black text-slate-700">{ownerLabel}</div></div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Tài liệu bước</div><div className="mt-0.5 font-black text-slate-700">{station.key === 'EXCEPTIONS' ? 'Không áp dụng' : `${completeness.stationDocumentPresent}/${completeness.stationDocumentTotal} tài liệu bắt buộc`}</div></div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Dữ liệu lõi</div><div className="mt-0.5 font-black text-slate-700">{completeness.coreFieldPresent}/{completeness.coreFieldTotal} trường đã có</div></div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Điểm bước</div><div className="mt-0.5 font-black text-slate-700">{completeness.stationScore === null ? 'Không áp dụng' : `${completeness.stationScore}%`}</div></div>
      </div>

      <div data-testid="pcn-code-source-review" className={`mt-3 rounded-md border px-2.5 py-2 text-[10px] ${codeReview.needsReview ? 'border-amber-200 bg-amber-50/70 text-amber-800' : 'border-emerald-200 bg-emerald-50/70 text-emerald-800'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-black">Mã nguồn PCN · {getPcnCodeFamilyLabel(codeReview.family)}</span>
          <span className="font-black">{codeReview.needsReview ? 'Cần đối chiếu mã nguồn' : 'Đã nhận diện'}</span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-white/70 px-2 py-1.5"><div className="text-[9px] font-bold text-slate-500">Mã gốc</div><div className="mt-0.5 break-all font-mono font-bold">{codeReview.source || 'Chưa có mã Đề nghị'}</div></div>
          <div className="rounded-md bg-white/70 px-2 py-1.5"><div className="text-[9px] font-bold text-slate-500">Mã chuẩn hóa</div><div className="mt-0.5 break-all font-mono font-bold">{codeReview.normalized || 'Chưa có'}</div></div>
        </div>
        <p className="mt-2 text-[9px]">{codeReview.needsReview ? `${codeReview.message} Giữ nguyên mã gốc cho tới khi được đối chiếu.` : 'Mã chỉ được chuẩn hóa để hiển thị; giá trị nghiệp vụ gốc không bị thay đổi.'}</p>
      </div>

      {station.key === 'EXCEPTIONS' && <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] text-rose-800"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><b>Lý do ngoại lệ</b><p className="mt-1 break-words">{exceptionReason || 'Chưa ghi nhận lý do ngoại lệ trong dữ liệu cũ.'}</p></div>{canEdit && <button type="button" onClick={onOpenExceptionReason} className="shrink-0 rounded-md border border-rose-200 bg-white px-2 py-1 text-[9px] font-bold text-rose-700 hover:bg-rose-100">Cập nhật lý do</button>}</div></div>}

      {missing.length > 0 ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800"><b>Tài liệu còn thiếu:</b> {missing.join(' • ')}</p> : <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-800">Bước này đã đủ tài liệu bắt buộc.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenStep} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500"><ArrowRight size={12} /> {station.actionLabel}</button>
        <button type="button" onClick={onOpenChecklist} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><Upload size={12} /> Mở checklist</button>
        <button type="button" onClick={onOpenGeneration} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"><Download size={12} /> Mở sinh biểu mẫu</button>
        {onOpenProposal && <button type="button" onClick={onOpenProposal} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"><FileText size={12} /> Chi tiết Đề nghị</button>}
        {(station.key === 'APPROVAL' || station.key === 'ISSUANCE' || station.key === 'DELIVERY_ARCHIVE') && <button type="button" onClick={onOpenApprovalModule} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><PackageCheck size={12} /> Mở vùng phê duyệt / phát hành</button>}
        <button type="button" onClick={onCompleteStep} disabled={completionDisabled || !canEdit} title={completionTitle} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={12} /> Hoàn tất bước và chuyển bước</button>
      </div>
    </section>
  );
}

function DossierStationChecklist({ stationChecklist, users }: { stationChecklist: ReturnType<typeof buildPcnDossierStationChecklist>; users: PcnUserAccount[] }) {
  if (stationChecklist.items.length === 0) return null;
  return <section className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" aria-labelledby="pcn-workflow-step-checklist-title" data-testid="pcn-workflow-step-checklist">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 id="pcn-workflow-step-checklist-title" className="text-xs font-black text-slate-900">Tài liệu tại bước</h3><p className="mt-1 text-[10px] text-slate-600">Danh sách cần xử lý ngay tại bước {stationChecklist.station.number || 'ngoại lệ'}; gồm cả mục bắt buộc và mục điều kiện.</p><p className="mt-1 text-[10px] font-bold text-indigo-700">Checklist này để kiểm tra nhanh. Muốn tải phiên mới, mở “Chi tiết phiên và tải tài liệu” bên dưới.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${stationChecklist.requiredMissing > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{stationChecklist.present}/{stationChecklist.total} đã có{stationChecklist.items.filter((item) => item.status === 'WAIVED').length ? ` · ${stationChecklist.items.filter((item) => item.status === 'WAIVED').length} bỏ qua` : ''}</span><span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black text-indigo-700">Điểm bước: {getPcnDossierStationScore(stationChecklist) === null ? 'Không áp dụng' : `${getPcnDossierStationScore(stationChecklist)}%`}</span></div>
    </div>
    <div className="mt-2 grid gap-1.5 md:grid-cols-2">{stationChecklist.items.map((item) => <div key={item.requirement.id} className={`rounded-md border px-2.5 py-2 ${item.status === 'PRESENT' ? 'border-emerald-100 bg-emerald-50/60' : item.status === 'WAIVED' ? 'border-indigo-100 bg-indigo-50/60' : 'border-amber-100 bg-amber-50/60'}`}><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-start gap-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'PRESENT' ? 'bg-emerald-500' : item.status === 'WAIVED' ? 'bg-indigo-500' : 'bg-amber-500'}`} /><span className="min-w-0 text-[10px] font-bold leading-4 text-slate-700">{item.requirement.name}</span></div><span className={`shrink-0 text-[9px] font-black ${item.status === 'PRESENT' ? 'text-emerald-700' : item.status === 'WAIVED' ? 'text-indigo-700' : 'text-amber-700'}`}>{item.status === 'PRESENT' ? 'Đã có' : item.status === 'WAIVED' ? 'Đã bỏ qua' : 'Còn thiếu'}</span></div><div className="mt-1 flex flex-wrap items-center gap-1 text-[8px] text-slate-500"><span>{item.requirement.required ? 'Bắt buộc' : 'Điều kiện'}</span><span>•</span><span>{item.versionCount} phiên</span>{item.currentVersion && <><span>•</span><a href={getPcnFileUrl(item.currentVersion.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline">Mở file hiện tại</a><span>• {item.currentVersion.fileName} • {formatDateTime(item.currentVersion.uploadedAt)} • Người tải: {getPcnUserDisplayName(item.currentVersion.uploadedBy, users)}</span></>}{item.status === 'WAIVED' && item.waiver?.reason && <span className="text-indigo-700">• Lý do: {item.waiver.reason}</span>}</div></div>)}</div>
  </section>;
}

function DossierWorkflowSummary({ projection, selectedNodeKey, completeness, ownerLabel, exceptionReason, onSelectNode, onOpenExceptionReason, onOpenStep, onOpenChecklist, onOpenGeneration, onOpenApprovalModule, onOpenProposal, onCompleteStep, completionDisabled, completionTitle, canEdit, users }: { projection: PcnDossierWorkflowMapProjection; selectedNodeKey: PcnPipelineStationKey; completeness: ReturnType<typeof buildPcnDossierCompleteness>; ownerLabel: string; exceptionReason?: string; onSelectNode: (key: PcnPipelineStationKey) => void; onOpenExceptionReason: () => void; onOpenStep: () => void; onOpenChecklist: () => void; onOpenGeneration: () => void; onOpenApprovalModule: () => void; onOpenProposal?: () => void; onCompleteStep: () => void; completionDisabled?: boolean; completionTitle?: string; canEdit: boolean; users: PcnUserAccount[] }) {
  const currentNode = projection.nodes.find((node) => node.key === selectedNodeKey) || projection.currentNode;
  return <div className="space-y-2"><PcnWorkflowMap projection={projection} mode="dossier" selectedNodeKey={selectedNodeKey} onSelectNode={onSelectNode} /><DossierWorkflowSummaryOverview station={currentNode} completeness={completeness} ownerLabel={ownerLabel} exceptionReason={exceptionReason} canEdit={canEdit} onOpenExceptionReason={onOpenExceptionReason} onOpenStep={onOpenStep} onOpenChecklist={onOpenChecklist} onOpenGeneration={onOpenGeneration} onOpenApprovalModule={onOpenApprovalModule} onOpenProposal={onOpenProposal} onCompleteStep={onCompleteStep} completionDisabled={completionDisabled} completionTitle={completionTitle} /><DossierStationChecklist stationChecklist={completeness.stationChecklist} users={users} /></div>;
}

function DossierOwnerPanel({ ownerUsername, ownerOptions, users, canEdit, authorityHint, onChange }: { ownerUsername: string; ownerOptions: PcnUserAccount[]; users: PcnUserAccount[]; canEdit: boolean; authorityHint: string; onChange: (username: string) => void }) { const ownerCatalogOptions = pcnUserCatalogOptions(ownerOptions, users); const unmatchedOwnerOption = pcnUnmatchedUserOption(ownerUsername, ownerCatalogOptions);
  return <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-emerald-900">Chủ hồ sơ</h3><p className="mt-1 text-[10px] text-emerald-800">Một nhân viên PCN chịu trách nhiệm xuyên suốt từ Đề nghị, hồ sơ liên quan, đóng gói đến trình lãnh đạo.</p><p className="mt-1 text-[9px] text-emerald-700">{authorityHint}</p></div>{!canEdit && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500">Chỉ xem</span>}</div>{canEdit ? <label className="mt-3 block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-emerald-700">Giao chủ hồ sơ</span><PcnCatalogCombobox id="pcn-dossier-owner" label="Giao chủ hồ sơ" hideLabel value={ownerUsername} onChange={onChange} options={ownerCatalogOptions} unmatchedOption={unmatchedOwnerOption} placeholder={ownerCatalogOptions.length > 0 ? "Tìm tên hoặc tài khoản..." : "Chưa có người phù hợp"} /></label> : <p className="mt-2 text-[11px] font-black text-emerald-900">{ownerUsername ? getPcnUserDisplayName(ownerUsername, users) : 'Chưa phân công'}</p>}</section>;
}

function DossierRegionSelector({ activeTab, missingRequiredCount, onChange }: { activeTab: DetailTab; missingRequiredCount: number; onChange: (tab: DetailTab) => void }) {
  const selectableTabs = tabs;
  const activeLabel = selectableTabs.find(({ key }) => key === activeTab)?.label || 'Tổng quan';
  const openDocumentCompletion = () => {
    onChange('documents');
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]:not(:disabled)');
        const card = fileInput?.closest('[data-document-requirement]');
        if (card instanceof HTMLElement) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.focus({ preventScroll: true });
        }
      });
    });
  };
  return <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><label htmlFor="pcn-dossier-region" className="shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-500">Khu vực hồ sơ</label><select id="pcn-dossier-region" aria-label="Khu vực hồ sơ" value={activeTab} onChange={(event) => onChange(event.target.value as DetailTab)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-emerald-400"><option value={activeTab}>{activeLabel}{activeTab === 'documents' && missingRequiredCount > 0 ? ` · ${missingRequiredCount} thiếu` : ''}</option>{selectableTabs.filter(({ key }) => key !== activeTab).map(({ key, label }) => <option key={key} value={key}>{label}{key === 'documents' && missingRequiredCount > 0 ? ` · ${missingRequiredCount} thiếu` : ''}</option>)}</select><button type="button" onClick={openDocumentCompletion} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"><Upload size={13} /> Bổ sung tài liệu{missingRequiredCount > 0 ? ` · ${missingRequiredCount} thiếu` : null}</button><span className="hidden text-[9px] text-slate-400 sm:inline">Dùng bản đồ quy trình phía trên để mở đúng bước tiếp theo.</span></div>;
}

function formatPackageBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function DossierPackageSummary({ summary }: { summary: PcnDossierPackageSummary }) {
  return <details className="shrink-0 border-b border-slate-200 bg-white" data-testid="pcn-dossier-package-summary"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span className="inline-flex min-w-0 items-center gap-1.5"><PackageCheck size={14} className="shrink-0 text-emerald-600" /><span className="truncate">Danh sách bộ hồ sơ</span></span><span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-600">{summary.totalAssetCount} tệp</span></summary><div className="border-t border-slate-100 bg-slate-50/70 px-3 pb-3 pt-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-slate-800">Tóm tắt thành phần</p><p className="text-[9px] text-slate-500">Dung lượng biết được: <b>{formatPackageBytes(summary.knownByteSize)}</b>{summary.unknownByteCount > 0 ? ` · ${summary.unknownByteCount} tệp chưa có metadata dung lượng` : ''}</p></div><div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{summary.groups.map((group) => <div key={group.category} className="rounded-md border border-slate-200 bg-white px-2.5 py-2"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-[9px] font-bold text-slate-600">{group.label}</span><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${group.assetCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{group.assetCount}</span></div><p className="mt-1 text-[9px] text-slate-400">{group.assetCount === 0 ? 'Chưa có tệp' : `${formatPackageBytes(group.knownByteSize)} đã biết${group.unknownByteCount > 0 ? ` · ${group.unknownByteCount} chưa rõ` : ''}`}</p></div>)}</div><p className="mt-2 text-[9px] leading-4 text-slate-500">Bảng này chỉ là projection từ snapshot hiện tại. Khi tải ZIP, server sẽ dựng lại danh sách và kiểm tra provenance, byte size và SHA-256 lần cuối.</p></div></details>;
}

export function PcnDossierDetailView({ dossier, proposal, fields, templates, labRequests, results, approvalSteps, issuancePackages, activityLogs, documentRequirements, dossierDocuments, dossierAttachments, generatedDocuments, officialDocuments, signerDelegations, sampleLots, sampleItems = [], sampleRoutes, users, currentUser, onUploadDocument, onUpdateStatus, onUpdateDossier, canEditMilestones, onPreflight, onGenerateDocuments, onConfirmGenerated, onDownloadPackage, onClose, initialTab, onCreateSampleLot, onUpdateSampleRoute, onSaveLabRequest, onUpdateLabRequest, onDispatchLabRequest, onReconcileLabRequest, onSaveHandover, onSaveResult, onAttachResultFile, onPrepareIssuance, onApproveStep, onIssue, onDeliver, onArchive, onWithdraw, onAttachIssuanceFile, onPreflightOfficialDocuments, onGenerateOfficialDocuments, onCreateSignerDelegation, onRevokeSignerDelegation }: { dossier: CertificationDossier; proposal?: CertificationProposal; fields: PcnCertificationField[]; templates: PcnTemplateDefinition[]; labRequests: OutboundLabRequest[]; results: ReturnedTestResult[]; approvalSteps: PcnApprovalStep[]; issuancePackages: IssuancePackage[]; activityLogs: ActivityLog[]; documentRequirements: PcnDocumentRequirement[]; dossierDocuments: PcnDossierDocument[]; dossierAttachments: PcnDossierAttachment[]; generatedDocuments: PcnGeneratedDocument[]; officialDocuments: PcnOfficialGeneratedDocument[]; signerDelegations: import('../types').PcnSignerDelegation[]; sampleLots: PcnSampleLot[]; sampleItems?: PcnSampleItem[]; sampleRoutes: PcnSampleRoute[]; users: PcnUserAccount[]; currentUser: UserAccount; onUploadDocument: (requirementId: string, file: File) => Promise<void>; onUpdateStatus: (status: PcnDossierStatus, exceptionReason?: string) => Promise<void>; onUpdateDossier: (updates: PcnDossierUpdateInput) => Promise<void>; canEditMilestones: boolean; onPreflight: (kind: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => Promise<PcnDossierDocumentContext>; onGenerateDocuments: (kind: PcnGeneratedDocumentKind, formats: PcnGeneratedDocumentFormat[], sampleRouteId?: string, expectedContextHash?: string, labRequestId?: string) => Promise<PcnGeneratedDocument[]>; onConfirmGenerated?: (generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => Promise<void>; onDownloadPackage: () => void | Promise<void>; onClose: () => void; initialTab?: PcnDossierDetailTab; onCreateSampleLot: (draft: PcnSampleLotDraft) => Promise<void>; onUpdateSampleRoute: (routeId: string, status: PcnSampleRoute['status'], update?: PcnSampleRouteUpdate) => Promise<void>; onSaveLabRequest: (request: OutboundLabRequest) => Promise<void>; onUpdateLabRequest: (requestId: string, status: OutboundLabRequest['status'], updates?: Partial<Pick<OutboundLabRequest, 'handoverAt' | 'receivedAt' | 'handoverNote' | 'handoverDocumentId' | 'handoverDetails' | 'sampleIssue'>>) => Promise<void>; onDispatchLabRequest?: (requestId: string) => Promise<void>; onReconcileLabRequest?: (requestId: string) => Promise<void>; onSaveHandover?: (request: OutboundLabRequest, details: PcnSampleHandoverDetails) => Promise<void>; onSaveResult: (result: ReturnedTestResult) => Promise<void>; onAttachResultFile: (resultId: string, file: File) => Promise<void>; onPrepareIssuance: (dossier: CertificationDossier) => Promise<void>; onApproveStep: (stepId: string, decision: 'APPROVE' | 'RETURN', comment?: string) => Promise<void>; onIssue: (issuanceId: string, input: { issuanceNumber: string; signerUsername: string; issuedAt?: string }) => Promise<void>; onDeliver: (issuanceId: string, input: { recipient: string; deliveredAt?: string; note?: string }) => Promise<void>; onArchive: (issuanceId: string) => Promise<void>; onWithdraw: (issuanceId: string, reason: string) => Promise<void>; onAttachIssuanceFile: (issuanceId: string, file: File) => Promise<void>; onPreflightOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[]) => Promise<PcnOfficialPreflightResponse>; onGenerateOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[], expectedContextHash?: string) => Promise<PcnOfficialGeneratedDocument[]>; onCreateSignerDelegation: (input: PcnSignerDelegationInput) => Promise<void>; onRevokeSignerDelegation: (id: string) => Promise<void>; }) {
  const [activeTab, setActiveTabState] = useState<DetailTab>(normalizeDetailTab(initialTab || 'documents'));
  const setActiveTab = (nextTab: DetailTabSelection) => setActiveTabState(normalizeDetailTab(nextTab));
  const [documentOutput, setDocumentOutput] = useState<{ kind: PcnGeneratedDocumentKind; sampleRouteId?: string; labRequestId?: string } | null>(null);
  const [proposalDetailOpen, setProposalDetailOpen] = useState(false);
  const [operationalFormOpen, setOperationalFormOpen] = useState<PcnOperationalFormKind | null>(null);
  const [handoverRouteId, setHandoverRouteId] = useState<string | null>(null);
  const openGenerationRegion = () => {
    setDocumentOutput({ kind: getPcnDossierStationGenerationKind(station.key, dossier.status) });
  };
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingRequirementId, setUploadingRequirementId] = useState<string | null>(null);
  const [waiverRequirementId, setWaiverRequirementId] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [method, setMethod] = useState<PcnCertificationMethod>(dossier.method);
  const [ownerUsername, setOwnerUsername] = useState(dossier.ownerUsername || '');
  const [exceptionReason, setExceptionReason] = useState(dossier.exceptionReason || '');
  const [evaluatorUsername, setEvaluatorUsername] = useState(dossier.evaluatorUsername || '');
  const [reviewerUsername, setReviewerUsername] = useState(dossier.reviewerUsername || '');
  const [targetDate, setTargetDate] = useState(dossier.targetDate?.slice(0, 10) || '');
  const [evaluationAt, setEvaluationAt] = useState(dossier.evaluationAt?.slice(0, 10) || '');
  const [effectiveAt, setEffectiveAt] = useState(dossier.effectiveAt?.slice(0, 10) || '');
  const dossierRequests = labRequests.filter((request) => request.dossierId === dossier.id);
  const dossierResults = results.filter((result) => result.dossierId === dossier.id);
  const dossierApprovalSteps = approvalSteps.filter((step) => step.dossierId === dossier.id).sort((left, right) => left.sequence - right.sequence);
  const issuance = issuancePackages.find((item) => item.dossierId === dossier.id);
  const requirements = documentRequirements.length ? getPcnDocumentRequirements(dossier.fieldCodes, documentRequirements) : [];
  const documentsByRequirement = new Map(dossierDocuments.filter((item) => item.dossierId === dossier.id).map((item) => [item.requirementId, item]));
  const dossierDocumentsForCompleteness = dossierDocuments.filter((item) => item.dossierId === dossier.id);
  const baseCompleteness = buildPcnDossierCompleteness({ dossier, proposal, requirements, documents: dossierDocumentsForCompleteness });
  const currentStation = getPcnWorkflowStage(dossier.status)
    ? getPcnPipelineStationByKey(getPcnWorkflowStage(dossier.status)!.key)
    : getPcnPipelineStation(dossier.status);
  const [selectedWorkflowNodeKey, setSelectedWorkflowNodeKey] = useState<PcnPipelineStationKey>(currentStation.key);
  const station = getPcnPipelineStationByKey(selectedWorkflowNodeKey);
  const selectedStationChecklist = buildPcnDossierStationChecklist({ dossierId: dossier.id, status: dossier.status, stationKey: selectedWorkflowNodeKey, workflowStageKey: selectedWorkflowNodeKey, fieldCodes: dossier.fieldCodes, requirements, documents: dossierDocumentsForCompleteness, documentWaivers: dossier.documentWaivers });
  const completeness = {
    ...baseCompleteness,
    stationChecklist: selectedStationChecklist,
    stationScore: getPcnDossierStationScore(selectedStationChecklist),
    stationDocumentTotal: selectedStationChecklist.requiredTotal,
    stationDocumentPresent: selectedStationChecklist.requiredPresent,
    stationMissingLabels: selectedStationChecklist.items.filter((item) => item.requirement.required && item.status === 'MISSING').map((item) => item.requirement.name),
  };
  const ownerLabel = dossier.ownerUsername ? getPcnUserDisplayName(dossier.ownerUsername, users) : 'Chưa phân công';
  const dossierInspection = buildPcnDossierInspection({ dossierId: dossier.id, fieldCodes: dossier.fieldCodes, requirements, documents: dossierDocumentsForCompleteness, documentWaivers: dossier.documentWaivers, compact: true });
  const missingRequiredCount = dossierInspection.summary.requiredMissing;
  const attachmentIds = [...dossierResults.flatMap((result) => result.fileAssetId ? [result.fileAssetId] : []), ...(issuance?.fileAssetIds || [])];
  const dossierAttachmentsForPackage = dossierAttachments.filter((attachment) => attachment.dossierId === dossier.id).sort((left, right) => left.fileName.localeCompare(right.fileName, 'vi'));
  const exceptionReasonLabel = dossier.exceptionReason?.trim();
  const generationKind = getPcnDossierStationGenerationKind(station.key, dossier.status);
  const dossierEntityIds = new Set<string>([dossier.id, proposal?.id, ...dossierRequests.map((request) => request.id), ...dossierResults.map((result) => result.id), ...dossierApprovalSteps.map((step) => step.id), issuance?.id].filter((id): id is string => Boolean(id)));
  const dossierActivityLogs = activityLogs.filter((log) => Boolean(log.entityId && dossierEntityIds.has(log.entityId))).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  const dossierWorkflowProjection = buildPcnDossierWorkflowMap({ dossier, proposal, activityLogs: dossierActivityLogs, requirements, documents: dossierDocumentsForCompleteness, compact: true });
  const currentStepAccess = getPcnDossierStepAccess({ dossier, targetStageKey: dossierWorkflowProjection.currentNodeKey, actorUsername: currentUser.username });
  const selectedStepAccess = getPcnDossierStepAccess({ dossier, targetStageKey: selectedWorkflowNodeKey, actorUsername: currentUser.username });
  const canEditDossierSteps = canEditMilestones && selectedStepAccess.editable;
  const canCompleteCurrentStep = canEditMilestones
    && currentStepAccess.editable
    && selectedWorkflowNodeKey === dossierWorkflowProjection.currentNodeKey;
  const canManageWaiver = canEditDossierSteps && String(currentUser.departmentRoleCode || '').trim().toUpperCase() === 'LEADERSHIP';
  const nextStatuses = canCompleteCurrentStep ? getPcnDossierManualNextStatuses(dossier.status) : [];
  const nextStatusDenials: Map<string, string | null> = new Map(nextStatuses.map((status) => [status, getPcnDossierStageGateDenial({ dossier, nextStatus: status, requirements, documents: dossierDocumentsForCompleteness, documentWaivers: dossier.documentWaivers })]));
  if (canEditDossierSteps && dossier.status === 'TECHNICAL_REVIEW') {
    nextStatusDenials.set('WAITING_APPROVAL', getPcnDossierStageGateDenial({ dossier, nextStatus: 'WAITING_APPROVAL', requirements, documents: dossierDocumentsForCompleteness, documentWaivers: dossier.documentWaivers }));
  }
  const requiresIssuanceLifecycleAction = ['TECHNICAL_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'ISSUED', 'DELIVERED'].includes(dossier.status);
  const issuanceLifecycleActionLabel = dossier.status === 'TECHNICAL_REVIEW'
    ? 'lập bộ trình duyệt'
    : dossier.status === 'WAITING_APPROVAL'
      ? 'phê duyệt hồ sơ'
      : dossier.status === 'APPROVED'
        ? 'cấp số phát hành'
        : dossier.status === 'ISSUED'
          ? 'giao khách hàng'
          : 'lưu trữ';
  const customerSnapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
  const evaluatorOptions = users.filter((user) => {
    const role = user.systemRole || user.role;
    const fieldMatch = dossier.fieldCodes.length === 0 || user.fieldCodes.some((code) => dossier.fieldCodes.includes(code));
    return user.active && role !== 'viewer' && fieldMatch;
  }).sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  const reviewerOptions = evaluatorOptions;
  const currentUserRole = String(currentUser.systemRole || currentUser.role || '').trim().toLowerCase();
  const canManageOwner = currentUserRole === 'admin' || String(currentUser.departmentRoleCode || '').trim().toUpperCase() === 'LEADERSHIP';
  const canEditOwner = canEditMilestones && !currentStepAccess.requiresWithdrawal && (canManageOwner || !dossier.ownerUsername);
  const ownerOptions = canManageOwner
    ? evaluatorOptions
    : evaluatorOptions.filter((user) => user.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase());
  const ownerAuthorityHint = canManageOwner
    ? 'Admin/Lãnh đạo có thể điều phối hoặc chuyển chủ hồ sơ trong phạm vi Lĩnh vực.'
    : 'Nhân viên chỉ có thể tự nhận hồ sơ đang chưa có chủ; hồ sơ đã phân công là chỉ xem.';
  const packageSummary = buildPcnDossierPackageSummary({
    documents: dossierDocumentsForCompleteness,
    attachments: dossierAttachmentsForPackage,
    generatedDocuments: generatedDocuments.filter((document) => document.dossierId === dossier.id),
    officialDocuments: officialDocuments.filter((document) => document.dossierId === dossier.id),
    returnedResults: dossierResults,
    issuancePackages: issuance ? [issuance] : [],
  });
  const confirmGeneratedDocument = onConfirmGenerated || ((generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => usePcnStore.getState().confirmGeneratedDocument(dossier.id, generated, requirement));
  const selectedHandoverRoute = handoverRouteId ? sampleRoutes.find((route) => route.id === handoverRouteId) : undefined;
  const selectedHandoverLot = selectedHandoverRoute ? sampleLots.find((lot) => lot.id === selectedHandoverRoute.sampleLotId && lot.dossierId === dossier.id) : undefined;
  const selectedHandoverRequest = selectedHandoverRoute ? dossierRequests.find((request) => request.id === selectedHandoverRoute.labRequestId || request.sampleRouteId === selectedHandoverRoute.id) : undefined;
  const openDocumentOutput = (kind: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => {
    setDocumentOutput({ kind, sampleRouteId, labRequestId });
  };

  const saveOperationalForm = async (kind: PcnOperationalFormKind, value: PcnOperationalFormValue) => {
    if (!canEditDossierSteps) {
      toast.error(currentStepAccess.reason || 'Bạn không có quyền hoàn thiện bước này.');
      return;
    }
    if (!canProcessPcnOperationalForm(dossier, kind)) {
      toast.error('Biểu mẫu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.');
      return;
    }
    const operationalForms = mergePcnOperationalForm({}, kind, value);
    await onUpdateDossier({ operationalForms });
    toast.success(`Đã lưu ${PCN_OPERATIONAL_FORM_LABELS[kind].toLowerCase()} vào hồ sơ.`);
  };

  useEffect(() => {
    setMethod(dossier.method);
    setOwnerUsername(dossier.ownerUsername || '');
    setExceptionReason(dossier.exceptionReason || '');
    setEvaluatorUsername(dossier.evaluatorUsername || '');
    setReviewerUsername(dossier.reviewerUsername || '');
    setTargetDate(dossier.targetDate?.slice(0, 10) || '');
    setEvaluationAt(dossier.evaluationAt?.slice(0, 10) || '');
    setEffectiveAt(dossier.effectiveAt?.slice(0, 10) || '');
  }, [dossier.id, dossier.method, dossier.ownerUsername, dossier.exceptionReason, dossier.evaluatorUsername, dossier.reviewerUsername, dossier.targetDate, dossier.evaluationAt, dossier.effectiveAt]);

  useEffect(() => {
    setActiveTab(initialTab || getPcnDossierStationTab(currentStation.key));
  }, [dossier.id, dossier.status, initialTab, currentStation.key]);

  useEffect(() => {
    setSelectedWorkflowNodeKey(currentStation.key);
  }, [dossier.id, dossier.status, currentStation.key]);

  const changeStatus = async (status: PcnDossierStatus) => {
    if (isUpdating) return;
    if (!canCompleteCurrentStep) return;
    let nextExceptionReason: string | undefined;
    if (['ON_HOLD', 'REJECTED', 'CANCELLED'].includes(status)) {
      const prompted = typeof window !== 'undefined'
        ? window.prompt('Lý do ngoại lệ (bắt buộc):', status === dossier.status ? exceptionReason : '')
        : null;
      if (prompted === null) return;
      nextExceptionReason = prompted.trim();
      const denial = getPcnDossierExceptionReasonDenial(status, nextExceptionReason);
      if (denial) {
        toast.error(denial);
        return;
      }
    }
    setIsUpdating(true);
    try { await onUpdateStatus(status, nextExceptionReason); toast.success(`Hồ sơ đã chuyển sang ${getPcnDossierStatusLabel(status)}.`); } catch (error: any) { toast.error(error?.message || 'Không thể cập nhật trạng thái hồ sơ'); } finally { setIsUpdating(false); }
  };

  const editExceptionReason = async () => {
    if (!canEditMilestones || currentStation.key !== 'EXCEPTIONS' || isUpdating) return;
    const prompted = typeof window !== 'undefined'
      ? window.prompt('Lý do ngoại lệ (bắt buộc):', exceptionReason)
      : null;
    if (prompted === null) return;
    const nextExceptionReason = prompted.trim();
    const denial = getPcnDossierExceptionReasonDenial(dossier.status, nextExceptionReason);
    if (denial) {
      toast.error(denial);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateDossier({ exceptionReason: nextExceptionReason });
      toast.success('Đã cập nhật lý do ngoại lệ.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật lý do ngoại lệ');
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadRequirement = async (requirement: PcnDocumentRequirement, file?: File) => {
    if (!canEditDossierSteps || !file || uploadingRequirementId !== null) return;
    if (!canProcessPcnDossierRequirement(dossier, requirement)) {
      toast.error('Tài liệu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.');
      return;
    }
    setUploadingRequirementId(requirement.id);
    try { await onUploadDocument(requirement.id, file); toast.success(`Đã thêm phiên tài liệu: ${requirement.name}.`); } catch (error: any) { toast.error(error?.message || 'Không thể tải tài liệu hồ sơ'); } finally { setUploadingRequirementId(null); }
  };

  const saveDocumentWaiver = async (requirementId: string) => {
    const reason = waiverReason.trim();
    if (!canManageWaiver || !reason || isUpdating) {
      if (!canManageWaiver) toast.error('Chỉ Lãnh đạo được duyệt waiver tài liệu.');
      return;
    }
    const requirement = requirements.find((item) => item.id === requirementId);
    if (requirement && !canProcessPcnDossierRequirement(dossier, requirement)) {
      toast.error('Chỉ được đánh dấu bỏ qua tài liệu của bước hiện tại hoặc bước đã qua.');
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateDossier({ documentWaivers: { [requirementId]: { reason } } });
      setWaiverRequirementId(null);
      setWaiverReason('');
      toast.success('Đã đánh dấu bỏ qua tài liệu và lưu lý do.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu đánh dấu bỏ qua tài liệu');
    } finally {
      setIsUpdating(false);
    }
  };

  const clearDocumentWaiver = async (requirementId: string) => {
    if (!canManageWaiver || isUpdating) return;
    const requirement = requirements.find((item) => item.id === requirementId);
    if (requirement && !canProcessPcnDossierRequirement(dossier, requirement)) {
      toast.error('Chỉ được cập nhật tài liệu của bước hiện tại hoặc bước đã qua.');
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateDossier({ documentWaivers: { [requirementId]: null } });
      toast.success('Đã bỏ đánh dấu bỏ qua tài liệu.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể bỏ đánh dấu tài liệu');
    } finally {
      setIsUpdating(false);
    }
  };

  const selectWorkflowNode = (nodeKey: PcnPipelineStationKey) => {
    setSelectedWorkflowNodeKey(nodeKey);
    setActiveTab(getPcnDossierStationTab(nodeKey));
  };

  const completionTarget = dossier.status === 'TECHNICAL_REVIEW' || getPcnWorkflowStage(dossier.status)?.key === 'APPROVAL'
    ? undefined
    : nextStatuses.find((status) => getPcnWorkflowStage(status)?.key !== getPcnWorkflowStage(dossier.status)?.key) || nextStatuses[0];
  const completeCurrentStep = async () => {
    if (!canCompleteCurrentStep) {
      toast.error(currentStepAccess.reason || 'Bước này đang bị khóa.');
      return;
    }
    if (dossier.status === 'TECHNICAL_REVIEW') {
      if (nextStatusDenials.get('WAITING_APPROVAL')) {
        toast.error(nextStatusDenials.get('WAITING_APPROVAL') || 'Chưa đủ điều kiện trình phê duyệt.');
        return;
      }
      await onPrepareIssuance(dossier);
      return;
    }
    if (!completionTarget) {
      setActiveTab('issuance');
      return;
    }
    await changeStatus(completionTarget);
  };

  const openSelectedWorkflowStep = () => {
    setActiveTab(getPcnDossierStationTab(selectedWorkflowNodeKey));
  };

  const documentTab = <div className="space-y-3"><DossierVisualChecklist dossierId={dossier.id} activeWorkflowNodeKey={station.key} fieldCodes={dossier.fieldCodes} fields={fields} requirements={requirements} documents={dossierDocumentsForCompleteness} documentWaivers={dossier.documentWaivers} users={users} /><div className={`rounded-lg border p-3 text-[10px] ${missingRequiredCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><b>{missingRequiredCount > 0 ? `Còn ${missingRequiredCount} tài liệu bắt buộc chưa có` : 'Checklist tài liệu đã đủ hoặc đã có đánh dấu bỏ qua'}</b><span className="ml-1">Không thể sang bước sau nếu còn mục bắt buộc chưa xử lý.</span>{!canEditDossierSteps && <span className="ml-1 font-bold">Chỉ xem.</span>}</div>{requirements.length === 0 ? <EmptyTab text="Hồ sơ chưa có cấu hình tài liệu theo Lĩnh vực." /> : <details open data-testid="pcn-document-history" className="rounded-lg border border-slate-200 bg-white"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span>Chi tiết phiên và tải tài liệu</span><span className="text-[9px] font-bold text-slate-400">Văn bản và nút tải hiển thị ngay</span></summary><div className="space-y-2 border-t border-slate-100 p-2">{requirements.map((requirement) => { const canProcessRequirement = canProcessPcnDossierRequirement(dossier, requirement); const document = documentsByRequirement.get(requirement.id); const waiver = dossier.documentWaivers?.[requirement.id]; const versions = document?.versions || []; const current = versions.find((version) => version.assetId === document?.currentVersionId); return <article id={`pcn-dossier-requirement-${requirement.id}`} data-document-requirement={requirement.id} tabIndex={-1} key={requirement.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-black text-slate-800">{requirement.name}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${current ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : waiver?.reason ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{current ? 'Đã có' : waiver?.reason ? 'Đã bỏ qua' : 'Thiếu'}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{requirement.required ? 'Bắt buộc' : 'Điều kiện'}</span>{!canProcessRequirement && <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Chưa đến bước</span>}</div><p className="mt-1 text-[10px] text-slate-500">{fieldName(fields, requirement.fieldCode)} • Giai đoạn: {requirement.stages.join(', ')}</p>{current && <p className="mt-1 text-[10px] text-slate-600">Hiện tại: <a href={getPcnFileUrl(current.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline">{current.fileName}</a> • {formatDateTime(current.uploadedAt)}{current.uploadedBy ? ` • Người tải: ${getPcnUserDisplayName(current.uploadedBy, users)}` : ''}</p>}{waiver?.reason && !current && <p className="mt-1 text-[10px] text-indigo-700"><b>Lý do bỏ qua:</b> {waiver.reason} • {formatDateTime(waiver.decidedAt)} • {getPcnUserDisplayName(waiver.decidedBy || waiver.decidedByUsername, users)}</p>}{versions.length > 1 && <details className="mt-2 text-[10px] text-slate-500"><summary className="cursor-pointer font-bold">Lịch sử {versions.length} phiên</summary><div className="mt-1 space-y-1">{versions.map((version, index) => <div key={`${version.assetId}-${index}`} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-1"><span>V{index + 1} • {version.fileName}</span><a href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Mở</a></div>)}</div></details>}{!current && canManageWaiver && canProcessRequirement && <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => { setWaiverRequirementId(requirement.id); setWaiverReason(waiver?.reason || ''); }} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[9px] font-black text-indigo-700 hover:bg-indigo-100">{waiver ? 'Sửa đánh dấu bỏ qua' : 'Đánh dấu bỏ qua'}</button>{waiver && <button type="button" onClick={() => void clearDocumentWaiver(requirement.id)} disabled={isUpdating} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Bỏ đánh dấu</button>}</div>}{waiverRequirementId === requirement.id && canManageWaiver && <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/60 p-2"><label className="block"><span className="mb-1 block text-[9px] font-black text-indigo-800">Lý do bỏ qua tài liệu (bắt buộc)</span><textarea value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} rows={2} maxLength={1000} className="w-full rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-indigo-400" placeholder="Nêu rõ vì sao tài liệu không phát sinh hoặc chưa cần ở hồ sơ này." /></label><div className="mt-1.5 flex justify-end gap-1.5"><button type="button" onClick={() => { setWaiverRequirementId(null); setWaiverReason(''); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600">Hủy</button><button type="button" onClick={() => void saveDocumentWaiver(requirement.id)} disabled={isUpdating || !waiverReason.trim()} className="rounded-md bg-indigo-600 px-2 py-1.5 text-[9px] font-black text-white disabled:opacity-50">Lưu đánh dấu</button></div></div>}</div>{canEditDossierSteps && (canProcessRequirement ? <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"><Upload size={12} /> {uploadingRequirementId === requirement.id ? 'Đang tải…' : current ? 'Thay phiên bản' : 'Bổ sung file'}<input type="file" className="hidden" disabled={!canEditDossierSteps || uploadingRequirementId !== null} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadRequirement(requirement, file); }} /></label> : <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-500">Chưa đến bước hiện tại</span>)}</div></article>; })}</div></details>}</div>;

  const attachmentContent = dossierAttachmentsForPackage.length === 0 && attachmentIds.length === 0 ? <EmptyTab text="Chưa có tệp liên kết từ hồ sơ, KQTN hoặc phát hành." /> : <div className="space-y-2">{dossierAttachmentsForPackage.map((attachment) => <div key={attachment.id} className="rounded-lg border border-slate-200 bg-white p-3 text-[10px]"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{attachment.kind}</span>{attachment.requirementId && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[9px] text-slate-500">{attachment.requirementId}</span>}<span className="truncate font-bold text-slate-700">{attachment.fileName}</span></div><a href={getPcnFileUrl(attachment.assetId)} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-indigo-600 underline underline-offset-2">Mở file</a></div></div>)}{attachmentIds.map((assetId) => <div key={assetId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-[10px]"><span className="font-bold text-slate-700">File asset liên kết</span><a href={getPcnFileUrl(assetId)} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 underline underline-offset-2">{assetId} · Mở file</a></div>)}</div>;
  const operationalFormsSection = <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" data-testid="pcn-operational-forms"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-slate-900">Biểu mẫu theo bước</h3><p className="mt-1 text-[10px] leading-4 text-slate-600">Mỗi bước nhập dữ liệu ngay trong card hồ sơ. Lưu xong có thể sinh DOCX/PDF từ dữ liệu đã xác nhận; KQTN vẫn chỉ nhận bản scan và OCR từ phòng thử nghiệm.</p></div><span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black text-emerald-700">{Object.keys(dossier.operationalForms || {}).length}/7 đã nhập</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{OPERATIONAL_FORM_ACTIONS.map(({ kind, documentKind }) => { const canProcessForm = canProcessPcnOperationalForm(dossier, kind); const formKey = getPcnOperationalFormKey(kind); const isSaved = Boolean(dossier.operationalForms?.[formKey]); return <article key={kind} className="rounded-lg border border-white bg-white p-2.5 shadow-sm"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-black leading-4 text-slate-700">{PCN_OPERATIONAL_FORM_LABELS[kind]}</p><p className={`mt-1 text-[9px] font-bold ${!canProcessForm ? 'text-slate-500' : isSaved ? 'text-emerald-700' : 'text-amber-700'}`}>{!canProcessForm ? 'Chưa đến bước hiện tại' : isSaved ? 'Đã lưu dữ liệu' : 'Chưa nhập dữ liệu'}</p></div><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${!canProcessForm ? 'bg-slate-100 text-slate-500' : isSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{!canProcessForm ? 'KHÓA' : isSaved ? 'OK' : 'MỞ'}</span></div><div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => setOperationalFormOpen(kind)} disabled={!canEditDossierSteps || !canProcessForm} title={!canProcessForm ? 'Chưa đến bước xử lý của biểu mẫu này.' : undefined} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[9px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{isSaved ? 'Sửa form' : 'Nhập form'}</button>{documentKind && isSaved && (canProcessForm ? <button type="button" onClick={() => openDocumentOutput(documentKind)} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100">Sinh DOCX/PDF</button> : <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-[9px] font-bold text-slate-500">Chờ bước tương ứng</span>)}</div></article>; })}</div></section>;
  const documentWorkspaceTab = <div className="space-y-3">{operationalFormsSection}{documentTab}<details className="rounded-lg border border-slate-200 bg-white" data-testid="pcn-dossier-attachments"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span>Tệp liên kết trong bộ hồ sơ</span><span className="text-[9px] font-bold text-slate-400">{dossierAttachmentsForPackage.length + attachmentIds.length} tệp</span></summary><div className="border-t border-slate-100 p-2">{attachmentContent}</div></details></div>;
  const saveMilestones = async () => {
    if (isUpdating) return;
    if (!canEditDossierSteps) return;
    const ownerAuthorityDenial = getPcnOwnerAssignmentAuthorityDenial({
      currentUsername: dossier.ownerUsername,
      nextUsername: ownerUsername,
      actorUsername: currentUser.username,
      actorSystemRole: currentUser.systemRole || currentUser.role,
      actorDepartmentRoleCode: currentUser.departmentRoleCode,
    });
    if (ownerAuthorityDenial) {
      toast.error(ownerAuthorityDenial);
      return;
    }
    setIsUpdating(true);
    try {
      const updates: PcnDossierUpdateInput = {
        method,
        ownerUsername: ownerUsername.trim() || null,
        evaluatorUsername: evaluatorUsername.trim() || null,
        reviewerUsername: reviewerUsername.trim() || null,
        targetDate: targetDate || null,
        evaluationAt: evaluationAt || null,
        effectiveAt: effectiveAt || null,
      };
      await onUpdateDossier(updates);
      toast.success('Đã lưu phân công và các mốc vận hành hồ sơ.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu mốc vận hành hồ sơ');
    } finally {
      setIsUpdating(false);
    }
  };
  const evaluatorCatalogOptions = evaluatorOptions.map((user) => pcnUserCatalogOption(user, users)); const reviewerCatalogOptions = reviewerOptions.map((user) => pcnUserCatalogOption(user, users)); const unmatchedEvaluatorOption = pcnUnmatchedUserOption(evaluatorUsername, evaluatorCatalogOptions); const unmatchedReviewerOption = pcnUnmatchedUserOption(reviewerUsername, reviewerCatalogOptions); const overviewTab = <div className="space-y-3"><DossierOwnerPanel ownerUsername={ownerUsername} ownerOptions={ownerOptions} users={users} canEdit={canEditOwner} authorityHint={ownerAuthorityHint} onChange={setOwnerUsername} /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><FieldValue label="Khách hàng" value={customerSnapshot?.name} /><FieldValue label="Sản phẩm" value={proposal?.productName} /><FieldValue label="Phương thức" value={dossier.method.replace('METHOD_', 'Phương thức ')} /><FieldValue label="Hạn xử lý" value={formatDate(dossier.targetDate)} /></div><div className="grid gap-2 sm:grid-cols-2"><FieldValue label="Lĩnh vực" value={<span className="flex flex-wrap gap-1">{dossier.fieldCodes.map((code) => <span key={code} className="rounded-full border border-emerald-200 px-2 py-1 text-[10px] text-emerald-700">{fieldName(fields, code)}</span>)}</span>} /><FieldValue label="Tiến độ liên phòng" value={`${dossierRequests.length} PYC • ${dossierResults.length} KQTN trả về`} /></div><section className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-slate-800">Mốc vận hành</h3><p className="mt-1 text-[10px] text-slate-500">Các trường này lấy từ thông tin đã xác nhận trong hồ sơ, không tự suy diễn từ tên file hoặc trạng thái.</p></div>{!canEditMilestones && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">Chỉ xem</span>}</div>{canEditMilestones ? <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.1fr_1.1fr_1fr_1fr_1fr_auto] md:items-end"><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Phương thức chứng nhận</span><select aria-label="Phương thức chứng nhận" value={method} onChange={(event) => setMethod(event.target.value as PcnCertificationMethod)} disabled={Boolean(issuance)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100"><option value="METHOD_1">Phương thức 1</option><option value="METHOD_5">Phương thức 5</option><option value="METHOD_7">Phương thức 7</option></select>{issuance && <span className="mt-1 block text-[9px] font-bold text-amber-700">Đã khóa sau khi lập bộ phát hành.</span>}</label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Trưởng đoàn đánh giá</span><PcnCatalogCombobox id="pcn-dossier-evaluator" label="Trưởng đoàn đánh giá" hideLabel value={evaluatorUsername} onChange={setEvaluatorUsername} options={evaluatorCatalogOptions} unmatchedOption={unmatchedEvaluatorOption} placeholder="Tìm tên hoặc tài khoản..." /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Người soát xét kỹ thuật</span><PcnCatalogCombobox id="pcn-dossier-reviewer" label="Người soát xét kỹ thuật" hideLabel value={reviewerUsername} onChange={setReviewerUsername} options={reviewerCatalogOptions} unmatchedOption={unmatchedReviewerOption} placeholder="Tìm tên hoặc tài khoản..." /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Ngày đánh giá</span><input type="date" value={evaluationAt} onChange={(event) => setEvaluationAt(event.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-emerald-400" /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Ngày hiệu lực</span><input type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100" /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Hạn xử lý</span><input aria-label="Hạn xử lý" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-emerald-400" /></label><button type="button" onClick={() => void saveMilestones()} disabled={isUpdating} className="rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-500 disabled:opacity-50">{isUpdating ? 'Đang lưu…' : 'Lưu mốc'}</button></div> : <div className="mt-3 grid gap-2 sm:grid-cols-5"><FieldValue label="Trưởng đoàn đánh giá" value={dossier.evaluatorUsername ? getPcnUserDisplayName(dossier.evaluatorUsername, users) : 'Chưa phân công'} /><FieldValue label="Người soát xét kỹ thuật" value={dossier.reviewerUsername ? getPcnUserDisplayName(dossier.reviewerUsername, users) : 'Chưa phân công'} /><FieldValue label="Hạn xử lý" value={formatDate(dossier.targetDate)} /><FieldValue label="Ngày đánh giá" value={formatDate(dossier.evaluationAt)} /><FieldValue label="Ngày hiệu lực" value={formatDate(dossier.effectiveAt)} /></div>}</section></div>;
  const proposalSummary = <div className="grid gap-2 sm:grid-cols-2"><FieldValue label="Mã Đề nghị" value={proposal?.proposalCode} /><FieldValue label="Kênh tiếp nhận" value={proposal?.channel} /><FieldValue label="Người liên hệ" value={customerSnapshot?.contactPerson} /><FieldValue label="MST" value={customerSnapshot?.taxId} /><FieldValue label="Địa chỉ/kho" value={proposal?.warehouseAddress || customerSnapshot?.address} /><FieldValue label="Model / Nhãn hiệu" value={[proposal?.model, proposal?.brand].filter(Boolean).join(' • ')} /><FieldValue label="Nhà sản xuất" value={proposal?.manufacturer} /><FieldValue label="Địa chỉ nhà sản xuất" value={proposal?.manufacturerAddress} /><FieldValue label="Thông số kỹ thuật" value={proposal?.specifications} /></div>;
  const dossierOverviewTab = <div className="space-y-3">{overviewTab}<details className="rounded-lg border border-slate-200 bg-white" data-testid="pcn-proposal-summary"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span>Thông tin Đề nghị</span><span className="text-[9px] font-bold text-slate-400">Đầu vào của bộ hồ sơ</span></summary><div className="border-t border-slate-100 p-2">{proposalSummary}</div></details><details className="rounded-lg border border-slate-200 bg-white" data-testid="pcn-dossier-history"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span>Lịch sử xử lý</span><span className="text-[9px] font-bold text-slate-400">{dossierActivityLogs.length} hoạt động</span></summary><div className="border-t border-slate-100 p-2">{<ActivityHistory logs={dossierActivityLogs} users={users} />}</div></details></div>;
  const labTab = (
    <div className="space-y-3">
      <PcnSampleFlowView sampleLots={sampleLots} sampleItems={sampleItems} sampleRoutes={sampleRoutes} dossiers={[dossier]} proposals={proposal ? [proposal] : []} fields={fields} currentUser={currentUser} initialDossierId={dossier.id} canEdit={canEditDossierSteps && canProcessPcnSampleFlow(dossier)} onCreate={onCreateSampleLot} onRouteStatusChange={onUpdateSampleRoute} onOpenHandover={(routeId) => setHandoverRouteId(routeId)} />
      <PcnLabRequestView fields={fields} dossiers={[dossier]} proposals={proposal ? [proposal] : []} requests={dossierRequests} sampleLots={sampleLots} sampleItems={sampleItems} sampleRoutes={sampleRoutes} generatedDocuments={generatedDocuments} initialDossierId={dossier.id} canEdit={canEditDossierSteps && canCreatePcnLabRequest(dossier)} onSave={onSaveLabRequest} onStatusChange={onUpdateLabRequest} onDispatchLabRequest={onDispatchLabRequest} onReconcileLabRequest={onReconcileLabRequest} onOpenDossier={() => setActiveTab('lab')} onOpenDocument={(_, requestId) => openDocumentOutput('LAB_REQUEST', undefined, requestId)} />
    </div>
  );
  const resultsTab = <PcnResultReturnView fields={fields} dossiers={[dossier]} proposals={proposal ? [proposal] : []} requests={dossierRequests} results={dossierResults} initialDossierId={dossier.id} canEdit={canEditDossierSteps && canProcessPcnSampleFlow(dossier)} onSave={onSaveResult} onAttachFile={onAttachResultFile} />;
  const issuanceTab = <PcnIssuanceView dossiers={[dossier]} initialDossierId={dossier.id} proposals={proposal ? [proposal] : []} issuancePackages={issuancePackages} approvalSteps={dossierApprovalSteps} templates={templates} onPrepare={onPrepareIssuance} onApproveStep={onApproveStep} onIssue={onIssue} onDeliver={onDeliver} onArchive={onArchive} onWithdraw={onWithdraw} onAttachFile={onAttachIssuanceFile} officialDocuments={officialDocuments} onPreflightOfficialDocuments={onPreflightOfficialDocuments} onGenerateOfficialDocuments={onGenerateOfficialDocuments} currentUser={currentUser} canMutate={canEditMilestones} users={users} fields={fields} signerDelegations={signerDelegations} documentRequirements={requirements} dossierDocuments={dossierDocumentsForCompleteness} onOpenDossier={(dossierId) => { if (dossierId === dossier.id) setActiveTab('documents'); }} onCreateSignerDelegation={onCreateSignerDelegation} onRevokeSignerDelegation={onRevokeSignerDelegation} />;
  const auxiliaryModals = <>
    {operationalFormOpen && <PcnOperationalFormModal kind={operationalFormOpen} initialValue={dossier.operationalForms?.[getPcnOperationalFormKey(operationalFormOpen)]} users={users} currentUser={currentUser} sampleLots={sampleLots.filter((lot) => lot.dossierId === dossier.id)} canEdit={canEditDossierSteps && canProcessPcnOperationalForm(dossier, operationalFormOpen)} onSave={(value) => saveOperationalForm(operationalFormOpen, value)} onClose={() => setOperationalFormOpen(null)} />}
    {proposalDetailOpen && proposal && <PcnProposalDetailModal proposal={proposal} dossier={dossier} fields={fields} onOpenDocuments={(kind) => { setProposalDetailOpen(false); openDocumentOutput(kind); }} onClose={() => setProposalDetailOpen(false)} />}
    {selectedHandoverRoute && selectedHandoverLot && <PcnSampleHandoverModal lot={selectedHandoverLot} route={selectedHandoverRoute} request={selectedHandoverRequest} canEdit={canEditDossierSteps && canProcessPcnSampleFlow(dossier)} onSaveHandover={onSaveHandover && selectedHandoverRequest ? (details) => onSaveHandover(selectedHandoverRequest, details) : undefined} onOpenDocuments={(kind, routeId) => { setHandoverRouteId(null); openDocumentOutput(kind, routeId); }} onClose={() => setHandoverRouteId(null)} />}
    {documentOutput && <PcnDocumentOutputModal dossier={dossier} proposalUpdatedAt={proposal?.updatedAt} templates={templates} documentRequirements={requirements} generatedDocuments={generatedDocuments} sampleLots={sampleLots} sampleRoutes={sampleRoutes} labRequests={labRequests} users={users} kind={documentOutput.kind} sampleRouteId={documentOutput.sampleRouteId} labRequestId={documentOutput.labRequestId} canGenerate={canEditDossierSteps} onPreflight={onPreflight} onGenerate={onGenerateDocuments} onConfirmGenerated={confirmGeneratedDocument} onClose={() => setDocumentOutput(null)} />}
  </>;
  const tabContent = <><div className="mb-2 flex justify-end">{proposal && <button type="button" onClick={() => setProposalDetailOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"><FileText size={12} /> Chi tiết Đề nghị</button>}</div>{activeTab === 'documents' ? documentWorkspaceTab : activeTab === 'overview' ? dossierOverviewTab : activeTab === 'lab' ? labTab : activeTab === 'results' ? resultsTab : issuanceTab}{auxiliaryModals}</>;

  return <div data-testid="pcn-dossier-focus-shell" aria-label="Không gian làm việc hồ sơ" className="fixed inset-0 z-[70] flex items-stretch justify-center bg-white"><div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden max-h-[100dvh] bg-white shadow-2xl"><header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-slate-900">{dossier.dossierCode}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{getPcnDossierStatusLabel(dossier.status)}</span>{missingRequiredCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Thiếu tài liệu</span>}</div><p className="mt-1 text-[10px] text-slate-500">{customerSnapshot?.name || 'Chưa gắn khách hàng'} • {proposal?.productName || 'Hồ sơ chứng nhận'}</p></div><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => void onDownloadPackage()} title="Tải bộ hồ sơ PCN" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"><Download size={14} /> Tải bộ hồ sơ</button><button type="button" onClick={onClose} aria-label="Đóng hồ sơ" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></div></header><DossierRegionSelector activeTab={activeTab} missingRequiredCount={missingRequiredCount} onChange={setActiveTab} /><DossierPackageSummary summary={packageSummary} /><main className="h-0 min-h-0 flex-1 pcn-dossier-focus-scroll p-3 md:p-4"><div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2"><DossierWorkflowSummary projection={dossierWorkflowProjection} selectedNodeKey={selectedWorkflowNodeKey} completeness={completeness} ownerLabel={ownerLabel} exceptionReason={exceptionReasonLabel} onSelectNode={selectWorkflowNode} onOpenExceptionReason={() => void editExceptionReason()} onOpenStep={openSelectedWorkflowStep} onOpenChecklist={() => setActiveTab('documents')} onOpenGeneration={openGenerationRegion} onOpenApprovalModule={() => setActiveTab('issuance')} onCompleteStep={() => void completeCurrentStep()} completionDisabled={!canEditDossierSteps || (!completionTarget && dossier.status !== 'TECHNICAL_REVIEW')} completionTitle={currentStepAccess.reason || (nextStatusDenials.get(completionTarget || '') || undefined)} canEdit={canEditDossierSteps} users={users} /></div>{tabContent}</main><footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3"><span className="text-[10px] text-slate-400">Trạng thái tiếp theo</span><div className="flex flex-wrap justify-end gap-1.5">{nextStatuses.length === 0 && !requiresIssuanceLifecycleAction && <span className="text-[10px] font-bold text-slate-500">Đã ở trạng thái cuối</span>}{nextStatuses.map((status) => <button key={status} disabled={isUpdating || Boolean(nextStatusDenials.get(status))} title={nextStatusDenials.get(status) || undefined} onClick={() => void changeStatus(status)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{getPcnDossierStatusLabel(status)}{nextStatusDenials.get(status) ? ' · Chưa đủ hồ sơ' : ''}</button>)}{requiresIssuanceLifecycleAction && <button type="button" onClick={() => setActiveTab('issuance')} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><PackageCheck size={12} /> Mở vùng phát hành để {issuanceLifecycleActionLabel}</button>}</div></footer></div></div>;
}

function EmptyTab({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-7 text-center text-[10px] text-slate-500">{text}</div>;
}

export default PcnDossierDetailView;
