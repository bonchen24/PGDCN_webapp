import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdInspectionRequestInput,
  PgdInspectionRequestCreateInput,
  PgdSample,
  PgdLabRequest,
  PgdLabResult,
  PgdResultTemplate,
  PgdInspectionStatus,
  PgdTransitionContext,
  PgdCatalogItem,
  PgdGeneratedDocument,
  PgdDraftWorkspace,
  PgdCalibrationInstrument,
} from './pgdDomain.ts';
import type { CustomerRef, PcnUserAccount } from '../types.ts';
import type { PgdCaseEvent, PgdDossierIndex, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from './pgdArtifacts.ts';
import type {
  PgdCellValue,
  PgdDocumentTemplate,
  PgdDocumentTemplateFormat,
  PgdDocumentTemplateKind,
} from './pgdDocumentTemplates.ts';
import type { PgdDossierDocument, PgdDossierRequirement } from './pgdDossier.ts';
import type { PgdWorkflowTemplate } from './pgdWorkflowTemplate.ts';

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
  inspectionPlans: PgdInspectionPlan[];
  caseEvents: PgdCaseEvent[];
  fieldActivityLogs: PgdFieldActivityLog[];
  labResultReviews: PgdLabResultReview[];
  dossierIndexes: PgdDossierIndex[];
  calibrationInstruments: PgdCalibrationInstrument[];
  workflowTemplates: PgdWorkflowTemplate[];
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

export interface PgdDossierPackageManifest {
  format: 'PGD_DOSSIER_PACKAGE_V1';
  domain: 'pgd';
  dossierCode: string;
  ownerUsername?: string;
  generatedAt: string;
  complete: boolean;
  missingAssetIds: string[];
  missingRequirementCodes: string[];
  checklist: Array<{
    requirementCode: string;
    group: string;
    title: string;
    required: boolean;
    status: 'MISSING' | 'PRESENT' | 'WAIVED';
    currentDocumentId?: string;
    currentDocumentVersion?: number;
    waiverReason?: string;
    waivedByUsername?: string;
    waivedAt?: string;
  }>;
  entries: Array<{
    assetId: string;
    archivePath: string;
    fileName: string;
    sourceCollection: string;
    sourceDocumentId: string;
    version: number;
    checksum: string;
    mimeType: string;
    byteSize: number;
    kind: 'DOSSIER_DOCUMENT' | 'GENERATED_DOCUMENT';
    contextHash?: string;
  }>;
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
    inspectionPlans: Array.isArray(payload?.inspectionPlans) ? payload.inspectionPlans as PgdInspectionPlan[] : [],
    caseEvents: Array.isArray(payload?.caseEvents) ? payload.caseEvents as PgdCaseEvent[] : [],
    fieldActivityLogs: Array.isArray(payload?.fieldActivityLogs) ? payload.fieldActivityLogs as PgdFieldActivityLog[] : [],
    labResultReviews: Array.isArray(payload?.labResultReviews) ? payload.labResultReviews as PgdLabResultReview[] : [],
    dossierIndexes: Array.isArray(payload?.dossierIndexes) ? payload.dossierIndexes as PgdDossierIndex[] : [],
    calibrationInstruments: Array.isArray(payload?.calibrationInstruments) ? payload.calibrationInstruments as PgdCalibrationInstrument[] : [],
    workflowTemplates: Array.isArray(payload?.workflowTemplates) ? payload.workflowTemplates as PgdWorkflowTemplate[] : [],
  };
}

export async function savePgdCalibrationInstrument(instrument: PgdCalibrationInstrument): Promise<PgdCalibrationInstrument> {
  const payload = await request('/api/pgd/calibration-instruments', json(instrument));
  return payload.instrument as PgdCalibrationInstrument;
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

export function getPgdDossierPackageUrl(requestId: string): string {
  return `/api/pgd/requests/${encodeURIComponent(requestId)}/package`;
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

export async function attachPgdGeneratedDocument(requestId: string, input: { documentId: string; requirementCode: string; title?: string }): Promise<PgdDossierDocument> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/dossier-documents/attach-generated`, json(input));
  return payload.dossierDocument as PgdDossierDocument;
}

export async function assignPgdDossierOwner(requestId: string, ownerUsername: string): Promise<PgdInspectionRequest> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/owner`, { method: 'PUT', body: JSON.stringify({ ownerUsername }) });
  return payload.request as PgdInspectionRequest;
}

