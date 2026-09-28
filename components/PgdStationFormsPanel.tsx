'use client';

import { ClipboardCheck, ClipboardList, FileCheck2, FlaskConical, Save, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { usePgdStore } from '../store-pgd';
import type { PcnUserAccount } from '../types';
import {
  PGD_DOMAIN,
  buildPgdLabRequest,
  buildPgdLabResult,
  snapshotPgdResultTemplate,
  type PgdInspectionRequest,
  type PgdSample,
} from '../utils/pgdDomain';
import type { PgdCellTableRow, PgdTemplateCell } from '../utils/pgdDocumentTemplates';
import {
  buildPgdFieldInspection,
  combinePgdLocalDateTime,
  getPgdOperationalStepAccess,
  toPgdLocalDateTimeFields,
  type PgdOperationalStationKey,
} from '../utils/pgdWorkflow';
import { isOrganizationLeader, isPcnSystemManager } from '../utils/pcnRbac';
import {
  createPgdInspectionPlan,
  createPgdLabResultReview,
} from '../utils/pgdArtifacts';
import { getPgdDossierRequirements } from '../utils/pgdDossier';
import PgdCaseEvidencePanel from './PgdCaseEvidencePanel';
import PgdDossierOperationsPanel from './PgdDossierOperationsPanel';
import PgdSourceFormsPanel from './PgdSourceFormsPanel';
import PgdTableFieldEditor from './PgdTableFieldEditor';
import { PgdcnDateInput } from './PgdcnDateInput';

export type PgdStationPanelProps = {
  request: PgdInspectionRequest;
  currentUser: PcnUserAccount;
  editable: boolean;
};

const inputClass = 'mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

const PGD_MEASUREMENT_CELL: PgdTemplateCell = {
  key: 'fieldMeasurements', label: 'Đo kiểm / kích thước', sectionCode: 'measurements', row: 1, column: 1,
  type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit'],
  tableColumnLabels: { item: 'Hạng mục', value: 'Giá trị', unit: 'Đơn vị' },
};

const PGD_SAMPLE_LINE_CELL: PgdTemplateCell = {
  key: 'sampleLines', label: 'Dòng lấy mẫu', sectionCode: 'samples', row: 1, column: 1,
  type: 'TABLE', required: true,
  tableColumns: ['description', 'lotQuantity', 'quantity', 'sampleSize', 'sampleCode', 'destination', 'sealNumber', 'note'],
  tableColumnLabels: { description: 'Mô tả', lotQuantity: 'SL lô', quantity: 'SL mẫu', sampleSize: 'Cỡ mẫu', sampleCode: 'Mã mẫu', destination: 'Nơi nhận', sealNumber: 'Số niêm phong', note: 'Ghi chú' },
  validation: { minRows: 1 },
};

const PGD_TEST_ITEM_CELL: PgdTemplateCell = {
  key: 'labTestItems', label: 'Hạng mục và phương pháp thử', sectionCode: 'laboratory', row: 1, column: 1,
  type: 'TABLE', required: true, tableColumns: ['item', 'method'],
  tableColumnLabels: { item: 'Chỉ tiêu', method: 'Phương pháp' }, validation: { minRows: 1 },
};

const PGD_RESULT_ROW_CELL: PgdTemplateCell = {
  key: 'labResultValues', label: 'Bảng kết quả PTN', sectionCode: 'results', row: 1, column: 1,
  type: 'TABLE', required: false, tableColumns: ['item', 'value', 'unit', 'method'],
  tableColumnLabels: { item: 'Chỉ tiêu', value: 'Giá trị', unit: 'Đơn vị', method: 'Phương pháp' },
};

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

const REQUIRED_STATION_FIELDS = new Set([
  'Giám định viên (phân tách bằng dấu phẩy)',
  'Người soát xét kỹ thuật',
  'Ngày hiện trường',
  'Quan sát lô hàng',
  'Bao gói / bảo quản',
  'Nhãn / nhận dạng',
  'Điểm không phù hợp',
  'Kết quả hiện trường',
  'Bảng dòng lấy mẫu',
  'Mẫu gửi PTN',
  'Phòng thử nghiệm',
  'Hạng mục và phương pháp thử',
  'Yêu cầu PTN',
  'Kết quả PTN',
  'Tiêu đề báo cáo',
  'Kết luận',
]);

function Field({ label, children, wide = false, className = '', required }: { label: string; children: ReactNode; wide?: boolean; className?: string; required?: boolean }) {
  const normalizedLabel = label.replace(/\s*\*\s*$/, '').trim();
  const isRequired = required ?? REQUIRED_STATION_FIELDS.has(normalizedLabel);
  return <label className={`${wide ? 'block sm:col-span-2 lg:col-span-2' : 'block'} ${className}`.trim()}><span className="mb-1 block text-[11px] font-black text-slate-500">{normalizedLabel}{isRequired && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
}

function StationSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h2 className="flex items-center gap-2 text-xs font-black text-slate-800">{icon}{title}</h2>{children}</section>;
}

function canManagePgd(user: PcnUserAccount): boolean {
  return isPcnSystemManager(user) || user.pgdRole === 'PGD_ADMIN' || user.pgdRole === 'PGD_MANAGER';
}

function useDossierEvidence(request: PgdInspectionRequest) {
  const pgd = usePgdStore();
  const requirements = useMemo(() => getPgdDossierRequirements(request.productGroup), [request.productGroup]);
  const documents = pgd.dossierDocuments.filter((item) => item.requestId === request.id);
  useEffect(() => { void pgd.fetchDossierDocuments(request.id).catch(() => undefined); }, [pgd.fetchDossierDocuments, request.id]);
  return { pgd, requirements, documents };
}

function PgdAssignmentForm({ request, currentUser, editable }: PgdStationPanelProps) {
  const pgd = usePgdStore();
  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey: request.status === 'CAPABILITY_REVIEW' ? 'INTAKE_CAPABILITY' : 'PREPARATION' });
  const [inspectors, setInspectors] = useState(assignment?.inspectorUsernames.join(', ') || currentUser.username);
  const [reviewer, setReviewer] = useState(assignment?.technicalReviewerUsername || '');
  const [busy, setBusy] = useState(false);
  const managers = canManagePgd(currentUser);
  const candidates = pgd.users.filter((user) => user.active !== false && user.departmentScopes?.includes('PGD') && (isOrganizationLeader(user) || user.pgdRole !== 'PGD_VIEWER'));
  useEffect(() => { setInspectors(assignment?.inspectorUsernames.join(', ') || currentUser.username); setReviewer(assignment?.technicalReviewerUsername || ''); }, [assignment?.id, currentUser.username]);
  const save = async () => {
    const inspectorUsernames = inspectors.split(',').map((value) => value.trim()).filter(Boolean);
    const technicalReviewerUsername = reviewer.trim() || candidates.find((user) => isOrganizationLeader(user) || ['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL'].includes(user.pgdRole || ''))?.username || '';
    if (inspectorUsernames.length === 0 || !technicalReviewerUsername) { toast.error('Cần chọn giám định viên và người soát xét kỹ thuật PGD.'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await pgd.saveAssignment({ id: assignment?.id || newId('pgd-assignment'), domain: PGD_DOMAIN, requestId: request.id, leadInspectorUsername: inspectorUsernames[0], inspectorUsernames, technicalReviewerUsername, method: request.method, status: managers ? 'APPROVED' : 'PENDING_APPROVAL', approvedByUsername: managers ? currentUser.username : undefined, approvedAt: managers ? now : undefined, createdAt: assignment?.createdAt || now, updatedAt: now });
      toast.success(managers ? 'Đã lưu và phê duyệt phân công PGD.' : 'Đã lưu phân công chờ phê duyệt.');
    } catch (error: any) { toast.error(error?.message || 'Không thể lưu phân công PGD.'); } finally { setBusy(false); }
  };
  const canEdit = editable && access.editable;
  return <StationSection title="Phiếu phân công và xem xét năng lực" icon={<ClipboardList size={15} className="text-blue-600" />}><p className="mt-1 text-[11px] leading-4 text-slate-500">Phân công đoàn giám định theo ma trận chuyên môn; quản lý hoặc Quản trị viên có thể phê duyệt/điều chỉnh thủ công.</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-2"><Field label="Giám định viên (phân tách bằng dấu phẩy)"><input className={inputClass} disabled={!canEdit || busy} value={inspectors} onChange={(event) => setInspectors(event.target.value)} /></Field><Field label="Người soát xét kỹ thuật"><select className={inputClass} disabled={!canEdit || busy} value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option value="">Tự chọn theo ma trận...</option>{candidates.map((user) => <option key={user.username} value={user.username}>{user.username} · {user.name} · {user.pgdRole || 'PGD'}</option>)}</select></Field></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] text-slate-400">Trạng thái: <b className="text-slate-600">{assignment?.status || 'Chưa lập phiếu'}</b>{!canEdit && ' · Trạm đang khóa theo quy trình'}</span><button type="button" disabled={!canEdit || busy} onClick={() => void save()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} />{busy ? 'Đang lưu...' : managers ? 'Lưu & phê duyệt' : 'Lưu chờ phê duyệt'}</button></div></StationSection>;
}

