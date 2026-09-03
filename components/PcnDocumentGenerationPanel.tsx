'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { CertificationDossier, OutboundLabRequest, PcnDocumentRequirement, PcnDossierDocument, PcnGeneratedDocument, PcnGeneratedDocumentFormat, PcnGeneratedDocumentKind, PcnSampleLot, PcnSampleRoute, PcnTemplateDefinition, PcnUserAccount } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDocumentPreflightIssues, getPcnDocumentSourceUpdatedAt } from '../utils/pcnDocumentFreshness';
import { getPcnGeneratedDocumentLineageSummary, getPcnGeneratedDocumentsForKind } from '../utils/pcnGeneratedDocumentView';
import { getPcnGeneratedDocumentRequirementCode } from '../utils/pcnDossierDocuments';
import { getPcnOfficialDocumentKindLabel, getPcnTemplateReadiness, getPcnTemplatesForFields } from '../utils/pcnTemplateCatalog';
import { getPcnOperationalTemplateForKind } from '../utils/pcnOperationalTemplateCatalog';
import { isPcnInternalSampleRequest } from '../utils/pcnLabOperations';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { canProcessPcnGeneratedDocument } from '../utils/pcnWorkflowStages';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import { PcnFilePreviewButton } from './PcnDossierFilePreview';

type PcnDocumentPreflightContext = {
  contextHash: string;
  dossierCode: string;
  proposalCode: string;
  customerName: string;
  productName: string;
  method: CertificationDossier['method'];
  fieldNames: string[];
  ownerUsername?: string;
  evaluatorUsername?: string;
  reviewerUsername?: string;
  targetDate?: string;
  evaluationAt?: string;
  checklist: Array<{ name: string; required: boolean; status: PcnDossierDocument['status'] }>;
  attachments: unknown[];
  sampleHandover?: unknown;
  labRequest?: unknown;
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
}

function kindLabel(kind: PcnGeneratedDocumentKind): string {
  if (kind === 'DOSSIER_COVER') return 'Bìa + mục lục hồ sơ';
  if (kind === 'PROPOSAL_SUMMARY') return 'Phiếu tóm tắt Đề nghị';
  if (kind === 'PROPOSAL_FORM') return 'Đề nghị chứng nhận đầy đủ';
  if (kind === 'ASSIGNMENT_FORM') return 'Phiếu phân công chứng nhận';
  if (kind === 'EVALUATION_PLAN') return 'Kế hoạch đánh giá CNSP';
  if (kind === 'FIELD_INSPECTION') return 'Biên bản kiểm tra hiện trường';
  if (kind === 'SAMPLE_TAKING') return 'Biên bản lấy mẫu';
  if (kind === 'SAMPLE_CODING') return 'Biên bản mã hóa mẫu';
  if (kind === 'EVALUATION_REPORT') return 'Báo cáo đánh giá';
  if (kind === 'SAMPLE_RETURN') return 'Biên bản trả mẫu';
  if (kind === 'LAB_REQUEST') return 'PYC gửi PTN';
  return 'Biên bản giao/nhận mẫu';
}

const PCN_SAMPLE_ROUTE_GENERATED_KINDS: readonly PcnGeneratedDocumentKind[] = [
  'SAMPLE_TAKING',
  'SAMPLE_HANDOVER',
  'SAMPLE_RETURN',
  'SAMPLE_CODING',
];

function requiresSampleRoute(kind: PcnGeneratedDocumentKind): boolean {
  return PCN_SAMPLE_ROUTE_GENERATED_KINDS.includes(kind);
}

function requiresLabRequest(kind: PcnGeneratedDocumentKind): boolean {
  return kind === 'LAB_REQUEST';
}

function templateStatusLabel(status: string): string {
  if (status === 'APPROVED') return 'Đã duyệt';
  if (status === 'NEEDS_ANNOTATION') return 'Cần chú thích';
  if (status === 'RETIRED') return 'Ngừng dùng';
  return 'Đã phát hiện';
}

