// Author: Codex
// OS support: Web/Node
// Description: Deterministic mapping from an approved PCN roster to user-account input

import type { DepartmentScope, OrganizationManagementRoleCode, PcnSystemRole, ProfessionalRoleCode } from '../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from '../types.ts';
import { normalizePcnDepartmentRole } from './pcnAuth.ts';
import type { PcnUserInput } from './pcnUserApi.ts';

export interface PcnRosterRow {
  rowNumber: number;
  name: string;
  phone?: string;
  email?: string;
  accountType?: string;
  position?: string;
  fieldAssignment?: string;
}
function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizePcnRosterUsername(name: string): string {
  return clean(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function mapSystemRole(accountType: string): PcnSystemRole {
  const normalized = clean(accountType).toLowerCase();
  if (normalized === 'admin' || normalized.includes('quản trị') || normalized.includes('quan tri')) return 'admin';
  if (normalized === 'viewer' || normalized.includes('chỉ xem') || normalized.includes('chi xem')) return 'viewer';
  return 'staff';
}

function extractFieldCodes(fieldAssignment: string): string[] {
  const matches = clean(fieldAssignment).toUpperCase().match(/\bQC(?:4|9)\b/g) || [];
  const allowed = new Set<string>(PCN_CERTIFICATION_FIELD_CODES);
  return [...new Set(matches.filter((code) => allowed.has(code)))];
}

export function mapPcnRosterRow(row: PcnRosterRow): PcnUserInput {
  const name = clean(row.name);
  const position = clean(row.position);
  const phone = clean(row.phone);
  const email = clean(row.email);
  if (!name) throw new Error(`Dòng roster ${row.rowNumber} thiếu họ và tên.`);

  const normalizedPosition = position.toLocaleLowerCase('vi-VN');
  const normalizedFieldAssignment = clean(row.fieldAssignment).toLocaleLowerCase('vi-VN');
  const managementRoleCode: OrganizationManagementRoleCode = normalizedPosition.includes('phó giám đốc trung tâm') || normalizedPosition.includes('pho giam doc trung tam')
    ? 'CENTER_DEPUTY_DIRECTOR'
    : normalizedPosition.includes('giám đốc trung tâm') || normalizedPosition.includes('giam doc trung tam')
      ? 'CENTER_DIRECTOR'
      : normalizedPosition.includes('phó trưởng phòng') || normalizedPosition.includes('pho truong phong') || normalizedPosition.includes('phó phòng') || normalizedPosition.includes('pho phong')
        ? 'DEPARTMENT_DEPUTY'
        : normalizedPosition.includes('trưởng phòng') || normalizedPosition.includes('truong phong')
          ? 'DEPARTMENT_HEAD'
          : 'NONE';
  const professionalRoleCodes = Array.from(new Set<ProfessionalRoleCode>([
    ...(normalizedPosition.includes('giám định') || normalizedPosition.includes('giam dinh') ? ['INSPECTION_EXPERT' as const] : []),
    ...(normalizedPosition.includes('chứng nhận') || normalizedPosition.includes('chung nhan') ? ['CERTIFICATION_EXPERT' as const] : []),
    ...(normalizedPosition.includes('văn thư') || normalizedPosition.includes('van thu') || normalizedPosition.includes('hồ sơ') || normalizedPosition.includes('ho so') ? ['DOCUMENT_CLERK' as const] : []),
  ]));
  const departmentScopes: DepartmentScope[] = managementRoleCode !== 'NONE'
    ? ['PCN', 'PGD']
    : [
      ...(normalizedFieldAssignment.includes('pcn') ? ['PCN' as const] : []),
      ...(normalizedFieldAssignment.includes('pgd') ? ['PGD' as const] : []),
    ];

  return {
    username: normalizePcnRosterUsername(name),
    name,
    systemRole: mapSystemRole(row.accountType || ''),
    managementRoleCode,
    professionalRoleCodes,
    departmentRoleCode: normalizePcnDepartmentRole({ position }),
    fieldCodes: extractFieldCodes(row.fieldAssignment || ''),
    active: true,
    ...(departmentScopes.length > 0 ? { departmentScopes } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(position ? { position } : {}),
  };
}
