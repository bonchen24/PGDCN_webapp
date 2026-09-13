import type {
  PcnCertificationFieldCode,
  PcnDepartmentRoleCode,
  PcnSystemRole,
  PcnUserAccount,
  DepartmentScope,
  PgdDepartmentRoleCode,
  OrganizationManagementRoleCode,
  ProfessionalRoleCode,
} from '../types.ts';

export interface PcnDepartmentRole {
  id: string;
  code: PcnDepartmentRoleCode;
  name: string;
  active: boolean;
  sortOrder: number;
}

export interface PcnUserInput {
  username: string;
  name: string;
  systemRole: PcnSystemRole;
  managementRoleCode?: OrganizationManagementRoleCode;
  professionalRoleCodes?: ProfessionalRoleCode[];
  departmentRoleCode: PcnDepartmentRoleCode;
  fieldCodes: PcnCertificationFieldCode[];
  active: boolean;
  position?: string;
  phone?: string;
  email?: string;
  departmentScopes?: DepartmentScope[];
  pgdRole?: PgdDepartmentRoleCode;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN user API trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return parseResponse(response);
}

export async function fetchPcnUsers(): Promise<PcnUserAccount[]> {
  const payload = await request('/api/pcn/users');
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchPcnDepartmentRoles(): Promise<PcnDepartmentRole[]> {
  const payload = await request('/api/pcn/department-roles');
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function createPcnUser(input: PcnUserInput): Promise<PcnUserAccount> {
  const payload = await request('/api/pcn/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.user as PcnUserAccount;
}

export async function updatePcnUser(username: string, input: Omit<PcnUserInput, 'username'>): Promise<PcnUserAccount> {
  const payload = await request(`/api/pcn/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return payload.user as PcnUserAccount;
}

export async function deletePcnUser(username: string): Promise<void> {
  await request(`/api/pcn/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

export async function resetPcnUserPassword(username: string, password: string): Promise<void> {
  await request(`/api/pcn/users/${encodeURIComponent(username)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
