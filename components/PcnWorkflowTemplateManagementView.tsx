'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, GitBranch, Loader2, Pencil, Plus, RotateCcw, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnCertificationMethod, PcnWorkflowTemplate, UserAccount } from '../types';
import { isPcnSystemManager } from '../utils/pcnRbac';

const fieldOptions = ['QC4', 'QC9'];
const methodOptions: PcnCertificationMethod[] = ['METHOD_1', 'METHOD_5', 'METHOD_7'];

function statusLabel(status: PcnWorkflowTemplate['status']): string {
  return status === 'PUBLISHED' ? 'Đang áp dụng' : status === 'RETIRED' ? 'Đã ngừng' : 'Bản nháp';
}

function statusClass(status: PcnWorkflowTemplate['status']): string {
  return status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'RETIRED' ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-amber-200 bg-amber-50 text-amber-700';
}

function methodLabel(method: PcnCertificationMethod): string {
  return method.replace('METHOD_', 'Phương thức ');
}

function cloneForRevision(template: PcnWorkflowTemplate): PcnWorkflowTemplate {
  return JSON.parse(JSON.stringify({ ...template, status: 'DRAFT', publishedAt: undefined, publishedBy: undefined })) as PcnWorkflowTemplate;
}

export interface PcnWorkflowTemplateManagementViewProps {
  currentUser: UserAccount | null;
  workflowTemplates: PcnWorkflowTemplate[];
  onCreateWorkflowRevision: (templateId: string, template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  onPublishWorkflowTemplate: (templateId: string) => Promise<PcnWorkflowTemplate>;
  onRetireWorkflowTemplate: (templateId: string, reason: string) => Promise<PcnWorkflowTemplate>;
}

export function PcnWorkflowTemplateManagementView({ currentUser, workflowTemplates, onCreateWorkflowRevision, onPublishWorkflowTemplate, onRetireWorkflowTemplate }: PcnWorkflowTemplateManagementViewProps) {
  const canManageWorkflow = isPcnSystemManager(currentUser);
  const [editingTemplate, setEditingTemplate] = useState<PcnWorkflowTemplate | null>(null);
  const [topologyJson, setTopologyJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const publishedCount = useMemo(() => workflowTemplates.filter((template) => template.status === 'PUBLISHED').length, [workflowTemplates]);

  if (!canManageWorkflow) return <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[11px] font-bold text-rose-700">Chỉ Quản trị viên hoặc Quản lý PCN được thay đổi danh sách lưu trình hồ sơ.</section>;

  const startRevision = (template: PcnWorkflowTemplate) => {
    setEditingTemplate(cloneForRevision(template));
    setTopologyJson(JSON.stringify({ nodes: template.nodes, transitions: template.transitions }, null, 2));
  };

  const toggleField = (fieldCode: string) => setEditingTemplate((current) => current ? { ...current, appliesTo: { ...current.appliesTo, fieldCodes: current.appliesTo.fieldCodes.includes(fieldCode) ? current.appliesTo.fieldCodes.filter((code) => code !== fieldCode) : [...current.appliesTo.fieldCodes, fieldCode] } } : current);
  const toggleMethod = (method: PcnCertificationMethod) => setEditingTemplate((current) => current ? { ...current, appliesTo: { ...current.appliesTo, methods: current.appliesTo.methods?.includes(method) ? current.appliesTo.methods.filter((item) => item !== method) : [...(current.appliesTo.methods || []), method] } } : current);

  const saveRevision = async () => {
    if (!editingTemplate || saving) return;
    setSaving(true);
    try {
      const topology = JSON.parse(topologyJson) as { nodes?: unknown; transitions?: unknown };
      if (!Array.isArray(topology.nodes) || !Array.isArray(topology.transitions)) throw new Error('Cấu trúc lưu trình phải có danh sách nút và chuyển tiếp ở dạng JSON.');
      await onCreateWorkflowRevision(editingTemplate.id, { ...editingTemplate, nodes: topology.nodes as PcnWorkflowTemplate['nodes'], transitions: topology.transitions as PcnWorkflowTemplate['transitions'] });
      toast.success('Đã tạo bản nháp phiên bản lưu trình.');
      setEditingTemplate(null);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo phiên bản lưu trình.');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (template: PcnWorkflowTemplate) => {
    setBusyId(template.id);
    try { await onPublishWorkflowTemplate(template.id); toast.success(`Đã công bố ${template.name} phiên bản ${template.version}.`); } catch (error: any) { toast.error(error?.message || 'Không thể công bố lưu trình.'); } finally { setBusyId(null); }
  };

  const retire = async (template: PcnWorkflowTemplate) => {
    const reason = window.prompt(`Lý do ngừng lưu trình “${template.name}”:`)?.trim() || '';
    if (!reason) return;
    setBusyId(template.id);
    try { await onRetireWorkflowTemplate(template.id, reason); toast.success(`Đã ngừng ${template.name}.`); } catch (error: any) { toast.error(error?.message || 'Không thể ngừng lưu trình.'); } finally { setBusyId(null); }
  };

  return <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 shadow-sm" data-testid="pcn-workflow-template-management">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"><GitBranch size={16} /></span><div><h2 className="text-sm font-black text-slate-900">Danh sách lưu trình hồ sơ</h2><p className="mt-0.5 text-[10px] leading-4 text-slate-600">Quản lý theo phiên bản. Hồ sơ đã tiếp nhận giữ bản chụp riêng; công bố phiên bản mới không làm đổi các hồ sơ đang chạy.</p></div></div><div className="flex flex-wrap gap-1.5 text-[9px] font-black"><span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">{workflowTemplates.length} phiên bản</span><span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-emerald-700">{publishedCount} đang áp dụng</span></div></div>
    <div className="mt-3 space-y-2">{workflowTemplates.length === 0 ? <div className="rounded-lg border border-dashed border-indigo-200 bg-white p-4 text-center text-[10px] font-bold text-slate-500">Chưa có mẫu lưu trình. Hãy khởi tạo dữ liệu PCN hoặc tạo mẫu từ chức năng quản trị.</div> : workflowTemplates.map((template) => <details key={template.id} className="rounded-lg border border-white bg-white/90"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 text-[10px] font-black text-slate-800"><span className={`rounded-full border px-2 py-0.5 text-[8px] ${statusClass(template.status)}`}>{statusLabel(template.status)}</span><span className="font-mono text-indigo-700">{template.code} · v{template.version}</span><span className="min-w-0 flex-1 truncate">{template.name}</span><span className="text-[8px] font-bold text-slate-400">{template.nodes.length} nút · {template.transitions.length} chuyển tiếp</span></summary><div className="border-t border-slate-100 p-3"><p className="text-[10px] text-slate-600">{template.description || 'Chưa có mô tả.'}</p><div className="mt-2 flex flex-wrap gap-1 text-[8px] font-bold"><span className="rounded bg-slate-100 px-1.5 py-1 text-slate-600">Lĩnh vực: {template.appliesTo.fieldCodes.length ? template.appliesTo.fieldCodes.join(', ') : 'Tất cả'}</span><span className="rounded bg-slate-100 px-1.5 py-1 text-slate-600">Phương thức: {template.appliesTo.methods?.length ? template.appliesTo.methods.map(methodLabel).join(', ') : 'Tất cả'}</span>{template.publishedBy && <span className="rounded bg-emerald-50 px-1.5 py-1 text-emerald-700">Công bố bởi: {template.publishedBy}</span>}</div><div className="mt-2 flex flex-wrap gap-1.5">{template.status !== 'RETIRED' && <button type="button" onClick={() => startRevision(template)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black text-indigo-700"><Pencil size={11} /> Tạo phiên bản mới</button>}{template.status === 'DRAFT' && <button type="button" disabled={busyId === template.id} onClick={() => void publish(template)} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-black text-white disabled:opacity-50"><UploadCloud size={11} /> Công bố</button>}{template.status === 'PUBLISHED' && <button type="button" disabled={busyId === template.id} onClick={() => void retire(template)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-black text-orange-700 disabled:opacity-50"><RotateCcw size={11} /> Ngừng áp dụng</button>}{busyId === template.id && <Loader2 size={13} className="animate-spin self-center text-slate-400" />}</div></div></details>)}</div>
    {editingTemplate && <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-slate-900">Tạo phiên bản mới từ {editingTemplate.code} v{editingTemplate.version}</h3><p className="mt-0.5 text-[9px] text-slate-500">Hệ thống sẽ cấp mã và phiên bản mới; cấu trúc vẫn được kiểm tra các nút, cạnh, điểm hợp nhất và điều kiện cho phép.</p></div><button type="button" onClick={() => setEditingTemplate(null)} className="text-[10px] font-bold text-slate-400">Hủy</button></div><div className="mt-3 grid gap-2 md:grid-cols-2"><label className="text-[9px] font-black text-slate-600">Tên lưu trình<input value={editingTemplate.name} onChange={(event) => setEditingTemplate({ ...editingTemplate, name: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[10px]" /></label><label className="text-[9px] font-black text-slate-600">Mô tả<input value={editingTemplate.description || ''} onChange={(event) => setEditingTemplate({ ...editingTemplate, description: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[10px]" /></label></div><div className="mt-2 flex flex-wrap gap-3 text-[9px] font-bold text-slate-700"><span className="font-black text-slate-500">Áp dụng cho:</span>{fieldOptions.map((fieldCode) => <label key={fieldCode} className="inline-flex items-center gap-1"><input type="checkbox" checked={editingTemplate.appliesTo.fieldCodes.includes(fieldCode)} onChange={() => toggleField(fieldCode)} />{fieldCode}</label>)}{methodOptions.map((method) => <label key={method} className="inline-flex items-center gap-1"><input type="checkbox" checked={editingTemplate.appliesTo.methods?.includes(method) || false} onChange={() => toggleMethod(method)} />{methodLabel(method)}</label>)}</div><label className="mt-2 block text-[9px] font-black text-slate-600">Nút và chuyển tiếp (JSON)<textarea value={topologyJson} onChange={(event) => setTopologyJson(event.target.value)} rows={12} className="mt-1 w-full rounded-md border border-slate-200 bg-slate-950 p-2 font-mono text-[9px] leading-4 text-emerald-200 outline-none focus:border-indigo-400" spellCheck={false} /></label><div className="mt-2 flex justify-end"><button type="button" disabled={saving} onClick={() => void saveRevision()} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[9px] font-black text-white disabled:opacity-50">{saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Lưu phiên bản</button></div></div>}
  </section>;
}

export default PcnWorkflowTemplateManagementView;
