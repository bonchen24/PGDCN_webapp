'use client';

import { useMemo, useRef, type ReactNode } from 'react';

import type { PgdInspectionStatus, PgdTransitionContext } from '../utils/pgdDomain';
import { getPgdStatusLabel } from '../utils/pgdDomain';

/**
 * 7 Chuẩn hóa giai đoạn chính của quy trình hồ sơ Giám định PGD:
 * 1. intake: Tiếp nhận hồ sơ (Tiếp nhận PYC)
 * 2. review-assignment: Xem xét & phân công (Kiểm tra năng lực, phân công giám định)
 * 3. plan: Lập kế hoạch (Kế hoạch giám định hiện trường)
 * 4. execution: Thực hiện giám định (Hiện trường, lấy mẫu & niêm phong, giao mẫu PTN)
 * 5. results-evaluation: Xử lý & đánh giá kết quả (Tiếp nhận KQTN, xem xét KQTN)
 * 6. reporting-approval: Báo cáo & phê duyệt (Lập báo cáo, phê duyệt, ký chứng thư)
 * 7. issuance-archive: Trả kết quả & lưu trữ (Đóng gói, bàn giao kết quả & hoàn tất lưu trữ)
 */
export type PgdDossierFlowStageId =
  | 'intake'
  | 'review-assignment'
  | 'plan'
  | 'execution'
  | 'results-evaluation'
  | 'reporting-approval'
  | 'issuance-archive';

/**
 * Backward compatibility alias for legacy 12-step identifiers.
 * Maps legacy IDs to the canonical 7 stages.
 */
export type PgdDossierLegacyStepId =
  | 'capability'
  | 'assignment'
  | 'field'
  | 'sampling'
  | 'lab-request'
  | 'lab-result'
  | 'result-review'
  | 'report'
  | 'approval'
  | 'return';

export type PgdDossierFlowStepId = PgdDossierFlowStageId | PgdDossierLegacyStepId;

export type PgdDossierFlowStepStatus = 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'WAITING' | 'RETURNED' | 'COMPLETED';

export interface PgdDossierFlowProps {
  status: PgdInspectionStatus;
  evidence?: PgdTransitionContext;
  selectedStepId: PgdDossierFlowStepId;
  onSelectStep: (stepId: PgdDossierFlowStepId) => void;
}

type FlowType = 'FILE' | 'ACTION' | 'APPROVAL' | 'END';

export type PgdFlowStageTask = {
  id: string;
  legacyStepId: PgdDossierFlowStepId;
  title: string;
  description: string;
  required: boolean;
  type: FlowType;
};

export type FlowStep = {
  id: PgdDossierFlowStageId;
  label: string;
  description: string;
  type: FlowType;
  tasks: readonly PgdFlowStageTask[];
};

type StatusMeta = {
  label: string;
  className: string;
};

/**
 * Danh mục 7 giai đoạn chuẩn hóa PGD, lưu giữ đầy đủ các công việc từ 12 bước cũ.
 */
