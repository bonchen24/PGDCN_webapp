'use client';

import { useMemo, useState } from 'react';
import { FilePlus2, GitBranch, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnDocumentRequirement, PcnTemplateDefinition, PcnUserAccount, PcnWorkflowTemplate } from '../types.ts';
import type { PgdDossierRequirement } from '../utils/pgdDossier.ts';
import type { PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';
import type { PgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import { isPcnSystemManager } from '../utils/pcnRbac.ts';
import { DEFAULT_DOSSIER_TEMPLATE_STAGES, fromPcnDossierTemplateEditorModel, fromPgdDossierTemplateEditorModel, toPcnDossierTemplateEditorModel, toPgdDossierTemplateEditorModel, type DossierTemplateDomain, type DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import PgdcnDossierTemplateEditor from './PgdcnDossierTemplateEditor.tsx';
import PgdcnDossierTemplatePreview from './PgdcnDossierTemplatePreview.tsx';
import type { DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

type TemplateStatus = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'RETIRED';
type EditorMode = 'new' | 'draft' | 'revision' | 'view';

export interface PgdcnDossierTemplateManagementViewProps {
  currentUser: PcnUserAccount;
  pcnTemplates: PcnWorkflowTemplate[];
  pcnRequirements: PcnDocumentRequirement[];
  pcnDocxTemplates?: PcnTemplateDefinition[];
  pgdTemplates: PgdWorkflowTemplate[];
  pgdRequirements: PgdDossierRequirement[];
  pgdDocxTemplates?: PgdDocumentTemplate[];
  onCreatePcnWorkflowTemplate: (template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  onUpdatePcnWorkflowTemplate: (templateId: string, template: PcnWorkflowTemplate, expectedUpdatedAt?: string) => Promise<PcnWorkflowTemplate>;
  onCreatePcnWorkflowRevision: (templateId: string, template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  onPublishPcnWorkflowTemplate: (templateId: string) => Promise<PcnWorkflowTemplate>;
  onRetirePcnWorkflowTemplate: (templateId: string, reason: string) => Promise<PcnWorkflowTemplate>;
  onCreatePgdWorkflowTemplate: (template: PgdWorkflowTemplate) => Promise<PgdWorkflowTemplate>;
  onUpdatePgdWorkflowTemplate: (templateId: string, template: PgdWorkflowTemplate, expectedUpdatedAt?: string) => Promise<PgdWorkflowTemplate>;
  onCreatePgdWorkflowRevision: (templateId: string, template: PgdWorkflowTemplate) => Promise<PgdWorkflowTemplate>;
  onPublishPgdWorkflowTemplate: (templateId: string) => Promise<PgdWorkflowTemplate>;
  onRetirePgdWorkflowTemplate: (templateId: string, reason: string) => Promise<PgdWorkflowTemplate>;
}

function canManagePgd(currentUser: PcnUserAccount): boolean {
  return String(currentUser.pgdRole || '').toUpperCase() === 'PGD_ADMIN'
    || String(currentUser.pgdRole || '').toUpperCase() === 'PGD_MANAGER'
    || isPcnSystemManager(currentUser);
}

function canProposePcn(currentUser: PcnUserAccount): boolean {
  return currentUser.active !== false
    && currentUser.role !== 'viewer'
    && currentUser.systemRole !== 'viewer'
    && (currentUser.departmentScopes || []).includes('PCN');
}

function canProposePgd(currentUser: PcnUserAccount): boolean {
  return currentUser.active !== false
    && currentUser.role !== 'viewer'
    && currentUser.systemRole !== 'viewer'
    && String(currentUser.pgdRole || '').trim().toUpperCase() !== 'PGD_VIEWER'
    && (currentUser.departmentScopes || []).includes('PGD');
}

function statusLabel(status: Exclude<TemplateStatus, 'ALL'>): string {
  return status === 'PUBLISHED' ? 'Đang áp dụng' : status === 'RETIRED' ? 'Đã ngừng' : 'Bản nháp';
}

function statusClass(status: Exclude<TemplateStatus, 'ALL'>): string {
  return status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'RETIRED' ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-amber-200 bg-amber-50 text-amber-700';
}

const PCN_SCOPE_LABELS: Record<string, string> = { QC4: 'QC4 · Hợp quy', QC9: 'QC9 · Hợp chuẩn' };
const PGD_SCOPE_LABELS: Record<string, string> = { STEEL_METAL: 'Thép và kim loại', MACHINERY_LINE: 'Máy móc và dây chuyền', COAL: 'Than', OTHER: 'Nhóm khác' };

function applicationScopeLabels(template: PcnWorkflowTemplate | PgdWorkflowTemplate): string[] {
  if ('fieldCodes' in template.appliesTo) {
    return [
      ...template.appliesTo.fieldCodes.map((code) => PCN_SCOPE_LABELS[code] || code),
      ...(template.appliesTo.methods || []).map((method) => method.replace('METHOD_', 'Phương thức ')),
    ];
  }
  return [
    ...template.appliesTo.productGroups.map((group) => PGD_SCOPE_LABELS[group] || group),
    ...(template.appliesTo.methodCodes || []).map((method) => `Phương pháp ${method}`),
  ];
}

function blankModel(domain: DossierTemplateDomain): DossierTemplateEditorModel {
  const suffix = Date.now().toString(36);
  return {
    domain,
    id: `${domain.toLowerCase()}-workflow-${suffix}`,
    code: `${domain}-NEW-${suffix.toUpperCase()}`,
    name: `Bộ hồ sơ ${domain} mới`,
    description: '',
    version: 1,
    status: 'DRAFT',
    appliesTo: domain === 'PCN' ? { fieldCodes: ['QC4'] } : { productGroups: ['OTHER'], methodCodes: ['METHOD_7'] },
    stages: DEFAULT_DOSSIER_TEMPLATE_STAGES.map((stage) => ({ ...stage, requirementIds: [] })),
    nodes: [
      { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', active: true, laneId: 'intake', column: 1, sortOrder: 10, stageId: 'intake-documents', requirementRefs: [] },
      { id: 'end', kind: 'END', label: 'Kết thúc', active: true, laneId: 'archive', column: 6, sortOrder: 20, stageId: 'issuance-archive', requirementRefs: [] },
    ],
    transitions: [{ id: 'edge-start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function PgdcnDossierTemplateManagementView(props: PgdcnDossierTemplateManagementViewProps) {
  const scopes = props.currentUser.departmentScopes || [];
  const canManagePcn = scopes.includes('PCN') && isPcnSystemManager(props.currentUser);
  const canManagePgdDomain = scopes.includes('PGD') && canManagePgd(props.currentUser);
  const canPcn = canManagePcn || canProposePcn(props.currentUser);
  const canPgd = canManagePgdDomain || canProposePgd(props.currentUser);
  const [domain, setDomain] = useState<DossierTemplateDomain>(canPcn ? 'PCN' : 'PGD');
  const [status, setStatus] = useState<TemplateStatus>('ALL');
  const [query, setQuery] = useState('');
  const [editorModel, setEditorModel] = useState<DossierTemplateEditorModel>();
  const [sourceTemplate, setSourceTemplate] = useState<PcnWorkflowTemplate | PgdWorkflowTemplate>();
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [activePreview, setActivePreview] = useState<DossierTemplateEditorModel>();
  const activeCanManage = domain === 'PCN' ? canManagePcn : canManagePgdDomain;
  const activeCanPropose = domain === 'PCN' ? canProposePcn(props.currentUser) : canProposePgd(props.currentUser);
  const canSaveEditor = activeCanPropose && (editorMode === 'new'
    || (activeCanManage && sourceTemplate?.scope !== 'PERSONAL')
    || (editorMode === 'draft' && sourceTemplate?.scope === 'PERSONAL' && sourceTemplate.createdBy === props.currentUser.username && sourceTemplate.status === 'DRAFT'));

  const pcnOptions: DossierTemplateRequirementOption[] = useMemo(() => {
    const options = new Map<string, DossierTemplateRequirementOption>(props.pcnRequirements.map((requirement) => [requirement.id, { id: requirement.id, label: requirement.name, description: requirement.description, group: requirement.fieldCode, required: requirement.required }]));
    for (const template of props.pcnTemplates) for (const definition of template.requirementDefinitions || []) options.set(definition.id, { id: definition.id, label: definition.name, description: definition.description || definition.code, group: `${template.code} · ${definition.code}`, required: definition.level === 'REQUIRED', definition });
    return [...options.values()];
  }, [props.pcnRequirements, props.pcnTemplates]);
  const pgdOptions: DossierTemplateRequirementOption[] = useMemo(() => {
    const options = new Map<string, DossierTemplateRequirementOption>(props.pgdRequirements.map((requirement) => [requirement.code, { id: requirement.code, label: requirement.title, description: requirement.description, group: requirement.group, required: requirement.required }]));
    for (const template of props.pgdTemplates) for (const definition of template.requirementDefinitions || []) options.set(definition.id, { id: definition.id, label: definition.name, description: definition.description || definition.code, group: `${template.code} · ${definition.code}`, required: definition.level === 'REQUIRED', definition });
    return [...options.values()];
  }, [props.pgdRequirements, props.pgdTemplates]);
  const pcnDocxOptions = useMemo(() => (props.pcnDocxTemplates || []).filter((template) => template.status === 'APPROVED').map((template) => ({ id: template.id, label: template.displayName })), [props.pcnDocxTemplates]);
  const pgdDocxOptions = useMemo(() => (props.pgdDocxTemplates || []).filter((template) => template.active).map((template) => ({ id: template.id, label: template.name })), [props.pgdDocxTemplates]);
  const templates = domain === 'PCN' ? props.pcnTemplates : props.pgdTemplates;
  const accessibleTemplates = useMemo(() => templates.filter((template) => activeCanManage
    || (template.scope === 'PERSONAL'
      ? template.status === 'DRAFT' && template.createdBy === props.currentUser.username
      : template.status === 'PUBLISHED')),
  [activeCanManage, props.currentUser.username, templates]);
  const counts = useMemo(() => ({
    all: accessibleTemplates.length,
    published: accessibleTemplates.filter((template) => template.status === 'PUBLISHED').length,
    draft: accessibleTemplates.filter((template) => template.status === 'DRAFT').length,
    retired: accessibleTemplates.filter((template) => template.status === 'RETIRED').length,
  }), [accessibleTemplates]);
  const visibleTemplates = useMemo(() => accessibleTemplates.filter((template) =>
    (status === 'ALL' || template.status === status)
      && (!query.trim() || `${template.code} ${template.name} ${template.description || ''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))),
  [accessibleTemplates, query, status]);

  const closeEditor = () => {
    if (editorDirty && editorMode !== 'view' && !window.confirm('Thay đổi chưa lưu sẽ bị mất. Bạn có muốn rời trình chỉnh sửa không?')) return false;
    setEditorModel(undefined);
    setSourceTemplate(undefined);
    setEditorDirty(false);
    return true;
  };

  const previewTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    const isPcn = domain === 'PCN';
    const model = isPcn ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements) : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    setActivePreview(model);
  };

  const openTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    const isPcn = domain === 'PCN';
    const model = isPcn ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements) : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    setEditorModel(model);
    setSourceTemplate(clone(template));
    const personalProposalOwnedBySomeoneElse = template.scope === 'PERSONAL' && template.createdBy !== props.currentUser.username;
    setEditorMode(personalProposalOwnedBySomeoneElse ? 'view' : template.status === 'DRAFT' ? 'draft' : template.status === 'PUBLISHED' ? 'revision' : 'view');
    setSaveError('');
    setEditorDirty(false);
  };

  const createNew = () => {
    if (!activeCanPropose) return;
    if (!closeEditor()) return;
    setActivePreview(undefined);
    setEditorModel(blankModel(domain));
    setSourceTemplate(undefined);
    setEditorMode('new');
    setSaveError('');
    setEditorDirty(false);
  };

  const cloneTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    const model = domain === 'PCN'
      ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements)
      : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    const suffix = Date.now().toString(36);
    setEditorModel({ ...model, id: `${domain.toLowerCase()}-workflow-${suffix}`, code: `${domain}-${suffix.toUpperCase()}`, name: `${model.name} (bản sao)`, version: 1, status: 'DRAFT', updatedAt: undefined });
    setSourceTemplate(undefined);
    setEditorMode('new');
    setSaveError('');
    setEditorDirty(false);
  };

  const save = async (model: DossierTemplateEditorModel) => {
    if (!canSaveEditor) {
      setSaveError('Chỉ có thể lưu bộ hồ sơ mới hoặc bản nháp cá nhân do bạn tạo.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      if (domain === 'PCN') {
        const base = sourceTemplate && 'appliesTo' in sourceTemplate && 'fieldCodes' in sourceTemplate.appliesTo ? sourceTemplate : { ...blankModel('PCN'), createdAt: new Date().toISOString(), createdBy: props.currentUser.username, updatedAt: new Date().toISOString(), updatedBy: props.currentUser.username } as unknown as PcnWorkflowTemplate;
        const template = fromPcnDossierTemplateEditorModel(model, base as PcnWorkflowTemplate);
        if (editorMode === 'new') await props.onCreatePcnWorkflowTemplate(template);
        else if (editorMode === 'revision') await props.onCreatePcnWorkflowRevision((sourceTemplate as PcnWorkflowTemplate).id, template);
        else await props.onUpdatePcnWorkflowTemplate(template.id, template, sourceTemplate && 'updatedAt' in sourceTemplate ? sourceTemplate.updatedAt : undefined);
      } else {
        const base = sourceTemplate && 'domain' in sourceTemplate ? sourceTemplate : { ...blankModel('PGD'), domain: 'pgd', createdAt: new Date().toISOString(), createdBy: props.currentUser.username, updatedAt: new Date().toISOString(), updatedBy: props.currentUser.username } as unknown as PgdWorkflowTemplate;
        const template = fromPgdDossierTemplateEditorModel(model, base as PgdWorkflowTemplate);
        if (editorMode === 'new') await props.onCreatePgdWorkflowTemplate(template);
        else if (editorMode === 'revision') await props.onCreatePgdWorkflowRevision((sourceTemplate as PgdWorkflowTemplate).id, template);
        else await props.onUpdatePgdWorkflowTemplate(template.id, template, sourceTemplate && 'updatedAt' in sourceTemplate ? sourceTemplate.updatedAt : undefined);
      }
      toast.success(editorMode === 'revision' ? 'Đã tạo bản nháp phiên bản mới.' : !activeCanManage ? 'Đã lưu đề xuất riêng của bạn.' : 'Đã lưu bộ hồ sơ mẫu.');
      setEditorModel(undefined);
      setSourceTemplate(undefined);
      setEditorDirty(false);
    } catch (error: any) {
      const message = error?.message || 'Không thể lưu bộ hồ sơ mẫu.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    try {
      if (domain === 'PCN') await props.onPublishPcnWorkflowTemplate(template.id);
      else await props.onPublishPgdWorkflowTemplate(template.id);
      toast.success(`Đã công bố ${template.name} phiên bản ${template.version}.`);
    } catch (error: any) { toast.error(error?.message || 'Không thể công bố bộ hồ sơ mẫu.'); }
  };

  const retire = async (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    const reason = window.prompt(`Lý do ngừng áp dụng “${template.name}”:`)?.trim() || '';
    if (!reason) return;
    try {
      if (domain === 'PCN') await props.onRetirePcnWorkflowTemplate(template.id, reason);
      else await props.onRetirePgdWorkflowTemplate(template.id, reason);
      toast.success('Đã ngừng áp dụng bộ hồ sơ mẫu.');
    } catch (error: any) { toast.error(error?.message || 'Không thể ngừng bộ hồ sơ mẫu.'); }
  };

  if (!canPcn && !canPgd) return <section data-testid="pgdcn-dossier-template-denied" className="m-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 md:m-5"><div className="flex items-center gap-2"><ShieldAlert size={18} /> Tài khoản hiện tại không có quyền xem hoặc đề xuất bộ hồ sơ mẫu.</div><p className="mt-2 text-xs font-normal">Cần tài khoản đang hoạt động và phạm vi PCN hoặc PGD tương ứng.</p></section>;

  return <div data-testid="pgdcn-dossier-template-management" className="min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><GitBranch size={19} /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">PGDCN · Mẫu quy trình và tài liệu</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Hồ sơ mẫu</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Tạo checklist tài liệu theo giai đoạn. Tệp thật chỉ được tải lên khi hồ sơ chạy.</p>
            {!activeCanManage && <p className="mt-1 text-xs text-indigo-700">Đề xuất của bạn được lưu riêng; quản lý có thể nhân bản thành mẫu dùng chung.</p>}
          </div>
        </div>
        <button type="button" className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" onClick={createNew}>
          <FilePlus2 size={16} /> {activeCanManage ? 'Tạo bộ hồ sơ mới' : 'Tạo đề xuất riêng'}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Chọn lĩnh vực hồ sơ mẫu">
        <button type="button" role="tab" aria-selected={domain === 'PCN'} disabled={!canPcn} onClick={() => { if (domain !== 'PCN' && !closeEditor()) return; setActivePreview(undefined); setDomain('PCN'); }} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${domain === 'PCN' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600'} disabled:cursor-not-allowed disabled:opacity-40`}>PCN · Chứng nhận</button>
        <button type="button" role="tab" aria-selected={domain === 'PGD'} disabled={!canPgd} onClick={() => { if (domain !== 'PGD' && !closeEditor()) return; setActivePreview(undefined); setDomain('PGD'); }} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${domain === 'PGD' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'} disabled:cursor-not-allowed disabled:opacity-40`}>PGD · Giám định</button>
      </div>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="pgdcn-toolbar-nowrap" data-testid="pgdcn-dossier-template-filters">
        <label className="pgdcn-toolbar-search block"><span className="mb-1 block text-[10px] font-black text-slate-600">Tìm kiếm bộ hồ sơ mẫu</span><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input aria-label="Tìm kiếm bộ hồ sơ mẫu" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm" /></div></label>
        <label className="pgdcn-toolbar-filter block"><span className="mb-1 block text-[10px] font-black text-slate-600">Trạng thái</span><select aria-label="Lọc trạng thái bộ hồ sơ mẫu" value={status} onChange={(event) => setStatus(event.target.value as TemplateStatus)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đang áp dụng</option><option value="RETIRED">Đã ngừng</option></select></label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Thống kê bộ hồ sơ mẫu" data-testid="pgdcn-dossier-template-counts">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[10px] font-semibold text-slate-500">Tất cả</p><p className="text-lg font-black text-slate-900">{counts.all}</p></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[10px] font-semibold text-emerald-700">Đang áp dụng</p><p className="text-lg font-black text-emerald-900">{counts.published}</p></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[10px] font-semibold text-amber-700">Bản nháp</p><p className="text-lg font-black text-amber-900">{counts.draft}</p></div>
        <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2"><p className="text-[10px] font-semibold text-slate-600">Đã ngừng</p><p className="text-lg font-black text-slate-800">{counts.retired}</p></div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visibleTemplates.map((template) => {
          const isPersonalDraft = template.scope === 'PERSONAL' && template.status === 'DRAFT' && template.createdBy === props.currentUser.username;
          const cloneInsteadOfOpen = !activeCanManage && template.status === 'PUBLISHED';
          const primaryLabel = cloneInsteadOfOpen ? 'Nhân bản để đề xuất' : isPersonalDraft && !activeCanManage ? 'Mở đề xuất riêng' : template.status === 'PUBLISHED' ? 'Tạo phiên bản mới' : template.status === 'DRAFT' ? 'Mở chỉnh sửa' : 'Xem chi tiết';
          return <article key={template.id} data-testid={`pgdcn-dossier-template-card-${template.id}`} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass(template.status)}`}>{statusLabel(template.status)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-slate-500">{template.code}</span><span className="text-xs text-slate-400">phiên bản {template.version}</span>{template.scope === 'PERSONAL' && <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">Đề xuất riêng{activeCanManage && template.createdBy ? ` · ${template.createdBy}` : ''}</span>}</div>
                <h2 className="mt-1 truncate text-sm font-semibold text-slate-800">{template.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.description || 'Chưa có mô tả.'}</p>
                <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phạm vi áp dụng</p><div data-testid={`pgdcn-dossier-template-scope-${template.id}`} className="mt-1 flex flex-wrap gap-1.5">{applicationScopeLabels(template).map((label) => <span key={label} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">{label}</span>)}{applicationScopeLabels(template).length === 0 && <span className="text-[10px] text-slate-400">Chưa chọn phạm vi</span>}</div></div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>{template.nodes.length} nút</span><span>· {template.transitions.length} chuyển tiếp</span><span>· {new Set(template.nodes.flatMap((node) => 'requirementIds' in node ? node.requirementIds : node.requirementCodes)).size} loại tài liệu</span></div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700" onClick={() => previewTemplate(template)}>Xem trước</button>
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700" onClick={() => cloneInsteadOfOpen ? cloneTemplate(template) : openTemplate(template)}>{primaryLabel}</button>
              {activeCanManage && <button type="button" className="min-h-11 rounded-lg border border-indigo-200 px-3 text-xs font-semibold text-indigo-700" onClick={() => cloneTemplate(template)}>Nhân bản</button>}
              {activeCanManage && template.status === 'DRAFT' && template.scope !== 'PERSONAL' && <button type="button" className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white" onClick={() => void publish(template)}>Công bố</button>}
              {activeCanManage && template.status === 'PUBLISHED' && template.scope !== 'PERSONAL' && <button type="button" className="min-h-11 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-semibold text-orange-700" onClick={() => void retire(template)}>Ngừng áp dụng</button>}
            </div>
          </article>;
        })}
        {visibleTemplates.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 lg:col-span-2">Chưa có bộ hồ sơ mẫu phù hợp bộ lọc.</div>}
      </div>
    </section>
    {activePreview && <section data-testid="pgdcn-dossier-template-preview-surface" className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5"><PgdcnDossierTemplatePreview model={activePreview} requirements={domain === 'PCN' ? pcnOptions : pgdOptions} onClose={() => setActivePreview(undefined)} /></section>}
    {editorModel && <section data-testid="pgdcn-dossier-template-editor-surface" className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-blue-600">{editorMode === 'revision' ? 'Bản nháp phiên bản mới' : editorMode === 'new' ? (activeCanManage ? 'Bộ hồ sơ mới' : 'Đề xuất riêng mới') : editorMode === 'view' ? 'Xem bộ hồ sơ' : (sourceTemplate?.scope === 'PERSONAL' ? 'Đề xuất riêng' : 'Chỉnh sửa bản nháp')}</p>{editorDirty && editorMode !== 'view' && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Có thay đổi chưa lưu</span>}</div><p className="mt-1 text-xs text-slate-500">{editorMode === 'revision' ? 'Bản đã công bố giữ nguyên; thay đổi sẽ tạo phiên bản mới.' : editorMode === 'view' ? 'Bộ hồ sơ đã ngừng áp dụng và không thể chỉnh sửa.' : !activeCanManage ? 'Bản nháp riêng chỉ bạn chỉnh sửa; quản lý sẽ nhân bản nếu chọn dùng chung.' : 'Định nghĩa tài liệu và nhóm theo giai đoạn; lưu trình nâng cao vẫn được giữ nguyên.'}</p></div><button type="button" className="min-h-11 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100" onClick={closeEditor}>Đóng</button></div><PgdcnDossierTemplateEditor model={editorModel} requirements={domain === 'PCN' ? pcnOptions : pgdOptions} docxTemplates={domain === 'PCN' ? pcnDocxOptions : pgdDocxOptions} onChange={(model) => { setEditorModel(model); setEditorDirty(true); }} onSaveDraft={save} canMutate={canSaveEditor && editorMode !== 'view'} saving={saving} saveError={saveError} /></section>}
  </div>;
}
