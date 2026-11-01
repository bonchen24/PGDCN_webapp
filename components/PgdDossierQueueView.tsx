'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  FileWarning,
  Search,
  UserRound,
  LayoutGrid,
  List,
  Building2,
  Package,
  Layers,
  FolderOpen,
  ChevronDown,
  Edit3,
  Copy,
  Printer,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, useEffect, type MouseEvent } from 'react';
import { toast } from 'sonner';

import { PgdcnStatusBadge } from './PgdcnUiPrimitives';
import {
  PgdcnDossierCardExpanded,
  PgdcnDossierQuickActions,
  HighlightText,
  type PgdcnDossierItemModel,
  type DossierComponentStage,
  type DossierBlockerItem,
  type DossierBusinessBadge,
} from './PgdcnDossierDeck';

export interface PgdDossierQueueRow {
  requestId: string;
  requestCode: string;
  customerName: string;
  productName: string;
  status: string;
  statusLabel: string;
  currentStepNumber: number;
  currentStepLabel: string;
  nextActionLabel?: string;
  requiredDocumentPresent: number;
  requiredDocumentTotal: number;
  missingRequiredCount: number;
  ownerUsername?: string;
  ownerDisplayName?: string;
  productGroup: string;
  catalogLabel: string;
}

export interface PgdDossierQueueViewProps {
  rows: PgdDossierQueueRow[];
  onOpenDossier: (requestId: string) => void;
}

export const PGD_FILTER_CHIPS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ACTION_NEEDED', label: 'Cần xử lý' },
  { id: 'STEEL', label: 'Thép/Kim loại' },
  { id: 'MACHINE', label: 'Máy móc' },
  { id: 'COAL', label: 'Than' },
  { id: 'INTAKE', label: 'Tiếp nhận' },
  { id: 'IN_PROGRESS', label: 'Đang xử lý' },
  { id: 'MISSING_DOCS', label: 'Thiếu hồ sơ' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
] as const;

type PgdFilterChipId = typeof PGD_FILTER_CHIPS[number]['id'];

const PGD_PRODUCT_FILTER_IDS = new Set<PgdFilterChipId>(['STEEL', 'MACHINE', 'COAL']);

