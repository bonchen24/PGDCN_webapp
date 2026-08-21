// Author: Gemini
// OS support: Web/Node
// Description: SummaryLogView component displaying test requests logs summary table with customized columns and filtering

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, Sliders, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Eye, EyeOff, Edit2, Copy, Trash2, RefreshCw, Sliders as FilterIcon, HelpCircle,
  Undo2, Redo2, Plus, ArrowLeft, ArrowRight
} from 'lucide-react';
import { useStore } from '../store';
import { 
  TestRequest, RequestStatus, SampleStatus, TestCategory, MachineType
} from '../types';
import { formatDateVN, removeAccents } from '../utils/formatter';
import { toast } from 'sonner';

interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'stt', label: '#', width: 40, visible: true },
  { id: 'requestDate', label: 'Ngày yêu cầu', width: 110, visible: true },
  { id: 'requestCode', label: 'Số phiếu yêu cầu', width: 120, visible: true },
  { id: 'customerName', label: 'Tên khách hàng', width: 160, visible: true },
  { id: 'otherCustomerInfo', label: 'Thông tin khác', width: 160, visible: true },
  { id: 'modelName', label: 'Ký hiệu Model', width: 150, visible: true },
  { id: 'brand', label: 'Nhãn hiệu', width: 110, visible: true },
  { id: 'quantity', label: 'Số lượng mẫu', width: 90, visible: true },
  { id: 'sealStamp', label: 'Tem niêm phong', width: 120, visible: true },
  { id: 'testCategory', label: 'Phân loại', width: 90, visible: true },
  { id: 'type', label: 'Loại sản phẩm', width: 130, visible: true },
  { id: 'testCriteria', label: 'Chỉ tiêu thử nghiệm', width: 150, visible: true },
  { id: 'itdEncodeNumber', label: 'Số lô ITD', width: 130, visible: true },
  { id: 'emcEncodeNumber', label: 'Số lô EMC', width: 130, visible: true },
  { id: 'atdEncodeNumber', label: 'Số lô ITDC', width: 130, visible: true },
  { id: 'status', label: 'Trạng thái phiếu', width: 130, visible: true },
  { id: 'sampleStatus', label: 'Trạng thái mẫu', width: 110, visible: true },
  { id: 'retryCount', label: 'Số lần Fail', width: 95, visible: true },
  { id: 'testerName', label: 'Người thử nghiệm', width: 140, visible: true },
  { id: 'receivedDate', label: 'Ngày nhận mẫu', width: 110, visible: true },
  { id: 'scheduledDate', label: 'Ngày thử nghiệm', width: 120, visible: true },
  { id: 'returnDate', label: 'Ngày trả mẫu thực tế', width: 130, visible: true },
  { id: 'returnRecipient', label: 'Người nhận mẫu', width: 130, visible: true },
  { id: 'returnDocNo', label: 'Số biên bản trả', width: 120, visible: true },
  { id: 'printStatus', label: 'Trạng thái in', width: 100, visible: true },
  { id: 'note', label: 'Ghi chú', width: 180, visible: true }
];

