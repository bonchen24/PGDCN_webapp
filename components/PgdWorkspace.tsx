'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  PGD_ASSESSMENT_METHOD_OPTIONS,
  PGD_DOMAIN,
  PGD_GROUP_LABELS,
  PGD_REGISTRY_DOCUMENT_KINDS,
  PGD_WORKFLOW_STATES,
  getPgdActiveCatalog,
  mergePgdCatalogDefaults,
  getPgdStatusLabel,
  getPgdSteelTtlt58SamplingPlan,
  getPgdApprovalRoleForStatus,
  getPgdDossierDeletionDenial,
  getPgdDossierEditDenial,
  isPgdDossierActionViewer,
  isPgdSystemManager,
  isPgdV1ProductGroup,
  snapshotPgdResultTemplate,
  type PgdCatalogItem,
  type PgdCoalDetails,
  type PgdInspectionRequest,
  type PgdInspectionRequestInput,
  type PgdInspectionRequestCreateInput,
  type PgdIntakeSampleDraft,
  type PgdInspectionRequestEditPatch,
  type PgdMachineryDetails,
  type PgdRegistryDocumentKind,
  type PgdInspectionReport,
  type PgdResultTemplate,
  type PgdInspectionStatus,
  type PgdTransitionContext,
} from '../utils/pgdDomain';
import {
  buildPgdFieldInspection,
  buildPgdResultValues,
  getPgdOperationalStepAccess,
  getPgdOperationalStepGateDenial,
  getPgdPostSignatureMutationDenial,
  validatePgdResultValues,
  type PgdOperationalStationKey,
} from '../utils/pgdWorkflow';
import { getPgdDossierRequirements } from '../utils/pgdDossier';
import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PgdLoginScreen from './PgdLoginScreen';
import PgdCaseEvidencePanel from './PgdCaseEvidencePanel';
import PgdSourceFormsPanel from './PgdSourceFormsPanel';
import PgdSidebar, { PGD_SECTION_LABELS, type PgdEntrySection, type PgdSection } from './PgdSidebar';
import PgdProductGroupFields from './PgdProductGroupFields';
import PgdIntakeSampleTable from './PgdIntakeSampleTable';
import PgdcnIntakeDropzone from './PgdcnIntakeDropzone';
import PgdcnWindowsWorkflowModal from './PgdcnWindowsWorkflowModal';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import PgdDraftingWorkspaceView from './PgdDraftingWorkspaceView';
import PgdDocxSettingsModal from './PgdDocxSettingsModal';
import PgdDossierFlow, { getPgdDossierCurrentStepNumber, getPgdDossierFlowStepIdForStatus, PGD_DOSSIER_FLOW_STEPS, type PgdDossierFlowStepId } from './PgdDossierFlow';
import PgdDossierStepWorkPanel from './PgdDossierStepWorkPanel';
import PgdSummaryRegisterView from './PgdSummaryRegisterView';
import PgdDossierQueueView, { type PgdDossierQueueRow } from './PgdDossierQueueView';
import PgdSampleOperationsView from './PgdSampleOperationsView';
import { PgdcnPageHeader, PgdcnStatePanel } from './PgdcnUiPrimitives';
import { PgdcnDateInput, PgdcnDateTimeInput } from './PgdcnDateInput';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy, parseDdMmYyyy, parseDdMmYyyyTime } from '../utils/formatter';
import { runPgdOcr } from '../utils/pgdOcrApi';

type IntakeForm = {
  registrationNumber: string;
  receivedAt: string;
  technicalDossierNote: string;
  deficiencyNote: string;
  returnedPackageNote: string;
  courierName: string;
  intakeChannel: PgdInspectionRequestInput['intakeChannel'];
  requesterName: string;
  requesterAddress: string;
  requesterContact: string;
  requesterPhone: string;
  requesterEmail: string;
  priority: NonNullable<PgdInspectionRequestInput['priority']>;
  urgentReason: string;
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
  productForm: string;
  grade: string;
  dimensions: string;
  productStandard: string;
  origin: string;
  countryOfOrigin: string;
  manufacturer: string;
  manufacturerLotCode: string;
  importer: string;
  hsCode: string;
  lotDefinition: string;
  customsDocuments: string;
  lotCode: string;
  transportName: string;
  quantity: string;
  unit: string;
  weight: string;
  weightUnit: string;
  inspectionScope: string;
  inspectionLocation: string;
  inspectionScheduledAt: string;
  standards: string;
  method: string;
  assessmentMethod: string;
  note: string;
  registryDocuments: Record<PgdRegistryDocumentKind, { number: string; date: string }>;
  steelLotSize: string;
  steelSameGradeMultiProduct: boolean;
  steelManualSamplingPlanNote: string;
  machinery: PgdMachineryDetails;
  coal: PgdCoalDetails;
};

const REGISTRY_DOCUMENT_FIELDS: ReadonlyArray<{ kind: PgdRegistryDocumentKind; label: string }> = [
  { kind: 'CONTRACT', label: 'Hợp đồng' },
  { kind: 'INVOICE', label: 'Hóa đơn' },
  { kind: 'PACKING_LIST', label: 'Packing list' },
  { kind: 'BILL_OF_LADING', label: 'Vận đơn' },
  { kind: 'CUSTOMS_DECLARATION', label: 'Tờ khai hải quan' },
  { kind: 'CERTIFICATE_OF_ORIGIN', label: 'C/O' },
  { kind: 'TECHNICAL_DOSSIER', label: 'Hồ sơ kỹ thuật' },
  { kind: 'OTHER', label: 'Khác' },
];

const PGD_PRODUCT_GROUP_LABELS: Record<PgdInspectionRequestInput['productGroup'], string> = {
  STEEL_METAL: 'Thép / kim loại',
  MACHINERY_LINE: 'Máy / dây chuyền',
  COAL: 'Than',
  OTHER: 'Hàng hóa khác',
};

function createBlankRegistryDocuments(): IntakeForm['registryDocuments'] {
  return Object.fromEntries(PGD_REGISTRY_DOCUMENT_KINDS.map((kind) => [kind, { number: '', date: '' }])) as IntakeForm['registryDocuments'];
}

const initialIntake: IntakeForm = {
  registrationNumber: '',
  receivedAt: new Date().toISOString().slice(0, 10),
  technicalDossierNote: '',
  deficiencyNote: '',
  returnedPackageNote: '',
  courierName: '',
  intakeChannel: 'DIRECT',
  requesterName: '',
  requesterAddress: '',
  requesterContact: '',
  requesterPhone: '',
  requesterEmail: '',
  priority: 'NORMAL',
  urgentReason: '',
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
  productForm: '',
  grade: '',
  dimensions: '',
  productStandard: '',
  origin: '',
  countryOfOrigin: '',
  manufacturer: '',
  manufacturerLotCode: '',
  importer: '',
  hsCode: '',
  lotDefinition: '',
  customsDocuments: '',
  lotCode: '',
  transportName: '',
  quantity: '1',
  unit: 'lô',
  weight: '',
  weightUnit: 'tấn',
  inspectionScope: '',
  inspectionLocation: '',
  inspectionScheduledAt: '',
  standards: '',
  method: '',
  assessmentMethod: '',
  note: '',
  registryDocuments: createBlankRegistryDocuments(),
  steelLotSize: '',
  steelSameGradeMultiProduct: false,
  steelManualSamplingPlanNote: '',
  machinery: {},
  coal: {},
};

function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function formatDate(value?: string): string {
  return formatDateTimeDdMmYyyy(value) || 'Chưa đặt';
}

function getPgdCertificateStatusLabel(status: string): string {
  return ({
    DRAFT: 'Bản nháp',
    SIGNED: 'Đã ký',
    RETURNED: 'Đã trả lại',
  } as Record<string, string>)[status] || status;
}

function Field({ label, required, children, wide = false }: { label: string; required?: boolean; children: React.ReactNode; wide?: boolean }) {
  const normalizedLabel = label.replace(/\s*\*\s*$/, '');
  const isRequired = required ?? normalizedLabel !== label;
  return <label className={wide ? 'block sm:col-span-2 lg:col-span-2' : 'block'}><span className="mb-1 block text-[10px] font-black text-slate-500">{normalizedLabel}{isRequired && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const inputMode = props.inputMode || (props.type === 'number' ? (props.step === '1' ? 'numeric' : 'decimal') : undefined);
  return <input {...props} inputMode={inputMode} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${props.className || ''}`} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${props.className || ''}`} />;
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
  return <div className="pgdcn-kpi-card"><div className="min-w-0 flex-1"><div className="truncate text-[9px] font-black uppercase tracking-wide text-slate-400" title={label}>{label}</div><div className={`mt-0.5 text-xl font-black leading-5 ${tone}`}>{value}</div></div></div>;
}

function PgdSteelSamplingPreview({
  method,
  lotSize,
  sameGradeMultiProduct,
  onLotSizeChange,
  onMultiProductChange,
  manualPlanNote,
  onManualPlanNoteChange,
}: {
  method: string;
  lotSize: string;
  sameGradeMultiProduct: boolean;
  onLotSizeChange: (value: string) => void;
  onMultiProductChange: (value: boolean) => void;
  manualPlanNote: string;
  onManualPlanNoteChange: (value: string) => void;
}) {
  if (!['TT58', 'QT-GĐ-14'].includes(method)) return null;
  const plan = getPgdSteelTtlt58SamplingPlan(Number(lotSize), sameGradeMultiProduct);
  return <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3" aria-label="Kế hoạch lấy mẫu QT-GĐ-14">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-black text-amber-950">Kế hoạch lấy mẫu</h2><p className="mt-1 text-[10px] leading-4 text-amber-800">Theo bảng cỡ lô của QT-GĐ-14 / TTLT 58/2015. Đơn vị cỡ lô là bó, kiện hoặc cuộn; ngoài dải quy định phải lập kế hoạch thủ công.</p></div><span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[9px] font-black text-amber-800">QT-GĐ-14</span></div>
    <div className="mt-2 grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)]"><Field label="Cỡ lô (bó/kiện/cuộn)"><TextInput aria-label="Cỡ lô (bó/kiện/cuộn)" type="number" min="1" step="1" value={lotSize} onChange={(event) => onLotSizeChange(event.target.value)} /></Field><label className="flex items-center gap-2 self-end rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[10px] font-bold text-amber-900"><input type="checkbox" checked={sameGradeMultiProduct} onChange={(event) => onMultiProductChange(event.target.checked)} /> Lô cùng mác, nhiều loại sản phẩm (cột B)</label></div>
    <div className="mt-2 rounded-lg border border-amber-200 bg-white p-2.5 text-[10px] text-slate-700">{plan ? <div className="grid gap-2 sm:grid-cols-4"><div><b className="block text-[9px] text-slate-400">Ngoại quan / nhãn</b><strong>{plan.visualLabelSampleCount} mẫu</strong></div><div><b className="block text-[9px] text-slate-400">Cơ lý / khối lượng</b><strong>{plan.mechanicalWeightSampleCount} mẫu</strong></div><div><b className="block text-[9px] text-slate-400">Hóa học / lớp phủ</b><strong>{plan.chemicalCoatingSampleCount} mẫu</strong></div><div><b className="block text-[9px] text-slate-400">AQL</b><strong>{plan.aqlVisualDimensionWeight} / {plan.aqlMechanicalChemicalCoating}</strong></div></div> : <span className="font-bold text-amber-800">{lotSize ? 'Cỡ lô ngoài bảng nguồn (1–3200); cần lập kế hoạch lấy mẫu thủ công.' : 'Nhập cỡ lô để tính số mẫu theo bảng nguồn.'}</span>}</div>
    {lotSize && !plan && <div className="mt-2"><Field label="Kế hoạch thủ công / căn cứ" wide><textarea required value={manualPlanNote} onChange={(event) => onManualPlanNoteChange(event.target.value)} rows={2} className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></Field></div>}
  </section>;
}

