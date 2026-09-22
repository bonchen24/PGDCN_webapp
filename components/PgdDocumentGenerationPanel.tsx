'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import { CheckCircle2, Download, FileOutput, FileText, LockKeyhole, Save, Sparkles, UnlockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import {
  getPgdTemplateCellsForProductGroup,
  getPgdDocumentTemplates,
  orderPgdTemplateCells,
  normalizePgdCellValues,
  validatePgdCellValues,
  type PgdDocumentTemplate,
  type PgdDocumentTemplateFormat,
  type PgdDocumentTemplateKind,
  type PgdCellValidationIssue,
  type PgdTemplateCell,
} from '../utils/pgdDocumentTemplates';
import { getPgdTemplateSourceUrl } from '../utils/pgdApi';
import { usePgdStore } from '../store-pgd';
import type { PgdCaseEvent, PgdDossierIndex, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from '../utils/pgdArtifacts';
import PgdTableFieldEditor from './PgdTableFieldEditor';
import { DraftingContextStatusBar, DraftingFieldSection, DraftingOutputReviewShell, DraftingReadinessPanel, DraftingStickyActionBar } from './PgdcnDraftingPrimitives';
import { PgdcnDateInput } from './PgdcnDateInput';

type PgdDocumentGenerationPanelProps = {
  request: PgdInspectionRequest;
  templates: PgdDocumentTemplate[];
  canMutate: boolean;
  initialTemplateId?: string;
  initialFormat?: PgdDocumentTemplateFormat;
  initialCellValues?: Record<string, unknown>;
  onSaveDraft?: (input: { templateId: string; format: PgdDocumentTemplateFormat; cellValues: Record<string, unknown> }) => void;
  onAttachGenerated?: (document: PgdGeneratedDocument) => Promise<void>;
  showTemplateSelector?: boolean;
  showContextStatus?: boolean;
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
    registrationNumber: request.registryMetadata?.registrationNumber || '',
    receivedAt: request.registryMetadata?.receivedAt || '',
    technicalDossierNote: request.registryMetadata?.technicalDossierNote || '',
    deficiencyNote: request.registryMetadata?.deficiencyNote || '',
    returnedPackageNote: request.registryMetadata?.returnedPackageNote || '',
    courierName: request.registryMetadata?.courierName || '',
    registryDocuments: request.registryMetadata?.documents || [],
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
    senderUnit: latestLabRequest?.senderUnit || 'Phòng Giám định, Chứng nhận, Phát triển thị trường',
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

const PGD_DOCUMENT_SECTION_LABELS: Record<string, string> = {
  identity: 'Nhận diện chứng từ',
  customer: 'Khách hàng / đơn vị yêu cầu',
  product: 'Sản phẩm / lô hàng',
  criteria: 'Phạm vi / tiêu chuẩn',
  location: 'Địa điểm / thời gian',
  sampling: 'Lấy mẫu / niêm phong',
  samples: 'Mẫu và bàn giao',
  documents: 'Chứng từ liên quan',
  laboratory: 'Phòng thử nghiệm',
  handover: 'Giao nhận',
  results: 'Kết quả / kết luận',
  timeline: 'Diễn biến / hoạt động',
  index: 'Mục lục hồ sơ',
  approval: 'Phê duyệt / ký',
  confirmation: 'Xác nhận',
  archive: 'Lưu trữ / soát xét',
  findings: 'Ghi nhận / điểm không phù hợp',
  conclusion: 'Kết luận / kiến nghị',
};

function pgdDocumentSectionLabel(sectionCode: string): string {
  return PGD_DOCUMENT_SECTION_LABELS[sectionCode] || sectionCode.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

type PgdDocumentState = 'EMPTY' | 'EDITING' | 'SAVED' | 'GENERATING' | 'READY' | 'ATTACHED' | 'BLOCKED' | 'ERROR';

const PGD_DOCUMENT_STATE_LABELS: Record<PgdDocumentState, string> = {
  EMPTY: 'Chưa chọn biểu mẫu',
  EDITING: 'Đang soạn',
  SAVED: 'Đã lưu bản soạn',
  GENERATING: 'Đang sinh tài liệu',
  READY: 'Đã sẵn sàng',
  ATTACHED: 'Đã gắn vào hồ sơ',
  BLOCKED: 'Cần bổ sung dữ liệu',
  ERROR: 'Có lỗi, cần thử lại',
};

function hasMeaningfulPgdCellValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  return Array.isArray(value) ? value.length > 0 : true;
}

export default function PgdDocumentGenerationPanel({ request, templates, canMutate, initialTemplateId, initialFormat = 'DOCX', initialCellValues, onSaveDraft, onAttachGenerated, showTemplateSelector = true, showContextStatus = true }: PgdDocumentGenerationPanelProps) {
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
  const [lastGeneratedDocument, setLastGeneratedDocument] = useState<PgdGeneratedDocument | null>(null);
  const [attachedGeneratedId, setAttachedGeneratedId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [reviewedOutput, setReviewedOutput] = useState(false);
  const [allowSourceEditing, setAllowSourceEditing] = useState(false);
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
  const sourceCellValues = useMemo(() => Object.fromEntries(formCells.map((cell) => [cell.key, initialValue(cell, request, prefill)])), [formCells, request, inspectionPlan, caseEvents, fieldActivityLogs, fieldInspection, samples, labResults, labRequests, labResultReview, dossierIndex]);
  const draftCellKeys = useMemo(() => new Set(Object.keys(initialCellValues || {})), [initialCellValues]);
  const sourceFieldKeys = useMemo(() => new Set(formCells.filter((cell) => !draftCellKeys.has(cell.key) && hasMeaningfulPgdCellValue(sourceCellValues[cell.key])).map((cell) => cell.key)), [draftCellKeys, formCells, sourceCellValues]);
  const readinessIssues = useMemo(() => template ? validatePgdCellValues(template.cells, normalizePgdCellValues(template.cells, cellValues)) : [], [cellValues, template]);
  const readinessIssueKeys = useMemo(() => new Set(readinessIssues.map((item) => item.key)), [readinessIssues]);
  const formCellGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; cells: typeof formCells; missingCount: number; autoFilledCount: number }>();
    for (const cell of orderPgdTemplateCells(formCells)) {
      const key = cell.sectionCode || 'identity';
      const current = groups.get(key);
      if (current) {
        current.cells.push(cell);
        current.missingCount += readinessIssueKeys.has(cell.key) ? 1 : 0;
        current.autoFilledCount += sourceFieldKeys.has(cell.key) ? 1 : 0;
      } else groups.set(key, { key, label: pgdDocumentSectionLabel(key), cells: [cell], missingCount: readinessIssueKeys.has(cell.key) ? 1 : 0, autoFilledCount: sourceFieldKeys.has(cell.key) ? 1 : 0 });
    }
    return [...groups.values()];
  }, [formCells, readinessIssueKeys, sourceFieldKeys]);
  const hasDraftValues = Object.values(cellValues).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0);
  const documentState: PgdDocumentState = busy ? 'GENERATING' : issue ? 'ERROR' : attachedGeneratedId ? 'ATTACHED' : !template ? 'EMPTY' : readinessIssues.length > 0 ? 'BLOCKED' : lastOutput ? 'READY' : savedAt ? 'SAVED' : hasDraftValues ? 'EDITING' : 'EMPTY';
  const templateLabel = template ? `${template.code} · v${template.version}` : 'Chưa có mẫu';
  const readinessIssueItems = readinessIssues.map((item) => ({ key: item.key, label: formCells.find((cell) => cell.key === item.key)?.label || 'Trường dữ liệu', message: item.message }));

  const focusField = (key: string) => {
    const field = document.getElementById(`pgd-document-${key}`) || document.querySelector<HTMLElement>(`[data-pgd-field="${key}"]`);
    if (!field) return;
    const details = field.closest('details');
    if (details) details.open = true;
    window.requestAnimationFrame(() => {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof field.focus === 'function') field.focus({ preventScroll: true });
    });
  };

  const focusFirstMissingField = () => {
    const first = readinessIssueItems[0];
    if (first) focusField(first.key);
  };

  const focusOutputReview = () => {
    const output = document.getElementById('pgd-document-outputs');
    output?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    setLastGeneratedDocument(null);
    setAttachedGeneratedId(null);
    setReviewedOutput(false);
  };

  const updateCell = (cell: PgdTemplateCell, value: unknown) => {
    setIssue('');
    setCellValues((current) => ({ ...current, [cell.key]: value }));
  };

  const attachGeneratedOutput = async () => {
    if (!onAttachGenerated || !lastGeneratedDocument || !canMutate || attaching) return;
    setAttaching(true);
    try {
      await onAttachGenerated(lastGeneratedDocument);
      setAttachedGeneratedId(lastGeneratedDocument.id);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gắn tài liệu vào bộ hồ sơ.');
    } finally {
      setAttaching(false);
    }
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
      setLastGeneratedDocument(result.document);
      setAttachedGeneratedId(null);
      setReviewedOutput(false);
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

  return <div data-testid="pgd-document-generation" className="space-y-4" aria-label="Sinh tài liệu PGD" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-[15px] font-black text-blue-950"><FileOutput size={17} className="text-blue-600" /> Sinh tài liệu PGD</h3><p className="mt-1 text-[13px] leading-5 text-blue-900/75">Nhập phần dữ liệu còn thiếu; mẫu phù hợp sẽ được hệ thống tự ghép.</p></div><span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-black text-blue-700">{request.productGroup}</span></div>
    {showContextStatus && <DraftingContextStatusBar domain="PGD" sourceLabel={`${request.requestCode} · ${request.customerSnapshot.name}`} documentLabel={template ? `${template.name} · ${templateLabel}` : templateLabel} statusLabel={PGD_DOCUMENT_STATE_LABELS[documentState]} description="Dữ liệu nguồn được điền theo hồ sơ hiện tại; thay đổi chỉ nằm trong bản soạn cho đến khi sinh thành công." metadata={<span className="max-w-full break-words rounded-md border border-blue-200 bg-white/80 px-2 py-1 text-blue-800">Sản phẩm / đối tượng: {request.productName}</span>} advancedMetadata={<><div><span className="text-slate-400">Nhóm sản phẩm:</span> <span className="font-mono text-slate-700">{request.productGroup}</span></div><div><span className="text-slate-400">Mã mẫu:</span> <span className="font-mono text-slate-700">{template?.id || 'Chưa chọn'}</span></div></>} />}
    <DraftingReadinessPanel state={documentState} stateLabel={PGD_DOCUMENT_STATE_LABELS[documentState]} issueCount={readinessIssues.length} testId="pgd-document-readiness" stateTestId="pgd-document-state" onIssueClick={(item) => focusField(item.key)} message={documentState === 'EMPTY' ? 'Chọn loại biểu mẫu để bắt đầu từ dữ liệu hồ sơ PGD.' : documentState === 'BLOCKED' ? `Chưa thể sinh tệp: còn ${readinessIssues.length} trường cần kiểm tra.` : documentState === 'GENERATING' ? 'Đang tạo tệp từ dữ liệu đã kiểm tra. Vui lòng chờ kết quả.' : documentState === 'READY' ? 'Tệp vừa sinh đã sẵn sàng để tải lại hoặc đối chiếu.' : documentState === 'ATTACHED' ? 'Tài liệu đã được xác nhận và gắn vào đúng bộ hồ sơ.' : issue || 'Kiểm tra dữ liệu trước khi sinh DOCX/PDF.'} issues={readinessIssueItems} metadata={<span className="max-w-full break-words rounded-md border border-current/15 bg-white/70 px-2 py-1">Mẫu: {templateLabel}</span>} />
    <div className={showTemplateSelector ? 'mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem]' : 'mt-3 grid gap-2 md:grid-cols-[8rem]'}>{showTemplateSelector && <label>
<span className="mb-1 block text-[12px] font-black text-slate-500">Loại biểu mẫu</span>
<select aria-label="Loại tài liệu PGD" value={template?.id || ''} onChange={(event) => selectTemplate(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold outline-none focus:border-blue-400">{availableTemplates.map((item) => <option key={item.id} value={item.id}>{PGD_DOCUMENT_KIND_LABELS[item.kind]} · {item.code} · v{item.version}</option>)}</select>
</label>}<label>
<span className="mb-1 block text-[12px] font-black text-slate-500">Định dạng</span>
<select aria-label="Định dạng tài liệu PGD" value={format} onChange={(event) => setFormat(event.target.value as PgdDocumentTemplateFormat)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-black outline-none focus:border-blue-400">{(template?.formats || ['DOCX', 'PDF']).map((item) => <option key={item} value={item}>{item}</option>)}</select>
</label>
</div>
    {template && <div data-testid="pgd-document-field-sections" className="mt-3 space-y-3">{allowSourceEditing ? null : <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] text-slate-600"><span>Dữ liệu tự điền từ hồ sơ đang ở chế độ readonly; ưu tiên các trường còn thiếu.</span><button type="button" onClick={() => setAllowSourceEditing(true)} className="mobile-touch-target inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-black text-slate-700 hover:bg-slate-100"><LockKeyhole size={13} aria-hidden="true" /> Cho phép sửa dữ liệu nguồn</button></div>}{allowSourceEditing && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[12px] text-blue-900"><span>Đang cho phép hiệu chỉnh dữ liệu nguồn trong bản soạn này; hồ sơ gốc không đổi.</span><button type="button" onClick={() => setAllowSourceEditing(false)} className="mobile-touch-target inline-flex min-h-10 items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[12px] font-black text-blue-700 hover:bg-blue-100"><UnlockKeyhole size={13} aria-hidden="true" /> Khóa lại dữ liệu nguồn</button></div>}{formCellGroups.map((group) => <DraftingFieldSection key={group.key} testId={`pgd-document-section-${group.key}`} title={group.label} collapsible defaultOpen={group.missingCount > 0 || group.autoFilledCount < group.cells.length} missingCount={group.missingCount}><div className="grid min-w-0 gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{group.cells.map((cell) => { const fieldId = `pgd-document-${cell.key}`; const requiredProps = { required: cell.required, 'aria-required': cell.required || undefined, 'aria-invalid': readinessIssueKeys.has(cell.key) || undefined }; const cellLabel = <>{cell.label}{cell.required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}{cell.unit ? ` · ${cell.unit}` : ''}</>; const autoFilled = sourceFieldKeys.has(cell.key); const readOnly = autoFilled && !allowSourceEditing; const fieldClass = `min-h-11 w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 ${readinessIssueKeys.has(cell.key) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'} ${readOnly ? 'cursor-default bg-slate-100 text-slate-600' : 'bg-white'}`; return cell.type === 'TABLE' ? <fieldset key={cell.key} id={fieldId} data-pgd-field={cell.key} tabIndex={-1} className={`block min-w-0 rounded-lg border border-slate-100 bg-white p-3 sm:col-span-2 lg:col-span-4 xl:col-span-5 ${readinessIssueKeys.has(cell.key) ? 'border-amber-300 bg-amber-50/30' : ''}`}><legend className="px-1 text-[12px] font-black text-slate-700">{cellLabel}</legend><PgdTableFieldEditor cell={cell} value={cellValues[cell.key]} readOnly={!canMutate || busy || readOnly} onChange={(value) => { setIssue(''); updateCell(cell, value); }} /></fieldset> : <label key={cell.key} htmlFor={fieldId} data-pgd-field={cell.key} className="block min-w-0 scroll-mt-24 scroll-mb-28"><span className="mb-1 block text-[12px] font-black text-slate-600">{cellLabel}</span>{cell.type === 'BOOLEAN' ? <select id={fieldId} {...requiredProps} aria-label={`Giá trị ${cell.key}`} disabled={!canMutate || busy || readOnly} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className={fieldClass}><option value="">Chọn giá trị</option><option value="true">Có</option><option value="false">Không</option></select> : cell.validation?.options?.length ? <select id={fieldId} {...requiredProps} aria-label={`Giá trị ${cell.key}`} disabled={!canMutate || busy || readOnly} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className={fieldClass}><option value="">Chọn giá trị</option>{cell.validation.options.map((option) => <option key={option} value={option}>{option === 'METHOD_7' ? 'Phương thức 7' : option}</option>)}</select> : cell.type === 'DATE' ? <PgdcnDateInput id={fieldId} {...requiredProps} readOnly={!canMutate || busy || readOnly} value={scalarInputValue(cellValues[cell.key])} onChange={(value) => updateCell(cell, value)} className={fieldClass} /> : <input id={fieldId} {...requiredProps} readOnly={!canMutate || busy || readOnly} type={cell.type === 'NUMBER' ? 'number' : 'text'} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className={fieldClass} />}{autoFilled && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{readOnly ? 'Tự điền từ hồ sơ · readonly' : 'Giá trị nguồn · đang cho phép hiệu chỉnh'}</span>}{readinessIssueKeys.has(cell.key) && <span className="mt-1 block text-[11px] font-bold leading-4 text-amber-800">Bắt buộc: {cell.label}.</span>}</label>; })}</div></DraftingFieldSection>)}</div>}
    {issue && <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] font-bold text-amber-800">{issue}</p>}
    {lastOutput && <DraftingOutputReviewShell testId="pgd-document-outputs" accent="blue" title="Review output · Soát xét trước khi gắn" description="Kiểm tra định danh, nguồn PYC và phiên bản mẫu trước khi xác nhận vào đúng mục hồ sơ.">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3"><div className="min-w-0"><div className="break-words text-[13px] font-black text-slate-800" title={lastOutput.fileName}>{lastOutput.fileName}</div><p className="mt-1 text-[11px] leading-4 text-blue-900">Nguồn: <b>{request.requestCode}</b> · khách hàng <b>{request.customerSnapshot.name}</b> · sản phẩm/đối tượng <b>{request.productName}</b>.</p><div className="mt-1 text-[11px] text-slate-500">{format} · {formatDateTimeDdMmYyyy(lastOutput.generatedAt) || 'Chưa cập nhật'} · template <span className="font-mono">{templateLabel}</span></div></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-800">{attachedGeneratedId === lastGeneratedDocument?.id ? 'ATTACHED · Đã gắn' : reviewedOutput ? 'CONFIRMED · Đã soát xét' : 'READY · Chờ soát xét'}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><a href={lastOutput.url} download={lastOutput.fileName} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Download size={15} aria-hidden="true" /> Tải lại</a>{!reviewedOutput && <button type="button" onClick={() => setReviewedOutput(true)} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-black text-teal-800 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"><CheckCircle2 size={15} aria-hidden="true" /> Xác nhận đã soát xét</button>}{onAttachGenerated && lastGeneratedDocument && reviewedOutput && <button type="button" aria-label="Xác nhận vào bộ hồ sơ" disabled={!canMutate || busy || attaching || attachedGeneratedId === lastGeneratedDocument.id} onClick={() => void attachGeneratedOutput()} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{attachedGeneratedId === lastGeneratedDocument.id ? 'ATTACHED · Đã gắn vào hồ sơ' : attaching ? 'Đang gắn…' : 'Xác nhận & gắn vào bộ hồ sơ'}</button>}{attachedGeneratedId === lastGeneratedDocument?.id && <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-800"><CheckCircle2 size={15} aria-hidden="true" /> ATTACHED · Đã gắn đúng mục hồ sơ</span>}</div>
    </DraftingOutputReviewShell>}
    <DraftingStickyActionBar testId="pgd-document-actions" accent="blue" metadata="Dữ liệu lấy từ hồ sơ PGD và mẫu phù hợp; bản soạn không tự đổi trạng thái hồ sơ.">
      {documentState === 'EMPTY' && <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-600">Chưa có mẫu phù hợp để bắt đầu</span>}
      {documentState === 'BLOCKED' && <button type="button" onClick={focusFirstMissingField} disabled={readinessIssueItems.length === 0} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[13px] font-black text-white hover:bg-amber-500 disabled:opacity-50">Đi tới trường còn thiếu</button>}
      {(documentState === 'EDITING' || documentState === 'SAVED' || documentState === 'ERROR') && <>{onSaveDraft && <button type="button" disabled={!canMutate || busy || !template} onClick={() => { onSaveDraft({ templateId: template?.id || '', format, cellValues }); setSavedAt(new Date().toISOString()); }} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-[13px] font-black text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" title={!template ? 'Chọn mẫu trước' : undefined}><Save size={15} aria-hidden="true" /> Lưu bản nháp</button>}<button type="button" disabled={!canMutate || busy || !template || readinessIssues.length > 0} onClick={() => void generate()} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50" title={readinessIssues.length > 0 ? 'Bổ sung các trường bắt buộc trước khi sinh' : undefined}><Sparkles size={15} aria-hidden="true" /> Lưu & sinh DOCX + PDF</button></>}
      {documentState === 'GENERATING' && <button type="button" disabled className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[13px] font-black text-white disabled:cursor-wait disabled:opacity-70"><Sparkles size={15} aria-hidden="true" /> Đang sinh tài liệu…</button>}
      {documentState === 'READY' && <button type="button" onClick={focusOutputReview} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-black text-white hover:bg-blue-500"><CheckCircle2 size={15} aria-hidden="true" /> Review output</button>}
      {documentState === 'ATTACHED' && <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-black text-emerald-800"><CheckCircle2 size={15} aria-hidden="true" /> ATTACHED · Đã gắn vào hồ sơ</span>}
    </DraftingStickyActionBar>
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
      toast.success('Đã lưu cấu hình mẫu DOCX PGD.');
     } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu mẫu PGD.');
     } finally {
       setBusy(false);
     }
   };
   const sourceInspection = draft?.sourceInspection;
   const sourceStatusLabel = sourceInspection?.status === 'READY'
     ? 'Tệp nguồn hợp lệ'
     : sourceInspection?.status === 'PLACEHOLDER_MISMATCH'
       ? 'Trường dữ liệu trong tệp chưa khớp'
       : sourceInspection?.status === 'MISSING'
         ? 'Thiếu tệp nguồn'
         : 'Chưa kiểm tra được tệp nguồn';
   const sourceStatusClass = sourceInspection?.status === 'READY'
     ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
     : 'border-amber-200 bg-amber-50 text-amber-800';
   return (
     <div className="space-y-3 p-3 md:p-5">
       <header>
         <div className="text-[12px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Mẫu DOCX</div>
         <h1 className="mt-1 text-xl font-black text-slate-900">Quản trị mẫu DOCX PGD</h1>
         <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Quản lý tệp DOCX, trường dữ liệu và cấu hình ô của Phòng Giám định. Mẫu được dùng cho form nhập liệu và sinh tài liệu theo đúng bố cục DOCX.</p>
       </header>

       <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
         <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
           <label>
             <span className="mb-1 block text-[11px] font-black text-slate-500">Chọn mẫu DOCX</span>
             <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold outline-none focus:border-blue-400">
               {templates.map((template) => <option key={template.id} value={template.id}>{template.code} · {template.name} · v{template.version}</option>)}
             </select>
           </label>
           <div className="flex items-end">
             <button type="button" disabled={!canMutate || busy || !draft} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-black text-white disabled:opacity-50"><Save size={13} />{busy ? 'Đang lưu...' : 'Lưu cấu hình mẫu'}</button>
           </div>
         </div>
       </section>

       {draft && (
         <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
           <div className="flex flex-wrap items-start justify-between gap-2">
             <div>
               <div className="text-[12px] font-black text-blue-950">Tệp DOCX nguồn và trường dữ liệu</div>
               <p className="mt-1 break-all text-[11px] font-mono text-blue-800/70">{draft.fileName}{sourceInspection?.byteSize ? ' · ' + sourceInspection.byteSize.toLocaleString('vi-VN') + ' byte' : ''}</p>
             </div>
             <a href={getPgdTemplateSourceUrl(draft.id)} download={draft.fileName} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100">Tải DOCX nguồn</a>
           </div>
           <div className={'inline-flex rounded-full border px-2 py-1 text-[11px] font-black ' + sourceStatusClass}>{sourceStatusLabel}</div>
           {sourceInspection?.status !== 'READY' && sourceInspection?.message && <p role="alert" className="text-[11px] font-bold text-amber-800">{sourceInspection.message}</p>}
           {sourceInspection?.missingPlaceholderKeys?.length ? <p className="break-all text-[11px] font-bold text-amber-800">Thiếu trường dữ liệu trong tệp DOCX: {sourceInspection.missingPlaceholderKeys.map((key) => draft.cells.find((cell) => cell.key === key)?.label || 'Trường chưa khai báo').join(', ')}</p> : null}
           {sourceInspection?.extraPlaceholderKeys?.length ? <p className="break-all text-[11px] font-bold text-amber-800">Có trường chưa được cấu hình: {sourceInspection.extraPlaceholderKeys.map((key) => draft.cells.find((cell) => cell.key === key)?.label || 'Trường chưa khai báo').join(', ')}</p> : null}
           <p className="text-[11px] leading-4 text-blue-800/70">Cấu hình trường được kiểm tra trực tiếp từ tệp DOCX; bố cục biểu mẫu nằm trong tệp nguồn.</p>
           <div className="flex flex-wrap gap-1.5">
             {draft.cells.filter((cell) => placeholderKeys.includes(cell.key)).map((cell) => <span key={cell.key} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] text-blue-800">{cell.label}</span>)}
           </div>
         </section>
       )}
     </div>
   );
 }



export function PgdTemplateSettingsWorkspace({ templates, canMutate }: { templates: PgdDocumentTemplate[]; canMutate: boolean }) {
  return <PgdTemplateManagementPanel templates={templates} canMutate={canMutate} />;
}
