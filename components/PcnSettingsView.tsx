'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleSlash2, Database, FileCheck2, FileDown, FlaskConical, Loader2, MessageSquareWarning, Save, ScanText, Settings2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnCertificationFieldCode, PcnSampleLabCode, PcnSettings, PcnTemplateDefinition, PcnTemplateReviewAction, UserAccount } from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { DEFAULT_PCN_SETTINGS } from '../utils/pcnSettings';
import { fetchPcnSettings, updatePcnSettings } from '../utils/pcnSettingsApi';
import { getPcnDossierTemplateProfiles } from '../utils/pcnDossierTemplateCatalog';
import { getPcnOperationalTemplateStatusLabel, getPcnOperationalTemplatesForFields } from '../utils/pcnOperationalTemplateCatalog';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { PcnTemplateSettingsModal } from './PcnTemplateSettingsModal';

const FIELD_OPTIONS: Array<{ code: PcnCertificationFieldCode; label: string }> = [
  { code: 'QC4', label: 'Quy chuẩn 4' },
  { code: 'QC9', label: 'Quy chuẩn 9' },
];

function Panel({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-start gap-2"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon size={16} /></div><div><h2 className="text-sm font-black text-slate-800">{title}</h2><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p></div></div><div className="mt-3">{children}</div></section>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-emerald-600" />{label}</label>;
}

function operationalKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    ASSIGNMENT_FORM: 'Phiếu phân công',
    EVALUATION_PLAN: 'Kế hoạch đánh giá',
    FIELD_INSPECTION: 'Kiểm tra hiện trường',
    SAMPLE_TAKING: 'Lấy mẫu',
    SAMPLE_CODING: 'Mã hóa mẫu',
    SAMPLE_HANDOVER: 'Giao nhận mẫu',
    LAB_REQUEST: 'PYC gửi PTN',
    TEST_REPORT: 'KQTN do PTN cấp (tham chiếu)',
    EVALUATION_REPORT: 'Báo cáo đánh giá',
    CERTIFICATION_RESULT: 'Kết quả chứng nhận / phụ lục',
    CERTIFICATE: 'Giấy chứng nhận',
    DECISION: 'Quyết định',
    CLIENT_PACKAGE: 'Hồ sơ gửi khách hàng',
    COMMERCIAL: 'Hợp đồng dịch vụ',
    DOSSIER_COVER: 'Bìa hồ sơ',
    PROPOSAL_FORM: 'Đề nghị chứng nhận',
  };
  return labels[kind] || kind;
}

function templateStatusLabel(status: PcnTemplateDefinition['status']): string {
  return ({
    DISCOVERED: 'Mới phát hiện',
    NEEDS_ANNOTATION: 'Cần soát xét',
    APPROVED: 'Đã duyệt',
    RETIRED: 'Ngừng dùng',
  } as const)[status];
}

