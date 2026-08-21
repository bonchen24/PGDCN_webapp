// Author: Gemini
// OS support: Web/Node
// Description: KQTNView component displaying redesigned lab test results cell-grid table, column customization, multi-field search, version history tracking, and rich modal inspection

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Upload, Eye, Edit2, Trash2, RefreshCw, History, Plus, FileSpreadsheet,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, ArrowLeft, EyeOff, X, FileText, 
  User, Calendar, Award, ShieldCheck, Info, Layers, Tag, Building, Image as ImageIcon,
  Check, Maximize2, Sparkles, Filter, ChevronLast, ChevronFirst
} from 'lucide-react';
import { useStore } from '../store';
import { KQTNRecord, KQTNVersionHistory } from '../types';
import { formatDateVN } from '../utils/formatter';
import { toast } from 'sonner';
import { MAHOA_CODES } from '../lib/mahoa-codes';
import { mergeKqtnSampleHeads } from '../utils/kqtnRows';
import { getKqtnPdfUrl, uploadKqtnPdf } from '../utils/kqtnPdfClient';
import KqtnBulkPdfUploadModal from './KqtnBulkPdfUploadModal';

interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'stt', label: '#', width: 45, visible: true },
  { id: 'sampleCode', label: 'Số mã hóa', width: 130, visible: true },
  { id: 'sealStamp', label: 'Tem niêm phong', width: 140, visible: true },
  { id: 'resultPdf', label: 'File PDF', width: 180, visible: true },
  { id: 'version', label: 'Version', width: 85, visible: true },
  { id: 'sampleName', label: 'Tên mẫu', width: 200, visible: true },
  { id: 'model', label: 'Model', width: 150, visible: true },
  { id: 'brand', label: 'Thương hiệu', width: 130, visible: true },
  { id: 'senderUnit', label: 'Khách hàng', width: 220, visible: true },
  { id: 'standardTitle', label: 'Tiêu chuẩn', width: 220, visible: true },
  { id: 'criteriaType', label: 'Loại thử', width: 105, visible: true },
  { id: 'testDate', label: 'Ngày TN', width: 120, visible: true },
  { id: 'reportDate', label: 'Ngày ra BC', width: 110, visible: true },
  { id: 'testerName', label: 'Người thử', width: 140, visible: true },
  { id: 'updatedAt', label: 'Ngày cập nhật', width: 145, visible: true },
  { id: 'updatedBy', label: 'Cập nhật bởi', width: 135, visible: true }
];

