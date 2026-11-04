import type {
  PcnApprovalStep,
  PcnCertificationMethod,
  PcnDossierStatus,
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDossierWorkflowTask,
  PcnWorkflowCondition,
  PcnWorkflowNodeDefinition,
  PcnWorkflowSnapshot,
  PcnWorkflowTransitionDefinition,
  ReturnedTestResult,
} from '../types.ts';
import { isPcnWorkflowCondition } from './pcnWorkflowTemplate.ts';

export interface PcnWorkflowConditionContext {
  requiredDocumentsComplete?: boolean;
  anyResultReturned?: boolean;
  resultOutcome?: string;
  approvalReturned?: boolean;
  fieldCodes?: string[];
  expectedFieldCodes?: string[];
  method?: string;
  expectedMethod?: string;
}

export interface PcnWorkflowConditionContextInput {
  workflow: PcnWorkflowSnapshot;
  documents: readonly Pick<PcnDossierDocument, 'requirementId' | 'status'>[];
  requiredRequirementIds?: readonly string[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  results?: readonly Pick<ReturnedTestResult, 'id' | 'dossierId' | 'labRequestId' | 'round' | 'outcome' | 'receivedAt' | 'updatedAt' | 'createdAt'>[];
  approvalSteps?: readonly Pick<PcnApprovalStep, 'id' | 'dossierId' | 'sequence' | 'role' | 'status'>[];
  fieldCodes?: readonly string[];
  method?: PcnCertificationMethod | string;
}

export interface PcnWorkflowRuntimeNode {
  id: string;
  kind: PcnWorkflowNodeDefinition['kind'];
  label: string;
  description?: string;
  actionKey?: string;
  requirementIds: string[];
  status: PcnDossierWorkflowTask['status'];
  cycleNo: number;
  assignedUsername?: string;
  blockedReason?: 'MISSING_DOCUMENT' | 'PREDECESSOR' | 'CONDITION' | 'JOIN_POLICY';
  returnReason?: string;
  returnTargetNodeId?: string;
  isActive: boolean;
}

export interface PcnWorkflowRuntimeProjection {
  nodes: PcnWorkflowRuntimeNode[];
  edges: PcnWorkflowSnapshot['transitions'];
  byNodeId: Record<string, PcnWorkflowRuntimeNode>;
  activeNodeIds: string[];
  returnedNodeIds: string[];
  hasReturned: boolean;
}

/** Maps detailed node completion back to the compact dossier lifecycle. */
export function getPcnDossierStatusAfterWorkflowTaskComplete(
  node: Pick<PcnWorkflowNodeDefinition, 'id' | 'actionKey'>,
  currentStatus: PcnDossierStatus,
): PcnDossierStatus | undefined {
  const actionKey = String(node.actionKey || '').trim().toUpperCase();
  const nodeId = String(node.id || '').trim().toLowerCase();
  if (actionKey === 'ASSIGNMENT') return 'ASSIGNED';
  if (actionKey === 'EVALUATION') return nodeId.includes('plan') ? 'PLAN_PENDING_APPROVAL' : 'FIELD_EVALUATION';
  if (actionKey === 'SAMPLING_LAB') return 'AWAITING_SAMPLING';
  if (actionKey === 'SAMPLE_HANDOVER') return 'SENT_TO_LAB';
  if (actionKey === 'TEST_REPORT') return 'AWAITING_RESULTS';
  if (actionKey === 'TECHNICAL_REVIEW') return 'TECHNICAL_REVIEW';
  if (currentStatus === 'ARCHIVED') return undefined;
  return undefined;
}

function recordTimestamp(record: { receivedAt?: string; updatedAt?: string; createdAt?: string }): string {
  return String(record.receivedAt || record.updatedAt || record.createdAt || '');
}

function isTerminal(status: PcnDossierWorkflowTask['status'] | undefined): boolean {
  return status === 'COMPLETED' || status === 'SKIPPED';
}

function normalizeOutcome(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function evaluatePcnWorkflowCondition(condition: string | undefined, context: PcnWorkflowConditionContext): boolean {
  const normalized = String(condition || 'ALWAYS').trim().toUpperCase();
  if (!isPcnWorkflowCondition(normalized)) throw new Error(`Điều kiện workflow không được allowlist: ${condition}`);
  switch (normalized as PcnWorkflowCondition) {
    case 'ALWAYS': return true;
    case 'REQUIRED_DOCUMENTS_COMPLETE': return context.requiredDocumentsComplete === true;
    case 'ANY_RESULT_RETURNED': return context.anyResultReturned === true;
    case 'RESULT_PASSED': return ['PASS', 'PASSED', 'PASS_WITH_OBSERVATION'].includes(normalizeOutcome(context.resultOutcome));
    case 'RESULT_FAILED': return ['FAIL', 'FAILED', 'REJECTED'].includes(normalizeOutcome(context.resultOutcome));
    case 'APPROVAL_RETURNED': return context.approvalReturned === true;
    case 'FIELD_MATCH': return Boolean(context.fieldCodes?.length && context.expectedFieldCodes?.length && context.fieldCodes.some((code) => context.expectedFieldCodes?.includes(code)));
    case 'METHOD_MATCH': return Boolean(context.method && context.expectedMethod && context.method === context.expectedMethod);
    default: return false;
  }
}

function getIncoming(workflow: PcnWorkflowSnapshot, nodeId: string) {
  return workflow.transitions.filter((transition) => transition.toNodeId === nodeId);
}

function getOutgoing(workflow: PcnWorkflowSnapshot, nodeId: string) {
  return workflow.transitions.filter((transition) => transition.fromNodeId === nodeId);
}

function requirementIsResolved(
  requirementId: string,
  documents: readonly Pick<PcnDossierDocument, 'requirementId' | 'status'>[],
  waivers: Record<string, PcnDossierDocumentWaiver | undefined>,
): boolean {
  const document = documents.find((item) => item.requirementId === requirementId);
  if (document?.status === 'PRESENT') return true;
  const waiver = waivers[requirementId];
  return Boolean(waiver?.reason?.trim());
}

function nodeDocumentsResolved(
  node: PcnWorkflowNodeDefinition,
  documents: readonly Pick<PcnDossierDocument, 'requirementId' | 'status'>[],
  waivers: Record<string, PcnDossierDocumentWaiver | undefined>,
  requiredRequirementIds?: ReadonlySet<string>,
): boolean {
  return node.requirementIds
    .filter((requirementId) => !requiredRequirementIds || requiredRequirementIds.has(requirementId))
    .every((requirementId) => requirementIsResolved(requirementId, documents, waivers));
}

export function buildPcnWorkflowConditionContext(input: PcnWorkflowConditionContextInput): PcnWorkflowConditionContext {
  const requiredRequirementIds = input.requiredRequirementIds === undefined ? undefined : new Set(input.requiredRequirementIds);
  const requirementIds = new Set(input.workflow.nodes
    .filter((node) => node.active !== false)
    .flatMap((node) => node.requirementIds.filter((requirementId) => !requiredRequirementIds || requiredRequirementIds.has(requirementId))));
  const waivers = input.documentWaivers || {};
  const results = input.results || [];
  const latestResult = [...results].sort((left, right) => recordTimestamp(right).localeCompare(recordTimestamp(left)) || String(right.id).localeCompare(String(left.id))).at(0);
  return {
    requiredDocumentsComplete: [...requirementIds].every((requirementId) => requirementIsResolved(requirementId, input.documents, waivers)),
    anyResultReturned: results.length > 0,
    ...(latestResult?.outcome ? { resultOutcome: latestResult.outcome } : {}),
    approvalReturned: Boolean(input.approvalSteps?.some((step) => step.status === 'RETURNED')),
    ...(input.fieldCodes?.length ? { fieldCodes: input.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean) } : {}),
    ...(input.method ? { method: String(input.method).trim().toUpperCase() } : {}),
  };
}

export function isPcnWorkflowTransitionAllowed(
  transition: Pick<PcnWorkflowTransitionDefinition, 'condition' | 'conditionConfig'>,
  context: PcnWorkflowConditionContext,
): boolean {
  return evaluatePcnWorkflowCondition(transition.condition, {
    ...context,
    ...(transition.conditionConfig?.expectedFieldCodes ? { expectedFieldCodes: transition.conditionConfig.expectedFieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean) } : {}),
    ...(transition.conditionConfig?.expectedMethod ? { expectedMethod: String(transition.conditionConfig.expectedMethod).trim().toUpperCase() } : {}),
  });
}

