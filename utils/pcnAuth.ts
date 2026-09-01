import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  PcnCertificationFieldCode,
  PcnDepartmentRoleCode,
  PcnSystemRole,
  PcnUserAccount,
  UserAccount,
} from '../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from '../types.ts';
import { getCanonicalUserKey, getUserFullName, normalizeUserKey } from './userIdentity.ts';

export interface PcnUserRow {
  documentId: string;
  data: Record<string, unknown>;
}

export interface PcnSessionClaims {
  user: PcnUserAccount;
  expiresAt: number;
}

const PCN_SYSTEM_ROLES: PcnSystemRole[] = ['admin', 'staff', 'viewer'];
const PCN_DEPARTMENT_ROLES: PcnDepartmentRoleCode[] = [
  'LEADERSHIP',
  'CERTIFICATION_EXPERT',
  'TECHNICAL_REVIEWER',
  'SAMPLE_COORDINATOR',
  'DOCUMENT_CLERK',
  'UNASSIGNED',
];

export const PCN_INITIAL_EXCLUDED_USERNAMES = new Set(['nguyenthivananh']);

function isPcnSystemRole(value: unknown): value is PcnSystemRole {
  return PCN_SYSTEM_ROLES.includes(String(value || '').trim().toLowerCase() as PcnSystemRole);
}

function isPcnDepartmentRole(value: unknown): value is PcnDepartmentRoleCode {
  return PCN_DEPARTMENT_ROLES.includes(String(value || '').trim().toUpperCase() as PcnDepartmentRoleCode);
}

export function normalizePcnSystemRole(data: Record<string, unknown> | undefined, fallback: PcnSystemRole = 'staff'): PcnSystemRole {
  const canonical = String(data?.systemRole || '').trim().toLowerCase();
  if (isPcnSystemRole(canonical)) return canonical;
  const legacy = String(data?.role || data?.['Loại tài khoản'] || data?.['Phân quyền'] || data?.['Vai trò'] || '').trim().toLowerCase();
  if (legacy.includes('admin') || legacy.includes('lãnh đạo') || legacy.includes('quản lý')) return 'admin';
  if (legacy.includes('viewer') || legacy.includes('quan sát') || legacy.includes('quan sat')) return 'viewer';
  if (legacy.includes('guest') || legacy.includes('khách') || legacy.includes('khach') || legacy.includes('tester') || legacy.includes('staff') || legacy.includes('nhân viên') || legacy.includes('user')) return 'staff';
  return fallback;
}

export function normalizePcnDepartmentRole(data: Record<string, unknown> | undefined): PcnDepartmentRoleCode {
  const canonical = String(data?.departmentRoleCode || '').trim().toUpperCase();
  if (isPcnDepartmentRole(canonical)) return canonical;
  const position = String(data?.departmentRole || data?.position || data?.['Chức vụ'] || '').trim().toLowerCase();
  if (position.includes('trưởng phòng') || position.includes('lãnh đạo') || position.includes('phó trưởng')) return 'LEADERSHIP';
  if (position.includes('soát xét') || position.includes('thẩm xét') || position.includes('review')) return 'TECHNICAL_REVIEWER';
  if (position.includes('văn thư') || position.includes('hồ sơ')) return 'DOCUMENT_CLERK';
  if (position.includes('mẫu') || position.includes('điều phối') || position.includes('tiếp nhận')) return 'SAMPLE_COORDINATOR';
  if (position.includes('chuyên gia') || position.includes('đánh giá') || position.includes('chứng nhận')) return 'CERTIFICATION_EXPERT';
  return 'UNASSIGNED';
}

export function getPcnFieldCodes(data: Record<string, unknown> | undefined): PcnCertificationFieldCode[] {
  const values = Array.isArray(data?.fieldCodes) ? data.fieldCodes : [];
  return Array.from(new Set(values
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value): value is PcnCertificationFieldCode => PCN_CERTIFICATION_FIELD_CODES.includes(value as typeof PCN_CERTIFICATION_FIELD_CODES[number]))));
}

export function withPcnUserRoleAliases(
  data: Record<string, unknown>,
  systemRole: PcnSystemRole,
  departmentRoleCode: PcnDepartmentRoleCode,
  fieldCodes: PcnCertificationFieldCode[],
): Record<string, unknown> {
  return {
    ...data,
    role: systemRole,
    systemRole,
    'Loại tài khoản': systemRole,
    'Phân quyền': systemRole,
    'Vai trò': systemRole,
    departmentRoleCode,
    fieldCodes: Array.from(new Set(fieldCodes)),
    active: data.active !== false,
  };
}

function stringValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function getPcnUserLookupKeys(row: PcnUserRow): string[] {
  const rawValues = [
    row.documentId,
    row.data.username,
    row.data['Tên đăng nhập'],
    row.data.email,
    row.data['Email'],
  ];
  return Array.from(new Set(rawValues.flatMap((value) => {
    const raw = stringValue(value);
    const normalized = normalizeUserKey(raw);
    return [raw.toLowerCase(), normalized].filter(Boolean);
  })));
}

export function findPcnUser(rows: PcnUserRow[], inputUsername: string): PcnUserRow | null {
  const input = normalizeUserKey(inputUsername);
  if (!input) return null;
  return rows.find((row) => getPcnUserLookupKeys(row).includes(input)) || null;
}

export function verifyPcnPassword(row: PcnUserRow, inputPassword: string, customPassword = ''): boolean {
  const password = stringValue(inputPassword);
  const configuredPassword = stringValue(row.data.password || row.data['Mật khẩu']);
  const configuredCustomPassword = stringValue(customPassword);
  const validPassword = configuredCustomPassword && configuredCustomPassword !== 'Abc123456'
    ? configuredCustomPassword
    : configuredPassword || 'Abc123456';
  return password === validPassword || (password === 'Abc123456' && !configuredPassword && !configuredCustomPassword);
}

export function toPcnUserAccount(row: PcnUserRow): PcnUserAccount {
  const userData: Record<string, unknown> = { ...row.data, id: row.documentId };
  const systemRole = normalizePcnSystemRole(userData);
  const phone = stringValue(userData.phone || userData['Số điện thoại']);
  const email = stringValue(userData.email || userData['Email']);
  return {
    username: getCanonicalUserKey(row.documentId, userData),
    name: getUserFullName(userData),
    role: systemRole,
    systemRole,
    departmentRoleCode: normalizePcnDepartmentRole(userData),
    fieldCodes: getPcnFieldCodes(userData),
    active: userData.active !== false && userData.isActive !== false,
    position: stringValue(userData.position || userData['Chức vụ']),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

export function mapDdtAccountToPcnUser(account: UserAccount): Record<string, unknown> {
  const username = String(account.username || '').trim().toLowerCase();
  const systemRole: PcnSystemRole = username === 'luongxuanhung'
    ? 'admin'
    : account.role === 'admin'
      ? 'admin'
      : account.role === 'viewer'
        ? 'viewer'
        : 'staff';
  const departmentRoleCode: PcnDepartmentRoleCode = username === 'luongxuanhung' || String(account.position || '').toLowerCase().includes('trưởng phòng')
    ? 'LEADERSHIP'
    : 'UNASSIGNED';
  return {
    id: username,
    username,
    name: String(account.name || '').trim(),
    role: systemRole,
    systemRole,
    departmentRoleCode,
    fieldCodes: Array.isArray(account.fieldCodes) ? account.fieldCodes : [],
    active: true,
    source: 'PCN_INITIAL_IMPORT',
  };
}

export function buildInitialPcnUserSeeds(accounts: UserAccount[]): Array<Record<string, unknown>> {
  return accounts
    .filter((account) => !PCN_INITIAL_EXCLUDED_USERNAMES.has(normalizeUserKey(account.username)))
    .filter((account) => account.username === 'luongxuanhung' || account.role === 'guest')
    .map(mapDdtAccountToPcnUser);
}

export function createPcnSessionToken(
  user: PcnUserAccount,
  secret: string,
  now = Date.now(),
  ttlSeconds = 8 * 60 * 60,
): string {
  const payload = Buffer.from(JSON.stringify({
    user,
    expiresAt: now + ttlSeconds * 1000,
  }), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPcnSessionToken(token: string, secret: string, now = Date.now()): PcnUserAccount | null {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<PcnSessionClaims>;
    const user = claims.user;
    const expiresAt = Number(claims.expiresAt || 0);
    if (!user || !stringValue(user.username) || !stringValue(user.name) || !stringValue(user.role) || expiresAt <= now) return null;
    const systemRole = normalizePcnSystemRole(user as unknown as Record<string, unknown>);
    return {
      username: stringValue(user.username),
      name: stringValue(user.name),
      role: systemRole,
      systemRole,
      departmentRoleCode: normalizePcnDepartmentRole(user as unknown as Record<string, unknown>),
      fieldCodes: getPcnFieldCodes(user as unknown as Record<string, unknown>),
      active: user.active !== false,
      ...(stringValue(user.position) ? { position: stringValue(user.position) } : {}),
    };
  } catch {
    return null;
  }
}

// --- End of pcnAuth.ts ---
