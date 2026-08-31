// Author: Gemini
// OS support: Web/Node
// Description: Type definitions for the PCN certification workflow, dossier documents, sample flow and role-separated access control

export enum MachineType {
  AIR_CONDITIONER = 'Điều hòa không khí',
  REFRIGERATOR = 'Tủ lạnh',
  WASHING_MACHINE = 'Máy giặt',
  TV = 'Tivi',
  LIGHT_BULB = 'Bóng đèn',
  FAN = 'Quạt điện',
  WATER_HEATER = 'Bình đun nóng lạnh',
  RICE_COOKER = 'Nồi cơm điện',
  OTHER = 'Khác'
}

export enum RequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Đã chấp nhận',
  SAMPLES_RECEIVED = 'Đã nhận mẫu',
  SCHEDULED = 'Đã xếp lịch',
  TESTING = 'Đang thử nghiệm',
  RESULTS_SUBMITTED = 'Chờ duyệt KQTN',
  RESULTS_APPROVED = 'Đã duyệt KQ',
  COMPLETED = 'Hoàn thành',
  CANCELLED = 'Đã hủy',
  REQ_SUPPLEMENT = 'Cần bổ sung',
}

export enum SampleStatus {
  WAITING = 'Chờ nhận mẫu',
  IN_LAB = 'Mẫu trong kho',
  RETURNED = 'Đã trả khách',
}

export enum PriorityLevel {
  NORMAL = 1,
  HIGH = 2,
  VIP = 3,
  URGENT = 4,
}

export enum HandoverType {
  RECEIVE = 'Nhận mẫu',
  RETURN = 'Trả mẫu',
}

export interface AppSettings {
  workOnSaturday: boolean;
  workOnSunday: boolean;
  defaultTesters?: string[];
  defaultTestersAtd?: string[];
  defaultTestersEmc?: string[];
  defaultTestersChamber1?: string[];
  defaultTestersChamber2?: string[];
  cloudSyncEnabled?: boolean;
  geminiModel?: string;
  lastBackupDate?: string;
  updatedAt?: string;
}

export interface DayConfig {
  date: string;
  isPeakDay: boolean;
  isHoliday?: boolean;
  note?: string;
}

