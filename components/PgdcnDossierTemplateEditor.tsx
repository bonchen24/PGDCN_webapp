'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DossierTemplateEditorModel, DossierTemplateEditorNode, DossierTemplateEditorTransition } from '../utils/pgdcnDossierTemplate.ts';
import type { PgdWorkflowTemplateAppliesTo } from '../utils/pgdWorkflowTemplate.ts';
import { connectDossierTemplateEditorNodes, moveDossierTemplateEditorNode, validateDossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import { PGD_V1_PRODUCT_GROUPS } from '../utils/pgdDomain.ts';
import PgdcnDossierTemplateCanvas from './PgdcnDossierTemplateCanvas.tsx';
import PgdcnDossierTemplateInspector, { type DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

export interface PgdcnDossierTemplateEditorProps {
  model: DossierTemplateEditorModel;
  requirements: DossierTemplateRequirementOption[];
  onChange: (model: DossierTemplateEditorModel) => void;
  onSaveDraft: (model: DossierTemplateEditorModel) => void | Promise<void>;
  onPreview: (model: DossierTemplateEditorModel) => void;
  canMutate: boolean;
  saving?: boolean;
  saveError?: string;
}

const PALETTE: Array<{ kind: DossierTemplateEditorNode['kind']; label: string; description: string }> = [
  { kind: 'DOCUMENT_TASK', label: 'Tài liệu / nghiệp vụ', description: 'Một bước xử lý hồ sơ' },
  { kind: 'APPROVAL_TASK', label: 'Phê duyệt', description: 'Bước cần người có thẩm quyền' },
  { kind: 'DECISION', label: 'Điều kiện', description: 'Rẽ nhánh theo kết quả' },
  { kind: 'PARALLEL_SPLIT', label: 'Tách nhánh', description: 'Chạy nhiều nhánh cùng lúc' },
  { kind: 'PARALLEL_JOIN', label: 'Gom nhánh', description: 'Đợi các nhánh hoàn tất' },
  { kind: 'END', label: 'Kết thúc', description: 'Đóng lưu trình' },
];

const PCN_FIELD_CODES = [
  { code: 'QC4', label: 'QC4 · Hợp quy' },
  { code: 'QC9', label: 'QC9 · Hợp chuẩn' },
] as const;

const PGD_PRODUCT_GROUP_LABELS: Record<(typeof PGD_V1_PRODUCT_GROUPS)[number], string> = {
  STEEL_METAL: 'Sắt thép & kim loại',
  MACHINERY_LINE: 'Máy móc & dây chuyền',
  COAL: 'Than',
  OTHER: 'Nhóm khác',
};

function createClientNodeId(kind: DossierTemplateEditorNode['kind'], sequence: number): string {
  const random = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : `${Date.now()}-${sequence}`;
  return `draft-${kind.toLowerCase()}-${random}`;
}

export default function PgdcnDossierTemplateEditor(props: PgdcnDossierTemplateEditorProps) {
  const [draft, setDraft] = useState(props.model);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedTransitionId, setSelectedTransitionId] = useState<string>();
  const [connectionSourceId, setConnectionSourceId] = useState<string>();
  const [saveMessage, setSaveMessage] = useState('');
  const sequence = useRef(0);
  const modelKey = `${props.model.id}:${props.model.version}`;
  const modelKeyRef = useRef(modelKey);
  useEffect(() => {
    setDraft(props.model);
    if (modelKeyRef.current !== modelKey) {
      modelKeyRef.current = modelKey;
      setSelectedNodeId(undefined);
      setSelectedTransitionId(undefined);
      setConnectionSourceId(undefined);
    }
  }, [modelKey, props.model]);

  const validation = useMemo(() => validateDossierTemplateEditorModel(draft), [draft]);
  const selectedNode = selectedTransitionId ? undefined : draft.nodes.find((node) => node.id === selectedNodeId);
  const selectedTransition = draft.transitions.find((transition) => transition.id === selectedTransitionId);
  const updateDraft = (next: DossierTemplateEditorModel) => { setDraft(next); props.onChange(next); setSaveMessage(''); };

  const updateNode = (nodeId: string, changes: Partial<DossierTemplateEditorNode>) => updateDraft({ ...draft, nodes: draft.nodes.map((node) => node.id === nodeId ? { ...node, ...changes } : node) });
  const updateMetadata = (changes: Partial<Pick<DossierTemplateEditorModel, 'code' | 'name' | 'description'>>) => updateDraft({ ...draft, ...changes });
  const toggleScope = (value: string, checked: boolean) => {
    if (draft.domain === 'PCN') {
      const appliesTo = draft.appliesTo as { fieldCodes: string[]; methods?: never[]; dossierType?: string };
      const fieldCodes = checked ? [...new Set([...appliesTo.fieldCodes, value])] : appliesTo.fieldCodes.filter((code) => code !== value);
      updateDraft({ ...draft, appliesTo: { ...appliesTo, fieldCodes } });
      return;
    }
    const appliesTo = draft.appliesTo as PgdWorkflowTemplateAppliesTo;
    const productGroups = (checked ? [...new Set([...appliesTo.productGroups, value])] : appliesTo.productGroups.filter((group) => group !== value)) as PgdWorkflowTemplateAppliesTo['productGroups'];
    updateDraft({ ...draft, appliesTo: { ...appliesTo, productGroups } });
  };
  const addNode = (kind: DossierTemplateEditorNode['kind'], laneId = 'intake', column = 1) => {
    sequence.current += 1;
    const node: DossierTemplateEditorNode = { id: createClientNodeId(kind, sequence.current), kind, label: PALETTE.find((item) => item.kind === kind)?.label || 'Bước mới', active: true, laneId, column, sortOrder: (draft.nodes.length + 1) * 10, requirementRefs: [], ...(kind === 'PARALLEL_JOIN' ? { joinPolicy: 'ALL' as const } : {}) };
    const next = { ...draft, nodes: [...draft.nodes, node] };
    updateDraft(next);
    setSelectedNodeId(node.id);
  };
  const selectNode = (nodeId: string) => { setSelectedNodeId(nodeId); setSelectedTransitionId(undefined); };
  const selectTransition = (transitionId: string) => { setSelectedTransitionId(transitionId); setSelectedNodeId(undefined); setConnectionSourceId(undefined); };
  const deleteNode = (nodeId: string) => {
    const next = { ...draft, nodes: draft.nodes.filter((node) => node.id !== nodeId), transitions: draft.transitions.filter((transition) => transition.fromNodeId !== nodeId && transition.toNodeId !== nodeId) };
    updateDraft(next);
    if (selectedNodeId === nodeId) setSelectedNodeId(undefined);
  };
  const connect = (targetId: string) => {
    if (!connectionSourceId || connectionSourceId === targetId) return;
    const next = connectDossierTemplateEditorNodes(draft, connectionSourceId, targetId);
    updateDraft(next);
    setSelectedTransitionId(next.transitions.find((transition) => transition.fromNodeId === connectionSourceId && transition.toNodeId === targetId)?.id);
    setSelectedNodeId(undefined);
    setConnectionSourceId(undefined);
  };
  const updateTransition = (transitionId: string, changes: Partial<DossierTemplateEditorTransition>) => updateDraft({ ...draft, transitions: draft.transitions.map((transition) => transition.id === transitionId ? { ...transition, ...changes } : transition) });

  return (
    <section data-testid="pgdcn-dossier-template-editor" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Thiết kế trực quan</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{draft.name || 'Bộ hồ sơ mẫu mới'}</h2><p className="mt-1 text-sm text-slate-500">Kéo bước vào khu vực/cột, chọn “Nối tới”, rồi gán loại tài liệu ở bảng bên phải.</p><div data-testid="pgdcn-dossier-template-metadata" className="mt-4 grid gap-3 md:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Mã bộ hồ sơ<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span><input required aria-required="true" value={draft.code} onChange={(event) => updateMetadata({ code: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-800" /></label><label className="block text-xs font-semibold text-slate-600">Tên bộ hồ sơ<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span><input required aria-required="true" value={draft.name} onChange={(event) => updateMetadata({ name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-800" /></label><label className="block text-xs font-semibold text-slate-600 md:col-span-2">Mô tả<input value={draft.description || ''} onChange={(event) => updateMetadata({ description: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-800" /></label></div><fieldset className="mt-3"><legend className="text-xs font-semibold text-slate-600">Áp dụng cho</legend><div className="mt-2 flex flex-wrap gap-2">{draft.domain === 'PCN' ? PCN_FIELD_CODES.map((item) => <label key={item.code} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"><input type="checkbox" checked={(draft.appliesTo as { fieldCodes: string[] }).fieldCodes.includes(item.code)} onChange={(event) => toggleScope(item.code, event.target.checked)} />{item.label}</label>) : PGD_V1_PRODUCT_GROUPS.map((group) => <label key={group} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"><input type="checkbox" checked={(draft.appliesTo as { productGroups: string[] }).productGroups.includes(group)} onChange={(event) => toggleScope(group, event.target.checked)} />{PGD_PRODUCT_GROUP_LABELS[group]}</label>)}</div></fieldset></div><div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700" onClick={() => props.onPreview(draft)}>Xem trước Archify</button><button type="button" data-testid="pgdcn-dossier-template-save" disabled={!props.canMutate || props.saving || !validation.valid} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={async () => { await props.onSaveDraft(draft); setSaveMessage('Đã lưu bản nháp'); }}> {props.saving ? 'Đang lưu...' : 'Lưu bản nháp'} </button></div></div>
      {(props.saveError || saveMessage || !validation.valid) && <div data-testid="pgdcn-dossier-template-validation" className={`rounded-xl border p-3 text-sm ${validation.valid && !props.saveError ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{props.saveError || saveMessage || <><p className="font-medium">Cần bổ sung trước khi lưu:</p><ul className="mt-1 list-disc pl-5">{validation.errors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}</ul></>}</div>}
      {connectionSourceId && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Đang nối từ “{draft.nodes.find((node) => node.id === connectionSourceId)?.label}”. Chọn bước đích trên canvas.</div>}
      <div className="grid gap-4 xl:grid-cols-[220px,minmax(0,1fr),340px]">
        <aside data-testid="pgdcn-dossier-template-palette" className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-800">Thành phần</h3><p className="mt-1 text-xs text-slate-500">Bấm để thêm vào canvas.</p><div className="mt-3 space-y-2">{PALETTE.map((item) => <button key={item.kind} type="button" className="min-h-11 w-full rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50" onClick={() => addNode(item.kind)}><span className="block text-sm font-medium text-slate-700">{item.label}</span><span className="mt-1 block text-xs text-slate-400">{item.description}</span></button>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Tài liệu gán ở đây là tham chiếu đến danh mục. Tệp thật sẽ được tải lên khi hồ sơ chạy.</div></aside>
        <div className="min-w-0"><PgdcnDossierTemplateCanvas model={draft} selectedNodeId={selectedNodeId} selectedTransitionId={selectedTransitionId} connectionSourceId={connectionSourceId} onSelectNode={selectNode} onSelectTransition={selectTransition} onMoveNode={(nodeId, position) => updateDraft(moveDossierTemplateEditorNode(draft, nodeId, position))} onBeginConnection={(nodeId) => { selectNode(nodeId); setConnectionSourceId(nodeId); }} onCompleteConnection={connect} onAddNode={addNode} onDeleteNode={deleteNode} onDeleteTransition={(transitionId) => { updateDraft({ ...draft, transitions: draft.transitions.filter((transition) => transition.id !== transitionId) }); if (selectedTransitionId === transitionId) setSelectedTransitionId(undefined); }} /></div>
        <PgdcnDossierTemplateInspector domain={draft.domain} conditionScopeOptions={draft.domain === 'PCN' ? (draft.appliesTo as { fieldCodes: string[] }).fieldCodes : (draft.appliesTo as { productGroups: string[] }).productGroups} selectedNode={selectedNode} selectedTransition={selectedTransition} requirementOptions={props.requirements} onChangeNode={(changes) => selectedNode && updateNode(selectedNode.id, changes)} onChangeTransition={(changes) => selectedTransition && updateTransition(selectedTransition.id, changes)} onToggleRequirement={(requirementId, checked) => selectedNode && updateNode(selectedNode.id, { requirementRefs: checked ? [...new Set([...selectedNode.requirementRefs, requirementId])] : selectedNode.requirementRefs.filter((id) => id !== requirementId) })} onBeginConnection={() => selectedNode && setConnectionSourceId(selectedNode.id)} onDeleteNode={() => selectedNode && deleteNode(selectedNode.id)} onClose={() => { setSelectedNodeId(undefined); setSelectedTransitionId(undefined); setConnectionSourceId(undefined); }} />
      </div>
    </section>
  );
}
