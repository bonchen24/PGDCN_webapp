import type { ArchifyWorkflowDocument } from './pcnArchifyWorkflow.ts';
import { countTemplateRequirements, type DossierTemplateDomain, type DossierTemplateEditorModel } from './pgdcnDossierTemplate.ts';

const TYPE_BY_KIND: Record<DossierTemplateEditorModel['nodes'][number]['kind'], ArchifyWorkflowDocument['nodes'][number]['type']> = {
  DOCUMENT_TASK: 'backend',
  APPROVAL_TASK: 'security',
  DECISION: 'security',
  PARALLEL_SPLIT: 'messagebus',
  PARALLEL_JOIN: 'messagebus',
  END: 'database',
};

function archifyId(value: string): string {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-zA-Z]/.test(normalized) ? normalized : `node-${normalized || 'unknown'}`;
}

function laneLabel(laneId: string): string {
  return ({
    intake: 'Tiếp nhận',
    preparation: 'Chuẩn bị',
    field: 'Hiện trường',
    lab: 'PTN & kết quả',
    review: 'Rà soát & phê duyệt',
    archive: 'Trả kết quả & lưu trữ',
  } as Record<string, string>)[laneId] || laneId;
}

export function buildDossierTemplateArchifyWorkflow(model: DossierTemplateEditorModel, domain: DossierTemplateDomain): ArchifyWorkflowDocument {
  const activeNodes = model.nodes.filter((node) => node.active !== false).sort((left, right) => left.column - right.column || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const activeIds = new Set(activeNodes.map((node) => node.id));
  const nodes = activeNodes.map((node) => ({
    id: archifyId(node.id),
    lane: node.laneId || 'default',
    col: Math.max(0, (node.column || 1) - 1),
    type: TYPE_BY_KIND[node.kind],
    label: node.label,
    sublabel: `${node.kind.replaceAll('_', ' ')} · ${node.requirementRefs.length} tài liệu gán`,
    tag: node.requirementRefs.length ? 'Có checklist' : 'Không có checklist',
    width: 210,
    height: 68,
  }));
  const edges = model.transitions.filter((transition) => activeIds.has(transition.fromNodeId) && activeIds.has(transition.toNodeId)).map((transition) => ({
    id: archifyId(transition.id),
    from: archifyId(transition.fromNodeId),
    to: archifyId(transition.toNodeId),
    ...(transition.label ? { label: transition.label } : {}),
    variant: transition.condition && transition.condition !== 'ALWAYS' ? 'security' as const : 'default' as const,
    role: 'main' as const,
  }));
  const mainPath = activeNodes.map((node) => archifyId(node.id));
  const laneIds = Array.from(new Set(activeNodes.map((node) => node.laneId || 'default')));
  const maxColumn = Math.max(0, ...activeNodes.map((node) => Math.max(0, (node.column || 1) - 1)));
  const requirementCount = countTemplateRequirements(model);
  return {
    schema_version: 2,
    diagram_type: 'workflow',
    meta: {
      title: `${model.code} · ${model.name}`,
      subtitle: `${domain} · v${model.version} · ${activeNodes.length} node · ${requirementCount} loại tài liệu`,
      locale: 'en',
      animation: 'trace',
      visual_preset: 'signal-flow',
      quality_profile: 'showcase',
      views: [
        { id: 'overview', label: 'Tổng quan lưu trình', focus: mainPath, note: 'Sơ đồ chỉ hiển thị topology và checklist loại tài liệu của bộ mẫu.' },
        { id: 'requirements', label: 'Node & checklist', focus: activeNodes.filter((node) => node.requirementRefs.length > 0).map((node) => archifyId(node.id)), note: 'Tập trung vào các node có loại tài liệu được gán.' },
      ].filter((view) => view.focus.length > 0),
    },
    lanes: laneIds.map((id) => ({ id, label: laneLabel(id) })),
    phases: [
      { id: 'phase-intake', label: 'Tiếp nhận', fromCol: 0, toCol: Math.min(1, maxColumn) },
      { id: 'phase-execution', label: 'Xử lý & phối hợp', fromCol: Math.min(2, maxColumn), toCol: Math.min(4, maxColumn), variant: 'emphasis' },
      { id: 'phase-close', label: 'Soát xét & lưu trữ', fromCol: Math.min(5, maxColumn), toCol: maxColumn, variant: 'dashed' },
    ],
    groups: [],
    mainPath,
    nodes,
    edges,
    cards: [
      { dot: domain === 'PCN' ? 'emerald' : 'cyan', title: 'Bộ hồ sơ mẫu', items: [`${activeNodes.length} node · ${edges.length} nối`, `${requirementCount} loại tài liệu tham chiếu`, `Phiên bản v${model.version} · ${model.status}`] },
      { dot: 'violet', title: 'Giới hạn preview', items: ['Archify chỉ đọc và trình bày topology', 'File thật chỉ xuất hiện khi hồ sơ runtime được xử lý'] },
    ],
  };
}

export function buildPcnArchifyWorkflowTemplate(model: DossierTemplateEditorModel): ArchifyWorkflowDocument {
  if (model.domain !== 'PCN') throw new Error('Preview PCN cần model domain PCN.');
  return buildDossierTemplateArchifyWorkflow(model, 'PCN');
}
