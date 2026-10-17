'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileText,
  Flag,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import type { PgdInspectionStatus, PgdTransitionContext } from '../utils/pgdDomain';
import { getPgdStatusLabel } from '../utils/pgdDomain';

export type PgdDossierFlowStepId =
  | 'intake'
  | 'capability'
  | 'assignment'
  | 'plan'
  | 'field'
  | 'sampling'
  | 'lab-request'
  | 'lab-result'
  | 'result-review'
  | 'report'
  | 'approval'
  | 'return';

export type PgdDossierFlowStepStatus = 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'WAITING' | 'RETURNED' | 'COMPLETED';

export interface PgdDossierFlowProps {
  status: PgdInspectionStatus;
  evidence?: PgdTransitionContext;
  selectedStepId: PgdDossierFlowStepId;
  onSelectStep: (stepId: PgdDossierFlowStepId) => void;
}

type FlowType = 'FILE' | 'ACTION' | 'APPROVAL' | 'END';

type FlowStep = {
  id: PgdDossierFlowStepId;
  label: string;
  description: string;
  type: FlowType;
};

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export const PGD_DOSSIER_FLOW_STEPS: readonly FlowStep[] = [
  { id: 'intake', label: 'Tiếp nhận PYC', description: 'Kiểm tra hồ sơ đầu vào và checklist chứng từ.', type: 'FILE' },
  { id: 'capability', label: 'Kiểm tra phạm vi & năng lực', description: 'Đối chiếu phạm vi, tiêu chuẩn và khả năng thực hiện.', type: 'ACTION' },
  { id: 'assignment', label: 'Phân công giám định', description: 'Chọn đoàn giám định và người soát xét kỹ thuật.', type: 'APPROVAL' },
  { id: 'plan', label: 'Lập kế hoạch', description: 'Xác nhận ngày, nội dung và lịch giám định.', type: 'FILE' },
  { id: 'field', label: 'Kiểm tra hiện trường', description: 'Ghi nhận hiện trạng, đo kiểm và đại diện khách hàng.', type: 'FILE' },
  { id: 'sampling', label: 'Lấy mẫu & niêm phong', description: 'Tách mẫu PTN, mẫu lưu và thông tin niêm phong.', type: 'ACTION' },
  { id: 'lab-request', label: 'Giao mẫu / lập PYC PTN', description: 'Lập yêu cầu thử nghiệm và bàn giao mẫu.', type: 'ACTION' },
  { id: 'lab-result', label: 'Tiếp nhận KQTN', description: 'Ghi nhận báo cáo và dữ liệu kết quả PTN.', type: 'FILE' },
  { id: 'result-review', label: 'Xem xét KQTN', description: 'Đánh giá tính đầy đủ, phù hợp và nhu cầu thử lại.', type: 'APPROVAL' },
  { id: 'report', label: 'Lập báo cáo', description: 'Hoàn thiện báo cáo giám định và bản chụp tiêu chuẩn.', type: 'FILE' },
  { id: 'approval', label: 'Phê duyệt & ký', description: 'Phê duyệt chuyên môn, lãnh đạo và ký chứng thư.', type: 'APPROVAL' },
  { id: 'return', label: 'Trả kết quả & lưu trữ', description: 'Đóng gói, trả kết quả và lưu hồ sơ.', type: 'END' },
] as const;

