'use client';

import { FileSearch, Loader2, ScanLine, UploadCloud } from 'lucide-react';
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
  registrationNumber: 'Mã hồ sơ / PYC',
  customerName: 'Tên đơn vị / khách hàng',
  customerAddress: 'Địa chỉ đơn vị',
  customerContact: 'Người liên hệ',
  requesterName: 'Đơn vị yêu cầu',
  requesterAddress: 'Địa chỉ bên yêu cầu',
  requesterContact: 'Người liên hệ bên yêu cầu',
  requesterPhone: 'Điện thoại bên yêu cầu',
  requesterEmail: 'Email bên yêu cầu',
  productName: 'Tên hàng hóa / hạng mục',
  productCode: 'Mã hàng / model',
  brand: 'Nhãn hiệu',
  productForm: 'Dạng sản phẩm',
  grade: 'Mác / cấp sản phẩm',
  dimensions: 'Kích thước',
  productStandard: 'Tiêu chuẩn sản phẩm',
  countryOfOrigin: 'Nước xuất xứ',
  manufacturer: 'Nhà sản xuất',
  lotCode: 'Số lô',
  quantity: 'Số lượng',
  unit: 'Đơn vị',
  weight: 'Khối lượng',
  inspectionScope: 'Phạm vi yêu cầu',
  inspectionLocation: 'Địa điểm giám định',
  inspectionScheduledAt: 'Thời gian thực hiện',
  receivedAt: 'Ngày tiếp nhận',
  standards: 'Tiêu chuẩn / phương pháp',
  method: 'Mã phương thức',
  operatorName: 'Người thực hiện',
  sampleCode: 'Mã mẫu',
  sampleTypeLabel: 'Tên mẫu',
  sampleQuantity: 'Số lượng mẫu',
  sampleUnit: 'Đơn vị mẫu',
  sealNumber: 'Số niêm phong',
  productGroup: 'Nhóm sản phẩm',
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

  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60">
            <ScanLine size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span>{label}</span>
              <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">Trợ lý AI</span>
            </div>
            <p className="text-[11px] text-slate-500">Kéo thả, chọn tệp hoặc dán ảnh (Ctrl+V) để tự động điền bản nháp PYC.</p>
          </div>
        </div>
        <label className={`mobile-touch-target min-h-11 cursor-pointer relative inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-black text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          <UploadCloud size={14} aria-hidden="true" />
          <span>Chọn tệp</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,image/*"
            capture="environment"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            disabled={disabled}
            onChange={(event) => { processFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}
          />
        </label>
      </div>

      <div
        role="button" tabIndex={disabled ? -1 : 0}
        aria-live="polite"
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}
        onPaste={(event) => { const file = Array.from(event.clipboardData?.files || [])[0]; if (file) processFile(file); }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); processFile(event.dataTransfer.files?.[0]); }}
        className={`mobile-touch-target mt-2.5 min-h-11 rounded-lg border border-dashed px-3.5 py-2.5 text-xs outline-none focus-visible:ring-2 transition-all ${
          dragging
            ? 'border-blue-500 bg-blue-50/60 text-blue-800'
            : 'border-slate-300/80 bg-white/80 hover:bg-white hover:border-slate-400 text-slate-600'
        }`}
      >
        <div className="flex min-h-6 items-center gap-2">
          <FileSearch size={15} aria-hidden="true" className={dragging ? 'text-blue-600' : 'text-slate-400'} />
          <span className="truncate">{fileName || 'Thả tệp vào đây hoặc bấm Chọn tệp · có thể dán ảnh bằng Ctrl+V'}</span>
          {loading && <Loader2 size={14} className="ml-auto shrink-0 animate-spin text-blue-600" aria-label="Đang nhận tệp" />}
        </div>
      </div>

      {fileName && pendingDraft && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-800">
              Bản nháp OCR · độ tin cậy {Math.round(pendingDraft.confidence * 100)}%{pendingDraft.sourcePage ? ` · trang ${pendingDraft.sourcePage}` : ''}
            </p>
            <button
              type="button"
              onClick={() => { if (selectedFile && Object.keys(pendingDraft.fields).length > 0) { onDraftApply?.(pendingDraft.fields, selectedFile); setDraftConfirmed(true); } }}
              disabled={disabled || loading || draftConfirmed || Object.keys(pendingDraft.fields).length === 0}
              className="mobile-touch-target min-h-11 rounded-md bg-emerald-600 px-2.5 text-[11px] font-black text-white disabled:bg-emerald-300"
            >
              {draftConfirmed ? 'Đã xác nhận điền bản nháp' : 'Xác nhận điền bản nháp'}
            </button>
          </div>
          {Object.keys(pendingDraft.fields).length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">Chưa nhận diện được trường rõ ràng. Bạn có thể nhập thủ công; tệp vẫn được giữ làm nguồn tham chiếu.</p>
          ) : (
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(pendingDraft.fields).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
                  <span className="font-medium text-slate-500 text-[11px] block">{OCR_FIELD_LABELS[key] || 'Trường dữ liệu'}</span>
                  <div className="mt-0.5 font-semibold text-slate-800 truncate" title={value}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[11px] font-bold text-rose-700">{error}</p>}
    </section>
  );
}
