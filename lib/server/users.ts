// Author: Gemini
// OS support: Web/Node
// Description: User management and repository services for Next.js App Router

import type { PcnUserAccount } from '../../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from '../../types.ts';
import {
  toPcnUserAccount,
  normalizePcnSystemRole,
  normalizePcnDepartmentRole,
  getPcnFieldCodes,
  getDepartmentScopes,
  getProfessionalRoleCodes,
  normalizeManagementRole,
  withPcnUserRoleAliases,
  type PcnUserRow,
} from '../../utils/pcnAuth.ts';
import { pool, withPgTransaction } from './db.ts';

export const PCN_SYSTEM_ROLE_VALUES = new Set(['admin', 'staff', 'viewer']);
export const PCN_DEPARTMENT_ROLE_VALUES = new Set([
  'LEADERSHIP',
  'CERTIFICATION_EXPERT',
  'TECHNICAL_REVIEWER',
  'SAMPLE_COORDINATOR',
  'DOCUMENT_CLERK',
  'UNASSIGNED',
]);
export const ORGANIZATION_MANAGEMENT_ROLE_VALUES = new Set([
  'CENTER_DIRECTOR',
  'CENTER_DEPUTY_DIRECTOR',
  'DEPARTMENT_HEAD',
  'DEPARTMENT_DEPUTY',
  'NONE',
]);
export const PROFESSIONAL_ROLE_VALUES = new Set([
  'INSPECTION_EXPERT',
  'CERTIFICATION_EXPERT',
  'DOCUMENT_CLERK',
]);

export const PCN_USER_REFERENCE_SPECS: Array<{ collection: string; fields: string[] }> = [
  { collection: 'certificationDossiers', fields: ['ownerUsername', 'evaluatorUsername', 'reviewerUsername'] },
  { collection: 'approvalSteps', fields: ['assigneeUsername'] },
  { collection: 'pcnSignerDelegations', fields: ['grantorUsername', 'delegateUsername', 'approvedByUsername'] },
  { collection: 'pcnTasks', fields: ['assigneeUsername', 'createdBy'] },
];

export function sanitizePcnUserRow(row: { document_id: string; data: Record<string, any> }) {
  const user = toPcnUserAccount({ documentId: row.document_id, data: row.data || {} });
  return {
    id: row.document_id,
    username: user.username,
    name: user.name,
    role: user.role,
    systemRole: user.systemRole,
    managementRoleCode: user.managementRoleCode,
    professionalRoleCodes: user.professionalRoleCodes || [],
    departmentRoleCode: user.departmentRoleCode,
    fieldCodes: user.fieldCodes,
    active: user.active,
    departmentScopes: user.departmentScopes,
    ...(user.pgdRole ? { pgdRole: user.pgdRole } : {}),
    ...(user.position ? { position: user.position } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.email ? { email: user.email } : {}),
  };
}

