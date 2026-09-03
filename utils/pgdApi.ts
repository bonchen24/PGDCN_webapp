import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdInspectionRequestInput,
  PgdLabRequest,
  PgdLabResult,
  PgdResultTemplate,
  PgdSample,
  PgdInspectionStatus,
  PgdTransitionContext,
  PgdCatalogItem,
  PgdGeneratedDocument,
} from './pgdDomain.ts';
import type { CustomerRef, PcnUserAccount } from '../types.ts';
import type {
  PgdCellValue,
  PgdDocumentTemplate,
  PgdDocumentTemplateFormat,
  PgdDocumentTemplateKind,
} from './pgdDocumentTemplates.ts';
import type { PgdDossierDocument, PgdDossierRequirement } from './pgdDossier.ts';

export interface PgdBootstrapSnapshot {
  customers: CustomerRef[];
  users: PcnUserAccount[];
  catalog: PgdCatalogItem[];
  templates: PgdResultTemplate[];
  requests: PgdInspectionRequest[];
  assignments: PgdInspectionAssignment[];
  fieldInspections: PgdFieldInspection[];
  samples: PgdSample[];
  labRequests: PgdLabRequest[];
  labResults: PgdLabResult[];
  certificates: PgdInspectionCertificate[];
  reports: PgdInspectionReport[];
  approvals: PgdApprovalStep[];
  documentTemplates: PgdDocumentTemplate[];
  dossierDocuments: PgdDossierDocument[];
  documents: PgdGeneratedDocument[];
}

export interface PgdDocumentGenerationResponse {
  document: PgdGeneratedDocument;
  contentBase64: string;
}

export interface PgdRequestDossierDocumentsResponse {
  dossierDocuments: PgdDossierDocument[];
  requirements: PgdDossierRequirement[];
}

export interface SavePgdDossierDocumentInput {
  requirementCode: string;
  title: string;
  file?: File;
  fileName?: string;
  documentNumber?: string;
  documentDate?: string;
  note?: string;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PGD API trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const headers = init.body instanceof FormData
    ? { ...(init.headers || {}) }
    : { 'Content-Type': 'application/json', ...(init.headers || {}) };
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  return parseResponse(response);
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export async function fetchPgdBootstrap(): Promise<PgdBootstrapSnapshot> {
  const payload = await request('/api/pgd/bootstrap');
  return {
    customers: Array.isArray(payload?.customers) ? payload.customers : [],
    users: Array.isArray(payload?.users) ? payload.users : [],
    catalog: Array.isArray(payload?.catalog) ? payload.catalog : [],
    templates: Array.isArray(payload?.templates) ? payload.templates : [],
    requests: Array.isArray(payload?.requests) ? payload.requests : [],
    assignments: Array.isArray(payload?.assignments) ? payload.assignments : [],
    fieldInspections: Array.isArray(payload?.fieldInspections) ? payload.fieldInspections : [],
    samples: Array.isArray(payload?.samples) ? payload.samples : [],
    labRequests: Array.isArray(payload?.labRequests) ? payload.labRequests : [],
    labResults: Array.isArray(payload?.labResults) ? payload.labResults : [],
    reports: Array.isArray(payload?.reports) ? payload.reports : [],
    certificates: Array.isArray(payload?.certificates) ? payload.certificates : [],
    approvals: Array.isArray(payload?.approvals) ? payload.approvals : [],
    documentTemplates: Array.isArray(payload?.documentTemplates) ? payload.documentTemplates : [],
    dossierDocuments: Array.isArray(payload?.dossierDocuments) ? payload.dossierDocuments : [],
    documents: Array.isArray(payload?.documents) ? payload.documents : [],
  };
}

export async function fetchPgdDocumentTemplates(): Promise<PgdDocumentTemplate[]> {
  const payload = await request('/api/pgd/document-templates');
  return Array.isArray(payload?.templates) ? payload.templates as PgdDocumentTemplate[] : [];
}

export async function savePgdDocumentTemplate(template: PgdDocumentTemplate): Promise<PgdDocumentTemplate> {
  const payload = await request(`/api/pgd/document-templates/${encodeURIComponent(template.id)}`, { method: 'PUT', body: JSON.stringify(template) });
  return payload.template as PgdDocumentTemplate;
}

export async function generatePgdDocument(input: {
  requestId: string;
  kind: PgdDocumentTemplateKind;
  format: PgdDocumentTemplateFormat;
  templateId?: string;
  cellValues: Record<string, unknown> | PgdCellValue[];
}): Promise<PgdDocumentGenerationResponse> {
  const payload = await request('/api/pgd/documents/generate', json(input));
  return payload as PgdDocumentGenerationResponse;
}

export function getPgdDocumentDownloadUrl(documentId: string): string {
  return `/api/pgd/documents/${encodeURIComponent(documentId)}/download`;
}

export function getPgdDossierDocumentDownloadUrl(documentId: string): string {
  return `/api/pgd/dossier-documents/${encodeURIComponent(documentId)}/download`;
}

export function getPgdTemplateSourceUrl(templateId: string): string {
  return `/api/pgd/document-templates/${encodeURIComponent(templateId)}/source`;
}

export async function getPgdDossierDocuments(requestId: string): Promise<PgdRequestDossierDocumentsResponse> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/dossier-documents`);
  return {
    dossierDocuments: Array.isArray(payload?.dossierDocuments) ? payload.dossierDocuments as PgdDossierDocument[] : [],
    requirements: Array.isArray(payload?.requirements) ? payload.requirements as PgdDossierRequirement[] : [],
  };
}

export async function savePgdDossierDocument(requestId: string, input: SavePgdDossierDocumentInput): Promise<PgdDossierDocument> {
  const form = new FormData();
  form.set('requirementCode', input.requirementCode);
  form.set('title', input.title);
  if (input.file) form.set('file', input.file);
  if (input.fileName) form.set('fileName', input.fileName);
  if (input.documentNumber) form.set('documentNumber', input.documentNumber);
  if (input.documentDate) form.set('documentDate', input.documentDate);
  if (input.note) form.set('note', input.note);
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/dossier-documents`, { method: 'POST', body: form });
  return payload.dossierDocument as PgdDossierDocument;
}

