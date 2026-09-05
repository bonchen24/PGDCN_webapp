'use client';

import React from 'react';

import type { PgdCoalDetails, PgdMachineryDetails, PgdProductGroup } from '../utils/pgdDomain';

type PgdProductGroupFieldsProps = {
  productGroup: PgdProductGroup;
  method: string;
  machinery: PgdMachineryDetails;
  coal: PgdCoalDetails;
  onMachineryChange: <K extends keyof PgdMachineryDetails>(key: K, value: PgdMachineryDetails[K]) => void;
  onCoalChange: <K extends keyof PgdCoalDetails>(key: K, value: PgdCoalDetails[K]) => void;
};

const inputClassName = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

function ProductField({
  label,
  value,
  type = 'text',
  step,
  required = false,
  onChange,
}: {
  label: string;
  value: string | number | undefined;
  type?: 'text' | 'number';
  step?: number | 'any';
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">{label}{required ? ' *' : ''}</span><input required={required} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? (step ?? 1) : undefined} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={inputClassName} /></label>;
}

function ProductTextArea({
  label,
  value,
  required = false,
  onChange,
}: {
  label: string;
  value: string | undefined;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return <label className="block md:col-span-2"><span className="mb-1 block text-[10px] font-black text-slate-500">{label}{required ? ' *' : ''}</span><textarea required={required} rows={2} value={value || ''} onChange={(event) => onChange(event.target.value)} className={inputClassName} /></label>;
}

export default function PgdProductGroupFields({
  productGroup,
  method,
  machinery,
  coal,
  onMachineryChange,
  onCoalChange,
}: PgdProductGroupFieldsProps) {
  if (productGroup === 'MACHINERY_LINE') {
    return <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3" aria-label="Thông tin máy móc / dây chuyền">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-black text-indigo-950">Thông tin máy móc / dây chuyền</h2><p className="mt-1 text-[10px] leading-4 text-indigo-800">Nhập theo hồ sơ kỹ thuật, model/serial, tình trạng và mức độ đầy đủ của máy. Tính đồng bộ là bằng chứng riêng khi áp dụng QT-GĐ-12.</p></div><span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black text-indigo-700">GĐ-MAY-01</span></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ProductField label="Loại máy / thiết bị" required value={machinery.machineType} onChange={(value) => onMachineryChange('machineType', value)} />
        <ProductField label="Model máy" required value={machinery.model} onChange={(value) => onMachineryChange('model', value)} />
        <ProductField label="Số serial / nhận dạng" required value={machinery.serialNumber} onChange={(value) => onMachineryChange('serialNumber', value)} />
        <ProductField label="Năm sản xuất" required type="number" value={machinery.manufacturingYear} onChange={(value) => onMachineryChange('manufacturingYear', value ? Number(value) : undefined)} />
        <ProductField label="Mức độ đầy đủ / phụ kiện" value={machinery.completeness} onChange={(value) => onMachineryChange('completeness', value)} />
        <ProductField label="Tình trạng lắp đặt" value={machinery.installationStatus} onChange={(value) => onMachineryChange('installationStatus', value)} />
        <ProductField label="Tiêu chuẩn an toàn áp dụng" value={machinery.safetyStandard} onChange={(value) => onMachineryChange('safetyStandard', value)} />
        <ProductTextArea label="Thông số kỹ thuật" required value={machinery.technicalParameters} onChange={(value) => onMachineryChange('technicalParameters', value)} />
        <ProductTextArea label="Tình trạng máy" required value={machinery.condition} onChange={(value) => onMachineryChange('condition', value)} />
        <ProductTextArea label={`Tính đồng bộ dây chuyền${method === 'QT-GĐ-12' ? ' *' : ''}`} required={method === 'QT-GĐ-12'} value={machinery.synchronization} onChange={(value) => onMachineryChange('synchronization', value)} />
      </div>
    </section>;
  }

  if (productGroup === 'COAL') {
    return <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3" aria-label="Thông tin lô than">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-black text-amber-950">Thông tin lô than</h2><p className="mt-1 text-[10px] leading-4 text-amber-800">Ghi nhận nguồn/mỏ, cỡ hạt, căn cứ chất lượng và các chỉ tiêu PTN có thể dùng cho báo cáo.</p></div><span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[9px] font-black text-amber-700">GĐ-THAN-01</span></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ProductField label="Loại than" required value={coal.coalType} onChange={(value) => onCoalChange('coalType', value)} />
        <ProductField label="Nguồn / mỏ than" required value={coal.source} onChange={(value) => onCoalChange('source', value)} />
        <ProductField label="Cỡ hạt" value={coal.sizeRange} onChange={(value) => onCoalChange('sizeRange', value)} />
        <ProductField label={`Tiêu chuẩn chất lượng than${method === 'QT-GĐ-08' ? ' *' : ''}`} required={method === 'QT-GĐ-08'} value={coal.qualityStandard} onChange={(value) => onCoalChange('qualityStandard', value)} />
        <ProductField label={`Căn cứ lấy mẫu than${method === 'QT-GĐ-08' ? ' *' : ''}`} required={method === 'QT-GĐ-08'} value={coal.samplingBasis} onChange={(value) => onCoalChange('samplingBasis', value)} />
        <ProductField label="Độ ẩm (%)" type="number" step="any" value={coal.moisture} onChange={(value) => onCoalChange('moisture', value ? Number(value) : undefined)} />
        <ProductField label="Độ tro (%)" type="number" step="any" value={coal.ash} onChange={(value) => onCoalChange('ash', value ? Number(value) : undefined)} />
        <ProductField label="Nhiệt trị (kcal/kg)" type="number" value={coal.calorificValue} onChange={(value) => onCoalChange('calorificValue', value ? Number(value) : undefined)} />
        <ProductField label="Lưu huỳnh (%)" type="number" step="any" value={coal.sulfur} onChange={(value) => onCoalChange('sulfur', value ? Number(value) : undefined)} />
      </div>
    </section>;
  }

  return null;
}

// --- End of PgdProductGroupFields.tsx ---