export async function deletePgdInspection(requestId: string, reason: string, confirmationCode: string): Promise<{ deleted: true; requestId: string; requestCode: string }> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE', body: JSON.stringify({ reason, confirmationCode }) });
  return payload as { deleted: true; requestId: string; requestCode: string };
}

export async function createPgdInspection(input: PgdInspectionRequestCreateInput): Promise<{ request: PgdInspectionRequest; samples: PgdSample[] }> {
  const payload = await request('/api/pgd/requests', json(input));
  return {
    request: payload.request as PgdInspectionRequest,
    samples: Array.isArray(payload.samples) ? payload.samples as PgdSample[] : [],
  };
}

export async function fetchPgdDraftWorkspaces(requestId?: string, options?: { mineOnly?: boolean }): Promise<PgdDraftWorkspace[]> {
  const params = new URLSearchParams();
  if (requestId) params.set('requestId', requestId);
  if (options?.mineOnly) params.set('mineOnly', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  const payload = await request(`/api/pgd/drafts${query}`);
  return Array.isArray(payload?.items) ? payload.items as PgdDraftWorkspace[] : [];
}

export async function savePgdDraftWorkspace(input: Partial<PgdDraftWorkspace> & {
  requestId: string;
  requirementCode: string;
  title: string;
  templateId: string;
  templateKind: string;
  templateVersion: string;
  format: PgdDocumentTemplateFormat;
  cellValues: Record<string, unknown>;
}): Promise<PgdDraftWorkspace> {
  const payload = await request('/api/pgd/drafts', json(input));
  return payload.draft as PgdDraftWorkspace;
}

export async function updatePgdInspectionRequest(requestId: string, patch: Partial<PgdInspectionRequestInput>): Promise<PgdInspectionRequest> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}`, { method: 'PUT', body: JSON.stringify(patch) });
  return payload.request as PgdInspectionRequest;
}

export async function transitionPgdInspection(requestId: string, status: PgdInspectionStatus, context: PgdTransitionContext = {}, reason?: string): Promise<PgdInspectionRequest> {
  const payload = await request(`/api/pgd/requests/${encodeURIComponent(requestId)}/transition`, json({ status, context, ...(reason?.trim() ? { reason: reason.trim() } : {}) }));
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

export async function savePgdInspectionPlan(plan: PgdInspectionPlan): Promise<PgdInspectionPlan> {
  const payload = await request('/api/pgd/inspection-plans', json(plan));
  return payload.plan as PgdInspectionPlan;
}

export async function savePgdCaseEvent(event: PgdCaseEvent): Promise<PgdCaseEvent> {
  const payload = await request('/api/pgd/case-events', json(event));
  return payload.event as PgdCaseEvent;
}

export async function savePgdFieldActivityLog(log: PgdFieldActivityLog): Promise<PgdFieldActivityLog> {
  const payload = await request('/api/pgd/field-activity-logs', json(log));
  return payload.log as PgdFieldActivityLog;
}

export async function savePgdLabResultReview(review: PgdLabResultReview): Promise<PgdLabResultReview> {
  const payload = await request('/api/pgd/lab-result-reviews', json(review));
  return payload.review as PgdLabResultReview;
}

export async function savePgdDossierIndex(index: PgdDossierIndex): Promise<PgdDossierIndex> {
  const payload = await request('/api/pgd/dossier-indexes', json(index));
  return payload.index as PgdDossierIndex;
}

export async function splitPgdSample(input: { requestId: string; sampleCodePrefix: string; description: string; quantity: number; unit?: string; sampledAt?: string; samplingLocation?: string; sampledByUsername?: string; sampleSize?: string; lotQuantity?: number; lotUnit?: string }): Promise<PgdSample[]> {
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
