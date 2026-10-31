import type { PgdProductGroup } from './pgdDomain.ts';
import type { PgdcnDossierRequirementPolicy } from '../types.ts';
import { validateDossierRequirementPolicy } from './pgdcnDossierRequirementPolicy.ts';

export type PgdWorkflowTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type PgdWorkflowNodeKind = 'DOCUMENT_TASK' | 'APPROVAL_TASK' | 'DECISION' | 'PARALLEL_SPLIT' | 'PARALLEL_JOIN' | 'END';
export type PgdWorkflowJoinPolicy = 'ALL' | 'ANY' | 'QUORUM';
export type PgdWorkflowReturnPolicy = 'REWORK' | 'RESTART_DEPENDENCIES' | 'RESTART_TEMPLATE';
export type PgdWorkflowCondition =
  | 'ALWAYS'
  | 'REQUIRED_DOCUMENTS_COMPLETE'
  | 'ANY_RESULT_RETURNED'
  | 'RESULT_PASSED'
  | 'RESULT_FAILED'
  | 'APPROVAL_RETURNED'
  | 'FIELD_MATCH'
  | 'METHOD_MATCH';

export interface PgdWorkflowConditionConfig {
  expectedProductGroups?: PgdProductGroup[];
  expectedMethodCodes?: string[];
}

export interface PgdWorkflowTemplateAppliesTo {
  productGroups: PgdProductGroup[];
  methodCodes?: string[];
}

export interface PgdWorkflowNodeDefinition {
  id: string;
  kind: PgdWorkflowNodeKind;
  label: string;
  description?: string;
  actionKey?: string;
  requirementCodes: string[];
  assigneeRole?: string;
  slaDays?: number;
  joinPolicy?: PgdWorkflowJoinPolicy;
  quorum?: number;
  active: boolean;
  sortOrder: number;
  laneId?: string;
  column?: number;
}

export interface PgdWorkflowTransitionDefinition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  condition?: PgdWorkflowCondition;
  conditionConfig?: PgdWorkflowConditionConfig;
  priority?: number;
  returnPolicy?: PgdWorkflowReturnPolicy;
}

export interface PgdWorkflowTemplate {
  domain: 'pgd';
  id: string;
  code: string;
  name: string;
  description?: string;
  appliesTo: PgdWorkflowTemplateAppliesTo;
  /** Requirement policy is versioned with this dossier template, not with the DOCX library. */
  requirementPolicies?: Record<string, PgdcnDossierRequirementPolicy>;
  version: number;
  status: PgdWorkflowTemplateStatus;
  nodes: PgdWorkflowNodeDefinition[];
  transitions: PgdWorkflowTransitionDefinition[];
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  updatedAt: string;
  updatedBy: string;
}

const ALLOWED_CONDITIONS = new Set<PgdWorkflowCondition>([
  'ALWAYS',
  'REQUIRED_DOCUMENTS_COMPLETE',
  'ANY_RESULT_RETURNED',
  'RESULT_PASSED',
  'RESULT_FAILED',
  'APPROVAL_RETURNED',
  'FIELD_MATCH',
  'METHOD_MATCH',
]);
const ALLOWED_KINDS = new Set<PgdWorkflowNodeKind>([
  'DOCUMENT_TASK',
  'APPROVAL_TASK',
  'DECISION',
  'PARALLEL_SPLIT',
  'PARALLEL_JOIN',
  'END',
]);
const PGD_REQUIREMENT_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export interface PgdWorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PgdWorkflowSnapshot {
  templateId: string;
  templateCode: string;
  templateVersion: number;
  nodes: PgdWorkflowNodeDefinition[];
  transitions: PgdWorkflowTransitionDefinition[];
  requirementPolicies?: Record<string, PgdcnDossierRequirementPolicy>;
  capturedAt: string;
  capturedBy: string;
}

function normalized(value: unknown): string {
  return String(value || '').trim();
}

function unique(values: readonly string[]): boolean {
  const clean = values.map(normalized).filter(Boolean);
  return clean.length === values.length && new Set(clean).size === clean.length;
}

