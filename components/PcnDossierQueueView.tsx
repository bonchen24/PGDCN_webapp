'use client';

import {
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  FileWarning,
  Search,
  UserRound,
  LayoutGrid,
  List,
  Building2,
  Package,
  Clock,
  Layers,
  CheckCircle2,
  FolderOpen,
  Edit3,
  Copy,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';

import type { PcnOperationsRegisterRow } from '../utils/pcnOperationsRegister';
import { getPgdcnDashboardStatusLabel } from '../utils/pgdcnDashboard';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';
import {
  PgdcnDossierCard,
  PgdcnDossierCardExpanded,
  PgdcnDossierQuickActions,
  PgdcnDossierQuickPeek,
  type PgdcnDossierItemModel,
  type DossierComponentStage,
  type DossierBlockerItem,
  type DossierQuickAction,
  type DossierBusinessBadge,
} from './PgdcnDossierDeck';

export interface PcnDossierQueueViewProps {
  rows: PcnOperationsRegisterRow[];
  onOpenDossier: (dossierId: string) => void;
  filterControls?: ReactNode;
}

function statusLabel(value: string): string {
  return getPgdcnDashboardStatusLabel('PCN', value);
}

function isActionable(row: PcnOperationsRegisterRow): boolean {
  return row.missingRequiredCount > 0 || !row.ownerUsername || !['ARCHIVED', 'CANCELLED'].includes(row.dossierStatus);
}

export const PCN_FILTER_CHIPS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ACTION_NEEDED', label: 'Cần xử lý' },
  { id: 'MISSING_DOCS', label: 'Thiếu hồ sơ' },
  { id: 'UNASSIGNED', label: 'Chưa phân công' },
  { id: 'QC4', label: 'Quy chuẩn 4' },
  { id: 'QC9', label: 'Quy chuẩn 9' },
  { id: 'DONE', label: 'Hoàn thành' },
] as const;

type PcnFilterChipId = typeof PCN_FILTER_CHIPS[number]['id'];

