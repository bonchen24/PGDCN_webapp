'use client';

import { useMemo, useState } from 'react';
import { FilePlus2, GitBranch, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnDocumentRequirement, PcnUserAccount, PcnWorkflowTemplate } from '../types.ts';
import type { PgdDossierRequirement } from '../utils/pgdDossier.ts';
import type { PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';
import { isPcnSystemManager } from '../utils/pcnRbac.ts';
import { fromPcnDossierTemplateEditorModel, fromPgdDossierTemplateEditorModel, toPcnDossierTemplateEditorModel, toPgdDossierTemplateEditorModel, type DossierTemplateDomain, type DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import PgdcnDossierTemplateEditor from './PgdcnDossierTemplateEditor.tsx';
import PgdcnDossierTemplateArchifyPreview from './PgdcnDossierTemplateArchifyPreview.tsx';
import type { DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

type TemplateStatus = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'RETIRED';
type EditorMode = 'new' | 'draft' | 'revision' | 'view';

export interface PgdcnDossierTemplateManagementViewProps {
  currentUser: PcnUserAccount;
  pcnTemplates: PcnWorkflowTemplate[];
  pcnRequirements: PcnDocumentRequirement[];
  pgdTemplates: PgdWorkflowTemplate[];
  pgdRequirements: PgdDossierRequirement[];
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
    nodes: [
      { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', active: true, laneId: 'intake', column: 1, sortOrder: 10, requirementRefs: [] },
      { id: 'end', kind: 'END', label: 'Kết thúc', active: true, laneId: 'archive', column: 6, sortOrder: 20, requirementRefs: [] },
    ],
    transitions: [{ id: 'edge-start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function PgdcnDossierTemplateManagementView(props: PgdcnDossierTemplateManagementViewProps) {
  const scopes = props.currentUser.departmentScopes || [];
  const canPcn = scopes.includes('PCN') && isPcnSystemManager(props.currentUser);
  const canPgd = scopes.includes('PGD') && canManagePgd(props.currentUser);
  const [domain, setDomain] = useState<DossierTemplateDomain>(canPcn ? 'PCN' : 'PGD');
  const [status, setStatus] = useState<TemplateStatus>('ALL');
  const [query, setQuery] = useState('');
  const [editorModel, setEditorModel] = useState<DossierTemplateEditorModel>();
  const [sourceTemplate, setSourceTemplate] = useState<PcnWorkflowTemplate | PgdWorkflowTemplate>();
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [previewModel, setPreviewModel] = useState<DossierTemplateEditorModel>();
  const [editorDirty, setEditorDirty] = useState(false);

  const pcnOptions: DossierTemplateRequirementOption[] = useMemo(() => props.pcnRequirements.map((requirement) => ({ id: requirement.id, label: requirement.name, description: requirement.description, group: requirement.fieldCode, required: requirement.required })), [props.pcnRequirements]);
  const pgdOptions: DossierTemplateRequirementOption[] = useMemo(() => props.pgdRequirements.map((requirement) => ({ id: requirement.code, label: requirement.title, description: requirement.description, group: requirement.group, required: requirement.required })), [props.pgdRequirements]);
  const templates = domain === 'PCN' ? props.pcnTemplates : props.pgdTemplates;
  const visibleTemplates = useMemo(() => templates.filter((template) => (status === 'ALL' || template.status === status) && (!query.trim() || `${template.code} ${template.name} ${template.description || ''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))), [query, status, templates]);

  const closeEditor = () => {
    if (editorDirty && editorMode !== 'view' && !window.confirm('Thay đổi chưa lưu sẽ bị mất. Bạn có muốn rời trình chỉnh sửa không?')) return false;
    setEditorModel(undefined);
    setSourceTemplate(undefined);
    setPreviewModel(undefined);
    setEditorDirty(false);
    return true;
  };

  const openTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    const isPcn = domain === 'PCN';
    const model = isPcn ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements) : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    setEditorModel(model);
    setSourceTemplate(clone(template));
    setEditorMode(template.status === 'DRAFT' ? 'draft' : template.status === 'PUBLISHED' ? 'revision' : 'view');
    setSaveError('');
    setPreviewModel(undefined);
    setEditorDirty(false);
  };

  const createNew = () => {
    if (!closeEditor()) return;
    setEditorModel(blankModel(domain));
    setSourceTemplate(undefined);
    setEditorMode('new');
    setSaveError('');
    setPreviewModel(undefined);
    setEditorDirty(false);
  };

  const save = async (model: DossierTemplateEditorModel) => {
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
      toast.success(editorMode === 'revision' ? 'Đã tạo bản nháp revision.' : 'Đã lưu bộ hồ sơ mẫu.');
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
      toast.success(`Đã publish ${template.name} v${template.version}.`);
    } catch (error: any) { toast.error(error?.message || 'Không thể publish bộ hồ sơ mẫu.'); }
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

  if (!canPcn && !canPgd) return <section data-testid="pgdcn-dossier-template-denied" className="m-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 md:m-5"><div className="flex items-center gap-2"><ShieldAlert size={18} /> Tài khoản hiện tại không có quyền quản trị bộ hồ sơ mẫu.</div><p className="mt-2 text-xs font-normal">Cần role Admin/Quản lý và scope PCN hoặc PGD tương ứng.</p></section>;

  const activeCanMutate = domain === 'PCN' ? canPcn : canPgd;
  return <div data-testid="pgdcn-dossier-template-management" className="min-w-0 space-y-4 bg-slate-50/60 p-3 md:p-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><GitBranch size={19} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">PGDCN • Quản trị vận hành</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Hồ sơ mẫu</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Tập hợp các bộ hồ sơ mẫu, lưu trình và loại tài liệu cần có ở từng node. File thật chỉ được tải lên khi hồ sơ chạy.</p></div></div><button type="button" className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" onClick={createNew}><FilePlus2 size={16} /> Tạo bộ hồ sơ mới</button></div><div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Chọn lĩnh vực hồ sơ mẫu"><button type="button" role="tab" aria-selected={domain === 'PCN'} disabled={!canPcn} onClick={() => { if (domain !== 'PCN' && !closeEditor()) return; setDomain('PCN'); }} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${domain === 'PCN' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600'} disabled:cursor-not-allowed disabled:opacity-40`}>PCN · Chứng nhận</button><button type="button" role="tab" aria-selected={domain === 'PGD'} disabled={!canPgd} onClick={() => { if (domain !== 'PGD' && !closeEditor()) return; setDomain('PGD'); }} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${domain === 'PGD' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'} disabled:cursor-not-allowed disabled:opacity-40`}>PGD · Giám định</button></div></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]" data-testid="pgdcn-dossier-template-filters"><label className="relative block"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bộ hồ sơ theo tên hoặc mã..." className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm" /></label><select value={status} onChange={(event) => setStatus(event.target.value as TemplateStatus)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đang áp dụng</option><option value="RETIRED">Đã ngừng</option></select></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleTemplates.map((template) => <article key={template.id} data-testid={`pgdcn-dossier-template-card-${template.id}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3"><div className={`mt-0.5 rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass(template.status)}`}>{statusLabel(template.status)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-slate-500">{template.code}</span><span className="text-xs text-slate-400">v{template.version}</span></div><h2 className="mt-1 truncate text-sm font-semibold text-slate-800">{template.name}</h2><p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.description || 'Chưa có mô tả.'}</p><div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phạm vi áp dụng</p><div data-testid={`pgdcn-dossier-template-scope-${template.id}`} className="mt-1 flex flex-wrap gap-1.5">{applicationScopeLabels(template).map((label) => <span key={label} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">{label}</span>)}{applicationScopeLabels(template).length === 0 && <span className="text-[10px] text-slate-400">Chưa chọn phạm vi</span>}</div></div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>{template.nodes.length} node</span><span>· {template.transitions.length} nối</span><span>· {new Set(template.nodes.flatMap((node) => 'requirementIds' in node ? node.requirementIds : node.requirementCodes)).size} loại tài liệu</span></div></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700" onClick={() => openTemplate(template)}>{template.status === 'PUBLISHED' ? 'Tạo revision' : template.status === 'DRAFT' ? 'Mở chỉnh sửa' : 'Xem chi tiết'}</button>{template.status === 'DRAFT' && <button type="button" className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white" onClick={() => void publish(template)}>Publish</button>}{template.status === 'PUBLISHED' && <button type="button" className="min-h-11 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-semibold text-orange-700" onClick={() => void retire(template)}>Ngừng áp dụng</button>}</div></article>)}{visibleTemplates.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 lg:col-span-2">Chưa có bộ hồ sơ mẫu phù hợp bộ lọc.</div>}</div></section>
    {editorModel && <section data-testid="pgdcn-dossier-template-editor-surface" className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-blue-600">{editorMode === 'revision' ? 'Bản nháp revision' : editorMode === 'new' ? 'Bộ hồ sơ mới' : editorMode === 'view' ? 'Xem bộ hồ sơ' : 'Chỉnh sửa bản nháp'}</p>{editorDirty && editorMode !== 'view' && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Có thay đổi chưa lưu</span>}</div><p className="mt-1 text-xs text-slate-500">{editorMode === 'revision' ? 'Bản đã publish giữ nguyên; thay đổi sẽ tạo version mới.' : editorMode === 'view' ? 'Bộ hồ sơ đã ngừng áp dụng và không thể chỉnh sửa.' : 'Cấu hình node và loại tài liệu bằng giao diện trực quan.'}</p></div><button type="button" className="min-h-11 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100" onClick={closeEditor}>Đóng</button></div><PgdcnDossierTemplateEditor model={editorModel} requirements={domain === 'PCN' ? pcnOptions : pgdOptions} onChange={(model) => { setEditorModel(model); setEditorDirty(true); }} onSaveDraft={save} onPreview={(model) => setPreviewModel(model)} canMutate={activeCanMutate && editorMode !== 'view'} saving={saving} saveError={saveError} />{previewModel && <div className="mt-5"><PgdcnDossierTemplateArchifyPreview domain={domain} model={previewModel} /></div>}</section>}
  </div>;
}
