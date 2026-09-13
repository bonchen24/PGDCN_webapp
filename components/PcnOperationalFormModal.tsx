'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Save, X } from 'lucide-react';

import type {
  PcnAssignmentForm,
  PcnCommercialForm,
  PcnEvaluationPlanForm,
  PcnEvaluationReportForm,
  PcnFieldInspectionForm,
  PcnOperationalFormKind,
  PcnOperationalForms,
  PcnSampleCodingForm,
  PcnSampleLot,
  PcnSampleTakingForm,
  PcnUserAccount,
  UserAccount,
} from '../types';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { mergePcnOperationalForm, validatePcnOperationalForm } from '../utils/pcnOperationalForms';
import { FORM_REQUIRED_FIELDS } from '../utils/pcnOperationalForms';
import PcnCatalogCombobox from './PcnCatalogCombobox';
import { PgdcnDateInput } from './PgdcnDateInput';

export type PcnOperationalFormValue =
  | PcnAssignmentForm
  | PcnEvaluationPlanForm
  | PcnFieldInspectionForm
  | PcnSampleTakingForm
  | PcnSampleCodingForm
  | PcnEvaluationReportForm
  | PcnCommercialForm;

type FormState = Record<string, string | number | string[]>;

export const PCN_OPERATIONAL_FORM_LABELS: Record<PcnOperationalFormKind, string> = {
  ASSIGNMENT_FORM: 'Phiếu phân công chứng nhận',
  EVALUATION_PLAN: 'Kế hoạch đánh giá CNSP',
  FIELD_INSPECTION: 'Biên bản kiểm tra tại hiện trường',
  SAMPLE_TAKING: 'Biên bản lấy mẫu',
  SAMPLE_CODING: 'Biên bản mã hóa mẫu',
  EVALUATION_REPORT: 'Báo cáo đánh giá hồ sơ',
  COMMERCIAL: 'Hợp đồng dịch vụ',
};

const FORM_DESCRIPTIONS: Record<PcnOperationalFormKind, string> = {
  ASSIGNMENT_FORM: 'Chốt người phụ trách, đoàn đánh giá và phạm vi xử lý bộ hồ sơ.',
  EVALUATION_PLAN: 'Chuẩn bị kế hoạch đánh giá trước khi thực hiện tại khách hàng.',
  FIELD_INSPECTION: 'Ghi nhận kết quả kiểm tra tại hiện trường và các điểm không phù hợp.',
  SAMPLE_TAKING: 'Ghi nhận việc lấy mẫu; mã tem niêm phong được lưu riêng với mã lô.',
  SAMPLE_CODING: 'Mã hóa mẫu theo lô và xác định mã vật lý trước khi gửi phòng thử nghiệm.',
  EVALUATION_REPORT: 'Tổng hợp kết quả đánh giá hồ sơ để chuyển sang soát xét kỹ thuật.',
  COMMERCIAL: 'Lưu thông tin hợp đồng và phạm vi dịch vụ liên quan đến bộ hồ sơ.',
};

const DATE_FIELDS = new Set(['assignedAt', 'plannedStartAt', 'plannedEndAt', 'inspectedAt', 'sampledAt', 'codedAt', 'reportedAt', 'signedAt']);
const NUMBER_FIELDS = new Set(['sampleQuantity', 'serviceValue']);
const ARRAY_FIELDS = new Set(['teamMembers', 'participants', 'nonconformities', 'sampleCodes']);

