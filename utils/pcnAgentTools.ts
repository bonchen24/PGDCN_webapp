import type { PcnAgentCapability, PcnAgentWorkItem, PcnAgentWorkspace } from './pcnAgentTypes.ts';
import { getPcnAgentPermissionForCapability } from './pcnAgentCapabilities.ts';
import { isPcnAgentTaskOverdue } from './pcnAgentWorkspace.ts';

export const PCN_AGENT_TOOL_NAMES = [
  'get_my_work',
  'get_my_records',
  'get_my_tasks',
  'get_overdue_work',
  'get_overdue_tasks',
  'get_upcoming_deadlines',
  'search_certification_records',
  'get_certification_record',
  'get_record_documents',
  'get_missing_documents',
  'get_record_workflow',
  'get_test_results',
  'get_recent_test_results',
  'get_pending_test_results',
  'get_customer_information',
  'get_pending_reviews',
  'get_pending_approvals',
  'get_department_workload',
  'get_staff_workload',
  'get_unassigned_records',
  'get_assignment_candidates',
] as const;

export type PcnAgentToolName = typeof PCN_AGENT_TOOL_NAMES[number];

type ToolInput = Record<string, unknown>;
type ToolOutput = unknown;

interface ToolDefinition {
  capability: PcnAgentCapability;
  execute: (workspace: PcnAgentWorkspace, input: ToolInput) => ToolOutput;
}

function availableRecords(workspace: PcnAgentWorkspace): PcnAgentWorkItem[] {
  return workspace.allWork || workspace.myWork;
}

function findRecord(workspace: PcnAgentWorkspace, input: ToolInput): PcnAgentWorkItem | undefined {
  const id = String(input.dossierId || '').trim();
  const code = String(input.dossierCode || input.query || '').trim().toLocaleLowerCase('vi-VN');
  return availableRecords(workspace).find((record) =>
    (id && record.dossierId === id) ||
    (code && [record.dossierCode, record.proposalCode, record.customerName, record.productName].some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(code))),
  );
}