export function validatePgdWorkflowTemplate(template: PgdWorkflowTemplate): PgdWorkflowValidationResult {
  const errors: string[] = [];
  if (template?.domain !== 'pgd') errors.push('Template PGD phải có domain pgd.');
  if (!normalized(template?.id)) errors.push('Template PGD phải có id.');
  if (!normalized(template?.code)) errors.push('Template PGD phải có mã.');
  if (!normalized(template?.name)) errors.push('Template PGD phải có tên.');
  if (!Number.isInteger(template?.version) || template.version < 1) errors.push('Version template PGD phải là số nguyên dương.');
  if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(template?.status)) errors.push('Trạng thái template PGD không hợp lệ.');
  if (!Array.isArray(template?.appliesTo?.productGroups)) errors.push('Template PGD phải có productGroups.');
  if (!Array.isArray(template?.nodes) || template.nodes.length === 0) errors.push('Template PGD phải có ít nhất một node.');
  if (!Array.isArray(template?.transitions)) errors.push('Template PGD phải có danh sách transition.');

  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const transitions = Array.isArray(template?.transitions) ? template.transitions : [];
  const requirementRefs = new Set(nodes.flatMap((node) => Array.isArray(node.requirementCodes) ? node.requirementCodes : []));
  for (const [requirementCode, policy] of Object.entries(template?.requirementPolicies || {})) {
    if (!PGD_REQUIREMENT_CODE.test(requirementCode)) errors.push(`Yêu cầu PGD ${requirementCode} không có mã hợp lệ.`);
    if (!requirementRefs.has(requirementCode)) errors.push(`Cấu hình yêu cầu ${requirementCode} chưa được gắn vào bước nào.`);
    for (const error of validateDossierRequirementPolicy(policy, 'PGD')) errors.push(`Yêu cầu ${requirementCode}: ${error}`);
  }
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const id = normalized(node.id);
    if (!id) errors.push('Node PGD phải có id.');
    else if (nodeIds.has(id)) errors.push(`Node PGD ${id} không được trùng id.`);
    else nodeIds.add(id);
    if (!normalized(node.label)) errors.push(`Node PGD ${id || '(không tên)'} phải có nhãn.`);
    if (!ALLOWED_KINDS.has(node.kind)) errors.push(`Node PGD ${id || '(không tên)'} có kind không hợp lệ.`);
    if (!Array.isArray(node.requirementCodes) || !unique(node.requirementCodes)) errors.push(`Node PGD ${id || '(không tên)'} có requirementCodes trùng hoặc không hợp lệ.`);
    for (const code of node.requirementCodes || []) {
      if (!PGD_REQUIREMENT_CODE.test(normalized(code))) errors.push(`Node PGD ${id || '(không tên)'} có mã tài liệu không hợp lệ.`);
    }
    if (!Number.isInteger(node.sortOrder) || node.sortOrder < 0) errors.push(`Node PGD ${id || '(không tên)'} có sortOrder không hợp lệ.`);
    if (node.column !== undefined && (!Number.isInteger(node.column) || node.column < 1)) errors.push(`Node PGD ${id || '(không tên)'} có cột không hợp lệ.`);
    if (node.slaDays !== undefined && (!Number.isInteger(node.slaDays) || node.slaDays < 0)) errors.push(`Node PGD ${id || '(không tên)'} có SLA không hợp lệ.`);
    if (node.kind === 'PARALLEL_JOIN') {
      if (!node.joinPolicy) errors.push(`Node join PGD ${id || '(không tên)'} phải có joinPolicy.`);
      if (node.joinPolicy === 'QUORUM' && (!Number.isInteger(node.quorum) || (node.quorum || 0) < 1)) errors.push(`Node join PGD ${id || '(không tên)'} phải có quorum dương.`);
    }
    if (node.kind !== 'PARALLEL_JOIN' && node.quorum !== undefined) errors.push(`Node PGD ${id || '(không tên)'} không được khai báo quorum.`);
  }

  const transitionIds = new Set<string>();
  for (const transition of transitions) {
    const id = normalized(transition.id);
    const fromNodeId = normalized(transition.fromNodeId);
    const toNodeId = normalized(transition.toNodeId);
    if (!id) errors.push('Transition PGD phải có id.');
    else if (transitionIds.has(id)) errors.push(`Transition PGD ${id} không được trùng id.`);
    else transitionIds.add(id);
    if (!nodeIds.has(fromNodeId)) errors.push(`Transition ${id || '(không tên)'} trỏ fromNodeId không tồn tại.`);
    if (!nodeIds.has(toNodeId)) errors.push(`Transition ${id || '(không tên)'} trỏ toNodeId không tồn tại.`);
    if (fromNodeId === toNodeId) errors.push(`Transition ${id || '(không tên)'} không được tự trỏ vào chính node.`);
    if (transition.condition !== undefined && !ALLOWED_CONDITIONS.has(transition.condition)) errors.push(`Transition ${id || '(không tên)'} có điều kiện không được allowlist.`);
    if (transition.condition === 'FIELD_MATCH' && !transition.conditionConfig?.expectedProductGroups?.length) errors.push(`Transition ${id || '(không tên)'} dùng FIELD_MATCH phải có expectedProductGroups.`);
    if (transition.condition === 'METHOD_MATCH' && !transition.conditionConfig?.expectedMethodCodes?.length) errors.push(`Transition ${id || '(không tên)'} dùng METHOD_MATCH phải có expectedMethodCodes.`);
    if (transition.priority !== undefined && (!Number.isInteger(transition.priority) || transition.priority < 0)) errors.push(`Transition ${id || '(không tên)'} có priority không hợp lệ.`);
    if (transition.returnPolicy !== undefined && !['REWORK', 'RESTART_DEPENDENCIES', 'RESTART_TEMPLATE'].includes(transition.returnPolicy)) errors.push(`Transition ${id || '(không tên)'} có returnPolicy không hợp lệ.`);
  }

  const activeNodes = nodes.filter((node) => node.active !== false);
  const activeNodeIds = new Set(activeNodes.map((node) => normalized(node.id)));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const transition of transitions) {
    if (!activeNodeIds.has(normalized(transition.fromNodeId)) || !activeNodeIds.has(normalized(transition.toNodeId))) continue;
    incoming.set(normalized(transition.toNodeId), (incoming.get(normalized(transition.toNodeId)) || 0) + 1);
    outgoing.set(normalized(transition.fromNodeId), (outgoing.get(normalized(transition.fromNodeId)) || 0) + 1);
  }
  if (activeNodes.length > 0 && !activeNodes.some((node) => !incoming.has(normalized(node.id)))) errors.push('Template PGD phải có node bắt đầu.');
  if (activeNodes.length > 0 && !activeNodes.some((node) => node.kind === 'END')) errors.push('Template PGD phải có ít nhất một node END.');
  for (const node of activeNodes) {
    if (node.kind === 'PARALLEL_SPLIT' && (outgoing.get(normalized(node.id)) || 0) < 2) errors.push(`Node split PGD ${node.id} phải có ít nhất hai nhánh.`);
    if (node.kind === 'PARALLEL_JOIN' && (incoming.get(normalized(node.id)) || 0) < 2) errors.push(`Node join PGD ${node.id} phải nhận ít nhất hai nhánh.`);
  }
  return { valid: errors.length === 0, errors };
}

