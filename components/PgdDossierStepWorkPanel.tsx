'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronRight, Download, Eye, Pencil, Upload } from 'lucide-react';

import type { PcnUserAccount } from '../types';
import type { PgdInspectionRequest, PgdSample } from '../utils/pgdDomain';
import type { PgdDossierDocument, PgdDossierRequirement } from '../utils/pgdDossier';
import { getCurrentPgdDossierDocuments, getPgdDossierRequirementForTemplate } from '../utils/pgdDossier';
import { getPgdDossierDocumentDownloadUrl } from '../utils/pgdApi';
import { getPgdcnNextAction } from '../utils/pgdcnDashboard';
import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdDossierFlowStepId, PgdDossierFlowStageId } from './PgdDossierFlow';
import { canonicalizePgdStepId, PGD_DOSSIER_FLOW_STEPS } from './PgdDossierFlow';
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
  dossierLoadStatus?: 'loading' | 'error' | 'loaded';
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
  onUploadSupplementary?: (stageId: PgdDossierFlowStageId, file: File) => Promise<void>;
  onRequestException?: (status: 'REJECTED' | 'ON_HOLD', reason: string) => void;
  exceptionBusy?: boolean;
  onSelectDocument?: (documentId: string) => void;
};

// Định nghĩa thông tin 7 giai đoạn chuẩn hóa
const STAGE_META: Record<PgdDossierFlowStageId, { number: number; title: string; description: string }> = {
  intake: {
    number: 1,
    title: 'Tiếp nhận hồ sơ',
    description: 'Xác nhận bộ hồ sơ đầu vào, người phụ trách và các chứng từ hải quan/thương mại cần bổ sung.',
  },
  'review-assignment': {
    number: 2,
    title: 'Xem xét & Phân công',
    description: 'Đối chiếu phạm vi giám định, đánh giá năng lực và phân công đoàn giám định.',
  },
  plan: {
    number: 3,
    title: 'Lập kế hoạch',
    description: 'Xác nhận ngày hiện trường, nội dung trọng tâm và lịch trình làm việc.',
  },
  execution: {
    number: 4,
    title: 'Thực hiện giám định',
    description: 'Kiểm tra hiện trường, lấy mẫu, niêm phong và bàn giao mẫu cho PTN.',
  },
  'results-evaluation': {
    number: 5,
    title: 'Xử lý & Đánh giá kết quả',
    description: 'Tiếp nhận kết quả thử nghiệm từ PTN và xem xét đánh giá sự phù hợp.',
  },
  'reporting-approval': {
    number: 6,
    title: 'Báo cáo & Phê duyệt',
    description: 'Hoàn thiện báo cáo giám định, trình duyệt chuyên môn và ký phát hành chứng thư.',
  },
  'issuance-archive': {
    number: 7,
    title: 'Trả kết quả & Lưu trữ',
    description: 'Đóng gói chứng thư, bàn giao kết quả cho khách hàng và lưu trữ hồ sơ nghiệp vụ.',
  },
};

const STAGE_COUNT = Object.keys(STAGE_META).length;

const STAGE_DRAFTING: Partial<Record<PgdDossierFlowStageId, PgdDocumentTemplateKind>> = {
  intake: 'INTAKE_REQUEST',
  'review-assignment': 'ASSIGNMENT',
  plan: 'INSPECTION_PLAN',
  execution: 'FIELD_INSPECTION',
  'results-evaluation': 'LAB_RESULT_REVIEW',
  'reporting-approval': 'INSPECTION_REPORT',
  'issuance-archive': 'DOSSIER_COVER',
};

const NEXT_ROLE_BY_STAGE: Record<PgdDossierFlowStageId, string> = {
  intake: 'Văn thư / Bộ phận tiếp nhận',
  'review-assignment': 'Quản lý PGD / Chuyên gia giám định',
  plan: 'Chuyên gia giám định',
  execution: 'Kiểm tra viên hiện trường / PTN',
  'results-evaluation': 'Người soát xét kỹ thuật',
  'reporting-approval': 'Lãnh đạo phê duyệt',
  'issuance-archive': 'Văn thư lưu trữ',
};

