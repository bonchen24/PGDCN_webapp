'use client';

import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Eye, FileText, PauseCircle, X, Sparkles, Layers, ShieldCheck, Clock } from 'lucide-react';
import type { DossierTemplateEditorModel, DossierTemplateEditorNode, DossierTemplateEditorTransition } from '../utils/pgdcnDossierTemplate.ts';
import type { DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

export interface PgdcnDossierTemplatePreviewProps {
  model: DossierTemplateEditorModel;
  requirements: DossierTemplateRequirementOption[];
  onClose: () => void;
}

const LANES = [
  { id: 'default', label: 'Chưa phân nhóm', color: 'from-slate-100 to-slate-200/60 text-slate-700' },
  { id: 'intake', label: 'Tiếp nhận', color: 'from-blue-50 to-indigo-100/60 text-blue-900' },
  { id: 'preparation', label: 'Chuẩn bị', color: 'from-cyan-50 to-teal-100/60 text-teal-900' },
  { id: 'field', label: 'Hiện trường', color: 'from-amber-50 to-orange-100/60 text-amber-900' },
  { id: 'lab', label: 'PTN & kết quả', color: 'from-purple-50 to-violet-100/60 text-purple-900' },
  { id: 'review', label: 'Rà soát & phê duyệt', color: 'from-emerald-50 to-teal-100/60 text-emerald-900' },
  { id: 'archive', label: 'Trả kết quả & lưu trữ', color: 'from-slate-100 to-zinc-200/60 text-slate-900' },
] as const;

const COLUMNS = [1, 2, 3, 4, 5, 6];

const COLUMN_HEADERS: Record<number, { title: string; subtitle: string; color: string }> = {
  1: { title: 'Cột 1', subtitle: 'Tiếp nhận hồ sơ', color: 'border-blue-200 bg-blue-50/80 text-blue-800' },
  2: { title: 'Cột 2', subtitle: 'Xem xét & Chuẩn bị', color: 'border-cyan-200 bg-cyan-50/80 text-cyan-800' },
  3: { title: 'Cột 3', subtitle: 'Hiện trường & Mẫu', color: 'border-amber-200 bg-amber-50/80 text-amber-800' },
  4: { title: 'Cột 4', subtitle: 'PTN & Thử nghiệm', color: 'border-purple-200 bg-purple-50/80 text-purple-800' },
  5: { title: 'Cột 5', subtitle: 'Rà soát & Phê duyệt', color: 'border-emerald-200 bg-emerald-50/80 text-emerald-800' },
  6: { title: 'Cột 6', subtitle: 'Phát hành & Lưu trữ', color: 'border-slate-300 bg-slate-100/80 text-slate-800' },
};

const ACTION_KEY_LABELS: Record<string, string> = {
  INTAKE: 'Tiếp nhận hồ sơ',
  DOCUMENTS: 'Bổ sung hồ sơ',
  ASSIGNMENT: 'Phân công chuyên gia',
  PLAN: 'Lập kế hoạch',
  EVALUATION: 'Kế hoạch & Đánh giá',
  FIELD: 'Giám định hiện trường',
  SAMPLING_LAB: 'Lập PYC & Lấy mẫu',
  SAMPLE_CODING: 'Mã hóa mẫu',
  SAMPLE_HANDOVER: 'Giao nhận mẫu',
  SAMPLE_RETURN: 'Bàn giao trả mẫu',
  LAB_SUONTRACTOR: 'Giao mẫu & nhận KQTN',
  TEST_REPORT: 'Tiếp nhận KQTN',
  TECHNICAL_REVIEW: 'Hoàn thiện kết quả',
  RESULT_ISSUANCE: 'Rà soát & lập báo cáo',
  APPROVAL: 'Phê duyệt',
  DELIVERY: 'Bàn giao khách hàng',
  ARCHIVE: 'Đóng & lưu trữ',
};

const ROLE_LABELS: Record<string, string> = {
  LEADERSHIP: 'Lãnh đạo phòng',
  CERTIFICATION_EXPERT: 'Chuyên gia chứng nhận',
  TECHNICAL_REVIEWER: 'Người soát xét kỹ thuật',
  SAMPLE_COORDINATOR: 'Điều phối / tiếp nhận mẫu',
  DOCUMENT_CLERK: 'Văn thư hồ sơ',
  MANAGER: 'Quản lý',
  SPECIALIST: 'Chuyên viên',
};

const KIND_LABELS: Record<DossierTemplateEditorNode['kind'], string> = {
  DOCUMENT_TASK: 'Tài liệu / nghiệp vụ',
  APPROVAL_TASK: 'Phê duyệt',
  DECISION: 'Điều kiện',
  PARALLEL_SPLIT: 'Tách nhánh',
  PARALLEL_JOIN: 'Gom nhánh',
  END: 'Kết thúc',
};

const PCN_SCOPE_LABELS: Record<string, string> = {
  QC4: 'QC4 · Hợp quy',
  QC9: 'QC9 · Hợp chuẩn',
};

const PGD_SCOPE_LABELS: Record<string, string> = {
  STEEL_METAL: 'Thép và kim loại',
  MACHINERY_LINE: 'Máy móc và dây chuyền',
  COAL: 'Than',
  OTHER: 'Nhóm khác',
};

const PCN_METHOD_LABELS: Record<string, string> = {
  METHOD_1: 'Phương thức 1',
  METHOD_5: 'Phương thức 5',
  METHOD_7: 'Phương thức 7',
};

const PGD_METHOD_LABELS: Record<string, string> = {
  TT58: 'TT58',
  'QT-GĐ-14': 'QT-GĐ-14',
  GENERIC: 'Chung',
};

const CONDITION_LABELS: Record<string, string> = {
  ALWAYS: 'Luôn chuyển',
  REQUIRED_DOCUMENTS_COMPLETE: 'Đủ tài liệu bắt buộc',
  ANY_RESULT_RETURNED: 'Có kết quả',
  RESULT_PASSED: 'Đạt kết quả',
  RESULT_FAILED: 'Không đạt kết quả',
  APPROVAL_RETURNED: 'Bị trả về từ phê duyệt',
  FIELD_MATCH: 'Khớp phạm vi',
  METHOD_MATCH: 'Khớp phương thức',
};

const JOIN_POLICY_LABELS: Record<string, string> = {
  ALL: 'Chờ tất cả nhánh',
  ANY: 'Chờ ít nhất một nhánh',
  QUORUM: 'Đủ số nhánh tối thiểu',
};

const RETURN_POLICY_LABELS: Record<string, string> = {
  REWORK: 'Làm lại bước trước',
  RESTART_DEPENDENCIES: 'Khởi động lại các nhánh phụ thuộc',
  RESTART_TEMPLATE: 'Khởi động lại toàn bộ lưu trình',
};

function statusLabel(status: DossierTemplateEditorModel['status']): string {
  return status === 'PUBLISHED' ? 'Đang áp dụng' : status === 'RETIRED' ? 'Đã ngừng' : 'Bản nháp';
}

function statusBadgeStyle(status: DossierTemplateEditorModel['status']) {
  if (status === 'PUBLISHED') {
    return 'border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 shadow-2xs';
  }
  if (status === 'RETIRED') {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }
  return 'border-amber-200/90 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 shadow-2xs';
}

function transitionConditionParameter(
  transition: DossierTemplateEditorTransition,
  domain: DossierTemplateEditorModel['domain'],
): { label: string; values: string[] } | undefined {
  const config = transition.conditionConfig || {};
  if (transition.condition === 'FIELD_MATCH') {
    const values = domain === 'PCN' ? config.expectedFieldCodes : config.expectedProductGroups;
    if (!Array.isArray(values)) return undefined;
    const labels = domain === 'PCN' ? PCN_SCOPE_LABELS : PGD_SCOPE_LABELS;
    return {
      label: 'Phạm vi điều kiện',
      values: values.map((value) => String(value)).map((value) => labels[value] || value),
    };
  }
  if (transition.condition === 'METHOD_MATCH') {
    const values = domain === 'PCN'
      ? typeof config.expectedMethod === 'string' ? [config.expectedMethod] : []
      : Array.isArray(config.expectedMethodCodes) ? config.expectedMethodCodes : [];
    const labels = domain === 'PCN' ? PCN_METHOD_LABELS : PGD_METHOD_LABELS;
    return {
      label: 'Phương thức điều kiện',
      values: values.map((value) => String(value)).map((value) => labels[value] || value),
    };
  }
  return undefined;
}

function formatScopeLabels(model: DossierTemplateEditorModel): string[] {
  if (model.domain === 'PCN') {
    const appliesTo = model.appliesTo as { fieldCodes?: string[]; methods?: string[] };
    return [
      ...(appliesTo.fieldCodes || []).map((code) => PCN_SCOPE_LABELS[code] || code),
      ...(appliesTo.methods || []).map((method) => method.replace('METHOD_', 'Phương thức ')),
    ];
  }
  const appliesTo = model.appliesTo as { productGroups?: string[]; methodCodes?: string[] };
  return [
    ...(appliesTo.productGroups || []).map((group) => PGD_SCOPE_LABELS[group] || group),
    ...(appliesTo.methodCodes || []).map((method) => `Phương pháp ${method}`),
  ];
}

function getNodeCardStyling(node: DossierTemplateEditorNode) {
  if (node.kind === 'END') {
    return {
      wrap: 'border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100/90 hover:border-slate-400',
      tag: 'bg-slate-200 text-slate-700',
      badge: 'border-slate-300 text-slate-600',
    };
  }
  if (node.kind === 'APPROVAL_TASK') {
    return {
      wrap: 'border-purple-200 bg-gradient-to-b from-purple-50/50 to-fuchsia-50/20 hover:border-purple-300 shadow-xs hover:shadow-purple-500/10',
      tag: 'bg-purple-100 text-purple-800',
      badge: 'border-purple-200 text-purple-700',
    };
  }
  if (node.kind === 'DECISION') {
    return {
      wrap: 'border-amber-200 bg-gradient-to-b from-amber-50/50 to-yellow-50/20 hover:border-amber-300 shadow-xs hover:shadow-amber-500/10',
      tag: 'bg-amber-100 text-amber-800',
      badge: 'border-amber-200 text-amber-700',
    };
  }
  return {
    wrap: 'border-blue-100 bg-white hover:border-blue-300 shadow-xs hover:shadow-blue-500/10',
    tag: 'bg-blue-50 text-blue-700',
    badge: 'border-blue-100 text-blue-600',
  };
}

export default function PgdcnDossierTemplatePreview(props: PgdcnDossierTemplatePreviewProps) {
  const { model, requirements, onClose } = props;

  const requirementMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const req of requirements) {
      map.set(req.id, req.label);
    }
    return map;
  }, [requirements]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, DossierTemplateEditorNode>();
    for (const node of model.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [model.nodes]);

  const scopeBadges = useMemo(() => formatScopeLabels(model), [model]);

  const nodeConnections = useMemo(() => {
    const outgoing = new Map<string, DossierTemplateEditorTransition[]>();
    const incoming = new Map<string, DossierTemplateEditorTransition[]>();
    for (const transition of model.transitions) {
      if (!outgoing.has(transition.fromNodeId)) outgoing.set(transition.fromNodeId, []);
      outgoing.get(transition.fromNodeId)!.push(transition);
      if (!incoming.has(transition.toNodeId)) incoming.set(transition.toNodeId, []);
      incoming.get(transition.toNodeId)!.push(transition);
    }
    return { outgoing, incoming };
  }, [model.transitions]);

  const flowSequence = useMemo(() => {
    return [...model.nodes].sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      return a.sortOrder - b.sortOrder;
    });
  }, [model.nodes]);

  return (
    <article
      data-testid="pgdcn-dossier-template-preview"
      className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-6"
      aria-label={`Xem trước bộ hồ sơ mẫu ${model.name}`}
    >
      {/* Header & Metadata */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/40 p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100/80 px-2.5 py-1 text-xs font-bold text-blue-800">
                <Eye size={14} aria-hidden="true" />
                Xem trước hồ sơ mẫu (Chỉ đọc)
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeStyle(model.status)}`}
              >
                {statusLabel(model.status)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700">
                {model.domain === 'PCN' ? 'PCN · Chứng nhận' : 'PGD · Giám định'}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-500">phiên bản {model.version}</span>
            </div>

            <h2 className="break-words text-xl font-black tracking-tight text-slate-900 md:text-2xl">
              {model.name}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-700">{model.code}</span>
              <span>· ID: {model.id}</span>
            </div>

            {model.description && (
              <p className="max-w-4xl break-words text-xs md:text-sm text-slate-600 leading-relaxed">{model.description}</p>
            )}

            {/* Scope */}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Phạm vi áp dụng:
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {scopeBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-0.5 text-xs font-bold text-indigo-700"
                  >
                    {badge}
                  </span>
                ))}
                {scopeBadges.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Chưa cấu hình phạm vi áp dụng</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs md:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <X size={16} aria-hidden="true" />
            Đóng
          </button>
        </div>

        {/* Summary Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-blue-700 border border-blue-200/60">
            <Layers size={13} /> Tổng số bước: <strong className="text-blue-900">{model.nodes.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-200/60">
            <ArrowRight size={13} /> Chuyển tiếp: <strong className="text-indigo-900">{model.transitions.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-purple-700 border border-purple-200/60">
            <FileText size={13} /> Tài liệu tham chiếu: <strong className="text-purple-900">{new Set(model.nodes.flatMap((n) => n.requirementRefs)).size}</strong>
          </span>
        </div>
      </div>

      {/* Visual Flowchart Pipeline */}
      {model.nodes.length > 0 && model.transitions.length > 0 && (
        <section className="space-y-3" aria-label="Sơ đồ luồng đồ họa">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Sơ đồ luồng quy trình (Flowchart trực quan)
              </h3>
              <p className="text-xs text-slate-500">
                Chuỗi trạm công việc được kết nối tuần tự từ khởi tạo đến phát hành và lưu trữ
              </p>
            </div>
            <span className="rounded-full bg-blue-100/80 px-2.5 py-1 text-xs font-bold text-blue-700">
              {model.nodes.length} trạm · {model.transitions.length} luồng chuyển tiếp
            </span>
          </div>

          <div className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 shadow-2xs">
            <div className="flex min-w-max items-center gap-2 py-2">
              {flowSequence.map((node, index) => {
                const outgoing = nodeConnections.outgoing.get(node.id) || [];
                const primaryTransition = outgoing[0];
                const isLast = index === flowSequence.length - 1;
                const kindLabel = KIND_LABELS[node.kind] || node.kind;

                return (
                  <div key={node.id} className="flex items-center">
                    {/* Node Station Card */}
                    <div
                      className={`relative flex min-w-[170px] max-w-[210px] flex-col rounded-2xl border p-3.5 shadow-2xs transition hover:shadow-md ${
                        node.kind === 'END'
                          ? 'border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200/70'
                          : node.kind === 'APPROVAL_TASK'
                            ? 'border-purple-200 bg-gradient-to-b from-purple-50/80 to-fuchsia-50/50'
                            : 'border-blue-200/90 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="rounded-md bg-gradient-to-r from-slate-900 to-indigo-950 px-1.5 py-0.5 font-mono font-bold text-white shadow-2xs">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 border border-slate-200/60">
                          Cột {node.column}
                        </span>
                      </div>

                      <h4 className="mt-2 line-clamp-2 text-xs font-bold text-slate-900" title={node.label}>
                        {node.label}
                      </h4>

                      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
                        <span className="truncate font-semibold text-blue-700">{kindLabel}</span>
                        {node.slaDays !== undefined && (
                          <span className="shrink-0 font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                            SLA: {node.slaDays}d
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SVG Flowchart Arrow Connector */}
                    {!isLast && (
                      <div className="flex shrink-0 flex-col items-center px-1.5">
                        {primaryTransition?.label && (
                          <span className="mb-0.5 max-w-[120px] truncate text-[10px] font-bold text-blue-700">
                            {primaryTransition.label}
                          </span>
                        )}
                        <div className="flex items-center">
                          <div className="h-0.5 w-7 bg-blue-500 sm:w-9" />
                          <svg
                            className="-ml-1 h-3.5 w-3.5 text-blue-600"
                            viewBox="0 0 12 12"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M2 1l8 5-8 5V1z" />
                          </svg>
                        </div>
                        {primaryTransition?.condition && primaryTransition.condition !== 'ALWAYS' ? (
                          <span className="mt-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                            {CONDITION_LABELS[primaryTransition.condition] || primaryTransition.condition}
                          </span>
                        ) : (
                          <span className="mt-0.5 text-[9px] font-medium text-slate-400">
                            tiếp tục
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Topology Canvas (Read-only Lane/Column grid) */}
      <section className="space-y-3" aria-label="Sơ đồ các bước lưu trình">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Ma trận lưu trình (Phân nhóm Làn & 6 Cột)</h3>
          <span className="text-xs text-slate-400 font-medium">Bố trí theo từng giai đoạn xử lý hồ sơ</span>
        </div>

        {model.nodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Chưa có bước nào trong lưu trình.
          </div>
        ) : (
          <div className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-2xs">
            <div className="grid min-w-[960px] grid-cols-[148px_repeat(6,minmax(150px,1fr))] gap-2.5">
              <div className="flex items-center justify-center rounded-xl bg-slate-800 p-3 text-xs font-black uppercase tracking-wider text-white shadow-2xs">
                Phân nhóm (Làn)
              </div>
              {COLUMNS.map((column) => (
                <div
                  key={column}
                  className={`rounded-xl border p-2.5 text-center text-xs font-bold shadow-2xs ${COLUMN_HEADERS[column]?.color}`}
                >
                  <div className="font-black">Cột {column}</div>
                  <div className="mt-0.5 text-[10px] font-medium opacity-90">
                    {COLUMN_HEADERS[column]?.subtitle}
                  </div>
                </div>
              ))}

              {LANES.map((lane) => (
                <div key={lane.id} className="contents">
                  <div className={`flex min-h-[140px] items-start rounded-xl border border-slate-200/60 bg-gradient-to-r p-3 text-xs font-bold shadow-2xs ${lane.color}`}>
                    {lane.label}
                  </div>
                  {COLUMNS.map((column) => {
                    const cellNodes = model.nodes
                      .filter((n) => (n.laneId || 'default') === lane.id && n.column === column)
                      .sort((a, b) => a.sortOrder - b.sortOrder);

                    return (
                      <div
                        key={`${lane.id}-${column}`}
                        className="min-h-[140px] rounded-xl border border-dashed border-slate-200 bg-white/70 p-2"
                      >
                        <div className="space-y-2.5">
                          {cellNodes.map((node) => {
                            const kindLabel = KIND_LABELS[node.kind] || node.kind;
                            const styling = getNodeCardStyling(node);

                            return (
                              <article
                                key={node.id}
                                data-testid={`pgdcn-template-preview-node-${node.id}`}
                                className={`rounded-xl border p-3 transition ${styling.wrap} ${
                                  !node.active ? 'opacity-70' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${styling.tag}`}>
                                    {kindLabel}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      node.active
                                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border border-slate-200 bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {node.active ? (
                                      <>
                                        <CheckCircle2 size={10} aria-hidden="true" />
                                        Đang hoạt động
                                      </>
                                    ) : (
                                      <>
                                        <PauseCircle size={10} aria-hidden="true" />
                                        Tạm dừng
                                      </>
                                    )}
                                  </span>
                                </div>

                                <h4 className="mt-1.5 break-words text-xs md:text-sm font-bold text-slate-900">
                                  {node.label}
                                </h4>

                                <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                                  ID: {node.id}
                                </div>

                                {node.description && (
                                  <p className="mt-1 break-words text-[11px] text-slate-500 leading-snug">
                                    {node.description}
                                  </p>
                                )}

                                {/* Node Configuration */}
                                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                                  {node.actionKey && (
                                    <div>
                                      <span className="text-slate-400 font-medium">Thao tác: </span>
                                      <span className="font-bold text-slate-800">
                                        {ACTION_KEY_LABELS[node.actionKey] || node.actionKey}
                                      </span>
                                      {ACTION_KEY_LABELS[node.actionKey] && (
                                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                                          ({node.actionKey})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {node.assigneeRole && (
                                    <div>
                                      <span className="text-slate-400 font-medium">Vai trò: </span>
                                      <span className="font-bold text-slate-800">
                                        {ROLE_LABELS[node.assigneeRole] || node.assigneeRole}
                                      </span>
                                      {ROLE_LABELS[node.assigneeRole] && (
                                        <span className="ml-1 text-[10px] text-slate-400">
                                          ({node.assigneeRole})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {node.slaDays !== undefined && (
                                    <div>
                                      <span className="text-slate-400 font-medium">SLA: </span>
                                      <span className="font-bold text-slate-800">
                                        {node.slaDays} ngày
                                      </span>
                                    </div>
                                  )}
                                  {node.joinPolicy && (
                                    <div>
                                      <span className="text-slate-400 font-medium">Gom nhánh: </span>
                                      <span className="font-bold text-slate-800">
                                        {JOIN_POLICY_LABELS[node.joinPolicy] || node.joinPolicy}
                                      </span>
                                    </div>
                                  )}
                                  {node.quorum !== undefined && (
                                    <div>
                                      <span className="text-slate-400 font-medium">Quorum: </span>
                                      <span className="font-bold text-slate-800">
                                        {node.quorum}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Requirements checklist */}
                                {node.requirementRefs.length > 0 && (
                                  <div className="mt-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-[11px]">
                                    <div className="flex items-center gap-1 font-bold text-slate-700">
                                      <FileText size={12} className="text-blue-600" aria-hidden="true" />
                                      Tài liệu yêu cầu ({node.requirementRefs.length}):
                                    </div>
                                    <ul className="mt-1 space-y-1">
                                      {node.requirementRefs.map((ref) => {
                                        const label = requirementMap.get(ref);
                                        return (
                                          <li
                                            key={ref}
                                            className="break-words text-slate-700 font-medium"
                                          >
                                            {label ? (
                                              <span>• {label}</span>
                                            ) : (
                                              <span className="text-slate-400 italic">
                                                • {ref} (Chưa có trong danh mục)
                                              </span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Transitions List (Collapsed by default) */}
      <section className="space-y-3" aria-label="Danh sách chuyển tiếp lưu trình">
        {model.transitions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Chưa có đường nối giữa các bước.
          </div>
        ) : (
          <details className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 transition">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900">
              <span className="flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">▸</span>
                <span>Thông số kỹ thuật chuyển tiếp ({model.transitions.length} đường nối - bấm để xem chi tiết)</span>
              </span>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Ẩn mặc định</span>
            </summary>

            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {model.transitions.map((transition) => {
                const fromNode = nodeMap.get(transition.fromNodeId);
                const toNode = nodeMap.get(transition.toNodeId);
                const fromLabel = fromNode ? fromNode.label : transition.fromNodeId;
                const toLabel = toNode ? toNode.label : transition.toNodeId;
                const conditionLabel = transition.condition
                  ? CONDITION_LABELS[transition.condition] || transition.condition
                  : undefined;
                const conditionParameter = transitionConditionParameter(transition, model.domain);

                return (
                  <div
                    key={transition.id}
                    data-testid={`pgdcn-template-preview-transition-${transition.id}`}
                    className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs shadow-2xs hover:border-blue-300 transition"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span className="truncate">{fromLabel}</span>
                      <ArrowRight size={14} className="shrink-0 text-blue-500" aria-hidden="true" />
                      <span className="truncate">{toLabel}</span>
                    </div>

                    {transition.label && (
                      <div className="mt-1 font-semibold text-blue-700">
                        {transition.label}
                      </div>
                    )}

                    <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      {conditionLabel && (
                        <div>
                          <span>Điều kiện: </span>
                          <span className="font-bold text-slate-700">{conditionLabel}</span>
                        </div>
                      )}
                      {conditionParameter && conditionParameter.values.length > 0 && (
                        <div>
                          <span>{conditionParameter.label}: </span>
                          <span className="font-bold text-slate-700">{conditionParameter.values.join(' · ')}</span>
                        </div>
                      )}
                      {transition.returnPolicy && (
                        <div>
                          <span>Chính sách trả: </span>
                          <span className="font-bold text-slate-700">{RETURN_POLICY_LABELS[transition.returnPolicy] || transition.returnPolicy}</span>
                        </div>
                      )}
                      {transition.priority !== undefined && (
                        <div>
                          <span>Độ ưu tiên: </span>
                          <span className="font-bold text-slate-700">{transition.priority}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </section>
    </article>
  );
}