function joinSatisfied(
  node: PcnWorkflowNodeDefinition,
  incoming: ReturnType<typeof getIncoming>,
  statuses: Map<string, PcnDossierWorkflowTask['status']>,
  context: PcnWorkflowConditionContext,
): boolean {
  const satisfied = incoming.filter((edge) => isPcnWorkflowTransitionAllowed(edge, context)
    && isTerminal(statuses.get(edge.fromNodeId))).length;
  if (node.joinPolicy === 'ANY') return satisfied >= 1;
  if (node.joinPolicy === 'QUORUM') return satisfied >= Math.max(1, node.quorum || 0);
  return satisfied === incoming.length && incoming.length > 0;
}

function nodePredecessorsReady(
  workflow: PcnWorkflowSnapshot,
  node: PcnWorkflowNodeDefinition,
  statuses: Map<string, PcnDossierWorkflowTask['status']>,
  context: PcnWorkflowConditionContext,
): boolean {
  const allIncoming = getIncoming(workflow, node.id);
  const incoming = allIncoming.filter((edge) => isPcnWorkflowTransitionAllowed(edge, context));
  if (allIncoming.length === 0) return true;
  if (incoming.length === 0) return false;
  if (node.kind === 'PARALLEL_JOIN') return joinSatisfied(node, incoming, statuses, context);
  return incoming.every((edge) => isTerminal(statuses.get(edge.fromNodeId)));
}

