import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type {
  PgdCaseEvent,
  PgdDossierIndex,
  PgdFieldActivityLog,
  PgdInspectionPlan,
  PgdLabResultReview,
} from './pgdArtifacts.ts';
import type {
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain.ts';
import {
  normalizePgdCellValues,
  snapshotPgdDocumentTemplate,
  validatePgdCellValues,
  type PgdCellStoredValue,
  type PgdCellValue,
  type PgdDocumentTemplate,
  type PgdDocumentTemplateFormat,
  type PgdDocumentTemplateSnapshot,
} from './pgdDocumentTemplates.ts';
import { extractPcnTemplatePlaceholderKeys } from './pcnTemplateDiscovery.ts';
import { inspectPgdTemplateSource, resolvePgdTemplateSourcePath } from './pgdTemplatePack.ts';

export interface PgdDocumentContext {
  domain: 'pgd';
  request: Pick<PgdInspectionRequest, 'id' | 'requestCode' | 'productGroup' | 'productName' | 'lotCode' | 'inspectionScope' | 'inspectionLocation' | 'standards' | 'updatedAt' | 'transportName' | 'registryMetadata'>;
  sourceSnapshots: {
    assignmentId?: string;
    inspectionPlanId?: string;
    caseEventIds: string[];
    fieldActivityLogIds: string[];
    fieldInspectionId?: string;
    sampleIds: string[];
    labRequestIds: string[];
    labResultIds: string[];
    labResultReviewId?: string;
    dossierIndexId?: string;
    reportId?: string;
    certificateId?: string;
  };
  templateSnapshot: PgdDocumentTemplateSnapshot;
  cellValues: Record<string, PgdCellStoredValue>;
  contextHash: string;
  generatedAt: string;
}

export interface PgdDocumentContextInput {
  template: PgdDocumentTemplate;
  request: PgdInspectionRequest;
  assignment?: PgdInspectionAssignment;
  inspectionPlan?: PgdInspectionPlan;
  caseEvents?: PgdCaseEvent[];
  fieldActivityLogs?: PgdFieldActivityLog[];
  fieldInspection?: PgdFieldInspection;
  samples?: PgdSample[];
  labRequests?: PgdLabRequest[];
  labResults?: PgdLabResult[];
  labResultReview?: PgdLabResultReview;
  dossierIndex?: PgdDossierIndex;
  report?: PgdInspectionReport;
  certificate?: PgdInspectionCertificate;
  cellValues: Record<string, unknown> | PgdCellValue[];
  now: string;
}

export interface PgdDocumentOutput {
  format: PgdDocumentTemplateFormat;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  contextHash: string;
  templateSnapshot: PgdDocumentTemplateSnapshot;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function valueText(value: PgdCellStoredValue): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map((row) => Object.entries(row).map(([key, item]) => key + ': ' + String(item ?? '')).join(' · ')).join('\n');
  }
  return String(value);
}

