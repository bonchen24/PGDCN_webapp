import type {
  PcnDocumentRequirement,
  PgdcnDossierRequirementPolicy,
  PcnWorkflowCondition,
  PcnWorkflowJoinPolicy,
  PcnWorkflowNodeDefinition,
  PcnWorkflowReturnPolicy,
  PcnWorkflowTemplate,
  PcnWorkflowTransitionDefinition,
} from '../types.ts';
import type { PgdDossierRequirement } from './pgdDossier.ts';
import { validateDossierRequirementPolicy } from './pgdcnDossierRequirementPolicy.ts';
import type {
  PgdWorkflowCondition,
  PgdWorkflowJoinPolicy,
  PgdWorkflowNodeDefinition,
  PgdWorkflowReturnPolicy,
  PgdWorkflowTemplate,
  PgdWorkflowTransitionDefinition,
} from './pgdWorkflowTemplate.ts';

export type DossierTemplateDomain = 'PCN' | 'PGD';
export type DossierTemplateEditorNodeKind = PcnWorkflowNodeDefinition['kind'] | PgdWorkflowNodeDefinition['kind'];
export type DossierTemplateEditorCondition = PcnWorkflowCondition | PgdWorkflowCondition;
export type DossierTemplateEditorJoinPolicy = PcnWorkflowJoinPolicy | PgdWorkflowJoinPolicy;
export type DossierTemplateEditorReturnPolicy = PcnWorkflowReturnPolicy | PgdWorkflowReturnPolicy;

export interface DossierTemplateEditorNode {
  id: string;
  kind: DossierTemplateEditorNodeKind;
  label: string;
  description?: string;
  actionKey?: string;
  assigneeRole?: string;
  slaDays?: number;
  joinPolicy?: DossierTemplateEditorJoinPolicy;
  quorum?: number;
  active: boolean;
  laneId: string;
  column: number;
  sortOrder: number;
  requirementRefs: string[];
}

export interface DossierTemplateEditorTransition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  condition?: DossierTemplateEditorCondition;
  conditionConfig?: Record<string, unknown>;
  priority?: number;
  returnPolicy?: DossierTemplateEditorReturnPolicy;
}

export interface DossierTemplateEditorModel {
  domain: DossierTemplateDomain;
  id: string;
  code: string;
  name: string;
  description?: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  appliesTo: PcnWorkflowTemplate['appliesTo'] | PgdWorkflowTemplate['appliesTo'];
  requirementPolicies?: Record<string, PgdcnDossierRequirementPolicy>;
  nodes: DossierTemplateEditorNode[];
  transitions: DossierTemplateEditorTransition[];
  updatedAt?: string;
}

export interface DossierTemplateEditorValidationResult {
  valid: boolean;
  errors: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function editorNode(input: PcnWorkflowNodeDefinition | PgdWorkflowNodeDefinition, refs: string[]): DossierTemplateEditorNode {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    ...(input.description ? { description: input.description } : {}),
    ...(input.actionKey ? { actionKey: input.actionKey } : {}),
    ...(input.assigneeRole ? { assigneeRole: input.assigneeRole } : {}),
    ...(input.slaDays !== undefined ? { slaDays: input.slaDays } : {}),
    ...(input.joinPolicy ? { joinPolicy: input.joinPolicy } : {}),
    ...(input.quorum !== undefined ? { quorum: input.quorum } : {}),
    active: input.active !== false,
    laneId: input.laneId || 'default',
    column: input.column || 1,
    sortOrder: input.sortOrder,
    requirementRefs: [...refs],
  };
}

function editorTransition(input: PcnWorkflowTransitionDefinition | PgdWorkflowTransitionDefinition): DossierTemplateEditorTransition {
  return {
    id: input.id,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    ...(input.label ? { label: input.label } : {}),
    ...(input.condition ? { condition: input.condition } : {}),
    ...(input.conditionConfig ? { conditionConfig: clone(input.conditionConfig) as Record<string, unknown> } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.returnPolicy ? { returnPolicy: input.returnPolicy } : {}),
  };
}

export function toPcnDossierTemplateEditorModel(template: PcnWorkflowTemplate, _requirements: readonly PcnDocumentRequirement[] = []): DossierTemplateEditorModel {
  return {
    domain: 'PCN',
    id: template.id,
    code: template.code,
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    version: template.version,
    status: template.status,
    appliesTo: clone(template.appliesTo),
    ...(template.requirementPolicies ? { requirementPolicies: clone(template.requirementPolicies) } : {}),
    nodes: template.nodes.map((node) => editorNode(node, node.requirementIds)),
    transitions: template.transitions.map(editorTransition),
    updatedAt: template.updatedAt,
  };
}

