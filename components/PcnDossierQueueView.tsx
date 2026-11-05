'use client';

import {
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  FileWarning,
  Search,
  UserRound,
  Building2,
  Package,
  Clock,
  Layers,
  CheckCircle2,
  FolderOpen,
  ChevronDown,
  Download,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import type { PcnOperationsRegisterRow } from '../utils/pcnOperationsRegister';
import { getPgdcnDashboardStatusLabel } from '../utils/pgdcnDashboard';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { isPcnSystemManager } from '../utils/pcnRbac';
import { usePcnStore } from '../store-pcn';
import { downloadPcnDossierPackage } from '../utils/pcnDossierPackageApi';
import PcnDossierAssignmentControl from './PcnDossierAssignmentControl';
import type { PcnUserAccount, UserAccount } from '../types';

export interface PcnDossierQueueViewProps {
  rows: PcnOperationsRegisterRow[];
  onOpenDossier: (dossierId: string) => void;
  users?: PcnUserAccount[];
  currentUser?: UserAccount | null;
  onAssignDossier?: (dossierId: string, ownerUsername: string) => Promise<unknown>;
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

export default function PcnDossierQueueView({ rows, onOpenDossier, users: providedUsers, currentUser: providedCurrentUser, onAssignDossier, filterControls }: PcnDossierQueueViewProps) {
  const sessionUser = usePcnSessionStore((state) => state.currentUser);
  const currentUser = providedCurrentUser === undefined ? sessionUser : providedCurrentUser;
  const isManagerOrAdmin = Boolean(currentUser && (currentUser.systemRole === 'admin' || currentUser.role === 'admin' || isPcnSystemManager(currentUser)));
  const deleteDossier = usePcnStore((state) => state.deleteDossier);
  const storeUsers = usePcnStore((state) => state.users);
  const updateDossier = usePcnStore((state) => state.updateDossier);
  const users = providedUsers ?? storeUsers;
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<PcnFilterChipId>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const actionCount = rows.filter(isActionable).length;
  const incompleteCount = rows.filter((row) => row.missingRequiredCount > 0).length;
  const unassignedCount = rows.filter((row) => !row.ownerUsername).length;
  const hasActiveFilters = activeChip !== 'ALL' || Boolean(query.trim());

  const resetFilters = () => {
    setQuery('');
    setActiveChip('ALL');
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

  const handleQuickView = (row: PcnOperationsRegisterRow) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pgdcn:quickview', {
          detail: {
            domain: 'PCN',
            dossierCode: row.dossierCode,
            item: {
              dossierCode: row.dossierCode,
              domain: 'PCN',
              customerName: row.customerName,
              productName: row.productName,
              status: row.dossierStatus,
              statusLabel: statusLabel(row.dossierStatus),
              currentStage: row.stationTitle,
              nextStep: row.stationActionLabel || 'Chờ xử lý tiếp',
              assigneeName: row.ownerUsername,
            },
          },
        })
      );
    }
  };

  const handleDownloadPackage = async (row: PcnOperationsRegisterRow) => {
    try {
      await downloadPcnDossierPackage(row.dossierId, row.dossierCode);
      toast.success(`Đã tải bộ hồ sơ ${row.dossierCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải bộ hồ sơ PCN.');
    }
  };

  const handleDeleteDossier = async (row: PcnOperationsRegisterRow) => {
    if (!isManagerOrAdmin) return;
    const reason = typeof window !== 'undefined'
      ? window.prompt('Nhập lý do xóa vĩnh viễn hồ sơ PCN:', '')?.trim()
      : undefined;
    if (!reason) return;
    const confirmationCode = typeof window !== 'undefined'
      ? window.prompt(`Nhập lại chính xác mã hồ sơ để xác nhận xóa: ${row.dossierCode}`, '')?.trim()
      : undefined;
    if (!confirmationCode) return;
    if (confirmationCode !== row.dossierCode) {
      toast.error('Mã xác nhận không khớp với mã hồ sơ.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`Bạn chắc chắn muốn XÓA VĨNH VIỄN hồ sơ ${row.dossierCode}? Toàn bộ dữ liệu liên kết sẽ bị xóa, không thể khôi phục.`)) return;
    try {
      await deleteDossier(row.dossierId, reason, confirmationCode);
      toast.success(`Đã xóa vĩnh viễn hồ sơ PCN ${row.dossierCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa hồ sơ PCN.');
    }
  };

  return (
    <section data-testid="pcn-dossier-queue" className="min-w-0 space-y-3 p-3 md:p-4" aria-label="Hàng đợi hồ sơ PCN">
      {/* Header: 1-line compact with brand color badge */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
            PCN · Hàng đợi công việc
          </span>
          <h2 className="text-sm md:text-base font-black text-slate-900">Mở đúng hồ sơ, xử lý đúng việc</h2>
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

      {/* Bảng hồ sơ PCN */}
      {filteredRows.length > 0 ? (
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
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-44 min-w-[160px] border-b border-slate-200 bg-slate-50 px-3 py-3">
                    <span className="block font-bold text-slate-700">Hồ sơ / Đề nghị</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Mã hồ sơ · Trạng thái</span>
                  </th>
                  <th scope="col" className="w-[22%] min-w-[180px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Khách hàng</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Doanh nghiệp đề nghị</span>
                  </th>
                  <th scope="col" className="w-[18%] min-w-[150px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Sản phẩm</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Tên & kiểu loại</span>
                  </th>
                  <th scope="col" className="w-[18%] min-w-[150px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Bước hiện tại</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Công đoạn xử lý</span>
                  </th>
                  <th scope="col" className="w-28 min-w-[110px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Hoàn thiện</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Tiến độ hồ sơ</span>
                  </th>
                  <th scope="col" className="w-32 min-w-[120px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Tài liệu</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Tình trạng đầu mục</span>
                  </th>
                  <th scope="col" className="w-28 min-w-[110px] border-b border-slate-200 px-3 py-3">
                    <span className="block font-bold text-slate-700">Chủ hồ sơ</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Phụ trách kỹ thuật</span>
                  </th>
                  <th scope="col" className="w-32 min-w-[120px] border-b border-slate-200 px-3 py-3 text-right">
                    <span className="block font-bold text-slate-700">Thao tác</span>
                    <span className="block text-[10px] font-medium text-slate-400 normal-case">Mở / Tải / Xóa</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.dossierId} className="align-top transition-colors hover:bg-slate-50/70 border-b border-slate-100">
                    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal border-b border-slate-100">
                      <div className="min-w-[150px]">
                        <button
                          type="button"
                          onClick={() => onOpenDossier(row.dossierId)}
                          aria-label={`Mở chi tiết hồ sơ ${row.dossierCode}`}
                          className="font-mono text-xs font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 cursor-pointer"
                        >
                          {row.dossierCode}
                        </button>
                        <p className="mt-0.5 text-[11px] text-slate-500">Đề nghị {row.registrationCode}</p>
                        <div className="mt-1">
                          <PgdcnStatusBadge compact domain="PCN" status={row.dossierStatus} label={statusLabel(row.dossierStatus)} />
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3 align-top text-xs font-semibold text-slate-900">
                      <span className="line-clamp-2" title={row.customerName || undefined}>{row.customerName || 'Chưa có khách hàng'}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-700">
                      <span className="line-clamp-2" title={row.productName || undefined}>{row.productName || 'Chưa có sản phẩm'}</span>
                      {row.model && <span className="block mt-0.5 font-mono text-[10px] text-slate-400">{row.model}</span>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="text-xs font-semibold text-blue-900">{row.stationTitle}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{row.stationActionLabel}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                row.completenessScore >= 100
                                  ? 'bg-emerald-600'
                                  : row.completenessScore >= 60
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, row.completenessScore))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-800">{row.completenessScore}%</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        row.missingRequiredCount > 0
                          ? 'border border-amber-200/80 bg-amber-50 text-amber-800'
                          : 'border border-emerald-200/80 bg-emerald-50 text-emerald-800'
                      }`}>
                        {row.missingRequiredCount > 0 ? `Thiếu ${row.missingRequiredCount} mục` : 'Đủ tài liệu bắt buộc'}
                      </span>
                    </td>
                    <td className="min-w-[190px] px-3 py-3 align-top text-xs font-medium text-slate-700">
                      <PcnDossierAssignmentControl
                        dossier={{ id: row.dossierId, dossierCode: row.dossierCode, fieldCodes: row.fieldCodes, ownerUsername: row.ownerUsername }}
                        users={users}
                        currentUser={currentUser}
                        onAssign={async (ownerUsername) => {
                          if (onAssignDossier) await onAssignDossier(row.dossierId, ownerUsername);
                          else await updateDossier(row.dossierId, { ownerUsername });
                        }}
                        compact
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenDossier(row.dossierId)}
                          title="Mở chi tiết hồ sơ"
                          aria-label={`Mở hồ sơ ${row.dossierCode}`}
                          className="mobile-touch-target dossier-action-compact rounded-lg border border-emerald-600 bg-emerald-600 p-2 text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <FolderOpen size={14} aria-hidden="true" />
                          <span className="sr-only">Mở hồ sơ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadPackage(row)}
                          title="Tải gói tài liệu hồ sơ"
                          aria-label={`Tải tài liệu hồ sơ ${row.dossierCode}`}
                          className="mobile-touch-target rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-emerald-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <Download size={14} aria-hidden="true" />
                          <span className="sr-only">Tải tài liệu</span>
                        </button>
                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteDossier(row)}
                            title="Xóa vĩnh viễn hồ sơ"
                            aria-label={`Xóa hồ sơ ${row.dossierCode}`}
                            className="mobile-touch-target rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-2xs transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            <span className="sr-only">Xóa hồ sơ</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </section>
  );
}
