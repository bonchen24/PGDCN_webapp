'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileSearch, Loader2, ScanLine, UploadCloud } from 'lucide-react';

import type { PcnOcrContext, PcnOcrDraft } from '../types';
import { runPcnOcr } from '../utils/pcnOcrApi';

const FIELD_LABELS: Record<string, string> = {
  proposalCode: 'Mã Đề nghị',
  customerName: 'Khách hàng',
  address: 'Địa chỉ',
  contactPerson: 'Người liên hệ',
  taxId: 'Mã số thuế',
  phone: 'Điện thoại',
  email: 'Email',
  warehouseAddress: 'Địa chỉ/kho',
  productName: 'Tên sản phẩm',
  productType: 'Kiểu/loại',
  model: 'Kiểu loại',
  brand: 'Nhãn hiệu',
  specifications: 'Thông số kỹ thuật',
  manufacturer: 'Nhà sản xuất',
  manufacturerAddress: 'Địa chỉ nhà sản xuất',
  quantity: 'Số lượng',
  reportNumber: 'Số báo cáo KQTN',
  outcome: 'Kết quả',
  notes: 'Ghi chú',
  receivedAt: 'Ngày tiếp nhận',
  fieldCodes: 'Lĩnh vực',
};

type PcnOcrPanelProps = {
  context: PcnOcrContext;
  onApply: (fields: Record<string, string>, draft: PcnOcrDraft) => void;
  onFileSelected?: (file: File) => void;
  disabled?: boolean;
};

export default function PcnOcrPanel({ context, onApply, onFileSelected, disabled = false }: PcnOcrPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState<PcnOcrDraft>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const processFile = async (file?: File) => {
    if (!file || disabled) return;
    setFileName(file.name);
    setDraft(undefined);
    setError('');
    setLoading(true);
    onFileSelected?.(file);
    try {
      const response = await runPcnOcr(file, context);
      setDraft({ ...response.draft, provider: response.provider as PcnOcrDraft['provider'] });
    } catch (cause: any) {
      setError(cause?.message || 'Không thể OCR tệp; chưa thể xác nhận KQTN mới.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files || [])[0];
      if (file) void processFile(file);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  });

  const fields = draft ? Object.entries(draft.fields).filter(([, value]) => String(value).trim()) : [];
  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all" aria-label="OCR hồ sơ PCN">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <ScanLine size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span>OCR trích xuất {context === 'proposal' ? 'Đề nghị' : 'KQTN'}</span>
              <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">Trợ lý AI</span>
            </div>
            <p className="text-[11px] text-slate-500">Kéo thả, chọn tệp hoặc dán ảnh (Ctrl+V) để tự động điền bản nháp.</p>
          </div>
        </div>
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          <UploadCloud size={14} />
          <span>Chọn tệp</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,image/*"
            capture="environment"
            className="hidden"
            disabled={disabled || loading}
            onChange={(event) => { void processFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}
          />
        </label>
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Vùng kéo thả tệp OCR"
        onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !disabled && !loading) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void processFile(event.dataTransfer.files?.[0]); }}
        className={`mt-2.5 rounded-lg border border-dashed px-3.5 py-2.5 text-xs transition-all ${
          dragging
            ? 'border-emerald-500 bg-emerald-50/60 text-emerald-800'
            : 'border-slate-300/80 bg-white/80 hover:bg-white hover:border-slate-400 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <FileSearch size={15} className={dragging ? 'text-emerald-600' : 'text-slate-400'} />
          <span className="truncate">{fileName || 'Thả tệp vào đây hoặc bấm Chọn tệp (hỗ trợ PDF, ảnh chụp, scan)'}</span>
          {loading && <Loader2 size={14} className="ml-auto shrink-0 animate-spin text-emerald-600" />}
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

      {draft && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-800">
              Bản nháp OCR · độ tin cậy {Math.round(draft.confidence * 100)}%{draft.sourcePage ? ` · trang ${draft.sourcePage}` : ''}
            </p>
            <button
              type="button"
              onClick={() => { const confirmedDraft = { ...draft, confirmed: true }; onApply(confirmedDraft.fields, confirmedDraft); setDraft(confirmedDraft); }}
              disabled={draft.confirmed === true}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:bg-emerald-300"
            >
              {draft.confirmed ? <Check size={13} /> : null}
              {draft.confirmed ? 'Đã xác nhận điền' : 'Xác nhận điền bản nháp'}
            </button>
          </div>
          {fields.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Không nhận diện được trường rõ ràng. KQTN mới chưa thể lưu nếu chưa có bản nháp OCR được xác nhận.</p>
          ) : (
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
                  <span className="font-medium text-slate-500 text-[11px] block">{FIELD_LABELS[key] || 'Trường dữ liệu'}</span>
                  <div className="mt-0.5 font-semibold text-slate-800 truncate" title={value}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
