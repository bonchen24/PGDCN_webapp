import type {
  ActivityLog,
  CertificationDossier,
  PcnApprovalStep,
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDossierWorkflowTask,
  PcnWorkflowNodeDefinition,
  PcnWorkflowSnapshot,
  ReturnedTestResult,
} from '../types.ts';
import { buildPcnWorkflowConditionContext, projectPcnWorkflowRuntime } from './pcnWorkflowRuntime.ts';
import { unavailableDiagram, type ArchifyDiagramSuite } from './archifyDiagram.ts';
import { buildPcnArchitectureDiagram, buildPcnDataflowDiagram, buildPcnLifecycleDiagram, buildPcnSequenceDiagram, type ArchifyArchitectureDocument, type ArchifyDataflowDocument, type ArchifyLifecycleDocument, type ArchifySequenceDocument } from './pcnArchifyOtherDiagrams.ts';

export type ArchifyWorkflowDocument = {
  schema_version: 2;
  diagram_type: 'workflow';
  meta: {
    title: string;
    subtitle: string;
    locale: 'en' | 'zh-CN';
    animation: 'trace' | 'none';
    visual_preset: 'classic' | 'signal-flow' | 'blueprint' | 'editorial';
    quality_profile: 'standard' | 'showcase';
    views: Array<{ id: string; label: string; focus: string[]; note?: string }>;
  };
  lanes: Array<{ id: string; label: string; variant?: 'normal' | 'exception' }>;
  phases: Array<{ id: string; label: string; fromCol: number; toCol: number; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }>;
  groups: Array<{ id: string; label: string; lane: string; fromCol: number; toCol: number; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }>;
  mainPath: string[];
  nodes: Array<{
    id: string;
    lane: string;
    col: number;
    type: 'frontend' | 'backend' | 'database' | 'cloud' | 'security' | 'messagebus' | 'external';
    label: string;
    sublabel?: string;
    tag?: string;
    width?: number;
    height?: number;
    yOffset?: number;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label?: string;
    variant?: 'default' | 'emphasis' | 'security' | 'dashed';
    role?: 'main' | 'branch' | 'async' | 'return' | 'error';
    route?: 'auto' | 'straight' | 'drop' | 'outside-right' | 'return-left' | 'bottom-channel' | 'up-channel';
    fromSide?: 'left' | 'right' | 'top' | 'bottom';
    toSide?: 'left' | 'right' | 'top' | 'bottom';
    bias?: number;
    width?: number;
  }>;
  cards: Array<{ dot: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'orange' | 'slate'; title: string; items: string[] }>;
};

/** Internal, schema-safe tag used to carry runtime state into the Archify renderer. */
export const PCN_ARCHIFY_STATUS_TAG_PREFIX = '__pcn_status__';

export interface PcnArchifyWorkflowInput {
  dossier: CertificationDossier;
  workflow: PcnWorkflowSnapshot;
  tasks: readonly PcnDossierWorkflowTask[];
  documents: readonly PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  results?: readonly ReturnedTestResult[];
  approvalSteps?: readonly PcnApprovalStep[];
  activityLogs?: readonly ActivityLog[];
}

export type PcnArchifyDiagramSuite = ArchifyDiagramSuite<ArchifyWorkflowDocument, ArchifyLifecycleDocument, ArchifyDataflowDocument, ArchifySequenceDocument, ArchifyArchitectureDocument>;

const TYPE_BY_KIND: Record<PcnWorkflowNodeDefinition['kind'], ArchifyWorkflowDocument['nodes'][number]['type']> = {
  DOCUMENT_TASK: 'backend',
  APPROVAL_TASK: 'security',
  DECISION: 'security',
  PARALLEL_SPLIT: 'messagebus',
  PARALLEL_JOIN: 'messagebus',
  END: 'database',
};

const RETURN_POLICIES = new Set(['REWORK', 'RESTART_DEPENDENCIES', 'RESTART_TEMPLATE']);