export function PcnTemplateAdminPanel({ templates, onUploadTemplate, onReviewTemplate }: {
  templates: PcnTemplateDefinition[];
  onUploadTemplate: (templateId: string, file: File) => Promise<unknown>;
  onReviewTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<PcnTemplateDefinition | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const review = async (template: PcnTemplateDefinition, action: PcnTemplateReviewAction) => {
    if (!template.fileAssetId) return;
    let reason: string | undefined;
    if (action === 'REQUEST_ANNOTATION') {
      reason = window.prompt('Nêu lý do/yêu cầu chỉnh sửa mẫu:') || '';
      if (!reason.trim()) return;
    }
    if (action === 'RETIRE' && !window.confirm(`Ngừng sử dụng mẫu “${template.displayName}”?`)) return;
    setReviewingId(template.id);
    try {
      await onReviewTemplate(template.id, action, reason);
      toast.success(action === 'APPROVE' ? `Đã phê duyệt ${template.displayName}.` : action === 'RETIRE' ? `Đã ngừng dùng ${template.displayName}.` : `Đã gửi yêu cầu chỉnh sửa ${template.displayName}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể soát xét mẫu PCN.');
    } finally {
      setReviewingId(null);
    }
  };
  return <><Panel icon={FileCheck2} title="Mẫu DOCX chính thức" description="Tải lên bản GCN/QĐ đã được phòng xác nhận, sau đó soát xét từng tệp. Tệp mới luôn phải được duyệt lại trước khi phát hành."><div className="space-y-2">{templates.length === 0 ? <p className="text-[10px] text-slate-500">Chưa có mẫu PCN trong cơ sở dữ liệu.</p> : templates.map((template) => { const busy = reviewingId === template.id; const statusClass = template.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : template.status === 'RETIRED' ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-amber-200 bg-amber-50 text-amber-700'; return <article key={template.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{template.fieldCode}</span><span className="text-[11px] font-black text-slate-800">{template.displayName}</span><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${statusClass}`}>{templateStatusLabel(template.status)}</span></div><p className="mt-1 text-[9px] text-slate-500">Tệp hiện tại: <b>{template.fileAssetId ? 'Đã tải lên' : 'Chưa có tệp'}</b></p>{template.importedAt && <p className="mt-1 text-[9px] text-slate-500">Cập nhật: {formatDateTimeDdMmYyyy(template.importedAt) || 'Chưa cập nhật'}</p>}{template.approvedByUsername && <p className="mt-1 text-[9px] text-emerald-700">Duyệt bởi: {template.approvedByUsername}{template.approvedAt ? ` · ${formatDateTimeDdMmYyyy(template.approvedAt) || 'Chưa cập nhật'}` : ''}</p>}</div><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setSelectedTemplate(template)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-[9px] font-black text-emerald-700"><Upload size={12} /> Tải bản mới</button>{template.fileAssetId && <a href={getPcnFileUrl(template.fileAssetId, { download: true })} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-[9px] font-black text-indigo-700"><FileDown size={12} /> Tải xuống</a>}</div></div>{template.fileAssetId && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2"><button type="button" disabled={busy || template.status === 'APPROVED'} onClick={() => void review(template, 'APPROVE')} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[9px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"><CheckCircle2 size={12} /> Phê duyệt</button><button type="button" disabled={busy || template.status === 'RETIRED'} onClick={() => void review(template, 'REQUEST_ANNOTATION')} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[9px] font-black text-amber-700 hover:bg-amber-50 disabled:opacity-50"><MessageSquareWarning size={12} /> Yêu cầu chỉnh sửa</button><button type="button" disabled={busy || template.status === 'RETIRED'} onClick={() => void review(template, 'RETIRE')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50"><CircleSlash2 size={12} /> Ngừng dùng</button>{busy && <Loader2 size={14} className="animate-spin self-center text-slate-400" />}</div>}</article>; })}</div><p className="mt-2 text-[9px] font-bold text-slate-400">Tệp được lưu trong vùng lưu trữ riêng của PCN. Tải bản mới sẽ thay thế tệp hiện tại và buộc soát xét lại; không hiển thị đường dẫn thư mục nghiên cứu.</p></Panel>{selectedTemplate && <PcnTemplateSettingsModal template={selectedTemplate} onUploadTemplate={onUploadTemplate} onClose={() => setSelectedTemplate(null)} />}</>;
}

