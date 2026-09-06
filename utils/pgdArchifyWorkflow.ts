import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain.ts';
import { PGD_WORKFLOW_STATES, getPgdStatusLabel } from './pgdDomain.ts';
import type { PgdDossierDocument } from './pgdDossier.ts';
import type { ArchifyWorkflowDocument } from './pcnArchifyWorkflow.ts';
import { unavailableDiagram, type ArchifyDiagramSuite } from './archifyDiagram.ts';
import { buildPgdArchitectureDiagram, buildPgdDataflowDiagram, buildPgdLifecycleDiagram, buildPgdSequenceDiagram, type ArchifyArchitectureDocument, type ArchifyDataflowDocument, type ArchifyLifecycleDocument, type ArchifySequenceDocument } from './pgdArchifyOtherDiagrams.ts';

export interface PgdArchifyWorkflowInput {
  request: PgdInspectionRequest;
  assignment?: PgdInspectionAssignment;
  fieldInspection?: PgdFieldInspection;
  samples: readonly PgdSample[];
  labRequests: readonly PgdLabRequest[];
  labResults: readonly PgdLabResult[];
  report?: PgdInspectionReport;
  certificate?: PgdInspectionCertificate;
  labResultReview?: { status?: string; conformity?: string; retestRequired?: boolean };
  dossierDocuments: readonly PgdDossierDocument[];
  approvals: readonly PgdApprovalStep[];
  activityLogs: readonly Record<string, unknown>[];
}

export type PgdArchifyDiagramSuite = ArchifyDiagramSuite<ArchifyWorkflowDocument, ArchifyLifecycleDocument, ArchifyDataflowDocument, ArchifySequenceDocument, ArchifyArchitectureDocument>;

type ArchifyNode = ArchifyWorkflowDocument['nodes'][number];

function archifyId(value: string): string {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-zA-Z]/.test(normalized) ? normalized : `node-${normalized || 'unknown'}`;
}

function nodeStatus(requestStatus: string, stateCode: string): string {
  const current = PGD_WORKFLOW_STATES.find((state) => state.code === requestStatus)?.order ?? -1;
  const order = PGD_WORKFLOW_STATES.find((state) => state.code === stateCode)?.order ?? 0;
  if (requestStatus === stateCode) return 'Đang xử lý';
  if (current >= 0 && order < current) return 'Hoàn tất';
  return requestStatus === 'REJECTED' ? 'Đã từ chối' : requestStatus === 'CANCELLED' ? 'Đã hủy' : 'Đang khóa';
}

function typeForState(code: string): ArchifyNode['type'] {
  if (code === 'LEADERSHIP_APPROVAL' || code === 'TECHNICAL_REVIEW') return 'security';
  if (code === 'WAITING_LAB_RESULTS') return 'cloud';
  if (code === 'ARCHIVED') return 'database';
  return 'backend';
}

function checklistSummary(request: PgdInspectionRequest): { total: number; present: number; missing: number; waived: number } {
  const checklist = Array.isArray(request.dossierChecklist) ? request.dossierChecklist : [];
  return {
    total: checklist.length,
    present: checklist.filter((item) => item.status === 'PRESENT').length,
    missing: checklist.filter((item) => item.status === 'MISSING').length,
    waived: checklist.filter((item) => item.status === 'WAIVED').length,
  };
}

function makeNode(input: {
  id: string;
  lane: string;
  col: number;
  type: ArchifyNode['type'];
  label: string;
  sublabel: string;
  tag?: string;
  yOffset?: number;
}): ArchifyNode {
  return {
    id: archifyId(input.id),
    lane: input.lane,
    col: Math.max(0, Math.min(5, input.col)),
    type: input.type,
    label: input.label,
    sublabel: input.sublabel,
    ...(input.tag ? { tag: input.tag } : {}),
    width: 210,
    height: 68,
    ...(input.yOffset === undefined ? {} : { yOffset: input.yOffset }),
  };
}

