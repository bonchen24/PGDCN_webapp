// Author: Codex
// OS support: Browser/Node
// Description: Shared organization hierarchy and composable professional-role normalization

import type { OrganizationManagementRoleCode, ProfessionalRoleCode } from '../types.ts';

const MANAGEMENT_ROLES: readonly OrganizationManagementRoleCode[] = [
  'CENTER_DIRECTOR',
  'CENTER_DEPUTY_DIRECTOR',
  'DEPARTMENT_HEAD',
  'DEPARTMENT_DEPUTY',
  'NONE',
];

const PROFESSIONAL_ROLES: readonly ProfessionalRoleCode[] = [
  'INSPECTION_EXPERT',
  'CERTIFICATION_EXPERT',
  'DOCUMENT_CLERK',
];

function isManagementRole(value: unknown): value is OrganizationManagementRoleCode {
  return MANAGEMENT_ROLES.includes(String(value || '').trim().toUpperCase() as OrganizationManagementRoleCode);
}

function isProfessionalRole(value: unknown): value is ProfessionalRoleCode {
  return PROFESSIONAL_ROLES.includes(String(value || '').trim().toUpperCase() as ProfessionalRoleCode);
}

/**
 * Resolve the canonical organization hierarchy. Existing explicit
 * department-role data is accepted as a compatibility bridge; arbitrary
 * position text alone never grants a management role.
 */
export function normalizeManagementRole(data: Record<string, unknown> | undefined): OrganizationManagementRoleCode {
  const canonical = String(data?.managementRoleCode || '').trim().toUpperCase();
  if (isManagementRole(canonical)) return canonical;

  const legacyDepartmentRole = String(data?.departmentRoleCode || '').trim().toUpperCase();
  if (legacyDepartmentRole !== 'LEADERSHIP') return 'NONE';

  const position = String(data?.position || data?.['Chức vụ'] || '').trim().toLocaleLowerCase('vi-VN');
  return position.includes('phó') || position.includes('pho') ? 'DEPARTMENT_DEPUTY' : 'DEPARTMENT_HEAD';
}

/** Normalize the composable professional-role list from explicit fields and legacy role adapters. */
export function getProfessionalRoleCodes(data: Record<string, unknown> | undefined): ProfessionalRoleCode[] {
  if (Array.isArray(data?.professionalRoleCodes)) {
    return Array.from(new Set(data.professionalRoleCodes.filter(isProfessionalRole)));
  }

  const roles = new Set<ProfessionalRoleCode>();
  const legacyDepartmentRole = String(data?.departmentRoleCode || '').trim().toUpperCase();
  const legacyPgdRole = String(data?.pgdRole || '').trim().toUpperCase();
  if (legacyDepartmentRole === 'CERTIFICATION_EXPERT') roles.add('CERTIFICATION_EXPERT');
  if (legacyDepartmentRole === 'DOCUMENT_CLERK') roles.add('DOCUMENT_CLERK');
  if (['PGD_TECHNICAL', 'PGD_FIELD_INSPECTOR'].includes(legacyPgdRole)) roles.add('INSPECTION_EXPERT');
  if (legacyPgdRole === 'PGD_DOCUMENT_CLERK') roles.add('DOCUMENT_CLERK');
  return Array.from(roles);
}