export const PGD_DOSSIER_FLOW_STEPS: readonly FlowStep[] = [
  {
    id: 'intake',
    label: 'Tiếp nhận hồ sơ',
    description: 'Tiếp nhận PYC, kiểm tra hồ sơ đầu vào và danh mục chứng từ.',
    type: 'FILE',
    tasks: [
      {
        id: 'task-intake-pyc',
        legacyStepId: 'intake',
        title: 'Tiếp nhận PYC & Hồ sơ',
        description: 'Kiểm tra hồ sơ đầu vào, kiểm tra chứng từ hải quan/thương mại.',
        required: true,
        type: 'FILE',
      },
    ],
  },
  {
    id: 'review-assignment',
    label: 'Xem xét & Phân công',
    description: 'Kiểm tra phạm vi năng lực và phân công đoàn giám định.',
    type: 'APPROVAL',
    tasks: [
      {
        id: 'task-capability-review',
        legacyStepId: 'capability',
        title: 'Kiểm tra phạm vi & năng lực',
        description: 'Đối chiếu phạm vi, tiêu chuẩn kỹ thuật và năng lực thực hiện.',
        required: true,
        type: 'ACTION',
      },
      {
        id: 'task-assignment',
        legacyStepId: 'assignment',
        title: 'Phân công giám định viên',
        description: 'Chỉ định giám định viên hiện trường và người soát xét kỹ thuật.',
        required: true,
        type: 'APPROVAL',
      },
    ],
  },
  {
    id: 'plan',
    label: 'Lập kế hoạch',
    description: 'Xác nhận ngày, nội dung trọng tâm và lịch giám định.',
    type: 'FILE',
    tasks: [
      {
        id: 'task-plan-preparation',
        legacyStepId: 'plan',
        title: 'Lập kế hoạch giám định',
        description: 'Lập phương án, lịch làm việc và thông báo cho khách hàng.',
        required: true,
        type: 'FILE',
      },
    ],
  },
  {
    id: 'execution',
    label: 'Thực hiện giám định',
    description: 'Kiểm tra hiện trường, lấy mẫu, niêm phong và gửi mẫu PTN.',
    type: 'ACTION',
    tasks: [
      {
        id: 'task-field-inspection',
        legacyStepId: 'field',
        title: 'Kiểm tra hiện trường',
        description: 'Ghi nhận hiện trạng lô hàng, đo kiểm và lập biên bản hiện trường.',
        required: true,
        type: 'FILE',
      },
      {
        id: 'task-field-sampling',
        legacyStepId: 'sampling',
        title: 'Lấy mẫu & niêm phong',
        description: 'Tách mẫu gửi PTN, lưu mẫu, lập biên bản lấy mẫu và niêm phong.',
        required: false,
        type: 'ACTION',
      },
      {
        id: 'task-lab-dispatch',
        legacyStepId: 'lab-request',
        title: 'Giao mẫu / Lập PYC PTN',
        description: 'Lập phiếu yêu cầu thử nghiệm và bàn giao mẫu cho phòng thử nghiệm.',
        required: false,
        type: 'ACTION',
      },
    ],
  },
  {
    id: 'results-evaluation',
    label: 'Xử lý & Đánh giá kết quả',
    description: 'Tiếp nhận kết quả thử nghiệm và đánh giá sự phù hợp.',
    type: 'APPROVAL',
    tasks: [
      {
        id: 'task-lab-result-receive',
        legacyStepId: 'lab-result',
        title: 'Tiếp nhận KQTN',
        description: 'Tiếp nhận phiếu KQTN từ phòng thử nghiệm nội bộ hoặc nhà thầu phụ.',
        required: false,
        type: 'FILE',
      },
      {
        id: 'task-result-review',
        legacyStepId: 'result-review',
        title: 'Xem xét & Đánh giá KQTN',
        description: 'Đánh giá tính hợp lệ của KQTN, đối chiếu tiêu chuẩn kỹ thuật.',
        required: false,
        type: 'APPROVAL',
      },
    ],
  },
  {
    id: 'reporting-approval',
    label: 'Báo cáo & Phê duyệt',
    description: 'Lập báo cáo giám định, phê duyệt chuyên môn và ký chứng thư.',
    type: 'APPROVAL',
    tasks: [
      {
        id: 'task-report-preparation',
        legacyStepId: 'report',
        title: 'Lập báo cáo giám định',
        description: 'Tổng hợp kết quả, soạn thảo dự thảo chứng thư / chứng chỉ giám định.',
        required: true,
        type: 'FILE',
      },
      {
        id: 'task-approval-signature',
        legacyStepId: 'approval',
        title: 'Phê duyệt & Ký chứng thư',
        description: 'Soát xét kỹ thuật, trình lãnh đạo phê duyệt và ký số chứng thư.',
        required: true,
        type: 'APPROVAL',
      },
    ],
  },
  {
    id: 'issuance-archive',
    label: 'Trả kết quả & Lưu trữ',
    description: 'Đóng gói chứng thư, trả kết quả cho khách hàng và lưu trữ hồ sơ.',
    type: 'END',
    tasks: [
      {
        id: 'task-return-archive',
        legacyStepId: 'return',
        title: 'Trả kết quả & Lưu trữ',
        description: 'Bàn giao chứng thư cho khách hàng và hoàn tất đóng hồ sơ lưu trữ.',
        required: true,
        type: 'END',
      },
    ],
  },
] as const;

