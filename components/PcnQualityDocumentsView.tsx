'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CalendarDays, Edit3, FileCheck2, FileText, LockKeyhole, Plus, ShieldCheck, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnCertificationField, PcnQualityDocument, PcnQualityDocumentCategory, PcnQualityDocumentStatus, PcnUserAccount, UserAccount } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnQualityDocumentCategoryLabel, getPcnQualityDocumentWarning } from '../utils/pcnQualityDocuments';
import type { PcnQualityDocumentInput } from '../utils/pcnQualityDocuments';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';

const CATEGORY_LABELS: Record<PcnQualityDocumentCategory, string> = {
  VICAS: 'VICAS / đánh giá công nhận',
  VIAS: 'VIAS / công nhận',
  ISO: 'ISO / hệ thống chất lượng',
  DESIGNATION: 'Hồ sơ xin chỉ định',
  PROCEDURE: 'Quy trình / hướng dẫn',
};

const STATUS_LABELS: Record<PcnQualityDocumentStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang áp dụng',
  EXPIRED: 'Đã hết hạn',
  RETIRED: 'Ngừng sử dụng',
};

const STATUS_CLASSES: Record<PcnQualityDocumentStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  EXPIRED: 'border-amber-200 bg-amber-50 text-amber-700',
  RETIRED: 'border-slate-200 bg-slate-100 text-slate-500',
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-emerald-400';
type QualityDocumentForm = Omit<PcnQualityDocumentInput, 'id'>;

function isAdmin(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.role === 'admin';
}

function formatDate(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
}

function warningLabel(warning: ReturnType<typeof getPcnQualityDocumentWarning>): string | null {
  if (warning === 'EXPIRED_ADVISORY') return 'Cảnh báo: đã quá hạn rà soát';
  if (warning === 'EXPIRING_SOON_ADVISORY') return 'Cảnh báo: sắp đến hạn rà soát';
  if (warning === 'RETIRED_ADVISORY') return 'Tài liệu đã ngừng sử dụng';
  return null;
}

function blankForm(): QualityDocumentForm {
  return {
    documentCode: '', title: '', category: 'PROCEDURE', fieldCodes: [], version: '01', status: 'DRAFT',
    issuedAt: '', effectiveFrom: '', validUntil: '', ownerUsername: '', fileName: '', note: '',
  };
}

