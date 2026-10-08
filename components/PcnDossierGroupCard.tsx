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
  PcnDossierStatus,
  PcnSampleLot,
  PcnSampleItem,
  PcnSampleRoute,
} from '../types';
import { toast } from 'sonner';

export interface PcnDossierGroupCardProps {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  sampleLots?: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes?: PcnSampleRoute[];
  canEdit?: boolean;
  onOpenDossier: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

  const receivedDdMm = formatDdMm(proposal.receivedAt);
  const targetDdMm = formatDdMm(dossier.targetDate);
  const brandLabel = proposal.brand || proposal.model || proposal.productType || '';

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${proposal.proposalCode} · ${dossier.dossierCode}`);
      toast.success(`Đã sao chép mã ${proposal.proposalCode}`);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-card-expand]')) {
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      data-testid="pcn-dossier-card"
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-3.5 shadow-2xs transition-all duration-200 cursor-pointer ${
        isExpanded
          ? 'border-emerald-300 ring-2 ring-emerald-100 shadow-md'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Compact Icon Box 24px */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-xs bg-slate-50 text-slate-500 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
          title={isExpanded ? 'Thu gọn' : 'Mở rộng tại chỗ'}
        >
          <FolderOpen size={11} strokeWidth={2.2} className="text-amber-600" />
        </div>

        {/* Info Column */}
        <div className="min-w-0 flex-1">
          {/* Top Line: Codes, Badges, and Action Toolbar */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span
                onClick={onOpenDossier}
                className="cursor-pointer font-black text-[11px] uppercase tracking-widest text-slate-800 transition-colors hover:text-emerald-700"
                title={`Mã Đề nghị: ${proposal.proposalCode}`}
              >
                {proposal.proposalCode}
              </span>

              <button
                type="button"
                onClick={onOpenDossier}
                className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
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
            <div className="request-card-action-group flex items-center gap-0.5 shrink-0 bg-white p-0.5 rounded-lg border border-slate-100 shadow-xs">
              {canEdit && proposalEditingAllowed && onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  title="Sửa Đề nghị"
                  className="inline-flex w-5.5 h-5.5 items-center justify-center rounded text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  <Edit3 size={11} strokeWidth={2.2} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDossier(); }}
                title="In / Xem hồ sơ"
                className="inline-flex w-5.5 h-5.5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <Printer size={11} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Sao chép mã hồ sơ"
                className="inline-flex w-5.5 h-5.5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <Copy size={11} strokeWidth={2} />
              </button>
              {onDelete && canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Xóa hồ sơ"
                  className="inline-flex w-5.5 h-5.5 items-center justify-center rounded text-rose-500 hover:bg-rose-600 hover:text-white transition-colors"
                >
                  <Trash2 size={11} strokeWidth={2} />
                </button>
              )}
              <div className="w-px h-3 bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                title={isExpanded ? 'Thu gọn' : 'Mở rộng chi tiết'}
                className="inline-flex w-5.5 h-5.5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                {isExpanded ? <ChevronUp size={11} strokeWidth={2.5} /> : <ChevronDown size={11} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* Line 2: Customer / Company Name */}
          <div className="mt-1">
            <h3
              onClick={onOpenDossier}
              className="cursor-pointer truncate text-[10px] font-bold text-slate-800 transition-colors hover:text-slate-900"
              title={proposal.customerSnapshot.name}
            >
              {proposal.customerSnapshot.name || 'CHƯA GẮN KHÁCH HÀNG'}
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
              onClick={onOpenDossier}
              className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
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
