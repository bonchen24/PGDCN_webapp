'use client';

import { useMemo } from 'react';
import { Building2, Eye } from 'lucide-react';

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

export default function PgdcnCustomersView({ scopes }: { scopes: readonly DepartmentScope[] }) {
  const pcnCustomers = usePcnStore((state) => state.customers);
  const pgdCustomers = usePgdStore((state) => state.customers);
  const customers = useMemo(() => mergeCustomers(pcnCustomers, pgdCustomers), [pcnCustomers, pgdCustomers]);

  if (scopes.includes('PCN')) return <PcnCustomersManagementView />;

  return (
    <section className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-3 bg-slate-50/60 p-3 md:p-5">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"><Building2 size={14} className="text-blue-600" /> Dùng chung PGDCN</div>
        <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Khách hàng</h1>
        <p className="mt-1 text-[11px] text-slate-500">Danh mục liên hệ dùng để chọn khi lập PYC. Tài khoản chỉ có scope PGD xem projection này; chỉnh sửa danh mục thực hiện ở boundary dữ liệu dùng chung.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5"><div className="flex items-center gap-2"><Eye size={15} className="text-blue-600" /><span className="text-xs font-black text-slate-800">Danh sách khách hàng</span></div><span className="text-[10px] font-bold text-slate-400">{customers.length}</span></div>
        {customers.length === 0 ? <div className="p-10 text-center text-[11px] text-slate-400">Chưa có khách hàng dùng chung.</div> : <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">{customers.map((customer) => <article key={customerKey(customer)} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><h2 className="text-xs font-black text-slate-800">{customer.name || 'Chưa có tên khách hàng'}</h2><p className="mt-1 text-[10px] text-slate-500">{customer.address || 'Chưa có địa chỉ'}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400"><span>{customer.customerCode || 'Chưa có mã'}</span>{customer.taxId && <span>MST {customer.taxId}</span>}{customer.phone && <span>{customer.phone}</span>}</div></article>)}</div>}
      </div>
    </section>
  );
}
