'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, FileCheck2, FolderOpen, Hash, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  PcnApprovalStep,
  PcnDossierStatus,
  PcnGeneratedDocumentFormat,
  PcnOfficialGeneratedDocument,
  PcnTemplateDefinition,
  PcnCertificationField,
  PcnDossierDocument,
  PcnSignerDelegation,
  PcnUserAccount,
  UserAccount,
} from '../types';
import PcnApprovalModal, { type PcnApprovalEvidence, type PcnApprovalPackageEvidence } from './PcnApprovalModal';
import { PcnFilePreviewButton } from './PcnDossierFilePreview';
import PcnSignerDelegationPanel from './PcnSignerDelegationPanel';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { buildPcnDossierCompleteness } from '../utils/pcnDossierPipeline';
import { getPcnCodeFamilyLabel } from '../utils/pcnCodePolicy';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnOfficialSourceUpdatedAt, selectPcnOfficialTemplate } from '../utils/pcnOfficialDocumentPolicy';
import { getPcnTemplateReadiness } from '../utils/pcnTemplateCatalog';
import { getPcnAuthorizedSignerOptions, type PcnAuthorizedSignerOption } from '../utils/pcnSignerAuthorization';
import { getPcnEffectiveApprovalSteps } from '../utils/pcnApproval';
import { isOrganizationLeader } from '../utils/pcnRbac';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { PgdcnDateInput } from './PgdcnDateInput';
import type { PcnSignerDelegationInput } from '../utils/pcnSignerDelegationApi';
import type { PcnOfficialPreflightResponse } from '../utils/pcnOfficialDocumentApi';
import PcnCatalogCombobox from './PcnCatalogCombobox';

const visibleStatuses: PcnDossierStatus[] = [
  'TECHNICAL_REVIEW',
  'WAITING_APPROVAL',
  'APPROVED',
  'ISSUED',
  'DELIVERED',
  'ARCHIVED',
];

type IssueForm = {
  id: string;
  issuanceNumber: string;
  signerUsername: string;
  issuedAt: string;
};

type DeliveryForm = {
  id: string;
  recipient: string;
  note: string;
  deliveredAt: string;
};

type PcnIssuanceViewProps = {
  dossiers: CertificationDossier[];
  initialDossierId?: string;
  proposals: CertificationProposal[];
  issuancePackages: IssuancePackage[];
  approvalSteps: PcnApprovalStep[];
  templates: PcnTemplateDefinition[];
  onPrepare: (dossier: CertificationDossier) => Promise<void>;
  onApproveStep: (stepId: string, decision: 'APPROVE' | 'RETURN', comment?: string) => Promise<void>;
  onIssue: (issuanceId: string, input: { issuanceNumber: string; signerUsername: string; issuedAt?: string }) => Promise<void>;
  onDeliver: (issuanceId: string, input: { recipient: string; deliveredAt?: string; note?: string }) => Promise<void>;
  onArchive: (issuanceId: string) => Promise<void>;
  onWithdraw: (issuanceId: string, reason: string) => Promise<void>;
  onAttachFile: (issuanceId: string, file: File) => Promise<void>;
  officialDocuments: PcnOfficialGeneratedDocument[];
  onPreflightOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[]) => Promise<PcnOfficialPreflightResponse>;
  onGenerateOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[], expectedContextHash?: string) => Promise<PcnOfficialGeneratedDocument[]>;
  currentUser: UserAccount | null;
  canMutate: boolean;
  users: PcnUserAccount[];
  fields: PcnCertificationField[];
  signerDelegations: PcnSignerDelegation[];
  documentRequirements: import('../types').PcnDocumentRequirement[];
  dossierDocuments: import('../types').PcnDossierDocument[];
  onOpenDossier: (dossierId: string) => void;
  onCreateSignerDelegation: (input: PcnSignerDelegationInput) => Promise<void>;
  onRevokeSignerDelegation: (id: string) => Promise<void>;
};

function EmptyIssuanceState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
      <Award size={18} className="mx-auto text-slate-400" />
      <p className="mt-2 text-xs font-black text-slate-600">Chưa có hồ sơ trong vùng phê duyệt</p>
      <p className="mt-1 text-[10px] text-slate-400">Hồ sơ sau khi hoàn thiện bước 4 sẽ xuất hiện tại đây; cấp số, giao và lưu trữ là các bước sau phê duyệt.</p>
    </div>
  );
}

function issuanceStatusLabel(status?: IssuancePackage['status']): string {
  switch (status) {
    case 'PENDING_APPROVAL': return 'Chờ phê duyệt';
    case 'RETURNED': return 'Đã trả về kỹ thuật';
    case 'APPROVED': return 'Đã phê duyệt';
    case 'ISSUED': return 'Đã phát hành';
    case 'DELIVERED': return 'Đã giao khách hàng';
    case 'ARCHIVED': return 'Đã lưu trữ';
    default: return 'Bản nháp';
  }
}