export default function KQTNView() {
  const { 
    kqtnRecords, requests, currentUser, deleteKqtnRecord, updateKqtnRecord
  } = useStore();

  const isAdmin = currentUser?.role === 'admin';

  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const isColumnsLoaded = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    const storageKey = `lab_kqtn_cols_${currentUser.username}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = DEFAULT_COLUMNS.map(defCol => {
            const found = parsed.find((p: any) => p.id === defCol.id);
            if (found) {
              return {
                ...defCol,
                width: typeof found.width === 'number' ? found.width : defCol.width,
                visible: typeof found.visible === 'boolean' ? found.visible : defCol.visible
              };
            }
            return defCol;
          });
          setColumns(merged);
        }
      } catch (e) {}
    }
    isColumnsLoaded.current = true;
  }, [currentUser]);

  useEffect(() => {
    if (isColumnsLoaded.current && currentUser) {
      const storageKey = `lab_kqtn_cols_${currentUser.username}`;
      localStorage.setItem(storageKey, JSON.stringify(columns));
    }
  }, [columns, currentUser]);

  const [searchTerm, setSearchTerm] = useState('');
  const [standardFilter, setStandardFilter] = useState<string>('ALL');
  const [testerFilter, setTesterFilter] = useState<string>('ALL');
  const [criteriaFilter, setCriteriaFilter] = useState<string>('ALL');
  const [versionFilter, setVersionFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'CODE_ASC'>('NEWEST');

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkPdfUpload, setShowBulkPdfUpload] = useState(false);

  const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<KQTNRecord | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'overview' | 'results' | 'history'>('overview');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<KQTNRecord | null>(null);

  const [recordToEditVersion, setRecordToEditVersion] = useState<KQTNRecord | null>(null);
  const [editChangeNote, setEditChangeNote] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editSampleName, setEditSampleName] = useState('');
  const [editSealStamp, setEditSealStamp] = useState('');
  const [editTestDate, setEditTestDate] = useState('');
  const [editReportDate, setEditReportDate] = useState('');

  const sampleHeadRows = useMemo(() => mergeKqtnSampleHeads(requests || [], kqtnRecords || []), [requests, kqtnRecords]);

  const stats = useMemo(() => {
    const list = sampleHeadRows;
    const total = list.length;
    const multiVersion = list.filter(r => (r.version || 1) > 1).length;
    const withSeal = list.filter(r => r.sealStamp && r.sealStamp.trim().length > 0).length;
    return { total, multiVersion, withSeal };
  }, [sampleHeadRows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (standardFilter !== 'ALL') count++;
    if (testerFilter !== 'ALL') count++;
    if (criteriaFilter !== 'ALL') count++;
    if (versionFilter !== 'ALL') count++;
    return count;
  }, [standardFilter, testerFilter, criteriaFilter, versionFilter]);

  const uniqueStandards = useMemo(() => {
    const set = new Set<string>();
    sampleHeadRows.forEach(r => {
      if (r.standardTitle) set.add(r.standardTitle);
    });
    return Array.from(set);
  }, [sampleHeadRows]);

  const uniqueTesters = useMemo(() => {
    const set = new Set<string>();
    sampleHeadRows.forEach(r => {
      if (r.testerName) set.add(r.testerName);
    });
    return Array.from(set);
  }, [sampleHeadRows]);

  const filteredRecords = useMemo(() => {
    let result = [...sampleHeadRows];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(r => 
        (r.requestCode && r.requestCode.toLowerCase().includes(term)) ||
        (r.sampleCode && r.sampleCode.toLowerCase().includes(term)) ||
        (r.reportNo && r.reportNo.toLowerCase().includes(term)) ||
        (r.sealStamp && r.sealStamp.toLowerCase().includes(term)) ||
        (r.sampleName && r.sampleName.toLowerCase().includes(term)) ||
        (r.model && r.model.toLowerCase().includes(term)) ||
        (r.brand && r.brand.toLowerCase().includes(term)) ||
        (r.senderUnit && r.senderUnit.toLowerCase().includes(term)) ||
        (r.testerName && r.testerName.toLowerCase().includes(term))
      );
    }

    if (standardFilter !== 'ALL') {
      result = result.filter(r => r.standardTitle === standardFilter);
    }

    if (testerFilter !== 'ALL') {
      result = result.filter(r => r.testerName === testerFilter);
    }

    if (criteriaFilter !== 'ALL') {
      result = result.filter(r => r.criteriaType === criteriaFilter);
    }

    if (versionFilter === 'V1_ONLY') {
      result = result.filter(r => (r.version || 1) === 1);
    } else if (versionFilter === 'UPDATED_V2') {
      result = result.filter(r => (r.version || 1) > 1);
    }

    if (sortOrder === 'NEWEST') {
      result.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    } else if (sortOrder === 'OLDEST') {
      result.sort((a, b) => new Date(a.updatedAt || a.createdAt || 0).getTime() - new Date(b.updatedAt || b.createdAt || 0).getTime());
    } else if (sortOrder === 'CODE_ASC') {
      result.sort((a, b) => (a.sampleCode || a.reportNo || '').localeCompare(b.sampleCode || b.reportNo || ''));
    }

    return result;
  }, [sampleHeadRows, searchTerm, standardFilter, testerFilter, criteriaFilter, versionFilter, sortOrder]);

  const totalItems = filteredRecords.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / (pageSize as number)));

  const paginatedRecords = useMemo(() => {
    if (pageSize === 'ALL') return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * (pageSize === 'ALL' ? 0 : (pageSize as number)) + 1;
  const endIndex = pageSize === 'ALL' ? totalItems : Math.min(totalItems, currentPage * (pageSize as number));

  const toggleColumnVisibility = (colId: string) => {
    if (colId === 'stt') return;
    setColumns(cols => cols.map(c => c.id === colId ? { ...c, visible: !c.visible } : c));
  };

  const moveColumn = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index > 1) {
      setColumns(cols => {
        const newCols = [...cols];
        const temp = newCols[index];
        newCols[index] = newCols[index - 1];
        newCols[index - 1] = temp;
        return newCols;
      });
    } else if (direction === 'right' && index < columns.length - 1) {
      setColumns(cols => {
        const newCols = [...cols];
        const temp = newCols[index];
        newCols[index] = newCols[index + 1];
        newCols[index + 1] = temp;
        return newCols;
      });
    }
  };

  const resetColumnsToDefault = () => {
    setColumns(DEFAULT_COLUMNS);
    if (currentUser) {
      localStorage.removeItem(`lab_kqtn_cols_${currentUser.username}`);
    }
    toast.success('Đã khôi phục cấu hình cột mặc định');
  };

  const resizingColRef = useRef<number | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleResizeStart = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = idx;
    startXRef.current = e.pageX;
    startWidthRef.current = columns[idx].width;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (resizingColRef.current === null) return;
    const diff = e.pageX - startXRef.current;
    const newWidth = Math.max(50, startWidthRef.current + diff);
    setColumns(cols => {
      const nextCols = [...cols];
      nextCols[resizingColRef.current as number].width = newWidth;
      return nextCols;
    });
  };

  const handleResizeEnd = () => {
    resizingColRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const getColLetter = (idx: number) => {
    if (idx === 0) return '';
    let temp, letter = '';
    let n = idx;
    while (n > 0) {
      temp = (n - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      n = Math.floor((n - temp - 1) / 26);
    }
    return letter;
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStandardFilter('ALL');
    setTesterFilter('ALL');
    setCriteriaFilter('ALL');
    setVersionFilter('ALL');
  };

  const handleOpenEditVersion = (rec: KQTNRecord) => {
    setRecordToEditVersion(rec);
    setEditChangeNote(`Cập nhật thông tin bản ghi KQTN phiên bản v${(rec.version || 1) + 1}`);
    setEditModel(rec.model || '');
    setEditBrand(rec.brand || '');
    setEditSampleName(rec.sampleName || '');
    setEditSealStamp(rec.sealStamp || '');
    setEditTestDate(rec.testDate || '');
    setEditReportDate(rec.reportDate || '');
  };

  const handleSaveEditedVersion = async () => {
    if (!recordToEditVersion) return;
    if (!editChangeNote.trim()) {
      toast.error('Vui lòng nhập lý do/ghi chú cập nhật phiên bản');
      return;
    }

    try {
      await updateKqtnRecord(
        recordToEditVersion.id,
        {
          model: editModel,
          brand: editBrand,
          sampleName: editSampleName,
          sealStamp: editSealStamp,
          testDate: editTestDate,
          reportDate: editReportDate
        },
        editChangeNote
      );
      toast.success(`Đã cập nhật lên phiên bản v${(recordToEditVersion.version || 1) + 1} thành công!`);
      setRecordToEditVersion(null);
    } catch (e: any) {
      toast.error('Lỗi khi lưu phiên bản: ' + e.message);
    }
  };

  const bulkCandidates = useMemo(() => sampleHeadRows.map((row) => ({
    id: row.id,
    sampleCode: row.sampleCode,
    sampleKey: row.sampleKey || row.sampleCode,
    model: row.model,
    hasPdf: Boolean(row.resultPdf),
  })), [sampleHeadRows]);

  const handleUploadPdf = async (record: KQTNRecord & { isPending?: boolean }, file?: File) => {
    if (!file) return;
    if (record.isPending || record.id.startsWith('sample-head:')) {
      toast.warning('Save the KQTN result before attaching a PDF.');
      return;
    }
    if (record.resultPdf && !window.confirm('This sample head already has a PDF. Replace the old file?')) return;
    try {
      const resultPdf = await uploadKqtnPdf(record.id, file);
      await updateKqtnRecord(record.id, { resultPdf }, 'Attached or replaced KQTN PDF');
      toast.success('KQTN PDF saved.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to save KQTN PDF.');
    }
  };

  const handleBulkUploaded = async (recordId: string, resultPdf: any) => {
    await updateKqtnRecord(recordId, { resultPdf }, 'Bulk uploaded KQTN PDF');
  };

  const exportToCSV = () => {
    try {
      const visibleCols = columns.filter(c => c.id !== 'stt' && c.visible);
      const headers = visibleCols.map(c => c.label);
      const rows = filteredRecords.map((req) => {
        return visibleCols.map(col => {
          const field = col.id as keyof KQTNRecord;
          const val = req[field];
          if (val === null || val === undefined) return '';
          if (field === 'createdAt' || field === 'updatedAt' || field === 'testDate' || field === 'reportDate') {
            return formatDateVN(String(val));
          }
          if (field === 'resultPdf') {
            return val ? 'PDF' : '';
          }
          if (field === 'criteriaType') {
            return val === 'full' ? 'Đầy đủ' : 'Rút gọn';
          }
          return String(val).replace(/"/g, '""');
        });
      });

      let csvContent = "\uFEFF"; 
      csvContent += headers.map(h => `"${h}"`).join(",") + "\n";
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `KQTN_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Xuất file Excel/CSV thành công!");
    } catch (e: any) {
      toast.error("Lỗi xuất file: " + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50 select-none overflow-hidden">
      <header className="border-b border-slate-200 bg-white px-3 sm:px-4 py-3 shrink-0 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-none bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2 min-w-0">
                <h1 className="text-base font-bold text-slate-800 tracking-tight truncate">
                  Sổ Kết Quả Thử Nghiệm (KQTN)
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-none">
                  Data Grid
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Quản lý, truy xuất và theo dõi lịch sử phiên bản kết quả thử nghiệm lab
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex items-center flex-wrap gap-1 text-xs font-semibold text-slate-600 border-r border-slate-200 pr-2 min-w-0">
              <span className="px-2.5 py-1 text-slate-800 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Tổng: <strong className="text-emerald-700">{stats.total}</strong>
              </span>
              <span className="px-2 py-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Có tem: <strong className="text-amber-700">{stats.withSeal}</strong>
              </span>
              {stats.multiVersion > 0 && (
                <span className="px-2 py-1 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  Đã sửa: <strong className="text-blue-700">{stats.multiVersion}</strong>
                </span>
              )}
            </div>

            <button
              onClick={() => setShowBulkPdfUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold shadow-xs transition-colors"
              title="Bulk Upload PDF KQTN"
            >
              <Upload size={14} />
              <span>Bulk Upload</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-sm text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
              title="Xuất bảng ra file CSV/Excel"
            >
              <Download size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            <button
              onClick={() => setShowConfigPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-sm text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
              title="Tùy biến hiển thị và độ rộng cột"
            >
              <SlidersHorizontal size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Tùy biến cột</span>
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex-1 flex items-center gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="w-full bg-transparent border-b border-slate-300 pl-8 pr-8 py-1 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                placeholder="Tìm mã phiếu, Số mã hóa, Tem niêm phong, Model, Tên mẫu, Khách hàng..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-sm text-xs font-bold transition-all shrink-0 ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={13} />
              <span>Bộ lọc</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
              <span>Sắp xếp:</span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as any)}
                className="bg-transparent border-b border-slate-300 py-0.5 px-0 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="NEWEST">Mới cập nhật nhất</option>
                <option value="OLDEST">Cũ nhất</option>
                <option value="CODE_ASC">Số mã hóa (A-Z)</option>
              </select>
            </div>

            {(searchTerm || activeFiltersCount > 0) && (
              <button
                onClick={handleClearFilters}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm border border-slate-200 transition-colors"
                title="Xóa tất cả bộ lọc"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-2 p-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs animate-in fade-in duration-150">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Tiêu chuẩn thử nghiệm</label>
              <select
                value={standardFilter}
                onChange={e => { setStandardFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">-- Tất cả tiêu chuẩn --</option>
                {uniqueStandards.map(std => (
                  <option key={std} value={std}>{std}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Người thử nghiệm (KTV)</label>
              <select
                value={testerFilter}
                onChange={e => { setTesterFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">-- Tất cả người thử --</option>
                {uniqueTesters.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Loại chỉ tiêu</label>
              <select
                value={criteriaFilter}
                onChange={e => { setCriteriaFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">-- Tất cả loại thử --</option>
                <option value="full">Đầy đủ</option>
                <option value="reduced">Rút gọn</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Phiên bản bản ghi</label>
              <select
                value={versionFilter}
                onChange={e => { setVersionFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">-- Tất cả phiên bản --</option>
                <option value="V1_ONLY">Bản ghi gốc (v1)</option>
                <option value="UPDATED_V2">Đã cập nhật (v2 trở lên)</option>
              </select>
            </div>
          </div>
        )}
      </header>

      <main className="mobile-scroll-x flex-1 min-w-0 min-h-0 overflow-auto bg-white relative">
        <div className="w-max min-w-full align-middle">
          <table className="w-max min-w-full border-collapse text-xs table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 shadow-xs select-none">
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-mono text-slate-400 h-4">
                {columns.filter(c => c.visible).map((col, idx) => (
                  <th 
                    key={`letter-${col.id}`} 
                    className="border-r border-slate-200/80 text-center font-normal px-1"
                    style={{ width: col.width }}
                  >
                    {getColLetter(idx)}
                  </th>
                ))}
                <th className="w-20 text-center font-normal text-[9px]">ACTIONS</th>
              </tr>

              <tr className="border-b border-slate-300 text-slate-700 font-bold text-xs h-8">
                {columns.filter(c => c.visible).map((col, idx) => (
                  <th 
                    key={`header-${col.id}`} 
                    className="border-r border-slate-300 px-3 py-1 text-left relative group font-bold tracking-tight bg-slate-100"
                    style={{ width: col.width }}
                  >
                    <div className="truncate" title={col.label}>{col.label}</div>
                    <div 
                      onMouseDown={(e) => handleResizeStart(columns.findIndex(c => c.id === col.id), e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 group-hover:bg-slate-300 transition-colors" 
                    />
                  </th>
                ))}
                <th className="w-20 text-center font-bold px-2 bg-slate-100 text-slate-700">
                  Thao tác
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length + 1} className="py-20 text-center text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-none bg-slate-100 flex items-center justify-center mb-3">
                        <FileSpreadsheet className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 mb-1">Không tìm thấy bản ghi KQTN nào</p>
                      <p className="text-xs text-slate-500 mb-4">Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc đang chọn.</p>
                      {(searchTerm || activeFiltersCount > 0) && (
                        <button
                          onClick={handleClearFilters}
                          className="px-4 py-1.5 bg-emerald-600 text-white rounded-sm text-xs font-bold hover:bg-emerald-700 transition"
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((req, rowIdx) => {
                  const absoluteIndex = startIndex + rowIdx;
                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-emerald-50/40 transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      {columns.filter(c => c.visible).map(col => {
                        const fieldId = col.id;
                        const cellValue = req[fieldId as keyof KQTNRecord];
                        let displayValue = String(cellValue || '');

                        if (fieldId === 'stt') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/60" style={{ width: col.width }}>
                              {absoluteIndex}
                            </td>
                          );
                        }

                        if (fieldId === 'createdAt' || fieldId === 'updatedAt' || fieldId === 'testDate' || fieldId === 'reportDate') {
                          displayValue = cellValue ? formatDateVN(String(cellValue)) : '';
                        }

                        if (fieldId === 'resultPdf') {
                          const inputId = `kqtn-pdf-${req.id}`;
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-2 py-1.5" style={{ width: col.width }}>
                              <div className="flex items-center justify-center gap-1">
                                {req.resultPdf ? (
                                  <>
                                    <button onClick={() => window.open(getKqtnPdfUrl(req.id), '_blank', 'noopener,noreferrer')} className="rounded p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600" title="View PDF"><Eye size={13} /></button>
                                    <a href={getKqtnPdfUrl(req.id, true)} className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-600" title="Download PDF"><Download size={13} /></a>
                                    <label htmlFor={inputId} className="cursor-pointer rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600" title="Replace PDF"><Upload size={13} /><input id={inputId} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => handleUploadPdf(req, event.target.files?.[0])} /></label>
                                  </>
                                ) : (
                                  <label htmlFor={inputId} className={`flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold ${req.isPending ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600 hover:bg-red-100'}`} title={req.isPending ? 'Save KQTN result first' : 'Upload PDF'}>
                                    <Upload size={12} /> Upload
                                    <input id={inputId} type="file" accept="application/pdf,.pdf" disabled={req.isPending} className="hidden" onChange={(event) => handleUploadPdf(req, event.target.files?.[0])} />
                                  </label>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (fieldId === 'sampleCode') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-3 py-1.5 truncate" style={{ width: col.width }} title={displayValue}>
                              {displayValue ? (
                                <span className="font-black font-mono text-[10px] uppercase bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded-none">
                                  {displayValue}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic font-medium text-[10px]">-</span>
                              )}
                            </td>
                          );
                        }

                        if (fieldId === 'sealStamp') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-3 py-1.5 truncate" style={{ width: col.width }} title={displayValue}>
                              {displayValue ? (
                                <span className="font-mono bg-amber-50 text-amber-800 px-1 py-0.5 rounded-none font-bold text-[10px] shadow-2xs" title={displayValue}>
                                  {displayValue}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic font-medium text-[10px]">Chưa niêm phong</span>
                              )}
                            </td>
                          );
                        }

                        if (fieldId === 'version') {
                          const vNum = req.version || 1;
                          const hasHistory = Array.isArray(req.versionHistory) && req.versionHistory.length > 1;
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-3 py-1.5 truncate text-center" style={{ width: col.width }}>
                              <span className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold inline-flex items-center gap-1 ${
                                vNum > 1 
                                  ? 'bg-blue-50 text-blue-700' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {hasHistory && <History size={10} className="text-blue-500" />}
                                v{vNum}
                              </span>
                            </td>
                          );
                        }

                        if (fieldId === 'criteriaType') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 px-3 py-1.5 truncate text-center" style={{ width: col.width }}>
                              {cellValue === 'full' ? (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-none text-[10px] font-bold">Đầy đủ</span>
                              ) : cellValue === 'reduced' ? (
                                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-none text-[10px] font-bold">Rút gọn</span>
                              ) : (
                                <span className="text-slate-300 italic text-[10px]">-</span>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td 
                            key={`cell-${req.id}-${fieldId}`} 
                            className="border-r border-slate-200 px-3 py-1.5 truncate text-slate-700" 
                            style={{ width: col.width }}
                            title={displayValue}
                          >
                            {displayValue || <span className="text-slate-300 italic text-[10px]">-</span>}
                          </td>
                        );
                      })}

                      <td className="w-20 px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedRecordForDetail(req);
                              setDetailActiveTab('overview');
                            }}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Xem chi tiết bản ghi"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEditVersion(req)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Tạo phiên bản sửa đổi mới"
                          >
                            <Edit2 size={14} />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordToDelete(req);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Xóa bản ghi (Admin)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 flex flex-col sm:flex-row items-center justify-between shrink-0 select-none text-xs gap-2 shadow-xs">
        <div className="text-slate-500 font-medium flex items-center gap-3 text-xs">
          <span>
            Hiển thị <span className="font-bold text-slate-800">{startIndex}</span> - <span className="font-bold text-slate-800">{endIndex}</span> trên tổng số <span className="font-bold text-emerald-700">{totalItems}</span> mẫu
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-sm p-0.5 shadow-sm">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 hover:bg-slate-100 rounded-sm text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="px-2 flex items-center gap-1 text-slate-600">
              <span>Trang</span>
              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="bg-slate-100 hover:bg-slate-200 border-none rounded-sm px-1.5 py-0.5 text-xs font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none transition-all"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <span>/ {totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 hover:bg-slate-100 rounded-sm text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-bold">Dòng / trang:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value;
              setPageSize(val === 'ALL' ? 'ALL' : Number(val));
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded-sm px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer"
          >
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </footer>

      {showConfigPanel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md flex flex-col max-h-[85vh] border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">Tùy biến cột hiển thị KQTN</h3>
              </div>
              <button 
                onClick={() => setShowConfigPanel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Tích chọn để bật/tắt cột hoặc di chuyển vị trí cột theo nhu cầu hiển thị của bạn.
              </p>

              {columns.map((col, idx) => (
                <div key={col.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={col.visible}
                      disabled={col.id === 'stt'}
                      onChange={() => toggleColumnVisibility(col.id)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className={`font-semibold ${col.visible ? 'text-slate-800' : 'text-slate-400'}`}>
                      {col.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">({col.width}px)</span>
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveColumn(idx, 'left')}
                      disabled={idx <= 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      title="Chuyển sang trái"
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      onClick={() => moveColumn(idx, 'right')}
                      disabled={idx === 0 || idx >= columns.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      title="Chuyển sang phải"
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-b-2xl">
              <button
                onClick={resetColumnsToDefault}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Khôi phục mặc định
              </button>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-sm text-xs font-bold hover:bg-emerald-700 shadow-xs"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecordForDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-150 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-none bg-emerald-100 flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    Chi Tiết Kết Quả Thử Nghiệm
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2 py-0.5 rounded-none">
                      v{selectedRecordForDetail.version || 1}
                    </span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mt-0.5">
                    <span>Số phiếu YC: <strong className="text-slate-800">{selectedRecordForDetail.requestCode || '-'}</strong></span>
                    <span>•</span>
                    <span>Mã hóa: <strong className="font-mono text-emerald-700 font-bold">{selectedRecordForDetail.sampleCode || '-'}</strong></span>
                    <span>•</span>
                    <span>Tem: <strong className="font-mono text-amber-800 font-bold">{selectedRecordForDetail.sealStamp || '-'}</strong></span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRecordForDetail(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-bold shrink-0">
              <button
                onClick={() => setDetailActiveTab('overview')}
                className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailActiveTab === 'overview'
                    ? 'border-emerald-600 text-emerald-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Info size={14} />
                Tổng quan & Pháp lý
              </button>

              <button
                onClick={() => setDetailActiveTab('results')}
                className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailActiveTab === 'results'
                    ? 'border-emerald-600 text-emerald-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 size={14} />
                Dữ liệu đo đạc
              </button>

              <button
                onClick={() => setDetailActiveTab('history')}
                className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailActiveTab === 'history'
                    ? 'border-emerald-600 text-emerald-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History size={14} />
                Lịch sử phiên bản ({selectedRecordForDetail.versionHistory?.length || 1})
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm bg-slate-50/30">
              {detailActiveTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-sm shadow-xs">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                      <Tag className="w-4 h-4 text-emerald-600" /> Thông tin mẫu thử
                    </h4>
                    <div className="grid grid-cols-[120px_1fr] gap-2 items-start text-xs">
                      <span className="text-slate-500 font-medium">Số phiếu YC:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.requestCode || '-'}</strong>

                      <span className="text-slate-500 font-medium">Số mã hóa:</span> 
                      <strong className="text-emerald-700 font-mono font-bold">{selectedRecordForDetail.sampleCode || '-'}</strong>

                      <span className="text-slate-500 font-medium">Tem niêm phong:</span> 
                      <strong className="text-amber-800 font-mono font-bold">{selectedRecordForDetail.sealStamp || 'Chưa niêm phong'}</strong>

                      <span className="text-slate-500 font-medium">Tên mẫu:</span> 
                      <strong className="text-slate-900 leading-tight">{selectedRecordForDetail.sampleName || '-'}</strong>
                      
                      <span className="text-slate-500 font-medium">Model:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.model || '-'}</strong>
                      
                      <span className="text-slate-500 font-medium">Nhãn hiệu:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.brand || '-'}</strong>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-sm shadow-xs">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                      <Building className="w-4 h-4 text-blue-600" /> Khách hàng & Thử nghiệm
                    </h4>
                    <div className="grid grid-cols-[120px_1fr] gap-2 items-start text-xs">
                      <span className="text-slate-500 font-medium">Khách hàng:</span> 
                      <strong className="text-slate-900 leading-tight">{selectedRecordForDetail.senderUnit || '-'}</strong>

                      <span className="text-slate-500 font-medium">Tiêu chuẩn:</span> 
                      <strong className="text-slate-900 leading-tight">{selectedRecordForDetail.standardTitle || '-'}</strong>

                      <span className="text-slate-500 font-medium">Loại thử:</span> 
                      <span className="font-bold text-slate-800">{selectedRecordForDetail.criteriaType === 'full' ? 'Đầy đủ' : selectedRecordForDetail.criteriaType === 'reduced' ? 'Rút gọn' : '-'}</span>

                      <span className="text-slate-500 font-medium">Ngày thử nghiệm:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.testDate || '-'}</strong>

                      <span className="text-slate-500 font-medium">Ngày báo cáo:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.reportDate || '-'}</strong>
                      
                      <span className="text-slate-500 font-medium">KTV Thử nghiệm:</span> 
                      <strong className="text-slate-900">{selectedRecordForDetail.testerName || '-'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {detailActiveTab === 'results' && (
                <div className="space-y-4">
                  {selectedRecordForDetail.emcData && Object.keys(selectedRecordForDetail.emcData).length > 0 ? (
                    <div className="border border-slate-200 rounded-sm overflow-hidden shadow-xs bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-bold border-r border-slate-200">Hạng mục EMC</th>
                            <th className="py-2 px-3 font-bold">Trạng thái đo kiểm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(selectedRecordForDetail.emcData).map(([key, value]: [string, any], index) => {
                            const labelMap: Record<string, string> = {
                              dienApNhieu: 'Điện áp nhiễu',
                              congSuatNhieu: 'Công suất nhiễu',
                              nhieuLoantTuTuyen: 'Nhiễu loạn từ tuyến',
                              congSuatPhatXa: 'Công suất phát xạ'
                            };
                            let summary = 'Đã có dữ liệu đo';
                            if (Array.isArray(value)) {
                              summary = `${value.length} điểm đo được ghi nhận.`;
                            }
                            return (
                              <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                <td className="py-2 px-3 font-bold text-slate-700 align-top border-r border-slate-100">{labelMap[key] || key}</td>
                                <td className="py-2 px-3 text-slate-600 align-top">{summary}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : selectedRecordForDetail.dayCapDienData && Object.keys(selectedRecordForDetail.dayCapDienData).length > 0 ? (
                    <div className="border border-slate-200 rounded-sm overflow-hidden shadow-xs bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-bold border-r border-slate-200">Hạng mục Dây Cáp Điện</th>
                            <th className="py-2 px-3 font-bold">Kết quả đo kiểm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(selectedRecordForDetail.dayCapDienData).map(([key, value]: [string, any], index) => {
                            const labelMap: Record<string, string> = {
                              dienTroRuotDan: 'Điện trở ruột dẫn',
                              chieuDayCachDien: 'Chiều dày cách điện',
                              chieuDayVoBoc: 'Chiều dày vỏ bọc',
                              dienTroCachDien: 'Điện trở cách điện',
                              dienApKieng: 'Điện áp kiêng',
                              bksTrcLaoHoa_CachDien: 'Độ bền kéo đứt trước lão hóa (Cách điện)',
                              bksTrcLaoHoa_VoBoc: 'Độ bền kéo đứt trước lão hóa (Vỏ bọc)',
                              bksSauLaoHoa_CachDien: 'Độ bền kéo đứt sau lão hóa (Cách điện)',
                              bksSauLaoHoa_VoBoc: 'Độ bền kéo đứt sau lão hóa (Vỏ bọc)'
                            };
                            let summary = 'Đã có dữ liệu đo';
                            if (Array.isArray(value)) {
                              summary = `${value.length} mẫu đo được ghi nhận.`;
                            }
                            return (
                              <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                <td className="py-2 px-3 font-bold text-slate-700 align-top border-r border-slate-100">{labelMap[key] || key}</td>
                                <td className="py-2 px-3 text-slate-600 align-top">{summary}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-200 rounded-sm text-center bg-white">
                      <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-500">Chưa có dữ liệu kết quả đo kiểm đặc thù cho mẫu này.</p>
                    </div>
                  )}
                </div>
              )}

              {detailActiveTab === 'history' && (
                <div className="space-y-3">
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {(selectedRecordForDetail.versionHistory || [{
                      version: selectedRecordForDetail.version || 1,
                      updatedAt: selectedRecordForDetail.updatedAt || selectedRecordForDetail.createdAt,
                      updatedBy: selectedRecordForDetail.updatedBy || selectedRecordForDetail.createdBy,
                      changeNote: 'Khởi tạo kết quả thử nghiệm ban đầu (v1)'
                    }]).map((h, hIdx) => (
                      <div key={hIdx} className="relative">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-600 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        </div>
                        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm">
                              Phiên bản v{h.version}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDateVN(h.updatedAt)}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 mt-1.5">
                            {h.changeNote || 'Cập nhật thông tin'}
                          </p>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <User size={12} className="text-slate-400" />
                            Người thực hiện: <strong className="text-slate-700">{h.updatedBy || 'KTV'}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Lưu lần cuối: {formatDateVN(selectedRecordForDetail.updatedAt || selectedRecordForDetail.createdAt || '')} bởi <strong className="text-slate-700">{selectedRecordForDetail.updatedBy || selectedRecordForDetail.createdBy || 'KTV'}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleOpenEditVersion(selectedRecordForDetail);
                    setSelectedRecordForDetail(null);
                  }}
                  className="px-4 py-2 bg-white text-blue-600 border border-slate-200 hover:border-blue-200 hover:bg-blue-50 rounded-sm text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Edit2 size={13} />
                  Sửa / Tạo version mới
                </button>
                <button
                  onClick={() => setSelectedRecordForDetail(null)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 text-xs font-bold shadow-xs transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recordToEditVersion && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-150 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Tạo Phiên Bản Mới (v{(recordToEditVersion.version || 1) + 1})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Số mã hóa hiện tại: <strong>{recordToEditVersion.sampleCode || recordToEditVersion.reportNo}</strong> (v{recordToEditVersion.version || 1})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRecordToEditVersion(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                  Ghi chú thay đổi / Lý do sửa đổi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editChangeNote}
                  onChange={e => setEditChangeNote(e.target.value)}
                  placeholder="VD: Cập nhật model và bổ sung ngày thử nghiệm theo yêu cầu..."
                  className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Tên mẫu thử</label>
                  <input
                    type="text"
                    value={editSampleName}
                    onChange={e => setEditSampleName(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Model / Kiểu loại</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={e => setEditModel(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Nhãn hiệu</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={e => setEditBrand(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Tem niêm phong</label>
                  <input
                    type="text"
                    list="kqtnSealStampCodesList"
                    value={editSealStamp}
                    onChange={e => setEditSealStamp(e.target.value)}
                    placeholder="VD: IEMM.26/HQA/1291.2A-SP"
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                  <datalist id="kqtnSealStampCodesList">
                    {MAHOA_CODES.map(code => <option key={code} value={code} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Ngày thử nghiệm</label>
                  <input
                    type="text"
                    value={editTestDate}
                    onChange={e => setEditTestDate(e.target.value)}
                    placeholder="VD: 10/08/2026 – 14/08/2026"
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Ngày ra báo cáo</label>
                  <input
                    type="text"
                    value={editReportDate}
                    onChange={e => setEditReportDate(e.target.value)}
                    placeholder="VD: Ngày 15 tháng 08 năm 2026"
                    className="w-full bg-transparent border-b border-slate-300 py-1 px-0 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                onClick={() => setRecordToEditVersion(null)}
                className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveEditedVersion}
                className="px-5 py-2 bg-blue-600 text-white rounded-sm text-xs font-bold hover:bg-blue-700 shadow-xs"
              >
                Lưu phiên bản mới (v{(recordToEditVersion.version || 1) + 1})
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-sm shadow-2xl object-contain" />
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {recordToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-sm flex flex-col p-6 border border-slate-200 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-none bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">Xác nhận xóa bản ghi</h3>
            <p className="text-sm text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa bản ghi KQTN <strong className="text-slate-800">{recordToDelete.reportNo || recordToDelete.sampleCode || 'này'}</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-sm hover:bg-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  deleteKqtnRecord(recordToDelete.id);
                  toast.success('Đã xóa bản ghi KQTN thành công');
                  setRecordToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-sm hover:bg-red-700 shadow-md shadow-red-200 transition-colors"
              >
                Xóa Bản Ghi
              </button>
            </div>
          </div>
        </div>
      )}

      <KqtnBulkPdfUploadModal
        isOpen={showBulkPdfUpload}
        candidates={bulkCandidates}
        onClose={() => setShowBulkPdfUpload(false)}
        onUploaded={handleBulkUploaded}
      />
    </div>
  );
}
// --- End of KQTNView.tsx ---
