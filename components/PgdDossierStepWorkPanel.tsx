'use client';

import { useState, type ReactNode } from 'react';

import type { PcnUserAccount } from '../types';
import type { PgdInspectionRequest, PgdSample } from '../utils/pgdDomain';
import type { PgdDossierDocument, PgdDossierRequirement } from '../utils/pgdDossier';
import { getPgdDossierRequirementForTemplate } from '../utils/pgdDossier';
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
  completeLabel?: string;
  onOpenChecklist?: () => void;
  onOpenFullDossier?: () => void;
  onOpenDrafting?: (input: { templateKind: PgdDocumentTemplateKind; requirementCode: string }) => void;
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

function StepIntro({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[10px] leading-4 text-blue-950">{children}</div>;
}

function ExistingStationPanel({ request, currentUser, canMutate }: Pick<Props, 'request' | 'currentUser' | 'canMutate'>) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 text-[10px] text-slate-600"><div className="font-black text-slate-800">Việc này dùng cùng dữ liệu nghiệp vụ PGD</div><p className="mt-1 leading-4">Các biểu mẫu liên quan được gom theo ngữ cảnh để bạn xử lý mà không rời hồ sơ. Quyền chỉnh sửa vẫn do quy trình và RBAC hiện tại quyết định.</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><span><b className="block text-[9px] text-slate-400">Mã PYC</b><strong className="font-mono text-blue-700">{request.requestCode}</strong></span><span><b className="block text-[9px] text-slate-400">Hàng hóa</b><strong className="text-slate-700">{request.productName}</strong></span><span><b className="block text-[9px] text-slate-400">Người thao tác</b><strong className="font-mono text-slate-700">{currentUser.username}</strong></span></div><span className="sr-only">{canMutate ? 'Có quyền thao tác khi bước mở.' : 'Chỉ xem theo quyền hiện tại.'}</span></div>;
}

