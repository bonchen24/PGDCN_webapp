'use client';

import { AlertCircle, CheckCircle2, CircleDashed, Download, FileOutput, FileText, Loader2, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { PgdInspectionRequest } from '../utils/pgdDomain';
import {
  getPgdTemplateCellsForProductGroup,
  getPgdDocumentTemplates,
  normalizePgdCellValues,
  validatePgdCellValues,
  type PgdDocumentTemplate,
  type PgdDocumentTemplateFormat,
  type PgdDocumentTemplateKind,
  type PgdTemplateCell,
} from '../utils/pgdDocumentTemplates';
import { getPgdTemplateSourceUrl } from '../utils/pgdApi';
import { usePgdStore } from '../store-pgd';
import type { PgdCaseEvent, PgdDossierIndex, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from '../utils/pgdArtifacts';
import PgdTableFieldEditor from './PgdTableFieldEditor';

type PgdDocumentGenerationPanelProps = {
  request: PgdInspectionRequest;
  templates: PgdDocumentTemplate[];
  canMutate: boolean;
  initialTemplateId?: string;
  initialFormat?: PgdDocumentTemplateFormat;
  initialCellValues?: Record<string, unknown>;
  onSaveDraft?: (input: { templateId: string; format: PgdDocumentTemplateFormat; cellValues: Record<string, unknown> }) => void;
  showTemplateSelector?: boolean;
};

export const PGD_DOCUMENT_KIND_LABELS: Record<PgdDocumentTemplateKind, string> = {
  INTAKE_REQUEST: 'Phiếu tiếp nhận PYC',
  ASSIGNMENT: 'Phiếu phân công',
  INSPECTION_PLAN: 'Kế hoạch giám định',
  FIELD_INSPECTION: 'Biên bản hiện trường',
  SAMPLE_TAKING: 'Biên bản lấy mẫu',
  LAB_REQUEST: 'Phiếu giao nhận / yêu cầu PTN',
  INSPECTION_REPORT: 'Báo cáo giám định',
  DECISION: 'Quyết định PGD',
  INSPECTION_CERTIFICATE: 'Chứng thư giám định',
  DOSSIER_COVER: 'Bìa và mục lục hồ sơ',
  CASE_TIMELINE: 'Diễn biến vụ giám định',
  FIELD_ACTIVITY_LOG: 'Phiếu ghi chép hiện trường',
  LAB_RESULT_REVIEW: 'Bản đánh giá kết quả thử nghiệm',
  INSPECTION_MINUTES: 'Biên bản vụ giám định',
  SAMPLE_HANDOVER: 'Biên bản giao mẫu PTN',
};

type PgdDocumentPrefill = {
  inspectionPlan?: PgdInspectionPlan;
  caseEvents: PgdCaseEvent[];
  fieldActivityLogs: PgdFieldActivityLog[];
  fieldInspection?: ReturnType<typeof usePgdStore.getState>['fieldInspections'][number];
  samples: ReturnType<typeof usePgdStore.getState>['samples'];
  labResults: ReturnType<typeof usePgdStore.getState>['labResults'];
  labRequests: ReturnType<typeof usePgdStore.getState>['labRequests'];
  labResultReview?: PgdLabResultReview;
  dossierIndex?: PgdDossierIndex;
};

function initialValue(cell: PgdTemplateCell, request: PgdInspectionRequest, prefill: PgdDocumentPrefill): unknown {
  const latestFieldLog = [...prefill.fieldActivityLogs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const timelineEvents = [...prefill.caseEvents].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const labResultRows = prefill.labResults.map((result) => ({ reportNumber: result.reportNumber || '', reportDate: result.receivedAt.slice(0, 10), laboratory: prefill.labRequests.find((labRequest) => labRequest.id === result.labRequestId)?.laboratoryName || '' }));
  const latestLabRequest = [...prefill.labRequests].sort((left, right) => (right.handover?.sentAt || '').localeCompare(left.handover?.sentAt || '') || right.id.localeCompare(left.id))[0];
  const registryDocumentNumber = (kind: string): string => request.registryMetadata?.documents?.find((document) => document.kind === kind)?.number || '';
  const byKey: Record<string, unknown> = {
    requestCode: request.requestCode,
    ownerUsername: request.ownerUsername || '',
    customerName: request.customerSnapshot.name,
    customerAddress: request.customerSnapshot.address,
    productName: request.productName,
    lotCode: request.lotCode || '',
    quantity: request.quantity,
    inspectionScope: request.inspectionScope,
    inspectionLocation: request.inspectionLocation,
    intakeChannel: request.intakeChannel,
    standards: request.standards.map((standard) => ({ standard })),
    certificateScope: request.inspectionScope,
    inspectionDate: prefill.inspectionPlan?.inspectionDate || request.inspectionScheduledAt || '',
    inspectionDateTime: request.inspectionScheduledAt || '',
    inspectionLocationText: request.inspectionLocation,
    samplingLocation: request.inspectionLocation,
    samplingMethod: request.method || '',
    assessmentMethod: request.assessmentMethod || (request.method === 'TT58' ? 'METHOD_7' : ''),
    purpose: request.inspectionScope,
    productForm: request.productDetails?.productForm || '',
    grade: request.productDetails?.grade || request.brand || '',
    dimensions: request.productDetails?.dimensions || '',
    productStandard: request.productDetails?.productStandard || '',
    origin: request.productDetails?.origin || '',
    countryOfOrigin: request.productDetails?.countryOfOrigin || request.productDetails?.origin || '',
    manufacturer: request.productDetails?.manufacturer || '',
    manufacturerLotCode: request.productDetails?.manufacturerLotCode || '',
    importer: request.productDetails?.importer || '',
    hsCode: request.productDetails?.hsCode || '',
    lotDefinition: request.productDetails?.lotDefinition || '',
    customsDocuments: request.productDetails?.customsDocuments || [],
    steelLotSize: request.productDetails?.steelLotSize,
    steelSameGradeMultiProduct: request.productDetails?.steelSameGradeMultiProduct,
    steelManualSamplingPlanNote: request.productDetails?.steelManualSamplingPlanNote || '',
    machineryType: request.productDetails?.machinery?.machineType || '',
    machineryModel: request.productDetails?.machinery?.model || '',
    machinerySerialNumber: request.productDetails?.machinery?.serialNumber || '',
    machineryManufacturingYear: request.productDetails?.machinery?.manufacturingYear,
    machineryTechnicalParameters: request.productDetails?.machinery?.technicalParameters || '',
    machineryCondition: request.productDetails?.machinery?.condition || '',
    machineryCompleteness: request.productDetails?.machinery?.completeness || '',
    machinerySynchronization: request.productDetails?.machinery?.synchronization || '',
    machineryInstallationStatus: request.productDetails?.machinery?.installationStatus || '',
    machinerySafetyStandard: request.productDetails?.machinery?.safetyStandard || '',
    coalType: request.productDetails?.coal?.coalType || '',
    coalSource: request.productDetails?.coal?.source || '',
    coalSizeRange: request.productDetails?.coal?.sizeRange || '',
    coalQualityStandard: request.productDetails?.coal?.qualityStandard || '',
    coalSamplingBasis: request.productDetails?.coal?.samplingBasis || '',
    coalMoisture: request.productDetails?.coal?.moisture,
    coalAsh: request.productDetails?.coal?.ash,
    coalCalorificValue: request.productDetails?.coal?.calorificValue,
    coalSulfur: request.productDetails?.coal?.sulfur,
    agenda: prefill.inspectionPlan?.schedule.map((row) => ({ time: `${row.startTime}${row.endTime ? `–${row.endTime}` : ''}`, activity: row.activity, owner: row.note || '' })) || [],
    productLines: prefill.inspectionPlan?.productLines.map((product) => ({ productName: product.productName, grade: product.grade || '', dimensions: product.dimensions || '', standard: product.standard, origin: product.origin || '', manufacturer: product.manufacturer || '', quantity: product.quantity ?? '', unit: product.unit || '' })) || [],
    team: prefill.inspectionPlan?.team.map((member) => ({ name: member.name || member.username, role: member.role, phone: member.phone || '' })) || [],
    eventDate: timelineEvents[0]?.occurredAt.slice(0, 10) || request.inspectionScheduledAt?.slice(0, 10) || '',
    eventRows: timelineEvents.map((event) => ({ time: event.occurredAt.slice(11, 16), activity: event.activity, actor: event.actorUsername, note: event.note || '' })),
    session: latestFieldLog?.session || 'MORNING',
    activityDate: latestFieldLog?.date || request.inspectionScheduledAt?.slice(0, 10) || '',
    auditor: latestFieldLog?.auditorUsername || '',
    activityRows: latestFieldLog?.entries.map((entry) => ({ time: entry.time, activity: entry.activity, comments: entry.comments || '' })) || [],
    transportName: request.transportName || '',
    packingListNumber: registryDocumentNumber('PACKING_LIST'),
    invoiceNumber: registryDocumentNumber('INVOICE'),
    contractNumber: registryDocumentNumber('CONTRACT'),
    preInspectionCondition: prefill.fieldInspection?.lotObservation || prefill.fieldInspection?.packaging || '',
    inspectionResult: prefill.fieldInspection?.inspectionResult || prefill.fieldInspection?.note || '',
    customerConfirmation: prefill.fieldInspection?.customerRepresentative || '',
    sampleRows: prefill.samples.map((sample) => ({ sampleCode: sample.sampleCode, description: sample.description, quantity: sample.quantity, unit: sample.unit || '', disposition: sample.disposition })),
    laboratoryName: latestLabRequest?.laboratoryName || '',
    laboratoryCode: latestLabRequest?.laboratoryCode || '',
    senderUnit: latestLabRequest?.senderUnit || 'Phòng Giám định - Chứng nhận',
    sentAt: latestLabRequest?.handover?.sentAt || '',
    sender: latestLabRequest?.handover?.senderUsername || '',
    receiver: latestLabRequest?.handover?.receiverName || '',
    handoverRows: prefill.labRequests.map((labRequest) => {
      const sample = prefill.samples.find((item) => item.id === labRequest.sampleId);
      return { sampleCode: sample?.sampleCode || labRequest.sampleId, description: sample?.description || '', quantity: labRequest.handover?.quantity || sample?.quantity || '', unit: sample?.unit || '', testItems: labRequest.testItems.join('; '), methods: (labRequest.testMethods || []).join('; ') };
    }),
    handoverNote: latestLabRequest?.handover?.note || '',
    dossierEntries: prefill.dossierIndex?.entries.map((entry) => ({ requirementCode: entry.requirementCode, title: entry.title, status: entry.status, pageCount: entry.pageCount || '' })) || [],
    reviewer: prefill.labResultReview?.reviewerUsername || prefill.dossierIndex?.reviewerUsername || '',
    archivist: prefill.dossierIndex?.archivistUsername || '',
    archiveReference: prefill.dossierIndex?.archiveReference || '',
    labResultRows,
    completeness: prefill.labResultReview?.completeness || (labResultRows.length > 0 ? 'COMPLETE' : ''),
    conformity: prefill.labResultReview?.conformity || '',
    missingItems: prefill.labResultReview?.missingItems?.map((item) => ({ item, note: '' })) || [],
    nonconformities: prefill.labResultReview?.nonconformities?.map((item) => ({ item, description: item })) || [],
    recommendation: prefill.labResultReview?.recommendation || '',
    conclusion: prefill.labResultReview?.conclusion || '',
  };
  return Object.prototype.hasOwnProperty.call(byKey, cell.key) ? byKey[cell.key] : cell.type === 'TABLE' ? [] : '';
}

function scalarInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

type PgdDocumentState = 'EMPTY' | 'EDITING' | 'SAVED' | 'GENERATING' | 'READY' | 'BLOCKED' | 'ERROR';

const PGD_DOCUMENT_STATE_LABELS: Record<PgdDocumentState, string> = {
  EMPTY: 'Chưa chọn biểu mẫu',
  EDITING: 'Đang soạn',
  SAVED: 'Đã lưu bản soạn',
  GENERATING: 'Đang sinh tài liệu',
  READY: 'Đã sẵn sàng',
  BLOCKED: 'Cần bổ sung dữ liệu',
  ERROR: 'Có lỗi, cần thử lại',
};

function PgdDocumentStateSummary({ state, templateLabel, issueCount, issue }: { state: PgdDocumentState; templateLabel: string; issueCount: number; issue: string }) {
  const tone = state === 'READY' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : state === 'BLOCKED' ? 'border-amber-200 bg-amber-50 text-amber-900' : state === 'ERROR' ? 'border-rose-200 bg-rose-50 text-rose-900' : state === 'GENERATING' ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-800';
  const Icon = state === 'READY' ? CheckCircle2 : state === 'BLOCKED' || state === 'ERROR' ? AlertCircle : state === 'GENERATING' ? Loader2 : CircleDashed;
  return <section data-testid="pgd-document-readiness" className={`rounded-xl border p-3 ${tone}`} aria-label="Trạng thái tài liệu PGD"><div className="flex items-start gap-2"><Icon size={16} className={state === 'GENERATING' ? 'animate-spin' : 'mt-0.5'} /><div className="min-w-0 flex-1"><div data-testid="pgd-document-state" aria-live="polite" className="text-[10px] font-black uppercase tracking-[0.12em]">{PGD_DOCUMENT_STATE_LABELS[state]}</div><p className="mt-1 text-[10px] leading-4">{state === 'EMPTY' ? 'Chọn loại biểu mẫu để bắt đầu từ dữ liệu hồ sơ PGD.' : state === 'BLOCKED' ? `Chưa thể sinh file: còn ${issueCount} trường cần kiểm tra.` : state === 'GENERATING' ? 'Đang tạo file từ dữ liệu đã kiểm tra. Vui lòng chờ kết quả.' : state === 'READY' ? 'File vừa sinh đã sẵn sàng để tải lại hoặc đối chiếu.' : issue || 'Kiểm tra dữ liệu trước khi sinh DOCX/PDF.'}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold"><span className="max-w-full truncate rounded-md border border-current/15 bg-white/70 px-2 py-1" title={templateLabel}>Template: {templateLabel}</span>{issueCount > 0 && <span className="rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-amber-800">Còn {issueCount} mục cần kiểm tra</span>}</div></div></div></section>;
}

export default function PgdDocumentGenerationPanel({ request, templates, canMutate, initialTemplateId, initialFormat = 'DOCX', initialCellValues, onSaveDraft, showTemplateSelector = true }: PgdDocumentGenerationPanelProps) {
  const generateDocument = usePgdStore((state) => state.generateDocument);
  const inspectionPlan = usePgdStore((state) => state.inspectionPlans.find((item) => item.requestId === request.id));
  const caseEvents = usePgdStore((state) => state.caseEvents.filter((item) => item.requestId === request.id));
  const fieldActivityLogs = usePgdStore((state) => state.fieldActivityLogs.filter((item) => item.requestId === request.id));
  const fieldInspection = usePgdStore((state) => state.fieldInspections.find((item) => item.requestId === request.id));
  const samples = usePgdStore((state) => state.samples.filter((item) => item.requestId === request.id));
  const labResults = usePgdStore((state) => state.labResults.filter((item) => item.requestId === request.id));
  const labRequests = usePgdStore((state) => state.labRequests.filter((item) => item.requestId === request.id));
  const labResultReview = usePgdStore((state) => state.labResultReviews.find((item) => item.requestId === request.id));
  const dossierIndex = usePgdStore((state) => state.dossierIndexes.find((item) => item.requestId === request.id));
  const [templateId, setTemplateId] = useState(initialTemplateId || '');
  const [format, setFormat] = useState<PgdDocumentTemplateFormat>(initialFormat);
  const [cellValues, setCellValues] = useState<Record<string, unknown>>(() => ({ ...(initialCellValues || {}) }));
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<{ fileName: string; url: string; mimeType: string; generatedAt: string } | null>(null);
  const catalogTemplates = useMemo(() => {
    const source = templates.length > 0 ? templates : getPgdDocumentTemplates();
    return source.filter((template) => template.active && template.status !== 'RETIRED');
  }, [templates]);
  const availableTemplates = useMemo(() => catalogTemplates.filter((template) => template.productGroups.includes(request.productGroup)), [catalogTemplates, request.productGroup]);
  const selectedTemplate = availableTemplates.find((item) => item.id === templateId) || availableTemplates[0];
  const template = useMemo(() => {
    if (!selectedTemplate) return undefined;
    const scopedCells = getPgdTemplateCellsForProductGroup(selectedTemplate, request.productGroup);
    const scopedKeys = new Set(scopedCells.map((cell) => cell.key));
    return {
      ...selectedTemplate,
      cells: scopedCells,
      placeholderKeys: (selectedTemplate.placeholderKeys || []).filter((key) => scopedKeys.has(key)),
      requiredPlaceholderKeys: (selectedTemplate.requiredPlaceholderKeys || []).filter((key) => scopedKeys.has(key)),
    };
  }, [request.productGroup, selectedTemplate]);
  const formCells = useMemo(() => {
    if (!template) return [];
    const placeholderKeys = new Set(template.placeholderKeys || template.cells.map((cell) => cell.key));
    return template.cells.filter((cell) => placeholderKeys.has(cell.key) && cell.active !== false);
  }, [template]);
  const prefill: PgdDocumentPrefill = { inspectionPlan, caseEvents, fieldActivityLogs, fieldInspection, samples, labResults, labRequests, labResultReview, dossierIndex };
  const readinessIssues = useMemo(() => template ? validatePgdCellValues(template.cells, normalizePgdCellValues(template.cells, cellValues)) : [], [cellValues, template]);
  const hasDraftValues = Object.values(cellValues).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0);
  const documentState: PgdDocumentState = busy ? 'GENERATING' : issue ? 'ERROR' : !template ? 'EMPTY' : readinessIssues.length > 0 ? 'BLOCKED' : lastOutput ? 'READY' : savedAt ? 'SAVED' : hasDraftValues ? 'EDITING' : 'EMPTY';
  const templateLabel = template ? `${template.code} · v${template.version}` : 'Chưa có template';

  useEffect(() => () => {
    if (lastOutput?.url) URL.revokeObjectURL(lastOutput.url);
  }, [lastOutput?.url]);

  useEffect(() => {
    if (!template) return;
    setTemplateId((current) => current && availableTemplates.some((item) => item.id === current) ? current : template.id);
    setCellValues((current) => {
      const next: Record<string, unknown> = {};
      for (const cell of formCells) next[cell.key] = current[cell.key] ?? initialCellValues?.[cell.key] ?? initialValue(cell, request, prefill);
      return next;
    });
  }, [availableTemplates, formCells, template?.id, request.id, initialCellValues, inspectionPlan?.updatedAt, caseEvents.length, fieldActivityLogs.length, labResults.length, labResultReview?.updatedAt, dossierIndex?.updatedAt]);

  const selectTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const nextTemplate = availableTemplates.find((item) => item.id === nextTemplateId);
    setFormat((current) => nextTemplate?.formats.includes(current) ? current : nextTemplate?.formats[0] || 'DOCX');
    setCellValues({});
    setIssue('');
    setSavedAt(null);
    setLastOutput(null);
  };

  const updateCell = (cell: PgdTemplateCell, value: unknown) => {
    setIssue('');
    setCellValues((current) => ({ ...current, [cell.key]: value }));
  };

  const generate = async () => {
    if (!template) return;
    setBusy(true);
    try {
      const normalized = normalizePgdCellValues(template.cells, cellValues);
      const issues = validatePgdCellValues(template.cells, normalized);
      if (issues.length > 0) throw new Error(issues.map((item) => item.message).join(' '));
      const result = await generateDocument({ requestId: request.id, kind: template.kind, format, templateId: template.id, cellValues: normalized });
      const blob = new Blob([decodeBase64(result.contentBase64)], { type: result.document.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.document.fileName;
      link.click();
      setLastOutput({ fileName: result.document.fileName, url, mimeType: result.document.mimeType, generatedAt: new Date().toISOString() });
      setSavedAt(null);
      toast.success(`Đã sinh ${result.document.fileName}`);
      setIssue('');
    } catch (error: any) {
      setIssue(error?.message || 'Không thể sinh tài liệu PGD.');
      toast.error(error?.message || 'Không thể sinh tài liệu PGD.');
    } finally {
      setBusy(false);
    }
  };

  return <div data-testid="pgd-document-generation" className="space-y-3" aria-label="Sinh tài liệu PGD" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-xs font-black text-blue-950"><FileOutput size={15} className="text-blue-600" /> Sinh tài liệu PGD</h3><p className="mt-1 text-[10px] text-blue-800/70">Nhập phần dữ liệu còn thiếu; template phù hợp sẽ được hệ thống tự ghép.</p></div><span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[9px] font-black text-blue-700">{request.productGroup}</span></div>
    <PgdDocumentStateSummary state={documentState} templateLabel={templateLabel} issueCount={readinessIssues.length} issue={issue} />
    <div className={showTemplateSelector ? 'mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem]' : 'mt-3 grid gap-2 md:grid-cols-[8rem]'}>{showTemplateSelector && <label>
<span className="mb-1 block text-[9px] font-black text-slate-500">Loại biểu mẫu</span>
<select aria-label="Loại tài liệu PGD" value={template?.id || ''} onChange={(event) => selectTemplate(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400">{availableTemplates.map((item) => <option key={item.id} value={item.id}>{PGD_DOCUMENT_KIND_LABELS[item.kind]} · {item.code} · v{item.version}</option>)}</select>
</label>}<label>
<span className="mb-1 block text-[9px] font-black text-slate-500">Định dạng</span>
<select aria-label="Định dạng tài liệu PGD" value={format} onChange={(event) => setFormat(event.target.value as PgdDocumentTemplateFormat)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black outline-none focus:border-blue-400">{(template?.formats || ['DOCX', 'PDF']).map((item) => <option key={item} value={item}>{item}</option>)}</select>
</label>
</div>
    {template && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{formCells.map((cell) => <label key={cell.key} className={cell.type === 'TABLE' ? 'block sm:col-span-2 lg:col-span-4' : 'block'}><span className="mb-1 block text-[9px] font-black text-slate-600">{cell.label}{cell.required ? ' *' : ''}{cell.unit ? ` · ${cell.unit}` : ''}</span>{cell.type === 'TABLE' ? <PgdTableFieldEditor cell={cell} value={cellValues[cell.key]} readOnly={!canMutate || busy} onChange={(value) => { setIssue(''); updateCell(cell, value); }} /> : cell.type === 'BOOLEAN' ? <select aria-label={`Giá trị ${cell.key}`} disabled={!canMutate || busy} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-blue-400 disabled:bg-slate-100"><option value="">Chọn...</option><option value="true">Có</option><option value="false">Không</option></select> : cell.validation?.options?.length ? <select aria-label={`Giá trị ${cell.key}`} disabled={!canMutate || busy} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-blue-400 disabled:bg-slate-100"><option value="">Chọn...</option>{cell.validation.options.map((option) => <option key={option} value={option}>{option === 'METHOD_7' ? 'Phương thức 7' : option}</option>)}</select> : <input aria-label={`Giá trị ${cell.key}`} disabled={!canMutate || busy} type={cell.type === 'NUMBER' ? 'number' : cell.type === 'DATE' ? 'date' : 'text'} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] outline-none focus:border-blue-400 disabled:bg-slate-100" />}</label>)}</div>}
    {issue && <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800">{issue}</p>}
    <div data-testid="pgd-document-outputs" className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[10px] font-black text-slate-800"><FileText size={14} className="text-blue-600" /> Kết quả sinh gần nhất</div>{lastOutput ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white p-2"><div className="min-w-0"><div className="truncate text-[10px] font-black text-slate-700" title={lastOutput.fileName}>{lastOutput.fileName}</div><div className="mt-0.5 text-[9px] text-slate-500">{format} · {new Date(lastOutput.generatedAt).toLocaleString('vi-VN')}</div></div><a href={lastOutput.url} download={lastOutput.fileName} className="mobile-touch-target inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-100"><Download size={14} /> Tải lại</a></div> : <p className="mt-1 text-[9px] text-slate-500">Chưa có file trong phiên này. File chỉ xuất hiện sau khi server sinh thành công.</p>}</div>
    <div className="mobile-safe-bottom sticky bottom-0 z-10 flex flex-col items-stretch justify-between gap-2 border-t border-blue-100 bg-white py-3 sm:flex-row sm:items-center"><div className="text-[9px] text-blue-800/70">Dữ liệu lấy từ hồ sơ PGD và template phù hợp; bản soạn không tự đổi trạng thái hồ sơ.</div><div className="flex flex-wrap justify-end gap-2">{onSaveDraft && <button type="button" disabled={!canMutate || busy || !template} onClick={() => { onSaveDraft({ templateId: template?.id || '', format, cellValues }); setSavedAt(new Date().toISOString()); }} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-[10px] font-black text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" title={!template ? 'Chọn template trước' : undefined}><Save size={14} /> Lưu bản soạn</button>}<button type="button" disabled={!canMutate || busy || !template || readinessIssues.length > 0} onClick={() => void generate()} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50" title={readinessIssues.length > 0 ? 'Bổ sung các trường bắt buộc trước khi sinh' : undefined}><Sparkles size={14} />{busy ? 'Đang sinh...' : 'Sinh DOCX/PDF & tải file'}</button></div></div>
  </div>;
}

 export function PgdTemplateManagementPanel({ templates, canMutate }: { templates: PgdDocumentTemplate[]; canMutate: boolean }) {
   const saveDocumentTemplate = usePgdStore((state) => state.saveDocumentTemplate);
   const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
   const [draft, setDraft] = useState<PgdDocumentTemplate | undefined>(templates[0]);
   const [busy, setBusy] = useState(false);
   const selected = templates.find((template) => template.id === selectedId) || templates[0];
   const placeholderKeys = draft?.placeholderKeys || draft?.cells.map((cell) => cell.key) || [];

   useEffect(() => { setDraft(selected); }, [selected?.id]);
   const save = async () => {
     if (!draft) return;
     setBusy(true);
     try {
       await saveDocumentTemplate({ ...draft, status: 'DRAFT' });
       toast.success('Đã lưu cấu hình template DOCX PGD.');
     } catch (error: any) {
       toast.error(error?.message || 'Không thể lưu template PGD.');
     } finally {
       setBusy(false);
     }
   };
   const sourceInspection = draft?.sourceInspection;
   const sourceStatusLabel = sourceInspection?.status === 'READY'
     ? 'File nguồn hợp lệ'
     : sourceInspection?.status === 'PLACEHOLDER_MISMATCH'
       ? 'Placeholder chưa khớp file nguồn'
       : sourceInspection?.status === 'MISSING'
         ? 'Thiếu file nguồn'
         : 'Chưa kiểm tra được file nguồn';
   const sourceStatusClass = sourceInspection?.status === 'READY'
     ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
     : 'border-amber-200 bg-amber-50 text-amber-800';
   return (
     <div className="space-y-3 p-3 md:p-5">
       <header>
         <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Template DOCX</div>
         <h1 className="mt-1 text-xl font-black text-slate-900">Quản trị template DOCX PGD</h1>
         <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Quản lý file DOCX, placeholder và cell của Phòng Giám định. Template được dùng cho form nhập liệu và sinh tài liệu theo đúng bố cục DOCX.</p>
       </header>

       <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
         <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
           <label>
             <span className="mb-1 block text-[9px] font-black text-slate-500">Chọn template DOCX</span>
             <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400">
               {templates.map((template) => <option key={template.id} value={template.id}>{template.code} · {template.name} · v{template.version}</option>)}
             </select>
           </label>
           <div className="flex items-end">
             <button type="button" disabled={!canMutate || busy || !draft} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50"><Save size={13} />{busy ? 'Đang lưu...' : 'Lưu cấu hình template'}</button>
           </div>
         </div>
       </section>

       {draft && (
         <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
           <div className="flex flex-wrap items-start justify-between gap-2">
             <div>
               <div className="text-[10px] font-black text-blue-950">File DOCX nguồn và placeholder</div>
               <p className="mt-1 break-all text-[9px] font-mono text-blue-800/70">{draft.fileName}{sourceInspection?.byteSize ? ' · ' + sourceInspection.byteSize.toLocaleString('vi-VN') + ' bytes' : ''}</p>
             </div>
             <a href={getPgdTemplateSourceUrl(draft.id)} download={draft.fileName} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[9px] font-black text-blue-700 hover:bg-blue-100">Tải DOCX nguồn</a>
           </div>
           <div className={'inline-flex rounded-full border px-2 py-1 text-[9px] font-black ' + sourceStatusClass}>{sourceStatusLabel}</div>
           {sourceInspection?.status !== 'READY' && sourceInspection?.message && <p role="alert" className="text-[9px] font-bold text-amber-800">{sourceInspection.message}</p>}
           {sourceInspection?.missingPlaceholderKeys?.length ? <p className="break-all text-[9px] font-bold text-amber-800">Thiếu placeholder: {sourceInspection.missingPlaceholderKeys.map((key) => '[[' + key + ']]').join(', ')}</p> : null}
           {sourceInspection?.extraPlaceholderKeys?.length ? <p className="break-all text-[9px] font-bold text-amber-800">Thừa placeholder: {sourceInspection.extraPlaceholderKeys.map((key) => '[[' + key + ']]').join(', ')}</p> : null}
           <p className="text-[9px] leading-4 text-blue-800/70">Placeholder được kiểm tra trực tiếp từ file DOCX; bố cục biểu mẫu nằm trong file nguồn.</p>
           <div className="flex flex-wrap gap-1.5">
             {draft.cells.filter((cell) => placeholderKeys.includes(cell.key)).map((cell) => <span key={cell.key} className="rounded-md border border-blue-200 bg-white px-2 py-1 font-mono text-[9px] text-blue-800">{'[[' + cell.key + ']]'}</span>)}
           </div>
         </section>
       )}
     </div>
   );
 }



export function PgdTemplateSettingsWorkspace({ templates, canMutate }: { templates: PgdDocumentTemplate[]; canMutate: boolean }) {
  return <PgdTemplateManagementPanel templates={templates} canMutate={canMutate} />;
}