/**
 * Mapping từ mã bước cũ sang mã giai đoạn 7 bước mới
 */
export const PGD_LEGACY_STEP_TO_STAGE: Record<string, PgdDossierFlowStageId> = {
  intake: 'intake',
  capability: 'review-assignment',
  assignment: 'review-assignment',
  plan: 'plan',
  field: 'execution',
  sampling: 'execution',
  'lab-request': 'execution',
  'lab-result': 'results-evaluation',
  'result-review': 'results-evaluation',
  report: 'reporting-approval',
  approval: 'reporting-approval',
  return: 'issuance-archive',
  // Direct mappings
  'review-assignment': 'review-assignment',
  execution: 'execution',
  'results-evaluation': 'results-evaluation',
  'reporting-approval': 'reporting-approval',
  'issuance-archive': 'issuance-archive',
};

export function canonicalizePgdStepId(stepId: PgdDossierFlowStepId | string): PgdDossierFlowStageId | undefined {
  return PGD_LEGACY_STEP_TO_STAGE[stepId];
}

const STATUS_META: Record<PgdDossierFlowStepStatus, StatusMeta> = {
  LOCKED: { label: 'Chưa mở', className: 'text-slate-400' },
  READY: { label: 'Sẵn sàng', className: 'text-blue-700' },
  IN_PROGRESS: { label: 'Đang xử lý', className: 'text-blue-700' },
  WAITING: { label: 'Đang chờ', className: 'text-amber-700' },
  RETURNED: { label: 'Cần xử lý lại', className: 'text-rose-700' },
  COMPLETED: { label: 'Đã hoàn tất', className: 'text-emerald-700' },
};

/**
 * Tính số thứ tự giai đoạn hiện tại (1 -> 7) theo trạng thái PGD
 */
export function getPgdDossierCurrentStepNumber(status: PgdInspectionStatus): number {
  if (status === 'DRAFT') return 1; // 1. Tiếp nhận hồ sơ
  if (status === 'REJECTED' || status === 'ON_HOLD') return 2; // 2. Xem xét & phân công
  if (status === 'CAPABILITY_REVIEW') return 2; // 2. Xem xét & phân công
  if (status === 'READY_TO_EXECUTE') return 2; // 2. Xem xét & phân công
  if (status === 'PREPARING') return 3; // 3. Lập kế hoạch
  if (status === 'FIELD_INSPECTION') return 4; // 4. Thực hiện giám định
  if (status === 'WAITING_LAB_RESULTS') return 5; // 5. Xử lý & đánh giá KQTN
  if (status === 'RESULTS_REVIEW') return 5; // 5. Xử lý & đánh giá KQTN
  if (status === 'TECHNICAL_REVIEW') return 6; // 6. Báo cáo & phê duyệt
  if (status === 'LEADERSHIP_APPROVAL') return 6; // 6. Báo cáo & phê duyệt
  return 7; // 7. Trả kết quả & lưu trữ (SIGNED, RESULT_RETURNED, ARCHIVED)
}

