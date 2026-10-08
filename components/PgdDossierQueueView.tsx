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
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';

import { PgdcnStatusBadge } from './PgdcnUiPrimitives';
import {
  PgdcnDossierCard,
  PgdcnDossierCardExpanded,
  PgdcnDossierQuickActions,
  type PgdcnDossierItemModel,
  type DossierComponentStage,
  type DossierBlockerItem,
  type DossierQuickAction,
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
  { id: 'OVERDUE', label: 'Thiếu hồ sơ' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
] as const;

type PgdFilterChipId = typeof PGD_FILTER_CHIPS[number]['id'];

export default function PgdDossierQueueView({ rows, onOpenDossier }: PgdDossierQueueViewProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [activeChip, setActiveChip] = useState<PgdFilterChipId>('ALL');
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const actionCount = rows.filter((r) => r.missingRequiredCount > 0 || !['Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(r.statusLabel)).length;
  const incompleteCount = rows.filter((r) => r.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((r) => !r.ownerUsername && !r.ownerDisplayName).length;

  const toggleCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    let result = rows;
    if (activeChip === 'ACTION_NEEDED') {
      result = result.filter((r) => r.missingRequiredCount > 0 || !['Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(r.statusLabel));
    } else if (activeChip === 'STEEL') {
      result = result.filter((r) => r.productGroup.includes('Thép') || r.catalogLabel.includes('Thép'));
    } else if (activeChip === 'MACHINE') {
      result = result.filter((r) => r.productGroup.includes('Máy') || r.catalogLabel.includes('Máy'));
    } else if (activeChip === 'COAL') {
      result = result.filter((r) => r.productGroup.includes('Than') || r.catalogLabel.includes('Than'));
    } else if (activeChip === 'INTAKE') {
      result = result.filter((r) => r.currentStepNumber <= 2);
    } else if (activeChip === 'IN_PROGRESS') {
      result = result.filter((r) => r.currentStepNumber > 2 && r.currentStepNumber < 5);
    } else if (activeChip === 'OVERDUE') {
      result = result.filter((r) => r.missingRequiredCount > 0);
    } else if (activeChip === 'COMPLETED') {
      result = result.filter((r) => ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(r.statusLabel));
    }

    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return result;
    return result.filter((row) =>
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
  }, [query, rows, activeChip]);

  // Convert PGD row to unified item model
  const itemModels = useMemo<PgdcnDossierItemModel[]>(() => {
    return filteredRows.map((row) => {
      const blockers: DossierBlockerItem[] = [];
      if (row.missingRequiredCount > 0) {
        blockers.push({
          id: `pgd-missing-${row.requestId}`,
          title: 'Thiếu hồ sơ & bằng chứng bắt buộc',
          reason: `Còn thiếu ${row.missingRequiredCount} mục tài liệu theo quy trình giám định.`,
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
          label: ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(row.statusLabel) ? 'Chứng thư ✓' : 'Chưa phát hành',
          tone: ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(row.statusLabel) ? 'success' : 'default',
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
          status: ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(row.statusLabel) ? 'COMPLETED' : 'IN_PROGRESS',
          statusLabel: ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(row.statusLabel) ? 'Đã ký' : 'Đang soạn',
        },
        {
          id: 'archive',
          name: 'Lưu trữ hồ sơ',
          status: ['Đã lưu trữ'].includes(row.statusLabel) ? 'COMPLETED' : 'LOCKED',
          statusLabel: ['Đã lưu trữ'].includes(row.statusLabel) ? 'Đã lưu' : 'Chưa lưu',
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
              : `Sẵn sàng thực hiện bước ${row.currentStepNumber} · ${row.currentStepLabel}.`,
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
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              viewMode === 'card'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem dạng thẻ chuẩn DDT"
          >
            <LayoutGrid size={13} />
            <span className="hidden sm:inline">Dạng thẻ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Xem bảng truyền thống"
          >
            <List size={13} />
            <span className="hidden sm:inline">Dạng bảng</span>
          </button>
        </div>
      </div>

      {/* Single-row Toolbar (TVCI Lab Standard) */}
      <div className="pgdcn-toolbar-nowrap flex items-center gap-2 overflow-x-auto py-1">
        {/* Search Input */}
        <div className="pgdcn-toolbar-search relative min-w-[200px] max-w-sm flex-1 shrink-0">
          <span className="sr-only">Tìm trong hàng đợi hồ sơ</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm trong hàng đợi hồ sơ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã PYC, khách hàng, đối tượng, phân loại, kết quả..."
            className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="pgdcn-toolbar-pills flex items-center gap-1.5 shrink-0">
          {PGD_FILTER_CHIPS.map((chip) => {
            const active = activeChip === chip.id;
            const count =
              chip.id === 'ALL'
                ? rows.length
                : chip.id === 'ACTION_NEEDED'
                ? actionCount
                : chip.id === 'STEEL'
                ? rows.filter((r) => r.productGroup.includes('Thép') || r.catalogLabel.includes('Thép')).length
                : chip.id === 'MACHINE'
                ? rows.filter((r) => r.productGroup.includes('Máy') || r.catalogLabel.includes('Máy')).length
                : chip.id === 'COAL'
                ? rows.filter((r) => r.productGroup.includes('Than') || r.catalogLabel.includes('Than')).length
                : chip.id === 'INTAKE'
                ? rows.filter((r) => r.currentStepNumber <= 2).length
                : chip.id === 'IN_PROGRESS'
                ? rows.filter((r) => r.currentStepNumber > 2 && r.currentStepNumber < 5).length
                : chip.id === 'OVERDUE'
                ? incompleteCount
                : rows.filter((r) => ['Đã ký', 'Đã hoàn thành', 'Đã lưu trữ', 'Đã trả kết quả'].includes(r.statusLabel)).length;

            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveChip(chip.id)}
                className={`mobile-touch-target inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
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
      </div>

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
          <div className="mobile-scroll-x min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table aria-label="Bảng hàng đợi hồ sơ PGD" className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <caption className="sr-only">Danh sách hồ sơ PGD đang cần xử lý</caption>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Mã PYC</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Đối tượng</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Loại hồ sơ</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Việc hiện tại</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu còn thiếu</th>
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
                          <PgdcnStatusBadge compact domain="PGD" status={row.status} label={row.statusLabel} />
                        </div>
                      </th>
                      <td className="max-w-[200px] px-3 py-3 align-top text-sm font-medium text-slate-900">
                        <span className="line-clamp-2">{row.customerName || 'Chưa có khách hàng'}</span>
                      </td>
                      <td className="max-w-[200px] px-3 py-3 align-top text-sm text-slate-700">
                        <span className="line-clamp-2">{row.productName || 'Chưa có đối tượng'}</span>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-600">
                        <span className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
                          {row.catalogLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-semibold text-blue-900">Bước {row.currentStepNumber} · {row.currentStepLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.nextActionLabel || 'Chờ xử lý tiếp'}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <span className="font-semibold text-slate-900">{score}%</span>
                        <p className="mt-1 text-xs text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} mục</p>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 align-top">
                        <span className={row.missingRequiredCount > 0 ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                          {row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-slate-700">
                        {row.ownerDisplayName || row.ownerUsername || 'Chưa phân công'}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <button
                          type="button"
                          className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[10px] font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
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
          <h3 className="mt-2 text-xs font-bold text-slate-800">Không tìm thấy hồ sơ PGD phù hợp</h3>
          <p className="mt-1 text-[11px] text-slate-500">Hãy thử điều chỉnh từ khóa tìm kiếm hoặc các tiêu chí bộ lọc.</p>
        </div>
      )}
    </section>
  );
}
