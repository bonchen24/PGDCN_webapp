'use client';

import { useMemo, useState } from 'react';
import type { DossierTemplateDomain, DossierTemplateEditorNode, DossierTemplateEditorTransition } from '../utils/pgdcnDossierTemplate.ts';

const CONDITION_OPTIONS = [
  { value: 'ALWAYS', label: 'Luôn chuyển tiếp' },
  { value: 'REQUIRED_DOCUMENTS_COMPLETE', label: 'Đủ tài liệu bắt buộc' },
  { value: 'ANY_RESULT_RETURNED', label: 'Có kết quả trả về' },
  { value: 'RESULT_PASSED', label: 'Kết quả đạt' },
  { value: 'RESULT_FAILED', label: 'Kết quả không đạt' },
  { value: 'APPROVAL_RETURNED', label: 'Bị trả về từ phê duyệt' },
  { value: 'FIELD_MATCH', label: 'Khớp lĩnh vực' },
  { value: 'METHOD_MATCH', label: 'Khớp phương pháp' },
] as const;

const RETURN_POLICY_OPTIONS = [
  { value: 'REWORK', label: 'Trả về bước xử lý' },
  { value: 'RESTART_DEPENDENCIES', label: 'Chạy lại các bước phụ thuộc' },
  { value: 'RESTART_TEMPLATE', label: 'Chạy lại từ đầu lưu trình' },
] as const;

const PCN_METHOD_OPTIONS = [
  { value: 'METHOD_1', label: 'Phương thức 1' },
  { value: 'METHOD_5', label: 'Phương thức 5' },
  { value: 'METHOD_7', label: 'Phương thức 7' },
] as const;

const PGD_METHOD_OPTIONS = [
  { value: 'TT58', label: 'TT58' },
  { value: 'QT-GĐ-14', label: 'QT-GĐ-14' },
  { value: 'GENERIC', label: 'Chung' },
] as const;

export interface DossierTemplateRequirementOption {
  id: string;
  label: string;
  description?: string;
  group?: string;
  required: boolean;
}

export interface PgdcnDossierTemplateInspectorProps {
  selectedNode?: DossierTemplateEditorNode;
  selectedTransition?: DossierTemplateEditorTransition;
  domain: DossierTemplateDomain;
  conditionScopeOptions: string[];
  requirementOptions: DossierTemplateRequirementOption[];
  onChangeNode: (changes: Partial<DossierTemplateEditorNode>) => void;
  onChangeTransition: (changes: Partial<DossierTemplateEditorTransition>) => void;
  onToggleRequirement: (requirementId: string, checked: boolean) => void;
  onBeginConnection?: () => void;
  onDeleteNode?: () => void;
  onClose: () => void;
}