export function toPgdDossierTemplateEditorModel(template: PgdWorkflowTemplate, _requirements: readonly PgdDossierRequirement[] = []): DossierTemplateEditorModel {
  return {
    domain: 'PGD',
    id: template.id,
    code: template.code,
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    version: template.version,
    status: template.status,
    appliesTo: clone(template.appliesTo),
    ...(template.requirementPolicies ? { requirementPolicies: clone(template.requirementPolicies) } : {}),
    nodes: template.nodes.map((node) => editorNode(node, node.requirementCodes)),
    transitions: template.transitions.map(editorTransition),
    updatedAt: template.updatedAt,
  };
}

export function fromPcnDossierTemplateEditorModel(model: DossierTemplateEditorModel, base: PcnWorkflowTemplate): PcnWorkflowTemplate {
  if (model.domain !== 'PCN') throw new Error('Không thể chuyển model PGD thành template PCN.');
  return {
    ...clone(base),
    id: model.id,
    code: model.code,
    name: model.name,
    ...(model.description ? { description: model.description } : {}),
    version: model.version,
    status: model.status,
    appliesTo: clone(model.appliesTo) as PcnWorkflowTemplate['appliesTo'],
    ...(model.requirementPolicies ? { requirementPolicies: clone(model.requirementPolicies) } : {}),
    nodes: model.nodes.map((node) => ({
      id: node.id,
      kind: node.kind as PcnWorkflowNodeDefinition['kind'],
      label: node.label,
      ...(node.description ? { description: node.description } : {}),
      ...(node.actionKey ? { actionKey: node.actionKey } : {}),
      ...(node.assigneeRole ? { assigneeRole: node.assigneeRole } : {}),
      ...(node.slaDays !== undefined ? { slaDays: node.slaDays } : {}),
      ...(node.joinPolicy ? { joinPolicy: node.joinPolicy as PcnWorkflowNodeDefinition['joinPolicy'] } : {}),
      ...(node.quorum !== undefined ? { quorum: node.quorum } : {}),
      active: node.active,
      laneId: node.laneId,
      column: node.column,
      sortOrder: node.sortOrder,
      requirementIds: [...node.requirementRefs],
    })),
    transitions: model.transitions.map((transition) => ({
      ...transition,
      condition: transition.condition as PcnWorkflowTransitionDefinition['condition'],
    })),
  };
}

export function fromPgdDossierTemplateEditorModel(model: DossierTemplateEditorModel, base: PgdWorkflowTemplate): PgdWorkflowTemplate {
  if (model.domain !== 'PGD') throw new Error('Không thể chuyển model PCN thành template PGD.');
  return {
    ...clone(base),
    domain: 'pgd',
    id: model.id,
    code: model.code,
    name: model.name,
    ...(model.description ? { description: model.description } : {}),
    version: model.version,
    status: model.status,
    appliesTo: clone(model.appliesTo) as PgdWorkflowTemplate['appliesTo'],
    ...(model.requirementPolicies ? { requirementPolicies: clone(model.requirementPolicies) } : {}),
    nodes: model.nodes.map((node) => ({
      id: node.id,
      kind: node.kind as PgdWorkflowNodeDefinition['kind'],
      label: node.label,
      ...(node.description ? { description: node.description } : {}),
      ...(node.actionKey ? { actionKey: node.actionKey } : {}),
      ...(node.assigneeRole ? { assigneeRole: node.assigneeRole } : {}),
      ...(node.slaDays !== undefined ? { slaDays: node.slaDays } : {}),
      ...(node.joinPolicy ? { joinPolicy: node.joinPolicy as PgdWorkflowNodeDefinition['joinPolicy'] } : {}),
      ...(node.quorum !== undefined ? { quorum: node.quorum } : {}),
      active: node.active,
      laneId: node.laneId,
      column: node.column,
      sortOrder: node.sortOrder,
      requirementCodes: [...node.requirementRefs],
    })),
    transitions: model.transitions.map((transition) => ({
      ...transition,
      condition: transition.condition as PgdWorkflowTransitionDefinition['condition'],
    })),
  };
}

