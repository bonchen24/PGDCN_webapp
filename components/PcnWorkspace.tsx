'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Activity,
  Award,
  AlertTriangle,
  Bot,
  Bell,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSearch,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Send,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { LoginScreen } from './LoginScreen';
import { CustomersManagementView } from './SystemManagementViews';
import { PcnIssuanceView } from './PcnIssuanceView';
import { PcnLabRequestView } from './PcnLabRequestView';
import { PcnResultReturnView } from './PcnResultReturnView';
import { PcnDossierDetailView } from './PcnDossierDetailView';
import { PcnArchiveView } from './PcnArchiveView';
import { PcnUserManagementView } from './PcnUserManagementView';
import { PcnSampleFlowView } from './PcnSampleFlowView';
import { PcnTemplateManagementView } from './PcnTemplateManagementView';
import { PcnBackupView } from './PcnBackupView';
import { ActivityLogView } from './ActivityLogView';
import { PcnOperationsRegisterView } from './PcnOperationsRegisterView';
import { PcnQualityDocumentsView } from './PcnQualityDocumentsView';
import { PcnHistoricalDiscoveryView } from './PcnHistoricalDiscoveryView';
import { PcnHaimyImportView } from './PcnHaimyImportView';
import { PcnNotificationDropdown } from './PcnNotificationDropdown';
import { PcnWorkQueueView } from './PcnWorkQueueView';
import { PcnPipelineBoard } from './PcnPipelineBoard';
import { PcnDataIntegrityView } from './PcnDataIntegrityView';
import { PcnCutoverVerificationView } from './PcnCutoverVerificationView';
import { PcnAgentWorkspaceView } from './PcnAgentWorkspaceView';
import PcnSidebar, { PCN_SECTION_ICONS } from './PcnSidebar';
import { usePcnStore } from '../store-pcn';
import { useStore } from '../store';
import { clearPcnSession, getPcnSession } from '../utils/pcnAuthApi';
import type { AppNotification, CertificationDossier, CertificationProposal, PcnDossierStatus, PcnCertificationField } from '../types';
import type { PcnHistoricalReviewInput } from '../utils/pcnHistoricalReview';
import type { PcnProposalUpdateInput } from '../utils/pcnProposalApi';
import { PcnIntakeApiError } from '../utils/pcnIntakeApi';
import { formatPcnIntakeValidationIssues, indexPcnIntakeValidationIssues, validatePcnProposalIntake } from '../utils/pcnIntakePolicy';
import { getPcnDashboardMetrics } from '../utils/pcnReporting';
import { getPcnDataIntegrityReport, getPcnIntegrityDossierTab, PCN_DATA_INTEGRITY_COLLECTION_LABELS, type PcnDataIntegrityCollection } from '../utils/pcnDataIntegrity';
import { canViewNotification } from '../utils/notificationEvents';
import { downloadPcnDossierPackage } from '../utils/pcnDossierPackageApi';
import { getPcnDossierStationTab, getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation';
import { getPcnPipelineStation } from '../utils/pcnDossierPipeline';
import { reviewPcnCodes } from '../utils/pcnCodePolicy';
import { PCN_MOBILE_NAVIGATION, type PcnSection } from '../utils/pcnNavigation';
import type { PcnWorkQueueSection } from '../utils/pcnWorkQueue';

const sectionLabels: Record<PcnSection, string> = {
  dashboard: 'Tổng quan',
  dataIntegrity: 'Kiểm tra dữ liệu',
  cutover: 'Đối soát cutover',
  operationsRegister: 'Sổ điều hành',
  historicalDiscovery: 'Kiểm kê hồ sơ lịch sử',
  agent: 'AI Trợ lý',
  proposals: 'Quản lý Đề nghị',
  fields: 'Hồ sơ',
  samples: 'Mẫu theo lô',
  customers: 'Danh sách khách hàng',
  labRequests: 'PYC gửi PTN',
  results: 'KQTN trả về',
  issuance: 'Phê duyệt & Phát hành',
  templates: 'Biểu mẫu PCN',
  qualityDocuments: 'Tài liệu chất lượng',
  haimy: 'Tích hợp Haimy',
  backup: 'Sao lưu & khôi phục',
  archive: 'Kho hồ sơ',
  activityLogs: 'Nhật ký hệ thống',
  users: 'Nhân sự PCN',
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
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon size={17} /></div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 truncate">{label}</div>
        <div className="text-xl font-black text-slate-800 leading-6">{value}</div>
      </div>
    </div>
  );
}

