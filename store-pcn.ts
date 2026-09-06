import { create } from 'zustand';

import type {
  CertificationDossier,
  CertificationProposal,
  CustomerRef,
  IssuancePackage,
  OutboundLabRequest,
  PcnApprovalDecision,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierAttachment,
  PcnGeneratedDocument,
  PcnGeneratedDocumentFormat,
  PcnGeneratedDocumentKind,
  ReturnedTestResult,
  PcnCertificationField,
  PcnUserAccount,
  PcnSampleFlowEvent,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnTemplateDefinition,
  PcnOfficialGeneratedDocument,
  PcnTemplateReviewAction,
  PcnTemplateAnnotationMapping,
  PcnSignerDelegation,
  PcnQualityDocument,
  AppNotification,
  PcnDossierWorkflowTask,
  PcnWorkflowTemplate,
} from './types';
import { fetchCollection } from './utils/postgresApi';
import { mergeNotifications } from './utils/notificationEvents';
import { normalizeCustomerRecord } from './utils/customerRecord';
import { DEFAULT_PCN_CERTIFICATION_FIELDS, isPcnDossierTransitionAllowed, mergePcnCertificationFields } from './utils/pcnWorkflow';
import { mergePcnTemplateCatalog, mergePcnTemplateRuntimeProjection } from './utils/pcnTemplateCatalog';
import { generatePcnOfficialDocuments, preflightPcnOfficialDocuments } from './utils/pcnOfficialDocumentApi';
import type { PcnOfficialPreflightResponse } from './utils/pcnOfficialDocumentApi';
import { reviewPcnTemplate as reviewPcnTemplateApi, uploadPcnTemplate as uploadPcnTemplateApi } from './utils/pcnTemplateApi';
import { annotatePcnTemplate as annotatePcnTemplateApi } from './utils/pcnTemplateAnnotationApi';
import { getPcnDocumentId, mergePcnCustomers } from './utils/pcnStorePolicy';
import { getPcnIssuanceReadiness } from './utils/pcnIssuance';
import { actOnPcnApprovalStep, archivePcnIssuance, attachPcnIssuanceFile, createPcnIssuanceBundle, deliverPcnIssuance, withdrawPcnIssuance } from './utils/pcnIssuanceApi';
import { updatePcnDossierRetention } from './utils/pcnRetentionApi';
import { submitPcnReturnedResult } from './utils/pcnResultApi';
import { attachPcnReturnedResultFile } from './utils/pcnResultFileApi';
import { markPcnProposalConverted } from './utils/pcnPolicy';
import { uploadPcnFile } from './utils/pcnFileApi';
import { ensurePcnDossierCustomerSnapshot } from './utils/pcnDossierPolicy';
import { createPcnIntake } from './utils/pcnIntakeApi';
import { createPcnWorkflowRevision, createPcnWorkflowTemplate, fetchPcnWorkflowTemplates, publishPcnWorkflowTemplate, retirePcnWorkflowTemplate, updatePcnWorkflowTemplate } from './utils/pcnWorkflowTemplateApi';
import { completePcnWorkflowTask, returnPcnWorkflowTask, startPcnWorkflowTask } from './utils/pcnWorkflowTaskApi';
import { updatePcnProposal, type PcnProposalUpdateInput } from './utils/pcnProposalApi';
import { deletePcnDossier, updatePcnDossier, type PcnDossierUpdateInput } from './utils/pcnDossierApi';
import { confirmPcnGeneratedDocumentIntoChecklist, generateAndAttachPcnDossierNodeDocument, removeCurrentPcnDossierDocument, uploadPcnDossierDocument, waivePcnDossierDocument } from './utils/pcnDossierDocumentApi';
import { generatePcnDossierDocuments, preflightPcnDossierDocuments } from './utils/pcnDocumentGenerationApi';
import type { PcnDossierDocumentContext } from './utils/pcnDocumentGeneration';
import { createPcnSampleLot as createPcnSampleLotApi, updatePcnSampleRoute as updatePcnSampleRouteApi } from './utils/pcnSampleApi';
import { createPcnLabRequest as createPcnLabRequestApi, dispatchPcnLabRequest, reconcilePcnLabRequest, updatePcnLabRequest as updatePcnLabRequestApi, type PcnLabRequestMutationResponse } from './utils/pcnLabRequestApi';
import { retryPcnSampleRequestBundleDispatch, savePcnSampleRequestBundle, sendPcnSampleRequestBundle, type PcnSampleRequestBundleMutationResponse } from './utils/pcnSampleRequestBundleApi';
import { createPcnSignerDelegation, fetchPcnSignerDelegations, issuePcnIssuance, revokePcnSignerDelegation, type PcnSignerDelegationInput } from './utils/pcnSignerDelegationApi';
import { assertPcnSignerAuthorized } from './utils/pcnSignerAuthorization';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, mergePcnDocumentRequirements } from './utils/pcnDossierDocuments';
import { createPcnUser, deletePcnUser as deletePcnUserApi, fetchPcnDepartmentRoles, fetchPcnUsers, resetPcnUserPassword, updatePcnUser, type PcnDepartmentRole, type PcnUserInput } from './utils/pcnUserApi';
import { buildPcnQualityDocument } from './utils/pcnQualityDocuments';
import { attachPcnQualityDocumentFile, createPcnQualityDocument, updatePcnQualityDocument } from './utils/pcnQualityDocumentApi';
import { createPcnCustomer, deletePcnCustomer, updatePcnCustomer } from './utils/pcnCustomerApi';
import type { PcnSampleLotDraft, PcnSampleRouteUpdate } from './utils/pcnSampleFlow';
import type { ActivityLog } from './types';
import { assertPcnClientAdmin, assertPcnClientMutationAllowed, assertPcnPersonnelAdmin, getPcnWorkflowTemplateMutationDenial } from './utils/pcnRbac';
import { filterPcnFutureWorkRelations, filterPcnFutureWorkSnapshot } from './utils/pcnActiveData';
import { usePcnSessionStore } from './utils/pcnSessionState';
import {
  clearPcnNotifications as clearPcnNotificationsApi,
  fetchPcnNotifications,
  markAllPcnNotificationsRead as markAllPcnNotificationsReadApi,
  markPcnNotificationRead as markPcnNotificationReadApi,
} from './utils/pcnNotificationApi';

