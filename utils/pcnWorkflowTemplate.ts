import type {
  CertificationDossier,
  PcnWorkflowCondition,
  PcnWorkflowNodeDefinition,
  PcnWorkflowSnapshot,
  PcnWorkflowTemplate,
  PcnWorkflowTransitionDefinition,
} from '../types.ts';
import { PCN_PIPELINE_STATIONS } from './pcnDossierPipeline.ts';
import { validateDossierRequirementPolicy } from './pgdcnDossierRequirementPolicy.ts';

export const PCN_WORKFLOW_CONDITIONS = {
  ALWAYS: 'ALWAYS',
  REQUIRED_DOCUMENTS_COMPLETE: 'REQUIRED_DOCUMENTS_COMPLETE',
  ANY_RESULT_RETURNED: 'ANY_RESULT_RETURNED',
  RESULT_PASSED: 'RESULT_PASSED',
  RESULT_FAILED: 'RESULT_FAILED',
  APPROVAL_RETURNED: 'APPROVAL_RETURNED',
  FIELD_MATCH: 'FIELD_MATCH',
  METHOD_MATCH: 'METHOD_MATCH',
} as const satisfies Record<string, PcnWorkflowCondition>;

const ALLOWED_CONDITIONS = new Set<PcnWorkflowCondition>(Object.values(PCN_WORKFLOW_CONDITIONS));

export interface PcnWorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

function normalized(value: unknown): string {
  return String(value || '').trim();
}

function uniqueIds(values: readonly string[]): boolean {
  return new Set(values.map(normalized).filter(Boolean)).size === values.filter((value) => normalized(value)).length;
}