const issuanceLifecycleStages: Array<{ status: Extract<IssuancePackage['status'], 'APPROVED' | 'ISSUED' | 'DELIVERED' | 'ARCHIVED'>; label: string; action: string }> = [
  { status: 'APPROVED', label: 'Đã phê duyệt', action: 'Cấp số phát hành' },
  { status: 'ISSUED', label: 'Đã cấp số', action: 'Giao khách hàng' },
  { status: 'DELIVERED', label: 'Đã giao', action: 'Lưu trữ' },
  { status: 'ARCHIVED', label: 'Đã lưu trữ', action: 'Hoàn tất' },
];

function IssuanceLifecycleRail({ status }: { status?: IssuancePackage['status'] }) {
  const currentIndex = issuanceLifecycleStages.findIndex((stage) => stage.status === status);
  return <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5" aria-label="Trình tự cấp số giao lưu trữ"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Trình tự sau phê duyệt · Hành động tiếp theo</div><span className="text-[9px] font-bold text-indigo-700">Bản kê hệ thống: xác minh lại trước thao tác</span></div><ol className="mt-2 grid gap-2 sm:grid-cols-4">{issuanceLifecycleStages.map((stage, index) => { const completed = currentIndex >= index; const active = currentIndex === index; const locked = currentIndex < index; return <li key={stage.status} className={`min-w-0 rounded-md border px-2 py-1.5 ${active ? 'border-indigo-300 bg-indigo-50' : completed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="flex items-center gap-1.5 text-[10px] font-black"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${completed ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{completed ? <CheckCircle2 size={12} aria-hidden="true" /> : index + 1}</span><span className={locked ? 'text-slate-500' : active ? 'text-indigo-800' : 'text-emerald-800'}>{stage.label}</span></div><p className="mt-1 text-[9px] text-slate-600">{locked ? `Khóa · chờ ${issuanceLifecycleStages[index - 1]?.label || 'bước trước'}` : `Tiếp theo: ${stage.action}`}</p></li>; })}</ol></section>;
}

function buildApprovalPackageEvidence({ dossier, issuance, dossierDocuments, officialDocuments, missingRequiredCount }: { dossier: CertificationDossier; issuance?: IssuancePackage; dossierDocuments: PcnDossierDocument[]; officialDocuments: PcnOfficialGeneratedDocument[]; missingRequiredCount: number }): PcnApprovalPackageEvidence {
  const currentChecklistVersions = dossierDocuments.filter((document) => document.dossierId === dossier.id).map((document) => document.versions.find((version) => version.assetId === document.currentVersionId)).filter(Boolean);
  const currentOfficialDocuments = officialDocuments.filter((document) => document.dossierId === dossier.id);
  const assetIds = new Set<string>();
  const checksumReadyIds = new Set<string>();
  currentChecklistVersions.forEach((version) => { if (!version) return; assetIds.add(version.assetId); if (version.byteSize !== undefined && Boolean(version.sha256)) checksumReadyIds.add(version.assetId); });
  currentOfficialDocuments.forEach((document) => { assetIds.add(document.fileAssetId); if (document.byteSize >= 0 && Boolean(document.sha256)) checksumReadyIds.add(document.fileAssetId); });
  (issuance?.fileAssetIds || []).forEach((assetId) => assetIds.add(assetId));
  const assetCount = assetIds.size;
  const checksumReadyCount = checksumReadyIds.size;
  const unknownMetadataCount = Math.max(0, assetCount - checksumReadyCount);
  const actionRequired = missingRequiredCount > 0 || assetCount === 0 || unknownMetadataCount > 0;
  return {
    assetCount,
    checksumReadyCount,
    unknownMetadataCount,
    manifestStatus: actionRequired ? 'ACTION_REQUIRED' : 'READY_TO_VERIFY',
    manifestNote: missingRequiredCount > 0
      ? `Chưa đủ manifest: còn ${missingRequiredCount} mục bắt buộc cần xử lý.`
      : assetCount === 0
        ? 'Chưa có pointer tài liệu để dựng gói.'
        : unknownMetadataCount > 0
          ? `Cần hệ thống xác minh ${unknownMetadataCount} liên kết tệp còn thiếu nguồn gốc/mã kiểm tra.`
          : 'Dữ liệu hiện tại đã đủ để hệ thống xác minh bản kê và mã kiểm tra.',
    action: missingRequiredCount > 0
      ? 'Mở danh sách kiểm tra, bổ sung phiên hiện hành hoặc đánh dấu bỏ qua kèm lý do.'
      : unknownMetadataCount > 0
        ? 'Mở kiểm tra trực quan và yêu cầu kiểm tra nguồn gốc/mã kiểm tra trước khi quyết định.'
        : 'Tiếp tục theo trình tự; hệ thống vẫn dựng bản kê cuối cùng trước khi ghi nhận thay đổi.',
  };
}

