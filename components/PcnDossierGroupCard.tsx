'use client';

import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  Building2,
  Package,
  Calendar,
  ChevronDown,
  ChevronUp,
  User,
  Edit3,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type {
  CertificationDossier,
  CertificationProposal,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleLot,
  PcnSampleItem,
  PcnSampleRoute,
} from '../types';
import { toast } from 'sonner';
import { buildPcnDossierCompleteness } from '../utils/pcnDossierPipeline';

export interface PcnDossierGroupCardProps {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  documentRequirements: PcnDocumentRequirement[];
  dossierDocuments: PcnDossierDocument[];
  dataLoaded: boolean;
  sampleLots?: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes?: PcnSampleRoute[];
  canEdit?: boolean;
  onOpenDossier: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export type PcnDossierRequiredDocumentSummary =
  | { state: 'LOADING' }
  | { state: 'NO_REQUIREMENTS'; missingCount: 0; labels: []; additionalMissingCount: 0 }
  | { state: 'COMPLETE'; missingCount: 0; labels: []; additionalMissingCount: 0 }
  | { state: 'MISSING'; missingCount: number; labels: string[]; additionalMissingCount: number };

export function buildPcnDossierRequiredDocumentSummary(input: {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  dataLoaded: boolean;
}): PcnDossierRequiredDocumentSummary {
  if (!input.dataLoaded) return { state: 'LOADING' };

  const completeness = buildPcnDossierCompleteness({
    dossier: input.dossier,
    proposal: input.proposal,
    requirements: input.requirements,
    documents: input.documents,
  });
  const missingCount = completeness.missingRequirementIds.length;
  if (completeness.requiredDocumentTotal === 0) {
    return { state: 'NO_REQUIREMENTS', missingCount: 0, labels: [], additionalMissingCount: 0 };
  }
  if (missingCount === 0) return { state: 'COMPLETE', missingCount: 0, labels: [], additionalMissingCount: 0 };

  const labels = completeness.missingLabels.slice(0, 2);
  return {
    state: 'MISSING',
    missingCount,
    labels,
    additionalMissingCount: Math.max(0, missingCount - labels.length),
  };
}

function formatDdMm(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function PcnDossierGroupCard({
  proposal,
  dossier,
  documentRequirements,
  dossierDocuments,
  dataLoaded,
  sampleLots = [],
  sampleItems = [],
  sampleRoutes = [],
  canEdit,
  onOpenDossier,
  onEdit,
  onDelete,
}: PcnDossierGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const proposalEditingAllowed = Boolean(
    onEdit && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status)
  );

  // Filter lots and items belonging to this dossier
  const matchingLots = sampleLots.filter((lot) => lot.dossierId === dossier.id);
  const matchingLotIds = new Set(matchingLots.map((l) => l.id));
  const matchingItems = sampleItems.filter((item) => matchingLotIds.has(item.sampleLotId));
  const totalSamples = matchingItems.length || proposal.quantity || 1;
  const isDone = ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(dossier.status);

  // Calculate done count
  const doneItemsCount = matchingItems.filter((item) => {
    const itemRoutes = sampleRoutes.filter((r) => r.sampleLotId === item.sampleLotId);
    return itemRoutes.some((r) => r.status === 'RESULT_RETURNED' || r.status === 'CLOSED');
  }).length;
  const completionRatio = isDone ? totalSamples : doneItemsCount;
  const progressRatioLabel = `${completionRatio}/${totalSamples} XONG`;
  const progressPercent = isDone ? 100 : Math.round((completionRatio / totalSamples) * 100);
  const requiredDocumentSummary = buildPcnDossierRequiredDocumentSummary({
    dossier,
    proposal,
    requirements: documentRequirements,
    documents: dossierDocuments,
    dataLoaded,
  });

  const receivedDdMm = formatDdMm(proposal.receivedAt);
  const targetDdMm = formatDdMm(dossier.targetDate);
  const brandLabel = proposal.brand || proposal.model || proposal.productType || '';

  const handleCopyCode = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Không thể sao chép mã hồ sơ.');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${proposal.proposalCode} · ${dossier.dossierCode}`);
      toast.success(`Đã sao chép mã ${proposal.proposalCode}`);
    } catch {
      toast.error('Không thể sao chép mã hồ sơ.');
    }
  };

  return (
    <div
      data-testid="pcn-dossier-card"
      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-3.5 shadow-2xs transition-all duration-200 ${
        isExpanded
          ? 'border-emerald-300 ring-2 ring-emerald-100 shadow-md'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={isExpanded ? 'Thu gọn chi tiết hồ sơ' : 'Mở rộng chi tiết hồ sơ'}
          aria-expanded={isExpanded}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          className="mobile-touch-target inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 shadow-xs transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          title={isExpanded ? 'Thu gọn' : 'Mở rộng tại chỗ'}
        >
          <FolderOpen size={15} strokeWidth={2.2} className="text-amber-600" />
        </button>

        {/* Info Column */}
        <div className="min-w-0 flex-1">
          {/* Top Line: Codes, Badges, and Action Toolbar */}
          <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
                className="mobile-touch-target inline-flex min-h-11 items-center rounded px-1 font-black text-[11px] uppercase tracking-widest text-slate-800 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                title={`Mã Đề nghị: ${proposal.proposalCode}`}
              >
                {proposal.proposalCode}
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
                className="mobile-touch-target inline-flex min-h-11 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                title={`Mã hồ sơ: ${dossier.dossierCode}`}
              >
                {dossier.dossierCode}
              </button>

              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-600 border border-slate-200/50 shadow-xs">
                {totalSamples} mẫu
              </span>

              {receivedDdMm && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500 border border-slate-200/50 shadow-xs" title={`Ngày tiếp nhận: ${receivedDdMm}`}>
                  {receivedDdMm}
                </span>
              )}

              {targetDdMm && (
                <span className="rounded border border-blue-100 bg-blue-50/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700 shadow-xs" title={`Hạn hoàn tất: ${targetDdMm}`}>
                  {targetDdMm}
                </span>
              )}
            </div>

            {/* Quick Actions Icons (DDT style) */}
            <div className="request-card-action-group flex w-full flex-wrap items-center justify-end gap-0.5 rounded-lg border border-slate-100 bg-white p-0.5 shadow-xs xl:w-auto xl:shrink-0">
              {canEdit && proposalEditingAllowed && onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  aria-label="Sửa đề nghị"
                  title="Sửa Đề nghị"
                  className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded text-blue-600 transition-colors hover:bg-blue-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <Edit3 size={11} strokeWidth={2.2} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
                aria-label="In hoặc xem hồ sơ"
                title="In / Xem hồ sơ"
                className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <Printer size={11} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Sao chép mã hồ sơ"
                title="Sao chép mã hồ sơ"
                className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <Copy size={11} strokeWidth={2} />
              </button>
              {onDelete && canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  aria-label="Xóa hồ sơ"
                  title="Xóa hồ sơ"
                  className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded text-rose-500 transition-colors hover:bg-rose-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <Trash2 size={11} strokeWidth={2} />
                </button>
              )}
              <div aria-hidden="true" className="mx-0.5 h-3 w-px bg-slate-200" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                aria-label={isExpanded ? 'Thu gọn chi tiết hồ sơ' : 'Mở rộng chi tiết hồ sơ'}
                aria-expanded={isExpanded}
                title={isExpanded ? 'Thu gọn' : 'Mở rộng chi tiết'}
                className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {isExpanded ? <ChevronUp size={11} strokeWidth={2.5} /> : <ChevronDown size={11} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* Line 2: Customer / Company Name */}
          <div className="mt-1 min-w-0">
            <h3 className="min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
                className="mobile-touch-target inline-flex min-h-11 max-w-full items-center truncate text-left text-[10px] font-bold text-slate-800 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                title={proposal.customerSnapshot.name}
              >
                {proposal.customerSnapshot.name || 'CHƯA GẮN KHÁCH HÀNG'}
              </button>
            </h3>
          </div>

          {/* Line 3: Brand & Product info */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-600">
            {brandLabel && (
              <span className="rounded border border-amber-200/60 bg-amber-50 px-1.5 py-0.2 font-bold uppercase tracking-wider text-amber-900 text-[8px]">
                {brandLabel}
              </span>
            )}
            {proposal.productName && (
              <span className="truncate text-slate-500 font-medium">
                {proposal.productName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Accordion Detail Drawer */}
      {isExpanded && (
        <div className="mt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl text-[11px] text-slate-600 space-y-2">
          <section data-testid="pcn-dossier-required-documents" aria-label="Tài liệu bắt buộc" className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className={`font-bold ${requiredDocumentSummary.state === 'MISSING' ? 'text-amber-800' : 'text-slate-700'}`}>
              {requiredDocumentSummary.state === 'LOADING' && 'Đang tải danh sách tài liệu bắt buộc…'}
              {requiredDocumentSummary.state === 'NO_REQUIREMENTS' && 'Chưa có cấu hình tài liệu bắt buộc cho Lĩnh vực này.'}
              {requiredDocumentSummary.state === 'COMPLETE' && 'Đủ tài liệu bắt buộc.'}
              {requiredDocumentSummary.state === 'MISSING' && `Thiếu ${requiredDocumentSummary.missingCount} tài liệu bắt buộc.`}
            </p>
            {requiredDocumentSummary.state === 'MISSING' && (
              <>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-600">
                  {requiredDocumentSummary.labels.map((label) => <li key={label}>{label}</li>)}
                </ul>
                {requiredDocumentSummary.additionalMissingCount > 0 && <p className="mt-1 text-slate-500">Còn {requiredDocumentSummary.additionalMissingCount} mục bắt buộc khác.</p>}
              </>
            )}
          </section>

          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
            <span>Chi tiết mẫu & Thông số kỹ thuật</span>
            <span className="text-[9px] font-bold text-slate-400">Trạng thái KQTN sơ bộ</span>
          </div>

          {matchingItems.length > 0 ? (
            <div className="space-y-1.5">
              {matchingItems.map((item, idx) => {
                const itemRoutes = sampleRoutes.filter((r) => r.sampleLotId === item.sampleLotId);
                const hasResult = itemRoutes.some((r) => r.status === 'RESULT_RETURNED' || r.status === 'CLOSED');
                const isTesting = itemRoutes.some((r) => r.status === 'RECEIVED' || r.status === 'SENT');
                const preliminaryOutcome = hasResult ? 'Đã có KQ' : isTesting ? 'Đang thử' : 'Chờ KQ';
                return (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between rounded-md border border-slate-200/80 bg-white px-2 py-1 text-slate-700"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] font-black text-slate-500">
                        #{item.sampleCode || idx + 1}
                      </span>
                      <span className="truncate font-semibold text-xs">{item.model || item.sampleType}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500">
                        {item.quantity} {item.unit || 'mẫu'}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                        hasResult ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                        isTesting ? 'border-blue-200 bg-blue-50 text-blue-800' :
                        'border-amber-200 bg-amber-50 text-amber-800'
                      }`}>
                        {preliminaryOutcome}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded border border-slate-200/60 bg-white p-2 text-xs">
              <p className="font-semibold text-slate-700">
                {proposal.productName} {proposal.model ? `· ${proposal.model}` : ''}
              </p>
              {proposal.specifications && (
                <p className="mt-1 text-slate-500 text-[10px] line-clamp-2">
                  {proposal.specifications}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
            <span>Chủ hồ sơ: <strong className="text-slate-800">{dossier.ownerUsername || 'Chưa phân công'}</strong></span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
              className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded text-emerald-700 font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Mở chi tiết hồ sơ <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Row 4 (Bottom): Progress Bar & Status Text */}
      <div className="mt-2.5 flex items-center justify-between gap-3 pt-1">
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPercent > 0 ? 'bg-emerald-500' : 'bg-transparent'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-[11px] font-black text-slate-500 whitespace-nowrap">
          {progressRatioLabel}
        </span>
      </div>
    </div>
  );
}

export default PcnDossierGroupCard;