export function validatePcnWorkflowTemplate(template: PcnWorkflowTemplate): PcnWorkflowValidationResult {
  const errors: string[] = [];
  if (!normalized(template?.id)) errors.push('Template phải có id.');
  if (!normalized(template?.code)) errors.push('Template phải có mã.');
  if (!normalized(template?.name)) errors.push('Template phải có tên.');
  if (!Number.isInteger(template?.version) || template.version < 1) errors.push('Version template phải là số nguyên dương.');
  if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(template?.status)) errors.push('Trạng thái template không hợp lệ.');
  if (!Array.isArray(template?.nodes) || template.nodes.length === 0) errors.push('Template phải có ít nhất một node.');
  if (!Array.isArray(template?.transitions)) errors.push('Template phải có danh sách transition.');

  const nodes = Array.isArray(template?.nodes) ? template.nodes : [];
  const transitions = Array.isArray(template?.transitions) ? template.transitions : [];
  const requirementRefs = new Set(nodes.flatMap((node) => Array.isArray(node.requirementIds) ? node.requirementIds : []));
  for (const [requirementId, policy] of Object.entries(template?.requirementPolicies || {})) {
    if (!/^QC[49]-[A-Z0-9_]+$/.test(requirementId)) errors.push(`Yêu cầu ${requirementId} không thuộc danh mục PCN.`);
    if (!requirementRefs.has(requirementId)) errors.push(`Cấu hình yêu cầu ${requirementId} chưa được gắn vào bước nào.`);
    for (const error of validateDossierRequirementPolicy(policy, 'PCN')) errors.push(`Yêu cầu ${requirementId}: ${error}`);
  }
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const id = normalized(node.id);
    if (!id) errors.push('Node phải có id.');
    else if (nodeIds.has(id)) errors.push(`Node ${id} không được trùng id.`);
    else nodeIds.add(id);
    if (!normalized(node.label)) errors.push(`Node ${id || '(không tên)'} phải có nhãn.`);
    if (!['DOCUMENT_TASK', 'APPROVAL_TASK', 'DECISION', 'PARALLEL_SPLIT', 'PARALLEL_JOIN', 'END'].includes(node.kind)) errors.push(`Node ${id || '(không tên)'} có kind không hợp lệ.`);
    if (!Array.isArray(node.requirementIds) || !uniqueIds(node.requirementIds)) errors.push(`Node ${id || '(không tên)'} có requirementIds trùng hoặc không hợp lệ.`);
    if (!Number.isInteger(node.sortOrder) || node.sortOrder < 0) errors.push(`Node ${id || '(không tên)'} có sortOrder không hợp lệ.`);
    if (node.slaDays !== undefined && (!Number.isInteger(node.slaDays) || node.slaDays < 0)) errors.push(`Node ${id || '(không tên)'} có SLA không hợp lệ.`);
    if (node.kind === 'PARALLEL_JOIN') {
      if (!node.joinPolicy) errors.push(`Node join ${id || '(không tên)'} phải có joinPolicy.`);
      if (node.joinPolicy === 'QUORUM' && (!Number.isInteger(node.quorum) || (node.quorum || 0) < 1)) errors.push(`Node join ${id || '(không tên)'} phải có quorum dương.`);
    }
    if (node.kind !== 'PARALLEL_JOIN' && node.quorum !== undefined) errors.push(`Node ${id || '(không tên)'} không được khai báo quorum.`);
  }

  const transitionIds = new Set<string>();
  for (const transition of transitions) {
    const id = normalized(transition.id);
    if (!id) errors.push('Transition phải có id.');
    else if (transitionIds.has(id)) errors.push(`Transition ${id} không được trùng id.`);
    else transitionIds.add(id);
    if (!nodeIds.has(normalized(transition.fromNodeId))) errors.push(`Transition ${id || '(không tên)'} trỏ fromNodeId không tồn tại.`);
    if (!nodeIds.has(normalized(transition.toNodeId))) errors.push(`Transition ${id || '(không tên)'} trỏ toNodeId không tồn tại.`);
    if (normalized(transition.fromNodeId) === normalized(transition.toNodeId)) errors.push(`Transition ${id || '(không tên)'} không được tự trỏ vào chính node.`);
    if (transition.condition !== undefined && !ALLOWED_CONDITIONS.has(transition.condition)) errors.push(`Transition ${id || '(không tên)'} có điều kiện không được allowlist.`);
    const conditionConfig = transition.conditionConfig;
    if (conditionConfig !== undefined && (!conditionConfig || typeof conditionConfig !== 'object' || Array.isArray(conditionConfig))) {
      errors.push(`Transition ${id || '(không tên)'} có conditionConfig không hợp lệ.`);
    } else if (conditionConfig) {
      if (conditionConfig.expectedFieldCodes !== undefined && (!Array.isArray(conditionConfig.expectedFieldCodes) || !uniqueIds(conditionConfig.expectedFieldCodes))) {
        errors.push(`Transition ${id || '(không tên)'} có expectedFieldCodes không hợp lệ.`);
      }
      if (conditionConfig.expectedMethod !== undefined && !['METHOD_1', 'METHOD_5', 'METHOD_7'].includes(conditionConfig.expectedMethod)) {
        errors.push(`Transition ${id || '(không tên)'} có expectedMethod không hợp lệ.`);
      }
    }
    if (transition.condition === 'FIELD_MATCH' && !conditionConfig?.expectedFieldCodes?.length) errors.push(`Transition ${id || '(không tên)'} dùng FIELD_MATCH phải có expectedFieldCodes.`);
    if (transition.condition === 'METHOD_MATCH' && !conditionConfig?.expectedMethod) errors.push(`Transition ${id || '(không tên)'} dùng METHOD_MATCH phải có expectedMethod.`);
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
  if (activeNodes.length > 0 && !activeNodes.some((node) => !incoming.has(node.id))) errors.push('Template phải có node bắt đầu.');
  if (activeNodes.length > 0 && !activeNodes.some((node) => node.kind === 'END')) errors.push('Template phải có ít nhất một node END.');
  for (const node of activeNodes) {
    if (node.kind === 'PARALLEL_SPLIT' && (outgoing.get(node.id) || 0) < 2) errors.push(`Node split ${node.id} phải có ít nhất hai nhánh.`);
    if (node.kind === 'PARALLEL_JOIN' && (incoming.get(node.id) || 0) < 2) errors.push(`Node join ${node.id} phải nhận ít nhất hai nhánh.`);
  }
  return { valid: errors.length === 0, errors };
}

