'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building, Check, Download, Edit2, FileSpreadsheet, Mail, Phone, Plus, Search, Trash2, Upload, User, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { usePcnStore } from '../store-pcn';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { getPcnDocumentId } from '../utils/pcnStorePolicy';
import { exportCustomersToWorkbook, parseCustomerWorkbook, type CustomerExcelIssue } from '../utils/customerExcel';
import type { CustomerRef } from '../types';

const emptyCustomerForm = {
  name: '',
  customerCode: '',
  address: '',
  taxId: '',
  phone: '',
  email: '',
  contactPerson: '',
};

function normalizeSearch(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

type PcnCustomerDirectoryMetadata = CustomerRef & {
  region?: string;
  businessType?: string;
};

export type PcnCustomerContactFilter = 'all' | 'with-contact' | 'without-contact';

export interface PcnCustomerFilters {
  searchQuery?: string;
  contactStatus?: PcnCustomerContactFilter;
  region?: string;
  businessType?: string;
}

export interface PcnCustomerFilterOptions {
  regions: string[];
  businessTypes: string[];
}

export function hasPcnCustomerCode(customer: CustomerRef): boolean {
  return Boolean(String(customer.customerCode || '').trim());
}

export function hasPcnCustomerContact(customer: CustomerRef): boolean {
  return [customer.phone, customer.email, customer.contactPerson]
    .some((value) => Boolean(String(value || '').trim()));
}

export function PcnCustomerCodeDisplay({ customer }: { customer: CustomerRef }) {
  return hasPcnCustomerCode(customer)
    ? <span className="inline-flex items-center rounded border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800 tracking-tight">{customer.customerCode?.trim()}</span>
    : <span title="Khách hàng chưa có mã khách hàng" className="inline-flex items-center gap-1 rounded border border-amber-200/80 bg-amber-50/80 px-2 py-0.5 text-[10px] font-medium text-amber-800"><AlertCircle size={11} className="shrink-0 text-amber-600" /> Chưa có mã</span>;
}

export function PcnCustomerContactDisplay({ customer }: { customer: CustomerRef }) {
  return (
    <div className="space-y-1">
      {customer.phone?.trim() && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">SĐT:</span> <span className="font-mono font-medium text-slate-700">{customer.phone.trim()}</span></div>}
      {customer.email?.trim() && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">Email:</span> <span className="text-slate-700">{customer.email.trim()}</span></div>}
      {customer.contactPerson?.trim() && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">LH:</span> <span className="font-semibold text-slate-800">{customer.contactPerson.trim()}</span></div>}
      {!hasPcnCustomerContact(customer) && <span role="status" className="inline-flex items-center gap-1 rounded border border-amber-200/80 bg-amber-50/70 px-2 py-0.5 text-[10px] font-medium text-amber-800"><AlertCircle size={11} className="shrink-0 text-amber-600" /> Chưa có liên hệ</span>}
    </div>
  );
}

function uniqueMetadataValues(customers: CustomerRef[], field: 'region' | 'businessType'): string[] {
  const values = new Map<string, string>();
  customers.forEach((customer) => {
    const value = String((customer as PcnCustomerDirectoryMetadata)[field] || '').trim();
    const normalized = normalizeSearch(value);
    if (value && normalized && !values.has(normalized)) values.set(normalized, value);
  });
  return [...values.values()].sort((left, right) => left.localeCompare(right, 'vi'));
}

export function getPcnCustomerFilterOptions(customers: CustomerRef[]): PcnCustomerFilterOptions {
  return {
    regions: uniqueMetadataValues(customers, 'region'),
    businessTypes: uniqueMetadataValues(customers, 'businessType'),
  };
}

export function PcnCustomerMetadataFilterControls({
  options,
  regionFilter,
  onRegionChange,
  businessTypeFilter,
  onBusinessTypeChange,
}: {
  options: PcnCustomerFilterOptions;
  regionFilter: string;
  onRegionChange: (value: string) => void;
  businessTypeFilter: string;
  onBusinessTypeChange: (value: string) => void;
}) {
  return (
    <>
      {options.regions.length > 0 && <label className="block min-w-0 sm:w-44"><span className="sr-only">Khu vực</span><select aria-label="Lọc khu vực" value={regionFilter} onChange={(event) => onRegionChange(event.target.value)} className="mobile-touch-target min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs outline-none transition focus:border-emerald-500">
        <option value="">Tất cả khu vực</option>{options.regions.map((region) => <option key={region} value={region}>{region}</option>)}
      </select></label>}
      {options.businessTypes.length > 0 && <label className="block min-w-0 sm:w-48"><span className="sr-only">Loại doanh nghiệp</span><select aria-label="Lọc loại doanh nghiệp" value={businessTypeFilter} onChange={(event) => onBusinessTypeChange(event.target.value)} className="mobile-touch-target min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs outline-none transition focus:border-emerald-500">
        <option value="">Tất cả loại doanh nghiệp</option>{options.businessTypes.map((businessType) => <option key={businessType} value={businessType}>{businessType}</option>)}
      </select></label>}
    </>
  );
}

export function filterPcnCustomers(customers: CustomerRef[], filters: PcnCustomerFilters = {}): CustomerRef[] {
  const query = normalizeSearch(filters.searchQuery);
  const contactStatus = filters.contactStatus || 'all';
  const region = normalizeSearch(filters.region);
  const businessType = normalizeSearch(filters.businessType);

  return customers.filter((customer) => {
    const customerHasContact = hasPcnCustomerContact(customer);
    const metadata = customer as PcnCustomerDirectoryMetadata;
    const matchesSearch = !query || [
      customer.name,
      customer.customerCode,
      customer.address,
      customer.taxId,
      customer.phone,
      customer.email,
      customer.contactPerson,
    ].some((value) => normalizeSearch(value).includes(query));
    const matchesContact = contactStatus === 'all'
      || (contactStatus === 'with-contact' && customerHasContact)
      || (contactStatus === 'without-contact' && !customerHasContact);

    return matchesSearch
      && matchesContact
      && (!region || normalizeSearch(metadata.region) === region)
      && (!businessType || normalizeSearch(metadata.businessType) === businessType);
  });
}

function isEmptyCustomer(customer: CustomerRef): boolean {
  return !['name', 'address', 'customerCode', 'taxId', 'phone', 'email', 'contactPerson']
    .some((field) => String(customer[field as keyof CustomerRef] || '').trim());
}

function customerFormFrom(customer: CustomerRef) {
  return {
    name: customer.name || '',
    customerCode: customer.customerCode || '',
    address: customer.address || '',
    taxId: customer.taxId || '',
    phone: customer.phone || '',
    email: customer.email || '',
    contactPerson: customer.contactPerson || '',
  };
}

function CustomerInput({
  value,
  onChange,
  type = 'text',
  disabled = false,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none transition-colors focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

export interface CustomerImportPreviewData {
  fileName: string;
  fileBuffer: ArrayBuffer | Uint8Array;
  validCustomers: CustomerRef[];
  errors: CustomerExcelIssue[];
}

export interface CustomerImportResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ rowNumber?: number; message: string }>;
}

export function exportPcnCustomersWorkbook({
  customers,
  filteredCustomers,
  scope,
}: {
  customers: CustomerRef[];
  filteredCustomers: CustomerRef[];
  scope: 'all' | 'filtered';
}): XLSX.WorkBook {
  const target = scope === 'filtered' ? filteredCustomers : customers;
  return exportCustomersToWorkbook(target);
}

export function downloadCustomerWorkbook(wb: XLSX.WorkBook, filename = 'danh-sach-khach-hang-pcn.xlsx'): void {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

export function prepareCustomerImportPreview({
  fileName,
  fileBuffer,
  currentCustomers,
}: {
  fileName: string;
  fileBuffer: ArrayBuffer | Uint8Array;
  currentCustomers: CustomerRef[];
}): {
  fileName: string;
  fileBuffer: ArrayBuffer | Uint8Array;
  validCustomers: CustomerRef[];
  errors: CustomerExcelIssue[];
} {
  const { customers, errors } = parseCustomerWorkbook(fileBuffer, currentCustomers);
  return {
    fileName,
    fileBuffer,
    validCustomers: customers,
    errors,
  };
}

export async function executeCustomerImport({
  fileBuffer,
  previewCustomers,
  getLatestCustomers,
  addCustomer,
}: {
  fileBuffer: ArrayBuffer | Uint8Array;
  previewCustomers: CustomerRef[];
  getLatestCustomers: () => CustomerRef[];
  addCustomer: (cust: Partial<CustomerRef>) => Promise<void>;
}): Promise<CustomerImportResult> {
  const latestCustomers = getLatestCustomers();
  const { customers: recheckedCustomers, errors: parseErrors } = parseCustomerWorkbook(fileBuffer, latestCustomers);

  const errors: Array<{ rowNumber?: number; message: string }> = [...parseErrors];
  let successCount = 0;
  let failedCount = errors.length;

  for (let idx = 0; idx < recheckedCustomers.length; idx++) {
    const cust = recheckedCustomers[idx];
    try {
      await addCustomer(cust);
      successCount++;
    } catch (err: any) {
      failedCount++;
      const msg = err?.message || 'Không thể lưu khách hàng.';
      const previewIndex = previewCustomers.findIndex(
        (previewCustomer) => normalizeSearch(getPcnDocumentId(previewCustomer)) === normalizeSearch(getPcnDocumentId(cust)),
      );
      const previewOrdinal = previewIndex >= 0 ? previewIndex + 1 : idx + 1;
      errors.push({
        message: `Bản xem trước #${previewOrdinal} (${cust.name || cust.customerCode || 'Khách hàng'}): ${msg}`,
      });
    }
  }

  return {
    successCount,
    failedCount,
    errors,
  };
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PcnCustomerImportPreview({
  preview,
  isImporting = false,
  alreadyApplied = false,
  onConfirm,
  onCancel,
  importResult,
  triggerRef,
}: {
  preview: {
    fileName: string;
    validCustomers: CustomerRef[];
    errors: Array<{ rowNumber?: number; message: string }>;
  };
  isImporting?: boolean;
  alreadyApplied?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  importResult?: CustomerImportResult | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [expandedValid, setExpandedValid] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(false);

  const initialLimit = 10;
  const displayedValid = expandedValid ? preview.validCustomers : preview.validCustomers.slice(0, initialLimit);
  const remainingValid = Math.max(0, preview.validCustomers.length - initialLimit);

  const displayedErrors = expandedErrors ? preview.errors : preview.errors.slice(0, initialLimit);
  const remainingErrors = Math.max(0, preview.errors.length - initialLimit);

  const canConfirm = preview.validCustomers.length > 0 && !isImporting && !alreadyApplied;

  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  const isImportingRef = useRef(isImporting);
  const fallbackTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    isImportingRef.current = isImporting;
  }, [isImporting]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      fallbackTriggerRef.current = document.activeElement;
    }

    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const focusables = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0));
      const target = focusables[0] || dialogEl;
      target.focus();
    }

    const restoreTriggerFocus = () => {
      const target = triggerRef?.current || fallbackTriggerRef.current;
      target?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isImportingRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCancelRef.current();
          restoreTriggerFocus();
        }
        return;
      }

      if (event.key === 'Tab') {
        const currentDialog = dialogRef.current;
        if (!currentDialog) return;

        const focusables = Array.from(
          currentDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute('disabled') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0));

        if (focusables.length === 0) {
          event.preventDefault();
          currentDialog.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !currentDialog.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !currentDialog.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      restoreTriggerFocus();
    };
  }, [triggerRef]);

  const handleCancel = () => {
    if (isImporting) return;
    onCancel();
    const target = triggerRef?.current || fallbackTriggerRef.current;
    target?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcn-customer-import-preview-title"
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={20} />
            <div>
              <h3 id="pcn-customer-import-preview-title" className="text-sm font-black text-slate-800">Xem trước nhập khách hàng từ Excel</h3>
              <p className="text-[11px] text-slate-500">Tệp đã chọn: <span className="font-semibold text-slate-700">{preview.fileName}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isImporting}
            className="mobile-touch-target rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Đóng xem trước"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-bold text-emerald-800">
              <Check size={14} /> Hợp lệ: {preview.validCustomers.length}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-bold text-amber-800">
              <AlertCircle size={14} /> Lỗi / Trùng: {preview.errors.length}
            </span>
            {alreadyApplied && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-bold text-slate-600">
                Đã xử lý
              </span>
            )}
          </div>

          {importResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <h4 className="font-bold text-slate-800">Kết quả nhập dữ liệu</h4>
              <p className="text-[11px] text-slate-600">
                Thành công: <strong className="text-emerald-700">{importResult.successCount}</strong> | Thất bại: <strong className="text-red-700">{importResult.failedCount}</strong>
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="font-semibold text-slate-700 text-[11px]">Chi tiết lỗi:</span>
                  <ul className="max-h-28 overflow-y-auto space-y-1 rounded border border-red-100 bg-red-50/50 p-2 text-[11px] text-red-700">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Danh sách khách hàng hợp lệ ({preview.validCustomers.length})</h4>
            {preview.validCustomers.length === 0 ? (
              <p className="italic text-slate-400">Không có dòng dữ liệu nào hợp lệ.</p>
            ) : (
              <div className="space-y-1.5">
                {displayedValid.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700">Bản xem trước #{idx + 1}</span>
                        {c.customerCode && <span className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-[10px] text-emerald-800">{c.customerCode}</span>}
                        <span className="truncate font-medium text-slate-800">{c.name}</span>
                      </div>
                      {c.address && <p className="truncate text-[10px] text-slate-500">{c.address}</p>}
                    </div>
                  </div>
                ))}
                {!expandedValid && remainingValid > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedValid(true)}
                    className="mt-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    Xem thêm {remainingValid} khách hàng hợp lệ
                  </button>
                )}
                {expandedValid && remainingValid > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedValid(false)}
                    className="mt-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Thu gọn
                  </button>
                )}
              </div>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-red-600">Danh sách lỗi / trùng ({preview.errors.length})</h4>
              <div className="space-y-1.5">
                {displayedErrors.map((err, idx) => (
                  <div key={idx} className="rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-[11px] text-red-800">
                    {err.message}
                  </div>
                ))}
                {!expandedErrors && remainingErrors > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedErrors(true)}
                    className="mt-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline"
                  >
                    Xem thêm {remainingErrors} lỗi
                  </button>
                )}
                {expandedErrors && remainingErrors > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedErrors(false)}
                    className="mt-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Thu gọn
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isImporting}
            className="mobile-touch-target rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {alreadyApplied ? 'Đóng' : 'Hủy'}
          </button>
          {!alreadyApplied && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirm}
              className="mobile-touch-target rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? 'Đang lưu...' : 'Xác nhận nhập'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PcnCustomerExportModal({
  totalCount,
  filteredCount,
  onExport,
  onClose,
}: {
  totalCount: number;
  filteredCount: number;
  onExport: (scope: 'all' | 'filtered') => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'all' | 'filtered'>('all');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Download className="text-emerald-600" size={18} /> Xuất Excel khách hàng
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 py-4 text-xs">
          <p className="text-slate-600">Chọn phạm vi dữ liệu xuất ra tệp Excel (.xlsx):</p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="font-bold text-slate-800">Toàn bộ danh sách</div>
                <div className="text-[11px] text-slate-500">{totalCount} khách hàng trong hệ thống</div>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'filtered'}
                onChange={() => setScope('filtered')}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="font-bold text-slate-800">Kết quả lọc ({filteredCount} khách hàng)</div>
                <div className="text-[11px] text-slate-500">Các khách hàng khớp bộ lọc hiện tại</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onExport(scope)}
            className="mobile-touch-target rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white hover:bg-emerald-500"
          >
            Tải tệp Excel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PcnCustomersManagementView({ initialSearchQuery = '' }: { initialSearchQuery?: string }) {
  const customers = usePcnStore((state) => state.customers);
  const addCustomer = usePcnStore((state) => state.addCustomer);
  const updateCustomer = usePcnStore((state) => state.updateCustomer);
  const deleteCustomer = usePcnStore((state) => state.deleteCustomer);
  const sessionUser = usePcnSessionStore((state) => state.currentUser);
  const currentUser = sessionUser ?? usePcnSessionStore.getState().currentUser;
  const canEditCustomers = currentUser?.systemRole !== 'viewer' && currentUser?.role !== 'viewer';

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addForm, setAddForm] = useState(emptyCustomerForm);
  const [editForm, setEditForm] = useState(emptyCustomerForm);
  const [contactStatusFilter, setContactStatusFilter] = useState<PcnCustomerContactFilter>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('');
  const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const [importPreview, setImportPreview] = useState<CustomerImportPreviewData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const isImportingRef = useRef(false);
  const previewAppliedRef = useRef(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
    setCurrentPage(1);
  }, [initialSearchQuery]);

  const customerFilterOptions = useMemo(() => getPcnCustomerFilterOptions(customers), [customers]);
  const filteredCustomers = useMemo(() => {
    return filterPcnCustomers(customers, {
      searchQuery,
      contactStatus: contactStatusFilter,
      region: regionFilter,
      businessType: businessTypeFilter,
    });
  }, [customers, searchQuery, contactStatusFilter, regionFilter, businessTypeFilter]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedCustomers = useMemo(() => {
    if (pageSize === 'ALL') return filteredCustomers;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, pageSize, safeCurrentPage]);

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(emptyCustomerForm);
  };

  const handleStartEdit = (customer: CustomerRef) => {
    if (!canEditCustomers) return;
    setEditingId(getPcnDocumentId(customer));
    setEditForm(customerFormFrom(customer));
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!canEditCustomers || !editingId) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      toast.error('Vui lòng nhập tên khách hàng.');
      return;
    }
    setIsSaving(true);
    try {
      await updateCustomer(editingId, {
        name: cleanName,
        address: editForm.address.trim(),
        taxId: editForm.taxId.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        contactPerson: editForm.contactPerson.trim(),
      });
      toast.success('Đã cập nhật thông tin khách hàng.');
      cancelEditing();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật khách hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAdd = async () => {
    if (!canEditCustomers) return;
    const cleanName = addForm.name.trim();
    const cleanCode = addForm.customerCode.trim();
    if (!cleanName) {
      toast.error('Vui lòng nhập tên khách hàng.');
      return;
    }
    const nextId = normalizeSearch(cleanCode || cleanName);
    if (customers.some((customer) => normalizeSearch(getPcnDocumentId(customer)) === nextId)) {
      toast.error('Mã hoặc tên khách hàng này đã tồn tại.');
      return;
    }
    setIsSaving(true);
    try {
      await addCustomer({
        name: cleanName,
        customerCode: cleanCode,
        address: addForm.address.trim(),
        taxId: addForm.taxId.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim(),
        contactPerson: addForm.contactPerson.trim(),
      });
      toast.success('Đã thêm khách hàng mới.');
      setIsAdding(false);
      setAddForm(emptyCustomerForm);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể thêm khách hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!canEditCustomers) return;
    setIsSaving(true);
    try {
      await deleteCustomer(customerId);
      toast.success('Đã xóa khách hàng.');
      setConfirmDelete(null);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa khách hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const preview = prepareCustomerImportPreview({
        fileName: file.name,
        fileBuffer: buffer,
        currentCustomers: customers,
      });
      setImportPreview(preview);
      setAlreadyApplied(false);
      previewAppliedRef.current = false;
      setImportResult(null);
    } catch (err: any) {
      toast.error('Không thể đọc tệp Excel: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!canEditCustomers || !importPreview || isImportingRef.current || previewAppliedRef.current) {
      return;
    }
    if (importPreview.validCustomers.length === 0) {
      toast.error('Không có khách hàng hợp lệ để nhập.');
      return;
    }
    isImportingRef.current = true;
    previewAppliedRef.current = true;
    setIsImporting(true);
    setAlreadyApplied(true);
    try {
      const res = await executeCustomerImport({
        fileBuffer: importPreview.fileBuffer,
        previewCustomers: importPreview.validCustomers,
        getLatestCustomers: () => usePcnStore.getState().customers,
        addCustomer,
      });
      setImportResult(res);
      if (res.successCount > 0) {
        toast.success(`Đã nhập thành công ${res.successCount} khách hàng.`);
      }
      if (res.failedCount > 0) {
        toast.error(`Có ${res.failedCount} bản ghi không thể nhập.`);
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu khách hàng: ' + (err?.message || ''));
    } finally {
      setIsImporting(false);
      isImportingRef.current = false;
    }
  };

  const handleExport = (scope: 'all' | 'filtered') => {
    try {
      const wb = exportPcnCustomersWorkbook({
        customers,
        filteredCustomers,
        scope,
      });
      downloadCustomerWorkbook(wb, 'danh-sach-khach-hang-pcn.xlsx');
      toast.success(`Đã xuất ${scope === 'filtered' ? filteredCustomers.length : customers.length} khách hàng ra file Excel.`);
      setShowExportModal(false);
    } catch (err: any) {
      toast.error('Không thể xuất file Excel: ' + (err?.message || ''));
    }
  };

  return (
    <div data-testid="pcn-customers-management-surface" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/50 p-3 mobile-safe-bottom md:p-5 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-emerald-500">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-800"><Building className="text-emerald-600" size={20} /> Danh sách khách hàng</h2>
          <p className="mt-0.5 text-xs text-slate-500">Dữ liệu khách hàng PCN dùng để lập Đề nghị và bộ hồ sơ chứng nhận.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-emerald-700"
            title="Xuất danh sách khách hàng ra Excel"
            aria-label="Xuất Excel"
          >
            <Download size={14} /> Xuất Excel
          </button>
          {canEditCustomers && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                aria-label="Chọn tệp Excel khách hàng"
                onChange={handleFileSelect}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              />
              <button
                ref={importTriggerRef}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-emerald-700"
                title="Nhập khách hàng từ tệp Excel"
                aria-label="Nhập Excel"
              >
                <Upload size={14} /> Nhập Excel
              </button>
            </>
          )}
          {!isAdding && canEditCustomers && <button onClick={() => { setIsAdding(true); cancelEditing(); }} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95"><Plus size={14} /> Thêm khách hàng</button>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-3 sm:px-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  aria-label="Tìm khách hàng"
                  type="search"
                  value={searchQuery}
                  placeholder="Tìm theo tên, mã KH, MST, người liên hệ, SĐT..."
                  onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                  className="mobile-touch-target min-h-9 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs outline-none transition focus:border-emerald-500"
                />
              </div>

              <div className="min-w-[170px]">
                <select
                  aria-label="Lọc tình trạng liên hệ"
                  value={contactStatusFilter}
                  onChange={(event) => { setContactStatusFilter(event.target.value as PcnCustomerContactFilter); setCurrentPage(1); }}
                  className="mobile-touch-target min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs outline-none transition focus:border-emerald-500"
                >
                  <option value="all">Tất cả tình trạng liên hệ</option>
                  <option value="with-contact">Có liên hệ</option>
                  <option value="without-contact">Chưa có liên hệ</option>
                </select>
              </div>

              <PcnCustomerMetadataFilterControls
                options={customerFilterOptions}
                regionFilter={regionFilter}
                onRegionChange={(value) => { setRegionFilter(value); setCurrentPage(1); }}
                businessTypeFilter={businessTypeFilter}
                onBusinessTypeChange={(value) => { setBusinessTypeFilter(value); setCurrentPage(1); }}
              />

              {(Boolean(searchQuery) || contactStatusFilter !== 'all' || Boolean(regionFilter) || Boolean(businessTypeFilter)) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setContactStatusFilter('all');
                    setRegionFilter('');
                    setBusinessTypeFilter('');
                    setCurrentPage(1);
                  }}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={13} /> Xóa lọc
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end">
              <span className="rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs">
                {filteredCustomers.length === customers.length
                  ? `${customers.length} khách hàng`
                  : `${filteredCustomers.length} / ${customers.length} khách hàng`}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="hidden md:table w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="w-28 py-3 pl-4 pr-3">Mã KH</th>
                <th className="w-[30%] py-3 px-3">Tên doanh nghiệp</th>
                <th className="w-[34%] py-3 px-3">Địa chỉ & MST</th>
                <th className="py-3 px-3">Thông tin liên hệ</th>
                <th className="w-24 py-3 pl-3 pr-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isAdding && canEditCustomers && (
                <tr className="bg-emerald-50/40 border-b border-emerald-100">
                  <td className="py-3 pl-4 pr-3 align-top">
                    <CustomerInput value={addForm.customerCode} placeholder="Mã KH" ariaLabel="Mã khách hàng mới" onChange={(value) => setAddForm({ ...addForm, customerCode: value })} />
                  </td>
                  <td className="py-3 px-3 align-top">
                    <CustomerInput value={addForm.name} placeholder="Tên doanh nghiệp" ariaLabel="Tên doanh nghiệp mới" onChange={(value) => setAddForm({ ...addForm, name: value })} />
                  </td>
                  <td className="space-y-1.5 py-3 px-3 align-top">
                    <CustomerInput value={addForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setAddForm({ ...addForm, address: value })} />
                    <CustomerInput value={addForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setAddForm({ ...addForm, taxId: value })} />
                  </td>
                  <td className="space-y-1 py-3 px-3 align-top">
                    <div className="grid grid-cols-2 gap-1">
                      <CustomerInput value={addForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setAddForm({ ...addForm, phone: value })} />
                      <CustomerInput type="email" value={addForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setAddForm({ ...addForm, email: value })} />
                    </div>
                    <CustomerInput value={addForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setAddForm({ ...addForm, contactPerson: value })} />
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right align-top">
                    <div className="flex justify-end gap-1">
                      <button disabled={isSaving} onClick={handleSaveAdd} className="mobile-touch-target rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-50" title="Lưu" aria-label="Lưu khách hàng mới">
                        <Check size={14} />
                      </button>
                      <button disabled={isSaving} onClick={() => { setIsAdding(false); setAddForm(emptyCustomerForm); }} className="mobile-touch-target rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-50" title="Hủy" aria-label="Hủy thêm khách hàng">
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {filteredCustomers.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs italic text-slate-400">
                    Không tìm thấy khách hàng nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer, index) => {
                  const customerId = getPcnDocumentId(customer);
                  const rowKey = customerId || `pcn-customer-${index}`;
                  const isEditing = editingId === customerId;
                  const emptyRecord = isEmptyCustomer(customer);

                  return (
                    <tr key={rowKey} className={`transition-colors hover:bg-slate-50/70 ${isEditing ? 'bg-emerald-50/20' : emptyRecord ? 'bg-amber-50/40' : ''}`}>
                      <td className="py-3 pl-4 pr-3 align-top">
                        {isEditing ? (
                          <CustomerInput value={editForm.customerCode} onChange={() => undefined} disabled ariaLabel="Mã khách hàng" />
                        ) : (
                          <PcnCustomerCodeDisplay customer={customer} />
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        {isEditing ? (
                          <CustomerInput value={editForm.name} ariaLabel="Tên khách hàng" onChange={(value) => setEditForm({ ...editForm, name: value })} />
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-slate-900 leading-snug">
                              {customer.name || <span className="italic font-normal text-slate-400">Chưa có tên khách hàng</span>}
                            </div>
                            {emptyRecord && (
                              <span title="Không có dữ liệu nghiệp vụ" className="inline-flex items-center gap-1 rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                <AlertCircle size={10} /> Cần rà soát
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <CustomerInput value={editForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setEditForm({ ...editForm, address: value })} />
                            <CustomerInput value={editForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setEditForm({ ...editForm, taxId: value })} />
                          </div>
                        ) : (
                          <div className="space-y-1 text-xs">
                            <div className="text-slate-600 leading-snug line-clamp-2" title={customer.address || undefined}>
                              {customer.address ? (
                                customer.address
                              ) : (
                                <span className="italic text-slate-400 text-[11px]">Chưa có địa chỉ</span>
                              )}
                            </div>
                            {customer.taxId ? (
                              <div className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">
                                <span className="text-slate-400 font-sans">MST:</span>
                                <span>{customer.taxId}</span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        {isEditing ? (
                          <div className="space-y-1">
                            <div className="grid grid-cols-2 gap-1">
                              <CustomerInput value={editForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setEditForm({ ...editForm, phone: value })} />
                              <CustomerInput type="email" value={editForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setEditForm({ ...editForm, email: value })} />
                            </div>
                            <CustomerInput value={editForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setEditForm({ ...editForm, contactPerson: value })} />
                          </div>
                        ) : (
                          <PcnCustomerContactDisplay customer={customer} />
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right align-top">
                        {canEditCustomers && <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button disabled={isSaving} onClick={handleSaveEdit} className="mobile-touch-target rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-50" title="Lưu" aria-label="Lưu thông tin khách hàng">
                                <Check size={14} />
                              </button>
                              <button disabled={isSaving} onClick={cancelEditing} className="mobile-touch-target rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-50" title="Hủy" aria-label="Hủy chỉnh sửa">
                                <X size={14} />
                              </button>
                            </>
                          ) : confirmDelete === customerId ? (
                            <div className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 p-1">
                              <span className="px-1 text-[11px] font-bold text-red-600">Xóa?</span>
                              <button disabled={isSaving} onClick={() => handleDelete(customerId)} className="mobile-touch-target rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50">Có</button>
                              <button disabled={isSaving} onClick={() => setConfirmDelete(null)} className="mobile-touch-target rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-300">Không</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => handleStartEdit(customer)} className="mobile-touch-target rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700" title="Sửa khách hàng" aria-label={`Sửa khách hàng ${customer.name || customer.customerCode}`}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setConfirmDelete(customerId)} className="mobile-touch-target rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Xóa khách hàng" aria-label={`Xóa khách hàng ${customer.name || customer.customerCode}`}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {isAdding && canEditCustomers && (
            <div className="bg-emerald-50/30 p-3 space-y-2">
              <div className="font-bold text-xs text-emerald-800">Thêm khách hàng mới</div>
              <CustomerInput value={addForm.customerCode} placeholder="Mã KH" ariaLabel="Mã khách hàng mới" onChange={(value) => setAddForm({ ...addForm, customerCode: value })} />
              <CustomerInput value={addForm.name} placeholder="Tên doanh nghiệp" ariaLabel="Tên doanh nghiệp mới" onChange={(value) => setAddForm({ ...addForm, name: value })} />
              <CustomerInput value={addForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setAddForm({ ...addForm, taxId: value })} />
              <CustomerInput value={addForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setAddForm({ ...addForm, address: value })} />
              <div className="grid grid-cols-2 gap-1.5">
                <CustomerInput value={addForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setAddForm({ ...addForm, phone: value })} />
                <CustomerInput type="email" value={addForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setAddForm({ ...addForm, email: value })} />
              </div>
              <CustomerInput value={addForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setAddForm({ ...addForm, contactPerson: value })} />
              <div className="flex justify-end gap-2 pt-1">
                <button disabled={isSaving} onClick={handleSaveAdd} className="mobile-touch-target min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Lưu</button>
                <button disabled={isSaving} onClick={() => { setIsAdding(false); setAddForm(emptyCustomerForm); }} className="mobile-touch-target min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Hủy</button>
              </div>
            </div>
          )}

          {filteredCustomers.length === 0 && !isAdding ? (
            <div className="p-6 text-center text-xs italic text-slate-400">Không tìm thấy khách hàng nào phù hợp.</div>
          ) : (
            paginatedCustomers.map((customer, index) => {
              const customerId = getPcnDocumentId(customer);
              const cardKey = customerId || `pcn-customer-card-${index}`;
              const isEditing = editingId === customerId;
              const emptyRecord = isEmptyCustomer(customer);

              if (isEditing) {
                return (
                  <div key={cardKey} className="bg-emerald-50/20 p-3 space-y-2">
                    <div className="font-bold text-xs text-emerald-800">Chỉnh sửa khách hàng</div>
                    <CustomerInput value={editForm.name} ariaLabel="Tên khách hàng" onChange={(value) => setEditForm({ ...editForm, name: value })} />
                    <CustomerInput value={editForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setEditForm({ ...editForm, taxId: value })} />
                    <CustomerInput value={editForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setEditForm({ ...editForm, address: value })} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <CustomerInput value={editForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setEditForm({ ...editForm, phone: value })} />
                      <CustomerInput type="email" value={editForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setEditForm({ ...editForm, email: value })} />
                    </div>
                    <CustomerInput value={editForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setEditForm({ ...editForm, contactPerson: value })} />
                    <div className="flex justify-end gap-2 pt-1">
                      <button disabled={isSaving} onClick={handleSaveEdit} className="mobile-touch-target min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Lưu</button>
                      <button disabled={isSaving} onClick={cancelEditing} className="mobile-touch-target min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Hủy</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={cardKey} className={`p-3 space-y-2 transition-colors hover:bg-slate-50/60 ${emptyRecord ? "bg-amber-50/40" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <PcnCustomerCodeDisplay customer={customer} />
                        {emptyRecord && <span title="Không có dữ liệu nghiệp vụ" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800"><AlertCircle size={10} /> Cần rà soát</span>}
                      </div>
                      <div className="text-sm font-bold text-slate-900 break-words">{customer.name || "Chưa có tên khách hàng"}</div>
                    </div>
                    {canEditCustomers && (
                      <div className="flex shrink-0 items-center gap-1">
                        {confirmDelete === customerId ? (
                          <div className="flex items-center gap-1 rounded-md border border-red-100 bg-red-50 p-1">
                            <span className="text-[10px] font-bold text-red-600">Xóa?</span>
                            <button disabled={isSaving} onClick={() => handleDelete(customerId)} className="mobile-touch-target min-h-9 rounded bg-red-500 px-2 text-[10px] font-bold text-white hover:bg-red-600 disabled:opacity-50">Có</button>
                            <button disabled={isSaving} onClick={() => setConfirmDelete(null)} className="mobile-touch-target min-h-9 rounded bg-slate-200 px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-300">Không</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => handleStartEdit(customer)} className="mobile-touch-target min-h-11 min-w-11 rounded-md p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" title="Sửa khách hàng" aria-label={`Sửa khách hàng ${customer.name || customer.customerCode}`}><Edit2 size={15} /></button>
                            <button onClick={() => setConfirmDelete(customerId)} className="mobile-touch-target min-h-11 min-w-11 rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Xóa khách hàng" aria-label={`Xóa khách hàng ${customer.name || customer.customerCode}`}><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    {customer.taxId && <div className="font-mono font-semibold text-slate-800"><span className="text-slate-400 font-sans font-normal">MST:</span> {customer.taxId}</div>}
                    {customer.address && <div><span className="text-slate-400">ĐC:</span> {customer.address}</div>}
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <PcnCustomerContactDisplay customer={customer} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Thanh phân trang Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Hiển thị</span>
              <select
                aria-label="Số bản ghi khách hàng trên mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="mobile-touch-target min-h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs outline-none transition focus:border-emerald-500"
              >
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value="ALL">Tất cả</option>
              </select>
              <span>(Tổng {filteredCustomers.length} khách hàng)</span>
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="mobile-touch-target min-h-8 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-2 text-xs font-semibold text-slate-700">
                  Trang {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="mobile-touch-target min-h-8 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showExportModal && (
        <PcnCustomerExportModal
          totalCount={customers.length}
          filteredCount={filteredCustomers.length}
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {importPreview && (
        <PcnCustomerImportPreview
          preview={importPreview}
          isImporting={isImporting}
          alreadyApplied={alreadyApplied}
          importResult={importResult}
          triggerRef={importTriggerRef}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            if (!isImporting) {
              setImportPreview(null);
              setImportResult(null);
              importTriggerRef.current?.focus();
            }
          }}
        />
      )}
    </div>
  );
}

// --- End of PcnCustomersManagementView.tsx ---