function PgdIntakeForm({
  catalog,
  customers,
  currentUser,
  canMutate,
  onCreated,
  formId = 'pgd-intake-form',
  onSavingChange,
}: {
  catalog: PgdCatalogItem[];
  customers: CustomerRef[];
  currentUser: PcnUserAccount;
  canMutate: boolean;
  onCreated: (id: string) => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const activeCatalog = useMemo(() => {
    const configured = getPgdActiveCatalog(mergePgdCatalogDefaults(catalog));
    return configured.length > 0 ? configured : getPgdActiveCatalog(DEFAULT_PGD_CATALOG);
  }, [catalog]);
  const [form, setForm] = useState<IntakeForm>(() => ({ ...initialIntake, standards: activeCatalog[0]?.defaultStandards.join(', ') || '' }));
  const [sampleDrafts, setSampleDrafts] = useState<PgdIntakeSampleDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const createRequest = usePgdStore((state) => state.createRequest);
  const selectedCatalog = activeCatalog.find((item) => item.id === form.catalogItemId) || activeCatalog[0] || DEFAULT_PGD_CATALOG[0];
  const activeProductGroups = useMemo(() => [...new Set(activeCatalog.map((item) => item.productGroup))], [activeCatalog]);
  const customerOptions = useMemo<PcnCatalogOption[]>(() => customers.flatMap((customer) => {
    const value = customer.customerCode || customer.name;
    if (!value) return [];
    return [{
      value,
      label: [customer.customerCode, customer.name].filter(Boolean).join(' — '),
      searchText: [customer.customerCode, customer.name, customer.taxId, customer.contactPerson, customer.phone].filter(Boolean).join(' '),
      description: [customer.address, customer.contactPerson].filter(Boolean).join(' · '),
    }];
  }), [customers]);
  const selectedCustomerValue = useMemo(() => {
    const customer = customers.find((item) => item.name === form.customerName && (!form.customerTaxId || item.taxId === form.customerTaxId));
    return customer?.customerCode || (customer ? customer.name : '');
  }, [customers, form.customerName, form.customerTaxId]);

  useEffect(() => {
    if (!form.catalogItemId && selectedCatalog) {
      setForm((current) => ({ ...current, catalogItemId: selectedCatalog.id, productGroup: selectedCatalog.productGroup, standards: current.standards || selectedCatalog.defaultStandards.join(', ') }));
    }
  }, [form.catalogItemId, selectedCatalog]);

  useEffect(() => {
    if (!form.method || selectedCatalog.methodOptions.some((method) => method.code === form.method)) return;
    setForm((current) => ({ ...current, method: '' }));
  }, [form.method, selectedCatalog.id, selectedCatalog.methodOptions]);

  useEffect(() => {
    if (['TT58', 'QT-GĐ-14'].includes(form.method) && !form.assessmentMethod) {
      setForm((current) => ({ ...current, assessmentMethod: 'METHOD_7' }));
    }
  }, [form.assessmentMethod, form.method]);

  const update = <K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateMachinery = <K extends keyof PgdMachineryDetails>(key: K, value: PgdMachineryDetails[K]) => setForm((current) => ({ ...current, machinery: { ...current.machinery, [key]: value } }));
  const updateCoal = <K extends keyof PgdCoalDetails>(key: K, value: PgdCoalDetails[K]) => setForm((current) => ({ ...current, coal: { ...current.coal, [key]: value } }));
  const chooseProductGroup = (productGroup: PgdInspectionRequestInput['productGroup']) => {
    const item = activeCatalog.find((candidate) => candidate.productGroup === productGroup);
    setForm((current) => ({
      ...current,
      productGroup,
      catalogItemId: item?.id || current.catalogItemId,
      standards: item?.defaultStandards.join(', ') || current.standards,
      method: item?.methodOptions.some((method) => method.code === current.method) ? current.method : '',
    }));
  };
  const chooseCustomer = (customerCode: string) => {
    const customer = customers.find((item) => item.customerCode === customerCode || (!item.customerCode && item.name === customerCode));
    if (!customer) {
      if (!customerCode) setForm((current) => ({ ...current, customerName: '', customerAddress: '', customerTaxId: '', customerContact: '', customerPhone: '', customerEmail: '' }));
      return;
    }
    setForm((current) => ({ ...current, customerName: customer.name, customerAddress: customer.address, customerTaxId: customer.taxId || '', customerContact: customer.contactPerson || '', customerPhone: customer.phone || '', customerEmail: customer.email || '' }));
  };

  const applyPgdOcr = (fields: Record<string, string>, file: File) => {
    const read = (key: string) => String(fields[key] || '').trim();
    const group = read('productGroup');
    const recognizedGroup = ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(group) ? group as IntakeForm['productGroup'] : undefined;
    const receivedAt = parseDdMmYyyyTime(read('receivedAt')) || parseDdMmYyyy(read('receivedAt'));
    const inspectionScheduledAt = parseDdMmYyyyTime(read('inspectionScheduledAt')) || parseDdMmYyyy(read('inspectionScheduledAt'));
    setForm((current) => ({
      ...current,
      ...(read('registrationNumber') ? { registrationNumber: read('registrationNumber') } : {}),
      ...(read('requesterName') ? { requesterName: read('requesterName') } : {}),
      ...(read('requesterAddress') ? { requesterAddress: read('requesterAddress') } : {}),
      ...(read('requesterContact') ? { requesterContact: read('requesterContact') } : {}),
      ...(read('requesterPhone') ? { requesterPhone: read('requesterPhone') } : {}),
      ...(read('requesterEmail') ? { requesterEmail: read('requesterEmail') } : {}),
      ...(read('customerName') ? { customerName: read('customerName') } : {}),
      ...(read('customerAddress') ? { customerAddress: read('customerAddress') } : {}),
      ...(read('customerContact') ? { customerContact: read('customerContact') } : {}),
      ...(read('customerTaxId') ? { customerTaxId: read('customerTaxId') } : {}),
      ...(read('customerPhone') ? { customerPhone: read('customerPhone') } : {}),
      ...(read('customerEmail') ? { customerEmail: read('customerEmail') } : {}),
      ...(recognizedGroup ? { productGroup: recognizedGroup } : {}),
      ...(read('productName') ? { productName: read('productName') } : {}),
      ...(read('productCode') ? { productCode: read('productCode') } : {}),
      ...(read('brand') ? { brand: read('brand') } : {}),
      ...(read('productForm') ? { productForm: read('productForm') } : {}),
      ...(read('grade') ? { grade: read('grade') } : {}),
      ...(read('dimensions') ? { dimensions: read('dimensions') } : {}),
      ...(read('productStandard') ? { productStandard: read('productStandard') } : {}),
      ...(read('countryOfOrigin') ? { countryOfOrigin: read('countryOfOrigin') } : {}),
      ...(read('manufacturer') ? { manufacturer: read('manufacturer') } : {}),
      ...(read('lotCode') ? { lotCode: read('lotCode') } : {}),
      ...(read('quantity') ? { quantity: read('quantity') } : {}),
      ...(read('unit') ? { unit: read('unit') } : {}),
      ...(read('weight') ? { weight: read('weight') } : {}),
      ...(read('inspectionScope') ? { inspectionScope: read('inspectionScope') } : {}),
      ...(read('inspectionLocation') ? { inspectionLocation: read('inspectionLocation') } : {}),
      ...(receivedAt ? { receivedAt } : {}),
      ...(inspectionScheduledAt ? { inspectionScheduledAt } : {}),
      ...(read('standards') ? { standards: read('standards') } : {}),
      ...(read('method') ? { method: read('method') } : {}),
      note: `Đã nhận diện từ ${file.name}; cần soát xét trước khi lưu.${current.note.trim() ? `\n${current.note.trim()}` : ''}`,
    }));
    const quantity = Number(read('sampleQuantity') || read('quantity') || 1);
    setSampleDrafts((current) => current.length > 0 ? current : [{ id: `ocr-${Date.now()}`, sampleCode: read('sampleCode') || 'M01', sampleTypeLabel: read('sampleTypeLabel') || read('productName'), customLabel: read('sampleTypeLabel') || undefined, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unit: read('sampleUnit') || read('unit') || 'mẫu', disposition: 'RETAINED', sealNumber: read('sealNumber') || undefined }]);
    toast.success('Đã điền bản nháp OCR PGD; hãy soát xét các trường bắt buộc và bảng mẫu trước khi lưu.');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    onSavingChange?.(true);
    try {
      const standards = form.standards.split(',').map((item) => item.trim()).filter(Boolean);
      const registryDocuments = REGISTRY_DOCUMENT_FIELDS.map(({ kind }) => {
        const document = form.registryDocuments[kind];
        return {
          kind,
          ...(document.number.trim() ? { number: document.number.trim() } : {}),
          ...(document.date ? { date: document.date } : {}),
        };
      }).filter((document) => document.number || document.date);
      const compactDetails = <T extends object>(details: T): Partial<T> => Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value]).filter(([, value]) => value !== undefined)) as Partial<T>;
      const machinery = compactDetails(form.machinery);
      const coal = compactDetails(form.coal);
      const input: PgdInspectionRequestCreateInput = {
        id: makeId('pgd-request'),
        registryMetadata: {
          ...(form.registrationNumber.trim() ? { registrationNumber: form.registrationNumber.trim() } : {}),
          ...(form.receivedAt ? { receivedAt: form.receivedAt } : {}),
          ...(registryDocuments.length > 0 ? { documents: registryDocuments } : {}),
          ...(form.technicalDossierNote.trim() ? { technicalDossierNote: form.technicalDossierNote.trim() } : {}),
          ...(form.deficiencyNote.trim() ? { deficiencyNote: form.deficiencyNote.trim() } : {}),
          ...(form.returnedPackageNote.trim() ? { returnedPackageNote: form.returnedPackageNote.trim() } : {}),
          ...(form.courierName.trim() ? { courierName: form.courierName.trim() } : {}),
        },
        intakeChannel: form.intakeChannel,
        requester: { name: form.requesterName.trim(), address: form.requesterAddress.trim(), contactPerson: form.requesterContact.trim(), phone: form.requesterPhone.trim(), email: form.requesterEmail.trim() || undefined },
        receivedByUsername: currentUser.username,
        priority: form.priority,
        ...(form.priority === 'URGENT' && form.urgentReason.trim() ? { urgentReason: form.urgentReason.trim() } : {}),
        customerSnapshot: { name: form.customerName.trim(), address: form.customerAddress.trim(), taxId: form.customerTaxId.trim() || undefined, contactPerson: form.customerContact.trim() || undefined, phone: form.customerPhone.trim() || undefined, email: form.customerEmail.trim() || undefined },
        productGroup: form.productGroup,
        pgdGroupCode: selectedCatalog.groupCode,
        catalogItemId: form.catalogItemId || selectedCatalog.id,
        productName: form.productName.trim(),
        productCode: form.productCode.trim() || undefined,
        brand: form.brand.trim() || undefined,
        productDetails: {
          productForm: form.productForm.trim() || undefined,
          grade: form.grade.trim() || undefined,
          dimensions: form.dimensions.trim() || undefined,
          productStandard: form.productStandard.trim() || undefined,
          origin: form.origin.trim() || undefined,
          countryOfOrigin: form.countryOfOrigin.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          manufacturerLotCode: form.manufacturerLotCode.trim() || undefined,
          importer: form.importer.trim() || undefined,
          hsCode: form.hsCode.trim() || undefined,
          lotDefinition: form.lotDefinition.trim() ? form.lotDefinition as NonNullable<PgdInspectionRequestInput['productDetails']>['lotDefinition'] : undefined,
          customsDocuments: form.customsDocuments.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => ({ document: line })),
          ...(form.method && ['TT58', 'QT-GĐ-14'].includes(form.method) && form.steelLotSize ? { steelLotSize: Number(form.steelLotSize), steelSameGradeMultiProduct: form.steelSameGradeMultiProduct } : {}),
          ...(form.method && ['TT58', 'QT-GĐ-14'].includes(form.method) && form.steelManualSamplingPlanNote.trim() ? { steelManualSamplingPlanNote: form.steelManualSamplingPlanNote.trim() } : {}),
          ...(form.productGroup === 'MACHINERY_LINE' ? { machinery } : {}),
          ...(form.productGroup === 'COAL' ? { coal } : {}),
        },
        lotCode: form.lotCode.trim() || undefined,
        transportName: form.transportName.trim() || undefined,
        quantity: Number(form.quantity),
        unit: form.unit.trim() || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        weightUnit: form.weightUnit.trim() || undefined,
        inspectionScope: form.inspectionScope.trim(),
        inspectionLocation: form.inspectionLocation.trim(),
        inspectionScheduledAt: form.inspectionScheduledAt ? new Date(form.inspectionScheduledAt).toISOString() : undefined,
        standards,
        method: form.method.trim() || undefined,
        assessmentMethod: form.assessmentMethod.trim() ? form.assessmentMethod as PgdInspectionRequestInput['assessmentMethod'] : undefined,
        note: form.note.trim() || undefined,
        sampleDrafts,
      };
      const request = await createRequest(input);
      toast.success(`Đã tạo PYC ${request.requestCode} ở trạng thái Bản nháp.`);
      onCreated(request.id);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo PYC giám định.');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  return <div className="space-y-3 p-3 md:p-5">
    <form id={formId} onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
      <div data-testid="pgd-selected-group-code" className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-2 text-[10px] text-blue-800"><span className="font-black">Nhóm nghiệp vụ PGD:</span><span className="rounded-full border border-blue-200 bg-white px-2 py-1 font-black">{selectedCatalog.groupCode ? PGD_GROUP_LABELS[selectedCatalog.groupCode] : 'Chưa gắn nhóm nghiệp vụ'}</span><span className="text-blue-600">Mã phân tuyến: {selectedCatalog.code}</span></div>
      <PgdcnIntakeDropzone disabled={saving || !canMutate} onExtract={runPgdOcr} onDraftApply={applyPgdOcr} onFileAccepted={(file) => update('note', `Tài liệu nhập nhanh: ${file.name}${form.note.trim() ? `\n${form.note.trim()}` : ''}`)} />
      <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-3"><h2 className="mb-2 text-xs font-black text-slate-800">Thông tin bên yêu cầu</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Người / đơn vị yêu cầu *"><TextInput required value={form.requesterName} onChange={(event) => update('requesterName', event.target.value)} /></Field><Field label="Địa chỉ bên yêu cầu *"><TextInput required value={form.requesterAddress} onChange={(event) => update('requesterAddress', event.target.value)} /></Field><Field label="Người liên hệ *"><TextInput required value={form.requesterContact} onChange={(event) => update('requesterContact', event.target.value)} /></Field><Field label="Điện thoại *"><TextInput required value={form.requesterPhone} onChange={(event) => update('requesterPhone', event.target.value)} /></Field><Field label="Email"><TextInput type="email" value={form.requesterEmail} onChange={(event) => update('requesterEmail', event.target.value)} /></Field><Field label="Mức ưu tiên"><SelectInput value={form.priority} onChange={(event) => update('priority', event.target.value as IntakeForm['priority'])}><option value="NORMAL">Bình thường</option><option value="URGENT">Gấp / ưu tiên</option></SelectInput></Field><Field label="Lý do ưu tiên" wide><TextInput required={form.priority === 'URGENT'} value={form.urgentReason} onChange={(event) => update('urgentReason', event.target.value)} /></Field></div></section>
      <section><h2 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><Building2 size={15} className="text-blue-600" /> Đơn vị yêu cầu / khách hàng</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[10px] text-blue-800"><span className="block font-black">Số hồ sơ / PYC</span><span className="mt-1 block">Hệ thống tự cấp theo ngày: <b className="font-mono">PGD-YYMMDD-TT</b></span></div><Field label="Kênh tiếp nhận"><SelectInput value={form.intakeChannel} onChange={(event) => update('intakeChannel', event.target.value as IntakeForm['intakeChannel'])}><option value="DIRECT">Trực tiếp</option><option value="PHONE">Điện thoại</option><option value="ONLINE_ZALO">Zalo / Online</option><option value="EMAIL">Email</option><option value="OTHER">Khác</option></SelectInput></Field><Field label="Tìm khách hàng dùng chung"><PcnCatalogCombobox id="pgd-customer-catalog" label="Tìm khách hàng dùng chung" hideLabel value={selectedCustomerValue} options={customerOptions} onChange={chooseCustomer} disabled={saving} /></Field><Field label="Tên đơn vị *"><TextInput required value={form.customerName} onChange={(event) => update('customerName', event.target.value)} /></Field><Field label="Địa chỉ *"><TextInput required value={form.customerAddress} onChange={(event) => update('customerAddress', event.target.value)} /></Field><Field label="Mã số thuế"><TextInput value={form.customerTaxId} onChange={(event) => update('customerTaxId', event.target.value)} /></Field><Field label="Người liên hệ"><TextInput value={form.customerContact} onChange={(event) => update('customerContact', event.target.value)} /></Field><Field label="Điện thoại"><TextInput value={form.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} /></Field><Field label="Email"><TextInput type="email" value={form.customerEmail} onChange={(event) => update('customerEmail', event.target.value)} /></Field></div></section>
      <section className="border-t border-slate-100 pt-4"><h2 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><PackageCheck size={15} className="text-blue-600" /> Hàng hóa / phạm vi giám định</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Nhóm sản phẩm"><SelectInput aria-label="Nhóm sản phẩm PGD" value={form.productGroup} onChange={(event) => chooseProductGroup(event.target.value as IntakeForm['productGroup'])}>{activeProductGroups.map((group) => <option key={group} value={group}>{PGD_PRODUCT_GROUP_LABELS[group]}</option>)}</SelectInput></Field><Field label="Loại hình giám định"><SelectInput value={form.catalogItemId} onChange={(event) => { const item = activeCatalog.find((candidate) => candidate.id === event.target.value); setForm((current) => ({ ...current, catalogItemId: event.target.value, productGroup: item?.productGroup || current.productGroup, standards: item?.defaultStandards.join(', ') || current.standards })); }}><option value="">Chọn loại hình...</option>{activeCatalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectInput></Field><Field label="Tên hàng hóa / thiết bị *"><TextInput required value={form.productName} onChange={(event) => update('productName', event.target.value)} /></Field><Field label="Mã hàng / kiểu loại"><TextInput value={form.productCode} onChange={(event) => update('productCode', event.target.value)} /></Field><Field label="Mác / nhãn hiệu"><TextInput value={form.brand} onChange={(event) => update('brand', event.target.value)} /></Field><Field label="Số lô / số nhận dạng"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.lotCode} onChange={(event) => update('lotCode', event.target.value)} /></Field><Field label="Số lượng *"><TextInput required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></Field><Field label="Đơn vị"><TextInput value={form.unit} onChange={(event) => update('unit', event.target.value)} /></Field><Field label="Khối lượng"><TextInput type="number" min="0" step="0.001" value={form.weight} onChange={(event) => update('weight', event.target.value)} /></Field><Field label="Phạm vi yêu cầu *" wide><textarea required rows={2} value={form.inspectionScope} onChange={(event) => update('inspectionScope', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field><Field label="Tiêu chuẩn / phương pháp đối chiếu *" wide><TextInput required value={form.standards} onChange={(event) => update('standards', event.target.value)} /></Field><Field label="Mã phương thức / quy trình"><SelectInput aria-label="Mã phương thức PGD" value={form.method} onChange={(event) => update('method', event.target.value)}><option value="">Chọn mã phương thức...</option>{selectedCatalog.methodOptions.map((method) => <option key={method.code} value={method.code}>{method.code} · {method.name}</option>)}</SelectInput></Field><Field label="Phương thức ĐGSPH"><SelectInput aria-label="Phương thức ĐGSPH" required value={form.assessmentMethod} onChange={(event) => update('assessmentMethod', event.target.value)}><option value="">Chọn phương thức 7...</option>{PGD_ASSESSMENT_METHOD_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}</SelectInput></Field><Field label="Lịch dự kiến"><PgdcnDateTimeInput value={form.inspectionScheduledAt} onChange={(value) => update('inspectionScheduledAt', value)} /></Field><Field label="Địa điểm giám định *" wide><TextInput required value={form.inspectionLocation} onChange={(event) => update('inspectionLocation', event.target.value)} /></Field><Field label="Ghi chú tiếp nhận" wide><textarea rows={2} value={form.note} onChange={(event) => update('note', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field></div></section>
      <section className="border-t border-slate-100 pt-4"><h2 className="mb-2 text-xs font-black text-slate-800">Thông tin lô / sản phẩm và chứng từ</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Dạng sản phẩm"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.productForm} onChange={(event) => update('productForm', event.target.value)} /></Field><Field label="Mác / cấp sản phẩm"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.grade} onChange={(event) => update('grade', event.target.value)} /></Field><Field label="Kích thước / thông số"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.dimensions} onChange={(event) => update('dimensions', event.target.value)} /></Field><Field label="Tiêu chuẩn sản phẩm công bố"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.productStandard} onChange={(event) => update('productStandard', event.target.value)} /></Field><Field label="Xuất xứ"><TextInput value={form.origin} onChange={(event) => update('origin', event.target.value)} /></Field><Field label="Nước xuất xứ"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.countryOfOrigin} onChange={(event) => update('countryOfOrigin', event.target.value)} /></Field><Field label="Nhà sản xuất"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} /></Field><Field label="Số lô nhà sản xuất / lô hàng"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.manufacturerLotCode} onChange={(event) => update('manufacturerLotCode', event.target.value)} /></Field><Field label="Phương tiện vận tải"><TextInput value={form.transportName} onChange={(event) => update('transportName', event.target.value)} /></Field><Field label="Nhà nhập khẩu"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.importer} onChange={(event) => update('importer', event.target.value)} /></Field><Field label="Mã HS"><TextInput required={form.productGroup === 'STEEL_METAL'} value={form.hsCode} onChange={(event) => update('hsCode', event.target.value)} /></Field><Field label="Cách xác định lô"><SelectInput required={form.productGroup === 'STEEL_METAL'} value={form.lotDefinition} onChange={(event) => update('lotDefinition', event.target.value)}><option value="">Chọn cách xác định lô...</option><option value="PRODUCT_LOT">Lô sản phẩm</option><option value="SHIPMENT_LOT">Lô hàng hóa</option></SelectInput></Field><Field label="Chứng từ hải quan / thương mại" wide><textarea required={form.productGroup === 'STEEL_METAL'} rows={2} value={form.customsDocuments} onChange={(event) => update('customsDocuments', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field></div></section>
      <PgdProductGroupFields productGroup={form.productGroup} method={form.method} machinery={form.machinery} coal={form.coal} onMachineryChange={updateMachinery} onCoalChange={updateCoal} />
      <PgdSteelSamplingPreview method={form.method} lotSize={form.steelLotSize} sameGradeMultiProduct={form.steelSameGradeMultiProduct} onLotSizeChange={(value) => update('steelLotSize', value)} onMultiProductChange={(value) => update('steelSameGradeMultiProduct', value)} manualPlanNote={form.steelManualSamplingPlanNote} onManualPlanNoteChange={(value) => update('steelManualSamplingPlanNote', value)} />
      <PgdIntakeSampleTable productGroup={form.productGroup} rows={sampleDrafts} onChange={setSampleDrafts} disabled={saving || !canMutate} />
      <section className="border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="mb-1 text-xs font-black text-slate-800">Sổ đăng ký PGD</h2><p className="text-[10px] text-slate-500">Các trường dưới đây được chuẩn hóa từ sổ đăng ký của phòng; chứng từ là tùy chọn và có thể bổ sung ở checklist hồ sơ.</p></div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">Bản chụp khi tạo PYC</span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Số đăng ký"><TextInput value={form.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value)} /></Field>
          <Field label="Ngày tiếp nhận"><PgdcnDateInput value={form.receivedAt} onChange={(value) => update('receivedAt', value)} /></Field>
          {REGISTRY_DOCUMENT_FIELDS.map(({ kind, label }) => <div key={kind} className="rounded-lg border border-slate-100 bg-slate-50 p-2"><div className="mb-1 text-[9px] font-black text-slate-600">{label}</div><div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_7rem]"><TextInput aria-label={`${label} số`} value={form.registryDocuments[kind].number} onChange={(event) => setForm((current) => ({ ...current, registryDocuments: { ...current.registryDocuments, [kind]: { ...current.registryDocuments[kind], number: event.target.value } } }))} /><PgdcnDateInput aria-label={`${label} ngày`} value={form.registryDocuments[kind].date} onChange={(value) => setForm((current) => ({ ...current, registryDocuments: { ...current.registryDocuments, [kind]: { ...current.registryDocuments[kind], date: value } } }))} /></div></div>)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Hồ sơ kỹ thuật"><TextInput value={form.technicalDossierNote} onChange={(event) => update('technicalDossierNote', event.target.value)} /></Field>
          <Field label="Chuyển phát"><TextInput value={form.courierName} onChange={(event) => update('courierName', event.target.value)} /></Field>
          <Field label="Thiếu hồ sơ" wide><textarea rows={2} value={form.deficiencyNote} onChange={(event) => update('deficiencyNote', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field>
          <Field label="Hoàn trả" wide><textarea rows={2} value={form.returnedPackageNote} onChange={(event) => update('returnedPackageNote', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field>
        </div>
      </section>
    </form>
  </div>;
}

type PgdEditForm = {
  intakeChannel: PgdInspectionRequestInput['intakeChannel'];
  customerName: string;
  customerAddress: string;
  customerTaxId: string;
  customerContact: string;
  customerPhone: string;
  customerEmail: string;
  productName: string;
  productCode: string;
  brand: string;
  lotCode: string;
  transportName: string;
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

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
}

function buildPgdEditForm(request: PgdInspectionRequest): PgdEditForm {
  return {
    intakeChannel: request.intakeChannel,
    customerName: request.customerSnapshot.name,
    customerAddress: request.customerSnapshot.address,
    customerTaxId: request.customerSnapshot.taxId || '',
    customerContact: request.customerSnapshot.contactPerson || '',
    customerPhone: request.customerSnapshot.phone || '',
    customerEmail: request.customerSnapshot.email || '',
    productName: request.productName,
    productCode: request.productCode || '',
    brand: request.brand || '',
    lotCode: request.lotCode || '',
    transportName: request.transportName || '',
    quantity: String(request.quantity),
    unit: request.unit || '',
    weight: request.weight === undefined ? '' : String(request.weight),
    weightUnit: request.weightUnit || '',
    inspectionScope: request.inspectionScope,
    inspectionLocation: request.inspectionLocation,
    inspectionScheduledAt: toDateTimeLocal(request.inspectionScheduledAt),
    standards: request.standards.join(', '),
    method: request.method || '',
    note: request.note || '',
  };
}

function PgdRequestEditPanel({ request, onClose }: { request: PgdInspectionRequest; onClose: () => void }) {
  const updateRequest = usePgdStore((state) => state.updateRequest);
  const [form, setForm] = useState<PgdEditForm>(() => buildPgdEditForm(request));
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof PgdEditForm>(key: K, value: PgdEditForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const patch: PgdInspectionRequestEditPatch = {
        intakeChannel: form.intakeChannel,
        customerSnapshot: {
          name: form.customerName.trim(),
          address: form.customerAddress.trim(),
          taxId: form.customerTaxId.trim() || undefined,
          contactPerson: form.customerContact.trim() || undefined,
          phone: form.customerPhone.trim() || undefined,
          email: form.customerEmail.trim() || undefined,
        },
        productName: form.productName.trim(),
        productCode: form.productCode.trim() || undefined,
        brand: form.brand.trim() || undefined,
        lotCode: form.lotCode.trim() || undefined,
        transportName: form.transportName.trim() || undefined,
        quantity: Number(form.quantity),
        unit: form.unit.trim() || undefined,
        weight: form.weight.trim() ? Number(form.weight) : undefined,
        weightUnit: form.weightUnit.trim() || undefined,
        inspectionScope: form.inspectionScope.trim(),
        inspectionLocation: form.inspectionLocation.trim(),
        inspectionScheduledAt: form.inspectionScheduledAt ? new Date(form.inspectionScheduledAt).toISOString() : undefined,
        standards: form.standards.split(',').map((item) => item.trim()).filter(Boolean),
        method: form.method.trim() || undefined,
        note: form.note.trim() || undefined,
      };
      await updateRequest(request.id, patch);
      toast.success(`Đã cập nhật thông tin hồ sơ ${request.requestCode}.`);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật thông tin hồ sơ PGD.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 md:p-6" role="dialog" aria-modal="true" aria-label={`Sửa thông tin hồ sơ PGD ${request.requestCode}`}>
    <section className="my-2 w-full max-w-5xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:my-4">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-5"><div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Hiệu chỉnh hồ sơ</div><h2 className="mt-0.5 text-sm font-black text-slate-900">Sửa thông tin hồ sơ {request.requestCode}</h2><p className="mt-1 text-[10px] text-slate-500">Chỉ Quản trị viên hoặc Quản lý toàn hệ thống được lưu; mọi thay đổi được ghi nhật ký.</p></div><button type="button" onClick={onClose} aria-label="Đóng sửa thông tin hồ sơ" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></header>
      <form onSubmit={submit} className="max-h-[calc(100dvh-9rem)] space-y-4 overflow-y-auto p-4 md:p-5">
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><div className="flex flex-wrap items-center gap-2 text-[10px] text-blue-900"><b>Nhóm hồ sơ:</b> {PGD_PRODUCT_GROUP_LABELS[request.productGroup]} <span>·</span> <b>Loại hình:</b> {request.catalogItemId} <span className="rounded-full border border-blue-200 bg-white px-2 py-1 font-black">Mã PYC giữ nguyên: {request.requestCode}</span></div><p className="mt-1 text-[9px] text-blue-800">Nhóm sản phẩm, loại hình và mã PYC là định danh nghiệp vụ; nếu cần đổi loại hình, hãy tạo yêu cầu điều chỉnh riêng để không làm lệch danh mục hồ sơ đã chụp.</p></section>
        <section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><Building2 size={15} className="text-blue-600" /> Khách hàng và tiếp nhận</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Kênh tiếp nhận"><SelectInput value={form.intakeChannel} onChange={(event) => update('intakeChannel', event.target.value as PgdEditForm['intakeChannel'])}><option value="DIRECT">Trực tiếp</option><option value="PHONE">Điện thoại</option><option value="ONLINE_ZALO">Zalo / Online</option><option value="EMAIL">Email</option><option value="OTHER">Khác</option></SelectInput></Field><Field label="Tên đơn vị *"><TextInput required value={form.customerName} onChange={(event) => update('customerName', event.target.value)} /></Field><Field label="Địa chỉ *"><TextInput required value={form.customerAddress} onChange={(event) => update('customerAddress', event.target.value)} /></Field><Field label="Mã số thuế"><TextInput value={form.customerTaxId} onChange={(event) => update('customerTaxId', event.target.value)} /></Field><Field label="Người liên hệ"><TextInput value={form.customerContact} onChange={(event) => update('customerContact', event.target.value)} /></Field><Field label="Điện thoại"><TextInput value={form.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} /></Field><Field label="Email"><TextInput type="email" value={form.customerEmail} onChange={(event) => update('customerEmail', event.target.value)} /></Field></div></section>
        <section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800"><PackageCheck size={15} className="text-blue-600" /> Hàng hóa, lô và phạm vi</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="Tên hàng hóa / thiết bị *"><TextInput required value={form.productName} onChange={(event) => update('productName', event.target.value)} /></Field><Field label="Mã hàng / kiểu loại"><TextInput value={form.productCode} onChange={(event) => update('productCode', event.target.value)} /></Field><Field label="Mác / nhãn hiệu"><TextInput value={form.brand} onChange={(event) => update('brand', event.target.value)} /></Field><Field label="Số lô / số nhận dạng"><TextInput value={form.lotCode} onChange={(event) => update('lotCode', event.target.value)} /></Field><Field label="Số lượng *"><TextInput required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></Field><Field label="Đơn vị"><TextInput value={form.unit} onChange={(event) => update('unit', event.target.value)} /></Field><Field label="Khối lượng"><TextInput type="number" min="0" step="0.001" value={form.weight} onChange={(event) => update('weight', event.target.value)} /></Field><Field label="Đơn vị khối lượng"><TextInput value={form.weightUnit} onChange={(event) => update('weightUnit', event.target.value)} /></Field><Field label="Phương tiện vận tải"><TextInput value={form.transportName} onChange={(event) => update('transportName', event.target.value)} /></Field><Field label="Phạm vi yêu cầu *" wide><textarea required rows={2} value={form.inspectionScope} onChange={(event) => update('inspectionScope', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field><Field label="Địa điểm giám định *" wide><TextInput required value={form.inspectionLocation} onChange={(event) => update('inspectionLocation', event.target.value)} /></Field><Field label="Tiêu chuẩn / phương pháp đối chiếu *" wide><TextInput required value={form.standards} onChange={(event) => update('standards', event.target.value)} /></Field><Field label="Mã phương thức / quy trình"><TextInput value={form.method} onChange={(event) => update('method', event.target.value)} /></Field><Field label="Lịch dự kiến"><PgdcnDateTimeInput value={form.inspectionScheduledAt} onChange={(value) => update('inspectionScheduledAt', value)} /></Field><Field label="Ghi chú tiếp nhận" wide><textarea rows={2} value={form.note} onChange={(event) => update('note', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></Field></div></section>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-blue-600 px-4 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}</button></footer>
      </form>
    </section>
  </div>;
}

function getPgdUserDisplayName(username: string | undefined, users: PcnUserAccount[]): string {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return 'Chưa phân công';
  return users.find((user) => user.username.trim().toLowerCase() === normalized)?.name || username || 'Chưa phân công';
}

function RequestCard({ request, users, onOpen }: { request: import('../utils/pgdDomain').PgdInspectionRequest; users: PcnUserAccount[]; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-black text-slate-900">{request.requestCode}</span><StatusBadge status={request.status} /></div><h3 className="mt-2 truncate text-sm font-black text-slate-800">{request.productName}</h3><p className="mt-1 truncate text-[10px] text-slate-500">{request.customerSnapshot.name} · {request.inspectionLocation}</p><p className="mt-1 truncate text-[9px] font-bold text-blue-700">Phụ trách: {getPgdUserDisplayName(request.ownerUsername, users)}</p></div><ArrowRight size={16} className="shrink-0 text-slate-300" /></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-[9px]"><span><b className="block text-slate-400">Lô / nhận dạng</b><span className="font-bold text-slate-700">{request.lotCode || 'Chưa có'}</span></span><span><b className="block text-slate-400">Số lượng</b><span className="font-bold text-slate-700">{request.quantity} {request.unit || ''}</span></span><span><b className="block text-slate-400">Cập nhật</b><span className="font-bold text-slate-700">{formatDate(request.updatedAt)}</span></span></div></button>;
}

function formatRegistryDate(value?: string): string {
  return formatDateDdMmYyyy(value) || value || '—';
}

function registryDocumentNumber(request: PgdInspectionRequest, kind: PgdRegistryDocumentKind): string {
  return request.registryMetadata?.documents?.find((document) => document.kind === kind)?.number || '—';
}

function PgdRegisterTable({ requests, users, onOpen }: { requests: PgdInspectionRequest[]; users: PcnUserAccount[]; onOpen: (id: string) => void }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Sổ đăng ký PGD"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-black text-slate-800">Sổ đăng ký PGD</h2><p className="mt-0.5 text-[10px] text-slate-400">Danh sách hồ sơ phát sinh trong ứng dụng; mở dòng để lập biên bản và đóng gói.</p></div><span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{requests.length} hồ sơ</span></div><div className="mt-3 overflow-x-auto rounded-xl border border-slate-100"><table className="min-w-[1240px] w-full text-left text-[10px]"><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-2.5 py-2">Số đăng ký / PYC</th><th className="px-2.5 py-2">Ngày</th><th className="px-2.5 py-2">Khách hàng</th><th className="px-2.5 py-2">Hàng hóa / lô</th><th className="px-2.5 py-2">SL / KL</th><th className="px-2.5 py-2">Địa điểm</th><th className="px-2.5 py-2">Phương thức</th><th className="px-2.5 py-2">Phụ trách</th><th className="px-2.5 py-2">Hợp đồng / HĐ</th><th className="px-2.5 py-2">Vận đơn / C/O</th><th className="px-2.5 py-2">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((request) => <tr key={request.id} className="bg-white hover:bg-blue-50/50"><td className="px-2.5 py-2"><button type="button" onClick={() => onOpen(request.id)} aria-label={`Mở hồ sơ ${request.requestCode}`} className="mobile-touch-target min-h-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"><div className="font-mono font-black text-blue-700">{request.requestCode}</div>{request.registryMetadata?.registrationNumber && <div className="mt-0.5 font-mono text-[9px] text-slate-400">Số ngoài: {request.registryMetadata.registrationNumber}</div>}</button></td><td className="whitespace-nowrap px-2.5 py-2 text-slate-600">{formatRegistryDate(request.registryMetadata?.receivedAt)}</td><td className="max-w-44 px-2.5 py-2"><div className="truncate font-bold text-slate-700" title={request.customerSnapshot.name}>{request.customerSnapshot.name}</div><div className="truncate text-[9px] text-slate-400">{request.customerSnapshot.contactPerson || '—'}</div></td><td className="max-w-52 px-2.5 py-2"><div className="truncate font-bold text-slate-700" title={request.productName}>{request.productName}</div><div className="truncate text-[9px] text-slate-400">{request.lotCode || 'Chưa có lô'}</div></td><td className="whitespace-nowrap px-2.5 py-2 text-slate-600">{request.quantity} {request.unit || ''}{request.weight ? <div className="text-[9px] text-slate-400">{request.weight} {request.weightUnit || ''}</div> : null}</td><td className="max-w-40 px-2.5 py-2 text-slate-600"><div className="truncate" title={request.inspectionLocation}>{request.inspectionLocation}</div></td><td className="whitespace-nowrap px-2.5 py-2 font-mono text-[9px] text-blue-700">{request.method || '—'}</td><td className="px-2.5 py-2 font-mono text-[9px] text-slate-600">{request.ownerUsername || 'Chưa gán'}</td><td className="px-2.5 py-2 text-slate-600"><div>{registryDocumentNumber(request, 'CONTRACT')}</div><div className="text-[9px] text-slate-400">{registryDocumentNumber(request, 'INVOICE')}</div></td><td className="px-2.5 py-2 text-slate-600"><div>{registryDocumentNumber(request, 'BILL_OF_LADING')}</div><div className="text-[9px] text-slate-400">{registryDocumentNumber(request, 'CERTIFICATE_OF_ORIGIN')}</div></td><td className="px-2.5 py-2"><StatusBadge status={request.status} /></td></tr>)}{requests.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-[11px] text-slate-400">Không có hồ sơ phù hợp.</td></tr>}</tbody></table></div></section>;
}

function PgdRequestDetail({ request, currentUser, onClose, onOpenDrafting, standalone = false }: { request: import('../utils/pgdDomain').PgdInspectionRequest; currentUser: PcnUserAccount; onClose: () => void; onOpenDrafting?: (request: import('../utils/pgdDomain').PgdInspectionRequest, input: { templateKind: PgdDocumentTemplateKind; requirementCode: string }) => string | undefined; standalone?: boolean }) {
  const pgd = usePgdStore();
  const [dossierRequirements, setDossierRequirements] = useState<import('../utils/pgdDossier').PgdDossierRequirement[]>([]);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [inspectorInput, setInspectorInput] = useState(currentUser.username);
  const [reviewerInput, setReviewerInput] = useState('');
  const [fieldForm, setFieldForm] = useState({
    lotObservation: 'Đã kiểm tra nhận dạng theo PYC.',
    packaging: 'Đã ghi nhận tại hiện trường.',
    labeling: request.lotCode ? `Số lô: ${request.lotCode}` : '',
    measurements: '',
    nonconformities: 'Không có',
    inspectionResult: 'Kết quả phù hợp với phạm vi giám định đã thống nhất.',
    customerRepresentative: '',
    note: 'Biên bản hiện trường được ghi nhận trên hồ sơ PGD.',
  });
  const [sampleQuantity, setSampleQuantity] = useState('2');
  const [sampleDescription, setSampleDescription] = useState(request.productName);
  const [labName, setLabName] = useState('PTN nội bộ TVCI');
  const [labCode, setLabCode] = useState('');
  const [labItems, setLabItems] = useState('Nhận dạng, kích thước, chỉ tiêu theo PYC');
  const [labReportNumber, setLabReportNumber] = useState('');
  const [labConclusion, setLabConclusion] = useState('Đạt theo phạm vi kết quả được tiếp nhận');
  const [certificateConclusion, setCertificateConclusion] = useState('Kết quả giám định phù hợp với phạm vi và tiêu chuẩn đã thống nhất.');
  const [reportInputs, setReportInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<PgdDossierFlowStepId>(() => getPgdDossierFlowStepIdForStatus(request.status));

  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const fieldInspection = pgd.fieldInspections.find((item) => item.requestId === request.id);
  const samples = pgd.samples.filter((item) => item.requestId === request.id);
  const dossierDocuments = pgd.dossierDocuments.filter((item) => item.requestId === request.id);
  const labRequests = pgd.labRequests.filter((item) => item.requestId === request.id);
  const labResults = pgd.labResults.filter((item) => item.requestId === request.id);
  const report = pgd.reports.find((item) => item.requestId === request.id);
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const labResultReview = pgd.labResultReviews.find((item) => item.requestId === request.id);
  const template = pgd.templates.find((item) => item.productGroup === request.productGroup && item.active) || pgd.templates.find((item) => item.active);
  useEffect(() => {
    setSelectedStepId(getPgdDossierFlowStepIdForStatus(request.status));
  }, [request.id, request.status]);
  useEffect(() => {
    if (!fieldInspection) return;
    setFieldForm({
      lotObservation: fieldInspection.lotObservation || '',
      packaging: fieldInspection.packaging || '',
      labeling: fieldInspection.labeling || '',
      measurements: Object.entries(fieldInspection.measurements || {}).map(([key, value]) => `${key}: ${value}`).join('\n'),
      nonconformities: (fieldInspection.nonconformities || []).join('\n'),
      inspectionResult: fieldInspection.inspectionResult || '',
      customerRepresentative: fieldInspection.customerRepresentative || '',
      note: fieldInspection.note || '',
    });
  }, [fieldInspection?.id]);
  useEffect(() => {
    let cancelled = false;
    void pgd.fetchDossierDocuments(request.id)
      .then((result) => {
        if (!cancelled) {
          setDossierRequirements(result.requirements);
          setDossierError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDossierRequirements(getPgdDossierRequirements(request.productGroup));
          setDossierError('Không tải được trạng thái chứng từ; checklist đang hiển thị để rà soát, vui lòng thử lại.');
        }
      });
    return () => { cancelled = true; };
  }, [pgd.fetchDossierDocuments, request.id]);
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
  const isManager = isPgdSystemManager(currentUser) || currentUser.pgdRole === 'PGD_ADMIN' || currentUser.pgdRole === 'PGD_MANAGER';
  const editDenial = getPgdDossierEditDenial(request, currentUser);
  const canEditDossier = isPgdSystemManager(currentUser) && editDenial === null;
  const deletionDenial = getPgdDossierDeletionDenial(request, currentUser);
  const showDossierActions = isPgdDossierActionViewer(currentUser);
  const showDeleteControl = showDossierActions;
  const canDelete = isPgdSystemManager(currentUser) && deletionDenial === null;
  const pgdUsers = pgd.users.filter((user) => user.active !== false && user.departmentScopes?.includes('PGD') && user.pgdRole !== 'PGD_VIEWER');
  const reviewerCandidates = pgdUsers.filter((user) => isPgdSystemManager(user) || ['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL'].includes(user.pgdRole || ''));

  const context: PgdTransitionContext = {
    hasApprovedAssignment: assignment?.status === 'APPROVED',
    hasFieldInspection: fieldInspection?.completed === true,
    hasSampleHandover: samples.some((sample) => sample.disposition === 'LAB' && Boolean(sample.handedOverAt)),
    labRequests,
    reportReady: Boolean(report?.conclusion?.trim()),
    hasCertificate: Boolean(certificate),
    signed: certificate?.status === 'SIGNED',
    labResultReview: labResultReview ? { status: labResultReview.status, conformity: labResultReview.conformity, retestRequired: labResultReview.retestRequired === true } : undefined,
  };
  Object.assign(context, { requestId: request.id, requestCode: request.requestCode });
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
  const nextState = request.status === 'REJECTED' || request.status === 'ON_HOLD'
    ? 'CAPABILITY_REVIEW' as const
    : PGD_WORKFLOW_STATES.find((state) => state.order === PGD_WORKFLOW_STATES.find((candidate) => candidate.code === request.status)?.order! + 1)?.code;
  const nextDenial = nextState ? getPgdOperationalStepGateDenial({ currentStatus: request.status, nextStatus: nextState, evidence: context }) : null;
  const currentStepId = getPgdDossierFlowStepIdForStatus(request.status);
  const selectedStepIsCurrent = selectedStepId === currentStepId;

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
    const inspection = buildPgdFieldInspection({ id: fieldInspection?.id || makeId('pgd-field'), requestId: request.id, performedAt: fieldInspection?.performedAt || new Date().toISOString(), location: request.inspectionLocation, inspectorUsernames: assignment?.inspectorUsernames || [currentUser.username], lotObservation: fieldForm.lotObservation.trim(), packaging: fieldForm.packaging.trim(), labeling: fieldForm.labeling.trim() || undefined, measurements, nonconformities: fieldForm.nonconformities.split('\n'), inspectionResult: fieldForm.inspectionResult.trim() || undefined, customerRepresentative: fieldForm.customerRepresentative.trim() || undefined, sampleIds: request.sampleIds, note: fieldForm.note.trim() || undefined });
    await pgd.saveFieldInspection(inspection);
  }, 'Đã hoàn tất biên bản hiện trường.');

  const splitSample = () => run(async () => {
    await pgd.splitSample({ requestId: request.id, sampleCodePrefix: request.requestCode, description: sampleDescription, quantity: Number(sampleQuantity), unit: request.unit });
  }, 'Đã tách phần mẫu gửi PTN và mẫu lưu.');

  const createLabRequest = () => run(async () => {
    const sample = samples.find((item) => item.disposition === 'LAB' && !item.handedOverAt);
    if (!sample) throw new Error('Cần tách mẫu và còn phần mẫu PTN chưa bàn giao.');
    await pgd.saveLabRequest({ id: makeId('pgd-lab'), domain: PGD_DOMAIN, requestId: request.id, sampleId: sample.id, status: 'SENT', laboratoryName: labName.trim() || 'PTN nội bộ TVCI', laboratoryCode: labCode.trim() || undefined, senderUnit: 'Phòng Giám định, Chứng nhận, Phát triển thị trường', testItems: labItems.split(',').map((item) => item.trim()).filter(Boolean), handover: { sentAt: new Date().toISOString(), senderUsername: currentUser.username, receiverName: labName.trim(), quantity: sample.quantity, note: `Bàn giao theo mã mẫu ${sample.sampleCode}` } });
  }, 'Đã lập và bàn giao yêu cầu PTN.');

  const saveLabResult = () => run(async () => {
    const labRequest = labRequests.find((item) => !item.resultId) || labRequests[0];
    if (!labRequest) throw new Error('Chưa có yêu cầu PTN để tiếp nhận kết quả.');
    await pgd.saveLabResult({ id: makeId('pgd-result'), domain: PGD_DOMAIN, requestId: request.id, labRequestId: labRequest.id, reportNumber: labReportNumber.trim() || undefined, receivedAt: new Date().toISOString(), values: [{ key: 'conclusion', label: 'Kết luận PTN', value: labConclusion, conclusion: labConclusion }] });
  }, 'Đã tiếp nhận kết quả PTN; hồ sơ sẽ cảnh báo nếu còn yêu cầu thiếu kết quả.');

  const saveCertificate = () => run(async () => {
    if (!template) throw new Error('Chưa có mẫu kết quả phù hợp với loại hình giám định.');
    if (reportIssues.length > 0) throw new Error(`Chưa thể lập báo cáo: ${reportIssues.map((issue) => issue.message).join(' ')}`);
    const templateSnapshot = snapshotPgdResultTemplate(template);
    const now = new Date().toISOString();
    const conclusion = certificateConclusion.trim();
    const reportRecord: PgdInspectionReport = { id: report?.id || makeId('pgd-report'), domain: PGD_DOMAIN, requestId: request.id, reportNumber: report?.reportNumber, title: `Báo cáo giám định · ${request.productName}`, standardSnapshot: [...request.standards], templateSnapshot, values: reportValues, conclusion, status: report?.status === 'APPROVED' ? 'APPROVED' : 'DRAFT', createdAt: report?.createdAt || now, updatedAt: now };
    await pgd.saveReport(reportRecord);
      await pgd.saveCertificate({ id: certificate?.id || makeId('pgd-certificate'), domain: PGD_DOMAIN, requestId: request.id, documentNumber: certificate?.documentNumber, title: `Chứng thư giám định · ${request.productName}`, standardSnapshot: [...request.standards], conclusion, templateSnapshot, status: certificate?.status === 'SIGNED' ? 'SIGNED' : 'DRAFT', signedByUsername: certificate?.signedByUsername, signedAt: certificate?.signedAt, createdAt: certificate?.createdAt || now, updatedAt: now });
    }, 'Đã lưu dự thảo chứng thư và bản chụp mẫu.');

  const advance = () => {
    if (!nextState) return;
    void run(async () => { await pgd.transitionRequest(request.id, nextState, context); }, `Đã chuyển hồ sơ sang ${getPgdStatusLabel(nextState)}.`);
  };

  const requestException = (status: 'REJECTED' | 'ON_HOLD', reason: string) => {
    void run(async () => {
      await pgd.transitionRequest(request.id, status, context, reason);
    }, status === 'REJECTED' ? 'Đã trả hồ sơ PGD để bổ sung.' : 'Đã tạm dừng hồ sơ PGD và ghi nhận lý do.');
  };

  const approve = () => {
    const role = getPgdApprovalRoleForStatus(request.status);
    if (!role) return;
    const sequence = role === 'TECHNICAL_REVIEW' ? 1 : 2;
    void run(async () => {
      await pgd.approveStep({ id: makeId(`pgd-approval-${sequence}`), domain: PGD_DOMAIN, requestId: request.id, sequence, role, status: 'PENDING', actedByUsername: currentUser.username, comment: role === 'TECHNICAL_REVIEW' ? 'Đã phê duyệt chuyên môn PGD.' : 'Đã phê duyệt lãnh đạo PGD.' });
    }, role === 'TECHNICAL_REVIEW' ? 'Đã phê duyệt chuyên môn và trình lãnh đạo.' : 'Đã phê duyệt lãnh đạo và ký chứng thư PGD.');
  };

  const deleteDossier = () => {
    if (!canDelete || busy) return;
    const reason = window.prompt('Nhập lý do xóa vĩnh viễn hồ sơ PGD:', '')?.trim();
    if (!reason) return;
    const confirmationCode = window.prompt(`Nhập lại chính xác mã hồ sơ để xác nhận xóa vĩnh viễn: ${request.requestCode}`, '')?.trim();
    if (!confirmationCode) return;
    if (!window.confirm(`Bạn chắc chắn muốn XÓA VĨNH VIỄN hồ sơ ${request.requestCode}? Toàn bộ dữ liệu liên kết và tệp đính kèm sẽ bị xóa, không thể khôi phục.`)) return;
    void run(async () => {
      await pgd.deleteRequest(request.id, reason, confirmationCode);
      onClose();
    }, 'Đã xóa vĩnh viễn hồ sơ PGD và ghi nhật ký tối thiểu.');
  };

  return <div data-testid="pgd-dossier-focus-shell" aria-label={`Không gian làm việc hồ sơ PGD ${request.requestCode}`} className={standalone ? 'flex h-full min-h-0 min-w-0 flex-col bg-white' : 'fixed inset-0 z-[80] flex items-stretch justify-center bg-white'}>
<div className={standalone ? 'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-slate-50' : 'flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-slate-50 shadow-2xl'}>
<header data-testid="pgd-dossier-mobile-header" className="flex min-w-0 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4 md:px-5" aria-label="Nhận diện hồ sơ PGD">
<div className="min-w-0">
<div className="flex flex-wrap items-center gap-2">
<span className="font-mono text-sm font-black text-slate-900">{request.requestCode}</span>
<StatusBadge status={request.status} />
<span className="text-[10px] text-slate-400">Cập nhật {formatDate(request.updatedAt)}</span>
</div>
<h2 className="mt-1 break-words text-base font-black text-slate-800">{request.productName} · {request.customerSnapshot.name}</h2>
</div>
<div data-testid="pgd-dossier-mobile-actions" aria-label="Thao tác hồ sơ PGD" className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto">{showDossierActions && <button type="button" disabled={!canEditDossier} onClick={() => setEditOpen(true)} title={editDenial || 'Sửa thông tin hồ sơ PGD'} className="mobile-touch-target min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-black text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Sửa thông tin hồ sơ</button>}<button type="button" onClick={onClose} aria-label="Đóng chi tiết hồ sơ PGD" className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
<X size={18} />
</button>
</div>
</header>
    <div className="mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-5 md:p-5"><PgdDossierFlow status={request.status} evidence={context} selectedStepId={selectedStepId} onSelectStep={setSelectedStepId} /><div className="mt-3"><PgdDossierStepWorkPanel request={request} currentUser={currentUser} selectedStepId={selectedStepId} dossierRequirements={dossierRequirements} dossierDocuments={dossierDocuments} samples={samples} canMutate={canMutate} completeDisabled={!selectedStepIsCurrent || Boolean(nextDenial) || busy || !canMutate} completeLabel={request.status === 'DRAFT' ? 'Bắt đầu xử lý' : request.status === 'REJECTED' || request.status === 'ON_HOLD' ? 'Tiếp tục xử lý' : request.status === 'TECHNICAL_REVIEW' ? 'Hoàn tất việc & trình phê duyệt' : request.status === 'LEADERSHIP_APPROVAL' ? 'Phê duyệt & ký' : nextState ? 'Hoàn tất việc' : undefined} onCompleteCurrent={selectedStepIsCurrent ? (request.status === 'TECHNICAL_REVIEW' || request.status === 'LEADERSHIP_APPROVAL' ? approve : nextState ? advance : undefined) : undefined} onOpenChecklist={() => setSelectedStepId('intake')} onOpenDrafting={(input) => onOpenDrafting?.(request, input)} onRequestException={requestException} exceptionBusy={busy} /></div><div className="hidden mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"><main className="min-w-0 space-y-3"><section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Khách hàng</div><div className="mt-1 text-xs font-black text-slate-800">{request.customerSnapshot.name}</div><div className="mt-1 text-[10px] text-slate-500">{request.customerSnapshot.address}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Lô / số lượng</div><div className="mt-1 text-xs font-black text-slate-800">{request.lotCode || 'Chưa ghi nhận'}</div><div className="mt-1 text-[10px] text-slate-500">{request.quantity} {request.unit || ''} {request.weight ? `· ${request.weight} ${request.weightUnit || ''}` : ''}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Phạm vi</div><div className="mt-1 line-clamp-3 text-[10px] font-bold text-slate-700">{request.inspectionScope}</div></div><div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[9px] font-black uppercase text-slate-400">Ngày tiếp nhận</div><div className="mt-1 text-xs font-black text-slate-800">{formatRegistryDate(request.registryMetadata?.receivedAt)}</div><div className="mt-1 text-[10px] text-slate-500">{request.method || 'Chưa chọn phương thức'}</div></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><Users size={15} className="text-blue-600" /> Phân công theo năng lực</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Field label="KTV / chuyên gia *"><TextInput required aria-required="true" list="pgd-inspectors" value={inspectorInput} onChange={(event) => setInspectorInput(event.target.value)} /><datalist id="pgd-inspectors">{pgdUsers.map((user) => <option key={user.username} value={user.username}>{user.name} · {user.pgdRole}</option>)}</datalist></Field><Field label="Người soát xét kỹ thuật *"><TextInput required aria-required="true" list="pgd-reviewers" value={reviewerInput} onChange={(event) => setReviewerInput(event.target.value)} /><datalist id="pgd-reviewers">{reviewerCandidates.map((user) => <option key={user.username} value={user.username}>{user.name} · {user.pgdRole}</option>)}</datalist></Field><div className="flex items-end"><button type="button" disabled={!canMutate || busy || !assignmentAccess.editable || !inspectorInput.trim()} onClick={saveAssignment} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-black text-blue-700 disabled:opacity-50"><ShieldCheck size={14} />{assignment?.status === 'APPROVED' ? 'Cập nhật phân công' : 'Lưu phân công'}</button></div></div>{assignment && <p className="mt-2 text-[10px] text-slate-500">Trạng thái: <b className="text-slate-700">{assignment.status}</b> · KTV: {assignment.inspectorUsernames.join(', ') || 'Chưa chọn'} · Soát xét: {assignment.technicalReviewerUsername || 'Chưa chọn'}</p>}{!assignmentAccess.editable && <p className="mt-2 text-[9px] font-bold text-amber-700">{assignmentAccess.reason}</p>}</section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><ClipboardCheck size={15} className="text-blue-600" /> Hiện trường, lấy mẫu và bàn giao PTN</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Biên bản hiện trường</div><div className="mt-1 text-[9px] text-slate-500">{fieldInspection ? `Hoàn tất lúc ${formatDate(fieldInspection.performedAt)}` : 'Chưa hoàn tất'}</div><div className="mt-2 grid gap-1.5"><Field label="Ghi nhận lô hàng *"><TextInput required aria-required="true" aria-label="Ghi nhận lô hàng" value={fieldForm.lotObservation} onChange={(event) => setFieldForm((current) => ({ ...current, lotObservation: event.target.value }))} /></Field><Field label="Bao gói *"><TextInput required aria-required="true" aria-label="Bao gói" value={fieldForm.packaging} onChange={(event) => setFieldForm((current) => ({ ...current, packaging: event.target.value }))} /></Field><Field label="Nhãn hàng hóa"><TextInput aria-label="Nhãn hàng hóa" value={fieldForm.labeling} onChange={(event) => setFieldForm((current) => ({ ...current, labeling: event.target.value }))} /></Field><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Kích thước và đo đạc</span><textarea aria-label="Kích thước và đo đạc" rows={2} value={fieldForm.measurements} onChange={(event) => setFieldForm((current) => ({ ...current, measurements: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Điểm không phù hợp</span><textarea aria-label="Điểm không phù hợp" rows={2} value={fieldForm.nonconformities} onChange={(event) => setFieldForm((current) => ({ ...current, nonconformities: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /></label><Field label="Kết quả giám định *"><textarea required aria-required="true" aria-label="Kết quả giám định" rows={2} value={fieldForm.inspectionResult} onChange={(event) => setFieldForm((current) => ({ ...current, inspectionResult: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /></Field><Field label="Đại diện khách hàng"><TextInput aria-label="Đại diện khách hàng" value={fieldForm.customerRepresentative} onChange={(event) => setFieldForm((current) => ({ ...current, customerRepresentative: event.target.value }))} /></Field></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable || !fieldForm.lotObservation.trim() || !fieldForm.packaging.trim() || !fieldForm.inspectionResult.trim()} onClick={saveFieldInspection} className="mt-2 min-h-10 w-full rounded-lg bg-blue-600 px-2 text-[10px] font-black text-white disabled:opacity-50">{fieldInspection ? 'Ghi nhận lại biên bản' : 'Hoàn tất hiện trường'}</button></div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Tách mẫu</div><div className="mt-1 grid gap-1.5"><Field label="Số lượng mẫu *"><TextInput required aria-required="true" type="number" min="2" step="1" value={sampleQuantity} onChange={(event) => setSampleQuantity(event.target.value)} /></Field><Field label="Mô tả mẫu *"><TextInput required aria-required="true" value={sampleDescription} onChange={(event) => setSampleDescription(event.target.value)} /></Field></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable || Number(sampleQuantity) < 2 || !sampleDescription.trim()} onClick={splitSample} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">Tách phần PTN + mẫu lưu</button><p className="mt-1 text-[9px] text-slate-400">{samples.length ? `${samples.length} phần mẫu đã tạo` : 'Chưa có mẫu'}</p></div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Yêu cầu PTN</div><div className="mt-1 grid gap-1.5"><Field label="Phòng thử nghiệm *"><TextInput required aria-required="true" value={labName} onChange={(event) => setLabName(event.target.value)} /></Field><Field label="Mã PTN"><TextInput value={labCode} onChange={(event) => setLabCode(event.target.value)} /></Field><Field label="Hạng mục thử *"><TextInput required aria-required="true" value={labItems} onChange={(event) => setLabItems(event.target.value)} /></Field></div><button type="button" disabled={!canMutate || busy || !fieldAccess.editable || !labName.trim() || !labItems.trim()} onClick={createLabRequest} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">Giao mẫu & lập PYC PTN</button><p className="mt-1 text-[9px] text-slate-400">{labRequests.length} PYC · {labResults.length} KQTN</p></div></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black text-slate-800"><FlaskConical size={15} className="text-blue-600" /> Kết quả PTN và báo cáo / chứng thư linh hoạt</h3><div className="mt-2 grid gap-2 md:grid-cols-2"><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Tiếp nhận KQTN</div><div className="mt-2 grid gap-1.5"><Field label="Số phiếu KQTN"><TextInput aria-label="Số phiếu KQTN" value={labReportNumber} onChange={(event) => setLabReportNumber(event.target.value)} /></Field><Field label="Kết luận KQTN *"><textarea required aria-required="true" rows={2} value={labConclusion} onChange={(event) => setLabConclusion(event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /></Field></div><button type="button" disabled={!canMutate || busy || !labAccess.editable || labRequests.length === 0 || !labConclusion.trim()} onClick={saveLabResult} className="mt-2 min-h-10 w-full rounded-lg bg-blue-600 px-2 text-[10px] font-black text-white disabled:opacity-50">Ghi nhận kết quả</button>{labRequests.some((item) => !item.resultId) && <p className="mt-1 text-[9px] font-bold text-amber-700">Cảnh báo: còn PYC PTN chưa có kết quả.</p>}</div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] font-black text-slate-700">Báo cáo / chứng thư</div><p className="mt-1 text-[9px] text-slate-500">{template ? `Mẫu ${template.code || template.id} · phiên bản ${template.version}` : 'Chưa có mẫu'}{report ? ` · báo cáo ${report.status}` : ''}</p><div className="mt-2 grid gap-1.5">{template?.fields.map((field) => { const fieldDescriptor = `${field.key} ${field.label}`.toLowerCase(); const isConclusion = fieldDescriptor.includes('conclusion') || fieldDescriptor.includes('kết luận'); const value = isConclusion ? certificateConclusion : reportInputs[field.key] || ''; const updateValue = (nextValue: string) => { if (isConclusion) setCertificateConclusion(nextValue); else setReportInputs((current) => ({ ...current, [field.key]: nextValue })); }; const requiredProps = field.required ? { required: true, 'aria-required': true } : {}; return <label key={field.key} className="block"><span className="mb-1 block text-[9px] font-black text-slate-500">{field.label}{field.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}{field.unit ? ` · ${field.unit}` : ''}</span>{field.type === 'TABLE' ? <textarea {...requiredProps} rows={2} value={value} onChange={(event) => updateValue(event.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] outline-none focus:border-blue-400" /> : field.type === 'BOOLEAN' ? <SelectInput {...requiredProps} value={value} onChange={(event) => updateValue(event.target.value)}><option value="">Chọn...</option><option value="true">Có</option><option value="false">Không</option></SelectInput> : field.type === 'DATE' ? <PgdcnDateInput {...requiredProps} value={value} onChange={updateValue} /> : <TextInput {...requiredProps} type={field.type === 'NUMBER' ? 'number' : 'text'} value={value} onChange={(event) => updateValue(event.target.value)} />}</label>; })}</div>{reportIssues.length > 0 && <p role="alert" className="mt-2 text-[9px] font-bold text-amber-700">Còn {reportIssues.length} trường cần xử lý trước khi lập báo cáo.</p>}{!template && <p className="mt-2 text-[9px] font-bold text-amber-700">Chưa có mẫu kết quả phù hợp; chọn mẫu trước khi lập báo cáo.</p>}<button type="button" disabled={!canMutate || busy || !reportAccess.editable || labResults.length === 0 || reportIssues.length > 0 || certificate?.status === 'SIGNED'} onClick={saveCertificate} className="mt-2 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700 disabled:opacity-50">{certificate ? 'Cập nhật dự thảo chứng thư' : 'Tạo báo cáo + dự thảo chứng thư'}</button>{report && <p className="mt-1 text-[9px] font-bold text-blue-700">Báo cáo đã snapshot {report.standardSnapshot.length} tiêu chuẩn; {report.values.length} trường trong mẫu.</p>}{certificate && <p className="mt-1 text-[9px] font-bold text-emerald-700">Đã snapshot mẫu lúc {formatDate(certificate.templateSnapshot?.capturedAt)} · {certificate.status}</p>}</div></div></section>
      {editOpen && <PgdRequestEditPanel request={request} onClose={() => setEditOpen(false)} />}
      <PgdCaseEvidencePanel request={request} requirements={dossierRequirements} dossierDocuments={dossierDocuments} samples={samples} canMutate={canMutate} editable={getPgdPostSignatureMutationDenial(request.status) === null} lockedReason={getPgdPostSignatureMutationDenial(request.status)} loadError={dossierError} />
      <PgdSourceFormsPanel request={request} currentUser={currentUser} editable={getPgdPostSignatureMutationDenial(request.status) === null} />
    </main><aside className="min-w-0 space-y-3"><section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="text-xs font-black text-slate-800">Quy trình PGD</h3><div className="mt-3 space-y-1.5">{PGD_WORKFLOW_STATES.map((state) => <div key={state.code} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${state.code === request.status ? 'bg-blue-50 text-blue-700' : state.order < (PGD_WORKFLOW_STATES.find((item) => item.code === request.status)?.order ?? 0) ? 'text-emerald-600' : 'text-slate-400'}`}><span className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-black">{state.order < (PGD_WORKFLOW_STATES.find((item) => item.code === request.status)?.order ?? 0) ? '✓' : state.order + 1}</span><span className="text-[10px] font-bold">{state.label}</span></div>)}</div></section><section className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><h3 className="flex items-center gap-2 text-xs font-black text-blue-900"><LockKeyhole size={14} /> Cổng tiếp theo</h3>{request.status === 'TECHNICAL_REVIEW' || request.status === 'LEADERSHIP_APPROVAL' ? <><p className="mt-2 text-[10px] leading-4 text-blue-800">{request.status === 'TECHNICAL_REVIEW' ? 'Soát xét kỹ thuật là bước hoàn thiện báo cáo; sau khi đủ bằng chứng, trình phê duyệt hai cấp.' : 'Bước này cần phê duyệt của lãnh đạo; không chuyển trạng thái trực tiếp.'}</p><button type="button" disabled={!canMutate || busy || (request.status === 'TECHNICAL_REVIEW' && Boolean(nextDenial))} onClick={approve} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50"><BadgeCheck size={14} />{request.status === 'TECHNICAL_REVIEW' ? 'Hoàn tất soát xét, trình phê duyệt lãnh đạo' : 'Phê duyệt lãnh đạo / ký'}</button></> : nextState ? <><p className={`mt-2 text-[10px] leading-4 ${nextDenial ? 'text-amber-800' : 'text-blue-800'}`}>{nextDenial || `Có thể chuyển sang: ${getPgdStatusLabel(nextState)}.`}</p><button type="button" disabled={!canMutate || busy || Boolean(nextDenial)} onClick={advance} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight size={14} /> Chuyển bước</button></> : <p className="mt-2 text-[10px] text-emerald-700">Hồ sơ đã ở cuối quy trình.</p>}</section><section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="text-xs font-black text-slate-800">Tài liệu & truy vết</h3><div className="mt-2 space-y-1.5 text-[10px] text-slate-500"><div className="flex justify-between"><span>Mẫu</span><b className="text-slate-700">{samples.length}</b></div><div className="flex justify-between"><span>PYC PTN</span><b className="text-slate-700">{pgd.approvals.filter((item) => item.requestId === request.id).length}</b></div><div className="flex justify-between"><span>Chứng thư</span><b className="text-slate-700">{certificate ? getPgdCertificateStatusLabel(certificate.status) : 'Chưa tạo'}</b></div></div>{deletionDenial && showDeleteControl && <p className="mt-3 border-t border-slate-100 pt-2 text-[9px] font-bold text-amber-700">Xóa hồ sơ: {deletionDenial}</p>}<p className="mt-3 border-t border-slate-100 pt-2 text-[9px] leading-4 text-slate-400">Xóa vĩnh viễn sẽ xóa dữ liệu liên kết và tệp; chỉ giữ nhật ký tối thiểu.</p></section></aside></div></div><footer data-testid="pgd-dossier-mobile-footer" className="mobile-safe-bottom flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center md:px-5"><span className="min-w-0 break-words">Lĩnh vực: <b className="font-mono text-blue-700">{PGD_DOMAIN}</b> · Người thao tác: {currentUser.username}</span><div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:justify-end"><button type="button" disabled={!showDeleteControl || busy || !canDelete} onClick={deleteDossier} title={deletionDenial || 'Xóa vĩnh viễn hồ sơ PGD'} className="min-h-10 rounded-lg border border-rose-200 px-3 font-black text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">Xóa hồ sơ</button><button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 hover:bg-slate-50">Đóng</button></div></footer></div></div>;
}

export type PgdWorkspaceProps = {
  embedded?: boolean;
  initialSection?: PgdEntrySection;
  initialRequestId?: string;
  initialDraftingOpen?: boolean;
  initialDraftRequestId?: string;
  initialDraftRequirementCode?: string;
  initialDraftTemplateKind?: PgdDocumentTemplateKind;
  onRequestClose?: () => void;
  onActiveSectionChange?: (section: PgdSection) => void;
};

export default function PgdWorkspace({ embedded = false, initialSection = 'dashboard', initialRequestId, initialDraftingOpen = false, initialDraftRequestId, initialDraftRequirementCode, initialDraftTemplateKind, onRequestClose, onActiveSectionChange }: PgdWorkspaceProps = {}) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pgd = usePgdStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<PgdSection>(initialDraftingOpen ? 'templates' : initialSection === 'intake' ? 'requests' : initialSection);
  const [intakeOpen, setIntakeOpen] = useState(initialSection === 'intake');
  const [intakeMinimized, setIntakeMinimized] = useState(false);
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [docxSettingsOpen, setDocxSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'QUEUE' | 'DATA'>('QUEUE');
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [draftingRequestId, setDraftingRequestId] = useState<string>();
  const [draftingRequirementCode, setDraftingRequirementCode] = useState<string>();
  const [draftingTemplateKind, setDraftingTemplateKind] = useState<PgdDocumentTemplateKind>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [registerGroup, setRegisterGroup] = useState<'ALL' | PgdInspectionRequestInput['productGroup']>('ALL');
  const [registerStatus, setRegisterStatus] = useState<'ALL' | PgdInspectionStatus>('ALL');
  const hasPgdAccess = Boolean(currentUser && (isPgdSystemManager(currentUser) || currentUser.departmentScopes?.includes('PGD')));

  useEffect(() => {
    let cancelled = false;
    getPcnSession().then((session) => { if (!cancelled) setCurrentUser(session?.user || null); }).catch(() => { if (!cancelled) setCurrentUser(null); }).finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, [setCurrentUser]);

  useEffect(() => { if (sessionChecked && currentUser && hasPgdAccess) void pgd.load().catch(() => undefined); }, [currentUser, hasPgdAccess, pgd.load, sessionChecked]);

  useEffect(() => {
    setActiveSection(initialDraftingOpen ? 'templates' : initialSection === 'intake' ? 'requests' : initialSection);
    setIntakeOpen(initialSection === 'intake');
    setIntakeMinimized(false);
  }, [initialDraftingOpen, initialSection]);

  useEffect(() => {
    if (!initialRequestId) {
      if (embedded) setSelectedRequestId(undefined);
      return;
    }
    setSelectedRequestId(initialRequestId);
    setActiveSection('requests');
    setIntakeOpen(false);
    setIntakeMinimized(false);
  }, [initialRequestId]);

  const openSection = (section: PgdEntrySection, preserveRequest = false) => {
    const nextSection = section === 'intake' ? 'requests' : section;
    setActiveSection(nextSection);
    if (!preserveRequest) {
      setSelectedRequestId(undefined);
      onRequestClose?.();
    }
    if (section === 'intake') { setIntakeOpen(true); setIntakeMinimized(false); }
    setMobileOpen(false);
    onActiveSectionChange?.(nextSection);
  };

  const visibleRequests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const activeRequests = pgd.requests.filter((request) => !request.deletedAt && isPgdV1ProductGroup(request.productGroup));
    if (!normalized) return activeRequests;
    return activeRequests.filter((request) => [request.requestCode, request.registryMetadata?.registrationNumber, request.customerSnapshot.name, request.productName, request.lotCode, request.inspectionLocation, request.method, ...(request.registryMetadata?.documents || []).flatMap((document) => [document.kind, document.number])].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized));
  }, [pgd.requests, query]);

  const queueRows = useMemo<PgdDossierQueueRow[]>(() => visibleRequests.map((request) => {
    const requirements = getPgdDossierRequirements(request.productGroup).filter((requirement) => requirement.required);
    const checklist = request.dossierChecklist || [];
    const requiredDocumentPresent = requirements.filter((requirement) => checklist.some((item) => item.requirementCode === requirement.code && (item.status === 'PRESENT' || item.status === 'WAIVED'))).length;
    const currentStepId = getPgdDossierFlowStepIdForStatus(request.status);
    const currentStep = PGD_DOSSIER_FLOW_STEPS.find((step) => step.id === currentStepId) || PGD_DOSSIER_FLOW_STEPS[0];
    return {
      requestId: request.id,
      requestCode: request.requestCode,
      customerName: request.customerSnapshot.name,
      productName: request.productName,
      statusLabel: getPgdStatusLabel(request.status),
      currentStepNumber: getPgdDossierCurrentStepNumber(request.status),
      currentStepLabel: currentStep.label,
      requiredDocumentPresent,
      requiredDocumentTotal: requirements.length,
      missingRequiredCount: Math.max(0, requirements.length - requiredDocumentPresent),
      ownerUsername: request.ownerUsername,
      ownerDisplayName: getPgdUserDisplayName(request.ownerUsername, pgd.users),
      productGroup: PGD_PRODUCT_GROUP_LABELS[request.productGroup],
    };
  }), [pgd.users, visibleRequests]);

  if (!sessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-xs font-bold text-slate-700">Đang xác thực phiên làm việc...</div>;
  if (!currentUser) return <PgdLoginScreen />;

  const hasAccess = hasPgdAccess;
  if (!hasAccess) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4"><div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-xl"><ShieldCheck className="mx-auto text-amber-500" size={28} /><h1 className="mt-3 text-lg font-black text-slate-900">Chưa được cấp phạm vi PGD</h1><p className="mt-2 text-xs leading-5 text-slate-600">Tài khoản này chỉ có quyền PCN. Hãy nhờ quản trị Phòng Giám định, Chứng nhận, Phát triển thị trường cấp scope PGD; dữ liệu PCN vẫn được bảo vệ riêng.</p><button type="button" onClick={async () => { await clearPcnSession().catch(() => undefined); clearCurrentUser(); }} className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 text-xs font-black text-white">Đăng xuất</button></div></div>;

  const isAdmin = currentUser.systemRole === 'admin' || currentUser.role === 'admin' || currentUser.pgdRole === 'PGD_ADMIN' || currentUser.pgdRole === 'PGD_MANAGER';
  const canMutate = currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer';
  const selectedRequest = pgd.requests.find((request) => request.id === selectedRequestId);
  const standaloneRequest = embedded && Boolean(initialRequestId);
  const openRequest = (id: string) => { setSelectedRequestId(id); openSection('requests', true); if (embedded) router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(id)}`); };
  const openDraftingFromStep = (request: PgdInspectionRequest, input: { templateKind: PgdDocumentTemplateKind; requirementCode: string }) => {
    const query = new URLSearchParams({ requestId: request.id, requirementCode: input.requirementCode, templateKind: input.templateKind }).toString();
    return `/pgdcn/pgd/drafting?${query}`;
  };
  const logout = async () => { await clearPcnSession().catch(() => undefined); pgd.reset(); clearCurrentUser(); };
  const openCreateRequest = () => { openSection('requests'); setIntakeOpen(true); setIntakeMinimized(false); };
  const createDone = (id: string) => { setIntakeOpen(false); setIntakeMinimized(false); setSelectedRequestId(id); openSection('requests', true); if (embedded) router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(id)}`); };
  const sectionRequests = activeSection === 'requests'
    ? visibleRequests.filter((request) => (registerGroup === 'ALL' || request.productGroup === registerGroup) && (registerStatus === 'ALL' || request.status === registerStatus))
    : pgd.requests;
  const statusCount = (status: PgdInspectionStatus) => pgd.requests.filter((request) => request.status === status).length;
  const requestCreateAction = activeSection === 'requests' ? <div className="flex justify-end px-3 pt-3 md:px-5 md:pt-5"><button type="button" disabled={!canMutate} onClick={openCreateRequest} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-[10px] font-black text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={15} /> Tạo PYC</button></div> : null;

  const dashboard = <div className="space-y-4 p-3 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Phòng Giám định, Chứng nhận, Phát triển thị trường</div><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Tổng quan hoạt động giám định</h1><p className="mt-1 text-[11px] text-slate-500">Từ PYC, năng lực, hiện trường, PTN đến phê duyệt và trả chứng thư.</p></div><button type="button" disabled={!canMutate} onClick={openCreateRequest} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-[10px] font-black text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={15} /> Tạo PYC</button></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8"><Metric label="Tổng hồ sơ" value={pgd.requests.length} /><Metric label="Chờ năng lực" value={statusCount('CAPABILITY_REVIEW')} tone="text-amber-600" /><Metric label="Đang hiện trường" value={statusCount('FIELD_INSPECTION')} tone="text-blue-600" /><Metric label="Chờ KQTN" value={statusCount('WAITING_LAB_RESULTS')} tone="text-orange-600" /><Metric label="Chờ duyệt" value={statusCount('LEADERSHIP_APPROVAL')} tone="text-indigo-600" /><Metric label="Đã ký" value={statusCount('SIGNED')} tone="text-emerald-600" /><Metric label="Đã trả" value={statusCount('RESULT_RETURNED')} tone="text-teal-600" /><Metric label="Đã lưu" value={statusCount('ARCHIVED')} tone="text-slate-600" /></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-800">Hồ sơ gần đây</h2><p className="mt-0.5 text-[10px] text-slate-400">Mỗi thẻ dẫn về đúng một hồ sơ PGD.</p></div><button type="button" onClick={() => setActiveSection('requests')} className="text-[10px] font-black text-blue-600">Xem tất cả</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{pgd.requests.slice(0, 4).map((request) => <RequestCard key={request.id} request={request} users={pgd.users} onOpen={() => openRequest(request.id)} />)}{pgd.requests.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-[11px] text-slate-400">Chưa có PYC giám định. Bắt đầu từ Tạo PYC.</div>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-black text-slate-800"><ClipboardList size={16} className="text-blue-600" /> Danh mục PGD</h2><div className="mt-3 space-y-2">{pgd.catalog.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black text-slate-800">{item.name}</div><div className="mt-1 font-mono text-[9px] text-blue-600">{item.code}</div></div><span className="rounded bg-white px-1.5 py-1 text-[9px] font-bold text-slate-500">{item.slaLabel}</span></div><div className="mt-2 flex flex-wrap gap-1">{item.defaultStandards.map((standard) => <span key={standard} className="rounded bg-white px-1.5 py-1 text-[9px] text-slate-500">{standard}</span>)}</div></div>)}{pgd.catalog.length === 0 && <p className="text-[10px] text-slate-400">Đang tải danh mục PGD...</p>}</div></section></div></div>;

  const requestRegister = <div className="space-y-3 p-3 md:p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Sổ đăng ký</div><h1 className="mt-1 text-xl font-black text-slate-900">Sổ đăng ký hồ sơ giám định</h1><p className="mt-1 text-[11px] text-slate-500">Theo dõi các trường đăng ký đã chụp dữ liệu từ PYC mới; không sửa trực tiếp trên bảng.</p></div><div data-testid="pgd-register-toolbar" className="pgdcn-toolbar-nowrap w-full lg:w-auto lg:min-w-[48rem]"><label className="pgdcn-toolbar-search block min-w-0"><span className="mb-1 block text-[10px] font-black text-slate-600">Tìm hồ sơ PGD</span><div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><TextInput aria-label="Tìm hồ sơ PGD" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" /></div></label><label className="pgdcn-toolbar-filter block min-w-0"><span className="mb-1 block text-[10px] font-black text-slate-600">Nhóm sản phẩm</span><SelectInput aria-label="Lọc nhóm sản phẩm PGD" value={registerGroup} onChange={(event) => setRegisterGroup(event.target.value as typeof registerGroup)} className="w-full min-w-0"><option value="ALL">Tất cả nhóm</option>{(Object.entries(PGD_PRODUCT_GROUP_LABELS) as Array<[PgdInspectionRequestInput['productGroup'], string]>).map(([group, label]) => <option key={group} value={group}>{label}</option>)}</SelectInput></label><label className="pgdcn-toolbar-filter block min-w-0"><span className="mb-1 block text-[10px] font-black text-slate-600">Trạng thái</span><SelectInput aria-label="Lọc trạng thái PGD" value={registerStatus} onChange={(event) => setRegisterStatus(event.target.value as typeof registerStatus)} className="w-full min-w-0"><option value="ALL">Tất cả trạng thái</option>{PGD_WORKFLOW_STATES.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</SelectInput></label><button type="button" onClick={() => void pgd.load(true)} title="Tải lại sổ đăng ký PGD" className="pgdcn-toolbar-actions inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-500 hover:text-blue-600"><RefreshCw size={15} /></button></div></div><PgdRegisterTable requests={sectionRequests} users={pgd.users} onOpen={openRequest} /></div>;

  const operationProjection = <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 md:px-5"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">Quản lý PGD</p><h1 className="mt-1 text-lg font-black text-slate-900">Hồ sơ cần xử lý</h1><p className="mt-1 text-[10px] text-slate-500">Chọn Hàng đợi hồ sơ để xử lý theo từng việc hoặc Sổ dữ liệu để rà soát toàn bộ trường.</p></div><div className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Chế độ quản lý PGD"><button type="button" role="tab" aria-selected={viewMode === 'QUEUE'} onClick={() => setViewMode('QUEUE')} className={`min-h-9 rounded-md px-3 text-[10px] font-black ${viewMode === 'QUEUE' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white'}`}>Hàng đợi hồ sơ</button><button type="button" role="tab" aria-selected={viewMode === 'DATA'} onClick={() => setViewMode('DATA')} className={`min-h-9 rounded-md px-3 text-[10px] font-black ${viewMode === 'DATA' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white'}`}>Sổ dữ liệu</button></div></div>{viewMode === 'QUEUE' ? <PgdDossierQueueView rows={queueRows} onOpenDossier={openRequest} /> : <PgdSummaryRegisterView requests={pgd.requests} assignments={pgd.assignments} samples={pgd.samples} labRequests={pgd.labRequests} labResults={pgd.labResults} reports={pgd.reports} certificates={pgd.certificates} users={pgd.users} currentUsername={currentUser.username} canEdit={canMutate} onOpenRequest={openRequest} onUpdateRequest={pgd.updateRequest} onAssignOwner={pgd.assignOwner} />}</div>;
  const sampleRegister = <PgdSampleOperationsView requests={pgd.requests} samples={pgd.samples} labRequests={pgd.labRequests} labResults={pgd.labResults} onOpenRequest={openRequest} />;
  const projection = activeSection === 'templates'
    ? <PgdDraftingWorkspaceView templates={pgd.documentTemplates} documents={pgd.documents} canMutate={canMutate} initialRequestId={initialDraftRequestId || draftingRequestId} initialRequirementCode={initialDraftRequirementCode || draftingRequirementCode} initialTemplateKind={initialDraftTemplateKind || draftingTemplateKind} onOpenSettings={() => setDocxSettingsOpen(true)} />
    : activeSection === 'sample-operations' ? sampleRegister : operationProjection;

  const requestDetail = selectedRequest ? <PgdRequestDetail request={selectedRequest} currentUser={currentUser} standalone={standaloneRequest} onOpenDrafting={openDraftingFromStep} onClose={() => { setSelectedRequestId(undefined); onRequestClose?.(); }} /> : null;

  return <>
    <div className={embedded ? 'min-w-0' : 'flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800'}>
      <Toaster position="top-right" richColors />
      {!embedded && <PgdSidebar currentUser={currentUser} activeSection={activeSection} collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onNavigate={openSection} onCloseMobile={() => setMobileOpen(false)} onLogout={logout} />}
      <div className={embedded ? 'min-w-0' : 'flex min-w-0 flex-1 flex-col'}>
        {!embedded && <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5"><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu PGD" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={18} /></button><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-wider text-blue-600">IEMM • TVCI · {PGD_SECTION_LABELS[activeSection]}</div><div className="truncate text-xs font-bold text-slate-600">Phòng Giám định, Chứng nhận, Phát triển thị trường · Dữ liệu PGD riêng</div></div></div><div className="hidden items-center gap-2 text-[10px] font-bold text-slate-400 sm:flex"><CheckCircle2 size={14} className="text-emerald-500" /> Tài khoản: {currentUser.username}</div></header>}
        <main className={embedded ? 'min-w-0' : 'mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto'}>
          {standaloneRequest && requestDetail ? requestDetail : <>
            {requestCreateAction}
            {activeSection === 'dashboard' ? dashboard : activeSection === 'requests' ? requestRegister : projection}
          </>}
        </main>
        {!embedded && <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white p-1.5 lg:hidden" aria-label="Menu PGD di động">{(['dashboard', 'requests', 'operations', 'sample-operations', 'templates'] as PgdSection[]).map((section) => <button type="button" key={section} onClick={() => openSection(section)} className={`min-h-11 min-w-[4.75rem] rounded-lg px-2 text-[9px] font-black ${activeSection === section ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>{PGD_SECTION_LABELS[section]}</button>)}</nav>}
      </div>
    </div>
    {!standaloneRequest && requestDetail}
    {docxSettingsOpen && <PgdDocxSettingsModal templates={pgd.documentTemplates} canMutate={canMutate && isAdmin} onClose={() => setDocxSettingsOpen(false)} />}
    {/* data-testid="pgd-intake-modal" aria-labelledby="pgd-intake-title" data-testid="pgd-intake-body" data-testid="pgd-intake-footer" */}
    <PgdcnWindowsWorkflowModal
      open={intakeOpen}
      minimized={intakeMinimized}
      title="Tạo PYC và bắt đầu bộ hồ sơ"
      eyebrow="PGD · Hồ sơ PYC mới"
      description="Nhập thông tin tối thiểu để mở hồ sơ, lập bảng mẫu và tiếp tục hoàn thiện danh mục hồ sơ theo quy trình PGD."
      contextLabel="QC20 là nhóm nghiệp vụ PGD"
      accent="blue"
      testId="pgd-intake-modal"
      bodyTestId="pgd-intake-body"
      footerTestId="pgd-intake-footer"
      titleId="pgd-intake-title"
      busy={intakeSaving}
      onClose={() => { if (!intakeSaving) { setIntakeOpen(false); setIntakeMinimized(false); } }}
      onMinimize={() => setIntakeMinimized(true)}
      onRestore={() => setIntakeMinimized(false)}
      footer={<><p className="text-[10px] text-slate-400">{canMutate ? 'PYC được tạo ở Bản nháp; các dòng mẫu được lưu cùng hồ sơ.' : 'Tài khoản chỉ đọc: không được tạo hoặc sửa hồ sơ PGD.'}</p><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setIntakeOpen(false)} disabled={intakeSaving} className="min-h-10 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="submit" form="pgd-intake-form" disabled={intakeSaving || !canMutate} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={14} />{intakeSaving ? 'Đang tạo PYC...' : 'Tạo PYC & mở hồ sơ'}</button></div></>}
    >
      <PgdIntakeForm catalog={pgd.catalog} customers={pgd.customers} currentUser={currentUser} canMutate={canMutate} onCreated={createDone} onSavingChange={setIntakeSaving} />
    </PgdcnWindowsWorkflowModal>
  </>;
}