export function buildPgdArchifyWorkflow(input: PgdArchifyWorkflowInput): ArchifyWorkflowDocument {
  const request = input.request;
  const checklist = checklistSummary(request);
  const documents = input.dossierDocuments.filter((document) => document.requestId === request.id);
  const baseStates = PGD_WORKFLOW_STATES.filter((state) => state.code !== 'ARCHIVED');
  const nodes: ArchifyNode[] = [];
  const lanes: ArchifyWorkflowDocument['lanes'] = [
    { id: 'pgd-intake', label: 'Tiếp nhận & năng lực' },
    { id: 'pgd-field', label: 'Hiện trường & lấy mẫu' },
    { id: 'pgd-lab', label: 'Phòng thử nghiệm' },
    { id: 'pgd-governance', label: 'Soát xét & phê duyệt' },
    { id: 'pgd-archive', label: 'Trả kết quả & lưu trữ' },
  ];
  const edges: ArchifyWorkflowDocument['edges'] = [];
  const lifecycleIds: string[] = [];
  const requestOrder = PGD_WORKFLOW_STATES.find((state) => state.code === request.status)?.order ?? -1;
  const labOrder = PGD_WORKFLOW_STATES.find((state) => state.code === 'WAITING_LAB_RESULTS')?.order ?? 5;

  const checklistItems = Array.isArray(request.dossierChecklist) ? request.dossierChecklist : [];
  if (checklistItems.length > 0) {
    lanes.push({ id: 'pgd-documents', label: 'Bộ hồ sơ & chứng từ' });
    checklistItems.forEach((item, index) => {
      const documentNodeId = `pgd-doc-${item.requirementCode}`;
      nodes.push(makeNode({ id: documentNodeId, lane: 'pgd-documents', col: 1, type: 'database', label: item.title, sublabel: `${item.requirementCode} · ${item.status} · ${item.currentDocumentVersion ? `v${item.currentDocumentVersion}` : 'chưa có phiên bản'}`, tag: item.status === 'PRESENT' ? 'Đã có' : item.status === 'WAIVED' ? 'Đã miễn' : 'Cần bổ sung', yOffset: index === 0 ? undefined : index * 78 }));
      edges.push({ id: `pgd-intake-doc-${index}`, from: archifyId('pgd-draft'), to: archifyId(documentNodeId), label: 'Checklist', role: 'branch', variant: 'dashed' });
      edges.push({ id: `pgd-doc-capability-${index}`, from: archifyId(documentNodeId), to: archifyId('pgd-capability_review'), label: 'Đối soát', role: 'async', variant: 'dashed' });
    });
  }

  for (const [index, state] of baseStates.entries()) {
    const id = `pgd-${state.code.toLowerCase()}`;
    lifecycleIds.push(id);
    const lane = state.code === 'FIELD_INSPECTION' ? 'pgd-field'
      : state.code === 'WAITING_LAB_RESULTS' ? 'pgd-lab'
        : ['RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL'].includes(state.code) ? 'pgd-governance'
          : 'pgd-intake';
    const col = Math.min(5, index);
    const tag = state.code === request.status ? 'Hiện tại' : nodeStatus(request.status, state.code);
    nodes.push(makeNode({
      id,
      lane,
      col,
      type: typeForState(state.code),
      label: state.label,
      sublabel: `${state.code} · ${nodeStatus(request.status, state.code)} · ${checklist.present}/${checklist.total || 0} tài liệu`,
      tag,
      yOffset: nodes.some((node) => node.lane === lane && node.col === col) ? (nodes.filter((node) => node.lane === lane && node.col === col).length * 82) : undefined,
    }));
    if (index > 0) {
      edges.push({ id: `pgd-state-${index - 1}-${index}`, from: archifyId(lifecycleIds[index - 1]), to: archifyId(id), label: 'Chuyển bước', role: 'main', variant: 'default' });
    }
  }

  const fieldId = archifyId('pgd-field_inspection');
  const waitLabId = archifyId('pgd-waiting-lab-results');
  const hasLab = input.labRequests.length > 0;
  if (hasLab) {
    const splitId = archifyId('pgd-lab-split');
    const joinId = archifyId('pgd-lab-join');
    const splitTag = requestOrder < labOrder ? 'Đang khóa' : 'Hoàn tất';
    nodes.push(makeNode({ id: 'pgd-lab-split', lane: 'pgd-lab', col: 4, type: 'messagebus', label: 'Điều phối PTN', sublabel: `${input.labRequests.length} PYC PTN · xử lý song song · ${splitTag}`, tag: splitTag }));
    edges.push({ id: 'pgd-field-to-lab-split', from: fieldId, to: splitId, label: 'Bàn giao mẫu', role: 'branch', variant: 'emphasis' });
    input.labRequests.forEach((labRequest, index) => {
      const labId = `pgd-lab-${labRequest.id}`;
      const result = input.labResults.find((item) => item.id === labRequest.resultId || item.labRequestId === labRequest.id);
      const labLane = `pgd-lab-${index + 1}`;
      lanes.push({ id: labLane, label: `PTN nhánh ${index + 1}` });
      const labTag = result ? 'Hoàn tất' : requestOrder === labOrder ? 'Đang xử lý' : 'Đang khóa';
      nodes.push(makeNode({ id: labId, lane: labLane, col: 5, type: 'cloud', label: labRequest.laboratoryName || `PYC PTN ${index + 1}`, sublabel: `${labRequest.status} · ${(labRequest.testItems || []).join(', ') || 'Chưa có chỉ tiêu'} · ${result ? 'đã có KQ' : 'chưa có KQ'}`, tag: labTag, yOffset: index === 0 ? undefined : index * 78 }));
      edges.push({ id: `pgd-lab-branch-${index}`, from: splitId, to: archifyId(labId), label: labRequest.laboratoryCode || 'PYC PTN', role: 'branch', variant: 'emphasis' });
      edges.push({ id: `pgd-lab-join-${index}`, from: archifyId(labId), to: joinId, label: result ? 'KQTN' : 'Đang chờ', role: 'async', variant: 'dashed' });
    });
    const allLabResultsReceived = input.labResults.length >= input.labRequests.length;
    const joinTag = requestOrder < labOrder ? 'Đang khóa' : requestOrder === labOrder ? (allLabResultsReceived ? 'Đang xử lý' : 'Đang chờ') : 'Hoàn tất';
    nodes.push(makeNode({ id: 'pgd-lab-join', lane: 'pgd-lab', col: 5, type: 'messagebus', label: 'Gom kết quả PTN', sublabel: `${input.labResults.length}/${input.labRequests.length} kết quả đã nhận · ${joinTag}`, tag: joinTag, yOffset: 110 }));
    edges.push({ id: 'pgd-lab-join-review', from: joinId, to: archifyId('pgd-results_review'), label: 'Kết quả đã tiếp nhận', role: 'main', variant: 'emphasis' });
  } else {
    edges.push({ id: 'pgd-field-review', from: fieldId, to: archifyId('pgd-results_review'), label: 'Không phát sinh PYC PTN', role: 'main', variant: 'default' });
  }

  const returnSource = input.approvals.find((approval) => approval.status === 'RETURNED') || (input.report?.status === 'RETURNED' ? input.report : undefined);
  if (returnSource) {
    const leadershipNodeIndex = nodes.findIndex((node) => node.id === archifyId('pgd-leadership_approval'));
    if (leadershipNodeIndex >= 0) nodes[leadershipNodeIndex] = { ...nodes[leadershipNodeIndex], tag: 'Cần xử lý lại' };
    edges.push({ id: 'pgd-return-to-technical', from: archifyId('pgd-leadership_approval'), to: archifyId('pgd-technical_review'), label: 'Trả lại xử lý', role: 'return', variant: 'dashed' });
  }

  const archiveId = archifyId('pgd-archived');
  nodes.push(makeNode({ id: 'pgd-archived', lane: 'pgd-archive', col: 5, type: 'database', label: 'Lưu trữ hồ sơ PGD', sublabel: `${request.status === 'ARCHIVED' ? 'Đã lưu trữ' : 'Đang khóa'} · ${documents.length} chứng từ đã liên kết`, tag: request.status === 'ARCHIVED' ? 'Hoàn tất' : 'Chưa đến bước' }));
  edges.push({ id: 'pgd-result-to-archive', from: archifyId('pgd-leadership_approval'), to: archiveId, label: 'Đã ký / trả kết quả', role: 'main', variant: 'default' });

  const mainPath = [
    ...lifecycleIds.slice(0, 5).map(archifyId),
    ...(hasLab ? [archifyId('pgd-lab-split'), archifyId(input.labRequests[0] ? `pgd-lab-${input.labRequests[0].id}` : 'pgd-lab-join'), archifyId('pgd-lab-join')] : []),
    archifyId('pgd-results_review'),
    archifyId('pgd-technical_review'),
    archifyId('pgd-leadership_approval'),
    archiveId,
  ].filter((id, index, all) => id && all.indexOf(id) === index);
  const views = [
    { id: 'intake', label: 'Tiếp nhận & năng lực', focus: lifecycleIds.slice(0, 3).map(archifyId), note: 'Từ PYC đến chấp nhận phạm vi giám định.' },
    { id: 'field-lab', label: 'Hiện trường & PTN', focus: nodes.filter((node) => node.lane === 'pgd-field' || node.lane.startsWith('pgd-lab')).map((node) => node.id), note: 'Bàn giao mẫu và các PYC PTN đã ghi nhận.' },
    { id: 'review-archive', label: 'Soát xét & lưu trữ', focus: nodes.filter((node) => node.lane === 'pgd-governance' || node.lane === 'pgd-archive').map((node) => node.id), note: 'Kiểm tra kết quả, phê duyệt, trả và lưu trữ.' },
  ].map((view) => ({ ...view, focus: [...new Set(view.focus)] })).filter((view) => view.focus.length > 0);

  return {
    schema_version: 2,
    diagram_type: 'workflow',
    meta: {
      title: `${request.requestCode} · Lưu trình PGD`,
      subtitle: `${request.productName} · ${getPgdStatusLabel(request.status)} · ${nodes.length} node · ${checklist.present}/${checklist.total || 0} tài liệu`,
      locale: 'en',
      animation: 'trace',
      visual_preset: 'blueprint',
      quality_profile: 'standard',
      views,
    },
    lanes,
    phases: [
      { id: 'pgd-phase-intake', label: 'Tiếp nhận', fromCol: 0, toCol: 2 },
      { id: 'pgd-phase-execution', label: 'Hiện trường & PTN', fromCol: 3, toCol: 4, variant: 'emphasis' },
      { id: 'pgd-phase-review', label: 'Soát xét & trả kết quả', fromCol: 5, toCol: 5, variant: 'dashed' },
    ],
    groups: [],
    mainPath,
    nodes,
    edges,
    cards: [
      { dot: 'cyan', title: 'PGD dossier', items: [`${nodes.length} node · ${edges.length} transition`, `${request.productGroup} · ${request.method || 'Chưa chọn phương thức'}`] },
      { dot: checklist.missing > 0 ? 'amber' : 'emerald', title: 'Bộ hồ sơ', items: [`${checklist.present}/${checklist.total || 0} tài liệu hiện có`, `${checklist.missing} thiếu · ${checklist.waived} miễn có lý do`] },
      { dot: input.labResults.length < input.labRequests.length ? 'orange' : 'violet', title: 'Bằng chứng vận hành', items: [`${input.samples.length} mẫu · ${input.labRequests.length} PYC PTN`, `${input.labResults.length} KQTN · ${input.approvals.length} bước phê duyệt`] },
    ],
  };
}

export function buildPgdArchifyDiagramSuite(input: PgdArchifyWorkflowInput): PgdArchifyDiagramSuite {
  return {
    workflow: buildPgdArchifyWorkflow(input),
    lifecycle: { available: true, diagramType: 'lifecycle', document: buildPgdLifecycleDiagram(input) },
    dataflow: buildPgdDataflowDiagram(input),
    sequence: buildPgdSequenceDiagram(input),
    architecture: { available: true, diagramType: 'architecture', document: buildPgdArchitectureDiagram(input) },
  };
}