function validPcnRequirementRef(model: DossierTemplateEditorModel, ref: string): boolean {
  if (!/^QC[49]-[A-Z0-9_]+$/.test(ref)) return false;
  const fieldCodes = (model.appliesTo as PcnWorkflowTemplate['appliesTo']).fieldCodes || [];
  return fieldCodes.length === 0 || fieldCodes.some((fieldCode) => ref.startsWith(`${fieldCode}-`));
}

function validPgdRequirementRef(ref: string): boolean {
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(ref) && !/^QC[49]-/.test(ref);
}

const ALLOWED_CONDITIONS = new Set<string>([
  'ALWAYS',
  'REQUIRED_DOCUMENTS_COMPLETE',
  'ANY_RESULT_RETURNED',
  'RESULT_PASSED',
  'RESULT_FAILED',
  'APPROVAL_RETURNED',
  'FIELD_MATCH',
  'METHOD_MATCH',
]);

export function validateDossierTemplateEditorModel(model: DossierTemplateEditorModel): DossierTemplateEditorValidationResult {
  const errors: string[] = [];
  if (!['PCN', 'PGD'].includes(model?.domain)) errors.push('Mô hình phải có lĩnh vực hợp lệ.');
  if (!String(model?.id || '').trim()) errors.push('Bộ hồ sơ mẫu phải có id.');
  if (!String(model?.code || '').trim()) errors.push('Bộ hồ sơ mẫu phải có mã.');
  if (!String(model?.name || '').trim()) errors.push('Bộ hồ sơ mẫu phải có tên.');
  if (!Number.isInteger(model?.version) || model.version < 1) errors.push('Version bộ hồ sơ mẫu không hợp lệ.');
  if (!Array.isArray(model?.nodes) || model.nodes.length === 0) errors.push('Bộ hồ sơ mẫu phải có ít nhất một node.');
  if (!Array.isArray(model?.transitions)) errors.push('Bộ hồ sơ mẫu phải có danh sách nối node.');

  const nodes = Array.isArray(model?.nodes) ? model.nodes : [];
  const transitions = Array.isArray(model?.transitions) ? model.transitions : [];
  const referencedRequirements = new Set(nodes.flatMap((node) => Array.isArray(node.requirementRefs) ? node.requirementRefs : []));
  for (const [requirementId, policy] of Object.entries(model?.requirementPolicies || {})) {
    if (!referencedRequirements.has(requirementId)) errors.push(`Cấu hình yêu cầu ${requirementId} chưa được gắn vào bước nào.`);
    const policyErrors = validateDossierRequirementPolicy(policy, model.domain);
    for (const error of policyErrors) errors.push(`Yêu cầu ${requirementId}: ${error}`);
  }
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const id = String(node.id || '').trim();
    if (!id) errors.push('Node phải có id.');
    else if (nodeIds.has(id)) errors.push(`Node ${id} không được trùng id.`);
    else nodeIds.add(id);
    if (!String(node.label || '').trim()) errors.push(`Node ${id || '(không tên)'} phải có tên hiển thị.`);
    if (!Number.isInteger(node.column) || node.column < 1) errors.push(`Node ${id || '(không tên)'} phải nằm ở cột hợp lệ.`);
    if (!Number.isInteger(node.sortOrder) || node.sortOrder < 0) errors.push(`Node ${id || '(không tên)'} có thứ tự không hợp lệ.`);
    if (!Array.isArray(node.requirementRefs) || new Set(node.requirementRefs).size !== node.requirementRefs.length) errors.push(`Node ${id || '(không tên)'} có tài liệu gán trùng.`);
    for (const ref of node.requirementRefs || []) {
      const valid = model.domain === 'PCN' ? validPcnRequirementRef(model, String(ref)) : validPgdRequirementRef(String(ref));
      if (!valid) errors.push(`Node ${id || '(không tên)'} có tài liệu không thuộc domain ${model.domain}.`);
    }
    if (node.kind === 'PARALLEL_JOIN') {
      if (!node.joinPolicy) errors.push(`Node join ${id || '(không tên)'} cần chính sách gom nhánh.`);
      if (node.joinPolicy === 'QUORUM' && (!Number.isInteger(node.quorum) || (node.quorum || 0) < 1)) errors.push(`Node join ${id || '(không tên)'} cần số nhánh tối thiểu.`);
    }
  }

  const transitionIds = new Set<string>();
  for (const transition of transitions) {
    const id = String(transition.id || '').trim();
    if (!id) errors.push('Nối node phải có id.');
    else if (transitionIds.has(id)) errors.push(`Nối node ${id} không được trùng id.`);
    else transitionIds.add(id);
    if (!nodeIds.has(transition.fromNodeId)) errors.push(`Nối node ${id || '(không tên)'} có node nguồn không tồn tại.`);
    if (!nodeIds.has(transition.toNodeId)) errors.push(`Nối node ${id || '(không tên)'} có node đích không tồn tại.`);
    if (transition.fromNodeId === transition.toNodeId) errors.push(`Nối node ${id || '(không tên)'} không được tự nối.`);
    if (transition.condition && !ALLOWED_CONDITIONS.has(transition.condition)) errors.push(`Nối node ${id || '(không tên)'} có điều kiện không được hỗ trợ.`);
    const conditionConfig = transition.conditionConfig && typeof transition.conditionConfig === 'object' ? transition.conditionConfig : {};
    if (transition.condition === 'FIELD_MATCH') {
      const values = model.domain === 'PCN' ? conditionConfig.expectedFieldCodes : conditionConfig.expectedProductGroups;
      if (!Array.isArray(values) || values.length === 0) errors.push(`Nối node ${id || '(không tên)'} dùng FIELD_MATCH phải có tham số phạm vi.`);
    }
    if (transition.condition === 'METHOD_MATCH') {
      const values = model.domain === 'PCN' ? conditionConfig.expectedMethod : conditionConfig.expectedMethodCodes;
      if (model.domain === 'PCN' ? typeof values !== 'string' || !values.trim() : !Array.isArray(values) || values.length === 0) errors.push(`Nối node ${id || '(không tên)'} dùng METHOD_MATCH phải có tham số phương thức.`);
    }
  }

  const activeNodes = nodes.filter((node) => node.active !== false);
  const activeIds = new Set(activeNodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const transition of transitions) {
    if (!activeIds.has(transition.fromNodeId) || !activeIds.has(transition.toNodeId)) continue;
    incoming.set(transition.toNodeId, (incoming.get(transition.toNodeId) || 0) + 1);
    outgoing.set(transition.fromNodeId, (outgoing.get(transition.fromNodeId) || 0) + 1);
  }
  if (activeNodes.length > 0 && !activeNodes.some((node) => !incoming.has(node.id))) errors.push('Bộ hồ sơ mẫu phải có node bắt đầu.');
  if (activeNodes.length > 0 && !activeNodes.some((node) => node.kind === 'END')) errors.push('Bộ hồ sơ mẫu phải có ít nhất một node kết thúc.');
  for (const node of activeNodes) {
    if (node.kind === 'PARALLEL_SPLIT' && (outgoing.get(node.id) || 0) < 2) errors.push(`Node split ${node.id} cần ít nhất hai nhánh.`);
    if (node.kind === 'PARALLEL_JOIN' && (incoming.get(node.id) || 0) < 2) errors.push(`Node join ${node.id} cần ít nhất hai nhánh.`);
  }
  return { valid: errors.length === 0, errors };
}