const inputClass = 'mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]';

function IssueModal({
  form,
  onChange,
  onClose,
  onSubmit,
  signerOptions,
  users,
  isSubmitting,
}: {
  form: IssueForm;
  onChange: (next: IssueForm) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  signerOptions: PcnAuthorizedSignerOption[];
  users: PcnUserAccount[];
  isSubmitting: boolean;
}) {
  const signerCatalogOptions = signerOptions.map((option) => ({
    value: option.username,
    label: `${getPcnUserDisplayName(option.username, users)} · ${option.mode === 'DIRECT' ? 'Trực tiếp' : 'Ủy quyền đến ' + formatDateDdMmYyyy(option.validUntil) || 'Chưa cập nhật'}`,
    searchText: [option.username, getPcnUserDisplayName(option.username, users), option.mode, option.validUntil].filter(Boolean).join(' '),
    description: option.mode === 'DIRECT' ? 'Ký trực tiếp' : `Ủy quyền đến ${formatDateDdMmYyyy(option.validUntil) || 'Chưa cập nhật'}`,
  }));

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={onSubmit} aria-busy={isSubmitting} className="mobile-scroll-y max-h-[94dvh] w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Cấp số phát hành</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-slate-400 disabled:cursor-not-allowed disabled:opacity-50">×</button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Chỉ thực hiện sau khi toàn bộ chuỗi phê duyệt đã hoàn tất.</p>
        <label className="mt-3 block text-[10px] font-black text-slate-500">
          Số phát hành <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>
          <input required disabled={isSubmitting} value={form.issuanceNumber} onChange={(event) => onChange({ ...form, issuanceNumber: event.target.value })} className={inputClass} />
        </label>
        <label className="mt-2 block text-[10px] font-black text-slate-500">
          Người ký <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>
          <PcnCatalogCombobox id="pcn-issuance-signer" label="Người ký" hideLabel required disabled={isSubmitting} value={form.signerUsername} onChange={(value) => onChange({ ...form, signerUsername: value })} options={signerCatalogOptions} />
          {signerOptions.length === 0 && <span className="mt-1 block text-[10px] font-bold text-rose-600">Chưa có người ký hợp lệ cho Lĩnh vực và ngày cấp này.</span>}
        </label>
        <label className="mt-2 block text-[10px] font-black text-slate-500">
          Ngày phát hành <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>
          <PgdcnDateInput required disabled={isSubmitting} value={form.issuedAt} onChange={(value) => onChange({ ...form, issuedAt: value })} className={inputClass} />
        </label>
        <button type="submit" disabled={isSubmitting} className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-black text-white disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Đang ghi nhận…' : 'Xác nhận phát hành'}</button>
      </form>
    </div>
  );
}

function DeliveryModal({
  form,
  onChange,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  form: DeliveryForm;
  onChange: (next: DeliveryForm) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={onSubmit} aria-busy={isSubmitting} className="mobile-scroll-y max-h-[94dvh] w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Giao khách hàng</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-slate-400 disabled:cursor-not-allowed disabled:opacity-50">×</button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Lưu người/đơn vị nhận và thời điểm giao trước khi đưa hồ sơ vào kho lưu trữ.</p>
        <label className="mt-3 block text-[10px] font-black text-slate-500">
          Người/đơn vị nhận <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>
          <input required disabled={isSubmitting} value={form.recipient} onChange={(event) => onChange({ ...form, recipient: event.target.value })} className={inputClass} />
        </label>
        <label className="mt-2 block text-[10px] font-black text-slate-500">
          Ngày giao <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>
          <PgdcnDateInput required disabled={isSubmitting} value={form.deliveredAt} onChange={(value) => onChange({ ...form, deliveredAt: value })} className={inputClass} />
        </label>
        <label className="mt-2 block text-[10px] font-black text-slate-500">
          Ghi chú giao nhận
          <textarea rows={3} disabled={isSubmitting} value={form.note} onChange={(event) => onChange({ ...form, note: event.target.value })} className={inputClass} />
        </label>
        <button type="submit" disabled={isSubmitting} className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-black text-white disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Đang ghi nhận…' : 'Xác nhận đã giao'}</button>
      </form>
    </div>
  );
}

