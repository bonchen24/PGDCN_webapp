'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Archive,
  Bell,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  FilePlus2,
  FolderOpen,
  Menu,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import PcnLoginScreen from './PcnLoginScreen';
import PcnCustomersManagementView from './PcnCustomersManagementView';
import { PcnDossierDetailView } from './PcnDossierDetailView';
import { PcnUserManagementView } from './PcnUserManagementView';
import PcnSettingsView from './PcnSettingsView';
import PcnPersonalSettingsPanel from './PcnPersonalSettingsPanel';
import PcnOcrPanel from './PcnOcrPanel';
import PcnCatalogCombobox, { type PcnCatalogOption } from './PcnCatalogCombobox';
import { PcnNotificationDropdown } from './PcnNotificationDropdown';
import { PcnWorkQueueView } from './PcnWorkQueueView';
import { PcnPipelineBoard } from './PcnPipelineBoard';
import PcnOperationsRegisterView from './PcnOperationsRegisterView';
import PcnLabOperationsView from './PcnLabOperationsView';
import PcnAssistantView from './PcnAssistantView';
import PcnDraftingWorkspaceView from './PcnDraftingWorkspaceView';
import { ActivityLogView } from './ActivityLogView';
import { PcnUserKpiTable } from './PcnUserKpiTable';
import PcnSidebar, { PCN_SECTION_ICONS } from './PcnSidebar';
import { usePcnStore } from '../store-pcn';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { clearPcnSession, getPcnSession } from '../utils/pcnAuthApi';
import type { AppNotification, CertificationDossier, CertificationProposal, PcnDossierStatus, PcnCertificationField } from '../types';
import type { PcnProposalUpdateInput } from '../utils/pcnProposalApi';
import { PcnIntakeApiError } from '../utils/pcnIntakeApi';
import { formatPcnIntakeValidationIssues, indexPcnIntakeValidationIssues, validatePcnProposalIntake } from '../utils/pcnIntakePolicy';
import { getPcnDashboardMetrics } from '../utils/pcnReporting';
import { canViewNotification } from '../utils/notificationEvents';
import { downloadPcnDossierPackage } from '../utils/pcnDossierPackageApi';
import { getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation';
import { reviewPcnCodes } from '../utils/pcnCodePolicy';
import { PCN_MOBILE_NAVIGATION, type PcnSection } from '../utils/pcnNavigation';

const sectionLabels: Record<PcnSection, string> = {
  dashboard: 'Tổng quan',
  proposals: 'Đề nghị',
  operations: 'Sổ điều hành',
  'lab-operations': 'PYC & luân chuyển mẫu nội bộ',
  drafting: 'Soạn thảo tài liệu',
  assistant: 'Trợ lý phê duyệt',
  customers: 'Danh sách khách hàng',
  users: 'Nhân sự PCN',
  activityLogs: 'Nhật ký hệ thống',
  settings: 'Cấu hình PCN',
};

const statusLabels: Record<PcnDossierStatus, string> = {
  DRAFT: 'Bản nháp',
  INTAKE_REVIEW: 'Đang kiểm tra Đề nghị',
  AWAITING_DOCUMENTS: 'Chờ bổ sung hồ sơ',
  ASSIGNED: 'Đã phân công',
  PLAN_PENDING_APPROVAL: 'Chờ duyệt kế hoạch',
  FIELD_EVALUATION: 'Đang đánh giá',
  AWAITING_SAMPLING: 'Chờ lấy mẫu',
  SENT_TO_LAB: 'Đã gửi PTN',
  AWAITING_RESULTS: 'Chờ KQTN',
  CORRECTIVE_ACTION: 'Đang khắc phục',
  TECHNICAL_REVIEW: 'Đang soát xét kỹ thuật',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  ISSUED: 'Đã phát hành',
  DELIVERED: 'Đã giao khách hàng',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối / trả lại',
  CANCELLED: 'Đã hủy',
  ON_HOLD: 'Tạm dừng',
};

const statusClasses: Record<PcnDossierStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  INTAKE_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  AWAITING_DOCUMENTS: 'bg-rose-50 text-rose-700 border-rose-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  PLAN_PENDING_APPROVAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FIELD_EVALUATION: 'bg-violet-50 text-violet-700 border-violet-200',
  AWAITING_SAMPLING: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SENT_TO_LAB: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_RESULTS: 'bg-orange-50 text-orange-700 border-orange-200',
  CORRECTIVE_ACTION: 'bg-red-50 text-red-700 border-red-200',
  TECHNICAL_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
  WAITING_APPROVAL: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-teal-50 text-teal-700 border-teal-200',
  DELIVERED: 'bg-green-50 text-green-700 border-green-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  ON_HOLD: 'bg-gray-100 text-gray-600 border-gray-200',
};

