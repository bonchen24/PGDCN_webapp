// Author: Gemini
// OS support: Web/Node
// Description: Modal component for detailed synchronization diagnostic logs, cloud timestamp verification, and lot inspection

import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  Database, 
  Cloud,
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Clock, 
  Layers, 
  FileText, 
  Info,
  Server,
  Activity,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../store';
import { SyncDiagnosticReport } from '../types';

interface SyncDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncDiagnosticModal: React.FC<SyncDiagnosticModalProps> = ({ isOpen, onClose }) => {
  const { 
    lastSyncReport, 
    runDetailedSyncDiagnostic, 
    forceReload,
    isLoading,
    syncError,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'diagnosis' | 'comparison' | 'collections'>('diagnosis');
  const [lotSearchQuery, setLotSearchQuery] = useState('1242-26');
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  if (!isOpen) return null;

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      await runDetailedSyncDiagnostic(lotSearchQuery);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleReloadAndDiagnose = async () => {
    setIsDiagnosing(true);
    try {
      await forceReload();
      await runDetailedSyncDiagnostic(lotSearchQuery);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const report = lastSyncReport;

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="sync-diagnostic-modal-backdrop" className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-6 overflow-y-auto">
      <div 
        id="sync-diagnostic-modal-container" 
        className="relative w-full max-w-5xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-h-0 max-h-[calc(100dvh-1rem)] md:max-h-[90vh]"
      >
        {/* Header */}
        <div id="sync-modal-header" className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Nhật Ký & Chẩn Đoán Đồng Bộ Hóa
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Deep Sync Inspector
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Kiểm tra đối chiếu PostgreSQL Server và Bộ nhớ cục bộ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="sync-modal-refresh-btn"
              onClick={handleReloadAndDiagnose}
              disabled={isDiagnosing || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing || isLoading ? 'animate-spin' : ''}`} />
              <span>{isDiagnosing || isLoading ? 'Đang phân tích...' : 'Tải lại & Chẩn đoán'}</span>
            </button>
            <button
              id="sync-modal-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Bar */}
        <div id="sync-modal-summary-bar" className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Lần kiểm tra cuối:</span>
              <span className="font-semibold text-slate-800">
                {report ? formatDateTime(report.timestamp) : 'Chưa chạy chẩn đoán'}
              </span>
            </div>
            {report && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Thời gian xử lý:</span>
                <span className="font-semibold text-slate-800">{report.durationMs}ms</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {report?.postgres.fromCache ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Dữ liệu từ Cache cục bộ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Kết nối trực tiếp PostgreSQL Server
              </span>
            )}

          </div>
        </div>

        {/* Navigation Tabs */}
        <div id="sync-modal-tabs" className="flex border-b border-slate-200 px-6 bg-white gap-2">
          <button
            id="tab-lot-diagnosis"
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'diagnosis'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Chẩn Đoán Đích Danh Lô (Deep Lot Diagnosis)</span>
          </button>

          <button
            id="tab-timestamp-comparison"
            onClick={() => setActiveTab('comparison')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'comparison'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Đối Chiếu Timestamp & Bản Ghi Cloud Mới Nhất</span>
          </button>

          <button
            id="tab-collections-metric"
            onClick={() => setActiveTab('collections')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'collections'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Chi Tiết Bộ Sưu Tập (PostgreSQL Collections)</span>
          </button>

        </div>

        {/* Content Body */}
        <div id="sync-modal-body" className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 bg-slate-50/50 space-y-6">
          {/* TAB 1: LOT DIAGNOSIS */}
          {activeTab === 'diagnosis' && (
            <div id="tab-content-lot-diagnosis" className="space-y-6">
              {/* Search Box */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Nhập Số Lô hoặc Mã Phiếu Yêu Cầu cần kiểm tra:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={lotSearchQuery}
                      onChange={(e) => setLotSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunDiagnostic()}
                      placeholder="Ví dụ: 1242-26, 1142-26, 0478-26, PYC..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>{isDiagnosing ? 'Đang kiểm tra...' : 'Kiểm Tra Ngay'}</span>
                  </button>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <span className="text-[11px] text-slate-500">Mẫu tra cứu nhanh:</span>
                  {['1242-26', '1142-26', '0478-26', '0898-26'].map((sample) => (
                    <button
                      key={sample}
                      onClick={() => {
                        setLotSearchQuery(sample);
                        runDetailedSyncDiagnostic(sample);
                      }}
                      className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagnosis Output Card */}
              {report?.lotDiagnosis ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                      <span>KẾT QUẢ CHẨN ĐOÁN CHO TỪ KHÓA:</span>
                      <span className="font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md text-xs">
                        {report.lotDiagnosis.targetQuery}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Status Badges Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
                        report.lotDiagnosis.foundInPostgresServer
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>PostgreSQL Server</span>
                          {report.lotDiagnosis.foundInPostgresServer ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {report.lotDiagnosis.foundInPostgresServer ? 'Đã tìm thấy (Live)' : 'Không có trên Server'}
                        </span>
                      </div>

                      <div className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
                        report.lotDiagnosis.foundInLocal
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Bộ Nhớ Máy (Local)</span>
                          {report.lotDiagnosis.foundInLocal ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {report.lotDiagnosis.foundInLocal ? 'Đã có trong Store' : 'Chưa có trong Store'}
                        </span>
                      </div>

                      <div className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
                        report.lotDiagnosis.isDeleted
                          ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Trạng Thái Xóa</span>
                          {report.lotDiagnosis.isDeleted ? (
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {report.lotDiagnosis.isDeleted ? 'Đang bị đánh dấu XÓA' : 'Hợp lệ (Chưa xóa)'}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Diagnosis Text */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                            Phân tích nguyên nhân:
                          </div>
                          <div className="text-sm font-medium leading-relaxed text-slate-100">
                            {report.lotDiagnosis.diagnosis}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-start gap-2.5">
                        <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                            Đề xuất hành động:
                          </div>
                          <div className="text-xs font-medium leading-relaxed text-slate-300">
                            {report.lotDiagnosis.suggestedAction}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matched Record Details if Found */}
                    {report.lotDiagnosis.matchedRecord && (
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          Thông tin bản ghi tìm thấy:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Số Lô / Mã Hóa:</span>
                            <span className="font-bold font-mono text-indigo-600">
                              {report.lotDiagnosis.matchedRecord.encodeNumber || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Mã Phiếu Yêu Cầu (PYC):</span>
                            <span className="font-bold text-slate-900">
                              {report.lotDiagnosis.matchedRecord.requestCode || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Tên Mẫu Thử:</span>
                            <span className="font-semibold text-slate-900 truncate block">
                              {report.lotDiagnosis.matchedRecord.sampleName || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Khách Hàng:</span>
                            <span className="font-semibold text-slate-900 truncate block">
                              {report.lotDiagnosis.matchedRecord.customerName || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Ngày Tiếp Nhận:</span>
                            <span className="font-semibold text-slate-900">
                              {report.lotDiagnosis.matchedRecord.requestDate || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block">Nguồn Nạp Dữ Liệu:</span>
                            <span className="font-bold text-emerald-600">
                              {report.lotDiagnosis.matchedRecord.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có kết quả chẩn đoán</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nhập số lô cần kiểm tra và nhấn nút "Kiểm Tra Ngay" để quét dữ liệu
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMESTAMP & LATEST RECORDS */}
          {activeTab === 'comparison' && (
            <div id="tab-content-comparison" className="space-y-6">
              {/* Header Timestamp Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-indigo-500" />
                      Bộ nhớ máy cục bộ (Local Store)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {report?.comparison.localTotalRequests || 0} Phiếu
                    </span>
                  </div>

                  {report?.comparison.localLatestRequest ? (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mã PYC mới nhất:</span>
                        <span className="font-bold text-slate-900">{report.comparison.localLatestRequest.requestCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số Lô:</span>
                        <span className="font-bold font-mono text-indigo-600">{report.comparison.localLatestRequest.encodeNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tên mẫu:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[200px]">{report.comparison.localLatestRequest.sampleName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời gian tạo/sửa:</span>
                        <span className="font-medium text-slate-900">
                          {formatDateTime(report.comparison.localLatestRequest.updatedAt || report.comparison.localLatestRequest.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Không có dữ liệu cục bộ</p>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-emerald-500" />
                      PostgreSQL Server
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {report?.comparison.cloudTotalRequests || 0} Phiếu
                    </span>
                  </div>

                  {report?.comparison.cloudLatestRequest ? (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mã PYC mới nhất:</span>
                        <span className="font-bold text-slate-900">{report.comparison.cloudLatestRequest.requestCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số Lô:</span>
                        <span className="font-bold font-mono text-emerald-600">{report.comparison.cloudLatestRequest.encodeNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tên mẫu:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[200px]">{report.comparison.cloudLatestRequest.sampleName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời gian tạo/sửa:</span>
                        <span className="font-medium text-slate-900">
                          {formatDateTime(report.comparison.cloudLatestRequest.updatedAt || report.comparison.cloudLatestRequest.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Không có dữ liệu trên PostgreSQL</p>
                  )}
                </div>
              </div>

              {/* 10 Most Recent Cloud Requests Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    Danh Sách 10 Bản Ghi Mới Nhất Trên PostgreSQL
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Sắp xếp theo thời gian tạo/cập nhật</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Số Lô</th>
                        <th className="px-4 py-2.5">Mã Phiếu (PYC)</th>
                        <th className="px-4 py-2.5">Tên Mẫu Thử</th>
                        <th className="px-4 py-2.5">Khách Hàng</th>
                        <th className="px-4 py-2.5">Cập Nhật Lúc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report?.comparison.recentCloudRequests && report.comparison.recentCloudRequests.length > 0 ? (
                        report.comparison.recentCloudRequests.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-2.5 font-bold font-mono text-indigo-600">
                              {item.encodeNumber || '—'}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {item.requestCode || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 max-w-[220px] truncate">
                              {item.sampleName || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-[180px] truncate">
                              {item.customerName || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-medium">
                              {formatDateTime(item.updatedAt || item.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                            Chưa có dữ liệu bản ghi nào trên PostgreSQL
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLLECTIONS METRICS */}
          {activeTab === 'collections' && (
            <div id="tab-content-collections" className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Số lượng tài liệu trong các Collection của PostgreSQL
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {[
                    { label: 'Phiếu Yêu Cầu (requests)', count: report?.postgres.collections.requests || 0, color: 'indigo' },
                    { label: 'Biên Bản Bàn Giao (handoverDocs)', count: report?.postgres.collections.handoverDocs || 0, color: 'blue' },
                    { label: 'Khách Hàng (customers)', count: report?.postgres.collections.customers || 0, color: 'emerald' },
                    { label: 'Sản Phẩm (products)', count: report?.postgres.collections.products || 0, color: 'cyan' },
                    { label: 'Nhãn Hiệu (brands)', count: report?.postgres.collections.brands || 0, color: 'amber' },
                    { label: 'Người Dùng Hệ Thống (systemUsers)', count: report?.postgres.collections.systemUsers || 0, color: 'purple' },
                    { label: 'Cấu Hình Hệ Thống (systemConfig)', count: report?.postgres.collections.systemConfig || 0, color: 'slate' },
                    { label: 'Hồ Sơ KQTN (kqtnRecords)', count: report?.postgres.collections.kqtnRecords || 0, color: 'teal' },
                    { label: 'Thông Báo (notifications)', count: report?.postgres.collections.notifications || 0, color: 'rose' },
                  ].map((col, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                      <span className="text-xs font-medium text-slate-600">{col.label}</span>
                      <span className="text-xl font-bold font-mono text-slate-900 mt-2">{col.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div id="sync-modal-footer" className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Hệ thống tự động đồng bộ PostgreSQL 2 chiều qua REST API (Realtime Two-way Sync)
          </div>
          <div className="flex items-center gap-2">
            <button
              id="sync-modal-btn-close-bottom"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Đóng
            </button>
            <button
              id="sync-modal-btn-run-diag-bottom"
              onClick={handleReloadAndDiagnose}
              disabled={isDiagnosing || isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing || isLoading ? 'animate-spin' : ''}`} />
              <span>Nạp lại toàn bộ & Chẩn đoán</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- End of components/SyncDiagnosticModal.tsx ---
