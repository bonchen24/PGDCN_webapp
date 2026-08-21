// Author: Gemini
// OS support: Web/Node
// Description: Sidebar displaying warehouse sample inventory list with searching and filtering
import React, { useState, useMemo } from 'react';
import { Package, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useStore } from '../store';
import { SampleStatus, RequestStatus } from '../types';
import { calculateInternalDeadline } from '../utils/scheduler';
import { removeAccents } from '../utils/formatter';

export const WarehouseSidebar = () => {
  const { requests } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const activeRequests = useMemo(() => {
    return requests.filter(r => !r.id.includes('-log-') && r.sampleStatus !== SampleStatus.RETURNED);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = removeAccents(searchQuery).toLowerCase().trim();
    const cleanQ = q.replace(/^(lô|lo)\s+/i, '');
    return activeRequests.filter(req => {
      const model = removeAccents(String(req.modelName || '')).toLowerCase();
      const code = removeAccents(String(req.requestCode || '')).toLowerCase();
      const encode = removeAccents(String(req.encodeNumber || '')).toLowerCase();
      const atdEncode = removeAccents(String(req.atdEncodeNumber || '')).toLowerCase();
      const emcEncode = removeAccents(String(req.emcEncodeNumber || '')).toLowerCase();
      const itdEncode = removeAccents(String(req.itdEncodeNumber || '')).toLowerCase();
      const seal = removeAccents(String(req.sealStamp || '')).toLowerCase();
      const customer = removeAccents(String(req.customerName || '')).toLowerCase();
      const product = removeAccents(String(req.type || '')).toLowerCase();
      const brand = removeAccents(String(req.brand || '')).toLowerCase();

      const rawLot = req.encodeNumber || 
        [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber]
          .map(e => e ? e.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '') : '')
          .find(Boolean) || '';
      const lot = removeAccents(rawLot.toLowerCase());

      const matchesSearch = !q ||
                            model.includes(q) || 
                            code.includes(q) || (cleanQ !== '' && code.includes(cleanQ)) ||
                            encode.includes(q) || (cleanQ !== '' && encode.includes(cleanQ)) ||
                            atdEncode.includes(q) || (cleanQ !== '' && atdEncode.includes(cleanQ)) ||
                            emcEncode.includes(q) || (cleanQ !== '' && emcEncode.includes(cleanQ)) ||
                            itdEncode.includes(q) || (cleanQ !== '' && itdEncode.includes(cleanQ)) ||
                            seal.includes(q) || (cleanQ !== '' && seal.includes(cleanQ)) ||
                            customer.includes(q) ||
                            product.includes(q) ||
                            brand.includes(q) ||
                            (lot !== '' && (lot.includes(q) || (cleanQ !== '' && lot.includes(cleanQ))));

      const matchesStatus = statusFilter === 'ALL' || req.sampleStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeRequests, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <aside className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-fit sticky top-4 flex flex-col max-h-[calc(100vh-2rem)]" aria-labelledby="warehouse-title">
      <h3 id="warehouse-title" className="text-[11px] font-black uppercase text-slate-800 mb-3 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-2"><Package size={16} aria-hidden="true" className="text-blue-600"/> Kho mẫu hiện tại</span>
        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] border border-blue-100" aria-label="Số lượng mẫu trong kho">
          Tổng: {filteredRequests.reduce((acc, r) => acc + (Number(r.quantity) || 1), 0)} mẫu ({filteredRequests.length} phiếu)
        </span>
      </h3>

      <div className="shrink-0 space-y-2 mb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Tìm theo mã, tên, số lô..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] py-1 px-2 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value={SampleStatus.WAITING}>Chờ thử</option>
            <option value={SampleStatus.IN_LAB}>Đang thử</option>
          </select>
        </div>
      </div>
      
      {/* Container có scrollbar */}
      <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0 relative" role="list">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Package size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-medium">Không tìm thấy mẫu</p>
          </div>
        ) : (
          currentItems.map(req => {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const deadline = calculateInternalDeadline(req);
            const isOverdue = deadline ? (deadline < today && req.status !== RequestStatus.COMPLETED && req.status !== RequestStatus.RESULTS_APPROVED) : false;
            
            let badgeColor = "bg-slate-100 text-slate-600";
            if (req.sampleStatus === SampleStatus.WAITING) badgeColor = "bg-amber-100 text-amber-700";
            if (req.sampleStatus === SampleStatus.IN_LAB) badgeColor = "bg-emerald-100 text-emerald-700";

            return (
            <div key={req.id} className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-colors group ${isOverdue ? 'bg-red-50/30 border-red-200 hover:bg-red-50' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-blue-200 hover:shadow-sm'}`} role="listitem">
              <div className="flex items-start justify-between gap-2"> 
                <div className="flex-1 min-w-0"> 
                  <div className={`text-[11px] font-bold leading-tight line-clamp-2 ${isOverdue ? 'text-red-700' : 'text-slate-800'} flex items-center gap-1.5`}>
                    <span className="truncate">{req.modelName}</span>
                    {req.isNewSampleNoPYC && (
                      <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1 py-0 rounded border border-amber-200 uppercase tracking-wider shrink-0 animate-pulse">
                        Chưa PYC
                      </span>
                    )}
                  </div> 
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-black bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase">
                      {req.requestCode}
                    </span>
                    {req.type && (
                      <span className="text-[9px] font-bold text-slate-500 uppercase">
                        {req.type}
                      </span>
                    )}
                  </div>
                </div> 
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                    SL: {req.quantity || 1}
                  </span>
                  {isOverdue && <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded uppercase shadow-sm animate-pulse">Trễ hạn</span>} 
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100/80">
                  <div className="flex gap-1">
                    {(req.atdEncodeNumber || req.itdEncodeNumber || req.emcEncodeNumber) ? (
                      <>
                        {req.atdEncodeNumber && <span className="text-[8px] font-black text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded" title="ITDC">ITDC</span>}
                        {req.itdEncodeNumber && <span className="text-[8px] font-black text-purple-700 bg-purple-100 px-1 py-0.5 rounded" title="ITD">ITD</span>}
                        {req.emcEncodeNumber && <span className="text-[8px] font-black text-blue-700 bg-blue-100 px-1 py-0.5 rounded" title="EMC">EMC</span>}
                      </>
                    ) : (
                      <span className="text-[8px] text-slate-400 italic">Chưa mã hóa</span>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${badgeColor}`}>
                    {req.sampleStatus === SampleStatus.WAITING ? 'Chờ thử' : 
                    req.sampleStatus === SampleStatus.IN_LAB ? 'Đang thử' : 'Chưa nhận'}
                  </span>
              </div>
            </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
          <span className="text-[10px] text-slate-500 font-medium">
            {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRequests.length)} / {filteredRequests.length}
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-bold text-slate-700 px-2 bg-slate-50 rounded-md py-0.5">
              {currentPage}/{totalPages}
            </span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

// --- End of WarehouseSidebar.tsx ---
