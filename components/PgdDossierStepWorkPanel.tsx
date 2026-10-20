'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Eye, FileText, Upload } from 'lucide-react';

import type { PcnUserAccount } from '../types';
import type { PgdInspectionRequest, PgdSample } from '../utils/pgdDomain';
import type { PgdDossierDocument, PgdDossierRequirement } from '../utils/pgdDossier';
import { getCurrentPgdDossierDocuments, getPgdDossierRequirementForTemplate } from '../utils/pgdDossier';
import { getPgdDossierDocumentDownloadUrl } from '../utils/pgdApi';
import { getPgdcnNextAction } from '../utils/pgdcnDashboard';
import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdDossierFlowStepId } from './PgdDossierFlow';
import PgdCaseEvidencePanel from './PgdCaseEvidencePanel';
import PgdDossierOperationsPanel from './PgdDossierOperationsPanel';
import {
  PgdAssignmentStepPanel,
  PgdFieldInspectionStepPanel,
  PgdFieldSamplingPanel,
  PgdLabRequestStepPanel,
  PgdPlanStepPanel,
  PgdResultsStepPanel,
  type PgdStationPanelProps,
} from './PgdStationFormsPanel';
import PgdcnDossierDocumentActionTable from './PgdcnDossierDocumentActionTable';

type Props = {
  request: PgdInspectionRequest;
  currentUser: PcnUserAccount;
  selectedStepId: PgdDossierFlowStepId;
  dossierRequirements: PgdDossierRequirement[];
  dossierDocuments: PgdDossierDocument[];
  samples: PgdSample[];
  canMutate: boolean;
  onCompleteCurrent?: () => void;
  completeDisabled?: boolean;
  isProcessing?: boolean;
  completeLabel?: string;
  onOpenChecklist?: (requirementCode?: string) => void;
  initialRequirementCode?: string;
  onOpenFullDossier?: () => void;
  onOpenDrafting?: (input: { templateKind: PgdDocumentTemplateKind; requirementCode: string }) => string | undefined;
  onRequestException?: (status: 'REJECTED' | 'ON_HOLD', reason: string) => void;
  exceptionBusy?: boolean;
};

const STEP_META: Record<PgdDossierFlowStepId, { number: number; title: string; description: string }> = {
  intake: { number: 1, title: 'Tiếp nhận PYC', description: 'Xác nhận bộ hồ sơ đầu vào, người phụ trách và các chứng từ cần bổ sung.' },
  capability: { number: 2, title: 'Kiểm tra phạm vi & năng lực', description: 'Đối chiếu phạm vi giám định, tiêu chuẩn áp dụng và khả năng thực hiện.' },
  assignment: { number: 3, title: 'Phân công giám định', description: 'Chọn giám định viên và người soát xét kỹ thuật theo scope PGD.' },
  plan: { number: 4, title: 'Lập kế hoạch', description: 'Xác nhận ngày hiện trường, nội dung trọng tâm và lịch làm việc.' },
  field: { number: 5, title: 'Kiểm tra hiện trường', description: 'Ghi nhận hiện trạng, đo kiểm và xác nhận với đại diện khách hàng.' },
  sampling: { number: 6, title: 'Lấy mẫu & niêm phong', description: 'Tách mẫu gửi PTN, mẫu lưu, mã mẫu và số niêm phong.' },
  'lab-request': { number: 7, title: 'Giao mẫu / lập PYC PTN', description: 'Lập yêu cầu thử nghiệm và ghi nhận bàn giao mẫu.' },
  'lab-result': { number: 8, title: 'Tiếp nhận KQTN', description: 'Tiếp nhận báo cáo và các giá trị kết quả từ PTN.' },
  'result-review': { number: 9, title: 'Xem xét KQTN', description: 'Đánh giá tính đầy đủ, phù hợp và nhu cầu thử lại.' },
  report: { number: 10, title: 'Lập báo cáo', description: 'Hoàn thiện báo cáo giám định theo bản chụp tiêu chuẩn.' },
  approval: { number: 11, title: 'Phê duyệt & ký', description: 'Thực hiện phê duyệt chuyên môn, lãnh đạo và ký chứng thư.' },
  return: { number: 12, title: 'Trả kết quả & lưu trữ', description: 'Tải gói hồ sơ, trả kết quả và hoàn thiện lưu trữ.' },
};
const STEP_COUNT = Object.keys(STEP_META).length;