export interface HandoverDoc {
  id: string;
  docNumber: string;
  type: HandoverType;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  representative: string;
  customerPosition?: string;
  driverName?: string;
  vehicleInfo?: string;
  labName: string;
  labAddress: string;
  labRepresentative: string;
  labRepPosition: string;
  labRepPhone: string;
  sampleIds: string[];
  status: 'Draft' | 'Signed';
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface TestResult {
  ecnCode?: string;
  testDate?: string;
  serialNumber?: string;
  manufactureYear?: string;
  country?: string;
  coolingCapacity?: number;
  powerInput?: number;
  current?: number;
  measuredCapacity?: number;
  measuredPower?: number;
  cspf?: number;
  energyLevel?: number;
}

export enum TestCategory {
  ATD = 'An toàn điện',
  EMC = 'Tương thích điện từ',
  BOTH = 'Cả An toàn điện và EMC'
}

export interface Sample {
  id: string;
  pycNo: string;
  sampleCode?: string;
  sampleName: string;
  model: string;
  brand?: string;
  quantity: number;
  status: SampleStatus;
  receivedDate?: string;
  testDate?: string;
  tester?: string;
  testCategory?: TestCategory;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface TestRequest {
  id: string;
  requestCode: string;
  status: RequestStatus;
  sampleStatus: SampleStatus;
  customerName: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  invoiceCompanyName?: string;
  invoiceAddress?: string;
  invoiceTaxId?: string;
  invoiceEmail?: string;
  invoiceReceiverName?: string;
  otherCustomerInfo?: string;
  labAddress?: string;
  resultCopyCount?: number;
  modelName: string;
  brand?: string;
  type: string;
  testCategory?: TestCategory;
  quantity: number;
  unit?: string;
  sampleCondition?: string;
  postTestHandling?: string;
  atdEncodeNumber?: string;
  emcEncodeNumber?: string;
  itdEncodeNumber?: string;
  encodeNumber?: string;
  specifications?: string;
  standard?: string;
  testTimeEMC?: number;
  testTimeATD?: number;
  priority: PriorityLevel;
  requestDate: string;
  receivedDate?: string;
  scheduledDate: string | null;
  endDate?: string | null;
  duration: number;
  testerName?: string;
  ecnCode?: string;
  returnDate?: string;
  returnRecipient?: string;
  returnDocNo?: string;
  note?: string;
  customsDeadline?: string;
  retryCount?: number;
  lastFailReason?: string;
  result?: TestResult;
  senderUnit?: string;
  sampleLocation?: string;
  price?: string | number;
  testCriteria?: string;
  managerComment?: string;
  totalLotDays?: number;
  deadlineDate?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
  chamberId?: 'Chamber 1' | 'Chamber 2';
  sealStamp?: string;
  mtt?: string;
  printStatus?: string;
  isPycPrinted?: boolean;
  pycPrintStatus?: string;
  isNewSampleNoPYC?: boolean;
}

export interface CustomerRef {
  name: string;
  address: string;
  taxId?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  customerCode?: string;
  normalizedSearchStr?: string;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export type PcnCertificationFieldCode = string;
export type PcnCertificationFieldScopeStatus = 'CONFIRMED' | 'NEEDS_PCN_CONFIRMATION';

/** Active PCN field catalog. Keep this list separate from the DDT/legacy model. */
export const PCN_CERTIFICATION_FIELD_CODES = ['QC4', 'QC9', 'QC20'] as const;

export interface PcnCertificationField {
  code: PcnCertificationFieldCode;
  name: string;
  standardRefs: string[];
  scopeStatus?: PcnCertificationFieldScopeStatus;
  active: boolean;
}

export type PcnQc20LotDefinition = 'PRODUCT_LOT' | 'SHIPMENT_LOT';

export interface PcnQc20ChemicalCompositionRequirement {
  element: string;
  minPercent?: number;
  maxPercent?: number;
  source?: string;
}

/**
 * Confirmed scope data for QCVN 20. These values are captured from the
 * proposal instead of being inferred from a product name or a file name.
 */
export interface PcnQc20ScopeSnapshot {
  productForm?: string;
  grade?: string;
  nominalDimensions?: string;
  hsCode?: string;
  lotDefinition?: PcnQc20LotDefinition;
  manufacturerLotCode?: string;
  importer?: string;
  countryOfOrigin?: string;
  appliedStandard?: string;
  chromiumMinPercent?: number;
  carbonMaxPercent?: number;
  chemicalCompositionRequirements?: PcnQc20ChemicalCompositionRequirement[];
}

export type PcnProposalChannel = 'DIRECT' | 'EMAIL' | 'ONLINE_ZALO' | 'OTHER';
export type PcnProposalStatus = 'DRAFT' | 'RECEIVED' | 'REJECTED' | 'CONVERTED';

export interface CertificationProposal {
  id: string;
  proposalCode: string;
  channel: PcnProposalChannel;
  status: PcnProposalStatus;
  dossierId?: string;
  customerId?: string;
  customerSnapshot: Pick<CustomerRef, 'name' | 'address' | 'taxId' | 'phone' | 'email' | 'contactPerson'>;
  warehouseAddress?: string;
  productName: string;
  model?: string;
  brand?: string;
  productType?: string;
  specifications?: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  quantity: number;
  fieldCodes: PcnCertificationFieldCode[];
  receivedAt: string;
  createdAt?: string;
  updatedAt?: string;
  historicalImport?: PcnHistoricalImportMetadata;
  qc20Scope?: PcnQc20ScopeSnapshot;
}

export type PcnDossierStatus =
  | 'DRAFT'
  | 'INTAKE_REVIEW'
  | 'AWAITING_DOCUMENTS'
  | 'ASSIGNED'
  | 'PLAN_PENDING_APPROVAL'
  | 'FIELD_EVALUATION'
  | 'AWAITING_SAMPLING'
  | 'SENT_TO_LAB'
  | 'AWAITING_RESULTS'
  | 'CORRECTIVE_ACTION'
  | 'TECHNICAL_REVIEW'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'ISSUED'
  | 'DELIVERED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type PcnCertificationMethod = 'METHOD_1' | 'METHOD_5' | 'METHOD_7';

/** Structured PCN station records captured before a DOCX/PDF is generated. */
export type PcnOperationalFormKind =
  | 'ASSIGNMENT_FORM'
  | 'EVALUATION_PLAN'
  | 'FIELD_INSPECTION'
  | 'SAMPLE_TAKING'
  | 'SAMPLE_CODING'
  | 'EVALUATION_REPORT'
  | 'COMMERCIAL';

export interface PcnOperationalFormMetadata {
  savedAt?: string;
  savedByUsername?: string;
}

export interface PcnAssignmentForm extends PcnOperationalFormMetadata {
  assignmentNumber: string;
  assignedAt: string;
  assignedBy: string;
  ownerUsername: string;
  evaluatorUsername: string;
  reviewerUsername: string;
  scope: string;
  notes: string;
}

export interface PcnEvaluationPlanForm extends PcnOperationalFormMetadata {
  plannedStartAt: string;
  plannedEndAt: string;
  location: string;
  teamMembers: string[];
  scope: string;
  criteria: string;
  customerRepresentative: string;
  notes: string;
}

export interface PcnFieldInspectionForm extends PcnOperationalFormMetadata {
  inspectedAt: string;
  location: string;
  participants: string[];
  findings: string;
  conclusion: string;
  nonconformities: string[];
  notes: string;
}

export interface PcnSampleTakingForm extends PcnOperationalFormMetadata {
  sampledAt: string;
  location: string;
  samplingMethod: string;
  participants: string[];
  sampleQuantity: number;
  unit: string;
  packaging: string;
  sealCode: string;
  notes: string;
}

export interface PcnSampleCodingForm extends PcnOperationalFormMetadata {
  codedAt: string;
  coder: string;
  lotCode: string;
  sampleCodes: string[];
  sealCode: string;
  notes: string;
}

export interface PcnEvaluationReportForm extends PcnOperationalFormMetadata {
  reportNumber: string;
  reportedAt: string;
  findings: string;
  conclusion: string;
  nonconformities: string[];
  recommendations: string;
  notes: string;
}

export interface PcnCommercialForm extends PcnOperationalFormMetadata {
  contractNumber: string;
  signedAt: string;
  customerSigner: string;
  pcnSigner: string;
  serviceScope: string;
  serviceValue: string;
  paymentTerms: string;
  notes: string;
}

export interface PcnOperationalForms {
  assignment?: PcnAssignmentForm;
  evaluationPlan?: PcnEvaluationPlanForm;
  fieldInspection?: PcnFieldInspectionForm;
  sampleTaking?: PcnSampleTakingForm;
  sampleCoding?: PcnSampleCodingForm;
  evaluationReport?: PcnEvaluationReportForm;
  commercial?: PcnCommercialForm;
}

/** Independent document workspace used for customer-facing or ad-hoc PCN drafting. */
export type PcnDraftFormKind =
  | 'PROPOSAL_FORM'
  | 'DOSSIER_COVER'
  | 'ASSIGNMENT_FORM'
  | 'EVALUATION_PLAN'
  | 'FIELD_INSPECTION'
  | 'SAMPLE_TAKING'
  | 'SAMPLE_CODING'
  | 'SAMPLE_HANDOVER'
  | 'LAB_REQUEST'
  | 'EVALUATION_REPORT'
  | 'CERTIFICATION_RESULT'
  | 'COMMERCIAL'
  | 'CLIENT_PACKAGE';

export type PcnDraftWorkspaceStatus = 'DRAFT' | 'GENERATED' | 'ARCHIVED';

export interface PcnDraftOutput {
  id: string;
  format: 'DOCX' | 'PDF';
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  generatedAt: string;
}

export interface PcnDraftWorkspace {
  id: string;
  title: string;
  formKind: PcnDraftFormKind;
  templateId: string;
  sourceProposalId?: string;
  sourceDossierId?: string;
  fieldCodes: PcnCertificationFieldCode[];
  values: Record<string, unknown>;
  status: PcnDraftWorkspaceStatus;
  outputAssetIds?: string[];
  outputs?: PcnDraftOutput[];
  createdByUsername: string;
  updatedByUsername: string;
  createdAt: string;
  updatedAt: string;
}

export type PcnRetentionState = 'ACTIVE' | 'PAPER_REVIEW_DUE' | 'DIGITAL_REVIEW_DUE' | 'LEGAL_HOLD';

export interface PcnRetentionMetadata {
  policyVersion: string;
  retentionStartAt: string;
  paperRetentionUntil: string;
  digitalRetentionUntil: string;
  legalHold: boolean;
  legalHoldReason?: string;
  legalHoldBy?: string;
  legalHoldAt?: string;
}

export interface CertificationDossier {
  id: string;
  dossierCode: string;
  proposalId: string;
  /** Snapshot captured when the Đề nghị is converted; optional for legacy rows. */
  customerSnapshot?: Pick<CustomerRef, 'name' | 'address' | 'taxId' | 'phone' | 'email' | 'contactPerson'>;
  fieldCodes: PcnCertificationFieldCode[];
  method: PcnCertificationMethod;
  status: PcnDossierStatus;
  /** One accountable PCN operator from intake through packaging and archive. */
  ownerUsername?: string;
  /** Explicit operator-confirmed reason for an exception-lane status. */
  exceptionReason?: string;
  evaluatorUsername?: string;
  reviewerUsername?: string;
  targetDate?: string;
  evaluationAt?: string;
  effectiveAt?: string;
  operationalForms?: PcnOperationalForms;
  /** Explicit per-document decisions used by the sequential workflow gate. */
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
  labRequestIds: string[];
  returnedResultIds: string[];
  sampleLotIds?: string[];
  issuancePackageId?: string;
  retention?: PcnRetentionMetadata;
  createdAt?: string;
  updatedAt?: string;
  historicalImport?: PcnHistoricalImportMetadata;
}

export interface PcnDossierDocumentWaiver {
  requirementId: string;
  reason: string;
  decidedAt: string;
  decidedByUsername: string;
}

export type PcnHistoricalImportReviewStatus = 'PENDING_REVIEW' | 'REVIEWED';

export interface PcnHistoricalImportMetadata {
  batchId: string;
  sourceFamily: 'QC4' | 'QC9';
  sourceFolderName: string;
  sourceRelativePath: string;
  /** Source-only test-scope hint; never proves procedural completeness. */
  variantHint?: string;
  reviewStatus: PcnHistoricalImportReviewStatus;
  unresolvedFields: string[];
  importedAt: string;
}

export type PcnHistoricalFileKind =
  | 'PROPOSAL'
  | 'COMMERCIAL'
  | 'SAMPLE_HANDOVER'
  | 'SAMPLE_RETURN'
  | 'TEST_REPORT'
  | 'CORRECTIVE_ACTION'
  | 'CERTIFICATE'
  | 'DECISION'
  | 'PHOTO'
  | 'OTHER';

export type PcnAttachmentMappingStatus = 'AUTO_MAPPED' | 'UNMAPPED' | 'MANUAL_MAPPED';

export interface PcnDossierAttachment {
  id: string;
  dossierId: string;
  fieldCode: PcnCertificationFieldCode;
  kind: PcnHistoricalFileKind;
  requirementId?: string;
  mappingStatus?: PcnAttachmentMappingStatus;
  mappingReason?: string;
  fileName: string;
  sourceRelativePath: string;
  assetId: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  importedAt: string;
  note?: string;
}

export type PcnGeneratedDocumentKind = 'DOSSIER_COVER' | 'PROPOSAL_SUMMARY' | 'PROPOSAL_FORM' | 'ASSIGNMENT_FORM' | 'EVALUATION_PLAN' | 'FIELD_INSPECTION' | 'SAMPLE_TAKING' | 'SAMPLE_CODING' | 'EVALUATION_REPORT' | 'SAMPLE_HANDOVER' | 'SAMPLE_RETURN' | 'LAB_REQUEST';
export type PcnGeneratedDocumentFormat = 'DOCX' | 'PDF';

export interface PcnGeneratedDocument {
  id: string;
  dossierId: string;
  kind: PcnGeneratedDocumentKind;
  /** Set only for LAB_REQUEST; sample forms use the sampleLotId/sampleRouteId pointers below. */
  labRequestId?: string;
  sampleLotId?: string;
  sampleRouteId?: string;
  format: PcnGeneratedDocumentFormat;
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  contextHash: string;
  sourceUpdatedAt?: string;
  generatedAt: string;
  generatedBy?: string;
}

export type PcnOfficialDocumentKind =
  | 'PROPOSAL'
  | 'CERTIFICATE'
  | 'DECISION'
  | 'SAMPLE_HANDOVER'
  | 'EVALUATION_REPORT';

export type PcnTemplateFormat = 'DOCX' | 'DOC';
export type PcnTemplateStatus = 'DISCOVERED' | 'NEEDS_ANNOTATION' | 'APPROVED' | 'RETIRED';
export type PcnTemplateStorageScope = 'PCN_PRIVATE';
export type PcnTemplateReviewAction = 'APPROVE' | 'REQUEST_ANNOTATION' | 'RETIRE';
export type PcnTemplatePrivateAssetVerificationIssue =
  | 'MISSING_ASSET'
  | 'ASSET_NOT_FOUND'
  | 'BUCKET_MISMATCH'
  | 'SOURCE_COLLECTION_MISMATCH'
  | 'SOURCE_DOCUMENT_MISMATCH'
  | 'SOURCE_JSON_PATH_MISMATCH'
  | 'MIME_TYPE_MISMATCH'
  | 'BYTE_SIZE_MISMATCH'
  | 'SHA256_MISMATCH';

export interface PcnTemplateFingerprint {
  /** Optional authoring-only reference; runtime projections deliberately omit it. */
  sourceRelativePath?: string;
  byteSize: number;
  sha256?: string;
}

export interface PcnTemplateAnnotationMapping {
  key: string;
  sourceText: string;
  occurrence?: number;
}

export interface PcnTemplateAnnotation {
  sourceAssetId: string;
  sourceSha256: string;
  appliedAt: string;
  appliedBy: string;
  mappings: PcnTemplateAnnotationMapping[];
}

export interface PcnTemplateDefinition {
  id: string;
  fieldCode: PcnCertificationFieldCode;
  documentKind: PcnOfficialDocumentKind;
  method?: PcnCertificationMethod;
  variant?: string;
  displayName: string;
  /** Authoring-only label; never shown or returned by the runtime projection. */
  sourceLabel?: string;
  format: PcnTemplateFormat;
  status: PcnTemplateStatus;
  placeholderKeys: string[];
  requiredPlaceholderKeys: string[];
  sourceFingerprint: PcnTemplateFingerprint;
  sourceOriginalFingerprint?: PcnTemplateFingerprint;
  annotation?: PcnTemplateAnnotation;
  fileAssetId?: string;
  storageScope?: PcnTemplateStorageScope;
  importedByUsername?: string;
  importedAt?: string;
  approvedByUsername?: string;
  approvedAt?: string;
  /** Read-only server projection; never persisted in the catalog payload. */
  privateAssetVerified?: boolean;
  /** Read-only server projection; safe reason for an unverified private asset. */
  privateAssetVerificationIssue?: PcnTemplatePrivateAssetVerificationIssue;
}

export type PcnQualityDocumentCategory = 'VICAS' | 'VIAS' | 'ISO' | 'DESIGNATION' | 'PROCEDURE';
export type PcnQualityDocumentStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'RETIRED';

export interface PcnQualityDocument {
  id: string;
  documentCode: string;
  title: string;
  category: PcnQualityDocumentCategory;
  fieldCodes?: PcnCertificationFieldCode[];
  version: string;
  status: PcnQualityDocumentStatus;
  issuedAt?: string;
  effectiveFrom?: string;
  validUntil?: string;
  ownerUsername?: string;
  fileAssetId?: string;
  fileName?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PcnOfficialGeneratedDocument {
  id: string;
  issuanceId: string;
  dossierId: string;
  templateId: string;
  documentKind: PcnOfficialDocumentKind;
  format: PcnGeneratedDocumentFormat;
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  contextHash: string;
  sourceUpdatedAt?: string;
  generatedAt: string;
  generatedBy?: string;
}

export type PcnDocumentRequirementStage =
  | 'INTAKE'
  | 'LAB_ROUTING'
  | 'TECHNICAL_REVIEW'
  | 'ISSUANCE'
  | 'DELIVERY'
  | 'ARCHIVE';

/** Pipeline stations used to route a checklist item to the exact work area. */
export type PcnDossierStationKey =
  | 'INTAKE'
  | 'DOCUMENTS'
  | 'ASSIGNMENT'
  | 'EVALUATION'
  | 'SAMPLING_LAB'
  | 'RESULTS'
  | 'CORRECTION'
  | 'TECHNICAL_REVIEW'
  | 'APPROVAL'
  | 'ISSUANCE'
  | 'DELIVERY_ARCHIVE'
  | 'EXCEPTIONS';

export interface PcnDocumentRequirement {
  id: string;
  fieldCode: PcnCertificationFieldCode;
  code: string;
  name: string;
  description?: string;
  stages: PcnDocumentRequirementStage[];
  /** Optional precise routing; omitted on older configurations for compatibility. */
  stationKeys?: PcnDossierStationKey[];
  required: boolean;
  active: boolean;
  sortOrder: number;
}

export interface PcnDossierDocumentVersion {
  assetId: string;
  fileName: string;
  mimeType?: string;
  byteSize?: number;
  sha256?: string;
  uploadedAt: string;
  uploadedBy?: string;
  note?: string;
}

export interface PcnDossierDocument {
  id: string;
  dossierId: string;
  requirementId: string;
  fieldCode: PcnCertificationFieldCode;
  currentVersionId?: string;
  versions: PcnDossierDocumentVersion[];
  status: 'MISSING' | 'PRESENT';
  createdAt?: string;
  updatedAt?: string;
}

export type PcnSampleLabCode = 'PERFORMANCE' | 'EMC' | 'ELECTRICAL_SAFETY' | 'CHEMICAL_ANALYSIS';

export const PCN_SAMPLE_LAB_OPTIONS: Array<{ code: PcnSampleLabCode; name: string }> = [
  { code: 'PERFORMANCE', name: 'Phòng thử nghiệm Hiệu suất' },
  { code: 'EMC', name: 'Phòng thử EMC' },
  { code: 'ELECTRICAL_SAFETY', name: 'Phòng thử An toàn điện' },
  { code: 'CHEMICAL_ANALYSIS', name: 'Phân tích thành phần hóa học / Hóa lý' },
];

export type PcnSampleRouteStatus =
  | 'PENDING'
  | 'SENT'
  | 'RECEIVED'
  | 'RESULT_RETURNED'
  | 'RETURNED_TO_PCN'
  | 'CLOSED'
  | 'ISSUE'
  | 'CANCELLED';

export type PcnSampleExecutionStatus =
  | 'UNSCHEDULED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED';

export type PcnSampleExecutionOutcome = 'PENDING' | 'PASS' | 'FAIL';

/** Remote execution facts owned by the target testing-room application. */
export interface PcnSampleExecutionSnapshot {
  status: PcnSampleExecutionStatus;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: PcnSampleExecutionOutcome;
  sourceSystemCode?: string;
  externalStatusCode?: string;
  externalReportNumber?: string;
  lastExternalEventId?: string;
  lastExternalSequence?: number;
  lastSyncedAt?: string;
}

export type PcnLabRequestIntegrationSyncStatus =
  | 'NOT_SENT'
  | 'PENDING'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'ERROR';

/** Server-to-server identity and delivery facts; never stores the shared secret. */
export interface PcnLabRequestIntegrationLink {
  targetSystemCode: string;
  syncStatus: PcnLabRequestIntegrationSyncStatus;
  idempotencyKey?: string;
  externalRequestId?: string;
  externalRequestCode?: string;
  payloadFingerprint?: string;
  lastAttemptAt?: string;
  acknowledgedAt?: string;
  lastSyncedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastExternalSequence?: number;
}

export type PcnSampleLotStatus =
  | 'PREPARED'
  | 'IN_TRANSIT'
  | 'AT_LAB'
  | 'RESULTS_PENDING'
  | 'RETURNED_TO_PCN'
  | 'CLOSED'
  | 'ISSUE';

export type PcnSampleFlowEventType =
  | 'LOT_CREATED'
  | 'SENT_TO_LAB'
  | 'LAB_RECEIVED'
  | 'RESULT_RETURNED'
  | 'SAMPLE_RETURNED'
  | 'CLOSED'
  | 'ISSUE_RECORDED'
  | 'UPDATED';

export interface PcnSampleLot {
  id: string;
  dossierId: string;
  lotCode: string;
  /** Stable child item ids. Optional only for legacy single-sample lots. */
  sampleItemIds?: string[];
  sampleName: string;
  model?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  fieldCodes: PcnCertificationFieldCode[];
  /** Snapshot used by QC20 to keep the material/lot identity with the sample. */
  qc20Snapshot?: Pick<PcnQc20ScopeSnapshot, 'grade' | 'nominalDimensions' | 'manufacturerLotCode' | 'lotDefinition'>;
  routeIds: string[];
  status: PcnSampleLotStatus;
  currentLocation: string;
  receivedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** One physical sample/model inside exactly one sample lot. */
export interface PcnSampleItem {
  id: string;
  sampleLotId: string;
  sampleCode: string;
  sampleType: string;
  model: string;
  brand?: string;
  quantity: number;
  unit?: string;
  serialNumbers?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Per-item facts when one route/PYC contains several sample models. */
export interface PcnSampleRouteItemSnapshot {
  status?: PcnSampleRouteStatus;
  execution?: PcnSampleExecutionSnapshot;
  sentAt?: string;
  receivedAt?: string;
  resultReturnedAt?: string;
  returnedAt?: string;
  note?: string;
}

export interface PcnSampleRoute {
  id: string;
  sampleLotId: string;
  labCode: PcnSampleLabCode;
  labName: string;
  status: PcnSampleRouteStatus;
  /** 1-based order inside this lot; legacy routes may omit it. */
  sequence?: number;
  /** Empty/omitted means the route applies to every item for legacy data. */
  sampleItemIds?: string[];
  /** Item-level route/execution snapshots; route fields remain the legacy aggregate fallback. */
  itemSnapshots?: Record<string, PcnSampleRouteItemSnapshot>;
  labRequestId?: string;
  execution?: PcnSampleExecutionSnapshot;
  sentAt?: string;
  receivedAt?: string;
  resultReturnedAt?: string;
  returnedAt?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Canonical handover facts captured before a sample handover document is generated. */
export interface PcnSampleHandoverDetails {
  senderName: string;
  senderUnit?: string;
  receiverName: string;
  receiverUnit?: string;
  handoverAt: string;
  receivedAt?: string;
  location: string;
  vehicle?: string;
  driver?: string;
  quantity: number;
  sampleCodes: string[];
  note?: string;
}

export interface PcnSampleFlowEvent {
  id: string;
  sampleLotId: string;
  routeId?: string;
  labRequestId?: string;
  idempotencyFingerprint?: string;
  sourceSystemCode?: string;
  externalEventId?: string;
  externalRequestId?: string;
  externalSequence?: number;
  sampleItemIds?: string[];
  type: PcnSampleFlowEventType;
  fromStatus?: PcnSampleRouteStatus;
  toStatus?: PcnSampleRouteStatus;
  location: string;
  note?: string;
  actorUsername?: string;
  occurredAt: string;
}

export type PcnLabRequestStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'RESULT_RETURNED' | 'CANCELLED';

export type PcnSampleIssueType = 'MISMATCH' | 'DAMAGED' | 'INSUFFICIENT' | 'MISSING_DOCUMENT' | 'OTHER';

export interface PcnSampleIssue {
  type: PcnSampleIssueType;
  description: string;
  reportedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface OutboundLabRequest {
  id: string;
  pycNumber: string;
  dossierId: string;
  fieldCode: PcnCertificationFieldCode;
  laboratoryName: string;
  /** Optional link to the tracked PCN lot/route that this outbound PYC serves. */
  sampleLotId?: string;
  sampleRouteId?: string;
  integration?: PcnLabRequestIntegrationLink;
  status: PcnLabRequestStatus;
  requestedAt: string;
  targetDate?: string;
  criteria?: string;
  handoverDocumentId?: string;
  handoverAt?: string;
  receivedAt?: string;
  handoverNote?: string;
  handoverDetails?: PcnSampleHandoverDetails;
  sampleIssue?: PcnSampleIssue;
  returnedResultId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PcnResultOutcome = 'PASS' | 'FAIL' | 'PENDING';

export interface ReturnedTestResult {
  id: string;
  dossierId: string;
  labRequestId: string;
  round: number;
  outcome: PcnResultOutcome;
  receivedAt: string;
  reportNumber?: string;
  fileAssetId?: string;
  notes?: string;
  isOfficial?: boolean;
  sampleIssue?: PcnSampleIssue;
  ocrEvidence?: PcnOcrEvidence;
  createdAt?: string;
  updatedAt?: string;
}

export type PcnIssuanceDocumentType = 'CERTIFICATE' | 'DECISION';
export type PcnApprovalStepStatus = 'PENDING' | 'APPROVED' | 'RETURNED';
export type PcnApprovalDecision = 'APPROVE' | 'RETURN';
export type PcnIssuanceStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'ISSUED' | 'DELIVERED' | 'ARCHIVED';

export type PcnSignerDelegationStatus = 'ACTIVE' | 'REVOKED';

export interface PcnSignerDelegation {
  id: string;
  grantorUsername: string;
  delegateUsername: string;
  fieldCodes: PcnCertificationFieldCode[];
  effectiveFrom: string;
  effectiveUntil: string;
  reason: string;
  approvedByUsername: string;
  status: PcnSignerDelegationStatus;
  createdAt?: string;
  updatedAt?: string;
  revokedAt?: string;
  revokedByUsername?: string;
}

export interface PcnApprovalStep {
  id: string;
  dossierId: string;
  sequence: number;
  role: string;
  assigneeUsername?: string;
  status: PcnApprovalStepStatus;
  comment?: string;
  actedAt?: string;
  createdAt?: string;
}

export interface IssuancePackage {
  id: string;
  dossierId: string;
  certificateTemplateCode: string;
  decisionTemplateCode: string;
  documentType: PcnIssuanceDocumentType;
  status: PcnIssuanceStatus;
  approvalStepIds?: string[];
  issuanceNumber?: string;
  issuedAt?: string;
  signerUsername?: string;
  fileAssetIds: string[];
  deliveryRecipient?: string;
  deliveryNote?: string;
  deliveredAt?: string;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductRef {
  id?: string;
  name: string;
  testTimeEMC?: number;
  testTimeATD?: number;
  updatedAt?: string;
  createdAt?: string;
}

export interface Tester {
  name: string;
  shortName: string;
  colorClass: string;
  position?: string;
  responsibilities?: string;
  phone?: string;
}

export type NotificationEntityType =
  | 'REQUEST'
  | 'HANDOVER_DOC'
  | 'KQTN_RECORD'
  | 'SCHEDULE'
  | 'PCN_PROPOSAL'
  | 'PCN_DOSSIER'
  | 'PCN_SAMPLE_LOT'
  | 'PCN_LAB_REQUEST'
  | 'PCN_RESULT'
  | 'PCN_APPROVAL'
  | 'PCN_ISSUANCE';

export type NotificationAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'SCHEDULED' | 'UNSCHEDULED' | 'ASSIGNED';

export type ActivityLogAction = NotificationAction | 'IMPORTED' | 'RESTORED' | 'CONFIGURED';

export type ActivityLogEntityType =
  | NotificationEntityType
  | 'PCN_PROPOSAL'
  | 'PCN_DOSSIER'
  | 'PCN_CUSTOMER'
  | 'PCN_LAB_REQUEST'
  | 'PCN_RESULT'
  | 'PCN_APPROVAL'
  | 'PCN_ISSUANCE'
  | 'PCN_TEMPLATE'
  | 'PCN_FIELD'
  | 'PCN_USER'
  | 'PCN_SIGNER_DELEGATION'
  | 'PCN_QUALITY_DOCUMENT'
  | 'PCN_DRAFT'
  | 'PCN_SAMPLE_LOT'
  | 'USER'
  | 'CUSTOMER'
  | 'PRODUCT'
  | 'BRAND'
  | 'SYSTEM_SETTINGS'
  | 'SYSTEM';

export interface ActivityLogChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ActivityLog {
  id: string;
  createdAt: string;
  actorUsername?: string;
  actorName: string;
  actorRole?: UserRole;
  action: ActivityLogAction;
  entityType: ActivityLogEntityType;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  summary: string;
  changes?: ActivityLogChange[];
  source: 'UI' | 'USER_REVIEW' | 'IMPORT' | 'RESTORE' | 'SYSTEM';
  groupId?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
}

export interface ActivityKpiSummary {
  actorUsername: string;
  actorName: string;
  totalActions: number;
  requestsCreated: number;
  samplesProcessed: number;
  kqtnUpdated: number;
  handoversCreated: number;
  workActions: number;
  requestActions: number;
  kqtnActions: number;
  handoverActions: number;
  scheduleActions: number;
  otherActions: number;
  lastActivityAt: string | null;
}

export type NotificationTargetRole = 'admin' | 'staff' | 'all';

export type AppNotificationType = 'NEW_REQUEST' | 'STATUS_CHANGE' | 'BUSINESS_ACTIVITY' | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  entityType?: NotificationEntityType;
  action?: NotificationAction;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  customerName?: string;
  modelName?: string;
  testCategory?: TestCategory;
  previousStatus?: string;
  nextStatus?: string;
  scheduledDate?: string | null;
  createdBy?: string;
  createdAt: string;
  read: boolean;
  targetRole?: NotificationTargetRole;
  targetUsernames?: string[];
}

export const LAB_CONSTANTS = {
  CAPACITY_NORMAL: 8,
  CAPACITY_PEAK: 22,
  DAYS_PER_MONO: 2,
  DAYS_PER_INVERTER: 3,
  HOURS_PER_WORK_DAY: 8,
  PEAK_LOAD_THRESHOLD: 15,
  TURNAROUND_MONO_DAYS: 2,
  TURNAROUND_INVERTER_DAYS: 3
};

export const LAB_METADATA = {
  name: 'Trung tâm Thử nghiệm - Kiểm định Công nghiệp',
  addresses: [
    'Số 3 ngõ 76 đường Trung Văn, Phường Đại Mỗ, Thành phố Hà Nội',
    'Số 565 đường Nguyễn Trãi, Phường Thanh Liệt, Thành phố Hà Nội'
  ],
  staff: [
    { name: 'Vũ Việt Anh', position: 'Phó trưởng phòng' },
    { name: 'Lương Xuân Hùng', position: 'Phó trưởng phòng' },
    { name: 'Vũ Ngọc Linh', position: 'Thử nghiệm EMC' },
    { name: 'Nguyễn Mạnh Trọng', position: 'Thử nghiệm EMC' },
    { name: 'Tống Đăng Quý', position: 'Thử nghiệm dây cáp điện' },
    { name: 'Lã Trung Sơn', position: 'Thử nghiệm ATĐ' },
    { name: 'Vũ Nam Thái', position: 'Thử nghiệm ATĐ' },
    { name: 'Lại Minh Quang', position: 'Thử nghiệm ATĐ (cáp)' }
  ]
};

export const INITIAL_TESTERS: Tester[] = [
  { name: 'Vũ Việt Anh', shortName: 'Việt Anh', colorClass: 'bg-tester-1 text-tester-1-fg border-tester-1-fg/20', position: 'Phó trưởng phòng' },
  { name: 'Lương Xuân Hùng', shortName: 'Hùng', colorClass: 'bg-tester-2 text-tester-2-fg border-tester-2-fg/20', position: 'Phó trưởng phòng' },
  { name: 'Vũ Ngọc Linh', shortName: 'Linh', colorClass: 'bg-tester-3 text-tester-3-fg border-tester-3-fg/20', position: 'Thử nghiệm EMC' },
  { name: 'Nguyễn Mạnh Trọng', shortName: 'Trọng', colorClass: 'bg-tester-4 text-tester-4-fg border-tester-4-fg/20', position: 'Thử nghiệm EMC' },
  { name: 'Tống Đăng Quý', shortName: 'Quý', colorClass: 'bg-tester-5 text-tester-5-fg border-tester-5-fg/20', position: 'Thử nghiệm dây cáp điện' },
  { name: 'Lã Trung Sơn', shortName: 'Sơn', colorClass: 'bg-tester-6 text-tester-6-fg border-tester-6-fg/20', position: 'Thử nghiệm ATĐ' },
  { name: 'Vũ Nam Thái', shortName: 'Thái', colorClass: 'bg-tester-7 text-tester-7-fg border-tester-7-fg/20', position: 'Thử nghiệm ATĐ' },
  { name: 'Lại Minh Quang', shortName: 'Quang', colorClass: 'bg-tester-8 text-tester-8-fg border-tester-8-fg/20', position: 'Thử nghiệm ATĐ (cáp)' },
  { name: 'Khác', shortName: 'Khác', colorClass: 'bg-tester-other text-tester-other-fg border-tester-other-fg/20', position: '' },
];

export const DEFAULT_TESTER = INITIAL_TESTERS[0].name;

export type UserRole = 'admin' | 'tester' | 'staff' | 'viewer' | 'guest' | 'office_clerk';

export type PcnSystemRole = 'admin' | 'staff' | 'viewer';
export type PcnDepartmentRoleCode =
  | 'LEADERSHIP'
  | 'CERTIFICATION_EXPERT'
  | 'TECHNICAL_REVIEWER'
  | 'SAMPLE_COORDINATOR'
  | 'DOCUMENT_CLERK'
  | 'UNASSIGNED';

export type PcnOcrProvider = 'PADDLEOCR' | 'GEMINI' | 'DISABLED';

export type PcnOcrEvidenceProvider = Exclude<PcnOcrProvider, 'DISABLED'>;

export interface PcnOcrEvidence {
  provider: PcnOcrEvidenceProvider;
  sourceFileName: string;
  sourcePage?: number;
  confidence: number;
  confirmedAt: string;
  confirmedBy?: string;
}

export interface PcnOcrDraft {
  fields: Record<string, string>;
  confidence: number;
  sourcePage?: number;
  sourceFileName?: string;
  provider?: PcnOcrEvidenceProvider;
  confirmed?: boolean;
}

export type PcnOcrContext = 'proposal' | 'result';

export interface PcnSettings {
  id: 'pcn-settings';
  fieldCodes: PcnCertificationFieldCode[];
  labRoutes: Record<PcnCertificationFieldCode, PcnSampleLabCode[]>;
  checklist: {
    requireFilesBeforeAdvance: boolean;
    showCompletenessToManagers: boolean;
  };
  coding: {
    proposalPrefix: string;
    dossierPrefix: string;
    sampleLotPrefix: string;
  };
  ocr: {
    enabled: boolean;
    provider: PcnOcrProvider;
    confidenceThreshold: number;
  };
  storage: {
    bucket: string;
    privateOnly: true;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export const PCN_DEPARTMENT_ROLE_OPTIONS: Array<{ code: PcnDepartmentRoleCode; name: string }> = [
  { code: 'LEADERSHIP', name: 'Lãnh đạo phòng' },
  { code: 'CERTIFICATION_EXPERT', name: 'Chuyên gia chứng nhận' },
  { code: 'TECHNICAL_REVIEWER', name: 'Người soát xét kỹ thuật' },
  { code: 'SAMPLE_COORDINATOR', name: 'Điều phối / tiếp nhận mẫu' },
  { code: 'DOCUMENT_CLERK', name: 'Văn thư hồ sơ' },
  { code: 'UNASSIGNED', name: 'Chưa phân công' },
];

export interface UserAccount {
  username: string;
  name: string;
  role: UserRole;
  position?: string;
  phone?: string;
  email?: string;
  systemRole?: PcnSystemRole;
  departmentRoleCode?: PcnDepartmentRoleCode;
  fieldCodes?: PcnCertificationFieldCode[];
  active?: boolean;
}

export interface PcnUserAccount extends UserAccount {
  role: PcnSystemRole;
  systemRole: PcnSystemRole;
  departmentRoleCode: PcnDepartmentRoleCode;
  fieldCodes: PcnCertificationFieldCode[];
  active: boolean;
}

export interface UserPreferences {
  customPassword?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  avatarUrl?: string;
}

export const PRESET_ACCOUNTS: UserAccount[] = [
  { username: 'luongxuanhung', name: 'Lương Xuân Hùng', role: 'admin', position: 'Phó trưởng phòng' },
  { username: 'vuvietanh', name: 'Vũ Việt Anh', role: 'admin', position: 'Phó trưởng phòng' },
  { username: 'nguyenanhthu', name: 'Nguyễn Anh Thư', role: 'office_clerk', position: 'Văn thư chuyên trách' },
  { username: 'tongdangquy', name: 'Tống Đăng Quý', role: 'tester', position: 'Nhân viên' },
  { username: 'latrungson', name: 'Lã Trung Sơn', role: 'tester', position: 'Nhân viên' },
  { username: 'vunamthai', name: 'Vũ Nam Thái', role: 'tester', position: 'Nhân viên' },
  { username: 'nguyenmanhtrong', name: 'Nguyễn Mạnh Trọng', role: 'tester', position: 'Nhân viên' },
  { username: 'vutienlinh', name: 'Vũ Ngọc Linh', role: 'tester', position: 'Nhân viên' },
  { username: 'laiminhquang', name: 'Lại Minh Quang', role: 'tester', position: 'Nhân viên' },
  { username: 'tranhoangphuong', name: 'Trần Hoàng Phương', role: 'guest', position: 'Khách' },
  { username: 'nguyentuanthanh', name: 'Nguyễn Tuấn Thành', role: 'guest', position: 'Khách' },
  { username: 'vuthitham', name: 'Vũ Thị Thắm', role: 'guest', position: 'Khách' },
  { username: 'dangducbinh', name: 'Đặng Đức Bình', role: 'guest', position: 'Khách' },
  { username: 'nguyenquocviet', name: 'Nguyễn Quốc Việt', role: 'guest', position: 'Khách' },
  { username: 'buithivananh', name: 'Bui Thị Vân Anh', role: 'guest', position: 'Khách' },
  { username: 'nguyenthivananh', name: 'Bui Thị Vân Anh ', role: 'guest', position: 'Khách' }
];

export const getProductDefaultTime = (name: string): { testTimeEMC: number; testTimeATD: number } => {
  const norm = (name || '').toLowerCase().trim();
  if (
    norm === 'bếp điện từ đôi' ||
    norm === 'bếp điện từ đôi âm' ||
    norm === 'bếp điện từ đôi hồng ngoại' ||
    norm.includes('bếp điện từ đôi') ||
    norm.includes('bếp từ đôi')
  ) {
    return { testTimeEMC: 530, testTimeATD: 60 };
  }
  return { testTimeEMC: 480, testTimeATD: 60 };
};

export interface KQTNVersionHistory {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeNote: string;
  summaryChanges?: string;
  snapshotData?: {
    reportMeta?: any;
    testResults?: any;
    emcData?: any;
    dayCapDienData?: any;
  };
}

export interface KqtnPdfMetadata {
  assetId: string;
  bucketName: string;
  objectPath: string;
  originalName: string;
  mimeType: 'application/pdf';
  byteSize: number;
  sha256: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface KQTNRecord {
  id: string;
  requestId?: string;
  requestCode?: string;
  sampleCode: string;
  sampleKey?: string;
  reportNo: string;
  sealStamp?: string;
  sampleName: string;
  model: string;
  brand?: string;
  senderUnit?: string;
  standardId: string;
  standardTitle: string;
  criteriaType?: 'full' | 'reduced';
  subOptionTitle?: string;
  testDate?: string;
  reportDate?: string;
  testerName?: string;
  managerName?: string;
  testResultsData?: Record<string, any>;
  emcData?: any;
  dayCapDienData?: any;
  productPhoto1?: string;
  productPhoto2?: string;
  nameplatePhoto1?: string;
  nameplatePhoto2?: string;
  nameplatePhotos?: string[];
  resultPdf?: KqtnPdfMetadata;
  customerPaymentConfirmed?: boolean;
  customerPaymentConfirmedAt?: string;
  customerPaymentConfirmedBy?: string;
  version: number;
  versionHistory: KQTNVersionHistory[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  isSynced?: boolean;
}

export interface LotDiagnosisResult {
  targetQuery: string;
  foundInPostgresServer: boolean;
  foundInPostgresCache: boolean;
  foundInLocal: boolean;
  isDeleted: boolean;
  isHiddenByFilter: boolean;
  hiddenReason?: string;
  matchedRecord?: {
    id: string;
    requestCode?: string;
    encodeNumber?: string;
    sampleCode?: string;
    sampleName?: string;
    customerName?: string;
    requestDate?: string;
    createdAt?: string;
    updatedAt?: string;
    sampleStatus?: string;
    source: 'postgres-server' | 'postgres-cache' | 'local';
  };
  diagnosis: string;
  suggestedAction: string;
}

export interface SyncDiagnosticReport {
  timestamp: string;
  durationMs: number;
  postgres: {
    status: 'success' | 'warning' | 'error';
    fromCache: boolean;
    error?: string;
    collections: {
      requests: number;
      handoverDocs: number;
      customers: number;
      products: number;
      brands: number;
      systemUsers: number;
      systemConfig: number;
      kqtnRecords: number;
      notifications: number;
    };
  };
  comparison: {
    localTotalRequests: number;
    cloudTotalRequests: number;
    localLatestRequest?: {
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      createdAt?: string;
      updatedAt?: string;
      requestDate?: string;
    } | null;
    cloudLatestRequest?: {
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      createdAt?: string;
      updatedAt?: string;
      requestDate?: string;
    } | null;
    timeDifferenceSeconds?: number;
    recentCloudRequests: Array<{
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      customerName?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };
  lotDiagnosis?: LotDiagnosisResult;
}

// --- End of types.ts ---
