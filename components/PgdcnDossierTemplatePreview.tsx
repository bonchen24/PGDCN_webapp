'use client';

import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Eye, FileText, Info, PauseCircle, X } from 'lucide-react';
import type { DossierTemplateEditorModel, DossierTemplateEditorNode, DossierTemplateEditorTransition } from '../utils/pgdcnDossierTemplate.ts';
import type { DossierTemplateRequirementOption } from './PgdcnDossierTemplateInspector.tsx';

export interface PgdcnDossierTemplatePreviewProps {
  model: DossierTemplateEditorModel;
  requirements: DossierTemplateRequirementOption[];
  onClose: () => void;
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

const COLUMN_HEADERS: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Cột 1', subtitle: 'Tiếp nhận hồ sơ' },
  2: { title: 'Cột 2', subtitle: 'Xem xét & Chuẩn bị' },
  3: { title: 'Cột 3', subtitle: 'Hiện trường & Mẫu' },
  4: { title: 'Cột 4', subtitle: 'PTN & Thử nghiệm' },
  5: { title: 'Cột 5', subtitle: 'Rà soát & Phê duyệt' },
  6: { title: 'Cột 6', subtitle: 'Phát hành & Lưu trữ' },
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
  LAB_SUBCONTRACTOR: 'Giao mẫu & nhận KQTN',
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

function statusClass(status: DossierTemplateEditorModel['status']): string {
  return status === 'PUBLISHED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'RETIRED'
      ? 'border-slate-200 bg-slate-100 text-slate-500'
      : 'border-amber-200 bg-amber-50 text-amber-700';
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

  return (
    <article
      data-testid="pgdcn-dossier-template-preview"
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
      aria-label={`Xem trước bộ hồ sơ mẫu ${model.name}`}
    >
      {/* Header & Metadata */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              <Eye size={14} aria-hidden="true" />
              Xem trước hồ sơ mẫu (Chỉ đọc)
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(model.status)}`}
            >
              {statusLabel(model.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {model.domain === 'PCN' ? 'PCN · Chứng nhận' : 'PGD · Giám định'}
            </span>
            <span className="font-mono text-xs text-slate-500">phiên bản {model.version}</span>
          </div>

          <h2 className="break-words text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {model.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{model.code}</span>
            <span>· ID: {model.id}</span>
          </div>

          {model.description && (
            <p className="max-w-4xl break-words text-sm text-slate-600">{model.description}</p>
          )}

          {/* Scope */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Phạm vi áp dụng:
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {scopeBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
                >
                  {badge}
                </span>
              ))}
              {scopeBadges.length === 0 && (
                <span className="text-xs text-slate-400">Chưa cấu hình phạm vi áp dụng</span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng xem trước"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X size={16} aria-hidden="true" />
          Đóng
        </button>
      </div>

      {/* Summary Counters */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
        <span>Tổng số bước: <strong className="text-slate-800">{model.nodes.length}</strong></span>
        <span>·</span>
        <span>Chuyển tiếp: <strong className="text-slate-800">{model.transitions.length}</strong></span>
        <span>·</span>
        <span>Tài liệu tham chiếu: <strong className="text-slate-800">{new Set(model.nodes.flatMap((n) => n.requirementRefs)).size}</strong></span>
      </div>

      {/* Topology Canvas (Read-only Lane/Column grid) */}
      <section className="space-y-3" aria-label="Sơ đồ các bước lưu trình">
        <h3 className="text-sm font-bold text-slate-800">Sơ đồ lưu trình (Làn & Cột)</h3>

        {model.nodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Chưa có bước nào trong lưu trình.
          </div>
        ) : (
          <div className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="grid min-w-[960px] grid-cols-[148px_repeat(6,minmax(150px,1fr))] gap-2">
              <div className="rounded-lg bg-slate-200/80 p-3 text-xs font-bold text-slate-600">
                Phân nhóm (Làn)
              </div>
              {COLUMNS.map((column) => (
                <div
                  key={column}
                  className="rounded-lg bg-slate-200/80 p-2.5 text-center text-xs font-bold text-slate-700"
                >
                  <div>Cột {column}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {COLUMN_HEADERS[column]?.subtitle}
                  </div>
                </div>
              ))}

              {LANES.map((lane) => (
                <div key={lane.id} className="contents">
                  <div className="flex min-h-[140px] items-start rounded-xl bg-slate-100/70 p-3 text-xs font-semibold text-slate-700">
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
                        <div className="space-y-2">
                          {cellNodes.map((node) => {
                            const kindLabel = KIND_LABELS[node.kind] || node.kind;
                            return (
                              <article
                                key={node.id}
                                data-testid={`pgdcn-template-preview-node-${node.id}`}
                                className={`rounded-xl border p-3 shadow-xs transition ${
                                  node.active
                                    ? 'border-slate-200 bg-white'
                                    : 'border-slate-200 bg-slate-50 opacity-80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {kindLabel}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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

                                <h4 className="mt-1 break-words text-sm font-semibold text-slate-900">
                                  {node.label}
                                </h4>

                                <div className="mt-1 font-mono text-[10px] text-slate-400">
                                  ID: {node.id}
                                </div>

                                {node.description && (
                                  <p className="mt-1 break-words text-xs text-slate-500">
                                    {node.description}
                                  </p>
                                )}

                                {/* Node Configuration */}
                                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                                  {node.actionKey && (
                                    <div>
                                      <span className="text-slate-400">Thao tác: </span>
                                      <span className="font-medium text-slate-700">
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
                                      <span className="text-slate-400">Vai trò: </span>
                                      <span className="font-medium text-slate-700">
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
                                      <span className="text-slate-400">SLA: </span>
                                      <span className="font-medium text-slate-700">
                                        {node.slaDays} ngày
                                      </span>
                                    </div>
                                  )}
                                  {node.joinPolicy && (
                                    <div>
                                      <span className="text-slate-400">Gom nhánh: </span>
                                      <span className="font-medium text-slate-700">
                                        {JOIN_POLICY_LABELS[node.joinPolicy] || node.joinPolicy}
                                      </span>
                                    </div>
                                  )}
                                  {node.quorum !== undefined && (
                                    <div>
                                      <span className="text-slate-400">Quorum: </span>
                                      <span className="font-medium text-slate-700">
                                        {node.quorum}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Requirements checklist */}
                                {node.requirementRefs.length > 0 && (
                                  <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px]">
                                    <div className="flex items-center gap-1 font-semibold text-slate-600">
                                      <FileText size={12} aria-hidden="true" />
                                      Tài liệu yêu cầu ({node.requirementRefs.length}):
                                    </div>
                                    <ul className="mt-1 space-y-1">
                                      {node.requirementRefs.map((ref) => {
                                        const label = requirementMap.get(ref);
                                        return (
                                          <li
                                            key={ref}
                                            className="break-words text-slate-700"
                                          >
                                            {label ? (
                                              <span>• {label}</span>
                                            ) : (
                                              <span className="text-slate-500">
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

      {/* Transitions List */}
      <section className="space-y-3" aria-label="Danh sách chuyển tiếp lưu trình">
        <h3 className="text-sm font-bold text-slate-800">Danh sách chuyển tiếp lưu trình</h3>

        {model.transitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Chưa có đường nối giữa các bước.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <span className="truncate">{fromLabel}</span>
                    <ArrowRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{toLabel}</span>
                  </div>

                  {transition.label && (
                    <div className="mt-1 font-medium text-blue-700">
                      {transition.label}
                    </div>
                  )}

                  <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                    {conditionLabel && (
                      <div>
                        <span>Điều kiện: </span>
                        <span className="font-medium text-slate-700">{conditionLabel}</span>
                      </div>
                    )}
                    {conditionParameter && conditionParameter.values.length > 0 && (
                      <div>
                        <span>{conditionParameter.label}: </span>
                        <span className="font-medium text-slate-700">{conditionParameter.values.join(' · ')}</span>
                      </div>
                    )}
                    {transition.returnPolicy && (
                      <div>
                        <span>Chính sách trả: </span>
                        <span className="font-medium text-slate-700">{RETURN_POLICY_LABELS[transition.returnPolicy] || transition.returnPolicy}</span>
                      </div>
                    )}
                    {transition.priority !== undefined && (
                      <div>
                        <span>Độ ưu tiên: </span>
                        <span className="font-medium text-slate-700">{transition.priority}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
}