export function buildPcnWorkflowTaskSeed(
  workflow: PcnWorkflowSnapshot,
  dossierId: string,
  updatedBy: string,
  now: string,
): PcnDossierWorkflowTask[] {
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  return [...workflow.nodes]
    .filter((node) => node.active !== false && nodeIds.has(node.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((node) => ({
      id: `${dossierId}--${node.id}`,
      dossierId,
      nodeId: node.id,
      status: getIncoming(workflow, node.id).length === 0 ? 'READY' : 'LOCKED',
      cycleNo: 1,
      updatedAt: now,
      updatedBy,
    }));
}

export interface PcnWorkflowFocusNode {
  nodeId: string;
  label: string;
  kind: PcnWorkflowNodeDefinition['kind'];
  status: PcnDossierWorkflowTask['status'];
  cycleNo: number;
  assignedUsername?: string;
}

const WORKFLOW_FOCUS_STATUS_ORDER: readonly PcnDossierWorkflowTask['status'][] = [
  'RETURNED',
  'IN_PROGRESS',
  'WAITING',
  'READY',
];

/** Selects the node a compact dossier card should surface without collapsing the graph into stations. */
export function getPcnWorkflowFocusNode(
  workflow: PcnWorkflowSnapshot | undefined,
  tasks: readonly PcnDossierWorkflowTask[] = [],
): PcnWorkflowFocusNode | undefined {
  if (!workflow?.nodes?.length) return undefined;
  const nodesById = new Map(workflow.nodes.filter((node) => node.active !== false).map((node) => [node.id, node]));
  const validTasks = tasks.filter((task) => nodesById.has(task.nodeId));
  const activeTask = [...validTasks]
    .filter((task) => WORKFLOW_FOCUS_STATUS_ORDER.includes(task.status))
    .sort((left, right) => WORKFLOW_FOCUS_STATUS_ORDER.indexOf(left.status) - WORKFLOW_FOCUS_STATUS_ORDER.indexOf(right.status)
      || (nodesById.get(left.nodeId)?.sortOrder || 0) - (nodesById.get(right.nodeId)?.sortOrder || 0)
      || left.nodeId.localeCompare(right.nodeId))[0];
  const completedTask = [...validTasks]
    .filter((task) => task.status === 'COMPLETED' || task.status === 'SKIPPED')
    .sort((left, right) => (nodesById.get(right.nodeId)?.sortOrder || 0) - (nodesById.get(left.nodeId)?.sortOrder || 0)
      || right.nodeId.localeCompare(left.nodeId))[0];
  const selectedTask = activeTask || completedTask;
  const selectedNode = selectedTask ? nodesById.get(selectedTask.nodeId) : [...nodesById.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))[0];
  if (!selectedNode) return undefined;
  return {
    nodeId: selectedNode.id,
    label: selectedNode.label,
    kind: selectedNode.kind,
    status: selectedTask?.status || 'LOCKED',
    cycleNo: selectedTask?.cycleNo || 1,
    ...(selectedTask?.assignedUsername ? { assignedUsername: selectedTask.assignedUsername } : {}),
  };
}

export function projectPcnWorkflowRuntime(input: {
  workflow: PcnWorkflowSnapshot;
  tasks: readonly PcnDossierWorkflowTask[];
  documents: readonly Pick<PcnDossierDocument, 'requirementId' | 'status'>[];
  requiredRequirementIds?: readonly string[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  conditionContext?: PcnWorkflowConditionContext;
}): PcnWorkflowRuntimeProjection {
  const context = input.conditionContext || {};
  const requiredRequirementIds = input.requiredRequirementIds === undefined ? undefined : new Set(input.requiredRequirementIds);
  const taskByNodeId = new Map(input.tasks.map((task) => [task.nodeId, task]));
  const statuses = new Map(input.tasks.map((task) => [task.nodeId, task.status]));
  const orderedNodes = [...input.workflow.nodes].filter((node) => node.active !== false).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  // Resolve LOCKED -> READY in topology order. Repeating makes the projection
  // stable even when a valid template has same-order split/join nodes.
  for (let pass = 0; pass < orderedNodes.length + 1; pass += 1) {
    let changed = false;
    for (const node of orderedNodes) {
      if (statuses.get(node.id) !== 'LOCKED') continue;
      if (!nodePredecessorsReady(input.workflow, node, statuses, context)) continue;
      statuses.set(node.id, 'READY');
      changed = true;
    }
    if (!changed) break;
  }

  const nodes = orderedNodes.map((node): PcnWorkflowRuntimeNode => {
    const rawTask = taskByNodeId.get(node.id);
    const status = statuses.get(node.id) || rawTask?.status || 'LOCKED';
    const allIncoming = getIncoming(input.workflow, node.id);
    const activeIncoming = allIncoming.filter((edge) => isPcnWorkflowTransitionAllowed(edge, context));
    const predecessorReady = nodePredecessorsReady(input.workflow, node, statuses, context);
    const documentsResolved = nodeDocumentsResolved(node, input.documents, input.documentWaivers || {}, requiredRequirementIds);
    const blockedReason = ['READY', 'LOCKED'].includes(status)
      ? allIncoming.length > 0 && activeIncoming.length === 0 ? 'CONDITION'
        : !predecessorReady ? 'PREDECESSOR'
          : status === 'READY' && !documentsResolved ? 'MISSING_DOCUMENT'
            : status === 'READY' && node.kind === 'PARALLEL_JOIN' && !joinSatisfied(node, getIncoming(input.workflow, node.id), statuses, context) ? 'JOIN_POLICY'
              : undefined
      : undefined;
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      ...(node.description ? { description: node.description } : {}),
      ...(node.actionKey ? { actionKey: node.actionKey } : {}),
      requirementIds: [...node.requirementIds],
      status,
      cycleNo: rawTask?.cycleNo || 1,
      ...(rawTask?.assignedUsername ? { assignedUsername: rawTask.assignedUsername } : {}),
      ...(blockedReason ? { blockedReason } : {}),
      ...(rawTask?.returnReason ? { returnReason: rawTask.returnReason } : {}),
      ...(rawTask?.returnTargetNodeId ? { returnTargetNodeId: rawTask.returnTargetNodeId } : {}),
      isActive: ['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED'].includes(status),
    };
  });
  const byNodeId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const activeNodeIds = nodes.filter((node) => node.isActive).map((node) => node.id);
  const returnedNodeIds = nodes.filter((node) => node.status === 'RETURNED' || Boolean(node.returnTargetNodeId)).map((node) => node.id);
  return {
    nodes,
    edges: input.workflow.transitions.filter((transition) => byNodeId[transition.fromNodeId] && byNodeId[transition.toNodeId]),
    byNodeId,
    activeNodeIds,
    returnedNodeIds,
    hasReturned: returnedNodeIds.length > 0,
  };
}

export function applyPcnWorkflowReturn(input: {
  workflow: PcnWorkflowSnapshot;
  tasks: readonly PcnDossierWorkflowTask[];
  sourceNodeId: string;
  targetNodeId: string;
  reason: string;
  actor: string;
  now: string;
}): { tasks: PcnDossierWorkflowTask[]; returnedTask: PcnDossierWorkflowTask } {
  const sourceNode = input.workflow.nodes.find((node) => node.id === input.sourceNodeId);
  const targetNode = input.workflow.nodes.find((node) => node.id === input.targetNodeId);
  const reason = String(input.reason || '').trim();
  if (!sourceNode || !targetNode) throw new Error('Node trả lại không thuộc snapshot workflow của hồ sơ.');
  if (input.sourceNodeId === input.targetNodeId) throw new Error('Node trả lại phải khác node nguồn.');
  if (targetNode.kind === 'END') throw new Error('Không thể trả hồ sơ về node END.');
  if (!reason || reason.length > 1000) throw new Error('Trả hồ sơ phải có lý do từ 1 đến 1000 ký tự.');

  const descendants = new Set<string>();
  const queue = [input.targetNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of getOutgoing(input.workflow, current)) {
      if (edge.toNodeId === input.sourceNodeId || descendants.has(edge.toNodeId)) continue;
      descendants.add(edge.toNodeId);
      queue.push(edge.toNodeId);
    }
  }
  const targetTask = input.tasks.find((task) => task.nodeId === input.targetNodeId);
  const sourceTask = input.tasks.find((task) => task.nodeId === input.sourceNodeId);
  if (!targetTask || !sourceTask) throw new Error('Không tìm thấy task nguồn hoặc task đích trong hồ sơ.');
  if (!['READY', 'IN_PROGRESS', 'WAITING'].includes(sourceTask.status)) throw new Error('Chỉ có thể trả lại node đang được xử lý.');

  const ancestorNodeIds = new Set<string>();
  const ancestorQueue = [input.sourceNodeId];
  while (ancestorQueue.length > 0) {
    const current = ancestorQueue.shift()!;
    for (const edge of input.workflow.transitions) {
      if (edge.toNodeId !== current || ancestorNodeIds.has(edge.fromNodeId)) continue;
      ancestorNodeIds.add(edge.fromNodeId);
      ancestorQueue.push(edge.fromNodeId);
    }
  }
  if (!ancestorNodeIds.has(input.targetNodeId)) throw new Error('Node nhận lại phải nằm trước node nguồn trong snapshot workflow.');
  const cycleNo = Math.max(targetTask.cycleNo || 1, sourceTask.cycleNo || 1) + 1;
  const tasks = input.tasks.map((task) => {
    if (task.nodeId === input.sourceNodeId) return { ...task, status: 'RETURNED' as const, returnReason: reason, returnTargetNodeId: input.targetNodeId, updatedAt: input.now, updatedBy: input.actor };
    if (task.nodeId === input.targetNodeId) return { ...task, status: 'READY' as const, cycleNo, returnReason: undefined, returnTargetNodeId: undefined, updatedAt: input.now, updatedBy: input.actor };
    if (descendants.has(task.nodeId) && task.status !== 'CANCELLED') return { ...task, status: 'STALE' as const, cycleNo, updatedAt: input.now, updatedBy: input.actor };
    return task;
  });
  const returnedTask = tasks.find((task) => task.nodeId === input.sourceNodeId)!;
  return { tasks, returnedTask };
}

