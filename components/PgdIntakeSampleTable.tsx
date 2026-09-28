'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  PGD_SAMPLE_TYPE_OPTIONS,
  type PgdIntakeSampleDraft,
  type PgdProductGroup,
} from '../utils/pgdDomain';

type PgdIntakeSampleTableProps = {
  productGroup: PgdProductGroup;
  rows: PgdIntakeSampleDraft[];
  onChange: (rows: PgdIntakeSampleDraft[]) => void;
  disabled?: boolean;
};

const inputClassName = 'mobile-touch-target min-h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:bg-slate-100';

function SampleField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1 block text-[11px] font-black text-slate-500">{label}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
}

function defaultSample(index: number, productGroup: PgdProductGroup): PgdIntakeSampleDraft {
  const firstOption = PGD_SAMPLE_TYPE_OPTIONS.find((option) => (option.productGroups as readonly PgdProductGroup[]).includes(productGroup));
  return {
    id: `draft-${Date.now()}-${index}`,
    sampleCode: `M${String(index + 1).padStart(2, '0')}`,
    catalogOptionId: firstOption?.id,
    sampleTypeLabel: firstOption?.label || '',
    quantity: 1,
    unit: productGroup === 'MACHINERY_LINE' ? 'bộ' : 'kg',
    disposition: 'RETAINED',
  };
}

export default function PgdIntakeSampleTable({ productGroup, rows, onChange, disabled = false }: PgdIntakeSampleTableProps) {
  const options = PGD_SAMPLE_TYPE_OPTIONS.filter((option) => (option.productGroups as readonly PgdProductGroup[]).includes(productGroup));
  const sampleCatalogId = `pgd-sample-catalog-options-${productGroup.toLowerCase()}`;
  const totalQuantity = rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0), 0);
  const duplicateCodes = new Set(rows.map((row) => String(row.sampleCode || '').trim().toLocaleUpperCase()).filter(Boolean).filter((code, index, all) => all.indexOf(code) !== index));

  const updateRow = (index: number, patch: Partial<PgdIntakeSampleDraft>) => {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  const updateSampleLabel = (index: number, value: string) => {
    const selected = options.find((option) => option.label === value);
    updateRow(index, selected
      ? { sampleTypeLabel: selected.label, catalogOptionId: selected.id, customLabel: undefined }
      : { sampleTypeLabel: value, catalogOptionId: undefined, customLabel: value });
  };

  return <section className="rounded-xl border border-slate-200 bg-white p-3" aria-label="Bảng tổng hợp mẫu">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-xs font-black text-slate-900">Bảng tổng hợp mẫu</h2>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Chọn tên mẫu từ danh mục hoặc gõ <b>Mẫu khác</b> tùy chọn. Các dòng được lưu cùng PYC.</p>
      </div>
      <button type="button" onClick={() => onChange([...rows, defaultSample(rows.length, productGroup)])} disabled={disabled} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} aria-hidden="true" /> Thêm mẫu</button>
    </div>

    <datalist id={sampleCatalogId}>{options.map((option) => <option key={option.id} value={option.label}>{option.id}</option>)}</datalist>
    <div className="mobile-scroll-x mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[1040px] border-collapse text-left" aria-label="Danh sách mẫu PGD">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2">Mã mẫu <span className="text-rose-600">*</span></th>
            <th className="px-2 py-2">Tên/mô tả mẫu <span className="text-rose-600">*</span></th>
            <th className="w-24 px-2 py-2">Số lượng <span className="text-rose-600">*</span></th>
            <th className="w-24 px-2 py-2">Đơn vị <span className="text-rose-600">*</span></th>
            <th className="w-32 px-2 py-2">Phân loại mẫu <span className="text-rose-600">*</span></th>
            <th className="w-32 px-2 py-2">Số niêm phong {rows.some((row) => row.disposition === 'RETAINED') && <span className="text-rose-600">*</span>}</th>
            <th className="w-36 px-2 py-2">Tên PTN {rows.some((row) => row.disposition === 'LAB') && <span className="text-rose-600">*</span>}</th>
            <th className="w-14 px-2 py-2 text-center">&nbsp;</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-5 text-center text-[11px] text-slate-500">Chưa có mẫu. Bấm “Thêm mẫu” để lập bảng mẫu.</td></tr>}
          {rows.map((row, index) => <tr key={row.id || `${row.sampleCode}-${index}`} className="align-top">
            <td className="px-2 py-2"><input aria-label={`Mã mẫu dòng ${index + 1}`} required value={row.sampleCode} onChange={(event) => updateRow(index, { sampleCode: event.target.value })} className={`${inputClassName} ${duplicateCodes.has(String(row.sampleCode || '').trim().toLocaleUpperCase()) ? 'border-rose-400 bg-rose-50' : ''}`} disabled={disabled} />{duplicateCodes.has(String(row.sampleCode || '').trim().toLocaleUpperCase()) && <p role="alert" className="mt-1 text-[11px] font-bold text-rose-700">Mã mẫu trùng</p>}</td>
            <td className="px-2 py-2"><input aria-label={`Tên/mô tả mẫu dòng ${index + 1}`} required list={sampleCatalogId} value={row.sampleTypeLabel} onChange={(event) => updateSampleLabel(index, event.target.value)} className={inputClassName} disabled={disabled} /></td>
            <td className="px-2 py-2"><input aria-label={`Số lượng mẫu dòng ${index + 1}`} required type="number" min="0.001" step="any" value={row.quantity} onChange={(event) => updateRow(index, { quantity: Number(event.target.value) })} className={inputClassName} disabled={disabled} /></td>
            <td className="px-2 py-2"><input aria-label={`Đơn vị mẫu dòng ${index + 1}`} required value={row.unit || ''} onChange={(event) => updateRow(index, { unit: event.target.value })} className={inputClassName} disabled={disabled} /></td>
            <td className="px-2 py-2"><select aria-label={`Phân loại mẫu dòng ${index + 1}`} required value={row.disposition} onChange={(event) => updateRow(index, { disposition: event.target.value as PgdIntakeSampleDraft['disposition'] })} className={inputClassName} disabled={disabled}><option value="RETAINED">Mẫu lưu</option><option value="LAB">Gửi PTN</option></select></td>
            <td className="px-2 py-2"><SampleField label="Số niêm phong" required={row.disposition === 'RETAINED'}><input aria-label={`Số niêm phong dòng ${index + 1}`} required={row.disposition === 'RETAINED'} value={row.sealNumber || ''} onChange={(event) => updateRow(index, { sealNumber: event.target.value })} className={inputClassName} disabled={disabled} /></SampleField></td>
            <td className="px-2 py-2"><SampleField label="Tên PTN" required={row.disposition === 'LAB'}><input aria-label={`Tên PTN dòng ${index + 1}`} required={row.disposition === 'LAB'} value={row.laboratoryName || ''} onChange={(event) => updateRow(index, { laboratoryName: event.target.value })} className={inputClassName} disabled={disabled} /></SampleField></td>
            <td className="px-2 py-2 text-center"><button type="button" aria-label={`Xóa mẫu dòng ${index + 1}`} title="Xóa mẫu" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={disabled} className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"><Trash2 size={14} aria-hidden="true" /></button></td>
          </tr>)}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50 text-[11px] font-black text-slate-700"><tr><td colSpan={2} className="px-2 py-2 text-right">Tổng số lượng</td><td className="px-2 py-2">{totalQuantity || 0}</td><td colSpan={5} className="px-2 py-2 text-slate-500">{rows.length} dòng mẫu</td></tr></tfoot>
      </table>
    </div>
  </section>;
}
