// Author: Gemini
// OS support: Web/Node
// Description: Modal quản lý và cập nhật các biểu mẫu Word (.docx) cho các module lập báo cáo

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Search, 
  FileText, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Flame, 
  Wind, 
  Coffee, 
  Thermometer, 
  Zap, 
  Shirt, 
  Snowflake, 
  Activity, 
  Plug, 
  Box, 
  Shield, 
  FileCog,
  FileCheck2,
  HardDrive,
  Clock,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_TEMPLATES_CATALOG, ReportTemplateMetadata, TemplateCategory } from '../lib/reportTemplatesCatalog';

interface DocxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getTemplateIcon = (standardId: string) => {
  switch (standardId) {
    case 'toaster': return <Flame className="w-5 h-5 text-orange-500" strokeWidth={1.75} />;
    case 'iron': return <Wind className="w-5 h-5 text-blue-500" strokeWidth={1.75} />;
    case 'rice_cooker': return <Coffee className="w-5 h-5 text-amber-600" strokeWidth={1.75} />;
    case 'fan': return <Wind className="w-5 h-5 text-cyan-500" strokeWidth={1.75} />;
    case 'storage_heater':
    case 'instant_heater': return <Thermometer className="w-5 h-5 text-red-500" strokeWidth={1.75} />;
    case 'hair_dryer': return <Wind className="w-5 h-5 text-pink-500" strokeWidth={1.75} />;
    case 'microwave': return <Box className="w-5 h-5 text-indigo-500" strokeWidth={1.75} />;
    case 'emc_bep_dien': return <Flame className="w-5 h-5 text-orange-600" strokeWidth={1.75} />;
    case 'emc_dieu_hoa': return <Snowflake className="w-5 h-5 text-blue-400" strokeWidth={1.75} />;
    case 'emc_may_giat': return <Shirt className="w-5 h-5 text-cyan-600" strokeWidth={1.75} />;
    case 'emc_may_hut_bui': return <Zap className="w-5 h-5 text-yellow-500" strokeWidth={1.75} />;
    case 'emc_may_khoan': return <Activity className="w-5 h-5 text-slate-600" strokeWidth={1.75} />;
    case 'emc_may_say_toc': return <Wind className="w-5 h-5 text-pink-400" strokeWidth={1.75} />;
    case 'emc_may_xay': return <Coffee className="w-5 h-5 text-stone-600" strokeWidth={1.75} />;
    case 'emc_tu_lanh': return <Snowflake className="w-5 h-5 text-blue-300" strokeWidth={1.75} />;
    case 'emc_dung_cu_dien_dun_nuoc_nong': return <Thermometer className="w-5 h-5 text-red-400" strokeWidth={1.75} />;
    case 'day_cap_dien': return <Plug className="w-5 h-5 text-green-600" strokeWidth={1.75} />;
    case 'general_pyc': return <FileText className="w-5 h-5 text-indigo-600" strokeWidth={1.75} />;
    case 'general_bmgn': return <FileCheck2 className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />;
    default: return <Shield className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return 'Chưa cập nhật';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Chưa cập nhật';
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Chưa cập nhật';
  }
};