const STEP_DRAFTING: Partial<Record<PgdDossierFlowStepId, PgdDocumentTemplateKind>> = {
  intake: 'INTAKE_REQUEST',
  capability: 'CASE_TIMELINE',
  assignment: 'ASSIGNMENT',
  plan: 'INSPECTION_PLAN',
  field: 'FIELD_INSPECTION',
  sampling: 'SAMPLE_TAKING',
  'lab-request': 'LAB_REQUEST',
  'lab-result': 'LAB_RESULT_REVIEW',
  'result-review': 'LAB_RESULT_REVIEW',
  report: 'INSPECTION_REPORT',
  approval: 'DECISION',
  return: 'DOSSIER_COVER',
};

const NEXT_ROLE: Record<PgdDossierFlowStepId, string> = {
  intake: 'Tiếp nhận / Văn thư',
  capability: 'Quản lý PGD',
  assignment: 'Chuyên gia giám định',
  plan: 'Chuyên gia giám định',
  field: 'Kiểm tra viên hiện trường',
  sampling: 'Kiểm tra viên hiện trường',
  'lab-request': 'Phòng thử nghiệm',
  'lab-result': 'Chuyên gia / Người soát xét',
  'result-review': 'Người soát xét kỹ thuật',
  report: 'Người soát xét kỹ thuật',
  approval: 'Lãnh đạo',
  return: 'Văn thư lưu trữ',
};

const STEP_REQUIREMENT_GROUPS: Record<PgdDossierFlowStepId, PgdDossierRequirement['group'][]> = {
  intake: ['REQUEST', 'COMMERCIAL_CUSTOMS'],
  capability: ['REQUEST', 'COMMERCIAL_CUSTOMS', 'TECHNICAL'],
  assignment: ['REQUEST'],
  plan: ['TECHNICAL'],
  field: ['FIELD'],
  sampling: ['FIELD'],
  'lab-request': ['LAB_SUBCONTRACTOR'],
  'lab-result': ['RESULT_ISSUANCE'],
  'result-review': ['RESULT_ISSUANCE'],
  report: ['RESULT_ISSUANCE'],
  approval: ['RESULT_ISSUANCE'],
  return: ['ARCHIVE', 'RESULT_ISSUANCE'],
};

function StepIntro({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-5 text-blue-950">{children}</div>;
}

function ExistingStationPanel({ request, currentUser, canMutate }: Pick<Props, 'request' | 'currentUser' | 'canMutate'>) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600"><div className="font-black text-slate-800">Việc này dùng cùng dữ liệu nghiệp vụ PGD</div><p className="mt-1">Các biểu mẫu liên quan được gom theo ngữ cảnh để bạn xử lý mà không rời hồ sơ. Quyền chỉnh sửa vẫn do quy trình và RBAC hiện tại quyết định.</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><span><b className="block text-[9px] text-slate-400">Mã PYC</b><strong className="font-mono text-blue-700">{request.requestCode}</strong></span><span><b className="block text-[9px] text-slate-400">Hàng hóa</b><strong className="text-slate-700">{request.productName}</strong></span><span><b className="block text-[9px] text-slate-400">Người thao tác</b><strong className="font-mono text-slate-700">{currentUser.username}</strong></span></div><span className="sr-only">{canMutate ? 'Có quyền thao tác khi bước mở.' : 'Chỉ xem theo quyền hiện tại.'}</span></div>;
}

