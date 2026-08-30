// Author: Codex
// OS support: Web/Node
// Description: Browser-safe policy for assigning PCN dossier operators

export interface PcnDossierAssignmentUser {
  username: string;
  active: boolean;
  systemRole?: string;
  role?: string;
  fieldCodes?: string[];
}

export interface PcnDossierAssignmentInput {
  assignmentLabel: string;
  currentUsername?: string;
  nextUsername?: string;
  dossierFieldCodes: string[];
  users: PcnDossierAssignmentUser[];
}

export interface PcnOwnerAssignmentAuthorityInput {
  currentUsername?: string;
  nextUsername?: string;
  actorUsername?: string;
  actorSystemRole?: string;
  actorDepartmentRoleCode?: string;
}

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeFieldCodes(values: unknown): string[] {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)));
}

/**
 * Return a user-facing denial when a dossier assignment would introduce an
 * invalid operator. An unchanged legacy value is deliberately allowed so an
 * operator can open the form and clear or replace it during data cleanup.
 */
export function getPcnDossierAssignmentDenial(input: PcnDossierAssignmentInput): string | null {
  const currentUsername = normalizeUsername(input.currentUsername);
  const nextUsername = normalizeUsername(input.nextUsername);
  if (!nextUsername || nextUsername === currentUsername) return null;

  const user = input.users.find((candidate) => normalizeUsername(candidate.username) === nextUsername);
  if (!user) return `${input.assignmentLabel} phải là tài khoản PCN đang hoạt động trong danh sách.`;
  if (user.active !== true) return `${input.assignmentLabel} không thể giao cho tài khoản PCN đã ngừng hoạt động.`;

  const role = String(user.systemRole || user.role || '').trim().toLowerCase();
  if (role === 'viewer') return `${input.assignmentLabel} không thể giao cho tài khoản viewer.`;

  const dossierFields = normalizeFieldCodes(input.dossierFieldCodes);
  const userFields = normalizeFieldCodes(user.fieldCodes);
  if (dossierFields.length > 0 && !userFields.some((code) => dossierFields.includes(code))) {
    return `${input.assignmentLabel} phải thuộc phạm vi Lĩnh vực của hồ sơ.`;
  }
  return null;
}

/**
 * Keep transfer authority separate from target-account validation. A staff
 * member may claim an unassigned dossier for their own account, while an
 * occupied dossier can only be reassigned by Admin or Leadership.
 */
export function getPcnOwnerAssignmentAuthorityDenial(input: PcnOwnerAssignmentAuthorityInput): string | null {
  const currentUsername = normalizeUsername(input.currentUsername);
  const nextUsername = normalizeUsername(input.nextUsername);
  if (nextUsername === currentUsername) return null;

  const actorUsername = normalizeUsername(input.actorUsername);
  const systemRole = String(input.actorSystemRole || '').trim().toLowerCase();
  const departmentRoleCode = String(input.actorDepartmentRoleCode || '').trim().toUpperCase();
  if (systemRole === 'viewer') return 'Tài khoản viewer không được điều phối chủ hồ sơ.';
  if (systemRole === 'admin' || departmentRoleCode === 'LEADERSHIP') return null;
  if (!nextUsername && currentUsername) return 'Chỉ Admin hoặc Lãnh đạo mới được bỏ chủ hồ sơ đã phân công.';
  if (!currentUsername && actorUsername === nextUsername) return null;

  return currentUsername
    ? 'Chỉ Admin hoặc Lãnh đạo mới được chuyển chủ hồ sơ đã phân công.'
    : 'Nhân viên chỉ được nhận hồ sơ chưa phân công cho chính mình.';
}

// --- End of pcnDossierAssignment.ts ---
