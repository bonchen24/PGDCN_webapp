import type {
  CertificationDossier,
  CertificationProposal,
  PcnDossierDocument,
  PcnDocumentRequirement,
  PcnUserAccount,
  OutboundLabRequest,
  ReturnedTestResult,
} from '../types.ts';
import type { PcnWorkQueueRow } from './pcnWorkQueue.ts';

export const PCN_AGENT_CAPABILITIES = [
  'VIEW_MY_WORK',
  'VIEW_UPCOMING_DEADLINES',
  'SEARCH_RECORDS_IN_SCOPE',
  'ANALYZE_RECORD',
  'CHECK_MISSING_DOCUMENTS',
  'REVIEW_ASSIGNED_RECORDS',
  'PREPARE_ASSESSMENT_DRAFT',
  'VIEW_SAMPLE_WORK',
  'MONITOR_TEST_RESULTS',
  'VIEW_DOCUMENT_WORK',
  'VIEW_PENDING_REVIEWS',
  'VIEW_PENDING_APPROVALS',
  'VIEW_DEPARTMENT_WORK',
  'VIEW_STAFF_WORKLOAD',
  'VIEW_UNASSIGNED_RECORDS',
  'PROPOSE_ASSIGNMENT',
  'PROPOSE_TASK',
] as const;

export type PcnAgentCapability = typeof PCN_AGENT_CAPABILITIES[number];

export const PCN_AGENT_PERMISSIONS = [
  'pcn.agent.read.assigned',
  'pcn.agent.record.search.assigned',
  'pcn.agent.record.analyze',
  'pcn.agent.deadline.read',
  'pcn.agent.kqtn.read',
  'pcn.agent.review.read',
  'pcn.agent.approval.read',
  'pcn.agent.task.propose',
  'pcn.agent.department.read',
  'pcn.agent.workload.read',
  'pcn.agent.assignment.propose',
] as const;

export type PcnAgentPermission = typeof PCN_AGENT_PERMISSIONS[number];

export type PcnAgentActionLevel = 'READ' | 'DRAFT' | 'EXECUTE_WITH_CONFIRMATION';
export type PcnAgentActionType = 'CREATE_TASK' | 'PROPOSE_ASSIGNMENT' | 'APPROVE_CERTIFICATE' | 'ISSUE_CERTIFICATE' | 'SIGN_DOCUMENT' | 'DELETE_RECORD' | 'CHANGE_PERMISSION';
export type PcnAgentActionStatus = 'PROPOSED' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED' | 'EXECUTED' | 'FAILED';

export interface PcnAgentUserContext {
  id: string;
  username: string;
  name: string;
  department: 'Phòng Chứng nhận';
  position?: string;
  systemRole: PcnUserAccount['systemRole'];
  departmentRoleCode: PcnUserAccount['departmentRoleCode'];
  roles: string[];
  fieldCodes: string[];
  permissions: PcnAgentPermission[];
  responsibilities: string[];
  capabilities: PcnAgentCapability[];
}

export interface PcnAgentWorkItem extends PcnWorkQueueRow {
  relation: 'OWNER' | 'EVALUATOR' | 'REVIEWER' | 'APPROVAL' | 'UNASSIGNED';
  priorityScore: number;
  priorityReasons: string[];
  blocked: boolean;
  waitingDays: number;
}

export interface PcnAgentDeadline {
  id: string;
  kind: 'DOSSIER' | 'LAB_REQUEST';
  dossierId: string;
  dossierCode: string;
  label: string;
  targetDate: string;
  daysRemaining: number;
  priority: PcnWorkQueueRow['priority'];
  overdue: boolean;
}

export interface PcnAgentActivity {
  id: string;
  status: 'DONE';
  label: string;
  detail: string;
}

export interface PcnAgentTestResult {
  id: string;
  dossierId: string;
  labRequestId: string;
  round: number;
  outcome: string;
  receivedAt: string;
  reportNumber?: string;
}

export interface PcnAgentLabRequest {
  id: string;
  dossierId: string;
  pycNumber: string;
  laboratoryName: string;
  status: string;
  targetDate?: string;
  requestedAt?: string;
}