const BASE_VALUES: Record<PcnOperationalFormKind, FormState> = {
  ASSIGNMENT_FORM: { assignmentNumber: '', assignedAt: '', assignedBy: '', ownerUsername: '', evaluatorUsername: '', reviewerUsername: '', scope: '', notes: '' },
  EVALUATION_PLAN: { plannedStartAt: '', plannedEndAt: '', location: '', teamMembers: [], scope: '', criteria: '', customerRepresentative: '', notes: '' },
  FIELD_INSPECTION: { inspectedAt: '', location: '', participants: [], findings: '', conclusion: '', nonconformities: [], notes: '' },
  SAMPLE_TAKING: { sampledAt: '', location: '', samplingMethod: '', participants: [], sampleQuantity: 0, unit: 'mẫu', packaging: '', sealCode: '', notes: '' },
  SAMPLE_CODING: { codedAt: '', coder: '', lotCode: '', sampleCodes: [], sealCode: '', notes: '' },
  EVALUATION_REPORT: { reportNumber: '', reportedAt: '', findings: '', conclusion: '', nonconformities: [], recommendations: '', notes: '' },
  COMMERCIAL: { contractNumber: '', signedAt: '', customerSigner: '', pcnSigner: '', serviceScope: '', serviceValue: '', paymentTerms: '', notes: '' },
};

const PCN_OPERATIONAL_FORM_FIELD_ORDER: Record<PcnOperationalFormKind, readonly string[]> = {
  ASSIGNMENT_FORM: ['assignmentNumber', 'assignedAt', 'assignedBy', 'ownerUsername', 'evaluatorUsername', 'reviewerUsername', 'scope', 'notes'],
  EVALUATION_PLAN: ['plannedStartAt', 'plannedEndAt', 'location', 'teamMembers', 'scope', 'criteria', 'customerRepresentative', 'notes'],
  FIELD_INSPECTION: ['inspectedAt', 'location', 'participants', 'findings', 'conclusion', 'nonconformities', 'notes'],
  SAMPLE_TAKING: ['sampledAt', 'location', 'samplingMethod', 'participants', 'sampleQuantity', 'unit', 'packaging', 'sealCode', 'notes'],
  SAMPLE_CODING: ['codedAt', 'coder', 'lotCode', 'sampleCodes', 'sealCode', 'notes'],
  EVALUATION_REPORT: ['reportNumber', 'reportedAt', 'findings', 'conclusion', 'nonconformities', 'recommendations', 'notes'],
  COMMERCIAL: ['contractNumber', 'signedAt', 'customerSigner', 'pcnSigner', 'serviceScope', 'serviceValue', 'paymentTerms', 'notes'],
};

export function getPcnOperationalFormFieldOrder(kind: PcnOperationalFormKind): string[] {
  return [...PCN_OPERATIONAL_FORM_FIELD_ORDER[kind]];
}

const FIELD_LABELS: Record<string, string> = {
  assignmentNumber: 'Số phiếu phân công', assignedAt: 'Ngày phân công', assignedBy: 'Người phân công', ownerUsername: 'Chủ hồ sơ', evaluatorUsername: 'Trưởng đoàn đánh giá', reviewerUsername: 'Người soát xét kỹ thuật', scope: 'Phạm vi đánh giá', notes: 'Ghi chú',
  plannedStartAt: 'Ngày bắt đầu đánh giá', plannedEndAt: 'Ngày kết thúc đánh giá', location: 'Địa điểm đánh giá', teamMembers: 'Thành viên đoàn đánh giá', criteria: 'Tiêu chí đánh giá', customerRepresentative: 'Đại diện khách hàng',
  inspectedAt: 'Ngày kiểm tra hiện trường', participants: 'Thành phần tham gia', findings: 'Kết quả / nhận xét', conclusion: 'Kết luận', nonconformities: 'Điểm không phù hợp',
  sampledAt: 'Ngày lấy mẫu', samplingMethod: 'Phương pháp lấy mẫu', sampleQuantity: 'Số lượng mẫu', unit: 'Đơn vị mẫu', packaging: 'Tình trạng bao gói', sealCode: 'Mã tem niêm phong',
  codedAt: 'Ngày mã hóa mẫu', coder: 'Người mã hóa mẫu', lotCode: 'Mã hóa mẫu theo lô', sampleCodes: 'Mã mẫu vật lý',
  reportNumber: 'Số báo cáo đánh giá', reportedAt: 'Ngày lập báo cáo', recommendations: 'Kiến nghị',
  contractNumber: 'Số hợp đồng', signedAt: 'Ngày ký hợp đồng', customerSigner: 'Đại diện khách hàng ký', pcnSigner: 'Đại diện PCN ký', serviceScope: 'Phạm vi dịch vụ', serviceValue: 'Giá trị dịch vụ', paymentTerms: 'Điều khoản thanh toán',
};

