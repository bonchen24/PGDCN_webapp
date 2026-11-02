import type {
  PcnApprovalStep,
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDossierStatus,
  PcnDocumentRequirement,
  PcnSampleLot,
  PcnSampleRoute,
  IssuancePackage,
  OutboundLabRequest,
  ReturnedTestResult,
  PcnGeneratedDocumentKind,
  PcnDraftFormKind,
  PcnDraftWorkspace,
} from '../types.ts';
import type { PcnWorkflowRuntimeNode } from './pcnWorkflowRuntime.ts';
import type { PcnWorkflowNodeDefinition } from '../types.ts';
import { getPcnDraftFormRequirementCode } from './pcnDossierDocuments.ts';

export type PcnDossierNodeWorkStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'UPLOADED'
  | 'GENERATED'
  | 'CONFIRMED'
  | 'WAIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ATTENTION'
  | 'NOT_APPLICABLE';

export type PcnDossierNodeDocumentAction = 'VIEW' | 'REPLACE' | 'REMOVE_CURRENT' | 'UPLOAD' | 'CREATE_FROM_FORM' | 'CONFIRM' | 'WAIVE' | 'CLEAR_WAIVER';

/** Generated forms with a deterministic checklist counterpart for node work. */
const NODE_FORM_KIND_BY_REQUIREMENT_CODE: Readonly<Partial<Record<string, PcnGeneratedDocumentKind>>> = {
  PROPOSAL: 'PROPOSAL_FORM',
  ASSIGNMENT_FORM: 'ASSIGNMENT_FORM',
  EVALUATION_PLAN: 'EVALUATION_PLAN',
  FIELD_INSPECTION: 'FIELD_INSPECTION',
  SAMPLE_CODING: 'SAMPLE_CODING',
  SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
  SAMPLE_RETURN: 'SAMPLE_RETURN',
  LAB_REQUEST: 'LAB_REQUEST',
};

const NODE_DRAFT_FORM_KIND_BY_REQUIREMENT_CODE: Readonly<Partial<Record<string, PcnDraftFormKind>>> = {
  PROPOSAL: 'PROPOSAL_FORM',
  COMMERCIAL: 'COMMERCIAL',
  ASSIGNMENT_FORM: 'ASSIGNMENT_FORM',
  EVALUATION_PLAN: 'EVALUATION_PLAN',
  FIELD_INSPECTION: 'FIELD_INSPECTION',
  SAMPLE_CODING: 'SAMPLE_CODING',
  SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
  LAB_REQUEST: 'LAB_REQUEST',
  CERTIFICATION_RESULT: 'CERTIFICATION_RESULT',
  CLIENT_PACKAGE: 'CLIENT_PACKAGE',
};

export function getPcnNodeDocumentGenerationKind(requirementCode: string): PcnGeneratedDocumentKind | undefined {
  return NODE_FORM_KIND_BY_REQUIREMENT_CODE[String(requirementCode || '').trim().toUpperCase()];
}

export function getPcnNodeDraftFormKind(requirementCode: string): PcnDraftFormKind | undefined {
  return NODE_DRAFT_FORM_KIND_BY_REQUIREMENT_CODE[String(requirementCode || '').trim().toUpperCase()];
}

export interface PcnDossierNodeBusinessFact {
  id: string;
  label: string;
  status: Extract<PcnDossierNodeWorkStatus, 'IN_PROGRESS' | 'COMPLETED' | 'ATTENTION' | 'NOT_APPLICABLE'>;
  actionLabel?: string;
  reason?: string;
}

export interface PcnDossierNodeBusinessFactsInput {
  actionKey?: string;
  dossierId: string;
  dossierStatus?: PcnDossierStatus;
  ownerUsername?: string;
  sampleLots?: readonly Pick<PcnSampleLot, 'id' | 'dossierId' | 'status'>[];
  sampleRoutes?: readonly Pick<PcnSampleRoute, 'id' | 'sampleLotId' | 'status' | 'labRequestId'>[];
  labRequests?: readonly Pick<OutboundLabRequest, 'id' | 'dossierId' | 'status' | 'sampleRouteId'>[];
  results?: readonly Pick<ReturnedTestResult, 'id' | 'dossierId' | 'labRequestId' | 'round' | 'outcome' | 'receivedAt'>[];
  approvalSteps?: readonly Pick<PcnApprovalStep, 'id' | 'dossierId' | 'status'>[];
  issuancePackages?: readonly Pick<IssuancePackage, 'id' | 'dossierId' | 'status'>[];
}

