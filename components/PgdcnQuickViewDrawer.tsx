'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  X,
  ExternalLink,
  Building2,
  Calendar,
  User,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';

import { usePcnStore } from '../store-pcn';
import { usePgdStore } from '../store-pgd';

export interface QuickViewChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  status: string;
  stage?: string;
  code?: string;
}

export interface QuickViewStageItem {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'upcoming' | 'waiting';
}

export interface QuickViewDossierItem {
  id?: string;
  dossierCode: string;
  domain: 'PCN' | 'PGD';
  customerName?: string;
  productName?: string;
  dossierType?: string;
  status?: string;
  statusLabel?: string;
  currentStage?: string;
  nextStep?: string;
  progressPercent?: number;
  assigneeName?: string;
  targetDate?: string;
  createdAt?: string;
  checklist?: QuickViewChecklistItem[];
  stages?: QuickViewStageItem[];
}

export interface PgdcnQuickViewDrawerProps {
  open: boolean;
  item?: QuickViewDossierItem | null;
  dossierCode?: string;
  domain?: 'PCN' | 'PGD';
  onClose: () => void;
  onOpenFullDetail?: (domain: 'PCN' | 'PGD', idOrCode: string) => void;
}

const PCN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  INTAKE_REVIEW: 'Tiếp nhận hồ sơ',
  AWAITING_DOCUMENTS: 'Chờ bổ sung tài liệu',
  ASSIGNED: 'Đã phân công',
  PLAN_PENDING_APPROVAL: 'Kế hoạch chờ duyệt',
  FIELD_EVALUATION: 'Đánh giá hiện trường',
  AWAITING_SAMPLING: 'Chờ lấy mẫu',
  SENT_TO_LAB: 'Đã gửi PTN',
  AWAITING_RESULTS: 'Chờ KQTN',
  CORRECTIVE_ACTION: 'Hành động khắc phục',
  TECHNICAL_REVIEW: 'Soát xét kỹ thuật',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  ISSUED: 'Đã cấp chứng chỉ',
  DELIVERED: 'Đã bàn giao',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  ON_HOLD: 'Tạm dừng',
};

const PGD_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  CAPABILITY_REVIEW: 'Xem xét năng lực',
  READY_TO_EXECUTE: 'Sẵn sàng thực hiện',
  PREPARING: 'Đang chuẩn bị',
  FIELD_INSPECTION: 'Giám định hiện trường',
  WAITING_LAB_RESULTS: 'Chờ kết quả PTN',
  RESULTS_REVIEW: 'Soát xét kết quả',
  TECHNICAL_REVIEW: 'Soát xét kỹ thuật',
  LEADERSHIP_APPROVAL: 'Lãnh đạo duyệt',
  SIGNED: 'Đã ký chứng thư',
  RESULT_RETURNED: 'Đã trả kết quả',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  ON_HOLD: 'Tạm dừng',
};

const DOCUMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PRESENT: { label: 'Đã có', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ATTACHED: { label: 'Đã gắn hồ sơ', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  UPLOADED: { label: 'Đã tải lên', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  GENERATED: { label: 'Đã sinh', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DRAFTING: { label: 'Đang soạn', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  PENDING_CONFIRMATION: { label: 'Chờ xác nhận', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  REVISION_REQUESTED: { label: 'Cần sửa', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  WAIVED: { label: 'Được miễn', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  MISSING: { label: 'Chưa có', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function PgdcnQuickViewDrawer({
  open,
  item,
  dossierCode,
  domain: requestedDomain,
  onClose,
  onOpenFullDetail,
}: PgdcnQuickViewDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Resilient store resolution: In React 19 SSR / renderToStaticMarkup, useSyncExternalStore
  // invokes getServerSnapshot returning initial state. Fall back to getState() when empty.
  const pcnHook = usePcnStore();
  const pcn = pcnHook.dossiers?.length > 0 ? pcnHook : usePcnStore.getState();
  const pgdHook = usePgdStore();
  const pgd = pgdHook.requests?.length > 0 ? pgdHook : usePgdStore.getState();

  const resolvedData: QuickViewDossierItem | null = useMemo(() => {
    if (item) return item;
    const code = dossierCode?.trim();
    if (!code) return null;

    // Search PCN store with null-defensive safeguards
    // Note on empirical vulnerability: legacy unshielded proposal?.customerSnapshot.name and pcnDossier.fieldCodes.join
    const pcnDossiers = pcn.dossiers || [];
    const pcnDossier = pcnDossiers.find((d) => d.dossierCode === code || d.id === code);
    if (pcnDossier && (!requestedDomain || requestedDomain === 'PCN')) {
      const proposals = pcn.proposals || [];
      const proposal = proposals.find((p) => p.id === pcnDossier.proposalId);
      const fieldCodes = pcnDossier.fieldCodes || [];
      const documentRequirements = pcn.documentRequirements || [];
      const reqs = documentRequirements.filter((r) => fieldCodes.includes(r.fieldCode));
      const dossierDocuments = pcn.dossierDocuments || [];
      const docs = dossierDocuments.filter((d) => d.dossierId === pcnDossier.id);
      const docByReq = new Map(docs.map((d) => [d.requirementId, d]));

      const checklist: QuickViewChecklistItem[] = reqs.map((req) => {
        const doc = docByReq.get(req.id);
        const waiver = pcnDossier.documentWaivers?.[req.id];
        let status = 'MISSING';
        if (waiver) status = 'WAIVED';
        else if (doc) status = doc.status || 'PRESENT';
        return {
          id: req.id,
          code: req.code,
          label: req.name || req.code,
          required: req.required,
          status,
          stage: req.stages?.[0],
        };
      });

      const defaultStages: QuickViewStageItem[] = [
        { id: 'intake', label: 'Tiếp nhận', status: 'completed' },
        { id: 'eval', label: 'Đánh giá', status: ['FIELD_EVALUATION', 'SENT_TO_LAB', 'AWAITING_RESULTS'].includes(pcnDossier.status) ? 'active' : 'upcoming' },
        { id: 'review', label: 'Soát xét', status: pcnDossier.status === 'TECHNICAL_REVIEW' ? 'active' : 'upcoming' },
        { id: 'approval', label: 'Phê duyệt', status: ['WAITING_APPROVAL', 'APPROVED'].includes(pcnDossier.status) ? 'active' : 'upcoming' },
        { id: 'issuance', label: 'Cấp chứng chỉ', status: ['ISSUED', 'DELIVERED', 'ARCHIVED'].includes(pcnDossier.status) ? 'completed' : 'upcoming' },
      ];

      const fieldCodesLabel = fieldCodes.join(', ');

      return {
        id: pcnDossier.id,
        dossierCode: pcnDossier.dossierCode,
        domain: 'PCN',
        customerName: pcnDossier.customerSnapshot?.name || proposal?.customerSnapshot?.name || 'Khách hàng PCN',
        productName: proposal?.productName || fieldCodesLabel || code,
        dossierType: fieldCodesLabel || 'PCN',
        status: pcnDossier.status,
        statusLabel: PCN_STATUS_LABELS[pcnDossier.status] || pcnDossier.status,
        assigneeName: pcnDossier.ownerUsername || 'Chưa phân công',
        targetDate: pcnDossier.targetDate,
        createdAt: pcnDossier.createdAt,
        checklist,
        stages: defaultStages,
      };
    }

    // Search PGD store with null-defensive safeguards
    const pgdRequests = pgd.requests || [];
    const pgdReq = pgdRequests.find((r) => r.requestCode === code || r.id === code);
    if (pgdReq && (!requestedDomain || requestedDomain === 'PGD')) {
      const pgdDocs = pgd.documents || [];
      const docs = pgdDocs.filter((d) => d.requestId === pgdReq.id);
      const checklist: QuickViewChecklistItem[] = docs.map((doc) => ({
        id: doc.id,
        label: doc.fileName || doc.kind || doc.templateCode || 'Tài liệu giám định',
        required: true,
        status: doc.status || 'PRESENT',
      }));

      const defaultStages: QuickViewStageItem[] = [
        { id: 'intake', label: 'Tiếp nhận', status: 'completed' },
        { id: 'prep', label: 'Chuẩn bị', status: ['PREPARING', 'READY_TO_EXECUTE'].includes(pgdReq.status) ? 'active' : 'upcoming' },
        { id: 'field', label: 'Hiện trường & Mẫu', status: ['FIELD_INSPECTION', 'WAITING_LAB_RESULTS'].includes(pgdReq.status) ? 'active' : 'upcoming' },
        { id: 'review', label: 'Soát xét KQTN', status: ['RESULTS_REVIEW', 'TECHNICAL_REVIEW'].includes(pgdReq.status) ? 'active' : 'upcoming' },
        { id: 'issuance', label: 'Phê duyệt & Cấp', status: ['LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(pgdReq.status) ? 'completed' : 'upcoming' },
      ];

      return {
        id: pgdReq.id,
        dossierCode: pgdReq.requestCode,
        domain: 'PGD',
        customerName: pgdReq.customerSnapshot?.name || 'Khách hàng PGD',
        productName: pgdReq.productName || pgdReq.productGroup || 'Hàng hóa giám định',
        dossierType: pgdReq.productGroup || 'Giám định',
        status: pgdReq.status,
        statusLabel: PGD_STATUS_LABELS[pgdReq.status] || pgdReq.status,
        assigneeName: pgdReq.receivedByUsername || 'Chưa phân công',
        createdAt: pgdReq.createdAt,
        checklist,
        stages: defaultStages,
      };
    }

    // Fallback minimal projection if not found in local state
    return {
      dossierCode: code,
      domain: requestedDomain || 'PCN',
      status: 'INTAKE_REVIEW',
      statusLabel: 'Đang xử lý',
      customerName: 'Hồ sơ chuyên ngành',
      productName: code,
    };
  }, [item, dossierCode, requestedDomain, pcn.dossiers, pcn.proposals, pcn.documentRequirements, pcn.dossierDocuments, pgd.requests, pgd.documents]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const data = resolvedData;
  const isPcn = data?.domain === 'PCN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pgdcn-quickview-title"
      data-testid="pgdcn-quick-view-drawer"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel: 480-560px on desktop, full width on mobile */}
      <div className="relative flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out sm:max-w-md md:max-w-lg lg:max-w-xl">
        {/* Header bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                isPcn ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {data?.domain || 'PCN'}
            </span>
            <h2 id="pgdcn-quickview-title" className="truncate text-base font-bold text-slate-900">
              {data?.dossierCode || 'Xem nhanh hồ sơ'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenFullDetail && data?.dossierCode && (
              <button
                type="button"
                onClick={() => onOpenFullDetail(data.domain, data.id || data.dossierCode)}
                className="mobile-touch-target inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Mở toàn bộ hồ sơ chi tiết"
              >
                <span>Mở chi tiết</span>
                <ExternalLink size={13} aria-hidden="true" />
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng xem nhanh"
              className="mobile-touch-target rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Scrollable content body */}
        <div className="mobile-scroll-y min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Main Info Card */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4" aria-label="Thông tin chung hồ sơ">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Khách hàng</p>
                <h3 className="mt-0.5 text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{data?.customerName || 'Chưa có thông tin'}</span>
                </h3>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  isPcn
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
              >
                {data?.statusLabel || data?.status || 'Đang xử lý'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-200/80 pt-3">
              <div>
                <span className="text-slate-500 flex items-center gap-1">
                  <Package size={12} className="text-slate-400" />
                  Hàng hóa / Sản phẩm:
                </span>
                <p className="mt-0.5 font-semibold text-slate-800 truncate" title={data?.productName}>
                  {data?.productName || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-500 flex items-center gap-1">
                  <User size={12} className="text-slate-400" />
                  Phụ trách:
                </span>
                <p className="mt-0.5 font-semibold text-slate-800 truncate">
                  {data?.assigneeName || 'Chưa phân công'}
                </p>
              </div>
              {data?.targetDate && (
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    Hạn xử lý:
                  </span>
                  <p className="mt-0.5 font-semibold text-slate-800">{data.targetDate}</p>
                </div>
              )}
              {data?.dossierType && (
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers size={12} className="text-slate-400" />
                    Quy chuẩn / Loại:
                  </span>
                  <p className="mt-0.5 font-semibold text-slate-800">{data.dossierType}</p>
                </div>
              )}
            </div>
          </section>

          {/* Workflow Stage Timeline */}
          {data?.stages && data.stages.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4" aria-label="Tiến trình quy trình">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5 flex items-center gap-1.5">
                <Shield size={13} className="text-slate-500" />
                Tiến trình xử lý
              </h4>
              <ol className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                {data.stages.map((stage, idx) => {
                  const isCompleted = stage.status === 'completed';
                  const isActive = stage.status === 'active';
                  return (
                    <li key={stage.id} className="flex flex-1 flex-col items-center text-center min-w-[70px]">
                      <div className="flex items-center w-full">
                        <div
                          className={`flex h-6 w-6 shrink-0 mx-auto items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                        </div>
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] leading-tight font-medium ${
                          isActive ? 'font-bold text-blue-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Checklist Documents Table */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4" aria-label="Checklist hồ sơ tài liệu">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-500" />
                Checklist tài liệu ({data?.checklist?.length || 0})
              </h4>
              {data?.checklist && (
                <span className="text-[11px] font-semibold text-slate-500">
                  {data.checklist.filter((item) => ['APPROVED', 'CONFIRMED', 'PRESENT', 'ATTACHED'].includes(item.status)).length}/
                  {data.checklist.length} hoàn thành
                </span>
              )}
            </div>

            {data?.checklist && data.checklist.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">Tên tài liệu</th>
                      <th scope="col" className="px-2 py-2 text-center w-20">Yêu cầu</th>
                      <th scope="col" className="px-3 py-2 text-right w-28">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.checklist.map((docItem) => {
                      const badge = DOCUMENT_STATUS_BADGES[docItem.status] || {
                        label: docItem.status,
                        className: 'bg-slate-100 text-slate-600 border-slate-200',
                      };
                      return (
                        <tr key={docItem.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{docItem.label}</span>
                            {docItem.stage && (
                              <span className="block text-[10px] text-slate-400">{docItem.stage}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                docItem.required
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-50 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {docItem.required ? 'Bắt buộc' : 'Tùy chọn'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                <p>Chưa có danh mục checklist tài liệu cho hồ sơ này.</p>
                <p className="mt-1 text-[11px] text-slate-400">Chưa có tài liệu nào trong danh mục checklist của hồ sơ này.</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Đóng
          </button>
          {onOpenFullDetail && data?.dossierCode && (
            <button
              type="button"
              onClick={() => onOpenFullDetail(data.domain, data.id || data.dossierCode)}
              className="mobile-touch-target inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>Xem chi tiết hồ sơ</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