export default function PgdcnDossierTemplateInspector(props: PgdcnDossierTemplateInspectorProps) {
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return props.requirementOptions.filter((option) => !normalized || `${option.label} ${option.id} ${option.group || ''}`.toLocaleLowerCase('vi-VN').includes(normalized));
  }, [props.requirementOptions, query]);

  if (!props.selectedNode && !props.selectedTransition) {
    return <aside data-testid="pgdcn-dossier-template-inspector" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Chọn một bước để xem cấu hình và tài liệu được gán.</aside>;
  }

  if (props.selectedTransition && !props.selectedNode) {
    const transition = props.selectedTransition;
    const config = transition.conditionConfig || {};
    const scopeValues = props.domain === 'PCN'
      ? (Array.isArray(config.expectedFieldCodes) ? config.expectedFieldCodes.map(String) : [])
      : (Array.isArray(config.expectedProductGroups) ? config.expectedProductGroups.map(String) : []);
    const methodValues = props.domain === 'PCN'
      ? (typeof config.expectedMethod === 'string' ? [config.expectedMethod] : [])
      : (Array.isArray(config.expectedMethodCodes) ? config.expectedMethodCodes.map(String) : []);
    const methodOptions = props.domain === 'PCN' ? PCN_METHOD_OPTIONS : PGD_METHOD_OPTIONS;
    const toggleScopeValue = (value: string, checked: boolean) => {
      const nextValues = checked ? [...new Set([...scopeValues, value])] : scopeValues.filter((item) => item !== value);
      props.onChangeTransition({ conditionConfig: props.domain === 'PCN' ? { ...config, expectedFieldCodes: nextValues } : { ...config, expectedProductGroups: nextValues } });
    };
    const toggleMethodValue = (value: string, checked: boolean) => {
      const nextValues = checked ? [...new Set([...methodValues, value])] : methodValues.filter((item) => item !== value);
      props.onChangeTransition({ conditionConfig: props.domain === 'PCN' ? { ...config, expectedMethod: nextValues[0] } : { ...config, expectedMethodCodes: nextValues } });
    };
    return (
      <aside data-testid="pgdcn-dossier-template-inspector" className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-800">Điều kiện nối bước</h2><button type="button" className="min-h-11 min-w-11" onClick={props.onClose}>×</button></div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Chọn cách chuyển tiếp giữa hai bước. Các điều kiện này là danh sách an toàn và sẽ được runtime hiểu thống nhất.</p>
        <label className="mt-4 block text-xs font-medium text-slate-500">Nhãn nối<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></label>
        <input required aria-required="true" value={transition.label || ''} onChange={(event) => props.onChangeTransition({ label: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        <label className="mt-4 block text-xs font-medium text-slate-500">Điều kiện</label>
        <select value={transition.condition || 'ALWAYS'} onChange={(event) => props.onChangeTransition({ condition: event.target.value as DossierTemplateEditorTransition['condition'], conditionConfig: undefined })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {transition.condition === 'FIELD_MATCH' && <fieldset className="mt-4"><legend className="text-xs font-medium text-slate-500">Phạm vi áp dụng điều kiện</legend><div className="mt-2 space-y-2">{props.conditionScopeOptions.map((value) => <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-100 px-3 text-xs text-slate-700"><input type="checkbox" checked={scopeValues.includes(value)} onChange={(event) => toggleScopeValue(value, event.target.checked)} />{value}</label>)}</div></fieldset>}
        {transition.condition === 'METHOD_MATCH' && <fieldset className="mt-4"><legend className="text-xs font-medium text-slate-500">Giá trị phương thức</legend><div className="mt-2 space-y-2">{methodOptions.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-100 px-3 text-xs text-slate-700"><input type={props.domain === 'PCN' ? 'radio' : 'checkbox'} name={`template-method-${transition.id}`} checked={methodValues.includes(option.value)} onChange={(event) => toggleMethodValue(option.value, event.target.checked)} />{option.label}</label>)}</div></fieldset>}
        <label className="mt-4 block text-xs font-medium text-slate-500">Chính sách trả về</label>
        <select value={transition.returnPolicy || ''} onChange={(event) => props.onChangeTransition({ returnPolicy: event.target.value ? event.target.value as DossierTemplateEditorTransition['returnPolicy'] : undefined })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Không đặt</option>{RETURN_POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <label className="mt-4 block text-xs font-medium text-slate-500">Độ ưu tiên nhánh</label>
        <input type="number" min={1} value={transition.priority ?? ''} onChange={(event) => props.onChangeTransition({ priority: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
      </aside>
    );
  }

  const node = props.selectedNode!;
  return (
    <aside data-testid="pgdcn-dossier-template-inspector" className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cấu hình bước</p><h2 className="mt-1 text-lg font-semibold text-slate-800">{node.label || 'Bước chưa đặt tên'}</h2></div><button type="button" className="min-h-11 min-w-11 rounded-lg text-slate-400 hover:bg-slate-100" onClick={props.onClose}>×</button></div>
      <label className="mt-5 block text-xs font-medium text-slate-500">Tên hiển thị<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></label>
      <input required aria-required="true" value={node.label} onChange={(event) => props.onChangeNode({ label: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
      <label className="mt-4 block text-xs font-medium text-slate-500">Mô tả hướng dẫn</label>
      <input value={node.description || ''} onChange={(event) => props.onChangeNode({ description: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
      <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">SLA (ngày)<input type="number" min={0} value={node.slaDays ?? ''} onChange={(event) => props.onChangeNode({ slaDays: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-xs text-slate-500">Vai trò<input value={node.assigneeRole || ''} onChange={(event) => props.onChangeNode({ assigneeRole: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>
      <div className="mt-5 flex gap-2"><button type="button" className="min-h-11 flex-1 rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700" onClick={props.onBeginConnection}>Nối tới</button><button type="button" className="min-h-11 rounded-lg px-3 text-sm font-medium text-rose-600 hover:bg-rose-50" onClick={props.onDeleteNode}>Xóa bước</button></div>
      <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-end justify-between gap-3"><div><h3 className="font-semibold text-slate-800">Tài liệu theo bước</h3><p className="mt-1 text-xs text-slate-500">Chọn loại tài liệu cần có khi hồ sơ chạy qua bước này.</p></div><span className="text-xs text-slate-400">{node.requirementRefs.length} đã chọn</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        <div className="mt-3 max-h-[330px] space-y-2 overflow-y-auto">{filteredOptions.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-2 hover:bg-slate-50"><input type="checkbox" checked={node.requirementRefs.includes(option.id)} onChange={(event) => props.onToggleRequirement(option.id, event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-sm text-slate-700"><span className="block">{option.label} {option.required && <span className="text-rose-500">*</span>}</span><span className="block text-xs text-slate-400">{option.group || option.id}</span></span></label>)}{filteredOptions.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Không tìm thấy tài liệu phù hợp.</p>}</div>
      </div>
    </aside>
  );
}