export default function PgdDossierStepWorkPanel({ request, currentUser, selectedStepId, dossierRequirements, dossierDocuments, samples, canMutate, onCompleteCurrent, completeDisabled = false, completeLabel, onOpenChecklist, onOpenFullDossier, onOpenDrafting, onRequestException, exceptionBusy = false }: Props) {
  const meta = STEP_META[selectedStepId];
  const stationProps: PgdStationPanelProps = { request, currentUser, editable: canMutate };
  const templateKind = STEP_DRAFTING[selectedStepId];
  const requirement = templateKind ? getPgdDossierRequirementForTemplate(templateKind, request.productGroup) : undefined;
  const missingRequiredCount = dossierRequirements.filter((item) => item.required && !dossierDocuments.some((document) => document.requirementCode === item.code)).length;
  const currentRole = currentUser.pgdRole || currentUser.position || currentUser.username;
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [exceptionStatus, setExceptionStatus] = useState<'REJECTED' | 'ON_HOLD'>('REJECTED');
  const [exceptionReason, setExceptionReason] = useState('');
  const exceptionAllowed = Boolean(onRequestException && canMutate && !['SIGNED', 'RESULT_RETURNED', 'ARCHIVED', 'CANCELLED'].includes(request.status));

  const renderStep = () => {
    switch (selectedStepId) {
      case 'intake':
        return <PgdCaseEvidencePanel request={request} requirements={dossierRequirements} dossierDocuments={dossierDocuments} samples={samples} canMutate={canMutate} editable={canMutate} />;
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
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">{meta.number}</span><span className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">Việc đang chọn</span></div>
          <h3 className="mt-2 text-base font-black text-slate-900">{meta.title}</h3>
          <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {templateKind && requirement && onOpenDrafting ? <button type="button" onClick={() => onOpenDrafting({ templateKind, requirementCode: requirement.code })} disabled={!canMutate} className="mobile-touch-target inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Soạn thảo tài liệu</button> : null}
          {onOpenChecklist ? <button type="button" onClick={onOpenChecklist} className="mobile-touch-target inline-flex min-h-10 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[10px] font-black text-blue-700 hover:bg-blue-100">Mở checklist</button> : null}
          {onOpenFullDossier ? <button type="button" onClick={onOpenFullDossier} className="mobile-touch-target inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:border-blue-300 hover:text-blue-700">Mở hồ sơ đầy đủ</button> : null}
        </div>
      </header>

      <section className="grid gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[10px] sm:grid-cols-3" aria-label="Soát xét hồ sơ PGD">
        <div><span className="block text-[9px] font-black uppercase tracking-wide text-blue-700">Soát xét hồ sơ</span><strong className="mt-1 block text-slate-800">{missingRequiredCount ? `Còn ${missingRequiredCount} mục bắt buộc` : 'Checklist hiện không thiếu mục bắt buộc'}</strong></div>
        <div><span className="block text-[9px] font-black uppercase tracking-wide text-blue-700">Vai trò hiện tại</span><strong className="mt-1 block break-words text-slate-800">{currentRole}</strong><span className="text-slate-500">{currentUser.username}</span></div>
        <div><span className="block text-[9px] font-black uppercase tracking-wide text-blue-700">Bàn giao kế tiếp</span><strong className="mt-1 block text-slate-800">{NEXT_ROLE[selectedStepId]}</strong><span className="text-slate-500">Tài liệu phải được soạn/xác nhận trước khi hoàn tất việc.</span></div>
      </section>

      {exceptionAllowed ? <section data-testid="pgd-dossier-exception-review" className="rounded-xl border border-rose-100 bg-rose-50/50 p-3" aria-label="Xử lý ngoại lệ hồ sơ PGD">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-[10px] font-black uppercase tracking-wide text-rose-800">Xử lý ngoại lệ</h3><p className="mt-1 text-[10px] leading-4 text-rose-900/80">Dùng khi hồ sơ cần trả bổ sung hoặc tạm dừng. Bắt buộc ghi lý do để người tiếp theo tiếp tục đúng ngữ cảnh.</p></div><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => { setExceptionStatus('REJECTED'); setExceptionFormOpen(true); }} disabled={exceptionBusy} className="mobile-touch-target min-h-10 rounded-lg border border-rose-200 bg-white px-2.5 text-[9px] font-black text-rose-700 disabled:opacity-50">Trả bổ sung</button><button type="button" onClick={() => { setExceptionStatus('ON_HOLD'); setExceptionFormOpen(true); }} disabled={exceptionBusy} className="mobile-touch-target min-h-10 rounded-lg border border-amber-200 bg-white px-2.5 text-[9px] font-black text-amber-800 disabled:opacity-50">Tạm dừng</button></div></div>
        {exceptionFormOpen && <div className="mt-2 rounded-lg border border-rose-200 bg-white p-2.5"><div className="text-[10px] font-black text-slate-800">{exceptionStatus === 'REJECTED' ? 'Trả bổ sung hồ sơ' : 'Tạm dừng hồ sơ'}</div><label className="mt-2 block" htmlFor="pgd-exception-reason"><span className="text-[9px] font-black text-slate-600">Lý do<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><textarea id="pgd-exception-reason" required aria-required="true" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-rose-200 px-2.5 py-2 text-[10px] outline-none focus:border-rose-400" /></label><div className="mt-2 flex flex-wrap justify-end gap-1.5"><button type="button" onClick={() => setExceptionFormOpen(false)} disabled={exceptionBusy} className="min-h-10 rounded-lg border border-slate-200 px-3 text-[9px] font-bold text-slate-600">Hủy</button><button type="button" onClick={submitException} disabled={exceptionBusy || !exceptionReason.trim()} className="min-h-10 rounded-lg bg-rose-600 px-3 text-[9px] font-black text-white disabled:opacity-50">{exceptionBusy ? 'Đang ghi nhận...' : 'Xác nhận nhánh ngoại lệ'}</button></div></div>}
      </section> : null}

      {renderStep()}

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[10px] text-slate-500">Chỉ hoàn tất khi các điều kiện của việc và dữ liệu bắt buộc đã đủ.</p>
        <button type="button" onClick={onCompleteCurrent} disabled={!onCompleteCurrent || completeDisabled} className="mobile-touch-target inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{completeLabel || (selectedStepId === 'intake' ? 'Bắt đầu xử lý' : 'Hoàn tất việc')}</button>
      </footer>
    </section>
  );
}