function PcnDashboard({
  customers,
  proposals,
  dossiers,
  fields,
  dossierDocuments,
  documentRequirements,
  users,
  labRequests,
  results,
  sampleLots,
  sampleRoutes,
  issuancePackages,
  templates,
  currentUser,
  canEdit,
  onOpenSection,
  onOpenModule,
  onOpenDossier,
  onClaimDossier,
}: {
  customers: import('../types').CustomerRef[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  fields: PcnCertificationField[];
  dossierDocuments: import('../types').PcnDossierDocument[];
  documentRequirements?: import('../types').PcnDocumentRequirement[];
  users?: import('../types').PcnUserAccount[];
  labRequests: import('../types').OutboundLabRequest[];
  results: import('../types').ReturnedTestResult[];
  sampleLots: import('../types').PcnSampleLot[];
  sampleRoutes: import('../types').PcnSampleRoute[];
  issuancePackages: import('../types').IssuancePackage[];
  templates: import('../types').PcnTemplateDefinition[];
  currentUser: import('../types').UserAccount | null;
  canEdit: boolean;
  onOpenSection: (section: PcnSection, fieldCode?: string) => void;
  onOpenModule: (section: PcnWorkQueueSection, dossierId: string) => void;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => void;
  onClaimDossier: (dossier: CertificationDossier) => Promise<void>;
}) {
  const storedDocumentRequirements = usePcnStore((state) => state.documentRequirements);
  const storedUsers = usePcnStore((state) => state.users);
  const [dashboardWorkSurface, setDashboardWorkSurface] = useState<'QUEUE' | 'WORKFLOW'>('WORKFLOW');
  const boardRequirements = documentRequirements?.length ? documentRequirements : storedDocumentRequirements;
  const boardUsers = users?.length ? users : storedUsers;
  const metrics = getPcnDashboardMetrics(dossiers, labRequests, results);
  const integrityReport = getPcnDataIntegrityReport({ customers, proposals, dossiers, sampleLots, sampleRoutes, labRequests, returnedResults: results, issuancePackages, templates });
  const integritySection: Record<PcnDataIntegrityCollection, PcnSection> = {
    customers: 'customers',
    certificationProposals: 'proposals',
    certificationDossiers: 'fields',
    pcnSampleLots: 'samples',
    pcnSampleRoutes: 'samples',
    labRequests: 'labRequests',
    returnedResults: 'results',
    issuancePackages: 'issuance',
    pcnTemplateDefinitions: 'templates',
  };

  return (
    <div className="p-3 md:p-5 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Chứng nhận • TVCI</p>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">Tổng quan hồ sơ chứng nhận</h1>
          <p className="text-[11px] text-slate-500 mt-1">Theo dõi Đề nghị, Lĩnh vực, PYC liên phòng và phát hành.</p>
        </div>
        {canEdit && <button onClick={() => onOpenSection('proposals')} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500">
          <Plus size={14} /> Tạo Đề nghị
        </button>}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-8 gap-3">
        <KpiCard label="Đề nghị" value={proposals.length} icon={FilePlus2} tone="bg-blue-50 text-blue-600" />
        <KpiCard label="Hồ sơ" value={metrics.totalDossiers} icon={FolderOpen} tone="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Đang chờ PTN" value={metrics.waitingLab} icon={Send} tone="bg-orange-50 text-orange-600" />
        <KpiCard label="Chờ KQTN" value={metrics.waitingResults} icon={ClipboardCheck} tone="bg-cyan-50 text-cyan-600" />
        <KpiCard label="Khắc phục" value={metrics.correctiveAction} icon={Activity} tone="bg-rose-50 text-rose-600" />
        <KpiCard label="Chờ phê duyệt" value={metrics.waitingApproval} icon={ShieldCheck} tone="bg-amber-50 text-amber-600" />
        <KpiCard label="Đã phát hành" value={metrics.issued} icon={Award} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Quá hạn" value={metrics.overdue} icon={Activity} tone="bg-red-50 text-red-600" />
      </div>

      <section className={`rounded-xl border p-3 md:p-4 shadow-sm ${integrityReport.issueCount > 0 ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/60'}`} aria-live="polite">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${integrityReport.issueCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><AlertTriangle size={16} /></div>
          <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black text-slate-800">Toàn vẹn dữ liệu</h2><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${integrityReport.issueCount > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>{integrityReport.issueCount > 0 ? `${integrityReport.issueCount} cảnh báo` : 'Đang ổn định'}</span></div>
            {integrityReport.issueCount === 0 ? <p className="mt-1 text-[10px] text-emerald-800">Các khóa và liên kết PCN trong snapshot hiện tại đã qua kiểm tra read-only.</p> : <><p className="mt-1 text-[10px] text-amber-900">Có {integrityReport.affectedRecordCount} bản ghi cần người có quyền rà soát. Hệ thống không tự sửa hoặc xóa dữ liệu.</p><div className="mt-3 space-y-1.5">{integrityReport.issues.slice(0, 5).map((issue, index) => <div key={`${issue.collection}-${issue.entityId}-${issue.code}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/70 px-2.5 py-2"><div className="min-w-0"><p className="truncate text-[10px] font-black text-slate-700">{PCN_DATA_INTEGRITY_COLLECTION_LABELS[issue.collection]} • <span className="font-mono">{issue.entityId}</span></p><p className="text-[10px] text-amber-900">{issue.message}</p></div><button type="button" onClick={() => onOpenSection(integritySection[issue.collection], issue.entityId)} className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800 hover:bg-amber-100">Mở module</button></div>)}{integrityReport.issues.length > 5 && <p className="text-[10px] font-bold text-amber-800">Còn {integrityReport.issues.length - 5} cảnh báo khác trong snapshot.</p>}</div></>}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-black text-slate-800">Lĩnh vực</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Mỗi hồ sơ có thể liên kết nhiều lĩnh vực.</p>
          </div>
          <button onClick={() => onOpenSection('fields')} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700">Xem tất cả <ChevronRight className="inline" size={12} /></button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {fields.map((field) => {
            const count = dossiers.filter((item) => item.fieldCodes.includes(field.code)).length;
            return (
              <button key={field.code} onClick={() => onOpenSection('fields', field.code)} className="text-left rounded-lg border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ClipboardList size={16} /></span><span><span className="block text-xs font-black text-slate-800">{field.name}</span><span className="block text-[10px] text-slate-400 font-mono">{field.code}</span></span></div>
                  <span className="text-lg font-black text-slate-700">{count}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{field.standardRefs.map((standard) => <span key={standard} className="rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{standard}</span>)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section data-testid="pcn-dashboard-work-surface" className="rounded-xl border border-slate-200 bg-slate-50/40 p-2.5 md:p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-800">Không gian công việc</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">Chọn một góc nhìn; hồ sơ không lặp lại ở hai danh sách cùng lúc.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chế độ xem công việc">
            <button type="button" aria-pressed={dashboardWorkSurface === 'QUEUE'} onClick={() => setDashboardWorkSurface('QUEUE')} className={`min-h-11 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${dashboardWorkSurface === 'QUEUE' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>Việc cần làm</button>
            <button type="button" aria-pressed={dashboardWorkSurface === 'WORKFLOW'} onClick={() => setDashboardWorkSurface('WORKFLOW')} className={`min-h-11 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${dashboardWorkSurface === 'WORKFLOW' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>Bản đồ quy trình</button>
          </div>
        </div>
        <div className="mt-3">
          {dashboardWorkSurface === 'WORKFLOW' ? (
            <PcnPipelineBoard dossiers={dossiers} proposals={proposals} fields={fields} requirements={boardRequirements} documents={dossierDocuments} users={boardUsers} currentUser={currentUser} onClaimDossier={onClaimDossier} onOpenDossier={onOpenDossier} />
          ) : (
            <PcnWorkQueueView dossiers={dossiers} proposals={proposals} documentRequirements={boardRequirements} dossierDocuments={dossierDocuments} users={boardUsers} currentUser={currentUser} onOpenDossier={onOpenDossier} onOpenModule={onOpenModule} onClaimDossier={onClaimDossier} />
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
  const proposalEditingAllowed = Boolean(onEdit && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status) && proposal.historicalImport?.reviewStatus !== 'PENDING_REVIEW' && dossier.historicalImport?.reviewStatus !== 'PENDING_REVIEW');
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

function FieldRegisterRow({ field, dossier, proposal, onOpenDossier }: { field: PcnCertificationField; dossier: CertificationDossier; proposal?: CertificationProposal; onOpenDossier: () => void }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-200"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">{field.code}</span><span className="font-mono text-xs font-black text-slate-800">{dossier.dossierCode}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses[dossier.status]}`}>{statusLabels[dossier.status]}</span></div><p className="mt-1 text-[11px] font-bold text-slate-700">{field.name}</p><p className="text-[10px] text-slate-500">{proposal?.customerSnapshot.name || 'Chưa gắn khách hàng'} · {proposal?.productName || 'Chưa có sản phẩm'}{proposal?.model ? ` · ${proposal.model}` : ''}</p></div><button type="button" onClick={onOpenDossier} className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-100">Mở hồ sơ chuẩn</button></div><div className="mt-2 flex flex-wrap gap-1">{field.standardRefs.map((standard) => <span key={standard} className="rounded bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500">{standard}</span>)}</div><p className="mt-2 text-[9px] text-slate-400">Lọc theo Lĩnh vực chỉ để tra cứu; checklist và thao tác hồ sơ nằm trong hồ sơ chuẩn.</p></article>;
}

function ProposalView({ fields, proposals, dossiers, customers, canEdit, initialDossierId, onSave, onUpdateProposal, onOpenDossier }: { fields: PcnCertificationField[]; proposals: CertificationProposal[]; dossiers: CertificationDossier[]; customers: Array<{ name: string; address?: string; customerCode?: string; taxId?: string; phone?: string; email?: string; contactPerson?: string }>; canEdit: boolean; initialDossierId?: string; onSave: (proposal: CertificationProposal) => Promise<void>; onUpdateProposal: (proposalId: string, updates: PcnProposalUpdateInput) => Promise<void>; onOpenDossier: (dossier: CertificationDossier) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProposal, setEditingProposal] = useState<CertificationProposal>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PcnDossierStatus | ''>('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const emptyForm = () => ({
    proposalCode: '', channel: 'DIRECT' as CertificationProposal['channel'], customerName: '', customerId: '', address: '', warehouseAddress: '',
    contactPerson: '', taxId: '', phone: '', email: '', productName: '', model: '', brand: '', productType: '', specifications: '',
    manufacturer: '', manufacturerAddress: '', quantity: '1', fieldCodes: [],
  });
  const [form, setForm] = useState(emptyForm);
  const codeReview = reviewPcnCodes(form.fieldCodes, form.proposalCode);
  const reset = () => { setForm(emptyForm()); setEditingProposal(undefined); setValidationErrors({}); };

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

  const handleCustomerChange = (value: string) => {
    const customer = customers.find((item) => item.name === value || item.customerCode === value);
    setForm((previous) => ({
      ...previous, customerName: customer?.name || value, customerId: customer?.customerCode || '',
      ...(customer ? { address: customer.address || '', taxId: customer.taxId || '', phone: customer.phone || '', email: customer.email || '', contactPerson: customer.contactPerson || '' } : {}),
    }));
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
    <div className="p-3 md:p-5 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/60">
      <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-black text-slate-900">Quản lý Đề nghị</h1><p className="text-[11px] text-slate-500 mt-1">Mỗi thẻ là một Đề nghị và một bộ hồ sơ liên kết. PYC chỉ phát sinh khi cần kết nối phòng thử nghiệm khác.</p></div>{!openForm && canEdit && <button onClick={() => { reset(); setOpenForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><Plus size={14} /> Tạo Đề nghị</button>}</div>
      {openForm && <form onSubmit={submit} className="rounded-xl border border-emerald-200 bg-white p-3 md:p-4 shadow-sm space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">{editingProposal ? 'Sửa thông tin Đề nghị' : 'Thông tin Đề nghị / bộ hồ sơ'}</h2>{editingProposal && <p className="mt-1 text-[10px] text-amber-700">Chỉ sửa được ở giai đoạn đầu vào; mã Đề nghị và Lĩnh vực được giữ nguyên.</p>}</div><button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-40"><X size={16} /></button></div><div className="grid md:grid-cols-3 gap-2"><Field label="Mã Đề nghị / mã đăng ký"><input value={form.proposalCode} disabled={Boolean(editingProposal)} onChange={(event) => setForm({ ...form, proposalCode: event.target.value })} placeholder="Ví dụ: 0665, 0109-01 hoặc IEMM 0105" />{codeReview.needsReview && <p role="status" className="mt-1 text-[9px] font-bold leading-4 text-amber-700">{codeReview.message}{codeReview.normalized ? ` Giá trị chuẩn hóa: ${codeReview.normalized}` : ''}</p>}</Field><Field label="Kênh tiếp nhận"><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as CertificationProposal['channel'] })}><option value="DIRECT">Trực tiếp</option><option value="EMAIL">Email</option><option value="ONLINE_ZALO">Online / Zalo</option><option value="OTHER">Khác</option></select></Field><Field label="Số lượng mẫu *" error={validationErrors.quantity}><input type="number" min="1" value={form.quantity} aria-invalid={Boolean(validationErrors.quantity)} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field></div><div className="grid md:grid-cols-2 gap-2"><Field label="Khách hàng *" error={validationErrors['customerSnapshot.name']}><input list="pcn-customer-options" value={form.customerName} aria-invalid={Boolean(validationErrors['customerSnapshot.name'])} onChange={(event) => handleCustomerChange(event.target.value)} placeholder="Chọn hoặc nhập tên khách hàng" /><datalist id="pcn-customer-options">{customers.map((customer) => <option key={customer.customerCode || customer.name} value={customer.name}>{customer.customerCode || ''}</option>)}</datalist></Field><Field label="Địa chỉ khách hàng *" error={validationErrors['customerSnapshot.address']}><input value={form.address} aria-invalid={Boolean(validationErrors['customerSnapshot.address'])} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Tự điền từ Danh sách khách hàng" /></Field></div><div className="grid md:grid-cols-4 gap-2"><Field label="Người liên hệ hoặc Mã số thuế *" error={validationErrors['customerSnapshot.contactPerson']}><input value={form.contactPerson} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Field><Field label="Mã số thuế"><input value={form.taxId} aria-invalid={Boolean(validationErrors['customerSnapshot.contactPerson'])} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></Field><Field label="Điện thoại"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field></div><Field label="Địa chỉ/kho liên quan *" error={validationErrors.warehouseAddress}><input value={form.warehouseAddress} aria-invalid={Boolean(validationErrors.warehouseAddress)} onChange={(event) => setForm({ ...form, warehouseAddress: event.target.value })} placeholder="Nơi lấy/giao mẫu hoặc kho liên quan" /></Field><div className="grid md:grid-cols-4 gap-2"><Field label="Tên sản phẩm *" error={validationErrors.productName}><input value={form.productName} aria-invalid={Boolean(validationErrors.productName)} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></Field><Field label="Kiểu/loại sản phẩm *" error={validationErrors.productType}><input value={form.productType} aria-invalid={Boolean(validationErrors.productType)} onChange={(event) => setForm({ ...form, productType: event.target.value })} /></Field><Field label="Model *" error={validationErrors.model}><input value={form.model} aria-invalid={Boolean(validationErrors.model)} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field><Field label="Nhãn hiệu *" error={validationErrors.brand}><input value={form.brand} aria-invalid={Boolean(validationErrors.brand)} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></Field></div><div className="grid md:grid-cols-3 gap-2"><Field label="Nhà sản xuất *" error={validationErrors.manufacturer}><input value={form.manufacturer} aria-invalid={Boolean(validationErrors.manufacturer)} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></Field><Field label="Địa chỉ nhà sản xuất"><input value={form.manufacturerAddress} onChange={(event) => setForm({ ...form, manufacturerAddress: event.target.value })} /></Field><Field label="Thông số kỹ thuật / mô tả *" error={validationErrors.specifications}><textarea rows={2} value={form.specifications} aria-invalid={Boolean(validationErrors.specifications)} onChange={(event) => setForm({ ...form, specifications: event.target.value })} /></Field></div><div><div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lĩnh vực *</div><div className="flex flex-wrap gap-2">{fields.map((field) => <label key={field.code} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} aria-invalid={Boolean(validationErrors.fieldCodes)} disabled={Boolean(editingProposal)} onChange={(event) => setForm({ ...form, fieldCodes: event.target.checked ? [...form.fieldCodes, field.code] : form.fieldCodes.filter((code) => code !== field.code) })} />{field.name}</label>)}</div>{validationErrors.fieldCodes && <p role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{validationErrors.fieldCodes}</p>}</div><div className="flex justify-end gap-2"><button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" disabled={saving} aria-busy={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-50">{saving ? 'Đang lưu...' : editingProposal ? 'Lưu thay đổi' : 'Tạo Đề nghị & bộ hồ sơ'}</button></div></form>}
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

function FieldDossierView({ fields, dossiers, proposals, selectedField, initialDossierId, onSelectField, onOpenDossier }: { fields: PcnCertificationField[]; dossiers: CertificationDossier[]; proposals: CertificationProposal[]; selectedField?: string; initialDossierId?: string; onSelectField: (field?: string) => void; onOpenDossier: (dossier: CertificationDossier) => void }) {
  const visible = dossiers.filter((dossier) => (!initialDossierId || dossier.id === initialDossierId) && (!selectedField || dossier.fieldCodes.includes(selectedField)));
  return <div className="p-3 md:p-5 space-y-4 h-full overflow-y-auto mobile-safe-bottom bg-slate-50/60"><div><h1 className="text-xl font-black text-slate-900">Hồ sơ chứng nhận</h1><p className="text-[11px] text-slate-500 mt-1">Tra cứu hồ sơ theo quy chuẩn; tiến độ và thao tác nằm trong hồ sơ chuẩn.</p>{initialDossierId && <p className="mt-1 text-[10px] font-bold text-indigo-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}</div><div className="flex flex-wrap gap-2"><button onClick={() => onSelectField(undefined)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-black ${!selectedField ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>Tất cả lĩnh vực</button>{fields.map((field) => <button key={field.code} onClick={() => onSelectField(field.code)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-black ${selectedField === field.code ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{field.name}</button>)}</div>{visible.length === 0 ? <EmptyState title="Chưa có hồ sơ trong lĩnh vực" description="Hồ sơ được mở sau khi Đề nghị được tiếp nhận hợp lệ." /> : <div className="space-y-2">{visible.map((dossier) => <FieldRegisterRow key={dossier.id} field={fields.find((field) => field.code === selectedField) || fields.find((field) => dossier.fieldCodes.includes(field.code)) || { code: selectedField || 'PCN', name: 'Lĩnh vực hồ sơ', standardRefs: [], active: true } as PcnCertificationField} dossier={dossier} proposal={proposals.find((proposal) => proposal.id === dossier.proposalId)} onOpenDossier={() => onOpenDossier(dossier)} />)}</div>}</div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] font-black text-slate-500 mb-1">{label}</span><div className={`[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[11px] [&_input]:outline-none [&_input]:focus:border-emerald-400 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-1.5 [&_select]:text-[11px] [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:px-2.5 [&_textarea]:py-1.5 [&_textarea]:text-[11px] [&_textarea]:outline-none ${error ? '[&_input]:border-rose-300 [&_select]:border-rose-300 [&_textarea]:border-rose-300 [&_input]:bg-rose-50/40 [&_select]:bg-rose-50/40 [&_textarea]:bg-rose-50/40' : '[&_input]:border-slate-200 [&_select]:border-slate-200 [&_textarea]:border-slate-200'}`}>{children}</div>{error && <p role="alert" className="mt-1 text-[9px] font-bold leading-4 text-rose-700">{error}</p>}</label>;
}

export function PcnWorkspace() {
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const pcn = usePcnStore();
  const resetPcn = usePcnStore((state) => state.reset);
  const [pcnSessionChecked, setPcnSessionChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<PcnSection>('dashboard');
  const [selectedField, setSelectedField] = useState<string | undefined>();
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [focusedDossierId, setFocusedDossierId] = useState<string | undefined>();
  const [selectedDossierId, setSelectedDossierId] = useState<string | undefined>();
  const [selectedDossierTab, setSelectedDossierTab] = useState<import('../utils/pcnDossierNavigation').PcnDossierDetailTab | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return window.localStorage.getItem('pcn_sidebar_collapsed') === 'true';
    return false;
  });
  const [pcnNotificationOpen, setPcnNotificationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPcnSession()
      .then((session) => {
        if (!cancelled) {
          if (!session) resetPcn();
          useStore.setState({ currentUser: session?.user || null });
        }
      })
      .catch((error) => {
        console.error('PCN session check failed:', error);
        if (!cancelled) {
          resetPcn();
          useStore.setState({ currentUser: null });
        }
      })
      .finally(() => {
        if (!cancelled) setPcnSessionChecked(true);
      });
    return () => { cancelled = true; };
  }, [resetPcn]);

  useEffect(() => { if (pcnSessionChecked && currentUser) pcn.load().catch((error) => toast.error(error?.message || 'Không thể tải dữ liệu PCN')); }, [currentUser, pcn.load, pcnSessionChecked]);

  useEffect(() => {
    if (!selectedDossierId || selectedDossierTab) return;
    const dossier = pcn.dossiers.find((item) => item.id === selectedDossierId);
    if (!dossier) return;
    const station = getPcnPipelineStation(dossier.status);
    const proposal = pcn.proposals.find((item) => item.id === dossier.proposalId);
    setSelectedDossierTab(getPcnDossierStationTab(station.key, Boolean(dossier.historicalImport || proposal?.historicalImport)));
  }, [pcn.dossiers, pcn.proposals, selectedDossierId, selectedDossierTab]);

  if (!pcnSessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-xs font-bold text-slate-300">Đang xác thực phiên PCN...</div>;
  if (!currentUser) return <LoginScreen mode="pcn" />;

  const handleLogout = async () => {
    try {
      await clearPcnSession();
    } catch (error) {
      console.warn('PCN session logout failed:', error);
    } finally {
      resetPcn();
      logout({ skipLegacySession: true });
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('pcn_sidebar_collapsed', String(next));
      return next;
    });
  };

  const openSection = (section: PcnSection, entityKey?: string) => { setActiveSection(section); setFocusedDossierId(undefined); setSelectedField(section === 'fields' ? entityKey : undefined); setCustomerSearchQuery(section === 'customers' ? (entityKey || '') : ''); setMobileMenuOpen(false); };
  const openDossierAtCurrentStation = (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => {
    const proposal = pcn.proposals.find((item) => item.id === dossier.proposalId);
    const station = getPcnPipelineStation(dossier.status);
    setSelectedDossierTab(initialTab || getPcnDossierStationTab(station.key, Boolean(dossier.historicalImport || proposal?.historicalImport)));
    setSelectedDossierId(dossier.id);
  };
  const openWorkQueueModule = (section: PcnWorkQueueSection, dossierId: string) => {
    if (section === 'historicalDiscovery') {
      setSelectedDossierTab(undefined);
      setSelectedDossierId(dossierId);
      return;
    }
    setActiveSection(section);
    setFocusedDossierId(dossierId);
    setSelectedField(undefined);
    setCustomerSearchQuery('');
    setMobileMenuOpen(false);
  };
  const handleIntegrityNavigation = (collection: PcnDataIntegrityCollection, entityId: string) => {
    const sectionByCollection: Record<PcnDataIntegrityCollection, PcnSection> = {
      customers: 'customers',
      certificationProposals: 'proposals',
      certificationDossiers: 'fields',
      pcnSampleLots: 'samples',
      pcnSampleRoutes: 'samples',
      labRequests: 'labRequests',
      returnedResults: 'results',
      issuancePackages: 'issuance',
      pcnTemplateDefinitions: 'templates',
    };
    const dossier = collection === 'certificationProposals'
      ? pcn.dossiers.find((item) => item.proposalId === entityId)
      : collection === 'certificationDossiers'
        ? pcn.dossiers.find((item) => item.id === entityId)
        : collection === 'pcnSampleLots'
          ? pcn.dossiers.find((item) => item.id === pcn.sampleLots.find((lot) => lot.id === entityId)?.dossierId)
          : collection === 'pcnSampleRoutes'
            ? pcn.dossiers.find((item) => item.id === pcn.sampleLots.find((lot) => lot.id === pcn.sampleRoutes.find((route) => route.id === entityId)?.sampleLotId)?.dossierId)
            : collection === 'labRequests'
              ? pcn.dossiers.find((item) => item.id === pcn.labRequests.find((request) => request.id === entityId)?.dossierId)
              : collection === 'returnedResults'
                ? pcn.dossiers.find((item) => item.id === pcn.returnedResults.find((result) => result.id === entityId)?.dossierId)
                : collection === 'issuancePackages'
                  ? pcn.dossiers.find((item) => item.id === pcn.issuancePackages.find((issuance) => issuance.id === entityId)?.dossierId)
                  : undefined;
    if (dossier) {
      setSelectedDossierTab(getPcnIntegrityDossierTab(collection));
      setSelectedDossierId(dossier.id);
      return;
    }
    openSection(sectionByCollection[collection], collection === 'customers' ? entityId : undefined);
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
    const sectionByEntity: Partial<Record<NonNullable<AppNotification['entityType']>, PcnSection>> = {
      PCN_PROPOSAL: 'proposals',
      PCN_DOSSIER: 'fields',
      PCN_SAMPLE_LOT: 'samples',
      PCN_LAB_REQUEST: 'labRequests',
      PCN_RESULT: 'results',
      PCN_APPROVAL: 'issuance',
      PCN_ISSUANCE: 'issuance',
    };
    const section = notification.entityType ? sectionByEntity[notification.entityType] : undefined;
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
    if (pcn.issuancePackages.some((item) => item.dossierId === dossier.id)) { toast.info('Hồ sơ này đã có bộ phát hành.'); return; }
    try { await pcn.createIssuanceBundle(dossier.id); toast.success(`Đã tạo chuỗi phê duyệt cho ${dossier.dossierCode}`); } catch (error: any) { toast.error(error?.message || 'Không thể tạo bộ phát hành'); }
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
  const setDossierLegalHold = async (dossierId: string, input: { legalHold: boolean; reason?: string }) => {
    try {
      await pcn.setDossierLegalHold(dossierId, input);
      toast.success(input.legalHold ? 'Đã đặt giữ pháp lý cho hồ sơ.' : 'Đã gỡ giữ pháp lý cho hồ sơ.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật giữ pháp lý');
      throw error;
    }
  };

  const reviewHistoricalDossier = async (dossierId: string, input: PcnHistoricalReviewInput) => {
    await pcn.reviewHistoricalDossier(dossierId, input);
  };

  const sidebarWidthClass = isSidebarCollapsed ? 'w-16' : 'w-64';
  const mobileNavItems = PCN_MOBILE_NAVIGATION.map((key) => ({ key, icon: PCN_SECTION_ICONS[key] }));


  const content = activeSection === 'dashboard' ? (
    <PcnDashboard
      customers={pcn.customers}
      proposals={pcn.proposals}
      dossiers={pcn.dossiers}
      fields={pcn.fields}
      dossierDocuments={pcn.dossierDocuments}
      documentRequirements={pcn.documentRequirements}
      users={pcn.users}
      labRequests={pcn.labRequests}
      results={pcn.returnedResults}
      sampleLots={pcn.sampleLots}
      sampleRoutes={pcn.sampleRoutes}
      issuancePackages={pcn.issuancePackages}
      templates={pcn.templates}
      currentUser={currentUser}
      canEdit={canMutatePcn}
      onOpenSection={openSection}
      onOpenModule={openWorkQueueModule}
      onOpenDossier={openDossierAtCurrentStation}
      onClaimDossier={claimPcnDossier}
    />
  ) : activeSection === 'dataIntegrity' ? (
    <PcnDataIntegrityView
      snapshot={{ customers: pcn.customers, proposals: pcn.proposals, dossiers: pcn.dossiers, sampleLots: pcn.sampleLots, sampleRoutes: pcn.sampleRoutes, labRequests: pcn.labRequests, returnedResults: pcn.returnedResults, issuancePackages: pcn.issuancePackages, templates: pcn.templates }}
      onOpenIssue={handleIntegrityNavigation}
    />
  ) : activeSection === 'cutover' ? (
    <PcnCutoverVerificationView currentUser={currentUser} customers={pcn.customers} onImported={async () => { await pcn.load(true); }} />
  ) : activeSection === 'operationsRegister' ? (
    <PcnOperationsRegisterView fields={pcn.fields} proposals={pcn.proposals} dossiers={pcn.dossiers} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} labRequests={pcn.labRequests} returnedResults={pcn.returnedResults} issuancePackages={pcn.issuancePackages} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} users={pcn.users} onOpenDossier={(dossier, initialTab) => { setSelectedDossierTab(initialTab); setSelectedDossierId(dossier.id); }} />
  ) : activeSection === 'historicalDiscovery' ? (
    <PcnHistoricalDiscoveryView currentUser={currentUser} dossiers={pcn.dossiers} attachments={pcn.dossierAttachments} activityLogs={pcn.activityLogs} onImported={async () => { await pcn.load(true); }} onOpenSection={openSection} />
  ) : activeSection === 'agent' ? (
    <PcnAgentWorkspaceView currentUser={currentUser} dossiers={pcn.dossiers} onOpenDossier={openDossierAtCurrentStation} />
  ) : activeSection === 'proposals' ? (
    <ProposalView fields={pcn.fields} proposals={pcn.proposals} dossiers={pcn.dossiers} customers={pcn.customers} canEdit={canMutatePcn} initialDossierId={focusedDossierId} onSave={(proposal) => pcn.addProposal(proposal)} onUpdateProposal={(proposalId, updates) => pcn.updateProposal(proposalId, updates)} onOpenDossier={(dossier) => { setSelectedDossierTab('proposal'); setSelectedDossierId(dossier.id); }} />
  ) : activeSection === 'fields' ? (
    <FieldDossierView fields={pcn.fields} dossiers={pcn.dossiers} proposals={pcn.proposals} selectedField={selectedField} initialDossierId={focusedDossierId} onSelectField={(field) => { setSelectedField(field); }} onOpenDossier={(dossier) => openDossierAtCurrentStation(dossier)} />
  ) : activeSection === 'samples' ? (
    <PcnSampleFlowView sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} dossiers={pcn.dossiers} proposals={pcn.proposals} fields={pcn.fields} currentUser={currentUser} initialDossierId={focusedDossierId} onCreate={pcn.addSampleLot} onRouteStatusChange={pcn.updateSampleRoute} />
  ) : activeSection === 'customers' ? (
    <CustomersManagementView source="pcn" initialSearchQuery={customerSearchQuery} />
  ) : activeSection === 'labRequests' ? (
    <PcnLabRequestView fields={pcn.fields} dossiers={pcn.dossiers} proposals={pcn.proposals} requests={pcn.labRequests} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} generatedDocuments={pcn.generatedDocuments} canEdit={canMutatePcn} initialDossierId={focusedDossierId} onSave={pcn.addLabRequest} onStatusChange={pcn.updateLabRequest} onOpenDossier={(dossierId) => { setSelectedDossierTab('lab'); setSelectedDossierId(dossierId); }} />
  ) : activeSection === 'results' ? (
    <PcnResultReturnView fields={pcn.fields} dossiers={pcn.dossiers} proposals={pcn.proposals} requests={pcn.labRequests} results={pcn.returnedResults} canEdit={canMutatePcn} initialDossierId={focusedDossierId} onSave={pcn.addReturnedResult} onAttachFile={pcn.attachResultFile} />
  ) : activeSection === 'issuance' ? (
    <PcnIssuanceView dossiers={pcn.dossiers} proposals={pcn.proposals} issuancePackages={pcn.issuancePackages} approvalSteps={pcn.approvalSteps} templates={pcn.templates} officialDocuments={pcn.officialDocuments} initialDossierId={focusedDossierId} onPrepare={prepareIssuance} onApproveStep={approveStep} onIssue={issuePackage} onDeliver={deliverPackage} onArchive={archivePackage} onAttachFile={pcn.attachIssuanceFile} onPreflightOfficialDocuments={pcn.preflightOfficialDocuments} onGenerateOfficialDocuments={pcn.generateOfficialDocuments} currentUser={currentUser} canMutate={canMutatePcn} users={pcn.users} fields={pcn.fields} signerDelegations={pcn.signerDelegations} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} onOpenDossier={(dossierId) => { setSelectedDossierTab('documents'); setSelectedDossierId(dossierId); }} onCreateSignerDelegation={pcn.addSignerDelegation} onRevokeSignerDelegation={pcn.revokeSignerDelegation} />
  ) : activeSection === 'templates' ? (
    <PcnTemplateManagementView templates={pcn.templates} currentUser={currentUser} onReview={pcn.reviewPcnTemplate} onAnnotate={pcn.annotatePcnTemplate} onImport={pcn.importPcnTemplate} onPreflightSources={pcn.preflightPcnTemplateSources} documentRequirements={pcn.documentRequirements} />
  ) : activeSection === 'qualityDocuments' ? (
    <PcnQualityDocumentsView documents={pcn.qualityDocuments} fields={pcn.fields} users={pcn.users} currentUser={currentUser} onCreate={pcn.addQualityDocument} onUpdate={pcn.updateQualityDocument} onRetire={pcn.retireQualityDocument} />
  ) : activeSection === 'haimy' ? (
    <PcnHaimyImportView currentUser={currentUser} onPromoted={async (response) => { await pcn.load(true); openDossierAtCurrentStation(response.dossier); }} onOpenDossier={(dossierId) => { const dossier = pcn.dossiers.find((item) => item.id === dossierId); if (dossier) openDossierAtCurrentStation(dossier); else setSelectedDossierId(dossierId); }} />
  ) : activeSection === 'backup' ? (
    <PcnBackupView currentUser={currentUser} onRestored={async () => { await pcn.load(true); }} />
  ) : activeSection === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />
  ) : activeSection === 'users' ? (
    <PcnUserManagementView users={pcn.users} roles={pcn.departmentRoles} fields={pcn.fields} currentUser={currentUser} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} />
  ) : (
    <PcnArchiveView fields={pcn.fields} dossiers={pcn.dossiers} proposals={pcn.proposals} issuancePackages={pcn.issuancePackages} initialDossierId={focusedDossierId} onOpenDossier={(dossier) => { setSelectedDossierTab('issuance'); setSelectedDossierId(dossier.id); }} canEdit={canMutatePcn} onSetLegalHold={setDossierLegalHold} />
  );

  const systemRoleLabel = currentUser.systemRole || currentUser.role;
  const departmentRoleLabel = currentUser.departmentRoleCode || 'Chưa phân công';
  return (
    <>
      <div className="pcn-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800">
        <Toaster position="top-right" richColors />
        <PcnSidebar
          currentUser={currentUser}
          activeSection={activeSection}
          fields={pcn.fields}
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
          onLogout={handleLogout}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="ddt-compact-header flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5">
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
          </header>
          <main className="min-h-0 flex-1">{content}</main>
          <nav className="flex shrink-0 items-center justify-around border-t border-slate-200 bg-white p-1.5 lg:hidden" aria-label="Menu di động">
            {mobileNavItems.map(({ key, icon: Icon }) => {
              const isActive = activeSection === key;
              return <button type="button" key={key} onClick={() => openSection(key)} aria-current={isActive ? 'page' : undefined} className={isActive ? 'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md bg-emerald-50 px-1 py-1.5 text-[8px] font-bold text-emerald-700' : 'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[8px] font-bold text-slate-400'}><Icon size={15} /><span className="truncate">{sectionLabels[key]}</span></button>;
            })}
          </nav>
        </div>
      </div>
      {selectedDossier && <PcnDossierDetailView dossier={selectedDossier} proposal={pcn.proposals.find((proposal) => proposal.id === selectedDossier.proposalId)} fields={pcn.fields} templates={pcn.templates} labRequests={pcn.labRequests} results={pcn.returnedResults} approvalSteps={pcn.approvalSteps} issuancePackages={pcn.issuancePackages} activityLogs={pcn.activityLogs} documentRequirements={pcn.documentRequirements} dossierDocuments={pcn.dossierDocuments} dossierAttachments={pcn.dossierAttachments} generatedDocuments={pcn.generatedDocuments} officialDocuments={pcn.officialDocuments} sampleLots={pcn.sampleLots} sampleRoutes={pcn.sampleRoutes} users={pcn.users} currentUser={currentUser} initialTab={selectedDossierTab} onUploadDocument={(requirementId, file) => pcn.uploadDossierDocument(selectedDossier.id, requirementId, file)} onUpdateStatus={(status, exceptionReason) => pcn.updateDossier(selectedDossier.id, { status, ...(exceptionReason !== undefined ? { exceptionReason } : {}) })} onUpdateDossier={(updates) => pcn.updateDossier(selectedDossier.id, updates)} canEditMilestones={currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer'} onReviewHistorical={(input) => reviewHistoricalDossier(selectedDossier.id, input)} onMapHistoricalAttachment={(attachmentId, requirementId) => pcn.mapHistoricalAttachment(selectedDossier.id, attachmentId, requirementId)} onPreflight={(kind, sampleRouteId, labRequestId) => pcn.preflightDossierDocuments(selectedDossier.id, kind, sampleRouteId, labRequestId)} onGenerateDocuments={(kind, formats, sampleRouteId, expectedContextHash, labRequestId) => pcn.generateDossierDocuments(selectedDossier.id, kind, formats, sampleRouteId, expectedContextHash, labRequestId)} onDownloadPackage={() => downloadDossierPackage(selectedDossier)} onOpenApprovalModule={() => { setActiveSection('issuance'); setFocusedDossierId(selectedDossier.id); setSelectedDossierTab(undefined); setSelectedDossierId(undefined); }} onClose={() => { setSelectedDossierTab(undefined); setSelectedDossierId(undefined); }} />}
    </>
  );
}

export default PcnWorkspace;
