// Author: Gemini
// OS support: Web/Node
// Description: Handover document management modal listing existing documents with quick search by model, customer, or other info

import React, { useState } from 'react';
import { X, FileText, Search, Eye, FileSignature, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { HandoverDoc, HandoverType } from '../types';
import { formatDateVN, removeAccents } from '../utils/formatter';

interface HandoverDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (doc: HandoverDoc) => void;
  onDeleteDoc?: (doc: HandoverDoc) => void;
}

export const HandoverDocsModal = ({ isOpen, onClose, onSelectDoc, onDeleteDoc }: HandoverDocsModalProps) => {
  const { handoverDocs, requests, currentUser } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const q = removeAccents(String(searchQuery || '')).toLowerCase();
  const filteredDocs = handoverDocs
    .filter(doc => {
      const matchDoc = removeAccents(String(doc.docNumber || '')).toLowerCase().includes(q);
      const matchCustomer = removeAccents(String(doc.customerName || '')).toLowerCase().includes(q);
      
      if (matchDoc || matchCustomer) return true;

      if (Array.isArray(doc.sampleIds)) {
        const relatedRequests = doc.sampleIds.map(id => requests.find(r => r.id === id)).filter(Boolean);
        return relatedRequests.some(r => 
          removeAccents(String(r?.modelName || '')).toLowerCase().includes(q) ||
          removeAccents(String(r?.otherCustomerInfo || '')).toLowerCase().includes(q) ||
          removeAccents(String(r?.note || '')).toLowerCase().includes(q) ||
          removeAccents(String(r?.specifications || '')).toLowerCase().includes(q)
        );
      }
      return false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center p-2 md:p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] md:h-[90vh] md:max-h-[90vh] rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FileSignature size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 truncate">Quản Lý Biên Bản Giao Nhận</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">Danh sách các biên bản giao nhận mẫu đã tạo</p>
            </div>
          </div>
          <button onClick={onClose} className="mobile-touch-target shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Đóng danh sách biên bản">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-white border-b border-slate-100 shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:max-w-md">
            <Search className="absolute left-3 top-2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm theo Số BB, Tên khách hàng hoặc Tên model..."
              className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto">
            Tổng số: <span className="text-blue-600">{filteredDocs.length}</span> biên bản
          </div>
        </div>

        {/* Data Table */}
        <div className="mobile-scroll-x flex-1 min-h-0 overflow-y-auto bg-slate-50/50 p-3">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
              <FileText size={48} className="text-slate-300" />
              <p className="text-sm font-medium">Không tìm thấy biên bản nào phù hợp.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-[720px] w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">Số BB</th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">Loại</th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">Ngày Lập</th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">Đơn vị / Khách hàng</th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200 text-center">Số Mẫu</th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocs.map(doc => {
                    const sampleTypes = Array.isArray(doc.sampleIds) ? Array.from(new Set(doc.sampleIds.map(id => requests.find(r => r.id === id)?.type).filter(Boolean))) : [];
                    
                    return (
                      <tr key={doc.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="p-3 text-sm font-bold text-slate-800 whitespace-nowrap">{doc.docNumber}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${doc.type === HandoverType.RECEIVE ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                            {doc.type === HandoverType.RECEIVE ? 'Nhận Mẫu' : 'Trả Mẫu'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-600 whitespace-nowrap">{formatDateVN(new Date(doc.date))}</td>
                        <td className="p-3">
                          <div className="text-sm font-bold text-slate-700 line-clamp-2">{doc.customerName}</div>
                          {sampleTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sampleTypes.map((type, idx) => (
                                <span key={idx} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {String(type)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm font-bold text-slate-600 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 group-hover:bg-white group-hover:shadow-sm transition-all">
                            {Array.isArray(doc.sampleIds) ? doc.sampleIds.length : 0}
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              onSelectDoc(doc);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Eye size={14} /> Chi tiết
                          </button>
                          {onDeleteDoc && currentUser?.role === 'admin' && (
                            <button
                              onClick={() => onDeleteDoc(doc)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 rounded-lg text-xs font-bold transition-all shadow-sm"
                              title="Xóa biên bản này"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- End of components/HandoverDocsModal.tsx ---
