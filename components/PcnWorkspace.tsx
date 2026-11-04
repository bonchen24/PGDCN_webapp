'use client';

import { formatDateDdMmYyyy, parseDdMmYyyy, parseDdMmYyyyTime } from '../utils/formatter';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  LayoutGrid,
  List,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  Send,
  ShieldCheck,
  UserRound,
  X,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';

import PcnLoginScreen from './PcnLoginScreen';
import PcnCustomersManagementView from './PcnCustomersManagementView';
import { PcnDossierDetailView } from './PcnDossierDetailView';
import { PcnUserManagementView } from './PcnUserManagementView';
import PcnSettingsView from './PcnSettingsView';
import PcnPersonalSettingsPanel from './PcnPersonalSettingsPanel';
import PcnOcrPanel from './PcnOcrPanel';
import PgdcnWindowsWorkflowModal from './PgdcnWindowsWorkflowModal';
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
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS } from '../types';
import type { AppNotification, CertificationDossier, CertificationProposal, PcnCertificationMethod, PcnDossierDocument, PcnDocumentRequirement, PcnDossierStatus, PcnProposalStatus, PcnCertificationField, PcnSampleLot, PcnSampleItem, PcnSampleRoute, PcnWorkflowTemplate } from '../types';
import type { PcnProposalUpdateInput } from '../utils/pcnProposalApi';
import { PcnIntakeApiError } from '../utils/pcnIntakeApi';
import { formatPcnIntakeValidationIssues, indexPcnIntakeValidationIssues, validatePcnProposalIntake } from '../utils/pcnIntakePolicy';
import { getPcnDashboardMetrics } from '../utils/pcnReporting';
import { canViewNotification } from '../utils/notificationEvents';
import { canManageSystemUsers, canViewSystemSettings } from '../utils/systemSettingsPolicy';
import { downloadPcnDossierPackage } from '../utils/pcnDossierPackageApi';
import { getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation';
import { PCN_MOBILE_NAVIGATION, type PcnSection } from '../utils/pcnNavigation';
import { PgdcnDateInput } from './PgdcnDateInput';
import { matchPcnPublishedWorkflowTemplates, resolveTemplateSelectionState } from '../utils/pgdcnIntakeTemplateMatching';

const sectionLabels: Record<PcnSection, string> = {
  dashboard: 'Tổng quan',
  proposals: 'Đề nghị',
  operations: 'Sổ tổng hợp',
  'lab-operations': 'Sổ quản lý mẫu',
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

const proposalStatusLabels: Record<PcnProposalStatus, string> = {
  DRAFT: 'Bản nháp',
  RECEIVED: 'Đã tiếp nhận',
  REJECTED: 'Từ chối',
  CONVERTED: 'Đã chuyển hồ sơ',
};

function todayPcnDateInputValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function proposalDateInputValue(value?: string): string {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(normalized) ? normalized.slice(0, 10) : '';
}

function isValidPcnDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

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
    <div className="pgdcn-kpi-card">
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
  workflowTasks,
  currentUser,
  canEdit,
  onCreateProposal,
  onOpenSection,
  onOpenDossier,
  onClaimDossier,
  onAssignDossier,
}: {
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  fields: PcnCertificationField[];
  dossierDocuments: import('../types').PcnDossierDocument[];
  documentRequirements?: import('../types').PcnDocumentRequirement[];
  users?: import('../types').PcnUserAccount[];
  labRequests: import('../types').OutboundLabRequest[];
  results: import('../types').ReturnedTestResult[];
  workflowTasks: import('../types').PcnDossierWorkflowTask[];
  currentUser: import('../types').UserAccount | null;
  canEdit: boolean;
  onCreateProposal: () => void;
  onOpenSection: (section: PcnSection, fieldCode?: string) => void;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => void;
  onClaimDossier: (dossier: CertificationDossier) => Promise<void>;
  onAssignDossier: (dossierId: string, ownerUsername: string) => Promise<void>;
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
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Giám định, Chứng nhận, Phát triển thị trường • PCN</p>
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
            <PcnPipelineBoard dossiers={dossiers} proposals={proposals} fields={fields} requirements={boardRequirements} documents={dossierDocuments} workflowTasks={workflowTasks} users={boardUsers} currentUser={currentUser} onClaimDossier={onClaimDossier} onAssignDossier={onAssignDossier} onOpenDossier={onOpenDossier} />
          ) : (
            <PcnWorkQueueView dossiers={dossiers} proposals={proposals} documentRequirements={boardRequirements} dossierDocuments={dossierDocuments} workflowTasks={workflowTasks} users={boardUsers} currentUser={currentUser} onOpenDossier={onOpenDossier} onClaimDossier={onClaimDossier} onAssignDossier={onAssignDossier} />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-7 text-center"><div className="mx-auto mb-2 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400"><FolderOpen size={16} /></div><p className="text-xs font-black text-slate-600">{title}</p><p className="text-[10px] text-slate-400 mt-1">{description}</p>{action && onAction && <button onClick={onAction} className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white"><Plus size={12} /> {action}</button>}</div>;
}

