'use client';

import { useId, useMemo, useState } from 'react';
import type { PgdcnDossierRequirementCondition, PgdcnDossierRequirementPolicy } from '../types.ts';
import type { DossierTemplateDomain, DossierTemplateEditorNode, DossierTemplateEditorTransition } from '../utils/pgdcnDossierTemplate.ts';
import { PGD_REQUIREMENT_METHOD_CODES } from '../utils/pgdcnDossierRequirementPolicy.ts';

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
  { value: 'GENERIC', label: 'Chung' },
  ...PGD_REQUIREMENT_METHOD_CODES.filter((code) => code.startsWith('QT-')).map((code) => ({ value: code, label: code })),
] as const;

const REQUIREMENT_CLASSES = [
  { value: 'DEFAULT_REQUIRED', label: 'Mặc định bắt buộc' },
  { value: 'DEFAULT_CONDITIONAL', label: 'Mặc định bắt buộc có điều kiện' },
  { value: 'DEFAULT_OPTIONAL', label: 'Mặc định tùy chọn' },
  { value: 'FREE_ADDITIONAL', label: 'Bổ sung tự do' },
] as const;

const REQUIREMENT_SOURCE_MODES = [
  { value: 'CREATE_DOCX', label: 'Tạo từ biểu mẫu DOCX' },
  { value: 'UPLOAD', label: 'Tải tệp lên' },
  { value: 'EXTERNAL_PTN', label: 'Nhận từ PTN' },
  { value: 'MULTI', label: 'Nhiều nguồn' },
] as const;

const PCN_REQUIREMENT_FIELDS = [
  { value: 'QC4', label: 'QC4 · Hợp quy' },
  { value: 'QC9', label: 'QC9 · Hợp chuẩn' },
] as const;

const PGD_REQUIREMENT_GROUPS = [
  { value: 'STEEL_METAL', label: 'Sắt thép và kim loại' },
  { value: 'MACHINERY_LINE', label: 'Máy móc và dây chuyền' },
  { value: 'COAL', label: 'Than' },
  { value: 'OTHER', label: 'Nhóm khác' },
] as const;

const LANE_OPTIONS = [
  { value: 'default', label: 'Chưa phân nhóm' },
  { value: 'intake', label: 'Tiếp nhận' },
  { value: 'preparation', label: 'Chuẩn bị' },
  { value: 'field', label: 'Hiện trường' },
  { value: 'lab', label: 'PTN & kết quả' },
  { value: 'review', label: 'Rà soát & phê duyệt' },
  { value: 'archive', label: 'Trả kết quả & lưu trữ' },
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
  requirementPolicies?: Record<string, PgdcnDossierRequirementPolicy>;
  onChangeNode: (changes: Partial<DossierTemplateEditorNode>) => void;
  onChangeTransition: (changes: Partial<DossierTemplateEditorTransition>) => void;
  onToggleRequirement: (requirementId: string, checked: boolean) => void;
  onChangeRequirementPolicy?: (requirementId: string, policy: PgdcnDossierRequirementPolicy) => void;
  onBeginConnection?: () => void;
  onDeleteNode?: () => void;
  onClose: () => void;
}