function templateReadinessReasonLabel(reason: string): string {
  if (reason === 'STATUS_NOT_APPROVED') return 'chưa được duyệt';
  if (reason === 'LEGACY_FORMAT') return 'định dạng .doc';
  if (reason === 'MISSING_PRIVATE_ASSET') return 'chưa có asset private';
  return 'thiếu placeholder bắt buộc';
}

function lineageStatusLabel(status: string): string {
  if (status === 'COMPLETE') return 'Đủ Word + PDF';
  if (status === 'MISSING_DOCX') return 'Thiếu Word';
  if (status === 'MISSING_PDF') return 'Thiếu PDF';
  if (status === 'CONTEXT_MISMATCH') return 'Khác context';
  return 'Cần sinh lại';
}

function lineageStatusClass(status: string): string {
  if (status === 'COMPLETE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'STALE') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function PcnDocumentGenerationPanel({
  dossier,
  proposalUpdatedAt,
  templates,
  documentRequirements,
  generatedDocuments,
  sampleLots,
  sampleRoutes,
  labRequests,
  users,
  canGenerate,
  initialKind,
  initialSampleRouteId,
  initialLabRequestId,
  onPreflight,
  onGenerate,
  onConfirmGenerated,
}: {
  dossier: CertificationDossier;
  proposalUpdatedAt?: string;
  templates: PcnTemplateDefinition[];
  documentRequirements: PcnDocumentRequirement[];
  generatedDocuments: PcnGeneratedDocument[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  users: PcnUserAccount[];
  canGenerate: boolean;
  initialKind?: PcnGeneratedDocumentKind;
  initialSampleRouteId?: string;
  initialLabRequestId?: string;
  onPreflight: (kind: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => Promise<PcnDocumentPreflightContext>;
  onGenerate: (kind: PcnGeneratedDocumentKind, formats: PcnGeneratedDocumentFormat[], sampleRouteId?: string, expectedContextHash?: string, labRequestId?: string) => Promise<PcnGeneratedDocument[]>;
  onConfirmGenerated: (generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => Promise<void>;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [preflight, setPreflight] = useState<PcnDocumentPreflightContext | null>(null);
  const [selectedKind, setSelectedKind] = useState<PcnGeneratedDocumentKind>(initialKind || 'DOSSIER_COVER');
  const [selectedRouteId, setSelectedRouteId] = useState(initialSampleRouteId || '');
  const [selectedLabRequestId, setSelectedLabRequestId] = useState(initialLabRequestId || '');
  const [confirmingGeneratedId, setConfirmingGeneratedId] = useState<string | null>(null);
  const [confirmationRequirementIds, setConfirmationRequirementIds] = useState<Record<string, string>>({});
  const dossierLots = useMemo(() => sampleLots.filter((lot) => lot.dossierId === dossier.id), [dossier.id, sampleLots]);
  const lotById = useMemo(() => new Map(dossierLots.map((lot) => [lot.id, lot])), [dossierLots]);
  const dossierRoutes = useMemo(() => sampleRoutes.filter((route) => lotById.has(route.sampleLotId)).sort((left, right) => left.id.localeCompare(right.id)), [lotById, sampleRoutes]);
  const dossierLabRequests = useMemo(() => labRequests.filter((request) => request.dossierId === dossier.id && isPcnInternalSampleRequest(request, dossierRoutes)).sort((left, right) => left.id.localeCompare(right.id)), [dossier.id, dossierRoutes, labRequests]);
  const activeRouteId = dossierRoutes.some((route) => route.id === selectedRouteId) ? selectedRouteId : (dossierRoutes[0]?.id || '');
  const activeLabRequestId = dossierLabRequests.some((request) => request.id === selectedLabRequestId) ? selectedLabRequestId : (dossierLabRequests[0]?.id || '');
  const selectedRoute = dossierRoutes.find((route) => route.id === activeRouteId);
  const selectedLot = selectedRoute ? lotById.get(selectedRoute.sampleLotId) : undefined;
  const selectedPyc = selectedRoute ? dossierLabRequests.find((request) => request.id === selectedRoute.labRequestId || request.sampleRouteId === selectedRoute.id) : undefined;
  const selectedLabRequest = dossierLabRequests.find((request) => request.id === activeLabRequestId);
  const selectedLabRequestLot = selectedLabRequest?.sampleLotId ? lotById.get(selectedLabRequest.sampleLotId) : undefined;
  const selectedLabRequestRoute = selectedLabRequest?.sampleRouteId ? dossierRoutes.find((route) => route.id === selectedLabRequest.sampleRouteId) : dossierRoutes.find((route) => route.labRequestId === selectedLabRequest?.id);
  const routeOptions = useMemo<PcnCatalogOption[]>(() => dossierRoutes.map((route) => {
    const lot = lotById.get(route.sampleLotId);
    const pyc = dossierLabRequests.find((request) => request.id === route.labRequestId || request.sampleRouteId === route.id);
    return {
      value: route.id,
      label: `${lot?.lotCode || route.sampleLotId} · ${route.labName} · ${route.status}${pyc ? ` · ${pyc.pycNumber}` : ''}`,
      searchText: [route.id, route.labName, route.status, lot?.lotCode, lot?.sampleName, pyc?.pycNumber].filter(Boolean).join(' '),
      description: [lot?.sampleName, lot?.model, pyc?.pycNumber].filter(Boolean).join(' · '),
    };
  }), [dossierLabRequests, dossierRoutes, lotById]);
  const labRequestOptions = useMemo<PcnCatalogOption[]>(() => dossierLabRequests.map((request) => {
    const lot = request.sampleLotId ? lotById.get(request.sampleLotId) : undefined;
    return {
      value: request.id,
      label: `${request.pycNumber} · ${request.laboratoryName} · ${request.status}${lot ? ` · ${lot.lotCode}` : ''}`,
      searchText: [request.id, request.pycNumber, request.laboratoryName, request.status, lot?.lotCode, lot?.sampleName].filter(Boolean).join(' '),
      description: [lot?.sampleName, request.fieldCode].filter(Boolean).join(' · '),
    };
  }), [dossierLabRequests, lotById]);
  const operationalTemplate = getPcnOperationalTemplateForKind(selectedKind, dossier.fieldCodes);
  const dossierDocuments = useMemo(() => getPcnGeneratedDocumentsForKind(generatedDocuments, dossier.id, selectedKind, requiresSampleRoute(selectedKind) ? activeRouteId : undefined, requiresLabRequest(selectedKind) ? activeLabRequestId : undefined), [activeLabRequestId, activeRouteId, dossier.id, generatedDocuments, selectedKind]);
  const officialTemplates = useMemo(() => getPcnTemplatesForFields(dossier.fieldCodes, templates)
    .filter((template) => template.documentKind === 'CERTIFICATE' || template.documentKind === 'DECISION'), [dossier.fieldCodes, templates]);
  const officialReadyCount = officialTemplates.filter((template) => getPcnTemplateReadiness(template, { availablePlaceholderKeys: template.placeholderKeys, requireVerifiedPrivateAsset: true }).ready).length;
  const contextHash = dossierDocuments[0]?.contextHash;
  const sourceUpdatedAt = getPcnDocumentSourceUpdatedAt(
    dossier.updatedAt,
    proposalUpdatedAt,
    ...(requiresSampleRoute(selectedKind) ? [selectedLot?.updatedAt, selectedRoute?.updatedAt, selectedPyc?.updatedAt] : []),
    ...(requiresLabRequest(selectedKind) ? [selectedLabRequest?.updatedAt, selectedLabRequestLot?.updatedAt, selectedLabRequestRoute?.updatedAt] : []),
  );
  const lineageSummary = useMemo(() => getPcnGeneratedDocumentLineageSummary(
    generatedDocuments,
    dossier.id,
    selectedKind,
    requiresSampleRoute(selectedKind) ? activeRouteId : undefined,
    sourceUpdatedAt,
    requiresLabRequest(selectedKind) ? activeLabRequestId : undefined,
  ), [activeLabRequestId, activeRouteId, dossier.id, generatedDocuments, selectedKind, sourceUpdatedAt]);
  const preflightIssues = useMemo(() => preflight ? getPcnDocumentPreflightIssues({
    kind: selectedKind,
    hasSampleRoute: !requiresSampleRoute(selectedKind) || Boolean(preflight.sampleHandover),
    hasLabRequest: !requiresLabRequest(selectedKind) || Boolean(preflight.labRequest),
    checklist: preflight.checklist,
  }) : [], [preflight, selectedKind]);
  const preflightOwnerLabel = preflight?.ownerUsername ? getPcnUserDisplayName(preflight.ownerUsername, users) : 'Chưa phân công';
  const preflightEvaluatorLabel = preflight?.evaluatorUsername ? getPcnUserDisplayName(preflight.evaluatorUsername, users) : 'Chưa phân công';
  const preflightReviewerLabel = preflight?.reviewerUsername ? getPcnUserDisplayName(preflight.reviewerUsername, users) : 'Chưa phân công';
  const canProcessSelectedKind = canProcessPcnGeneratedDocument(dossier, selectedKind);

  useEffect(() => {
    setPreflight(null);
  }, [activeLabRequestId, activeRouteId, selectedKind]);

  useEffect(() => {
    setSelectedKind(initialKind || 'DOSSIER_COVER');
    setSelectedRouteId(initialSampleRouteId || '');
    setSelectedLabRequestId(initialLabRequestId || '');
    setPreflight(null);
  }, [dossier.id, initialKind, initialLabRequestId, initialSampleRouteId]);

  const runPreflight = async () => {
    if (isPreflighting) return;
    if (requiresSampleRoute(selectedKind) && !activeRouteId) {
      toast.error(`Hãy chọn tuyến mẫu trước khi kiểm tra dữ liệu ${selectedKind === 'SAMPLE_RETURN' ? 'biên bản trả mẫu' : selectedKind === 'SAMPLE_TAKING' ? 'biên bản lấy mẫu' : selectedKind === 'SAMPLE_CODING' ? 'biên bản mã hóa mẫu' : 'biên bản giao nhận'}.`);
      return;
    }
    if (requiresLabRequest(selectedKind) && !activeLabRequestId) {
      toast.error('Hãy chọn PYC trước khi kiểm tra dữ liệu phiếu yêu cầu thử nghiệm.');
      return;
    }
    setIsPreflighting(true);
    try {
      const context = await onPreflight(selectedKind, requiresSampleRoute(selectedKind) ? activeRouteId : undefined, requiresLabRequest(selectedKind) ? activeLabRequestId : undefined);
      setPreflight(context);
      toast.success('Đã kiểm tra context dữ liệu; chưa tạo hoặc tải file.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể kiểm tra dữ liệu trước khi sinh tài liệu');
    } finally {
      setIsPreflighting(false);
    }
  };

  const generate = async () => {
    if (isGenerating || isPreflighting) return;
    if (!canGenerate) return;
    if (!canProcessSelectedKind) {
      toast.error('Biểu mẫu thuộc bước chưa đến; hãy hoàn tất bước hiện tại trước.');
      return;
    }
    if (requiresSampleRoute(selectedKind) && !activeRouteId) {
      toast.error(`Hãy chọn tuyến mẫu trước khi sinh ${selectedKind === 'SAMPLE_RETURN' ? 'biên bản trả mẫu' : selectedKind === 'SAMPLE_TAKING' ? 'biên bản lấy mẫu' : selectedKind === 'SAMPLE_CODING' ? 'biên bản mã hóa mẫu' : 'biên bản giao nhận'}.`);
      return;
    }
    if (requiresLabRequest(selectedKind) && !activeLabRequestId) {
      toast.error('Hãy chọn PYC trước khi sinh phiếu yêu cầu thử nghiệm.');
      return;
    }
    if (!preflight) {
      toast.error('Hãy bấm “Kiểm tra dữ liệu” và rà soát context trước khi sinh tài liệu.');
      return;
    }
    if (preflightIssues.some((issue) => issue.severity === 'BLOCKING')) {
      toast.error(preflightIssues.filter((issue) => issue.severity === 'BLOCKING').map((issue) => issue.message).join(' '));
      return;
    }
    setIsGenerating(true);
    try {
      const documents = await onGenerate(selectedKind, ['DOCX', 'PDF'], requiresSampleRoute(selectedKind) ? activeRouteId : undefined, preflight.contextHash, requiresLabRequest(selectedKind) ? activeLabRequestId : undefined);
      toast.success(`Đã sinh ${documents.length} tài liệu từ cùng một context dữ liệu.`);
    } catch (error: any) {
      if (String(error?.message || '').includes('Dữ liệu hồ sơ đã thay đổi')) setPreflight(null);
      toast.error(error?.message || 'Không thể sinh bộ hồ sơ Word/PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmGenerated = async (generated: PcnGeneratedDocument, requirement?: PcnDocumentRequirement) => {
    if (!canGenerate || !canProcessPcnGeneratedDocument(dossier, generated.kind) || confirmingGeneratedId || !requirement) return;
    setConfirmingGeneratedId(generated.id);
    try {
      await onConfirmGenerated(generated, requirement);
      toast.success(`Đã xác nhận ${generated.fileName} vào checklist ${requirement.name}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xác nhận bản sinh vào checklist');
    } finally {
      setConfirmingGeneratedId(null);
    }
  };

  return <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-black text-slate-800"><FileText size={15} className="text-indigo-600" /> Sinh Word/PDF</div>
        <p className="mt-1 text-[10px] text-slate-600">Sinh biểu mẫu quản lý nội bộ từ một nguồn dữ liệu chuẩn. Đây không phải GCN/QĐ chính thức.</p>
        {contextHash && <p className="mt-1 break-all font-mono text-[9px] text-slate-500">Context: {contextHash}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        <button type="button" onClick={() => void runPreflight()} disabled={isPreflighting || (requiresSampleRoute(selectedKind) && !activeRouteId) || (requiresLabRequest(selectedKind) && !activeLabRequestId)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60">
          {isPreflighting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          {isPreflighting ? 'Đang kiểm tra…' : 'Kiểm tra dữ liệu'}
        </button>
        <button type="button" onClick={() => void generate()} disabled={isGenerating || isPreflighting || !canGenerate || !canProcessSelectedKind || !preflight || preflightIssues.some((issue) => issue.severity === 'BLOCKING') || (requiresSampleRoute(selectedKind) && !activeRouteId) || (requiresLabRequest(selectedKind) && !activeLabRequestId)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
          {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {isGenerating ? 'Đang sinh…' : 'Sinh DOCX + PDF'}
        </button>
      </div>
    </div>
    {!canProcessSelectedKind && <p className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-600">Biểu mẫu này thuộc bước sau. Có thể xem cấu hình, nhưng chỉ được sinh/xác nhận khi hồ sơ tới bước tương ứng.</p>}
    {preflight && <div className={`rounded-lg border p-2.5 text-[10px] ${preflightIssues.some((issue) => issue.severity === 'BLOCKING') ? 'border-rose-200 bg-rose-50 text-rose-800' : preflightIssues.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><b>Preflight context đã kiểm tra</b><span className="font-mono text-[9px]">{preflight.contextHash.slice(0, 16)}…</span></div>
      {preflightIssues.length === 0 ? <p className="mt-1">Không có cảnh báo từ checklist hoặc dữ liệu hồ sơ. Có thể sinh Word/PDF.</p> : <ul className="mt-1 space-y-0.5">{preflightIssues.map((issue) => <li key={issue.code}><b>{issue.severity === 'BLOCKING' ? 'Chặn' : 'Cảnh báo'}:</b> {issue.message}</li>)}</ul>}
      <div className="mt-2 rounded-md border border-slate-200 bg-white/80 p-2">
        <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Snapshot nguồn (chỉ đọc)</div>
        <div className="mt-1.5 grid gap-1.5 text-[9px] sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-slate-400">Mã Đề nghị</span><p className="truncate font-bold text-slate-700" title={preflight.proposalCode}>{preflight.proposalCode || 'Chưa cập nhật'}</p></div>
          <div><span className="text-slate-400">Mã hồ sơ</span><p className="truncate font-bold text-slate-700" title={preflight.dossierCode}>{preflight.dossierCode || 'Chưa cập nhật'}</p></div>
          <div><span className="text-slate-400">Khách hàng</span><p className="truncate font-bold text-slate-700" title={preflight.customerName}>{preflight.customerName || 'Chưa cập nhật'}</p></div>
          <div><span className="text-slate-400">Sản phẩm</span><p className="truncate font-bold text-slate-700" title={preflight.productName}>{preflight.productName || 'Chưa cập nhật'}</p></div>
          <div><span className="text-slate-400">Phương thức</span><p className="truncate font-bold text-slate-700">{preflight.method.replace('METHOD_', 'Phương thức ')}</p></div>
          <div><span className="text-slate-400">Chủ hồ sơ</span><p className="truncate font-bold text-slate-700" title={preflightOwnerLabel}>{preflightOwnerLabel}</p></div>
          <div><span className="text-slate-400">Lĩnh vực</span><p className="truncate font-bold text-slate-700" title={preflight.fieldNames.join(', ')}>{preflight.fieldNames.join(', ') || 'Chưa cập nhật'}</p></div>
          <div><span className="text-slate-400">Checklist / tệp đính kèm</span><p className="font-bold text-slate-700">{preflight.checklist.length} mục / {preflight.attachments.length} tệp</p></div>
          <div><span className="text-slate-400">Người đánh giá / rà soát</span><p className="truncate font-bold text-slate-700" title={`${preflightEvaluatorLabel} / ${preflightReviewerLabel}`}>{preflightEvaluatorLabel} / {preflightReviewerLabel}</p></div>
          <div><span className="text-slate-400">Hạn xử lý / ngày đánh giá</span><p className="truncate font-bold text-slate-700">{preflight.targetDate ? formatDateTime(preflight.targetDate) : 'Chưa đặt'} / {preflight.evaluationAt ? formatDateTime(preflight.evaluationAt) : 'Chưa cập nhật'}</p></div>
        </div>
      </div>
      <p className="mt-1 text-[9px] opacity-80">Preflight chỉ đọc, chưa tạo tài liệu và chưa ghi audit. Nếu <b>Context đã thay đổi</b>, hệ thống sẽ yêu cầu kiểm tra lại trước khi sinh.</p>
    </div>}
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black text-amber-900">Biểu mẫu phát hành chính thức</div>
        <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[9px] font-bold text-amber-800">{officialReadyCount}/{officialTemplates.length} sẵn sàng</span>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-amber-800">GCN/QĐ/chứng thư chỉ được sinh từ DOCX đã duyệt và có asset private PCN. Mẫu ngoài catalog PCN, .doc hoặc mẫu chưa chú thích không được dùng thay thế.</p>
      {officialTemplates.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{officialTemplates.map((template) => { const readiness = getPcnTemplateReadiness(template, { availablePlaceholderKeys: template.placeholderKeys, requireVerifiedPrivateAsset: true }); return <span key={template.id} className="rounded-md border border-amber-200 bg-white px-1.5 py-1 text-[9px] font-bold text-slate-700">{getPcnOfficialDocumentKindLabel(template.documentKind)} · {templateStatusLabel(template.status)}{!readiness.ready && <span className="font-normal text-amber-700"> · {readiness.reasons.map(templateReadinessReasonLabel).join(', ')}</span>}</span>; })}</div> : <p className="mt-1 text-[9px] text-amber-800">Chưa có catalog cho lĩnh vực của hồ sơ.</p>}
    </div>
    <div className="rounded-lg border border-indigo-200 bg-white p-2.5">
      <label className="block text-[9px] font-black uppercase tracking-wide text-slate-500" htmlFor="pcn-document-kind">Biểu mẫu cần sinh</label>
      <select id="pcn-document-kind" aria-label="Biểu mẫu cần sinh" value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as PcnGeneratedDocumentKind)} className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400">
        {(['DOSSIER_COVER', 'PROPOSAL_SUMMARY', 'PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_CODING', 'EVALUATION_REPORT', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'LAB_REQUEST'] as PcnGeneratedDocumentKind[]).map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
      </select>
      <p className="mt-1 text-[9px] leading-4 text-slate-500">Chọn một biểu mẫu, kiểm tra dữ liệu rồi sinh đồng thời Word và PDF.</p>
      {operationalTemplate && <p className="mt-1 rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1.5 text-[9px] text-emerald-800">Nguồn form PCN: <b>{operationalTemplate.fileName}</b> · {operationalTemplate.status === 'OFFICIAL_CANDIDATE' ? 'ứng viên mẫu chính thức, vẫn phải duyệt riêng' : 'mẫu vận hành nháp'}</p>}
    </div>
    {requiresSampleRoute(selectedKind) && <div className="rounded-lg border border-indigo-200 bg-white p-2.5">
      <PcnCatalogCombobox id="pcn-sample-route" label="Chọn tuyến mẫu" hideLabel value={activeRouteId} onChange={setSelectedRouteId} options={routeOptions} placeholder={routeOptions.length > 0 ? 'Tìm lô, mẫu, phòng thử hoặc PYC...' : 'Chưa có tuyến mẫu thuộc hồ sơ'} disabled={isGenerating || isPreflighting} />
      {selectedRoute && <p className="mt-1.5 text-[9px] leading-4 text-slate-500">Lô <b>{selectedLot?.lotCode}</b> • {selectedLot?.sampleName} • {selectedRoute.labName} • PYC: {selectedPyc?.pycNumber || 'chưa tạo'} • Trạng thái tuyến: {selectedRoute.status}</p>}
      {!activeRouteId && <p className="mt-1.5 text-[9px] font-bold text-amber-700">Cần tạo lô và tuyến mẫu trước khi sinh biên bản.</p>}
    </div>}
    {requiresLabRequest(selectedKind) && <div className="rounded-lg border border-indigo-200 bg-white p-2.5">
      <PcnCatalogCombobox id="pcn-lab-request" label="Chọn PYC gửi PTN" hideLabel value={activeLabRequestId} onChange={setSelectedLabRequestId} options={labRequestOptions} placeholder={labRequestOptions.length > 0 ? 'Tìm số PYC, phòng thử, lô hoặc mẫu...' : 'Chưa có PYC thuộc hồ sơ'} disabled={isGenerating || isPreflighting} />
      {selectedLabRequest && <p className="mt-1.5 text-[9px] leading-4 text-slate-500">PYC <b>{selectedLabRequest.pycNumber}</b> • {selectedLabRequest.laboratoryName} • Lô: {selectedLabRequestLot?.lotCode || 'chưa nối'} • Tuyến: {selectedLabRequestRoute?.labName || 'chưa nối'} • Hạn trả: {selectedLabRequest.targetDate || 'chưa đặt'}</p>}
      {!activeLabRequestId && <p className="mt-1.5 text-[9px] font-bold text-amber-700">Cần tạo PYC gửi PTN thuộc hồ sơ trước khi sinh phiếu.</p>}
    </div>}
    {dossierDocuments.length === 0 ? <p className="rounded-lg border border-dashed border-indigo-200 bg-white/70 p-3 text-[10px] text-slate-500">Chưa có bản sinh. Nhấn nút để tạo bản DOCX và PDF.</p> : <><div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-[10px] text-slate-700">Lineage Word/PDF gần nhất</b><p className="mt-0.5 text-[9px] text-slate-500">Chỉ ghép hai file khi cùng context và cùng mốc nguồn.</p></div><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${lineageStatusClass(lineageSummary.status)}`}>{lineageStatusLabel(lineageSummary.status)}</span></div>{lineageSummary.latest && <div className="mt-2 grid gap-1 text-[9px] text-slate-500 sm:grid-cols-3"><span className="truncate" title={lineageSummary.latest.contextHash}>Context: <b className="font-mono text-slate-700">{lineageSummary.latest.contextHash.slice(0, 16)}…</b></span><span>Word: <b className="text-slate-700">{lineageSummary.latest.docx ? lineageSummary.latest.docx.fileName : 'Chưa có'}</b></span><span>PDF: <b className="text-slate-700">{lineageSummary.latest.pdf ? lineageSummary.latest.pdf.fileName : 'Chưa có'}</b></span></div>}{lineageSummary.status === 'CONTEXT_MISMATCH' && <p className="mt-2 text-[9px] font-bold text-rose-700">Word và PDF hiện thuộc các context khác nhau; không coi là cùng một bộ. Hãy kiểm tra dữ liệu rồi sinh lại cả hai định dạng.</p>}{lineageSummary.status === 'STALE' && <p className="mt-2 text-[9px] font-bold text-amber-700">Nguồn hồ sơ đã thay đổi sau lần sinh gần nhất. Hãy chạy lại preflight trước khi sinh lại.</p>}{lineageSummary.status === 'MISSING_DOCX' && <p className="mt-2 text-[9px] font-bold text-rose-700">Lineage gần nhất chưa có bản Word.</p>}{lineageSummary.status === 'MISSING_PDF' && <p className="mt-2 text-[9px] font-bold text-rose-700">Lineage gần nhất chưa có bản PDF.</p>}</div><div className="grid gap-2 sm:grid-cols-2">{dossierDocuments.map((document) => { const isStale = Boolean(document.sourceUpdatedAt && sourceUpdatedAt && document.sourceUpdatedAt !== sourceUpdatedAt); const expectedRequirementCode = getPcnGeneratedDocumentRequirementCode(document.kind); const confirmableRequirements = expectedRequirementCode ? documentRequirements.filter((requirement) => requirement.code === expectedRequirementCode && dossier.fieldCodes.includes(requirement.fieldCode)) : []; const selectedRequirementId = confirmationRequirementIds[document.id] || (confirmableRequirements.length === 1 ? confirmableRequirements[0].id : ''); const selectedRequirement = confirmableRequirements.find((requirement) => requirement.id === selectedRequirementId); return <article key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1"><p className="truncate text-[10px] font-black text-slate-700">{kindLabel(document.kind)} • {document.format}</p>{isStale && <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">Cần sinh lại</span>}</div><p className="truncate text-[9px] text-slate-500">{document.fileName}</p><p className="mt-0.5 text-[9px] text-slate-400">{formatBytes(document.byteSize)} • {formatDateTime(document.generatedAt)}</p></div><div className="flex shrink-0 flex-col items-end gap-1.5"><div className="flex items-center gap-1.5"><PcnFilePreviewButton version={{ assetId: document.fileAssetId, fileName: document.fileName, mimeType: document.mimeType, uploadedAt: document.generatedAt, uploadedBy: document.generatedBy }} /><a href={getPcnFileUrl(document.fileAssetId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 underline underline-offset-2"><Download size={12} />Mở file</a></div>{canGenerate && confirmableRequirements.length > 0 && <div className="flex max-w-[19rem] flex-wrap items-center justify-end gap-1"><span className="text-[9px] text-slate-400">Bản nháp</span>{confirmableRequirements.length > 1 && <select aria-label={`Chọn checklist cho ${document.fileName}`} value={selectedRequirementId} onChange={(event) => setConfirmationRequirementIds((previous) => ({ ...previous, [document.id]: event.target.value }))} className="max-w-[12rem] rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] text-amber-900"><option value="">Chọn lĩnh vực</option>{confirmableRequirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.fieldCode} · {requirement.name}</option>)}</select>}<button type="button" disabled={!selectedRequirement || confirmingGeneratedId !== null} onClick={() => void confirmGenerated(document, selectedRequirement)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={12} />{confirmingGeneratedId === document.id ? 'Đang xác nhận…' : 'Xác nhận vào checklist'}</button></div>}</div></article>; })}</div></>}
  </section>;
}

export default PcnDocumentGenerationPanel;