export function selectPgdPublishedWorkflowTemplate(
  templates: readonly PgdWorkflowTemplate[],
  context: { productGroup: PgdProductGroup; method?: string },
): PgdWorkflowTemplate | undefined {
  const productGroup = String(context.productGroup || '').trim().toUpperCase();
  const method = String(context.method || '').trim();
  return templates
    .filter((template) => template.status === 'PUBLISHED'
      && validatePgdWorkflowTemplate(template).valid
      && (!(template.appliesTo?.productGroups || []).length || template.appliesTo.productGroups.includes(productGroup as PgdProductGroup))
      && (!(template.appliesTo?.methodCodes || []).length || Boolean(method && template.appliesTo.methodCodes.includes(method)))
    )
    .sort((left, right) => {
      const specificity = (template: PgdWorkflowTemplate) => (
        ((template.appliesTo?.productGroups || []).length ? 10 : 0)
        + ((template.appliesTo?.methodCodes || []).length ? 5 : 0)
      );
      return specificity(right) - specificity(left)
        || right.version - left.version
        || right.updatedAt.localeCompare(left.updatedAt)
        || left.id.localeCompare(right.id);
    })[0];
}

export function snapshotPgdWorkflowTemplate(
  template: PgdWorkflowTemplate,
  input: { capturedAt: string; capturedBy: string },
): PgdWorkflowSnapshot {
  return {
    templateId: template.id,
    templateCode: template.code,
    templateVersion: template.version,
    nodes: JSON.parse(JSON.stringify(template.nodes)) as PgdWorkflowNodeDefinition[],
    transitions: JSON.parse(JSON.stringify(template.transitions)) as PgdWorkflowTransitionDefinition[],
    ...(template.requirementPolicies ? { requirementPolicies: JSON.parse(JSON.stringify(template.requirementPolicies)) as Record<string, PgdcnDossierRequirementPolicy> } : {}),
    capturedAt: input.capturedAt,
    capturedBy: input.capturedBy,
  };
}