export default function PcnSettingsView({ currentUser, templates, onUploadTemplate, onReviewTemplate }: { currentUser: UserAccount | null; templates: PcnTemplateDefinition[]; onUploadTemplate: (templateId: string, file: File) => Promise<unknown>; onReviewTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown> }) {
  const [settings, setSettings] = useState<PcnSettings>(DEFAULT_PCN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = currentUser?.systemRole === 'admin' || currentUser?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void fetchPcnSettings().then((next) => { if (active) setSettings(next); }).catch((error: any) => toast.error(error?.message || 'Không thể tải cấu hình PCN.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  const fieldCodes = useMemo(() => new Set(settings.fieldCodes), [settings.fieldCodes]);
  const templateProfiles = useMemo(() => getPcnDossierTemplateProfiles(), []);
  const operationalTemplates = useMemo(() => getPcnOperationalTemplatesForFields(settings.fieldCodes), [settings.fieldCodes]);
  const templateAdminPanel = <PcnTemplateAdminPanel templates={templates} onUploadTemplate={onUploadTemplate} onReviewTemplate={onReviewTemplate} />;
  const operationalTemplatePanel = <Panel icon={FileCheck2} title="Bộ mẫu DOCX vận hành PCN" description="Mẫu trống theo từng trạm, đã được chuẩn hóa và đóng gói trong mã nguồn PCN. Nhóm vận hành dùng chúng trong thẻ hồ sơ để tạo DOCX/PDF nháp; mẫu KQTN của PTN chỉ tham chiếu, không sinh từ PCN."><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{operationalTemplates.map((template) => <article key={template.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${template.usage === 'REFERENCE_ONLY' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{operationalKindLabel(template.generationKind)}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600">{template.fieldCodes.join(' / ')}</span></div><p className="mt-1 break-words text-[10px] font-black text-slate-800">{template.displayName}</p><p className="mt-1 break-words text-[9px] text-slate-500">Tệp đóng gói: {template.fileName}</p></div><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black ${template.status === 'OFFICIAL_CANDIDATE' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{template.usage === 'REFERENCE_ONLY' ? 'Chỉ tham chiếu' : getPcnOperationalTemplateStatusLabel(template.status)}</span></div><p className="mt-2 text-[9px] text-slate-500">Số trường bắt buộc trong mẫu: <b className="text-slate-700">{template.requiredPlaceholderKeys.length}</b></p></article>)}</div><p className="mt-2 text-[9px] font-bold text-slate-400">Bộ mẫu đã chuẩn hóa và lưu trong mã nguồn/vùng lưu trữ riêng của PCN; ứng dụng không đọc, theo dõi hoặc hiển thị đường dẫn thư mục nghiên cứu.</p></Panel>;
  const setFieldEnabled = (code: PcnCertificationFieldCode, enabled: boolean) => setSettings((current) => ({ ...current, fieldCodes: enabled ? Array.from(new Set([...current.fieldCodes, code])) : current.fieldCodes.filter((item) => item !== code) }));
  const toggleLab = (fieldCode: PcnCertificationFieldCode, labCode: PcnSampleLabCode, enabled: boolean) => setSettings((current) => ({ ...current, labRoutes: { ...current.labRoutes, [fieldCode]: enabled ? Array.from(new Set([...current.labRoutes[fieldCode], labCode])) : current.labRoutes[fieldCode].filter((item) => item !== labCode) } }));
  const save = async () => {
    setSaving(true);
    try { const next = await updatePcnSettings(settings); setSettings(next); toast.success('Đã lưu cấu hình PCN.'); } catch (error: any) { toast.error(error?.message || 'Không thể lưu cấu hình PCN.'); } finally { setSaving(false); }
  };

  if (!isAdmin) return <div className="pcn-page-surface min-w-0 p-5 text-sm font-bold text-rose-700">Chỉ Quản trị viên PCN được xem cấu hình PCN.</div>;
  if (loading) return <div className="pcn-page-surface min-w-0 flex items-center justify-center gap-2 text-xs font-bold text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải cấu hình PCN…</div>;

  return <div className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-4 bg-slate-50/60 p-3 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị • Phòng Chứng nhận</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Cấu hình PCN</h1><p className="mt-1 max-w-2xl text-[11px] leading-4 text-slate-500">Thiết lập phạm vi, tuyến phòng thử, checklist, mã hóa và OCR cho các bộ hồ sơ mới.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu cài đặt</button></div>

    {templateAdminPanel}
    {operationalTemplatePanel}
    <Panel icon={Settings2} title="Phạm vi chứng nhận" description="Các nhánh QC đang được phục vụ trong PCN. Giám định thép không gỉ được quản lý tại miền PGD."><div className="grid gap-2 md:grid-cols-2">{FIELD_OPTIONS.map((field) => <label key={field.code} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-[11px] font-black ${fieldCodes.has(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={fieldCodes.has(field.code)} onChange={(event) => setFieldEnabled(field.code, event.target.checked)} className="accent-emerald-600" /><span>{field.code} · {field.label}</span></label>)}</div></Panel>

    <Panel icon={FlaskConical} title="Tuyến phòng thử của từng nhánh" description="Mẫu được tách route theo phòng thử; không tạo lịch thử. Phân tích hóa học của thép không gỉ thuộc PGD."><div className="space-y-3">{FIELD_OPTIONS.map((field) => <div key={field.code} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3"><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">{field.code}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <Toggle key={lab.code} label={lab.name} checked={settings.labRoutes[field.code].includes(lab.code)} onChange={(enabled) => toggleLab(field.code, lab.code, enabled)} />)}</div></div>)}</div></Panel>

    <div className="grid gap-4 xl:grid-cols-2"><Panel icon={FileCheck2} title="Checklist & kiểm tra hoàn thiện" description="Bộ hồ sơ luôn được đánh giá tại trạm trước khi chuyển bước."><div className="space-y-2"><Toggle label="Bắt buộc đủ tệp checklist trước khi chuyển trạm" checked={settings.checklist.requireFilesBeforeAdvance} onChange={(value) => setSettings((current) => ({ ...current, checklist: { ...current.checklist, requireFilesBeforeAdvance: value } }))} /><Toggle label="Hiển thị mức độ hoàn thiện cho nhà quản lý" checked={settings.checklist.showCompletenessToManagers} onChange={(value) => setSettings((current) => ({ ...current, checklist: { ...current.checklist, showCompletenessToManagers: value } }))} /></div></Panel><Panel icon={ShieldCheck} title="Chính sách mã hóa" description="Tiền tố mặc định cho bộ hồ sơ mới; mã nghiệp vụ thực tế vẫn do PCN xác nhận."><div className="grid gap-2 sm:grid-cols-3">{([['proposalPrefix', 'Đề nghị'], ['dossierPrefix', 'Hồ sơ'], ['sampleLotPrefix', 'Lô mẫu']] as const).map(([key, label]) => <label key={key} className="text-[10px] font-black text-slate-600">{label}<input value={settings.coding[key]} onChange={(event) => setSettings((current) => ({ ...current, coding: { ...current.coding, [key]: event.target.value } }))} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] font-bold outline-none focus:border-emerald-400" /></label>)}</div></Panel></div>

    <Panel icon={FileCheck2} title="Khung checklist theo QC4/QC9" description="Khung hồ sơ trống theo từng nhánh QC để tạo checklist cho Đề nghị mới. Cấu hình được đóng gói trong PCN; tệp sinh ra luôn nằm trong card hồ sơ."><div className="grid gap-2 md:grid-cols-2">{templateProfiles.map((profile) => <article key={profile.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><div className="text-xs font-black text-slate-800">{profile.fieldCode} · Mẫu trống</div><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">Đầu ra chính thức: {profile.officialOutputs.join(' / ')}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">{profile.description}</p><div className="mt-2 text-[9px] font-bold text-slate-600">{profile.stationGroups.length} trạm · {profile.stageGroups.flatMap((group) => group.requirements).length} yêu cầu</div></article>)}</div><p className="mt-2 text-[9px] font-bold text-slate-400">Khung checklist không đọc thư mục bên ngoài, không đọc dữ liệu khách hàng, không chứa tệp DOCX và không tạo mutation ở màn hình Cài đặt.</p></Panel>

    <div className="grid gap-4 xl:grid-cols-2"><Panel icon={ScanText} title="OCR hồ sơ" description="OCR luôn chạy PaddleOCR trước; chỉ fallback Gemini khi PaddleOCR lỗi, rỗng hoặc dưới ngưỡng. Người dùng phải xem và xác nhận bản nháp trước khi điền vào hồ sơ."><div className="space-y-2"><Toggle label="Cho phép OCR trong hồ sơ" checked={settings.ocr.enabled} onChange={(value) => setSettings((current) => ({ ...current, ocr: { ...current.ocr, enabled: value } }))} /><div className="rounded-md border border-blue-100 bg-blue-50 px-2 py-2 text-[10px] font-bold text-blue-800">Nhà cung cấp chính: PaddleOCR nội bộ</div><label className="block text-[10px] font-black text-slate-600">Ngưỡng tin cậy<input type="number" min="0" max="1" step="0.05" value={settings.ocr.confidenceThreshold} onChange={(event) => setSettings((current) => ({ ...current, ocr: { ...current.ocr, confidenceThreshold: Number(event.target.value) } }))} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-[11px] font-bold" /></label></div></Panel><Panel icon={Database} title="Lưu trữ hồ sơ" description="Tệp hồ sơ được lưu riêng trong vùng lưu trữ PCN và luôn đi cùng thông tin mô tả trong cơ sở dữ liệu riêng."><div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-bold text-blue-800"><div className="flex items-center gap-2"><Check size={14} /> Vùng lưu trữ: {settings.storage.bucket}</div><div className="mt-1 text-[10px] font-normal">Chỉ lưu trữ riêng tư · tải theo từng checklist, KQTN hoặc bộ phát hành.</div></div></Panel></div>
    {settings.updatedAt && <p className="text-right text-[9px] text-slate-400">Cập nhật lần cuối: {formatDateTimeDdMmYyyy(settings.updatedAt) || 'Chưa cập nhật'} · {settings.updatedBy || 'Quản trị viên PCN'}</p>}
  </div>;
}
