'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building, Check, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { usePcnStore } from '../store-pcn';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { getPcnDocumentId } from '../utils/pcnStorePolicy';
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
    .trim();
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

export default function PcnCustomersManagementView({ initialSearchQuery = '' }: { initialSearchQuery?: string }) {
  const customers = usePcnStore((state) => state.customers);
  const addCustomer = usePcnStore((state) => state.addCustomer);
  const updateCustomer = usePcnStore((state) => state.updateCustomer);
  const deleteCustomer = usePcnStore((state) => state.deleteCustomer);
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const canEditCustomers = currentUser?.systemRole !== 'viewer' && currentUser?.role !== 'viewer';

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addForm, setAddForm] = useState(emptyCustomerForm);
  const [editForm, setEditForm] = useState(emptyCustomerForm);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
    setCurrentPage(1);
  }, [initialSearchQuery]);

  const filteredCustomers = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return customers;
    return customers.filter((customer) => [
      customer.name,
      customer.customerCode,
      customer.address,
      customer.taxId,
      customer.phone,
      customer.email,
      customer.contactPerson,
    ].some((value) => normalizeSearch(value).includes(query)));
  }, [customers, searchQuery]);

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

  const renderContact = (customer: CustomerRef) => (
    <div className="space-y-0.5">
      {customer.phone && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">SĐT:</span> <span className="font-mono">{customer.phone}</span></div>}
      {customer.email && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">Email:</span> {customer.email}</div>}
      {customer.contactPerson && <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">LH:</span> <span className="font-bold">{customer.contactPerson}</span></div>}
      {!customer.phone && !customer.email && !customer.contactPerson && <span className="text-[11px] italic text-slate-500">Chưa có liên hệ</span>}
    </div>
  );

  return (
    <div data-testid="pcn-customers-management-surface" className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/50 p-3 mobile-safe-bottom md:p-4 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-emerald-500">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-slate-800"><Building className="text-emerald-600" size={20} /> Danh sách khách hàng</h2>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Dữ liệu khách hàng PCN dùng để lập Đề nghị và bộ hồ sơ chứng nhận.</p>
        </div>
        {!isAdding && canEditCustomers && <button onClick={() => { setIsAdding(true); cancelEditing(); }} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95"><Plus size={14} /> Thêm khách hàng</button>}
      </div>

      <label className="block max-w-sm"><span className="mb-1 block text-[11px] font-black text-slate-600">Tìm kiếm khách hàng</span><div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input aria-label="Tìm khách hàng" type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-[11px] font-medium shadow-2xs outline-none focus:border-emerald-500" />
      </div></label>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50 font-black uppercase tracking-wider text-slate-500"><th className="w-28 p-3 pl-4">Mã KH</th><th className="w-56 p-3">Tên doanh nghiệp</th><th className="w-56 p-3">Địa chỉ & MST</th><th className="p-3">Thông tin liên hệ</th><th className="w-32 p-3 pr-4 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isAdding && canEditCustomers && <tr className="bg-emerald-50/30">
                <td className="p-2.5 pl-4"><CustomerInput value={addForm.customerCode} ariaLabel="Mã khách hàng mới" onChange={(value) => setAddForm({ ...addForm, customerCode: value })} /></td>
                <td className="p-2.5"><CustomerInput value={addForm.name} ariaLabel="Tên doanh nghiệp mới" onChange={(value) => setAddForm({ ...addForm, name: value })} /></td>
                <td className="space-y-1 p-2.5"><CustomerInput value={addForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setAddForm({ ...addForm, address: value })} /><CustomerInput value={addForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setAddForm({ ...addForm, taxId: value })} /></td>
                <td className="space-y-1 p-2.5"><div className="grid grid-cols-2 gap-1"><CustomerInput value={addForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setAddForm({ ...addForm, phone: value })} /><CustomerInput type="email" value={addForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setAddForm({ ...addForm, email: value })} /></div><CustomerInput value={addForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setAddForm({ ...addForm, contactPerson: value })} /></td>
                <td className="p-2.5 pr-4 text-right"><div className="flex justify-end gap-1"><button disabled={isSaving} onClick={handleSaveAdd} className="mobile-touch-target min-h-11 min-w-11 rounded-md bg-emerald-600 p-1 text-white hover:bg-emerald-500 disabled:opacity-50" title="Lưu" aria-label="Lưu khách hàng mới"><Check size={14} /></button><button disabled={isSaving} onClick={() => { setIsAdding(false); setAddForm(emptyCustomerForm); }} className="mobile-touch-target min-h-11 min-w-11 rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-50" title="Hủy" aria-label="Hủy thêm khách hàng"><X size={14} /></button></div></td>
              </tr>}

              {filteredCustomers.length === 0 && !isAdding ? <tr><td colSpan={5} className="p-6 text-center text-[11px] italic text-slate-400">Không tìm thấy khách hàng nào phù hợp.</td></tr> : paginatedCustomers.map((customer, index) => {
                const customerId = getPcnDocumentId(customer);
                const rowKey = customerId || `pcn-customer-${index}`;
                const isEditing = editingId === customerId;
                const emptyRecord = isEmptyCustomer(customer);
                return <tr key={rowKey} className={`transition-colors hover:bg-slate-50/55 ${isEditing ? 'bg-emerald-50/20' : emptyRecord ? 'bg-amber-50/60' : ''}`}>
                  <td className="p-2.5 pl-4">{isEditing ? <CustomerInput value={editForm.customerCode} onChange={() => undefined} disabled ariaLabel="Mã khách hàng" /> : <span className="rounded-md border border-emerald-100/50 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">{customer.customerCode || 'N/A'}</span>}</td>
                  <td className="p-2.5">{isEditing ? <CustomerInput value={editForm.name} ariaLabel="Tên khách hàng" onChange={(value) => setEditForm({ ...editForm, name: value })} /> : <div className="space-y-1"><div className="text-xs font-bold text-slate-800">{customer.name || 'Chưa có tên khách hàng'}</div>{emptyRecord && <span title="Không có dữ liệu nghiệp vụ" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[11px] font-black text-amber-800"><AlertCircle size={10} /> Cần rà soát</span>}</div>}</td>
                  <td className="space-y-1 p-2.5">{isEditing ? <><CustomerInput value={editForm.address} placeholder="Địa chỉ" ariaLabel="Địa chỉ" onChange={(value) => setEditForm({ ...editForm, address: value })} /><CustomerInput value={editForm.taxId} placeholder="Mã số thuế" ariaLabel="Mã số thuế" onChange={(value) => setEditForm({ ...editForm, taxId: value })} /></> : <><div className="text-[11px] text-slate-500">{customer.address ? <><span className="font-semibold text-slate-400">ĐC:</span> {customer.address}</> : <span className="italic text-slate-400">Chưa có địa chỉ</span>}</div>{customer.taxId && <div className="font-mono text-[11px] text-slate-500"><span className="font-semibold text-slate-400">MST:</span> {customer.taxId}</div>}</>}</td>
                  <td className="p-2.5">{isEditing ? <div className="space-y-1"><div className="grid grid-cols-2 gap-1"><CustomerInput value={editForm.phone} placeholder="Số điện thoại" ariaLabel="Số điện thoại" onChange={(value) => setEditForm({ ...editForm, phone: value })} /><CustomerInput type="email" value={editForm.email} placeholder="Email" ariaLabel="Email" onChange={(value) => setEditForm({ ...editForm, email: value })} /></div><CustomerInput value={editForm.contactPerson} placeholder="Người liên hệ" ariaLabel="Người liên hệ" onChange={(value) => setEditForm({ ...editForm, contactPerson: value })} /></div> : renderContact(customer)}</td>
                  <td className="p-2.5 pr-4 text-right">{canEditCustomers && <div className="flex justify-end gap-1">{isEditing ? <><button disabled={isSaving} onClick={handleSaveEdit} className="mobile-touch-target min-h-11 min-w-11 rounded-md bg-emerald-600 p-1 text-white hover:bg-emerald-500 disabled:opacity-50" title="Lưu" aria-label="Lưu thông tin khách hàng"><Check size={14} /></button><button disabled={isSaving} onClick={cancelEditing} className="mobile-touch-target min-h-11 min-w-11 rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-50" title="Hủy" aria-label="Hủy chỉnh sửa"><X size={14} /></button></> : confirmDelete === customerId ? <div className="flex items-center gap-1 rounded-md border border-red-100 bg-red-50 p-1"><span className="px-1 text-[11px] font-bold text-red-600">Xóa?</span><button disabled={isSaving} onClick={() => handleDelete(customerId)} className="mobile-touch-target min-h-11 rounded bg-red-500 px-2 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-50">Có</button><button disabled={isSaving} onClick={() => setConfirmDelete(null)} className="mobile-touch-target min-h-11 rounded bg-slate-200 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-300">Không</button></div> : <><button onClick={() => handleStartEdit(customer)} className="mobile-touch-target min-h-11 min-w-11 rounded-md p-1 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-700" title="Sửa khách hàng" aria-label={`Sửa khách hàng ${customer.name || customer.customerCode}`}><Edit2 size={13} /></button><button onClick={() => setConfirmDelete(customerId)} className="mobile-touch-target min-h-11 min-w-11 rounded-md p-1 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title="Xóa khách hàng" aria-label={`Xóa khách hàng ${customer.name || customer.customerCode}`}><Trash2 size={13} /></button></>}</div>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        {/* Thanh phân trang Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Hiển thị:</span>
              <select
                aria-label="Số bản ghi khách hàng trên mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="mobile-touch-target min-h-9 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-emerald-400"
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
                  className="mobile-touch-target min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  Trang {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="mobile-touch-target min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- End of PcnCustomersManagementView.tsx ---
