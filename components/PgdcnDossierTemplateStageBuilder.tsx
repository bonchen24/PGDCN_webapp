'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_DOSSIER_TEMPLATE_STAGES, setDossierTemplateStageRequirement, type DossierTemplateEditorModel, validateDossierTemplateRequirementDefinition } from '../utils/pgdcnDossierTemplate.ts';
import type { DossierTemplateRequirementDefinition, DossierTemplateRequirementLevel, DossierTemplateRequirementSource } from '../types.ts';
import type { DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

export interface PgdcnDossierTemplateStageBuilderProps {
  model: DossierTemplateEditorModel;
  requirements: DossierTemplateRequirementOption[];
  docxTemplates?: Array<{ id: string; label: string }>;
  onChange: (model: DossierTemplateEditorModel) => void;
  canMutate: boolean;
}

function createStageId(): string {
  const id = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : Date.now().toString(36);
  return `custom-stage-${id}`;
}

function createRequirementDraft(domain: 'PCN' | 'PGD') {
  return {
    code: '',
    name: '',
    description: '',
    level: 'REQUIRED' as DossierTemplateRequirementLevel,
    source: 'UPLOAD_EXTERNAL' as DossierTemplateRequirementSource,
    condition: 'RESULT_FAILED' as DossierTemplateRequirementDefinition['condition'],
    ownerRole: domain === 'PCN' ? 'CERTIFICATION_EXPERT' : 'PGD_FIELD_INSPECTOR',
    multiplicity: 'SINGLE' as DossierTemplateRequirementDefinition['multiplicity'],
    linkedDocxTemplateId: '',
    businessModuleKey: '',
  };
}

export default function PgdcnDossierTemplateStageBuilder(props: PgdcnDossierTemplateStageBuilderProps) {
  const stages = props.model.stages?.length
    ? props.model.stages
    : DEFAULT_DOSSIER_TEMPLATE_STAGES.map((stage) => ({ ...stage, requirementIds: [] }));
  const [expandedStageId, setExpandedStageId] = useState(stages[0]?.id || '');
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState('');
  const [creatingRequirement, setCreatingRequirement] = useState(false);
  const [editingRequirementId, setEditingRequirementId] = useState<string>();
  const [requirementError, setRequirementError] = useState('');
  const [requirementDraft, setRequirementDraft] = useState(() => createRequirementDraft(props.model.domain));

  useEffect(() => {
    setExpandedStageId(stages[0]?.id || '');
    setShowCatalog(false);
    setCreatingRequirement(false);
    setEditingRequirementId(undefined);
    setRequirementError('');
    setRequirementDraft(createRequirementDraft(props.model.domain));
  }, [props.model.id, props.model.version, props.model.domain]);

  const nodesFor = (stageId: string) => props.model.nodes.filter((node) => node.stageId === stageId);
  const requirementIdsFor = (stageId: string) => Array.from(new Set([
    ...(stages.find((stage) => stage.id === stageId)?.requirementIds || []),
  ]));
  const change = (next: DossierTemplateEditorModel) => props.onChange(next);

  const setRequirement = (stageId: string, requirementId: string, checked: boolean) => {
    const nextModel = setDossierTemplateStageRequirement(props.model, stageId, requirementId, checked);
    const nextNodes = props.model.nodes;
    const option = props.requirements.find((item) => item.id === requirementId);
    const existingDefinitions = props.model.requirementDefinitions || [];
    const referencedElsewhere = nextModel.stages?.some((stage) => (stage.requirementIds || []).includes(requirementId))
      || nextNodes.some((node) => node.requirementRefs.includes(requirementId));
    const nextDefinitions = checked && option?.definition && !existingDefinitions.some((item) => item.id === requirementId)
      ? [...existingDefinitions, option.definition]
      : checked || referencedElsewhere
        ? existingDefinitions
        : existingDefinitions.filter((item) => item.id !== requirementId);
    change({ ...nextModel, nodes: nextNodes, requirementDefinitions: nextDefinitions });
  };

  const addRequirement = (stageId: string) => {
    const randomId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`;
    const definition: DossierTemplateRequirementDefinition = {
      domain: props.model.domain,
      id: `${props.model.domain.toLowerCase()}-custom-${randomId.slice(0, 16).toLowerCase()}`,
      code: requirementDraft.code.trim().toUpperCase(),
      name: requirementDraft.name.trim(),
      ...(requirementDraft.description.trim() ? { description: requirementDraft.description.trim() } : {}),
      level: requirementDraft.level,
      source: requirementDraft.source,
      ...(requirementDraft.level === 'CONDITIONAL' ? { condition: requirementDraft.condition } : {}),
      ownerRole: requirementDraft.ownerRole as DossierTemplateRequirementDefinition['ownerRole'],
      multiplicity: requirementDraft.multiplicity,
      ...(requirementDraft.source === 'DRAFT_FROM_DOCX_TEMPLATE' && requirementDraft.linkedDocxTemplateId ? { linkedDocxTemplateId: requirementDraft.linkedDocxTemplateId } : {}),
      ...(requirementDraft.source === 'BUSINESS_MODULE_LINK' && requirementDraft.businessModuleKey ? { businessModuleKey: requirementDraft.businessModuleKey } : {}),
    };
    const validation = validateDossierTemplateRequirementDefinition(definition, props.model.domain);
    const existing = props.model.requirementDefinitions || [];
    if (existing.some((item) => item.code.toUpperCase() === definition.code)) validation.errors.push('Mã requirement đã tồn tại trong bộ hồ sơ này.');
    if (!validation.valid || validation.errors.length > 0) {
      setRequirementError(validation.errors.join(' '));
      return;
    }
    const nextStages = stages.map((stage) => stage.id === stageId
      ? { ...stage, requirementIds: [...new Set([...(stage.requirementIds || []), definition.id])] }
      : stage);
    change({ ...props.model, stages: nextStages, requirementDefinitions: [...existing, definition] });
    setRequirementError('');
    setCreatingRequirement(false);
    setRequirementDraft({ ...requirementDraft, code: '', name: '', description: '', linkedDocxTemplateId: '', businessModuleKey: '' });
  };

  const removeRequirement = (stageId: string, requirementId: string) => {
    const nextStages = stages.map((stage) => stage.id === stageId
      ? { ...stage, requirementIds: (stage.requirementIds || []).filter((id) => id !== requirementId) }
      : stage);
    const nextNodes = props.model.nodes;
    const referencedElsewhere = nextStages.some((stage) => (stage.requirementIds || []).includes(requirementId))
      || nextNodes.some((node) => node.requirementRefs.includes(requirementId));
    const nextDefinitions = referencedElsewhere
      ? props.model.requirementDefinitions || []
      : (props.model.requirementDefinitions || []).filter((definition) => definition.id !== requirementId);
    change({ ...props.model, stages: nextStages, nodes: nextNodes, requirementDefinitions: nextDefinitions });
  };

  const moveRequirement = (stageId: string, requirementId: string, offset: -1 | 1) => {
    const currentIds = requirementIdsFor(stageId);
    const index = currentIds.indexOf(requirementId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= currentIds.length) return;
    [currentIds[index], currentIds[target]] = [currentIds[target], currentIds[index]];
    const nextStages = stages.map((stage) => stage.id === stageId ? { ...stage, requirementIds: currentIds } : stage);
    change({ ...props.model, stages: nextStages });
  };

  const renameRequirement = (requirementId: string, name: string) => {
    const nextDefinitions = (props.model.requirementDefinitions || []).map((definition) => definition.id === requirementId
      ? { ...definition, name }
      : definition);
    change({ ...props.model, requirementDefinitions: nextDefinitions });
  };

  const updateRequirementDefinition = (
    requirementId: string,
    update: (definition: DossierTemplateRequirementDefinition) => DossierTemplateRequirementDefinition,
  ) => {
    const currentDefinitions = props.model.requirementDefinitions || [];
    if (!currentDefinitions.some((definition) => definition.id === requirementId)) return;
    change({
      ...props.model,
      requirementDefinitions: currentDefinitions.map((definition) => definition.id === requirementId ? update(definition) : definition),
    });
  };

  const setRequirementSource = (requirementId: string, source: DossierTemplateRequirementSource) => {
    updateRequirementDefinition(requirementId, (definition) => {
      const { linkedDocxTemplateId: _linkedDocxTemplateId, businessModuleKey: _businessModuleKey, ...rest } = definition;
      return {
        ...rest,
        source,
        ...(source === 'DRAFT_FROM_DOCX_TEMPLATE' ? { linkedDocxTemplateId: '' } : {}),
        ...(source === 'BUSINESS_MODULE_LINK' ? { businessModuleKey: '' } : {}),
      };
    });
  };

  const moveStage = (stageId: string, offset: -1 | 1) => {
    const index = stages.findIndex((stage) => stage.id === stageId);
    const target = index + offset;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    change({ ...props.model, stages: next.map((stage, order) => ({ ...stage, sortOrder: (order + 1) * 10 })) });
  };

  const addStage = () => {
    const stage = { id: createStageId(), label: 'Giai đoạn mới', sortOrder: (stages.length + 1) * 10, requirementIds: [] };
    change({ ...props.model, stages: [...stages, stage] });
    setExpandedStageId(stage.id);
  };

  const removeStage = (stageId: string) => {
    const nextStages = stages.filter((stage) => stage.id !== stageId).map((stage, order) => ({ ...stage, sortOrder: (order + 1) * 10 }));
    change({ ...props.model, stages: nextStages });
    setExpandedStageId(nextStages[0]?.id || '');
  };

  const visibleOptions = props.requirements.filter((option) => !search.trim()
    || `${option.label} ${option.description || ''} ${option.group || ''}`.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')));

  return <section data-testid="pgdcn-dossier-template-stage-builder" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold text-slate-900">Giai đoạn &amp; tài liệu</h3><p className="mt-1 text-xs text-slate-500">Nhóm tài liệu theo giai đoạn; nhánh lưu trình vẫn giữ nguyên.</p></div>
      {props.canMutate && <button type="button" onClick={addStage} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Thêm giai đoạn</button>}
    </div>
    <div className="mt-3 space-y-2">
      {stages.map((stage, index) => {
        const expanded = expandedStageId === stage.id;
        const requirementIds = requirementIdsFor(stage.id);
        const stageNodes = nodesFor(stage.id);
        return <article key={stage.id} data-testid={`pgdcn-dossier-template-stage-${stage.id}`} className="overflow-hidden rounded-xl border border-slate-200">
          <button type="button" aria-expanded={expanded} onClick={() => { setExpandedStageId(expanded ? '' : stage.id); setShowCatalog(false); setSearch(''); }} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{stage.label}</span><span className="mt-0.5 block text-xs text-slate-500">{requirementIds.length} yêu cầu · {stageNodes.length} nhiệm vụ liên kết</span></span>
            <span aria-hidden="true" className="text-slate-400">{expanded ? '−' : '+'}</span>
          </button>
          {expanded && <div className="border-t border-slate-200 p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-600">Tên giai đoạn<input disabled={!props.canMutate} value={stage.label} onChange={(event) => change({ ...props.model, stages: stages.map((item) => item.id === stage.id ? { ...item, label: event.target.value } : item) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-800 disabled:bg-slate-100" /></label>
              <button type="button" aria-label={`Chuyển ${stage.label} lên`} disabled={!props.canMutate || index === 0} onClick={() => moveStage(stage.id, -1)} className="min-h-11 min-w-11 rounded-lg border border-slate-300 text-lg text-slate-700 disabled:opacity-40">↑</button>
              <button type="button" aria-label={`Chuyển ${stage.label} xuống`} disabled={!props.canMutate || index === stages.length - 1} onClick={() => moveStage(stage.id, 1)} className="min-h-11 min-w-11 rounded-lg border border-slate-300 text-lg text-slate-700 disabled:opacity-40">↓</button>
              {stages.length > 1 && <button type="button" disabled={!props.canMutate || stageNodes.length > 0 || requirementIds.length > 0} onClick={() => removeStage(stage.id)} className="min-h-11 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-40">Xóa nhóm trống</button>}
            </div>
            {stageNodes.length > 0 && <div className="mt-4"><p className="text-xs font-semibold text-slate-600">Nhiệm vụ lưu trình trong nhóm</p><ul className="mt-2 space-y-2">{stageNodes.map((node) => <li key={node.id} className="grid min-w-0 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr),220px] sm:items-center"><span className="truncate text-sm text-slate-700">{node.label}</span><label className="text-[11px] font-medium text-slate-500">Nhóm hiển thị<select aria-label={`Giai đoạn của ${node.label}`} disabled={!props.canMutate} value={node.stageId || stage.id} onChange={(event) => change({ ...props.model, nodes: props.model.nodes.map((item) => item.id === node.id ? { ...item, stageId: event.target.value } : item) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700">{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></li>)}</ul></div>}
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-800">Yêu cầu tài liệu</h4><button type="button" disabled={!props.canMutate} onClick={() => setShowCatalog((open) => !open)} className="min-h-11 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40">{showCatalog ? 'Ẩn danh mục' : 'Thêm từ danh mục'}</button></div>
              {requirementIds.length > 0 ? <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">{requirementIds.map((id, requirementIndex) => { const option = props.requirements.find((item) => item.id === id); const savedDefinition = (props.model.requirementDefinitions || []).find((item) => item.id === id); const definition = savedDefinition || option?.definition; const workflowBound = props.model.nodes.some((node) => node.stageId === stage.id && node.requirementRefs.includes(id)); return <li key={id} className="flex min-h-11 items-center justify-between gap-2 px-3 py-2"><span className="min-w-0 flex-1">{savedDefinition && props.canMutate ? <input aria-label={`Tên yêu cầu ${definition.name}`} value={definition.name} onChange={(event) => renameRequirement(id, event.target.value)} maxLength={160} className="min-h-9 w-full rounded border border-transparent bg-transparent px-1 text-sm text-slate-800 focus:border-slate-300 focus:bg-white" /> : <span className="block truncate text-sm text-slate-800">{definition?.name || option?.label || id}</span>}<span className="block truncate text-[10px] text-slate-500">{definition ? `${definition.code} · ${definition.source === 'UPLOAD_EXTERNAL' || (props.model.domain === 'PCN' && definition.source === 'DRAFT_FROM_DOCX_TEMPLATE') ? 'Tải tệp bên ngoài' : definition.source === 'DRAFT_FROM_DOCX_TEMPLATE' ? 'Tạo bản nháp DOCX' : 'Liên kết nghiệp vụ'} · ${definition.multiplicity === 'MULTIPLE' ? 'Cấu hình cũ: nhiều tệp' : 'Một tệp hiện hành'}` : option?.description}</span></span><span className="flex shrink-0 items-center gap-1.5"><span className="text-[10px] font-semibold text-slate-500">{definition?.level === 'CONDITIONAL' ? 'Có điều kiện' : definition?.level === 'OPTIONAL' || option?.required === false ? 'Tùy chọn' : 'Bắt buộc'}</span>{props.canMutate && <><button type="button" aria-label={`Chuyển ${definition?.name || option?.label || id} lên`} title="Chuyển lên" disabled={requirementIndex === 0} onClick={() => moveRequirement(stage.id, id, -1)} className="min-h-10 min-w-9 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-30">↑</button><button type="button" aria-label={`Chuyển ${definition?.name || option?.label || id} xuống`} title="Chuyển xuống" disabled={requirementIndex === requirementIds.length - 1} onClick={() => moveRequirement(stage.id, id, 1)} className="min-h-10 min-w-9 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-30">↓</button>{!workflowBound && <button type="button" aria-label={`Gỡ yêu cầu ${definition?.name || option?.label || id}`} onClick={() => removeRequirement(stage.id, id)} className="min-h-10 rounded px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Gỡ</button>}</>}</span></li>; })}</ul> : <p className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">Chưa có yêu cầu tài liệu trong giai đoạn này.</p>}
              {requirementIds.map((id) => {
                const definition = (props.model.requirementDefinitions || []).find((item) => item.id === id);
                if (!definition || !props.canMutate) return null;
                const validation = validateDossierTemplateRequirementDefinition(definition, props.model.domain);
                const duplicateCode = (props.model.requirementDefinitions || []).some((item) => item.id !== id && item.code.toUpperCase() === definition.code.toUpperCase());
                const errors = [...validation.errors, ...(duplicateCode ? ['Mã requirement đã tồn tại trong bộ hồ sơ này.'] : [])];
                const editing = editingRequirementId === id;
                return <div key={`edit-${id}`} className="mt-2">
                  <button type="button" aria-expanded={editing} onClick={() => setEditingRequirementId(editing ? undefined : id)} className="min-h-9 rounded px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa yêu cầu'}</button>
                  {editing && <div className="grid gap-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600">Mã yêu cầu<input aria-label={`Mã yêu cầu ${definition.name}`} maxLength={64} value={definition.code} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-600">Tên tài liệu<input aria-label={`Tên tài liệu ${definition.name}`} maxLength={200} value={definition.name} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Mô tả<textarea aria-label={`Mô tả ${definition.name}`} maxLength={1000} value={definition.description || ''} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-600">Mức yêu cầu<select aria-label={`Mức yêu cầu ${definition.name}`} value={definition.level} onChange={(event) => updateRequirementDefinition(id, (current) => { const level = event.target.value as DossierTemplateRequirementLevel; return { ...current, level, ...(level === 'CONDITIONAL' ? { condition: current.condition || 'RESULT_FAILED' } : { condition: undefined }) }; })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="REQUIRED">Bắt buộc</option><option value="OPTIONAL">Tùy chọn</option><option value="CONDITIONAL">Có điều kiện</option></select></label>
                    {definition.level === 'CONDITIONAL' && <label className="text-xs font-semibold text-slate-600">Điều kiện<select aria-label={`Điều kiện ${definition.name}`} value={definition.condition || 'RESULT_FAILED'} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, condition: event.target.value as DossierTemplateRequirementDefinition['condition'] }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="RESULT_FAILED">Kết quả không đạt</option><option value="RESULT_PASSED">Kết quả đạt</option></select></label>}
                    <label className="text-xs font-semibold text-slate-600">Nguồn tài liệu<select aria-label={`Nguồn tài liệu ${definition.name}`} value={definition.source} onChange={(event) => setRequirementSource(id, event.target.value as DossierTemplateRequirementSource)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="UPLOAD_EXTERNAL">Tải tệp bên ngoài</option><option value="DRAFT_FROM_DOCX_TEMPLATE" disabled={props.model.domain === 'PCN'}>Tạo bản nháp từ DOCX{props.model.domain === 'PCN' ? ' (chỉ PGD)' : ''}</option><option value="BUSINESS_MODULE_LINK">Liên kết mô-đun nghiệp vụ</option></select></label>
                    {definition.source === 'DRAFT_FROM_DOCX_TEMPLATE' && <label className="text-xs font-semibold text-slate-600">Mẫu DOCX<select aria-label={`Mẫu DOCX ${definition.name}`} value={definition.linkedDocxTemplateId || ''} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, linkedDocxTemplateId: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Chọn mẫu DOCX</option>{(props.docxTemplates || []).map((docxTemplate) => <option key={docxTemplate.id} value={docxTemplate.id}>{docxTemplate.label}</option>)}</select></label>}
                    {definition.source === 'BUSINESS_MODULE_LINK' && <label className="text-xs font-semibold text-slate-600">Mô-đun nghiệp vụ<select aria-label={`Mô-đun nghiệp vụ ${definition.name}`} value={definition.businessModuleKey || ''} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, businessModuleKey: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Chọn mô-đun</option><option value="REQUEST">Yêu cầu</option><option value="FIELD_ASSESSMENT">Đánh giá tại chỗ</option><option value="TESTING">Thử nghiệm</option><option value="CORRECTIVE_ACTION">Hành động khắc phục</option><option value="RESULT">Kết quả</option><option value="ISSUANCE">Phát hành</option></select></label>}
                    <label className="text-xs font-semibold text-slate-600">Vai trò phụ trách<select aria-label={`Vai trò phụ trách ${definition.name}`} value={definition.ownerRole} onChange={(event) => updateRequirementDefinition(id, (current) => ({ ...current, ownerRole: event.target.value as DossierTemplateRequirementDefinition['ownerRole'] }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value={props.model.domain === 'PCN' ? 'CERTIFICATION_EXPERT' : 'PGD_FIELD_INSPECTOR'}>{props.model.domain === 'PCN' ? 'Chuyên gia chứng nhận' : 'Giám định viên'}</option><option value={props.model.domain === 'PCN' ? 'TECHNICAL_REVIEWER' : 'PGD_MANAGER'}>Người soát xét / quản lý</option><option value={props.model.domain === 'PCN' ? 'LEADERSHIP' : 'PGD_ADMIN'}>Lãnh đạo</option></select></label>
                    <p className="self-center text-xs text-slate-500">Một tệp hiện hành; bản thay thế được lưu thành phiên bản tiếp theo.</p>
                    {errors.length > 0 && <p role="alert" className="text-xs font-medium text-rose-700 sm:col-span-2">{errors.join(' ')}</p>}
                  </div>}
                </div>;
              })}
              {requirementIds.map((id) => {
                const definition = (props.model.requirementDefinitions || []).find((item) => item.id === id);
                const legacyMultiple = definition?.multiplicity === 'MULTIPLE';
                const unsupportedPcnDocx = props.model.domain === 'PCN' && definition?.source === 'DRAFT_FROM_DOCX_TEMPLATE';
                if (!definition || (!legacyMultiple && !unsupportedPcnDocx)) return null;
                const { linkedDocxTemplateId: _linkedDocxTemplateId, ...withoutDocxLink } = definition;
                return <div key={`legacy-${id}`} role="status" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>{legacyMultiple && 'Cấu hình cũ: runtime chỉ giữ một tệp hiện hành.'}{legacyMultiple && unsupportedPcnDocx && ' '}{unsupportedPcnDocx && 'PCN chưa hỗ trợ sinh từ DOCX liên kết; hồ sơ dùng tệp tải lên.'}</span>
                  {props.canMutate && <span className="flex flex-wrap gap-2">{legacyMultiple && <button type="button" onClick={() => updateRequirementDefinition(id, (current) => ({ ...current, multiplicity: 'SINGLE' }))} className="min-h-9 rounded border border-amber-300 bg-white px-2 font-semibold">Đổi sang một tệp hiện hành</button>}{unsupportedPcnDocx && <button type="button" onClick={() => updateRequirementDefinition(id, () => ({ ...withoutDocxLink, source: 'UPLOAD_EXTERNAL' }))} className="min-h-9 rounded border border-amber-300 bg-white px-2 font-semibold">Đổi sang tải tệp bên ngoài</button>}</span>}
                </div>;
              })}
              <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={!props.canMutate} onClick={() => { setCreatingRequirement((open) => !open); setRequirementError(''); }} className="min-h-11 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">{creatingRequirement ? 'Đóng biểu mẫu' : 'Tạo yêu cầu mới'}</button><button type="button" disabled={!props.canMutate} onClick={() => setShowCatalog((open) => !open)} className="min-h-11 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40">{showCatalog ? 'Ẩn danh mục' : 'Thêm từ danh mục'}</button></div>
              {creatingRequirement && <div className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:grid-cols-2" data-testid="dossier-template-new-requirement-form"><p className="text-xs text-slate-600 sm:col-span-2">Đây là định nghĩa trong mẫu. Tệp thực tế sẽ được thêm khi hồ sơ được xử lý.</p><label className="text-xs font-semibold text-slate-600">Mã yêu cầu<input aria-label="Mã yêu cầu" maxLength={40} value={requirementDraft.code} onChange={(event) => setRequirementDraft({ ...requirementDraft, code: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" placeholder="VD: BIEN_BAN_KIEM_TRA" /></label><label className="text-xs font-semibold text-slate-600">Tên tài liệu<input aria-label="Tên tài liệu" maxLength={160} value={requirementDraft.name} onChange={(event) => setRequirementDraft({ ...requirementDraft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" placeholder="Tên tài liệu cần có" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Mô tả<textarea aria-label="Mô tả yêu cầu" maxLength={500} value={requirementDraft.description} onChange={(event) => setRequirementDraft({ ...requirementDraft, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">Mức yêu cầu<select aria-label="Mức yêu cầu" value={requirementDraft.level} onChange={(event) => setRequirementDraft({ ...requirementDraft, level: event.target.value as DossierTemplateRequirementLevel })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="REQUIRED">Bắt buộc</option><option value="OPTIONAL">Tùy chọn</option><option value="CONDITIONAL">Có điều kiện</option></select></label>{requirementDraft.level === 'CONDITIONAL' && <label className="text-xs font-semibold text-slate-600">Điều kiện<select aria-label="Điều kiện yêu cầu" value={requirementDraft.condition} onChange={(event) => setRequirementDraft({ ...requirementDraft, condition: event.target.value as DossierTemplateRequirementDefinition['condition'] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="RESULT_FAILED">Kết quả không đạt</option><option value="RESULT_PASSED">Kết quả đạt</option></select></label>}<label className="text-xs font-semibold text-slate-600">Nguồn tài liệu<select aria-label="Nguồn tài liệu" value={requirementDraft.source} onChange={(event) => setRequirementDraft({ ...requirementDraft, source: event.target.value as DossierTemplateRequirementSource })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="UPLOAD_EXTERNAL">Tải tệp bên ngoài</option><option value="DRAFT_FROM_DOCX_TEMPLATE" disabled={props.model.domain === 'PCN'}>Tạo bản nháp từ DOCX{props.model.domain === 'PCN' ? ' (chỉ PGD)' : ''}</option><option value="BUSINESS_MODULE_LINK">Liên kết mô-đun nghiệp vụ</option></select></label>{requirementDraft.source === 'DRAFT_FROM_DOCX_TEMPLATE' && <label className="text-xs font-semibold text-slate-600">Mẫu DOCX<select aria-label="Mẫu DOCX liên kết" value={requirementDraft.linkedDocxTemplateId} onChange={(event) => setRequirementDraft({ ...requirementDraft, linkedDocxTemplateId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Chọn mẫu DOCX</option>{(props.docxTemplates || []).map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>}{requirementDraft.source === 'BUSINESS_MODULE_LINK' && <label className="text-xs font-semibold text-slate-600">Mô-đun nghiệp vụ<select aria-label="Mô-đun nghiệp vụ" value={requirementDraft.businessModuleKey} onChange={(event) => setRequirementDraft({ ...requirementDraft, businessModuleKey: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Chọn mô-đun</option><option value="REQUEST">Yêu cầu</option><option value="FIELD_ASSESSMENT">Đánh giá tại chỗ</option><option value="TESTING">Thử nghiệm</option><option value="CORRECTIVE_ACTION">Hành động khắc phục</option><option value="RESULT">Kết quả</option><option value="ISSUANCE">Phát hành</option></select></label>}<label className="text-xs font-semibold text-slate-600">Vai trò phụ trách<select aria-label="Vai trò phụ trách" value={requirementDraft.ownerRole} onChange={(event) => setRequirementDraft({ ...requirementDraft, ownerRole: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value={props.model.domain === 'PCN' ? 'CERTIFICATION_EXPERT' : 'PGD_FIELD_INSPECTOR'}>{props.model.domain === 'PCN' ? 'Chuyên gia chứng nhận' : 'Giám định viên'}</option><option value={props.model.domain === 'PCN' ? 'TECHNICAL_REVIEWER' : 'PGD_MANAGER'}>Người soát xét / quản lý</option><option value={props.model.domain === 'PCN' ? 'LEADERSHIP' : 'PGD_ADMIN'}>Lãnh đạo</option></select></label><label className="text-xs font-semibold text-slate-600">Số lượng tệp<select aria-label="Số lượng tệp" disabled value="SINGLE" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm text-slate-700"><option value="SINGLE">Một tệp hiện hành</option></select></label><p className="text-xs text-slate-500 sm:col-span-2">Tải tệp mới sẽ tạo phiên bản tiếp theo trong lịch sử của yêu cầu này.</p>{requirementError && <p role="alert" className="text-xs font-medium text-rose-700 sm:col-span-2">{requirementError}</p>}<button type="button" onClick={() => addRequirement(stage.id)} className="min-h-11 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white sm:col-span-2">Thêm yêu cầu vào giai đoạn</button></div>}
              {showCatalog && <div className="mt-3 rounded-lg border border-slate-200 p-3"><label className="block text-xs font-semibold text-slate-600">Tìm trong danh mục<input aria-label="Tìm tài liệu trong danh mục" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" /></label><div className="mt-2 max-h-64 space-y-1 overflow-y-auto">{visibleOptions.map((option) => <label key={option.id} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={requirementIds.includes(option.id)} disabled={!props.canMutate} onChange={(event) => setRequirement(stage.id, option.id, event.target.checked)} />{option.label}<span className="ml-auto text-[10px] text-slate-500">{option.group || ''}</span></label>)}{visibleOptions.length === 0 && <p className="py-3 text-center text-xs text-slate-500">Không tìm thấy tài liệu phù hợp.</p>}</div></div>}
            </div>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