export function countTemplateRequirements(model: Pick<DossierTemplateEditorModel, 'nodes'>): number {
  return new Set(model.nodes.flatMap((node) => node.requirementRefs)).size;
}

export function moveDossierTemplateEditorNode(
  model: DossierTemplateEditorModel,
  nodeId: string,
  position: { laneId: string; column: number; sortOrder?: number },
): DossierTemplateEditorModel {
  return {
    ...clone(model),
    nodes: model.nodes.map((node) => node.id === nodeId
      ? { ...node, laneId: position.laneId, column: position.column, ...(position.sortOrder === undefined ? {} : { sortOrder: position.sortOrder }) }
      : { ...node }),
  };
}

export function connectDossierTemplateEditorNodes(model: DossierTemplateEditorModel, sourceId: string, targetId: string): DossierTemplateEditorModel {
  if (sourceId === targetId || !model.nodes.some((node) => node.id === sourceId) || !model.nodes.some((node) => node.id === targetId)) return clone(model);
  const existing = model.transitions.find((transition) => transition.fromNodeId === sourceId && transition.toNodeId === targetId);
  if (existing) return clone(model);
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'node';
  const id = `edge-${safe(sourceId)}-${safe(targetId)}`;
  return {
    ...clone(model),
    transitions: [...model.transitions, { id, fromNodeId: sourceId, toNodeId: targetId, condition: 'ALWAYS' }],
  };
}