function ProposalRegisterRow({
  proposal,
  dossier,
  canEdit,
  documentRequirements = [],
  dossierDocuments = [],
  onOpenDossier,
  onEdit,
}: {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  canEdit: boolean;
  documentRequirements?: PcnDocumentRequirement[];
  dossierDocuments?: PcnDossierDocument[];
  onOpenDossier: () => void;
  onEdit?: () => void;
}) {
  const proposalEditingAllowed = Boolean(onEdit && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status));
  const contactParts = [
    proposal.customerSnapshot.contactPerson,
    proposal.customerSnapshot.phone || proposal.customerSnapshot.taxId ? `SĐT: ${proposal.customerSnapshot.phone || proposal.customerSnapshot.taxId}` : undefined,
  ].filter(Boolean).join(' • ') || proposal.productName || 'Chưa có thông tin liên hệ';

  const isQc4 = proposal.fieldCodes.some((code) => code.includes('QC4') || code.includes('04'));
  const isQc9 = proposal.fieldCodes.some((code) => code.includes('QC9') || code.includes('09'));

  const docsForDossier = dossierDocuments.filter((doc) => doc.dossierId === dossier.id);
  const reqCount = documentRequirements.length > 0 ? documentRequirements.length : 5;
  const completedDocs = docsForDossier.filter((doc) => doc.status === 'PRESENT').length;
  const progressPercent = Math.min(100, Math.round((completedDocs / reqCount) * 100));

  const isOverdue = Boolean(dossier.targetDate && !['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(dossier.status) && new Date(dossier.targetDate) < new Date());
  const dueLabel = dossier.targetDate ? formatDateDdMmYyyy(dossier.targetDate) : undefined;

  const nextStepMap: Record<string, string> = {
    DRAFT: 'Bổ sung hồ sơ',
    INTAKE_REVIEW: 'Phân công chuyên viên',
    AWAITING_DOCUMENTS: 'Thu thập tài liệu bắt buộc',
    ASSIGNED: 'Lập kế hoạch đánh giá',
    PLAN_PENDING_APPROVAL: 'Phê duyệt kế hoạch',
    FIELD_EVALUATION: 'Đánh giá hiện trường & lấy mẫu',
    AWAITING_SAMPLING: 'Gửi mẫu đến PTN',
    SENT_TO_LAB: 'Chờ kết quả thử nghiệm',
    AWAITING_RESULTS: 'Soát xét kỹ thuật KQTN',
    TECHNICAL_REVIEW: 'Trình lãnh đạo phê duyệt',
    WAITING_APPROVAL: 'Ký & phát hành chứng chỉ',
    APPROVED: 'Bàn giao cho khách hàng',
    ISSUED: 'Lưu trữ hồ sơ',
    CORRECTIVE_ACTION: 'Xác nhận khắc phục',
  };
  const nextStepPreview = nextStepMap[dossier.status] || 'Tiếp tục xử lý';

  const handleQuickView = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pgdcn:quickview', {
        detail: {
          domain: 'PCN',
          dossierCode: dossier.dossierCode,
          item: {
            dossierCode: dossier.dossierCode,
            domain: 'PCN',
            customerName: proposal.customerSnapshot.name,
            productName: proposal.productName,
            status: dossier.status,
            statusLabel: statusLabels[dossier.status],
            currentStage: statusLabels[dossier.status],
            nextStep: nextStepPreview,
            targetDate: dossier.targetDate,
            assigneeName: dossier.ownerUsername,
          },
        },
      }));
    }
  };

  return (
    <tr className="align-top transition-colors hover:bg-slate-50 border-b border-slate-100">
      {/* 1. Mã hồ sơ */}
      <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-2.5 text-left font-normal border-b border-slate-100">
        <button
          type="button"
          onClick={onOpenDossier}
          aria-label={`Mở chi tiết hồ sơ ${dossier.dossierCode}`}
          className="font-mono text-xs font-black text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
        >
          {dossier.dossierCode}
        </button>
        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
          ĐN: {proposal.proposalCode}
        </span>
      </th>

      {/* 2. Khách hàng */}
      <td className="max-w-[220px] px-3 py-2.5">
        <p className="truncate text-xs font-bold text-slate-900" title={proposal.customerSnapshot.name}>
          {proposal.customerSnapshot.name || 'Chưa gắn khách hàng'}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-slate-500" title={contactParts}>
          {contactParts}
        </p>
      </td>

      {/* 3. Loại hồ sơ */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {isQc4 && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800">QC4</span>}
          {isQc9 && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-800">QC9</span>}
          {!isQc4 && !isQc9 && (
            proposal.fieldCodes.length > 0 ? (
              proposal.fieldCodes.map((code) => (
                <span key={code} className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">{code}</span>
              ))
            ) : (
              <span className="text-[9px] font-bold text-slate-400">QC</span>
            )
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {proposal.productName ? `${proposal.productName}` : 'Phương thức 5'}
        </p>
      </td>

      {/* 4. Giai đoạn */}
      <td className="px-3 py-2.5">
        <p className="text-xs font-bold text-slate-800">{statusLabels[dossier.status] || dossier.status}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">→ Tiếp: {nextStepPreview}</p>
      </td>

      {/* 5. Tiến độ */}
      <td className="px-3 py-2.5 min-w-[100px]">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-[10px] font-black text-slate-700">{progressPercent}%</span>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-400">{completedDocs}/{reqCount} tài liệu</p>
      </td>

      {/* 6. Phụ trách */}
      <td className="px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800">{dossier.ownerUsername || 'Chưa phân công'}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{dossier.ownerUsername ? 'Chủ hồ sơ' : 'Chờ chỉ định'}</p>
      </td>

      {/* 7. Trạng thái */}
      <td className="px-3 py-2.5">
        <PgdcnStatusBadge domain="PCN" status={dossier.status} label={statusLabels[dossier.status]} />
        <p className={`mt-0.5 text-[10px] ${isOverdue ? 'font-bold text-rose-600' : 'text-slate-400'}`}>
          {isOverdue ? `Quá hạn · ${dueLabel || ''}` : dueLabel ? `Hạn: ${dueLabel}` : 'Chưa đặt hạn'}
        </p>
      </td>

      {/* 8. Thao tác */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleQuickView}
            aria-label={`Xem nhanh ${dossier.dossierCode}`}
            title="Xem nhanh trong ngăn kéo"
            className="mobile-touch-target inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 cursor-pointer"
          >
            <Eye size={12} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only text-[11px]">Xem</span>
          </button>
          <button
            type="button"
            onClick={onOpenDossier}
            aria-label={`Mở hồ sơ chuẩn ${dossier.dossierCode}`}
            title="Mở hồ sơ chuẩn"
            className="mobile-touch-target inline-flex min-h-8 items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <FolderOpen size={12} aria-hidden="true" />
            <span>Xử lý · Mở hồ sơ chuẩn</span>
          </button>
          {canEdit && proposalEditingAllowed && (
            <button
              type="button"
              onClick={onEdit}
              title="Sửa Đề nghị"
              aria-label={`Sửa Đề nghị ${proposal.proposalCode}`}
              className="mobile-touch-target min-h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 cursor-pointer"
            >
              Sửa Đề nghị
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PcnPendingWorkflowTemplatePanel({ dossier, workflowTemplates, documentRequirements, onAttach }: {
  dossier: CertificationDossier;
  workflowTemplates: PcnWorkflowTemplate[];
  documentRequirements: PcnDocumentRequirement[];
  onAttach: (dossierId: string, selection: { id: string; version: number }) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const candidates = useMemo(() => matchPcnPublishedWorkflowTemplates(workflowTemplates, {
    fieldCodes: dossier.fieldCodes,
    method: dossier.method,
    dossierType: dossier.dossierType,
  }), [dossier.dossierType, dossier.fieldCodes, dossier.method, workflowTemplates]);
  const selection = useMemo(() => resolveTemplateSelectionState({ candidates, selectedId }), [candidates, selectedId]);
  const chosen = selection.selectedTemplate || selection.suggestedTemplate;
  const options = useMemo<PcnCatalogOption[]>(() => candidates.map((template) => ({
    value: template.id,
    label: `${template.name} · ${template.code} · v${template.version}`,
    searchText: `${template.name} ${template.code} v${template.version}`,
    description: template.description,
  })), [candidates]);
  const requirementRows = useMemo(() => {
    if (!chosen) return undefined;
    const ids = [...new Set(chosen.nodes.flatMap((node) => node.requirementIds))];
    const rows = ids.map((id) => ({ id, definition: documentRequirements.find((requirement) => requirement.id === id || requirement.code === id) }));
    return {
      required: rows.filter((row) => row.definition?.required),
      optional: rows.filter((row) => row.definition && !row.definition.required),
      unknown: rows.filter((row) => !row.definition),
    };
  }, [chosen, documentRequirements]);

  if (dossier.workflowTemplatePending !== true) return null;
  const attach = async () => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      await onAttach(dossier.id, { id: chosen.id, version: chosen.version });
    } catch (cause: any) {
      setError(cause?.message || 'Không thể gắn bộ hồ sơ mẫu.');
    } finally {
      setBusy(false);
    }
  };

  return <section aria-label={`Gắn bộ hồ sơ mẫu cho ${dossier.dossierCode}`} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[10px] text-amber-950">
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="min-w-0"><p className="font-black uppercase tracking-wide text-amber-800">Hồ sơ đang chờ bộ hồ sơ mẫu</p>
        {candidates.length === 0 ? <p className="mt-1">Chưa xác định bộ hồ sơ mẫu. Có thể quay lại sau khi catalog có mẫu đang publish phù hợp.</p> : <>
          {candidates.length > 1 && <PcnCatalogCombobox id={`pcn-pending-template-${dossier.id}`} label="Chọn bộ hồ sơ mẫu" value={selection.selectedId || ''} options={options} onChange={setSelectedId} disabled={busy} invalid={selection.isAmbiguous} aria-invalid={selection.isAmbiguous} />}
          {chosen && <div className="mt-1"><b>{candidates.length === 1 ? 'Đề xuất phù hợp' : 'Mẫu đã chọn'}:</b> {chosen.name} · <span className="font-mono">{chosen.code}</span> · phiên bản {chosen.version}</div>}
          {requirementRows && <div className="mt-2 grid gap-1 sm:grid-cols-2"><p><b>Bắt buộc:</b> {requirementRows.required.map((row) => row.definition?.name || row.id).join(' · ') || 'Không có mục bắt buộc trong catalog.'}</p><p><b>Tùy chọn:</b> {requirementRows.optional.map((row) => row.definition?.name || row.id).join(' · ') || 'Không có mục tùy chọn trong catalog.'}</p>{requirementRows.unknown.length > 0 && <p className="sm:col-span-2"><b>Mã chưa có nhãn:</b> {requirementRows.unknown.map((row) => row.id).join(' · ')}</p>}</div>}
        </>}
        {error && <p role="alert" className="mt-1 font-bold text-rose-700">{error}</p>}
      </div>
      {candidates.length > 0 && <button type="button" onClick={() => void attach()} disabled={busy || !chosen || selection.isAmbiguous} className="mobile-touch-target min-h-11 rounded-lg bg-amber-700 px-3 py-2 text-[10px] font-black text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Đang gắn…' : 'Gắn bộ hồ sơ mẫu'}</button>}
    </div>
  </section>;
}

type PcnProposalForm = {
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
  receivedAt: string;
  registrationNumber: string;
  standards: string;
  method: PcnCertificationMethod;
  dossierType: string;
  fieldCodes: string[];
};

function ProposalView({
  fields,
  proposals,
  dossiers,
  documentRequirements,
  workflowTemplates,
  dossierDocuments,
  dataLoaded,
  sampleLots = [],
  sampleItems = [],
  sampleRoutes = [],
  customers,
  canEdit,
  initialDossierId,
  initialFieldCode,
  openFormRequest,
  onSave,
  onAttachWorkflowTemplate,
  onUpdateProposal,
  onOpenDossier,
}: {
  fields: PcnCertificationField[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  documentRequirements: PcnDocumentRequirement[];
  workflowTemplates: PcnWorkflowTemplate[];
  dossierDocuments: PcnDossierDocument[];
  dataLoaded: boolean;
  sampleLots?: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes?: PcnSampleRoute[];
  customers: Array<{ name: string; address?: string; customerCode?: string; taxId?: string; phone?: string; email?: string; contactPerson?: string }>;
  canEdit: boolean;
  initialDossierId?: string;
  initialFieldCode?: string;
  openFormRequest?: number;
  onSave: (proposal: CertificationProposal, workflowTemplateSelection?: { id: string; version: number }, dossierContext?: { method: PcnCertificationMethod; dossierType?: string }) => Promise<void>;
  onAttachWorkflowTemplate: (dossierId: string, selection: { id: string; version: number }) => Promise<void>;
  onUpdateProposal: (proposalId: string, updates: PcnProposalUpdateInput) => Promise<void>;
  onOpenDossier: (dossier: CertificationDossier) => void;
}) {
  const [pillFilter, setPillFilter] = useState<'ALL' | 'ACTION_NEEDED' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'OVERDUE' | 'QC4' | 'QC9'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'LOT_DESC' | 'CODE_DESC'>('NEWEST');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [proposalMinimized, setProposalMinimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProposal, setEditingProposal] = useState<CertificationProposal>();
  const [workflowTemplateId, setWorkflowTemplateId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PcnDossierStatus | ''>('');
  const [fieldFilter, setFieldFilter] = useState(initialFieldCode || '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const proposalFormRef = useRef<HTMLFormElement>(null);
  // Kept as a named focus anchor for the proposal modal contract; the shared Windows primitive owns the visible close control.
  const proposalCloseButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const emptyForm = () => ({
    channel: 'DIRECT' as CertificationProposal['channel'], customerName: '', customerId: '', address: '', warehouseAddress: '',
    contactPerson: '', taxId: '', phone: '', email: '', productName: '', model: '', brand: '', productType: '', specifications: '',
    manufacturer: '', manufacturerAddress: '', quantity: '1', receivedAt: todayPcnDateInputValue(), registrationNumber: '', standards: '', method: 'METHOD_1' as PcnCertificationMethod, dossierType: '', fieldCodes: [],
  });
  const [form, setForm] = useState<PcnProposalForm>(emptyForm());
  const customerOptions = useMemo<PcnCatalogOption[]>(() => customers.flatMap((customer) => {
      const value = customer.customerCode || customer.name;
      return value ? [{
        value,
        label: [customer.customerCode, customer.name].filter(Boolean).join(' — '),
        searchText: [customer.customerCode, customer.name, customer.taxId, customer.contactPerson].filter(Boolean).join(' '),
      }] : [];
    }), [customers]);
  const customerValue = form.customerId || form.customerName;
  const workflowCandidates = useMemo(() => matchPcnPublishedWorkflowTemplates(workflowTemplates, {
    fieldCodes: form.fieldCodes,
    method: form.method,
    dossierType: form.dossierType || undefined,
  }), [form.dossierType, form.fieldCodes, form.method, workflowTemplates]);
  const workflowSelection = useMemo(() => resolveTemplateSelectionState({
    candidates: workflowCandidates,
    selectedId: workflowTemplateId,
  }), [workflowCandidates, workflowTemplateId]);
  const recommendedWorkflowTemplate = workflowSelection.selectedTemplate || workflowSelection.suggestedTemplate;
  const workflowTemplateOptions = useMemo<PcnCatalogOption[]>(() => workflowCandidates.map((template) => ({
    value: template.id,
    label: `${template.name} · ${template.code} · v${template.version}`,
    searchText: `${template.name} ${template.code} v${template.version}`,
    description: template.description,
  })), [workflowCandidates]);
  const fieldOptions = useMemo<PcnCatalogOption[]>(() => fields.map((field) => ({
    value: field.code,
    label: `${field.code} · ${field.name}`,
    searchText: `${field.code} ${field.name}`,
  })), [fields]);
  const channelOptions = useMemo<PcnCatalogOption[]>(() => [
    { value: 'DIRECT', label: 'Trực tiếp' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'ONLINE_ZALO', label: 'Online / Zalo' },
    { value: 'OTHER', label: 'Khác' },
  ], []);
  const methodOptions = useMemo<PcnCatalogOption[]>(() => [
    { value: 'METHOD_1', label: 'Phương thức 1 · đánh giá tại nơi sản xuất và thử nghiệm mẫu' },
    { value: 'METHOD_5', label: 'Phương thức 5 · đánh giá quá trình và giám sát' },
    { value: 'METHOD_7', label: 'Phương thức 7 · thử nghiệm lô sản phẩm' },
  ], []);
  const dossierTypeOptions = useMemo<PcnCatalogOption[]>(() => [...new Set(workflowTemplates
    .filter((template) => template.status === 'PUBLISHED')
    .map((template) => template.appliesTo?.dossierType?.trim())
    .filter((value): value is string => Boolean(value)))].sort().map((value) => ({ value, label: value })), [workflowTemplates]);
  const templateRequirementRows = useMemo(() => {
    if (!recommendedWorkflowTemplate) return undefined;
    const ids = [...new Set(recommendedWorkflowTemplate.nodes.flatMap((node) => node.requirementIds))];
    const rows = ids.map((id) => ({ id, definition: documentRequirements.find((requirement) => requirement.id === id || requirement.code === id) }));
    return {
      required: rows.filter((row) => row.definition?.required),
      optional: rows.filter((row) => row.definition && !row.definition.required),
      unknown: rows.filter((row) => !row.definition),
    };
  }, [documentRequirements, recommendedWorkflowTemplate]);
  const legacyCustomerOption = customerValue && !customerOptions.some((option) => option.value === customerValue)
    ? { value: customerValue, label: `Giá trị hiện tại cần rà soát: ${form.customerName || customerValue}`, description: 'Giá trị cũ được giữ nguyên để bạn đối chiếu với Danh sách khách hàng.', disabled: true }
    : undefined;
  const reset = () => { setForm(emptyForm()); setEditingProposal(undefined); setWorkflowTemplateId(''); setValidationErrors({}); };
  const rememberFormFocus = () => {
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  };
  const focusFirstInvalidProposalField = () => {
    window.requestAnimationFrame(() => proposalFormRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };
  const openProposalForm = () => {
    rememberFormFocus();
    reset();
    setOpenForm(true);
    setProposalMinimized(false);
  };
  const closeProposalForm = () => {
    const focusTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    reset();
    setOpenForm(false);
    setProposalMinimized(false);
    window.requestAnimationFrame(() => focusTarget?.focus());
  };

  useEffect(() => {
    if (!openFormRequest) return;
    rememberFormFocus();
    setForm(emptyForm());
    setEditingProposal(undefined);
    setWorkflowTemplateId('');
    setValidationErrors({});
    setOpenForm(true);
    setProposalMinimized(false);
  }, [openFormRequest]);

  useEffect(() => {
    if (!openForm) return;
    return undefined;
  }, [openForm]);

  const openEdit = (proposal: CertificationProposal) => {
    rememberFormFocus();
    setEditingProposal(proposal);
    const linkedDossier = dossiers.find((item) => item.proposalId === proposal.id || item.id === proposal.dossierId);
    setWorkflowTemplateId('');
    setForm({
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
      receivedAt: proposalDateInputValue(proposal.receivedAt),
      registrationNumber: proposal.registrationNumber || '',
      standards: (proposal.standards || []).join(', '),
      method: linkedDossier?.method || 'METHOD_1',
      dossierType: linkedDossier?.dossierType || '',
      fieldCodes: proposal.fieldCodes,
    });
    setOpenForm(true);
    setProposalMinimized(false);
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
    const receivedAt = parseDdMmYyyyTime(String(ocrFields.receivedAt || '').trim()) || parseDdMmYyyy(String(ocrFields.receivedAt || '').trim());
    setForm((previous) => ({
      ...previous,
      ...(ocrFields.customerName ? { customerName: ocrFields.customerName } : {}),
      ...(ocrFields.address ? { address: ocrFields.address } : {}),
      ...(ocrFields.contactPerson ? { contactPerson: ocrFields.contactPerson } : {}),
      ...(ocrFields.taxId ? { taxId: ocrFields.taxId } : {}),
      ...(ocrFields.phone ? { phone: ocrFields.phone } : {}),
      ...(ocrFields.email ? { email: ocrFields.email } : {}),
      ...(ocrFields.warehouseAddress ? { warehouseAddress: ocrFields.warehouseAddress } : {}),
      ...(ocrFields.registrationNumber ? { registrationNumber: ocrFields.registrationNumber } : {}),
      ...((ocrFields.standards || ocrFields.tieu_chuan) ? { standards: ocrFields.standards || ocrFields.tieu_chuan } : {}),
      ...(ocrFields.productName ? { productName: ocrFields.productName } : {}),
      ...(ocrFields.productType ? { productType: ocrFields.productType } : {}),
      ...(ocrFields.model ? { model: ocrFields.model } : {}),
      ...(ocrFields.brand ? { brand: ocrFields.brand } : {}),
      ...(ocrFields.specifications ? { specifications: ocrFields.specifications } : {}),
      ...(ocrFields.manufacturer ? { manufacturer: ocrFields.manufacturer } : {}),
      ...(ocrFields.manufacturerAddress ? { manufacturerAddress: ocrFields.manufacturerAddress } : {}),
      ...(ocrFields.quantity && Number(ocrFields.quantity) > 0 ? { quantity: String(Math.round(Number(ocrFields.quantity))) } : {}),
      ...(receivedAt ? { receivedAt } : {}),
      ...(recognizedFieldCodes.length > 0 ? { fieldCodes: recognizedFieldCodes } : {}),
    }));
    toast.success('Đã điền bản nháp OCR vào biểu mẫu; hãy kiểm tra trước khi tạo Đề nghị.');
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
      standards: form.standards.split(',').map((value) => value.trim()).filter(Boolean),
    }, { requireStandards: !editingProposal });
    const receivedAtError = isValidPcnDateInput(form.receivedAt) ? undefined : 'Ngày tiếp nhận phải là ngày hợp lệ.';
    if (!intakeValidation.valid || receivedAtError) {
      const nextValidationErrors = indexPcnIntakeValidationIssues(intakeValidation.issues);
      if (receivedAtError) nextValidationErrors.receivedAt = receivedAtError;
      setValidationErrors(nextValidationErrors);
      focusFirstInvalidProposalField();
      toast.error([formatPcnIntakeValidationIssues(intakeValidation.issues), receivedAtError].filter(Boolean).join(' '));
      return;
    }
    if (!editingProposal && workflowSelection.isAmbiguous) {
      setValidationErrors({ workflowTemplate: 'Có nhiều bộ hồ sơ mẫu phù hợp. Hãy chọn một mẫu hoặc điều chỉnh điều kiện tiếp nhận.' });
      focusFirstInvalidProposalField();
      toast.error('Hãy chọn một bộ hồ sơ mẫu phù hợp trước khi tạo Đề nghị.');
      return;
    }
    const customerSnapshot = { name: form.customerName.trim(), address: form.address.trim(), taxId: form.taxId.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, contactPerson: form.contactPerson.trim() || undefined };
    setSaving(true);
    try {
      if (editingProposal) {
        await onUpdateProposal(editingProposal.id, {
          channel: form.channel,
          customerId: form.customerId.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          standards: form.standards.split(',').map((value) => value.trim()).filter(Boolean),
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
          proposalCode: '',
          channel: form.channel, status: 'RECEIVED', customerId: form.customerId || undefined,
          customerSnapshot,
          registrationNumber: form.registrationNumber.trim() || undefined,
          standards: form.standards.split(',').map((value) => value.trim()).filter(Boolean),
          warehouseAddress: form.warehouseAddress.trim() || undefined,
          productName: form.productName.trim(), model: form.model.trim() || undefined, brand: form.brand.trim() || undefined,
          productType: form.productType.trim() || undefined, specifications: form.specifications.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined, manufacturerAddress: form.manufacturerAddress.trim() || undefined, quantity: Math.max(1, Number(form.quantity) || 1), fieldCodes: form.fieldCodes,
          receivedAt: form.receivedAt, createdAt: now, updatedAt: now,
        };
        const selectedTemplate = workflowSelection.selectedTemplate || workflowSelection.suggestedTemplate;
        await onSave(proposal, selectedTemplate ? { id: selectedTemplate.id, version: selectedTemplate.version } : undefined, {
          method: form.method,
          dossierType: form.dossierType || undefined,
        });
        toast.success('Đã tạo Đề nghị và bộ hồ sơ.');
      }
      closeProposalForm();
    } catch (error: any) {
      if (error instanceof PcnIntakeApiError && error.issues.length > 0) {
        setValidationErrors(indexPcnIntakeValidationIssues(error.issues));
        focusFirstInvalidProposalField();
      }
      toast.error(error?.message || 'Không thể lưu Đề nghị.');
    } finally {
      setSaving(false);
    }
  };

  const dossierByProposalId = useMemo(() => new Map(dossiers.map((dossier) => [dossier.proposalId, dossier])), [dossiers]);
  const visibleProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const now = new Date();
    const filtered = proposals.filter((proposal) => {
      const dossier = dossierByProposalId.get(proposal.id);
      if (initialDossierId && dossier?.id !== initialDossierId) return false;
      if (statusFilter && dossier?.status !== statusFilter) return false;
      if (fieldFilter && !proposal.fieldCodes.includes(fieldFilter)) return false;

      // Pill filter tabs
      if (pillFilter === 'ACTION_NEEDED') {
        if (!dossier || !['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'DOCUMENTS_SUBMITTED'].includes(dossier.status)) return false;
      } else if (pillFilter === 'IN_PROGRESS') {
        if (!dossier || ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'PENDING_APPROVAL', 'LEAD_REVIEW', 'APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(dossier.status)) return false;
      } else if (pillFilter === 'AWAITING_APPROVAL') {
        if (!dossier || !['PENDING_APPROVAL', 'LEAD_REVIEW'].includes(dossier.status)) return false;
      } else if (pillFilter === 'OVERDUE') {
        if (!dossier || !dossier.targetDate || ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(dossier.status)) return false;
        if (new Date(dossier.targetDate) >= now) return false;
      } else if (pillFilter === 'QC4') {
        if (!proposal.fieldCodes.some((code) => code.includes('QC4') || code.includes('04'))) return false;
      } else if (pillFilter === 'QC9') {
        if (!proposal.fieldCodes.some((code) => code.includes('QC9') || code.includes('09'))) return false;
      }

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

    return filtered.sort((a, b) => {
      if (sortBy === 'LOT_DESC') {
        const lotA = sampleLots?.find((l) => l.dossierId === a.dossierId)?.lotCode || '';
        const lotB = sampleLots?.find((l) => l.dossierId === b.dossierId)?.lotCode || '';
        return lotB.localeCompare(lotA);
      }
      if (sortBy === 'CODE_DESC') {
        return (b.proposalCode || '').localeCompare(a.proposalCode || '');
      }
      return new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime();
    });
  }, [dossierByProposalId, fieldFilter, initialDossierId, pillFilter, proposals, query, statusFilter, sortBy, sampleLots]);

  // Quick filter counts
  const chipCounts = useMemo(() => {
    const total = proposals.length;
    let qc4 = 0;
    let qc9 = 0;
    let intake = 0;
    let inProgress = 0;
    let awaitingApproval = 0;
    let overdue = 0;
    let completed = 0;
    const now = new Date();

    for (const p of proposals) {
      if (p.fieldCodes.some((code) => code.includes('QC4') || code.includes('04'))) qc4++;
      if (p.fieldCodes.some((code) => code.includes('QC9') || code.includes('09'))) qc9++;
      const d = dossierByProposalId.get(p.id);
      if (d) {
        if (['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'DOCUMENTS_SUBMITTED'].includes(d.status)) intake++;
        else if (['PENDING_APPROVAL', 'LEAD_REVIEW'].includes(d.status)) awaitingApproval++;
        else if (['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(d.status)) completed++;
        else inProgress++;

        if (d.targetDate && !['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(d.status)) {
          const target = new Date(d.targetDate);
          if (target < now) overdue++;
        }
      }
    }
    return { total, qc4, qc9, intake, inProgress, awaitingApproval, overdue, completed };
  }, [proposals, dossierByProposalId]);

  return (
    <div className="pcn-page-surface min-w-0 p-3 md:p-5 space-y-3.5 mobile-safe-bottom bg-slate-50/60">
      {/* Title & Top Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Quản lý Đề nghị</h1>
          <p className="text-xs text-slate-500 mt-0.5">Phòng Giám định - Chứng nhận và Phát triển thị trường · Danh sách hồ sơ chuẩn dạng bảng TVCI Lab</p>
        </div>
        <div className="flex items-center gap-2">
          {!openForm && canEdit && (
            <button
              onClick={openProposalForm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Nhận Phiếu / Tạo Đề nghị
            </button>
          )}
        </div>
      </div>

      {/* Unified Search & Status Pills Filter Bar (TVCI Lab Standard) */}
      <div data-testid="pcn-proposal-filters" className="pgdcn-toolbar-nowrap flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
        {/* Search input with rounded-xl */}
        <div className="pgdcn-toolbar-search relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          {!query && (
            <span className="pointer-events-none absolute left-9 right-3 top-1/2 -translate-y-1/2 truncate text-xs text-slate-400">
              Tìm mã PYC, số lô, mã hồ sơ, model, khách hàng...
            </span>
          )}
          <input
            type="text"
            aria-label="Tìm Đề nghị"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 shadow-2xs"
          />
        </div>

        {/* Filter Pills - Single row */}
        <div className="pgdcn-toolbar-pills flex items-center gap-1.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setPillFilter('ALL'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'ALL' && statusFilter === '' && fieldFilter === ''
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            Tất cả
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'ALL' && statusFilter === '' && fieldFilter === '' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setPillFilter(pillFilter === 'ACTION_NEEDED' ? 'ALL' : 'ACTION_NEEDED'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'ACTION_NEEDED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            Cần xử lý
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'ACTION_NEEDED' ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.intake}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setPillFilter(pillFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'IN_PROGRESS'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            Đang xử lý
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'IN_PROGRESS' ? 'bg-sky-700 text-sky-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.inProgress}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setPillFilter(pillFilter === 'AWAITING_APPROVAL' ? 'ALL' : 'AWAITING_APPROVAL'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'AWAITING_APPROVAL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            Chờ phê duyệt
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'AWAITING_APPROVAL' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.awaitingApproval}
            </span>
          </button>

          {chipCounts.overdue > 0 && (
            <button
              type="button"
              onClick={() => { setPillFilter(pillFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE'); setStatusFilter(''); setFieldFilter(''); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
                pillFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-rose-200 text-rose-700 hover:border-rose-300'
              }`}
            >
              Quá hạn
              <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-black text-rose-800">
                {chipCounts.overdue}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setPillFilter(pillFilter === 'QC4' ? 'ALL' : 'QC4'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'QC4'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            QC4
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'QC4' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.qc4}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setPillFilter(pillFilter === 'QC9' ? 'ALL' : 'QC9'); setStatusFilter(''); setFieldFilter(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
              pillFilter === 'QC9'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            QC9
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
              pillFilter === 'QC9' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {chipCounts.qc9}
            </span>
          </button>

          {/* Lọc nâng cao */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                showAdvanced || (statusFilter && statusFilter !== 'INTAKE_REVIEW' && statusFilter !== 'SENT_TO_LAB')
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Lọc nâng cao</span>
              <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg space-y-2.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Trạng thái hồ sơ</label>
                  <select
                    aria-label="Lọc trạng thái hồ sơ"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PcnDossierStatus | '')}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(statusLabels).map(([status, label]) => (
                      <option key={status} value={status}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Lĩnh vực</label>
                  <select
                    aria-label="Lọc Lĩnh vực"
                    value={fieldFilter}
                    onChange={(e) => setFieldFilter(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="">Tất cả Lĩnh vực</option>
                    {fields.map((f) => (
                      <option key={f.code} value={f.code}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Sắp xếp */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 cursor-pointer shrink-0"
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="LOT_DESC">Số lô giảm dần</option>
            <option value="CODE_DESC">Mã giảm dần</option>
          </select>
        </div>
      </div>
      {openForm && <>{/* data-testid="pcn-proposal-form-modal" aria-labelledby="pcn-proposal-modal-title" data-testid="pcn-proposal-modal-body" data-testid="pcn-proposal-modal-footer" focus-visible:ring */}<PgdcnWindowsWorkflowModal
        open={openForm}
        minimized={proposalMinimized}
        title={editingProposal ? 'Sửa thông tin Đề nghị' : 'Thông tin Đề nghị / bộ hồ sơ'}
        eyebrow="PCN · Tiếp nhận hồ sơ"
        description="Soạn Đề nghị trực tiếp trên app. Tệp kéo thả chỉ tạo bản nháp OCR; dữ liệu phải được kiểm tra trước khi lưu."
        contextLabel="Đề nghị PCN"
        accent="emerald"
        testId="pcn-proposal-form-modal"
        bodyTestId="pcn-proposal-modal-body"
        footerTestId="pcn-proposal-modal-footer"
        titleId="pcn-proposal-modal-title"
        busy={saving}
        onClose={closeProposalForm}
        onMinimize={() => setProposalMinimized(true)}
        onRestore={() => setProposalMinimized(false)}
        footer={<div className="flex w-full flex-wrap justify-end gap-2"><button type="button" onClick={closeProposalForm} disabled={saving} className="min-h-10 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" form="pcn-proposal-form" disabled={saving} aria-busy={saving} className="min-h-10 rounded-lg bg-emerald-600 px-3 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-50">{saving ? 'Đang lưu...' : editingProposal ? 'Lưu thay đổi' : 'Tạo Đề nghị & bộ hồ sơ'}</button></div>}
      >
        <form id="pcn-proposal-form" ref={proposalFormRef} onSubmit={submit} className="space-y-3 p-3 md:p-4">
          <PcnOcrPanel context="proposal" onApply={applyProposalOcr} disabled={saving} />
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
<Field label="Mã Đề nghị">
<div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-[10px] font-bold text-indigo-700">Hệ thống tự cấp theo dạng PCN-YYMMDD-TT khi lưu</div>
</Field>
<Field label="Trạng thái Đề nghị">
<div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-700" aria-live="polite">{editingProposal ? proposalStatusLabels[editingProposal.status] : 'Đã tiếp nhận · chờ hệ thống chuyển hồ sơ'}</div>
</Field>
        <Field label="Kênh tiếp nhận">
<PcnCatalogCombobox id="pcn-proposal-channel" label="Kênh tiếp nhận" hideLabel value={form.channel} options={channelOptions} onChange={(value) => setForm({ ...form, channel: value as CertificationProposal['channel'] })} disabled={saving} />
</Field>
<Field label="Số lượng mẫu *" error={validationErrors.quantity} errorId="pcn-proposal-error-quantity">
<input id="pcn-proposal-quantity" type="number" min="1" step="1" inputMode="numeric" required value={form.quantity} aria-invalid={Boolean(validationErrors.quantity)} aria-describedby={validationErrors.quantity ? 'pcn-proposal-error-quantity' : undefined} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
</Field>
<Field label="Ngày tiếp nhận *" error={validationErrors.receivedAt} errorId="pcn-proposal-error-received-at">
<PgdcnDateInput id="pcn-proposal-received-at" value={form.receivedAt} readOnly={Boolean(editingProposal)} required aria-required="true" aria-invalid={Boolean(validationErrors.receivedAt)} aria-describedby={validationErrors.receivedAt ? 'pcn-proposal-error-received-at' : undefined} onChange={(value) => setForm({ ...form, receivedAt: value })} />
</Field>
<Field label="Số đăng ký Một cửa quốc gia">
<input id="pcn-proposal-registration-number" value={form.registrationNumber} onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })} />
</Field>
</div>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
<Field label="Khách hàng *" error={validationErrors['customerSnapshot.name']} errorId="pcn-proposal-error-customer-name">
<PcnCatalogCombobox id="pcn-customer" label="Khách hàng *" hideLabel value={customerValue} options={customerOptions} unmatchedOption={legacyCustomerOption} onChange={handleCustomerSelection} required invalid={Boolean(validationErrors['customerSnapshot.name'])} aria-invalid={Boolean(validationErrors['customerSnapshot.name'])} disabled={saving} />
</Field>
<Field label="Địa chỉ khách hàng *" error={validationErrors['customerSnapshot.address']} errorId="pcn-proposal-error-customer-address">
<input id="pcn-proposal-customer-address" required value={form.address} aria-invalid={Boolean(validationErrors['customerSnapshot.address'])} aria-describedby={validationErrors['customerSnapshot.address'] ? 'pcn-proposal-error-customer-address' : undefined} onChange={(event) => setForm({ ...form, address: event.target.value })} />
</Field>
</div>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
<Field label="Người liên hệ hoặc Mã số thuế *" error={validationErrors['customerSnapshot.contactPerson']} errorId="pcn-proposal-error-customer-contact">
<input id="pcn-proposal-contact" required={!form.taxId.trim()} value={form.contactPerson} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} aria-describedby={validationErrors['customerSnapshot.contactPerson'] ? 'pcn-proposal-error-customer-contact' : undefined} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
</Field>
<Field label="Mã số thuế" error={validationErrors['customerSnapshot.contactPerson']} errorId="pcn-proposal-error-customer-tax-id">
<input id="pcn-proposal-tax-id" required={!form.contactPerson.trim()} value={form.taxId} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} aria-describedby={validationErrors['customerSnapshot.contactPerson'] ? 'pcn-proposal-error-customer-contact' : undefined} onChange={(event) => setForm({ ...form, taxId: event.target.value })} />
</Field>
<Field label="Điện thoại">
<input id="pcn-proposal-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
</Field>
<Field label="Email">
<input id="pcn-proposal-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
</Field>
</div>
<Field label="Địa chỉ/kho liên quan *" error={validationErrors.warehouseAddress} errorId="pcn-proposal-error-warehouse-address">
<input id="pcn-proposal-warehouse-address" required value={form.warehouseAddress} aria-invalid={Boolean(validationErrors.warehouseAddress)} aria-describedby={validationErrors.warehouseAddress ? 'pcn-proposal-error-warehouse-address' : undefined} onChange={(event) => setForm({ ...form, warehouseAddress: event.target.value })} />
</Field>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
<Field label="Tên sản phẩm *" error={validationErrors.productName} errorId="pcn-proposal-error-product-name">
<input id="pcn-proposal-product-name" required value={form.productName} aria-invalid={Boolean(validationErrors.productName)} aria-describedby={validationErrors.productName ? 'pcn-proposal-error-product-name' : undefined} onChange={(event) => setForm({ ...form, productName: event.target.value })} />
</Field>
<Field label="Kiểu/loại sản phẩm *" error={validationErrors.productType} errorId="pcn-proposal-error-product-type">
<input id="pcn-proposal-product-type" required value={form.productType} aria-invalid={Boolean(validationErrors.productType)} aria-describedby={validationErrors.productType ? 'pcn-proposal-error-product-type' : undefined} onChange={(event) => setForm({ ...form, productType: event.target.value })} />
</Field>
<Field label="Kiểu loại *" error={validationErrors.model} errorId="pcn-proposal-error-model">
<input id="pcn-proposal-model" required value={form.model} aria-invalid={Boolean(validationErrors.model)} aria-describedby={validationErrors.model ? 'pcn-proposal-error-model' : undefined} onChange={(event) => setForm({ ...form, model: event.target.value })} />
</Field>
<Field label="Nhãn hiệu *" error={validationErrors.brand} errorId="pcn-proposal-error-brand">
<input id="pcn-proposal-brand" required value={form.brand} aria-invalid={Boolean(validationErrors.brand)} aria-describedby={validationErrors.brand ? 'pcn-proposal-error-brand' : undefined} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
</Field>
</div>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
<Field label="Nhà sản xuất *" error={validationErrors.manufacturer} errorId="pcn-proposal-error-manufacturer">
<input id="pcn-proposal-manufacturer" required value={form.manufacturer} aria-invalid={Boolean(validationErrors.manufacturer)} aria-describedby={validationErrors.manufacturer ? 'pcn-proposal-error-manufacturer' : undefined} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} />
</Field>
<Field label="Địa chỉ nhà sản xuất">
<input id="pcn-proposal-manufacturer-address" value={form.manufacturerAddress} onChange={(event) => setForm({ ...form, manufacturerAddress: event.target.value })} />
</Field>
<Field label="Thông số kỹ thuật / mô tả *" error={validationErrors.specifications} errorId="pcn-proposal-error-specifications">
<textarea id="pcn-proposal-specifications" rows={2} required value={form.specifications} aria-invalid={Boolean(validationErrors.specifications)} aria-describedby={validationErrors.specifications ? 'pcn-proposal-error-specifications' : undefined} onChange={(event) => setForm({ ...form, specifications: event.target.value })} />
</Field>
</div>
<Field label="Tiêu chuẩn / quy chuẩn *" error={validationErrors.standards} errorId="pcn-proposal-error-standards">
<input id="pcn-proposal-standards" required value={form.standards} aria-invalid={Boolean(validationErrors.standards)} aria-describedby={validationErrors.standards ? 'pcn-proposal-error-standards' : undefined} onChange={(event) => setForm({ ...form, standards: event.target.value })} />
</Field>
<div>
<div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lĩnh vực <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></div>
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
  <Field label="Phương thức chứng nhận *">
    <PcnCatalogCombobox id="pcn-proposal-method" label="Phương thức chứng nhận" hideLabel value={form.method} options={methodOptions} onChange={(value) => setForm({ ...form, method: value as PcnCertificationMethod })} disabled={saving || Boolean(editingProposal)} />
  </Field>
  <Field label="Loại hồ sơ theo mẫu">
    <PcnCatalogCombobox id="pcn-proposal-dossier-type" label="Loại hồ sơ theo mẫu" hideLabel value={form.dossierType} options={dossierTypeOptions} onChange={(value) => setForm({ ...form, dossierType: value })} disabled={saving || Boolean(editingProposal)} />
  </Field>
</div>
<div className="space-y-2">
  <PcnCatalogCombobox id="pcn-proposal-field-picker" label="Thêm lĩnh vực" value="" options={fieldOptions.filter((option) => !form.fieldCodes.includes(option.value))} onChange={(value) => { if (value) setForm((current) => ({ ...current, fieldCodes: [...current.fieldCodes, value] })); }} disabled={saving || Boolean(editingProposal)} aria-invalid={Boolean(validationErrors.fieldCodes)} />
  <div className="flex flex-wrap gap-1.5" aria-label="Lĩnh vực đã chọn">{form.fieldCodes.map((code) => {
    const field = fields.find((item) => item.code === code);
    return <button key={code} type="button" disabled={Boolean(editingProposal)} onClick={() => setForm((current) => ({ ...current, fieldCodes: current.fieldCodes.filter((item) => item !== code) }))} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 disabled:cursor-default">{code} · {field?.name || code}{field?.scopeStatus === 'NEEDS_PCN_CONFIRMATION' ? ' · cần xác nhận phạm vi' : ''}</button>;
  })}</div>
  {validationErrors.fieldCodes && <p id="pcn-proposal-error-field-codes" role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{validationErrors.fieldCodes}</p>}
</div>
<section hidden={Boolean(editingProposal)} aria-live="polite" aria-label="Bộ hồ sơ mẫu phù hợp" className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[10px] text-indigo-950">
  <h3 className="font-black">Bộ hồ sơ mẫu</h3>
  {workflowCandidates.length === 0 ? <p className="mt-1 font-bold text-amber-800">Chưa xác định bộ hồ sơ mẫu. Có thể lưu Đề nghị và gắn mẫu sau.</p> : <>
    {workflowCandidates.length > 1 && <div className="mt-2"><PcnCatalogCombobox id="pcn-proposal-workflow-template" label="Chọn bộ hồ sơ mẫu" value={workflowSelection.selectedId || ''} options={workflowTemplateOptions} onChange={setWorkflowTemplateId} invalid={workflowSelection.isAmbiguous || Boolean(validationErrors.workflowTemplate)} aria-invalid={workflowSelection.isAmbiguous || Boolean(validationErrors.workflowTemplate)} disabled={saving} /><p className="mt-1 text-slate-600">Có {workflowCandidates.length} bộ mẫu phù hợp. Chọn đúng bộ hồ sơ để liên kết khi tạo.</p></div>}
    {recommendedWorkflowTemplate && <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2.5">
      <p className="font-black">{workflowCandidates.length === 1 ? 'Đề xuất phù hợp' : 'Mẫu đã chọn'}: {recommendedWorkflowTemplate.name}</p>
      <p className="mt-0.5 font-mono text-slate-600">{recommendedWorkflowTemplate.code} · phiên bản {recommendedWorkflowTemplate.version}</p>
      {templateRequirementRows && <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><b>Bắt buộc</b><p className="mt-0.5 leading-4">{templateRequirementRows.required.map((row) => row.definition?.name || row.id).join(' · ') || 'Không có mục bắt buộc được khai báo trong catalog.'}</p></div>
        <div><b>Tùy chọn</b><p className="mt-0.5 leading-4">{templateRequirementRows.optional.map((row) => row.definition?.name || row.id).join(' · ') || 'Không có mục tùy chọn được khai báo trong catalog.'}</p></div>
        {templateRequirementRows.unknown.length > 0 && <div className="sm:col-span-2"><b>Mã tài liệu chưa có nhãn trong catalog</b><p className="mt-0.5 leading-4">{templateRequirementRows.unknown.map((row) => row.id).join(' · ')}</p></div>}
      </div>}
    </div>}
    {workflowSelection.isAmbiguous && validationErrors.workflowTemplate && <p role="alert" className="mt-1 font-bold text-rose-700">{validationErrors.workflowTemplate}</p>}
  </>}
</section>
</div>
<section aria-labelledby="pcn-proposal-domain-boundaries" className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-[10px] text-indigo-900">
<h3 id="pcn-proposal-domain-boundaries" className="font-black">Dữ liệu bổ sung theo đúng vùng nghiệp vụ</h3>
<p className="mt-1 leading-4">Đơn vị mẫu sẽ được ghi trong thông tin lô/mẫu sau khi hồ sơ được tiếp nhận; biểu mẫu Đề nghị không yêu cầu nhập đơn vị riêng.</p>
<p className="mt-1 leading-4">Lĩnh vực và phương thức chứng nhận được xác nhận ngay tại đây để tìm đúng bộ hồ sơ mẫu trước khi lưu.</p>
<p className="mt-1 leading-4">Tài liệu, chứng cứ và ghi chú vận hành được bổ sung tại danh mục tài liệu hồ sơ sau khi tạo Đề nghị.</p>
<p className="mt-1 leading-4">Trạng thái do hệ thống quản lý theo quy trình; biểu mẫu không cho phép tự đổi trạng thái.</p>
</section>
</form>
      </PgdcnWindowsWorkflowModal></>}

      {initialDossierId && <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-800">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</div>}
      {dossiers.filter((dossier) => dossier.workflowTemplatePending === true).map((dossier) => <PcnPendingWorkflowTemplatePanel key={dossier.id} dossier={dossier} workflowTemplates={workflowTemplates} documentRequirements={documentRequirements} onAttach={onAttachWorkflowTemplate} />)}
      {proposals.length === 0 ? (
        <EmptyState title="Chưa có Đề nghị" description="Tiếp nhận Đề nghị từ khách hàng để tạo bộ hồ sơ chứng nhận." action={canEdit ? 'Tạo Đề nghị' : undefined} onAction={canEdit ? openProposalForm : undefined} />
      ) : visibleProposals.length === 0 ? (
        <EmptyState title="Không tìm thấy Đề nghị" description="Thử đổi từ khóa hoặc bộ lọc trạng thái/Lĩnh vực." />
      ) : (
        <div className="mobile-scroll-x min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table aria-label="Danh sách Đề nghị PCN" className="w-full min-w-[980px] border-collapse text-left text-[10px]">
            <caption className="sr-only">Danh sách Đề nghị PCN và hồ sơ liên kết</caption>
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Mã hồ sơ</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Mã Đề nghị</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Khách hàng</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Liên hệ / MST</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Loại hồ sơ</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Lĩnh vực / QC</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Giai đoạn</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Bước tiếp theo</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Tiến độ</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Tài liệu</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Phụ trách</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Chủ hồ sơ</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                  <span className="block font-black text-slate-700">Trạng thái</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Hạn SLA</span>
                </th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5 text-right">
                  <span className="block font-black text-slate-700">Thao tác</span>
                  <span className="block text-[9px] font-semibold text-slate-400 normal-case">Xử lý / Xem</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProposals.map((proposal) => {
                const dossier = dossiers.find((item) => item.id === proposal.dossierId || item.proposalId === proposal.id);
                return dossier ? (
                  <ProposalRegisterRow
                    key={proposal.id}
                    proposal={proposal}
                    dossier={dossier}
                    canEdit={canEdit}
                    documentRequirements={documentRequirements}
                    dossierDocuments={dossierDocuments}
                    onOpenDossier={() => onOpenDossier(dossier)}
                    onEdit={() => openEdit(proposal)}
                  />
                ) : (
                  <tr key={proposal.id}>
                    <td colSpan={8} className="px-3 py-3 text-[10px] text-amber-800">
                      Đề nghị <b>{proposal.proposalCode}</b> chưa có bộ hồ sơ liên kết.
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, error, errorId, hideLabel = false, children }: { label: string; required?: boolean; error?: string; errorId?: string; hideLabel?: boolean; children: React.ReactNode }) {
  const normalizedLabel = label.replace(/\s*\*\s*$/, '');
  const childProps = React.isValidElement(children) ? children.props as { required?: boolean } : undefined;
  const isRequired = required ?? (Boolean(childProps?.required) || normalizedLabel !== label);
  return <label className="block">{!hideLabel && <span className="block text-[10px] font-black text-slate-500 mb-1">{normalizedLabel}{isRequired && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>}<div className={`[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[11px] [&_input]:outline-none [&_input]:focus:border-emerald-400 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-1.5 [&_select]:text-[11px] [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:px-2.5 [&_textarea]:py-1.5 [&_textarea]:text-[11px] [&_textarea]:outline-none ${error ? '[&_input]:border-rose-300 [&_select]:border-rose-300 [&_textarea]:border-rose-300 [&_input]:bg-rose-50/40 [&_select]:bg-rose-50/40 [&_textarea]:bg-rose-50/40' : '[&_input]:border-slate-200 [&_select]:border-slate-200 [&_textarea]:border-slate-200'}`}>{children}</div>{error && <p id={errorId} role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{error}</p>}</label>;
}

export type PcnWorkspaceProps = {
  embedded?: boolean;
  initialSection?: PcnSection;
  initialDossierId?: string;
  initialDossierTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab;
  initialDossierNodeId?: string;
  initialDraftDossierId?: string;
  initialDraftRequirementId?: string;
  initialDraftNodeId?: string;
  initialDraftKind?: import('../types').PcnDraftFormKind;
  initialDraftReturnTo?: string;
  standaloneDossier?: boolean;
  onActiveSectionChange?: (section: PcnSection) => void;
  onOpenContextualAssistant?: (dossierId: string) => void;
};

export function PcnWorkspace({ embedded = false, initialSection = 'dashboard', initialDossierId, initialDossierTab, initialDossierNodeId, initialDraftDossierId, initialDraftRequirementId, initialDraftNodeId, initialDraftKind, initialDraftReturnTo, standaloneDossier = false, onActiveSectionChange, onOpenContextualAssistant }: PcnWorkspaceProps = {}) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pcn = usePcnStore();
  const resetPcn = usePcnStore((state) => state.reset);
  const [pcnSessionChecked, setPcnSessionChecked] = useState(() => embedded || Boolean(usePcnSessionStore.getState().currentUser));
  const [activeSection, setActiveSection] = useState<PcnSection>(initialSection);
  const [selectedField, setSelectedField] = useState<string | undefined>();
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [focusedDossierId, setFocusedDossierId] = useState<string | undefined>();
  const [proposalFormRequest, setProposalFormRequest] = useState(0);
  const [selectedDossierId, setSelectedDossierId] = useState<string | undefined>(initialDossierId);
  const [selectedDossierTab, setSelectedDossierTab] = useState<import('../utils/pcnDossierNavigation').PcnDossierDetailTab | undefined>(initialDossierTab);
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
    setSelectedDossierId(initialDossierId);
    setSelectedDossierTab(initialDossierTab);
  }, [initialDossierId, initialDossierTab]);

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

  const openSection = (section: PcnSection, entityKey?: string) => { setActiveSection(section); onActiveSectionChange?.(section); setFocusedDossierId(undefined); setSelectedDossierId(undefined); setSelectedDossierTab(undefined); setSelectedField(section === 'proposals' ? entityKey : undefined); setCustomerSearchQuery(section === 'customers' ? (entityKey || '') : ''); setMobileMenuOpen(false); };
  const openNewProposal = () => {
    openSection('proposals');
    setFocusedDossierId(undefined);
    setSelectedField(undefined);
    setProposalFormRequest((current) => current + 1);
    setMobileMenuOpen(false);
  };
  const openDossierAtCurrentStation = (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => {
    const query = initialTab ? `?tab=${encodeURIComponent(initialTab)}` : '';
    router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossier.id)}${query}`);
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
      openDossierAtCurrentStation(dossier, notificationTab);
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
  const closeSelectedDossier = () => {
    if (standaloneDossier) {
      router.replace('/pgdcn/pcn');
      return;
    }
    setSelectedDossierTab(undefined);
    setSelectedDossierId(undefined);
  };
  const downloadDossierPackage = async (dossier: CertificationDossier) => {
    try {
      await downloadPcnDossierPackage(dossier.id, dossier.dossierCode);
      toast.success(`Đã tải bộ hồ sơ ${dossier.dossierCode}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải bộ hồ sơ PCN.');
    }
  };
  const isPcnAdmin = canManageSystemUsers(currentUser);
  const canViewPcnSettings = canViewSystemSettings(currentUser);
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
  const assignPcnDossier = async (dossierId: string, ownerUsername: string) => {
    try {
      await pcn.updateDossier(dossierId, { ownerUsername });
      toast.success(ownerUsername.trim() ? 'Đã gán người thực hiện cho hồ sơ.' : 'Đã bỏ gán người thực hiện.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gán người thực hiện.');
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


  const renderDossierDetail = (standalone: boolean) => selectedDossier ? <PcnDossierDetailView dossier={selectedDossier} proposal={pcn.proposals.find((proposal) => proposal.id === selectedDossier.proposalId)} fields={pcn.fields} templates={pcn.templates} labRequests={pcn.labRequests} results={pcn.returnedResults} approvalSteps={pcn.approvalSteps} issuancePackages={pcn.issuancePackages} activityLogs={pcn.activityLogs} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} dossierAttachments={pcn.dossierAttachments} generatedDocuments={pcn.generatedDocuments} officialDocuments={pcn.officialDocuments} signerDelegations={pcn.signerDelegations} sampleLots={pcn.sampleLots} sampleItems={pcn.sampleItems} sampleRoutes={pcn.sampleRoutes} users={pcn.users} currentUser={currentUser} standalone={standalone} workflowTasks={pcn.workflowTasks} onStartWorkflowTask={(taskId) => pcn.startWorkflowTask(selectedDossier.id, taskId)} onCompleteWorkflowTask={(taskId) => pcn.completeWorkflowTask(selectedDossier.id, taskId)} onReturnWorkflowTask={(taskId, input) => pcn.returnWorkflowTask(selectedDossier.id, taskId, input)} initialTab={selectedDossierTab} initialNodeId={initialDossierNodeId} onOpenContextualAssistant={onOpenContextualAssistant} onUploadDocument={(requirementId, file) => pcn.uploadDossierDocument(selectedDossier.id, requirementId, file)} onUpdateStatus={(status, exceptionReason) => pcn.updateDossier(selectedDossier.id, { status, ...(exceptionReason !== undefined ? { exceptionReason } : {}) })} onUpdateDossier={(updates) => pcn.updateDossier(selectedDossier.id, updates)} onDeleteDossier={(reason, confirmationCode) => pcn.deleteDossier(selectedDossier.id, reason, confirmationCode)} canEditMilestones={currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer'} onPreflight={(kind, sampleRouteId, labRequestId) => pcn.preflightDossierDocuments(selectedDossier.id, kind, sampleRouteId, labRequestId)} onGenerateDocuments={(kind, formats, sampleRouteId, expectedContextHash, labRequestId) => pcn.generateDossierDocuments(selectedDossier.id, kind, formats, sampleRouteId, expectedContextHash, labRequestId)} onDownloadPackage={() => downloadDossierPackage(selectedDossier)} onCreateSampleLot={pcn.addSampleLot} onUpdateSampleRoute={pcn.updateSampleRoute} onSaveLabRequest={pcn.addLabRequest} onUpdateLabRequest={pcn.updateLabRequest} onDispatchLabRequest={pcn.dispatchLabRequest} onReconcileLabRequest={pcn.reconcileLabRequest} onSaveHandover={(request, details) => pcn.updateLabRequest(request.id, request.status, { handoverDetails: details })} onSaveResult={pcn.addReturnedResult} onAttachResultFile={pcn.attachResultFile} onPrepareIssuance={prepareIssuance} onApproveStep={approveStep} onIssue={issuePackage} onDeliver={deliverPackage} onArchive={archivePackage} onWithdraw={withdrawPackage} onAttachIssuanceFile={pcn.attachIssuanceFile} onPreflightOfficialDocuments={pcn.preflightOfficialDocuments} onGenerateOfficialDocuments={pcn.generateOfficialDocuments} onCreateSignerDelegation={pcn.addSignerDelegation} onRevokeSignerDelegation={pcn.revokeSignerDelegation} onClose={closeSelectedDossier} /> : null;
  const content = standaloneDossier ? (selectedDossier ? renderDossierDetail(true) : <div className="p-6 text-sm font-bold text-slate-600">Không tìm thấy hồ sơ PCN.</div>) : activeSection === 'dashboard' ? (
    <PcnDashboard
      proposals={pcn.proposals}
      dossiers={pcn.dossiers}
      fields={pcn.fields}
      dossierDocuments={pcn.dossierDocuments}
      documentRequirements={pcn.documentRequirements}
      users={pcn.users}
      labRequests={pcn.labRequests}
      results={pcn.returnedResults}
      workflowTasks={pcn.workflowTasks}
      currentUser={currentUser}
      canEdit={canMutatePcn}
      onCreateProposal={openNewProposal}
      onOpenSection={openSection}
      onOpenDossier={openDossierAtCurrentStation}
      onClaimDossier={claimPcnDossier}
      onAssignDossier={assignPcnDossier}
    />
  ) : activeSection === 'proposals' ? (
    <ProposalView
      fields={pcn.fields}
      workflowTemplates={pcn.workflowTemplates}
      proposals={pcn.proposals}
      dossiers={pcn.dossiers}
      documentRequirements={pcn.documentRequirements}
      dossierDocuments={pcn.dossierDocuments}
      dataLoaded={pcn.isLoaded}
      sampleLots={pcn.sampleLots}
      sampleItems={pcn.sampleItems}
      sampleRoutes={pcn.sampleRoutes}
      customers={pcn.customers}
      canEdit={canMutatePcn}
      initialDossierId={focusedDossierId}
      initialFieldCode={selectedField}
      openFormRequest={proposalFormRequest}
      onSave={(proposal, selection, context) => pcn.addProposal(proposal, selection, context)}
      onAttachWorkflowTemplate={async (dossierId, selection) => {
        const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/workflow-template`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(selection),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || payload?.message || 'Không thể gắn bộ hồ sơ mẫu PCN.');
        await pcn.load(true);
      }}
      onUpdateProposal={(proposalId, updates) => pcn.updateProposal(proposalId, updates)}
      onOpenDossier={openDossierAtCurrentStation}
    />
  ) : activeSection === 'operations' ? (
    <PcnOperationsRegisterView fields={pcn.fields} proposals={pcn.proposals} dossiers={pcn.dossiers} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} issuancePackages={pcn.issuancePackages} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} users={pcn.users} currentUser={currentUser} currentUsername={currentUser.username} canEdit={canMutatePcn} onUpdateProposal={pcn.updateProposal} onUpdateDossier={pcn.updateDossier} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'lab-operations' ? (
    <PcnLabOperationsView dossiers={pcn.dossiers} proposals={pcn.proposals} sampleLots={pcn.sampleLots} sampleItems={pcn.sampleItems} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} sampleRequestBundles={pcn.sampleRequestBundles} returnedResults={pcn.returnedResults} canEdit={canMutatePcn} onSaveBundle={pcn.saveSampleRequestBundle} onSendBundle={pcn.sendSampleRequestBundle} onRetryBundleDispatch={pcn.retrySampleRequestBundleDispatch} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'drafting' ? (
    <PcnDraftingWorkspaceView proposals={pcn.proposals} dossiers={pcn.dossiers} templates={pcn.templates} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} onUploadTemplate={pcn.uploadPcnTemplate} onReviewTemplate={pcn.reviewPcnTemplate} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} initialDossierId={initialDraftDossierId} initialRequirementId={initialDraftRequirementId} initialNodeId={initialDraftNodeId} initialKind={initialDraftKind} initialReturnTo={initialDraftReturnTo} onToast={(message, type) => type === 'error' ? toast.error(message) : toast.success(message)} />
  ) : activeSection === 'assistant' ? (
    <PcnAssistantView dossiers={pcn.dossiers} proposals={pcn.proposals} requirements={pcn.documentRequirements} documents={pcn.dossierDocuments} labRequests={pcn.labRequests} sampleLots={pcn.sampleLots} sampleItems={pcn.sampleItems} sampleRoutes={pcn.sampleRoutes} returnedResults={pcn.returnedResults} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'customers' ? (
    <PcnCustomersManagementView initialSearchQuery={customerSearchQuery} />
  ) : activeSection === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />
  ) : activeSection === 'settings' && canViewPcnSettings ? (
    <PcnSettingsView currentUser={currentUser} templates={pcn.templates} onUploadTemplate={pcn.uploadPcnTemplate} onReviewTemplate={pcn.reviewPcnTemplate} />
  ) : activeSection === 'users' && isPcnAdmin ? (
    <PcnUserManagementView users={pcn.users} roles={pcn.departmentRoles} fields={pcn.fields} currentUser={currentUser} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} />
  ) : null;
  const systemRoleLabel = currentUser.systemRole || currentUser.role;
  const managementRoleLabel = ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === currentUser.managementRoleCode)?.name || 'Chưa phân công chức danh quản lý';
  const professionalRoleLabel = (currentUser.professionalRoleCodes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code).join(', ') || 'Chưa gán vai trò chuyên môn';
  const departmentRoleLabel = `${managementRoleLabel} • ${professionalRoleLabel}`;
  const WorkspaceContent = embedded ? 'div' : 'main';
  return (
    <>
      <div className={embedded ? 'flex h-full min-h-0 w-full min-w-0 flex-col' : 'pcn-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800'}>
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
        <div className={embedded ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col' : 'flex min-w-0 flex-1 flex-col'}>
          {!embedded && <header className="app-compact-header flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5">
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
          <WorkspaceContent className={embedded ? (standaloneDossier ? 'min-h-0 min-w-0 flex-1 overflow-hidden' : 'min-w-0 flex-1') : 'min-h-0 min-w-0 flex-1 mobile-scroll-y overflow-x-hidden overflow-y-auto'}>{content}</WorkspaceContent>
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
      {!standaloneDossier && renderDossierDetail(false)}
    </>
  );
}

export default PcnWorkspace;
