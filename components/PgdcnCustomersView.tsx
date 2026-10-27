'use client';

import { useMemo, useState } from 'react';
import { Building2, Eye, X } from 'lucide-react';

import type { CustomerRef, DepartmentScope } from '../types';
import { usePcnStore } from '../store-pcn';
import { usePgdStore } from '../store-pgd';
import PcnCustomersManagementView from './PcnCustomersManagementView';

function customerKey(customer: CustomerRef): string {
  return String(customer.customerCode || customer.name || '').trim().toLocaleLowerCase('vi-VN');
}

function mergeCustomers(primary: CustomerRef[], fallback: CustomerRef[]): CustomerRef[] {
  const result = new Map<string, CustomerRef>();
  for (const customer of [...primary, ...fallback]) {
    const key = customerKey(customer);
    if (key && !result.has(key)) result.set(key, customer);
  }
  return Array.from(result.values()).sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'vi'));
}

function normalizeCustomerSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function filterCustomersBySearch(customers: CustomerRef[], query: string): CustomerRef[] {
  const normalizedQuery = normalizeCustomerSearchValue(query);
  if (!normalizedQuery) return customers;

  return customers.filter((customer) => [
    customer.name,
    customer.customerCode,
    customer.taxId,
    customer.contactPerson,
    customer.phone,
    customer.email,
  ].some((value) => normalizeCustomerSearchValue(value).includes(normalizedQuery)));
}

export default function PgdcnCustomersView({ scopes }: { scopes: readonly DepartmentScope[] }) {
  const pcnCustomers = usePcnStore((state) => state.customers);
  const pgdCustomers = usePgdStore((state) => state.customers);
  const customers = useMemo(() => mergeCustomers(pcnCustomers, pgdCustomers), [pcnCustomers, pgdCustomers]);

  if (scopes.includes('PCN')) return <PcnCustomersManagementView />;

  return <PgdCustomerSearchProjection customers={customers} />;
}

function PgdCustomerSearchProjection({ customers }: { customers: CustomerRef[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCustomers = useMemo(() => filterCustomersBySearch(customers, searchTerm), [customers, searchTerm]);
  const hasSearchQuery = Boolean(searchTerm.trim());

  return (
    <section className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-3 bg-slate-50/60 p-3 md:p-5">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"><Building2 size={14} className="text-blue-600" /> Dùng chung PGDCN</div>
        <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Khách hàng</h1>
        <p className="mt-1 text-[11px] text-slate-500">Danh mục liên hệ dùng để chọn khi lập PYC. Tài khoản chỉ có phạm vi PGD xem danh sách tổng hợp này; chỉnh sửa danh mục thực hiện ở vùng dữ liệu dùng chung.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2"><Eye size={15} className="shrink-0 text-blue-600" aria-hidden="true" /><span className="text-xs font-black text-slate-800">Danh sách khách hàng</span></div>
          <span role="status" aria-live="polite" aria-atomic="true" className="shrink-0 text-xs font-bold text-slate-500">
            {hasSearchQuery ? `${filteredCustomers.length} / ${customers.length} khách hàng` : `${customers.length} khách hàng`}
          </span>
        </div>
        <div role="search" aria-label="Tìm kiếm khách hàng dùng chung" className="border-b border-slate-100 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Tìm khách hàng</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tên, mã, MST, người liên hệ, điện thoại hoặc email"
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:text-sm"
              />
            </label>
            {hasSearchQuery && filteredCustomers.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <X size={16} aria-hidden="true" />
                Xóa tìm kiếm
              </button>
            )}
          </div>
        </div>
        {customers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Chưa có khách hàng dùng chung.</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center sm:p-10">
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy khách hàng phù hợp với “{searchTerm.trim()}”.</p>
            <p className="text-sm text-slate-500">Thử tên, mã khách hàng, mã số thuế hoặc thông tin liên hệ khác.</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <X size={16} aria-hidden="true" />
              Xóa tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid min-w-0 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <article key={customerKey(customer)} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <h2 className="break-words text-sm font-black text-slate-800">{customer.name || 'Chưa có tên khách hàng'}</h2>
                <p className="mt-1 break-words text-xs text-slate-600">{customer.address || 'Chưa có địa chỉ'}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
                  <span>{customer.customerCode || 'Chưa có mã'}</span>
                  {customer.taxId && <span>MST {customer.taxId}</span>}
                  {customer.contactPerson && <span>Người liên hệ: {customer.contactPerson}</span>}
                  {customer.phone && <span>{customer.phone}</span>}
                  {customer.email && <span className="[overflow-wrap:anywhere]">{customer.email}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
