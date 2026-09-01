// Author: Codex
// OS support: Web/Node
// Description: Deterministic mapping from an approved PCN roster to user-account input

import type { PcnSystemRole } from '../types.ts';
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
  const matches = clean(fieldAssignment).toUpperCase().match(/\bQC(?:4|9|20)\b/g) || [];
  const allowed = new Set<string>(PCN_CERTIFICATION_FIELD_CODES);
  return [...new Set(matches.filter((code) => allowed.has(code)))];
}

export function mapPcnRosterRow(row: PcnRosterRow): PcnUserInput {
  const name = clean(row.name);
  const position = clean(row.position);
  const phone = clean(row.phone);
  const email = clean(row.email);
  if (!name) throw new Error(`Dòng roster ${row.rowNumber} thiếu họ và tên.`);

  return {
    username: normalizePcnRosterUsername(name),
    name,
    systemRole: mapSystemRole(row.accountType || ''),
    departmentRoleCode: normalizePcnDepartmentRole({ position }),
    fieldCodes: extractFieldCodes(row.fieldAssignment || ''),
    active: true,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(position ? { position } : {}),
  };
}