export default function PgdcnDossierTemplateInspector(props: PgdcnDossierTemplateInspectorProps) {
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return props.requirementOptions.filter((option) => !normalized || `${option.label} ${option.id} ${option.group || ''}`.toLocaleLowerCase('vi-VN').includes(normalized));
  }, [props.requirementOptions, query]);

  if (!props.selectedNode && !props.selectedTransition) {
    return <aside data-testid="pgdcn-dossier-template-inspector" className="w-full min-w-0 max-w-full overflow-x-clip rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500 sm:p-5">Chọn một bước để xem cấu hình và tài liệu được gán.</aside>;
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
      <aside data-testid="pgdcn-dossier-template-inspector" className="w-full min-w-0 max-w-full overflow-x-clip rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
        <div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 break-words font-semibold text-slate-800">Điều kiện nối bước</h2><button type="button" aria-label="Đóng trình kiểm tra" className="min-h-11 min-w-11 shrink-0 rounded-lg text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" onClick={props.onClose}>×</button></div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Chọn cách chuyển tiếp giữa hai bước. Các điều kiện này là danh sách an toàn và sẽ được runtime hiểu thống nhất.</p>
        <label htmlFor={`${idPrefix}-transition-label`} className="mt-4 block text-xs font-medium text-slate-600">Nhãn nối<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></label>
        <input id={`${idPrefix}-transition-label`} required aria-required="true" aria-describedby={`${idPrefix}-transition-label-hint`} value={transition.label || ''} onChange={(event) => props.onChangeTransition({ label: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" />
        <p id={`${idPrefix}-transition-label-hint`} className="mt-1 text-xs text-slate-600">Bắt buộc. Nhập tên dễ nhận biết cho đường nối.</p>
        <label htmlFor={`${idPrefix}-transition-condition`} className="mt-4 block text-xs font-medium text-slate-600">Điều kiện</label>
        <select id={`${idPrefix}-transition-condition`} value={transition.condition || 'ALWAYS'} onChange={(event) => props.onChangeTransition({ condition: event.target.value as DossierTemplateEditorTransition['condition'], conditionConfig: undefined })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {transition.condition === 'FIELD_MATCH' && <fieldset className="mt-4 min-w-0"><legend className="text-xs font-medium text-slate-600">Phạm vi áp dụng điều kiện</legend><div className="mt-2 space-y-2">{props.conditionScopeOptions.map((value) => <label key={value} htmlFor={`${idPrefix}-scope-${encodeURIComponent(value)}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-100 px-3 text-xs text-slate-700"><input id={`${idPrefix}-scope-${encodeURIComponent(value)}`} type="checkbox" checked={scopeValues.includes(value)} onChange={(event) => toggleScopeValue(value, event.target.checked)} className="h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{value}</span></label>)}</div></fieldset>}
        {transition.condition === 'METHOD_MATCH' && <fieldset className="mt-4 min-w-0"><legend className="text-xs font-medium text-slate-600">Giá trị phương thức</legend><div className="mt-2 space-y-2">{methodOptions.map((option) => <label key={option.value} htmlFor={`${idPrefix}-method-${option.value}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-100 px-3 text-xs text-slate-700"><input id={`${idPrefix}-method-${option.value}`} type={props.domain === 'PCN' ? 'radio' : 'checkbox'} name={`template-method-${transition.id}`} checked={methodValues.includes(option.value)} onChange={(event) => toggleMethodValue(option.value, event.target.checked)} className="h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span></label>)}</div></fieldset>}
        <label htmlFor={`${idPrefix}-transition-return-policy`} className="mt-4 block text-xs font-medium text-slate-600">Chính sách trả về</label>
        <select id={`${idPrefix}-transition-return-policy`} value={transition.returnPolicy || ''} onChange={(event) => props.onChangeTransition({ returnPolicy: event.target.value ? event.target.value as DossierTemplateEditorTransition['returnPolicy'] : undefined })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><option value="">Không đặt</option>{RETURN_POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <label htmlFor={`${idPrefix}-transition-priority`} className="mt-4 block text-xs font-medium text-slate-600">Độ ưu tiên nhánh</label>
        <input id={`${idPrefix}-transition-priority`} type="number" min={1} aria-describedby={`${idPrefix}-transition-priority-hint`} value={transition.priority ?? ''} onChange={(event) => props.onChangeTransition({ priority: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" />
        <p id={`${idPrefix}-transition-priority-hint`} className="mt-1 text-xs text-slate-600">Giá trị tối thiểu là 1.</p>
      </aside>
    );
  }

  const node = props.selectedNode!;
  const getRequirementPolicy = (option: DossierTemplateRequirementOption): PgdcnDossierRequirementPolicy => props.requirementPolicies?.[option.id] || {
    defaultClass: option.required ? 'DEFAULT_REQUIRED' : 'DEFAULT_OPTIONAL',
    sourceMode: 'UPLOAD',
    cardinality: { min: 1 },
  };
  const updatePolicy = (option: DossierTemplateRequirementOption, changes: Partial<PgdcnDossierRequirementPolicy>) => {
    props.onChangeRequirementPolicy?.(option.id, { ...getRequirementPolicy(option), ...changes });
  };
  const togglePolicyCondition = (option: DossierTemplateRequirementOption, key: PgdcnDossierRequirementCondition['key'], value: string, checked: boolean) => {
    const policy = getRequirementPolicy(option);
    const conditions = [...(policy.appliesWhen?.conditions || [])];
    const current = conditions.find((condition) => condition.key === key);
    const values = new Set((current?.values || []).map(String));
    if (checked) values.add(value);
    else values.delete(value);
    const nextConditions = conditions.filter((condition) => condition.key !== key);
    if (values.size) nextConditions.push({ key, values: Array.from(values) } as PgdcnDossierRequirementCondition);
    updatePolicy(option, { appliesWhen: nextConditions.length ? { operator: policy.appliesWhen?.operator || 'ALL', conditions: nextConditions } : undefined });
  };
  const makeConditional = (option: DossierTemplateRequirementOption) => {
    const values = props.domain === 'PCN'
      ? (props.conditionScopeOptions.length ? props.conditionScopeOptions : ['QC4'])
      : (props.conditionScopeOptions.length ? props.conditionScopeOptions : ['OTHER']);
    const condition = (props.domain === 'PCN'
      ? { key: 'PCN_FIELD', values }
      : { key: 'PGD_PRODUCT_GROUP', values }) as PgdcnDossierRequirementCondition;
    updatePolicy(option, { defaultClass: 'DEFAULT_CONDITIONAL', appliesWhen: { operator: 'ALL', conditions: [condition] } });
  };
  return (
    <aside data-testid="pgdcn-dossier-template-inspector" className="w-full min-w-0 max-w-full overflow-x-clip rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cấu hình bước</p><h2 className="mt-1 break-words text-lg font-semibold text-slate-800">{node.label || 'Bước chưa đặt tên'}</h2></div><button type="button" aria-label="Đóng trình kiểm tra" className="min-h-11 min-w-11 shrink-0 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" onClick={props.onClose}>×</button></div>
      <label htmlFor={`${idPrefix}-node-label`} className="mt-5 block text-xs font-medium text-slate-600">Tên hiển thị<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></label>
      <input id={`${idPrefix}-node-label`} required aria-required="true" aria-describedby={`${idPrefix}-node-label-hint`} value={node.label} onChange={(event) => props.onChangeNode({ label: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" />
      <p id={`${idPrefix}-node-label-hint`} className="mt-1 text-xs text-slate-600">Bắt buộc. Tên bước cần dễ hiểu với người xử lý.</p>
      <label htmlFor={`${idPrefix}-node-description`} className="mt-4 block text-xs font-medium text-slate-600">Mô tả hướng dẫn</label>
      <input id={`${idPrefix}-node-description`} value={node.description || ''} onChange={(event) => props.onChangeNode({ description: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" />
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"><div className="min-w-0"><label htmlFor={`${idPrefix}-node-sla`} className="block text-xs text-slate-600">SLA (ngày)</label><input id={`${idPrefix}-node-sla`} type="number" min={0} aria-describedby={`${idPrefix}-node-sla-hint`} value={node.slaDays ?? ''} onChange={(event) => props.onChangeNode({ slaDays: event.target.value === '' ? undefined : Number(event.target.value) })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" /><p id={`${idPrefix}-node-sla-hint`} className="mt-1 text-xs text-slate-600">Tối thiểu 0 ngày.</p></div><div className="min-w-0"><label htmlFor={`${idPrefix}-node-role`} className="block text-xs text-slate-600">Vai trò</label><input id={`${idPrefix}-node-role`} value={node.assigneeRole || ''} onChange={(event) => props.onChangeNode({ assigneeRole: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" /></div></div>
      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-slate-800">Vị trí trên lưu trình</legend>
        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0"><label htmlFor={`${idPrefix}-node-lane`} className="block text-xs text-slate-600">Vùng</label>
            <select id={`${idPrefix}-node-lane`} value={node.laneId || 'default'} onChange={(event) => props.onChangeNode({ laneId: event.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              {LANE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="min-w-0"><label htmlFor={`${idPrefix}-node-column`} className="block text-xs text-slate-600">Cột</label>
            <select id={`${idPrefix}-node-column`} value={node.column} onChange={(event) => props.onChangeNode({ column: Number(event.target.value) })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </div>
        </div>
      </fieldset>
      <div className="mt-5 flex min-w-0 flex-wrap gap-2"><button type="button" className="min-h-11 min-w-0 flex-1 rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" onClick={props.onBeginConnection}>Nối tới</button><button type="button" className="min-h-11 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" onClick={props.onDeleteNode}>Xóa bước</button></div>
      <div className="mt-6 min-w-0 border-t border-slate-100 pt-5"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-800">Tài liệu theo bước</h3><p className="mt-1 break-words text-xs text-slate-600">Chọn loại tài liệu cần có khi hồ sơ chạy qua bước này.</p></div><span className="shrink-0 text-xs text-slate-500">{node.requirementRefs.length} đã chọn</span></div><label htmlFor={`${idPrefix}-requirement-search`} className="mt-3 block text-xs font-medium text-slate-600">Tìm tài liệu</label><input id={`${idPrefix}-requirement-search`} placeholder="Tìm tài liệu" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" />
        <div className="mt-3 max-h-[560px] min-w-0 space-y-2 overflow-y-auto">{filteredOptions.map((option) => {
          const selected = node.requirementRefs.includes(option.id);
          const policy = getRequirementPolicy(option);
          const conditionValues = (key: PgdcnDossierRequirementCondition['key']) => policy.appliesWhen?.conditions.find((condition) => condition.key === key)?.values.map(String) || [];
          return <article key={option.id} className="min-w-0 rounded-lg border border-slate-200 p-2">
            <label htmlFor={`${idPrefix}-requirement-${encodeURIComponent(option.id)}`} className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-lg p-1 hover:bg-slate-50"><input id={`${idPrefix}-requirement-${encodeURIComponent(option.id)}`} type="checkbox" checked={selected} onChange={(event) => props.onToggleRequirement(option.id, event.target.checked)} className="mt-1 h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" /><span className="min-w-0 break-words text-sm text-slate-700 [overflow-wrap:anywhere]"><span className="block">{option.label} {option.required && <span className="text-rose-600">*</span>}</span><span className="block text-xs text-slate-600">{option.group || option.id}</span></span></label>
            {selected && <div className="mt-2 grid min-w-0 gap-3 border-t border-slate-100 pt-3">
              <label className="block min-w-0 text-xs font-medium text-slate-600">Phân loại mặc định<select aria-label={`Phân loại ${option.label}`} value={policy.defaultClass} onChange={(event) => { const defaultClass = event.target.value as PgdcnDossierRequirementPolicy['defaultClass']; if (defaultClass === 'DEFAULT_CONDITIONAL') makeConditional(option); else updatePolicy(option, { defaultClass, appliesWhen: undefined }); }} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{REQUIREMENT_CLASSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              {policy.defaultClass === 'DEFAULT_CONDITIONAL' && <fieldset className="min-w-0 rounded-lg bg-slate-50 p-2"><legend className="px-1 text-xs font-semibold text-slate-600">Điều kiện áp dụng</legend>
                <label className="block text-xs text-slate-600">Kết hợp điều kiện<select aria-label={`Kết hợp điều kiện ${option.label}`} value={policy.appliesWhen?.operator || 'ALL'} onChange={(event) => updatePolicy(option, { appliesWhen: { operator: event.target.value as 'ALL' | 'ANY', conditions: policy.appliesWhen?.conditions || [] } })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="ALL">Đồng thời thỏa mãn</option><option value="ANY">Thỏa mãn một điều kiện</option></select></label>
                {props.domain === 'PCN' ? <div className="mt-2"><p className="text-xs font-medium text-slate-600">Lĩnh vực chứng nhận</p><div className="mt-1 flex flex-wrap gap-2">{PCN_REQUIREMENT_FIELDS.map((item) => <label key={item.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs"><input type="checkbox" checked={conditionValues('PCN_FIELD').includes(item.value)} onChange={(event) => togglePolicyCondition(option, 'PCN_FIELD', item.value, event.target.checked)} />{item.label}</label>)}</div></div> : <>
                  <div className="mt-2"><p className="text-xs font-medium text-slate-600">Nhóm sản phẩm</p><div className="mt-1 flex flex-wrap gap-2">{PGD_REQUIREMENT_GROUPS.map((item) => <label key={item.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs"><input type="checkbox" checked={conditionValues('PGD_PRODUCT_GROUP').includes(item.value)} onChange={(event) => togglePolicyCondition(option, 'PGD_PRODUCT_GROUP', item.value, event.target.checked)} />{item.label}</label>)}</div></div>
                  <div className="mt-2"><p className="text-xs font-medium text-slate-600">Phương pháp</p><div className="mt-1 flex flex-wrap gap-2">{PGD_METHOD_OPTIONS.map((item) => <label key={item.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs"><input type="checkbox" checked={conditionValues('PGD_METHOD').includes(item.value)} onChange={(event) => togglePolicyCondition(option, 'PGD_METHOD', item.value, event.target.checked)} />{item.label}</label>)}</div></div>
                </>}
              </fieldset>}
              <label className="block min-w-0 text-xs font-medium text-slate-600">Nguồn tệp<select aria-label={`Nguồn tệp ${option.label}`} value={policy.sourceMode} onChange={(event) => updatePolicy(option, { sourceMode: event.target.value as PgdcnDossierRequirementPolicy['sourceMode'] })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{REQUIREMENT_SOURCE_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <div className="grid min-w-0 grid-cols-2 gap-2"><label className="block min-w-0 text-xs font-medium text-slate-600">Số lượng tối thiểu<input aria-label={`Số lượng tối thiểu ${option.label}`} type="number" min={1} step={1} value={policy.cardinality.min} onChange={(event) => updatePolicy(option, { cardinality: { ...policy.cardinality, min: Number(event.target.value) } })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="block min-w-0 text-xs font-medium text-slate-600">Số lượng tối đa<input aria-label={`Số lượng tối đa ${option.label}`} type="number" min={policy.cardinality.min} step={1} value={policy.cardinality.max ?? ''} onChange={(event) => updatePolicy(option, { cardinality: { ...policy.cardinality, max: event.target.value === '' ? undefined : Number(event.target.value) } })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm" /><span className="mt-1 block font-normal text-slate-500">Để trống nếu không giới hạn.</span></label></div>
            </div>}
          </article>;
        })}{filteredOptions.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Không tìm thấy tài liệu phù hợp.</p>}</div>
      </div>
    </aside>
  );
}
