export type PgdDossierCapability =
  | 'INPUT_REVIEW'
  | 'TEAM_LEAD'
  | 'ASSESSOR'
  | 'TECHNICAL_REVIEW'
  | 'LEADERSHIP_APPROVAL'
  | 'OFFICE_ISSUANCE'
  | 'ARCHIVE';

export interface PgdCapabilityUser {
  username: string;
  active?: boolean;
  systemRole?: string;
  role?: string;
  managementRoleCode?: string;
  departmentScopes?: readonly string[];
  pgdRole?: string;
  professionalRoleCodes?: readonly string[];
}

export interface PgdCapabilityAssignment {
  username: string;
  capability: PgdDossierCapability;
}

export interface PgdCapabilityAssignmentIssue extends PgdCapabilityAssignment {
  message: string;
}

const MANAGER_ROLES = new Set(['CENTER_DIRECTOR', 'CENTER_DEPUTY_DIRECTOR', 'DEPARTMENT_HEAD', 'DEPARTMENT_DEPUTY']);

function normalize(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function getPgdUserCapabilities(user: PgdCapabilityUser): PgdDossierCapability[] {
  if (user.active === false || !(user.departmentScopes || []).some((scope) => normalize(scope) === 'PGD')) return [];
  const pgdRole = normalize(user.pgdRole);
  const systemRole = normalize(user.systemRole || user.role);
  const managementRole = normalize(user.managementRoleCode);
  const professionalRoles = new Set((user.professionalRoleCodes || []).map(normalize));
  const isManager = systemRole === 'ADMIN' || ['PGD_ADMIN', 'PGD_MANAGER'].includes(pgdRole) || MANAGER_ROLES.has(managementRole);
  const capabilities: PgdDossierCapability[] = [];
  if (isManager) capabilities.push('INPUT_REVIEW', 'LEADERSHIP_APPROVAL');
  if (pgdRole === 'PGD_FIELD_INSPECTOR' || professionalRoles.has('INSPECTION_EXPERT')) capabilities.push('TEAM_LEAD', 'ASSESSOR');
  if (pgdRole === 'PGD_TECHNICAL') capabilities.push('TECHNICAL_REVIEW');
  if (pgdRole === 'PGD_DOCUMENT_CLERK' || professionalRoles.has('DOCUMENT_CLERK')) capabilities.push('OFFICE_ISSUANCE', 'ARCHIVE');
  return Array.from(new Set(capabilities));
}

export function validatePgdCapabilityAssignments(
  assignments: readonly PgdCapabilityAssignment[],
  users: readonly PgdCapabilityUser[],
): PgdCapabilityAssignmentIssue[] {
  const byUsername = new Map(users.map((user) => [normalize(user.username), user]));
  const seen = new Set<string>();
  const issues: PgdCapabilityAssignmentIssue[] = [];
  for (const assignment of assignments) {
    const username = String(assignment.username || '').trim();
    const key = `${normalize(username)}:${assignment.capability}`;
    if (!username || seen.has(key)) continue;
    seen.add(key);
    const user = byUsername.get(normalize(username));
    if (!user || !getPgdUserCapabilities(user).includes(assignment.capability)) {
      issues.push({ ...assignment, username, message: `Tài khoản ${username || '(trống)'} không đủ năng lực hoặc không hoạt động trong phạm vi PGD để nhận quyền ${assignment.capability}.` });
    }
  }
  return issues;
}

export function hasPgdDossierCapability(
  assignment: { roleAssignments?: readonly PgdCapabilityAssignment[] } | undefined,
  username: string,
  capability: PgdDossierCapability,
): boolean {
  const normalizedUsername = normalize(username);
  return Boolean(assignment?.roleAssignments?.some((item) => normalize(item.username) === normalizedUsername && item.capability === capability));
}
