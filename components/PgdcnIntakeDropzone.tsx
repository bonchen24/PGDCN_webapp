'use client';

import { FileSearch, Loader2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PgdOcrDraft } from '../utils/pgdOcrParser';

type PgdcnIntakeDropzoneProps = {
  onFileAccepted?: (file: File) => void;
  onExtract?: (file: File) => Promise<PgdOcrDraft>;
  onDraftApply?: (fields: Record<string, string>, file: File) => void;
  disabled?: boolean;
  label?: string;
};

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];

const OCR_FIELD_LABELS: Record<string, string> = {
  registrationNumber: 'Mã hồ sơ / PYC', customerName: 'Tên đơn vị / khách hàng', customerAddress: 'Địa chỉ đơn vị', customerContact: 'Người liên hệ',
  requesterName: 'Đơn vị yêu cầu', requesterAddress: 'Địa chỉ bên yêu cầu', requesterContact: 'Người liên hệ bên yêu cầu', requesterPhone: 'Điện thoại bên yêu cầu', requesterEmail: 'Email bên yêu cầu',
  productName: 'Tên hàng hóa / hạng mục', productCode: 'Mã hàng / model', brand: 'Nhãn hiệu', productForm: 'Dạng sản phẩm', grade: 'Mác / cấp sản phẩm', dimensions: 'Kích thước', productStandard: 'Tiêu chuẩn sản phẩm', countryOfOrigin: 'Nước xuất xứ', manufacturer: 'Nhà sản xuất',
  lotCode: 'Số lô', quantity: 'Số lượng', unit: 'Đơn vị', weight: 'Khối lượng', inspectionScope: 'Phạm vi yêu cầu', inspectionLocation: 'Địa điểm giám định', inspectionScheduledAt: 'Thời gian thực hiện', receivedAt: 'Ngày tiếp nhận', standards: 'Tiêu chuẩn / phương pháp', method: 'Mã phương thức', operatorName: 'Người thực hiện',
  sampleCode: 'Mã mẫu', sampleTypeLabel: 'Tên mẫu', sampleQuantity: 'Số lượng mẫu', sampleUnit: 'Đơn vị mẫu', sealNumber: 'Số niêm phong', productGroup: 'Nhóm sản phẩm',
};

function isAccepted(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return file.type === 'application/pdf' || file.type.startsWith('image/') || extension === 'docx' || ACCEPTED_EXTENSIONS.includes(extension);
}

export default function PgdcnIntakeDropzone({ onFileAccepted, onExtract, onDraftApply, disabled = false, label = 'Tài liệu nhập nhanh' }: PgdcnIntakeDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PgdOcrDraft>();
  const [selectedFile, setSelectedFile] = useState<File>();

  const processFile = async (file?: File) => {
    if (!file || disabled) return;
    setError('');
    if (!isAccepted(file)) {
      setError('Chỉ nhận PDF, DOCX, PNG, JPG hoặc JPEG.');
      return;
    }
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
      setError('Tệp phải lớn hơn 0 và không quá 25 MB.');
      return;
    }
    setLoading(true);
    setFileName(file.name);
    setSelectedFile(file);
    setDraftConfirmed(false);
    setPendingDraft(undefined);
    onFileAccepted?.(file);
    try {
      if (onExtract) setPendingDraft(await onExtract(file));
    } catch (cause: any) {
      setError(cause?.message || 'Không thể nhận diện nội dung tệp. Bạn vẫn có thể nhập thủ công.');
    } finally {
      setLoading(false);
    }
  };

  return <section className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3" aria-label={label}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-800"><FileSearch size={14} aria-hidden="true" /> {label}</div>
        <p className="mt-1 text-[10px] leading-4 text-blue-700">Kéo thả, chọn tệp, chụp camera hoặc dán ảnh để nhập nhanh. Tệp chỉ tạo bản nháp, cần kiểm tra trước khi lưu.</p>
      </div>
      <label className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[10px] font-black text-white hover:bg-blue-700 ${disabled ? 'pointer-events-none opacity-50' : ''}`}><UploadCloud size={13} aria-hidden="true" /> Chọn tệp<input ref={inputRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,image/*" capture="environment" className="hidden" disabled={disabled} onChange={(event) => { processFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
    </div>
    <div role="button" tabIndex={disabled ? -1 : 0} aria-live="polite" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }} onPaste={(event) => { const file = Array.from(event.clipboardData?.files || [])[0]; if (file) processFile(file); }} onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); processFile(event.dataTransfer.files?.[0]); }} className={`mt-2 rounded-md border px-3 py-2 text-[10px] outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200 ${dragging ? 'border-blue-500 bg-blue-100' : 'border-blue-100 bg-white/80'}`}>
      <div className="flex min-h-8 items-center gap-2 text-blue-700"><FileSearch size={14} aria-hidden="true" /><span>{fileName || 'Thả tệp vào đây hoặc bấm Chọn tệp · có thể dán ảnh bằng Ctrl+V'}</span>{loading && <Loader2 size={13} className="ml-auto animate-spin" aria-label="Đang nhận tệp" />}</div>
    </div>
    {fileName && pendingDraft && <div className="mt-2 rounded-md border border-blue-100 bg-white p-2.5" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black text-slate-700">Bản nháp OCR · độ tin cậy {Math.round(pendingDraft.confidence * 100)}%{pendingDraft.sourcePage ? ` · trang ${pendingDraft.sourcePage}` : ''}</p><button type="button" onClick={() => { if (selectedFile && Object.keys(pendingDraft.fields).length > 0) { onDraftApply?.(pendingDraft.fields, selectedFile); setDraftConfirmed(true); } }} disabled={disabled || loading || draftConfirmed || Object.keys(pendingDraft.fields).length === 0} className="min-h-9 rounded-md bg-emerald-600 px-2.5 text-[10px] font-black text-white disabled:bg-emerald-300">{draftConfirmed ? 'Đã xác nhận điền bản nháp' : 'Xác nhận điền bản nháp'}</button></div>{Object.keys(pendingDraft.fields).length === 0 ? <p className="mt-2 text-[10px] text-amber-700">Chưa nhận diện được trường rõ ràng. Bạn có thể nhập thủ công; tệp vẫn được giữ làm nguồn tham chiếu.</p> : <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{Object.entries(pendingDraft.fields).map(([key, value]) => <div key={key} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px]"><span className="font-black text-slate-500">{OCR_FIELD_LABELS[key] || 'Trường dữ liệu'}</span><div className="mt-0.5 font-bold text-slate-800">{value}</div></div>)}</div>}</div>}
    {error && <p role="alert" className="mt-2 text-[10px] font-bold text-rose-700">{error}</p>}
  </section>;
}