function PgdPlanForm({ request, currentUser, editable }: PgdStationPanelProps) {
  const pgd = usePgdStore();
  const plan = pgd.inspectionPlans.find((item) => item.requestId === request.id);
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'PREPARATION' });
  const [date, setDate] = useState(plan?.inspectionDate || request.inspectionScheduledAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [activity, setActivity] = useState('Kiểm tra hồ sơ, ngoại quan, kích thước và lấy mẫu');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDate(plan?.inspectionDate || request.inspectionScheduledAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)); }, [plan?.id, request.id]);
  const save = async () => {
    setBusy(true);
    try {
      const inspectors = pgd.assignments.find((item) => item.requestId === request.id)?.inspectorUsernames || [currentUser.username];
      await pgd.saveInspectionPlan(createPgdInspectionPlan({ id: plan?.id || newId('pgd-plan'), requestId: request.id, inspectionDate: date, team: inspectors.map((username, index) => ({ username, role: index === 0 ? 'LEAD' : 'INSPECTOR' })), productLines: [{ productName: request.productName, grade: request.productDetails?.grade, dimensions: request.productDetails?.dimensions, standard: request.productDetails?.productStandard || request.standards.join(', '), origin: request.productDetails?.countryOfOrigin || request.productDetails?.origin, manufacturer: request.productDetails?.manufacturer, quantity: request.quantity, unit: request.unit }], schedule: [{ startTime: '08:30', endTime: '09:00', activity: 'Họp khai mạc và thống nhất nội dung' }, { startTime: '09:00', endTime: '11:00', activity: activity.trim() || 'Kiểm tra hồ sơ, ngoại quan và lấy mẫu' }, { startTime: '11:00', endTime: '11:30', activity: 'Hoàn thiện biên bản và kết thúc' }], criteria: request.inspectionScope, assessmentMethod: request.assessmentMethod, inspectionType: 'Giám định theo lô', status: 'CONFIRMED' }));
      toast.success('Đã lưu kế hoạch giám định PGD.');
    } catch (error: any) { toast.error(error?.message || 'Không thể lưu kế hoạch giám định.'); } finally { setBusy(false); }
  };
  const canEdit = editable && access.editable;
  return <StationSection title="Kế hoạch & phân công" icon={<ClipboardList size={15} className="text-blue-600" />}><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><Field label="Ngày hiện trường" required><PgdcnDateInput className={inputClass} required disabled={!canEdit || busy} value={date} onChange={setDate} /></Field><Field label="Nội dung trọng tâm" required className="lg:col-span-2"><input required className={inputClass} disabled={!canEdit || busy} value={activity} onChange={(event) => setActivity(event.target.value)} /></Field><button type="button" disabled={!canEdit || busy || !date || !activity.trim()} onClick={() => void save()} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu kế hoạch</button></div>{plan && <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[9px] text-slate-600">{plan.inspectionDate} · {plan.team.map((member) => member.username).join(', ')} · {plan.schedule.map((row) => row.activity).join(' · ')}</div>}</StationSection>;
}