export default function PgdDossierStepWorkPanel({ request, currentUser, selectedStepId, dossierRequirements, dossierDocuments, samples, canMutate, onCompleteCurrent, completeDisabled = false, isProcessing = false, completeLabel, onOpenChecklist, initialRequirementCode, onOpenFullDossier, onOpenDrafting, onRequestException, exceptionBusy = false }: Props) {
  const meta = STEP_META[selectedStepId];
  const stationProps: PgdStationPanelProps = { request, currentUser, editable: canMutate };
  const templateKind = STEP_DRAFTING[selectedStepId];
  const requirement = templateKind ? getPgdDossierRequirementForTemplate(templateKind, request.productGroup) : undefined;
  const currentDocumentsByCode = useMemo(() => new Map(getCurrentPgdDossierDocuments(dossierDocuments).map((document) => [document.requirementCode, document])), [dossierDocuments]);
  const waivedRequirementCodes = useMemo(() => new Set((request.dossierChecklist || [])
    .filter((item) => item.status === 'WAIVED' && Boolean(item.waiverReason?.trim()))
    .map((item) => item.requirementCode)), [request.dossierChecklist]);
  const currentRole = currentUser.pgdRole || currentUser.position || currentUser.username;
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [exceptionStatus, setExceptionStatus] = useState<'REJECTED' | 'ON_HOLD'>('REJECTED');
  const [exceptionReason, setExceptionReason] = useState('');
  const [selectedSupplementRequirementCode, setSelectedSupplementRequirementCode] = useState<string>();
  const exceptionAllowed = Boolean(onRequestException && canMutate && !['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED'].includes(request.status));
  const stepRequirements = useMemo(() => {
    const groups = new Set(STEP_REQUIREMENT_GROUPS[selectedStepId] || []);
    const matches = dossierRequirements.filter((item) => groups.has(item.group));
    if (requirement && !matches.some((item) => item.code === requirement.code)) matches.unshift(requirement);
    return matches;
  }, [dossierRequirements, requirement, selectedStepId]);
  const requiredStepRequirements = stepRequirements.filter((item) => item.required);
  const presentRequiredCount = requiredStepRequirements.filter((item) => currentDocumentsByCode.has(item.code)).length;
  const waivedRequiredCount = requiredStepRequirements.filter((item) => (
    !currentDocumentsByCode.has(item.code) && waivedRequirementCodes.has(item.code)
  )).length;
  const missingStepRequirements = requiredStepRequirements.filter((item) => (
    !currentDocumentsByCode.has(item.code) && !waivedRequirementCodes.has(item.code)
  ));
  const missingRequiredCount = missingStepRequirements.length;
  const nextAction = getPgdcnNextAction('PGD', request.status, { missingRequiredCount });
  const completionPending = isProcessing && canMutate && Boolean(onCompleteCurrent);
  const completionUnavailable = !canMutate || !onCompleteCurrent || completeDisabled || completionPending;
  const continuationReason = !canMutate
    ? 'Tài khoản hiện tại chỉ có quyền xem; hãy nhờ người có quyền PGD thực hiện thao tác tiếp theo.'
    : !onCompleteCurrent
      ? 'Bước đang chọn không có thao tác chuyển tiếp trong trạng thái hiện tại. Hãy mở bước PGD hiện hành.'
      : completionPending
        ? 'Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất trước khi tiếp tục.'
        : completeDisabled
        ? 'Thao tác chuyển bước đang bị khóa bởi điều kiện nghiệp vụ hoặc đang được xử lý. Kiểm tra mục Cổng tiếp theo của hồ sơ PGD để biết trạng thái hiện hành.'
        : undefined;
  const permissionAwareNextAction = !canMutate
    ? missingRequiredCount > 0
      ? `Xem ${missingRequiredCount} mục bắt buộc còn thiếu; nhờ người có quyền PGD bổ sung tài liệu.`
      : 'Chỉ xem hồ sơ; nhờ người có quyền PGD tiếp tục bước hiện tại.'
    : !onCompleteCurrent
      ? 'Xem lại bước này; thao tác chuyển tiếp thuộc về bước PGD hiện hành.'
      : completionPending
        ? 'Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất.'
        : completeDisabled
        ? 'Kiểm tra điều kiện nghiệp vụ trước khi tiếp tục.'
        : missingRequiredCount > 0
          ? `Bổ sung ${missingRequiredCount} tài liệu bắt buộc còn thiếu.`
          : nextAction.label;
  const continuationReasonId = `pgd-step-continuation-reasons-${selectedStepId}`;
  const draftingHref = templateKind && requirement && onOpenDrafting
    ? onOpenDrafting({ templateKind, requirementCode: requirement.code })
    : undefined;
  const documentActionRows = stepRequirements.map((item) => {
    const document = currentDocumentsByCode.get(item.code);
    const isWaived = waivedRequirementCodes.has(item.code);
    const status = document ? 'Đã có' : isWaived ? 'Đã bỏ qua' : 'Chưa có';
    const action = document?.fileAssetId ? (
      <a href={getPgdDossierDocumentDownloadUrl(document.id)} target="_blank" rel="noreferrer" download={document.fileName} title="Xem tài liệu" aria-label="Xem tài liệu" className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Eye size={14} aria-hidden="true" /></a>
    ) : !document && !isWaived && draftingHref && requirement?.code === item.code ? (
      <a href={draftingHref} title="Soạn thảo tài liệu" aria-label="Soạn thảo tài liệu" className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><FileText size={14} aria-hidden="true" /></a>
    ) : !document && onOpenChecklist ? (
      <button type="button" onClick={() => { setSelectedSupplementRequirementCode(item.code); onOpenChecklist?.(item.code); }} title="Bổ sung tệp" aria-label="Bổ sung tệp" className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Upload size={14} aria-hidden="true" /></button>
    ) : <span className="text-xs font-semibold text-slate-500">{document ? 'Đã ghi nhận' : isWaived ? 'Đã bỏ qua' : 'Chưa có'}</span>;
    return {
      id: item.code,
      step: meta.title,
      title: item.title,
      required: item.required,
      status,
      statusTone: document ? 'success' as const : isWaived ? 'neutral' as const : 'warning' as const,
      detail: document ? `${document.fileName} · v${document.version}` : item.description,
      action,
    };
  });

  const renderStep = () => {
    switch (selectedStepId) {
      case 'intake':
        return <PgdCaseEvidencePanel request={request} requirements={dossierRequirements} dossierDocuments={dossierDocuments} samples={samples} canMutate={canMutate} editable={canMutate} initialRequirementCode={selectedSupplementRequirementCode || initialRequirementCode} />;
      case 'capability':
        return <><StepIntro><b>Kiểm tra trước khi phân công:</b> đối chiếu nhóm sản phẩm, phạm vi yêu cầu, tiêu chuẩn, địa điểm và phương thức đánh giá. Chủ hồ sơ có thể được cập nhật ở khối thao tác bên dưới.</StepIntro><PgdDossierOperationsPanel request={request} requirements={dossierRequirements} dossierDocuments={dossierDocuments} canMutate={canMutate} editable={canMutate} /></>;
      case 'assignment':
        return <PgdAssignmentStepPanel {...stationProps} />;
      case 'plan':
        return <PgdPlanStepPanel {...stationProps} />;
      case 'field':
        return <PgdFieldInspectionStepPanel {...stationProps} />;
      case 'sampling':
        return <PgdFieldSamplingPanel {...stationProps} />;
      case 'lab-request':
      case 'lab-result':
        return <PgdLabRequestStepPanel {...stationProps} />;
      case 'result-review':
      case 'report':
      case 'approval':
      case 'return':
        return <PgdResultsStepPanel {...stationProps} />;
      default:
        return <ExistingStationPanel request={request} currentUser={currentUser} canMutate={canMutate} />;
    }
  };

  const submitException = () => {
    const reason = exceptionReason.trim();
    if (!reason || !onRequestException) return;
    onRequestException(exceptionStatus, reason);
    setExceptionFormOpen(false);
    setExceptionReason('');
  };

  return (
    <section id={`pgd-dossier-step-panel-${selectedStepId}`} role="tabpanel" aria-labelledby={`pgd-dossier-step-tab-${selectedStepId}`} data-testid="pgd-dossier-step-work-panel" className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">{meta.number}</span><span data-testid="pgd-step-position" className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Bước {meta.number}/{STEP_COUNT} · Việc đang chọn</span></div>
          <h3 className="mt-2 text-base font-black text-slate-900">{meta.title}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">{meta.description}</p><p data-testid="pgd-step-next-action" className="mt-2 break-words text-xs font-bold leading-5 text-blue-800">Việc bạn cần làm: {permissionAwareNextAction}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {draftingHref ? <a href={draftingHref} className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Soạn thảo tài liệu</a> : null}
          {onOpenChecklist ? <button type="button" onClick={() => onOpenChecklist()} className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Xem danh sách tài liệu</button> : null}
          {onOpenFullDossier ? <button type="button" onClick={onOpenFullDossier} className="mobile-touch-target mobile-touch-target inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Mở hồ sơ đầy đủ</button> : null}
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs" aria-label="Soát xét tài liệu bắt buộc ở bước PGD hiện tại">
        <div className="min-w-0 break-words"><span className="mr-2 text-xs font-black uppercase tracking-wide text-blue-700">Soát xét bước này</span><strong className="break-words text-slate-800">{presentRequiredCount} đã có · {waivedRequiredCount} được miễn · {missingRequiredCount} còn thiếu</strong></div>
        <div><span className="mr-2 text-xs font-black uppercase tracking-wide text-blue-700">Bước kế tiếp</span><strong className="text-slate-800">{NEXT_ROLE[selectedStepId]}</strong></div>
        <details className="text-slate-500" data-testid="pgd-dossier-role-details" data-disclosure="advanced"><summary className="cursor-pointer list-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Vai trò hiện tại</summary><span className="ml-1">{currentRole} · {currentUser.username}</span></details>
      </section>

      <section data-testid="pgd-step-continuation-guidance" aria-label="Hướng dẫn tiếp tục bước PGD" aria-live="polite" className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 break-words">
          <h4 className="text-xs font-black text-slate-900">Điều kiện và việc tiếp theo</h4>
          {missingRequiredCount > 0
            ? <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-amber-900">Còn thiếu {missingRequiredCount} tài liệu bắt buộc ở bước này: {missingStepRequirements.map((item) => item.title).join(' · ')}.</p>
            : <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-slate-600">Đã có hoặc được miễn toàn bộ tài liệu bắt buộc ở bước này.</p>}
        </div>
        {completionUnavailable && continuationReason
          ? <div id={continuationReasonId} tabIndex={-1} aria-label="Lý do chưa thể tiếp tục" className="min-w-0 break-words rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-950">
              <p><strong>Chưa thể tiếp tục:</strong> {continuationReason}</p>
              <a href={`#${continuationReasonId}`} className="mobile-touch-target mt-1 inline-flex min-h-11 items-center font-bold text-amber-900 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">Xem lý do chưa thể tiếp tục</a>
            </div>
          : <p className="min-w-0 break-words text-xs leading-5 text-slate-700">Bước có thể tiếp tục bằng thao tác: <strong>{completeLabel || nextAction.label}</strong>.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Danh sách tài liệu cần hoàn thiện PGD">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-xs font-black text-slate-900">Tài liệu cần hoàn thiện</h3><p className="mt-1 text-xs leading-5 text-slate-600">Mỗi dòng cho biết tài liệu đã có chưa và việc cần làm tiếp theo.</p></div>
          <span className="text-xs font-bold text-slate-600">{stepRequirements.length} mục ở bước này</span>
        </div>
        <PgdcnDossierDocumentActionTable testId="pgd-dossier-document-action-table" rows={documentActionRows} />
      </section>

      {exceptionAllowed ? <details className="rounded-xl border border-rose-100 bg-rose-50/50" data-testid="pgd-dossier-exception-review" data-disclosure="advanced" aria-label="Xử lý ngoại lệ hồ sơ PGD">
        <summary className="mobile-touch-target cursor-pointer list-none px-3 py-2.5 text-xs font-black text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">Xử lý ngoại lệ <span className="ml-1 font-normal text-rose-900/70">(chỉ mở khi cần trả bổ sung hoặc tạm dừng)</span></summary>
        <div className="border-t border-rose-100 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs leading-5 text-rose-900/90">Bắt buộc ghi lý do để người tiếp theo tiếp tục đúng ngữ cảnh.</p><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => { setExceptionStatus('REJECTED'); setExceptionFormOpen(true); }} disabled={exceptionBusy} className="mobile-touch-target min-h-11 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-black text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50">Trả bổ sung</button><button type="button" onClick={() => { setExceptionStatus('ON_HOLD'); setExceptionFormOpen(true); }} disabled={exceptionBusy} className="mobile-touch-target min-h-11 rounded-lg border border-amber-200 bg-white px-2.5 text-xs font-black text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50">Tạm dừng</button></div></div>
        {exceptionFormOpen && <div className="mt-2 rounded-lg border border-rose-200 bg-white p-2.5"><div className="text-xs font-black text-slate-800">{exceptionStatus === 'REJECTED' ? 'Trả bổ sung hồ sơ' : 'Tạm dừng hồ sơ'}</div><label className="mt-2 block" htmlFor="pgd-exception-reason"><span className="text-xs font-black text-slate-700">Lý do<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><textarea id="pgd-exception-reason" required aria-required="true" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} rows={2} className="mobile-touch-target mt-1 min-h-11 w-full rounded-lg border border-rose-200 px-2.5 py-2 text-xs outline-none focus:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" /></label><div className="mt-2 flex flex-wrap justify-end gap-1.5"><button type="button" onClick={() => setExceptionFormOpen(false)} disabled={exceptionBusy} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Hủy</button><button type="button" onClick={submitException} disabled={exceptionBusy || !exceptionReason.trim()} className="mobile-touch-target min-h-11 rounded-lg bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50">{exceptionBusy ? 'Đang ghi nhận...' : 'Xác nhận nhánh ngoại lệ'}</button></div></div>}
        </div>
      </details> : null}

      <details className="rounded-xl border border-slate-200 bg-slate-50" data-testid="pgd-dossier-advanced-workflow" data-disclosure="advanced">
        <summary className="mobile-touch-target cursor-pointer list-none px-3 py-2.5 text-xs font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Mở biểu mẫu nghiệp vụ của bước này <span className="ml-1 font-normal text-slate-600">({meta.title})</span></summary>
        <div className="border-t border-slate-200 p-3">{renderStep()}</div>
      </details>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-xs leading-5 text-slate-600">{completionUnavailable ? 'Xem lý do và hướng xử lý ở trên trước khi tiếp tục.' : 'Chỉ hoàn tất khi các điều kiện của việc và dữ liệu bắt buộc đã đủ.'}</p>
        <button type="button" onClick={onCompleteCurrent} disabled={completionUnavailable} aria-busy={completionPending ? 'true' : undefined} aria-describedby={completionUnavailable ? continuationReasonId : undefined} className="mobile-touch-target inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{completionPending ? 'Đang xử lý...' : completeLabel || (selectedStepId === 'intake' ? 'Bắt đầu xử lý' : 'Hoàn tất việc')}</button>
      </footer>
    </section>
  );
}
