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
  model: 'Model',
  brand: 'Nhãn hiệu',
  specifications: 'Thông số kỹ thuật',
  manufacturer: 'Nhà sản xuất',
  manufacturerAddress: 'Địa chỉ nhà sản xuất',
  quantity: 'Số lượng',
  reportNumber: 'Số báo cáo KQTN',
  outcome: 'Kết quả',
  notes: 'Ghi chú',
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
      setError(cause?.message || 'Không thể OCR file; chưa thể xác nhận KQTN mới.');
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
  return <section className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3" aria-label="OCR hồ sơ PCN"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-800"><ScanLine size={14} /> OCR {context === 'proposal' ? 'Đề nghị' : 'KQTN'}</div><p className="mt-1 text-[10px] leading-4 text-indigo-700">Kéo thả, chọn file, chụp camera hoặc dán ảnh. Kết quả chỉ là bản nháp cần xác nhận.</p></div><label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-2 text-[10px] font-black text-white hover:bg-indigo-700 ${disabled ? 'pointer-events-none opacity-50' : ''}`}><UploadCloud size={13} /> Chọn file<input ref={inputRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,image/*" capture="environment" className="hidden" disabled={disabled || loading} onChange={(event) => { void processFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label></div><div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void processFile(event.dataTransfer.files?.[0]); }} className={`mt-2 rounded-md border px-3 py-2 text-[10px] ${dragging ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-100 bg-white/70'}`}><div className="flex items-center gap-2 text-indigo-700"><FileSearch size={14} /><span>{fileName || 'Thả file vào đây hoặc bấm Chọn file · có thể dán ảnh bằng Ctrl+V'}</span>{loading && <Loader2 size={13} className="ml-auto animate-spin" />}</div></div>{error && <p role="alert" className="mt-2 text-[10px] font-bold text-rose-700">{error}</p>}{draft && <div className="mt-3 rounded-md border border-indigo-100 bg-white p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-slate-700">Bản nháp OCR · độ tin cậy {Math.round(draft.confidence * 100)}%{draft.sourcePage ? ` · trang ${draft.sourcePage}` : ''}</p><button type="button" onClick={() => { const confirmedDraft = { ...draft, confirmed: true }; onApply(confirmedDraft.fields, confirmedDraft); setDraft(confirmedDraft); }} disabled={draft.confirmed === true} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white disabled:bg-emerald-300">{draft.confirmed ? <Check size={12} /> : null}{draft.confirmed ? 'Đã xác nhận điền' : 'Xác nhận điền bản nháp'}</button></div>{fields.length === 0 ? <p className="mt-2 text-[10px] text-slate-500">Không nhận diện được trường rõ ràng. KQTN mới chưa thể lưu nếu chưa có bản nháp OCR được xác nhận.</p> : <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{fields.map(([key, value]) => <div key={key} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px]"><span className="font-black text-slate-500">{FIELD_LABELS[key] || key}</span><div className="mt-0.5 font-bold text-slate-800">{value}</div></div>)}</div>}</div>}</section>;
}