export function validatePcnUserInput(input: Record<string, any>, current: Record<string, any> = {}): { data?: Record<string, any>; error?: string } {
  const merged = { ...current, ...input };
  const username = String(merged.username || merged['Tên đăng nhập'] || '').trim().toLowerCase();
  const name = String(merged.name || merged['Họ và Tên'] || '').trim();
  if (!username || !name) return { error: 'Nhân sự PCN phải có tên đăng nhập và họ tên.' };
  const rawSystemRole = input.systemRole ?? input.role;
  const systemRole = normalizePcnSystemRole(merged);
  if (rawSystemRole !== undefined && !PCN_SYSTEM_ROLE_VALUES.has(String(rawSystemRole).trim().toLowerCase())) {
    return { error: 'Role hệ thống PCN không hợp lệ.' };
  }
  const rawDepartmentRole = input.departmentRoleCode;
  const departmentRoleCode = normalizePcnDepartmentRole(merged);
  if (rawDepartmentRole !== undefined && !PCN_DEPARTMENT_ROLE_VALUES.has(String(rawDepartmentRole).trim().toUpperCase())) {
    return { error: 'Role chức vụ phòng ban PCN không hợp lệ.' };
  }
  const rawManagementRole = input.managementRoleCode;
  const managementRoleCode = normalizeManagementRole(merged);
  if (rawManagementRole !== undefined && !ORGANIZATION_MANAGEMENT_ROLE_VALUES.has(String(rawManagementRole).trim().toUpperCase())) {
    return { error: 'Chức danh quản lý Trung tâm/Phòng không hợp lệ.' };
  }
  const rawProfessionalRoles = input.professionalRoleCodes;
  if (rawProfessionalRoles !== undefined && (!Array.isArray(rawProfessionalRoles) || rawProfessionalRoles.some((role: unknown) => !PROFESSIONAL_ROLE_VALUES.has(String(role).trim().toUpperCase())))) {
    return { error: 'Vai trò chuyên môn không hợp lệ.' };
  }
  if (input.fieldCodes !== undefined && (!Array.isArray(input.fieldCodes) || input.fieldCodes.some((code: unknown) => !PCN_CERTIFICATION_FIELD_CODES.includes(String(code).trim().toUpperCase() as typeof PCN_CERTIFICATION_FIELD_CODES[number])))) {
    return { error: 'Phạm vi Lĩnh vực PCN chỉ được gồm QC4 hoặc QC9.' };
  }
  const rawDepartmentScopes = input.departmentScopes ?? current.departmentScopes;
  if (rawDepartmentScopes !== undefined && (!Array.isArray(rawDepartmentScopes) || rawDepartmentScopes.some((scope: unknown) => !['PCN', 'PGD'].includes(String(scope).trim().toUpperCase())))) {
    return { error: 'Phạm vi phòng ban chỉ được gồm PCN hoặc PGD.' };
  }
  const fieldCodes = getPcnFieldCodes(merged);
  const departmentScopes = getDepartmentScopes({ ...merged, ...(rawDepartmentScopes !== undefined ? { departmentScopes: rawDepartmentScopes } : {}) }, systemRole);
  if (['CENTER_DIRECTOR', 'CENTER_DEPUTY_DIRECTOR', 'DEPARTMENT_HEAD', 'DEPARTMENT_DEPUTY'].includes(managementRoleCode)
    && !(departmentScopes.includes('PCN') && departmentScopes.includes('PGD'))) {
    return { error: 'Lãnh đạo Trung tâm/Phòng phải có đồng thời scope PCN và PGD.' };
  }
  const professionalRoleCodes = getProfessionalRoleCodes({
    ...merged,
    ...(rawProfessionalRoles !== undefined ? { professionalRoleCodes: rawProfessionalRoles } : {}),
  });
  const rawPgdRole = String(merged.pgdRole || '').trim().toUpperCase();
  const pgdRole = ['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL', 'PGD_FIELD_INSPECTOR', 'PGD_DOCUMENT_CLERK', 'PGD_VIEWER'].includes(rawPgdRole)
    ? rawPgdRole
    : undefined;
  const phone = String(merged.phone || merged['Số điện thoại'] || '').trim();
  const email = String(merged.email || merged['Email'] || '').trim();
  const data = withPcnUserRoleAliases(
    {
      ...current,
      ...input,
      username,
      name,
      active: merged.active !== false,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      departmentScopes,
      ...(pgdRole ? { pgdRole } : {}),
    },
    systemRole,
    departmentRoleCode,
    fieldCodes,
    managementRoleCode,
    professionalRoleCodes,
  );
  const existingPassword = String(current.password || current['Mật khẩu'] || '').trim();
  delete data.id;
  delete data.password;
  delete data['Mật khẩu'];
  delete data['Số điện thoại'];
  delete data['Email'];
  if (existingPassword) {
    data.password = existingPassword;
    data['Mật khẩu'] = existingPassword;
  }
  return { data };
}

export async function findPcnUserReferences(client: any, username: string): Promise<Array<{ collection: string; documentId: string }>> {
  const references: Array<{ collection: string; documentId: string }> = [];
  for (const spec of PCN_USER_REFERENCE_SPECS) {
    const result = await client.query(
      `SELECT document_id
       FROM app_documents
       WHERE collection_name = $1
         AND EXISTS (
           SELECT 1
           FROM jsonb_each_text(data) AS entry(key, value)
           WHERE entry.key = ANY($2::text[])
             AND lower(trim(entry.value)) = lower(trim($3))
         )
       ORDER BY document_id
       LIMIT 25`,
      [spec.collection, spec.fields, username],
    );
    references.push(...result.rows.map((row: any) => ({
      collection: spec.collection,
      documentId: String(row.document_id),
    })));
  }
  return references;
}

export async function fetchPcnUsers() {
  const result = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'systemUsers'
     ORDER BY lower(COALESCE(data->>'name', data->>'Họ và Tên', document_id)), document_id`,
  );
  return result.rows.map(sanitizePcnUserRow);
}

export async function fetchPcnDepartmentRoles() {
  const result = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnDepartmentRoles'
     ORDER BY COALESCE((data->>'sortOrder')::int, 999), document_id`,
  );
  return result.rows.map((row) => ({
    id: String(row.document_id),
    ...(row.data || {}),
  }));
}