function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone}`}><Icon size={15} /></div>
      <div className="min-w-0">
        <div className="truncate text-[9px] font-black uppercase leading-3 tracking-wide text-slate-400">{label}</div>
        <div className="text-lg font-black leading-5 text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function PcnDashboard({
  proposals,
  dossiers,
  fields,
  dossierDocuments,
  documentRequirements,
  users,
  labRequests,
  results,
  currentUser,
  canEdit,
  onCreateProposal,
  onOpenSection,
  onOpenDossier,
  onClaimDossier,
}: {
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  fields: PcnCertificationField[];
  dossierDocuments: import('../types').PcnDossierDocument[];
  documentRequirements?: import('../types').PcnDocumentRequirement[];
  users?: import('../types').PcnUserAccount[];
  labRequests: import('../types').OutboundLabRequest[];
  results: import('../types').ReturnedTestResult[];
  currentUser: import('../types').UserAccount | null;
  canEdit: boolean;
  onCreateProposal: () => void;
  onOpenSection: (section: PcnSection, fieldCode?: string) => void;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => void;
  onClaimDossier: (dossier: CertificationDossier) => Promise<void>;
}) {
  const storedDocumentRequirements = usePcnStore((state) => state.documentRequirements);
  const storedUsers = usePcnStore((state) => state.users);
  const [dashboardWorkSurface, setDashboardWorkSurface] = useState<'QUEUE' | 'WORKFLOW'>('WORKFLOW');
  const boardRequirements = documentRequirements?.length ? documentRequirements : storedDocumentRequirements;
  const boardUsers = users?.length ? users : storedUsers;
  const metrics = getPcnDashboardMetrics(dossiers, labRequests, results);

  return (
    <div className="pcn-page-surface min-w-0 space-y-3 bg-slate-50/60 p-2.5 pb-4 md:p-4 mobile-safe-bottom">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Giám định - Chứng nhận • PCN</p>
          <h1 className="mt-0.5 text-lg font-black tracking-tight text-slate-900 md:text-xl">Tổng quan hồ sơ chứng nhận</h1>
          <p className="mt-0.5 text-[10px] text-slate-500">Theo dõi Đề nghị, Lĩnh vực, PYC liên phòng và phát hành.</p>
        </div>
        {canEdit && <button className="mobile-touch-target min-h-11 shrink-0 gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500" onClick={onCreateProposal}>
          <Plus size={14} /> Tạo Đề nghị
        </button>}
      </div>

      <div data-testid="pcn-dashboard-kpi-grid" className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-8 2xl:grid-cols-10">
        <KpiCard label="Đề nghị" value={proposals.length} icon={FilePlus2} tone="bg-blue-50 text-blue-600" />
        <KpiCard label="Hồ sơ" value={metrics.totalDossiers} icon={FolderOpen} tone="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Đang chờ PTN" value={metrics.waitingLab} icon={Send} tone="bg-orange-50 text-orange-600" />
        <KpiCard label="Chờ KQTN" value={metrics.waitingResults} icon={ClipboardCheck} tone="bg-cyan-50 text-cyan-600" />
        <KpiCard label="Chờ bổ sung hồ sơ" value={metrics.awaitingDocuments} icon={FileWarning} tone="bg-rose-50 text-rose-600" />
        <KpiCard label="Khắc phục" value={metrics.correctiveAction} icon={Activity} tone="bg-rose-50 text-rose-600" />
        <KpiCard label="Chờ phê duyệt" value={metrics.waitingApproval} icon={ShieldCheck} tone="bg-amber-50 text-amber-600" />
        <KpiCard label="Đã phát hành" value={metrics.issued} icon={Award} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Đã lưu trữ" value={metrics.archived} icon={Archive} tone="bg-slate-100 text-slate-600" />
        <KpiCard label="Quá hạn" value={metrics.overdue} icon={Activity} tone="bg-red-50 text-red-600" />
      </div>
      <div data-testid="pcn-dashboard-summary-grid" className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <PcnUserKpiTable currentUser={currentUser} onOpenActivityLogs={() => onOpenSection('activityLogs')} />
        <section data-testid="pcn-dashboard-fields" className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-800">Lĩnh vực</h2>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">Mỗi hồ sơ có thể liên kết nhiều lĩnh vực.</p>
            </div>
            <button onClick={() => onOpenSection('proposals')} className="mobile-touch-target min-h-9 shrink-0 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">Xem <ChevronRight className="inline" size={12} /></button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {fields.map((field) => {
              const count = dossiers.filter((item) => item.fieldCodes.includes(field.code)).length;
              return (
                <button key={field.code} onClick={() => onOpenSection('proposals', field.code)} className="rounded-md border border-slate-200 p-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"><ClipboardList size={15} /></span><span className="min-w-0"><span className="block truncate text-xs font-black text-slate-800">{field.name}</span><span className="block text-[10px] font-mono text-slate-400">{field.code}</span>{field.scopeStatus === 'NEEDS_PCN_CONFIRMATION' && <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Chờ xác nhận phạm vi</span>}</span></div>
                    <span className="text-lg font-black text-slate-700">{count}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{field.standardRefs.map((standard) => <span key={standard} className="rounded bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500">{standard}</span>)}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section data-testid="pcn-dashboard-work-surface" className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/40 p-2 md:p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-800">Không gian công việc</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">Chọn một góc nhìn; hồ sơ không lặp lại ở hai danh sách cùng lúc.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chế độ xem công việc">
            <button type="button" aria-pressed={dashboardWorkSurface === 'QUEUE'} onClick={() => setDashboardWorkSurface('QUEUE')} className={`min-h-11 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${dashboardWorkSurface === 'QUEUE' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>Việc cần làm</button>
            <button type="button" aria-pressed={dashboardWorkSurface === 'WORKFLOW'} onClick={() => setDashboardWorkSurface('WORKFLOW')} className={`min-h-11 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${dashboardWorkSurface === 'WORKFLOW' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>Hồ sơ cần hoàn thiện</button>
          </div>
        </div>
        <div className="mt-2 min-w-0 w-full">
          {dashboardWorkSurface === 'WORKFLOW' ? (
            <PcnPipelineBoard dossiers={dossiers} proposals={proposals} fields={fields} requirements={boardRequirements} documents={dossierDocuments} users={boardUsers} currentUser={currentUser} onClaimDossier={onClaimDossier} onOpenDossier={onOpenDossier} />
          ) : (
            <PcnWorkQueueView dossiers={dossiers} proposals={proposals} documentRequirements={boardRequirements} dossierDocuments={dossierDocuments} users={boardUsers} currentUser={currentUser} onOpenDossier={onOpenDossier} onClaimDossier={onClaimDossier} />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-7 text-center"><div className="mx-auto mb-2 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400"><FolderOpen size={16} /></div><p className="text-xs font-black text-slate-600">{title}</p><p className="text-[10px] text-slate-400 mt-1">{description}</p>{action && onAction && <button onClick={onAction} className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white"><Plus size={12} /> {action}</button>}</div>;
}

function ProposalRegisterRow({ proposal, dossier, canEdit, onOpenDossier, onEdit }: { proposal: CertificationProposal; dossier: CertificationDossier; canEdit: boolean; onOpenDossier: () => void; onEdit?: () => void }) {
  const proposalEditingAllowed = Boolean(onEdit && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status));
  return (
    <article className="group overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
      <div className="border-b border-indigo-100 bg-white/80 p-3">
        <div className="flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-100 text-indigo-700"><FilePlus2 size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate font-mono text-xs font-black uppercase tracking-wide text-slate-900">{proposal.proposalCode}</h2>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${statusClasses[dossier.status]}`}>{statusLabels[dossier.status]}</span>
            </div>
            <p className="mt-1 truncate text-[10px] font-bold text-slate-600">Hồ sơ: <span className="font-mono text-slate-800">{dossier.dossierCode}</span></p>
          </div>
          <span className="shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-1 text-[9px] font-black text-indigo-700">{proposal.fieldCodes.length} lĩnh vực</span>
        </div>
      </div>
      <div className="space-y-2.5 p-3">
        <div>
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Khách hàng</span>
          <p className="mt-0.5 truncate text-[11px] font-black text-slate-800" title={proposal.customerSnapshot.name}>{proposal.customerSnapshot.name || 'Chưa gắn khách hàng'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Sản phẩm</span><p className="mt-0.5 truncate text-[10px] font-bold text-slate-700" title={proposal.productName}>{proposal.productName || 'Chưa có sản phẩm'}</p></div>
          <div className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Model / nhãn hiệu</span><p className="mt-0.5 truncate text-[10px] font-bold text-slate-700" title={[proposal.model, proposal.brand].filter(Boolean).join(' / ')}>{[proposal.model, proposal.brand].filter(Boolean).join(' / ') || 'Chưa có thông tin'}</p></div>
        </div>
        <div className="flex flex-wrap gap-1">
          {proposal.fieldCodes.length > 0 ? proposal.fieldCodes.map((code) => <span key={code} className="rounded border border-white bg-white/80 px-1.5 py-0.5 text-[9px] font-black text-slate-600">{code}</span>) : <span className="text-[9px] font-bold text-amber-700">Chưa xác định Lĩnh vực</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-indigo-100 bg-white/60 px-3 py-2.5">
        <span className="text-[9px] font-bold text-slate-400">Tiếp nhận {new Date(proposal.receivedAt).toLocaleDateString('vi-VN')}</span>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={onOpenDossier} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[9px] font-black text-white hover:bg-indigo-500"><FolderOpen size={12} /> Mở hồ sơ chuẩn</button>
          {canEdit && proposalEditingAllowed && <button type="button" onClick={onEdit} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">Sửa Đề nghị</button>}
        </div>
      </div>
    </article>
  );
}

type PcnProposalForm = {
  proposalCode: string;
  channel: CertificationProposal['channel'];
  customerName: string;
  customerId: string;
  address: string;
  warehouseAddress: string;
  contactPerson: string;
  taxId: string;
  phone: string;
  email: string;
  productName: string;
  model: string;
  brand: string;
  productType: string;
  specifications: string;
  manufacturer: string;
  manufacturerAddress: string;
  quantity: string;
  fieldCodes: string[];
};

function ProposalView({ fields, proposals, dossiers, customers, canEdit, initialDossierId, initialFieldCode, openFormRequest, onSave, onUpdateProposal, onOpenDossier }: { fields: PcnCertificationField[]; proposals: CertificationProposal[]; dossiers: CertificationDossier[]; customers: Array<{ name: string; address?: string; customerCode?: string; taxId?: string; phone?: string; email?: string; contactPerson?: string }>; canEdit: boolean; initialDossierId?: string; initialFieldCode?: string; openFormRequest?: number; onSave: (proposal: CertificationProposal) => Promise<void>; onUpdateProposal: (proposalId: string, updates: PcnProposalUpdateInput) => Promise<void>; onOpenDossier: (dossier: CertificationDossier) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProposal, setEditingProposal] = useState<CertificationProposal>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PcnDossierStatus | ''>('');
  const [fieldFilter, setFieldFilter] = useState(initialFieldCode || '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const emptyForm = () => ({
    proposalCode: '', channel: 'DIRECT' as CertificationProposal['channel'], customerName: '', customerId: '', address: '', warehouseAddress: '',
    contactPerson: '', taxId: '', phone: '', email: '', productName: '', model: '', brand: '', productType: '', specifications: '',
    manufacturer: '', manufacturerAddress: '', quantity: '1', fieldCodes: [],
  });
  const [form, setForm] = useState<PcnProposalForm>(emptyForm());
  const codeReview = reviewPcnCodes(form.fieldCodes, form.proposalCode);
  const customerOptions = useMemo<PcnCatalogOption[]>(() => customers.flatMap((customer) => {
      const value = customer.customerCode || customer.name;
      return value ? [{
        value,
        label: [customer.customerCode, customer.name].filter(Boolean).join(' — '),
        searchText: [customer.customerCode, customer.name, customer.taxId, customer.contactPerson].filter(Boolean).join(' '),
      }] : [];
    }), [customers]);
  const customerValue = form.customerId || form.customerName;
  const legacyCustomerOption = customerValue && !customerOptions.some((option) => option.value === customerValue)
    ? { value: customerValue, label: `Giá trị hiện tại cần rà soát: ${form.customerName || customerValue}`, description: 'Giá trị cũ được giữ nguyên để bạn đối chiếu với Danh sách khách hàng.', disabled: true }
    : undefined;
  const reset = () => { setForm(emptyForm()); setEditingProposal(undefined); setValidationErrors({}); };

  useEffect(() => {
    if (!openFormRequest) return;
    setForm(emptyForm());
    setEditingProposal(undefined);
    setValidationErrors({});
    setOpenForm(true);
  }, [openFormRequest]);

  const openEdit = (proposal: CertificationProposal) => {
    setEditingProposal(proposal);
    setForm({
      proposalCode: proposal.proposalCode,
      channel: proposal.channel,
      customerName: proposal.customerSnapshot.name || '',
      customerId: proposal.customerId || '',
      address: proposal.customerSnapshot.address || '',
      warehouseAddress: proposal.warehouseAddress || '',
      contactPerson: proposal.customerSnapshot.contactPerson || '',
      taxId: proposal.customerSnapshot.taxId || '',
      phone: proposal.customerSnapshot.phone || '',
      email: proposal.customerSnapshot.email || '',
      productName: proposal.productName || '',
      model: proposal.model || '',
      brand: proposal.brand || '',
      productType: proposal.productType || '',
      specifications: proposal.specifications || '',
      manufacturer: proposal.manufacturer || '',
      manufacturerAddress: proposal.manufacturerAddress || '',
      quantity: String(proposal.quantity || 1),
      fieldCodes: proposal.fieldCodes,
    });
    setOpenForm(true);
  };

  const handleCustomerSelection = (value: string) => {
    const customer = customers.find((item) => item.name === value || item.customerCode === value);
    setForm((previous) => ({
      ...previous, customerName: customer?.name || value, customerId: customer?.customerCode || '',
      ...(customer ? { address: customer.address || '', taxId: customer.taxId || '', phone: customer.phone || '', email: customer.email || '', contactPerson: customer.contactPerson || '' } : {}),
    }));
  };

  const applyProposalOcr = (ocrFields: Record<string, string>) => {
    const allowedFieldCodes = new Set(fields.map((field) => field.code));
    const recognizedFieldCodes = String(ocrFields.fieldCodes || '').split(/[,;\s]+/).map((code) => code.trim().toUpperCase()).filter((code) => allowedFieldCodes.has(code as any));
    setForm((previous) => ({
      ...previous,
      ...(ocrFields.proposalCode ? { proposalCode: ocrFields.proposalCode } : {}),
      ...(ocrFields.customerName ? { customerName: ocrFields.customerName } : {}),
      ...(ocrFields.address ? { address: ocrFields.address } : {}),
      ...(ocrFields.contactPerson ? { contactPerson: ocrFields.contactPerson } : {}),
      ...(ocrFields.taxId ? { taxId: ocrFields.taxId } : {}),
      ...(ocrFields.phone ? { phone: ocrFields.phone } : {}),
      ...(ocrFields.email ? { email: ocrFields.email } : {}),
      ...(ocrFields.warehouseAddress ? { warehouseAddress: ocrFields.warehouseAddress } : {}),
      ...(ocrFields.productName ? { productName: ocrFields.productName } : {}),
      ...(ocrFields.productType ? { productType: ocrFields.productType } : {}),
      ...(ocrFields.model ? { model: ocrFields.model } : {}),
      ...(ocrFields.brand ? { brand: ocrFields.brand } : {}),
      ...(ocrFields.specifications ? { specifications: ocrFields.specifications } : {}),
      ...(ocrFields.manufacturer ? { manufacturer: ocrFields.manufacturer } : {}),
      ...(ocrFields.manufacturerAddress ? { manufacturerAddress: ocrFields.manufacturerAddress } : {}),
      ...(ocrFields.quantity && Number(ocrFields.quantity) > 0 ? { quantity: String(Math.round(Number(ocrFields.quantity))) } : {}),
      ...(recognizedFieldCodes.length > 0 ? { fieldCodes: recognizedFieldCodes } : {}),
    }));
    toast.success('Đã điền bản nháp OCR vào form; hãy kiểm tra trước khi tạo Đề nghị.');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!canEdit) return;
    const intakeValidation = validatePcnProposalIntake({
      customerSnapshot: {
        name: form.customerName,
        address: form.address,
        contactPerson: form.contactPerson,
        taxId: form.taxId,
      },
      warehouseAddress: form.warehouseAddress,
      productName: form.productName,
      productType: form.productType,
      model: form.model,
      brand: form.brand,
      specifications: form.specifications,
      manufacturer: form.manufacturer,
      quantity: form.quantity,
      fieldCodes: form.fieldCodes,
    });
    if (!intakeValidation.valid) {
      setValidationErrors(indexPcnIntakeValidationIssues(intakeValidation.issues));
      toast.error(formatPcnIntakeValidationIssues(intakeValidation.issues));
      return;
    }
    const customerSnapshot = { name: form.customerName.trim(), address: form.address.trim(), taxId: form.taxId.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, contactPerson: form.contactPerson.trim() || undefined };
    setSaving(true);
    try {
      if (editingProposal) {
        await onUpdateProposal(editingProposal.id, {
          channel: form.channel,
          customerId: form.customerId.trim() || undefined,
          customerSnapshot,
          warehouseAddress: form.warehouseAddress.trim(),
          productName: form.productName.trim(),
          model: form.model.trim() || undefined,
          brand: form.brand.trim() || undefined,
          productType: form.productType.trim() || undefined,
          specifications: form.specifications.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          manufacturerAddress: form.manufacturerAddress.trim() || undefined,
          quantity: Number(form.quantity),
        });
        toast.success('Đã lưu thay đổi Đề nghị.');
      } else {
        const now = new Date().toISOString();
        const proposal: CertificationProposal = {
          id: makeId('proposal'),
          proposalCode: form.proposalCode.trim() || `DN-${new Date().getFullYear()}-${String(proposals.length + 1).padStart(3, '0')}`,
          channel: form.channel, status: 'RECEIVED', customerId: form.customerId || undefined,
          customerSnapshot,
          warehouseAddress: form.warehouseAddress.trim() || undefined,
          productName: form.productName.trim(), model: form.model.trim() || undefined, brand: form.brand.trim() || undefined,
          productType: form.productType.trim() || undefined, specifications: form.specifications.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined, manufacturerAddress: form.manufacturerAddress.trim() || undefined, quantity: Math.max(1, Number(form.quantity) || 1), fieldCodes: form.fieldCodes,
          receivedAt: now, createdAt: now, updatedAt: now,
        };
        await onSave(proposal);
        toast.success('Đã tạo Đề nghị và bộ hồ sơ.');
      }
      reset();
      setOpenForm(false);
    } catch (error: any) {
      if (error instanceof PcnIntakeApiError && error.issues.length > 0) {
        setValidationErrors(indexPcnIntakeValidationIssues(error.issues));
      }
      toast.error(error?.message || 'Không thể lưu Đề nghị.');
    } finally {
      setSaving(false);
    }
  };

  const dossierByProposalId = useMemo(() => new Map(dossiers.map((dossier) => [dossier.proposalId, dossier])), [dossiers]);
  const visibleProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return proposals.filter((proposal) => {
      const dossier = dossierByProposalId.get(proposal.id);
      if (initialDossierId && dossier?.id !== initialDossierId) return false;
      if (statusFilter && dossier?.status !== statusFilter) return false;
      if (fieldFilter && !proposal.fieldCodes.includes(fieldFilter)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        proposal.proposalCode,
        dossier?.dossierCode,
        proposal.customerSnapshot.name,
        proposal.productName,
        proposal.model,
        proposal.brand,
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [dossierByProposalId, fieldFilter, initialDossierId, proposals, query, statusFilter]);

  return (
    <div className="pcn-page-surface min-w-0 p-3 md:p-5 space-y-4 mobile-safe-bottom bg-slate-50/60">
      <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-black text-slate-900">Quản lý Đề nghị</h1><p className="text-[11px] text-slate-500 mt-1">Mỗi thẻ là một Đề nghị và một bộ hồ sơ liên kết. PYC chỉ phát sinh khi cần kết nối phòng thử nghiệm khác.</p></div>{!openForm && canEdit && <button onClick={() => { reset(); setOpenForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><Plus size={14} /> Tạo Đề nghị</button>}</div>
      {openForm && <form onSubmit={submit} className="rounded-xl border border-emerald-200 bg-white p-3 md:p-4 shadow-sm space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">{editingProposal ? 'Sửa thông tin Đề nghị' : 'Thông tin Đề nghị / bộ hồ sơ'}</h2>{editingProposal && <p className="mt-1 text-[10px] text-amber-700">Chỉ sửa được ở giai đoạn đầu vào; mã Đề nghị và Lĩnh vực được giữ nguyên.</p>}</div><button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-40"><X size={16} /></button></div><PcnOcrPanel context="proposal" onApply={applyProposalOcr} disabled={saving} /><div className="grid md:grid-cols-3 gap-2"><Field label="Mã Đề nghị / mã đăng ký"><input value={form.proposalCode} disabled={Boolean(editingProposal)} onChange={(event) => setForm({ ...form, proposalCode: event.target.value })} placeholder="Ví dụ: 0665, 0109-01 hoặc IEMM 0105" />{codeReview.needsReview && <p role="status" className="mt-1 text-[9px] font-bold leading-4 text-amber-700">{codeReview.message}{codeReview.normalized ? ` Giá trị chuẩn hóa: ${codeReview.normalized}` : ''}</p>}</Field><Field label="Kênh tiếp nhận"><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as CertificationProposal['channel'] })}><option value="DIRECT">Trực tiếp</option><option value="EMAIL">Email</option><option value="ONLINE_ZALO">Online / Zalo</option><option value="OTHER">Khác</option></select></Field><Field label="Số lượng mẫu *" error={validationErrors.quantity}><input type="number" min="1" value={form.quantity} aria-invalid={Boolean(validationErrors.quantity)} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field></div><div className="grid md:grid-cols-2 gap-2"><Field label="Khách hàng *" error={validationErrors['customerSnapshot.name']}><PcnCatalogCombobox id="pcn-customer" label="Khách hàng *" hideLabel value={customerValue} options={customerOptions} unmatchedOption={legacyCustomerOption} onChange={handleCustomerSelection} required invalid={Boolean(validationErrors['customerSnapshot.name'])} aria-invalid={Boolean(validationErrors['customerSnapshot.name'])} disabled={saving} placeholder="Tìm mã hoặc tên khách hàng..." /></Field><Field label="Địa chỉ khách hàng *" error={validationErrors['customerSnapshot.address']}><input value={form.address} aria-invalid={Boolean(validationErrors['customerSnapshot.address'])} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Tự điền từ Danh sách khách hàng" /></Field></div><div className="grid md:grid-cols-4 gap-2"><Field label="Người liên hệ hoặc Mã số thuế *" error={validationErrors['customerSnapshot.contactPerson']}><input value={form.contactPerson} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Field><Field label="Mã số thuế"><input value={form.taxId} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></Field><Field label="Điện thoại"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field></div><Field label="Địa chỉ/kho liên quan *" error={validationErrors.warehouseAddress}><input value={form.warehouseAddress} aria-invalid={Boolean(validationErrors.warehouseAddress)} onChange={(event) => setForm({ ...form, warehouseAddress: event.target.value })} placeholder="Nơi lấy/giao mẫu hoặc kho liên quan" /></Field><div className="grid md:grid-cols-4 gap-2"><Field label="Tên sản phẩm *" error={validationErrors.productName}><input value={form.productName} aria-invalid={Boolean(validationErrors.productName)} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></Field><Field label="Kiểu/loại sản phẩm *" error={validationErrors.productType}><input value={form.productType} aria-invalid={Boolean(validationErrors.productType)} onChange={(event) => setForm({ ...form, productType: event.target.value })} /></Field><Field label="Model *" error={validationErrors.model}><input value={form.model} aria-invalid={Boolean(validationErrors.model)} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field><Field label="Nhãn hiệu *" error={validationErrors.brand}><input value={form.brand} aria-invalid={Boolean(validationErrors.brand)} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></Field></div><div className="grid md:grid-cols-3 gap-2"><Field label="Nhà sản xuất *" error={validationErrors.manufacturer}><input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></Field><Field label="Địa chỉ nhà sản xuất"><input value={form.manufacturerAddress} onChange={(event) => setForm({ ...form, manufacturerAddress: event.target.value })} /></Field><Field label="Thông số kỹ thuật / mô tả *" error={validationErrors.specifications}><textarea rows={2} value={form.specifications} aria-invalid={Boolean(validationErrors.specifications)} onChange={(event) => setForm({ ...form, specifications: event.target.value })} /></Field></div><div><div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lĩnh vực *</div><div className="flex flex-wrap gap-2">{fields.map((field) => <label key={field.code} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} aria-invalid={Boolean(validationErrors.fieldCodes)} disabled={Boolean(editingProposal)} onChange={(event) => setForm({ ...form, fieldCodes: event.target.checked ? [...form.fieldCodes, field.code] : form.fieldCodes.filter((code) => code !== field.code) })} />{field.name}{field.scopeStatus === 'NEEDS_PCN_CONFIRMATION' && <span className="rounded bg-amber-50 px-1 py-0.5 text-[8px] font-black text-amber-700">xác nhận phạm vi</span>}</label>)}</div>{validationErrors.fieldCodes && <p role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{validationErrors.fieldCodes}</p>}</div><div className="flex justify-end gap-2"><button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" disabled={saving} aria-busy={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-50">{saving ? 'Đang lưu...' : editingProposal ? 'Lưu thay đổi' : 'Tạo Đề nghị & bộ hồ sơ'}</button></div></form>}
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_190px_170px_auto]">
        <label className="block"><span className="sr-only">Tìm Đề nghị</span><input aria-label="Tìm Đề nghị" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, khách hàng, sản phẩm, model..." className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" /></label>
        <select aria-label="Lọc trạng thái hồ sơ" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PcnDossierStatus | '')} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>
        <select aria-label="Lọc Lĩnh vực" value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">Tất cả Lĩnh vực</option>{fields.map((field) => <option key={field.code} value={field.code}>{field.name}</option>)}</select>
        <div className="flex items-center justify-end text-[10px] font-bold text-slate-500">{visibleProposals.length}/{proposals.length} Đề nghị</div>
      </div>
      {initialDossierId && <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-800">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{proposals.length === 0 ? <EmptyState title="Chưa có Đề nghị" description="Tiếp nhận Đề nghị từ khách hàng để tạo bộ hồ sơ chứng nhận." action={canEdit ? 'Tạo Đề nghị' : undefined} onAction={canEdit ? () => { reset(); setOpenForm(true); } : undefined} /> : visibleProposals.length === 0 ? <EmptyState title="Không tìm thấy Đề nghị" description="Thử đổi từ khóa hoặc bộ lọc trạng thái/Lĩnh vực." /> : visibleProposals.map((proposal) => { const dossier = dossiers.find((item) => item.id === proposal.dossierId || item.proposalId === proposal.id); return dossier ? <ProposalRegisterRow key={proposal.id} proposal={proposal} dossier={dossier} canEdit={canEdit} onOpenDossier={() => onOpenDossier(dossier)} onEdit={() => openEdit(proposal)} /> : <div key={proposal.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800">Đề nghị <b>{proposal.proposalCode}</b> chưa có bộ hồ sơ liên kết.</div>; })}</div>
    </div>
  );
}

