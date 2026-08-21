import fs from 'fs';
let code = fs.readFileSync('components/KQTNView.tsx', 'utf8');

const target = `                              title="Xóa bản ghi (      <footer className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 flex flex-col sm:flex-row items-center justify-between shrink-0 select-none text-xs gap-2 shadow-xs">        <div className="text-slate-500 font-medium flex items-center gap-3 text-xs">          <span>            Hiển thị <span className="font-bold text-slate-800">{startIndex}</span> - <span className="font-bold text-slate-800">{endIndex}</span> trên tổng số <span className="font-bold text-emerald-700">{totalItems}</span> mẫu          </span>        </div>        {totalPages > 1 && (          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">            <button              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}              disabled={currentPage === 1}              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"              title="Trang trước"            >              <ChevronLeft className="w-4 h-4" />            </button>                        <div className="px-2 flex items-center gap-1 text-slate-600">              <span>Trang</span>              <select                value={currentPage}                onChange={(e) => setCurrentPage(Number(e.target.value))}                className="bg-slate-100 hover:bg-slate-200 border-none rounded px-1.5 py-0.5 text-xs font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer outline-none transition-all"              >                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (                  <option key={p} value={p}>{p}</option>                ))}              </select>              <span>/ {totalPages}</span>            </div>            <button              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}              disabled={currentPage === totalPages}              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center cursor-pointer"              title="Trang sau"            >              <ChevronRight className="w-4 h-4" />            </button>          </div>        )}        <div className="flex items-center gap-1.5">          <span className="text-[11px] text-slate-400 font-bold">Dòng / trang:</span>          <select            value={pageSize}            onChange={(e) => {              const val = e.target.value;              setPageSize(val === 'ALL' ? 'ALL' : Number(val));              setCurrentPage(1);            }}            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer"          >            <option value={10}>10 dòng</option>            <option value={20}>20 dòng</option>            <option value={50}>50 dòng</option>            <option value={100}>100 dòng</option>            <option value="ALL">Tất cả</option>          </select>        </div>      </footer>    onClick={() => setCurrentPage(totalPages)}              disabled={currentPage === totalPages}              className="p-1 rounded-smborder-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"              title="Trang cuối"            >              <ChevronLast size={14} />            </button>          </div>        )}      </footer>`;

const replacement = `                              title="Xóa bản ghi (Admin)"
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
      </footer>`;

const idx = code.indexOf(target);
if (idx !== -1) {
    code = code.substring(0, idx) + replacement + code.substring(idx + target.length);
    fs.writeFileSync('components/KQTNView.tsx', code);
    console.log("Success");
} else {
    console.log("Target not found");
}
