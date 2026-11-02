import type {
  DossierTemplateRequirementDefinition,
  DossierTemplateStageDefinition,
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
export type { DossierTemplateStageDefinition };
export type DossierTemplateEditorNodeKind = PcnWorkflowNodeDefinition['kind'] | PgdWorkflowNodeDefinition['kind'];
export type DossierTemplateEditorCondition = PcnWorkflowCondition | PgdWorkflowCondition;
export type DossierTemplateEditorJoinPolicy = PcnWorkflowJoinPolicy | PgdWorkflowJoinPolicy;
export type DossierTemplateEditorReturnPolicy = PcnWorkflowReturnPolicy | PgdWorkflowReturnPolicy;

export const DEFAULT_DOSSIER_TEMPLATE_STAGES: readonly DossierTemplateStageDefinition[] = [
  { id: 'intake-documents', label: 'Tiếp nhận yêu cầu & tài liệu khách hàng', sortOrder: 10 },
  { id: 'scope-assignment', label: 'Xem xét yêu cầu & phân công', sortOrder: 20 },
  { id: 'onsite-assessment', label: 'Đánh giá/giám định tại chỗ', sortOrder: 30 },
  { id: 'testing-evidence', label: 'Thử nghiệm & tổng hợp bằng chứng', sortOrder: 40 },
  { id: 'corrective-action', label: 'Hành động khắc phục', sortOrder: 50 },
  { id: 'review-approval', label: 'Soát xét & phê duyệt kết quả', sortOrder: 60 },
  { id: 'issuance-archive', label: 'Phát hành, bàn giao & lưu trữ', sortOrder: 70 },
];

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
  stageId?: string;
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
  stages?: DossierTemplateStageDefinition[];
  requirementDefinitions?: DossierTemplateRequirementDefinition[];
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

const CUSTOM_REQUIREMENT_ID = /^(pcn|pgd)-custom-[a-z0-9-]{4,80}$/;
const CUSTOM_REQUIREMENT_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const CUSTOM_REQUIREMENT_CONDITIONS = new Set(['RESULT_FAILED', 'RESULT_PASSED']);

const CUSTOM_REQUIREMENT_ROLES: Record<DossierTemplateDomain, Set<string>> = {
  PCN: new Set(['CUSTOMER', 'LEADERSHIP', 'CERTIFICATION_EXPERT', 'TECHNICAL_REVIEWER', 'SAMPLE_COORDINATOR', 'DOCUMENT_CLERK']),
  PGD: new Set(['CUSTOMER', 'PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL', 'PGD_FIELD_INSPECTOR', 'PGD_DOCUMENT_CLERK']),
};

const CUSTOM_REQUIREMENT_MODULES: Record<DossierTemplateDomain, Set<string>> = {
  PCN: new Set(['PROPOSAL_FORM', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'LAB_RESULT', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW', 'APPROVAL_PACKAGE', 'REQUEST', 'FIELD_ASSESSMENT', 'TESTING', 'RESULT', 'ISSUANCE']),
  PGD: new Set(['PYC_REQUEST', 'ASSIGNMENT', 'FIELD_INSPECTION', 'SAMPLE_HANDOVER', 'LAB_RESULT', 'REPORT', 'APPROVAL', 'DELIVERY_ARCHIVE', 'REQUEST', 'FIELD_ASSESSMENT', 'TESTING', 'CORRECTIVE_ACTION', 'RESULT', 'ISSUANCE']),
};

export interface DossierTemplateRequirementValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDossierTemplateRequirementDefinition(
  value: DossierTemplateRequirementDefinition,
  expectedDomain: DossierTemplateDomain,
): DossierTemplateRequirementValidationResult {
  const requirement = value as Partial<DossierTemplateRequirementDefinition> | null | undefined;
  const errors: string[] = [];
  const clean = (input: unknown) => String(input ?? '').trim();
  const id = clean(requirement?.id);
  const code = clean(requirement?.code);
  const name = clean(requirement?.name);
  const source = clean(requirement?.source);
  const condition = clean(requirement?.condition);
  const linkedDocxTemplateId = clean(requirement?.linkedDocxTemplateId);
  const businessModuleKey = clean(requirement?.businessModuleKey);

  if (requirement?.domain !== expectedDomain) errors.push('Requirement custom không thuộc đúng domain.');
  if (!CUSTOM_REQUIREMENT_ID.test(id) || !id.startsWith(`${expectedDomain.toLowerCase()}-custom-`)) errors.push('Requirement custom phải có id ổn định theo domain.');
  if (!CUSTOM_REQUIREMENT_CODE.test(code) || code.length > 64) errors.push('Mã requirement custom không hợp lệ.');
  if (!name || name.length > 200) errors.push('Tên requirement custom phải từ 1 đến 200 ký tự.');
  if (clean(requirement?.description).length > 1000) errors.push('Mô tả requirement custom không được vượt quá 1000 ký tự.');
  if (!['REQUIRED', 'OPTIONAL', 'CONDITIONAL'].includes(clean(requirement?.level))) errors.push('Mức requirement không hợp lệ.');
  if (!['UPLOAD_EXTERNAL', 'DRAFT_FROM_DOCX_TEMPLATE', 'BUSINESS_MODULE_LINK'].includes(source)) errors.push('Nguồn requirement không thuộc allowlist.');
  if (!['SINGLE', 'MULTIPLE'].includes(clean(requirement?.multiplicity))) errors.push('Số lượng file của requirement không hợp lệ.');
  if (!CUSTOM_REQUIREMENT_ROLES[expectedDomain].has(clean(requirement?.ownerRole))) errors.push('Vai trò phụ trách requirement không thuộc allowlist của domain.');

  if (requirement?.level === 'CONDITIONAL') {
    if (!CUSTOM_REQUIREMENT_CONDITIONS.has(condition)) errors.push('Requirement có điều kiện phải dùng condition trong allowlist.');
  } else if (condition) {
    errors.push('Chỉ requirement CONDITIONAL mới được có condition.');
  }

  if (source === 'DRAFT_FROM_DOCX_TEMPLATE') {
    if (!/^[a-zA-Z0-9._-]{1,160}$/.test(linkedDocxTemplateId)) errors.push('Requirement tạo từ DOCX phải liên kết một template DOCX hợp lệ.');
    if (businessModuleKey) errors.push('Requirement DOCX không được đồng thời liên kết module nghiệp vụ.');
  } else if (linkedDocxTemplateId) {
    errors.push('Chỉ requirement có nguồn DOCX mới được liên kết template DOCX.');
  }

  if (source === 'BUSINESS_MODULE_LINK') {
    if (!CUSTOM_REQUIREMENT_MODULES[expectedDomain].has(businessModuleKey)) errors.push('Module nghiệp vụ không thuộc allowlist của domain.');
  } else if (businessModuleKey) {
    errors.push('Chỉ requirement liên kết nghiệp vụ mới được có module key.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateDossierTemplateRequirementDefinitions(
  definitions: readonly DossierTemplateRequirementDefinition[] | undefined,
  expectedDomain: DossierTemplateDomain,
): DossierTemplateRequirementValidationResult {
  const errors: string[] = [];
  if (definitions === undefined) return { valid: true, errors };
  if (!Array.isArray(definitions)) return { valid: false, errors: ['Danh sách requirement custom không hợp lệ.'] };
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const definition of definitions) {
    errors.push(...validateDossierTemplateRequirementDefinition(definition, expectedDomain).errors);
    const id = String(definition?.id || '').trim();
    const code = String(definition?.code || '').trim().toUpperCase();
    if (id && ids.has(id)) errors.push(`Requirement custom ${id} bị trùng id.`);
    if (code && codes.has(code)) errors.push(`Requirement custom ${code} bị trùng mã.`);
    if (id) ids.add(id);
    if (code) codes.add(code);
  }
  return { valid: errors.length === 0, errors };
}

function inferLegacyStageId(node: PcnWorkflowNodeDefinition | PgdWorkflowNodeDefinition): string {
  const key = `${node.stageId || ''} ${node.laneId || ''} ${node.actionKey || ''} ${node.id} ${node.label}`.toLowerCase();
  if (/end|archive|issu|deliver|certificate|sign|lưu trữ|phát hành|bàn giao/.test(key)) return 'issuance-archive';
  if (/exception|correct|repair|khắc phục|ngoại lệ/.test(key)) return 'corrective-action';
  if (/technical|review|approval|report|soát xét|phê duyệt|báo cáo/.test(key)) return 'review-approval';
  if (/lab|test|result|evidence|sampling|sample|ptn|kqtn|thử nghiệm/.test(key)) return 'testing-evidence';
  if (/field|onsite|inspection|evaluation|hiện trường|tại chỗ|đánh giá|giám định/.test(key)) return 'onsite-assessment';
  if (/scope|capability|assignment|preparation|plan|phạm vi|năng lực|phân công|kế hoạch/.test(key)) return 'scope-assignment';
  return 'intake-documents';
}

function stagesForTemplate(
  configuredStages: readonly DossierTemplateStageDefinition[] | undefined,
  nodes: readonly DossierTemplateEditorNode[],
): DossierTemplateStageDefinition[] {
  const stages = clone(configuredStages?.length ? [...configuredStages] : [...DEFAULT_DOSSIER_TEMPLATE_STAGES]);
  const requirementIds = new Map(stages.map((stage) => [stage.id, new Set(stage.requirementIds || [])]));
  for (const node of nodes) {
    const hasKnownStage = stages.some((stage) => stage.id === node.stageId);
    const stageId = hasKnownStage ? node.stageId! : stages[0]?.id;
    if (!stageId) continue;
    const configuredStage = configuredStages?.find((stage) => stage.id === stageId);
    if (hasKnownStage && Array.isArray(configuredStage?.requirementIds)) continue;
    const current = requirementIds.get(stageId) || new Set<string>();
    node.requirementRefs.forEach((id) => current.add(id));
    requirementIds.set(stageId, current);
  }
  return stages.map((stage) => ({ ...stage, requirementIds: [...(requirementIds.get(stage.id) || [])] }));
}

export function setDossierTemplateStageRequirement(
  model: DossierTemplateEditorModel,
  stageId: string,
  requirementId: string,
  included: boolean,
): DossierTemplateEditorModel {
  const stages = model.stages?.length
    ? model.stages
    : DEFAULT_DOSSIER_TEMPLATE_STAGES.map((stage) => ({ ...stage, requirementIds: [] }));
  return {
    ...model,
    stages: stages.map((stage) => {
      if (stage.id !== stageId) return stage;
      const requirementIds = new Set(stage.requirementIds || []);
      if (included) requirementIds.add(requirementId);
      else requirementIds.delete(requirementId);
      return { ...stage, requirementIds: [...requirementIds] };
    }),
  };
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
    stageId: input.stageId || inferLegacyStageId(input),
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
  const nodes = template.nodes.map((node) => editorNode(node, node.requirementIds));
  return {
    domain: 'PCN',
    id: template.id,
    code: template.code,
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    version: template.version,
    status: template.status,
    appliesTo: clone(template.appliesTo),
    stages: stagesForTemplate(template.stages, nodes),
    ...(template.requirementDefinitions ? { requirementDefinitions: clone(template.requirementDefinitions) } : {}),
    ...(template.requirementPolicies ? { requirementPolicies: clone(template.requirementPolicies) } : {}),
    nodes,
    transitions: template.transitions.map(editorTransition),
    updatedAt: template.updatedAt,
  };
}

export function toPgdDossierTemplateEditorModel(template: PgdWorkflowTemplate, _requirements: readonly PgdDossierRequirement[] = []): DossierTemplateEditorModel {
  const nodes = template.nodes.map((node) => editorNode(node, node.requirementCodes));
  return {
    domain: 'PGD',
    id: template.id,
    code: template.code,
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    version: template.version,
    status: template.status,
    appliesTo: clone(template.appliesTo),
    stages: stagesForTemplate(template.stages, nodes),
    ...(template.requirementDefinitions ? { requirementDefinitions: clone(template.requirementDefinitions) } : {}),
    ...(template.requirementPolicies ? { requirementPolicies: clone(template.requirementPolicies) } : {}),
    nodes,
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
    stages: clone(model.stages || [...DEFAULT_DOSSIER_TEMPLATE_STAGES]),
    ...(model.requirementDefinitions ? { requirementDefinitions: clone(model.requirementDefinitions) } : {}),
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
      ...(node.stageId ? { stageId: node.stageId } : {}),
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
    stages: clone(model.stages || [...DEFAULT_DOSSIER_TEMPLATE_STAGES]),
    ...(model.requirementDefinitions ? { requirementDefinitions: clone(model.requirementDefinitions) } : {}),
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
      ...(node.stageId ? { stageId: node.stageId } : {}),
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

export function validateDossierTemplateEditorModel(model: DossierTemplateEditorModel, options: { allowIncompleteDraft?: boolean } = {}): DossierTemplateEditorValidationResult {
  const errors: string[] = [];
  if (!['PCN', 'PGD'].includes(model?.domain)) errors.push('Mô hình phải có lĩnh vực hợp lệ.');
  if (!String(model?.id || '').trim()) errors.push('Bộ hồ sơ mẫu phải có id.');
  if (!String(model?.code || '').trim()) errors.push('Bộ hồ sơ mẫu phải có mã.');
  if (!String(model?.name || '').trim()) errors.push('Bộ hồ sơ mẫu phải có tên.');
  if (!Number.isInteger(model?.version) || model.version < 1) errors.push('Version bộ hồ sơ mẫu không hợp lệ.');
  if (!Array.isArray(model?.nodes) || model.nodes.length === 0) errors.push('Bộ hồ sơ mẫu phải có ít nhất một node.');
  if (!Array.isArray(model?.transitions)) errors.push('Bộ hồ sơ mẫu phải có danh sách nối node.');
  const definitionsValidation = validateDossierTemplateRequirementDefinitions(model?.requirementDefinitions, model?.domain);
  errors.push(...definitionsValidation.errors);

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
      const isDefinedCustom = (model.requirementDefinitions || []).some((definition) => definition.id === String(ref) && definition.domain === model.domain);
      const valid = isDefinedCustom || (model.domain === 'PCN' ? validPcnRequirementRef(model, String(ref)) : validPgdRequirementRef(String(ref)));
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
  const remainingErrors = options.allowIncompleteDraft
    ? errors.filter((error) => !['node bắt đầu', 'node kết thúc', 'node split', 'node join'].some((phrase) => error.toLocaleLowerCase('vi-VN').includes(phrase)))
    : errors;
  return { valid: remainingErrors.length === 0, errors: remainingErrors };
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
