'use client';

import { PgdcnDateInput } from './PgdcnDateInput';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import { ClipboardList, FileText, History, Save, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { usePgdStore } from '../store-pgd';
import type { PcnUserAccount } from '../types';
import {
  buildPgdDossierIndex,
  createPgdCaseEvent,
  createPgdFieldActivityLog,
  createPgdInspectionPlan,
  createPgdLabResultReview,
  type PgdDossierIndexEntry,
  type PgdFieldActivitySession,
} from '../utils/pgdArtifacts';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdOperationalStepAccess } from '../utils/pgdWorkflow';

type PgdSourceFormsPanelProps = {
  request: PgdInspectionRequest;
  currentUser: PcnUserAccount;
  editable: boolean;
};

const inputClass = 'mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

function SourceField({ label, children, required = false, wide = false }: { label: string; children: ReactNode; required?: boolean; wide?: boolean }) {
  const normalized = label.replace(/\s*\*\s*$/, '').trim();
  const isRequired = required || normalized !== label;
  return <label className={wide ? 'block sm:col-span-2 lg:col-span-2' : 'block'}><span className="mb-1 block text-[11px] font-black text-slate-500">{normalized}{isRequired && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
}

function currentTime(): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export function getLocalCalendarDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalIsoTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function currentDate(): string {
  return getLocalCalendarDate();
}

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
}

function Section({ title, icon, children, locked = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; locked?: boolean }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800">{icon}{title}</h3>{locked && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-800">Đã khóa hậu ký</span>}</div>{children}</section>;
}