export function PcnQualityDocumentsView({
  documents,
  fields,
  users,
  currentUser,
  onCreate,
  onUpdate,
  onRetire,
}: {
  documents: PcnQualityDocument[];
  fields: PcnCertificationField[];
  users: PcnUserAccount[];
  currentUser: UserAccount | null;
  onCreate: (input: PcnQualityDocumentInput, file?: File) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<PcnQualityDocument, 'id'>>, file?: File) => Promise<void>;
  onRetire: (id: string) => Promise<void>;
}) {
  const editable = isAdmin(currentUser);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PcnQualityDocumentCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PcnQualityDocumentStatus>('ALL');
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'QC4' | 'QC9'>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<PcnQualityDocument | null>(null);
  const [form, setForm] = useState<QualityDocumentForm>(blankForm());
  const [file, setFile] = useState<File>();
  const [saving, setSaving] = useState(false);
  const [busyRetireId, setBusyRetireId] = useState<string>();

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return documents.filter((document) => {
      const haystack = `${document.documentCode} ${document.title} ${document.version} ${document.ownerUsername || ''} ${document.fileName || ''}`.toLocaleLowerCase('vi-VN');
      return (!normalized || haystack.includes(normalized))
        && (categoryFilter === 'ALL' || document.category === categoryFilter)
        && (statusFilter === 'ALL' || document.status === statusFilter)
        && (fieldFilter === 'ALL' || (document.fieldCodes || []).includes(fieldFilter));
    });
  }, [categoryFilter, documents, fieldFilter, query, statusFilter]);

  const closeForm = () => { if (!saving) { setIsFormOpen(false); setEditing(null); setFile(undefined); } };
  const openCreate = () => { setEditing(null); setForm(blankForm()); setFile(undefined); setIsFormOpen(true); };
  const openEdit = (document: PcnQualityDocument) => {
    setEditing(document);
    setForm({ documentCode: document.documentCode, title: document.title, category: document.category, fieldCodes: document.fieldCodes || [], version: document.version, status: document.status, issuedAt: document.issuedAt || '', effectiveFrom: document.effectiveFrom || '', validUntil: document.validUntil || '', ownerUsername: document.ownerUsername || '', fileName: document.fileName || '', note: document.note || '' });
    setFile(undefined);
    setIsFormOpen(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    if (saving) return;
    setSaving(true);
    try {
      if (editing) await onUpdate(editing.id, { ...form, fieldCodes: form.fieldCodes as Array<'QC4' | 'QC9'> }, file);
      else await onCreate({ ...form, id: `pcn-quality-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, file);
      toast.success(editing ? 'Đã cập nhật tài liệu chất lượng.' : 'Đã tạo tài liệu chất lượng.');
      closeForm();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu tài liệu chất lượng.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (document: PcnQualityDocument) => {
    if (!editable || document.status === 'RETIRED') return;
    if (busyRetireId === document.id) return;
    if (typeof window !== 'undefined' && !window.confirm(`Ngừng sử dụng tài liệu “${document.documentCode}”?`)) return;
    setBusyRetireId(document.id);
    try { await onRetire(document.id); toast.success(`Đã ngừng sử dụng ${document.documentCode}.`); }
    catch (error: any) { toast.error(error?.message || 'Không thể ngừng sử dụng tài liệu.'); }
    finally { setBusyRetireId(undefined); }
  };

  const toggleField = (fieldCode: string) => {
    if (!['QC4', 'QC9'].includes(fieldCode)) return;
    const code = fieldCode as 'QC4' | 'QC9';
    const selected = (form.fieldCodes || []).includes(code);
    setForm({ ...form, fieldCodes: selected ? (form.fieldCodes || []).filter((item) => item !== code) : [...(form.fieldCodes || []), code] });
  };

  return <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị chất lượng PCN</p><h1 className="mt-1 text-xl font-black text-slate-900">Sổ tài liệu chất lượng & chỉ định</h1><p className="mt-1 max-w-3xl text-[11px] text-slate-500">Theo dõi VICAS, VIAS, ISO, hồ sơ xin chỉ định và quy trình riêng với hồ sơ chứng nhận. Cảnh báo thời hạn chỉ để rà soát, không tự kết luận hiệu lực pháp lý.</p></div>{editable && <button type="button" onClick={openCreate} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-700"><Plus size={14} /> Thêm tài liệu</button>}</div>
    {!editable && <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Bạn có thể xem và mở file private; chỉ Admin PCN được tạo, sửa hoặc ngừng sử dụng tài liệu.</div>}
    <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_150px_130px]"><input value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" placeholder="Tìm mã, tên, phiên bản, người phụ trách..." /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">Tất cả nhóm tài liệu</option>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value as typeof fieldFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">QC4 + QC9</option>{fields.filter((field) => ['QC4', 'QC9'].includes(field.code)).map((field) => <option key={field.code} value={field.code}>{field.name}</option>)}</select></div>
    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span className="rounded-md border border-slate-200 bg-white px-2 py-1">{visibleDocuments.length}/{documents.length} tài liệu</span><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{documents.filter((document) => document.status === 'ACTIVE').length} đang áp dụng</span><span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">{documents.filter((document) => getPcnQualityDocumentWarning(document)).length} cần rà soát</span><span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1"><LockKeyhole size={11} /> file private</span></div>
    <div className="space-y-2">{visibleDocuments.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-[11px] text-slate-400">Chưa có tài liệu phù hợp bộ lọc.</div> : visibleDocuments.map((document) => { const warning = getPcnQualityDocumentWarning(document); return <article key={document.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FileText size={15} className="text-indigo-600" /><h2 className="text-xs font-black text-slate-800">{document.documentCode} · {document.title}</h2><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${STATUS_CLASSES[document.status]}`}>{STATUS_LABELS[document.status]}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{document.version}</span></div><p className="mt-1 text-[10px] text-slate-500">{getPcnQualityDocumentCategoryLabel(document.category)}{document.ownerUsername ? ` • Phụ trách: ${getPcnUserDisplayName(document.ownerUsername, users)}` : ''}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-500">{(document.fieldCodes || []).map((code) => <span key={code} className="rounded bg-emerald-50 px-1.5 py-1 font-bold text-emerald-700">{code}</span>)}<span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-1"><CalendarDays size={10} /> Hiệu lực: {formatDate(document.effectiveFrom)}</span><span className="rounded bg-slate-50 px-1.5 py-1">Hết hạn: {formatDate(document.validUntil)}</span></div>{warning && <p className="mt-2 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700"><AlertTriangle size={11} /> {warningLabel(warning)}</p>}{document.note && <p className="mt-2 text-[10px] text-slate-500">{document.note}</p>}{document.fileAssetId && <p className="mt-2 inline-flex max-w-full items-center gap-1 text-[10px] text-indigo-700"><FileCheck2 size={12} /><a href={getPcnFileUrl(document.fileAssetId)} target="_blank" rel="noreferrer" className="truncate font-bold underline underline-offset-2">{document.fileName || 'Mở file tài liệu private'}</a></p>}</div>{editable && <div className="flex shrink-0 flex-wrap justify-end gap-1.5"><button type="button" onClick={() => openEdit(document)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700"><Edit3 size={12} /> Sửa</button>{document.status !== 'RETIRED' && <button type="button" disabled={busyRetireId === document.id} aria-busy={busyRetireId === document.id} onClick={() => void retire(document)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-600 disabled:cursor-wait disabled:opacity-50"><Archive size={12} /> {busyRetireId === document.id ? 'Đang ngừng...' : 'Ngừng dùng'}</button>}</div>}</div></article>; })}</div>
    {editable && isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label={editing ? 'Sửa tài liệu chất lượng' : 'Thêm tài liệu chất lượng'}><div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Registry độc lập</p><h2 className="mt-1 text-base font-black text-slate-900">{editing ? 'Sửa tài liệu chất lượng' : 'Thêm tài liệu chất lượng'}</h2></div><button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button></div><form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3"><div className="grid gap-2 md:grid-cols-2"><label className="text-[10px] font-bold text-slate-600">Mã tài liệu *<input required value={form.documentCode} onChange={(event) => setForm({ ...form, documentCode: event.target.value })} className={inputClass} placeholder="Ví dụ: QL-ISO-001" /></label><label className="text-[10px] font-bold text-slate-600">Tên tài liệu *<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} placeholder="Tên giấy phép / quy trình" /></label><label className="text-[10px] font-bold text-slate-600">Nhóm<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PcnQualityDocumentCategory })} className={inputClass}>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-[10px] font-bold text-slate-600">Phiên bản *<input required value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} className={inputClass} /></label><label className="text-[10px] font-bold text-slate-600">Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PcnQualityDocumentStatus })} className={inputClass}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-[10px] font-bold text-slate-600">Người phụ trách<select value={form.ownerUsername || ''} onChange={(event) => setForm({ ...form, ownerUsername: event.target.value })} className={inputClass}><option value="">Chưa phân công</option>{users.filter((user) => user.active !== false).map((user) => <option key={user.username} value={user.username}>{user.name}</option>)}</select></label></div><div><span className="text-[10px] font-bold text-slate-600">Lĩnh vực liên quan</span><div className="mt-1 flex flex-wrap gap-1.5">{fields.filter((field) => ['QC4', 'QC9'].includes(field.code)).map((field) => { const selected = (form.fieldCodes || []).includes(field.code as 'QC4' | 'QC9'); return <button type="button" key={field.code} onClick={() => toggleField(field.code)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>{field.name}</button>; })}</div></div><div className="grid gap-2 md:grid-cols-3"><label className="text-[10px] font-bold text-slate-600">Ngày ban hành<input type="date" value={form.issuedAt || ''} onChange={(event) => setForm({ ...form, issuedAt: event.target.value })} className={inputClass} /></label><label className="text-[10px] font-bold text-slate-600">Ngày hiệu lực<input type="date" value={form.effectiveFrom || ''} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} className={inputClass} /></label><label className="text-[10px] font-bold text-slate-600">Ngày hết hạn<input type="date" value={form.validUntil || ''} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} className={inputClass} /></label></div><label className="text-[10px] font-bold text-slate-600">File tài liệu private<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0])} className="mt-1 block w-full rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-2 text-[10px]" />{editing?.fileName && !file && <span className="mt-1 block text-[9px] text-slate-500">Đang gắn: {editing.fileName}</span>}</label><label className="text-[10px] font-bold text-slate-600">Ghi chú<textarea rows={2} value={form.note || ''} onChange={(event) => setForm({ ...form, note: event.target.value })} className={inputClass} /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={closeForm} className="rounded-md border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"><Upload size={13} />{saving ? 'Đang lưu...' : 'Lưu tài liệu'}</button></div></form></div></div>}
  </div>;
}

export default PcnQualityDocumentsView;
