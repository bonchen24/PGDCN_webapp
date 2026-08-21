// Author: Gemini
// OS support: Web/Node
// Description: Confirmation modal for deleting handover documents with warnings for scheduled samples
import React from 'react';
import { AlertTriangle, Trash2, Calendar, User, Package } from 'lucide-react';
import { HandoverDoc, HandoverType } from '../types';
import { useStore } from '../store';

interface ConfirmDeleteHandoverModalProps {
  isOpen: boolean;
  doc: HandoverDoc | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteHandoverModal: React.FC<ConfirmDeleteHandoverModalProps> = ({
  isOpen,
  doc,
  onClose,
  onConfirm,
}) => {
  const { requests } = useStore();

  if (!isOpen || !doc) return null;

  const isReceiveDoc = doc.type === HandoverType.RECEIVE;
  const sampleIds = Array.isArray(doc.sampleIds) ? doc.sampleIds : [];
  const relatedRequests = requests.filter((r) => sampleIds.includes(r.id));

  const scheduledSamples = relatedRequests.filter(
    (r) => r.scheduledDate !== null && r.scheduledDate !== undefined && r.scheduledDate !== ''
  );
  const waitingSamples = relatedRequests.filter(
    (r) => !r.scheduledDate
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-4 sm:p-6 transform transition-all scale-100 max-h-[calc(100dvh-1rem)] md:max-h-[90vh] min-h-0 flex flex-col">
        <div className="flex flex-col items-center text-center mb-4 shrink-0">
          <div
            className={`w-12 h-12 ${
              scheduledSamples.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
            } rounded-full flex items-center justify-center mb-3`}
          >
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">
            Xóa Biên Bản {isReceiveDoc ? 'Nhận Mẫu' : 'Trả Mẫu'}?
          </h3>
          <p className="text-xs text-slate-500">
            Biên bản số <span className="font-bold text-slate-800">{doc.docNumber}</span> ({doc.customerName}) bao gồm{' '}
            <span className="font-bold text-blue-600">{sampleIds.length} mẫu</span>
          </p>
        </div>

        {isReceiveDoc && scheduledSamples.length > 0 ? (
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 mb-4 overflow-y-auto max-h-60 space-y-2 text-left">
            <div className="text-[11px] font-black text-amber-800 uppercase flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              Cảnh báo: {scheduledSamples.length} mẫu đã được xếp lịch thử nghiệm!
            </div>
            <p className="text-[11px] text-amber-900 font-medium">
              Khi xóa phiếu nhận mẫu này, các mẫu thử sau sẽ <strong>hủy lịch thử nghiệm</strong> và rút khỏi hàng chờ kho:
            </p>
            <div className="space-y-1.5 mt-2">
              {scheduledSamples.map((s) => (
                <div key={s.id} className="bg-white p-2.5 rounded-lg border border-amber-200/80 text-[11px] space-y-1 shadow-sm">
                  <div className="font-bold text-slate-800 flex justify-between items-center">
                    <span className="truncate">{s.modelName}</span>
                    <span className="text-amber-700 font-mono text-[10px] bg-amber-100/60 px-1.5 py-0.5 rounded">
                      {s.requestCode}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 flex flex-wrap gap-2 items-center">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} className="text-blue-600" />
                      Lịch: <strong className="text-blue-700">{s.scheduledDate}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={10} className="text-slate-500" />
                      Thử nghiệm: <strong>{s.testerName || 'Chưa phân công'}</strong>
                    </span>
                    {s.chamberId && (
                      <span className="flex items-center gap-1">
                        <Package size={10} className="text-purple-600" />
                        Buồng: <strong>{s.chamberId}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {waitingSamples.length > 0 && (
              <p className="text-[10px] text-amber-700 italic pt-1 border-t border-amber-200/60">
                ({waitingSamples.length} mẫu đang ở hàng chờ cũng sẽ chuyển về trạng thái 'Chờ nhận mẫu' và biến mất khỏi hàng chờ)
              </p>
            )}
          </div>
        ) : isReceiveDoc ? (
          <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 mb-4 text-left">
            <div className="text-[11px] font-bold text-blue-800 flex gap-2 items-center">
              <AlertTriangle size={16} className="text-blue-600 shrink-0" />
              <span>Các mẫu trong biên bản này đang ở hàng chờ kho.</span>
            </div>
            <p className="text-[10px] text-blue-700 mt-1.5">
              Khi xóa phiếu nhận mẫu này, <strong>{sampleIds.length} mẫu</strong> sẽ chuyển về trạng thái 'Chờ nhận mẫu' và tự động biến mất khỏi hàng chờ thử nghiệm.
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 text-left">
            <p className="text-[11px] text-slate-700 font-medium">
              Xóa biên bản trả mẫu sẽ trả trạng thái của {sampleIds.length} mẫu về 'Mẫu trong kho'.
            </p>
          </div>
        )}

        <div className="flex gap-3 shrink-0 mt-auto pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-xl hover:bg-slate-200 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 text-white text-xs font-bold uppercase rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all"
          >
            {scheduledSamples.length > 0 ? 'Xóa & Hủy Lịch Thử' : 'Xác Nhận Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- End of components/ConfirmDeleteHandoverModal.tsx ---
