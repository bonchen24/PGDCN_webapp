// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for employee KPI ranking and activity chart segments

import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivityKpiSegments, selectActivityKpiRows } from '../utils/activityLogKpi.ts';
import * as activityKpi from '../utils/activityLogKpi.ts';
import type { ActivityKpiSummary } from '../types';

const row = (overrides: Partial<ActivityKpiSummary>): ActivityKpiSummary => ({
  actorUsername: 'staff',
  actorName: 'Nhân viên',
  totalActions: 5,
  requestsCreated: 1,
  samplesProcessed: 2,
  kqtnUpdated: 1,
  handoversCreated: 1,
  workActions: 2,
  requestActions: 2,
  kqtnActions: 1,
  handoverActions: 1,
  scheduleActions: 1,
  otherActions: 0,
  lastActivityAt: '2026-08-18T03:00:00.000Z',
  ...overrides,
});

test('multi-user KPI selection keeps checked users and applies display limit', () => {
  const rows = [
    row({ actorUsername: 'top', actorName: 'Top', totalActions: 20 }),
    row({ actorUsername: 'middle', actorName: 'Middle', totalActions: 10 }),
    row({ actorUsername: 'low', actorName: 'Low', totalActions: 1 }),
  ];

  assert.deepEqual(selectActivityKpiRows(rows, [], 2).map(item => item.actorUsername), ['top', 'middle']);
  assert.deepEqual(selectActivityKpiRows(rows, ['low'], 2).map(item => item.actorUsername), ['low']);
});

test('selected employee chart segments are mutually exclusive and sum to total actions', () => {
  const segments = getActivityKpiSegments(row({
    totalActions: 12,
    requestActions: 4,
    kqtnActions: 3,
    handoverActions: 2,
    scheduleActions: 2,
    otherActions: 1,
  }));

  assert.deepEqual(segments.map(segment => segment.label), ['Phiếu', 'KQTN', 'Biên bản', 'Lịch', 'Khác']);
  assert.equal(segments.reduce((sum, segment) => sum + segment.value, 0), 12);
});

const pcnMemberAccount = (overrides: Record<string, unknown> = {}) => ({
  username: 'pcn-member',
  name: 'Nhân viên phòng',
  role: 'staff',
  active: true,
  departmentRoleCode: 'CERTIFICATION_EXPERT',
  ...overrides,
});

const getDepartmentMembers = (accounts: unknown[]) => {
  const selectMembers = (activityKpi as any).getPcnDepartmentKpiMembers;
  assert.equal(typeof selectMembers, 'function', 'KPI membership helper must be implemented');
  return selectMembers(accounts);
};

test('KPI roster requires active PCN/PGD function metadata, not access scopes or generic identity', () => {
  const members = getDepartmentMembers([
    pcnMemberAccount(),
    pcnMemberAccount({ username: 'pgd-field', name: 'Giám định viên', departmentRoleCode: 'UNASSIGNED', pgdRole: 'PGD_FIELD_INSPECTOR' }),
    pcnMemberAccount({ username: 'dept-head', name: 'Trưởng phòng', departmentRoleCode: 'UNASSIGNED', managementRoleCode: 'DEPARTMENT_HEAD' }),
    pcnMemberAccount({ username: 'expert', name: 'Chuyên gia', departmentRoleCode: 'UNASSIGNED', professionalRoleCodes: ['INSPECTION_EXPERT'] }),
    pcnMemberAccount({ username: 'scope-only', name: 'Tài khoản có scope', departmentRoleCode: 'UNASSIGNED', departmentScopes: ['PCN', 'PGD'] }),
    pcnMemberAccount({ username: 'generic-admin', name: 'Quản trị chung', departmentRoleCode: 'UNASSIGNED', departmentScopes: ['PCN', 'PGD'], systemRole: 'admin' }),
    pcnMemberAccount({ username: 'inactive', name: 'Đã nghỉ', active: false }),
    pcnMemberAccount({ username: 'viewer', name: 'Người xem PGD', departmentRoleCode: 'UNASSIGNED', pgdRole: 'PGD_VIEWER' }),
    pcnMemberAccount({ username: 'center-leader', name: 'Lãnh đạo trung tâm', departmentRoleCode: 'UNASSIGNED', managementRoleCode: 'CENTER_DIRECTOR' }),
    pcnMemberAccount({ username: 'position-only', name: 'Nhân viên', departmentRoleCode: 'UNASSIGNED', position: 'Chuyên gia chứng nhận' }),
  ]);

  assert.deepEqual(members.map((member: any) => member.username).sort(), [
    'dept-head', 'expert', 'pcn-member', 'pgd-field',
  ].sort());
});

