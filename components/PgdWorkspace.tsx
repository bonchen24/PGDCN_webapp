'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  FlaskConical,
  LockKeyhole,
  Menu,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import type { CustomerRef, PcnUserAccount } from '../types';
import { clearPcnSession, getPcnSession } from '../utils/pcnAuthApi';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import {
  DEFAULT_PGD_CATALOG,
  PGD_DOMAIN,
  PGD_WORKFLOW_STATES,
  getPgdStatusLabel,
  snapshotPgdResultTemplate,
  type PgdCatalogItem,
  type PgdInspectionRequest,
  type PgdInspectionRequestInput,
  type PgdInspectionReport,
  type PgdResultTemplate,
  type PgdInspectionStatus,
  type PgdTransitionContext,
} from '../utils/pgdDomain';
import {
  PGD_OPERATIONAL_STATIONS,
  buildPgdFieldInspection,
  buildPgdResultValues,
  getPgdOperationalStation,
  getPgdOperationalStepAccess,
  getPgdOperationalStepGateDenial,
  validatePgdResultValues,
  type PgdOperationalStationKey,
} from '../utils/pgdWorkflow';
import { usePgdStore } from '../store-pgd';
import PgdLoginScreen from './PgdLoginScreen';
import PgdSidebar, { PGD_SECTION_LABELS, type PgdSection } from './PgdSidebar';
import { PgdTemplateSettingsWorkspace, PgdTemplateWorkspace } from './PgdDocumentGenerationPanel';

type IntakeForm = {
  requestCode: string;
  intakeChannel: PgdInspectionRequestInput['intakeChannel'];
  customerName: string;
  customerAddress: string;
  customerTaxId: string;
  customerContact: string;
  customerPhone: string;
  customerEmail: string;
  productGroup: PgdInspectionRequestInput['productGroup'];
  catalogItemId: string;
  productName: string;
  productCode: string;
  brand: string;
  grade: string;
  dimensions: string;
  productStandard: string;
  origin: string;
  manufacturer: string;
  importer: string;
  customsDocuments: string;
  lotCode: string;
  quantity: string;
  unit: string;
  weight: string;
  weightUnit: string;
  inspectionScope: string;
  inspectionLocation: string;
  inspectionScheduledAt: string;
  standards: string;
  method: string;
  note: string;
};

const initialIntake: IntakeForm = {
  requestCode: '',
  intakeChannel: 'DIRECT',
  customerName: '',
  customerAddress: '',
  customerTaxId: '',
  customerContact: '',
  customerPhone: '',
  customerEmail: '',
  productGroup: 'STEEL_METAL',
  catalogItemId: '',
  productName: '',
  productCode: '',
  brand: '',
  grade: '',
  dimensions: '',
  productStandard: '',
  origin: '',
  manufacturer: '',
  importer: '',
  customsDocuments: '',
  lotCode: '',
  quantity: '1',
  unit: 'lô',
  weight: '',
  weightUnit: 'tấn',
  inspectionScope: '',
  inspectionLocation: '',
  inspectionScheduledAt: '',
  standards: '',
  method: '',
  note: '',
};

function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function formatDate(value?: string): string {
  if (!value) return 'Chưa đặt';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'block md:col-span-2' : 'block'}><span className="mb-1 block text-[10px] font-black text-slate-500">{label}</span>{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${props.className || ''}`} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${props.className || ''}`} />;
}

function StatusBadge({ status }: { status: PgdInspectionStatus }) {
  const tone = status === 'SIGNED' || status === 'RESULT_RETURNED' || status === 'ARCHIVED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'REJECTED' || status === 'CANCELLED'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-black ${tone}`}>{getPgdStatusLabel(status)}</span>;
}