export function PgdPreparationPanel(props: PgdStationPanelProps) {
  return <div className="space-y-3"><PgdAssignmentForm {...props} /><PgdPlanForm {...props} /><div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-4 text-amber-900"><b>Điều kiện chuyển trạm:</b> cần có phân công đã phê duyệt và kế hoạch giám định trước khi ra hiện trường.</div></div>;
}

export function PgdAssignmentStepPanel(props: PgdStationPanelProps) {
  return <PgdAssignmentForm {...props} />;
}

export function PgdPlanStepPanel(props: PgdStationPanelProps) {
  return <PgdPlanForm {...props} />;
}

function PgdFieldInspectionForm({ request, currentUser, editable }: PgdStationPanelProps) {
  const pgd = usePgdStore();
  const inspections = pgd.fieldInspections.filter((item) => item.requestId === request.id).sort((left, right) => String(right.startedAt || right.performedAt || '').localeCompare(String(left.startedAt || left.performedAt || '')));
  const samples = pgd.samples.filter((item) => item.requestId === request.id);
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'FIELD_SAMPLING' });
  const defaultForm = {
    sessionCode: '',
    activityType: 'Kiểm tra hiện trường',
    date: '',
    startedTime: '',
    endedTime: '',
    location: request.inspectionLocation || '',
    objectDescription: request.productName,
    inspectedQuantity: String(request.quantity || ''),
    inspectedUnit: request.unit || '',
    lotObservation: 'Đã kiểm tra nhận dạng theo PYC.',
    packaging: 'Đã ghi nhận tại hiện trường.',
    labeling: request.lotCode ? 'Số lô: ' + request.lotCode : '',
    nonconformities: 'Không có',
    inspectionResult: 'Kết quả phù hợp với phạm vi giám định đã thống nhất.',
    customerRepresentative: '',
    note: 'Biên bản hiện trường được ghi nhận trên hồ sơ PGD.',
  };
  const [selectedInspectionId, setSelectedInspectionId] = useState('');
  const [newSession, setNewSession] = useState(inspections.length === 0);
  const [copying, setCopying] = useState(false);
  const activeInspection = newSession ? undefined : inspections.find((item) => item.id === selectedInspectionId) || inspections[0];
  const [form, setForm] = useState(defaultForm);
  const [completed, setCompleted] = useState(false);
  const [measurementRows, setMeasurementRows] = useState<PgdCellTableRow[]>([]);
  const [sampleRows, setSampleRows] = useState<PgdCellTableRow[]>([{ description: request.productName, lotQuantity: request.quantity, quantity: 2, sampleSize: '', sampleCode: '', destination: 'LAB + Mẫu lưu', sealNumber: '', note: '' }]);
  const [busy, setBusy] = useState(false);
  const sessionSampleIds = activeInspection?.sampleIds || [];
  const sessionSamples = samples.filter((sample) => sessionSampleIds.includes(sample.id));

  useEffect(() => {
    if (!activeInspection) return;
    const started = toPgdLocalDateTimeFields(activeInspection.startedAt || activeInspection.performedAt);
    const ended = toPgdLocalDateTimeFields(activeInspection.endedAt);
    setForm({
      ...defaultForm,
      sessionCode: activeInspection.sessionCode || '',
      activityType: activeInspection.activityType || defaultForm.activityType,
      date: started.date,
      startedTime: started.time,
      endedTime: ended.time,
      location: activeInspection.location || defaultForm.location,
      objectDescription: activeInspection.objectDescription || defaultForm.objectDescription,
      inspectedQuantity: activeInspection.inspectedQuantity === undefined ? defaultForm.inspectedQuantity : String(activeInspection.inspectedQuantity),
      inspectedUnit: activeInspection.inspectedUnit || defaultForm.inspectedUnit,
      lotObservation: activeInspection.lotObservation || '',
      packaging: activeInspection.packaging || '',
      labeling: activeInspection.labeling || '',
      nonconformities: (activeInspection.nonconformities || []).join('\\n'),
      inspectionResult: activeInspection.inspectionResult || '',
      customerRepresentative: activeInspection.customerRepresentative || '',
      note: activeInspection.note || '',
    });
    setCompleted(activeInspection.completed !== false && activeInspection.status !== 'DRAFT');
    setMeasurementRows(Object.entries(activeInspection.measurements || {}).map(([item, value]) => ({ item, value: String(value), unit: '' })));
    setSampleRows([]);
  }, [activeInspection?.id, request.id]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const selectInspection = (value: string) => {
    if (value === '__new__') {
      setSelectedInspectionId('');
      setNewSession(true);
      setCopying(false);
      setForm(defaultForm);
      setMeasurementRows([]);
      setSampleRows([{ description: request.productName, lotQuantity: request.quantity, quantity: 2, sampleSize: '', sampleCode: '', destination: 'LAB + Mẫu lưu', sealNumber: '', note: '' }]);
      setCompleted(false);
      return;
    }
    setNewSession(false);
    setCopying(false);
    setSelectedInspectionId(value);
  };

  const copyInspection = () => {
    if (!activeInspection) return;
    setNewSession(true);
    setCopying(true);
    setForm((current) => ({
      ...current,
      sessionCode: '',
      date: '',
      startedTime: '',
      endedTime: '',
      location: activeInspection.location || current.location,
      activityType: activeInspection.activityType || current.activityType,
    }));
    setMeasurementRows(Object.entries(activeInspection.measurements || {}).map(([item, value]) => ({ item, value: String(value), unit: '' })));
    setSampleRows([]);
    setCompleted(false);
  };

  const saveInspection = async () => {
    const startedAt = combinePgdLocalDateTime(form.date, form.startedTime);
    const endedAt = completed ? combinePgdLocalDateTime(form.date, form.endedTime) : undefined;
    if (!startedAt) { toast.error('Cần chọn ngày và giờ bắt đầu thực tế của phiên.'); return; }
    if (completed && !endedAt) { toast.error('Phiên đã hoàn tất cần có giờ kết thúc thực tế.'); return; }
    if (completed && endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) { toast.error('Giờ kết thúc không được trước giờ bắt đầu.'); return; }
    if (!form.location.trim()) { toast.error('Cần nhập địa điểm thực tế của phiên.'); return; }
    setBusy(true);
    try {
      const measurements = Object.fromEntries(measurementRows.map((row) => {
        const item = String(row.item || '').trim() || 'Ghi nhận';
        const value = String(row.value || '').trim();
        const unit = String(row.unit || '').trim();
        return [item, unit && value ? value + ' ' + unit : value];
      }).filter(([, value]) => Boolean(String(value).trim())));
      const id = !newSession && activeInspection ? activeInspection.id : newId('pgd-field');
      const baseSampleIds = !newSession && activeInspection ? activeInspection.sampleIds || [] : [];
      const assignment = pgd.assignments.find((item) => item.requestId === request.id);
      const saved = buildPgdFieldInspection({
        id,
        requestId: request.id,
        sessionCode: form.sessionCode || 'PGD-' + (inspections.length + 1),
        activityType: form.activityType,
        performedAt: startedAt,
        startedAt,
        endedAt,
        location: form.location,
        inspectorUsernames: assignment?.inspectorUsernames || [currentUser.username],
        objectDescription: form.objectDescription,
        inspectedQuantity: Number(form.inspectedQuantity) || undefined,
        inspectedUnit: form.inspectedUnit || undefined,
        lotObservation: form.lotObservation,
        packaging: form.packaging,
        labeling: form.labeling,
        measurements,
        nonconformities: form.nonconformities.split('\\n'),
        inspectionResult: form.inspectionResult,
        customerRepresentative: form.customerRepresentative,
        sampleIds: baseSampleIds,
        status: completed ? 'COMPLETED' : 'DRAFT',
        completed,
        note: form.note,
      });
      await pgd.saveFieldInspection(saved);

      const createdSamples: PgdSample[] = [];
      for (const row of sampleRows.filter((candidate) => String(candidate.description || '').trim() || String(candidate.quantity || '').trim())) {
        const quantity = Number(row.quantity);
        if (!Number.isFinite(quantity) || quantity < 2) throw new Error('Số lượng mỗi dòng mẫu phải từ 2 để tách PTN và mẫu lưu.');
        const created = await pgd.splitSample({
          requestId: request.id,
          sampleCodePrefix: String(row.sampleCode || '').trim() || request.requestCode,
          description: String(row.description || '').trim() || request.productName,
          quantity,
          unit: request.unit,
          sampledAt: startedAt,
          samplingLocation: form.location,
          sampledByUsername: assignment?.leadInspectorUsername || currentUser.username,
          sampleSize: String(row.sampleSize || '').trim() || undefined,
          lotQuantity: Number(row.lotQuantity) || quantity,
          lotUnit: request.unit,
        });
        createdSamples.push(...created);
      }

      const linkedSampleIds = Array.from(new Set([...baseSampleIds, ...createdSamples.map((sample) => sample.id)]));
      if (linkedSampleIds.length !== baseSampleIds.length) {
        await pgd.saveFieldInspection({ ...saved, sampleIds: linkedSampleIds });
      }
      setSelectedInspectionId(id);
      setNewSession(false);
      setCopying(false);
      setSampleRows([]);
      toast.success(copying ? 'Đã sao chép thành phiên hiện trường mới.' : createdSamples.length > 0 ? 'Đã lưu phiên và gắn ' + createdSamples.length + ' mẫu vào phiên.' : 'Đã lưu biên bản kiểm tra tại hiện trường.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu biên bản hiện trường.');
    } finally {
      setBusy(false);
    }
  };

  const canEdit = editable && access.editable;
  const statusLabel = completed ? 'Đã hoàn tất' : form.date && form.startedTime ? 'Đang thực hiện' : 'Bản nháp';
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2" data-testid="pgd-field-session-toolbar">
      <label className="shrink-0 text-[11px] font-black text-blue-900" htmlFor="pgd-field-session-select">Phiên hiện trường</label>
      <select id="pgd-field-session-select" value={newSession ? '__new__' : activeInspection?.id || ''} onChange={(event) => selectInspection(event.target.value)} disabled={!canEdit || busy} className="mobile-touch-target min-h-11 min-w-48 max-w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <option value="__new__">+ Phiên mới</option>
        {inspections.map((item, index) => <option key={item.id} value={item.id}>{item.sessionCode || 'Phiên ' + (inspections.length - index)} · {item.location}</option>)}
      </select>
      <button type="button" disabled={!canEdit || busy} onClick={() => selectInspection('__new__')} className="mobile-touch-target min-h-11 shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white">THÊM PHIÊN HIỆN TRƯỜNG</button>
      <button type="button" disabled={!canEdit || busy || !activeInspection} onClick={copyInspection} className="mobile-touch-target min-h-11 shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-[11px] font-black text-blue-700">Sao chép phiên</button>
      {copying ? <span className="shrink-0 text-[11px] font-bold text-blue-700">Đang tạo bản sao chưa lưu</span> : null}
    </div>
    <StationSection title="Biên bản kiểm tra tại hiện trường" icon={<ClipboardCheck size={15} className="text-blue-600" />}>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Mã phiên"><input className={inputClass} disabled={!canEdit || busy} value={form.sessionCode} onChange={(event) => update('sessionCode', event.target.value)} /></Field>
        <Field label="Loại hoạt động"><input className={inputClass} disabled={!canEdit || busy} value={form.activityType} onChange={(event) => update('activityType', event.target.value)} /></Field>
        <Field label="Ngày thực tế" required><PgdcnDateInput className={inputClass} required disabled={!canEdit || busy} value={form.date} onChange={(value) => update('date', value)} /></Field>
        <Field label="Giờ bắt đầu thực tế" required><input type="time" className={inputClass} required disabled={!canEdit || busy} value={form.startedTime} onChange={(event) => update('startedTime', event.target.value)} /></Field>
        <Field label="Giờ kết thúc"><input type="time" className={inputClass} disabled={!canEdit || busy} value={form.endedTime} onChange={(event) => update('endedTime', event.target.value)} /></Field>
        <Field label="Địa điểm thực tế" wide required><input className={inputClass} required disabled={!canEdit || busy} value={form.location} onChange={(event) => update('location', event.target.value)} /></Field>
        <Field label="Đối tượng kiểm tra" wide><input className={inputClass} disabled={!canEdit || busy} value={form.objectDescription} onChange={(event) => update('objectDescription', event.target.value)} /></Field>
        <Field label="Số lượng kiểm tra"><input type="number" min="0" className={inputClass} disabled={!canEdit || busy} value={form.inspectedQuantity} onChange={(event) => update('inspectedQuantity', event.target.value)} /></Field>
        <Field label="Đơn vị"><input className={inputClass} disabled={!canEdit || busy} value={form.inspectedUnit} onChange={(event) => update('inspectedUnit', event.target.value)} /></Field>
        <Field label="Quan sát lô hàng"><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.lotObservation} onChange={(event) => update('lotObservation', event.target.value)} /></Field>
        <Field label="Bao gói / bảo quản"><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.packaging} onChange={(event) => update('packaging', event.target.value)} /></Field>
        <Field label="Nhãn / nhận dạng"><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.labeling} onChange={(event) => update('labeling', event.target.value)} /></Field>
        <Field label="Đại diện khách hàng"><input className={inputClass} disabled={!canEdit || busy} value={form.customerRepresentative} onChange={(event) => update('customerRepresentative', event.target.value)} /></Field>
        <Field label="Đo kiểm / kích thước" wide><PgdTableFieldEditor cell={PGD_MEASUREMENT_CELL} value={measurementRows} readOnly={!canEdit || busy} onChange={setMeasurementRows} /></Field>
        <Field label="Điểm không phù hợp" wide><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.nonconformities} onChange={(event) => update('nonconformities', event.target.value)} /></Field>
        <Field label="Kết quả hiện trường" wide><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.inspectionResult} onChange={(event) => update('inspectionResult', event.target.value)} /></Field>
        <Field label="Ghi chú" wide><textarea rows={2} className={inputClass} disabled={!canEdit || busy} value={form.note} onChange={(event) => update('note', event.target.value)} /></Field>
      </div>
      <label className="mobile-touch-target mt-2 inline-flex min-h-11 items-center gap-2 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} disabled={!canEdit || busy} className="h-4 w-4 accent-blue-600" /> Đánh dấu phiên đã hoàn tất <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px]">{statusLabel}</span></label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-slate-500">{sessionSamples.length} mẫu đã gắn với phiên này · khi lưu sẽ tạo và liên kết các dòng mẫu mới.</span><button type="button" disabled={!canEdit || busy} onClick={() => void saveInspection()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> {copying ? 'Lưu phiên sao chép' : 'Lưu phiên & mẫu'}</button></div>
    </StationSection>
    <StationSection title="Mẫu lấy trong phiên" icon={<FlaskConical size={15} className="text-emerald-600" />}>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">Các dòng dưới đây được tạo thành cặp LAB / mẫu lưu và liên kết vào phiên sau khi lưu. Không dùng toàn bộ mẫu của PYC làm mẫu của phiên.</p>
      <Field label="Bảng dòng lấy mẫu" wide><PgdTableFieldEditor cell={PGD_SAMPLE_LINE_CELL} value={sampleRows} readOnly={!canEdit || busy} onChange={setSampleRows} /></Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sessionSamples.map((sample) => <span key={sample.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">{sample.sampleCode} · {sample.disposition === 'LAB' ? 'LAB' : 'Mẫu lưu'} · {sample.quantity} {sample.unit || ''}</span>)}
        {sessionSamples.length === 0 && <span className="text-[11px] text-slate-400">Chưa có mẫu gắn với phiên này.</span>}
      </div>
    </StationSection>
  </div>;
}export function PgdFieldSamplingPanel(props: PgdStationPanelProps) {
  const { request } = props;
  const evidence = useDossierEvidence(request);
  return <div className="space-y-3"><PgdFieldInspectionForm {...props} /><PgdLabRequestForm {...props} /><PgdCaseEvidencePanel request={request} requirements={evidence.requirements} dossierDocuments={evidence.documents} samples={evidence.pgd.samples.filter((item) => item.requestId === request.id)} canMutate={props.editable} editable={props.editable} /><PgdSourceFormsPanel request={request} currentUser={props.currentUser} editable={props.editable} /></div>;
}

export function PgdFieldInspectionStepPanel(props: PgdStationPanelProps) {
  return <div className="space-y-3"><PgdFieldInspectionForm {...props} /><PgdLabRequestForm {...props} handoverOnly /></div>;
}

function PgdLabRequestForm({ request, currentUser, editable, handoverOnly = false }: PgdStationPanelProps & { handoverOnly?: boolean }) {
  const pgd = usePgdStore();
  const samples = pgd.samples.filter((item) => item.requestId === request.id && item.disposition === 'LAB');
  const labRequests = pgd.labRequests.filter((item) => item.requestId === request.id);
  const labResults = pgd.labResults.filter((item) => item.requestId === request.id);
  const review = pgd.labResultReviews.find((item) => item.requestId === request.id);
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey: handoverOnly ? 'FIELD_SAMPLING' : 'LAB_RESULTS' });
  const [sampleId, setSampleId] = useState(samples[0]?.id || '');
  const [labName, setLabName] = useState('PTN nội bộ TVCI');
  const [labCode, setLabCode] = useState('');
  const [testRows, setTestRows] = useState<PgdCellTableRow[]>([{ item: 'Nhận dạng / kích thước / chỉ tiêu theo PYC', method: request.standards[0] || '' }]);
  const [selectedLabRequestId, setSelectedLabRequestId] = useState('');
  const [reportNumber, setReportNumber] = useState('');
  const [resultRows, setResultRows] = useState<PgdCellTableRow[]>([{ item: 'Kết quả tổng hợp', value: 'Đạt theo phạm vi kết quả được tiếp nhận', unit: '', method: '' }]);
  const [reviewConclusion, setReviewConclusion] = useState(review?.conclusion || 'Kết quả thử nghiệm phù hợp với tiêu chuẩn áp dụng.');
  const [busy, setBusy] = useState(false);
  const selectedLabRequest = labRequests.find((item) => item.id === selectedLabRequestId) || labRequests[0];
  const selectedLabResult = labResults.find((item) => item.labRequestId === selectedLabRequest?.id);
  useEffect(() => { if (!sampleId && samples[0]) setSampleId(samples[0].id); if (!selectedLabRequestId && labRequests[0]) setSelectedLabRequestId(labRequests[0].id); }, [labRequests, sampleId, samples, selectedLabRequestId]);
  useEffect(() => { if (selectedLabRequest) setTestRows(selectedLabRequest.testItems.map((item, index) => ({ item, method: selectedLabRequest.testMethods?.[index] || request.standards[index] || '' }))); }, [selectedLabRequest?.id, request.id]);
  useEffect(() => { if (selectedLabResult?.values.length) setResultRows(selectedLabResult.values.map((item) => ({ item: item.label, value: item.value, unit: item.unit || '', method: '' }))); }, [selectedLabResult?.id]);
  const run = async (action: () => Promise<void>, message: string) => { setBusy(true); try { await action(); toast.success(message); } catch (error: any) { toast.error(error?.message || 'Không thể cập nhật dữ liệu PTN PGD.'); } finally { setBusy(false); } };
    const saveRequest = () => run(async () => { const sample = samples.find((item) => item.id === sampleId); if (!sample) throw new Error('Cần chọn mẫu gửi PTN.'); const rows = testRows.filter((row) => String(row.item || '').trim()); if (rows.length === 0) throw new Error('Cần nhập ít nhất một hạng mục thử nghiệm.'); const next = buildPgdLabRequest({ id: newId('pgd-lab-request'), domain: PGD_DOMAIN, requestId: request.id, sampleId: sample.id, status: 'SENT', laboratoryName: labName, laboratoryCode: labCode, senderUnit: 'Phòng Giám định, Chứng nhận, Phát triển thị trường', testItems: rows.map((row) => String(row.item).trim()), testMethods: rows.map((row) => String(row.method || '').trim()).filter(Boolean), handover: { sentAt: new Date().toISOString(), quantity: sample.quantity, note: `Bàn giao theo PYC ${request.requestCode}` } }, currentUser.username); await pgd.saveLabRequest(next); setSelectedLabRequestId(next.id); }, 'Đã lập phiếu giao nhận và yêu cầu PTN.');
  const saveResult = () => run(async () => { const labRequest = labRequests.find((item) => item.id === selectedLabRequestId) || labRequests[0]; if (!labRequest) throw new Error('Chưa có yêu cầu PTN để nhận kết quả.'); const values = resultRows.filter((row) => String(row.item || '').trim() || String(row.value || '').trim()).map((row) => ({ key: String(row.item || 'SUMMARY').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label: String(row.item || 'Kết quả tổng hợp').trim(), value: String(row.value || '').trim(), unit: String(row.unit || '').trim() || undefined })); if (values.length === 0) throw new Error('Cần nhập ít nhất một dòng kết quả PTN.'); const result = buildPgdLabResult({ id: newId('pgd-lab-result'), domain: PGD_DOMAIN, requestId: request.id, labRequestId: labRequest.id, reportNumber: reportNumber.trim() || undefined, receivedAt: new Date().toISOString(), values, issue: undefined }, currentUser.username); await pgd.saveLabResult(result); setSelectedLabRequestId(labRequest.id); }, 'Đã tiếp nhận kết quả PTN.');
  const saveReview = () => run(async () => { if (labResults.length === 0) throw new Error('Chưa có kết quả PTN để đánh giá.'); await pgd.saveLabResultReview(createPgdLabResultReview({ id: review?.id || newId('pgd-lab-review'), requestId: request.id, labResultIds: labResults.map((item) => item.id), completeness: 'COMPLETE', conformity: 'CONFORMING', conclusion: reviewConclusion.trim(), recommendation: 'Đề nghị tiếp tục lập báo cáo/chứng thư.', reviewerUsername: currentUser.username, reviewedAt: new Date().toISOString(), status: 'FINAL' })); }, 'Đã lưu bản đánh giá kết quả thử nghiệm.');
  const canEdit = editable && access.editable;
  const resultsEditable = canEdit && !handoverOnly;
  if (handoverOnly) {
    return <div className="space-y-3"><StationSection title="Phiếu giao nhận mẫu" icon={<FlaskConical size={15} className="text-blue-600" />}><p className="mt-1 text-[11px] text-slate-500">Phiếu yêu cầu PTN ghi rõ mẫu, phòng thử nghiệm, hạng mục và phương pháp.</p><p className="mt-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[11px] leading-4 text-blue-900">Bàn giao mẫu là phần việc cuối của trạm hiện trường. Sau khi lưu, hồ sơ mới được chuyển sang <b>Chờ kết quả PTN</b> để tiếp nhận KQTN.</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Mẫu gửi PTN"><select className={inputClass} disabled={!canEdit || busy} value={sampleId} onChange={(event) => setSampleId(event.target.value)}><option value="">Chọn mẫu PTN...</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleCode} · {sample.description} · {sample.quantity} {sample.unit || ''}</option>)}</select></Field><Field label="Phòng thử nghiệm"><input className={inputClass} disabled={!canEdit || busy} value={labName} onChange={(event) => setLabName(event.target.value)} /></Field><Field label="Mã PTN"><input className={inputClass} disabled={!canEdit || busy} value={labCode} onChange={(event) => setLabCode(event.target.value)} /></Field><Field label="Hạng mục và phương pháp thử" wide><PgdTableFieldEditor cell={PGD_TEST_ITEM_CELL} value={testRows} readOnly={!canEdit || busy} onChange={setTestRows} /></Field></div><div className="mt-2 flex justify-end"><button type="button" disabled={!canEdit || busy || !sampleId} onClick={() => void saveRequest()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Send size={13} /> Lập phiếu & bàn giao PTN</button></div></StationSection></div>;
  }
  return <div className="space-y-3"><StationSection title="Phiếu giao nhận mẫu" icon={<FlaskConical size={15} className="text-blue-600" />}><p className="mt-1 text-[11px] text-slate-500">Phiếu yêu cầu PTN ghi rõ mẫu, phòng thử nghiệm, hạng mục và phương pháp.</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Mẫu gửi PTN"><select className={inputClass} disabled={!canEdit || busy} value={sampleId} onChange={(event) => setSampleId(event.target.value)}><option value="">Chọn mẫu PTN...</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleCode} · {sample.description} · {sample.quantity} {sample.unit || ''}</option>)}</select></Field><Field label="Phòng thử nghiệm"><input className={inputClass} disabled={!canEdit || busy} value={labName} onChange={(event) => setLabName(event.target.value)} /></Field><Field label="Mã PTN"><input className={inputClass} disabled={!canEdit || busy} value={labCode} onChange={(event) => setLabCode(event.target.value)} /></Field><Field label="Hạng mục và phương pháp thử" wide><PgdTableFieldEditor cell={PGD_TEST_ITEM_CELL} value={testRows} readOnly={!canEdit || busy} onChange={setTestRows} /></Field></div><div className="mt-2 flex justify-end"><button type="button" disabled={!canEdit || busy || !sampleId} onClick={() => void saveRequest()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Send size={13} /> Lập phiếu & bàn giao PTN</button></div></StationSection><StationSection title="Tiếp nhận KQTN" icon={<FileCheck2 size={15} className="text-emerald-600" />}><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Yêu cầu PTN"><select className={inputClass} disabled={!canEdit || busy} value={selectedLabRequestId} onChange={(event) => setSelectedLabRequestId(event.target.value)}><option value="">Chọn yêu cầu PTN...</option>{labRequests.map((item) => <option key={item.id} value={item.id}>{item.laboratoryName} · {item.testItems.join(', ')} · {item.status}</option>)}</select></Field><Field label="Số báo cáo PTN"><input className={inputClass} disabled={!canEdit || busy} value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} /></Field><Field label="Kết quả PTN" wide><PgdTableFieldEditor cell={PGD_RESULT_ROW_CELL} value={resultRows} readOnly={!canEdit || busy} onChange={setResultRows} /></Field></div><div className="mt-2 flex justify-end"><button type="button" disabled={!canEdit || busy || (!selectedLabRequestId && labRequests.length === 0)} onClick={() => void saveResult()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 disabled:opacity-50"><Save size={13} /> Ghi nhận KQTN</button></div><div className="mt-2 text-[9px] text-slate-500">{labRequests.length} yêu cầu PTN · {labResults.length} kết quả đã tiếp nhận{labRequests.some((item) => !item.resultId) && <span role="alert" className="ml-2 text-[11px] font-bold text-amber-700">Cảnh báo: còn yêu cầu chưa có kết quả.</span>}</div></StationSection><StationSection title="Đánh giá KQTN" icon={<ShieldCheck size={15} className="text-blue-600" />}><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-[11px] font-black text-slate-500">Kết luận đối chiếu với tiêu chuẩn<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><textarea rows={2} className={inputClass} disabled={!canEdit || busy || labResults.length === 0} value={reviewConclusion} onChange={(event) => setReviewConclusion(event.target.value)} /></label><button type="button" disabled={!canEdit || busy || labResults.length === 0 || !reviewConclusion.trim()} onClick={() => void saveReview()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu đánh giá</button></div>{review && <p className="mt-2 text-[9px] text-slate-500">Đã đánh giá bởi {review.reviewerUsername || '—'} · {review.conclusion}</p>}</StationSection></div>;
}

export function PgdLabResultsPanel(props: PgdStationPanelProps) {
  const { request } = props;
  const evidence = useDossierEvidence(request);
  return <div className="space-y-3"><PgdLabRequestForm {...props} /><PgdCaseEvidencePanel request={request} requirements={evidence.requirements} dossierDocuments={evidence.documents} samples={evidence.pgd.samples.filter((item) => item.requestId === request.id)} canMutate={props.editable} editable={props.editable} /></div>;
}

export function PgdLabRequestStepPanel(props: PgdStationPanelProps) {
  return <PgdLabRequestForm {...props} />;
}

function PgdReportApprovalForm({ request, currentUser, editable }: PgdStationPanelProps) {
  const pgd = usePgdStore();
  const report = pgd.reports.find((item) => item.requestId === request.id);
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const approvals = pgd.approvals.filter((item) => item.requestId === request.id);
  const labResults = pgd.labResults.filter((item) => item.requestId === request.id);
  const template = pgd.templates.find((item) => item.productGroup === request.productGroup && item.active) || pgd.templates.find((item) => item.active);
  const [reportNumber, setReportNumber] = useState(report?.reportNumber || '');
  const [title, setTitle] = useState(report?.title || `Báo cáo giám định · ${request.productName}`);
  const [conclusion, setConclusion] = useState(report?.conclusion || 'Kết quả giám định phù hợp với phạm vi và tiêu chuẩn đã thống nhất.');
  const [certificateNumber, setCertificateNumber] = useState(certificate?.documentNumber || '');
  const [busy, setBusy] = useState(false);
  const evidence = useDossierEvidence(request);
  const access = getPgdOperationalStepAccess({ status: request.status, targetStationKey: 'REPORT_APPROVAL_RETURN' });
  const canEdit = editable && access.editable && labResults.length > 0;
  useEffect(() => { setReportNumber(report?.reportNumber || ''); setTitle(report?.title || `Báo cáo giám định · ${request.productName}`); setConclusion(report?.conclusion || 'Kết quả giám định phù hợp với phạm vi và tiêu chuẩn đã thống nhất.'); setCertificateNumber(certificate?.documentNumber || ''); }, [certificate?.id, report?.id, request.id]);
  const run = async (action: () => Promise<void>, message: string) => { setBusy(true); try { await action(); toast.success(message); } catch (error: any) { toast.error(error?.message || 'Không thể cập nhật báo cáo/chứng thư PGD.'); } finally { setBusy(false); } };
  const saveReport = () => run(async () => { const now = new Date().toISOString(); const snapshot = template ? snapshotPgdResultTemplate(template) : undefined; await pgd.saveReport({ id: report?.id || newId('pgd-report'), domain: PGD_DOMAIN, requestId: request.id, reportNumber: reportNumber.trim() || undefined, title: title.trim(), standardSnapshot: [...request.standards], templateSnapshot: snapshot, values: template ? template.fields.map((field) => ({ key: field.key, label: field.label, value: null, unit: field.unit })) : [], conclusion: conclusion.trim(), status: 'DRAFT', createdAt: report?.createdAt || now, updatedAt: now }); }, 'Đã lưu báo cáo giám định.');
  const saveCertificate = () => run(async () => { const now = new Date().toISOString(); await pgd.saveCertificate({ id: certificate?.id || newId('pgd-certificate'), domain: PGD_DOMAIN, requestId: request.id, documentNumber: certificateNumber.trim() || undefined, title: `Chứng thư giám định · ${request.productName}`, standardSnapshot: [...request.standards], conclusion: conclusion.trim(), templateSnapshot: template ? snapshotPgdResultTemplate(template) : undefined, status: certificate?.status === 'SIGNED' ? 'SIGNED' : 'DRAFT', signedByUsername: certificate?.signedByUsername, signedAt: certificate?.signedAt, createdAt: certificate?.createdAt || now, updatedAt: now }); }, 'Đã lưu dự thảo chứng thư giám định.');
  const approve = (role: 'TECHNICAL_REVIEW' | 'LEADERSHIP_APPROVAL') => {
    const sequence = role === 'TECHNICAL_REVIEW' ? 1 : 2;
    const label = role === 'TECHNICAL_REVIEW' ? 'phê duyệt chuyên môn PGD' : 'phê duyệt lãnh đạo PGD';
    return run(async () => {
      await pgd.approveStep({
        id: approvals.find((item) => item.role === role)?.id || newId(`pgd-approval-${sequence}`),
        domain: PGD_DOMAIN,
        requestId: request.id,
        sequence,
        role,
        status: 'PENDING',
        actedByUsername: currentUser.username,
        actedAt: new Date().toISOString(),
        comment: `Đã ${label}.`,
      });
    }, `Đã ${label}.`);
  };
  const technicalApproved = approvals.some((item) => item.role === 'TECHNICAL_REVIEW' && item.status === 'APPROVED');
  const leadershipApproved = approvals.some((item) => item.role === 'LEADERSHIP_APPROVAL' && item.status === 'APPROVED');
  return <div className="space-y-3"><StationSection title="Báo cáo giám định" icon={<FileCheck2 size={15} className="text-blue-600" />}><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Số báo cáo"><input className={inputClass} disabled={!canEdit || busy} value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} /></Field><Field label="Tiêu đề báo cáo"><input className={inputClass} disabled={!canEdit || busy} value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Kết luận" wide><textarea rows={3} className={inputClass} disabled={!canEdit || busy} value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></Field></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] text-slate-400">Bản chụp tiêu chuẩn: {request.standards.join(' · ') || 'Chưa có'}</span><button type="button" disabled={!canEdit || busy || !title.trim() || !conclusion.trim()} onClick={() => void saveReport()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu báo cáo</button></div></StationSection><StationSection title="Chứng thư giám định" icon={<FileCheck2 size={15} className="text-emerald-600" />}><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"><Field label="Số chứng thư"><input className={inputClass} disabled={!canEdit || busy} value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} /></Field><div className="flex items-end"><button type="button" disabled={!canEdit || busy || !conclusion.trim()} onClick={() => void saveCertificate()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={13} /> Lưu chứng thư</button></div></div><p className="mt-2 text-[9px] text-slate-500">{certificate ? `Trạng thái: ${certificate.status} · ${certificate.documentNumber || 'Chưa có số'}` : 'Chưa có dự thảo chứng thư.'}</p></StationSection><StationSection title="Phê duyệt hai cấp" icon={<ShieldCheck size={15} className="text-indigo-600" />}><div className="grid gap-2"><p className="text-[11px] leading-4 text-slate-500">Kết quả đi qua phê duyệt chuyên môn PGD trước, sau đó mới trình lãnh đạo Trung tâm / Viện.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={!canEdit || busy || !report || !certificate || request.status !== 'TECHNICAL_REVIEW' || technicalApproved} onClick={() => void approve('TECHNICAL_REVIEW')} className="inline-flex mobile-touch-target min-h-11 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 disabled:opacity-50">Phê duyệt chuyên môn {technicalApproved ? '✓' : ''}</button><button type="button" disabled={!canEdit || busy || !report || !certificate || request.status !== 'LEADERSHIP_APPROVAL' || !technicalApproved || leadershipApproved} onClick={() => void approve('LEADERSHIP_APPROVAL')} className="inline-flex mobile-touch-target min-h-11 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-700 disabled:opacity-50">Phê duyệt lãnh đạo / ký {leadershipApproved ? '✓' : ''}</button></div></div></StationSection><PgdSourceFormsPanel request={request} currentUser={currentUser} editable={editable} /><PgdDossierOperationsPanel request={request} requirements={evidence.requirements} dossierDocuments={evidence.documents} canMutate={editable} editable={editable} /></div>;
}

export function PgdReportApprovalPanel(props: PgdStationPanelProps) {
  return <PgdReportApprovalForm {...props} />;
}

export function PgdResultsStepPanel(props: PgdStationPanelProps) {
  return <PgdReportApprovalForm {...props} />;
}

export type { PgdOperationalStationKey };
