import type { PcnUserAccount } from '../types.ts';
import {
  PCN_AGENT_CAPABILITIES,
  type PcnAgentCapability,
  type PcnAgentPermission,
  type PcnAgentUserContext,
} from './pcnAgentTypes.ts';

const RESPONSIBILITIES: Record<string, string[]> = {
  LEADERSHIP: ['oversee_department_work', 'review_backlog', 'coordinate_assignments', 'review_approvals'],
  CERTIFICATION_EXPERT: ['review_application', 'check_documents', 'monitor_test_result', 'prepare_certification_assessment'],
  TECHNICAL_REVIEWER: ['review_assigned_records', 'check_document_consistency', 'review_test_result', 'prepare_review_notes'],
  SAMPLE_COORDINATOR: ['coordinate_sample_lots', 'monitor_lab_requests', 'monitor_test_result'],
  DOCUMENT_CLERK: ['check_document_versions', 'prepare_document_package', 'maintain_archive_evidence'],
  UNASSIGNED: [],
};

const COMMON_CAPABILITIES: PcnAgentCapability[] = [
  'VIEW_MY_WORK',
  'VIEW_UPCOMING_DEADLINES',
  'SEARCH_RECORDS_IN_SCOPE',
  'ANALYZE_RECORD',
  'CHECK_MISSING_DOCUMENTS',
];

const CAPABILITY_PERMISSION: Partial<Record<PcnAgentCapability, PcnAgentPermission>> = {
  VIEW_MY_WORK: 'pcn.agent.read.assigned',
  VIEW_UPCOMING_DEADLINES: 'pcn.agent.deadline.read',
  SEARCH_RECORDS_IN_SCOPE: 'pcn.agent.record.search.assigned',
  ANALYZE_RECORD: 'pcn.agent.record.analyze',
  CHECK_MISSING_DOCUMENTS: 'pcn.agent.record.analyze',
  REVIEW_ASSIGNED_RECORDS: 'pcn.agent.record.analyze',
  PREPARE_ASSESSMENT_DRAFT: 'pcn.agent.record.analyze',
  VIEW_SAMPLE_WORK: 'pcn.agent.read.assigned',
  MONITOR_TEST_RESULTS: 'pcn.agent.kqtn.read',
  VIEW_DOCUMENT_WORK: 'pcn.agent.read.assigned',
  VIEW_PENDING_REVIEWS: 'pcn.agent.review.read',
  VIEW_PENDING_APPROVALS: 'pcn.agent.approval.read',
  VIEW_DEPARTMENT_WORK: 'pcn.agent.department.read',
  VIEW_STAFF_WORKLOAD: 'pcn.agent.workload.read',
  VIEW_UNASSIGNED_RECORDS: 'pcn.agent.department.read',
  PROPOSE_ASSIGNMENT: 'pcn.agent.assignment.propose',
  PROPOSE_TASK: 'pcn.agent.task.propose',
};

function normalized(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function isViewer(user: Pick<PcnUserAccount, 'role' | 'systemRole'>): boolean {
  return normalized(user.systemRole || user.role) === 'VIEWER';
}

function isLeadership(user: Pick<PcnUserAccount, 'systemRole' | 'departmentRoleCode'>): boolean {
  return normalized(user.systemRole) === 'ADMIN' || normalized(user.departmentRoleCode) === 'LEADERSHIP';
}

export function getPcnAgentResponsibilities(user: PcnUserAccount): string[] {
  return [...(RESPONSIBILITIES[normalized(user.departmentRoleCode)] || [])];
}

/**
 * Capability is a description of what the Agent may assist with. It is not a
 * replacement for the server's business permission checks.
 */
export function getPcnAgentCapabilities(user: PcnUserAccount): PcnAgentCapability[] {
  if (!user || user.active === false) return [];

  const result = new Set<PcnAgentCapability>(COMMON_CAPABILITIES);
  const departmentRole = normalized(user.departmentRoleCode);

  if (departmentRole === 'CERTIFICATION_EXPERT') {
    result.add('REVIEW_ASSIGNED_RECORDS');
    result.add('PREPARE_ASSESSMENT_DRAFT');
    result.add('MONITOR_TEST_RESULTS');
  }
  if (departmentRole === 'TECHNICAL_REVIEWER') {
    result.add('REVIEW_ASSIGNED_RECORDS');
    result.add('VIEW_PENDING_REVIEWS');
  }
  if (departmentRole === 'SAMPLE_COORDINATOR') {
    result.add('VIEW_SAMPLE_WORK');
    result.add('MONITOR_TEST_RESULTS');
  }
  if (departmentRole === 'DOCUMENT_CLERK') {
    result.add('VIEW_DOCUMENT_WORK');
  }

  if (isLeadership(user)) {
    result.add('VIEW_DEPARTMENT_WORK');
    result.add('VIEW_STAFF_WORKLOAD');
    result.add('VIEW_UNASSIGNED_RECORDS');
    result.add('VIEW_PENDING_APPROVALS');
    if (!isViewer(user)) result.add('PROPOSE_ASSIGNMENT');
  }

  if (!isViewer(user)) result.add('PROPOSE_TASK');

  return PCN_AGENT_CAPABILITIES.filter((capability) => result.has(capability));
}

export function getPcnAgentPermissions(user: PcnUserAccount): PcnAgentPermission[] {
  if (!user || user.active === false) return [];
  const permissions = new Set<PcnAgentPermission>([
    'pcn.agent.read.assigned',
    'pcn.agent.record.search.assigned',
    'pcn.agent.record.analyze',
    'pcn.agent.deadline.read',
  ]);
  if (!isViewer(user)) permissions.add('pcn.agent.task.propose');
  if (isLeadership(user)) {
    permissions.add('pcn.agent.department.read');
    permissions.add('pcn.agent.workload.read');
    permissions.add('pcn.agent.approval.read');
    if (!isViewer(user)) permissions.add('pcn.agent.assignment.propose');
  }
  if (hasPcnAgentCapability(user, 'MONITOR_TEST_RESULTS')) permissions.add('pcn.agent.kqtn.read');
  if (hasPcnAgentCapability(user, 'VIEW_PENDING_REVIEWS')) permissions.add('pcn.agent.review.read');
  return [...permissions];
}

export function getPcnAgentPermissionForCapability(capability: PcnAgentCapability): PcnAgentPermission | undefined {
  return CAPABILITY_PERMISSION[capability];
}

export function hasPcnAgentPermission(user: PcnUserAccount, permission: PcnAgentPermission): boolean {
  return getPcnAgentPermissions(user).includes(permission);
}

export function hasPcnAgentCapability(
  user: PcnUserAccount,
  capability: PcnAgentCapability,
): boolean {
  return getPcnAgentCapabilities(user).includes(capability);
}

export function buildPcnAgentUserContext(user: PcnUserAccount): PcnAgentUserContext {
  const capabilities = getPcnAgentCapabilities(user);
  return {
    id: user.username,
    username: user.username,
    name: user.name,
    department: 'Phòng Chứng nhận',
    ...(user.position ? { position: user.position } : {}),
    systemRole: user.systemRole,
    departmentRoleCode: user.departmentRoleCode,
    roles: [user.systemRole, user.departmentRoleCode].filter(Boolean),
    fieldCodes: [...(user.fieldCodes || [])],
    permissions: getPcnAgentPermissions(user),
    responsibilities: getPcnAgentResponsibilities(user),
    capabilities,
  };
}
