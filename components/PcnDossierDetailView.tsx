'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Download, Eye, FileCheck2, FileText, History, PackageCheck, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import type { ActivityLog, CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnCertificationField, PcnCertificationMethod, PcnDocumentRequirement, PcnDossierAttachment, PcnDossierDocument, PcnDossierStatus, PcnGeneratedDocument, PcnGeneratedDocumentFormat, PcnGeneratedDocumentKind, PcnOfficialGeneratedDocument, PcnSampleLot, PcnSampleRoute, PcnTemplateDefinition, PcnUserAccount, ReturnedTestResult } from '../types';
import { activityActionLabels, activityEntityLabels } from '../utils/activityLog';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { buildPcnDossierCompleteness, buildPcnDossierStationChecklist, getPcnPipelineStation, type PcnPipelineStationKey } from '../utils/pcnDossierPipeline';
import { getPcnDossierStationGenerationKind, getPcnDossierStationTab, type PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import { buildPcnDossierInspection } from '../utils/pcnDossierInspection';
import { buildPcnDossierPackageSummary, type PcnDossierPackageSummary } from '../utils/pcnDossierPackage';
import { getPcnDocumentRequirements } from '../utils/pcnDossierDocuments';
import { getPcnActorDisplayName, getPcnUserDisplayName, PCN_NEUTRAL_USER_LABEL } from '../utils/pcnUserIdentity';
import { getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment';
import { getPcnDossierExceptionReasonDenial, getPcnDossierManualNextStatuses, getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { getPcnCodeFamilyLabel } from '../utils/pcnCodePolicy';
import { PcnHistoricalReviewPanel } from './PcnHistoricalReviewPanel';
import { PcnDocumentGenerationPanel } from './PcnDocumentGenerationPanel';
import { PcnFilePreviewButton } from './PcnDossierFilePreview';
import { PcnWorkflowMap } from './PcnWorkflowMap';
import { buildPcnDossierWorkflowMap, type PcnDossierWorkflowMapProjection, type PcnWorkflowNode } from '../utils/pcnWorkflowMap';
import type { PcnHistoricalReviewInput } from '../utils/pcnHistoricalReview';
import type { PcnDossierUpdateInput } from '../utils/pcnDossierApi';
import type { PcnDossierDocumentContext } from '../utils/pcnDocumentGeneration';
import { usePcnStore } from '../store-pcn';

type DetailTab = PcnDossierDetailTab;

const tabs: Array<{ key: DetailTab; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Tổng quan', icon: FileText },
  { key: 'historicalReview', label: 'Rà soát nhập lịch sử', icon: ClipboardCheck },
  { key: 'documents', label: 'Tài liệu hồ sơ', icon: Upload },
  { key: 'generation', label: 'Sinh Word/PDF', icon: Download },
  { key: 'proposal', label: 'Đề nghị & đầu vào', icon: FileCheck2 },
  { key: 'lab', label: 'PYC/Giao nhận', icon: ArrowRight },
  { key: 'results', label: 'KQTN trả về', icon: CheckCircle2 },
  { key: 'issuance', label: 'Phê duyệt & Phát hành', icon: PackageCheck },
  { key: 'attachments', label: 'Tệp đính kèm', icon: FileText },
  { key: 'history', label: 'Lịch sử', icon: History },
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

function HaimyOriginSummary({ origin }: { origin?: CertificationDossier['haimyOrigin'] }) {
  if (!origin) return null;
  return <section className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-[10px] text-indigo-900"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-indigo-300 bg-white px-2 py-0.5 font-black text-indigo-700">Nguồn Haimy</span><span className="font-mono">{origin.externalRegistrationId || 'Chưa có mã đăng ký ngoài'}</span></div><p className="mt-1 text-indigo-800">Định danh staging: <span className="font-mono">{origin.stagingIdempotencyKey}</span>{origin.externalBatchId ? <> · Lô ngoài: <span className="font-mono">{origin.externalBatchId}</span></> : null}{origin.externalCertificateId ? <> · Chứng thư ngoài: <span className="font-mono">{origin.externalCertificateId}</span></> : null}</p><p className="mt-1 text-indigo-700">Thông tin nguồn chỉ đọc; đối chiếu tại Haimy staging trước khi tiếp tục xử lý.</p></section>;
}

function FieldValue({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-700">{value || 'Chưa cập nhật'}</div></div>;
}

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

function historicalMappingLabel(status?: PcnDossierAttachment['mappingStatus']): string {
  return status === 'AUTO_MAPPED' ? 'Đã nối checklist' : status === 'MANUAL_MAPPED' ? 'Nối thủ công' : status === 'UNMAPPED' ? 'Chưa nối checklist' : 'Chưa đối soát';
}

function ActivityHistory({ logs, users = [] }: { logs: ActivityLog[]; users?: PcnUserAccount[] }) {
  if (logs.length === 0) return <EmptyTab text="Chưa có hoạt động nào được ghi nhận cho hồ sơ này." />;
  return <div className="space-y-2">{logs.map((log) => <article key={log.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{activityActionLabels[log.action]}</span><span className="text-[10px] font-bold text-slate-600">{activityEntityLabels[log.entityType]}</span>{log.entityLabel && <span className="font-mono text-[10px] text-slate-400">{log.entityLabel}</span>}</div><time className="text-[10px] text-slate-400" dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></div><p className="mt-1 text-[11px] font-bold text-slate-700">{log.summary}</p><p className="mt-1 text-[10px] text-slate-500">Thực hiện bởi: <span className="font-bold text-slate-700">{getPcnActorDisplayName(log.actorName, log.actorUsername, users)}</span>{log.actorRole ? ` • ${log.actorRole}` : ''}</p>{log.changes && log.changes.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">{log.changes.map((change) => <div key={`${log.id}-${change.field}`} className="grid gap-1 text-[10px] sm:grid-cols-[minmax(100px,0.7fr)_1fr]"><span className="font-bold text-slate-500">{change.field}</span><span className="text-slate-600"><span className="text-rose-600">{formatActivityValue(change.before)}</span><span className="mx-1 text-slate-300">→</span><span className="text-emerald-700">{formatActivityValue(change.after)}</span></span></div>)}</div>}</article>)}</div>;
}

function DossierVisualChecklist({ dossierId, activeWorkflowNodeKey, fieldCodes, fields, requirements, documents, users }: { dossierId: string; activeWorkflowNodeKey: string; fieldCodes: string[]; fields: PcnCertificationField[]; requirements: PcnDocumentRequirement[]; documents: PcnDossierDocument[]; users: PcnUserAccount[] }) {
  const inspection = buildPcnDossierInspection({ dossierId, fieldCodes, requirements, documents });
  if (inspection.summary.total === 0) return null;
  const { summary } = inspection;

  return <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" aria-labelledby="pcn-visual-checklist-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2"><Eye size={16} className="mt-0.5 shrink-0 text-indigo-600" /><div><h3 id="pcn-visual-checklist-title" className="text-xs font-black text-slate-900">Kiểm tra trực quan hồ sơ</h3><p className="mt-1 text-[10px] leading-4 text-slate-600">Bảng kiểm read-only theo từng bước. Chỉ phiên hiện tại hợp lệ mới được tính là đã có; tên file hoặc ngày cập nhật không tự làm tài liệu hợp lệ.</p></div></div><span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black text-indigo-700">Quản lý • Chỉ xem</span>
    </div>
    <div className="mt-3 grid gap-1.5 text-[9px] font-bold sm:grid-cols-3"><div className="rounded-md border border-emerald-100 bg-white px-2 py-1.5 text-emerald-700">Mục đã có <span className="font-black">{summary.present}/{summary.total}</span></div><div className="rounded-md border border-amber-100 bg-white px-2 py-1.5 text-amber-700">Còn thiếu <span className="font-black">{summary.missing}</span></div><div className="rounded-md border border-rose-100 bg-white px-2 py-1.5 text-rose-700">Bắt buộc còn thiếu <span className="font-black">{summary.requiredMissing}/{summary.requiredTotal}</span></div></div>
    <p className="mt-2 text-[9px] text-indigo-700">Bước hiện tại mở sẵn; các bước khác thu gọn để dễ quét nhanh và vẫn có thể mở để kiểm tra.</p>
    <div className="mt-3 space-y-2">{inspection.stations.map((step) => <details key={step.key} open={step.key === activeWorkflowNodeKey} className="rounded-lg border border-white bg-white/80"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-black text-slate-700"><span>Bước {step.number || '—'} · {step.label}</span><span className={`rounded-full px-2 py-0.5 ${step.missing > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{step.present}/{step.total} đã có</span></summary><div className="grid gap-1 border-t border-slate-100 p-2 md:grid-cols-2">{step.items.map((item) => <div key={`${step.key}-${item.requirement.id}`} className={`rounded-md border px-2 py-1.5 ${item.status === 'PRESENT' ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/50'}`}><div className="flex items-start gap-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-1"><p className="text-[10px] font-bold leading-4 text-slate-700">{item.requirement.name}</p><span className={`shrink-0 text-[9px] font-black ${item.status === 'PRESENT' ? 'text-emerald-700' : 'text-amber-700'}`}>{item.status === 'PRESENT' ? 'Đã có' : 'Còn thiếu'}</span></div><p className="mt-0.5 text-[8px] text-slate-500">{fieldName(fields, item.requirement.fieldCode)} • {item.requirement.required ? 'Bắt buộc' : 'Điều kiện'} • {item.versionCount} phiên</p>{item.currentVersion ? <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-600"><a href={getPcnFileUrl(item.currentVersion.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline underline-offset-2">Mở file</a><PcnFilePreviewButton version={item.currentVersion} /><span>{item.currentVersion.fileName} • {formatDateTime(item.currentVersion.uploadedAt)} • Người tải: {getPcnUserDisplayName(item.currentVersion.uploadedBy, users)}</span></p> : item.versionCount > 0 ? <p className="mt-0.5 text-[9px] font-bold text-amber-700">Đã có phiên lưu, chưa có phiên hiện tại hợp lệ.</p> : <p className="mt-0.5 text-[9px] text-amber-700">Chưa có phiên tài liệu.</p>}</div></div></div>)}</div></details>)}</div>
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

      <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Chủ hồ sơ</div><div className="mt-0.5 font-black text-slate-700">{ownerLabel}</div></div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Tài liệu bước</div><div className="mt-0.5 font-black text-slate-700">{station.key === 'EXCEPTIONS' ? 'Không áp dụng' : `${completeness.stationDocumentPresent}/${completeness.stationDocumentTotal} tài liệu bắt buộc`}</div></div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2"><div className="font-bold text-slate-400">Dữ liệu lõi</div><div className="mt-0.5 font-black text-slate-700">{completeness.coreFieldPresent}/{completeness.coreFieldTotal} trường đã có</div></div>
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
        {(station.key === 'APPROVAL' || station.key === 'ISSUANCE' || station.key === 'DELIVERY_ARCHIVE') && <button type="button" onClick={onOpenApprovalModule} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><PackageCheck size={12} /> Mở module phê duyệt / phát hành</button>}
      </div>
    </section>
  );
}

function DossierStationChecklist({ stationChecklist, canEdit, onUploadDocument, uploadingRequirementId, users }: { stationChecklist: ReturnType<typeof buildPcnDossierStationChecklist>; canEdit: boolean; onUploadDocument: (requirementId: string, file: File) => void | Promise<void>; uploadingRequirementId: string | null; users: PcnUserAccount[] }) {
  if (stationChecklist.items.length === 0) return null;
  return <section className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" aria-labelledby="pcn-workflow-step-checklist-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 id="pcn-workflow-step-checklist-title" className="text-xs font-black text-slate-900">Tài liệu tại bước</h3><p className="mt-1 text-[10px] text-slate-600">Danh sách cần xử lý ngay tại bước {stationChecklist.station.number || 'ngoại lệ'}; gồm cả mục bắt buộc và mục điều kiện.</p></div>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${stationChecklist.requiredMissing > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{stationChecklist.present}/{stationChecklist.total} đã có</span>
    </div>
    <div className="mt-2 grid gap-1.5 md:grid-cols-2">{stationChecklist.items.map((item) => <div key={item.requirement.id} className={`rounded-md border px-2.5 py-2 ${item.status === 'PRESENT' ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-start gap-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="min-w-0 text-[10px] font-bold leading-4 text-slate-700">{item.requirement.name}</span></div><span className={`shrink-0 text-[9px] font-black ${item.status === 'PRESENT' ? 'text-emerald-700' : 'text-amber-700'}`}>{item.status === 'PRESENT' ? 'Đã có' : 'Còn thiếu'}</span></div><div className="mt-1 flex flex-wrap items-center gap-1 text-[8px] text-slate-500"><span>{item.requirement.required ? 'Bắt buộc' : 'Điều kiện'}</span><span>•</span><span>{item.versionCount} phiên</span>{item.currentVersion && <><span>•</span><a href={getPcnFileUrl(item.currentVersion.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline">Mở file hiện tại</a><span>• {item.currentVersion.fileName} • {formatDateTime(item.currentVersion.uploadedAt)} • Người tải: {getPcnUserDisplayName(item.currentVersion.uploadedBy, users)}</span></>}{canEdit && <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100"><Upload size={11} />{uploadingRequirementId === item.requirement.id ? 'Đang tải…' : 'Tải phiên mới'}<input type="file" className="hidden" disabled={uploadingRequirementId !== null} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onUploadDocument(item.requirement.id, file); }} /></label>}</div></div>)}</div>
  </section>;
}

function DossierWorkflowSummary({ projection, selectedNodeKey, completeness, ownerLabel, exceptionReason, onSelectNode, onOpenExceptionReason, onOpenStep, onOpenChecklist, onOpenGeneration, onOpenApprovalModule, canEdit, onUploadDocument, uploadingRequirementId, users }: { projection: PcnDossierWorkflowMapProjection; selectedNodeKey: PcnPipelineStationKey; completeness: ReturnType<typeof buildPcnDossierCompleteness>; ownerLabel: string; exceptionReason?: string; onSelectNode: (key: PcnPipelineStationKey) => void; onOpenExceptionReason: () => void; onOpenStep: () => void; onOpenChecklist: () => void; onOpenGeneration: () => void; onOpenApprovalModule: () => void; canEdit: boolean; onUploadDocument: (requirementId: string, file: File) => void | Promise<void>; uploadingRequirementId: string | null; users: PcnUserAccount[] }) {
  const currentNode = projection.nodes.find((node) => node.key === selectedNodeKey) || projection.currentNode;
  return <div className="space-y-2"><PcnWorkflowMap projection={projection} mode="dossier" selectedNodeKey={selectedNodeKey} onSelectNode={onSelectNode} /><DossierWorkflowSummaryOverview station={currentNode} completeness={completeness} ownerLabel={ownerLabel} exceptionReason={exceptionReason} canEdit={canEdit} onOpenExceptionReason={onOpenExceptionReason} onOpenStep={onOpenStep} onOpenChecklist={onOpenChecklist} onOpenGeneration={onOpenGeneration} onOpenApprovalModule={onOpenApprovalModule} /><DossierStationChecklist stationChecklist={completeness.stationChecklist} canEdit={canEdit} onUploadDocument={onUploadDocument} uploadingRequirementId={uploadingRequirementId} users={users} /></div>;
}

function DossierOwnerPanel({ ownerUsername, ownerOptions, users, canEdit, authorityHint, onChange }: { ownerUsername: string; ownerOptions: PcnUserAccount[]; users: PcnUserAccount[]; canEdit: boolean; authorityHint: string; onChange: (username: string) => void }) {
  return <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-emerald-900">Chủ hồ sơ</h3><p className="mt-1 text-[10px] text-emerald-800">Một nhân viên PCN chịu trách nhiệm xuyên suốt từ Đề nghị, hồ sơ liên quan, đóng gói đến trình lãnh đạo.</p><p className="mt-1 text-[9px] text-emerald-700">{authorityHint}</p></div>{!canEdit && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500">Chỉ xem</span>}</div>{canEdit ? <label className="mt-3 block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-emerald-700">Giao chủ hồ sơ</span><select aria-label="Chủ hồ sơ" value={ownerUsername} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-emerald-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400"><option value="">Chưa phân công</option>{ownerUsername && !ownerOptions.some((user) => user.username === ownerUsername) && <option value={ownerUsername}>{PCN_NEUTRAL_USER_LABEL} (cần rà soát)</option>}{ownerOptions.map((user) => <option key={user.username} value={user.username}>{getPcnUserDisplayName(user.username, users)}</option>)}</select></label> : <p className="mt-2 text-[11px] font-black text-emerald-900">{ownerUsername ? getPcnUserDisplayName(ownerUsername, users) : 'Chưa phân công'}</p>}</section>;
}

function DossierRegionSelector({ activeTab, hasHistoricalReview, missingRequiredCount, onChange }: { activeTab: DetailTab; hasHistoricalReview: boolean; missingRequiredCount: number; onChange: (tab: DetailTab) => void }) {
  const selectableTabs = tabs.filter(({ key }) => key !== 'historicalReview' || hasHistoricalReview);
  const activeLabel = selectableTabs.find(({ key }) => key === activeTab)?.label || 'Tổng quan';
  return <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><label htmlFor="pcn-dossier-region" className="shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-500">Khu vực hồ sơ</label><select id="pcn-dossier-region" aria-label="Khu vực hồ sơ" value={activeTab} onChange={(event) => onChange(event.target.value as DetailTab)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-emerald-400"><option value={activeTab}>{activeLabel}{activeTab === 'documents' && missingRequiredCount > 0 ? ` · ${missingRequiredCount} thiếu` : ''}</option>{selectableTabs.filter(({ key }) => key !== activeTab).map(({ key, label }) => <option key={key} value={key}>{label}{key === 'documents' && missingRequiredCount > 0 ? ` · ${missingRequiredCount} thiếu` : ''}</option>)}</select><span className="hidden text-[9px] text-slate-400 sm:inline">Dùng bản đồ quy trình phía trên để mở đúng bước tiếp theo.</span></div>;
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

export function PcnDossierDetailView({ dossier, proposal, fields, templates, labRequests, results, approvalSteps, issuancePackages, activityLogs, documentRequirements, dossierDocuments, dossierAttachments, generatedDocuments, officialDocuments, sampleLots, sampleRoutes, users, currentUser, onUploadDocument, onUpdateStatus, onUpdateDossier, canEditMilestones, onReviewHistorical, onMapHistoricalAttachment, onPreflight, onGenerateDocuments, onConfirmGenerated, onOpenApprovalModule, onDownloadPackage, onClose, initialTab }: { dossier: CertificationDossier; proposal?: CertificationProposal; fields: PcnCertificationField[]; templates: PcnTemplateDefinition[]; labRequests: OutboundLabRequest[]; results: ReturnedTestResult[]; approvalSteps: PcnApprovalStep[]; issuancePackages: IssuancePackage[]; activityLogs: ActivityLog[]; documentRequirements: PcnDocumentRequirement[]; dossierDocuments: PcnDossierDocument[]; dossierAttachments: PcnDossierAttachment[]; generatedDocuments: PcnGeneratedDocument[]; officialDocuments: PcnOfficialGeneratedDocument[]; sampleLots: PcnSampleLot[]; sampleRoutes: PcnSampleRoute[]; users: PcnUserAccount[]; currentUser: { username: string; role?: string; systemRole?: string; departmentRoleCode?: string }; onUploadDocument: (requirementId: string, file: File) => Promise<void>; onUpdateStatus: (status: PcnDossierStatus, exceptionReason?: string) => Promise<void>; onUpdateDossier: (updates: PcnDossierUpdateInput) => Promise<void>; canEditMilestones: boolean; onReviewHistorical: (input: PcnHistoricalReviewInput) => Promise<void>; onMapHistoricalAttachment: (attachmentId: string, requirementId: string) => Promise<void>; onPreflight: (kind: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => Promise<PcnDossierDocumentContext>; onGenerateDocuments: (kind: PcnGeneratedDocumentKind, formats: PcnGeneratedDocumentFormat[], sampleRouteId?: string, expectedContextHash?: string, labRequestId?: string) => Promise<PcnGeneratedDocument[]>; onConfirmGenerated?: (generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => Promise<void>; onOpenApprovalModule: () => void; onDownloadPackage: () => void | Promise<void>; onClose: () => void; initialTab?: PcnDossierDetailTab; }) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab || 'documents');
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingRequirementId, setUploadingRequirementId] = useState<string | null>(null);
  const [isReviewingHistorical, setIsReviewingHistorical] = useState(false);
  const [mappingAttachmentId, setMappingAttachmentId] = useState<string | null>(null);
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
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
  const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements, documents: dossierDocumentsForCompleteness });
  const station = getPcnPipelineStation(dossier.status);
  const [selectedWorkflowNodeKey, setSelectedWorkflowNodeKey] = useState<PcnPipelineStationKey>(station.key);
  const ownerLabel = dossier.ownerUsername ? getPcnUserDisplayName(dossier.ownerUsername, users) : 'Chưa phân công';
  const dossierInspection = buildPcnDossierInspection({ dossierId: dossier.id, fieldCodes: dossier.fieldCodes, requirements, documents: dossierDocumentsForCompleteness });
  const missingRequiredCount = dossierInspection.summary.requiredMissing;
  const attachmentIds = [...dossierResults.flatMap((result) => result.fileAssetId ? [result.fileAssetId] : []), ...(issuance?.fileAssetIds || [])];
  const historicalAttachments = dossierAttachments.filter((attachment) => attachment.dossierId === dossier.id).sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath));
  const hasHistoricalReview = Boolean(dossier.historicalImport || proposal?.historicalImport);
  const exceptionReasonLabel = dossier.exceptionReason?.trim()
    || (hasHistoricalReview && (dossier.historicalImport?.reviewStatus || proposal?.historicalImport?.reviewStatus) === 'PENDING_REVIEW'
      ? 'Hồ sơ nhập lịch sử đang chờ người vận hành rà soát.'
      : undefined);
  const stationTab: DetailTab = getPcnDossierStationTab(station.key, hasHistoricalReview);
  const generationKind = getPcnDossierStationGenerationKind(station.key, dossier.status);
  const dossierEntityIds = new Set<string>([dossier.id, proposal?.id, ...dossierRequests.map((request) => request.id), ...dossierResults.map((result) => result.id), ...dossierApprovalSteps.map((step) => step.id), issuance?.id].filter((id): id is string => Boolean(id)));
  const dossierActivityLogs = activityLogs.filter((log) => Boolean(log.entityId && dossierEntityIds.has(log.entityId))).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  const dossierWorkflowProjection = buildPcnDossierWorkflowMap({ dossier, proposal, activityLogs: dossierActivityLogs, requirements, documents: dossierDocumentsForCompleteness });
  const nextStatuses = canEditMilestones ? getPcnDossierManualNextStatuses(dossier.status) : [];
  const requiresIssuanceLifecycleAction = canEditMilestones && ['TECHNICAL_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'ISSUED', 'DELIVERED'].includes(dossier.status);
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
  const haimyOrigin = dossier.haimyOrigin || proposal?.haimyOrigin;
  const evaluatorOptions = users.filter((user) => {
    const role = user.systemRole || user.role;
    const fieldMatch = dossier.fieldCodes.length === 0 || user.fieldCodes.some((code) => dossier.fieldCodes.includes(code));
    return user.active && role !== 'viewer' && fieldMatch;
  }).sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  const reviewerOptions = evaluatorOptions;
  const currentUserRole = String(currentUser.systemRole || currentUser.role || '').trim().toLowerCase();
  const canManageOwner = currentUserRole === 'admin' || String(currentUser.departmentRoleCode || '').trim().toUpperCase() === 'LEADERSHIP';
  const canEditOwner = canEditMilestones && (canManageOwner || !dossier.ownerUsername);
  const ownerOptions = canManageOwner
    ? evaluatorOptions
    : evaluatorOptions.filter((user) => user.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase());
  const ownerAuthorityHint = canManageOwner
    ? 'Admin/Lãnh đạo có thể điều phối hoặc chuyển chủ hồ sơ trong phạm vi Lĩnh vực.'
    : 'Nhân viên chỉ có thể tự nhận hồ sơ đang chưa có chủ; hồ sơ đã phân công là chỉ xem.';
  const packageSummary = buildPcnDossierPackageSummary({
    documents: dossierDocumentsForCompleteness,
    attachments: historicalAttachments,
    generatedDocuments: generatedDocuments.filter((document) => document.dossierId === dossier.id),
    officialDocuments: officialDocuments.filter((document) => document.dossierId === dossier.id),
    returnedResults: dossierResults,
    issuancePackages: issuance ? [issuance] : [],
  });
  const confirmGeneratedDocument = onConfirmGenerated || ((generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => usePcnStore.getState().confirmGeneratedDocument(dossier.id, generated, requirement));

  useEffect(() => {
    setMethod(dossier.method);
    setOwnerUsername(dossier.ownerUsername || '');
    setExceptionReason(dossier.exceptionReason || '');
    setEvaluatorUsername(dossier.evaluatorUsername || '');
    setReviewerUsername(dossier.reviewerUsername || '');
    setTargetDate(dossier.targetDate?.slice(0, 10) || '');
    setEvaluationAt(dossier.evaluationAt?.slice(0, 10) || '');
    setEffectiveAt(dossier.effectiveAt?.slice(0, 10) || '');
    setMappingSelections({});
  }, [dossier.id, dossier.method, dossier.ownerUsername, dossier.exceptionReason, dossier.evaluatorUsername, dossier.reviewerUsername, dossier.targetDate, dossier.evaluationAt, dossier.effectiveAt]);

  useEffect(() => {
    setActiveTab(initialTab || 'documents');
  }, [dossier.id, initialTab]);

  useEffect(() => {
    setSelectedWorkflowNodeKey(station.key);
  }, [dossier.id, dossier.status, station.key]);

  const changeStatus = async (status: PcnDossierStatus) => {
    if (isUpdating) return;
    if (!canEditMilestones) return;
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
    if (!canEditMilestones || station.key !== 'EXCEPTIONS' || isUpdating) return;
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
    if (!canEditMilestones || !file || uploadingRequirementId !== null) return;
    setUploadingRequirementId(requirement.id);
    try { await onUploadDocument(requirement.id, file); toast.success(`Đã thêm phiên tài liệu: ${requirement.name}.`); } catch (error: any) { toast.error(error?.message || 'Không thể tải tài liệu hồ sơ'); } finally { setUploadingRequirementId(null); }
  };

  const selectWorkflowNode = (nodeKey: PcnPipelineStationKey) => {
    setSelectedWorkflowNodeKey(nodeKey);
    setActiveTab(getPcnDossierStationTab(nodeKey, hasHistoricalReview));
  };

  const openSelectedWorkflowStep = () => {
    setActiveTab(getPcnDossierStationTab(selectedWorkflowNodeKey, hasHistoricalReview));
  };

  const reviewHistorical = async (input: PcnHistoricalReviewInput) => {
    if (!canEditMilestones || isReviewingHistorical) return;
    setIsReviewingHistorical(true);
    try {
      await onReviewHistorical(input);
      toast.success('Đã lưu kết quả rà soát; hồ sơ vẫn giữ trạng thái Tạm dừng.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu kết quả rà soát');
      throw error;
    } finally {
      setIsReviewingHistorical(false);
    }
  };

  const mapHistoricalAttachment = async (attachment: PcnDossierAttachment) => {
    if (!canEditMilestones || mappingAttachmentId !== null) return;
    const requirementId = mappingSelections[attachment.id] || attachment.requirementId || '';
    if (!requirementId) {
      toast.error('Hãy chọn mục checklist trước khi nối tệp.');
      return;
    }
    setMappingAttachmentId(attachment.id);
    try {
      await onMapHistoricalAttachment(attachment.id, requirementId);
      toast.success('Đã nối tệp vào checklist; file gốc và provenance được giữ nguyên.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể nối tệp vào checklist');
    } finally {
      setMappingAttachmentId(null);
    }
  };

  const documentTab = <div className="space-y-3"><DossierVisualChecklist dossierId={dossier.id} activeWorkflowNodeKey={station.key} fieldCodes={dossier.fieldCodes} fields={fields} requirements={requirements} documents={dossierDocumentsForCompleteness} users={users} /><div className={`rounded-lg border p-3 text-[10px] ${missingRequiredCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><b>{missingRequiredCount > 0 ? `Còn ${missingRequiredCount} tài liệu bắt buộc chưa có` : 'Checklist tài liệu đã đủ theo cấu hình hiện tại'}</b><span className="ml-1">Cảnh báo không khóa luồng xử lý.</span>{!canEditMilestones && <span className="ml-1 font-bold">Chỉ xem.</span>}</div>{requirements.length === 0 ? <EmptyTab text="Hồ sơ chưa có cấu hình tài liệu theo Lĩnh vực." /> : <details data-testid="pcn-document-history" className="rounded-lg border border-slate-200 bg-white"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-black text-slate-700"><span>Chi tiết phiên và tải tài liệu</span><span className="text-[9px] font-bold text-slate-400">Tài liệu chi tiết thu gọn</span></summary><div className="space-y-2 border-t border-slate-100 p-2">{requirements.map((requirement) => { const document = documentsByRequirement.get(requirement.id); const versions = document?.versions || []; const current = versions.find((version) => version.assetId === document?.currentVersionId); return <article key={requirement.id} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-black text-slate-800">{requirement.name}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${document?.status === 'PRESENT' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{document?.status === 'PRESENT' ? 'Đã có' : 'Thiếu'}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{requirement.required ? 'Bắt buộc' : 'Điều kiện'}</span></div><p className="mt-1 text-[10px] text-slate-500">{fieldName(fields, requirement.fieldCode)} • Giai đoạn: {requirement.stages.join(', ')}</p>{current && <p className="mt-1 text-[10px] text-slate-600">Hiện tại: <a href={getPcnFileUrl(current.assetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline">{current.fileName}</a> • {formatDateTime(current.uploadedAt)}{current.uploadedBy ? ` • Người tải: ${getPcnUserDisplayName(current.uploadedBy, users)}` : ''}</p>}{versions.length > 1 && <details className="mt-2 text-[10px] text-slate-500"><summary className="cursor-pointer font-bold">Lịch sử {versions.length} phiên</summary><div className="mt-1 space-y-1">{versions.map((version, index) => <div key={`${version.assetId}-${index}`} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-1"><span>V{index + 1} • {version.fileName}</span><a href={getPcnFileUrl(version.assetId)} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Mở</a></div>)}</div></details>}</div>{canEditMilestones && <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"><Upload size={12} /> {uploadingRequirementId === requirement.id ? 'Đang tải…' : 'Tải phiên mới'}<input type="file" className="hidden" disabled={!canEditMilestones || uploadingRequirementId !== null} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadRequirement(requirement, file); }} /></label>}</div></article>; })}</div></details>}</div>;

  const attachmentContent = historicalAttachments.length === 0 && attachmentIds.length === 0 ? <EmptyTab text="Chưa có tệp liên kết từ hồ sơ lịch sử, KQTN hoặc phát hành." /> : <div className="space-y-2">{historicalAttachments.map((attachment) => <div key={attachment.id} className="rounded-lg border border-slate-200 bg-white p-3 text-[10px]"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{attachment.kind}</span><span className={`rounded-full border px-2 py-0.5 font-bold ${attachment.mappingStatus === 'AUTO_MAPPED' || attachment.mappingStatus === 'MANUAL_MAPPED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{historicalMappingLabel(attachment.mappingStatus)}</span>{attachment.requirementId && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[9px] text-slate-500">{attachment.requirementId}</span>}<span className="truncate font-bold text-slate-700">{attachment.fileName}</span></div><a href={getPcnFileUrl(attachment.assetId)} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-indigo-600 underline underline-offset-2">Mở file</a></div><p className="mt-1 truncate text-slate-400" title={attachment.sourceRelativePath}>Nguồn tham chiếu: {attachment.sourceRelativePath}</p>{attachment.mappingReason && <p className="mt-1 text-slate-500">Mapping: {attachment.mappingReason}</p>}<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">{canEditMilestones && <select aria-label={`Chọn checklist cho ${attachment.fileName}`} value={mappingSelections[attachment.id] ?? attachment.requirementId ?? ''} onChange={(event) => setMappingSelections((previous) => ({ ...previous, [attachment.id]: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600"><option value="">Chọn mục checklist để nối thủ công</option>{requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.fieldCode} · {requirement.name}</option>)}</select>}{canEditMilestones && <button type="button" disabled={!canEditMilestones || mappingAttachmentId !== null} onClick={() => void mapHistoricalAttachment(attachment)} className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{mappingAttachmentId === attachment.id ? 'Đang nối…' : attachment.mappingStatus === 'MANUAL_MAPPED' ? 'Cập nhật nối' : 'Nối checklist'}</button>}</div></div>)}{attachmentIds.map((assetId) => <div key={assetId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-[10px]"><span className="font-bold text-slate-700">File asset liên kết</span><a href={getPcnFileUrl(assetId)} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 underline underline-offset-2">{assetId} · Mở file</a></div>)}</div>;
  const historicalReviewTab = hasHistoricalReview && proposal
    ? canEditMilestones ? <PcnHistoricalReviewPanel dossier={dossier} proposal={proposal} onSave={reviewHistorical} /> : <EmptyTab text="Dữ liệu lịch sử chỉ được xem; tài khoản này không có quyền rà soát hoặc xác nhận." />
    : hasHistoricalReview && !proposal
      ? <EmptyTab text="Thiếu Đề nghị liên kết để rà soát dữ liệu lịch sử. Hãy xử lý cảnh báo toàn vẹn dữ liệu trước khi tiếp tục." />
      : <EmptyTab text="Hồ sơ này không có dữ liệu nhập lịch sử cần rà soát." />;
  const generationTab = <PcnDocumentGenerationPanel dossier={dossier} proposalUpdatedAt={proposal?.updatedAt} templates={templates} documentRequirements={requirements} generatedDocuments={generatedDocuments} sampleLots={sampleLots} sampleRoutes={sampleRoutes} labRequests={labRequests} users={users} canGenerate={canEditMilestones} initialKind={generationKind} onPreflight={onPreflight} onGenerate={onGenerateDocuments} onConfirmGenerated={confirmGeneratedDocument} />;
  const saveMilestones = async () => {
    if (isUpdating) return;
    if (!canEditMilestones) return;
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
  const overviewTab = <div className="space-y-3"><DossierOwnerPanel ownerUsername={ownerUsername} ownerOptions={ownerOptions} users={users} canEdit={canEditOwner} authorityHint={ownerAuthorityHint} onChange={setOwnerUsername} /><HaimyOriginSummary origin={haimyOrigin} /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><FieldValue label="Khách hàng" value={customerSnapshot?.name} /><FieldValue label="Sản phẩm" value={proposal?.productName} /><FieldValue label="Phương thức" value={dossier.method.replace('METHOD_', 'Phương thức ')} /><FieldValue label="Hạn xử lý" value={formatDate(dossier.targetDate)} /></div><div className="grid gap-2 sm:grid-cols-2"><FieldValue label="Lĩnh vực" value={<span className="flex flex-wrap gap-1">{dossier.fieldCodes.map((code) => <span key={code} className="rounded-full border border-emerald-200 px-2 py-1 text-[10px] text-emerald-700">{fieldName(fields, code)}</span>)}</span>} /><FieldValue label="Tiến độ liên phòng" value={`${dossierRequests.length} PYC • ${dossierResults.length} KQTN trả về`} /></div><section className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-slate-800">Mốc vận hành</h3><p className="mt-1 text-[10px] text-slate-500">Các trường này lấy từ thông tin đã xác nhận trong hồ sơ, không tự suy diễn từ tên file hoặc trạng thái.</p></div>{!canEditMilestones && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">Chỉ xem</span>}</div>{canEditMilestones ? <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.1fr_1.1fr_1fr_1fr_1fr_auto] md:items-end"><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Phương thức chứng nhận</span><select aria-label="Phương thức chứng nhận" value={method} onChange={(event) => setMethod(event.target.value as PcnCertificationMethod)} disabled={Boolean(issuance)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100"><option value="METHOD_1">Phương thức 1</option><option value="METHOD_5">Phương thức 5</option><option value="METHOD_7">Phương thức 7</option></select>{issuance && <span className="mt-1 block text-[9px] font-bold text-amber-700">Đã khóa sau khi lập bộ phát hành.</span>}</label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Trưởng đoàn đánh giá</span><select value={evaluatorUsername} onChange={(event) => setEvaluatorUsername(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400"><option value="">Chưa phân công</option>{evaluatorUsername && !evaluatorOptions.some((user) => user.username === evaluatorUsername) && <option value={evaluatorUsername}>{PCN_NEUTRAL_USER_LABEL} (cần rà soát)</option>}{evaluatorOptions.map((user) => <option key={user.username} value={user.username}>{getPcnUserDisplayName(user.username, users)}</option>)}</select></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Người soát xét kỹ thuật</span><select aria-label="Người soát xét kỹ thuật" value={reviewerUsername} onChange={(event) => setReviewerUsername(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400"><option value="">Chưa phân công</option>{reviewerUsername && !reviewerOptions.some((user) => user.username === reviewerUsername) && <option value={reviewerUsername}>{PCN_NEUTRAL_USER_LABEL} (cần rà soát)</option>}{reviewerOptions.map((user) => <option key={user.username} value={user.username}>{getPcnUserDisplayName(user.username, users)}</option>)}</select></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Ngày đánh giá</span><input type="date" value={evaluationAt} onChange={(event) => setEvaluationAt(event.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-emerald-400" /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Ngày hiệu lực</span><input type="date" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100" /></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Hạn xử lý</span><input aria-label="Hạn xử lý" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-emerald-400" /></label><button type="button" onClick={() => void saveMilestones()} disabled={isUpdating} className="rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-500 disabled:opacity-50">{isUpdating ? 'Đang lưu…' : 'Lưu mốc'}</button></div> : <div className="mt-3 grid gap-2 sm:grid-cols-5"><FieldValue label="Trưởng đoàn đánh giá" value={dossier.evaluatorUsername ? getPcnUserDisplayName(dossier.evaluatorUsername, users) : 'Chưa phân công'} /><FieldValue label="Người soát xét kỹ thuật" value={dossier.reviewerUsername ? getPcnUserDisplayName(dossier.reviewerUsername, users) : 'Chưa phân công'} /><FieldValue label="Hạn xử lý" value={formatDate(dossier.targetDate)} /><FieldValue label="Ngày đánh giá" value={formatDate(dossier.evaluationAt)} /><FieldValue label="Ngày hiệu lực" value={formatDate(dossier.effectiveAt)} /></div>}</section></div>;
  const tabContent = activeTab === 'historicalReview' ? historicalReviewTab : activeTab === 'documents' ? documentTab : activeTab === 'generation' ? generationTab : activeTab === 'overview' ? overviewTab : activeTab === 'proposal' ? <div className="grid gap-2 sm:grid-cols-2"><FieldValue label="Mã Đề nghị" value={proposal?.proposalCode} /><FieldValue label="Kênh tiếp nhận" value={proposal?.channel} /><FieldValue label="Người liên hệ" value={customerSnapshot?.contactPerson} /><FieldValue label="MST" value={customerSnapshot?.taxId} /><FieldValue label="Địa chỉ/kho" value={proposal?.warehouseAddress || customerSnapshot?.address} /><FieldValue label="Model / Nhãn hiệu" value={[proposal?.model, proposal?.brand].filter(Boolean).join(' • ')} /><FieldValue label="Nhà sản xuất" value={proposal?.manufacturer} /><FieldValue label="Địa chỉ nhà sản xuất" value={proposal?.manufacturerAddress} /><FieldValue label="Thông số kỹ thuật" value={proposal?.specifications} /></div> : activeTab === 'lab' ? <div className="space-y-2">{dossierRequests.length === 0 ? <EmptyTab text="Chưa có PYC/Giao nhận liên kết với hồ sơ." /> : dossierRequests.map((request) => <div key={request.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-black text-slate-800">{request.pycNumber}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{request.status}</span></div><p className="mt-1 text-[11px] font-bold text-slate-700">{request.laboratoryName} <span className="font-normal text-slate-400">• {fieldName(fields, request.fieldCode)}</span></p><p className="text-[10px] text-slate-500">Hạn trả KQTN: {formatDate(request.targetDate)}{request.criteria ? ` • ${request.criteria}` : ''}</p><p className="mt-1 text-[10px] text-slate-400">Giao: {formatDate(request.handoverAt)} • PTN nhận: {formatDate(request.receivedAt)}</p>{request.handoverNote && <p className="mt-1 text-[10px] text-slate-500">Ghi chú giao nhận: {request.handoverNote}</p>}</div>)}</div> : activeTab === 'results' ? <div className="space-y-2">{dossierResults.length === 0 ? <EmptyTab text="Chưa có KQTN trả về; hồ sơ vẫn chờ kết quả từ PTN." /> : dossierResults.map((result) => <div key={result.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-800">Vòng KQTN {result.round}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{outcomeLabel(result.outcome)}</span>{result.isOfficial && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Kết quả chính thức</span>}</div><p className="mt-1 text-[10px] text-slate-500">{result.reportNumber || 'Chưa có số báo cáo'} • Nhận ngày {formatDate(result.receivedAt)}</p>{result.notes && <p className="mt-1 text-[10px] text-slate-600">{result.notes}</p>}{result.sampleIssue && <p className="mt-1 text-[10px] font-bold text-rose-600">Vấn đề mẫu: {result.sampleIssue.description}</p>}</div>)}</div> : activeTab === 'issuance' ? <div className="space-y-2">{issuance ? <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"><p className="text-xs font-black text-emerald-800">Đã khởi tạo bộ phát hành</p><p className="mt-1 text-[10px] text-emerald-700">GCN: {issuance.certificateTemplateCode} • Quyết định: {issuance.decisionTemplateCode}</p><p className="mt-1 text-[10px] text-slate-500">Số phát hành: {issuance.issuanceNumber || 'Chưa cấp'} • Người ký: {issuance.signerUsername ? getPcnUserDisplayName(issuance.signerUsername, users) : 'Chưa xác định'}</p><div className="mt-3 space-y-1.5">{dossierApprovalSteps.length === 0 ? <p className="text-[10px] text-slate-500">Chưa tạo chuỗi phê duyệt.</p> : dossierApprovalSteps.map((step) => <div key={step.id} className="flex items-center justify-between rounded-md bg-white/70 px-2 py-1 text-[10px]"><span>{step.sequence}. {step.role}</span><span className="font-bold">{step.status === 'APPROVED' ? 'Đã duyệt' : step.status === 'RETURNED' ? 'Đã trả' : 'Đang chờ'}</span></div>)}</div></div> : <EmptyTab text="Chưa có bộ GCN/QĐ; hồ sơ cần qua bước soát xét và phê duyệt." />}</div> : activeTab === 'attachments' ? attachmentContent : <div className="space-y-2"><FieldValue label="Tạo hồ sơ" value={formatDate(dossier.createdAt)} /><FieldValue label="Cập nhật gần nhất" value={formatDate(dossier.updatedAt)} /><ActivityHistory logs={dossierActivityLogs} users={users} /></div>;

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"><div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-slate-900">{dossier.dossierCode}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{getPcnDossierStatusLabel(dossier.status)}</span>{hasHistoricalReview && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Hồ sơ lịch sử</span>}{missingRequiredCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Thiếu tài liệu</span>}</div><p className="mt-1 text-[10px] text-slate-500">{customerSnapshot?.name || 'Chưa gắn khách hàng'} • {proposal?.productName || 'Hồ sơ chứng nhận'}</p></div><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => void onDownloadPackage()} title="Tải bộ hồ sơ PCN" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"><Download size={14} /> Tải bộ hồ sơ</button><button type="button" onClick={onClose} aria-label="Đóng hồ sơ" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></div></header><div className="border-b border-slate-200 bg-slate-50 px-3 py-2"><DossierWorkflowSummary projection={dossierWorkflowProjection} selectedNodeKey={selectedWorkflowNodeKey} completeness={completeness} ownerLabel={ownerLabel} exceptionReason={exceptionReasonLabel} onSelectNode={selectWorkflowNode} onOpenExceptionReason={() => void editExceptionReason()} onOpenStep={openSelectedWorkflowStep} onOpenChecklist={() => setActiveTab('documents')} onOpenGeneration={() => setActiveTab('generation')} onOpenApprovalModule={onOpenApprovalModule} canEdit={canEditMilestones} onUploadDocument={(requirementId, file) => { const requirement = requirements.find((item) => item.id === requirementId); if (requirement) return uploadRequirement(requirement, file); }} uploadingRequirementId={uploadingRequirementId} users={users} /></div><DossierRegionSelector activeTab={activeTab} hasHistoricalReview={hasHistoricalReview} missingRequiredCount={missingRequiredCount} onChange={setActiveTab} /><DossierPackageSummary summary={packageSummary} /><main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">{tabContent}</main><footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3"><span className="text-[10px] text-slate-400">Trạng thái tiếp theo</span><div className="flex flex-wrap justify-end gap-1.5">{nextStatuses.length === 0 && !requiresIssuanceLifecycleAction && <span className="text-[10px] font-bold text-slate-500">Đã ở trạng thái cuối</span>}{nextStatuses.map((status) => <button key={status} disabled={isUpdating || isReviewingHistorical} onClick={() => void changeStatus(status)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">{getPcnDossierStatusLabel(status)}</button>)}{requiresIssuanceLifecycleAction && <button type="button" onClick={onOpenApprovalModule} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><PackageCheck size={12} /> Mở module phát hành để {issuanceLifecycleActionLabel}</button>}</div></footer></div></div>;
}

function EmptyTab({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-7 text-center text-[10px] text-slate-500">{text}</div>;
}

export default PcnDossierDetailView;