function templateMatches(template: PcnWorkflowTemplate, dossier: Pick<CertificationDossier, 'fieldCodes' | 'method'> & { dossierType?: string }): boolean {
  if (template.status !== 'PUBLISHED') return false;
  const fieldCodes = template.appliesTo?.fieldCodes || [];
  if (fieldCodes.length > 0 && !dossier.fieldCodes.every((code) => fieldCodes.includes(code))) return false;
  if (template.appliesTo?.methods?.length && !template.appliesTo.methods.includes(dossier.method)) return false;
  if (template.appliesTo?.dossierType && template.appliesTo.dossierType !== dossier.dossierType) return false;
  return validatePcnWorkflowTemplate(template).valid;
}

function templateSpecificity(template: PcnWorkflowTemplate, dossier: Pick<CertificationDossier, 'fieldCodes' | 'method'> & { dossierType?: string }): number {
  let score = 0;
  if ((template.appliesTo?.fieldCodes || []).length > 0) score += 10;
  if (template.appliesTo?.methods?.length) score += 5;
  if (template.appliesTo?.dossierType && template.appliesTo.dossierType === dossier.dossierType) score += 2;
  return score;
}

export function selectPcnPublishedWorkflowTemplate(
  templates: readonly PcnWorkflowTemplate[],
  dossier: Pick<CertificationDossier, 'fieldCodes' | 'method'> & { dossierType?: string },
): PcnWorkflowTemplate | undefined {
  return templates
    .filter((template) => templateMatches(template, dossier))
    .sort((left, right) => templateSpecificity(right, dossier) - templateSpecificity(left, dossier)
      || right.version - left.version
      || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
      || left.id.localeCompare(right.id))[0];
}

export function snapshotPcnWorkflowTemplate(
  template: PcnWorkflowTemplate,
  metadata: { capturedAt: string; capturedBy: string },
): PcnWorkflowSnapshot {
  if (template.status !== 'PUBLISHED') throw new Error('Chỉ template PUBLISHED mới được snapshot vào hồ sơ.');
  const validation = validatePcnWorkflowTemplate(template);
  if (!validation.valid) throw new Error(`Template không hợp lệ: ${validation.errors.join(' ')}`);
  return JSON.parse(JSON.stringify({
    templateCode: template.code,
    templateVersion: template.version,
    nodes: template.nodes,
    transitions: template.transitions,
    ...(template.requirementPolicies ? { requirementPolicies: template.requirementPolicies } : {}),
    capturedAt: metadata.capturedAt,
    capturedBy: metadata.capturedBy,
  })) as PcnWorkflowSnapshot;
}

function legacyWorkflowSnapshot(): PcnWorkflowSnapshot {
  const nodes: PcnWorkflowNodeDefinition[] = PCN_PIPELINE_STATIONS.map((station) => ({
    id: station.key.toLowerCase(),
    kind: station.key === 'EXCEPTIONS' ? 'DECISION' : 'DOCUMENT_TASK',
    label: station.title,
    description: station.description,
    actionKey: station.key,
    requirementIds: [],
    active: true,
    sortOrder: station.number || 99,
  }));
  const transitions: PcnWorkflowTransitionDefinition[] = PCN_PIPELINE_STATIONS
    .filter((station) => station.key !== 'EXCEPTIONS')
    .slice(0, -1)
    .map((station, index) => ({
      id: `legacy-${station.key.toLowerCase()}-${index + 1}`,
      fromNodeId: station.key.toLowerCase(),
      toNodeId: PCN_PIPELINE_STATIONS[index + 1].key.toLowerCase(),
      condition: PCN_WORKFLOW_CONDITIONS.ALWAYS,
    }));
  return {
    templateCode: 'LEGACY-PCN-ADAPTER',
    templateVersion: 0,
    nodes,
    transitions,
    capturedAt: new Date(0).toISOString(),
    capturedBy: 'SYSTEM_LEGACY_ADAPTER',
  };
}

export function getPcnWorkflowForDossier(
  dossier: CertificationDossier,
  _templates: readonly PcnWorkflowTemplate[] = [],
): PcnWorkflowSnapshot {
  if (dossier.workflowSnapshot?.nodes?.length) {
    return JSON.parse(JSON.stringify(dossier.workflowSnapshot)) as PcnWorkflowSnapshot;
  }
  return legacyWorkflowSnapshot();
}

export function isPcnWorkflowCondition(value: unknown): value is PcnWorkflowCondition {
  return typeof value === 'string' && ALLOWED_CONDITIONS.has(value as PcnWorkflowCondition);
}

// --- End of pcnWorkflowTemplate.ts ---
