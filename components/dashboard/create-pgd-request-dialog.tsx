'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { PgdIntakeForm } from '@/components/PgdWorkspace';
import PgdcnWindowsWorkflowModal from '@/components/PgdcnWindowsWorkflowModal';

type CreatePgdRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePgdRequestDialog({ open, onOpenChange }: CreatePgdRequestDialogProps) {
  const router = useRouter();
  const pgd = usePgdStore();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const [saving, setSaving] = useState(false);
  const [recoveryRequestId, setRecoveryRequestId] = useState<string>();
  const canMutate = Boolean(currentUser && currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer');
  const closeOrOpenCreatedRequest = () => {
    const requestIdToOpen = recoveryRequestId;
    setRecoveryRequestId(undefined);
    onOpenChange(false);
    if (requestIdToOpen) router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(requestIdToOpen)}`);
  };

  return <PgdcnWindowsWorkflowModal
    open={open}
    title="Tạo PYC và bắt đầu bộ hồ sơ"
    eyebrow="PGD · Hồ sơ PYC mới"
    description="Nhập thông tin tiếp nhận, lập bảng mẫu và có thể đính kèm tài liệu B1 ngay hoặc bổ sung sau."
    contextLabel="Giám định · PGD"
    accent="blue"
    testId="pgd-dashboard-intake-modal"
    bodyTestId="pgd-dashboard-intake-body"
    footerTestId="pgd-dashboard-intake-footer"
    titleId="pgd-dashboard-intake-title"
    busy={saving}
    onClose={() => { if (!saving) closeOrOpenCreatedRequest(); }}
    onMinimize={() => undefined}
    onRestore={() => undefined}
    footer={<div className="flex w-full flex-wrap justify-end gap-2"><button type="button" onClick={closeOrOpenCreatedRequest} disabled={saving} className="min-h-11 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 disabled:opacity-50">{recoveryRequestId ? 'Bổ sung sau' : 'Hủy'}</button><button type="submit" form="pgd-dashboard-intake-form" disabled={!canMutate || saving} className="min-h-11 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu PYC / tệp…' : recoveryRequestId ? 'Thử lại tệp chưa tải' : 'Tạo PYC & mở hồ sơ'}</button></div>}
  >
    {currentUser && <PgdIntakeForm
      catalog={pgd.catalog}
      workflowTemplates={pgd.workflowTemplates}
      customers={pgd.customers}
      currentUser={currentUser}
      canMutate={canMutate}
      formId="pgd-dashboard-intake-form"
      onSavingChange={setSaving}
      onUploadRecoveryChange={(hasPending, requestId) => setRecoveryRequestId(hasPending ? requestId : undefined)}
      onCreated={(requestId) => {
        onOpenChange(false);
        router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(requestId)}`);
      }}
    />}
  </PgdcnWindowsWorkflowModal>;
}