const TOOL_DEFINITIONS: Record<PcnAgentToolName, ToolDefinition> = {
  get_my_work: { capability: 'VIEW_MY_WORK', execute: (workspace) => workspace.myWork },
  get_my_records: { capability: 'VIEW_MY_WORK', execute: (workspace) => workspace.myWork },
  get_my_tasks: { capability: 'VIEW_MY_WORK', execute: (workspace) => workspace.tasks },
  get_overdue_work: { capability: 'VIEW_MY_WORK', execute: (workspace) => workspace.myWork.filter((record) => record.priority === 'OVERDUE') },
  get_overdue_tasks: { capability: 'VIEW_MY_WORK', execute: (workspace) => workspace.tasks.filter((task) => task.status === 'OPEN' && isPcnAgentTaskOverdue(task, workspace.asOf)) },
  get_upcoming_deadlines: { capability: 'VIEW_UPCOMING_DEADLINES', execute: (workspace) => workspace.upcomingDeadlines },
  search_certification_records: {
    capability: 'SEARCH_RECORDS_IN_SCOPE',
    execute: (workspace, input) => {
      const query = String(input.query || '').trim().toLocaleLowerCase('vi-VN');
      if (!query) return [];
      return availableRecords(workspace).filter((record) => [
        record.dossierCode,
        record.proposalCode,
        record.customerName,
        record.productName,
        record.status,
        record.stationTitle,
      ].some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(query))).slice(0, 25);
    },
  },
  get_certification_record: { capability: 'ANALYZE_RECORD', execute: (workspace, input) => findRecord(workspace, input) || null },
  get_record_documents: {
    capability: 'CHECK_MISSING_DOCUMENTS',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      return record ? { dossierId: record.dossierId, dossierCode: record.dossierCode, completenessScore: record.completenessScore, requiredDocumentTotal: record.requiredDocumentTotal, requiredDocumentPresent: record.requiredDocumentPresent, missingRequiredCount: record.missingRequiredCount, missingLabels: [...record.stationMissingLabels, ...record.missingCoreLabels] } : null;
    },
  },
  get_missing_documents: {
    capability: 'CHECK_MISSING_DOCUMENTS',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      return record ? { dossierId: record.dossierId, dossierCode: record.dossierCode, missing: [...record.stationMissingLabels, ...record.missingCoreLabels] } : null;
    },
  },
  get_record_workflow: {
    capability: 'ANALYZE_RECORD',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      return record ? { dossierId: record.dossierId, dossierCode: record.dossierCode, status: record.status, stationKey: record.stationKey, stationTitle: record.stationTitle, nextAction: record.stationActionLabel, stepLabel: record.stepLabel } : null;
    },
  },
  get_test_results: {
    capability: 'MONITOR_TEST_RESULTS',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      return record ? workspace.testResults.filter((result) => result.dossierId === record.dossierId) : [];
    },
  },
  get_recent_test_results: {
    capability: 'MONITOR_TEST_RESULTS',
    execute: (workspace) => workspace.testResults.filter((result) => workspace.recommendations.some((recommendation) => recommendation.kind === 'NEW_RESULT' && recommendation.source.includes(`returnedResults:${result.id}`))),
  },
  get_pending_test_results: {
    capability: 'MONITOR_TEST_RESULTS',
    execute: (workspace) => workspace.myWork.filter((record) => record.status === 'AWAITING_RESULTS'),
  },
  get_customer_information: {
    capability: 'SEARCH_RECORDS_IN_SCOPE',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      return record ? workspace.customers.find((customer) => customer.dossierId === record.dossierId) || null : null;
    },
  },
  get_pending_reviews: { capability: 'VIEW_PENDING_REVIEWS', execute: (workspace) => availableRecords(workspace).filter((record) => record.status === 'TECHNICAL_REVIEW') },
  get_pending_approvals: { capability: 'VIEW_PENDING_APPROVALS', execute: (workspace) => availableRecords(workspace).filter((record) => record.status === 'WAITING_APPROVAL') },
  get_department_workload: { capability: 'VIEW_STAFF_WORKLOAD', execute: (workspace) => workspace.departmentWorkload || [] },
  get_staff_workload: { capability: 'VIEW_STAFF_WORKLOAD', execute: (workspace) => workspace.departmentWorkload || [] },
  get_unassigned_records: { capability: 'VIEW_UNASSIGNED_RECORDS', execute: (workspace) => availableRecords(workspace).filter((record) => record.relation === 'UNASSIGNED') },
  get_assignment_candidates: {
    capability: 'PROPOSE_ASSIGNMENT',
    execute: (workspace, input) => {
      const record = findRecord(workspace, input);
      if (!record || record.relation !== 'UNASSIGNED') return [];
      const dossierFields = record.fieldCodes.map((fieldCode) => String(fieldCode).trim().toUpperCase()).filter(Boolean);
      return (workspace.departmentWorkload || [])
        .filter((candidate) => candidate.assignable && (dossierFields.length === 0 || candidate.fieldCodes.length === 0 || candidate.fieldCodes.some((fieldCode) => dossierFields.includes(String(fieldCode).trim().toUpperCase()))))
        .sort((left, right) => left.dossierCount - right.dossierCount || left.overdueCount - right.overdueCount || left.dueSoonCount - right.dueSoonCount || left.name.localeCompare(right.name, 'vi'))
        .slice(0, 10);
    },
  },
};

export interface PcnAgentToolRegistry {
  list(): PcnAgentToolName[];
  execute(name: string, workspace: PcnAgentWorkspace, input?: ToolInput): ToolOutput;
}

export function createPcnAgentToolRegistry(): PcnAgentToolRegistry {
  return {
    list: () => [...PCN_AGENT_TOOL_NAMES],
    execute: (name, workspace, input = {}) => {
      const definition = TOOL_DEFINITIONS[name as PcnAgentToolName];
      if (!definition) throw new Error(`Tool AI '${String(name)}' không được whitelist.`);
      if (!workspace.user.capabilities.includes(definition.capability)) {
        throw new Error(`Người dùng không có capability ${definition.capability} để gọi tool AI.`);
      }
      const requiredPermission = getPcnAgentPermissionForCapability(definition.capability);
      if (requiredPermission && !workspace.user.permissions.includes(requiredPermission)) {
        throw new Error(`Người dùng không có permission ${requiredPermission} để gọi tool AI.`);
      }
      return definition.execute(workspace, input);
    },
  };
}