function SummaryLogView() {
  const { 
    requests, testers, currentUser, updateRequest
  } = useStore();

  const isAdmin = currentUser?.role === 'admin';

    const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const isColumnsLoaded = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    const storageKey = `lab_summary_log_cols_${currentUser.username}`;
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
    } else {
        // Fallback to legacy key if no user-specific key exists
        const legacySaved = localStorage.getItem('lab_summary_log_cols_v2');
        if (legacySaved) {
            try {
                const parsed = JSON.parse(legacySaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const merged = DEFAULT_COLUMNS.map(defCol => {
                        const found = parsed.find((p: any) => p.id === defCol.id);
                        if (found) {
                            return { ...defCol, width: typeof found.width === 'number' ? found.width : defCol.width, visible: typeof found.visible === 'boolean' ? found.visible : defCol.visible };
                        }
                        return defCol;
                    });
                    setColumns(merged);
                }
            } catch (e) {}
        }
    }
    isColumnsLoaded.current = true;
  }, [currentUser]);

    useEffect(() => {
    if (isColumnsLoaded.current && currentUser) {
      const storageKey = `lab_summary_log_cols_${currentUser.username}`;
      localStorage.setItem(storageKey, JSON.stringify(columns));
    }
  }, [columns, currentUser]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('ALL');
  const [sampleStatusFilter, setSampleStatusFilter] = useState<'ALL' | SampleStatus>('ALL');
  const [testerFilter, setTesterFilter] = useState<'ALL' | string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TestCategory>('ALL');
  const [productTypeFilter, setProductTypeFilter] = useState<'ALL' | string>('ALL');
  const [monthFilter, setMonthFilter] = useState<'ALL' | string>('ALL');
  const [lotFilter, setLotFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'LOT_ASC' | 'LOT_DESC'>('NEWEST');

  const [showFilters, setShowFilters] = useState(false);

  const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const availableTesters = useMemo(() => {
    const names = new Set(testers.map(t => t.name));
    requests.forEach(r => {
      const tName = r.testerName || (r as any).tester;
      if (tName && tName !== 'Khác' && tName !== 'Chưa giao') {
        names.add(tName);
      }
    });
    return Array.from(names).map(name => {
      const t = testers.find(x => x.name === name);
      return t || { name, shortName: name.split(' ').pop() || name, colorClass: 'bg-slate-100 text-slate-700 border-slate-300 font-bold' };
    });
  }, [testers, requests]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (sampleStatusFilter !== 'ALL') count++;
    if (testerFilter !== 'ALL') count++;
    if (categoryFilter !== 'ALL') count++;
    if (productTypeFilter !== 'ALL') count++;
    if (monthFilter !== 'ALL') count++;
    if (lotFilter.trim() !== '') count++;
    return count;
  }, [statusFilter, sampleStatusFilter, testerFilter, categoryFilter, productTypeFilter, monthFilter, lotFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sampleStatusFilter, testerFilter, categoryFilter, productTypeFilter, monthFilter, lotFilter, sortOrder, pageSize]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setSampleStatusFilter('ALL');
    setTesterFilter('ALL');
    setCategoryFilter('ALL');
    setProductTypeFilter('ALL');
    setMonthFilter('ALL');
    setLotFilter('');
    setSortOrder('NEWEST');
    toast.success("Đã xóa tất cả bộ lọc");
  };

  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const [editingCell, setEditingCell] = useState<{ rowId: string, colId: keyof TestRequest } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleResizeStart = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columns[index].width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          width: Math.max(30, startWidth + deltaX)
        };
        return updated;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleColumnVisibility = (id: string) => {
    if (id === 'stt') return;
    setColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const moveColumn = (index: number, direction: 'left' | 'right') => {
    if (index === 0 && direction === 'left') return; 
    
    setColumns(prev => {
      const nextIndex = direction === 'left' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      if (prev[nextIndex].id === 'stt' || prev[index].id === 'stt') return prev;

      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[nextIndex];
      updated[nextIndex] = temp;
      return updated;
    });
  };

  const getColLetter = (index: number): string => {
    let temp = index;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  const handleCellDoubleClick = (rowId: string, colId: keyof TestRequest, currentValue: any) => {
    if (!isAdmin) return;
    if (colId === 'printStatus') return;
    setEditingCell({ rowId, colId });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  };

  const handleSaveCell = (rowId: string, colId: keyof TestRequest) => {
    if (!editingCell) return;
    
    let typedValue: any = editValue;
    if (colId === 'quantity' || colId === 'retryCount') {
      const num = Number(editValue);
      typedValue = isNaN(num) ? 0 : num;
    } else if (colId === 'priority') {
      const num = Number(editValue);
      typedValue = isNaN(num) || num < 1 || num > 4 ? 1 : num;
    }

    const currentReq = requests.find(r => r.id === rowId);
    if (colId === 'sampleStatus' && typedValue === SampleStatus.WAITING && currentReq?.scheduledDate) {
      const confirmUnschedule = window.confirm(
        `CẢNH BÁO: Mẫu "${currentReq.modelName}" (Phiếu ${currentReq.requestCode}) đã được xếp lịch thử nghiệm ngày ${currentReq.scheduledDate}.\n\nChuyển trạng thái về 'Chờ nhận mẫu' sẽ HỦY LỊCH THỬ NGHIỆM và rút mẫu khỏi hàng chờ. Bạn có chắc chắn muốn thực hiện?`
      );
      if (!confirmUnschedule) {
        setEditingCell(null);
        return;
      }
    }

    updateRequest(rowId, { [colId]: typedValue });
    setEditingCell(null);
    toast.success("Đã lưu thay đổi ô tính");
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, colId: keyof TestRequest) => {
    if (e.key === 'Enter') {
      handleSaveCell(rowId, colId);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      if (req.id.includes('-log-')) return false;
      const q = removeAccents(searchTerm).toLowerCase().trim();
      let matchesSearch = true;
      if (q) {
        const reqCode = removeAccents(req.requestCode || '').toLowerCase();
        const custName = removeAccents(req.customerName || '').toLowerCase();
        const otherCust = removeAccents(req.otherCustomerInfo || '').toLowerCase();
        const tester = removeAccents(req.testerName || (req as any).tester || '').toLowerCase();
        const modelName = removeAccents(req.modelName || '').toLowerCase();
        const brand = removeAccents(req.brand || '').toLowerCase();
        const seal = removeAccents(req.sealStamp || '').toLowerCase();
        const testCrit = removeAccents(req.testCriteria || '').toLowerCase();
        const atdNo = removeAccents(req.atdEncodeNumber || '').toLowerCase();
        const emcNo = removeAccents(req.emcEncodeNumber || '').toLowerCase();
        const itdNo = removeAccents(req.itdEncodeNumber || '').toLowerCase();
        const encodeNo = removeAccents(req.encodeNumber || '').toLowerCase();
        const returnRec = removeAccents(req.returnRecipient || '').toLowerCase();
        const returnDoc = removeAccents(req.returnDocNo || '').toLowerCase();

        matchesSearch = reqCode.includes(q) || 
                        custName.includes(q) || 
                        otherCust.includes(q) ||
                         tester.includes(q) || 
                        modelName.includes(q) || 
                        brand.includes(q) || 
                        seal.includes(q) || 
                        testCrit.includes(q) ||
                        atdNo.includes(q) || 
                        emcNo.includes(q) || 
                        itdNo.includes(q) ||
                        encodeNo.includes(q) ||
                        returnRec.includes(q) ||
                        returnDoc.includes(q);
      }

      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesSample = sampleStatusFilter === 'ALL' || req.sampleStatus === sampleStatusFilter;
      const matchesTester = testerFilter === 'ALL' || (req.testerName || (req as any).tester) === testerFilter;
      const matchesCategory = categoryFilter === 'ALL' || req.testCategory === categoryFilter;
      const matchesProductType = productTypeFilter === 'ALL' || req.type === productTypeFilter;

      let matchesMonth = true;
      if (monthFilter !== 'ALL') {
          if (req.requestDate) {
              const d = new Date(req.requestDate);
              if (!isNaN(d.getTime())) {
                  const reqMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  matchesMonth = reqMonth === monthFilter;
              } else {
                  matchesMonth = false;
              }
          } else {
              matchesMonth = false;
          }
      }

      let matchesLot = true;
      if (lotFilter.trim()) {
        const lotVal = removeAccents(lotFilter).toLowerCase().trim();
        const atdNo = removeAccents(req.atdEncodeNumber || '').toLowerCase();
        const emcNo = removeAccents(req.emcEncodeNumber || '').toLowerCase();
        const itdNo = removeAccents(req.itdEncodeNumber || '').toLowerCase();
        const encodeNo = removeAccents(req.encodeNumber || '').toLowerCase();
        matchesLot = atdNo.includes(lotVal) || emcNo.includes(lotVal) || itdNo.includes(lotVal) || encodeNo.includes(lotVal);
      }

      return matchesSearch && matchesStatus && matchesSample && matchesTester && matchesCategory && matchesProductType && matchesMonth && matchesLot;
    });

    const getLotNumber = (req: TestRequest) => {
      const encode = req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || '';
      if (!encode) return '';
      return encode.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '').trim();
    };

    const parseLot = (lot: string) => {
      const parts = lot.split('-');
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        return Number(parts[1]) * 100000 + Number(parts[0]);
      }
      return lot;
    };

    return filtered.sort((a, b) => {
      if (sortOrder === 'NEWEST') {
        const dateA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
        const dateB = b.requestDate ? new Date(b.requestDate).getTime() : 0;
        return dateB - dateA;
      }
      if (sortOrder === 'OLDEST') {
        const dateA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
        const dateB = b.requestDate ? new Date(b.requestDate).getTime() : 0;
        return dateA - dateB;
      }
      if (sortOrder === 'LOT_ASC' || sortOrder === 'LOT_DESC') {
        const lotA = getLotNumber(a);
        const lotB = getLotNumber(b);
        const valA = parseLot(lotA);
        const valB = parseLot(lotB);

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'LOT_ASC' ? valA - valB : valB - valA;
        } else {
          return sortOrder === 'LOT_ASC' 
            ? String(valA).localeCompare(String(valB)) 
            : String(valB).localeCompare(String(valA));
        }
      }
      return 0;
    });
  }, [requests, searchTerm, statusFilter, sampleStatusFilter, testerFilter, categoryFilter, productTypeFilter, monthFilter, lotFilter, sortOrder]);

  const uniqueProductTypes = useMemo<string[]>(() => {
    return Array.from(new Set(requests.filter(r => !r.id.includes('-log-')).map(r => r.type as string).filter(Boolean))).sort();
  }, [requests]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    requests.forEach(req => {
      if (req.id.includes('-log-')) return;
      if (req.requestDate) {
        const d = new Date(req.requestDate);
        if (!isNaN(d.getTime())) {
          months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    });
    return Array.from(months).sort().reverse();
  }, [requests]);

  const totalItems = filteredRequests.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalItems / (pageSize as number));

  const paginatedRequests = useMemo(() => {
    if (pageSize === 'ALL') return filteredRequests;
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * (pageSize === 'ALL' ? 0 : (pageSize as number)) + 1;
  const endIndex = pageSize === 'ALL' ? totalItems : Math.min(totalItems, currentPage * (pageSize as number));

  console.log("SummaryLogView columns:", columns.map(c => c.id).join(', '));
  const exportToCSV = () => {
    try {
      const visibleCols = columns.filter(c => c.id !== 'stt' && c.visible);
      const headers = visibleCols.map(c => c.label);
      const rows = filteredRequests.map((req, rIdx) => {
        return visibleCols.map(col => {
          const field = col.id as keyof TestRequest;
          const val = (field as string === 'testerName' || field as string === 'tester') ? (req.testerName || (req as any).tester) : req[field];
          if (val === null || val === undefined) return '';
          if (field === 'requestDate' || field === 'receivedDate' || field === 'returnDate' || field === 'scheduledDate') {
            return formatDateVN(String(val));
          }
          if (field === 'priority') {
            const pMap = { 1: 'Thường', 2: 'Cao', 3: 'VIP', 4: 'Khẩn Cấp' };
            return pMap[val as 1 | 2 | 3 | 4] || 'Thường';
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
      link.setAttribute("download", `So_Tong_Hop_Phong_Lab_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Xuất file Excel/CSV thành công!");
    } catch (e: any) {
      toast.error("Lỗi xuất file: " + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <div className="border-b border-slate-200 px-4 py-2 bg-slate-50 shrink-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-emerald-500" />
              Bảng dữ liệu Sổ tổng hợp
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-2 py-0.5 rounded-full select-none">
              Realtime Cloud DB
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button 
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
              title="Ẩn hiện & Thay đổi vị trí cột của bảng"
            >
              <SlidersHorizontal size={12} className="text-slate-500" />
              <span>Cấu hình cột</span>
            </button>

            <button 
              onClick={exportToCSV}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm cursor-pointer"
              title="Tải toàn bộ dữ liệu đang hiển thị về máy tính dưới định dạng file CSV"
            >
              <Download size={12} />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mt-1">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm transition-all text-slate-700" 
              placeholder="Tìm nhanh model, mã phiếu, nhãn hiệu, tem, chỉ tiêu, mã hóa, người TN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="NEWEST">SẮP XẾP: MỚI NHẤT</option>
                <option value="OLDEST">SẮP XẾP: CŨ NHẤT</option>
                <option value="LOT_ASC">SỐ LÔ: TĂNG DẦN</option>
                <option value="LOT_DESC">SỐ LÔ: GIẢM DẦN</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase border transition-all ${
                showFilters || activeFiltersCount > 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={13} className={activeFiltersCount > 0 ? 'text-emerald-600 stroke-[2.5]' : ''} />
              <span>Bộ lọc nâng cao</span>
              {activeFiltersCount > 0 && (
                <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {(activeFiltersCount > 0 || searchTerm) && (
              <button 
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-black uppercase transition-all"
                title="Xóa tất cả bộ lọc đang kích hoạt"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 animate-in fade-in-50 slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Trạng thái thử nghiệm</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">TẤT CẢ TRẠNG THÁI</option>
                  {Object.values(RequestStatus).map(s => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Trạng thái mẫu thử</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={sampleStatusFilter}
                  onChange={(e) => setSampleStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">TẤT CẢ TRẠNG THÁI</option>
                  {Object.values(SampleStatus).map(s => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Người thử nghiệm</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={testerFilter}
                  onChange={(e) => setTesterFilter(e.target.value)}
                >
                  <option value="ALL">TẤT CẢ NGƯỜI TN</option>
                  {availableTesters.map(t => (
                    <option key={t.name} value={t.name}>{t.name.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Phân loại phòng thử</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                >
                  <option value="ALL">TẤT CẢ PHÂN LOẠI</option>
                  {Object.values(TestCategory).map(c => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Loại sản phẩm</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={productTypeFilter}
                  onChange={(e) => setProductTypeFilter(e.target.value)}
                >
                  <option value="ALL">TẤT CẢ LOẠI SẢN PHẨM</option>
                  {uniqueProductTypes.map(pt => (
                    <option key={pt} value={pt}>{pt.toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Thời gian tạo phiếu</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700 appearance-none pr-8 cursor-pointer"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="ALL">TẤT CẢ THỜI GIAN</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>Tháng {m.split('-')[1]}/{m.split('-')[0]}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Lọc số lô tăng/giảm</label>
              <input
                type="text"
                placeholder="Nhập số lô cần lọc..."
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm text-slate-700"
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {showConfigPanel && (
        <div className="absolute top-28 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in slide-in-from-top-4 duration-200 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-blue-500" />
              Cấu hình hiển thị cột
            </span>
            <button 
              onClick={() => setShowConfigPanel(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold"
            >
              Đóng
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {columns.map((col, idx) => (
              <div 
                key={col.id} 
                className={`flex items-center justify-between p-1.5 rounded-lg border text-[10px] font-semibold ${col.visible ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-100/30 border-slate-200/50 opacity-60'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button 
                    onClick={() => toggleColumnVisibility(col.id)}
                    className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                    disabled={col.id === 'stt'}
                  >
                    {col.visible ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} />}
                  </button>
                  <span className="truncate font-bold text-slate-700">{col.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {col.id !== 'stt' && (
                    <>
                      <button 
                        onClick={() => moveColumn(idx, 'left')} 
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        disabled={idx <= 1}
                        title="Dịch sang trái"
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button 
                        onClick={() => moveColumn(idx, 'right')} 
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        disabled={idx === columns.length - 1}
                        title="Dịch sang phải"
                      >
                        <ArrowRight size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 italic text-center leading-relaxed">
            * Kéo rê chuột trên vạch phân chia đầu cột của bảng tính để tùy chỉnh thủ công độ rộng của từng cột theo nhu cầu.
          </p>
        </div>
      )}

      <div className="mobile-scroll-x flex-1 min-w-0 overflow-y-auto bg-slate-100 relative">
        <div className="inline-block min-w-full">
          <table className="min-w-max border-collapse table-fixed bg-white text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 h-6 border-b border-slate-200">
                <th className="w-10 bg-slate-100 border-r border-slate-200 text-center sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.02)]"></th>
                {columns.map((col, idx) => {
                  if (!col.visible) return null;
                  return (
                    <th 
                      key={`head-letter-${col.id}`} 
                      style={{ width: col.width }}
                      className="border-r border-slate-200 bg-slate-100 text-center uppercase tracking-wide relative px-1 font-bold select-none text-[9px]"
                    >
                      {getColLetter(idx)}
                    </th>
                  );
                })}
              </tr>

              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 h-10 border-b border-slate-200 shadow-sm">
                <th className="w-10 bg-slate-100 border-r border-slate-200 text-center sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                  #
                </th>
                
                {columns.map((col, idx) => {
                  if (!col.visible) return null;
                  return (
                    <th 
                      key={`head-label-${col.id}`} 
                      style={{ width: col.width }}
                      className="border-r border-slate-200 px-3 relative align-middle uppercase text-[10px] tracking-wider select-none font-bold bg-slate-50 text-slate-600 group"
                    >
                      <div className="flex items-center justify-between gap-1 w-full truncate">
                        <span className="truncate">{col.label}</span>
                        {col.id !== 'stt' && (
                          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                            <button onClick={() => moveColumn(idx, 'left')} disabled={idx <= 1} className="p-0.5 hover:bg-slate-200 rounded text-slate-400"><ChevronUp size={10} className="-rotate-90" /></button>
                            <button onClick={() => moveColumn(idx, 'right')} disabled={idx === columns.length - 1} className="p-0.5 hover:bg-slate-200 rounded text-slate-400"><ChevronUp size={10} className="rotate-90" /></button>
                          </div>
                        )}
                      </div>

                      <div 
                        onMouseDown={(e) => handleResizeStart(idx, e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 bg-transparent transition-colors z-10"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {paginatedRequests.map((req, rIdx) => {
                const isEven = rIdx % 2 === 0;
                const displayRowIdx = pageSize === 'ALL' ? rIdx + 1 : (currentPage - 1) * (pageSize as number) + rIdx + 1;
                return (
                  <tr 
                    key={req.id} 
                    className={`h-9 border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    <td className="bg-slate-100 border-r border-slate-200 text-center sticky left-0 font-bold text-slate-400 text-[9px] select-none z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      {displayRowIdx}
                    </td>

                    {columns.map((col) => {
                      if (!col.visible) return null;

                      if (col.id === 'stt') {
                        return (
                          <td 
                            key={`cell-${req.id}-stt`} 
                            style={{ width: col.width }}
                            className="border-r border-slate-200 text-center px-1 text-[11px] font-black text-slate-400 select-none bg-slate-50/50"
                          >
                            {displayRowIdx}
                          </td>
                        );
                      }

                      const fieldId = col.id as keyof TestRequest;
                      const cellValue = req[fieldId];
                      const isEditingThisCell = editingCell && editingCell.rowId === req.id && editingCell.colId === fieldId;

                      const onDblClick = () => handleCellDoubleClick(req.id, fieldId, cellValue);

                      if (isEditingThisCell) {
                        if (fieldId === 'status') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                              <select 
                                autoFocus
                                className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 py-0 text-[11px] font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveCell(req.id, fieldId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(req.id, fieldId);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              >
                                {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          );
                        }

                        if (fieldId === 'sampleStatus') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                              <select 
                                autoFocus
                                className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 py-0 text-[11px] font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveCell(req.id, fieldId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(req.id, fieldId);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              >
                                {Object.values(SampleStatus).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          );
                        }

                        if (fieldId === 'testCategory') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                              <select 
                                autoFocus
                                className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 py-0 text-[11px] font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveCell(req.id, fieldId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(req.id, fieldId);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              >
                                {Object.values(TestCategory).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                          );
                        }

                        if (fieldId === 'type') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                              <select 
                                autoFocus
                                className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 py-0 text-[11px] font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveCell(req.id, fieldId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(req.id, fieldId);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              >
                                {Object.values(MachineType).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                          );
                        }

                        if (fieldId === 'testerName') {
                          return (
                            <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                              <select 
                                autoFocus
                                className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 py-0 text-[11px] font-bold"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveCell(req.id, fieldId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(req.id, fieldId);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              >
                                <option value="">Chưa phân công</option>
                                {availableTesters.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                              </select>
                            </td>
                          );
                        }

                        return (
                          <td key={`cell-${req.id}-${fieldId}`} className="border-r border-slate-200 p-0" style={{ width: col.width }}>
                            <input 
                              autoFocus
                              type={fieldId === 'quantity' || fieldId === 'retryCount' ? 'number' : 'text'}
                              className="w-full h-full border-none outline-none focus:ring-1 focus:ring-blue-500 bg-white px-2 text-[11px] font-bold"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveCell(req.id, fieldId)}
                              onKeyDown={(e) => handleKeyDown(e, req.id, fieldId)}
                            />
                          </td>
                        );
                      }

                      let cellContent: React.ReactNode = null;
                      let customCellClass = "px-3 truncate py-1 text-[11px] font-medium text-slate-700 relative select-none cursor-text group/cell";

                      if (fieldId === 'printStatus') {
                        const isPrinted = !!cellValue && cellValue !== 'Chờ in';
                        cellContent = (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isPrinted) {
                                const today = new Date();
                                const mm = String(today.getMonth() + 1).padStart(2, '0');
                                const dd = String(today.getDate()).padStart(2, '0');
                                updateRequest(req.id, { printStatus: `Đã in ${dd}/${mm}` });
                              } else {
                                updateRequest(req.id, { printStatus: 'Chờ in' });
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase transition-colors cursor-pointer w-full text-center ${
                              isPrinted 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs' 
                                : 'bg-slate-100 text-slate-500 border-slate-200/80 hover:bg-slate-200'
                            }`}
                            title={isPrinted ? `Trạng thái in: ${cellValue} (Click để đổi thành Chờ in)` : 'Click để đánh dấu Đã in'}
                          >
                            {isPrinted ? String(cellValue) : 'Chờ in'}
                          </button>
                        );
                      } else if (cellValue !== null && cellValue !== undefined) {
                        if (fieldId === 'status') {
                          const statusColors: Record<RequestStatus, string> = {
                            [RequestStatus.PENDING]: 'bg-yellow-50 text-yellow-700 border-yellow-200/50',
                            [RequestStatus.APPROVED]: 'bg-blue-50 text-blue-700 border-blue-200/50',
                            [RequestStatus.SAMPLES_RECEIVED]: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
                            [RequestStatus.SCHEDULED]: 'bg-sky-50 text-sky-700 border-sky-200/50',
                            [RequestStatus.TESTING]: 'bg-orange-50 text-orange-700 border-orange-200/50',
                            [RequestStatus.RESULTS_SUBMITTED]: 'bg-pink-50 text-pink-700 border-pink-200/50',
                            [RequestStatus.RESULTS_APPROVED]: 'bg-teal-50 text-teal-700 border-teal-200/50',
                            [RequestStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
                            [RequestStatus.CANCELLED]: 'bg-slate-100 text-slate-500 border-slate-200',
                            [RequestStatus.REQ_SUPPLEMENT]: 'bg-red-50 text-red-600 border-red-200',
                          };
                          cellContent = (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${statusColors[cellValue as RequestStatus] || 'bg-slate-100 text-slate-600'}`}>
                              {String(cellValue)}
                            </span>
                          );
                        } else if (fieldId === 'sampleStatus') {
                          const sampleColors: Record<SampleStatus, string> = {
                            [SampleStatus.WAITING]: 'bg-status-waiting text-status-waiting-fg border-status-waiting-fg/20',
                            [SampleStatus.IN_LAB]: 'bg-status-inlab text-status-inlab-fg border-status-inlab-fg/20',
                            [SampleStatus.RETURNED]: 'bg-status-returned text-status-returned-fg border-status-returned-fg/20',
                          };
                          cellContent = (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-tight ${sampleColors[cellValue as SampleStatus] || 'bg-slate-100 text-slate-600'}`}>
                              {String(cellValue)}
                            </span>
                          );
                        } else if (fieldId === 'retryCount') {
                          const count = req.retryCount || 0;
                          cellContent = (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAdmin) return;
                                const val = window.prompt(`[Admin] Sửa số lần test Fail (tích tụ) cho mẫu ${req.modelName}:`, String(count));
                                if (val !== null) {
                                  const num = parseInt(val, 10);
                                  if (!isNaN(num) && num >= 0) {
                                    updateRequest(req.id, { retryCount: num });
                                    toast.success(`Đã cập nhật số lần test Fail = ${num}`);
                                  } else {
                                    toast.error("Vui lòng nhập số nguyên không âm (>= 0)");
                                  }
                                }
                              }}
                              className={`px-2 py-0.5 rounded-full font-black text-[10px] transition-all ${
                                count > 0 
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 cursor-pointer' 
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 cursor-pointer'
                              }`}
                              title={isAdmin ? `Click để Admin thay đổi số lần Fail (${count})` : `Số lần Fail: ${count}`}
                            >
                              {count}
                            </button>
                          );
                        } else if (fieldId === 'priority') {
                          const pMap = { 1: 'Thường', 2: 'Cao', 3: 'VIP', 4: 'Khẩn Cấp' };
                          const pColors = { 1: 'text-slate-500 bg-slate-50 border-slate-200', 2: 'text-orange-600 bg-orange-50 border-orange-150', 3: 'text-purple-600 bg-purple-50 border-purple-150 font-black', 4: 'text-red-600 bg-red-50 border-red-150 font-black animate-pulse' };
                          const pNum = Number(cellValue) as 1 | 2 | 3 | 4;
                          cellContent = (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase ${pColors[pNum] || 'bg-slate-50 text-slate-600'}`}>
                              {pMap[pNum] || 'Thường'}
                            </span>
                          );
                        } else if (fieldId === 'testCategory') {
                          const catColors: Record<TestCategory, string> = {
                            [TestCategory.ATD]: 'bg-blue-50 text-blue-700 border-blue-200',
                            [TestCategory.EMC]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            [TestCategory.BOTH]: 'bg-purple-50 text-purple-700 border-purple-200',
                          };
                          cellContent = (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${catColors[cellValue as TestCategory] || 'bg-slate-100 text-slate-600'}`}>
                              {String(cellValue)}
                            </span>
                          );
                        } else if (fieldId === 'requestCode') {
                          cellContent = <span className="font-bold text-slate-800">{String(cellValue)}</span>;
                        } else if (fieldId === 'customerName') {
                          cellContent = <span className="font-bold text-slate-800" title={String(cellValue)}>{String(cellValue)}</span>;
                        } else if (fieldId === 'modelName') {
                          cellContent = (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-800 truncate" title={String(cellValue)}>{String(cellValue)}</span>
                              {req.isNewSampleNoPYC && (
                                <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1 py-0 rounded border border-amber-200 uppercase tracking-wider shrink-0 animate-pulse">
                                  Chưa PYC
                                </span>
                              )}
                            </span>
                          );
                        } else if (fieldId === 'sealStamp') {
                          cellContent = cellValue ? (
                            <span className="font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold" title={String(cellValue)}>
                              {String(cellValue)}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic font-medium text-[10px]">Chưa niêm phong</span>
                          );
                        } else if (fieldId === 'testCriteria') {
                          cellContent = cellValue ? (
                            <span className="font-bold text-slate-800" title={String(cellValue)}>
                              {String(cellValue)}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic font-medium text-[10px]">-</span>
                          );
                        } else if (fieldId === 'requestDate' || fieldId === 'receivedDate' || fieldId === 'returnDate' || fieldId === 'scheduledDate') {
                          cellContent = <span className="font-medium text-slate-500">{cellValue ? formatDateVN(String(cellValue)) : ''}</span>;
                        } else if (fieldId === 'atdEncodeNumber' && cellValue) {
                          cellContent = <span className="font-black font-mono text-[10px] uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/50">{String(cellValue)}</span>;
                        } else if (fieldId === 'emcEncodeNumber' && cellValue) {
                          cellContent = <span className="font-black font-mono text-[10px] uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200/50">{String(cellValue)}</span>;
                        } else if (fieldId === 'itdEncodeNumber' && cellValue) {
                          cellContent = <span className="font-black font-mono text-[10px] uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200/50">{String(cellValue)}</span>;
                        } else if (fieldId === 'quantity') {
                          cellContent = <span className="font-black text-slate-800">{String(cellValue)}</span>;
                        } else if (fieldId as string === 'testerName' || fieldId as string === 'tester') {
                          const actualTesterName = req.testerName || (req as any).tester || cellValue;
                          const tester = availableTesters.find(t => t.name === actualTesterName) || testers.find(t => t.name === actualTesterName);
                          cellContent = actualTesterName ? (
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border ${tester?.colorClass || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                              {String(actualTesterName)}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">Chưa phân công</span>
                          );
                        } else {
                          cellContent = <span className="truncate" title={String(cellValue)}>{String(cellValue)}</span>;
                        }
                      }

                      return (
                        <td 
                          key={`cell-${req.id}-${fieldId}`} 
                          style={{ width: col.width }}
                          onDoubleClick={onDblClick}
                          className={`${customCellClass} border-r border-slate-200 hover:bg-slate-100/30 transition-colors h-9 relative group`}
                        >
                          <div className="flex items-center justify-between w-full h-full overflow-hidden">
                            <div className="truncate flex-1 pr-1">{cellContent}</div>
                            <div className="opacity-0 group-hover/cell:opacity-100 flex items-center shrink-0 ml-1 absolute right-1 bg-white/90 shadow-sm border border-slate-150 rounded">
                              {cellValue !== null && cellValue !== undefined && cellValue !== '' && fieldId !== 'printStatus' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    let textToCopy = String(cellValue);
                                    if (fieldId === 'requestDate' || fieldId === 'receivedDate' || fieldId === 'returnDate' || fieldId === 'scheduledDate') {
                                      textToCopy = formatDateVN(String(cellValue));
                                    } else if (fieldId === 'priority') {
                                      const pMap = { 1: 'Thường', 2: 'Cao', 3: 'VIP', 4: 'Khẩn Cấp' };
                                      textToCopy = pMap[Number(cellValue) as 1 | 2 | 3 | 4] || 'Thường';
                                    } else if (fieldId === 'testCategory') {
                                      const cMap = { [TestCategory.ATD]: 'ATD', [TestCategory.EMC]: 'EMC', [TestCategory.BOTH]: 'Cả 2' };
                                      textToCopy = cMap[cellValue as TestCategory] || String(cellValue);
                                    } else if (fieldId === 'status') {
                                      textToCopy = String(cellValue); 
                                    }
                                    navigator.clipboard.writeText(textToCopy);
                                    toast.success(`Đã copy: ${textToCopy}`);
                                  }}
                                  className={`p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer ${isAdmin ? 'border-r border-slate-100 rounded-r-none' : ''}`}
                                  title="Copy nội dung"
                                >
                                  <Copy size={10} />
                                </button>
                              )}
                              {isAdmin && fieldId !== 'printStatus' && (
                                <button 
                                  onClick={onDblClick}
                                  className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                  title="Kích đúp chuột để sửa trực tiếp"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length + 1} className="py-16 text-center text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HelpCircle size={40} className="text-slate-200 stroke-[1.5]" />
                      <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Không tìm thấy mẫu nào khớp với bộ lọc của bạn</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-bold text-slate-500">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="flex items-center gap-1.5">
            Hiển thị <b className="text-slate-800 font-extrabold text-xs">{startIndex}-{endIndex}</b> trên <b className="text-slate-800 font-extrabold text-xs">{totalItems}</b> mẫu tìm thấy (Tổng {requests.filter(r => !r.id.includes('-log-')).length} mẫu)
          </span>
          <button
            onClick={() => useStore.getState().loadMoreRequests()}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded transition-colors cursor-pointer text-xs"
            title="Tải thêm 50 mẫu cũ hơn từ máy chủ"
          >
            <RefreshCw className="w-3 h-3" />
            Tải thêm mẫu cũ
          </button>
          <span className="hidden md:inline text-slate-300">|</span>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wide flex items-center gap-1 font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Quản lý
              </span>
            ) : (
              <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wide flex items-center gap-1 font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Xem chỉ đọc
              </span>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center cursor-pointer"
              title="Trang đầu"
            >
              <ChevronLeft className="w-4 h-4 -mr-1.5" />
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-2 flex items-center gap-1 text-slate-600">
              <span>Trang</span>
              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="bg-slate-100 hover:bg-slate-200 border-none rounded px-1.5 py-0.5 text-xs font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none transition-all"
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
              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center cursor-pointer"
              title="Trang cuối"
            >
              <ChevronRight className="w-4 h-4" />
              <ChevronRight className="w-4 h-4 -ml-1.5" />
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
            }}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer"
          >
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default SummaryLogView;
// --- End of SummaryLogView.tsx ---
