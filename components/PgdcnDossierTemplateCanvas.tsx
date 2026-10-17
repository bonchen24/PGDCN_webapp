'use client';

import { DndContext, type DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DossierTemplateEditorModel, DossierTemplateEditorNode } from '../utils/pgdcnDossierTemplate.ts';

export interface PgdcnDossierTemplateCanvasProps {
  model: DossierTemplateEditorModel;
  selectedNodeId?: string;
  selectedTransitionId?: string;
  connectionSourceId?: string;
  onSelectNode: (nodeId: string) => void;
  onSelectTransition: (transitionId: string) => void;
  onMoveNode: (nodeId: string, position: { laneId: string; column: number; sortOrder?: number }) => void;
  onBeginConnection: (nodeId: string) => void;
  onCompleteConnection: (nodeId: string) => void;
  onAddNode: (kind: DossierTemplateEditorNode['kind'], laneId: string, column: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteTransition: (transitionId: string) => void;
}

const LANES = [
  { id: 'default', label: 'Chưa phân nhóm' },
  { id: 'intake', label: 'Tiếp nhận' },
  { id: 'preparation', label: 'Chuẩn bị' },
  { id: 'field', label: 'Hiện trường' },
  { id: 'lab', label: 'PTN & kết quả' },
  { id: 'review', label: 'Rà soát & phê duyệt' },
  { id: 'archive', label: 'Trả kết quả & lưu trữ' },
] as const;

const COLUMNS = [1, 2, 3, 4, 5, 6];

const MOVE_DIRECTIONS = [
  { direction: 'left', symbol: '←', label: 'sang trái' },
  { direction: 'right', symbol: '→', label: 'sang phải' },
  { direction: 'up', symbol: '↑', label: 'lên làn trên' },
  { direction: 'down', symbol: '↓', label: 'xuống làn dưới' },
] as const;

type MoveDirection = (typeof MOVE_DIRECTIONS)[number]['direction'];
type NodePosition = { laneId: string; column: number };

function getAdjacentPosition(laneId: string, column: number, direction: MoveDirection): NodePosition | undefined {
  const laneIndex = LANES.findIndex((lane) => lane.id === laneId);
  const nextLaneIndex = laneIndex + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0);
  const nextColumn = column + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0);
  const nextLane = LANES[nextLaneIndex];
  if (!nextLane || !COLUMNS.includes(nextColumn)) return undefined;
  return { laneId: nextLane.id, column: nextColumn };
}

const KIND_LABELS: Record<DossierTemplateEditorNode['kind'], string> = {
  DOCUMENT_TASK: 'Tài liệu / nghiệp vụ',
  APPROVAL_TASK: 'Phê duyệt',
  DECISION: 'Điều kiện',
  PARALLEL_SPLIT: 'Tách nhánh',
  PARALLEL_JOIN: 'Gom nhánh',
  END: 'Kết thúc',
};