function valueMap(values: readonly PgdCellValue[]): Record<string, PgdCellStoredValue> {
  return Object.fromEntries(values.map((item) => [item.key, item.value]));
}

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function requestBoundValues(input: PgdDocumentContextInput): Record<string, unknown> {
  const request = input.request;
  const bound: Record<string, unknown> = {};
  for (const cell of input.template.cells) {
    if (!cell.binding) continue;
    const value = getPath({ request }, cell.binding);
    if (cell.key === 'standards') {
      bound[cell.key] = Array.isArray(value) ? value.map((standard) => ({ standard })) : [];
    } else if (value !== undefined) {
      bound[cell.key] = value;
    }
  }
  if (input.assignment) {
    bound.leadInspector = input.assignment.leadInspectorUsername || input.assignment.inspectorUsernames[0] || '';
    bound.inspectors = input.assignment.inspectorUsernames.map((username) => ({ username, role: username === input.assignment?.leadInspectorUsername ? 'LEAD' : 'INSPECTOR' }));
    bound.technicalReviewer = input.assignment.technicalReviewerUsername || '';
    bound.scheduledAt = request.inspectionScheduledAt || '';
    bound.team = input.assignment.inspectorUsernames.map((name) => ({ name, role: name === input.assignment?.leadInspectorUsername ? 'LEAD' : 'INSPECTOR' }));
  }
  if (input.inspectionPlan) {
    bound.inspectionDate = input.inspectionPlan.inspectionDate;
    bound.agenda = input.inspectionPlan.schedule.map((row) => ({ time: `${row.startTime}${row.endTime ? `–${row.endTime}` : ''}`, activity: row.activity, owner: row.note || '' }));
    bound.team = input.inspectionPlan.team.map((member) => ({ name: member.name || member.username, role: member.role, phone: member.phone || '' }));
    bound.productLines = input.inspectionPlan.productLines.map((product) => ({ productName: product.productName, grade: product.grade || '', dimensions: product.dimensions || '', standard: product.standard, origin: product.origin || '', manufacturer: product.manufacturer || '', quantity: product.quantity ?? '', unit: product.unit || '' }));
  }
  if (input.caseEvents && input.caseEvents.length > 0) {
    const events = [...input.caseEvents].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const vietnamTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
    bound.eventDate = events[0].occurredAt.slice(0, 10);
    bound.eventRows = events.map((event) => ({ time: vietnamTime(event.occurredAt), activity: event.activity, actor: event.actorUsername, note: event.note || '' }));
  }
  if (input.fieldActivityLogs && input.fieldActivityLogs.length > 0) {
    const latest = [...input.fieldActivityLogs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    bound.session = latest.session;
    bound.activityDate = latest.date || '';
    bound.auditor = latest.auditorUsername || '';
    bound.activityRows = latest.entries.map((entry) => ({ time: entry.time, activity: entry.activity, comments: entry.comments || '' }));
  }
  const field = input.fieldInspection;
  const samples = input.samples || [];
  const labRequests = input.labRequests || [];
  const labResults = input.labResults || [];
  const registryDocumentNumber = (kind: string): string => input.request.registryMetadata?.documents?.find((document) => document.kind === kind)?.number || '';
  bound.transportName = input.request.transportName || '';
  bound.packingListNumber = registryDocumentNumber('PACKING_LIST');
  bound.invoiceNumber = registryDocumentNumber('INVOICE');
  bound.contractNumber = registryDocumentNumber('CONTRACT');
  if (field) {
    bound.performedAt = field.performedAt;
    bound.location = field.location;
    bound.lotObservation = field.lotObservation;
    bound.packaging = field.packaging;
    bound.labeling = field.labeling;
    bound.measurements = Object.entries(field.measurements || {}).map(([item, measurement]) => ({ item, value: measurement }));
    bound.nonconformities = (field.nonconformities || []).map((description, index) => ({ code: String(index + 1), description }));
    bound.inspectionResult = field.inspectionResult || field.note || '';
    bound.customerConfirmation = field.customerRepresentative || '';
    bound.fieldFindings = [
      { item: 'Nhận dạng lô hàng', value: field.lotObservation },
      { item: 'Bao gói / bảo quản', value: field.packaging },
      { item: 'Ghi nhãn', value: field.labeling || '' },
    ];
  }
  if (samples.length > 0) {
    bound.sampleRows = samples.map((sample) => ({
      sampleCode: sample.sampleCode,
      description: sample.description,
      quantity: sample.quantity,
      unit: sample.unit || '',
      disposition: sample.disposition,
      seal: sample.note || '',
    }));
  }
  if (labRequests.length > 0) {
    const latest = [...labRequests].sort((left, right) => (right.handover?.sentAt || '').localeCompare(left.handover?.sentAt || '') || right.id.localeCompare(left.id))[0];
    bound.laboratoryName = latest.laboratoryName;
    bound.laboratoryCode = latest.laboratoryCode || '';
    bound.senderUnit = latest.senderUnit || 'Phòng Giám định - Chứng nhận';
    bound.sentAt = latest.handover?.sentAt;
    bound.sender = latest.handover?.senderUsername;
    bound.receiver = latest.handover?.receiverName;
    bound.testItems = latest.testItems.map((item, index) => ({ item, method: latest.testMethods?.[index] || '' }));
    const samplesById = new Map(samples.map((sample) => [sample.id, sample]));
    bound.handoverRows = labRequests.map((labRequest) => {
      const sample = samplesById.get(labRequest.sampleId);
      return {
        sampleCode: sample?.sampleCode || labRequest.sampleId,
        description: sample?.description || '',
        quantity: labRequest.handover?.quantity || sample?.quantity || '',
        unit: sample?.unit || '',
        testItems: labRequest.testItems.join('; '),
        methods: (labRequest.testMethods || []).join('; '),
      };
    });
    bound.handoverNote = latest.handover?.note || '';
  }
  if (labResults.length > 0) {
    const resultRows = labResults.flatMap((result) => result.values.map((value) => ({
      item: value.label,
      value: value.value,
      unit: value.unit || '',
      method: result.reportNumber || '',
    })));
    bound.labResults = resultRows;
  }
  if (input.labResultReview) {
    bound.labResultRows = labResults.map((result) => ({ reportNumber: result.reportNumber || '', reportDate: result.receivedAt.slice(0, 10), laboratory: labRequests.find((labRequest) => labRequest.id === result.labRequestId)?.laboratoryName || '' }));
    bound.completeness = input.labResultReview.completeness;
    bound.conformity = input.labResultReview.conformity;
    bound.missingItems = (input.labResultReview.missingItems || []).map((item) => ({ item, note: '' }));
    bound.nonconformities = (input.labResultReview.nonconformities || []).map((item) => ({ item, description: item }));
    bound.recommendation = input.labResultReview.recommendation || '';
    bound.conclusion = input.labResultReview.conclusion;
    bound.reviewer = input.labResultReview.reviewerUsername || '';
  }
  if (input.dossierIndex) {
    bound.dossierEntries = input.dossierIndex.entries.map((entry) => ({ requirementCode: entry.requirementCode, title: entry.title, status: entry.status, pageCount: entry.pageCount || '' }));
    bound.reviewer = input.dossierIndex.reviewerUsername || bound.reviewer || '';
    bound.archivist = input.dossierIndex.archivistUsername || '';
    bound.archiveReference = input.dossierIndex.archiveReference || '';
  }
  if (input.report) {
    bound.reportNumber = input.report.reportNumber;
    bound.conclusion = input.report.conclusion;
    bound.reportedAt = input.report.updatedAt;
    bound.labResults = input.report.values.map((value) => ({ item: value.label, value: value.value, unit: value.unit || '' }));
    bound.resultRows = input.report.values.map((value) => ({ item: value.label, result: value.value, unit: value.unit || '' }));
  }
  if (input.certificate) {
    bound.documentNumber = input.certificate.documentNumber;
    bound.conclusion = input.certificate.conclusion;
    bound.signedAt = input.certificate.signedAt;
  }
  bound.registrationNumber = input.request.registryMetadata?.registrationNumber || input.request.requestCode;
  bound.receivedAt = input.request.registryMetadata?.receivedAt || input.now;
  bound.technicalDossierNote = input.request.registryMetadata?.technicalDossierNote || '';
  bound.deficiencyNote = input.request.registryMetadata?.deficiencyNote || '';
  bound.returnedPackageNote = input.request.registryMetadata?.returnedPackageNote || '';
  bound.courierName = input.request.registryMetadata?.courierName || '';
  bound.registryDocuments = (input.request.registryMetadata?.documents || []).map((document) => ({
    kind: document.kind,
    number: document.number || '',
    date: document.date || '',
  }));
  bound.certificateScope = request.inspectionScope;
  bound.inspectionDate = request.inspectionScheduledAt;
  bound.samplingLocation = request.inspectionLocation;
  bound.samplingMethod = request.method;
  bound.quantity = request.quantity;
  bound.reportedAt = bound.reportedAt || input.now;
  return bound;
}

function buildContextHash(context: Omit<PgdDocumentContext, 'contextHash'>): string {
  return createHash('sha256').update(stableJson(context)).digest('hex');
}

export function buildPgdDocumentContext(input: PgdDocumentContextInput): PgdDocumentContext {
  const explicitValues = Array.isArray(input.cellValues) ? valueMap(input.cellValues) : input.cellValues;
  const values = normalizePgdCellValues(input.template.cells, { ...requestBoundValues(input), ...explicitValues });
  const issues = validatePgdCellValues(input.template.cells, values);
  if (issues.length > 0) throw new Error('Dữ liệu cell PGD chưa hợp lệ: ' + issues.map((issue) => issue.message).join(' '));
  const cells = valueMap(values);
  const base = {
    domain: 'pgd' as const,
    request: {
      id: input.request.id,
      requestCode: input.request.requestCode,
      productGroup: input.request.productGroup,
      productName: input.request.productName,
      lotCode: input.request.lotCode,
      inspectionScope: input.request.inspectionScope,
      inspectionLocation: input.request.inspectionLocation,
      standards: [...input.request.standards],
      updatedAt: input.request.updatedAt,
    },
    sourceSnapshots: {
      ...(input.assignment?.id ? { assignmentId: input.assignment.id } : {}),
      ...(input.inspectionPlan?.id ? { inspectionPlanId: input.inspectionPlan.id } : {}),
      caseEventIds: (input.caseEvents || []).map((event) => event.id),
      fieldActivityLogIds: (input.fieldActivityLogs || []).map((log) => log.id),
      ...(input.fieldInspection?.id ? { fieldInspectionId: input.fieldInspection.id } : {}),
      sampleIds: (input.samples || []).map((sample) => sample.id),
      labRequestIds: (input.labRequests || []).map((request) => request.id),
      labResultIds: (input.labResults || []).map((result) => result.id),
      ...(input.labResultReview?.id ? { labResultReviewId: input.labResultReview.id } : {}),
      ...(input.dossierIndex?.id ? { dossierIndexId: input.dossierIndex.id } : {}),
      ...(input.report?.id ? { reportId: input.report.id } : {}),
      ...(input.certificate?.id ? { certificateId: input.certificate.id } : {}),
    },
    templateSnapshot: snapshotPgdDocumentTemplate(input.template, input.now),
    cellValues: cells,
    generatedAt: input.now,
  };
  return { ...base, contextHash: buildContextHash(base) };
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'pgd-document';
}

function buildDocx(context: PgdDocumentContext): Buffer {
  const fileName = String(context.templateSnapshot.fileName || `${context.templateSnapshot.code}.docx`).trim();
  const templatePath = resolvePgdTemplateSourcePath(context.templateSnapshot);
  if (!fileName || !templatePath) throw new Error('Template DOCX PGD không có tên file hợp lệ.');
  const inspection = inspectPgdTemplateSource(context.templateSnapshot);
  if (inspection.status !== 'READY') throw new Error(inspection.message || `File template DOCX PGD chưa sẵn sàng: ${fileName}`);
  if (!existsSync(templatePath)) throw new Error(`Không tìm thấy file template DOCX PGD: ${fileName}`);

  const sourceBytes = readFileSync(templatePath);
  const sourceKeys = extractPcnTemplatePlaceholderKeys(sourceBytes);
  const values = Object.fromEntries(sourceKeys.map((key) => [key, valueText(context.cellValues[key])]));
  const zip = new PizZip(sourceBytes);
  const document = new Docxtemplater(zip, {
    delimiters: { start: '[[', end: ']]' },
    paragraphLoop: true,
    linebreaks: true,
  });
  document.render(values);
  return document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function pdfText(value: string): string {
  return value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\\x20-\\x7E]/g, '?');
}