export async function createPgdInspection(input: PgdInspectionRequestInput): Promise<PgdInspectionRequest> {
  const payload = await request('/api/pgd/requests', json(input));
  return payload.request as PgdInspectionRequest;
}

export async function transitionPgdInspection(requestId: string, status: PgdInspectionStatus, context: PgdTransitionContext = {}): Promise<PgdInspectionRequest> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/transition`, json({ status, context }));
  return payload.request as PgdInspectionRequest;
}

export async function savePgdAssignment(assignment: PgdInspectionAssignment): Promise<PgdInspectionAssignment> {
  const payload = await request('/api/pgd/assignments', json(assignment));
  return payload.assignment as PgdInspectionAssignment;
}

export async function savePgdFieldInspection(inspection: PgdFieldInspection): Promise<PgdFieldInspection> {
  const payload = await request('/api/pgd/field-inspections', json(inspection));
  return payload.inspection as PgdFieldInspection;
}

export async function splitPgdSample(input: { requestId: string; sampleCodePrefix: string; description: string; quantity: number; unit?: string }): Promise<PgdSample[]> {
  const payload = await request('/api/pgd/samples/split', json(input));
  return Array.isArray(payload.samples) ? payload.samples as PgdSample[] : [];
}

export async function destroyPgdSample(sampleId: string, note: string): Promise<PgdSample> {
  const payload = await request(`/api/pgd/samples/${encodeURIComponent(sampleId)}/destroy`, json({ note }));
  return payload.sample as PgdSample;
}

export async function savePgdLabRequest(labRequest: PgdLabRequest): Promise<PgdLabRequest> {
  const payload = await request('/api/pgd/lab-requests', json(labRequest));
  return payload.labRequest as PgdLabRequest;
}

export async function savePgdLabResult(result: PgdLabResult): Promise<PgdLabResult> {
  const payload = await request('/api/pgd/lab-results', json(result));
  return payload.result as PgdLabResult;
}

export async function savePgdCertificate(certificate: PgdInspectionCertificate): Promise<PgdInspectionCertificate> {
  const payload = await request('/api/pgd/certificates', json(certificate));
  return payload.certificate as PgdInspectionCertificate;
}

export async function savePgdReport(report: PgdInspectionReport): Promise<PgdInspectionReport> {
  const payload = await request('/api/pgd/reports', json(report));
  return payload.report as PgdInspectionReport;
}

export async function approvePgdStep(step: PgdApprovalStep): Promise<{ approval: PgdApprovalStep; request: PgdInspectionRequest; certificate?: PgdInspectionCertificate }> {
  const payload = await request('/api/pgd/approvals', json(step));
  return payload as { approval: PgdApprovalStep; request: PgdInspectionRequest; certificate?: PgdInspectionCertificate };
}

// --- End of pgdApi.ts ---
