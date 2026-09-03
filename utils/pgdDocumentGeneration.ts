import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

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

export interface PgdDocumentContext {
  domain: 'pgd';
  request: Pick<PgdInspectionRequest, 'id' | 'requestCode' | 'productGroup' | 'productName' | 'lotCode' | 'inspectionScope' | 'inspectionLocation' | 'standards' | 'updatedAt'>;
  sourceSnapshots: {
    assignmentId?: string;
    fieldInspectionId?: string;
    sampleIds: string[];
    labRequestIds: string[];
    labResultIds: string[];
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
  fieldInspection?: PgdFieldInspection;
  samples?: PgdSample[];
  labRequests?: PgdLabRequest[];
  labResults?: PgdLabResult[];
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
  const field = input.fieldInspection;
  const samples = input.samples || [];
  const labRequests = input.labRequests || [];
  const labResults = input.labResults || [];
  if (field) {
    bound.performedAt = field.performedAt;
    bound.location = field.location;
    bound.lotObservation = field.lotObservation;
    bound.packaging = field.packaging;
    bound.labeling = field.labeling;
    bound.measurements = Object.entries(field.measurements || {}).map(([item, measurement]) => ({ item, value: measurement }));
    bound.nonconformities = (field.nonconformities || []).map((description, index) => ({ code: String(index + 1), description }));
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
    const latest = labRequests[labRequests.length - 1];
    bound.laboratoryName = latest.laboratoryName;
    bound.sentAt = latest.handover?.sentAt;
    bound.sender = latest.handover?.senderUsername;
    bound.receiver = latest.handover?.receiverName;
    bound.testItems = latest.testItems.map((item, index) => ({ item, method: latest.testMethods?.[index] || '' }));
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
      ...(input.fieldInspection?.id ? { fieldInspectionId: input.fieldInspection.id } : {}),
      sampleIds: (input.samples || []).map((sample) => sample.id),
      labRequestIds: (input.labRequests || []).map((request) => request.id),
      labResultIds: (input.labResults || []).map((result) => result.id),
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
  if (!fileName || /[\\/]/.test(fileName)) throw new Error('Template DOCX PGD không có tên file hợp lệ.');
  const templatePath = path.join(process.cwd(), 'templates', 'pgd', fileName);
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