function TemplateNodeCard({
  node,
  selected,
  connecting,
  moveTargets,
  onSelect,
  onBeginConnection,
  onCompleteConnection,
  onMove,
  onDelete,
}: {
  node: DossierTemplateEditorNode;
  selected: boolean;
  connecting: boolean;
  moveTargets: Array<{ direction: MoveDirection; symbol: string; label: string; target: NodePosition | undefined }>;
  onSelect: () => void;
  onBeginConnection: () => void;
  onCompleteConnection: () => void;
  onMove: (position: NodePosition) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: node.id, data: { nodeId: node.id } });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.65 : 1 };
  const isTarget = Boolean(connecting && selected === false);
  const nodeLabel = node.label || 'Node chưa đặt tên';
  return (
    <article
      ref={setNodeRef}
      style={style}
      data-testid={`pgdcn-template-node-${node.id}`}
      className={`min-h-[132px] rounded-xl border bg-white p-3 shadow-sm transition ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} ${isTarget ? 'border-dashed border-emerald-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Kéo bước ${nodeLabel}`}
          className="min-h-11 min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{KIND_LABELS[node.kind]}</span>
          <span className="mt-1 block text-sm font-semibold text-slate-800">{nodeLabel}</span>
        </button>
        <button type="button" className="min-h-11 min-w-11 rounded-lg text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" aria-label={`Xóa node ${nodeLabel}`} onClick={onDelete}>×</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{node.requirementRefs.length} tài liệu gán</span>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" id={`pgdcn-template-node-select-${node.id}`} aria-label={`Chọn bước ${nodeLabel}`} aria-pressed={selected} className="min-h-11 rounded-lg px-2 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={onSelect}>Chọn</button>
          {connecting ? (
            <button type="button" aria-label={`Chọn bước ${nodeLabel} làm đích nối`} className="min-h-11 rounded-lg bg-emerald-50 px-2 font-medium text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2" onClick={onCompleteConnection}>Chọn đích</button>
          ) : (
            <button type="button" aria-label={`Bắt đầu nối từ bước ${nodeLabel}`} className="min-h-11 rounded-lg px-2 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={onBeginConnection}>Nối tới</button>
          )}
        </div>
      </div>
      <div role="group" aria-label={`Di chuyển ${nodeLabel}`} className="mt-2 grid w-fit grid-cols-2 gap-2">
        {moveTargets.map(({ direction, symbol, label, target }) => (
          <button
            key={direction}
            type="button"
            aria-label={`Di chuyển ${nodeLabel} ${label}`}
            disabled={!target}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-base font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => { if (target) onMove(target); }}
          >
            <span aria-hidden="true">{symbol}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function CanvasDropZone({ laneId, column, nodes, props }: { laneId: string; column: number; nodes: DossierTemplateEditorNode[]; props: PgdcnDossierTemplateCanvasProps }) {
  const { isOver, setNodeRef } = useDroppable({ id: `drop-${laneId}-${column}`, data: { laneId, column } });
  return (
    <div ref={setNodeRef} data-testid={`pgdcn-template-drop-${laneId}-${column}`} className={`min-h-[180px] rounded-xl border p-2 ${isOver ? 'border-blue-400 bg-blue-50' : 'border-dashed border-slate-200 bg-slate-50/70'}`}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cột {column}</div>
      <div className="space-y-2">
        {nodes.map((node) => (
          <TemplateNodeCard
            key={node.id}
            node={node}
            selected={props.selectedNodeId === node.id}
            connecting={Boolean(props.connectionSourceId && props.connectionSourceId !== node.id)}
            moveTargets={MOVE_DIRECTIONS.map((move) => ({ ...move, target: getAdjacentPosition(laneId, column, move.direction) }))}
            onSelect={() => props.onSelectNode(node.id)}
            onBeginConnection={() => props.onBeginConnection(node.id)}
            onCompleteConnection={() => props.onCompleteConnection(node.id)}
            onMove={(position) => {
              props.onMoveNode(node.id, { ...position, sortOrder: node.sortOrder });
              requestAnimationFrame(() => document.getElementById(`pgdcn-template-node-select-${node.id}`)?.focus());
            }}
            onDelete={() => props.onDeleteNode(node.id)}
          />
        ))}
        {nodes.length === 0 && <button type="button" className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" onClick={() => props.onAddNode('DOCUMENT_TASK', laneId, column)}>+ Thêm bước</button>}
      </div>
    </div>
  );
}

export default function PgdcnDossierTemplateCanvas(props: PgdcnDossierTemplateCanvasProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const target = event.over?.data.current as { laneId?: string; column?: number } | undefined;
    const nodeId = String(event.active.id || '');
    if (!target?.laneId || !Number.isInteger(target.column) || !nodeId) return;
    props.onMoveNode(nodeId, { laneId: target.laneId, column: target.column });
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <section data-testid="pgdcn-dossier-template-canvas" className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
        <div className="min-w-[960px] grid grid-cols-[148px_repeat(6,minmax(150px,1fr))] gap-2">
          <div className="rounded-lg bg-slate-100 p-3 text-xs font-semibold text-slate-500">Lưu trình</div>
          {COLUMNS.map((column) => <div key={column} className="rounded-lg bg-slate-100 p-3 text-center text-xs font-semibold text-slate-500">Cột {column}</div>)}
          {LANES.map((lane) => (
            <div key={lane.id} className="contents">
              <div className="flex min-h-[180px] items-start rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{lane.label}</div>
              {COLUMNS.map((column) => (
                <CanvasDropZone
                  key={`${lane.id}-${column}`}
                  laneId={lane.id}
                  column={column}
                  nodes={props.model.nodes.filter((node) => (node.laneId || 'default') === lane.id && node.column === column)}
                  props={props}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
      <div data-testid="pgdcn-dossier-template-connections" className="mt-3 space-y-2">
        {props.model.transitions.map((transition) => (
          <div key={transition.id} data-testid={`pgdcn-template-transition-${transition.id}`} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition ${props.selectedTransitionId === transition.id ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'}`}>
            <button type="button" aria-pressed={props.selectedTransitionId === transition.id} className={`min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${props.selectedTransitionId === transition.id ? 'text-blue-800' : 'text-slate-600 hover:text-blue-700'}`} onClick={() => props.onSelectTransition(transition.id)}>
              <span className="font-medium">{props.model.nodes.find((node) => node.id === transition.fromNodeId)?.label || transition.fromNodeId} → {props.model.nodes.find((node) => node.id === transition.toNodeId)?.label || transition.toNodeId}</span>
              <span className="ml-2 text-slate-400">{transition.label || transition.condition || 'Chọn để cấu hình'}</span>
            </button>
            <button type="button" className="min-h-11 rounded-lg px-2 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" onClick={() => props.onDeleteTransition(transition.id)}>Xóa nối</button>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