const STAGE_REQUIREMENT_GROUPS: Record<PgdDossierFlowStageId, PgdDossierRequirement['group'][]> = {
  intake: ['REQUEST', 'COMMERCIAL_CUSTOMS'],
  'review-assignment': ['REQUEST', 'COMMERCIAL_CUSTOMS', 'TECHNICAL'],
  plan: ['TECHNICAL'],
  execution: ['FIELD', 'LAB_SUBCONTRACTOR'],
  'results-evaluation': ['RESULT_ISSUANCE'],
  'reporting-approval': ['RESULT_ISSUANCE'],
  'issuance-archive': ['ARCHIVE', 'RESULT_ISSUANCE'],
};

function StepIntro({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-5 text-blue-950">{children}</div>;
}

function ExistingStationPanel({ request, currentUser, canMutate }: Pick<Props, 'request' | 'currentUser' | 'canMutate'>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
      <div className="font-black text-slate-800">Giai đoạn này dùng cùng dữ liệu nghiệp vụ PGD</div>
      <p className="mt-1">
        Các biểu mẫu liên quan được gom theo ngữ cảnh để bạn xử lý mà không rời hồ sơ. Quyền chỉnh sửa do quy trình và RBAC hiện tại quyết định.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <span>
          <b className="block text-[9px] text-slate-400">Mã PYC</b>
          <strong className="font-mono text-blue-700">{request.requestCode}</strong>
        </span>
        <span>
          <b className="block text-[9px] text-slate-400">Hàng hóa</b>
          <strong className="text-slate-700">{request.productName}</strong>
        </span>
        <span>
          <b className="block text-[9px] text-slate-400">Người thao tác</b>
          <strong className="font-mono text-slate-700">{currentUser.username}</strong>
        </span>
      </div>
      <span className="sr-only">{canMutate ? 'Có quyền thao tác khi bước mở.' : 'Chỉ xem theo quyền hiện tại.'}</span>
    </div>
  );
}

