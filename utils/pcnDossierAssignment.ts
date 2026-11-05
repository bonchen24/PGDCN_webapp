// Author: Codex
// OS support: Web/Node
// Description: Browser-safe policy for assigning PCN dossier operators

import type { OrganizationManagementRoleCode } from '../types.ts';
import { isOrganizationLeader, isPcnSystemManager, type PcnClientUserRole } from './pcnRbac.ts';

export interface PcnDossierAssignmentUser {
  username: string;
  name?: string;
  active: boolean;
  systemRole?: string;
  role?: string;
  departmentScopes?: string[];
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
  actorManagementRoleCode?: OrganizationManagementRoleCode;
  actorDepartmentRoleCode?: string;
}

/** Viewer accounts stay read-only even if stale leadership metadata is present. */
export function isPcnDossierAssignmentManager(user: PcnClientUserRole | null | undefined): boolean {
  if (!user) return false;
  const roles = [user.systemRole, user.role].map((role) => String(role || '').trim().toLowerCase());
  return !roles.includes('viewer') && isPcnSystemManager(user);
}

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeFieldCodes(values: unknown): string[] {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)));
}

function hasPcnScope(user: PcnDossierAssignmentUser): boolean {
  const scopes = Array.isArray(user.departmentScopes)
    ? user.departmentScopes.map((scope) => String(scope || '').trim().toUpperCase()).filter(Boolean)
    : [];
  return scopes.length === 0 || scopes.includes('PCN');
}

function matchesDossierFields(dossierFieldCodes: string[], userFieldCodes: string[]): boolean {
  return dossierFieldCodes.length === 0 || dossierFieldCodes.every((code) => userFieldCodes.includes(code));
}

/**
 * Return the active PCN personnel that a manager may assign to a dossier.
 * Empty department scopes remain compatible with legacy PCN accounts whose
 * scope predates the explicit PCN/PGD split.
 */
export function getPcnAssignableDossierUsers<T extends PcnDossierAssignmentUser>(
  dossierFieldCodes: string[],
  users: readonly T[],
): T[] {
  const normalizedDossierFields = normalizeFieldCodes(dossierFieldCodes);
  return users
    .filter((user) => {
      const role = String(user.systemRole || user.role || '').trim().toLowerCase();
      return user.active === true
        && role !== 'viewer'
        && hasPcnScope(user)
        && matchesDossierFields(normalizedDossierFields, normalizeFieldCodes(user.fieldCodes));
    })
    .slice()
    .sort((left, right) => String(left.name || left.username).localeCompare(String(right.name || right.username), 'vi')
      || normalizeUsername(left.username).localeCompare(normalizeUsername(right.username)));
}

export interface PcnDossierOperatorAuthorityInput {
  ownerUsername?: string;
  actorUsername?: string;
  actorIsSystemManager?: boolean;
}

/**
 * Staff can only mutate a dossier after it has been claimed by their account.
 * System managers retain the existing manager-level operational authority.
 */
export function getPcnDossierOperatorDenial(input: PcnDossierOperatorAuthorityInput): string | null {
  if (input.actorIsSystemManager === true) return null;
  const ownerUsername = normalizeUsername(input.ownerUsername);
  const actorUsername = normalizeUsername(input.actorUsername);
  if (!ownerUsername) return 'Hồ sơ chưa gán người thực hiện; hãy bấm Nhận hồ sơ để tự nhận.';
  if (!actorUsername || ownerUsername !== actorUsername) return 'Bạn chỉ được thao tác hồ sơ đã gắn tên mình.';
  return null;
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
  if (!hasPcnScope(user)) return `${input.assignmentLabel} phải thuộc phòng PCN.`;
  if (dossierFields.length > 0 && !dossierFields.every((code) => userFields.includes(code))) {
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
  if (systemRole === 'viewer') return 'Tài khoản viewer không được điều phối chủ hồ sơ.';
  if (systemRole === 'admin' || isOrganizationLeader({
    managementRoleCode: input.actorManagementRoleCode,
    departmentRoleCode: input.actorDepartmentRoleCode,
  })) return null;
  if (!nextUsername && currentUsername) return 'Chỉ Admin hoặc Lãnh đạo mới được bỏ chủ hồ sơ đã phân công.';
  if (!currentUsername && actorUsername === nextUsername) return null;

  return currentUsername
    ? 'Chỉ Admin hoặc Lãnh đạo mới được chuyển chủ hồ sơ đã phân công.'
    : 'Nhân viên chỉ được nhận hồ sơ chưa phân công cho chính mình.';
}

// --- End of pcnDossierAssignment.ts ---
