import type { PcnApprovalDecision, PcnApprovalStep, PcnDepartmentRoleCode, PcnUserAccount } from '../types.ts';
import { isOrganizationLeader } from './pcnRbac.ts';

export const PCN_APPROVAL_ROLES = ['Lãnh đạo'] as const;
export const PCN_LEADERSHIP_APPROVAL_ROLE = PCN_APPROVAL_ROLES[0];

const APPROVAL_ROLE_DEPARTMENT_CODES: Record<string, readonly PcnDepartmentRoleCode[]> = {
  [PCN_LEADERSHIP_APPROVAL_ROLE]: ['LEADERSHIP'],
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
  actor: Pick<PcnUserAccount, 'username' | 'active' | 'systemRole' | 'role' | 'departmentRoleCode' | 'managementRoleCode' | 'fieldCodes'> | undefined,
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
  if (!isOrganizationLeader(actor) && !allowedDepartmentCodes.includes(actor.departmentRoleCode)) return 'Chức vụ PCN hiện tại không phù hợp với bước phê duyệt này.';

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
  return PCN_APPROVAL_ROLES.map((role) => ({
    id: `approval-leadership-${normalizedDossierId}`,
    dossierId: normalizedDossierId,
    sequence: 1,
    role,
    ...(assigneeUsernames[0] ? { assigneeUsername: assigneeUsernames[0] } : {}),
    status: 'PENDING' as const,
    createdAt: now,
  }));
}

/** Only the new single leadership decision is effective for the current flow. */
export function getPcnEffectiveApprovalSteps(steps: PcnApprovalStep[]): PcnApprovalStep[] {
  return [...steps]
    .filter((step) => step.role === PCN_LEADERSHIP_APPROVAL_ROLE)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}

export function getNextPendingPcnApprovalStep(steps: PcnApprovalStep[]): PcnApprovalStep | undefined {
  return getPcnEffectiveApprovalSteps(steps)
    .filter((step) => step.status === 'PENDING')
    [0];
}

export function isPcnApprovalComplete(steps: PcnApprovalStep[]): boolean {
  const effectiveSteps = getPcnEffectiveApprovalSteps(steps);
  return effectiveSteps.length > 0 && effectiveSteps.every((step) => step.status === 'APPROVED');
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
  if (current.role !== PCN_LEADERSHIP_APPROVAL_ROLE) {
    throw new Error('Chỉ quyết định phê duyệt của Lãnh đạo là bước hiệu lực.');
  }
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
