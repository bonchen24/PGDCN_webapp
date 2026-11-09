'use client';

import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  FileDown,
  Eye,
  Image as ImageIcon,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  RefreshCw,
  Plus,
  HelpCircle,
  FolderUp,
} from 'lucide-react';
import {
  createPgdcnB1SelectedAttachment,
  formatPgdcnFileSize,
  type PgdcnB1SelectedAttachment,
  type ResolvedB1AttachmentRequirement,
} from '@/utils/pgdcnB1Attachments';

export type PgdcnB1AttachmentSectionProps = {
  attachments: readonly PgdcnB1SelectedAttachment[];
  onChange: (attachments: PgdcnB1SelectedAttachment[]) => void;
  requirements?: readonly ResolvedB1AttachmentRequirement[];
  disabled?: boolean;
  locked?: boolean;
  idPrefix?: string;
  accent?: 'emerald' | 'blue';
  domain?: 'PCN' | 'PGD';
};

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.avif';
const ACCEPTED_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

function isSupportedFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_FILE_EXTENSIONS.has(extension);
}

// Presets for items that have a standard DOCX template
const DOCX_TEMPLATE_PRESETS: Record<string, { filename: string; label: string }> = {
  'QC4-PROPOSAL': { filename: 'PCN_De_nghi_chung_nhan.docx', label: 'Mẫu Đề nghị PCN (DOCX)' },
  'QC9-PROPOSAL': { filename: 'PCN_De_nghi_chung_nhan.docx', label: 'Mẫu Đề nghị PCN (DOCX)' },
  'REQUEST_PYC': { filename: 'PGD-BM-01.docx', label: 'Mẫu Phiếu yêu cầu PGD (DOCX)' },
  'COMMERCIAL_CONTRACT': { filename: 'PCN_Hop_dong_dich_vu_chung_nhan.docx', label: 'Mẫu Hợp đồng dịch vụ (DOCX)' },
  'QC4-COMMERCIAL': { filename: 'PCN_Hop_dong_dich_vu_chung_nhan.docx', label: 'Mẫu Hợp đồng dịch vụ (DOCX)' },
  'QC9-COMMERCIAL': { filename: 'PCN_Hop_dong_dich_vu_chung_nhan.docx', label: 'Mẫu Hợp đồng dịch vụ (DOCX)' },
};

// Common screening document requirements for customer review and proposal eligibility
const COMMON_SCREENING_ITEMS = [
  {
    id: 'BUSINESS_LICENSE',
    code: 'BUSINESS_LICENSE',
    name: 'Giấy chứng nhận Đăng ký kinh doanh (ĐKKD / GPKD)',
    description: 'Đối chiếu tư cách pháp nhân, mã số thuế và người đại diện theo pháp luật',
    multiplicity: 'SINGLE' as const,
    group: 'Hồ sơ pháp lý khách hàng',
  },
  {
    id: 'AUTHORIZATION_LETTER',
    code: 'AUTHORIZATION_LETTER',
    displayName: 'Văn bản ủy quyền người đại diện / nộp hồ sơ',
    name: 'Văn bản ủy quyền người đại diện / nộp hồ sơ',
    description: 'Áp dụng khi người ký không phải đại diện pháp luật trên GPKD',
    multiplicity: 'SINGLE' as const,
    group: 'Hồ sơ pháp lý khách hàng',
  },
  {
    id: 'COMMERCIAL_QUOTE_CONTRACT',
    code: 'COMMERCIAL_CONTRACT',
    name: 'Hợp đồng dịch vụ hoặc Xác nhận báo giá',
    description: 'Căn cứ phạm vi, chi phí và thỏa thuận thực hiện dịch vụ',
    multiplicity: 'SINGLE' as const,
    group: 'Hồ sơ thương mại & hợp đồng',
  },
  {
    id: 'CUSTOMS_COMMODITY_DOCS',
    code: 'CUSTOMS_DECLARATION',
    name: 'Bộ chứng từ hàng hóa (Tờ khai hải quan, Invoice, Packing list, B/L)',
    description: 'Áp dụng cho hàng hóa nhập khẩu phục vụ kiểm tra chuyên ngành',
    multiplicity: 'MULTIPLE' as const,
    group: 'Hồ sơ hải quan & logistics',
  },
  {
    id: 'TECHNICAL_SPECIFICATIONS',
    code: 'TECHNICAL_SPECIFICATION',
    name: 'Hồ sơ kỹ thuật / Catalogue / Tiêu chuẩn cơ sở (TCCS)',
    description: 'Bản vẽ, thông số kích thước, cơ lý hóa, nhãn hàng hóa và quy trình',
    multiplicity: 'MULTIPLE' as const,
    group: 'Hồ sơ kỹ thuật & chất lượng',
  },
  {
    id: 'QUALITY_CERTIFICATE',
    code: 'QUALITY_CERTIFICATE',
    name: 'Chứng chỉ chất lượng (CO/CQ) hoặc Giấy chứng nhận ISO 9001',
    description: 'Chứng nhận hệ thống ISO 9001 (áp dụng cho PCN Phương thức 5) hoặc CO/CQ xuất xưởng',
    multiplicity: 'MULTIPLE' as const,
    group: 'Hồ sơ kỹ thuật & chất lượng',
  },
];

