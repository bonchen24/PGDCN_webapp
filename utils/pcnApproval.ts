import type { PcnApprovalDecision, PcnApprovalStep, PcnDepartmentRoleCode, PcnUserAccount } from '../types.ts';

export const PCN_APPROVAL_ROLES = [
  'Điều phối / Lãnh đạo',
  'Chuyên gia đánh giá / kỹ thuật',
  'Chuyên gia thẩm xét',
  'Người có thẩm quyền cuối',
] as const;

const APPROVAL_ROLE_DEPARTMENT_CODES: Record<string, readonly PcnDepartmentRoleCode[]> = {
  'Điều phối / Lãnh đạo': ['SAMPLE_COORDINATOR', 'LEADERSHIP'],
  'Chuyên gia đánh giá / kỹ thuật': ['CERTIFICATION_EXPERT', 'TECHNICAL_REVIEWER'],
  'Chuyên gia thẩm xét': ['TECHNICAL_REVIEWER'],
  'Người có thẩm quyền cuối': ['LEADERSHIP'],
};

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeFieldCodes(values: unknown): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
}

/**
 * Server and UI policy for who may act on the currently pending approval step.
 * The server must call this with a freshly resolved systemUsers record.
 */
export function getPcnApprovalDecisionDenial(
  step: Pick<PcnApprovalStep, 'role' | 'assigneeUsername'>,
  actor: Pick<PcnUserAccount, 'username' | 'active' | 'systemRole' | 'role' | 'departmentRoleCode' | 'fieldCodes'> | undefined,
  dossierFieldCodes: string[] = [],
): string | null {
  if (!actor) return 'Không tìm thấy tài khoản PCN đang đăng nhập trong danh sách nhân sự.';
  if (actor.active !== true) return 'Tài khoản PCN đã ngừng hoạt động không được phê duyệt hồ sơ.';
  if (actor.systemRole === 'viewer' || actor.role === 'viewer') return 'Tài khoản viewer PCN chỉ được đọc dữ liệu.';

  const actorUsername = normalizeUsername(actor.username);
  const assignedUsername = normalizeUsername(step.assigneeUsername);
  if (assignedUsername && assignedUsername !== actorUsername) return 'Bước phê duyệt đã được giao đích danh cho tài khoản PCN khác.';

  const allowedDepartmentCodes = APPROVAL_ROLE_DEPARTMENT_CODES[step.role];
  if (!allowedDepartmentCodes) return 'Vai trò bước phê duyệt chưa có quy tắc chức vụ được xác nhận.';
  if (!allowedDepartmentCodes.includes(actor.departmentRoleCode)) return 'Chức vụ PCN hiện tại không phù hợp với bước phê duyệt này.';

  const requiredFields = normalizeFieldCodes(dossierFieldCodes);
  const actorFields = normalizeFieldCodes(actor.fieldCodes);
  if (requiredFields.length > 0 && !actorFields.some((code) => requiredFields.includes(code))) {
    return 'Tài khoản phê duyệt không thuộc phạm vi Lĩnh vực của hồ sơ.';
  }
  return null;
}

export function buildPcnApprovalSteps(
  dossierId: string,
  now: string = new Date().toISOString(),
  assigneeUsernames: Array<string | undefined> = [],
): PcnApprovalStep[] {
  const normalizedDossierId = String(dossierId || '').trim();
  if (!normalizedDossierId) throw new Error('Chuỗi phê duyệt phải gắn với hồ sơ PCN');
  return PCN_APPROVAL_ROLES.map((role, index) => ({
    id: `approval-${normalizedDossierId}-${index + 1}`,
    dossierId: normalizedDossierId,
    sequence: index + 1,
    role,
    ...(assigneeUsernames[index] ? { assigneeUsername: assigneeUsernames[index] } : {}),
    status: 'PENDING' as const,
    createdAt: now,
  }));
}

export function getNextPendingPcnApprovalStep(steps: PcnApprovalStep[]): PcnApprovalStep | undefined {
  return [...steps]
    .filter((step) => step.status === 'PENDING')
    .sort((left, right) => left.sequence - right.sequence)[0];
}

export function isPcnApprovalComplete(steps: PcnApprovalStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.status === 'APPROVED');
}

export function applyPcnApprovalDecision(
  steps: PcnApprovalStep[],
  stepId: string,
  decision: PcnApprovalDecision,
  comment?: string,
  now: string = new Date().toISOString(),
): PcnApprovalStep[] {
  const current = steps.find((step) => step.id === stepId);
  if (!current) throw new Error('Không tìm thấy bước phê duyệt PCN');
  const nextPending = getNextPendingPcnApprovalStep(steps);
  if (!nextPending || nextPending.id !== current.id) {
    throw new Error('Các bước phê duyệt PCN phải thực hiện theo tuần tự');
  }
  const normalizedComment = String(comment || '').trim();
  if (decision === 'RETURN' && !normalizedComment) {
    throw new Error('Khi trả hồ sơ phải ghi rõ lý do');
  }
  return steps.map((step) => step.id === stepId
    ? {
        ...step,
        status: decision === 'APPROVE' ? 'APPROVED' : 'RETURNED',
        ...(normalizedComment ? { comment: normalizedComment } : {}),
        actedAt: now,
      }
    : step);
}

export function reopenPcnApprovalFromStep(steps: PcnApprovalStep[], sequence: number): PcnApprovalStep[] {
  return steps.map((step) => step.sequence >= sequence
    ? { ...step, status: 'PENDING', actedAt: undefined }
    : step);
}

// --- End of pcnApproval.ts ---