const TYPE_META: Record<FlowType, { label: string; icon: LucideIcon; className: string }> = {
  FILE: { label: 'Tài liệu', icon: FileText, className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  ACTION: { label: 'Thao tác', icon: ClipboardCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  APPROVAL: { label: 'Phê duyệt', icon: ShieldCheck, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  END: { label: 'Kết thúc', icon: Flag, className: 'border-slate-200 bg-slate-100 text-slate-700' },
};

const STATUS_META: Record<PgdDossierFlowStepStatus, StatusMeta> = {
  LOCKED: { label: 'Chưa mở', icon: LockKeyhole, className: 'text-slate-400' },
  READY: { label: 'Sẵn sàng', icon: CircleDot, className: 'text-blue-700' },
  IN_PROGRESS: { label: 'Đang xử lý', icon: PlayCircle, className: 'text-blue-700' },
  WAITING: { label: 'Đang chờ', icon: Clock3, className: 'text-amber-700' },
  RETURNED: { label: 'Cần xử lý lại', icon: RotateCcw, className: 'text-rose-700' },
  COMPLETED: { label: 'Đã hoàn tất', icon: CheckCircle2, className: 'text-emerald-700' },
};

export function getPgdDossierCurrentStepNumber(status: PgdInspectionStatus): number {
  if (status === 'DRAFT') return 1;
  if (status === 'REJECTED' || status === 'ON_HOLD') return 2;
  if (status === 'CAPABILITY_REVIEW') return 2;
  if (status === 'READY_TO_EXECUTE') return 3;
  if (status === 'PREPARING') return 4;
  if (status === 'FIELD_INSPECTION') return 5;
  if (status === 'WAITING_LAB_RESULTS') return 8;
  if (status === 'RESULTS_REVIEW') return 9;
  if (status === 'TECHNICAL_REVIEW') return 10;
  if (status === 'LEADERSHIP_APPROVAL') return 11;
  return 12;
}

function hasStepCompletionEvidence(step: FlowStep, evidence: PgdTransitionContext | undefined, status: PgdInspectionStatus): boolean {
  if (step.id === 'assignment') return evidence?.hasApprovedAssignment === true;
  if (step.id === 'field') return evidence?.hasFieldInspection === true;
  if (step.id === 'sampling') return evidence?.hasSampleHandover === true;
  if (step.id === 'lab-request') return (evidence?.labRequests?.length || 0) > 0;
  if (step.id === 'lab-result') {
    const requests = evidence?.labRequests || [];
    return requests.length > 0 && requests.every((request) => ['RESULT_RECEIVED', 'CLOSED'].includes(request.status));
  }
  if (step.id === 'result-review') {
    const review = evidence?.labResultReview;
    return review?.status === 'FINAL' && review.retestRequired !== true && review.conformity !== 'NON_CONFORMING';
  }
  if (step.id === 'report') return evidence?.reportReady === true;
  if (step.id === 'approval') return evidence?.signed === true;
  if (step.id === 'return') return ['RESULT_RETURNED', 'ARCHIVED'].includes(status) && evidence?.signed === true;
  return false;
}

function currentStatusForStep(stepNumber: number, status: PgdInspectionStatus, evidence: PgdTransitionContext | undefined): PgdDossierFlowStepStatus {
  const current = getPgdDossierCurrentStepNumber(status);
  const step = PGD_DOSSIER_FLOW_STEPS[stepNumber - 1];
  const verifiedComplete = step ? hasStepCompletionEvidence(step, evidence, status) : false;
  if (stepNumber > current) return 'LOCKED';
  if (stepNumber < current) return verifiedComplete ? 'COMPLETED' : 'READY';
  if (stepNumber === 12 && ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(status)) {
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
  if (step.id === 'assignment') return evidence?.hasApprovedAssignment === true ? 'Đã duyệt' : evidence?.hasApprovedAssignment === false ? 'Chưa duyệt' : 'Chưa có dữ liệu xác minh';
  if (step.id === 'field') return evidence?.hasFieldInspection === true ? 'Đã ghi nhận' : evidence?.hasFieldInspection === false ? 'Chưa ghi nhận' : 'Chưa có dữ liệu xác minh';
  if (step.id === 'sampling') return evidence?.hasSampleHandover === true ? 'Đã bàn giao' : evidence?.hasSampleHandover === false ? 'Chưa bàn giao' : 'Chưa có dữ liệu xác minh';
  if (step.id === 'lab-request') return evidence?.labRequests ? `${evidence.labRequests.length} PYC PTN` : 'Chưa có dữ liệu xác minh';
  if (step.id === 'lab-result') {
    if (!evidence?.labRequests) return 'Chưa có dữ liệu xác minh';
    const requests = evidence.labRequests;
    if (requests.length === 0) return 'Chưa có PYC PTN';
    const completed = requests.filter((item) => ['RESULT_RECEIVED', 'CLOSED'].includes(item.status)).length;
    return `${completed}/${requests.length} KQTN`;
  }
  if (step.id === 'result-review') {
    const review = evidence?.labResultReview;
    if (!review) return 'Chưa có dữ liệu xác minh';
    if (review.status !== 'FINAL') return 'Chưa hoàn tất xem xét';
    if (review.retestRequired === true || review.conformity === 'NON_CONFORMING') return 'Cần xử lý thêm';
    return 'Đã xem xét';
  }
  if (step.id === 'report') return evidence?.reportReady === true ? 'Đã có báo cáo' : evidence?.reportReady === false ? 'Chưa có báo cáo' : 'Chưa có dữ liệu xác minh';
  if (step.id === 'approval') return evidence?.signed === true ? 'Đã ký' : evidence?.hasCertificate === true ? 'Chưa ký' : evidence?.hasCertificate === false ? 'Chưa có chứng thư' : 'Chưa có dữ liệu xác minh';
  if (step.id === 'return') {
    if (evidence?.signed !== true) return evidence?.signed === false ? 'Chưa ký' : 'Chưa có dữ liệu xác minh';
    if (status === 'ARCHIVED') return 'Đã lưu trữ';
    if (status === 'RESULT_RETURNED') return 'Đã trả kết quả';
    return 'Đã ký · chờ trả';
  }
  return 'Chưa có dữ liệu xác minh';
}

export function getPgdDossierFlowStepIdForStatus(status: PgdInspectionStatus): PgdDossierFlowStepId {
  const step = PGD_DOSSIER_FLOW_STEPS[getPgdDossierCurrentStepNumber(status) - 1];
  return step?.id || 'intake';
}

export function PgdDossierFlow({ status, evidence, selectedStepId, onSelectStep }: PgdDossierFlowProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentNumber = getPgdDossierCurrentStepNumber(status);
  const selectedStep = PGD_DOSSIER_FLOW_STEPS.find((step) => step.id === selectedStepId) || PGD_DOSSIER_FLOW_STEPS[Math.min(currentNumber - 1, PGD_DOSSIER_FLOW_STEPS.length - 1)];
  const selectedIndex = PGD_DOSSIER_FLOW_STEPS.findIndex((step) => step.id === selectedStep?.id);
  const resolvedSteps = PGD_DOSSIER_FLOW_STEPS.filter((_, index) => currentStatusForStep(index + 1, status, evidence) === 'COMPLETED').length;
  const selectableIndexes = useMemo(() => PGD_DOSSIER_FLOW_STEPS.map((_, index) => index).filter((index) => index + 1 <= currentNumber), [currentNumber]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const selectedIndex = PGD_DOSSIER_FLOW_STEPS.findIndex((step) => step.id === selectedStepId);
    const selectedTab = selectedIndex >= 0 ? tabRefs.current[selectedIndex] : null;
    if (!scrollContainer || !selectedTab) return;

    const scrollBounds = scrollContainer.getBoundingClientRect();
    const tabBounds = selectedTab.getBoundingClientRect();
    const visibleLeft = scrollBounds.left + scrollContainer.clientLeft;
    const visibleRight = visibleLeft + scrollContainer.clientWidth;
    const nextScrollLeft = tabBounds.left < visibleLeft
      ? scrollContainer.scrollLeft + tabBounds.left - visibleLeft
      : tabBounds.right > visibleRight
        ? scrollContainer.scrollLeft + tabBounds.right - visibleRight
        : scrollContainer.scrollLeft;
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const targetLeft = Math.max(0, Math.min(nextScrollLeft, maxScrollLeft));
    if (Math.abs(targetLeft - scrollContainer.scrollLeft) < 1) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (prefersReducedMotion || typeof scrollContainer.scrollTo !== 'function') {
      scrollContainer.scrollLeft = targetLeft;
      return;
    }
    scrollContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [selectedStepId]);

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
    <section className="min-w-0 space-y-3" data-testid="pgd-dossier-native-flow" aria-label="Tiến trình hồ sơ PGD">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">PGD · Tiến trình hồ sơ</p>
          <h2 className="mt-1 text-base font-black text-slate-950">Xử lý từng việc theo đúng thứ tự</h2>
        </div>
        <p className="text-xs text-slate-600" aria-live="polite">Đang ở bước {currentNumber}/{PGD_DOSSIER_FLOW_STEPS.length} · {resolvedSteps}/{PGD_DOSSIER_FLOW_STEPS.length} việc đã xong · {getPgdStatusLabel(status)}</p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-200" style={{ width: `${Math.round((resolvedSteps / PGD_DOSSIER_FLOW_STEPS.length) * 100)}%` }} />
      </div>

      <div ref={scrollContainerRef} className="mobile-scroll-x min-w-0 overflow-x-auto pb-1" data-testid="pgd-dossier-flow-scroll">
        <div className="flex min-w-max items-stretch gap-2" role="tablist" aria-label="Các việc xử lý hồ sơ PGD">
          {PGD_DOSSIER_FLOW_STEPS.map((step, index) => {
            const stepStatus = currentStatusForStep(index + 1, status, evidence);
            const statusMeta = STATUS_META[stepStatus];
            const displayedStatusLabel = stepStatusLabel(index + 1, stepStatus, status);
            const typeMeta = TYPE_META[step.type];
            const TypeIcon = typeMeta.icon;
            const StatusIcon = statusMeta.icon;
            const disabled = stepStatus === 'LOCKED';
            const selected = selectedStep?.id === step.id;
            return (
              <div className="flex items-center gap-2" key={step.id}>
                <button
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`pgd-dossier-step-tab-${step.id}`}
                  type="button"
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  aria-selected={selected}
                  aria-current={index + 1 === currentNumber && stepStatus !== 'COMPLETED' ? 'step' : undefined}
                  aria-controls={`pgd-dossier-step-panel-${step.id}`}
                  aria-describedby={`pgd-step-status-${step.id}`}
                  aria-posinset={index + 1}
                  aria-setsize={PGD_DOSSIER_FLOW_STEPS.length}
                  disabled={disabled}
                  title={disabled ? `${step.label} · Chưa đến bước` : step.description}
                  onClick={() => onSelectStep(step.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`mobile-touch-target group flex min-h-[106px] w-[218px] flex-col justify-between rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100/80 text-slate-400 opacity-70' : selected ? 'border-blue-500 bg-white shadow-sm ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${typeMeta.className}`}>{index + 1}</span>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold tracking-wide ${typeMeta.className}`}><TypeIcon size={13} aria-hidden="true" />{typeMeta.label}</span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{step.label}</span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-500">{stepProgress(step, evidence, status)}</span>
                    <span id={`pgd-step-status-${step.id}`} className={`inline-flex shrink-0 items-center gap-1 font-medium ${statusMeta.className}`}><StatusIcon size={14} aria-hidden="true" />{displayedStatusLabel}</span>
                  </span>
                </button>
                {index < PGD_DOSSIER_FLOW_STEPS.length - 1 ? <ChevronRight className="shrink-0 text-slate-300" size={18} aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <p className="px-1 text-[11px] text-slate-500 md:hidden">Vuốt ngang để xem đủ 12 bước</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" aria-label="Chú giải loại việc">
        {(Object.keys(TYPE_META) as FlowType[]).map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return <span key={type} className="inline-flex items-center gap-1.5"><span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${meta.className}`}><Icon size={12} aria-hidden="true" />{meta.label}</span></span>;
        })}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-slate-700" data-testid="pgd-dossier-flow-context">
        <span className="font-semibold text-slate-950">Bước {selectedIndex + 1}: {selectedStep.label}</span>
        <span className="ml-2 text-slate-600">· {selectedStep.description}</span>
        {currentNumber < selectedIndex + 1 ? <span className="ml-2 text-amber-800">· Việc này đang bị khóa theo quy trình</span> : null}
      </div>
    </section>
  );
}

export default PgdDossierFlow;