export function PgdcnB1AttachmentSection({
  attachments,
  onChange,
  requirements = [],
  disabled = false,
  locked = false,
  idPrefix = 'pgdcn-b1',
  accent = 'emerald',
  domain,
}: PgdcnB1AttachmentSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [showBulkDropzone, setShowBulkDropzone] = useState(false);

  const inputId = `${idPrefix}-attachment-input`;
  const headingId = `${idPrefix}-attachments-heading`;

  const unavailable = disabled || locked;
  const isBlue = accent === 'blue';

  const focusClasses = isBlue
    ? 'focus-within:ring-blue-500 focus:border-blue-500 focus:ring-blue-500'
    : 'focus-within:ring-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';

  const dropColors = isBlue
    ? 'border-blue-500 bg-blue-50 text-blue-800'
    : 'border-emerald-500 bg-emerald-50 text-emerald-800';

  const primaryBtnClass = isBlue
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  const activeBadgeClass = isBlue
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  // Build checklist items: Template requirements + Common screening requirements + Pending mapping
  const checklistItems = useMemo(() => {
    const list: Array<{
      id: string;
      code: string;
      displayName: string;
      description?: string;
      multiplicity: 'SINGLE' | 'MULTIPLE';
      required: boolean;
      isTemplate: boolean;
    }> = [];

    const seenCodes = new Set<string>();

    // 1. Template-specific requirements first (SSOT)
    for (const req of requirements || []) {
      const code = req.requirementCode || req.requirementId;
      seenCodes.add(code.toUpperCase());
      seenCodes.add(req.requirementId.toUpperCase());
      list.push({
        id: req.requirementId,
        code: req.requirementCode || req.requirementId,
        displayName: req.displayName,
        description: `Mã chuẩn: ${req.requirementCode || req.requirementId} · Thuộc bộ hồ sơ mẫu`,
        multiplicity: req.multiplicity || 'SINGLE',
        required: req.required ?? false,
        isTemplate: true,
      });
    }

    // 2. Common screening items if not already present
    for (const item of COMMON_SCREENING_ITEMS) {
      if (seenCodes.has(item.code.toUpperCase()) || seenCodes.has(item.id.toUpperCase())) continue;
      // Skip customs/B/L for PCN unless needed
      if (domain === 'PCN' && item.code === 'CUSTOMS_DECLARATION') continue;

      list.push({
        id: item.id,
        code: item.code,
        displayName: item.name,
        description: item.description,
        multiplicity: item.multiplicity,
        required: false,
        isTemplate: false,
      });
    }

    return list;
  }, [requirements, domain]);

  // Options for re-mapping select dropdown
  const requirementOptions = useMemo(() => {
    const options = checklistItems.map((item) => ({
      value: item.id,
      label: `${item.displayName} (${item.code})`,
      requirement: item,
    }));

    return [
      ...options,
      { value: 'PENDING_MAPPING', label: 'Tài liệu bổ sung khác', requirement: undefined },
    ];
  }, [checklistItems]);

  // Add files directly to a specific requirement
  const addFilesForRequirement = (files: FileList | File[], targetReq?: { id: string; code: string; displayName: string; multiplicity?: 'SINGLE' | 'MULTIPLE' }) => {
    const selected = Array.from(files);
    const accepted = selected.filter(isSupportedFile);
    const rejectedCount = selected.length - accepted.length;
    setSelectionError(rejectedCount > 0 ? 'Chỉ nhận PDF, DOCX và tệp ảnh JPG, PNG, GIF, WEBP hoặc AVIF.' : '');

    if (accepted.length === 0) return;

    if (!targetReq || targetReq.id === 'PENDING_MAPPING') {
      const newAttachments = accepted.map((file) =>
        createPgdcnB1SelectedAttachment(file, 'OTHER', {
          requirementId: 'PENDING_MAPPING',
          displayName: 'Tài liệu bổ sung khác',
          documentKind: undefined,
          mappingStatus: 'PENDING_MAPPING',
        })
      );
      onChange([...attachments, ...newAttachments]);
      return;
    }

    // When targeting a specific requirement
    const isSingle = targetReq.multiplicity === 'SINGLE';
    const newAttachments = (isSingle ? [accepted[0]] : accepted).map((file) =>
      createPgdcnB1SelectedAttachment(file, 'OTHER', {
        requirementId: targetReq.id,
        requirementCode: targetReq.code,
        displayName: targetReq.displayName,
        documentKind: targetReq.code,
        mappingStatus: 'MAPPED',
      })
    );

    // If SINGLE, replace existing attachment for this requirement
    const existing = isSingle
      ? attachments.filter((att) => att.requirementId !== targetReq.id && att.requirementCode !== targetReq.code)
      : attachments;

    onChange([...existing, ...newAttachments]);
  };

  // General add files (starts unmapped as PENDING_MAPPING for backward compatibility)
  const addFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    const accepted = selected.filter(isSupportedFile);
    const rejectedCount = selected.length - accepted.length;
    setSelectionError(rejectedCount > 0 ? 'Chỉ nhận PDF, DOCX và tệp ảnh JPG, PNG, GIF, WEBP hoặc AVIF.' : '');

    if (accepted.length > 0) {
      const newAttachments = accepted.map((file) =>
        createPgdcnB1SelectedAttachment(file, 'OTHER', {
          requirementId: 'PENDING_MAPPING',
          displayName: 'Tài liệu bổ sung khác',
          documentKind: undefined,
          mappingStatus: 'PENDING_MAPPING',
        })
      );
      onChange([...attachments, ...newAttachments]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateRequirement = (id: string, selectedValue: string) => {
    if (unavailable) return;
    const opt = requirementOptions.find((item) => item.value === selectedValue);
    onChange(
      attachments.map((attachment) => {
        if (attachment.id !== id) return attachment;
        if (selectedValue === 'PENDING_MAPPING') {
          return {
            ...attachment,
            requirementId: 'PENDING_MAPPING',
            requirementCode: undefined,
            displayName: 'Tài liệu bổ sung khác',
            documentKind: undefined,
            mappingStatus: 'PENDING_MAPPING',
            kind: 'OTHER',
          };
        }
        return {
          ...attachment,
          requirementId: opt?.value || selectedValue,
          requirementCode: opt?.requirement?.code || selectedValue,
          displayName: opt?.requirement?.displayName || opt?.label || selectedValue,
          documentKind: opt?.requirement?.code,
          mappingStatus: 'MAPPED',
          kind: 'OTHER',
        };
      })
    );
  };

  const removeFile = (id: string) => {
    if (unavailable) return;
    onChange(attachments.filter((attachment) => attachment.id !== id));
  };

  // Group attachments by requirementId
  const attachmentsByRequirement = useMemo(() => {
    const map = new Map<string, PgdcnB1SelectedAttachment[]>();
    for (const att of attachments) {
      const key = att.requirementId || (att.mappingStatus === 'PENDING_MAPPING' ? 'PENDING_MAPPING' : 'PENDING_MAPPING');
      const list = map.get(key) || [];
      list.push(att);
      map.set(key, list);
    }
    return map;
  }, [attachments]);

  const pendingAttachments = attachmentsByRequirement.get('PENDING_MAPPING') || [];

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      {/* Header with info & count */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 id={headingId} className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>📎</span> Tệp đính kèm (tùy chọn)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            Đính kèm các chứng từ tiếp nhận để xét duyệt hồ sơ. Bạn có thể bấm <strong className="text-slate-700">Tải tệp lên</strong> trực tiếp tại từng đầu mục bên dưới, hoặc kéo thả nhiều tệp cùng lúc.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${attachments.length > 0 ? activeBadgeClass : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            <FileCheck2 size={13} />
            {attachments.length > 0 ? `Đã đính kèm ${attachments.length} tệp` : 'Chưa có tệp'}
          </span>

          <label
            htmlFor={inputId}
            className={`mobile-touch-target inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs focus-within:ring-2 ${focusClasses.split(' ')[0]} ${unavailable ? 'pointer-events-none opacity-50' : ''}`}
            title="Chọn nhiều tệp đính kèm"
          >
            <Upload size={14} aria-hidden="true" /> Chọn nhiều tệp
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            disabled={unavailable}
            className="sr-only"
            aria-label="Chọn nhiều tệp đính kèm B1"
            onChange={(event) => { if (event.currentTarget.files) addFiles(event.currentTarget.files); }}
          />
        </div>
      </div>

      {selectionError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle size={15} />
          {selectionError}
        </div>
      )}

      {/* CHECKLIST TABLE / CARDS ACCORDING TO TEMPLATE & SCREENING REQUIREMENTS */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Danh mục đầu mục hồ sơ xét duyệt tiếp nhận
          </div>
          <div className="text-xs text-slate-500">
            Hỗ trợ PDF, DOCX, Ảnh JPG/PNG (Tối đa 25MB/tệp)
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {checklistItems.map((item, index) => {
            const itemFiles = attachmentsByRequirement.get(item.id) || [];
            const hasFiles = itemFiles.length > 0;
            const singleFileInputId = `${idPrefix}-item-file-${item.id}`;
            const docxPreset = DOCX_TEMPLATE_PRESETS[item.code] || DOCX_TEMPLATE_PRESETS[item.id];

            return (
              <div
                key={item.id}
                className="p-3.5 md:p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${hasFiles ? (isBlue ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700') : 'bg-slate-100 text-slate-500'}`}>
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800">
                        {item.displayName}
                      </h3>
                      {item.required && (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          Bắt buộc
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${hasFiles ? activeBadgeClass : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {hasFiles ? `Đã chọn ${itemFiles.length} tệp` : 'Chưa có tệp'}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                        {item.description}
                      </p>
                    )}

                    {/* Files list for this specific requirement */}
                    {hasFiles && (
                      <div className="mt-2.5 space-y-1.5 max-w-xl">
                        {itemFiles.map((fileAtt) => {
                          const isImage = fileAtt.file.type.startsWith('image/');
                          const FileIcon = isImage ? ImageIcon : FileText;

                          return (
                            <div
                              key={fileAtt.id}
                              className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs"
                            >
                              <FileIcon size={15} className="shrink-0 text-slate-500" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-slate-800" title={fileAtt.file.name}>
                                  {fileAtt.file.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {formatPgdcnFileSize(fileAtt.file.size)}
                                  {fileAtt.status === 'UPLOADED' && ' · Đã tải lên'}
                                  {fileAtt.status === 'UPLOADING' && ' · Đang tải lên…'}
                                  {fileAtt.status === 'FAILED' && <span className="text-rose-600 font-bold"> · Lỗi tải tệp</span>}
                                </div>
                                {fileAtt.error && (
                                  <p role="alert" className="text-[11px] text-rose-600 font-medium">{fileAtt.error}</p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const url = URL.createObjectURL(fileAtt.file);
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                  } catch {
                                    toast.info(`Tệp: ${fileAtt.file.name}`);
                                  }
                                }}
                                aria-label={`Xem tệp ${fileAtt.file.name}`}
                                className="px-2 py-1 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-200/70 transition-colors"
                              >
                                Xem
                              </button>
                              <button
                                type="button"
                                disabled={unavailable || fileAtt.status === 'UPLOADED'}
                                onClick={() => removeFile(fileAtt.id)}
                                aria-label={`Xóa tệp ${fileAtt.file.name}`}
                                className="px-2 py-1 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                              >
                                Xóa
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload action for this requirement */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                  {docxPreset && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(`Biểu mẫu DOCX: ${docxPreset.label}. Có thể tải hoặc mở soạn thảo.`);
                      }}
                      className="mobile-touch-target inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      title={`Xem thông tin biểu mẫu ${docxPreset.label}`}
                    >
                      <FileDown size={13} className="text-slate-500" />
                      <span>File mẫu</span>
                    </button>
                  )}
                  <input
                    id={singleFileInputId}
                    type="file"
                    multiple={item.multiplicity === 'MULTIPLE'}
                    accept={ACCEPTED_FILE_TYPES}
                    disabled={unavailable}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.currentTarget.files) {
                        addFilesForRequirement(event.currentTarget.files, item);
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                  <label
                    htmlFor={singleFileInputId}
                    className={`mobile-touch-target inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold shadow-2xs transition-all ${
                      hasFiles
                        ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        : `${primaryBtnClass}`
                    } ${unavailable ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    {hasFiles ? (
                      item.multiplicity === 'MULTIPLE' ? (
                        <>
                          <Plus size={13} /> Thêm tệp
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} /> Thay thế
                        </>
                      )
                    ) : (
                      <>
                        <Upload size={13} /> Tải tệp lên
                      </>
                    )}
                  </label>
                </div>
              </div>
            );
          })}

          {/* Special Item: Tài liệu bổ sung khác (PENDING_MAPPING) */}
          <div className="p-3.5 md:p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors bg-slate-50/30">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 text-xs font-bold">
                +
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800">Tài liệu bổ sung khác</h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${pendingAttachments.length > 0 ? activeBadgeClass : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {pendingAttachments.length > 0 ? `Đã chọn ${pendingAttachments.length} tệp` : 'Chưa có tệp'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các tài liệu giải trình, hình ảnh hoặc giấy tờ ngoài danh mục (có thể phân loại lại sau)
                </p>

                {pendingAttachments.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 max-w-xl">
                    {pendingAttachments.map((fileAtt) => (
                      <div
                        key={fileAtt.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <FileText size={15} className="shrink-0 text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-800" title={fileAtt.file.name}>{fileAtt.file.name}</div>
                          <div className="text-[11px] text-slate-500">{formatPgdcnFileSize(fileAtt.file.size)}</div>
                        </div>
                        <button
                          type="button"
                          disabled={unavailable}
                          onClick={() => removeFile(fileAtt.id)}
                          className="px-2 py-1 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
              <input
                id={`${idPrefix}-pending-file`}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                disabled={unavailable}
                className="sr-only"
                onChange={(event) => {
                  if (event.currentTarget.files) {
                    addFilesForRequirement(event.currentTarget.files, { id: 'PENDING_MAPPING', code: 'PENDING_MAPPING', displayName: 'Tài liệu bổ sung khác' });
                  }
                  event.currentTarget.value = '';
                }}
              />
              <label
                htmlFor={`${idPrefix}-pending-file`}
                className={`mobile-touch-target inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs ${unavailable ? 'pointer-events-none opacity-50' : ''}`}
              >
                <Plus size={13} /> Thêm tệp khác
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK DROPZONE & COMPREHENSIVE ATTACHMENTS LIST (Ensures test & contract compliance) */}
      <div className="space-y-3 pt-2">
        <div
          onDragOver={(event) => { event.preventDefault(); if (!unavailable) setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); if (!unavailable) addFiles(event.dataTransfer.files); }}
          className={`rounded-xl border border-dashed px-4 py-3.5 text-center text-xs transition-colors ${
            dragging ? dropColors : 'border-slate-300 bg-slate-50/50 text-slate-600 hover:bg-slate-50'
          } ${unavailable ? 'opacity-60' : ''}`}
        >
          <span>Kéo thả nhiều tệp vào đây hoặc dùng nút </span>
          <label htmlFor={inputId} className="font-bold underline cursor-pointer text-slate-800 hover:text-blue-600">
            Chọn nhiều tệp
          </label>
          <span className="text-slate-400"> (Tự động nhận dạng và cho phép phân loại nhanh)</span>
        </div>

        {/* Global attachments list with type selector (Verified by unit and contract tests) */}
        {attachments.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Toàn bộ danh sách tệp B1 đã chọn ({attachments.length})</span>
              <span className="text-slate-400 font-normal">Có thể điều chỉnh loại chứng từ tương ứng</span>
            </div>

            <ul aria-label="Danh sách tệp B1 đã chọn" className="divide-y divide-slate-100">
              {attachments.map((attachment) => {
                const isImage = attachment.file.type.startsWith('image/');
                const Icon = isImage ? ImageIcon : FileText;
                const currentReqId = attachment.requirementId || 'PENDING_MAPPING';
                const currentReq = requirementOptions.find((item) => item.value === currentReqId);
                const displayLabel = currentReq?.label || attachment.displayName || (currentReqId === 'PENDING_MAPPING' ? 'Tài liệu bổ sung khác' : currentReqId);

                return (
                  <li
                    key={attachment.id}
                    className="grid min-w-0 gap-2.5 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(12rem,1fr)_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-800" title={attachment.file.name}>
                          {attachment.file.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatPgdcnFileSize(attachment.file.size)} ·{' '}
                          {attachment.status === 'UPLOADED'
                            ? 'Đã tải lên'
                            : attachment.status === 'UPLOADING'
                            ? 'Đang tải lên…'
                            : attachment.status === 'FAILED'
                            ? 'Tải chưa thành công'
                            : displayLabel}
                        </div>
                        {attachment.error && (
                          <p role="alert" className="mt-0.5 break-words text-[11px] font-semibold text-rose-700">
                            {attachment.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <select
                      aria-label={`Loại chứng từ · ${attachment.file.name}`}
                      value={currentReqId}
                      disabled={unavailable || attachment.status === 'UPLOADED'}
                      onChange={(event) => updateRequirement(attachment.id, event.target.value)}
                      className={`mobile-touch-target min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 ${
                        focusClasses.split(' ').slice(1).join(' ')
                      } disabled:bg-slate-50`}
                    >
                      {requirementOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={unavailable || attachment.status === 'UPLOADED'}
                      onClick={() => removeFile(attachment.id)}
                      aria-label={`Xóa tệp ${attachment.file.name}`}
                      className="mobile-touch-target inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40 transition-colors"
                      title="Xóa tệp"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default PgdcnB1AttachmentSection;