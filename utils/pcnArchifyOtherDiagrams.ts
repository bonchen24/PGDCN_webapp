import type { ActivityLog, ReturnedTestResult } from '../types.ts';
import type { ArchifyDiagramResult } from './archifyDiagram.ts';
import { archifyStableId, unavailableDiagram } from './archifyDiagram.ts';
import type { PcnArchifyWorkflowInput } from './pcnArchifyWorkflow.ts';

type Meta = { title: string; subtitle?: string; locale: 'en'; views?: Array<{ id: string; label: string; focus: string[]; note?: string }> };
type ComponentType = 'frontend' | 'backend' | 'database' | 'cloud' | 'security' | 'messagebus' | 'external';
export type ArchifyLifecycleDocument = { schema_version: 1; diagram_type: 'lifecycle'; meta: Meta; lanes: Array<{ id: string; label: string }>; states: Array<{ id: string; type: 'start' | 'active' | 'waiting' | 'decision' | 'success' | 'failure' | 'neutral'; label: string; lane: string; col: number; tag?: string }>; transitions: Array<{ id?: string; from: string; to: string; label?: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };
export type ArchifyDataflowDocument = { schema_version: 1; diagram_type: 'dataflow'; meta: Meta; stages: Array<{ label: string }>; nodes: Array<{ id: string; type: ComponentType; label: string; stage: number; row: number }>; flows: Array<{ id?: string; from: string; to: string; label: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };
export type ArchifyArchitectureDocument = { schema_version: 1; diagram_type: 'architecture'; meta: Meta; components: Array<{ id: string; type: ComponentType; label: string; sublabel?: string; row?: number; col?: number }>; connections: Array<{ id?: string; from: string; to: string; label?: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };
export type ArchifySequenceDocument = { schema_version: 1; diagram_type: 'sequence'; meta: Meta; participants: Array<{ id: string; type: ComponentType; label: string }>; messages: Array<{ id: string; from: string; to: string; y: number; label: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' | 'return' }> };

const id = (prefix: string, value: string) => archifyStableId(prefix, value).replace(/~/g, '-');
const view = (focus: string[]) => [{ id: 'overview', label: 'Tổng quan', focus, note: 'Chỉ tập trung vào các thực thể đã lưu.' }];

function currentNode(input: PcnArchifyWorkflowInput) {
  const tasks = input.tasks.filter((task) => task.dossierId === input.dossier.id);
  return input.workflow.nodes.find((node) => tasks.some((task) => task.nodeId === node.id && task.status === 'IN_PROGRESS'));
}

export function buildPcnLifecycleDiagram(input: PcnArchifyWorkflowInput): ArchifyLifecycleDocument {
  const nodes = input.workflow.nodes.filter((node) => node.active !== false).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const states = nodes.map((node, index) => ({ id: id('pcn', node.id), type: index === 0 ? 'start' as const : node.kind === 'DECISION' ? 'decision' as const : node.kind === 'END' ? 'success' as const : 'active' as const, label: node.label, lane: 'pcn-main', col: Math.min(4, index), ...(currentNode(input)?.id === node.id ? { tag: 'Hiện tại' } : {}) }));
  const stateIds = new Set(states.map((state) => state.id));
  return { schema_version: 1, diagram_type: 'lifecycle', meta: { title: `${input.dossier.dossierCode} · Lifecycle PCN`, locale: 'en', views: view(states.map((state) => state.id)) }, lanes: [{ id: 'main', label: 'Lưu trình PCN' }], states: states.map((state) => ({ ...state, lane: 'main' })), transitions: input.workflow.transitions.filter((edge) => stateIds.has(id('pcn', edge.fromNodeId)) && stateIds.has(id('pcn', edge.toNodeId))).map((edge) => ({ id: id('transition', edge.id), from: id('pcn', edge.fromNodeId), to: id('pcn', edge.toNodeId), ...(edge.label ? { label: edge.label } : {}), ...(edge.returnPolicy ? { variant: 'dashed' as const } : {}) })) };
}

export function buildPcnDataflowDiagram(input: PcnArchifyWorkflowInput): ArchifyDiagramResult<ArchifyDataflowDocument> {
  const documents = input.documents.filter((doc) => doc.dossierId === input.dossier.id && doc.status === 'PRESENT');
  const results = (input.results || []).filter((result) => result.dossierId === input.dossier.id);
  const approvals = (input.approvalSteps || []).filter((step) => step.dossierId === input.dossier.id);
  if ((results.length === 0 && approvals.length === 0) || (documents.length === 0 && results.length === 0 && approvals.length === 0)) return unavailableDiagram('dataflow', 'Chưa có đủ dữ liệu liên kết tài liệu, kết quả hoặc phê duyệt để dựng biểu đồ.');
  const nodes = [{ id: 'pcn-dossier', type: 'backend' as const, label: 'Hồ sơ PCN', stage: 0, row: 0 }, ...documents.map((doc, row) => ({ id: id('document', doc.id), type: 'external' as const, label: `Tài liệu ${doc.requirementId}`, stage: 1, row })), ...results.map((result, row) => ({ id: id('result', result.id), type: 'cloud' as const, label: `KQTN ${result.id}`, stage: 2, row })), ...approvals.map((approval, row) => ({ id: id('approval', approval.id), type: 'security' as const, label: `Phê duyệt ${approval.role}`, stage: 3, row }))];
  const flows: ArchifyDataflowDocument['flows'] = documents.map((doc) => ({ id: id('flow', `dossier-${doc.id}`), from: 'pcn-dossier', to: id('document', doc.id), label: `tài liệu ${doc.id}`, variant: 'emphasis' as const }));
  for (const result of results) flows.push({ id: id('flow', `result-${result.id}`), from: 'pcn-dossier', to: id('result', result.id), label: `Kết quả ${result.outcome}`, variant: 'default' });
  return { available: true, diagramType: 'dataflow', document: { schema_version: 1, diagram_type: 'dataflow', meta: { title: `${input.dossier.dossierCode} · Dataflow PCN`, locale: 'en', views: view(nodes.map((node) => node.id)) }, stages: [{ label: 'Nguồn hồ sơ' }, { label: 'Tài liệu' }, { label: 'Kết quả' }, { label: 'Phê duyệt' }], nodes, flows } };
}

function pcnEvents(input: PcnArchifyWorkflowInput) {
  const events: Array<{ id: string; at: string; actor: string; label: string }> = [];
  for (const task of input.tasks.filter((task) => task.dossierId === input.dossier.id)) if ((task.startedAt || task.completedAt) && task.updatedBy.trim()) events.push({ id: task.id, at: task.completedAt || task.startedAt || task.updatedAt, actor: 'PCN operator', label: `Task ${task.nodeId}: ${task.status}` });
  for (const result of (input.results || []).filter((result) => result.dossierId === input.dossier.id)) events.push({ id: result.id, at: result.receivedAt, actor: 'PCN result service', label: `Nhận kết quả ${result.outcome}` });
  for (const approval of (input.approvalSteps || []).filter((step) => step.dossierId === input.dossier.id)) if (approval.actedAt && approval.assigneeUsername?.trim()) events.push({ id: approval.id, at: approval.actedAt, actor: 'PCN reviewer', label: `Phê duyệt ${approval.status}` });
  for (const log of (input.activityLogs || []).filter((log) => (log.entityId === input.dossier.id || log.entityId === input.dossier.dossierCode) && (log.actorUsername?.trim() || log.actorName.trim()))) events.push({ id: log.id, at: log.createdAt, actor: 'PCN audit service', label: `Audit ${log.action}` });
  const messageId = (event: { id: string }) => id('message', event.id);
  return events.filter((event) => Number.isFinite(Date.parse(event.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || messageId(a).localeCompare(messageId(b)));
}

export function buildPcnSequenceDiagram(input: PcnArchifyWorkflowInput): ArchifyDiagramResult<ArchifySequenceDocument> {
  const events = pcnEvents(input); if (!events.length) return unavailableDiagram('sequence', 'Không có sự kiện thực tế đủ để dựng chuỗi actor/task/audit.');
  const actors = [...new Set(events.map((event) => event.actor).filter(Boolean))]; if (!actors.length) return unavailableDiagram('sequence', 'Không có actor thực tế đủ để dựng chuỗi actor/task/audit.');
  const participants = [...actors, 'pcn-system'].map((actor, index) => ({ id: id('actor', actor), type: index === 0 ? 'backend' as const : 'external' as const, label: actor }));
  const participantIds = new Set(participants.map((participant) => participant.id));
  const messages = events.map((event, index) => ({ id: id('message', event.id), from: id('actor', event.actor), to: id('actor', event.actor) === id('actor', 'pcn-system') ? id('actor', actors[0]) : id('actor', 'pcn-system'), y: 160 + index * 52, label: event.label, variant: 'default' as const })).filter((message) => participantIds.has(message.from) && participantIds.has(message.to) && message.from !== message.to);
  if (!messages.length || participants.length < 2) return unavailableDiagram('sequence', 'Không có actor và sự kiện thực tế đủ để dựng chuỗi.');
  return { available: true, diagramType: 'sequence', document: { schema_version: 1, diagram_type: 'sequence', meta: { title: `${input.dossier.dossierCode} · Sequence PCN`, locale: 'en', views: view(participants.map((participant) => participant.id)) }, participants, messages } };
}

export function buildPcnArchitectureDiagram(input: PcnArchifyWorkflowInput): ArchifyArchitectureDocument {
  const components: ArchifyArchitectureDocument['components'] = [{ id: 'pcn', type: 'backend', label: 'PCN', sublabel: input.dossier.dossierCode, row: 0, col: 0 }, { id: 'postgres', type: 'database', label: 'PostgreSQL', sublabel: 'Dữ liệu hồ sơ', row: 0, col: 1 }, { id: 'private-storage', type: 'cloud', label: 'Private Storage', sublabel: 'Tài sản riêng tư', row: 1, col: 1 }];
  const linkedLabIds = new Set(input.dossier.labRequestIds);
  const hasLab = (input.results || []).some((result) => result.dossierId === input.dossier.id && linkedLabIds.has(result.labRequestId)); if (hasLab) components.push({ id: 'ptn', type: 'external', label: 'PTN liên kết', sublabel: 'Bản ghi PYC/KQTN đã liên kết', row: 0, col: 2 });
  const connections = [{ from: 'pcn', to: 'postgres', label: 'hồ sơ' }, { from: 'pcn', to: 'private-storage', label: 'tài liệu' }, ...(hasLab ? [{ from: 'pcn', to: 'ptn', label: 'PYC/KQTN' }] : [])].map((connection, index) => ({ ...connection, id: `pcn-connection-${index}` }));
  return { schema_version: 1, diagram_type: 'architecture', meta: { title: `${input.dossier.dossierCode} · Architecture PCN`, locale: 'en', views: view(components.map((component) => component.id)) }, components, connections };
}