/** Reopens the node whose completed evidence changed while preserving every prior cycle. */
export function applyPcnWorkflowDocumentRework(input: {
  workflow: PcnWorkflowSnapshot;
  tasks: readonly PcnDossierWorkflowTask[];
  sourceNodeId: string;
  actor: string;
  now: string;
}): { tasks: PcnDossierWorkflowTask[]; reopenedTask: PcnDossierWorkflowTask } {
  const sourceNode = input.workflow.nodes.find((node) => node.id === input.sourceNodeId);
  const sourceTask = input.tasks.find((task) => task.nodeId === input.sourceNodeId);
  if (!sourceNode || !sourceTask) throw new Error('Không tìm thấy node hoặc task tài liệu cần xử lý lại.');
  if (!['COMPLETED', 'SKIPPED'].includes(sourceTask.status)) {
    throw new Error('Chỉ tài liệu của node đã hoàn tất mới tạo vòng xử lý lại.');
  }

  const descendants = new Set<string>();
  const queue = [input.sourceNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of getOutgoing(input.workflow, current)) {
      if (descendants.has(edge.toNodeId)) continue;
      descendants.add(edge.toNodeId);
      queue.push(edge.toNodeId);
    }
  }
  const cycleNo = (sourceTask.cycleNo || 1) + 1;
  const tasks = input.tasks.map((task) => {
    if (task.nodeId === input.sourceNodeId) {
      return {
        ...task,
        status: 'IN_PROGRESS' as const,
        cycleNo,
        returnReason: undefined,
        returnTargetNodeId: undefined,
        updatedAt: input.now,
        updatedBy: input.actor,
      };
    }
    if (descendants.has(task.nodeId) && task.status !== 'CANCELLED') {
      return { ...task, status: 'STALE' as const, cycleNo, updatedAt: input.now, updatedBy: input.actor };
    }
    return task;
  });
  return { tasks, reopenedTask: tasks.find((task) => task.nodeId === input.sourceNodeId)! };
}

// --- End of pcnWorkflowRuntime.ts ---
