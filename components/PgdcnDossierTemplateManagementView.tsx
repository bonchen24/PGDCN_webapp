'use client';

import { useMemo, useState } from 'react';
import { 
  FilePlus2, 
  GitBranch, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Archive, 
  Layers, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  Copy, 
  Eye, 
  Edit3, 
  Ban 
} from 'lucide-react';
import { toast } from 'sonner';

import type { PcnDocumentRequirement, PcnUserAccount, PcnWorkflowTemplate } from '../types.ts';
import type { PgdDossierRequirement } from '../utils/pgdDossier.ts';
import type { PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';
import { isPcnSystemManager } from '../utils/pcnRbac.ts';
import { fromPcnDossierTemplateEditorModel, fromPgdDossierTemplateEditorModel, toPcnDossierTemplateEditorModel, toPgdDossierTemplateEditorModel, type DossierTemplateDomain, type DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import PgdcnDossierTemplateEditor from './PgdcnDossierTemplateEditor.tsx';
import PgdcnDossierTemplatePreview from './PgdcnDossierTemplatePreview.tsx';
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

function statusBadge(status: Exclude<TemplateStatus, 'ALL'>) {
  if (status === 'PUBLISHED') {
    return {
      wrap: 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 shadow-sm shadow-emerald-500/10',
      dot: 'bg-emerald-500 ring-2 ring-emerald-300/50',
    };
  }
  if (status === 'RETIRED') {
    return {
      wrap: 'border-slate-200 bg-slate-100 text-slate-600',
      dot: 'bg-slate-400',
    };
  }
  return {
    wrap: 'border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 shadow-sm shadow-amber-500/10',
    dot: 'bg-amber-500 ring-2 ring-amber-300/50',
  };
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

function getCardTheme(template: PcnWorkflowTemplate | PgdWorkflowTemplate) {
  const code = (template.code || '').toUpperCase();
  if (code.includes('QC4')) {
    return {
      accentTop: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500',
      tagBg: 'border-blue-200 bg-blue-50/80 text-blue-700',
      borderHover: 'hover:border-blue-400 hover:shadow-blue-500/10',
    };
  }
  if (code.includes('QC9')) {
    return {
      accentTop: 'bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-500',
      tagBg: 'border-purple-200 bg-purple-50/80 text-purple-700',
      borderHover: 'hover:border-purple-400 hover:shadow-purple-500/10',
    };
  }
  return {
    accentTop: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600',
    tagBg: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    borderHover: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
  };
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
  const [editorDirty, setEditorDirty] = useState(false);
  const [activePreview, setActivePreview] = useState<DossierTemplateEditorModel>();

  const pcnOptions: DossierTemplateRequirementOption[] = useMemo(() => props.pcnRequirements.map((requirement) => ({ id: requirement.id, label: requirement.name, description: requirement.description, group: requirement.fieldCode, required: requirement.required })), [props.pcnRequirements]);
  const pgdOptions: DossierTemplateRequirementOption[] = useMemo(() => props.pgdRequirements.map((requirement) => ({ id: requirement.code, label: requirement.title, description: requirement.description, group: requirement.group, required: requirement.required })), [props.pgdRequirements]);
  const templates = domain === 'PCN' ? props.pcnTemplates : props.pgdTemplates;

  const counts = useMemo(() => {
    return {
      all: templates.length,
      published: templates.filter(t => t.status === 'PUBLISHED').length,
      draft: templates.filter(t => t.status === 'DRAFT').length,
      retired: templates.filter(t => t.status === 'RETIRED').length,
    };
  }, [templates]);

  const visibleTemplates = useMemo(() => templates.filter((template) => (status === 'ALL' || template.status === status) && (!query.trim() || `${template.code} ${template.name} ${template.description || ''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))), [query, status, templates]);

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

  const cloneTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    const isPcn = domain === 'PCN';
    const baseModel = isPcn ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements) : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    const now = Date.now().toString(36).slice(-4).toUpperCase();
    const clonedModel: DossierTemplateEditorModel = {
      ...clone(baseModel),
      id: `${baseModel.id}-copy-${now.toLowerCase()}`,
      code: `${baseModel.code}_${now}`,
      name: `(Bản sao) ${baseModel.name}`,
      version: 1,
      status: 'DRAFT',
    };
    setEditorModel(clonedModel);
    setSourceTemplate(undefined);
    setEditorMode('new');
    setSaveError('');
    setEditorDirty(true);
  };

  const openTemplate = (template: PcnWorkflowTemplate | PgdWorkflowTemplate) => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    const isPcn = domain === 'PCN';
    const model = isPcn ? toPcnDossierTemplateEditorModel(template as PcnWorkflowTemplate, props.pcnRequirements) : toPgdDossierTemplateEditorModel(template as PgdWorkflowTemplate, props.pgdRequirements);
    setEditorModel(model);
    setSourceTemplate(clone(template));
    setEditorMode(template.status === 'DRAFT' ? 'draft' : template.status === 'PUBLISHED' ? 'revision' : 'view');
    setSaveError('');
    setEditorDirty(false);
  };

  const createNew = () => {
    if (!closeEditor()) return;
    setActivePreview(undefined);
    setEditorModel(blankModel(domain));
    setSourceTemplate(undefined);
    setEditorMode('new');
    setSaveError('');
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
      toast.success(editorMode === 'revision' ? 'Đã tạo bản nháp phiên bản mới.' : 'Đã lưu bộ hồ sơ mẫu.');
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

  if (!canPcn && !canPgd) return <section data-testid="pgdcn-dossier-template-denied" className="m-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 md:m-5"><div className="flex items-center gap-2"><ShieldAlert size={18} /> Tài khoản hiện tại không có quyền quản trị bộ hồ sơ mẫu.</div><p className="mt-2 text-xs font-normal">Cần vai trò Quản trị viên/Quản lý và phạm vi PCN hoặc PGD tương ứng.</p></section>;

  const activeCanMutate = domain === 'PCN' ? canPcn : canPgd;

  return (
    <div data-testid="pgdcn-dossier-template-management" className="min-w-0 space-y-5 bg-slate-50/50 p-3 md:p-6">
      {/* Top Banner / Hero Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/40 p-5 shadow-sm md:p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-10 h-32 w-32 rounded-full bg-emerald-100/40 blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 text-white shadow-md shadow-slate-900/10">
              <GitBranch size={22} className="text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  <Sparkles size={11} /> PGDCN • Quản trị vận hành
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Hồ sơ mẫu
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-500 md:text-sm leading-relaxed">
                Tập hợp các bộ hồ sơ mẫu, lưu trình và loại tài liệu cần có ở từng nút. Tệp thật chỉ được tải lên khi hồ sơ chạy.
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 active:scale-95 md:text-sm" 
            onClick={createNew}
          >
            <FilePlus2 size={17} /> Tạo bộ hồ sơ mới
          </button>
        </div>

        {/* Domain Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-4" role="tablist" aria-label="Chọn lĩnh vực hồ sơ mẫu">
          <button 
            type="button" 
            role="tab" 
            aria-selected={domain === 'PCN'} 
            disabled={!canPcn} 
            onClick={() => { if (domain !== 'PCN' && !closeEditor()) return; setActivePreview(undefined); setDomain('PCN'); }} 
            className={`min-h-11 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs md:text-sm font-bold transition ${
              domain === 'PCN' 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20' 
                : 'border border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span>PCN · Chứng nhận</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${domain === 'PCN' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {props.pcnTemplates.length}
            </span>
          </button>
          
          <button 
            type="button" 
            role="tab" 
            aria-selected={domain === 'PGD'} 
            disabled={!canPgd} 
            onClick={() => { if (domain !== 'PGD' && !closeEditor()) return; setActivePreview(undefined); setDomain('PGD'); }} 
            className={`min-h-11 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs md:text-sm font-bold transition ${
              domain === 'PGD' 
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-600/20' 
                : 'border border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span>PGD · Giám định</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${domain === 'PGD' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {props.pgdTemplates.length}
            </span>
          </button>
        </div>
      </header>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div 
          onClick={() => setStatus('ALL')}
          className={`cursor-pointer rounded-2xl border p-3.5 transition hover:shadow-md ${
            status === 'ALL' 
              ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-300/40' 
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tất cả</span>
            <Layers size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{counts.all}</span>
            <span className="text-[11px] text-slate-400 font-medium">bộ mẫu</span>
          </div>
        </div>

        <div 
          onClick={() => setStatus('PUBLISHED')}
          className={`cursor-pointer rounded-2xl border p-3.5 transition hover:shadow-md ${
            status === 'PUBLISHED' 
              ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-300/40' 
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đang áp dụng</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{counts.published}</span>
            <span className="text-[11px] text-emerald-600/70 font-medium">đang chạy</span>
          </div>
        </div>

        <div 
          onClick={() => setStatus('DRAFT')}
          className={`cursor-pointer rounded-2xl border p-3.5 transition hover:shadow-md ${
            status === 'DRAFT' 
              ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300/40' 
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Bản nháp</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-700">{counts.draft}</span>
            <span className="text-[11px] text-amber-600/70 font-medium">đang chỉnh</span>
          </div>
        </div>

        <div 
          onClick={() => setStatus('RETIRED')}
          className={`cursor-pointer rounded-2xl border p-3.5 transition hover:shadow-md ${
            status === 'RETIRED' 
              ? 'border-slate-400 bg-slate-100 ring-2 ring-slate-300/40' 
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Đã ngừng</span>
            <Archive size={16} className="text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-700">{counts.retired}</span>
            <span className="text-[11px] text-slate-400 font-medium">lưu trữ</span>
          </div>
        </div>
      </div>

      {/* Main Content: Filter & Cards */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-5">
        <div className="pgdcn-toolbar-nowrap flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs" data-testid="pgdcn-dossier-template-filters">
          <div className="pgdcn-toolbar-search relative min-w-[220px] sm:min-w-[260px] max-w-sm flex-1 shrink-0">
            <label htmlFor="pgdcn-template-search" className="sr-only">Tìm kiếm bộ hồ sơ mẫu</label>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              id="pgdcn-template-search"
              aria-label="Tìm kiếm bộ hồ sơ mẫu" 
              placeholder="Nhập mã, tên hoặc từ khóa tìm kiếm..." 
              value={query} 
              onChange={(event) => setQuery(event.target.value)} 
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100" 
            />
          </div>
          <div className="pgdcn-toolbar-filter shrink-0">
            <select 
              aria-label="Lọc trạng thái bộ hồ sơ mẫu" 
              value={status} 
              onChange={(event) => setStatus(event.target.value as TemplateStatus)} 
              className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 shadow-3xs cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đang áp dụng</option>
              <option value="RETIRED">Đã ngừng</option>
            </select>
          </div>
        </div>

        {/* Template Cards Grid */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {visibleTemplates.map((template) => {
            const theme = getCardTheme(template);
            const badge = statusBadge(template.status);
            const reqCount = new Set(template.nodes.flatMap((node) => 'requirementIds' in node ? node.requirementIds : node.requirementCodes)).size;
            
            return (
              <article 
                key={template.id} 
                data-testid={`pgdcn-dossier-template-card-${template.id}`} 
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 ${theme.borderHover} hover:shadow-lg`}
              >
                {/* Top Vibrant Color Strip */}
                <div className={`absolute left-0 top-0 h-1.5 w-full ${theme.accentTop}`} />

                <div>
                  {/* Header Row: Status badge & Code info */}
                  <div className="flex items-center justify-between gap-2">
                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.wrap}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      <span>{statusLabel(template.status)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                        {template.code}
                      </span>
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/60">
                        phiên bản {template.version}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h2 className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {template.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2 min-h-[2rem]">
                    {template.description || 'Chưa có thông tin mô tả chi tiết cho bộ hồ sơ mẫu này.'}
                  </p>

                  {/* Scope Tags */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Phạm vi áp dụng
                    </p>
                    <div 
                      data-testid={`pgdcn-dossier-template-scope-${template.id}`} 
                      className="mt-1.5 flex flex-wrap gap-1.5"
                    >
                      {applicationScopeLabels(template).map((label) => (
                        <span 
                          key={label} 
                          className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold transition ${theme.tagBg}`}
                        >
                          {label}
                        </span>
                      ))}
                      {applicationScopeLabels(template).length === 0 && (
                        <span className="text-xs text-slate-400 italic">Chưa chọn phạm vi</span>
                      )}
                    </div>
                  </div>

                  {/* Workflow Metrics Badges */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs font-semibold text-slate-600 border border-slate-100">
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60">
                      <Layers size={13} /> {template.nodes.length} nút
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-200/60">
                      <ArrowRight size={13} /> {template.transitions.length} chuyển tiếp
                    </span>
                    <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50/80 px-2 py-0.5 rounded-md border border-purple-200/60">
                      <FileText size={13} /> {reqCount} loại tài liệu
                    </span>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition" 
                    onClick={() => previewTemplate(template)}
                  >Xem trước</button>

                  <button 
                    type="button" 
                    className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-100 active:scale-95 transition" 
                    onClick={() => openTemplate(template)}
                  >
                    <Edit3 size={14} /> {template.status === 'PUBLISHED' ? 'Tạo phiên bản mới' : template.status === 'DRAFT' ? 'Mở chỉnh sửa' : 'Xem chi tiết'}
                  </button>

                  <button 
                    type="button" 
                    className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 text-xs font-bold text-purple-700 shadow-2xs hover:bg-purple-100 active:scale-95 transition" 
                    onClick={() => cloneTemplate(template)}
                  >
                    <Copy size={14} /> Nhân bản
                  </button>

                  {template.status === 'DRAFT' && (
                    <button 
                      type="button" 
                      className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition" 
                      onClick={() => void publish(template)}
                    >
                      <CheckCircle2 size={14} /> Công bố
                    </button>
                  )}

                  {template.status === 'PUBLISHED' && (
                    <button 
                      type="button" 
                      className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3 text-xs font-bold text-orange-700 hover:bg-orange-100 active:scale-95 transition" 
                      onClick={() => void retire(template)}
                    >
                      <Ban size={14} /> Ngừng áp dụng
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {visibleTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center lg:col-span-2">
              <Search size={32} className="text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có bộ hồ sơ mẫu phù hợp bộ lọc</p>
              <p className="mt-1 text-xs text-slate-400">Hãy thử xóa từ khóa tìm kiếm hoặc chọn tất cả trạng thái.</p>
            </div>
          )}
        </div>
      </section>

      {/* Preview Surface */}
      {activePreview && (
        <section data-testid="pgdcn-dossier-template-preview-surface" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-6">
          <PgdcnDossierTemplatePreview 
            model={activePreview} 
            requirements={domain === 'PCN' ? pcnOptions : pgdOptions} 
            onClose={() => setActivePreview(undefined)} 
          />
        </section>
      )}

      {/* Editor Surface */}
      {editorModel && (
        <section data-testid="pgdcn-dossier-template-editor-surface" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-blue-600">
                  {editorMode === 'revision' ? 'Bản nháp phiên bản mới' : editorMode === 'new' ? 'Bộ hồ sơ mới' : editorMode === 'view' ? 'Xem bộ hồ sơ' : 'Chỉnh sửa bản nháp'}
                </p>
                {editorDirty && editorMode !== 'view' && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Có thay đổi chưa lưu
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {editorMode === 'revision' 
                  ? 'Bản đã công bố giữ nguyên; thay đổi sẽ tạo phiên bản mới.' 
                  : editorMode === 'view' 
                  ? 'Bộ hồ sơ đã ngừng áp dụng và không thể chỉnh sửa.' 
                  : 'Cấu hình nút và loại tài liệu bằng giao diện trực quan.'}
              </p>
            </div>
            <button 
              type="button" 
              className="min-h-11 rounded-xl px-4 text-xs md:text-sm font-bold text-slate-500 hover:bg-slate-100 transition" 
              onClick={closeEditor}
            >
              Đóng
            </button>
          </div>
          <PgdcnDossierTemplateEditor 
            model={editorModel} 
            requirements={domain === 'PCN' ? pcnOptions : pgdOptions} 
            onChange={(model) => { setEditorModel(model); setEditorDirty(true); }} 
            onSaveDraft={save} 
            canMutate={activeCanMutate && editorMode !== 'view'} 
            saving={saving} 
            saveError={saveError} 
          />
        </section>
      )}
    </div>
  );
}
