import { create } from 'zustand';

import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionRequest,
  PgdInspectionReport,
  PgdInspectionRequestInput,
  PgdInspectionRequestCreateInput,
  PgdLabRequest,
  PgdLabResult,
  PgdResultTemplate,
  PgdSample,
  PgdInspectionStatus,
  PgdTransitionContext,
  PgdCatalogItem,
  PgdGeneratedDocument,
  PgdCalibrationInstrument,
} from './utils/pgdDomain.ts';
import type { PgdCaseEvent, PgdDossierIndex, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from './utils/pgdArtifacts.ts';
import type { PgdDocumentTemplate } from './utils/pgdDocumentTemplates.ts';
import type { PgdDossierDocument, PgdDossierRequirement } from './utils/pgdDossier.ts';
import type { PgdWorkflowTemplate } from './utils/pgdWorkflowTemplate.ts';
import type { CustomerRef, PcnUserAccount } from './types.ts';
import {
  approvePgdStep,
  assignPgdDossierOwner,
  attachPgdGeneratedDocument,
  createPgdInspection,
  updatePgdInspectionRequest,
  deletePgdInspection,
  destroyPgdSample as destroyPgdSampleApi,
  fetchPgdBootstrap,
  getPgdDossierDocuments,
  savePgdAssignment,
  savePgdCertificate,
  savePgdDossierDocument as savePgdDossierDocumentApi,
  savePgdFieldInspection,
  savePgdInspectionPlan,
  savePgdCaseEvent,
  savePgdFieldActivityLog,
  savePgdLabResultReview,
  savePgdDossierIndex,
  savePgdLabRequest,
  savePgdLabResult,
  savePgdCalibrationInstrument,
  savePgdReport,
  splitPgdSample as splitPgdSampleApi,
  transitionPgdInspection,
  generatePgdDocument,
  savePgdDocumentTemplate,
} from './utils/pgdApi.ts';
import {
  createPgdWorkflowRevision,
  createPgdWorkflowTemplate,
  fetchPgdWorkflowTemplates,
  publishPgdWorkflowTemplate,
  retirePgdWorkflowTemplate,
  updatePgdWorkflowTemplate,
} from './utils/pgdWorkflowTemplateApi.ts';

interface PgdStoreState {
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
  reports: PgdInspectionReport[];
  certificates: PgdInspectionCertificate[];
  approvals: PgdApprovalStep[];
  documentTemplates: PgdDocumentTemplate[];
  workflowTemplates: PgdWorkflowTemplate[];
  dossierDocuments: PgdDossierDocument[];
  documents: PgdGeneratedDocument[];
  inspectionPlans: PgdInspectionPlan[];
  caseEvents: PgdCaseEvent[];
  fieldActivityLogs: PgdFieldActivityLog[];
  labResultReviews: PgdLabResultReview[];
  dossierIndexes: PgdDossierIndex[];
  calibrationInstruments: PgdCalibrationInstrument[];
  isLoading: boolean;
  isLoaded: boolean;
  error?: string;
  reset: () => void;
  load: (force?: boolean) => Promise<void>;
  createRequest: (input: PgdInspectionRequestCreateInput) => Promise<PgdInspectionRequest>;
  updateRequest: (requestId: string, patch: Partial<PgdInspectionRequestInput>) => Promise<PgdInspectionRequest>;
  deleteRequest: (requestId: string, reason: string, confirmationCode: string) => Promise<Awaited<ReturnType<typeof deletePgdInspection>>>;
  transitionRequest: (requestId: string, status: PgdInspectionStatus, context?: PgdTransitionContext, reason?: string) => Promise<PgdInspectionRequest>;
  saveAssignment: (assignment: PgdInspectionAssignment) => Promise<PgdInspectionAssignment>;
  saveFieldInspection: (inspection: PgdFieldInspection) => Promise<PgdFieldInspection>;
  saveInspectionPlan: (plan: PgdInspectionPlan) => Promise<PgdInspectionPlan>;
  saveCaseEvent: (event: PgdCaseEvent) => Promise<PgdCaseEvent>;
  saveFieldActivityLog: (log: PgdFieldActivityLog) => Promise<PgdFieldActivityLog>;
  saveLabResultReview: (review: PgdLabResultReview) => Promise<PgdLabResultReview>;
  saveDossierIndex: (index: PgdDossierIndex) => Promise<PgdDossierIndex>;
  fetchDossierDocuments: (requestId: string) => Promise<{ dossierDocuments: PgdDossierDocument[]; requirements: PgdDossierRequirement[] }>;
  saveDossierDocument: (requestId: string, input: Parameters<typeof savePgdDossierDocumentApi>[1]) => Promise<PgdDossierDocument>;
  assignOwner: (requestId: string, ownerUsername: string) => Promise<PgdInspectionRequest>;
  attachGeneratedDocument: (requestId: string, input: { documentId: string; requirementCode: string; title?: string }) => Promise<PgdDossierDocument>;
  splitSample: (input: { requestId: string; sampleCodePrefix: string; description: string; quantity: number; unit?: string }) => Promise<PgdSample[]>;
  destroySample: (sampleId: string, note: string) => Promise<PgdSample>;
  saveLabRequest: (labRequest: PgdLabRequest) => Promise<PgdLabRequest>;
  saveLabResult: (result: PgdLabResult) => Promise<PgdLabResult>;
  saveReport: (report: PgdInspectionReport) => Promise<PgdInspectionReport>;
  saveCertificate: (certificate: PgdInspectionCertificate) => Promise<PgdInspectionCertificate>;
  saveCalibrationInstrument: (instrument: PgdCalibrationInstrument) => Promise<PgdCalibrationInstrument>;
  approveStep: (step: PgdApprovalStep) => Promise<void>;
  saveDocumentTemplate: (template: PgdDocumentTemplate) => Promise<PgdDocumentTemplate>;
  createWorkflowTemplate: (template: PgdWorkflowTemplate) => Promise<PgdWorkflowTemplate>;
  updateWorkflowTemplate: (templateId: string, template: PgdWorkflowTemplate, expectedUpdatedAt?: string) => Promise<PgdWorkflowTemplate>;
  createWorkflowRevision: (templateId: string, template: PgdWorkflowTemplate) => Promise<PgdWorkflowTemplate>;
  publishWorkflowTemplate: (templateId: string) => Promise<PgdWorkflowTemplate>;
  retireWorkflowTemplate: (templateId: string, reason: string) => Promise<PgdWorkflowTemplate>;
  generateDocument: (input: Parameters<typeof generatePgdDocument>[0]) => Promise<Awaited<ReturnType<typeof generatePgdDocument>>>;
}

const emptyState = {
  customers: [], users: [],
  catalog: [], templates: [], requests: [], assignments: [], fieldInspections: [], samples: [],
  labRequests: [], labResults: [], reports: [], certificates: [], approvals: [], isLoading: false, isLoaded: false,
  documentTemplates: [], dossierDocuments: [], documents: [],
  workflowTemplates: [],
  inspectionPlans: [], caseEvents: [], fieldActivityLogs: [], labResultReviews: [], dossierIndexes: [],
  calibrationInstruments: [],
};

function replaceOne<T extends { id: string }>(items: T[], next: T): T[] {
  return [next, ...items.filter((item) => item.id !== next.id)];
}

function mergeRequest(set: (updater: (state: PgdStoreState) => Partial<PgdStoreState>) => void, request: PgdInspectionRequest): void {
  set((state) => ({ requests: replaceOne(state.requests, request) }));
}

export const usePgdStore = create<PgdStoreState>((set, get) => ({
  ...emptyState,
  reset: () => set({ ...emptyState }),
  load: async (force = false) => {
    if (get().isLoading || (get().isLoaded && !force)) return;
    set({ isLoading: true, error: undefined });
    try {
      const snapshot = await fetchPgdBootstrap();
      set({ ...snapshot, isLoading: false, isLoaded: true });
    } catch (error: any) {
      const message = error?.message || String(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },
  createRequest: async (input) => {
    const result = await createPgdInspection(input);
    mergeRequest(set, result.request);
    if (result.samples.length > 0) {
      set((state) => ({ samples: [...state.samples.filter((sample) => !result.samples.some((created) => created.id === sample.id)), ...result.samples] }));
    }
    return result.request;
  },
  updateRequest: async (requestId, patch) => {
    const request = await updatePgdInspectionRequest(requestId, patch);
    mergeRequest(set, request);
    return request;
  },
  deleteRequest: async (requestId, reason, confirmationCode) => {
    const deleted = await deletePgdInspection(requestId, reason, confirmationCode);
    const removeRelated = <T,>(items: T[]) => items.filter((item) => String((item as { requestId?: string }).requestId || '') !== requestId);
    set((state) => ({
      requests: state.requests.filter((request) => request.id !== requestId),
      assignments: removeRelated(state.assignments),
      fieldInspections: removeRelated(state.fieldInspections),
      samples: removeRelated(state.samples),
      labRequests: removeRelated(state.labRequests),
      labResults: removeRelated(state.labResults),
      reports: removeRelated(state.reports),
      certificates: removeRelated(state.certificates),
      approvals: removeRelated(state.approvals),
      dossierDocuments: removeRelated(state.dossierDocuments),
      documents: removeRelated(state.documents),
      inspectionPlans: removeRelated(state.inspectionPlans),
      caseEvents: removeRelated(state.caseEvents),
      fieldActivityLogs: removeRelated(state.fieldActivityLogs),
      labResultReviews: removeRelated(state.labResultReviews),
      dossierIndexes: removeRelated(state.dossierIndexes),
    }));
    return deleted;
  },
  transitionRequest: async (requestId, status, context, reason) => {
    const request = await transitionPgdInspection(requestId, status, context, reason);
    mergeRequest(set, request);
    return request;
  },
  saveAssignment: async (assignment) => {
    const next = await savePgdAssignment(assignment);
    set((state) => ({
      assignments: replaceOne(state.assignments, next),
      requests: state.requests.map((request) => request.id === next.requestId ? { ...request, assignmentId: next.id, updatedAt: request.updatedAt } : request),
    }));
    return next;
  },
  saveFieldInspection: async (inspection) => {
    const next = await savePgdFieldInspection(inspection);
    set((state) => ({
      fieldInspections: replaceOne(state.fieldInspections, next),
      requests: state.requests.map((request) => request.id === next.requestId ? { ...request, fieldInspectionId: next.id } : request),
    }));
    return next;
  },
  saveInspectionPlan: async (plan) => {
    const next = await savePgdInspectionPlan(plan);
    set((state) => ({ inspectionPlans: replaceOne(state.inspectionPlans, next), requests: state.requests.map((request) => request.id === next.requestId ? { ...request, inspectionPlanId: next.id } : request) }));
    return next;
  },
  saveCaseEvent: async (event) => {
    const next = await savePgdCaseEvent(event);
    set((state) => ({ caseEvents: replaceOne(state.caseEvents, next), requests: state.requests.map((request) => request.id === next.requestId ? { ...request, caseEventIds: [...new Set([...(request.caseEventIds || []), next.id])] } : request) }));
    return next;
  },
  saveFieldActivityLog: async (log) => {
    const next = await savePgdFieldActivityLog(log);
    set((state) => ({ fieldActivityLogs: replaceOne(state.fieldActivityLogs, next), requests: state.requests.map((request) => request.id === next.requestId ? { ...request, fieldActivityLogIds: [...new Set([...(request.fieldActivityLogIds || []), next.id])] } : request) }));
    return next;
  },
  saveLabResultReview: async (review) => {
    const next = await savePgdLabResultReview(review);
    set((state) => ({ labResultReviews: replaceOne(state.labResultReviews, next), requests: state.requests.map((request) => request.id === next.requestId ? { ...request, labResultReviewId: next.id } : request) }));
    return next;
  },
  saveCalibrationInstrument: async (instrument) => {
    const next = await savePgdCalibrationInstrument(instrument);
    set((state) => ({ calibrationInstruments: replaceOne(state.calibrationInstruments, next) }));
    return next;
  },
  saveDossierIndex: async (index) => {
    const next = await savePgdDossierIndex(index);
    set((state) => ({ dossierIndexes: replaceOne(state.dossierIndexes, next), requests: state.requests.map((request) => request.id === next.requestId ? { ...request, dossierIndexId: next.id } : request) }));
    return next;
  },
  fetchDossierDocuments: async (requestId) => {
    const result = await getPgdDossierDocuments(requestId);
    set((state) => ({
      dossierDocuments: [
        ...result.dossierDocuments,
        ...state.dossierDocuments.filter((item) => item.requestId !== requestId),
      ],
    }));
    return result;
  },
  saveDossierDocument: async (requestId, input) => {
    const next = await savePgdDossierDocumentApi(requestId, input);
    set((state) => ({ dossierDocuments: replaceOne(state.dossierDocuments, next) }));
    return next;
  },
  assignOwner: async (requestId, ownerUsername) => {
    const next = await assignPgdDossierOwner(requestId, ownerUsername);
    mergeRequest(set, next);
    return next;
  },
  attachGeneratedDocument: async (requestId, input) => {
    const next = await attachPgdGeneratedDocument(requestId, input);
    set((state) => ({ dossierDocuments: replaceOne(state.dossierDocuments, next) }));
    return next;
  },
  splitSample: async (input) => {
    const next = await splitPgdSampleApi(input);
    set((state) => ({
      samples: [...next, ...state.samples.filter((item) => !next.some((candidate) => candidate.id === item.id))],
      requests: state.requests.map((request) => request.id === input.requestId ? { ...request, sampleIds: [...new Set([...request.sampleIds, ...next.map((item) => item.id)])] } : request),
    }));
    return next;
  },
  destroySample: async (sampleId, note) => {
    const next = await destroyPgdSampleApi(sampleId, note);
    set((state) => ({ samples: replaceOne(state.samples, next) }));
    return next;
  },
  saveLabRequest: async (labRequest) => {
    const next = await savePgdLabRequest(labRequest);
    set((state) => ({
      labRequests: replaceOne(state.labRequests, next),
      samples: state.samples.map((sample) => sample.id === next.sampleId && next.handover
        ? { ...sample, handedOverAt: next.handover.sentAt, laboratoryName: next.laboratoryName }
        : sample),
      requests: state.requests.map((request) => request.id === next.requestId ? { ...request, labRequestIds: [...new Set([...request.labRequestIds, next.id])] } : request),
    }));
    return next;
  },
  saveLabResult: async (result) => {
    const next = await savePgdLabResult(result);
    set((state) => ({
      labResults: replaceOne(state.labResults, next),
      labRequests: state.labRequests.map((labRequest) => labRequest.id === next.labRequestId
        ? { ...labRequest, status: 'RESULT_RECEIVED', resultId: next.id }
        : labRequest),
    }));
    return next;
  },
  saveReport: async (report) => {
    const next = await savePgdReport(report);
    set((state) => ({ reports: replaceOne(state.reports, next) }));
    return next;
  },
  saveCertificate: async (certificate) => {
    const next = await savePgdCertificate(certificate);
    set((state) => ({ certificates: replaceOne(state.certificates, next) }));
    return next;
  },
  approveStep: async (step) => {
    const result = await approvePgdStep(step);
    set((state) => ({
      approvals: replaceOne(state.approvals, result.approval),
      requests: result.request ? replaceOne(state.requests, result.request) : state.requests,
      certificates: result.certificate ? replaceOne(state.certificates, result.certificate) : state.certificates,
    }));
  },
  saveDocumentTemplate: async (template) => {
    const next = await savePgdDocumentTemplate(template);
    set((state) => ({ documentTemplates: replaceOne(state.documentTemplates, next) }));
    return next;
  },
  createWorkflowTemplate: async (template) => {
    const result = await createPgdWorkflowTemplate(template);
    set((state) => ({ workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)] }));
    return result.template;
  },
  updateWorkflowTemplate: async (templateId, template, expectedUpdatedAt) => {
    const result = await updatePgdWorkflowTemplate(templateId, template, expectedUpdatedAt);
    set((state) => ({ workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)] }));
    return result.template;
  },
  createWorkflowRevision: async (templateId, template) => {
    const result = await createPgdWorkflowRevision(templateId, template);
    set((state) => ({ workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)] }));
    return result.template;
  },
  publishWorkflowTemplate: async (templateId) => {
    const result = await publishPgdWorkflowTemplate(templateId);
    set((state) => ({ workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)] }));
    return result.template;
  },
  retireWorkflowTemplate: async (templateId, reason) => {
    const result = await retirePgdWorkflowTemplate(templateId, reason);
    set((state) => ({ workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)] }));
    return result.template;
  },
  generateDocument: async (input) => {
    const result = await generatePgdDocument(input);
    set((state) => ({ documents: replaceOne(state.documents, result.document) }));
    return result;
  },
}));

// --- End of store-pgd.ts ---
