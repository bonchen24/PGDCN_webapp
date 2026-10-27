// Author: Gemini
// OS support: Web/Node
// Description: Pure selection and chart-segment helpers for employee activity KPIs

import type { ActivityKpiSummary } from '../types';

export interface ActivityKpiSegment {
  label: string;
  value: number;
  color: string;
}

export interface PcnDepartmentKpiAccount {
  username: string;
  name: string;
  active?: boolean;
  pcnDepartmentKpiMember?: boolean;
  departmentRoleCode?: string;
  managementRoleCode?: string;
  professionalRoleCodes?: string[];
  pgdRole?: string;
}

const PCN_KPI_DEPARTMENT_ROLES = new Set([
  'LEADERSHIP',
  'CERTIFICATION_EXPERT',
  'TECHNICAL_REVIEWER',
  'SAMPLE_COORDINATOR',
  'DOCUMENT_CLERK',
]);
const PCN_KPI_PROFESSIONAL_ROLES = new Set([
  'INSPECTION_EXPERT',
  'CERTIFICATION_EXPERT',
  'DOCUMENT_CLERK',
]);
const PCN_KPI_MANAGEMENT_ROLES = new Set(['DEPARTMENT_HEAD', 'DEPARTMENT_DEPUTY']);
const PGD_KPI_ROLES = new Set([
  'PGD_ADMIN',
  'PGD_MANAGER',
  'PGD_TECHNICAL',
  'PGD_FIELD_INSPECTOR',
  'PGD_DOCUMENT_CLERK',
]);

const normalizeActorUsername = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const normalizeDisplayName = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .trim()
  .replace(/\s+/g, ' ');

/**
 * Access scopes describe authorization, not department membership. The KPI
 * roster requires an active account with an explicit PCN/PGD function role.
 */
export const isPcnDepartmentKpiMember = (account: PcnDepartmentKpiAccount): boolean => {
  if (!normalizeActorUsername(account.username) || !String(account.name || '').trim() || account.active === false) return false;
  if (typeof account.pcnDepartmentKpiMember === 'boolean') return account.pcnDepartmentKpiMember;

  const departmentRole = String(account.departmentRoleCode || '').trim().toUpperCase();
  const managementRole = String(account.managementRoleCode || '').trim().toUpperCase();
  const pgdRole = String(account.pgdRole || '').trim().toUpperCase();
  const professionalRoles = Array.isArray(account.professionalRoleCodes)
    ? account.professionalRoleCodes.map(role => String(role || '').trim().toUpperCase())
    : [];

  return PCN_KPI_DEPARTMENT_ROLES.has(departmentRole)
    || PCN_KPI_MANAGEMENT_ROLES.has(managementRole)
    || professionalRoles.some(role => PCN_KPI_PROFESSIONAL_ROLES.has(role))
    || PGD_KPI_ROLES.has(pgdRole);
};

/** Filter to unambiguous usernames with explicit current department roles. */
export const getPcnDepartmentKpiMembers = (accounts: PcnDepartmentKpiAccount[]): PcnDepartmentKpiAccount[] => {
  const usernameCounts = new Map<string, number>();
  for (const account of accounts) {
    const username = normalizeActorUsername(account?.username);
    if (username) usernameCounts.set(username, (usernameCounts.get(username) || 0) + 1);
  }

  return accounts
    .filter(account => {
      const username = normalizeActorUsername(account?.username);
      return Boolean(username && usernameCounts.get(username) === 1 && isPcnDepartmentKpiMember(account));
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'vi')
      || normalizeActorUsername(left.username).localeCompare(normalizeActorUsername(right.username)));
};

/** An empty actor filter means every department member; a bad filter never widens. */
export const selectPcnDepartmentKpiMembers = (
  members: PcnDepartmentKpiAccount[],
  selectedActors: string[],
): PcnDepartmentKpiAccount[] => {
  const roster = getPcnDepartmentKpiMembers(members);
  if (selectedActors.length === 0) return roster;
  const selectedUsernames = new Set(selectedActors.map(normalizeActorUsername).filter(Boolean));
  return roster.filter(member => selectedUsernames.has(normalizeActorUsername(member.username)));
};

/** Keep one KPI row per selected member, even when the member had no activity. */
export const mergeActivityKpiRows = (
  members: PcnDepartmentKpiAccount[],
  activityRows: ActivityKpiSummary[],
): ActivityKpiSummary[] => {
  const rowByUsername = new Map(activityRows.map(row => [normalizeActorUsername(row.actorUsername), row]));
  const roster = getPcnDepartmentKpiMembers(members);
  const nameCounts = new Map<string, number>();
  for (const member of roster) {
    const key = normalizeDisplayName(member.name);
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  return roster
    .map(member => {
      const activity = rowByUsername.get(normalizeActorUsername(member.username));
      const actorName = nameCounts.get(normalizeDisplayName(member.name))! > 1
        ? `${member.name} (${member.username})`
        : member.name;
      const zeroRow: ActivityKpiSummary = {
        actorUsername: member.username.trim(),
        actorName,
        totalActions: 0,
        requestsCreated: 0,
        samplesProcessed: 0,
        kqtnUpdated: 0,
        handoversCreated: 0,
        workActions: 0,
        requestActions: 0,
        kqtnActions: 0,
        handoverActions: 0,
        scheduleActions: 0,
        otherActions: 0,
        lastActivityAt: '',
      };
      return {
        ...zeroRow,
        ...(activity || {}),
        actorUsername: member.username.trim(),
        actorName,
      };
    })
    .sort((left, right) => right.totalActions - left.totalActions
      || left.actorName.localeCompare(right.actorName, 'vi')
      || normalizeActorUsername(left.actorUsername).localeCompare(normalizeActorUsername(right.actorUsername)));
};

export const selectActivityKpiRows = (
  rows: ActivityKpiSummary[],
  selectedActors: string[],
  displayLimit: number,
): ActivityKpiSummary[] => {
  const selectedUsernames = new Set(selectedActors.map(normalizeActorUsername).filter(Boolean));
  const selected = selectedActors.length > 0
    ? rows.filter(row => selectedUsernames.has(normalizeActorUsername(row.actorUsername)))
    : rows;
  if (!displayLimit || displayLimit < 1) return selected;
  return selected.slice(0, displayLimit);
};

export const getActivityKpiSegments = (row: ActivityKpiSummary): ActivityKpiSegment[] => [
  { label: 'Phiếu', value: Math.max(0, row.requestActions), color: '#059669' },
  { label: 'KQTN', value: Math.max(0, row.kqtnActions), color: '#2563eb' },
  { label: 'Biên bản', value: Math.max(0, row.handoverActions), color: '#d97706' },
  { label: 'Lịch', value: Math.max(0, row.scheduleActions), color: '#7c3aed' },
  { label: 'Khác', value: Math.max(0, row.otherActions), color: '#94a3b8' },
];

// --- End of activityLogKpi.ts ---