async function buildPdf(context: PgdDocumentContext): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const write = (text: string, size = 10, bold = false) => {
    if (y < 45) { page = pdf.addPage([595, 842]); y = 800; }
    page.drawText(pdfText(text).slice(0, 110), { x: 42, y, size, font, color: bold ? rgb(0.05, 0.2, 0.45) : rgb(0.1, 0.1, 0.1) });
    y -= size + 7;
  };
  write('IEMM · TVCI · PHONG GIAM DINH - CHUNG NHAN', 13, true);
  write(context.templateSnapshot.name, 14, true);
  write('Ma PYC: ' + context.request.requestCode);
  write('Template: ' + context.templateSnapshot.code + ' - phien ban ' + context.templateSnapshot.version);
  y -= 5;
  for (const cell of context.templateSnapshot.cells) {
    if (cell.active === false) continue;
    const text = valueText(context.cellValues[cell.key]).replace(/\n/g, ' | ');
    write(cell.label + ': ' + text);
  }
  write('Context hash: ' + context.contextHash, 8);
  return Buffer.from(await pdf.save());
}

export async function buildPgdDocumentOutput(context: PgdDocumentContext, format: PgdDocumentTemplateFormat): Promise<PgdDocumentOutput> {
  if (!context.templateSnapshot.formats.includes(format)) throw new Error('Template PGD không hỗ trợ định dạng ' + format + '.');
  const identity = String(context.cellValues.documentNumber || context.cellValues.reportNumber || context.request.requestCode);
  const extension = format === 'DOCX' ? 'docx' : 'pdf';
  const bytes = format === 'DOCX' ? buildDocx(context) : await buildPdf(context);
  return {
    format,
    fileName: safeFilePart(context.templateSnapshot.code + '-' + identity) + '.' + extension,
    mimeType: format === 'DOCX'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf',
    bytes,
    contextHash: context.contextHash,
    templateSnapshot: context.templateSnapshot,
  };
}

// --- End of pgdDocumentGeneration.ts ---