export default function PcnDossierQueueView({ rows, onOpenDossier, filterControls }: PcnDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [activeChip, setActiveChip] = useState<PcnFilterChipId>('ALL');
  const [peekItem, setPeekItem] = useState<PgdcnDossierItemModel | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const actionCount = rows.filter(isActionable).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((row) => !row.ownerUsername).length;
  const hasActiveFilters = activeChip !== 'ALL' || Boolean(query.trim());

  const resetFilters = () => {
    setQuery('');
    setActiveChip('ALL');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    let result = rows;
    if (activeChip === 'ACTION_NEEDED') {
      result = result.filter(isActionable);
    } else if (activeChip === 'MISSING_DOCS') {
      result = result.filter((r) => r.missingRequiredCount > 0);
    } else if (activeChip === 'UNASSIGNED') {
      result = result.filter((r) => !r.ownerUsername);
    } else if (activeChip === 'QC4') {
      result = result.filter((r) => r.fieldCodes.includes('QC4'));
    } else if (activeChip === 'QC9') {
      result = result.filter((r) => r.fieldCodes.includes('QC9'));
    } else if (activeChip === 'DONE') {
      result = result.filter((r) => ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(r.dossierStatus));
    }

    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return result;
    return result.filter((row) =>
      [
        row.registrationCode,
        row.dossierCode,
        row.customerName,
        row.productName,
        row.stationTitle,
        typeof row.sampleQuantity === 'number' ? String(row.sampleQuantity) : undefined,
        row.ownerUsername,
        row.brand,
        row.model,
        ...row.fieldCodes,
        ...row.labStatuses,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(needle)
    );
  }, [query, rows, activeChip]);

  // Convert PCN Row to Unified Item Model
  const itemModels = useMemo<PgdcnDossierItemModel[]>(() => {
    return filteredRows.map((row) => {
      const blockers: DossierBlockerItem[] = [];
      if (row.missingRequiredCount > 0) {
        blockers.push({
          id: `pcn-missing-${row.dossierId}`,
          title: 'Thiếu tài liệu bắt buộc',
          reason: `Còn thiếu ${row.missingRequiredCount} mục tài liệu theo quy định.`,
          severity: 'HARD',
          actionLabel: 'Mở tài liệu',
          onAction: () => onOpenDossier(row.dossierId),
        });
      }
      if (!row.ownerUsername) {
        blockers.push({
          id: `pcn-unassigned-${row.dossierId}`,
          title: 'Chưa phân công chủ hồ sơ',
          reason: 'Hồ sơ chưa có cán bộ phụ trách xử lý.',
          severity: 'WARNING',
          actionLabel: 'Mở phân công',
          onAction: () => onOpenDossier(row.dossierId),
        });
      }
      if (row.labStatuses.some((st) => /chờ|đang|gửi/i.test(st))) {
        blockers.push({
          id: `pcn-lab-${row.dossierId}`,
          title: 'Đang theo dõi thử nghiệm PTN',
          reason: `Tiến độ phòng thử: ${row.labStatuses.join('; ')}`,
          severity: 'WARNING',
          actionLabel: 'Xem PTN',
          onAction: () => onOpenDossier(row.dossierId),
        });
      }

      // Zone 4: Compact Business Badges
      const businessBadges: DossierBusinessBadge[] = [
        {
          id: 'samples',
          label: `Mẫu ${row.sampleQuantity || 1}`,
          tone: 'default',
        },
        {
          id: 'lab',
          label: row.labStatuses.length > 0 ? `PTN: ${row.labStatuses.length} phòng` : 'PTN: Sẵn sàng',
          tone: 'info',
        },
        {
          id: 'kqtn',
          label: row.lastResultReceivedAt ? 'KQTN ✓' : 'Chờ KQTN',
          tone: row.lastResultReceivedAt ? 'success' : 'warning',
        },
        {
          id: 'approval',
          label: ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus) ? 'Đã duyệt' : 'Chờ duyệt',
          tone: ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus) ? 'success' : 'default',
        },
      ];

      // 8 PCN workflow stages breakdown
      const stages: DossierComponentStage[] = [
        {
          id: 'intake',
          name: 'Đề nghị',
          status: 'COMPLETED',
          statusLabel: 'Đã nhận',
        },
        {
          id: 'documents',
          name: 'Tài liệu',
          status: row.missingRequiredCount > 0 ? 'MISSING' : 'COMPLETED',
          statusLabel: `${row.requiredDocumentPresent}/${row.requiredDocumentTotal}`,
          actionLabel: 'Mở',
          onAction: () => onOpenDossier(row.dossierId),
        },
        {
          id: 'evaluation',
          name: 'Hiện trường',
          status: ['EVALUATION', 'TESTING', 'REVIEW', 'APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus)
            ? 'COMPLETED'
            : row.dossierStatus === 'INTAKE_REVIEW' || row.dossierStatus === 'AWAITING_DOCUMENTS'
            ? 'WAITING'
            : 'IN_PROGRESS',
          statusLabel: row.evaluationAt ? 'Đã đánh giá' : 'Chờ ĐG',
        },
        {
          id: 'samples',
          name: 'Mẫu thử',
          status: (row.sampleQuantity ?? 0) > 0 ? 'COMPLETED' : 'WAITING',
          statusLabel: `${row.sampleQuantity || 1} mẫu`,
        },
        {
          id: 'lab',
          name: 'Gửi PTN',
          status: row.labStatuses.length > 0 ? 'IN_PROGRESS' : 'WAITING',
          statusLabel: row.labStatuses.length > 0 ? 'Đã gửi' : 'Chưa gửi',
        },
        {
          id: 'results',
          name: 'KQTN',
          status: row.lastResultReceivedAt ? 'COMPLETED' : 'WAITING',
          statusLabel: row.lastResultOutcome ? 'Đã có KQ' : 'Chờ KQ',
        },
        {
          id: 'review',
          name: 'Phê duyệt',
          status: ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus) ? 'COMPLETED' : 'LOCKED',
          statusLabel: ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus) ? 'Đã duyệt' : 'Chưa duyệt',
        },
        {
          id: 'issuance',
          name: 'Phát hành',
          status: ['ISSUED', 'DELIVERED', 'ARCHIVED'].includes(row.dossierStatus) ? 'COMPLETED' : 'LOCKED',
          statusLabel: row.issuanceNumber ? 'Đã cấp CN' : 'Chưa cấp',
        },
      ];

      return {
        id: row.dossierId,
        domain: 'PCN',
        primaryCode: row.dossierCode,
        secondaryCode: `ĐN: ${row.registrationCode}`,
        status: row.dossierStatus,
        statusLabel: statusLabel(row.dossierStatus),
        customerName: row.customerName || 'Chưa có khách hàng',
        productName: row.productName || 'Chưa có sản phẩm',
        brandOrGroup: [row.brand, row.model].filter(Boolean).join(' · '),
        fieldOrCatalogBadge: row.fieldCodes.join(', '),
        ownerName: row.ownerUsername || 'Chưa phân công',
        currentStepLabel: [row.stationTitle, row.stationActionLabel].filter(Boolean).join(' · '),
        completenessPercent: row.completenessScore,
        completenessLabel: `${row.completenessScore}%`,
        missingRequiredCount: row.missingRequiredCount,
        businessBadges,
        deepSearchTokens: [
          row.registrationCode,
          row.dossierCode,
          row.customerName,
          row.productName,
          row.stationTitle,
          typeof row.sampleQuantity === 'number' ? String(row.sampleQuantity) : undefined,
          row.ownerUsername,
          row.brand,
          row.model,
          ...row.fieldCodes,
          ...row.labStatuses,
        ].filter(Boolean),
        nextAction: {
          title: row.stationActionLabel || 'Tiếp tục xử lý hồ sơ',
          reason:
            row.missingRequiredCount > 0
              ? `Còn ${row.missingRequiredCount} tài liệu bắt buộc cần bổ sung.`
              : `Hồ sơ sẵn sàng thực hiện bước ${row.stationTitle}.`,
          owner: row.ownerUsername || 'Chưa phân công',
          actionLabel: row.stationActionLabel || 'Tiếp tục xử lý',
          onAction: () => onOpenDossier(row.dossierId),
        },
        blockers,
        stages,
      };
    });
  }, [filteredRows, onOpenDossier]);

  // Auto-expand card on search match
  useEffect(() => {
    if (!query || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const matchingIds = itemModels
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
  }, [query, itemModels]);

  return (
    <section data-testid="pcn-dossier-queue" className="min-w-0 space-y-3 p-3 md:p-4" aria-label="Hàng đợi hồ sơ PCN">
      {/* Header: Title and View Switcher (Zero KPI Viewport Wastage) */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">PCN · Hàng đợi công việc</p>
          <h2 className="mt-0.5 text-sm md:text-base font-black text-slate-950">Mở đúng hồ sơ, xử lý đúng việc</h2>
        </div>

        {/* View Switcher (DDT pattern) */}
        <div role="group" aria-label="Chế độ hiển thị hồ sơ" className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            aria-label="Xem dạng thẻ"
            aria-pressed={viewMode === 'card'}
            className={`mobile-touch-target flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
              viewMode === 'card'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem dạng thẻ chuẩn DDT"
          >
            <LayoutGrid size={13} />
            <span className="sm:hidden">Thẻ</span>
            <span className="hidden sm:inline">Dạng thẻ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-label="Xem dạng bảng"
            aria-pressed={viewMode === 'table'}
            className={`mobile-touch-target flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem bảng truyền thống"
          >
            <List size={13} />
            <span className="sm:hidden">Bảng</span>
            <span className="hidden sm:inline">Dạng bảng</span>
          </button>
        </div>
      </div>

      {/* Search and filters wrap on small screens to avoid clipping the page. */}
      <div className="flex min-w-0 max-w-full flex-col items-stretch gap-3 py-1 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search Input */}
        <div role="search" aria-label="Tìm kiếm hồ sơ PCN" className="w-full min-w-0 sm:max-w-sm sm:flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm kiếm trong hàng đợi hồ sơ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã đề nghị, mã hồ sơ, khách hàng, sản phẩm, số lượng mẫu, phòng thử..."
              className="mobile-touch-target min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-bold shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div role="group" aria-label="Lọc hồ sơ theo trạng thái" className="pgdcn-toolbar-pills flex w-full min-w-0 flex-nowrap overflow-x-auto mobile-scroll-x items-center gap-1.5 py-0.5 sm:flex-wrap sm:w-auto sm:flex-1">
          {PCN_FILTER_CHIPS.map((chip) => {
            const active = activeChip === chip.id;
            const count =
              chip.id === 'ALL'
                ? rows.length
                : chip.id === 'ACTION_NEEDED'
                ? actionCount
                : chip.id === 'MISSING_DOCS'
                ? incompleteCount
                : chip.id === 'UNASSIGNED'
                ? unassignedCount
                : chip.id === 'QC4'
                ? rows.filter((r) => r.fieldCodes.includes('QC4')).length
                : chip.id === 'QC9'
                ? rows.filter((r) => r.fieldCodes.includes('QC9')).length
                : rows.filter((r) => ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(r.dossierStatus)).length;

            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveChip(chip.id)}
                aria-pressed={active}
                className={`mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1 text-[11px] font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs ring-2 ring-slate-700 ring-offset-1'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Controls */}
        {filterControls && (
          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-expanded={showFilters}
              aria-controls="pcn-advanced-filters"
              className="sm:hidden mobile-touch-target flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Bộ lọc chi tiết</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {showFilters ? "Thu gọn ▲" : "Mở rộng ▼"}
              </span>
            </button>
            <div
              id="pcn-advanced-filters"
              className={`${showFilters ? "flex" : "hidden"} sm:flex pgdcn-toolbar-group mt-2 sm:mt-0 w-full min-w-0 flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-1.5 sm:w-auto`}
            >
              {filterControls}
            </div>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="text-xs font-medium text-slate-600">
        {rows.length === 0
          ? 'Chưa có hồ sơ PCN trong hàng đợi.'
          : filteredRows.length === 0
          ? `Không có hồ sơ phù hợp trong ${rows.length} hồ sơ PCN.`
          : `Đang hiển thị ${filteredRows.length} trong ${rows.length} hồ sơ PCN.`}
      </p>

      {/* Grid: Desktop 2 Columns, Mobile 1 Column */}
      {filteredRows.length > 0 ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itemModels.map((item) => {
              const quickActions: DossierQuickAction[] = [
                {
                  id: 'open-detail',
                  label: 'Mở chi tiết',
                  icon: FolderOpen,
                  tone: 'primary',
                  onClick: () => onOpenDossier(item.id),
                },
              ];

              return (
                <PgdcnDossierCard
                  key={item.id}
                  item={item}
                  quickActions={quickActions}
                  isExpanded={expandedIds.has(item.id)}
                  onToggleExpand={() => toggleExpand(item.id)}
                  onOpenDetail={() => onOpenDossier(item.id)}
                  onOpenPeek={(item) => setPeekItem(item)}
                  searchQuery={query}
                />
              );
            })}
          </div>
        ) : (
          /* Table View (Secondary Traditional Table) */
          <div
            data-testid="pcn-dossier-table-scroll"
            role="region"
            aria-label="Bảng hồ sơ PCN, cuộn ngang để xem các cột khác"
            tabIndex={0}
            className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x rounded-xl border border-slate-200 bg-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-600 sm:hidden">Vuốt ngang để xem đầy đủ bảng hồ sơ.</p>
            <table aria-label="Bảng hàng đợi hồ sơ PCN" className="w-full min-w-[980px] border-collapse text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ PCN đang chờ xử lý</caption>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Hồ sơ / Đề nghị</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Sản phẩm</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Bước hiện tại</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.dossierId} className="align-top transition-colors hover:bg-blue-50/40">
                    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal">
                      <div className="min-w-[150px]">
                        <button
                          type="button"
                          onClick={() => onOpenDossier(row.dossierId)}
                          aria-label={`Mở chi tiết hồ sơ ${row.dossierCode}`}
                          className="font-mono text-xs font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 cursor-pointer"
                        >
                          {row.dossierCode}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">Đề nghị {row.registrationCode}</p>
                        <PgdcnStatusBadge compact domain="PCN" status={row.dossierStatus} label={statusLabel(row.dossierStatus)} />
                      </div>
                    </th>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm font-medium text-slate-900">
                      <span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span>
                    </td>
                    <td className="max-w-[190px] px-3 py-3 align-top text-sm text-slate-700">
                      <span className="line-clamp-2">{row.productName || 'Chưa có sản phẩm'}</span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-blue-900">{row.stationTitle}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.stationActionLabel}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <span className="font-semibold text-slate-900">{row.completenessScore}%</span>
                      <p className="mt-1 text-xs text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</p>
                    </td>
                    <td className="max-w-[230px] px-3 py-3 align-top">
                      <span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                        {row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu bắt buộc'}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-sm text-slate-700">{row.ownerUsername || 'Chưa phân công'}</td>
                    <td className="px-3 py-3 align-top text-right">
                      <button
                        type="button"
                        className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[10px] font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                        onClick={() => onOpenDossier(row.dossierId)}
                      >
                        <span>Mở hồ sơ</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <Layers size={28} className="mx-auto text-slate-300" />
          <h3 className="mt-2 text-sm font-bold text-slate-800">{hasActiveFilters ? 'Không tìm thấy hồ sơ PCN phù hợp' : 'Chưa có hồ sơ PCN trong hàng đợi'}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {hasActiveFilters
              ? 'Thử một mã hồ sơ hoặc tên khách hàng khác, hoặc xóa tìm kiếm và bộ lọc để xem lại toàn bộ hồ sơ.'
              : 'Khi có hồ sơ trong hàng đợi, danh sách sẽ hiển thị tại đây.'}
          </p>
          <button
            type="button"
            data-testid="pcn-filter-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="mobile-touch-target mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xóa tìm kiếm và bộ lọc
          </button>
        </div>
      )}
      <PgdcnDossierQuickPeek
        item={peekItem}
        onClose={() => setPeekItem(null)}
        onOpenDossier={onOpenDossier}
      />
    </section>
  );
}