function Metric({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div></div>;
}

function PgdWorkflowMap({ status, evidence }: { status: PgdInspectionStatus; evidence: PgdTransitionContext }) {
  const currentStation = getPgdOperationalStation(status);
  return <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Bản đồ 5 trạm hồ sơ PGD">
    <div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><ClipboardList size={15} className="text-blue-600" /> Bản đồ thao tác PGD</h3><p className="mt-1 text-[10px] text-slate-500">Học theo workflow PCN: trạm sau chỉ mở khi trạm hiện tại có đủ bằng chứng.</p></div><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">Trạm {currentStation.number}/5</span></div>
    <div className="grid gap-1.5 md:grid-cols-5">{PGD_OPERATIONAL_STATIONS.map((station) => {
      const access = getPgdOperationalStepAccess({ status, targetStationKey: station.key });
      const active = station.key === currentStation.key;
      const complete = station.number < currentStation.number;
      return <div key={station.key} aria-current={active ? 'step' : undefined} className={`rounded-lg border px-2 py-2 ${active ? 'border-blue-300 bg-blue-50' : complete ? 'border-emerald-200 bg-emerald-50/60' : access.locked ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}><div className="flex items-center gap-1.5"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${active ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-400'}`}>{complete ? '✓' : station.number}</span><span className={`text-[10px] font-black ${active ? 'text-blue-800' : complete ? 'text-emerald-800' : 'text-slate-500'}`}>{station.title}</span></div><p className="mt-1 text-[9px] leading-3 text-slate-500">{station.description}</p>{active && <div className="mt-1 text-[9px] font-bold text-blue-700">{getPgdStatusLabel(status)}</div>}{access.requiresWithdrawal && <div className="mt-1 text-[9px] font-bold text-amber-700">Đã khóa sau ký</div>}</div>;
    })}</div>
  </section>;
}

function PgdIntakeForm({
  catalog,
  customers,
  currentUser,
  canMutate,
  onCreated,
}: {
  catalog: PgdCatalogItem[];
  customers: CustomerRef[];
  currentUser: PcnUserAccount;
  canMutate: boolean;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<IntakeForm>(() => ({ ...initialIntake, requestCode: `PYC-GD-${new Date().getFullYear()}-`, standards: catalog[0]?.defaultStandards.join(', ') || '' }));
  const [saving, setSaving] = useState(false);
  const createRequest = usePgdStore((state) => state.createRequest);
  const selectedCatalog = catalog.find((item) => item.id === form.catalogItemId) || catalog[0] || DEFAULT_PGD_CATALOG[0];

  useEffect(() => {
    if (!form.catalogItemId && selectedCatalog) {
      setForm((current) => ({ ...current, catalogItemId: selectedCatalog.id, productGroup: selectedCatalog.productGroup, standards: current.standards || selectedCatalog.defaultStandards.join(', ') }));
    }
  }, [form.catalogItemId, selectedCatalog]);

  const update = <K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chooseCustomer = (customerCode: string) => {
    const customer = customers.find((item) => item.customerCode === customerCode);
    if (!customer) return;
    setForm((current) => ({ ...current, customerName: customer.name, customerAddress: customer.address, customerTaxId: customer.taxId || '', customerContact: customer.contactPerson || '', customerPhone: customer.phone || '', customerEmail: customer.email || '' }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const standards = form.standards.split(',').map((item) => item.trim()).filter(Boolean);
      const input: PgdInspectionRequestInput = {
        id: makeId('pgd-request'),
        requestCode: form.requestCode.trim() || makeId('PYC-GD'),
        intakeChannel: form.intakeChannel,
        requester: { name: currentUser.name, phone: currentUser.phone, email: currentUser.email },
        customerSnapshot: { name: form.customerName.trim(), address: form.customerAddress.trim(), taxId: form.customerTaxId.trim() || undefined, contactPerson: form.customerContact.trim() || undefined, phone: form.customerPhone.trim() || undefined, email: form.customerEmail.trim() || undefined },
        productGroup: form.productGroup,
        catalogItemId: form.catalogItemId || selectedCatalog.id,
        productName: form.productName.trim(),
        productCode: form.productCode.trim() || undefined,
        brand: form.brand.trim() || undefined,
        productDetails: {
          grade: form.grade.trim() || undefined,
          dimensions: form.dimensions.trim() || undefined,
          productStandard: form.productStandard.trim() || undefined,
          origin: form.origin.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          importer: form.importer.trim() || undefined,
          customsDocuments: form.customsDocuments.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => ({ document: line })),
        },
        lotCode: form.lotCode.trim() || undefined,
        quantity: Number(form.quantity),
        unit: form.unit.trim() || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        weightUnit: form.weightUnit.trim() || undefined,
        inspectionScope: form.inspectionScope.trim(),
        inspectionLocation: form.inspectionLocation.trim(),
        inspectionScheduledAt: form.inspectionScheduledAt ? new Date(form.inspectionScheduledAt).toISOString() : undefined,
        standards,
        method: form.method.trim() || undefined,
        note: form.note.trim() || undefined,
      };
      const request = await createRequest(input);
      toast.success(`Đã tạo PYC ${request.requestCode} ở trạng thái Bản nháp.`);
      onCreated(request.id);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo PYC giám định.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-3 p-3 md:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Tiếp nhận yêu cầu mới</div><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Tạo PYC giám định</h1><p className="mt-1 text-[11px] text-slate-500">Ghi nhận đủ khách hàng, lô hàng, phạm vi, địa điểm và tiêu chuẩn trước khi xem xét năng lực.</p></div><span className="hidden rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[10px] font-bold text-blue-700 md:inline-flex">Hồ sơ mới · PGD</span></div>
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
      <section><h2 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><Building2 size={15} className="text-blue-600" /> Đơn vị yêu cầu / khách hàng</h2><div className="grid gap-2 md:grid-cols-3"><Field label="Mã PYC"><TextInput required value={form.requestCode} onChange={(event) => update('requestCode', event.target.value)} placeholder="PYC-GD-2026-001" /></Field><Field label="Kênh tiếp nhận"><SelectInput value={form.intakeChannel} onChange={(event) => update('intakeChannel', event.target.value as IntakeForm['intakeChannel'])}><option value="DIRECT">Trực tiếp</option><option value="PHONE">Điện thoại</option><option value="ONLINE_ZALO">Zalo / Online</option><option value="EMAIL">Email</option><option value="OTHER">Khác</option></SelectInput></Field><Field label="Chọn khách hàng dùng chung"><SelectInput value="" onChange={(event) => chooseCustomer(event.target.value)}><option value="">Nhập mới hoặc chọn danh mục...</option>{customers.map((customer) => <option key={customer.customerCode || customer.name} value={customer.customerCode || customer.name}>{customer.customerCode ? `${customer.customerCode} · ` : ''}{customer.name}</option>)}</SelectInput></Field><Field label="Tên đơn vị *"><TextInput required value={form.customerName} onChange={(event) => update('customerName', event.target.value)} /></Field><Field label="Địa chỉ *"><TextInput required value={form.customerAddress} onChange={(event) => update('customerAddress', event.target.value)} /></Field><Field label="Mã số thuế"><TextInput value={form.customerTaxId} onChange={(event) => update('customerTaxId', event.target.value)} /></Field><Field label="Người liên hệ"><TextInput value={form.customerContact} onChange={(event) => update('customerContact', event.target.value)} /></Field><Field label="Điện thoại"><TextInput value={form.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} /></Field><Field label="Email"><TextInput type="email" value={form.customerEmail} onChange={(event) => update('customerEmail', event.target.value)} /></Field></div></section>
      <section className="border-t border-slate-100 pt-4"><h2 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><PackageCheck size={15} className="text-blue-600" /> Hàng hóa / phạm vi giám định</h2><div className="grid gap-2 md:grid-cols-3"><Field label="Nhóm sản phẩm"><SelectInput value={form.productGroup} onChange={(event) => { const group = event.target.value as IntakeForm['productGroup']; const first = catalog.find((item) => item.productGroup === group); setForm((current) => ({ ...current, productGroup: group, catalogItemId: first?.id || current.catalogItemId, standards: first?.defaultStandards.join(', ') || current.standards })); }}><option value="STEEL_METAL">Thép / kim loại</option><option value="MACHINERY_LINE">Máy móc / dây chuyền</option><option value="COAL">Than</option><option value="OTHER">Khác</option></SelectInput></Field><Field label="Loại hình giám định"><SelectInput value={form.catalogItemId} onChange={(event) => { const item = catalog.find((candidate) => candidate.id === event.target.value); setForm((current) => ({ ...current, catalogItemId: event.target.value, productGroup: item?.productGroup || current.productGroup, standards: item?.defaultStandards.join(', ') || current.standards })); }}><option value="">Chọn loại hình...</option>{catalog.filter((item) => item.productGroup === form.productGroup || form.productGroup === 'OTHER').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectInput></Field><Field label="Tên hàng hóa / thiết bị *"><TextInput required value={form.productName} onChange={(event) => update('productName', event.target.value)} /></Field><Field label="Mã hàng / model"><TextInput value={form.productCode} onChange={(event) => update('productCode', event.target.value)} /></Field><Field label="Mác / nhãn hiệu"><TextInput value={form.brand} onChange={(event) => update('brand', event.target.value)} /></Field><Field label="Số lô / số nhận dạng"><TextInput value={form.lotCode} onChange={(event) => update('lotCode', event.target.value)} /></Field><Field label="Số lượng *"><TextInput required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></Field><Field label="Đơn vị"><TextInput value={form.unit} onChange={(event) => update('unit', event.target.value)} /></Field><Field label="Khối lượng"><TextInput type="number" min="0" step="0.001" value={form.weight} onChange={(event) => update('weight', event.target.value)} /></Field><Field label="Phạm vi yêu cầu *" wide><textarea required rows={2} value={form.inspectionScope} onChange={(event) => update('inspectionScope', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Ví dụ: kiểm tra nhận dạng, số lượng, kích thước, chất lượng theo hợp đồng..." /></Field><Field label="Tiêu chuẩn / phương pháp đối chiếu *" wide><TextInput required value={form.standards} onChange={(event) => update('standards', event.target.value)} placeholder="Phân tách bằng dấu phẩy" /></Field><Field label="Phương thức / ghi chú kỹ thuật"><TextInput value={form.method} onChange={(event) => update('method', event.target.value)} /></Field><Field label="Lịch dự kiến"><TextInput type="datetime-local" value={form.inspectionScheduledAt} onChange={(event) => update('inspectionScheduledAt', event.target.value)} /></Field><Field label="Địa điểm giám định *" wide><TextInput required value={form.inspectionLocation} onChange={(event) => update('inspectionLocation', event.target.value)} placeholder="Kho, cảng, nhà máy hoặc địa điểm kiểm tra" /></Field><Field label="Ghi chú tiếp nhận" wide><textarea rows={2} value={form.note} onChange={(event) => update('note', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field></div></section>
      <section className="border-t border-slate-100 pt-4"><h2 className="mb-2 text-xs font-black text-slate-800">Thông tin lô / sản phẩm và chứng từ</h2><div className="grid gap-2 md:grid-cols-3"><Field label="Mác / cấp sản phẩm"><TextInput value={form.grade} onChange={(event) => update('grade', event.target.value)} placeholder="Ví dụ: SUS304, Q235..." /></Field><Field label="Kích thước / thông số"><TextInput value={form.dimensions} onChange={(event) => update('dimensions', event.target.value)} /></Field><Field label="Tiêu chuẩn sản phẩm công bố"><TextInput value={form.productStandard} onChange={(event) => update('productStandard', event.target.value)} /></Field><Field label="Xuất xứ"><TextInput value={form.origin} onChange={(event) => update('origin', event.target.value)} /></Field><Field label="Nhà sản xuất"><TextInput value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} /></Field><Field label="Nhà nhập khẩu"><TextInput value={form.importer} onChange={(event) => update('importer', event.target.value)} /></Field><Field label="Chứng từ hải quan / thương mại" wide><textarea rows={2} value={form.customsDocuments} onChange={(event) => update('customsDocuments', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Mỗi dòng một chứng từ: tờ khai, hợp đồng, invoice, packing list, B/L..." /></Field></div></section>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-[10px] text-slate-400">{canMutate ? 'PYC được tạo ở Bản nháp; thanh toán chỉ theo dõi, không chặn trả kết quả.' : 'Tài khoản chỉ đọc: không được tạo hoặc sửa hồ sơ PGD.'}</p><button type="submit" disabled={saving || !canMutate} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[11px] font-black text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={15} />{saving ? 'Đang tạo PYC...' : 'Tạo PYC & mở hồ sơ'}</button></div>
    </form>
  </div>;
}

function RequestCard({ request, onOpen }: { request: import('../utils/pgdDomain').PgdInspectionRequest; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-black text-slate-900">{request.requestCode}</span><StatusBadge status={request.status} /></div><h3 className="mt-2 truncate text-sm font-black text-slate-800">{request.productName}</h3><p className="mt-1 truncate text-[10px] text-slate-500">{request.customerSnapshot.name} · {request.inspectionLocation}</p></div><ArrowRight size={16} className="shrink-0 text-slate-300" /></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-[9px]"><span><b className="block text-slate-400">Lô / nhận dạng</b><span className="font-bold text-slate-700">{request.lotCode || 'Chưa có'}</span></span><span><b className="block text-slate-400">Số lượng</b><span className="font-bold text-slate-700">{request.quantity} {request.unit || ''}</span></span><span><b className="block text-slate-400">Cập nhật</b><span className="font-bold text-slate-700">{formatDate(request.updatedAt)}</span></span></div></button>;
}

function PgdRequestDetail({ request, currentUser, onClose }: { request: import('../utils/pgdDomain').PgdInspectionRequest; currentUser: PcnUserAccount; onClose: () => void }) {
  const pgd = usePgdStore();
  const [inspectorInput, setInspectorInput] = useState(currentUser.username);
  const [reviewerInput, setReviewerInput] = useState('');
  const [fieldForm, setFieldForm] = useState({
    lotObservation: 'Đã kiểm tra nhận dạng theo PYC.',
    packaging: 'Đã ghi nhận tại hiện trường.',
    labeling: request.lotCode ? `Số lô: ${request.lotCode}` : '',
    measurements: '',
    nonconformities: 'Không có',
    note: 'Biên bản hiện trường được ghi nhận trên hồ sơ PGD.',
  });
  const [sampleQuantity, setSampleQuantity] = useState('2');
  const [sampleDescription, setSampleDescription] = useState(request.productName);
  const [labName, setLabName] = useState('PTN nội bộ TVCI');
  const [labItems, setLabItems] = useState('Nhận dạng, kích thước, chỉ tiêu theo PYC');
  const [labReportNumber, setLabReportNumber] = useState('');
  const [labConclusion, setLabConclusion] = useState('Đạt theo phạm vi kết quả được tiếp nhận');
  const [certificateConclusion, setCertificateConclusion] = useState('Kết quả giám định phù hợp với phạm vi và tiêu chuẩn đã thống nhất.');
  const [reportInputs, setReportInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const fieldInspection = pgd.fieldInspections.find((item) => item.requestId === request.id);
  const samples = pgd.samples.filter((item) => item.requestId === request.id);
  const labRequests = pgd.labRequests.filter((item) => item.requestId === request.id);
  const labResults = pgd.labResults.filter((item) => item.requestId === request.id);
  const report = pgd.reports.find((item) => item.requestId === request.id);
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const template = pgd.templates.find((item) => item.productGroup === request.productGroup && item.active) || pgd.templates.find((item) => item.active);
  useEffect(() => {
    if (!fieldInspection) return;
    setFieldForm({
      lotObservation: fieldInspection.lotObservation || '',
      packaging: fieldInspection.packaging || '',
      labeling: fieldInspection.labeling || '',
      measurements: Object.entries(fieldInspection.measurements || {}).map(([key, value]) => `${key}: ${value}`).join('\n'),
      nonconformities: (fieldInspection.nonconformities || []).join('\n'),
      note: fieldInspection.note || '',
    });
  }, [fieldInspection?.id]);
  useEffect(() => {
    if (!template) return;
    setReportInputs((current) => {
      const next = { ...current };
      for (const field of template.fields) {
        if (next[field.key] !== undefined) continue;
        const key = `${field.key} ${field.label}`.toLowerCase();
        if (key.includes('conclusion') || key.includes('kết luận')) next[field.key] = certificateConclusion;
        else if (key.includes('quantity') || key.includes('weight') || key.includes('khối')) next[field.key] = String(request.weight ?? request.quantity);
        else if (key.includes('standard') || key.includes('tiêu chuẩn')) next[field.key] = request.standards.join(', ');
        else if (key.includes('lot') || key.includes('lô')) next[field.key] = request.lotCode || '';
        else next[field.key] = '';
      }
      return next;
    });
  }, [template?.id, request.id, request.quantity, request.weight, request.lotCode, request.standards, certificateConclusion, template]);
  const canMutate = currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer';
  const isManager = currentUser.systemRole === 'admin' || currentUser.role === 'admin' || currentUser.pgdRole === 'PGD_ADMIN' || currentUser.pgdRole === 'PGD_MANAGER';
  const pgdUsers = pgd.users.filter((user) => user.active !== false && user.departmentScopes?.includes('PGD') && user.pgdRole !== 'PGD_VIEWER');
  const reviewerCandidates = pgdUsers.filter((user) => ['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL'].includes(user.pgdRole || ''));

  const context: PgdTransitionContext = {
    hasApprovedAssignment: assignment?.status === 'APPROVED',
    hasFieldInspection: fieldInspection?.completed === true,
    hasSampleHandover: samples.some((sample) => sample.disposition === 'LAB' && Boolean(sample.handedOverAt)),
    labRequests,
    reportReady: Boolean(report?.conclusion?.trim()),
    hasCertificate: Boolean(certificate),
    signed: certificate?.status === 'SIGNED',
  };
  const stepAccess = (targetStationKey: PgdOperationalStationKey) => getPgdOperationalStepAccess({ status: request.status, targetStationKey });
  const assignmentAccess = stepAccess(request.status === 'CAPABILITY_REVIEW' ? 'INTAKE_CAPABILITY' : 'PREPARATION');
  const fieldAccess = stepAccess('FIELD_SAMPLING');
  const labAccess = stepAccess('LAB_RESULTS');
  const reportAccess = stepAccess('REPORT_APPROVAL_RETURN');
  const reportValues = useMemo(() => {
    if (!template) return [];
    const conclusionField = template.fields.find((field) => `${field.key} ${field.label}`.toLowerCase().includes('conclusion') || `${field.key} ${field.label}`.toLowerCase().includes('kết luận'));
    return buildPgdResultValues(template, {
      ...reportInputs,
      ...(conclusionField ? { [conclusionField.key]: certificateConclusion } : {}),
    });
  }, [template, reportInputs, certificateConclusion]);
  const reportIssues = useMemo(() => template ? validatePgdResultValues(template, reportValues) : [], [template, reportValues]);
  const nextState = PGD_WORKFLOW_STATES.find((state) => state.order === PGD_WORKFLOW_STATES.find((candidate) => candidate.code === request.status)?.order! + 1)?.code;
  const nextDenial = nextState ? getPgdOperationalStepGateDenial({ currentStatus: request.status, nextStatus: nextState, evidence: context }) : null;

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try { await action(); toast.success(success); } catch (error: any) { toast.error(error?.message || 'Không thể cập nhật hồ sơ PGD.'); } finally { setBusy(false); }
  };

  const saveAssignment = () => run(async () => {
    const inspectorUsernames = inspectorInput.split(',').map((item) => item.trim()).filter(Boolean);
    const technicalReviewerUsername = reviewerInput.trim() || reviewerCandidates[0]?.username || (isManager ? currentUser.username : '');
    if (!technicalReviewerUsername) throw new Error('Cần chọn người soát xét kỹ thuật PGD từ danh mục nhân sự có scope PGD.');
    const now = new Date().toISOString();
    await pgd.saveAssignment({ id: assignment?.id || makeId('pgd-assignment'), domain: PGD_DOMAIN, requestId: request.id, leadInspectorUsername: inspectorUsernames[0], inspectorUsernames, technicalReviewerUsername, method: request.method, status: isManager ? 'APPROVED' : 'PENDING_APPROVAL', approvedByUsername: isManager ? currentUser.username : undefined, approvedAt: isManager ? now : undefined, createdAt: assignment?.createdAt || now, updatedAt: now });
  }, isManager ? 'Đã phê duyệt phân công PGD.' : 'Đã lưu phân công chờ phê duyệt.');

  const saveFieldInspection = () => run(async () => {
    const measurements = Object.fromEntries(fieldForm.measurements.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const separator = line.indexOf(':');
      return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ['Ghi nhận', line];
    }));
    const inspection = buildPgdFieldInspection({ id: fieldInspection?.id || makeId('pgd-field'), requestId: request.id, performedAt: fieldInspection?.performedAt || new Date().toISOString(), location: request.inspectionLocation, inspectorUsernames: assignment?.inspectorUsernames || [currentUser.username], lotObservation: fieldForm.lotObservation.trim(), packaging: fieldForm.packaging.trim(), labeling: fieldForm.labeling.trim() || undefined, measurements, nonconformities: fieldForm.nonconformities.split('\n'), sampleIds: request.sampleIds, note: fieldForm.note.trim() || undefined });
    await pgd.saveFieldInspection(inspection);
  }, 'Đã hoàn tất biên bản hiện trường.');

  const splitSample = () => run(async () => {
    await pgd.splitSample({ requestId: request.id, sampleCodePrefix: request.requestCode, description: sampleDescription, quantity: Number(sampleQuantity), unit: request.unit });
  }, 'Đã tách phần mẫu gửi PTN và mẫu lưu.');

  const createLabRequest = () => run(async () => {
    const sample = samples.find((item) => item.disposition === 'LAB' && !item.handedOverAt);
    if (!sample) throw new Error('Cần tách mẫu và còn phần mẫu PTN chưa bàn giao.');
    await pgd.saveLabRequest({ id: makeId('pgd-lab'), domain: PGD_DOMAIN, requestId: request.id, sampleId: sample.id, status: 'SENT', laboratoryName: labName.trim() || 'PTN nội bộ TVCI', testItems: labItems.split(',').map((item) => item.trim()).filter(Boolean), handover: { sentAt: new Date().toISOString(), senderUsername: currentUser.username, receiverName: labName.trim(), quantity: sample.quantity, note: `Bàn giao theo mã mẫu ${sample.sampleCode}` } });
  }, 'Đã lập và bàn giao yêu cầu PTN.');

  const saveLabResult = () => run(async () => {
    const labRequest = labRequests.find((item) => !item.resultId) || labRequests[0];
    if (!labRequest) throw new Error('Chưa có yêu cầu PTN để tiếp nhận kết quả.');
    await pgd.saveLabResult({ id: makeId('pgd-result'), domain: PGD_DOMAIN, requestId: request.id, labRequestId: labRequest.id, reportNumber: labReportNumber.trim() || undefined, receivedAt: new Date().toISOString(), values: [{ key: 'conclusion', label: 'Kết luận PTN', value: labConclusion, conclusion: labConclusion }] });
  }, 'Đã tiếp nhận kết quả PTN; hồ sơ sẽ cảnh báo nếu còn yêu cầu thiếu kết quả.');

  const saveCertificate = () => run(async () => {
    if (!template) throw new Error('Chưa có template kết quả phù hợp với loại hình giám định.');
    if (reportIssues.length > 0) throw new Error(`Chưa thể lập báo cáo: ${reportIssues.map((issue) => issue.message).join(' ')}`);
    const templateSnapshot = snapshotPgdResultTemplate(template);
    const now = new Date().toISOString();
    const conclusion = certificateConclusion.trim();
    const reportRecord: PgdInspectionReport = { id: report?.id || makeId('pgd-report'), domain: PGD_DOMAIN, requestId: request.id, reportNumber: report?.reportNumber, title: `Báo cáo giám định · ${request.productName}`, standardSnapshot: [...request.standards], templateSnapshot, values: reportValues, conclusion, status: report?.status === 'APPROVED' ? 'APPROVED' : 'DRAFT', createdAt: report?.createdAt || now, updatedAt: now };
    await pgd.saveReport(reportRecord);
    await pgd.saveCertificate({ id: certificate?.id || makeId('pgd-certificate'), domain: PGD_DOMAIN, requestId: request.id, documentNumber: certificate?.documentNumber, title: `Chứng thư giám định · ${request.productName}`, standardSnapshot: [...request.standards], conclusion, templateSnapshot, status: certificate?.status === 'SIGNED' ? 'SIGNED' : 'DRAFT', signedByUsername: certificate?.signedByUsername, signedAt: certificate?.signedAt, createdAt: certificate?.createdAt || now, updatedAt: now });
  }, 'Đã lưu dự thảo chứng thư và snapshot template.');

  const advance = () => {
    if (!nextState) return;
    void run(async () => { await pgd.transitionRequest(request.id, nextState, context); }, `Đã chuyển hồ sơ sang ${getPgdStatusLabel(nextState)}.`);
  };

  const approve = () => {
    const role = request.status === 'TECHNICAL_REVIEW' ? 'TECHNICAL_REVIEW' : request.status === 'LEADERSHIP_APPROVAL' ? 'LEADERSHIP_APPROVAL' : null;
    if (!role) return;
    void run(async () => { await pgd.approveStep({ id: makeId('pgd-approval'), domain: PGD_DOMAIN, requestId: request.id, sequence: role === 'TECHNICAL_REVIEW' ? 1 : 2, role, status: 'PENDING', actedByUsername: currentUser.username, comment: role === 'TECHNICAL_REVIEW' ? 'Đã duyệt kỹ thuật.' : 'Đã duyệt lãnh đạo.' }); }, role === 'TECHNICAL_REVIEW' ? 'Đã duyệt kỹ thuật PGD.' : 'Đã ký chứng thư PGD.');
  };

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm md:items-center md:p-4" role="dialog" aria-modal="true" aria-label={`Chi tiết hồ sơ ${request.requestCode}`}><div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-slate-50 shadow-2xl md:max-h-[92dvh] md:rounded-2xl"><header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-slate-900">{request.requestCode}</span><StatusBadge status={request.status} /><span className="text-[10px] text-slate-400">Cập nhật {formatDate(request.updatedAt)}</span></div><h2 className="mt-1 truncate text-base font-black text-slate-800">{request.productName} · {request.customerSnapshot.name}</h2></div><button type="button" onClick={onClose} aria-label="Đóng chi tiết hồ sơ PGD" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></header>
    <div className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto p-3 md:p-5"><PgdWorkflowMap status={request.status} evidence={context} /><div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"><main className="space-y-3"><section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Khách hàng</div><div className="mt-1 text-xs font-black text-slate-800">{request.customerSnapshot.name}</div><div className="mt-1 text-[10px] text-slate-500">{request.customerSnapshot.address}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Lô / số lượng</div><div className="mt-1 text-xs font-black text-slate-800">{request.lotCode || 'Chưa ghi nhận'}</div><div className="mt-1 text-[10px] text-slate-500">{request.quantity} {request.unit || ''} {request.weight ? `· ${request.weight} ${request.weightUnit || ''}` : ''}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Phạm vi</div><div className="mt-1 line-clamp-3 text-[10px] font-bold text-slate-700">{request.inspectionScope}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Thanh toán</div><div className="mt-1 text-xs font-black text-emerald-700">{request.payment.status}</div><div className="mt-1 text-[10px] text-slate-500">Theo dõi riêng, không khóa trả kết quả</div></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><Users size={15} className="text-blue-600" /> Phân công theo năng lực</h3><div className="mt-2 grid gap-2 md:grid-cols-3"><Field label="KTV / chuyên gia"><TextInput list="pgd-inspectors" value={inspectorInput} onChange={(event) => setInspectorInput(event.target.value)} placeholder="username, username..." /><datalist id="pgd-inspectors">{pgdUsers.map((user) => <option key={user.username} value={user.username}>{user.name} · {user.pgdRole}</option>)}</datalist></Field><Field label="Người soát xét kỹ thuật"><TextInput list="pgd-reviewers" value={reviewerInput} onChange={(event) => setReviewerInput(event.target.value)} placeholder={reviewerCandidates[0]?.username || 'username'} /><datalist id="pgd-reviewers">{reviewerCandidates.map((user) => <option key={user.username} value={user.username}>{user.name} · {user.pgdRole}</option>)}</datalist></Field><div className="flex items-end"><button type="button" disabled={!canMutate || busy || !assignmentAccess.editable} onClick={saveAssignment} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-black text-blue-700 disabled:opacity-50"><ShieldCheck size={14} />{assignment?.status === 'APPROVED' ? 'Cập nhật phân công' : 'Lưu phân công'}</button></div></div>{assignment && <p className="mt-2 text-[10px] text-slate-500">Trạng thái: <b className="text-slate-700">{assignment.status}</b> · KTV: {assignment.inspectorUsernames.join(', ') || 'Chưa chọn'} · Soát xét: {assignment.technicalReviewerUsername || 'Chưa chọn'}</p>}{!assignmentAccess.editable && <p className="mt-2 text-[9px] font-bold text-amber-700">{assignmentAccess.reason}</p>}</section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><ClipboardCheck size={15} className="text-blue-600" /> Hiện trường, lấy mẫu và bàn giao PTN</h3><div className="mt-2 grid gap-2 md:grid-cols-3"><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Biên bản hiện trường</div><div className="mt-1 text-[9px] text-slate-500">{fieldInspection ? `Hoàn tất lúc ${formatDate(fieldInspection.performedAt)}` : 'Chưa hoàn tất'}</div><div className="mt-2 grid gap-1"><TextInput aria-label="Ghi nhận lô hàng" value={fieldForm.lotObservation} onChange={(event) => setFieldForm((current) => ({ ...current, lotObservation: event.target.value }))} placeholder="Nhận dạng / tình trạng lô" /><TextInput aria-label="Bao gói" value={fieldForm.packaging} onChange={(event) => setFieldForm((current) => ({ ...current, packaging: event.target.value }))} placeholder="Bao gói" /><TextInput aria-label="Nhãn hàng hóa" value={fieldForm.labeling} onChange={(event) => setFieldForm((current) => ({ ...current, labeling: event.target.value }))} placeholder="Nhãn / số lô" /><textarea aria-label="Kích thước và đo đạc" rows={2} value={fieldForm.measurements} onChange={(event) => setFieldForm((current) => ({ ...current, measurements: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" placeholder="Đo đạc (mỗi dòng: chỉ tiêu: giá trị)" /><textarea aria-label="Điểm không phù hợp" rows={2} value={fieldForm.nonconformities} onChange={(event) => setFieldForm((current) => ({ ...current, nonconformities: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" placeholder="Điểm không phù hợp, mỗi dòng một ý" /></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable} onClick={saveFieldInspection} className="mt-2 min-h-10 w-full rounded-lg bg-blue-600 px-2 text-[10px] font-black text-white disabled:opacity-50">{fieldInspection ? 'Ghi nhận lại biên bản' : 'Hoàn tất hiện trường'}</button></div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Tách mẫu</div><div className="mt-1 flex gap-1"><TextInput type="number" min="2" step="1" value={sampleQuantity} onChange={(event) => setSampleQuantity(event.target.value)} /><TextInput value={sampleDescription} onChange={(event) => setSampleDescription(event.target.value)} /></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable} onClick={splitSample} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">Tách phần PTN + mẫu lưu</button><p className="mt-1 text-[9px] text-slate-400">{samples.length ? `${samples.length} phần mẫu đã tạo` : 'Chưa có mẫu'}</p></div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Yêu cầu PTN</div><div className="mt-1 grid gap-1"><TextInput value={labName} onChange={(event) => setLabName(event.target.value)} placeholder="Tên PTN" /><TextInput value={labItems} onChange={(event) => setLabItems(event.target.value)} placeholder="Hạng mục, ..." /></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable} onClick={createLabRequest} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">Giao mẫu & lập PYC PTN</button><p className="mt-1 text-[9px] text-slate-400">{labRequests.length} PYC · {labResults.length} KQTN</p></div></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><FlaskConical size={15} className="text-blue-600" /> Kết quả PTN và báo cáo / chứng thư linh hoạt</h3><div className="mt-2 grid gap-2 md:grid-cols-2"><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Tiếp nhận KQTN</div><div className="mt-2 grid gap-1"><TextInput value={labReportNumber} onChange={(event) => setLabReportNumber(event.target.value)} placeholder="Số báo cáo PTN" /><textarea rows={2} value={labConclusion} onChange={(event) => setLabConclusion(event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /></div><button type="button" disabled={!canMutate || busy || !labAccess.editable || labRequests.length === 0} onClick={saveLabResult} className="mt-2 min-h-10 w-full rounded-lg bg-blue-600 px-2 text-[10px] font-black text-white disabled:opacity-50">Ghi nhận kết quả</button>{labRequests.some((item) => !item.resultId) && <p className="mt-1 text-[9px] font-bold text-amber-700">Cảnh báo: còn PYC PTN chưa có kết quả.</p>}</div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Báo cáo / chứng thư</div><p className="mt-1 text-[9px] text-slate-500">{template ? `Template ${template.code || template.id} · phiên bản ${template.version}` : 'Chưa có template'}{report ? ` · báo cáo ${report.status}` : ''}</p><div className="mt-2 grid gap-1.5">{template?.fields.map((field) => { const fieldDescriptor = `${field.key} ${field.label}`.toLowerCase(); const isConclusion = fieldDescriptor.includes('conclusion') || fieldDescriptor.includes('kết luận'); const value = isConclusion ? certificateConclusion : reportInputs[field.key] || ''; const updateValue = (nextValue: string) => { if (isConclusion) setCertificateConclusion(nextValue); else setReportInputs((current) => ({ ...current, [field.key]: nextValue })); }; return <label key={field.key} className="block"><span className="mb-1 block text-[9px] font-black text-slate-500">{field.label}{field.required ? ' *' : ''}{field.unit ? ` · ${field.unit}` : ''}</span>{field.type === 'TABLE' ? <textarea rows={2} value={value} onChange={(event) => updateValue(event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /> : field.type === 'BOOLEAN' ? <SelectInput value={value} onChange={(event) => updateValue(event.target.value)}><option value="">Chọn...</option><option value="true">Có</option><option value="false">Không</option></SelectInput> : <TextInput type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'} value={value} onChange={(event) => updateValue(event.target.value)} />}</label>; })}</div>{reportIssues.length > 0 && <p role="alert" className="mt-2 text-[9px] font-bold text-amber-700">Còn {reportIssues.length} trường cần xử lý trước khi lập báo cáo.</p>}<button type="button" disabled={!canMutate || busy || !reportAccess.editable || labResults.length === 0 || reportIssues.length > 0 || certificate?.status === 'SIGNED'} onClick={saveCertificate} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">{certificate ? 'Cập nhật dự thảo chứng thư' : 'Tạo báo cáo + dự thảo chứng thư'}</button>{report && <p className="mt-1 text-[9px] font-bold text-blue-700">Báo cáo đã snapshot {report.standardSnapshot.length} tiêu chuẩn; {report.values.length} trường template.</p>}{certificate && <p className="mt-1 text-[9px] font-bold text-emerald-700">Đã snapshot template lúc {formatDate(certificate.templateSnapshot?.capturedAt)} · {certificate.status}</p>}</div></div></section>
    </main><aside className="space-y-3"><section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="text-xs font-black text-slate-800">Lifecycle PGD</h3><div className="mt-3 space-y-1.5">{PGD_WORKFLOW_STATES.map((state) => <div key={state.code} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${state.code === request.status ? 'bg-blue-50 text-blue-700' : state.order < (PGD_WORKFLOW_STATES.find((item) => item.code === request.status)?.order ?? 0) ? 'text-emerald-600' : 'text-slate-400'}`}><span className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-black">{state.order < (PGD_WORKFLOW_STATES.find((item) => item.code === request.status)?.order ?? 0) ? '✓' : state.order + 1}</span><span className="text-[10px] font-bold">{state.label}</span></div>)}</div></section><section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><h3 className="flex items-center gap-2 text-xs font-black text-blue-900"><LockKeyhole size={14} /> Cổng tiếp theo</h3>{request.status === 'TECHNICAL_REVIEW' || request.status === 'LEADERSHIP_APPROVAL' ? <><p className="mt-2 text-[10px] leading-4 text-blue-800">Bước này cần phê duyệt đúng vai trò, không chuyển trạng thái trực tiếp.</p><button type="button" disabled={!canMutate || busy} onClick={approve} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50"><BadgeCheck size={14} />{request.status === 'TECHNICAL_REVIEW' ? 'Duyệt kỹ thuật' : 'Duyệt lãnh đạo & ký'}</button></> : nextState ? <><p className={`mt-2 text-[10px] leading-4 ${nextDenial ? 'text-amber-800' : 'text-blue-800'}`}>{nextDenial || `Có thể chuyển sang: ${getPgdStatusLabel(nextState)}.`}</p><button type="button" disabled={!canMutate || busy || Boolean(nextDenial)} onClick={advance} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight size={14} /> Chuyển bước</button></> : <p className="mt-2 text-[10px] text-emerald-700">Hồ sơ đã ở cuối lifecycle.</p>}</section><section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="text-xs font-black text-slate-800">Tài liệu & truy vết</h3><div className="mt-2 space-y-1.5 text-[10px] text-slate-500"><div className="flex justify-between"><span>Mẫu</span><b className="text-slate-700">{samples.length}</b></div><div className="flex justify-between"><span>PYC PTN</span><b className="text-slate-700">{labRequests.length}</b></div><div className="flex justify-between"><span>Kết quả</span><b className="text-slate-700">{labResults.length}</b></div><div className="flex justify-between"><span>Phê duyệt</span><b className="text-slate-700">{pgd.approvals.filter((item) => item.requestId === request.id).length}</b></div><div className="flex justify-between"><span>Chứng thư</span><b className="text-slate-700">{certificate ? certificate.status : 'Chưa tạo'}</b></div></div><p className="mt-3 border-t border-slate-100 pt-2 text-[9px] leading-4 text-slate-400">Hồ sơ mới được giữ nguyên snapshot tiêu chuẩn/template khi phát hành. Không có thao tác xóa cứng trong workspace.</p></section></aside></div></div><footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-[10px] text-slate-500 md:px-5"><span>Domain: <b className="font-mono text-blue-700">{PGD_DOMAIN}</b> · Người thao tác: {currentUser.username}</span><button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 hover:bg-slate-50">Đóng</button></footer></div></div>;
}

export type PgdWorkspaceProps = {
  embedded?: boolean;
  initialSection?: PgdSection;
  onActiveSectionChange?: (section: PgdSection) => void;
};

export default function PgdWorkspace({ embedded = false, initialSection = 'dashboard', onActiveSectionChange }: PgdWorkspaceProps = {}) {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pgd = usePgdStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<PgdSection>(initialSection);
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const hasPgdAccess = Boolean(currentUser && (currentUser.systemRole === 'admin' || currentUser.role === 'admin' || currentUser.departmentScopes?.includes('PGD')));

  useEffect(() => {
    let cancelled = false;
    getPcnSession().then((session) => { if (!cancelled) setCurrentUser(session?.user || null); }).catch(() => { if (!cancelled) setCurrentUser(null); }).finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, [setCurrentUser]);

  useEffect(() => { if (sessionChecked && currentUser && hasPgdAccess) void pgd.load().catch(() => undefined); }, [currentUser, hasPgdAccess, pgd.load, sessionChecked]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const openSection = (section: PgdSection) => {
    setActiveSection(section);
    setMobileOpen(false);
    onActiveSectionChange?.(section);
  };

  const visibleRequests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return pgd.requests;
    return pgd.requests.filter((request) => [request.requestCode, request.customerSnapshot.name, request.productName, request.lotCode, request.inspectionLocation].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized));
  }, [pgd.requests, query]);

  if (!sessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-xs font-bold text-slate-300">Đang xác thực phiên làm việc...</div>;
  if (!currentUser) return <PgdLoginScreen />;

  const hasAccess = hasPgdAccess;
  if (!hasAccess) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4"><div className="max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-center shadow-2xl"><ShieldCheck className="mx-auto text-amber-400" size={28} /><h1 className="mt-3 text-lg font-black text-white">Chưa được cấp phạm vi PGD</h1><p className="mt-2 text-xs leading-5 text-slate-400">Tài khoản này chỉ có quyền PCN. Hãy nhờ quản trị Phòng Giám định - Chứng nhận cấp scope PGD; dữ liệu PCN vẫn được bảo vệ riêng.</p><button type="button" onClick={async () => { await clearPcnSession().catch(() => undefined); clearCurrentUser(); }} className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 text-xs font-black text-white">Đăng xuất</button></div></div>;

  const isAdmin = currentUser.systemRole === 'admin' || currentUser.role === 'admin' || currentUser.pgdRole === 'PGD_ADMIN' || currentUser.pgdRole === 'PGD_MANAGER';
  const canMutate = currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer';
  const selectedRequest = pgd.requests.find((request) => request.id === selectedRequestId);
  const openRequest = (id: string) => { setSelectedRequestId(id); openSection('requests'); };
  const logout = async () => { await clearPcnSession().catch(() => undefined); pgd.reset(); clearCurrentUser(); };
  const createDone = (id: string) => { setSelectedRequestId(id); openSection('requests'); };
  const sectionRequests = activeSection === 'requests' ? visibleRequests : pgd.requests;
  const statusCount = (status: PgdInspectionStatus) => pgd.requests.filter((request) => request.status === status).length;

  const dashboard = <div className="space-y-4 p-3 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Phòng Giám định - Chứng nhận</div><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Tổng quan hoạt động giám định</h1><p className="mt-1 text-[11px] text-slate-500">Từ PYC, năng lực, hiện trường, PTN đến phê duyệt và trả chứng thư.</p></div><button type="button" disabled={!canMutate} onClick={() => setActiveSection('intake')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-[10px] font-black text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={15} /> Tiếp nhận PYC</button></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Tổng hồ sơ" value={pgd.requests.length} /><Metric label="Chờ năng lực" value={statusCount('CAPABILITY_REVIEW')} tone="text-amber-600" /><Metric label="Đang hiện trường" value={statusCount('FIELD_INSPECTION')} tone="text-blue-600" /><Metric label="Chờ KQTN" value={statusCount('WAITING_LAB_RESULTS')} tone="text-orange-600" /><Metric label="Chờ duyệt" value={statusCount('LEADERSHIP_APPROVAL')} tone="text-indigo-600" /><Metric label="Đã ký" value={statusCount('SIGNED')} tone="text-emerald-600" /><Metric label="Đã trả" value={statusCount('RESULT_RETURNED')} tone="text-teal-600" /><Metric label="Đã lưu" value={statusCount('ARCHIVED')} tone="text-slate-600" /></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-800">Hồ sơ gần đây</h2><p className="mt-0.5 text-[10px] text-slate-400">Mỗi thẻ dẫn về đúng một hồ sơ PGD.</p></div><button type="button" onClick={() => setActiveSection('requests')} className="text-[10px] font-black text-blue-600">Xem tất cả</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{pgd.requests.slice(0, 4).map((request) => <RequestCard key={request.id} request={request} onOpen={() => openRequest(request.id)} />)}{pgd.requests.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-[11px] text-slate-400">Chưa có PYC giám định. Bắt đầu từ Tiếp nhận PYC.</div>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-black text-slate-800"><ClipboardList size={16} className="text-blue-600" /> Catalog PGD</h2><div className="mt-3 space-y-2">{pgd.catalog.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black text-slate-800">{item.name}</div><div className="mt-1 font-mono text-[9px] text-blue-600">{item.code}</div></div><span className="rounded bg-white px-1.5 py-1 text-[9px] font-bold text-slate-500">{item.slaLabel}</span></div><div className="mt-2 flex flex-wrap gap-1">{item.defaultStandards.map((standard) => <span key={standard} className="rounded bg-white px-1.5 py-1 text-[9px] text-slate-500">{standard}</span>)}</div></div>)}{pgd.catalog.length === 0 && <p className="text-[10px] text-slate-400">Đang tải catalog PGD...</p>}</div></section></div></div>;

  const requestRegister = <div className="space-y-3 p-3 md:p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Hồ sơ</div><h1 className="mt-1 text-xl font-black text-slate-900">Hồ sơ đang xử lý</h1></div><div className="flex w-full gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-72"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><TextInput aria-label="Tìm hồ sơ PGD" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm PYC, khách hàng, lô..." className="pl-8" /></div><button type="button" onClick={() => void pgd.load(true)} title="Tải lại hồ sơ PGD" className="rounded-lg border border-slate-200 bg-white px-3 text-slate-500 hover:text-blue-600"><RefreshCw size={15} /></button></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{sectionRequests.map((request) => <RequestCard key={request.id} request={request} onOpen={() => openRequest(request.id)} />)}{sectionRequests.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-[11px] text-slate-400">Không có hồ sơ phù hợp.</div>}</div></div>;

  const customerProjection = <div className="space-y-3 p-3 md:p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Khách hàng dùng chung</div><h1 className="mt-1 text-xl font-black text-slate-900">Danh mục khách hàng</h1><p className="mt-1 text-[11px] text-slate-500">PGD dùng snapshot khách hàng khi tạo PYC; danh mục gốc được quản lý ở miền dùng chung.</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{pgd.customers.map((customer) => <article key={customer.customerCode || customer.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h2 className="text-xs font-black text-slate-800">{customer.name}</h2><p className="mt-1 text-[10px] text-slate-500">{customer.address || 'Chưa có địa chỉ'}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400"><span>{customer.customerCode || 'Chưa có mã'}</span>{customer.taxId && <span>MST {customer.taxId}</span>}{customer.phone && <span>{customer.phone}</span>}</div></article>)}{pgd.customers.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-[11px] text-slate-400">Chưa có khách hàng dùng chung.</div>}</div></div>;
  const userProjection = <div className="space-y-3 p-3 md:p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Nhân sự PGD</div><h1 className="mt-1 text-xl font-black text-slate-900">Danh mục người dùng PGD</h1><p className="mt-1 text-[11px] text-slate-500">Chỉ người dùng đang hoạt động và đã được cấp scope PGD được hiển thị trong ma trận phân công.</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{pgd.users.filter((user) => user.departmentScopes?.includes('PGD')).map((user) => <article key={user.username} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">{user.name}</h2><p className="mt-1 font-mono text-[9px] text-slate-500">{user.username}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{user.active ? 'Đang hoạt động' : 'Đã khóa'}</span></div><div className="mt-2 text-[10px] text-blue-700">{user.pgdRole || 'Chưa gán role PGD'}</div></article>)}{pgd.users.filter((user) => user.departmentScopes?.includes('PGD')).length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-[11px] text-slate-400">Chưa có nhân sự được cấp scope PGD.</div>}</div></div>;
  const operationProjection = <div className="space-y-3 p-3 md:p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">{PGD_SECTION_LABELS[activeSection]}</div><h1 className="mt-1 text-xl font-black text-slate-900">Theo dõi công việc theo trạm</h1><p className="mt-1 text-[11px] text-slate-500">Danh sách là projection đọc nhanh; mở card để thao tác trên hồ sơ chuẩn.</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{sectionRequests.map((request) => <RequestCard key={request.id} request={request} onOpen={() => openRequest(request.id)} />)}</div></div>;
  const projection = activeSection === 'customers' ? customerProjection : activeSection === 'users' ? userProjection : activeSection === 'settings' ? <PgdTemplateSettingsWorkspace templates={pgd.documentTemplates} canMutate={canMutate && isAdmin} /> : activeSection === 'templates' ? <PgdTemplateWorkspace templates={pgd.documentTemplates} documents={pgd.documents} canMutate={canMutate && isAdmin} onOpenSettings={() => openSection('settings')} /> : operationProjection;

  return <><div className={embedded ? 'min-w-0' : 'flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800'}><Toaster position="top-right" richColors />{!embedded && <PgdSidebar currentUser={currentUser} activeSection={activeSection} collapsed={collapsed} mobileOpen={mobileOpen} isAdmin={isAdmin} onToggle={() => setCollapsed((value) => !value)} onNavigate={openSection} onCloseMobile={() => setMobileOpen(false)} onLogout={logout} />}<div className={embedded ? 'min-w-0' : 'flex min-w-0 flex-1 flex-col'}>{!embedded && <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5"><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu PGD" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={18} /></button><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-wider text-blue-600">IEMM • TVCI · {PGD_SECTION_LABELS[activeSection]}</div><div className="truncate text-xs font-bold text-slate-600">Phòng Giám định - Chứng nhận · Dữ liệu PGD riêng</div></div></div><div className="hidden items-center gap-2 text-[10px] font-bold text-slate-400 sm:flex"><CheckCircle2 size={14} className="text-emerald-500" /> Tài khoản: {currentUser.username}</div></header>}<main className={embedded ? 'min-w-0' : 'mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto'}>{activeSection === 'intake' ? <PgdIntakeForm catalog={pgd.catalog} customers={pgd.customers} currentUser={currentUser} canMutate={canMutate} onCreated={createDone} /> : activeSection === 'dashboard' ? dashboard : activeSection === 'requests' ? requestRegister : projection}</main>{!embedded && <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white p-1.5 lg:hidden" aria-label="Menu PGD di động">{(['dashboard', 'intake', 'requests', 'field', 'labs', 'results'] as PgdSection[]).map((section) => <button type="button" key={section} onClick={() => openSection(section)} className={`min-h-11 min-w-[4.75rem] rounded-lg px-2 text-[9px] font-black ${activeSection === section ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>{PGD_SECTION_LABELS[section]}</button>)}</nav>}</div></div>{selectedRequest && <PgdRequestDetail request={selectedRequest} currentUser={currentUser} onClose={() => setSelectedRequestId(undefined)} />}</>;
}