export interface PcnDossierNodeDocumentItem {
  kind: 'DOCUMENT_REQUIREMENT';
  requirementId: string;
  code: string;
  label: string;
  required: boolean;
  status: Extract<PcnDossierNodeWorkStatus, 'PRESENT' | 'MISSING' | 'UPLOADED' | 'GENERATED' | 'CONFIRMED' | 'WAIVED'>;
  currentVersionId?: string;
  actions: PcnDossierNodeDocumentAction[];
  waiverReason?: string;
  pendingDraftId?: string;
}

export interface PcnDossierNodeWorkProjection {
  nodeId: string;
  nodeLabel: string;
  status: PcnWorkflowRuntimeNode['status'];
  cycleNo: number;
  blockedReason?: PcnWorkflowRuntimeNode['blockedReason'];
  documents: PcnDossierNodeDocumentItem[];
  businessFacts: PcnDossierNodeBusinessFact[];
  unresolvedRequiredCount: number;
  suggestions: string[];
  canContinue: boolean;
  isSelectable: boolean;
  isEditable: boolean;
  requiresReworkOnMutation: boolean;
}

export interface PcnDossierNodeWorkProjectionInput {
  node: Pick<PcnWorkflowNodeDefinition, 'id' | 'label' | 'requirementIds'> & { actionKey?: string; status?: PcnWorkflowRuntimeNode['status']; cycleNo?: number; blockedReason?: PcnWorkflowRuntimeNode['blockedReason'] };
  runtimeNode?: PcnWorkflowRuntimeNode;
  requirements: readonly PcnDocumentRequirement[];
  documents?: readonly Pick<PcnDossierDocument, 'requirementId' | 'status' | 'lifecycleStatus' | 'currentVersionId'>[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  businessFacts?: readonly PcnDossierNodeBusinessFact[];
  draftWorkspaces?: readonly PcnDraftWorkspace[];
}

const ACTIVE_STATUSES = new Set<PcnWorkflowRuntimeNode['status']>(['READY', 'IN_PROGRESS', 'WAITING', 'RETURNED']);
const SELECTABLE_STATUSES = new Set<PcnWorkflowRuntimeNode['status']>([...ACTIVE_STATUSES, 'COMPLETED']);

const COMPLETED_SAMPLE_ROUTE_STATUSES = new Set<PcnSampleRoute['status']>(['SENT', 'RECEIVED', 'RESULT_RETURNED', 'RETURNED_TO_PCN', 'CLOSED']);

function businessFact(id: string, label: string, status: PcnDossierNodeBusinessFact['status'], actionLabel: string, reason?: string): PcnDossierNodeBusinessFact {
  return { id, label, status, actionLabel, ...(reason ? { reason } : {}) };
}

export function buildPcnDossierNodeBusinessFacts(input: PcnDossierNodeBusinessFactsInput): PcnDossierNodeBusinessFact[] {
  const actionKey = String(input.actionKey || '').trim().toUpperCase();
  const sampleLots = (input.sampleLots || []).filter((lot) => lot.dossierId === input.dossierId);
  const sampleLotIds = new Set(sampleLots.map((lot) => lot.id));
  const sampleRoutes = (input.sampleRoutes || []).filter((route) => sampleLotIds.has(route.sampleLotId));
  const labRequests = (input.labRequests || []).filter((request) => request.dossierId === input.dossierId);
  const results = (input.results || []).filter((result) => result.dossierId === input.dossierId);
  const approvalSteps = (input.approvalSteps || []).filter((step) => step.dossierId === input.dossierId);
  const issuancePackages = (input.issuancePackages || []).filter((item) => item.dossierId === input.dossierId);

  if (actionKey === 'ASSIGNMENT') {
    return [input.ownerUsername?.trim()
      ? businessFact('assignment', 'Phân công hồ sơ', 'COMPLETED', 'Mở phân công hồ sơ')
      : businessFact('assignment', 'Phân công hồ sơ', 'ATTENTION', 'Mở phân công hồ sơ', 'Hồ sơ chưa có người phụ trách')];
  }
  if (['SAMPLING_LAB', 'LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(actionKey)) {
    if (sampleRoutes.length === 0) return [businessFact('sample-flow', 'Mẫu / PYC', 'ATTENTION', 'Mở sổ mẫu', 'Chưa có lô hoặc tuyến mẫu thuộc hồ sơ')];
    const relevantRequests = labRequests.filter((request) => !request.sampleRouteId || sampleRoutes.some((route) => route.id === request.sampleRouteId));
    const routeComplete = sampleRoutes.every((route) => COMPLETED_SAMPLE_ROUTE_STATUSES.has(route.status));
    const requestComplete = actionKey === 'SAMPLE_CODING' || actionKey === 'SAMPLE_HANDOVER' || actionKey === 'SAMPLE_RETURN'
      ? routeComplete
      : relevantRequests.length > 0 && relevantRequests.every((request) => request.status !== 'DRAFT');
    return [businessFact('sample-flow', 'Mẫu / PYC', requestComplete ? 'COMPLETED' : 'IN_PROGRESS', 'Mở sổ mẫu', requestComplete ? undefined : 'Còn tuyến mẫu hoặc PYC chưa hoàn tất')];
  }
  if (['TECHNICAL_REVIEW', 'TEST_REPORT'].includes(actionKey)) {
    return [results.length > 0
      ? businessFact('results', 'KQTN', 'COMPLETED', 'Mở KQTN')
      : businessFact('results', 'KQTN', 'ATTENTION', 'Mở KQTN', 'Chưa có KQTN chính thức')];
  }
  if (actionKey === 'APPROVAL') {
    if (approvalSteps.length === 0) return [businessFact('approval', 'Phê duyệt hồ sơ', 'ATTENTION', 'Mở phê duyệt', 'Chưa có bước phê duyệt')];
    if (approvalSteps.some((step) => step.status === 'RETURNED')) return [businessFact('approval', 'Phê duyệt hồ sơ', 'ATTENTION', 'Mở phê duyệt', 'Hồ sơ phê duyệt đã bị trả lại')];
    if (approvalSteps.every((step) => step.status === 'APPROVED')) return [businessFact('approval', 'Phê duyệt hồ sơ', 'COMPLETED', 'Mở phê duyệt')];
    return [businessFact('approval', 'Phê duyệt hồ sơ', 'IN_PROGRESS', 'Mở phê duyệt', 'Còn bước phê duyệt đang chờ')];
  }
  if (actionKey === 'ISSUANCE') {
    const issuance = issuancePackages[0];
    if (!issuance) return [businessFact('issuance', 'Phát hành chứng thư / quyết định', 'ATTENTION', 'Mở phát hành', 'Chưa có gói phát hành cho hồ sơ')];
    if (['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status)) return [businessFact('issuance', 'Phát hành chứng thư / quyết định', 'COMPLETED', 'Mở phát hành')];
    return [businessFact('issuance', 'Phát hành chứng thư / quyết định', 'IN_PROGRESS', 'Mở phát hành', 'Gói phát hành chưa hoàn tất')];
  }
  if (actionKey === 'DELIVERY') {
    const completed = ['DELIVERED', 'ARCHIVED'].includes(String(input.dossierStatus || '').toUpperCase());
    return [businessFact('delivery', 'Giao khách hàng', completed ? 'COMPLETED' : 'ATTENTION', 'Mở phát hành / giao khách hàng', completed ? undefined : 'Chưa ghi nhận giao khách hàng')];
  }
  if (actionKey === 'ARCHIVE' || actionKey === 'DELIVERY_ARCHIVE') {
    const completed = String(input.dossierStatus || '').toUpperCase() === 'ARCHIVED';
    return [businessFact('archive', 'Lưu trữ hồ sơ', completed ? 'COMPLETED' : 'ATTENTION', 'Mở lưu trữ', completed ? undefined : 'Hồ sơ chưa được lưu trữ')];
  }
  return [];
}

function documentItem(
  requirement: PcnDocumentRequirement,
  document: Pick<PcnDossierDocument, 'requirementId' | 'status' | 'lifecycleStatus' | 'currentVersionId'> | undefined,
  waiver: PcnDossierDocumentWaiver | undefined,
  pendingDraftId?: string,
): PcnDossierNodeDocumentItem {
  if (document?.status === 'PRESENT') {
    return {
      kind: 'DOCUMENT_REQUIREMENT',
      requirementId: requirement.id,
      code: requirement.code,
      label: requirement.name,
      required: requirement.required,
      status: document.lifecycleStatus || 'PRESENT',
      ...(document.currentVersionId ? { currentVersionId: document.currentVersionId } : {}),
      actions: ['VIEW', ...(document.lifecycleStatus === 'UPLOADED' || document.lifecycleStatus === 'GENERATED' ? ['CONFIRM' as const] : []), 'REPLACE', 'REMOVE_CURRENT'],
    };
  }
  if (waiver?.reason?.trim()) {
    return {
      kind: 'DOCUMENT_REQUIREMENT',
      requirementId: requirement.id,
      code: requirement.code,
      label: requirement.name,
      required: requirement.required,
      status: 'WAIVED',
       actions: ['UPLOAD', 'CLEAR_WAIVER'],
      waiverReason: waiver.reason.trim(),
    };
  }
  const generationKind = getPcnNodeDocumentGenerationKind(requirement.code);
  const draftFormKind = getPcnNodeDraftFormKind(requirement.code);
  return {
    kind: 'DOCUMENT_REQUIREMENT',
    requirementId: requirement.id,
    code: requirement.code,
    label: requirement.name,
    required: requirement.required,
    status: 'MISSING',
    ...(pendingDraftId ? { pendingDraftId } : {}),
    actions: ['UPLOAD', ...(generationKind || draftFormKind ? ['CREATE_FROM_FORM' as const] : []), 'WAIVE'],
  };
}

export function buildPcnDossierNodeWorkProjection(input: PcnDossierNodeWorkProjectionInput): PcnDossierNodeWorkProjection {
  const status = input.runtimeNode?.status || input.node.status || 'READY';
  const cycleNo = input.runtimeNode?.cycleNo || input.node.cycleNo || 1;
  const blockedReason = input.runtimeNode?.blockedReason || input.node.blockedReason;
  const requirementById = new Map(input.requirements.filter((requirement) => requirement.active !== false).map((requirement) => [requirement.id, requirement]));
  const documentByRequirementId = new Map((input.documents || []).map((document) => [document.requirementId, document]));
  const waivers = input.documentWaivers || {};
  const pendingDraftByReqCode = new Map<string, PcnDraftWorkspace>();
  for (const draft of input.draftWorkspaces || []) {
    if (draft.status !== 'GENERATED' || !draft.outputs || draft.outputs.length === 0) continue;
    const reqCode = getPcnDraftFormRequirementCode(draft.formKind);
    if (!reqCode) continue;
    const existing = pendingDraftByReqCode.get(reqCode);
    if (!existing || (draft.updatedAt || draft.createdAt || '').localeCompare(existing.updatedAt || existing.createdAt || '') > 0) {
      pendingDraftByReqCode.set(reqCode, draft);
    }
  }
  const documents = input.node.requirementIds
    .map((requirementId) => requirementById.get(requirementId))
    .filter((requirement): requirement is PcnDocumentRequirement => Boolean(requirement))
    .map((requirement) => {
      const doc = documentByRequirementId.get(requirement.id);
      const isPresent = doc?.status === 'PRESENT';
      const pendingDraft = !isPresent ? pendingDraftByReqCode.get(requirement.code) : undefined;
      return documentItem(requirement, doc, waivers[requirement.id], pendingDraft?.id);
    });
  const businessFacts = [...(input.businessFacts || [])];
  const unresolvedRequiredCount = documents.filter((item) => item.required && !['PRESENT', 'CONFIRMED', 'WAIVED'].includes(item.status)).length;
  const suggestions = [
    ...documents.filter((item) => item.required && item.status === 'UPLOADED').map((item) => `Xác nhận tệp ${item.label}`),
    ...documents.filter((item) => item.required && item.status === 'GENERATED').map((item) => `Rà soát và xác nhận bản sinh ${item.label}`),
    ...documents.filter((item) => item.required && item.status === 'MISSING').map((item) => `Bổ sung ${item.label}`),
    ...businessFacts
      .filter((item) => item.status !== 'COMPLETED' && item.status !== 'NOT_APPLICABLE')
      .map((item) => item.reason ? `${item.actionLabel || item.label}: ${item.reason}` : (item.actionLabel || item.label)),
  ];
  const businessComplete = businessFacts.every((item) => item.status === 'COMPLETED' || item.status === 'NOT_APPLICABLE');
  const canContinue = ACTIVE_STATUSES.has(status) && unresolvedRequiredCount === 0 && businessComplete;
  return {
    nodeId: input.node.id,
    nodeLabel: input.node.label,
    status,
    cycleNo,
    ...(blockedReason ? { blockedReason } : {}),
    documents,
    businessFacts,
    unresolvedRequiredCount,
    suggestions,
    canContinue,
    isSelectable: SELECTABLE_STATUSES.has(status),
    isEditable: SELECTABLE_STATUSES.has(status),
    requiresReworkOnMutation: status === 'COMPLETED',
  };
}