export function PcnIssuanceView({
  dossiers,
  initialDossierId,
  proposals,
  issuancePackages,
  approvalSteps,
  templates,
  onPrepare,
  onApproveStep,
  onIssue,
  onDeliver,
  onArchive,
  onWithdraw,
  onAttachFile,
  officialDocuments,
  onPreflightOfficialDocuments,
  onGenerateOfficialDocuments,
  currentUser,
  canMutate,
  users,
  fields,
  signerDelegations,
  documentRequirements,
  dossierDocuments,
  onOpenDossier,
  onCreateSignerDelegation,
  onRevokeSignerDelegation,
}: PcnIssuanceViewProps) {
  const [selectedApproval, setSelectedApproval] = useState<string>();
  const [issueForm, setIssueForm] = useState<IssueForm>();
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>();
  const [withdrawForm, setWithdrawForm] = useState<{ id: string; reason: string }>();
  const [submittingIssueId, setSubmittingIssueId] = useState<string>();
  const [submittingDeliveryId, setSubmittingDeliveryId] = useState<string>();
  const [submittingWithdrawalId, setSubmittingWithdrawalId] = useState<string>();
  const [archivingIssuanceId, setArchivingIssuanceId] = useState<string>();
  const [uploadingIssuanceId, setUploadingIssuanceId] = useState<string>();
  const [generatingIssuanceId, setGeneratingIssuanceId] = useState<string>();
  const [preflightingIssuanceId, setPreflightingIssuanceId] = useState<string>();
  const [preparingDossierId, setPreparingDossierId] = useState<string>();
  const [officialPreflights, setOfficialPreflights] = useState<Record<string, { format: PcnGeneratedDocumentFormat; response: PcnOfficialPreflightResponse }>>({});
  const visible = dossiers.filter((dossier) => visibleStatuses.includes(dossier.status) && (!initialDossierId || dossier.id === initialDossierId));
  const selectedSteps = selectedApproval ? getPcnEffectiveApprovalSteps(approvalSteps.filter((step) => step.dossierId === selectedApproval)) : [];
  const currentPcnUser = currentUser ? users.find((user) => user.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase()) : undefined;
  const selectedApprovalDossier = selectedApproval ? dossiers.find((dossier) => dossier.id === selectedApproval) : undefined;
  const selectedApprovalIssuance = selectedApproval ? issuancePackages.find((issuance) => issuance.dossierId === selectedApproval) : undefined;
  const selectedApprovalEvidence: PcnApprovalEvidence | undefined = selectedApprovalDossier ? (() => {
    const proposal = proposals.find((item) => item.id === selectedApprovalDossier.proposalId);
    const completeness = buildPcnDossierCompleteness({ dossier: selectedApprovalDossier, proposal, requirements: documentRequirements, documents: dossierDocuments });
    const missingRequiredCount = completeness.missingRequiredByStage.reduce((total, group) => total + group.labels.length, 0);
    return {
      dossierId: selectedApprovalDossier.id,
      dossierCode: selectedApprovalDossier.dossierCode,
      score: completeness.score,
      stationTitle: completeness.station.title,
      ...(completeness.station.number ? { stationNumber: completeness.station.number } : {}),
      stationDocumentTotal: completeness.stationDocumentTotal,
      stationDocumentPresent: completeness.stationDocumentPresent,
      stationMissingLabels: completeness.stationMissingLabels,
      requiredDocumentTotal: completeness.requiredDocumentTotal,
      requiredDocumentPresent: completeness.requiredDocumentPresent,
      coreFieldTotal: completeness.coreFieldTotal,
      coreFieldPresent: completeness.coreFieldPresent,
      missingCoreLabels: completeness.missingCoreLabels,
      missingRequiredByStage: completeness.missingRequiredByStage,
      codeReview: completeness.codeReview,
      packageEvidence: buildApprovalPackageEvidence({ dossier: selectedApprovalDossier, issuance: selectedApprovalIssuance, dossierDocuments, officialDocuments, missingRequiredCount }),
    };
  })() : undefined;
  const openSelectedDossierChecklist = () => {
    if (!selectedApprovalDossier) return;
    setSelectedApproval(undefined);
    onOpenDossier(selectedApprovalDossier.id);
  };
  const issueDossier = issueForm ? dossiers.find((dossier) => issuancePackages.some((issuance) => issuance.id === issueForm.id && issuance.dossierId === dossier.id)) : undefined;
  const issueSignerOptions = useMemo(() => issueDossier && issueForm ? getPcnAuthorizedSignerOptions({ fieldCodes: issueDossier.fieldCodes, issuedAt: issueForm.issuedAt + 'T00:00:00.000Z', users, delegations: signerDelegations }) : [], [issueDossier, issueForm, users, signerDelegations]);

  const prepareIssuance = async (dossier: CertificationDossier) => {
    if (preparingDossierId === dossier.id) return;
    if (!canMutate) return;
    setPreparingDossierId(dossier.id);
    try {
      await onPrepare(dossier);
    } finally {
      setPreparingDossierId(undefined);
    }
  };

  const attachFile = async (event: React.ChangeEvent<HTMLInputElement>, issuanceId: string) => {
    if (uploadingIssuanceId === issuanceId) return;
    if (!canMutate) return;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploadingIssuanceId(issuanceId);
    try {
      await onAttachFile(issuanceId, file);
      toast.success('Đã tải tệp vào vùng lưu trữ riêng của PCN.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải tệp PCN');
    } finally {
      setUploadingIssuanceId(undefined);
    }
  };

  const submitIssue = (event: React.FormEvent) => {
    event.preventDefault();
    if (issueForm && submittingIssueId === issueForm.id) return;
    if (!canMutate || !issueForm) return;
    const submittedForm = issueForm;
    setSubmittingIssueId(submittedForm.id);
    void onIssue(submittedForm.id, {
      issuanceNumber: submittedForm.issuanceNumber,
      signerUsername: submittedForm.signerUsername,
      issuedAt: `${submittedForm.issuedAt}T00:00:00.000Z`,
    }).then(() => setIssueForm(undefined)).catch(() => undefined).finally(() => setSubmittingIssueId(undefined));
  };

  const submitDelivery = (event: React.FormEvent) => {
    event.preventDefault();
    if (deliveryForm && submittingDeliveryId === deliveryForm.id) return;
    if (!canMutate || !deliveryForm) return;
    const submittedForm = deliveryForm;
    setSubmittingDeliveryId(submittedForm.id);
    void onDeliver(submittedForm.id, {
      recipient: submittedForm.recipient,
      note: submittedForm.note,
      deliveredAt: `${submittedForm.deliveredAt}T00:00:00.000Z`,
    }).then(() => setDeliveryForm(undefined)).catch(() => undefined).finally(() => setSubmittingDeliveryId(undefined));
  };

  const submitWithdrawal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canMutate || !withdrawForm || submittingWithdrawalId === withdrawForm.id) return;
    const submittedForm = withdrawForm;
    const reason = submittedForm.reason.trim();
    if (!reason) {
      toast.error('Thu hồi hồ sơ phải có lý do.');
      return;
    }
    setSubmittingWithdrawalId(submittedForm.id);
    void onWithdraw(submittedForm.id, reason).then(() => setWithdrawForm(undefined)).catch(() => undefined).finally(() => setSubmittingWithdrawalId(undefined));
  };

  const archiveIssuance = async (issuanceId: string) => {
    if (archivingIssuanceId === issuanceId) return;
    if (!canMutate) return;
    setArchivingIssuanceId(issuanceId);
    try {
      await onArchive(issuanceId);
    } catch {
      // The workspace owns the toast; keep this UI boundary rejection-safe.
    } finally {
      setArchivingIssuanceId(undefined);
    }
  };

  const preflightOfficialDocuments = async (issuanceId: string, format: PcnGeneratedDocumentFormat) => {
    if (preflightingIssuanceId === issuanceId) return;
    setPreflightingIssuanceId(issuanceId);
    try {
      const response = await onPreflightOfficialDocuments(issuanceId, [format]);
      setOfficialPreflights((current) => ({ ...current, [issuanceId]: { format, response } }));
      const blocked = response.preflight.filter((item) => !item.ready);
      if (blocked.length > 0) {
        toast.error(`Dữ liệu chưa sẵn sàng: ${blocked.flatMap((item) => item.reasons).join(', ')}`);
      } else {
        toast.success(`Kiểm tra dữ liệu chính thức (${format}) đạt; có thể sinh hồ sơ.`);
      }
    } catch (error: any) {
      toast.error(error?.message || `Không thể kiểm tra dữ liệu ${format} chính thức`);
    } finally {
      setPreflightingIssuanceId(undefined);
    }
  };

  const generateOfficialDocuments = async (issuanceId: string, format: PcnGeneratedDocumentFormat) => {
    if (generatingIssuanceId === issuanceId) return;
    if (!canMutate) return;
    const preflight = officialPreflights[issuanceId];
    if (!preflight || preflight.format !== format) {
      toast.error(`Hãy bấm "Kiểm tra dữ liệu chính thức (${format})" trước khi sinh hồ sơ.`);
      return;
    }
    const blocked = preflight.response.preflight.filter((item) => !item.ready);
    if (blocked.length > 0) {
      toast.error(`Dữ liệu chưa sẵn sàng: ${blocked.flatMap((item) => item.reasons).join(', ')}`);
      return;
    }
    setGeneratingIssuanceId(issuanceId);
    try {
      const documents = await onGenerateOfficialDocuments(issuanceId, [format], preflight.response.contextHash);
      toast.success(`Đã sinh ${documents.length} ${format} chính thức từ mẫu PCN đã duyệt.`);
    } catch (error: any) {
      toast.error(error?.message || `Không thể sinh ${format} phát hành chính thức`);
    } finally {
      setGeneratingIssuanceId(undefined);
    }
  };

  return (
    <div className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 pb-20 md:p-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Phê duyệt</h1>
        <p className="mt-1 text-[11px] text-slate-500">Lãnh đạo quyết định bước 5; sau đó bộ phận được phân quyền thực hiện cấp số, giao khách hàng và lưu trữ.</p>
        {initialDossierId && <p className="mt-2 text-[10px] font-black text-emerald-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}
      </div>
      <PcnSignerDelegationPanel currentUser={currentUser} users={users} fields={fields} delegations={signerDelegations} onCreate={onCreateSignerDelegation} onRevoke={onRevokeSignerDelegation} />

      <div className="mt-4 space-y-2">
        {visible.length === 0 ? <EmptyIssuanceState /> : visible.map((dossier) => {
          const issuance = issuancePackages.find((item) => item.dossierId === dossier.id);
          const proposal = proposals.find((item) => item.id === dossier.proposalId);
          const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements: documentRequirements, documents: dossierDocuments });
          const codeReview = completeness.codeReview;
          const customerSnapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
          const steps = getPcnEffectiveApprovalSteps(approvalSteps.filter((step) => step.dossierId === dossier.id));
          const canWithdraw = Boolean(currentPcnUser && (isOrganizationLeader(currentPcnUser) || dossier && issuance?.signerUsername?.trim().toLowerCase() === currentPcnUser.username.trim().toLowerCase()));
          const issueReady = issuance?.status === 'APPROVED' && dossier.status === 'APPROVED';
          const signerOptions = getPcnAuthorizedSignerOptions({
            fieldCodes: dossier.fieldCodes,
            issuedAt: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
            users,
            delegations: signerDelegations,
          });
          const issuanceDocuments = issuance ? officialDocuments.filter((document) => document.issuanceId === issuance.id) : [];
          const latestOfficialSourceUpdatedAt = issuance ? getPcnOfficialSourceUpdatedAt(issuance.updatedAt, dossier.updatedAt, proposal?.updatedAt) : undefined;
          const issuanceTemplateReadiness = (['CERTIFICATE', 'DECISION'] as const).map((documentKind) => {
            const template = selectPcnOfficialTemplate(templates, dossier.fieldCodes, dossier.method, documentKind);
            return template ? { documentKind, readiness: getPcnTemplateReadiness(template, { availablePlaceholderKeys: template.placeholderKeys, requireVerifiedPrivateAsset: true }) } : { documentKind, readiness: { ready: false, reasons: ['TEMPLATE_MISSING'] } };
          });
          const issuanceTemplatesReady = issuanceTemplateReadiness.every((item) => item.readiness.ready);
          const issuanceTemplateReasons = issuanceTemplateReadiness.flatMap((item) => item.readiness.reasons.map((reason) => `${item.documentKind}: ${reason}`));
          const officialPreflight = issuance ? officialPreflights[issuance.id] : undefined;
          const officialPreflightReady = Boolean(officialPreflight?.response.preflight.length && officialPreflight.response.preflight.every((item) => item.ready));
          const docxPreflightReady = canMutate && officialPreflight?.format === 'DOCX' && officialPreflightReady;
          const pdfPreflightReady = canMutate && officialPreflight?.format === 'PDF' && officialPreflightReady;

          return (
            <article key={dossier.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FolderOpen size={14} className="text-indigo-600" />
                    <span className="font-mono text-xs font-black text-slate-800">{dossier.dossierCode}</span>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{getPcnDossierStatusLabel(dossier.status)}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-700">
                    {customerSnapshot?.name || 'Chưa gắn khách hàng'} <span className="font-normal text-slate-400">• {proposal?.productName || ''}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1" aria-label="Chuỗi phê duyệt"><ShieldCheck size={12} /> Chuỗi phê duyệt: {steps.filter((step) => step.status === 'APPROVED').length}/{steps.length || 1} quyết định Lãnh đạo</span><span className={`rounded-md px-2 py-1 ${completeness.score < 100 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>Hoàn thiện {completeness.score}%</span><span title={codeReview.message || getPcnCodeFamilyLabel(codeReview.family)} className={`rounded-md px-2 py-1 ${codeReview.needsReview ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>Mã PCN: {codeReview.source || 'Chưa có'} · {codeReview.needsReview ? 'Cần đối chiếu mã nguồn' : getPcnCodeFamilyLabel(codeReview.family)}</span>
                    {issuance && <span className="rounded-md bg-slate-50 px-2 py-1">{issuanceStatusLabel(issuance.status)}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {canMutate && dossier.status === 'TECHNICAL_REVIEW' && (!issuance || issuance.status === 'RETURNED') && <button onClick={() => void prepareIssuance(dossier)} disabled={preparingDossierId === dossier.id} aria-busy={preparingDossierId === dossier.id} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><FileCheck2 size={12} /> {preparingDossierId === dossier.id ? 'Đang trình…' : issuance ? 'Trình lại bước 5' : 'Tạo bộ GCN/QĐ'}</button>}
                  {canMutate && issuance && issuance.status === 'PENDING_APPROVAL' && <button onClick={() => setSelectedApproval(dossier.id)} aria-label={`Xem bằng chứng bước 5 cho ${dossier.dossierCode}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700"><ShieldCheck size={12} /> Xem bằng chứng bước 5 · Mở phê duyệt</button>}
                  {issueReady && !issuanceTemplatesReady && <span title="Cần mẫu GCN/QĐ đã phê duyệt và có tệp riêng hợp lệ" className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800"><ShieldCheck size={12} /> Chưa thể cấp số: {issuanceTemplateReasons.join(', ')}</span>}
                  {canMutate && issueReady && issuanceTemplatesReady && signerOptions.length > 0 && <button onClick={() => setIssueForm({ id: issuance.id, issuanceNumber: issuance.issuanceNumber || '', signerUsername: signerOptions.some((option) => option.username === issuance.signerUsername) ? (issuance.signerUsername || '') : signerOptions[0].username, issuedAt: new Date().toISOString().slice(0, 10) })} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white"><Hash size={12} /> Cấp số phát hành</button>}
                  {issueReady && signerOptions.length === 0 && <span title="Cần gán Lĩnh vực và chức vụ người ký hoặc tạo ủy quyền còn hạn" className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800"><ShieldCheck size={12} /> Chưa thể cấp số: chưa có người ký hợp lệ</span>}
                  {canMutate && issuance?.status === 'ISSUED' && <button onClick={() => setDeliveryForm({ id: issuance.id, recipient: issuance.deliveryRecipient || customerSnapshot?.name || '', note: issuance.deliveryNote || '', deliveredAt: new Date().toISOString().slice(0, 10) })} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700">Giao khách hàng</button>}
                  {canMutate && issuance?.status === 'DELIVERED' && <button onClick={() => void archiveIssuance(issuance.id)} disabled={archivingIssuanceId === issuance.id} aria-busy={archivingIssuanceId === issuance.id} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[10px] font-black text-slate-700 disabled:cursor-wait disabled:opacity-60">{archivingIssuanceId === issuance.id ? 'Đang lưu…' : 'Lưu trữ'}</button>}
                  {canMutate && canWithdraw && issuance && ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status) && <button onClick={() => setWithdrawForm({ id: issuance.id, reason: '' })} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-black text-rose-700">Thu hồi để rà soát</button>}
                  {issuance && ['ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status) && <>
                    <button onClick={() => void preflightOfficialDocuments(issuance.id, 'DOCX')} disabled={preflightingIssuanceId === issuance.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 disabled:cursor-wait disabled:opacity-50"><FileCheck2 size={12} /> {preflightingIssuanceId === issuance.id ? 'Đang kiểm tra…' : 'Kiểm tra dữ liệu chính thức (Word)'}</button>
                    <button onClick={() => void preflightOfficialDocuments(issuance.id, 'PDF')} disabled={preflightingIssuanceId === issuance.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 disabled:cursor-wait disabled:opacity-50"><FileCheck2 size={12} /> {preflightingIssuanceId === issuance.id ? 'Đang kiểm tra…' : 'Kiểm tra dữ liệu chính thức (PDF)'}</button>
                    {canMutate && <button onClick={() => void generateOfficialDocuments(issuance.id, 'DOCX')} disabled={generatingIssuanceId === issuance.id || !docxPreflightReady} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><FileCheck2 size={12} /> {generatingIssuanceId === issuance.id ? 'Đang sinh…' : 'Sinh DOCX chính thức'}</button>}
                    {canMutate && <button onClick={() => void generateOfficialDocuments(issuance.id, 'PDF')} disabled={generatingIssuanceId === issuance.id || !pdfPreflightReady} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{generatingIssuanceId === issuance.id ? 'Đang sinh…' : 'Sinh PDF chính thức'}</button>}
                    {officialPreflight && <span className={`basis-full rounded-md border px-2 py-1 text-[10px] ${officialPreflightReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      Kiểm tra {officialPreflight.format}: {officialPreflightReady ? 'Đủ điều kiện sinh hồ sơ' : `Chưa sẵn sàng · ${officialPreflight.response.preflight.flatMap((item) => item.reasons).join(', ')}`}
                    </span>}
                  </>}
                  {canMutate && issuance && <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 ${uploadingIssuanceId === issuance.id ? 'pointer-events-none opacity-50' : ''}`}>
                    <Upload size={12} /> {uploadingIssuanceId === issuance.id ? 'Đang tải...' : 'Tải tệp GCN/QĐ'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" disabled={!canMutate || uploadingIssuanceId === issuance.id} onChange={(event) => void attachFile(event, issuance.id)} />
                  </label>}
                </div>
              </div>

              {issuance && <IssuanceLifecycleRail status={issuance.status} />}

              {issuance && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 md:grid-cols-3">
                <div>GCN: <b className="text-slate-700">{issuance.certificateTemplateCode}</b></div>
                <div>Quyết định: <b className="text-slate-700">{issuance.decisionTemplateCode}</b></div>
                <div>Số phát hành: <b className="text-slate-700">{issuance.issuanceNumber || 'Chưa cấp'}</b></div>
                <div>Tệp đính kèm: <b className="text-slate-700">{issuance.fileAssetIds?.length || 0}</b></div>
              </div>}
              {issuanceDocuments.length > 0 && <div className="mt-3 border-t border-indigo-100 pt-3"><div className="text-[10px] font-black text-indigo-800">Tài liệu phát hành đã sinh</div><div className="mt-1 flex flex-wrap gap-1.5">{issuanceDocuments.map((document) => { const isStale = Boolean(document.sourceUpdatedAt && latestOfficialSourceUpdatedAt && document.sourceUpdatedAt !== latestOfficialSourceUpdatedAt); const previewVersion = { assetId: document.fileAssetId, fileName: document.fileName, mimeType: document.mimeType, uploadedAt: document.generatedAt, uploadedBy: document.generatedBy }; return <div key={document.id} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[9px] font-bold text-indigo-700"><span title="Xem nhanh tài liệu phát hành"><PcnFilePreviewButton version={previewVersion} /></span><a href={getPcnFileUrl(document.fileAssetId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-0.5">{document.documentKind === 'CERTIFICATE' ? 'GCN' : 'Quyết định'} · {document.format} {isStale ? '· Cần sinh lại' : ''} · Mở tệp</a></div>; })}</div></div>}
            </article>
          );
        })}
      </div>

      {canMutate && selectedApproval && <PcnApprovalModal steps={selectedSteps} users={users} currentUser={currentPcnUser} dossierFieldCodes={selectedApprovalDossier?.fieldCodes || []} evidence={selectedApprovalEvidence} onAct={onApproveStep} onOpenDossier={openSelectedDossierChecklist} onClose={() => setSelectedApproval(undefined)} />}
      {canMutate && issueForm && <IssueModal form={issueForm} onChange={setIssueForm} onClose={() => setIssueForm(undefined)} onSubmit={submitIssue} signerOptions={issueSignerOptions} users={users} isSubmitting={submittingIssueId === issueForm.id} />}
      {canMutate && deliveryForm && <DeliveryModal form={deliveryForm} onChange={setDeliveryForm} onClose={() => setDeliveryForm(undefined)} onSubmit={submitDelivery} isSubmitting={submittingDeliveryId === deliveryForm.id} />}
      {canMutate && withdrawForm && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"><form onSubmit={submitWithdrawal} className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">Thu hồi hồ sơ</h2><button type="button" onClick={() => setWithdrawForm(undefined)} disabled={submittingWithdrawalId === withdrawForm.id} className="text-slate-400">×</button></div><p className="mt-1 text-[10px] text-slate-500">Thao tác này giữ nguyên số, tệp và lịch sử phát hành; hồ sơ sẽ quay về bước 4 để rà soát.</p><label className="mt-3 block text-[10px] font-black text-slate-500">Lý do thu hồi <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span><textarea required rows={4} value={withdrawForm.reason} onChange={(event) => setWithdrawForm({ ...withdrawForm, reason: event.target.value })} className={inputClass} /></label><button type="submit" disabled={submittingWithdrawalId === withdrawForm.id} className="mt-4 w-full rounded-md bg-rose-600 px-3 py-2 text-[11px] font-black text-white disabled:opacity-60">{submittingWithdrawalId === withdrawForm.id ? 'Đang thu hồi…' : 'Xác nhận thu hồi'}</button></form></div>}
    </div>
  );
}

export default PcnIssuanceView;