export interface PcnAgentCustomerInfo {
  dossierId: string;
  dossierCode: string;
  name: string;
  address?: string;
  taxId?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

export type PcnAgentRecommendationKind = 'OVERDUE' | 'MISSING_DOCUMENTS' | 'STALLED' | 'DUE_SOON' | 'NEW_RESULT' | 'NEW_DOCUMENT' | 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'UNASSIGNED' | 'TASK_OVERDUE' | 'WORKLOAD_RISK';

export interface PcnAgentRecommendation {
  id: string;
  kind: PcnAgentRecommendationKind;
  title: string;
  description: string;
  priority: PcnWorkQueueRow['priority'];
  dossierId?: string;
  dossierCode?: string;
  reasons: string[];
  source: string[];
}

export interface PcnAgentWorkloadRow {
  username: string;
  name: string;
  departmentRoleCode: PcnUserAccount['departmentRoleCode'];
  fieldCodes: string[];
  assignable: boolean;
  active: boolean;
  dossierCount: number;
  overdueCount: number;
  dueSoonCount: number;
  risk: 'NORMAL' | 'HIGH';
}

export interface PcnAgentMetrics {
  today: number;
  overdue: number;
  openTasks: number;
  overdueTasks: number;
  activeDossiers: number;
  waitingCustomer: number;
  upcomingDeadlines: number;
}

export interface PcnAgentQuickAction {
  id: string;
  label: string;
  description: string;
  capability: PcnAgentCapability;
  query: string;
}

export interface PcnAgentTask {
  id: string;
  title: string;
  description?: string;
  dossierId?: string;
  dossierCode?: string;
  assigneeUsername: string;
  dueAt?: string;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  source: 'AGENT' | 'MANUAL';
  createdAt: string;
  updatedAt: string;
  createdByUsername: string;
}

export interface PcnAgentAction {
  id: string;
  actionType: PcnAgentActionType;
  actionLevel: PcnAgentActionLevel;
  status: PcnAgentActionStatus;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  requiredCapability: PcnAgentCapability;
  actorUsername: string;
  conversationId?: string;
  createdAt: string;
  confirmedAt?: string;
  executedAt?: string;
  executionResult?: Record<string, unknown>;
}

export type PcnAgentResponseBlock =
  | { type: 'message'; text: string }
  | { type: 'work_summary'; title: string; metrics: PcnAgentMetrics }
  | { type: 'record_list'; title: string; records: PcnAgentWorkItem[] }
  | { type: 'task_list'; title: string; tasks: PcnAgentTask[] }
  | { type: 'warning'; title: string; text: string; records?: PcnAgentWorkItem[] }
  | { type: 'recommendation'; title: string; recommendations: PcnAgentRecommendation[] }
  | { type: 'draft'; title: string; text: string; dossierId?: string }
  | { type: 'proposed_action'; action: PcnAgentAction }
  | { type: 'chart_data'; title: string; rows: Array<Record<string, string | number>> };

export interface PcnAgentWorkspace {
  user: PcnAgentUserContext;
  asOf: string;
  activity: PcnAgentActivity[];
  briefing: string;
  metrics: PcnAgentMetrics;
  myWork: PcnAgentWorkItem[];
  upcomingDeadlines: PcnAgentDeadline[];
  testResults: PcnAgentTestResult[];
  labRequests: PcnAgentLabRequest[];
  customers: PcnAgentCustomerInfo[];
  recommendations: PcnAgentRecommendation[];
  quickActions: PcnAgentQuickAction[];
  allWork?: PcnAgentWorkItem[];
  departmentWorkload?: PcnAgentWorkloadRow[];
  tasks: PcnAgentTask[];
}

export interface PcnAgentSnapshot {
  user: PcnUserAccount;
  users: PcnUserAccount[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  documentRequirements: PcnDocumentRequirement[];
  dossierDocuments: PcnDossierDocument[];
  labRequests?: OutboundLabRequest[];
  returnedResults?: ReturnedTestResult[];
  approvalSteps?: import('../types.ts').PcnApprovalStep[];
  tasks?: PcnAgentTask[];
  now?: string;
}
