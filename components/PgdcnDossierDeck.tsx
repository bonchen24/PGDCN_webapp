'use client';

import React, { useState, useMemo, useEffect, type ReactNode } from 'react';
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
  AlertTriangle,
  FileWarning,
  ExternalLink,
  Layers,
  Search,
  Filter,
  Check,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
  UserCheck,
  AlertCircle,
  Truck,
  Pencil,
  Award,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';

// ============================================================================
// Types & Contracts
// ============================================================================

import type { LucideIcon } from 'lucide-react';

export type DossierComponentStage = {
  id: string;
  name: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING' | 'MISSING' | 'LOCKED' | 'NOT_APPLICABLE';
  statusLabel: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type DossierBlockerItem = {
  id: string;
  title: string;
  reason: string;
  severity?: 'HARD' | 'WARNING';
  actionLabel?: string;
  onAction?: () => void;
};

export type DossierNextActionSpec = {
  title: string;
  reason: string;
  owner?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type DossierQuickAction = {
  id: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{ size?: number | string; className?: string }>;
  tone?: 'default' | 'primary' | 'danger' | 'warning';
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
};

export type DossierBusinessBadge = {
  id: string;
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'info' | 'purple';
};

export interface PgdcnDossierItemModel {
  id: string;
  domain: 'PCN' | 'PGD';
  primaryCode: string;
  secondaryCode?: string;
  status: string;
  statusLabel: string;
  customerName: string;
  productName: string;
  brandOrGroup?: string;
  fieldOrCatalogBadge?: string;
  sampleCountLabel?: string;
  regDateDisplay?: string;
  deadlineDisplay?: string;
  ownerName?: string;
  currentStepLabel: string;
  currentStepNumber?: number;
  receivedDate?: string;
  targetDate?: string;
  completenessPercent: number;
  completenessLabel?: string;
  missingRequiredCount?: number;
  isOverdue?: boolean;
  businessBadges?: DossierBusinessBadge[];
  deepSearchTokens?: string[];
  creatorDisplayName?: string;
  effectiveContactPerson?: string;
  updatedAtLabel?: string;
  nextAction?: DossierNextActionSpec;
  blockers?: DossierBlockerItem[];
  stages?: DossierComponentStage[];
  customMeta?: ReactNode;
}

// ============================================================================
// Highlight Text Helper (matching DDT behavior)
// ============================================================================

export function HighlightText({ text, search }: { text?: string | null; search?: string }) {
  if (!text) return null;
  if (!search || !search.trim()) return <>{text}</>;

  const query = search.trim();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ============================================================================
// Quick Actions Toolbar (Zone 1 Right - DDT pattern)
// ============================================================================

export interface PgdcnDossierQuickActionsProps {
  actions: DossierQuickAction[];
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent) => void;
  onOpenDetail?: (e: React.MouseEvent) => void;
  onCopyCode?: (e: React.MouseEvent) => void;
}

export function PgdcnDossierQuickActions({
  actions,
  isExpanded,
  onToggleExpand,
  onOpenDetail,
  onCopyCode,
}: PgdcnDossierQuickActionsProps) {
  return (
    <div
      data-testid="dossier-quick-actions"
      className="request-card-action-group flex w-full flex-wrap items-center justify-end gap-1 md:w-auto shrink-0 bg-white p-1 rounded-xl border border-slate-200/80 shadow-xs"
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((act) => {
        const Icon = act.icon;
        const colorClasses =
          act.tone === 'primary'
            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600'
            : act.tone === 'danger'
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600'
            : act.tone === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300';

        return (
          <button
            key={act.id}
            type="button"
            disabled={act.disabled}
            onClick={(e) => {
              e.stopPropagation();
              act.onClick(e);
            }}
            title={act.label}
            aria-label={act.label}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${colorClasses}`}
          >
            <Icon size={16} strokeWidth={2.2} />
          </button>
        );
      })}

      {onCopyCode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopyCode(e);
          }}
          title="Sao chép mã hồ sơ"
          aria-label="Sao chép mã hồ sơ"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
        >
          <Copy size={16} strokeWidth={2} />
        </button>
      )}

      {onOpenDetail && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(e);
          }}
          title="Mở hồ sơ chi tiết"
          aria-label="Mở hồ sơ chi tiết"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
        >
          <ExternalLink size={16} strokeWidth={2} />
        </button>
      )}

      {onToggleExpand && (
        <>
          <div className="w-px h-5 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(e);
            }}
            title={isExpanded ? 'Thu gọn' : 'Mở rộng tại chỗ'}
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng tại chỗ'}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={16} strokeWidth={2.2} /> : <ChevronDown size={16} strokeWidth={2.2} />}
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Card Header & Zones 1 to 4
// ============================================================================

export interface PgdcnDossierCardHeaderProps {
  item: PgdcnDossierItemModel;
  quickActions: DossierQuickAction[];
  isExpanded: boolean;
  onToggleExpand: (e: React.MouseEvent) => void;
  onOpenDetail: () => void;
  searchQuery?: string;
}

export function PgdcnDossierCardHeader({
  item,
  quickActions,
  isExpanded,
  onToggleExpand,
  onOpenDetail,
  searchQuery = '',
}: PgdcnDossierCardHeaderProps) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const codes = [item.primaryCode, item.secondaryCode].filter(Boolean).join(' · ');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(codes);
      toast.success(`Đã sao chép mã ${codes}`);
    }
  };

  const deadlineDisplay = item.deadlineDisplay || item.targetDate;

  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:items-center md:gap-x-3 md:gap-y-1">
      {/* ================================================================== */}
      {/* ZONE 1: HEADER (Primary Code, Status Badge, Tags, Quick Actions)   */}
      {/* ================================================================== */}
      <div data-testid="dossier-header-zone" className="flex flex-wrap items-start gap-x-2 gap-y-1 md:col-span-4 md:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {/* Icon box compact 20px */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 shadow-xs">
            {item.domain === 'PCN' ? (
              <Layers size={11} strokeWidth={2.2} className="text-amber-600" />
            ) : (
              <FolderOpen size={11} strokeWidth={2.2} className="text-blue-600" />
            )}
          </div>

          {/* Primary Dossier Code */}
          <h3 className="min-w-0 break-words text-xs font-black leading-tight tracking-wide text-slate-900 uppercase">
            <HighlightText text={item.primaryCode} search={searchQuery} />
          </h3>

          {/* Secondary Code if present */}
          {item.secondaryCode && (
            <span className="break-words rounded border border-slate-200/60 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
              <HighlightText text={item.secondaryCode} search={searchQuery} />
            </span>
          )}

          {/* Status Badge */}
          <PgdcnStatusBadge domain={item.domain} status={item.status} label={item.statusLabel} />

          {/* Sample count or batch size label */}
          {item.sampleCountLabel && (
            <span className="rounded border border-slate-200/50 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-xs">
              {item.sampleCountLabel}
            </span>
          )}

          {/* Registration Date */}
          {item.regDateDisplay && (
            <span className="rounded border border-slate-200/50 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-xs" title="Ngày tiếp nhận/đăng ký">
              {item.regDateDisplay}
            </span>
          )}

          {/* Domain / Field / Catalog Badge */}
          {item.fieldOrCatalogBadge && (
            <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-blue-700 uppercase">
              {item.fieldOrCatalogBadge}
            </span>
          )}

        </div>

        {/* Quick Actions (Zone 1 Right) */}
        <PgdcnDossierQuickActions
          actions={quickActions}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onOpenDetail={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          onCopyCode={handleCopy}
        />
      </div>

      {/* ================================================================== */}
      {/* ZONE 2: PRIMARY METADATA (Customer, Product, Brand, Assignee)      */}
      {/* ================================================================== */}
      <div data-testid="dossier-metadata-zone" className="mt-0 grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 md:col-span-4 md:row-start-2">
        {/* Customer Name */}
        <p className="min-w-0 break-words text-[10px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Khách hàng:</span>
          <span className="font-bold text-slate-900" title={item.customerName || 'Chưa gắn khách hàng'}>
            <HighlightText text={item.customerName || 'Chưa gắn khách hàng'} search={searchQuery} />
          </span>
        </p>

        {/* Product / Object / Subject */}
        <p className="min-w-0 break-words text-[10px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Đối tượng:</span>
          <span className="font-medium text-slate-700" title={item.productName || 'Chưa có đối tượng'}>
            <HighlightText text={item.productName || 'Chưa có đối tượng'} search={searchQuery} />
          </span>
        </p>

        <p className="min-w-0 break-words text-[10px] leading-4 text-slate-700" title={item.currentStepLabel || 'Chưa có dữ liệu'}>
          <span className="mr-1 font-semibold text-slate-500">Bước nghiệp vụ:</span>
          <span className="font-medium text-slate-700">
            {item.currentStepLabel || 'Chưa có dữ liệu'}
          </span>
        </p>

        <p className="min-w-0 break-words text-[10px] leading-4 text-slate-700" title={item.ownerName || 'Chưa có dữ liệu'}>
          <span className="mr-1 font-semibold text-slate-500">Người phụ trách:</span>
          <span className="font-medium text-slate-700">{item.ownerName || 'Chưa có dữ liệu'}</span>
        </p>
      </div>

      {/* ================================================================== */}
      {/* ZONE 3: PROGRESS (Thin 1-line progress bar like DDT)               */}
      {/* ================================================================== */}
      <div data-testid="dossier-progress-zone" className="mt-0 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:col-span-4 md:row-start-3">
        <span className="shrink-0 text-[10px] leading-4 text-slate-700">
          <span className="font-semibold text-slate-500">Hạn:</span>{' '}
          <span className="font-bold text-blue-800" title="Hạn hoàn tất">{deadlineDisplay || 'Chưa có dữ liệu'}</span>
        </span>
        <div className="flex min-w-32 flex-1 items-center gap-2">
          <div
            className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Tiến độ hoàn tất hồ sơ"
            aria-valuenow={Math.min(100, Math.max(0, item.completenessPercent))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${Math.min(100, Math.max(0, item.completenessPercent))}% hoàn tất`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item.completenessPercent === 100
                  ? 'bg-emerald-500'
                  : item.completenessPercent >= 60
                  ? 'bg-blue-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, item.completenessPercent))}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] font-bold text-slate-600" title="Mức độ hoàn tất hồ sơ">
            {item.completenessLabel || `${item.completenessPercent}%`}
          </span>
        </div>
        {typeof item.missingRequiredCount === 'number' && Number.isFinite(item.missingRequiredCount) && (
          <span title={item.missingRequiredCount > 0 ? `${item.missingRequiredCount} tài liệu bắt buộc còn thiếu` : 'Đã đủ tài liệu bắt buộc'} className={`inline-flex max-w-full break-words rounded border px-1.5 py-0.5 text-[9px] font-semibold ${
            item.missingRequiredCount > 0
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}>
            {item.missingRequiredCount > 0
              ? `Thiếu ${item.missingRequiredCount} tài liệu`
              : 'Đủ tài liệu'}
          </span>
        )}
      </div>

      {/* ================================================================== */}
      {/* ZONE 4: BUSINESS BADGES (Compact row of actual domain data)        */}
      {/* ================================================================== */}
      {(item.brandOrGroup || (item.businessBadges && item.businessBadges.length > 0)) && (
        <div data-testid="dossier-business-badges" className="mt-0 flex flex-wrap items-center gap-1 md:col-span-4 md:row-start-4">
          {item.brandOrGroup && (
            <span className="rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              {item.brandOrGroup}
            </span>
          )}
          {(item.businessBadges || []).map((badge) => {
            const toneClasses =
              badge.tone === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : badge.tone === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : badge.tone === 'purple'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : badge.tone === 'info'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-50 text-slate-600 border-slate-200';

            return (
              <span
                key={badge.id}
                className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase shadow-2xs ${toneClasses}`}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ZONE 5: Card Expanded Drawer (Next Action, Blockers, Components Breakdown)
// ============================================================================

export interface PgdcnDossierCardExpandedProps {
  item: PgdcnDossierItemModel;
  onOpenDetail: () => void;
  onToggleExpand: (e: React.MouseEvent) => void;
}

export function PgdcnDossierCardExpanded({
  item,
  onOpenDetail,
  onToggleExpand,
}: PgdcnDossierCardExpandedProps) {
  const nextAction = item.nextAction;
  const blockers = item.blockers || [];
  const stages = item.stages || [];

  return (
    <div
      data-testid="pgdcn-dossier-card-expanded"
      className="mt-2.5 border-t border-slate-100 bg-slate-50/70 -mx-3 -mb-3 p-3 space-y-2.5 text-xs transition-all"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sub-header: Creator & Contact Persons (like DDT) */}
      {(!!item.creatorDisplayName || !!item.effectiveContactPerson) && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-slate-100">
          {!!item.creatorDisplayName && (
            <span
              title={`Người tạo: ${item.creatorDisplayName}`}
              className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[8px] font-bold text-sky-800"
            >
              <User size={9} className="text-sky-600" />
              <span>{item.creatorDisplayName}</span>
            </span>
          )}
          {!!item.effectiveContactPerson && (
            <span
              title={`Liên hệ: ${item.effectiveContactPerson}`}
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-800"
            >
              <User size={9} className="text-amber-600" />
              <span>{item.effectiveContactPerson}</span>
            </span>
          )}
          {!!item.updatedAtLabel && (
            <span className="text-[8px] text-slate-400 font-medium ml-auto">
              Cập nhật: {item.updatedAtLabel}
            </span>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION A: NEXT ACTION                                             */}
      {/* ================================================================== */}
      <div data-testid="dossier-next-action" className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-900">
          <span className="flex items-center gap-1">
            <ArrowRight size={12} className="text-blue-600" />
            Việc cần làm tiếp theo
          </span>
          {nextAction?.owner && (
            <span className="text-[9px] font-semibold text-slate-500 lowercase">
              phụ trách: <strong className="text-slate-700">{nextAction.owner}</strong>
            </span>
          )}
        </div>

        {nextAction ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-blue-200/80 bg-blue-50/90 p-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-blue-950 text-[11px] leading-tight">{nextAction.title}</h4>
              <p className="mt-0.5 text-[10px] text-blue-800/90 leading-tight">{nextAction.reason}</p>
            </div>
            {nextAction.onAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextAction.onAction?.();
                }}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded bg-blue-700 px-3 py-2 text-center text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-blue-800 cursor-pointer md:min-h-0 md:py-1"
              >
                {nextAction.actionLabel || 'Tiếp tục xử lý'}
                <ArrowRight size={10} />
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 text-[10px]">
            Hồ sơ đang ở trạng thái chờ hoặc đã hoàn thành.
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION B: BLOCKERS                                                */}
      {/* ================================================================== */}
      <div data-testid="dossier-blockers" className="space-y-1">
        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
          Cảnh báo & Điểm nghẽn
        </span>

        {blockers.length > 0 ? (
          <div className="space-y-1">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-1.5 text-[10px] text-amber-900"
              >
                <div className="flex items-start gap-1 min-w-0 flex-1">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <strong className="block font-bold">{b.title}</strong>
                    <span className="text-amber-800/90 text-[9px]">{b.reason}</span>
                  </div>
                </div>
                {b.onAction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      b.onAction?.();
                    }}
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded px-2 py-1 text-[10px] font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer md:min-h-0 md:min-w-0 md:px-1.5 md:py-0.5"
                  >
                    {b.actionLabel || 'Khắc phục'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-1.5 text-[10px] text-emerald-800">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>Không có điểm nghẽn hoặc cảnh báo chặn quy trình.</span>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION C: COMPONENT BREAKDOWN                                     */}
      {/* ================================================================== */}
      <div data-testid="dossier-components-breakdown" className="space-y-1">
        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
          Thành phần hồ sơ
        </span>

        {stages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {stages.map((st) => {
              const statusColors =
                st.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                  : st.status === 'IN_PROGRESS'
                  ? 'border-blue-200 bg-blue-50 text-blue-800 font-bold'
                  : st.status === 'MISSING'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : st.status === 'LOCKED'
                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-600';

              const icon =
                st.status === 'COMPLETED' ? (
                  <Check size={9} className="text-emerald-600" />
                ) : st.status === 'IN_PROGRESS' ? (
                  <Circle size={8} className="fill-blue-600 text-blue-600" />
                ) : st.status === 'MISSING' ? (
                  <AlertCircle size={9} className="text-amber-600" />
                ) : (
                  <Circle size={8} className="text-slate-300" />
                );

              return (
                <div
                  key={st.id}
                  className={`flex flex-col justify-between rounded border p-1 text-[9px] ${statusColors}`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {icon}
                    <span className="font-semibold truncate" title={st.name}>
                      {st.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[8px] font-bold">{st.statusLabel}</span>
                    {st.onAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          st.onAction?.();
                        }}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[10px] font-bold underline hover:opacity-80 cursor-pointer md:min-h-0 md:min-w-0 md:px-0 md:text-[9px]"
                      >
                        {st.actionLabel || 'Mở'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] text-slate-500">
            Xem tiến trình đầy đủ trong bản đồ quy trình của hồ sơ.
          </div>
        )}
      </div>

      {/* Footer of Expanded Card: Open Full Dossier */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-2 py-1 text-center text-[11px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer md:min-h-0 md:min-w-0 md:px-0 md:py-0"
        >
          <FolderOpen size={12} />
          Mở toàn bộ hồ sơ
          <ArrowRight size={10} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(e);
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer md:min-h-0 md:min-w-0 md:px-0 md:py-0"
        >
          Thu gọn
          <ChevronUp size={11} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Single Dossier Card
// ============================================================================

export interface PgdcnDossierCardProps {
  item: PgdcnDossierItemModel;
  quickActions?: DossierQuickAction[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenDetail: () => void;
  searchQuery?: string;
}

export function PgdcnDossierCard({
  item,
  quickActions = [],
  isExpanded,
  onToggleExpand,
  onOpenDetail,
  searchQuery = '',
}: PgdcnDossierCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if clicked element is an interactive button, link, or no-card-expand
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-card-expand]')) {
      return;
    }
    onToggleExpand();
  };

  return (
    <div
      data-testid="pgdcn-dossier-card"
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between rounded-xl border bg-white p-3 shadow-2xs transition-all duration-200 cursor-pointer md:px-4 md:py-2.5 ${
        isExpanded
          ? 'border-blue-300 ring-2 ring-blue-100 shadow-md'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <PgdcnDossierCardHeader
        item={item}
        quickActions={quickActions}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onOpenDetail={onOpenDetail}
        searchQuery={searchQuery}
      />

      {isExpanded && (
        <PgdcnDossierCardExpanded
          item={item}
          onOpenDetail={onOpenDetail}
          onToggleExpand={onToggleExpand}
        />
      )}
    </div>
  );
}

// ============================================================================
// Dossier Deck (Container + Filter Toolbar + Grid)
// ============================================================================

export type DossierFilterChip = {
  id: string;
  label: string;
  count?: number;
};

export interface PgdcnDossierDeckProps {
  items: PgdcnDossierItemModel[];
  filterChips?: DossierFilterChip[];
  activeFilterId?: string;
  onFilterChange?: (filterId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onOpenDossier: (dossierId: string) => void;
  getQuickActions?: (item: PgdcnDossierItemModel) => DossierQuickAction[];
  renderToolbarExtra?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function PgdcnDossierDeck({
  items,
  filterChips = [],
  activeFilterId = 'ALL',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Tìm mã hồ sơ, PYC, số lô, khách hàng, sản phẩm...',
  onOpenDossier,
  getQuickActions,
  renderToolbarExtra,
  emptyTitle = 'Không tìm thấy hồ sơ nào',
  emptyDescription = 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc các tiêu chí bộ lọc.',
}: PgdcnDossierDeckProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Auto-expand on search match (matching DDT interaction)
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();

    const matchingIds = items
      .filter((item) => {
        const tokens = [
          item.primaryCode,
          item.secondaryCode,
          item.customerName,
          item.productName,
          item.brandOrGroup,
          item.ownerName,
          ...(item.deepSearchTokens || []),
        ]
          .filter(Boolean)
          .map((t) => String(t).toLowerCase());

        return tokens.some((t) => t.includes(q));
      })
      .map((i) => i.id);

    if (matchingIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        matchingIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [searchQuery, items]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoExpandOnSearch = true; // contract property

  return (
    <div className="space-y-3">
      {/* Single-row Toolbar (TVCI Lab Standard) */}
      <div className="pgdcn-toolbar-nowrap flex items-center gap-2 overflow-x-auto py-1">
        {/* Search Input */}
        <div className="pgdcn-toolbar-search relative min-w-[200px] max-w-sm flex-1 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-11 w-full rounded-xl border border-slate-200/80 bg-white py-2 pl-9 pr-3 text-xs font-bold outline-none shadow-2xs transition-all focus:ring-2 focus:ring-emerald-500 md:min-h-0 md:py-1.5 md:text-[11px]"
          />
        </div>

        {/* Filter Chips Pills */}
        {filterChips.length > 0 && (
          <div data-testid="dossier-filter-chips" className="pgdcn-toolbar-pills flex items-center gap-1.5 shrink-0">
            {filterChips.map((chip) => {
              const active = activeFilterId === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onFilterChange?.(chip.id)}
                  className={`mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-bold transition-all cursor-pointer md:min-h-8 ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <span>{chip.label}</span>
                  {chip.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Actions / Extra */}
        {(mobileFilterOpen || renderToolbarExtra) && (
          <div className="pgdcn-toolbar-group flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="dossier-mobile-filter-toggle"
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs cursor-pointer md:hidden"
            >
              <SlidersHorizontal size={13} />
              <span>Bộ lọc</span>
              {activeFilterId !== 'ALL' && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </button>
            {renderToolbarExtra}
          </div>
        )}
      </div>

      {/* Dense, single-column dossier list at desktop and mobile widths */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {items.map((item) => (
            <PgdcnDossierCard
              key={item.id}
              item={item}
              quickActions={getQuickActions ? getQuickActions(item) : []}
              isExpanded={expandedIds.has(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onOpenDetail={() => onOpenDossier(item.id)}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <Folder size={32} className="mx-auto text-slate-300" />
          <h3 className="mt-2 text-sm font-bold text-slate-800">{emptyTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      )}
    </div>
  );
}

export default PgdcnDossierDeck;