test('KPI roster honors the server-computed membership flag over normalized legacy role fields', () => {
  const members = getDepartmentMembers([
    pcnMemberAccount({ username: 'server-excluded', pcnDepartmentKpiMember: false }),
    pcnMemberAccount({ username: 'server-included', departmentRoleCode: 'UNASSIGNED', pgdRole: 'PGD_VIEWER', pcnDepartmentKpiMember: true }),
  ]);

  assert.deepEqual(members.map((member: any) => member.username), ['server-included']);
});

test('KPI actor filters intersect the roster and an empty selection means all room members', () => {
  const members = getDepartmentMembers([
    pcnMemberAccount({ username: 'member-a', name: 'A' }),
    pcnMemberAccount({ username: 'member-b', name: 'B' }),
  ]);
  const selectMembers = (activityKpi as any).selectPcnDepartmentKpiMembers;
  assert.equal(typeof selectMembers, 'function', 'KPI actor filter helper must be implemented');

  assert.deepEqual(selectMembers(members, []).map((member: any) => member.username), ['member-a', 'member-b']);
  assert.deepEqual(selectMembers(members, ['outsider']).map((member: any) => member.username), []);
  assert.deepEqual(selectMembers(members, ['MEMBER-A', 'outsider']).map((member: any) => member.username), ['member-a']);
});

test('KPI summary keeps duplicate names separate by username and includes zero-activity members', () => {
  const members = getDepartmentMembers([
    pcnMemberAccount({ username: 'same-name-a', name: 'Nguyễn Văn An' }),
    pcnMemberAccount({ username: 'same-name-b', name: 'Nguyễn Văn An' }),
  ]);
  const mergeRows = (activityKpi as any).mergeActivityKpiRows;
  assert.equal(typeof mergeRows, 'function', 'KPI summary merge helper must be implemented');
  const rows = mergeRows(members, [
    row({ actorUsername: 'same-name-a', actorName: 'Tên lịch sử khác', totalActions: 3 }),
    row({ actorUsername: 'outsider', actorName: 'Người ngoài', totalActions: 50 }),
  ]);

  assert.deepEqual(rows.map((item: ActivityKpiSummary) => item.actorUsername).sort(), ['same-name-a', 'same-name-b']);
  assert.equal(rows.find((item: ActivityKpiSummary) => item.actorUsername === 'same-name-a')?.totalActions, 3);
  assert.equal(rows.find((item: ActivityKpiSummary) => item.actorUsername === 'same-name-a')?.actorName, 'Nguyễn Văn An (same-name-a)');
  assert.equal(rows.find((item: ActivityKpiSummary) => item.actorUsername === 'same-name-b')?.actorName, 'Nguyễn Văn An (same-name-b)');
  assert.equal(rows.find((item: ActivityKpiSummary) => item.actorUsername === 'same-name-b')?.totalActions, 0);
});

test('KPI chart does not widen an invalid selected actor into the full server response', () => {
  const rows = [row({ actorUsername: 'member-a' }), row({ actorUsername: 'member-b' })];
  assert.deepEqual(selectActivityKpiRows(rows, ['outsider'], 0), []);
});

// --- End of activity-log-kpi.test.ts ---