function Field({ label, error, hideLabel = false, children }: { label: string; error?: string; hideLabel?: boolean; children: React.ReactNode }) {
  return <label className="block">{!hideLabel && <span className="block text-[10px] font-black text-slate-500 mb-1">{label}</span>}<div className={`[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[11px] [&_input]:outline-none [&_input]:focus:border-emerald-400 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-1.5 [&_select]:text-[11px] [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:px-2.5 [&_textarea]:py-1.5 [&_textarea]:text-[11px] [&_textarea]:outline-none ${error ? '[&_input]:border-rose-300 [&_select]:border-rose-300 [&_textarea]:border-rose-300 [&_input]:bg-rose-50/40 [&_select]:bg-rose-50/40 [&_textarea]:bg-rose-50/40' : '[&_input]:border-slate-200 [&_select]:border-slate-200 [&_textarea]:border-slate-200'}`}>{children}</div>{error && <p role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{error}</p>}</label>;
}

export type PcnWorkspaceProps = {
  embedded?: boolean;
  initialSection?: PcnSection;
  onActiveSectionChange?: (section: PcnSection) => void;
};

export function PcnWorkspace({ embedded = false, initialSection = 'dashboard', onActiveSectionChange }: PcnWorkspaceProps = {}) {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pcn = usePcnStore();
  const resetPcn = usePcnStore((state) => state.reset);
  const [pcnSessionChecked, setPcnSessionChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<PcnSection>(initialSection);
  const [selectedField, setSelectedField] = useState<string | undefined>();
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [focusedDossierId, setFocusedDossierId] = useState<string | undefined>();
  const [proposalFormRequest, setProposalFormRequest] = useState(0);
  const [selectedDossierId, setSelectedDossierId] = useState<string | undefined>();
  const [selectedDossierTab, setSelectedDossierTab] = useState<import('../utils/pcnDossierNavigation').PcnDossierDetailTab | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return window.localStorage.getItem('pcn_sidebar_collapsed') === 'true';
    return false;
  });
  const [pcnNotificationOpen, setPcnNotificationOpen] = useState(false);
  const [personalSettingsOpen, setPersonalSettingsOpen] = useState(false);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    let cancelled = false;
    getPcnSession()
      .then((session) => {
        if (!cancelled) {
          if (!session) resetPcn();
          usePcnSessionStore.getState().setCurrentUser(session?.user || null);
        }
      })
      .catch((error) => {
        console.error('PCN session check failed:', error);
        if (!cancelled) {
          resetPcn();
          usePcnSessionStore.getState().clearCurrentUser();
        }
      })
      .finally(() => {
        if (!cancelled) setPcnSessionChecked(true);
      });
    return () => { cancelled = true; };
  }, [resetPcn]);

  useEffect(() => { if (pcnSessionChecked && currentUser) pcn.load().catch((error) => toast.error(error?.message || 'Không thể tải dữ liệu PCN')); }, [currentUser, pcn.load, pcnSessionChecked]);

  if (!pcnSessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-xs font-bold text-slate-300">Đang xác thực phiên PCN...</div>;
  if (!currentUser) return <PcnLoginScreen />;

  const handleLogout = async () => {
    try {
      await clearPcnSession();
    } catch (error) {
      console.warn('PCN session logout failed:', error);
    } finally {
      resetPcn();
      clearCurrentUser();
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('pcn_sidebar_collapsed', String(next));
      return next;
    });
  };

  const openSection = (section: PcnSection, entityKey?: string) => { setActiveSection(section); onActiveSectionChange?.(section); setFocusedDossierId(undefined); setSelectedField(section === 'proposals' ? entityKey : undefined); setCustomerSearchQuery(section === 'customers' ? (entityKey || '') : ''); setMobileMenuOpen(false); };
  const openNewProposal = () => {
    openSection('proposals');
    setFocusedDossierId(undefined);
    setSelectedField(undefined);
    setProposalFormRequest((current) => current + 1);
    setMobileMenuOpen(false);
  };
  const openDossierAtCurrentStation = (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => {
    setSelectedDossierTab(initialTab);
    setSelectedDossierId(dossier.id);
  };
  const findNotificationDossier = (notification: AppNotification): CertificationDossier | undefined => {
    if (notification.entityType === 'PCN_PROPOSAL') {
      return pcn.dossiers.find((dossier) => dossier.proposalId === notification.entityId);
    }
    if (notification.entityType === 'PCN_DOSSIER') {
      return pcn.dossiers.find((dossier) => dossier.id === notification.entityId);
    }
    if (notification.entityType === 'PCN_SAMPLE_LOT') {
      const lot = pcn.sampleLots.find((item) => item.id === notification.entityId);
      return pcn.dossiers.find((dossier) => dossier.id === lot?.dossierId);
    }
    if (notification.entityType === 'PCN_LAB_REQUEST') {
      const request = pcn.labRequests.find((item) => item.id === notification.entityId);
      return pcn.dossiers.find((dossier) => dossier.id === request?.dossierId);
    }
    if (notification.entityType === 'PCN_RESULT') {
      const result = pcn.returnedResults.find((item) => item.id === notification.entityId);
      return pcn.dossiers.find((dossier) => dossier.id === result?.dossierId);
    }
    if (notification.entityType === 'PCN_ISSUANCE') {
      const issuance = pcn.issuancePackages.find((item) => item.id === notification.entityId);
      return pcn.dossiers.find((dossier) => dossier.id === issuance?.dossierId);
    }
    if (notification.entityType === 'PCN_APPROVAL') {
      const approval = pcn.approvalSteps.find((item) => item.id === notification.entityId);
      return pcn.dossiers.find((dossier) => dossier.id === approval?.dossierId)
        || pcn.dossiers.find((dossier) => pcn.issuancePackages.some((item) => item.id === notification.entityId && item.dossierId === dossier.id));
    }
    return undefined;
  };
  const handlePcnNotificationSelect = (notification: AppNotification) => {
    const dossier = findNotificationDossier(notification);
    if (dossier) {
      const notificationTab = getPcnNotificationDossierTab(notification.entityType);
      setSelectedDossierTab(notificationTab);
      setSelectedDossierId(dossier.id);
      return;
    }
    const section: PcnSection | undefined = notification.entityType === 'PCN_PROPOSAL'
      ? 'proposals'
      : notification.entityType
        ? 'proposals'
        : undefined;
    if (section) openSection(section);
  };
  const selectedDossier = pcn.dossiers.find((dossier) => dossier.id === selectedDossierId);
  const downloadDossierPackage = async (dossier: CertificationDossier) => {
    try {
      await downloadPcnDossierPackage(dossier.id, dossier.dossierCode);
      toast.success(`Đã tải bộ hồ sơ ${dossier.dossierCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải bộ hồ sơ PCN.');
    }
  };
  const isPcnAdmin = currentUser.systemRole === 'admin' || currentUser.role === 'admin';
  const canMutatePcn = currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer';
  const pcnUnreadNotificationCount = pcn.notifications.filter((notification) => !notification.read && canViewNotification(notification, currentUser)).length;
  const claimPcnDossier = async (dossier: CertificationDossier) => {
    try {
      await pcn.updateDossier(dossier.id, { ownerUsername: currentUser.username });
      toast.success(`Đã nhận hồ sơ ${dossier.dossierCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể nhận hồ sơ.');
      throw error;
    }
  };
  const prepareIssuance = async (dossier: CertificationDossier) => {
    const existingIssuance = pcn.issuancePackages.find((item) => item.dossierId === dossier.id);
    if (existingIssuance && existingIssuance.status !== 'RETURNED') { toast.info('Hồ sơ này đã có bộ phát hành.'); return; }
    try { await pcn.createIssuanceBundle(dossier.id); toast.success(`Đã trình hồ sơ ${dossier.dossierCode} vào bước 5.`); } catch (error: any) { toast.error(error?.message || 'Không thể trình hồ sơ vào bước 5'); }
  };
  const approveStep = async (stepId: string, decision: 'APPROVE' | 'RETURN', comment?: string) => {
    try { await pcn.actOnApprovalStep(stepId, decision, comment); } catch (error: any) { toast.error(error?.message || 'Không thể cập nhật phê duyệt'); throw error; }
  };
  const issuePackage = async (issuanceId: string, input: { issuanceNumber: string; signerUsername: string; issuedAt?: string }) => {
    try { await pcn.issuePackage(issuanceId, input); toast.success('Đã cấp số và ghi nhận phát hành.'); } catch (error: any) { toast.error(error?.message || 'Không thể phát hành'); throw error; }
  };
  const deliverPackage = async (issuanceId: string, input: { recipient: string; deliveredAt?: string; note?: string }) => {
    try { await pcn.deliverPackage(issuanceId, input); toast.success('Đã ghi nhận giao GCN/QĐ cho khách hàng.'); } catch (error: any) { toast.error(error?.message || 'Không thể ghi nhận giao khách hàng'); throw error; }
  };
  const archivePackage = async (issuanceId: string) => {
    try { await pcn.archivePackage(issuanceId); toast.success('Đã đưa hồ sơ vào Kho hồ sơ.'); } catch (error: any) { toast.error(error?.message || 'Không thể lưu trữ hồ sơ'); }
  };
  const withdrawPackage = async (issuanceId: string, reason: string) => {
    try { await pcn.withdrawPackage(issuanceId, reason); toast.success('Đã thu hồi hồ sơ để mở lại vùng rà soát.'); } catch (error: any) { toast.error(error?.message || 'Không thể thu hồi hồ sơ'); throw error; }
  };

  const sidebarWidthClass = isSidebarCollapsed ? 'w-16' : 'w-64';
  const mobileNavItems = PCN_MOBILE_NAVIGATION.map((key) => ({ key, icon: PCN_SECTION_ICONS[key] }));


  const content = activeSection === 'dashboard' ? (
    <PcnDashboard
      proposals={pcn.proposals}
      dossiers={pcn.dossiers}
      fields={pcn.fields}
      dossierDocuments={pcn.dossierDocuments}
      documentRequirements={pcn.documentRequirements}
      users={pcn.users}
      labRequests={pcn.labRequests}
      results={pcn.returnedResults}
      currentUser={currentUser}
      canEdit={canMutatePcn}
      onCreateProposal={openNewProposal}
      onOpenSection={openSection}
      onOpenDossier={openDossierAtCurrentStation}
      onClaimDossier={claimPcnDossier}
    />
  ) : activeSection === 'proposals' ? (
    <ProposalView fields={pcn.fields} proposals={pcn.proposals} dossiers={pcn.dossiers} customers={pcn.customers} canEdit={canMutatePcn} initialDossierId={focusedDossierId} initialFieldCode={selectedField} openFormRequest={proposalFormRequest} onSave={(proposal) => pcn.addProposal(proposal)} onUpdateProposal={(proposalId, updates) => pcn.updateProposal(proposalId, updates)} onOpenDossier={(dossier) => { setSelectedDossierTab(undefined); setSelectedDossierId(dossier.id); }} />
  ) : activeSection === 'operations' ? (
    <PcnOperationsRegisterView fields={pcn.fields} proposals={pcn.proposals} dossiers={pcn.dossiers} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} issuancePackages={pcn.issuancePackages} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} users={pcn.users} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'lab-operations' ? (
    <PcnLabOperationsView dossiers={pcn.dossiers} proposals={pcn.proposals} sampleLots={pcn.sampleLots} sampleItems={pcn.sampleItems} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'drafting' ? (
    <PcnDraftingWorkspaceView proposals={pcn.proposals} dossiers={pcn.dossiers} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} onToast={(message, type) => type === 'error' ? toast.error(message) : toast.success(message)} onOpenSettings={() => openSection('settings')} />
  ) : activeSection === 'assistant' ? (
    <PcnAssistantView dossiers={pcn.dossiers} proposals={pcn.proposals} requirements={pcn.documentRequirements} documents={pcn.dossierDocuments} labRequests={pcn.labRequests} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} returnedResults={pcn.returnedResults} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'customers' ? (
    <PcnCustomersManagementView initialSearchQuery={customerSearchQuery} />
  ) : activeSection === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />
  ) : activeSection === 'settings' && isPcnAdmin ? (
    <PcnSettingsView currentUser={currentUser} templates={pcn.templates} onUploadTemplate={pcn.uploadPcnTemplate} onReviewTemplate={pcn.reviewPcnTemplate} />
  ) : activeSection === 'users' && isPcnAdmin ? (
    <PcnUserManagementView users={pcn.users} roles={pcn.departmentRoles} fields={pcn.fields} currentUser={currentUser} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} />
  ) : null;
  const systemRoleLabel = currentUser.systemRole || currentUser.role;
  const departmentRoleLabel = currentUser.departmentRoleCode || 'Chưa phân công';
  return (
    <>
      <div className={embedded ? 'min-w-0' : 'pcn-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800'}>
        <Toaster position="top-right" richColors />
        {!embedded && <PcnSidebar
          currentUser={currentUser}
          activeSection={activeSection}
          sectionLabels={sectionLabels}
          isPcnAdmin={isPcnAdmin}
          isSidebarCollapsed={isSidebarCollapsed}
          mobileMenuOpen={mobileMenuOpen}
          sidebarWidthClass={sidebarWidthClass}
          systemRoleLabel={systemRoleLabel}
          departmentRoleLabel={departmentRoleLabel}
          onToggleSidebar={toggleSidebar}
          onOpenSection={openSection}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
          onOpenPersonalSettings={() => setPersonalSettingsOpen(true)}
          onLogout={handleLogout}
        />}
        <div className={embedded ? 'min-w-0' : 'flex min-w-0 flex-1 flex-col'}>
          {!embedded && <header className="ddt-compact-header flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden rounded-lg p-1.5 text-slate-500 transition-all hover:bg-slate-100 lg:flex"
                title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                aria-label={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              >
                <Menu size={18} />
              </button>
              <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Mở menu PCN" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
                <Menu size={18} />
              </button>
              <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-7 w-7 rounded bg-white object-contain p-0.5" />
              <div className="min-w-0">
                <div className="truncate text-[10px] font-black uppercase tracking-wider text-emerald-600">IEMM • TVCI · {sectionLabels[activeSection]}</div>
                <div className="truncate text-xs font-bold text-slate-600">Quản lý chứng nhận theo Lĩnh vực</div>
              </div>
            </div>
            <div className="relative flex items-center gap-2 text-slate-400">
              <button type="button" onClick={() => { setPcnNotificationOpen((open) => !open); void pcn.refreshPcnNotifications(); }} aria-label="Mở thông báo PCN" className="relative rounded-lg p-2 hover:bg-slate-100 hover:text-emerald-700">
                <Bell size={16} />
                {pcnUnreadNotificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white">{pcnUnreadNotificationCount > 99 ? '99+' : pcnUnreadNotificationCount}</span>}
              </button>
              <Activity size={16} />
              <span className="hidden text-[10px] font-bold sm:inline">Database PCN riêng</span>
              <PcnNotificationDropdown isOpen={pcnNotificationOpen} onClose={() => setPcnNotificationOpen(false)} notifications={pcn.notifications} currentUser={currentUser} onMarkRead={pcn.markPcnNotificationAsRead} onMarkAllRead={pcn.markAllPcnNotificationsAsRead} onClear={pcn.clearPcnNotifications} onSelect={handlePcnNotificationSelect} />
            </div>
          </header>}
          {/* Standalone contract: <main className="min-h-0 min-w-0 flex-1 mobile-scroll-y overflow-x-hidden overflow-y-auto"> */}
          <main className={embedded ? 'min-w-0' : 'min-h-0 min-w-0 flex-1 mobile-scroll-y overflow-x-hidden overflow-y-auto'}>{content}</main>
          {!embedded && <nav className="pcn-mobile-nav mobile-scroll-x flex shrink-0 items-center justify-start gap-1 border-t border-slate-200 bg-white p-1.5 lg:hidden" aria-label="Menu di động">
            {mobileNavItems.map(({ key, icon: Icon }) => {
              const isActive = activeSection === key;
              return <button type="button" key={key} onClick={() => openSection(key)} aria-current={isActive ? 'page' : undefined} className={isActive ? 'mobile-touch-target flex min-h-11 min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-md bg-emerald-50 px-1 py-1.5 text-[8px] font-bold text-emerald-700' : 'mobile-touch-target flex min-h-11 min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[8px] font-bold text-slate-400'}><Icon size={15} /><span className="truncate">{sectionLabels[key]}</span></button>;
            })}
          </nav>}
        </div>
      </div>
      {personalSettingsOpen && <PcnPersonalSettingsPanel currentUser={currentUser} onClose={() => setPersonalSettingsOpen(false)} />}
      {/* The detail view normalizes the legacy result-file callback internally. */}
      {selectedDossier && <PcnDossierDetailView dossier={selectedDossier} proposal={pcn.proposals.find((proposal) => proposal.id === selectedDossier.proposalId)} fields={pcn.fields} templates={pcn.templates} labRequests={pcn.labRequests} results={pcn.returnedResults} approvalSteps={pcn.approvalSteps} issuancePackages={pcn.issuancePackages} activityLogs={pcn.activityLogs} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} dossierAttachments={pcn.dossierAttachments} generatedDocuments={pcn.generatedDocuments} officialDocuments={pcn.officialDocuments} signerDelegations={pcn.signerDelegations} sampleLots={pcn.sampleLots} sampleItems={pcn.sampleItems} sampleRoutes={pcn.sampleRoutes} users={pcn.users} currentUser={currentUser} initialTab={selectedDossierTab} onUploadDocument={(requirementId, file) => pcn.uploadDossierDocument(selectedDossier.id, requirementId, file)} onUpdateStatus={(status, exceptionReason) => pcn.updateDossier(selectedDossier.id, { status, ...(exceptionReason !== undefined ? { exceptionReason } : {}) })} onUpdateDossier={(updates) => pcn.updateDossier(selectedDossier.id, updates)} canEditMilestones={currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer'} onPreflight={(kind, sampleRouteId, labRequestId) => pcn.preflightDossierDocuments(selectedDossier.id, kind, sampleRouteId, labRequestId)} onGenerateDocuments={(kind, formats, sampleRouteId, expectedContextHash, labRequestId) => pcn.generateDossierDocuments(selectedDossier.id, kind, formats, sampleRouteId, expectedContextHash, labRequestId)} onDownloadPackage={() => downloadDossierPackage(selectedDossier)} onCreateSampleLot={pcn.addSampleLot} onUpdateSampleRoute={pcn.updateSampleRoute} onSaveLabRequest={pcn.addLabRequest} onUpdateLabRequest={pcn.updateLabRequest} onDispatchLabRequest={pcn.dispatchLabRequest} onReconcileLabRequest={pcn.reconcileLabRequest} onSaveHandover={(request, details) => pcn.updateLabRequest(request.id, request.status, { handoverDetails: details })} onSaveResult={pcn.addReturnedResult} onAttachResultFile={pcn.attachResultFile} onPrepareIssuance={prepareIssuance} onApproveStep={approveStep} onIssue={issuePackage} onDeliver={deliverPackage} onArchive={archivePackage} onWithdraw={withdrawPackage} onAttachIssuanceFile={pcn.attachIssuanceFile} onPreflightOfficialDocuments={pcn.preflightOfficialDocuments} onGenerateOfficialDocuments={pcn.generateOfficialDocuments} onCreateSignerDelegation={pcn.addSignerDelegation} onRevokeSignerDelegation={pcn.revokeSignerDelegation} onClose={() => { setSelectedDossierTab(undefined); setSelectedDossierId(undefined); }} />}
    </>
  );
}

export default PcnWorkspace;