interface PcnStoreState {
  fields: PcnCertificationField[];
  templates: PcnTemplateDefinition[];
  documentRequirements: PcnDocumentRequirement[];
  dossierDocuments: PcnDossierDocument[];
  dossierAttachments: PcnDossierAttachment[];
  generatedDocuments: PcnGeneratedDocument[];
  officialDocuments: PcnOfficialGeneratedDocument[];
  customers: CustomerRef[];
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  approvalSteps: PcnApprovalStep[];
  issuancePackages: IssuancePackage[];
  activityLogs: ActivityLog[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  sampleFlowEvents: PcnSampleFlowEvent[];
  sampleRequestBundles: PcnSampleRequestBundle[];
  users: PcnUserAccount[];
  departmentRoles: PcnDepartmentRole[];
  signerDelegations: PcnSignerDelegation[];
  qualityDocuments: PcnQualityDocument[];
  workflowTemplates: PcnWorkflowTemplate[];
  workflowTasks: PcnDossierWorkflowTask[];
  notifications: AppNotification[];
  isLoading: boolean;
  isLoaded: boolean;
  reset: () => void;
  load: (force?: boolean) => Promise<void>;
  addCustomer: (customer: Partial<CustomerRef>) => Promise<void>;
  updateCustomer: (customerCodeOrName: string, updates: Partial<CustomerRef>) => Promise<void>;
  deleteCustomer: (customerCodeOrName: string) => Promise<void>;
  addProposal: (proposal: CertificationProposal) => Promise<void>;
  updateProposal: (proposalId: string, updates: PcnProposalUpdateInput) => Promise<void>;
  addDossier: (dossier: CertificationDossier) => Promise<void>;
  createWorkflowTemplate: (template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  updateWorkflowTemplate: (templateId: string, template: PcnWorkflowTemplate, expectedUpdatedAt?: string) => Promise<PcnWorkflowTemplate>;
  createWorkflowRevision: (templateId: string, template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  publishWorkflowTemplate: (templateId: string) => Promise<PcnWorkflowTemplate>;
  retireWorkflowTemplate: (templateId: string, reason: string) => Promise<PcnWorkflowTemplate>;
  startWorkflowTask: (dossierId: string, taskId: string) => Promise<void>;
  completeWorkflowTask: (dossierId: string, taskId: string, expectedCycleNo?: number) => Promise<void>;
  returnWorkflowTask: (dossierId: string, taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  uploadDossierDocument: (dossierId: string, requirementId: string, file: File) => Promise<void>;
  waiveDossierDocument: (dossierId: string, requirementId: string, reason: string) => Promise<void>;
  removeCurrentDossierDocument: (dossierId: string, requirementId: string) => Promise<void>;
  generateAndAttachDossierNodeDocument: (dossierId: string, nodeId: string, requirementId: string) => Promise<void>;
  confirmGeneratedDocument: (dossierId: string, generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => Promise<void>;
  updateDossier: (dossierId: string, updates: PcnDossierUpdateInput) => Promise<void>;
  deleteDossier: (dossierId: string, reason: string, confirmationCode: string) => Promise<void>;
  preflightDossierDocuments: (dossierId: string, kind?: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => Promise<PcnDossierDocumentContext>;
  generateDossierDocuments: (dossierId: string, kind?: PcnGeneratedDocumentKind, formats?: PcnGeneratedDocumentFormat[], sampleRouteId?: string, expectedContextHash?: string, labRequestId?: string) => Promise<PcnGeneratedDocument[]>;
  preflightOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[]) => Promise<PcnOfficialPreflightResponse>;
  generateOfficialDocuments: (issuanceId: string, formats?: PcnGeneratedDocumentFormat[], expectedContextHash?: string) => Promise<PcnOfficialGeneratedDocument[]>;
  reviewPcnTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<PcnTemplateDefinition>;
  annotatePcnTemplate: (templateId: string, mappings: PcnTemplateAnnotationMapping[]) => Promise<PcnTemplateDefinition>;
  uploadPcnTemplate: (templateId: string, file: File) => Promise<PcnTemplateDefinition>;
  addLabRequest: (request: OutboundLabRequest) => Promise<void>;
  updateLabRequest: (requestId: string, status: OutboundLabRequest['status'], updates?: Partial<Pick<OutboundLabRequest, 'handoverAt' | 'receivedAt' | 'handoverNote' | 'handoverDocumentId' | 'handoverDetails' | 'sampleIssue' | 'returnedResultId'>>, idempotencyKey?: string) => Promise<void>;
  dispatchLabRequest: (requestId: string) => Promise<void>;
  reconcileLabRequest: (requestId: string) => Promise<void>;
  addReturnedResult: (result: ReturnedTestResult) => Promise<void>;
  attachResultFile: (resultId: string, file: File) => Promise<void>;
  createIssuanceBundle: (dossierId: string, idempotencyKey?: string) => Promise<void>;
  actOnApprovalStep: (stepId: string, decision: PcnApprovalDecision, comment?: string, idempotencyKey?: string) => Promise<void>;
  issuePackage: (issuanceId: string, input: { issuanceNumber: string; signerUsername: string; issuedAt?: string }, idempotencyKey?: string) => Promise<void>;
  deliverPackage: (issuanceId: string, input: { recipient: string; deliveredAt?: string; note?: string }, idempotencyKey?: string) => Promise<void>;
  archivePackage: (issuanceId: string, idempotencyKey?: string) => Promise<void>;
  withdrawPackage: (issuanceId: string, reason: string, idempotencyKey?: string) => Promise<void>;
  setDossierLegalHold: (dossierId: string, input: { legalHold: boolean; reason?: string }) => Promise<void>;
  attachIssuanceFile: (issuanceId: string, file: File) => Promise<void>;
  addPcnUser: (input: PcnUserInput) => Promise<void>;
  updatePcnUser: (username: string, input: Omit<PcnUserInput, 'username'>) => Promise<void>;
  deletePcnUser: (username: string) => Promise<void>;
  resetPcnUserPassword: (username: string, password: string) => Promise<void>;
  addSignerDelegation: (input: PcnSignerDelegationInput) => Promise<void>;
  revokeSignerDelegation: (id: string) => Promise<void>;
  addQualityDocument: (input: Parameters<typeof buildPcnQualityDocument>[0], file?: File) => Promise<void>;
  updateQualityDocument: (id: string, updates: Partial<Omit<PcnQualityDocument, 'id'>>, file?: File) => Promise<void>;
  retireQualityDocument: (id: string) => Promise<void>;
  refreshPcnNotifications: () => Promise<void>;
  markPcnNotificationAsRead: (id: string) => Promise<void>;
  markAllPcnNotificationsAsRead: () => Promise<void>;
  clearPcnNotifications: () => Promise<void>;
  addSampleLot: (draft: PcnSampleLotDraft) => Promise<void>;
  updateSampleRoute: (routeId: string, status: PcnSampleRoute['status'], update?: PcnSampleRouteUpdate) => Promise<void>;
  saveSampleRequestBundle: (draft: PcnSampleRequestBundleDraft) => Promise<PcnSampleRequestBundle>;
  sendSampleRequestBundle: (bundleId: string) => Promise<PcnSampleRequestBundle>;
  retrySampleRequestBundleDispatch: (bundleId: string, dispatchId: string) => Promise<PcnSampleRequestBundle>;
}

function mergePcnLabMutationState(state: PcnStoreState, result: PcnLabRequestMutationResponse): Partial<PcnStoreState> {
  const mergeOne = <T extends { id: string }>(items: T[], next?: T): T[] => next ? [next, ...items.filter((item) => item.id !== next.id)] : items;
  return {
    labRequests: mergeOne(state.labRequests, result.request),
    dossiers: mergeOne(state.dossiers, result.dossier),
    sampleLots: mergeOne(state.sampleLots, result.lot),
    sampleRoutes: mergeOne(state.sampleRoutes, result.route),
    sampleFlowEvents: mergeOne(state.sampleFlowEvents, result.event),
    activityLogs: result.activityLogs.length > 0
      ? [...result.activityLogs, ...state.activityLogs.filter((item) => !result.activityLogs.some((next) => next.id === item.id))]
      : state.activityLogs,
  };
}

function mergePcnSampleRequestBundleMutationState(state: PcnStoreState, result: PcnSampleRequestBundleMutationResponse): Partial<PcnStoreState> {
  const mergeMany = <T extends { id: string }>(current: T[], incoming: T[] = []): T[] => [
    ...incoming,
    ...current.filter((item) => !incoming.some((next) => next.id === item.id)),
  ];
  return {
    sampleRequestBundles: mergeMany(state.sampleRequestBundles, result.bundle ? [result.bundle] : []),
    sampleLots: mergeMany(state.sampleLots, result.lots),
    sampleItems: mergeMany(state.sampleItems, result.items),
    sampleRoutes: mergeMany(state.sampleRoutes, result.routes),
    sampleFlowEvents: mergeMany(state.sampleFlowEvents, result.events),
    labRequests: mergeMany(state.labRequests, result.labRequests),
    activityLogs: mergeMany(state.activityLogs, result.activityLogs),
  };
}

function byUpdatedAt<T extends { updatedAt?: string }>(left: T, right: T): number {
  return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
}

function mergeManyById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  return [...incoming, ...current.filter((item) => !incoming.some((next) => next.id === item.id))];
}

function assertPcnStoreMutationAllowed(): void {
  assertPcnClientMutationAllowed(usePcnSessionStore.getState().currentUser);
}

function assertPcnStoreAdminMutationAllowed(): void {
  assertPcnClientAdmin(usePcnSessionStore.getState().currentUser);
}

function assertPcnStorePersonnelMutationAllowed(): void {
  assertPcnPersonnelAdmin(usePcnSessionStore.getState().currentUser);
}

function assertPcnStoreWorkflowManagerMutationAllowed(): void {
  const denial = getPcnWorkflowTemplateMutationDenial(usePcnSessionStore.getState().currentUser);
  if (denial) throw new Error(denial);
}

function mergePcnWorkflowTaskMutationState(state: PcnStoreState, result: { task: PcnDossierWorkflowTask; tasks?: PcnDossierWorkflowTask[]; dossier?: CertificationDossier; activityLog?: ActivityLog }): Partial<PcnStoreState> {
  const incoming = result.tasks?.length ? result.tasks : [result.task];
  return {
    workflowTasks: mergeManyById(state.workflowTasks, incoming),
    ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
    ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
  };
}

export const usePcnStore = create<PcnStoreState>((set, get) => ({
  fields: DEFAULT_PCN_CERTIFICATION_FIELDS,
  templates: [],
  documentRequirements: DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
  dossierDocuments: [],
  dossierAttachments: [],
  generatedDocuments: [],
  officialDocuments: [],
  customers: [],
  proposals: [],
  dossiers: [],
  labRequests: [],
  returnedResults: [],
  approvalSteps: [],
  issuancePackages: [],
  activityLogs: [],
  sampleLots: [],
  sampleItems: [],
  sampleRoutes: [],
  sampleFlowEvents: [],
  sampleRequestBundles: [],
  users: [],
  departmentRoles: [],
  signerDelegations: [],
  qualityDocuments: [],
  workflowTemplates: [],
  workflowTasks: [],
  notifications: [],
  isLoading: false,
  isLoaded: false,

  reset: () => set({
    fields: DEFAULT_PCN_CERTIFICATION_FIELDS,
    templates: [],
    documentRequirements: DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
    dossierDocuments: [],
    dossierAttachments: [],
    generatedDocuments: [],
    officialDocuments: [],
    customers: [],
    proposals: [],
    dossiers: [],
    labRequests: [],
    returnedResults: [],
    approvalSteps: [],
    issuancePackages: [],
    activityLogs: [],
    sampleLots: [],
    sampleItems: [],
    sampleRoutes: [],
    sampleFlowEvents: [],
    sampleRequestBundles: [],
    users: [],
    departmentRoles: [],
    signerDelegations: [],
    qualityDocuments: [],
    workflowTemplates: [],
    workflowTasks: [],
    notifications: [],
    isLoading: false,
    isLoaded: false,
  }),

  load: async (force = false) => {
    if (get().isLoading || (get().isLoaded && !force)) return;
    set({ isLoading: true });
    try {
      const [fields, templates, documentRequirements, dossierDocuments, dossierAttachments, generatedDocuments, officialDocuments, customers, proposals, dossiers, sampleLots, sampleItems, sampleRoutes, sampleFlowEvents, sampleRequestBundles, labRequests, returnedResults, approvalSteps, issuancePackages, activityLogs, users, departmentRoles, signerDelegations, qualityDocuments, workflowTemplates, workflowTasks, notifications] = await Promise.all([
        fetchCollection<PcnCertificationField>('pcnCertificationFields'),
        fetchCollection<PcnTemplateDefinition>('pcnTemplateDefinitions'),
        fetchCollection<PcnDocumentRequirement>('pcnDocumentRequirements'),
        fetchCollection<PcnDossierDocument>('dossierDocuments'),
        fetchCollection<PcnDossierAttachment>('dossierAttachments'),
        fetchCollection<PcnGeneratedDocument>('pcnGeneratedDocuments'),
        fetchCollection<PcnOfficialGeneratedDocument>('pcnOfficialGeneratedDocuments'),
        fetchCollection<CustomerRef>('customers'),
        fetchCollection<CertificationProposal>('certificationProposals'),
        fetchCollection<CertificationDossier>('certificationDossiers'),
        fetchCollection<PcnSampleLot>('pcnSampleLots'),
        fetchCollection<PcnSampleItem>('pcnSampleItems'),
        fetchCollection<PcnSampleRoute>('pcnSampleRoutes'),
        fetchCollection<PcnSampleFlowEvent>('pcnSampleFlowEvents'),
        fetchCollection<PcnSampleRequestBundle>('pcnSampleRequestBundles'),
        fetchCollection<OutboundLabRequest>('labRequests'),
        fetchCollection<ReturnedTestResult>('returnedResults'),
        fetchCollection<PcnApprovalStep>('approvalSteps'),
        fetchCollection<IssuancePackage>('issuancePackages'),
        Promise.resolve<ActivityLog[]>([]),
        fetchPcnUsers(),
        fetchPcnDepartmentRoles(),
        fetchPcnSignerDelegations(),
        fetchCollection<PcnQualityDocument>('pcnQualityDocuments'),
        fetchPcnWorkflowTemplates(),
        fetchCollection<PcnDossierWorkflowTask>('pcnDossierWorkflowTasks'),
        fetchPcnNotifications(),
      ]);
      const activeSnapshot = filterPcnFutureWorkSnapshot({ proposals, dossiers, customers });
      const activeRelations = filterPcnFutureWorkRelations({
        dossierDocuments,
        dossierAttachments,
        generatedDocuments,
        officialDocuments,
        labRequests,
        returnedResults,
        approvalSteps,
        issuancePackages,
        sampleLots,
        sampleItems,
        sampleRoutes,
        sampleFlowEvents,
        activityLogs,
        notifications,
      }, activeSnapshot.dossiers);
      const activeDossierIds = new Set(activeSnapshot.dossiers.map((dossier) => dossier.id));
      const activeWorkflowTasks = workflowTasks.filter((task) => activeDossierIds.has(task.dossierId));
      const activeLotIds = new Set(activeRelations.sampleLots.map((lot) => lot.id));
      const activeSampleRequestBundles = sampleRequestBundles.filter((bundle) => bundle.sampleLotIds.some((lotId) => activeLotIds.has(lotId)));
      set({
        fields: mergePcnCertificationFields(fields),
        templates: mergePcnTemplateCatalog(templates),
        documentRequirements: mergePcnDocumentRequirements(documentRequirements),
        dossierDocuments: activeRelations.dossierDocuments,
        dossierAttachments: activeRelations.dossierAttachments,
        generatedDocuments: activeRelations.generatedDocuments.sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || ''))),
        officialDocuments: activeRelations.officialDocuments.sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || ''))),
        customers: mergePcnCustomers([], customers),
        proposals: activeSnapshot.proposals.sort(byUpdatedAt),
        dossiers: activeSnapshot.dossiers.sort(byUpdatedAt),
        sampleLots: activeRelations.sampleLots.sort(byUpdatedAt),
        sampleItems: activeRelations.sampleItems.sort(byUpdatedAt),
        sampleRoutes: activeRelations.sampleRoutes.sort(byUpdatedAt),
        sampleFlowEvents: activeRelations.sampleFlowEvents.sort((left, right) => String(right.occurredAt || '').localeCompare(String(left.occurredAt || ''))),
        sampleRequestBundles: activeSampleRequestBundles.sort(byUpdatedAt),
        labRequests: activeRelations.labRequests.sort(byUpdatedAt),
        returnedResults: activeRelations.returnedResults.sort(byUpdatedAt),
        approvalSteps: activeRelations.approvalSteps.sort((left, right) => left.sequence - right.sequence),
        issuancePackages: activeRelations.issuancePackages.sort(byUpdatedAt),
        activityLogs: activeRelations.activityLogs.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
        users,
        departmentRoles,
        signerDelegations,
        qualityDocuments: qualityDocuments.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))),
        workflowTemplates: workflowTemplates.sort((left, right) => String(left.code).localeCompare(String(right.code)) || right.version - left.version),
        workflowTasks: activeWorkflowTasks.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))),
        notifications: mergeNotifications([], activeRelations.notifications, 50),
        isLoaded: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  addPcnUser: async (input) => {
    assertPcnStorePersonnelMutationAllowed();
    const user = await createPcnUser(input);
    set((state) => ({ users: [user, ...state.users.filter((item) => item.username !== user.username)] }));
  },

  updatePcnUser: async (username, input) => {
    assertPcnStorePersonnelMutationAllowed();
    const user = await updatePcnUser(username, input);
    set((state) => ({ users: state.users.map((item) => item.username === user.username ? user : item) }));
  },

  deletePcnUser: async (username) => {
    assertPcnStorePersonnelMutationAllowed();
    await deletePcnUserApi(username);
    set((state) => ({ users: state.users.filter((item) => item.username !== username) }));
  },

  resetPcnUserPassword: async (username, password) => {
    assertPcnStorePersonnelMutationAllowed();
    await resetPcnUserPassword(username, password);
  },

  addSignerDelegation: async (input) => {
    assertPcnStoreAdminMutationAllowed();
    const result = await createPcnSignerDelegation(input);
    set((state) => ({
      signerDelegations: [result.delegation, ...state.signerDelegations.filter((item) => item.id !== result.delegation.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  revokeSignerDelegation: async (id) => {
    assertPcnStoreAdminMutationAllowed();
    const result = await revokePcnSignerDelegation(id);
    set((state) => ({
      signerDelegations: state.signerDelegations.map((item) => item.id === result.delegation.id ? result.delegation : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  addQualityDocument: async (input, file) => {
    assertPcnStoreAdminMutationAllowed();
    const now = new Date().toISOString();
    const { fileAssetId: _fileAssetId, fileName: _fileName, ...metadataInput } = input;
    const base = buildPcnQualityDocument(metadataInput, now);
    const created = await createPcnQualityDocument(base);
    let document = created.document;
    const activities = created.activityLog ? [created.activityLog] : [];
    if (file) {
      const asset = await uploadPcnFile({
        file,
        sourceCollection: 'pcnQualityDocuments',
        sourceDocumentId: base.id,
        sourceJsonPath: 'fileAssetId',
      });
      const attached = await attachPcnQualityDocumentFile(base.id, asset.id, file.name);
      document = attached.document;
      if (attached.activityLog) activities.push(attached.activityLog);
    }
    set((state) => ({
      qualityDocuments: [document, ...state.qualityDocuments.filter((item) => item.id !== document.id)],
      activityLogs: [...activities, ...state.activityLogs.filter((item) => !activities.some((activity) => activity.id === item.id))],
    }));
  },

  updateQualityDocument: async (id, updates, file) => {
    assertPcnStoreAdminMutationAllowed();
    const previous = get().qualityDocuments.find((item) => item.id === id);
    if (!previous) throw new Error('Không tìm thấy tài liệu chất lượng PCN.');
    const { fileAssetId: _fileAssetId, fileName: _fileName, ...metadataUpdates } = updates;
    const updated = await updatePcnQualityDocument(id, metadataUpdates);
    let next = updated.document;
    const activities = updated.activityLog ? [updated.activityLog] : [];
    if (file) {
      const asset = await uploadPcnFile({
        file,
        sourceCollection: 'pcnQualityDocuments',
        sourceDocumentId: id,
        sourceJsonPath: 'fileAssetId',
      });
      const attached = await attachPcnQualityDocumentFile(id, asset.id, file.name);
      next = attached.document;
      if (attached.activityLog) activities.push(attached.activityLog);
    }
    set((state) => ({
      qualityDocuments: state.qualityDocuments.map((item) => item.id === next.id ? next : item),
      activityLogs: [...activities, ...state.activityLogs.filter((item) => !activities.some((activity) => activity.id === item.id))],
    }));
  },

  retireQualityDocument: async (id) => {
    assertPcnStoreAdminMutationAllowed();
    const previous = get().qualityDocuments.find((item) => item.id === id);
    if (!previous) throw new Error('Không tìm thấy tài liệu chất lượng PCN.');
    await get().updateQualityDocument(id, { status: 'RETIRED' });
  },

  refreshPcnNotifications: async () => {
    const notifications = await fetchPcnNotifications();
    set({ notifications: mergeNotifications([], notifications, 50) });
  },

  markPcnNotificationAsRead: async (id) => {
    assertPcnStoreMutationAllowed();
    const current = get().notifications.find((notification) => notification.id === id);
    if (!current || current.read) return;
    await markPcnNotificationReadApi(id);
    const next = { ...current, read: true };
    set((state) => ({ notifications: state.notifications.map((notification) => notification.id === id ? next : notification) }));
  },

  markAllPcnNotificationsAsRead: async () => {
    assertPcnStoreMutationAllowed();
    const unread = get().notifications.filter((notification) => !notification.read);
    if (unread.length === 0) return;
    await markAllPcnNotificationsReadApi();
    set((state) => ({ notifications: state.notifications.map((notification) => ({ ...notification, read: true })) }));
  },

  clearPcnNotifications: async () => {
    assertPcnStoreMutationAllowed();
    await clearPcnNotificationsApi();
    set({ notifications: [] });
  },

  addSampleLot: async (draft) => {
    assertPcnStoreMutationAllowed();
    const result = await createPcnSampleLotApi(draft);
    const routeIds = new Set(result.routes.map((route) => route.id));
    set((state) => ({
      sampleLots: [result.lot, ...state.sampleLots.filter((item) => item.id !== result.lot.id)],
      sampleItems: result.items ? [...result.items, ...state.sampleItems.filter((item) => !result.items.some((next) => next.id === item.id))] : state.sampleItems,
      sampleRoutes: [...result.routes, ...state.sampleRoutes.filter((item) => !routeIds.has(item.id))],
      sampleFlowEvents: result.event
        ? [result.event, ...state.sampleFlowEvents.filter((item) => item.id !== result.event?.id)]
        : state.sampleFlowEvents,
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      activityLogs: [...result.activityLogs, ...state.activityLogs.filter((item) => !result.activityLogs.some((next) => next.id === item.id))],
    }));
  },

  updateSampleRoute: async (routeId, status, update = {}) => {
    assertPcnStoreMutationAllowed();
    const result = await updatePcnSampleRouteApi(routeId, status, update);
    set((state) => ({
      sampleLots: state.sampleLots.map((item) => item.id === result.lot.id ? result.lot : item),
      sampleRoutes: state.sampleRoutes.map((item) => item.id === result.route.id ? result.route : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      sampleFlowEvents: result.event
        ? [result.event, ...state.sampleFlowEvents.filter((item) => item.id !== result.event?.id)]
        : state.sampleFlowEvents,
      activityLogs: [...result.activityLogs, ...state.activityLogs.filter((item) => !result.activityLogs.some((next) => next.id === item.id))],
    }));
  },

  saveSampleRequestBundle: async (draft) => {
    assertPcnStoreMutationAllowed();
    const result = await savePcnSampleRequestBundle(draft);
    set((state) => mergePcnSampleRequestBundleMutationState(state, result));
    return result.bundle;
  },

  sendSampleRequestBundle: async (bundleId) => {
    assertPcnStoreMutationAllowed();
    const initial = await sendPcnSampleRequestBundle(bundleId);
    set((state) => mergePcnSampleRequestBundleMutationState(state, initial));
    let failedDispatches = 0;
    for (const dispatch of initial.bundle.dispatches) {
      if (dispatch.status === 'ACKNOWLEDGED') continue;
      for (const requestId of dispatch.labRequestIds) {
        try {
          const result = await dispatchPcnLabRequest(requestId);
          set((state) => mergePcnLabMutationState(state, result));
        } catch {
          // The server records ERROR for this child dispatch. Continue so an
          // acknowledged laboratory is never rolled back by another failure.
          failedDispatches += 1;
        }
      }
    }
    const [bundles, labRequests] = await Promise.all([
      fetchCollection<PcnSampleRequestBundle>('pcnSampleRequestBundles'),
      fetchCollection<OutboundLabRequest>('labRequests'),
    ]);
    const latest = bundles.find((bundle) => bundle.id === bundleId)
      || (failedDispatches > 0 ? { ...initial.bundle, status: 'PARTIALLY_SENT' as const } : initial.bundle);
    set((state) => ({
      sampleRequestBundles: [latest, ...state.sampleRequestBundles.filter((item) => item.id !== latest.id)],
      labRequests: mergeManyById(state.labRequests, labRequests.filter((request) => request.bundleId === bundleId)),
    }));
    return latest;
  },

  retrySampleRequestBundleDispatch: async (bundleId, dispatchId) => {
    assertPcnStoreMutationAllowed();
    const initial = await retryPcnSampleRequestBundleDispatch(bundleId, dispatchId);
    set((state) => mergePcnSampleRequestBundleMutationState(state, initial));
    const dispatch = initial.bundle.dispatches.find((item) => item.id === dispatchId);
    if (!dispatch) return initial.bundle;
    for (const requestId of dispatch.labRequestIds) {
      try {
        const result = await dispatchPcnLabRequest(requestId);
        set((state) => mergePcnLabMutationState(state, result));
      } catch {
        // Preserve the server-side ERROR state and return the partial outcome.
      }
    }
    const bundles = await fetchCollection<PcnSampleRequestBundle>('pcnSampleRequestBundles');
    const latest = bundles.find((bundle) => bundle.id === bundleId) || initial.bundle;
    set((state) => ({ sampleRequestBundles: [latest, ...state.sampleRequestBundles.filter((item) => item.id !== latest.id)] }));
    return latest;
  },

  addCustomer: async (customer) => {
    assertPcnStoreMutationAllowed();
    const record = normalizeCustomerRecord(customer);
    const id = getPcnDocumentId(record);
    if (!id) throw new Error('Khách hàng phải có tên hoặc mã khách hàng');
    const result = await createPcnCustomer(record);
    const next = result.customer || record;
    set((state) => ({
      customers: mergePcnCustomers(state.customers, [next]),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  updateCustomer: async (customerCodeOrName, updates) => {
    assertPcnStoreMutationAllowed();
    const previous = get().customers.find((customer) => getPcnDocumentId(customer) === customerCodeOrName);
    if (!previous) throw new Error('Không tìm thấy khách hàng cần cập nhật');
    const record = normalizeCustomerRecord(updates, previous);
    const oldId = getPcnDocumentId(previous);
    const result = await updatePcnCustomer(oldId, record);
    const next = result.customer || record;
    set((state) => ({
      customers: mergePcnCustomers(
        state.customers.filter((customer) => getPcnDocumentId(customer) !== oldId),
        [next],
      ),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  deleteCustomer: async (customerCodeOrName) => {
    assertPcnStoreMutationAllowed();
    const customer = get().customers.find((item) => getPcnDocumentId(item) === customerCodeOrName);
    if (!customer) return;
    const id = getPcnDocumentId(customer);
    const result = await deletePcnCustomer(id);
    if (result.deleted !== false) {
      set((state) => ({
        customers: state.customers.filter((item) => getPcnDocumentId(item) !== id),
        ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
      }));
    }
  },

  addProposal: async (proposal) => {
    assertPcnStoreMutationAllowed();
    const existingDossier = get().dossiers.find((item) => item.proposalId === proposal.id);
    const now = new Date().toISOString();
    const dossier: CertificationDossier = existingDossier || {
      id: proposal.dossierId || `dossier-${proposal.id}`,
      dossierCode: `HS-${new Date(now).getFullYear()}-${proposal.proposalCode.replace(/[^a-zA-Z0-9-]/g, '-').slice(-24)}`,
      proposalId: proposal.id,
      customerSnapshot: { ...proposal.customerSnapshot },
      fieldCodes: proposal.fieldCodes,
      method: 'METHOD_1',
      status: 'INTAKE_REVIEW',
      labRequestIds: [],
      returnedResultIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const convertedProposal = markPcnProposalConverted(proposal, dossier.id);
    const dossierWithSnapshot = ensurePcnDossierCustomerSnapshot(dossier, proposal);
    const result = await createPcnIntake(convertedProposal, dossierWithSnapshot);
    set((state) => ({
      proposals: [result.proposal, ...state.proposals.filter((item) => item.id !== result.proposal.id)],
      dossiers: [result.dossier, ...state.dossiers.filter((item) => item.id !== result.dossier.id)],
      ...(result.dossierDocuments ? {
        dossierDocuments: [
          ...result.dossierDocuments,
          ...state.dossierDocuments.filter((item) => !result.dossierDocuments!.some((candidate) => candidate.id === item.id)),
        ],
      } : {}),
      ...(result.activityLogs?.length ? {
        activityLogs: [
          ...result.activityLogs,
          ...state.activityLogs.filter((item) => !result.activityLogs!.some((candidate) => candidate.id === item.id)),
        ],
      } : {}),
      ...(result.workflowTasks?.length ? {
        workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks),
      } : {}),
    }));
  },

  addDossier: async (dossier) => {
    assertPcnStoreMutationAllowed();
    const proposal = get().proposals.find((item) => item.id === dossier.proposalId);
    if (!proposal) throw new Error('Hồ sơ chứng nhận phải liên kết với Đề nghị');
    if (proposal.dossierId && proposal.dossierId !== dossier.id) throw new Error('Đề nghị này đã liên kết với hồ sơ khác');
    const convertedProposal = markPcnProposalConverted(proposal, dossier.id);
    const dossierWithSnapshot = ensurePcnDossierCustomerSnapshot(dossier, proposal);
    const result = await createPcnIntake(convertedProposal, dossierWithSnapshot);
    set((state) => ({
      dossiers: [result.dossier, ...state.dossiers.filter((item) => item.id !== result.dossier.id)],
      proposals: [result.proposal, ...state.proposals.filter((item) => item.id !== result.proposal.id)],
      ...(result.dossierDocuments ? {
        dossierDocuments: [
          ...result.dossierDocuments,
          ...state.dossierDocuments.filter((item) => !result.dossierDocuments!.some((candidate) => candidate.id === item.id)),
        ],
      } : {}),
      ...(result.activityLogs?.length ? {
        activityLogs: [
          ...result.activityLogs,
          ...state.activityLogs.filter((item) => !result.activityLogs!.some((candidate) => candidate.id === item.id)),
        ],
      } : {}),
      ...(result.workflowTasks?.length ? {
        workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks),
      } : {}),
    }));
  },

  createWorkflowTemplate: async (template) => {
    assertPcnStoreWorkflowManagerMutationAllowed();
    const result = await createPcnWorkflowTemplate(template);
    set((state) => ({
      workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
    return result.template;
  },

  updateWorkflowTemplate: async (templateId, template, expectedUpdatedAt) => {
    assertPcnStoreWorkflowManagerMutationAllowed();
    const result = await updatePcnWorkflowTemplate(templateId, template, expectedUpdatedAt);
    set((state) => ({
      workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
    return result.template;
  },

  createWorkflowRevision: async (templateId, template) => {
    assertPcnStoreWorkflowManagerMutationAllowed();
    const result = await createPcnWorkflowRevision(templateId, template);
    set((state) => ({
      workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
    return result.template;
  },

  publishWorkflowTemplate: async (templateId) => {
    assertPcnStoreWorkflowManagerMutationAllowed();
    const result = await publishPcnWorkflowTemplate(templateId);
    set((state) => ({
      workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
    return result.template;
  },

  retireWorkflowTemplate: async (templateId, reason) => {
    assertPcnStoreWorkflowManagerMutationAllowed();
    const result = await retirePcnWorkflowTemplate(templateId, reason);
    set((state) => ({
      workflowTemplates: [result.template, ...state.workflowTemplates.filter((item) => item.id !== result.template.id)],
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
    return result.template;
  },

  startWorkflowTask: async (dossierId, taskId) => {
    assertPcnStoreMutationAllowed();
    const result = await startPcnWorkflowTask(dossierId, taskId);
    set((state) => mergePcnWorkflowTaskMutationState(state, result));
  },

  completeWorkflowTask: async (dossierId, taskId, expectedCycleNo) => {
    assertPcnStoreMutationAllowed();
    const currentTask = get().workflowTasks.find((task) => task.id === taskId && task.dossierId === dossierId);
    const result = await completePcnWorkflowTask(dossierId, taskId, expectedCycleNo ?? currentTask?.cycleNo);
    set((state) => mergePcnWorkflowTaskMutationState(state, result));
  },

  returnWorkflowTask: async (dossierId, taskId, input) => {
    assertPcnStoreMutationAllowed();
    const result = await returnPcnWorkflowTask(dossierId, taskId, input);
    set((state) => mergePcnWorkflowTaskMutationState(state, result));
  },

  updateProposal: async (proposalId, updates) => {
    assertPcnStoreMutationAllowed();
    const result = await updatePcnProposal(proposalId, updates);
    set((state) => ({
      proposals: [result.proposal, ...state.proposals.filter((item) => item.id !== result.proposal.id)],
      dossiers: [result.dossier, ...state.dossiers.filter((item) => item.id !== result.dossier.id)],
      ...(result.activityLogs?.length ? {
        activityLogs: [
          ...result.activityLogs,
          ...state.activityLogs.filter((item) => !result.activityLogs!.some((candidate) => candidate.id === item.id)),
        ],
      } : {}),
    }));
  },

  uploadDossierDocument: async (dossierId, requirementId, file) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    const requirement = get().documentRequirements.find((item) => item.id === requirementId);
    if (!requirement || !dossier.fieldCodes.includes(requirement.fieldCode)) throw new Error('Loại tài liệu không thuộc Lĩnh vực của hồ sơ');
    if (typeof File === 'undefined' || !(file instanceof File) || file.size <= 0) throw new Error('Tệp hồ sơ không hợp lệ');
    const currentUser = usePcnSessionStore.getState().currentUser;
    const result = await uploadPcnDossierDocument({
      dossierId,
      requirement,
      file,
      actorUsername: currentUser?.username,
    });
    set((state) => ({
      dossierDocuments: [result.document, ...state.dossierDocuments.filter((item) => item.id !== result.document.id)],
      ...(result.attachment ? { dossierAttachments: [result.attachment, ...state.dossierAttachments.filter((item) => item.id !== result.attachment?.id)] } : {}),
      ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
      ...(result.workflowTasks?.length ? { workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks) } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  waiveDossierDocument: async (dossierId, requirementId, reason) => {
    assertPcnStoreMutationAllowed();
    const result = await waivePcnDossierDocument({ dossierId, requirementId, reason });
    set((state) => ({
      ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
      ...(result.workflowTasks?.length ? { workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks) } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  removeCurrentDossierDocument: async (dossierId, requirementId) => {
    assertPcnStoreMutationAllowed();
    const result = await removeCurrentPcnDossierDocument({ dossierId, requirementId });
    set((state) => ({
      ...(result.document ? { dossierDocuments: [result.document, ...state.dossierDocuments.filter((item) => item.id !== result.document?.id)] } : {}),
      ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
      ...(result.workflowTasks?.length ? { workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks) } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  generateAndAttachDossierNodeDocument: async (dossierId, nodeId, requirementId) => {
    assertPcnStoreMutationAllowed();
    const result = await generateAndAttachPcnDossierNodeDocument({ dossierId, nodeId, requirementId });
    set((state) => ({
      ...(result.document ? { dossierDocuments: [result.document, ...state.dossierDocuments.filter((item) => item.id !== result.document?.id)] } : {}),
      ...(result.attachment ? { dossierAttachments: [result.attachment, ...state.dossierAttachments.filter((item) => item.id !== result.attachment?.id)] } : {}),
      ...(result.generated ? { generatedDocuments: [result.generated, ...state.generatedDocuments.filter((item) => item.id !== result.generated?.id)] } : {}),
      ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
      ...(result.workflowTasks?.length ? { workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks) } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  confirmGeneratedDocument: async (dossierId, generated, requirement) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    if (generated.dossierId !== dossierId || !dossier.fieldCodes.includes(requirement.fieldCode)) {
      throw new Error('Bản sinh hoặc loại tài liệu không thuộc hồ sơ chứng nhận');
    }
    const result = await confirmPcnGeneratedDocumentIntoChecklist({ dossierId, generated, requirement });
    set((state) => ({
      dossierDocuments: [result.document, ...state.dossierDocuments.filter((item) => item.id !== result.document.id)],
      ...(result.attachment ? { dossierAttachments: [result.attachment, ...state.dossierAttachments.filter((item) => item.id !== result.attachment?.id)] } : {}),
      ...(result.dossier ? { dossiers: state.dossiers.map((item) => item.id === result.dossier?.id ? result.dossier! : item) } : {}),
      ...(result.workflowTasks?.length ? { workflowTasks: mergeManyById(state.workflowTasks, result.workflowTasks) } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  updateDossier: async (dossierId, updates) => {
    assertPcnStoreMutationAllowed();
    const previous = get().dossiers.find((item) => item.id === dossierId);
    if (!previous) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    if (updates.status && updates.status !== previous.status && !isPcnDossierTransitionAllowed(previous.status, updates.status)) {
      throw new Error(`Không thể chuyển hồ sơ PCN từ ${previous.status} sang ${updates.status}`);
    }
    const result = await updatePcnDossier(dossierId, updates);
    set((state) => ({
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.approvalSteps ? {
        approvalSteps: [...result.approvalSteps, ...state.approvalSteps.filter((item) => !result.approvalSteps!.some((next) => next.id === item.id))],
      } : {}),
      ...(result.issuance ? {
        issuancePackages: [result.issuance, ...state.issuancePackages.filter((item) => item.id !== result.issuance!.id)],
      } : {}),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  preflightDossierDocuments: async (dossierId, kind = 'DOSSIER_COVER', sampleRouteId, labRequestId) => {
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    if (!get().proposals.some((item) => item.id === dossier.proposalId)) throw new Error('Hồ sơ chưa có Đề nghị liên kết');
    const result = await preflightPcnDossierDocuments(dossierId, kind, sampleRouteId, labRequestId);
    return result.context;
  },

  generateDossierDocuments: async (dossierId, kind = 'DOSSIER_COVER', formats = ['DOCX', 'PDF'], sampleRouteId, expectedContextHash, labRequestId) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    if (!get().proposals.some((item) => item.id === dossier.proposalId)) throw new Error('Hồ sơ chưa có Đề nghị liên kết');
    const result = await generatePcnDossierDocuments(dossierId, kind, formats, sampleRouteId, expectedContextHash, labRequestId);
    set((state) => ({
      generatedDocuments: [...result.documents, ...state.generatedDocuments.filter((item) => !result.documents.some((next) => next.id === item.id))].sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || ''))),
      activityLogs: [...result.activityLogs, ...state.activityLogs],
    }));
    return result.documents;
  },

  preflightOfficialDocuments: async (issuanceId, formats = ['DOCX']) => {
    return preflightPcnOfficialDocuments(issuanceId, ['CERTIFICATE', 'DECISION'], formats);
  },

  generateOfficialDocuments: async (issuanceId, formats = ['DOCX'], expectedContextHash) => {
    assertPcnStoreMutationAllowed();
    const result = await generatePcnOfficialDocuments(issuanceId, ['CERTIFICATE', 'DECISION'], formats, expectedContextHash);
    set((state) => ({
      officialDocuments: [...result.documents, ...state.officialDocuments.filter((item) => !result.documents.some((next) => next.id === item.id))].sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || ''))),
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      activityLogs: [...result.activityLogs, ...state.activityLogs],
    }));
    return result.documents;
  },

  reviewPcnTemplate: async (templateId, action, reason) => {
    assertPcnStoreAdminMutationAllowed();
    const result = await reviewPcnTemplateApi(templateId, action, reason);
    set((state) => ({
      templates: state.templates.map((template) => template.id === result.template.id ? mergePcnTemplateRuntimeProjection(template, result.template) : template),
      activityLogs: result.activityLog ? [result.activityLog, ...state.activityLogs] : state.activityLogs,
    }));
    return result.template;
  },

  annotatePcnTemplate: async (templateId, mappings) => {
    assertPcnStoreAdminMutationAllowed();
    const result = await annotatePcnTemplateApi(templateId, mappings);
    set((state) => ({
      templates: state.templates.map((template) => template.id === result.template.id ? mergePcnTemplateRuntimeProjection(template, result.template) : template),
      activityLogs: result.activityLog ? [result.activityLog, ...state.activityLogs] : state.activityLogs,
    }));
    return result.template;
  },

  uploadPcnTemplate: async (templateId, file) => {
    assertPcnStoreAdminMutationAllowed();
    const result = await uploadPcnTemplateApi(templateId, file);
    set((state) => ({
      templates: state.templates.map((template) => template.id === result.template.id ? mergePcnTemplateRuntimeProjection(template, result.template) : template),
    }));
    return result.template;
  },

  addLabRequest: async (request) => {
    assertPcnStoreMutationAllowed();
    const result = await createPcnLabRequestApi(request);
    set((state) => ({
      labRequests: [result.request, ...state.labRequests.filter((item) => item.id !== result.request.id)],
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      sampleLots: result.lot ? [result.lot, ...state.sampleLots.filter((item) => item.id !== result.lot?.id)] : state.sampleLots,
      sampleRoutes: result.route ? [result.route, ...state.sampleRoutes.filter((item) => item.id !== result.route?.id)] : state.sampleRoutes,
      activityLogs: [...result.activityLogs, ...state.activityLogs.filter((item) => !result.activityLogs.some((next) => next.id === item.id))],
    }));
  },

  updateLabRequest: async (requestId, status, updates = {}, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const result = await updatePcnLabRequestApi(requestId, status, updates, idempotencyKey);
    set((state) => ({
      labRequests: state.labRequests.map((item) => item.id === result.request.id ? result.request : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      sampleLots: result.lot ? state.sampleLots.map((item) => item.id === result.lot?.id ? result.lot! : item) : state.sampleLots,
      sampleRoutes: result.route ? state.sampleRoutes.map((item) => item.id === result.route?.id ? result.route! : item) : state.sampleRoutes,
      activityLogs: [...result.activityLogs, ...state.activityLogs.filter((item) => !result.activityLogs.some((next) => next.id === item.id))],
    }));
  },

  dispatchLabRequest: async (requestId) => {
    assertPcnStoreMutationAllowed();
    const result = await dispatchPcnLabRequest(requestId);
    set((state) => mergePcnLabMutationState(state, result));
  },

  reconcileLabRequest: async (requestId) => {
    assertPcnStoreMutationAllowed();
    const result = await reconcilePcnLabRequest(requestId);
    set((state) => mergePcnLabMutationState(state, result));
  },

  addReturnedResult: async (result) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === result.dossierId);
    const labRequest = get().labRequests.find((item) => item.id === result.labRequestId);
    if (!dossier || !labRequest || labRequest.dossierId !== dossier.id) throw new Error('KQTN phải liên kết với đúng hồ sơ và PYC');
    const mutation = await submitPcnReturnedResult(result, result.id);
    set((state) => ({
      returnedResults: [...mutation.results, ...state.returnedResults.filter((item) => !mutation.results.some((next) => next.id === item.id))],
      dossiers: state.dossiers.map((item) => item.id === mutation.dossier.id ? mutation.dossier : item),
      labRequests: state.labRequests.map((item) => item.id === mutation.request.id ? mutation.request : item),
      sampleLots: mutation.lot ? state.sampleLots.map((item) => item.id === mutation.lot?.id ? mutation.lot! : item) : state.sampleLots,
      sampleRoutes: mutation.route ? state.sampleRoutes.map((item) => item.id === mutation.route?.id ? mutation.route! : item) : state.sampleRoutes,
      sampleFlowEvents: [...mutation.events, ...state.sampleFlowEvents.filter((item) => !mutation.events.some((next) => next.id === item.id))],
      activityLogs: [...mutation.activityLogs, ...state.activityLogs.filter((item) => !mutation.activityLogs.some((next) => next.id === item.id))],
    }));
  },

  attachResultFile: async (resultId, file) => {
    assertPcnStoreMutationAllowed();
    const result = get().returnedResults.find((item) => item.id === resultId);
    if (!result) throw new Error('Không tìm thấy KQTN cần đính kèm file');
    if (result.fileAssetId) throw new Error('KQTN này đã có file đính kèm');
    if (typeof File === 'undefined' || !(file instanceof File) || file.size <= 0) throw new Error('Tệp KQTN không hợp lệ');
    const currentUser = usePcnSessionStore.getState().currentUser;
    const asset = await uploadPcnFile({
      file,
      sourceCollection: 'returnedResults',
      sourceDocumentId: result.id,
      sourceJsonPath: 'fileAssetId',
      actorUsername: currentUser.username,
    });
    const mutation = await attachPcnReturnedResultFile(result.id, asset.id, file.name);
    const nextResult = mutation.result;
    set((state) => ({
      returnedResults: state.returnedResults.map((item) => item.id === nextResult.id ? nextResult : item),
      ...(mutation.activityLog ? { activityLogs: [mutation.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  createIssuanceBundle: async (dossierId, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ chứng nhận');
    if (!['TECHNICAL_REVIEW', 'WAITING_APPROVAL', 'APPROVED'].includes(dossier.status)) throw new Error('Hồ sơ chưa sẵn sàng để lập bộ phát hành');
    const result = await createPcnIssuanceBundle(dossierId, idempotencyKey);
    set((state) => ({
      issuancePackages: [result.issuance, ...state.issuancePackages.filter((item) => item.id !== result.issuance.id)],
      approvalSteps: result.approvalSteps
        ? [...result.approvalSteps, ...state.approvalSteps.filter((item) => !result.approvalSteps!.some((next) => next.id === item.id))]
        : state.approvalSteps,
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  actOnApprovalStep: async (stepId, decision, comment, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const step = get().approvalSteps.find((item) => item.id === stepId);
    if (!step) throw new Error('Không tìm thấy bước phê duyệt');
    const issuance = get().issuancePackages.find((item) => item.dossierId === step.dossierId);
    if (!issuance) throw new Error('Bước phê duyệt chưa có bộ phát hành');
    const result = await actOnPcnApprovalStep(issuance.id, stepId, decision, comment, idempotencyKey);
    set((state) => ({
      approvalSteps: result.approvalSteps
        ? [...result.approvalSteps, ...state.approvalSteps.filter((item) => !result.approvalSteps!.some((next) => next.id === item.id))]
        : state.approvalSteps,
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  issuePackage: async (issuanceId, input, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const issuance = get().issuancePackages.find((item) => item.id === issuanceId);
    if (!issuance) throw new Error('Không tìm thấy bộ phát hành');
    const dossier = get().dossiers.find((item) => item.id === issuance.dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ phát hành');
    const proposal = get().proposals.find((item) => item.id === dossier.proposalId);
    const steps = get().approvalSteps.filter((item) => item.dossierId === dossier.id);
    const results = get().returnedResults.filter((item) => item.dossierId === dossier.id);
    const readiness = getPcnIssuanceReadiness(dossier, results, steps);
    if (!readiness.ready) throw new Error(readiness.reasons.join('; '));
    assertPcnSignerAuthorized({
      signerUsername: input.signerUsername,
      fieldCodes: dossier.fieldCodes,
      issuedAt: input.issuedAt || new Date().toISOString(),
      users: get().users,
      delegations: get().signerDelegations,
    });
    const result = await issuePcnIssuance(issuanceId, input, idempotencyKey);
    const issued = result.issuance as IssuancePackage;
    const nextDossier = result.dossier as CertificationDossier;
    set((state) => ({
      issuancePackages: state.issuancePackages.map((item) => item.id === issued.id ? issued : item),
      dossiers: state.dossiers.map((item) => item.id === nextDossier.id ? nextDossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs] } : {}),
    }));
  },

  deliverPackage: async (issuanceId, input, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const issuance = get().issuancePackages.find((item) => item.id === issuanceId);
    if (!issuance) throw new Error('Không tìm thấy bộ phát hành');
    const dossier = get().dossiers.find((item) => item.id === issuance.dossierId);
    if (!dossier || dossier.status !== 'ISSUED' || !isPcnDossierTransitionAllowed(dossier.status, 'DELIVERED')) {
      throw new Error('Chỉ được giao khách hàng sau khi hồ sơ đã phát hành');
    }
    const result = await deliverPcnIssuance(issuanceId, input, idempotencyKey);
    set((state) => ({
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  archivePackage: async (issuanceId, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const issuance = get().issuancePackages.find((item) => item.id === issuanceId);
    if (!issuance) throw new Error('Không tìm thấy bộ phát hành');
    const dossier = get().dossiers.find((item) => item.id === issuance.dossierId);
    if (!dossier || dossier.status !== 'DELIVERED' || !isPcnDossierTransitionAllowed(dossier.status, 'ARCHIVED')) {
      throw new Error('Chỉ được lưu trữ sau khi hồ sơ đã giao khách hàng');
    }
    const result = await archivePcnIssuance(issuanceId, idempotencyKey);
    set((state) => ({
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  deleteDossier: async (dossierId, reason, confirmationCode) => {
    assertPcnStoreMutationAllowed();
    const result = await deletePcnDossier(dossierId, reason, confirmationCode);
    set((state) => {
      const deletedLotIds = new Set(state.sampleLots.filter((item) => item.dossierId === dossierId).map((item) => item.id));
      const deletedRouteIds = new Set(state.sampleRoutes.filter((item) => deletedLotIds.has(item.sampleLotId)).map((item) => item.id));
      return {
        dossiers: state.dossiers.filter((item) => item.id !== dossierId),
        proposals: state.proposals.filter((item) => item.id !== result.proposalId && item.dossierId !== dossierId),
        dossierDocuments: state.dossierDocuments.filter((item) => item.dossierId !== dossierId),
        dossierAttachments: state.dossierAttachments.filter((item) => item.dossierId !== dossierId),
        generatedDocuments: state.generatedDocuments.filter((item) => item.dossierId !== dossierId),
        officialDocuments: state.officialDocuments.filter((item) => item.dossierId !== dossierId),
        labRequests: state.labRequests.filter((item) => item.dossierId !== dossierId),
        returnedResults: state.returnedResults.filter((item) => item.dossierId !== dossierId),
        sampleLots: state.sampleLots.filter((item) => item.dossierId !== dossierId),
        sampleItems: state.sampleItems.filter((item) => !deletedLotIds.has(item.sampleLotId)),
        sampleRoutes: state.sampleRoutes.filter((item) => !deletedLotIds.has(item.sampleLotId)),
        sampleFlowEvents: state.sampleFlowEvents.filter((item) => !deletedLotIds.has(item.sampleLotId) && !deletedRouteIds.has(item.routeId || '')),
        sampleRequestBundles: state.sampleRequestBundles.filter((item) => !item.sampleLotIds.some((lotId) => deletedLotIds.has(lotId))),
        approvalSteps: state.approvalSteps.filter((item) => item.dossierId !== dossierId),
        issuancePackages: state.issuancePackages.filter((item) => item.dossierId !== dossierId),
        activityLogs: result.activityLog ? [result.activityLog, ...state.activityLogs] : state.activityLogs,
      };
    });
  },

  withdrawPackage: async (issuanceId, reason, idempotencyKey) => {
    assertPcnStoreMutationAllowed();
    const issuance = get().issuancePackages.find((item) => item.id === issuanceId);
    if (!issuance) throw new Error('Không tìm thấy bộ phát hành');
    if (!['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(issuance.status)) {
      throw new Error('Chỉ được thu hồi hồ sơ sau khi đã phê duyệt hoặc phát hành');
    }
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) throw new Error('Thu hồi hồ sơ phải có lý do');
    const result = await withdrawPcnIssuance(issuanceId, { reason: normalizedReason }, idempotencyKey);
    set((state) => ({
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      approvalSteps: result.approvalSteps
        ? [...result.approvalSteps, ...state.approvalSteps.filter((item) => !result.approvalSteps!.some((next) => next.id === item.id))]
        : state.approvalSteps,
      ...(result.activityLogs ? { activityLogs: [...result.activityLogs, ...state.activityLogs] } : result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

  setDossierLegalHold: async (dossierId, input) => {
    assertPcnStoreMutationAllowed();
    const dossier = get().dossiers.find((item) => item.id === dossierId);
    if (!dossier) throw new Error('Không tìm thấy hồ sơ cần đặt giữ pháp lý');
    if (dossier.status !== 'ARCHIVED') throw new Error('Chỉ hồ sơ đã lưu trữ mới được đặt giữ pháp lý');
    const result = await updatePcnDossierRetention(dossierId, input);
    const activity = result.activityLog as ActivityLog | undefined;
    set((state) => ({
      dossiers: state.dossiers.map((item) => item.id === dossierId ? result.dossier : item),
      ...(activity ? { activityLogs: [activity, ...state.activityLogs] } : {}),
    }));
  },

  attachIssuanceFile: async (issuanceId, file) => {
    assertPcnStoreMutationAllowed();
    const issuance = get().issuancePackages.find((item) => item.id === issuanceId);
    if (!issuance) throw new Error('Không tìm thấy bộ phát hành');
    if (typeof File === 'undefined' || !(file instanceof File) || file.size <= 0) throw new Error('Tệp PCN không hợp lệ');
    const currentUser = usePcnSessionStore.getState().currentUser;
    const asset = await uploadPcnFile({
      file,
      sourceCollection: 'issuancePackages',
      sourceDocumentId: issuance.id,
      sourceJsonPath: 'fileAssetIds',
      actorUsername: currentUser.username,
    });
    const result = await attachPcnIssuanceFile(issuanceId, asset.id, file.name);
    set((state) => ({
      issuancePackages: state.issuancePackages.map((item) => item.id === result.issuance.id ? result.issuance : item),
      dossiers: state.dossiers.map((item) => item.id === result.dossier.id ? result.dossier : item),
      ...(result.activityLog ? { activityLogs: [result.activityLog, ...state.activityLogs.filter((item) => item.id !== result.activityLog?.id)] } : {}),
    }));
  },

}));