const USER_FIELDS = new Set(['assignedBy', 'ownerUsername', 'evaluatorUsername', 'reviewerUsername', 'coder', 'pcnSigner']);
const WIDE_FIELDS = new Set(['scope', 'criteria', 'findings', 'conclusion', 'recommendations', 'packaging', 'serviceScope', 'paymentTerms', 'notes']);
const MULTILINE_FIELDS = new Set(['scope', 'findings', 'conclusion', 'recommendations', 'packaging', 'serviceScope', 'paymentTerms', 'notes']);

function initialFormState(kind: PcnOperationalFormKind, value?: PcnOperationalFormValue): FormState {
  const source = value && typeof value === 'object' ? value as unknown as FormState : {};
  return { ...BASE_VALUES[kind], ...source };
}

function toLines(value: string | number | string[]): string {
  return Array.isArray(value) ? value.join('\n') : String(value ?? '');
}

function displayUser(user: PcnUserAccount): string {
  return getPcnUserDisplayName(user.username, [user]);
}

function FormField({ label, field, error, wide, required = false, children }: { label: string; field: string; error?: string; wide?: boolean; required?: boolean; children: React.ReactNode }) {
  return <label className={`block min-w-0 ${wide ? 'lg:col-span-2' : ''}`}>
    <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">{label}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>
    {children}
    {error && <span className="mt-1 block text-[9px] font-bold text-rose-600">{error}</span>}
    <span className="sr-only">Mã trường {field}</span>
  </label>;
}

