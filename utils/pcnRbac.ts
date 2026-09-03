// Author: Codex
// OS support: Web/Node
// Description: Server-side PCN collection mutation policy

export type PcnMutationOperation = 'write' | 'delete';
export type PcnMutationRole = 'admin' | 'staff' | 'viewer';

export interface PcnClientUserRole {
  username?: string;
  role?: string;
  systemRole?: string;
  position?: string;
  departmentRoleCode?: string;
  pgdRole?: string;
  departmentScopes?: string[];
}

export function isPcnPersonnelManager(user: PcnClientUserRole | null | undefined): boolean {
  if (!user) return false;
  if (user.systemRole === 'admin' || user.role === 'admin') return true;
  return user.departmentRoleCode === 'LEADERSHIP'
    || user.pgdRole === 'PGD_MANAGER'
    || String(user.position || '').toLocaleLowerCase('vi-VN').includes('quản lý')
    || String(user.position || '').toLocaleLowerCase('vi-VN').includes('trưởng phòng');
}

/**
 * PCN is a department scope, not an implied permission of the shared login.
 * Legacy users without an explicit scope retain the PCN default; once scopes
 * are configured, the list is authoritative for both PCN and PGD.
 */
export function getPcnDepartmentScopeDenial(
  user: PcnClientUserRole | null | undefined,
): string | null {
  if (!user) return 'Phiên PCN không hợp lệ.';
  const scopes = new Set((user.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
  if (scopes.size === 0 || scopes.has('PCN')) return null;
  return 'Tài khoản chưa được cấp scope PCN.';
}

export function getPcnClientMutationDenial(
  user: PcnClientUserRole | null | undefined,
): string | null {
  if (!user) return 'Phiên PCN không hợp lệ.';
  if (user.systemRole === 'viewer' || user.role === 'viewer') {
    return 'Tài khoản viewer PCN chỉ được đọc dữ liệu.';
  }
  return null;
}

export function assertPcnClientMutationAllowed(user: PcnClientUserRole | null | undefined): void {
  const denial = getPcnClientMutationDenial(user);
  if (denial) throw new Error(denial);
}

export function assertPcnClientAdmin(user: PcnClientUserRole | null | undefined): void {
  if (!user || (user.systemRole !== 'admin' && user.role !== 'admin')) {
    throw new Error('Chỉ Admin PCN được thực hiện thao tác này.');
  }
}

export function assertPcnPersonnelAdmin(user: PcnClientUserRole | null | undefined): void {
  if (!isPcnPersonnelManager(user)) {
    throw new Error('Chỉ Admin hoặc Quản lý được quản lý nhân sự PGDCN.');
  }
}

export const PCN_DEDICATED_MUTATION_COLLECTIONS = new Set([
  'certificationProposals',
  'certificationDossiers',
  'dossierDocuments',
  'approvalSteps',
  'issuancePackages',
  'customers',
  'pcnSampleLots',
  'pcnSampleItems',
  'pcnSampleRoutes',
  'pcnSampleFlowEvents',
  'labRequests',
  'returnedResults',
]);

export const PCN_STAFF_MUTABLE_COLLECTIONS = new Set([
  'notifications',
  'activityLogs',
]);

export const PCN_APPEND_ONLY_COLLECTIONS = new Set([
  'activityLogs',
  'pcnSampleFlowEvents',
]);

export const PCN_ADMIN_ONLY_COLLECTIONS = new Set([
  'pcnCertificationFields',
  'pcnDocumentRequirements',
  'pcnTemplateDefinitions',
  'pcnOfficialGeneratedDocuments',
  'pcnGeneratedDocuments',
  'systemConfig',
  'systemUsers',
  'pcnDepartmentRoles',
  'pcnSignerDelegations',
  'pcnQualityDocuments',
  'dossierAttachments',
]);

export function getPcnCollectionMutationDenial(
  collectionName: string,
  role: string | undefined,
  operation: PcnMutationOperation,
): string | null {
  const normalizedRole = String(role || '').trim().toLowerCase() as PcnMutationRole;
  if (!['admin', 'staff', 'viewer'].includes(normalizedRole)) {
    return 'Phiên PCN không có role hợp lệ để thay đổi dữ liệu.';
  }
  if (normalizedRole === 'viewer') {
    return 'Tài khoản viewer PCN chỉ được đọc dữ liệu.';
  }
  if (PCN_DEDICATED_MUTATION_COLLECTIONS.has(collectionName)) {
    return operation === 'delete'
      ? 'Collection PCN này chỉ được thay đổi qua endpoint chuyên biệt; sự kiện append-only không được xóa.'
      : 'Collection PCN này chỉ được thay đổi qua endpoint chuyên biệt.';
  }
  if (PCN_ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
    return 'Collection PCN này chỉ được thay đổi qua endpoint chuyên biệt.';
  }
  if (operation === 'delete' && PCN_APPEND_ONLY_COLLECTIONS.has(collectionName)) {
    return 'Collection PCN này là append-only và không được xóa.';
  }
  if (normalizedRole === 'admin') return null;
  if (!PCN_STAFF_MUTABLE_COLLECTIONS.has(collectionName)) {
    return 'Nhân sự staff PCN không được thay đổi collection này.';
  }
  return null;
}

// --- End of pcnRbac.ts ---
