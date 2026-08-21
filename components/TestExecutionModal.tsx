
import React, { useState } from 'react';
import { X, FileText, Upload, Calculator, Save, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TestRequest, TestResult } from '../types';
import { fileToGenerativePart, extractTestResultsFromPDF } from '../utils/gemini';

interface TestExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TestRequest | null;
  onSubmit: (id: string, result: TestResult) => void;
}

export const TestExecutionModal = ({ isOpen, onClose, request, onSubmit }: TestExecutionModalProps) => {
  const [result, setResult] = useState<TestResult>({
    measuredCapacity: 0,
    measuredPower: 0,
    cspf: 0,
    energyLevel: 0,
    serialNumber: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');

  if (!isOpen || !request) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const loadingToast = toast.loading("AI đang phân tích kết quả...");
    try {
      const base64 = await fileToGenerativePart(file);
      const extracted = await extractTestResultsFromPDF(base64, file.type || 'application/pdf');
      
      setResult(prev => ({
        ...prev,
        ...extracted
      }));
      toast.dismiss(loadingToast);
      toast.success("Trích xuất thành công!");
      setActiveTab('manual'); // Switch to review mode
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("Lỗi AI: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (!result.measuredCapacity || !result.measuredPower) {
        toast.warning("Vui lòng nhập đầy đủ kết quả đo lường!");
        return;
    }
    onSubmit(request.id, result);
    toast.success("Đã lưu kết quả thử nghiệm");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase flex items-center gap-2">
              <Calculator className="text-emerald-400" /> Thực hiện thử nghiệm
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
                Nhập dữ liệu cho mẫu: <span className="text-white font-bold">{request.modelName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-4 text-sm font-black uppercase transition-all ${activeTab === 'upload' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-400 hover:bg-white'}`}
            >
                <div className="flex items-center justify-center gap-2"><Upload size={16}/> Phương án A: Upload PDF (AI)</div>
            </button>
            <button 
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-4 text-sm font-black uppercase transition-all ${activeTab === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-400 hover:bg-white'}`}
            >
                <div className="flex items-center justify-center gap-2"><FileText size={16}/> Phương án B: Nhập thủ công</div>
            </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
            
            {activeTab === 'upload' && (
                <div className="flex flex-col items-center justify-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse">
                        <Upload size={32} className="text-emerald-600" />
                    </div>
                    <div className="text-center">
                        <h4 className="text-lg font-black text-slate-800">Tải lên báo cáo PDF</h4>
                        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                            Hệ thống AI sẽ tự động đọc file PDF, trích xuất Serial Number, các kết quả đo lường và HSNL.
                        </p>
                    </div>
                    <label className={`relative px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase shadow-lg shadow-emerald-200 cursor-pointer transition-all active:scale-95 flex items-center gap-3 ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}>
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                        {isProcessing ? "Đang xử lý..." : "Chọn file PDF"}
                    </label>
                </div>
            )}

            {activeTab === 'manual' && (
                <div className="space-y-6">
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h5 className="text-sm font-bold text-slate-800">Kiểm tra dữ liệu</h5>
                            <p className="text-xs text-slate-500 mt-1">Vui lòng rà soát kỹ các thông số trước khi lưu. Dữ liệu này sẽ được dùng để cấp chứng nhận.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase">Serial Number</label>
                             <input type="text" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                                value={result.serialNumber} onChange={e => setResult({...result, serialNumber: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase">Cấp sao năng lượng</label>
                             <input type="number" min="1" max="5" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                                value={result.energyLevel} onChange={e => setResult({...result, energyLevel: parseInt(e.target.value)})} />
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase">Công suất lạnh (W)</label>
                             <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                                value={result.measuredCapacity} onChange={e => setResult({...result, measuredCapacity: parseFloat(e.target.value)})} />
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase">Công suất điện (W)</label>
                             <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                                value={result.measuredPower} onChange={e => setResult({...result, measuredPower: parseFloat(e.target.value)})} />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase">Hiệu suất năng lượng (CSPF)</label>
                             <input type="number" step="0.01" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                                value={result.cspf} onChange={e => setResult({...result, cspf: parseFloat(e.target.value)})} />
                        </div>
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-white hover:shadow-sm uppercase transition-all">Hủy</button>
          <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 flex items-center gap-2 transition-all">
            <Save size={16} /> Lưu kết quả
          </button>
        </div>
      </div>
    </div>
  );
};
