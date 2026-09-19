'use client';

import React, { useState } from 'react';
import {
  FolderOpen,
  Building2,
  Package,
  Calendar,
  ChevronDown,
  ChevronUp,
  User,
  Layers,
  Edit3,
  CheckCircle2,
  Clock,
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
import { formatDateDdMmYyyy } from '../utils/formatter';

const statusLabels: Record<PcnDossierStatus, string> = {
  DRAFT: 'Bản nháp',
  INTAKE_REVIEW: 'Đang kiểm tra Đề nghị',
  AWAITING_DOCUMENTS: 'Chờ bổ sung hồ sơ',
  ASSIGNED: 'Đã phân công',
  PLAN_PENDING_APPROVAL: 'Chờ duyệt kế hoạch',
  FIELD_EVALUATION: 'Đang đánh giá',
  AWAITING_SAMPLING: 'Chờ lấy mẫu',
  SENT_TO_LAB: 'Đã gửi PTN',
  AWAITING_RESULTS: 'Chờ KQTN',
  CORRECTIVE_ACTION: 'Đang khắc phục',
  TECHNICAL_REVIEW: 'Đang soát xét kỹ thuật',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  ISSUED: 'Đã phát hành',
  DELIVERED: 'Đã giao khách hàng',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối / trả lại',
  CANCELLED: 'Đã hủy',
  ON_HOLD: 'Tạm dừng',
};

const statusClasses: Record<PcnDossierStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  INTAKE_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  AWAITING_DOCUMENTS: 'bg-rose-50 text-rose-700 border-rose-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  PLAN_PENDING_APPROVAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FIELD_EVALUATION: 'bg-violet-50 text-violet-700 border-violet-200',
  AWAITING_SAMPLING: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SENT_TO_LAB: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_RESULTS: 'bg-orange-50 text-orange-700 border-orange-200',
  CORRECTIVE_ACTION: 'bg-red-50 text-red-700 border-red-200',
  TECHNICAL_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
  WAITING_APPROVAL: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-teal-50 text-teal-700 border-teal-200',
  DELIVERED: 'bg-green-50 text-green-700 border-green-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  ON_HOLD: 'bg-amber-100 text-amber-800 border-amber-300',
};