function archifyId(value: string): string {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-zA-Z]/.test(normalized) ? normalized : `node-${normalized || 'unknown'}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isReturnEdge(edge: PcnWorkflowSnapshot['transitions'][number], nodesById: Map<string, PcnWorkflowNodeDefinition>): boolean {
  const from = nodesById.get(edge.fromNodeId);
  const to = nodesById.get(edge.toNodeId);
  // returnPolicy describes the rework policy carried by a transition; it does
  // not by itself make a forward transition a return route. The seeded
  // topology intentionally keeps that metadata on the join -> approval edge.
  return Boolean(from && to && to.sortOrder <= from.sortOrder);
}

function buildBranchLaneMap(workflow: PcnWorkflowSnapshot): Map<string, string> {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of workflow.transitions) {
    if (isReturnEdge(edge, nodesById)) continue;
    const list = outgoing.get(edge.fromNodeId) || [];
    list.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, list);
  }
  const branchLanes = new Map<string, string>();
  const splits = workflow.nodes.filter((node) => node.kind === 'PARALLEL_SPLIT').sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  for (const split of splits) {
    const roots = unique((outgoing.get(split.id) || []).sort());
    roots.forEach((root, index) => {
      const lane = `parallel-${index + 1}`;
      const queue = [root];
      const seen = new Set<string>();
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (seen.has(current)) continue;
        seen.add(current);
        const node = nodesById.get(current);
        if (!node || node.kind === 'PARALLEL_JOIN' || node.kind === 'PARALLEL_SPLIT') continue;
        branchLanes.set(current, lane);
        for (const next of outgoing.get(current) || []) queue.push(next);
      }
    });
  }
  return branchLanes;
}

function laneForNode(node: PcnWorkflowNodeDefinition, branchLanes: Map<string, string>): { id: string; label: string; variant?: 'normal' | 'exception' } {
  const branchLane = branchLanes.get(node.id);
  if (branchLane) return { id: branchLane, label: branchLane === 'parallel-1' ? 'Nhánh xử lý 1' : `Nhánh xử lý ${branchLane.replace('parallel-', '')}` };
  if (node.kind === 'END') return { id: 'archive', label: 'Lưu trữ' };
  if (node.kind === 'APPROVAL_TASK') return { id: 'governance', label: 'Soát xét & phê duyệt' };
  if (node.kind === 'DECISION' || node.kind === 'PARALLEL_SPLIT' || node.kind === 'PARALLEL_JOIN') return { id: 'control', label: 'Điều phối lưu trình' };
  return { id: 'operations', label: 'Xử lý hồ sơ' };
}

function calculateColumns(workflow: PcnWorkflowSnapshot, activeNodes: PcnWorkflowNodeDefinition[]): Map<string, number> {
  const nodesById = new Map(activeNodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  for (const edge of workflow.transitions) {
    if (isReturnEdge(edge, nodesById) || !nodesById.has(edge.fromNodeId) || !nodesById.has(edge.toNodeId)) continue;
    incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) || []), edge.fromNodeId]);
  }
  const columns = new Map<string, number>();
  const ordered = [...activeNodes].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  for (let pass = 0; pass <= ordered.length; pass += 1) {
    let changed = false;
    for (const node of ordered) {
      const predecessors = incoming.get(node.id) || [];
      const known = predecessors.filter((id) => columns.has(id));
      const next = known.length > 0 ? Math.min(5, Math.max(...known.map((id) => columns.get(id)! + 1))) : 0;
      if (columns.get(node.id) !== next) {
        columns.set(node.id, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return columns;
}

function buildMainPath(workflow: PcnWorkflowSnapshot, columns: Map<string, number>): string[] {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const active = workflow.nodes.filter((node) => node.active !== false);
  const outgoing = new Map<string, typeof workflow.transitions>();
  for (const edge of workflow.transitions) {
    if (isReturnEdge(edge, nodesById)) continue;
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) || []), edge]);
  }
  const start = [...active].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0];
  if (!start) return [];
  const path = [start.id];
  let current = start.id;
  const seen = new Set(path);
  while (true) {
    const next = (outgoing.get(current) || [])
      .filter((edge) => !seen.has(edge.toNodeId))
      .sort((a, b) => (columns.get(a.toNodeId) || 0) - (columns.get(b.toNodeId) || 0) || (a.priority || 0) - (b.priority || 0) || a.id.localeCompare(b.id))[0];
    if (!next) break;
    path.push(next.toNodeId);
    seen.add(next.toNodeId);
    current = next.toNodeId;
  }
  return path.length >= 2 ? path : active.slice(0, 2).map((node) => node.id);
}

function buildViews(nodes: ArchifyWorkflowDocument['nodes'], mainPath: string[], workflow: PcnWorkflowSnapshot): ArchifyWorkflowDocument['meta']['views'] {
  const ids = new Set(nodes.map((node) => node.id));
  const first = mainPath.slice(0, Math.min(3, mainPath.length));
  const middle = mainPath.slice(Math.max(0, mainPath.length - 4));
  const parallel = nodes.filter((node) => node.lane.startsWith('parallel-')).map((node) => node.id);
  const views = [
    { id: 'intake', label: 'Tiếp nhận & điều phối', focus: first, note: 'Theo dõi hồ sơ từ điểm tiếp nhận đến bước điều phối đầu tiên.' },
    { id: 'parallel-work', label: 'Xử lý song song', focus: parallel, note: 'Các nhánh song song được lấy từ transition đã lưu của hồ sơ.' },
    { id: 'review-archive', label: 'Soát xét & lưu trữ', focus: middle, note: 'Theo dõi các bước hoàn thiện, phê duyệt và kết thúc.' },
  ];
  return views.map((view) => ({ ...view, focus: unique(view.focus.filter((id) => ids.has(id))) })).filter((view) => view.focus.length > 0).slice(0, 5);
}

export function buildPcnArchifyWorkflow(input: PcnArchifyWorkflowInput): ArchifyWorkflowDocument {
  const workflow = input.workflow;
  const activeNodes = workflow.nodes.filter((node) => node.active !== false).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const nodesById = new Map(activeNodes.map((node) => [node.id, node]));
  const conditionContext = buildPcnWorkflowConditionContext({
    workflow,
    documents: input.documents,
    documentWaivers: input.documentWaivers,
    results: (input.results || []).filter((result) => result.dossierId === input.dossier.id),
    approvalSteps: (input.approvalSteps || []).filter((step) => step.dossierId === input.dossier.id),
    fieldCodes: input.dossier.fieldCodes,
    method: input.dossier.method,
  });
  const runtime = projectPcnWorkflowRuntime({
    workflow,
    tasks: input.tasks.filter((task) => task.dossierId === input.dossier.id),
    documents: input.documents,
    documentWaivers: input.documentWaivers,
    conditionContext,
  });
  const branchLanes = buildBranchLaneMap(workflow);
  const columns = calculateColumns(workflow, activeNodes);
  const lanesById = new Map<string, { id: string; label: string; variant?: 'normal' | 'exception' }>();
  const nodeLane = new Map<string, string>();
  for (const node of activeNodes) {
    const lane = laneForNode(node, branchLanes);
    lanesById.set(lane.id, lane);
    nodeLane.set(node.id, lane.id);
  }
  const laneColumnCounts = new Map<string, number>();
  const archifyNodes = activeNodes.map((node) => {
    const runtimeNode = runtime.byNodeId[node.id];
    const lane = nodeLane.get(node.id)!;
    const col = columns.get(node.id) || 0;
    const key = `${lane}:${col}`;
    const index = laneColumnCounts.get(key) || 0;
    laneColumnCounts.set(key, index + 1);
    const yOffset = index === 0 ? undefined : (index - 0.5) * 78;
    const requirements = node.requirementIds.length;
    const assigned = runtimeNode?.assignedUsername ? ` · ${runtimeNode.assignedUsername}` : '';
    const status = runtimeNode?.status || 'LOCKED';
    const tag = `${PCN_ARCHIFY_STATUS_TAG_PREFIX}${status}`;
    return {
      id: archifyId(node.id),
      lane,
      col,
      type: TYPE_BY_KIND[node.kind],
      label: node.label,
      sublabel: `${node.kind.replaceAll('_', ' ')}${assigned}${requirements ? ` · ${requirements} tài liệu` : ''}`,
      tag,
      width: 210,
      height: 68,
      ...(yOffset === undefined ? {} : { yOffset }),
    };
  });
  const edgeList = workflow.transitions.filter((edge) => nodesById.has(edge.fromNodeId) && nodesById.has(edge.toNodeId));
  const archifyEdges: ArchifyWorkflowDocument['edges'] = edgeList.map((edge): ArchifyWorkflowDocument['edges'][number] => {
    const returnEdge = isReturnEdge(edge, nodesById);
    const from = nodesById.get(edge.fromNodeId)!;
    const to = nodesById.get(edge.toNodeId)!;
    const branch = from.kind === 'PARALLEL_SPLIT' || to.kind === 'PARALLEL_JOIN';
    return {
      id: archifyId(edge.id),
      from: archifyId(edge.fromNodeId),
      to: archifyId(edge.toNodeId),
      ...(edge.label ? { label: edge.label } : {}),
      variant: (returnEdge ? 'dashed' : from.kind === 'DECISION' ? 'security' : branch ? 'emphasis' : 'default') as ArchifyWorkflowDocument['edges'][number]['variant'],
      role: (returnEdge ? 'return' : branch ? 'branch' : 'main') as ArchifyWorkflowDocument['edges'][number]['role'],
      ...(returnEdge ? { bias: 0.35 } : {}),
      ...(edge.returnPolicy && RETURN_POLICIES.has(edge.returnPolicy) ? { width: 1.4 } : {}),
    };
  });
  const mainPath = buildMainPath(workflow, columns).map(archifyId);
  const views = buildViews(archifyNodes, mainPath, workflow);
  const returnedCount = runtime.returnedNodeIds.length;
  const documentCount = input.documents.filter((document) => document.dossierId === input.dossier.id).length;
  const activityCount = input.activityLogs?.filter((log) => log.entityId === input.dossier.id || log.entityId === input.dossier.dossierCode).length || 0;
  return {
    schema_version: 2,
    diagram_type: 'workflow',
    meta: {
      title: `${input.dossier.dossierCode} · Lưu trình PCN`,
      subtitle: `${workflow.templateCode} v${workflow.templateVersion} · ${archifyNodes.length} node · ${documentCount} tài liệu · ${activityCount} hoạt động đã ghi nhận`,
      locale: 'en',
      animation: 'trace',
      visual_preset: 'signal-flow',
      quality_profile: 'showcase',
      views,
    },
    lanes: [...lanesById.values()],
    phases: [
      { id: 'phase-intake', label: 'Tiếp nhận', fromCol: 0, toCol: Math.min(1, Math.max(...archifyNodes.map((node) => node.col))) },
      { id: 'phase-execution', label: 'Xử lý & phối hợp', fromCol: 2, toCol: 4, variant: 'emphasis' },
      { id: 'phase-close', label: 'Soát xét & lưu trữ', fromCol: 5, toCol: 5, variant: 'dashed' },
    ],
    groups: [],
    mainPath,
    nodes: archifyNodes,
    edges: archifyEdges,
    cards: [
      { dot: 'cyan', title: 'PCN dossier', items: [`${archifyNodes.length} node · ${archifyEdges.length} transition`, `Template ${workflow.templateCode} v${workflow.templateVersion}`] },
      { dot: returnedCount > 0 ? 'orange' : 'emerald', title: 'Runtime evidence', items: [returnedCount > 0 ? `${returnedCount} node có vòng trả lại` : 'Không có node đang trả lại', `${documentCount} tài liệu được chiếu từ hồ sơ`] },
    ],
  };
}

export function buildPcnArchifyDiagramSuite(input: PcnArchifyWorkflowInput): PcnArchifyDiagramSuite {
  return {
    workflow: buildPcnArchifyWorkflow(input),
    lifecycle: { available: true, diagramType: 'lifecycle', document: buildPcnLifecycleDiagram(input) },
    dataflow: buildPcnDataflowDiagram(input),
    sequence: buildPcnSequenceDiagram(input),
    architecture: { available: true, diagramType: 'architecture', document: buildPcnArchitectureDiagram(input) },
  };
}