const PGD_COMPLETED_STATUS_CODES = new Set(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED']);

export function filterPgdDossierQueueRows(
  rows: PgdDossierQueueRow[],
  filterId: PgdFilterChipId,
): PgdDossierQueueRow[] {
  if (filterId === 'ALL') return rows;
  if (filterId === 'ACTION_NEEDED') {
    return rows.filter((row) => row.missingRequiredCount > 0 || !PGD_COMPLETED_STATUS_CODES.has(row.status));
  }
  if (filterId === 'STEEL') {
    return rows.filter((row) => row.productGroup.includes('Thép') || row.catalogLabel.includes('Thép'));
  }
  if (filterId === 'MACHINE') {
    return rows.filter((row) => row.productGroup.includes('Máy') || row.catalogLabel.includes('Máy'));
  }
  if (filterId === 'COAL') {
    return rows.filter((row) => row.productGroup.includes('Than') || row.catalogLabel.includes('Than'));
  }
  if (filterId === 'INTAKE') return rows.filter((row) => row.currentStepNumber <= 2);
  if (filterId === 'IN_PROGRESS') {
    return rows.filter((row) => row.currentStepNumber > 2 && row.currentStepNumber < 5);
  }
  if (filterId === 'MISSING_DOCS') return rows.filter((row) => row.missingRequiredCount > 0);
  if (filterId === 'COMPLETED') {
    return rows.filter((row) => PGD_COMPLETED_STATUS_CODES.has(row.status));
  }
  return rows;
}

interface PgdDossierSummaryCardProps {
  item: PgdcnDossierItemModel;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenDetail: () => void;
  searchQuery: string;
}

// PGD uses a focused summary here instead of the shared PgdcnDossierCard; PCN keeps its existing shared card.
function PgdDossierSummaryCard({ item, isExpanded, onToggleExpand, onOpenDetail, searchQuery }: PgdDossierSummaryCardProps) {
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-card-expand]')) return;
    onToggleExpand();
  };

  const handleCopyCode = (event: MouseEvent) => {
    event.stopPropagation();
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;

    void navigator.clipboard.writeText(item.primaryCode).then(
      () => toast.success(`Đã sao chép mã ${item.primaryCode}`),
      () => toast.error('Không thể sao chép mã hồ sơ.'),
    );
  };

  return (
    <article
      data-testid="pgdcn-dossier-card"
      onClick={handleCardClick}
      className={`min-w-0 cursor-pointer rounded-xl border bg-white p-3 shadow-2xs transition-colors md:px-4 md:py-3 ${
        isExpanded ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
      }`}
    >
      <div data-testid="dossier-header-zone" className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 w-full md:w-auto">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 break-words font-mono text-xs font-black tracking-wide text-slate-900">
              <HighlightText text={item.primaryCode} search={searchQuery} />
            </h3>
            <PgdcnStatusBadge compact domain="PGD" status={item.status} label={item.statusLabel} />
          </div>
        </div>
        <PgdcnDossierQuickActions
          actions={[]}
          isExpanded={isExpanded}
          onToggleExpand={() => onToggleExpand()}
          onCopyCode={handleCopyCode}
        />
      </div>

      <div data-testid="dossier-metadata-zone" className="mt-2 grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        <p className="min-w-0 break-words text-[11px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Khách hàng:</span>
          <span className="font-bold text-slate-900"><HighlightText text={item.customerName || 'Chưa có khách hàng'} search={searchQuery} /></span>
        </p>
        <p className="min-w-0 break-words text-[11px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Đối tượng:</span>
          <span className="font-medium text-slate-800"><HighlightText text={item.productName || 'Chưa có đối tượng'} search={searchQuery} /></span>
        </p>
        <p className="min-w-0 break-words text-[11px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Bước hiện tại:</span>
          <span className="font-semibold text-blue-900">{item.currentStepLabel || 'Chưa có dữ liệu'}</span>
        </p>
        <p className="min-w-0 break-words text-[11px] leading-4 text-slate-700">
          <span className="mr-1 font-semibold text-slate-500">Việc tiếp theo:</span>
          <span className="font-medium text-slate-800">{item.nextAction?.title || 'Chờ xử lý tiếp'}</span>
        </p>
        <p className="min-w-0 break-words text-[11px] leading-4 text-slate-700 sm:col-span-2">
          <span className="mr-1 font-semibold text-slate-500">Chủ hồ sơ:</span>
          <span className="font-medium text-slate-800">{item.ownerName || 'Chưa phân công'}</span>
        </p>
      </div>

      <div data-testid="dossier-progress-zone" className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
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
          <span className="shrink-0 text-[11px] font-bold text-slate-600" title="Mức độ hoàn tất hồ sơ">
            {item.completenessLabel || `${item.completenessPercent}%`}
          </span>
        </div>
        {typeof item.missingRequiredCount === 'number' && (
          <span
            title={item.missingRequiredCount > 0 ? `${item.missingRequiredCount} tài liệu bắt buộc còn thiếu` : 'Đã đủ tài liệu bắt buộc'}
            className={`inline-flex max-w-full break-words rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
              item.missingRequiredCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {item.missingRequiredCount > 0
              ? `Thiếu ${item.missingRequiredCount} mục`
              : 'Đủ tài liệu'}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {item.fieldOrCatalogBadge ? (
          <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            {item.fieldOrCatalogBadge}
          </span>
        ) : <span />}
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={`Mở hồ sơ ${item.primaryCode}`}
          className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:min-h-9 md:py-1.5 cursor-pointer"
        >
          <FolderOpen size={13} aria-hidden="true" />
          <span>Mở hồ sơ</span>
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <div data-testid="pgd-dossier-expanded-details" className="mt-3 space-y-3 border-t border-slate-100 pt-3" onClick={(event) => event.stopPropagation()}>
          <section aria-label="Thông tin phân loại" className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-600">Thông tin phân loại</h4>
            <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              <div className="min-w-0"><dt className="font-semibold text-slate-500">Nhóm sản phẩm</dt><dd className="break-words font-medium text-slate-800">{item.brandOrGroup || 'Chưa xác định nhóm'}</dd></div>
              <div className="min-w-0"><dt className="font-semibold text-slate-500">Phân loại</dt><dd className="break-words font-medium text-slate-800">{item.fieldOrCatalogBadge || 'Chưa phân loại'}</dd></div>
            </dl>
          </section>
          <PgdcnDossierCardExpanded item={item} onOpenDetail={onOpenDetail} onToggleExpand={() => onToggleExpand()} />
        </div>
      )}
    </article>
  );
}

export default function PgdDossierQueueView({ rows, onOpenDossier }: PgdDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [activeChip, setActiveChip] = useState<PgdFilterChipId>('ALL');
  const [productFiltersOpen, setProductFiltersOpen] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const unassignedCount = rows.filter((r) => !r.ownerUsername && !r.ownerDisplayName).length;

  const toggleCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchFilteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.requestCode,
        row.customerName,
        row.productName,
        row.productGroup,
        row.catalogLabel,
        row.ownerDisplayName,
        row.ownerUsername,
        row.statusLabel,
        row.currentStepLabel,
        row.nextActionLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(needle)
    );
  }, [query, rows]);

  const filteredRows = useMemo(
    () => filterPgdDossierQueueRows(searchFilteredRows, activeChip),
    [searchFilteredRows, activeChip],
  );
  const chipCounts = useMemo(() => {
    const counts = {} as Record<PgdFilterChipId, number>;
    for (const chip of PGD_FILTER_CHIPS) {
      counts[chip.id] = filterPgdDossierQueueRows(searchFilteredRows, chip.id).length;
    }
    return counts;
  }, [searchFilteredRows]);
  const hasActiveSearchOrFilter = Boolean(query.trim()) || activeChip !== 'ALL';
  const activeChipLabel = PGD_FILTER_CHIPS.find((chip) => chip.id === activeChip)?.label || '';
  const activeProductFilterCount = PGD_PRODUCT_FILTER_IDS.has(activeChip) ? 1 : 0;
  const productGroupChips = PGD_FILTER_CHIPS.filter((chip) => PGD_PRODUCT_FILTER_IDS.has(chip.id));
  const dossierStateChips = PGD_FILTER_CHIPS.filter((chip) => !PGD_PRODUCT_FILTER_IDS.has(chip.id));

  const renderFilterChip = (chip: typeof PGD_FILTER_CHIPS[number]) => {
    const active = activeChip === chip.id;
    const count = chipCounts[chip.id];

    return (
      <button
        key={chip.id}
        type="button"
        onClick={() => setActiveChip(chip.id)}
        aria-label={`${chip.label}, ${count} hồ sơ`}
        aria-pressed={active}
        className={`mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:min-h-8 ${
          active
            ? 'bg-blue-600 text-white shadow-xs'
            : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
        }`}
      >
        <span>{chip.label}</span>
        <span
          aria-hidden="true"
          className={`rounded-full px-1 py-0.2 text-[10px] font-black ${
            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  // Convert PGD row to unified item model
  const itemModels = useMemo<PgdcnDossierItemModel[]>(() => {
    return filteredRows.map((row) => {
      const isCompleted = PGD_COMPLETED_STATUS_CODES.has(row.status);
      const isArchived = row.status === 'ARCHIVED';
      const blockers: DossierBlockerItem[] = [];
      if (row.missingRequiredCount > 0) {
        blockers.push({
          id: `pgd-missing-${row.requestId}`,
          title: 'Đầu mục hồ sơ bắt buộc còn thiếu',
          reason: `Còn thiếu ${row.missingRequiredCount} đầu mục tài liệu bắt buộc theo quy trình giám định.`,
          severity: 'HARD',
          actionLabel: 'Bổ sung hồ sơ',
          onAction: () => onOpenDossier(row.requestId),
        });
      }
      if (!row.ownerUsername && !row.ownerDisplayName) {
        blockers.push({
          id: `pgd-unassigned-${row.requestId}`,
          title: 'Chưa phân công giám định viên',
          reason: 'Yêu cầu chưa có cán bộ kỹ thuật phụ trách kiểm tra hiện trường.',
          severity: 'WARNING',
          actionLabel: 'Phân công',
          onAction: () => onOpenDossier(row.requestId),
        });
      }

      const score = row.requiredDocumentTotal > 0 ? Math.round((row.requiredDocumentPresent / row.requiredDocumentTotal) * 100) : 100;

      // Zone 4: Compact Business Badges
      const businessBadges: DossierBusinessBadge[] = [
        {
          id: 'field',
          label: row.currentStepNumber >= 4 ? 'Hiện trường ✓' : 'Hiện trường',
          tone: row.currentStepNumber >= 4 ? 'success' : 'default',
        },
        {
          id: 'evidence',
          label: `Bằng chứng ${row.requiredDocumentPresent}/${row.requiredDocumentTotal}`,
          tone: 'info',
        },
        {
          id: 'kqtn',
          label: row.currentStepNumber >= 5 ? 'KQTN ✓' : 'Chờ KQTN',
          tone: row.currentStepNumber >= 5 ? 'success' : 'warning',
        },
        {
          id: 'cert',
          label: isCompleted ? 'Chứng thư ✓' : 'Chưa phát hành',
          tone: isCompleted ? 'success' : 'default',
        },
      ];

      // 8 PGD workflow stages breakdown
      const stages: DossierComponentStage[] = [
        {
          id: 'intake',
          name: 'Tiếp nhận PYC',
          status: 'COMPLETED',
          statusLabel: 'Đã nhận',
        },
        {
          id: 'documents',
          name: 'Tài liệu & hồ sơ',
          status: row.missingRequiredCount > 0 ? 'MISSING' : 'COMPLETED',
          statusLabel: `${row.requiredDocumentPresent}/${row.requiredDocumentTotal}`,
          actionLabel: 'Mở',
          onAction: () => onOpenDossier(row.requestId),
        },
        {
          id: 'plan',
          name: 'Kế hoạch',
          status: row.currentStepNumber >= 2 ? 'COMPLETED' : 'IN_PROGRESS',
          statusLabel: row.currentStepNumber >= 2 ? 'Đã lập KH' : 'Chờ KH',
        },
        {
          id: 'field',
          name: 'Hiện trường',
          status: row.currentStepNumber >= 3 ? 'COMPLETED' : row.currentStepNumber === 2 ? 'IN_PROGRESS' : 'WAITING',
          statusLabel: row.currentStepNumber >= 3 ? 'Đã kiểm' : 'Chờ kiểm',
        },
        {
          id: 'lab',
          name: 'Bàn giao PTN',
          status: row.currentStepNumber >= 4 ? 'COMPLETED' : 'WAITING',
          statusLabel: row.currentStepNumber >= 4 ? 'Đã giao' : 'Chưa giao',
        },
        {
          id: 'results',
          name: 'KQTN & Đánh giá',
          status: row.currentStepNumber > 4 ? 'COMPLETED' : 'WAITING',
          statusLabel: row.currentStepNumber > 4 ? 'Đã có KQ' : 'Chờ KQ',
        },
        {
          id: 'report',
          name: 'Báo cáo & Chứng thư',
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          statusLabel: isCompleted ? 'Đã ký' : 'Đang soạn',
        },
        {
          id: 'archive',
          name: 'Lưu trữ hồ sơ',
          status: isArchived ? 'COMPLETED' : 'LOCKED',
          statusLabel: isArchived ? 'Đã lưu' : 'Chưa lưu',
        },
      ];

      return {
        id: row.requestId,
        domain: 'PGD',
        primaryCode: row.requestCode,
        status: row.status,
        statusLabel: row.statusLabel,
        customerName: row.customerName || 'Chưa có khách hàng',
        productName: row.productName || 'Chưa có đối tượng',
        brandOrGroup: row.productGroup,
        fieldOrCatalogBadge: row.catalogLabel,
        sampleCountLabel: row.productGroup || 'Hồ sơ GĐ',
        ownerName: row.ownerDisplayName || row.ownerUsername,
        currentStepNumber: row.currentStepNumber,
        currentStepLabel: row.currentStepLabel,
        completenessPercent: score,
        completenessLabel: `${row.requiredDocumentPresent}/${row.requiredDocumentTotal} (${score}%)`,
        missingRequiredCount: row.missingRequiredCount,
        businessBadges,
        deepSearchTokens: [
          row.requestCode,
          row.customerName,
          row.productName,
          row.productGroup,
          row.catalogLabel,
          row.ownerDisplayName,
          row.ownerUsername,
          row.statusLabel,
          row.currentStepLabel,
          row.nextActionLabel,
        ].filter(Boolean),
        nextAction: {
          title: row.nextActionLabel || 'Tiếp tục hồ sơ giám định',
          reason:
            row.missingRequiredCount > 0
              ? `Còn thiếu ${row.missingRequiredCount} mục tài liệu bắt buộc cần bổ sung.`
              : `Hồ sơ hiện ở bước ${row.currentStepNumber} · ${row.currentStepLabel}.`,
          owner: row.ownerDisplayName || row.ownerUsername || 'Chưa phân công',
          actionLabel: row.nextActionLabel || 'Tiếp tục xử lý',
          onAction: () => onOpenDossier(row.requestId),
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
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        matchingIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [query, itemModels]);

  return (
    <section className="min-w-0 space-y-3 p-3 md:p-4" aria-label="Hàng đợi hồ sơ PGD">
      {/* Header: Title and View Switcher (Zero KPI Viewport Wastage) */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">PGD · Hàng đợi công việc</p>
          <h2 className="mt-0.5 text-sm md:text-base font-black text-slate-950">Mở đúng hồ sơ, xử lý đúng việc</h2>
        </div>

        {/* View switcher (DDT pattern) */}
        <div
          role="group"
          aria-label="Chọn chế độ hiển thị hàng đợi hồ sơ PGD"
          className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs"
        >
          <button
            type="button"
            onClick={() => setViewMode('card')}
            aria-label="Dạng thẻ"
            aria-pressed={viewMode === 'card'}
            className={`mobile-touch-target inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              viewMode === 'card'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem dạng thẻ chuẩn DDT"
          >
            <LayoutGrid size={13} aria-hidden="true" />
            <span className="whitespace-nowrap">Dạng thẻ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-label="Dạng bảng"
            aria-pressed={viewMode === 'table'}
            className={`mobile-touch-target inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem bảng truyền thống"
          >
            <List size={13} aria-hidden="true" />
            <span className="whitespace-nowrap">Dạng bảng</span>
          </button>
        </div>
      </div>

      {/* Keep search and core status filters close to the first card on mobile. */}
      <div className="pgd-queue-toolbar flex min-w-0 max-w-full flex-col gap-1 py-0 md:gap-2 md:py-1">
        {/* Search Input */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="pgdcn-toolbar-search relative min-w-0 max-w-sm flex-1">
            <span className="sr-only">Tìm trong hàng đợi hồ sơ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm trong hàng đợi hồ sơ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã PYC, khách hàng, đối tượng, phân loại, kết quả..."
              className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-1.5 text-base font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all md:text-[11px]"
            />
          </div>
          {hasActiveSearchOrFilter ? (
            <button
              type="button"
              onClick={() => { setQuery(''); setActiveChip('ALL'); }}
              className="mobile-touch-target min-h-11 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Đặt lại bộ lọc
            </button>
          ) : null}
        </div>

        {/* Secondary product filters collapse on mobile; the core status filters remain in a single scroll row. */}
        <div className="pgd-queue-filter-pills flex min-w-0 max-w-full flex-col gap-2 md:flex-row md:items-end md:gap-4">
          <div className="min-w-0 md:flex-1">
            <p id="pgd-queue-product-filter-label" className="sr-only md:not-sr-only md:mb-1 md:text-[9px] md:font-black md:uppercase md:tracking-wide md:text-slate-500">Nhóm sản phẩm PGD</p>
            <button
              type="button"
              aria-label={`Bộ lọc sản phẩm, ${activeProductFilterCount} bộ lọc đang áp dụng`}
              aria-expanded={productFiltersOpen}
              aria-controls="pgd-queue-product-filters"
              onClick={() => setProductFiltersOpen((open) => !open)}
              className="mobile-touch-target flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span>Bộ lọc sản phẩm</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">{activeProductFilterCount}</span>
                <span className="sr-only">{activeProductFilterCount} bộ lọc đang áp dụng</span>
                <ChevronDown aria-hidden="true" size={14} className={`transition-transform ${productFiltersOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            <div
              id="pgd-queue-product-filters"
              className={`${productFiltersOpen ? 'block' : 'hidden'} mt-1 md:mt-0 md:block`}
            >
              <div role="group" aria-labelledby="pgd-queue-product-filter-label" className="flex max-w-full flex-wrap items-center gap-1">
                {productGroupChips.map(renderFilterChip)}
              </div>
            </div>
          </div>
          <div className="min-w-0 md:flex-[1.5]">
            <p id="pgd-queue-state-filter-label" className="sr-only md:not-sr-only md:mb-1 md:text-[9px] md:font-black md:uppercase md:tracking-wide md:text-slate-500">Trạng thái / tiến độ hồ sơ</p>
            <div role="group" aria-labelledby="pgd-queue-state-filter-label" className="mobile-scroll-x flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain md:flex-wrap md:overflow-visible md:pb-0">
              {dossierStateChips.map(renderFilterChip)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Desktop 2 Columns, Mobile 1 Column */}
      {filteredRows.length > 0 ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itemModels.map((item) => {
              return (
                <PgdDossierSummaryCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedCardIds.has(item.id)}
                  onToggleExpand={() => toggleCard(item.id)}
                  onOpenDetail={() => onOpenDossier(item.id)}
                  searchQuery={query}
                />
              );
            })}
          </div>
        ) : (
          /* Table View (Secondary Traditional Table) */
          <div
            data-testid="pgd-dossier-table-scroll"
            role="region"
            aria-label="Bảng hồ sơ PGD, cuộn ngang để xem các cột khác"
            tabIndex={0}
            className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x rounded-xl border border-slate-200 bg-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-600 sm:hidden">Vuốt ngang để xem đầy đủ bảng hồ sơ PGD.</p>
            <table aria-label="Bảng hàng đợi hồ sơ PGD" className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ PGD đang cần xử lý</caption>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Mã PYC</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Trạng thái hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Đối tượng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Nhóm sản phẩm / phân loại</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Bước hiện tại / tiếp theo</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Đầu mục hồ sơ còn thiếu</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const score = row.requiredDocumentTotal > 0 ? Math.round((row.requiredDocumentPresent / row.requiredDocumentTotal) * 100) : 100;
                  return (
                    <tr key={row.requestId} className="align-top transition-colors hover:bg-blue-50/40">
                      <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal">
                        <div className="min-w-[150px]">
                          <button
                            type="button"
                            onClick={() => onOpenDossier(row.requestId)}
                            aria-label={`Mở chi tiết hồ sơ ${row.requestCode}`}
                            className="font-mono text-xs font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 cursor-pointer"
                          >
                            {row.requestCode}
                          </button>
                        </div>
                      </th>
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <PgdcnStatusBadge compact domain="PGD" status={row.status} label={row.statusLabel} />
                      </td>
                      <td className="max-w-[200px] px-3 py-3 align-top text-sm font-medium text-slate-900">
                        <span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span>
                      </td>
                      <td className="max-w-[200px] px-3 py-3 align-top text-sm text-slate-700">
                        <span className="line-clamp-2">{row.productName || 'Chưa có đối tượng'}</span>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 align-top text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">{row.productGroup || 'Chưa xác định nhóm'}</p>
                        <span className="mt-1 inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
                          {row.catalogLabel || 'Chưa phân loại'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-semibold text-blue-900">Bước {row.currentStepNumber} · {row.currentStepLabel}</p>
                        <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Tiếp theo:</span> {row.nextActionLabel || 'Chờ xử lý tiếp'}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <span className="font-semibold text-slate-900">{score}%</span>
                        <p className="mt-1 text-xs text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} mục</p>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 align-top">
                        <span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                          {row.missingRequiredCount > 0 ? `Còn thiếu ${row.missingRequiredCount} đầu mục` : 'Đủ đầu mục bắt buộc'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-slate-700">
                        {row.ownerDisplayName || row.ownerUsername || 'Chưa phân công'}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <button
                          type="button"
                          className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                          onClick={() => onOpenDossier(row.requestId)}
                        >
                          <span>Mở hồ sơ</span>
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <Layers size={28} className="mx-auto text-slate-300" />
          {rows.length === 0 ? (
            <>
              <h3 className="mt-2 text-xs font-bold text-slate-800">Chưa có hồ sơ PGD trong hàng đợi</h3>
              <p className="mt-1 text-[11px] text-slate-500">Hồ sơ sẽ xuất hiện tại đây khi được tạo.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-xs font-bold text-slate-800">Không tìm thấy hồ sơ PGD phù hợp</h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {query.trim()
                  ? `Không có hồ sơ khớp từ khóa “${query.trim()}”${activeChip === 'ALL' ? '' : ` trong bộ lọc “${activeChipLabel}”`}.`
                  : `Không có hồ sơ phù hợp với bộ lọc “${activeChipLabel}”.`}
              </p>
              {hasActiveSearchOrFilter && <p className="mt-2 text-[11px] font-semibold text-blue-700">Dùng “Đặt lại bộ lọc” để xem lại toàn bộ hàng đợi.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