function hasStepCompletionEvidence(step: FlowStep, evidence: PgdTransitionContext | undefined, status: PgdInspectionStatus): boolean {
  if (step.id === 'intake') {
    return status !== 'DRAFT';
  }
  if (step.id === 'review-assignment') {
    return evidence?.hasApprovedAssignment === true || ['PREPARING', 'FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status);
  }
  if (step.id === 'plan') {
    return ['FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status);
  }
  if (step.id === 'execution') {
    return evidence?.hasFieldInspection === true && (evidence?.hasSampleHandover === true || ['WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status));
  }
  if (step.id === 'results-evaluation') {
    const review = evidence?.labResultReview;
    const reviewComplete = review?.status === 'FINAL' && review.retestRequired !== true && review.conformity !== 'NON_CONFORMING';
    return reviewComplete || ['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status);
  }
  if (step.id === 'reporting-approval') {
    return evidence?.signed === true || ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status);
  }
  if (step.id === 'issuance-archive') {
    return ['RESULT_RETURNED', 'ARCHIVED'].includes(status) && evidence?.signed === true;
  }
  return false;
}

function currentStatusForStep(stepNumber: number, status: PgdInspectionStatus, evidence: PgdTransitionContext | undefined): PgdDossierFlowStepStatus {
  const current = getPgdDossierCurrentStepNumber(status);
  const step = PGD_DOSSIER_FLOW_STEPS[stepNumber - 1];
  const verifiedComplete = step ? hasStepCompletionEvidence(step, evidence, status) : false;
  if (stepNumber > current) return 'LOCKED';
  if (stepNumber < current) return verifiedComplete ? 'COMPLETED' : 'READY';
  if (stepNumber === 7 && ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status)) {
    if (status === 'SIGNED' && evidence?.signed === true) return 'WAITING';
    return verifiedComplete ? 'COMPLETED' : 'READY';
  }
  if (status === 'WAITING_LAB_RESULTS') return 'WAITING';
  if (status === 'REJECTED' || status === 'ON_HOLD') return 'RETURNED';
  return 'IN_PROGRESS';
}

function stepStatusLabel(stepNumber: number, stepStatus: PgdDossierFlowStepStatus, status: PgdInspectionStatus): string {
  const current = getPgdDossierCurrentStepNumber(status);
  if (stepStatus === 'READY' && stepNumber < current) return 'Đã qua · chưa xác minh';
  if (stepStatus === 'READY' && stepNumber === current && ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status)) return 'Chưa xác minh';
  return STATUS_META[stepStatus].label;
}

function stepProgress(step: FlowStep, evidence: PgdTransitionContext | undefined, status: PgdInspectionStatus): string {
  if (!evidence) {
    return 'Chưa có dữ liệu xác minh';
  }
  if (step.id === 'intake') {
    return status === 'DRAFT' ? 'Chờ xác nhận' : 'Đã tiếp nhận';
  }
  if (step.id === 'review-assignment') {
    return evidence?.hasApprovedAssignment === true ? 'Đã phân công' : evidence?.hasApprovedAssignment === false ? 'Chưa phân công' : 'Chưa duyệt';
  }
  if (step.id === 'plan') {
    return getPgdDossierCurrentStepNumber(status) > 3 ? 'Đã lập kế hoạch' : 'Đang lập';
  }
  if (step.id === 'execution') {
    if (evidence?.hasFieldInspection === true) {
      return evidence?.hasSampleHandover === true ? 'Đã kiểm tra & lấy mẫu' : 'Đã kiểm tra hiện trường';
    }
    return 'Chưa ghi nhận hiện trường';
  }
  if (step.id === 'results-evaluation') {
    const requests = evidence?.labRequests || [];
    const review = evidence?.labResultReview;
    if (requests.length > 0) {
      const completed = requests.filter((item) => ['RESULT_RECEIVED', 'CLOSED'].includes(item.status)).length;
      return `${completed}/${requests.length} KQTN`;
    }
    if (review?.status === 'FINAL') return 'Đã xem xét KQTN';
    return 'Chưa có KQTN';
  }
  if (step.id === 'reporting-approval') {
    if (evidence?.signed === true) return 'Đã ký chứng thư';
    if (evidence?.reportReady === true) return 'Đã có báo cáo';
    return 'Chưa duyệt báo cáo';
  }
  if (step.id === 'issuance-archive') {
    if (status === 'ARCHIVED') return 'Đã lưu trữ';
    if (status === 'RESULT_RETURNED') return 'Đã trả kết quả';
    if (evidence?.signed === true) return 'Đã ký · chờ trả';
    return 'Chờ ký phát hành';
  }
  return 'Chưa có dữ liệu xác minh';
}

export function getPgdDossierFlowStepIdForStatus(status: PgdInspectionStatus): PgdDossierFlowStageId {
  const step = PGD_DOSSIER_FLOW_STEPS[getPgdDossierCurrentStepNumber(status) - 1];
  return step?.id || 'intake';
}

export function PgdDossierStageGate({
  selectedStepId,
  stageId,
  children,
}: {
  selectedStepId: PgdDossierFlowStepId;
  stageId: PgdDossierFlowStageId;
  children?: ReactNode;
}) {
  return canonicalizePgdStepId(selectedStepId) === stageId ? <>{children}</> : null;
}

export function PgdDossierFlow({ status, evidence, selectedStepId, onSelectStep }: PgdDossierFlowProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentNumber = getPgdDossierCurrentStepNumber(status);
  
  // Canonicalize selectedStepId if passed legacy ID (e.g., 'capability' -> 'review-assignment')
  const canonicalSelectedId = canonicalizePgdStepId(selectedStepId);
  const selectedStep = PGD_DOSSIER_FLOW_STEPS.find((step) => step.id === canonicalSelectedId) || PGD_DOSSIER_FLOW_STEPS[Math.min(currentNumber - 1, PGD_DOSSIER_FLOW_STEPS.length - 1)];
  const selectableIndexes = useMemo(() => PGD_DOSSIER_FLOW_STEPS.map((_, index) => index).filter((index) => index + 1 <= currentNumber), [currentNumber]);

  const focusRelative = (index: number, direction: 1 | -1) => {
    const position = selectableIndexes.indexOf(index);
    if (position < 0 || selectableIndexes.length === 0) return;
    const nextIndex = selectableIndexes[(position + direction + selectableIndexes.length) % selectableIndexes.length];
    onSelectStep(PGD_DOSSIER_FLOW_STEPS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusRelative(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelative(index, -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? selectableIndexes[0] : selectableIndexes[selectableIndexes.length - 1];
      if (nextIndex === undefined) return;
      onSelectStep(PGD_DOSSIER_FLOW_STEPS[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <section className="min-w-0 space-y-2" data-testid="pgd-dossier-native-flow" aria-label="Bước xử lý">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">Bước xử lý</h3>
        <p className="text-[11px] text-slate-600" aria-live="polite">
          Đang ở giai đoạn {currentNumber}/7 · {getPgdStatusLabel(status)}
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto pb-1" data-testid="pgd-dossier-flow-scroll">
        <div className="grid min-w-max grid-cols-7 gap-1.5 md:w-full md:min-w-0" role="tablist" aria-label="Các giai đoạn xử lý hồ sơ PGD">
          {PGD_DOSSIER_FLOW_STEPS.map((step, index) => {
            const stepStatus = currentStatusForStep(index + 1, status, evidence);
            const displayedStatusLabel = stepStatusLabel(index + 1, stepStatus, status);
            const progressLabel = stepProgress(step, evidence, status);
            const selected = selectedStep?.id === step.id;
            const disabled = index + 1 > currentNumber;
            const stepClassName = disabled
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-70'
              : selected
                ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm'
                : stepStatus === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-50'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/30';
            const numberClassName = selected
              ? 'bg-blue-600 text-white'
              : stepStatus === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600';
            return (
              <button
                ref={(element) => { tabRefs.current[index] = element; }}
                id={'pgd-dossier-step-tab-' + step.id}
                key={step.id}
                type="button"
                role="tab"
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-current={index + 1 === currentNumber && stepStatus !== 'COMPLETED' ? 'step' : undefined}
                aria-controls={'pgd-dossier-step-panel-' + step.id}
                aria-describedby={'pgd-step-status-' + step.id}
                aria-posinset={index + 1}
                aria-setsize={PGD_DOSSIER_FLOW_STEPS.length}
                aria-label={step.label + ' · ' + displayedStatusLabel}
                disabled={disabled}
                title={disabled ? step.label + ' · Chưa đến giai đoạn' : step.description}
                onClick={() => onSelectStep(step.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={'mobile-touch-target flex min-h-11 min-w-11 items-center justify-center rounded-md border px-1.5 py-1 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ' + stepClassName}
              >
                <span className={'flex h-6 w-8 items-center justify-center rounded-md text-[10px] font-black tabular-nums ' + numberClassName}>
                  0{index + 1}
                </span>
                <span id={'pgd-step-status-' + step.id} className="sr-only">{progressLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default PgdDossierFlow;