export default function PgdDossierStepWorkPanel({
  request,
  currentUser,
  selectedStepId,
  dossierRequirements,
  dossierDocuments,
  dossierLoadStatus = 'loaded',
  samples,
  canMutate,
  onCompleteCurrent,
  completeDisabled = false,
  isProcessing = false,
  completeLabel,
  onOpenChecklist,
  initialRequirementCode,
  onOpenFullDossier,
  onOpenDrafting,
  onUploadSupplementary,
  onRequestException,
  exceptionBusy = false,
  onSelectDocument,
}: Props) {
  const canonicalStageId = canonicalizePgdStepId(selectedStepId);
  const meta = STAGE_META[canonicalStageId];
  const stationProps: PgdStationPanelProps = { request, currentUser, editable: canMutate };
  const templateKind = STAGE_DRAFTING[canonicalStageId];
  const requirement = templateKind ? getPgdDossierRequirementForTemplate(templateKind, request.productGroup) : undefined;
  
  const currentDocumentsByCode = useMemo(
    () => new Map(getCurrentPgdDossierDocuments(dossierDocuments).map((document) => [document.requirementCode, document])),
    [dossierDocuments]
  );
  const waivedRequirementCodes = useMemo(
    () => new Set((request.dossierChecklist || []).filter((item) => item.status === 'WAIVED' && Boolean(item.waiverReason?.trim())).map((item) => item.requirementCode)),
    [request.dossierChecklist]
  );
  const currentRole = currentUser.pgdRole || currentUser.position || currentUser.username;
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [exceptionStatus, setExceptionStatus] = useState<'REJECTED' | 'ON_HOLD'>('REJECTED');
  const [exceptionReason, setExceptionReason] = useState('');
  const [selectedSupplementRequirementCode, setSelectedSupplementRequirementCode] = useState<string>();
  const [activeTaskTab, setActiveTaskTab] = useState<string>('all');
  const [supplementaryUploadBusy, setSupplementaryUploadBusy] = useState(false);
  const [supplementaryUploadError, setSupplementaryUploadError] = useState<string | null>(null);
  const [suppModalOpen, setSuppModalOpen] = useState(false);
  const [suppTitle, setSuppTitle] = useState('');
  const [suppDesc, setSuppDesc] = useState('');
  const [suppFile, setSuppFile] = useState<File | null>(null);

  const exceptionAllowed = Boolean(onRequestException && canMutate && !['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED'].includes(request.status));
  
  const stepRequirements = useMemo(() => {
    const groups = new Set(STAGE_REQUIREMENT_GROUPS[canonicalStageId] || []);
    const matches = dossierRequirements.filter((item) => groups.has(item.group));
    if (requirement && !matches.some((item) => item.code === requirement.code)) matches.unshift(requirement);
    return matches;
  }, [dossierRequirements, requirement, canonicalStageId]);

  const requiredStepRequirements = stepRequirements.filter((item) => item.required);
  const presentRequiredCount = requiredStepRequirements.filter((item) => currentDocumentsByCode.has(item.code)).length;
  const waivedRequiredCount = requiredStepRequirements.filter((item) => !currentDocumentsByCode.has(item.code) && waivedRequirementCodes.has(item.code)).length;
  const missingStepRequirements = requiredStepRequirements.filter((item) => !currentDocumentsByCode.has(item.code) && !waivedRequirementCodes.has(item.code));
  const missingRequiredCount = missingStepRequirements.length;
  
  const nextAction = getPgdcnNextAction('PGD', request.status, { missingRequiredCount });
  const completionPending = isProcessing && canMutate && Boolean(onCompleteCurrent);
  const dossierLoadPending = dossierLoadStatus === 'loading';
  const dossierLoadFailed = dossierLoadStatus === 'error';
  const dossierStatusUnknown = dossierLoadStatus !== 'loaded';
  const completionUnavailable = dossierStatusUnknown || !canMutate || !onCompleteCurrent || completeDisabled || completionPending;
  
  const continuationReason = !canMutate
    ? 'Tài khoản hiện tại chỉ có quyền xem; hãy nhờ người có quyền PGD thực hiện thao tác tiếp theo.'
    : !onCompleteCurrent
    ? 'Giai đoạn đang chọn không có thao tác chuyển tiếp trong trạng thái hiện tại. Hãy mở giai đoạn PGD hiện hành.'
    : completionPending
    ? 'Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất trước khi tiếp tục.'
    : dossierLoadPending
    ? 'Đang tải trạng thái chứng từ; vui lòng chờ trước khi tiếp tục.'
    : dossierLoadFailed
    ? 'Không thể xác định điều kiện tài liệu. Hãy tải lại trạng thái chứng từ trước khi tiếp tục.'
    : completeDisabled
    ? 'Thao tác chuyển giai đoạn đang bị khóa bởi điều kiện nghiệp vụ hoặc đang được xử lý. Kiểm tra mục Cổng tiếp theo để biết trạng thái hiện hành.'
    : undefined;

  const permissionAwareNextAction = dossierLoadPending
    ? 'Đang tải trạng thái chứng từ; vui lòng chờ để xác định việc cần làm.'
    : dossierLoadFailed
    ? 'Không thể xác định việc cần làm do chưa tải được trạng thái chứng từ. Hãy tải lại trước khi tiếp tục.'
    : !canMutate
    ? missingRequiredCount > 0
      ? `Xem ${missingRequiredCount} mục bắt buộc còn thiếu; nhờ người có quyền PGD bổ sung tài liệu.`
      : 'Chỉ xem hồ sơ; nhờ người có quyền PGD tiếp tục giai đoạn hiện tại.'
    : !onCompleteCurrent
    ? 'Xem lại giai đoạn này; thao tác chuyển tiếp thuộc về giai đoạn PGD hiện hành.'
    : completionPending
    ? 'Đang xử lý thay đổi hồ sơ; vui lòng chờ hoàn tất.'
    : completeDisabled
    ? 'Kiểm tra điều kiện nghiệp vụ trước khi tiếp tục.'
    : missingRequiredCount > 0
    ? `Bổ sung ${missingRequiredCount} tài liệu bắt buộc còn thiếu.`
    : nextAction.label;

  const continuationReasonId = `pgd-step-continuation-reasons-${selectedStepId}`;
  const draftingHref = canMutate && templateKind && requirement && onOpenDrafting ? onOpenDrafting({ templateKind, requirementCode: requirement.code }) : undefined;
  const uploadSupplementary = async (file: File | undefined) => {
    if (!file || !onUploadSupplementary) return;
    setSupplementaryUploadBusy(true);
    setSupplementaryUploadError(null);
    try {
      await onUploadSupplementary(canonicalStageId, file);
    } catch (error) {
      setSupplementaryUploadError(error instanceof Error ? error.message : 'Không thể tải tệp phụ trợ.');
    } finally {
      setSupplementaryUploadBusy(false);
    }
  };

  const documentActionRows = stepRequirements.map((item) => {
    const document = currentDocumentsByCode.get(item.code);
    const isWaived = waivedRequirementCodes.has(item.code);
    const status = dossierLoadPending ? 'Đang xác định' : dossierLoadFailed ? 'Không xác định' : document ? 'Đã có' : isWaived ? 'Đã bỏ qua' : 'Chưa có';
    const action = dossierStatusUnknown ? (
      <span className="text-xs font-semibold text-slate-500">{dossierLoadPending ? 'Đang tải trạng thái' : 'Chưa thể xác định'}</span>
    ) : document?.fileAssetId ? (
      <div className="flex items-center gap-1">
        <a
          href={getPgdDossierDocumentDownloadUrl(document.id)}
          target="_blank"
          rel="noreferrer"
          download={document.fileName}
          title="Xem tài liệu"
          aria-label="Xem tài liệu"
          onClick={() => onSelectDocument?.(document.id)}
          className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
        >
          <Eye size={14} aria-hidden="true" />
        </a>
        <a
          href={getPgdDossierDocumentDownloadUrl(document.id)}
          download={document.fileName}
          title="Tải xuống"
          aria-label="Tải xuống"
          className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
        >
          <Download size={14} aria-hidden="true" />
        </a>
      </div>
    ) : !document && !isWaived && !canMutate ? (
      <span className="text-xs font-semibold text-slate-500">Nhờ người có quyền bổ sung</span>
    ) : !document && !isWaived && draftingHref && requirement?.code === item.code ? (
      <a href={draftingHref}
        title="Soạn thảo tài liệu"
        aria-label="Soạn thảo tài liệu"
        className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
      >
        <Pencil size={14} aria-hidden="true" />
      </a>
    ) : !document && !isWaived && onOpenChecklist ? (
      <button
        type="button"
        onClick={() => {
          setSelectedSupplementRequirementCode(item.code);
          onOpenChecklist?.(item.code);
        }}
        title="Bổ sung tệp"
        aria-label="Bổ sung tệp"
        className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
      >
        <Upload size={14} aria-hidden="true" />
      </button>
    ) : (
      <span className="text-xs font-semibold text-slate-500">{document ? 'Đã ghi nhận' : isWaived ? 'Đã bỏ qua' : 'Chưa có'}</span>
    );

    return {
      id: item.code,
      step: meta.title,
      title: item.title,
      required: item.required,
      status,
      statusTone: dossierStatusUnknown ? ('neutral' as const) : document ? ('success' as const) : isWaived ? ('neutral' as const) : ('warning' as const),
      detail: dossierStatusUnknown ? 'Chưa xác định trạng thái tài liệu.' : document ? `${document.fileName} · v${document.version}` : item.description,
      action,
    };
  });

  const renderStageForms = () => {
    switch (canonicalStageId) {
      case 'intake':
        return (
          <PgdCaseEvidencePanel
            request={request}
            requirements={dossierRequirements}
            dossierDocuments={dossierDocuments}
            samples={samples}
            canMutate={canMutate}
            editable={canMutate}
            initialRequirementCode={selectedSupplementRequirementCode || initialRequirementCode}
          />
        );
      case 'review-assignment':
        return (
          <div className="space-y-4">
            <StepIntro>
              <b>Giai đoạn 2: Xem xét & Phân công.</b> Đối chiếu nhóm sản phẩm, phạm vi yêu cầu, tiêu chuẩn áp dụng, đánh giá năng lực và chỉ định chuyên gia giám định.
            </StepIntro>
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-600" /> 1. Đánh giá phạm vi & năng lực giám định
                </h4>
                <PgdDossierOperationsPanel request={request} requirements={dossierRequirements} dossierDocuments={dossierDocuments} canMutate={canMutate} editable={canMutate} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-indigo-600" /> 2. Quyết định phân công giám định viên
                </h4>
                <PgdAssignmentStepPanel {...stationProps} />
              </div>
            </div>
          </div>
        );
      case 'plan':
        return <PgdPlanStepPanel {...stationProps} />;
      case 'execution':
        return (
          <div className="space-y-4">
            <StepIntro>
              <b>Giai đoạn 4: Thực hiện giám định.</b> Gồm 3 công việc: (1) Kiểm tra hiện trường, (2) Lấy mẫu & niêm phong, (3) Bàn giao mẫu PTN.
            </StepIntro>
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2">1. Kiểm tra hiện trường & Lập biên bản</h4>
                <PgdFieldInspectionStepPanel {...stationProps} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2">2. Lấy mẫu & Niêm phong mẫu giám định</h4>
                <PgdFieldSamplingPanel {...stationProps} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2">3. Giao mẫu & Lập PYC thử nghiệm (PTN)</h4>
                <PgdLabRequestStepPanel {...stationProps} />
              </div>
            </div>
          </div>
        );
      case 'results-evaluation':
        return (
          <div className="space-y-4">
            <StepIntro>
              <b>Giai đoạn 5: Xử lý & Đánh giá kết quả.</b> Tiếp nhận báo cáo KQTN từ phòng thử nghiệm và tổ chức xem xét, đánh giá sự phù hợp.
            </StepIntro>
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2">1. Tiếp nhận dữ liệu KQTN</h4>
                <PgdLabRequestStepPanel {...stationProps} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-xs font-black text-slate-900 mb-2">2. Soát xét & Đánh giá sự phù hợp KQTN</h4>
                <PgdResultsStepPanel {...stationProps} />
              </div>
            </div>
          </div>
        );
      case 'reporting-approval':
        return (
          <div className="space-y-4">
            <StepIntro>
              <b>Giai đoạn 6: Báo cáo & Phê duyệt.</b> Tổng hợp chứng thư giám định, tổ chức soát xét chuyên môn và trình lãnh đạo ký số.
            </StepIntro>
            <PgdResultsStepPanel {...stationProps} />
          </div>
        );
      case 'issuance-archive':
        return (
          <div className="space-y-4">
            <StepIntro>
              <b>Giai đoạn 7: Trả kết quả & Lưu trữ.</b> Hoàn tất đóng gói kết quả, bàn giao cho khách hàng và đưa hồ sơ vào trạng thái lưu trữ chính thức.
            </StepIntro>
            <PgdResultsStepPanel {...stationProps} />
          </div>
        );
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

  // Lấy danh sách công việc của giai đoạn hiện tại từ PGD_DOSSIER_FLOW_STEPS
  const currentStageConfig = PGD_DOSSIER_FLOW_STEPS.find((s) => s.id === canonicalStageId);
  const stageTasks = currentStageConfig?.tasks || [];

  return (
    <section
      id={`pgd-dossier-step-panel-${selectedStepId}`}
      role="tabpanel"
      aria-labelledby={`pgd-dossier-step-tab-${selectedStepId}`}
      data-testid="pgd-dossier-selected-step-panel"
      className="min-w-0 space-y-2.5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200/80 bg-blue-50/40 px-3 py-1.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">0{meta.number}</span>
            <span data-testid="pgd-step-position" className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
              Giai đoạn {meta.number}/{STAGE_COUNT} · Giai đoạn đang chọn
            </span>
            <h3 className="text-sm font-black text-slate-900">{meta.title}</h3>
          </div>
          <p data-testid="pgd-step-next-action" className="mt-1 break-words text-xs font-bold leading-5 text-blue-800">
            Việc bạn cần làm: {permissionAwareNextAction}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {onCompleteCurrent ? (
            <button
              type="button"
              onClick={onCompleteCurrent}
              disabled={completionUnavailable}
              aria-busy={completionPending ? 'true' : undefined}
              aria-describedby={continuationReason ? continuationReasonId : undefined}
              className="mobile-touch-target inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8"
            >
              {completionPending ? 'Đang xử lý…' : (completeLabel || 'Hoàn tất việc')}
            </button>
          ) : null}
          {draftingHref ? (
            <a href={draftingHref} className="mobile-touch-target dossier-action-compact inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-black text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8">
              Soạn thảo biểu mẫu
            </a>
          ) : null}
          {onOpenChecklist ? (
            <button
              type="button"
              onClick={() => onOpenChecklist()}
              className="mobile-touch-target dossier-action-compact inline-flex min-h-8 items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Xem danh sách tài liệu
            </button>
          ) : null}

        </div>
      </header>

      {/* Bảng công việc chi tiết của giai đoạn (Stage Tasks Breakdown) */}
      {stageTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-[11px]" aria-label="Các công việc thuộc giai đoạn này">
          <span className="font-bold text-slate-700 mr-1">Công việc ({stageTasks.length}):</span>
          {stageTasks.map((task, idx) => (
            <span key={task.id} className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700 text-[11px] font-medium shadow-2xs">
              <span className="font-mono font-bold text-slate-400">{meta.number}.{idx + 1}</span>
              <span className="font-semibold text-slate-800">{task.title}</span>
              {task.required && <span className="text-[11px] text-rose-600 font-bold" title="Bắt buộc">*</span>}
            </span>
          ))}
        </div>
      )}

      {/* Trọng tâm: Bảng tài liệu cần hoàn thiện trong giai đoạn */}
      <section className="border-t border-slate-200/80 pt-2.5" aria-label="Danh sách tài liệu cần hoàn thiện PGD">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black text-slate-900">Tài liệu và hồ sơ liên quan</h3>
            <p className="text-[11px] text-slate-500">Mỗi dòng cho biết tài liệu đã có chưa và việc cần làm tiếp theo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">{stepRequirements.length} mục ở giai đoạn này</span>
            {canMutate && onUploadSupplementary && !dossierStatusUnknown ? (
              <button
                type="button"
                onClick={() => setSuppModalOpen(true)}
                title={`Tải tệp phụ trợ cho giai đoạn ${meta.title}`}
                aria-label={`Tải tệp phụ trợ cho giai đoạn ${meta.title}`}
                className="mobile-touch-target dossier-action-compact inline-flex min-h-8 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <Upload size={13} aria-hidden="true" />
                <span>Tệp phụ trợ</span>
              </button>
            ) : null}
          </div>
        </div>
        {supplementaryUploadError ? <p role="alert" className="mb-2 text-xs font-semibold text-rose-700">{supplementaryUploadError}</p> : null}
        {(() => {
          const supplementaryDocs = dossierDocuments.filter((d) => d.supplementaryStageId === canonicalStageId);
          const supplementaryRows = supplementaryDocs.map((doc) => ({
            id: doc.id,
            step: meta.title,
            title: doc.fileName || doc.title,
            required: false,
            status: 'Đã có',
            statusTone: 'success' as const,
            detail: `Tệp phụ trợ · v${doc.version}`,
            action: (
              <div className="flex items-center gap-1">
                <a
                  href={getPgdDossierDocumentDownloadUrl(doc.id)}
                  target="_blank"
                  rel="noreferrer"
                  download={doc.fileName}
                  title="Xem tài liệu"
                  aria-label="Xem tài liệu"
                  onClick={() => onSelectDocument?.(doc.id)}
                  className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
                >
                  <Eye size={14} aria-hidden="true" />
                </a>
                <a
                  href={getPgdDossierDocumentDownloadUrl(doc.id)}
                  download={doc.fileName}
                  title="Tải xuống"
                  aria-label="Tải xuống"
                  className="mobile-touch-target dossier-action-compact inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8 sm:min-w-8"
                >
                  <Download size={14} aria-hidden="true" />
                </a>
              </div>
            ),
          }));
          return <PgdcnDossierDocumentActionTable testId="pgd-dossier-document-action-table" rows={[...documentActionRows, ...supplementaryRows]} />;
        })()}
        {suppModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="pgd-supp-modal-title">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 id="pgd-supp-modal-title" className="text-sm font-black text-slate-900">
              Thêm đầu mục tài liệu phụ trợ · {meta.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Nhập mô tả ngắn gọn và chọn tệp đính kèm để bổ sung vào giai đoạn.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Tên tài liệu / Tiêu đề *</label>
                <input
                  type="text"
                  value={suppTitle}
                  onChange={(e) => setSuppTitle(e.target.value)}
                  placeholder="Ví dụ: Bổ sung chứng từ giám định..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Mô tả ngắn gọn</label>
                <textarea
                  rows={2}
                  value={suppDesc}
                  onChange={(e) => setSuppDesc(e.target.value)}
                  placeholder="Nhập ghi chú tóm tắt nội dung..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Tệp tài liệu (tùy chọn)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.avif"
                  aria-label={`Tải tệp phụ trợ cho giai đoạn ${meta.title}`}
                  onChange={(e) => setSuppFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-blue-200 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSuppModalOpen(false);
                  setSuppTitle('');
                  setSuppDesc('');
                  setSuppFile(null);
                }}
                className="mobile-touch-target rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={supplementaryUploadBusy}
                onClick={async () => {
                  if (suppFile) {
                    await uploadSupplementary(suppFile);
                  }
                  setSuppModalOpen(false);
                  setSuppTitle('');
                  setSuppDesc('');
                  setSuppFile(null);
                }}
                className="mobile-touch-target rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {supplementaryUploadBusy ? 'Đang lưu…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>

      {/* Soát xét giai đoạn */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-1.5 text-xs" aria-label="Soát xét tài liệu bắt buộc ở bước PGD hiện tại">
        <div className="min-w-0 break-words">
          <span className="mr-2 text-xs font-black uppercase tracking-wide text-blue-700">Soát xét giai đoạn</span>
          <strong aria-live="polite" className="break-words text-slate-800">
            {dossierStatusUnknown
              ? dossierLoadPending
                ? 'Đang tải trạng thái chứng từ…'
                : 'Không thể xác định trạng thái chứng từ.'
              : `${presentRequiredCount} đã có · ${waivedRequiredCount} được miễn · ${missingRequiredCount} còn thiếu`}
          </strong>
        </div>
        <div>
          <span className="mr-2 text-xs font-black uppercase tracking-wide text-blue-700">Giai đoạn kế tiếp</span>
          <strong className="text-slate-800">{NEXT_ROLE_BY_STAGE[canonicalStageId]}</strong>
        </div>
        <details className="text-slate-500" data-testid="pgd-dossier-role-details" data-disclosure="advanced">
          <summary className="cursor-pointer list-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Vai trò hiện tại
          </summary>
          <span className="ml-1">
            {currentRole} · {currentUser.username}
          </span>
        </details>
      </section>

      {/* Hướng dẫn tiếp tục giai đoạn */}
      <section
        data-testid="pgd-step-continuation-guidance"
        aria-label="Hướng dẫn tiếp tục giai đoạn PGD"
        aria-live="polite"
        className="grid min-w-0 gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="min-w-0 break-words">
          <h4 className="text-xs font-black text-slate-900">Điều kiện và việc tiếp theo</h4>
          {dossierLoadPending ? (
            <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-slate-600">
              Đang tải trạng thái chứng từ; chưa thể xác định tài liệu còn thiếu.
            </p>
          ) : dossierLoadFailed ? (
            <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-amber-900">
              Không thể xác định trạng thái chứng từ. Hãy tải lại để kiểm tra điều kiện trước khi tiếp tục.
            </p>
          ) : missingRequiredCount > 0 ? (
            <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-amber-900">
              Còn thiếu {missingRequiredCount} tài liệu bắt buộc ở giai đoạn này: {missingStepRequirements.map((item) => item.title).join(' · ')}.
            </p>
          ) : (
            <p data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-slate-600">
              Đã có hoặc được miễn toàn bộ tài liệu bắt buộc ở giai đoạn này.
            </p>
          )}
        </div>
        {completionUnavailable && continuationReason ? (
          <div
            id={continuationReasonId}
            tabIndex={-1}
            aria-label="Lý do chưa thể tiếp tục"
            className="min-w-0 break-words rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-950"
          >
            <p>
              <strong>Chưa thể tiếp tục:</strong> {continuationReason}
            </p>
            <a
              href={`#${continuationReasonId}`}
              className="mobile-touch-target mt-1 inline-flex min-h-11 items-center font-bold text-amber-900 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              Xem lý do chưa thể tiếp tục
            </a>
          </div>
        ) : (
          <p className="min-w-0 break-words text-xs leading-5 text-slate-700">
            Giai đoạn có thể tiếp tục bằng thao tác: <strong>{completeLabel || nextAction.label}</strong>.
          </p>
        )}
      </section>

      {exceptionAllowed ? (
        <details className="rounded-xl border border-rose-100 bg-rose-50/50" data-testid="pgd-dossier-exception-review" data-disclosure="advanced" aria-label="Xử lý ngoại lệ hồ sơ PGD">
          <summary className="mobile-touch-target cursor-pointer list-none px-3 py-2 text-xs font-black text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
            Xử lý ngoại lệ <span className="ml-1 font-normal text-rose-900/70">(chỉ mở khi cần trả bổ sung hoặc tạm dừng)</span>
          </summary>
          <div className="border-t border-rose-100 p-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs leading-5 text-rose-900/90">Bắt buộc ghi lý do để người tiếp theo tiếp tục đúng ngữ cảnh.</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setExceptionStatus('REJECTED');
                    setExceptionFormOpen(true);
                  }}
                  disabled={exceptionBusy}
                  className="mobile-touch-target min-h-11 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-black text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  Trả bổ sung
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExceptionStatus('ON_HOLD');
                    setExceptionFormOpen(true);
                  }}
                  disabled={exceptionBusy}
                  className="mobile-touch-target min-h-11 rounded-lg border border-amber-200 bg-white px-2.5 text-xs font-black text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  Tạm dừng hồ sơ
                </button>
              </div>
            </div>

            {exceptionFormOpen ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-white p-2.5">
                <label htmlFor="pgd-exception-reason" className="block text-xs font-bold text-slate-800">
                  Lý do {exceptionStatus === 'REJECTED' ? 'trả bổ sung' : 'tạm dừng'} *
                </label>
                <textarea
                  id="pgd-exception-reason"
                  rows={2}
                  value={exceptionReason}
                  onChange={(event) => setExceptionReason(event.target.value)}
                  placeholder="Nhập lý do cụ thể..."
                  className="mobile-touch-target mt-1 min-h-11 w-full rounded-md border border-slate-200 p-2 text-xs outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200"
                />
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setExceptionFormOpen(false);
                      setExceptionReason('');
                    }}
                    className="mobile-touch-target min-h-11 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={!exceptionReason.trim() || exceptionBusy}
                    onClick={submitException}
                    className="mobile-touch-target min-h-11 rounded-lg bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {exceptionBusy ? 'Đang lưu…' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-slate-50" data-testid="pgd-dossier-advanced-workflow" data-disclosure="advanced" open={false}>
        <summary className="mobile-touch-target cursor-pointer list-none px-3 py-2 text-xs font-black text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Biểu mẫu nghiệp vụ của giai đoạn ({meta.title})
        </summary>
        <div className="border-t border-slate-200 p-3">
          {renderStageForms()}
        </div>
      </details>
    </section>
  );
}
