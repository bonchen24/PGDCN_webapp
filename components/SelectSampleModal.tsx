// Author: Gemini
// OS support: Web/Node
// Description: Modal chọn và lọc nhanh mẫu thử nghiệm để tự động điền thông tin báo cáo

import React, { useState, useMemo } from 'react';
import { Search, X, Check, Filter, Tag, User, Box, Calendar } from 'lucide-react';
import { TestRequest } from '../types';
import { useStore } from '../store';

interface SelectSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sample: TestRequest) => void;
}

export default function SelectSampleModal({ isOpen, onClose, onSelectSample }: SelectSampleModalProps) {
  const requests = useStore(state => state.requests);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const term = searchTerm.toLowerCase().trim();
      const code = String(req.requestCode || '').toLowerCase();
      const encode = String(
        req.atdEncodeNumber || 
        req.emcEncodeNumber || 
        req.itdEncodeNumber || 
        req.encodeNumber || ''
      ).toLowerCase();
      const model = String(req.modelName || '').toLowerCase();
      const type = String(req.type || '').toLowerCase();
      const brand = String(req.brand || '').toLowerCase();
      const customer = String(req.customerName || '').toLowerCase();
      const tester = String(req.testerName || '').toLowerCase();
      const seal = String(req.sealStamp || '').toLowerCase();

      const matchesSearch = !term || 
        code.includes(term) || 
        encode.includes(term) || 
        seal.includes(term) || 
        model.includes(term) || 
        type.includes(term) || 
        brand.includes(term) || 
        customer.includes(term) ||
        tester.includes(term);

      const matchesCategory = categoryFilter === 'ALL' || req.testCategory === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [requests, searchTerm, categoryFilter, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-1rem)] md:max-h-[85vh] flex flex-col min-h-0 overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-[#1b4332] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <Box className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="font-bold text-base leading-snug">Chọn Mẫu Thử Nghiệm</h3>
              <p className="text-xs text-emerald-200/80">Tìm kiếm và lọc nhanh thông tin mẫu thử nghiệm từ danh sách</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-3 shrink-0">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Tìm theo Mã PYC, Mã mã hóa, Tên mẫu, Model, Nhãn hiệu, Khách hàng..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <select 
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-700 font-medium shadow-sm"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="An toàn điện">An toàn điện</option>
              <option value="Tương thích điện từ">Tương thích điện từ</option>
              <option value="Cả An toàn điện và EMC">Cả ATĐ và EMC</option>
            </select>

            <select 
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-700 font-medium shadow-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Đã nhận mẫu">Đã nhận mẫu</option>
              <option value="Đã xếp lịch">Đã xếp lịch</option>
              <option value="Đang thử nghiệm">Đang thử nghiệm</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Pending">Chờ tiếp nhận</option>
            </select>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 min-h-[300px]">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
              <Box size={48} className="stroke-1 mb-2 text-slate-300" />
              <p className="text-sm font-medium">Không tìm thấy mẫu thử nghiệm nào phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredRequests.map(req => {
                const encodeNum = req.atdEncodeNumber || req.emcEncodeNumber || req.itdEncodeNumber || req.encodeNumber || 'Chưa mã hóa';
                return (
                  <div 
                    key={req.id}
                    className="p-4 bg-white border border-slate-200 hover:border-emerald-600 hover:shadow-md rounded-xl transition cursor-pointer group flex flex-col justify-between"
                    onClick={() => {
                      onSelectSample(req);
                      onClose();
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-[#1b4332] group-hover:text-emerald-700 transition">
                            {req.requestCode}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-semibold border border-emerald-200">
                            {encodeNum}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {req.status}
                        </span>
                      </div>

                      <h4 className="font-semibold text-slate-800 text-sm mb-1 line-clamp-1">
                        {req.type || req.modelName || 'Mẫu thử nghiệm'}
                      </h4>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-600 mt-2">
                        <div className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Model: <strong>{req.modelName || 'N/A'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Box className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Nhãn hiệu: <strong>{req.brand || 'N/A'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 col-span-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Đơn vị: <strong>{req.customerName || 'N/A'}</strong></span>
                        </div>
                        {req.sealStamp && (
                          <div className="flex items-center gap-1 col-span-2">
                            <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">Tem niêm phong: <strong className="font-mono text-amber-800 font-bold">{req.sealStamp}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 col-span-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Ngày nhận: {req.receivedDate || req.requestDate || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-400 text-[11px]">
                        {req.testerName ? `KTV: ${req.testerName}` : 'Chưa phân công KTV'}
                      </span>
                      <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1 text-xs">
                        Chọn mẫu <Check size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0 text-xs text-slate-500">
          <span>Hiển thị <strong>{filteredRequests.length}</strong> / <strong>{requests.length}</strong> mẫu thử nghiệm</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}

// --- End of SelectSampleModal.tsx ---
