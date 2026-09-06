import type { ArchifyDiagramResult } from './archifyDiagram.ts';
import { archifyStableId, unavailableDiagram } from './archifyDiagram.ts';
import type { PgdArchifyWorkflowInput } from './pgdArchifyWorkflow.ts';
import { PGD_WORKFLOW_STATES } from './pgdDomain.ts';

type Meta = { title: string; subtitle?: string; locale: 'en'; views?: Array<{ id: string; label: string; focus: string[]; note?: string }> };
type ComponentType = 'frontend' | 'backend' | 'database' | 'cloud' | 'security' | 'messagebus' | 'external';
export type ArchifyLifecycleDocument = { schema_version: 1; diagram_type: 'lifecycle'; meta: Meta; lanes: Array<{ id: string; label: string }>; states: Array<{ id: string; type: 'start' | 'active' | 'waiting' | 'decision' | 'success' | 'failure' | 'neutral'; label: string; lane: string; col: number; tag?: string }>; transitions: Array<{ id?: string; from: string; to: string; label?: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };
export type ArchifyDataflowDocument = { schema_version: 1; diagram_type: 'dataflow'; meta: Meta; stages: Array<{ label: string }>; nodes: Array<{ id: string; type: ComponentType; label: string; stage: number; row: number }>; flows: Array<{ id?: string; from: string; to: string; label: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };
export type ArchifySequenceDocument = { schema_version: 1; diagram_type: 'sequence'; meta: Meta; participants: Array<{ id: string; type: ComponentType; label: string }>; messages: Array<{ id: string; from: string; to: string; y: number; label: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' | 'return' }> };
export type ArchifyArchitectureDocument = { schema_version: 1; diagram_type: 'architecture'; meta: Meta; components: Array<{ id: string; type: ComponentType; label: string; sublabel?: string; row?: number; col?: number }>; connections: Array<{ id?: string; from: string; to: string; label?: string; variant?: 'default' | 'emphasis' | 'security' | 'dashed' }> };

const id = (prefix: string, value: string) => archifyStableId(prefix, value).replace(/~/g, '-');
const views = (focus: string[]) => [{ id: 'overview', label: 'Tổng quan', focus, note: 'Chỉ tập trung vào dữ liệu PGD đã liên kết.' }];

export function buildPgdLifecycleDiagram(input: PgdArchifyWorkflowInput): ArchifyLifecycleDocument {
  const states = PGD_WORKFLOW_STATES.map((state, index) => ({ id: id('pgd', state.code), type: index === 0 ? 'start' as const : state.code === input.request.status ? 'active' as const : state.code === 'ARCHIVED' ? 'success' as const : 'neutral' as const, label: state.label, lane: 'main', col: Math.min(4, index), ...(state.code === input.request.status ? { tag: 'Hiện tại' } : {}) }));
  return { schema_version: 1, diagram_type: 'lifecycle', meta: { title: `${input.request.requestCode} · Lifecycle PGD`, locale: 'en', views: views(states.map((state) => state.id)) }, lanes: [{ id: 'main', label: 'Lưu trình PGD' }], states, transitions: [] };
}

export function buildPgdDataflowDiagram(input: PgdArchifyWorkflowInput): ArchifyDiagramResult<ArchifyDataflowDocument> {
  const requestId = input.request.id;
  const docs = input.dossierDocuments.filter((doc) => doc.requestId === requestId);
  const samples = input.samples.filter((sample) => sample.requestId === requestId);
  const labs = input.labRequests.filter((lab) => lab.requestId === requestId && samples.some((sample) => sample.id === lab.sampleId));
  const results = input.labResults.filter((result) => result.requestId === requestId && labs.some((lab) => lab.id === result.labRequestId));
  const nodes: ArchifyDataflowDocument['nodes'] = [
    { id: 'pgd-request', type: 'backend', label: 'Hồ sơ PGD', stage: 0, row: 0 },
    ...docs.map((doc, row) => ({ id: id('document', doc.id), type: 'external' as const, label: `Tài liệu PGD ${doc.requirementCode}`, stage: 1, row })),
    ...samples.filter((sample) => labs.some((lab) => lab.sampleId === sample.id)).map((sample, row) => ({ id: id('sample', sample.id), type: 'messagebus' as const, label: `Mẫu ${sample.sampleCode} · ${sample.disposition}`, stage: 2, row })),
    ...labs.map((lab, row) => ({ id: id('lab', lab.id), type: 'cloud' as const, label: `PTN ${lab.laboratoryName}`, stage: 3, row })),
    ...results.map((result, row) => ({ id: id('result', result.id), type: 'security' as const, label: `KQTN ${result.reportNumber || result.id}`, stage: 4, row })),
  ];
  const flows: ArchifyDataflowDocument['flows'] = docs.map((doc) => ({ id: id('flow', doc.id), from: 'pgd-request', to: id('document', doc.id), label: `tài liệu PGD ${doc.requirementCode}`, variant: 'emphasis' }));
  for (const lab of labs) flows.push({ id: id('flow', `${lab.sampleId}-${lab.id}`), from: id('sample', lab.sampleId), to: id('lab', lab.id), label: samples.find((sample) => sample.id === lab.sampleId)?.disposition === 'LAB' ? 'LAB' : 'RETAINED' });
  for (const result of results) flows.push({ id: id('flow', `${result.labRequestId}-${result.id}`), from: id('lab', result.labRequestId), to: id('result', result.id), label: 'Kết quả PTN', variant: 'emphasis' });
  if (!flows.length) return unavailableDiagram('dataflow', 'Chưa có đủ dữ liệu PGD liên kết để dựng biểu đồ.');
  return { available: true, diagramType: 'dataflow', document: { schema_version: 1, diagram_type: 'dataflow', meta: { title: `${input.request.requestCode} · Dataflow PGD`, locale: 'en', views: views(nodes.map((node) => node.id)) }, stages: [{ label: 'Hồ sơ' }, { label: 'Tài liệu' }, { label: 'Mẫu' }, { label: 'PTN' }, { label: 'Kết quả' }], nodes, flows } };
}

type PgdEvent = { id: string; at: string; actor: string; label: string };
function pgdEvents(input: PgdArchifyWorkflowInput): PgdEvent[] {
  const requestId = input.request.id;
  const events: PgdEvent[] = [];
  const add = (eventId: string, at: unknown, actor: string | undefined, label: string) => { if (typeof at === 'string' && Number.isFinite(Date.parse(at)) && actor?.trim()) events.push({ id: eventId, at, actor, label }); };
  for (const sample of input.samples.filter((sample) => sample.requestId === requestId)) add(sample.id, sample.sampledAt, sample.sampledByUsername ? 'PGD field inspector' : undefined, `Mẫu ${sample.sampleCode}: ${sample.disposition}`);
  for (const lab of input.labRequests.filter((lab) => lab.requestId === requestId)) add(lab.id, lab.handover?.sentAt, lab.handover?.senderUsername ? 'PGD operator' : undefined, `Gửi PYC PTN ${lab.laboratoryName}`);
  for (const result of input.labResults.filter((result) => result.requestId === requestId)) add(result.id, result.receivedAt, 'PGD result service', `Nhận KQTN ${result.reportNumber || 'đã nhận'}`);
  for (const approval of input.approvals.filter((approval) => approval.requestId === requestId)) add(approval.id, approval.actedAt, approval.actedByUsername ? 'PGD approver' : undefined, `Phê duyệt ${approval.role}: ${approval.status}`);
  for (const log of input.activityLogs.filter((log) => (log.entityId === requestId || log.entityId === input.request.requestCode) && String(log.actorUsername || log.actorName || '').trim())) add(String(log.id || ''), log.createdAt, 'PGD audit service', `Audit ${String(log.action || 'activity')}`);
  return events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || id('message', left.id).localeCompare(id('message', right.id)));
}

export function buildPgdSequenceDiagram(input: PgdArchifyWorkflowInput): ArchifyDiagramResult<ArchifySequenceDocument> {
  const events = pgdEvents(input);
  const actors = [...new Set(events.map((event) => event.actor))];
  if (!events.length || !actors.length) return unavailableDiagram('sequence', 'Không có actor và sự kiện PGD thực tế đủ để dựng chuỗi.');
  const system = 'PGD system';
  const participants = [...actors, system].map((actor, index) => ({ id: id('actor', actor), type: index === 0 ? 'backend' as const : 'external' as const, label: actor }));
  const messages = events.map((event, index) => ({ id: id('message', event.id), from: id('actor', event.actor), to: id('actor', system), y: 160 + index * 52, label: event.label })).filter((message) => message.from !== message.to);
  if (!messages.length) return unavailableDiagram('sequence', 'Không có actor và sự kiện PGD thực tế đủ để dựng chuỗi.');
  return { available: true, diagramType: 'sequence', document: { schema_version: 1, diagram_type: 'sequence', meta: { title: `${input.request.requestCode} · Sequence PGD`, locale: 'en', views: views(participants.map((participant) => participant.id)) }, participants, messages } };
}

export function buildPgdArchitectureDiagram(input: PgdArchifyWorkflowInput): ArchifyArchitectureDocument {
  const requestId = input.request.id;
  const linkedLabs = input.labRequests.filter((lab) => lab.requestId === requestId && input.samples.some((sample) => sample.requestId === requestId && sample.id === lab.sampleId));
  const components: ArchifyArchitectureDocument['components'] = [
    { id: 'pgd', type: 'backend', label: 'PGD', sublabel: input.request.requestCode, row: 0, col: 0 },
    { id: 'postgres', type: 'database', label: 'PostgreSQL', sublabel: 'Dữ liệu PGD', row: 0, col: 1 },
    { id: 'private-storage', type: 'cloud', label: 'Private Storage', sublabel: 'Tài sản riêng tư', row: 1, col: 1 },
    ...linkedLabs.map((lab, index) => ({ id: id('ptn', lab.id), type: 'external' as const, label: `PTN ${lab.laboratoryName}`, sublabel: lab.laboratoryCode || 'Bản ghi liên kết', row: 0, col: index + 2 })),
  ];
  const connections = [{ id: 'pgd-connection-database', from: 'pgd', to: 'postgres', label: 'hồ sơ' }, { id: 'pgd-connection-storage', from: 'pgd', to: 'private-storage', label: 'tài liệu' }, ...linkedLabs.map((lab) => ({ id: id('pgd-connection', lab.id), from: 'pgd', to: id('ptn', lab.id), label: 'PYC PTN' }))];
  return { schema_version: 1, diagram_type: 'architecture', meta: { title: `${input.request.requestCode} · Architecture PGD`, locale: 'en', views: views(components.map((component) => component.id)) }, components, connections };
}