export function PcnOperationalFormModal({ kind, initialValue, users, currentUser, sampleLots = [], canEdit = true, onSave, onClose }: {
  kind: PcnOperationalFormKind;
  initialValue?: PcnOperationalFormValue;
  users: PcnUserAccount[];
  currentUser?: UserAccount;
  sampleLots?: PcnSampleLot[];
  canEdit?: boolean;
  onSave: (value: PcnOperationalFormValue) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialFormState(kind, initialValue));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const activeUsers = useMemo(() => users.filter((user) => user.active && (user.systemRole || user.role) !== 'viewer').sort((left, right) => left.name.localeCompare(right.name, 'vi')), [users]);

  useEffect(() => {
    setForm(initialFormState(kind, initialValue));
    setErrors({});
  }, [kind, initialValue]);

  const setField = (field: string, value: string | number | string[]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const controlClass = 'min-h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100';
  const isRequired = (field: string) => FORM_REQUIRED_FIELDS[kind].includes(field);
  const text = (field: string, options?: { wide?: boolean; multiline?: boolean }) => <FormField label={FIELD_LABELS[field] || field} field={field} error={errors[field]} wide={options?.wide} required={isRequired(field)}>
    {options?.multiline ? <textarea required={isRequired(field)} aria-required={isRequired(field) || undefined} value={toLines(form[field])} onChange={(event) => setField(field, event.target.value)} rows={2} disabled={!canEdit || isSaving} className={controlClass} /> : <input required={isRequired(field)} aria-required={isRequired(field) || undefined} value={String(form[field] ?? '')} onChange={(event) => setField(field, event.target.value)} disabled={!canEdit || isSaving} className={controlClass} />}
  </FormField>;
  const date = (field: string) => <FormField label={FIELD_LABELS[field] || field} field={field} error={errors[field]} required={isRequired(field)}><PgdcnDateInput required={isRequired(field)} aria-required={isRequired(field) || undefined} value={String(form[field] ?? '')} onChange={(value) => setField(field, value)} disabled={!canEdit || isSaving} className={controlClass} /></FormField>;
  const array = (field: string) => <FormField label={FIELD_LABELS[field] || field} field={field} error={errors[field]} wide required={isRequired(field)}><textarea required={isRequired(field)} aria-required={isRequired(field) || undefined} value={toLines(form[field])} onChange={(event) => setField(field, event.target.value.split('\n'))} rows={2} disabled={!canEdit || isSaving} className={controlClass} /></FormField>;
  const user = (field: string, emptyLabel = 'Chưa chọn') => {
    const label = FIELD_LABELS[field] || field;
    const options = activeUsers.map((item) => ({
      value: item.username,
      label: displayUser(item),
      searchText: [item.username, item.name, item.position, item.departmentRoleCode].filter(Boolean).join(' '),
      description: item.username,
    }));
    return <FormField label={label} field={field} error={errors[field]} required={isRequired(field)}><PcnCatalogCombobox id={`pcn-operational-${kind.toLowerCase()}-${field}`} label={label} hideLabel required={isRequired(field)} value={String(form[field] ?? '')} options={options} onChange={(value) => setField(field, value)} disabled={!canEdit || isSaving} /></FormField>;
  };
  const number = (field: string) => <FormField label={FIELD_LABELS[field] || field} field={field} error={errors[field]} required={isRequired(field)}><input type="number" min="0" required={isRequired(field)} aria-required={isRequired(field) || undefined} value={String(form[field] ?? '')} onChange={(event) => setField(field, event.target.value === '' ? '' : Number(event.target.value))} disabled={!canEdit || isSaving} className={controlClass} /></FormField>;

  const renderField = (field: string): React.ReactNode => {
    if (DATE_FIELDS.has(field)) return date(field);
    if (NUMBER_FIELDS.has(field)) return number(field);
    if (ARRAY_FIELDS.has(field)) return array(field);
    if (USER_FIELDS.has(field)) return user(field);
    return text(field, { wide: WIDE_FIELDS.has(field), multiline: MULTILINE_FIELDS.has(field) });
  };
  const fields = getPcnOperationalFormFieldOrder(kind).map((field) => <React.Fragment key={field}>{renderField(field)}</React.Fragment>);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;
    const nextValue = { ...form, savedAt: new Date().toISOString(), savedByUsername: currentUser?.username || '' };
    const nextErrors = validatePcnOperationalForm(kind, nextValue);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setIsSaving(true);
    try {
      const normalized = mergePcnOperationalForm(undefined, kind, nextValue);
      const key = Object.keys(normalized)[0] as keyof PcnOperationalForms;
      const saved = normalized[key];
      if (saved) await onSave(saved as PcnOperationalFormValue);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pcn-operational-form-title">
    <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><FileText size={17} /></span><div className="min-w-0"><h2 id="pcn-operational-form-title" className="text-sm font-black text-slate-900">{PCN_OPERATIONAL_FORM_LABELS[kind]}</h2><p className="mt-1 text-[10px] leading-4 text-slate-500">{FORM_DESCRIPTIONS[kind]}</p></div></div>
        <button type="button" onClick={onClose} aria-label="Đóng form nghiệp vụ" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
      </header>
      <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto">
          {kind === 'SAMPLE_CODING' && sampleLots.length > 0 && <div className="mx-4 mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[10px] text-indigo-800"><b>Lô mẫu trong hồ sơ:</b> {sampleLots.map((lot) => `${lot.lotCode} · ${lot.sampleName}`).join(' • ')}<p className="mt-1 text-[9px]">Mã lô, mã mẫu vật lý và mã tem niêm phong được quản lý thành ba trường riêng.</p></div>}
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">{fields}</div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3"><span className="text-[9px] text-slate-500">Các trường có lỗi sẽ được đánh dấu ngay tại form.</span><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-100">Hủy</button><button type="submit" disabled={!canEdit || isSaving} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><Save size={13} />{isSaving ? 'Đang lưu…' : 'Lưu form vào hồ sơ'}</button></div></footer>
      </form>
    </div>
  </div>;
}

export default PcnOperationalFormModal;