export interface PcnDossierGroupCardProps {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  sampleLots?: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes?: PcnSampleRoute[];
  canEdit?: boolean;
  onOpenDossier: () => void;
  onEdit?: () => void;
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
}: PcnDossierGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const proposalEditingAllowed = Boolean(
    onEdit && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status)
  );

  // Filter lots and items belonging to this dossier
  const matchingLots = sampleLots.filter((lot) => lot.dossierId === dossier.id);
  const matchingLotIds = new Set(matchingLots.map((l) => l.id));
  const matchingItems = sampleItems.filter((item) => matchingLotIds.has(item.sampleLotId));

  // Determine progress status percentage
  const getProgressPercentage = (status: PcnDossierStatus): number => {
    switch (status) {
      case 'DRAFT': return 10;
      case 'INTAKE_REVIEW': return 25;
      case 'AWAITING_DOCUMENTS': return 35;
      case 'ASSIGNED': return 45;
      case 'PLAN_PENDING_APPROVAL': return 50;
      case 'FIELD_EVALUATION': return 60;
      case 'AWAITING_SAMPLING': return 65;
      case 'SENT_TO_LAB': return 75;
      case 'AWAITING_RESULTS': return 80;
      case 'TECHNICAL_REVIEW': return 85;
      case 'WAITING_APPROVAL': return 90;
      case 'APPROVED':
      case 'ISSUED':
      case 'DELIVERED':
      case 'ARCHIVED': return 100;
      default: return 50;
    }
  };

  const progress = getProgressPercentage(dossier.status);
  const isDone = progress === 100;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border bg-white shadow-2xs transition-all duration-200 hover:shadow-md hover:border-emerald-300 ${
        dossier.status === 'APPROVED' || dossier.status === 'ISSUED'
          ? 'border-slate-200/90'
          : 'border-slate-200'
      }`}
    >
      {/* Top Card Header */}
      <div className="p-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* Codes and Primary Tag */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-white shadow-3xs">
                <Layers size={11} className="text-emerald-400" />
                {proposal.proposalCode}
              </span>
              <button
                type="button"
                onClick={onOpenDossier}
                aria-label={`Mở hồ sơ ${dossier.dossierCode}`}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-800 transition-colors hover:bg-emerald-100 hover:text-emerald-950"
              >
                {dossier.dossierCode}
              </button>
              {proposal.fieldCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-indigo-700"
                >
                  {code}
                </span>
              ))}
            </div>

            {/* Customer Name */}
            <div className="mt-2 flex items-start gap-1.5">
              <Building2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <h3
                className="line-clamp-1 text-xs font-black text-slate-800"
                title={proposal.customerSnapshot.name || 'Chưa gắn khách hàng'}
              >
                {proposal.customerSnapshot.name || 'Chưa gắn khách hàng'}
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-tight ${
              statusClasses[dossier.status]
            }`}
          >
            {statusLabels[dossier.status]}
          </span>
        </div>

        {/* Product / Model Meta */}
        <div className="mt-2 rounded-lg bg-slate-50/80 p-2 border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Package size={12} className="shrink-0 text-slate-400" />
            <span className="truncate text-xs font-bold" title={proposal.productName}>
              {proposal.productName || 'Chưa có tên sản phẩm'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
            <span className="truncate" title={[proposal.model, proposal.brand].filter(Boolean).join(' · ')}>
              {[proposal.model, proposal.brand].filter(Boolean).join(' · ') || 'Chưa có kiểu loại / nhãn hiệu'}
            </span>
            <span className="font-semibold text-slate-600">
              Số lượng mẫu: <strong className="text-slate-900">{proposal.quantity || 1}</strong>
            </span>
          </div>
        </div>

        {/* Operational Indicators: Date, Owner, Progress */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1" title="Ngày tiếp nhận">
              <Calendar size={11} className="text-slate-400" />
              {formatDateDdMmYyyy(proposal.receivedAt) || 'Chưa cập nhật'}
            </span>
            <span className="inline-flex items-center gap-1" title="Chủ hồ sơ">
              <User size={11} className="text-slate-400" />
              <span className="truncate max-w-[120px]">
                {dossier.ownerUsername || 'Chưa phân công'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isDone ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={12} />
                Hoàn tất
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                <Clock size={11} />
                {progress}%
              </span>
            )}
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isDone ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Accordion Detail Drawer */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-3 text-[11px] text-slate-600">
          <div className="font-black uppercase tracking-wider text-slate-500 text-[10px] mb-1.5">
            Chi tiết mẫu & Thông số kỹ thuật
          </div>

          {matchingItems.length > 0 ? (
            <div className="space-y-1.5">
              {matchingItems.map((item, idx) => (
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
                    {item.testLabCodes && item.testLabCodes.length > 0 && (
                      <div className="flex gap-1">
                        {item.testLabCodes.map((lab) => (
                          <span
                            key={lab}
                            className="rounded bg-sky-50 px-1 py-0.5 text-[8px] font-black text-sky-700 border border-sky-200"
                          >
                            {lab}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-slate-200/60 bg-white p-2">
              <p className="font-semibold text-slate-700">
                {proposal.specifications || 'Chưa cập nhật thông số kỹ thuật chi tiết.'}
              </p>
              {proposal.warehouseAddress && (
                <p className="mt-1 text-slate-500 text-[10px]">
                  Kho / Điểm lấy mẫu: {proposal.warehouseAddress}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3.5 py-2">
        {/* Accordion toggle button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <>
              Thu gọn <ChevronUp size={13} />
            </>
          ) : (
            <>
              Chi tiết mẫu <ChevronDown size={13} />
            </>
          )}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canEdit && proposalEditingAllowed && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Edit3 size={11} />
              Sửa Đề nghị
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDossier}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-3xs transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <FolderOpen size={13} />
            Mở hồ sơ
            <ArrowRight size={11} className="opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PcnDossierGroupCard;
