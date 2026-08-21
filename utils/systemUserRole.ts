// Author: Gemini
// OS support: Web/Node
// Description: Canonical role resolution and compatibility alias persistence for system users

import type { UserRole } from '../types';

const ROLE_FIELDS = ['role', 'Loại tài khoản', 'Phân quyền', 'Vai trò'] as const;

export function normalizeSystemUserRole(user: any, fallback: UserRole = 'viewer'): UserRole {
  const rawRole = ROLE_FIELDS
    .map(field => user?.[field])
    .find(value => value !== undefined && value !== null && String(value).trim() !== '');
  const role = String(rawRole ?? '').trim().toLowerCase();

  if (role.includes('admin') || role.includes('lãnh đạo') || role.includes('quản lý')) return 'admin';
  if (role.includes('tester') || role.includes('thử nghiệm') || role.includes('user')) return 'tester';
  if (role.includes('guest') || role.includes('khách') || role.includes('khach')) return 'guest';
  if (role.includes('viewer') || role.includes('quan sát') || role.includes('quan sat')) return 'viewer';
  return fallback;
}

export function withSystemUserRoleAliases(user: Record<string, any>, role: UserRole): Record<string, any> {
  return {
    ...user,
    role,
    'Loại tài khoản': role,
    'Phân quyền': role,
    'Vai trò': role
  };
}

// --- End of systemUserRole.ts ---