export const DocxSettingsModal: React.FC<DocxSettingsModalProps> = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState<ReportTemplateMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [resettingFilename, setResettingFilename] = useState<string | null>(null);
  const [dragOverFilename, setDragOverFilename] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTemplates(json.data);
      } else {
        // Fallback to static catalog if backend returns empty
        setTemplates(
          REPORT_TEMPLATES_CATALOG.map(t => ({
            ...t,
            size: 0,
            updatedAt: '',
            exists: true,
            hasBackup: false,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch templates metadata:', err);
      toast.error('Không thể tải danh sách biểu mẫu!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        t.standardName.toLowerCase().includes(q) ||
        t.deviceName.toLowerCase().includes(q) ||
        t.variantName.toLowerCase().includes(q) ||
        t.filename.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleDownload = (filename: string) => {
    const url = `/api/templates/${encodeURIComponent(filename)}/download`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Đang tải xuống biểu mẫu: ${filename}`);
  };

  const handleUploadFile = async (targetFilename: string, file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Vui lòng chỉ tải lên tệp định dạng Word (.docx)!');
      return;
    }

    setUploadingFilename(targetFilename);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', targetFilename);

      const res = await fetch('/api/templates/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Đã cập nhật biểu mẫu ${targetFilename} thành công!`);
        // Refresh templates metadata
        await fetchTemplates();
      } else {
        toast.error(`Lỗi cập nhật biểu mẫu: ${result.error || 'Thao tác thất bại'}`);
      }
    } catch (err: any) {
      console.error('Upload template failed:', err);
      toast.error('Có lỗi xảy ra khi tải lên biểu mẫu!');
    } finally {
      setUploadingFilename(null);
    }
  };

  const handleReset = async (filename: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khôi phục biểu mẫu gốc cho "${filename}"?`)) {
      return;
    }

    setResettingFilename(filename);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(filename)}/reset`, {
        method: 'POST',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Đã khôi phục biểu mẫu gốc: ${filename}`);
        await fetchTemplates();
      } else {
        toast.error(`Lỗi khôi phục: ${result.error || 'Không tìm thấy bản sao lưu gốc'}`);
      }
    } catch (err) {
      console.error('Reset template failed:', err);
      toast.error('Có lỗi xảy ra khi khôi phục biểu mẫu!');
    } finally {
      setResettingFilename(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFilename(filename);
  };

  const handleDragLeave = (e: React.DragEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFilename === filename) {
      setDragOverFilename(null);
    }
  };

  const handleDrop = (e: React.DragEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFilename(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleUploadFile(filename, file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-5xl h-[92vh] max-h-[850px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileCog className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">Cài Đặt & Quản Lý Biểu Mẫu DOCX</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {templates.length} biểu mẫu
                </span>
              </div>
              <p className="text-xs text-slate-300">Quản lý, tải về và cập nhật file Word (.docx) template cho từng tiêu chuẩn thử nghiệm</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Tìm theo tiêu chuẩn, chủng loại thiết bị, tên file .docx..."
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-xs text-slate-700 placeholder-slate-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'atd', label: 'An toàn điện' },
              { key: 'emc', label: 'EMC' },
              { key: 'cable', label: 'Dây cáp điện' },
              { key: 'general', label: 'PYC / BMGN' },
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shadow-2xs ${
                  selectedCategory === cat.key
                    ? 'bg-[#1b4332] text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition shadow-2xs disabled:opacity-50 ml-1"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content / Template List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100/60">
          {loading && templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-sm font-medium">Đang tải danh sách biểu mẫu...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Không tìm thấy biểu mẫu nào khớp với tìm kiếm</p>
              <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa hoặc bộ lọc danh mục</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTemplates.map(item => {
                const isUploading = uploadingFilename === item.filename;
                const isResetting = resettingFilename === item.filename;
                const isDragOver = dragOverFilename === item.filename;

                return (
                  <div
                    key={item.id}
                    onDragOver={e => handleDragOver(e, item.filename)}
                    onDragLeave={e => handleDragLeave(e, item.filename)}
                    onDrop={e => handleDrop(e, item.filename)}
                    className={`bg-white rounded-xl border p-3.5 transition-all shadow-xs flex flex-col justify-between relative ${
                      isDragOver
                        ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/50 scale-[1.01]'
                        : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Top Row: Icon + Standard Info */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                            {getTemplateIcon(item.standardId)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {item.standardName}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                item.variantName.includes('Đầy đủ')
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.variantName.includes('Giảm')
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {item.variantName}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-600 truncate mt-0.5">
                              {item.deviceName}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* File Details */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-y-1">
                        <div className="flex items-center gap-1 font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] truncate max-w-[240px]">
                          <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{item.filename}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="flex items-center gap-1 text-slate-500">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(item.size)}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400" title={`Ngày sửa đổi: ${formatDateTime(item.updatedAt)}`}>
                            <Clock className="w-3 h-3" />
                            {item.updatedAt ? formatDateTime(item.updatedAt) : 'Mặc định'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleDownload(item.filename)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                        title="Tải biểu mẫu hiện tại về máy tính"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Tải về</span>
                      </button>

                      {/* Hidden File Input */}
                      <input
                        type="file"
                        accept=".docx"
                        className="hidden"
                        ref={el => {
                          fileInputRefs.current[item.filename] = el;
                        }}
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleUploadFile(item.filename, e.target.files[0]);
                            e.target.value = '';
                          }
                        }}
                      />

                      <button
                        onClick={() => fileInputRefs.current[item.filename]?.click()}
                        disabled={isUploading}
                        className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-[0.98] disabled:opacity-50"
                        title="Tải lên tệp .docx mới thay thế biểu mẫu này"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Cập nhật</span>
                          </>
                        )}
                      </button>

                      {item.hasBackup && (
                        <button
                          onClick={() => handleReset(item.filename)}
                          disabled={isResetting}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center transition active:scale-[0.98] disabled:opacity-50"
                          title="Khôi phục về biểu mẫu gốc mặc định"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-rose-500' : ''}`} />
                        </button>
                      )}
                    </div>

                    {isDragOver && (
                      <div className="absolute inset-0 bg-emerald-600/90 text-white rounded-xl flex flex-col items-center justify-center z-10 animate-in fade-in duration-150">
                        <Upload className="w-8 h-8 mb-1 animate-bounce" />
                        <p className="text-xs font-bold uppercase tracking-wider">Thả file .docx vào đây để cập nhật</p>
                        <p className="text-[10px] text-emerald-100 mt-0.5">{item.filename}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Mẹo: Bạn có thể kéo & thả file <strong>.docx</strong> trực tiếp vào từng thẻ để cập nhật nhanh.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocxSettingsModal;

// --- End of components/DocxSettingsModal.tsx ---