export default function PgdSourceFormsPanel({ request, currentUser, editable }: PgdSourceFormsPanelProps) {
  const pgd = usePgdStore();
  const plan = pgd.inspectionPlans.find((item) => item.requestId === request.id);
  const events = useMemo(() => pgd.caseEvents.filter((item) => item.requestId === request.id).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)), [pgd.caseEvents, request.id]);
  const fieldLogs = useMemo(() => pgd.fieldActivityLogs.filter((item) => item.requestId === request.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [pgd.fieldActivityLogs, request.id]);
  const labResults = pgd.labResults.filter((item) => item.requestId === request.id);
  const review = pgd.labResultReviews.find((item) => item.requestId === request.id);
  const dossierIndex = pgd.dossierIndexes.find((item) => item.requestId === request.id);
  const dossierDocuments = pgd.dossierDocuments.filter((item) => item.requestId === request.id);
  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const planAccess = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'PREPARATION' });
  const fieldAccess = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'FIELD_SAMPLING' });
  const labAccess = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'LAB_RESULTS' });
  const reportAccess = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'REPORT_APPROVAL_RETURN' });
  const canEditPlan = editable && planAccess.editable;
  const canEditField = editable && fieldAccess.editable;
  const canEditReview = editable && labAccess.editable;
  const [planDate, setPlanDate] = useState(plan?.inspectionDate || request.inspectionScheduledAt?.slice(0, 10) || currentDate());
  const [planActivity, setPlanActivity] = useState('Kiểm tra hồ sơ, ngoại quan và lấy mẫu kiểm tra');
  const [eventActivity, setEventActivity] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [eventTime, setEventTime] = useState(currentTime());
  const [session, setSession] = useState<PgdFieldActivitySession>('MORNING');
  const [fieldDate, setFieldDate] = useState(currentDate());
  const [fieldActivity, setFieldActivity] = useState('Kiểm tra hồ sơ, ngoại quan, nhãn và kích thước lô hàng');
  const [fieldComments, setFieldComments] = useState('');
  const [reviewConformity, setReviewConformity] = useState<'CONFORMING' | 'NON_CONFORMING'>('CONFORMING');
  const [reviewConclusion, setReviewConclusion] = useState(review?.conclusion || 'Kết quả thử nghiệm phù hợp với tiêu chuẩn áp dụng.');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); } catch (error: any) { toast.error(error?.message || 'Không thể lưu biểu mẫu PGD.'); } finally { setBusy(false); }
  };

  const savePlan = () => run(async () => {
    const now = new Date().toISOString();
    const inspectors = assignment?.inspectorUsernames?.length ? assignment.inspectorUsernames : [currentUser.username];
    const next = createPgdInspectionPlan({
      id: plan?.id || newId('pgd-plan'), requestId: request.id, inspectionDate: planDate,
      team: inspectors.map((username, index) => ({ username, role: index === 0 ? 'LEAD' : 'INSPECTOR' })),
      productLines: [{ productName: request.productName, grade: request.productDetails?.grade || request.brand, dimensions: request.productDetails?.dimensions, standard: request.productDetails?.productStandard || request.standards.join(', '), origin: request.productDetails?.countryOfOrigin || request.productDetails?.origin, manufacturer: request.productDetails?.manufacturer, quantity: request.quantity, unit: request.unit }],
      schedule: [{ startTime: '08:30', endTime: '09:00', activity: 'Họp khai mạc và thống nhất nội dung làm việc' }, { startTime: '09:00', endTime: '11:00', activity: planActivity.trim() || 'Kiểm tra hồ sơ, ngoại quan và lấy mẫu' }, { startTime: '11:00', endTime: '11:30', activity: 'Hoàn thiện biên bản và kết thúc đánh giá' }],
      criteria: request.inspectionScope, assessmentMethod: request.assessmentMethod, inspectionType: 'Giám định theo lô', status: 'CONFIRMED', note: 'Chương trình có thể điều chỉnh trong quá trình hiện trường.',
    }, now);
    await pgd.saveInspectionPlan(next);
  }, 'Đã lưu kế hoạch giám định PGD.');

  const saveEvent = () => run(async () => {
    const time = eventTime.trim() || currentTime();
    const occurredAt = toLocalIsoTimestamp(currentDate(), time);
    await pgd.saveCaseEvent(createPgdCaseEvent({ id: newId('pgd-event'), requestId: request.id, occurredAt, activity: eventActivity.trim(), actorUsername: currentUser.username, note: eventNote.trim() || undefined }, new Date().toISOString()));
    setEventActivity('');
    setEventNote('');
  }, 'Đã ghi nhận diễn biến vụ giám định.');

  const saveFieldLog = () => run(async () => {
    await pgd.saveFieldActivityLog(createPgdFieldActivityLog({ id: newId('pgd-field-log'), requestId: request.id, session, date: fieldDate, auditeeName: request.customerSnapshot.name, auditeeCode: request.customerSnapshot.taxId, auditorUsername: currentUser.username, entries: [{ time: currentTime(), activity: fieldActivity.trim(), comments: fieldComments.trim() || undefined }] }, new Date().toISOString()));
    setFieldComments('');
  }, 'Đã lưu phiếu ghi chép hiện trường.');

  const saveReview = () => run(async () => {
    if (labResults.length === 0) throw new Error('Chưa có kết quả PTN để lập bản đánh giá.');
    await pgd.saveLabResultReview(createPgdLabResultReview({ id: review?.id || newId('pgd-lab-review'), requestId: request.id, labResultIds: labResults.map((item) => item.id), completeness: 'COMPLETE', conformity: reviewConformity, conclusion: reviewConclusion.trim(), recommendation: reviewConformity === 'CONFORMING' ? 'Đề nghị tiếp tục lập báo cáo/chứng thư.' : 'Đề nghị xử lý điểm không phù hợp hoặc thử nghiệm lại.', reviewerUsername: currentUser.username, reviewedAt: new Date().toISOString(), status: 'FINAL' }, new Date().toISOString()));
  }, 'Đã lưu bản đánh giá kết quả thử nghiệm.');

  const saveIndex = () => run(async () => {
    const entries: PgdDossierIndexEntry[] = dossierDocuments.length > 0
      ? dossierDocuments.map((document) => ({ requirementCode: document.requirementCode, title: document.title, status: 'PRESENT', documentId: document.id }))
      : [{ requirementCode: 'FIELD', title: 'Hồ sơ hiện trường và lấy mẫu', status: 'MISSING' }];
    await pgd.saveDossierIndex(buildPgdDossierIndex({ id: dossierIndex?.id, requestId: request.id, entries, reviewerUsername: currentUser.username, archivistUsername: currentUser.username, reviewedAt: new Date().toISOString() }, new Date().toISOString()));
  }, 'Đã cập nhật bìa và mục lục hồ sơ PGD.');

  return <div className="space-y-3" aria-label="Biểu mẫu PGD theo folder nguồn">
    <Section title="Kế hoạch & phân công" icon={<ClipboardList size={15} className="text-blue-600" />} locked={!canEditPlan}>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">Lịch đánh giá, thành phần đoàn và dòng sản phẩm được lưu thành kế hoạch PGD riêng.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><SourceField label="Ngày đánh giá" required><PgdcnDateInput className={inputClass} disabled={!canEditPlan || busy} value={planDate} onChange={setPlanDate} /></SourceField><SourceField label="Nội dung trọng tâm" required wide><input className={inputClass} required disabled={!canEditPlan || busy} value={planActivity} onChange={(event) => setPlanActivity(event.target.value)} /></SourceField><button type="button" disabled={!canEditPlan || busy || !planDate || !planActivity.trim()} onClick={savePlan} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu kế hoạch</button></div>
      {plan && <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100"><table className="min-w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-1.5">Thời gian</th><th className="px-2 py-1.5">Nội dung</th><th className="px-2 py-1.5">Đoàn</th></tr></thead><tbody className="divide-y divide-slate-100"><tr><td className="px-2 py-1.5">{plan.inspectionDate}</td><td className="px-2 py-1.5">{plan.schedule.map((row) => `${row.startTime}${row.endTime ? `–${row.endTime}` : ''} ${row.activity}`).join(' · ')}</td><td className="px-2 py-1.5">{plan.team.map((member) => member.username).join(', ')}</td></tr></tbody></table></div>}
    </Section>
    <Section title="Diễn biến vụ giám định" icon={<History size={15} className="text-blue-600" />} locked={!canEditField}>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><SourceField label="Thời gian" required><input className={inputClass} type="time" required value={eventTime} disabled={!canEditField || busy} onChange={(event) => setEventTime(event.target.value)} /></SourceField><SourceField label="Nội dung công việc" required><input className={inputClass} required value={eventActivity} disabled={!canEditField || busy} onChange={(event) => setEventActivity(event.target.value)} /></SourceField><SourceField label="Ghi chú / xác nhận"><input className={inputClass} value={eventNote} disabled={!canEditField || busy} onChange={(event) => setEventNote(event.target.value)} /></SourceField><button type="button" disabled={!canEditField || busy || !eventActivity.trim()} onClick={saveEvent} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 disabled:opacity-50"><Save size={13} /> Thêm mốc</button></div>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100"><table className="min-w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-1.5">Thời gian</th><th className="px-2 py-1.5">Nội dung</th><th className="px-2 py-1.5">Người thực hiện</th><th className="px-2 py-1.5">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.id}><td className="whitespace-nowrap px-2 py-1.5">{formatDateTimeDdMmYyyy(event.occurredAt) || 'Chưa cập nhật'}</td><td className="px-2 py-1.5">{event.activity}</td><td className="px-2 py-1.5">{event.actorUsername}</td><td className="px-2 py-1.5">{event.note || '—'}</td></tr>)}{events.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-400">Chưa có diễn biến.</td></tr>}</tbody></table></div>
    </Section>
    <Section title="Ghi chép hiện trường" icon={<FileText size={15} className="text-blue-600" />} locked={!canEditField}>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><SourceField label="Buổi" required><select className={inputClass} required disabled={!canEditField || busy} value={session} onChange={(event) => setSession(event.target.value as PgdFieldActivitySession)}><option value="MORNING">Buổi sáng</option><option value="AFTERNOON">Buổi chiều</option></select></SourceField><SourceField label="Ngày" required><PgdcnDateInput className={inputClass} disabled={!canEditField || busy} value={fieldDate} onChange={setFieldDate} /></SourceField><SourceField label="Nội dung" required><input className={inputClass} required disabled={!canEditField || busy} value={fieldActivity} onChange={(event) => setFieldActivity(event.target.value)} /></SourceField><SourceField label="Nhận xét"><input className={inputClass} disabled={!canEditField || busy} value={fieldComments} onChange={(event) => setFieldComments(event.target.value)} /></SourceField><button type="button" disabled={!canEditField || busy || !fieldActivity.trim()} onClick={saveFieldLog} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] font-black text-blue-700 disabled:opacity-50 sm:col-span-2 lg:col-span-1"><Save size={13} /> Lưu buổi</button></div>
      <div className="mt-2 flex flex-wrap gap-1.5">{fieldLogs.map((log) => <span key={log.id} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-600">{log.session === 'MORNING' ? 'Sáng' : 'Chiều'} · {log.date || '—'} · {log.entries.length} dòng</span>)}{fieldLogs.length === 0 && <span className="text-[11px] text-slate-400">Chưa có phiếu ghi chép buổi sáng/chiều.</span>}</div>
    </Section>
    <Section title="Đánh giá KQTN" icon={<ShieldCheck size={15} className="text-emerald-600" />} locked={!canEditReview}>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-slate-500">{labResults.length} kết quả PTN đã liên kết; bản đánh giá là điều kiện trước khi hoàn thiện báo cáo và trình phê duyệt hai cấp.</p><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">{review ? review.status : 'Chưa đánh giá'}</span></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><SourceField label="Tình trạng kết quả" required><select className={inputClass} required disabled={!canEditReview || labResults.length === 0 || busy} value={reviewConformity} onChange={(event) => setReviewConformity(event.target.value as 'CONFORMING' | 'NON_CONFORMING')}><option value="CONFORMING">Phù hợp</option><option value="NON_CONFORMING">Không phù hợp</option></select></SourceField><SourceField label="Kết luận đánh giá" required wide><input className={inputClass} required disabled={!canEditReview || labResults.length === 0 || busy} value={reviewConclusion} onChange={(event) => setReviewConclusion(event.target.value)} /></SourceField><button type="button" disabled={!canEditReview || busy || labResults.length === 0 || !reviewConclusion.trim()} onClick={saveReview} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu đánh giá</button></div>
    </Section>
    <Section title="Bìa hồ sơ" icon={<FileText size={15} className="text-slate-600" />} locked={!reportAccess.editable || !editable}>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] leading-4 text-slate-500">Mục lục được lập từ danh mục tài liệu PGD hiện hành, không tham chiếu đường dẫn ngoài ứng dụng.</p><button type="button" disabled={!editable || !reportAccess.editable || busy} onClick={saveIndex} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-50"><Save size={13} /> Cập nhật mục lục</button></div>
      <div className="mt-2 text-[11px] text-slate-400">{dossierIndex ? `${dossierIndex.entries.length} mục · cập nhật ${formatDateTimeDdMmYyyy(dossierIndex.updatedAt) || 'Chưa cập nhật'}` : 'Chưa có mục lục hồ sơ.'}</div>
    </Section>
  </div>;
}
