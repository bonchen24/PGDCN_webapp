import type { CustomerRef } from '../types.ts';
import type { PgdDocumentTemplateSnapshot } from './pgdDocumentTemplates.ts';

export const PGD_DOMAIN = 'pgd' as const;

export const PGD_COLLECTIONS = {
  catalog: 'pgdCatalog',
  requests: 'pgdInspectionRequests',
  assignments: 'pgdInspectionAssignments',
  fieldInspections: 'pgdFieldInspections',
  samples: 'pgdSamples',
  labRequests: 'pgdLabRequests',
  labResults: 'pgdLabResults',
  resultTemplates: 'pgdResultTemplates',
  documentTemplates: 'pgdDocumentTemplates',
  reports: 'pgdInspectionReports',
  certificates: 'pgdInspectionCertificates',
  approvals: 'pgdApprovalSteps',
  documents: 'pgdDocuments',
  dossierDocuments: 'pgdDossierDocuments',
  activityLogs: 'pgdActivityLogs',
} as const;

export type PgdInspectionStatus =
  | 'DRAFT'
  | 'CAPABILITY_REVIEW'
  | 'READY_TO_EXECUTE'
  | 'PREPARING'
  | 'FIELD_INSPECTION'
  | 'WAITING_LAB_RESULTS'
  | 'RESULTS_REVIEW'
  | 'TECHNICAL_REVIEW'
  | 'LEADERSHIP_APPROVAL'
  | 'SIGNED'
  | 'RESULT_RETURNED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type PgdIntakeChannel = 'DIRECT' | 'PHONE' | 'ONLINE_ZALO' | 'EMAIL' | 'OTHER';
export const PGD_ASSESSMENT_METHOD_OPTIONS = [
  { code: 'METHOD_7', name: 'Phương thức 7' },
] as const;
export type PgdAssessmentMethod = typeof PGD_ASSESSMENT_METHOD_OPTIONS[number]['code'];
export type PgdProductGroup = 'STEEL_METAL' | 'MACHINERY_LINE' | 'COAL' | 'OTHER';
export type PgdSampleDisposition = 'LAB' | 'RETAINED';
export type PgdLabRequestStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'RESULT_RECEIVED' | 'ISSUE' | 'CLOSED';
export type PgdApprovalStatus = 'PENDING' | 'APPROVED' | 'RETURNED';
export type PgdResultFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'TABLE';

export interface PgdWorkflowState {
  code: PgdInspectionStatus;
  label: string;
  order: number;
}

export const PGD_WORKFLOW_STATES: readonly PgdWorkflowState[] = [
  ['DRAFT', 'Bản nháp'],
  ['CAPABILITY_REVIEW', 'Xem xét năng lực'],
  ['READY_TO_EXECUTE', 'Đã chấp nhận thực hiện'],
  ['PREPARING', 'Chuẩn bị giám định'],
  ['FIELD_INSPECTION', 'Giám định hiện trường'],
  ['WAITING_LAB_RESULTS', 'Chờ kết quả PTN'],
  ['RESULTS_REVIEW', 'Xem xét kết quả'],
  ['TECHNICAL_REVIEW', 'Soát xét kỹ thuật'],
  ['LEADERSHIP_APPROVAL', 'Phê duyệt lãnh đạo'],
  ['SIGNED', 'Đã ký'],
  ['RESULT_RETURNED', 'Đã trả kết quả'],
  ['ARCHIVED', 'Đã lưu trữ'],
].map(([code, label], order) => ({ code: code as PgdInspectionStatus, label, order }));

export interface PgdCatalogItem {
  id: string;
  domain: typeof PGD_DOMAIN;
  code: string;
  name: string;
  productGroup: PgdProductGroup;
  inspectionTypes: string[];
  methodOptions: PgdMethodOption[];
  defaultStandards: string[];
  slaLabel: string;
  active: boolean;
}

export interface PgdMethodOption {
  code: string;
  name: string;
}

/** PGD catalog is intentionally not a copy of the PCN certification fields. */
export const DEFAULT_PGD_CATALOG: readonly PgdCatalogItem[] = [
  {
    id: 'STEEL_LOT_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-THEP-LO',
    name: 'Giám định lô thép và vật liệu kim loại',
    productGroup: 'STEEL_METAL',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'CHEMICAL', 'MECHANICAL'],
    methodOptions: [
      { code: 'TT58', name: 'Thông tư 58 - giám định thép' },
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-06', name: 'Giám định xuất xứ' },
      { code: 'QT-GĐ-10', name: 'Giám định vật liệu kim loại' },
      { code: 'QT-GĐ-14', name: 'Giám định chất lượng thép theo TTLT 58/2015' },
    ],
    defaultStandards: ['JIS', 'ASTM', 'GB/T'],
    slaLabel: '5–7 ngày',
    active: true,
  },
  {
    id: 'MACHINERY_LINE_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-MAY-01',
    name: 'Giám định máy móc và dây chuyền',
    productGroup: 'MACHINERY_LINE',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'MECHANICAL', 'FIELD_ASSESSMENT'],
    methodOptions: [
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-05', name: 'Giám định tình trạng' },
      { code: 'QT-GĐ-06', name: 'Giám định xuất xứ' },
      { code: 'QT-GĐ-07', name: 'Giám định tình trạng máy móc đã qua sử dụng' },
      { code: 'QT-GĐ-09', name: 'Giám định máy móc thiết bị' },
      { code: 'QT-GĐ-12', name: 'Giám định tính đồng bộ dây chuyền / máy móc' },
    ],
    defaultStandards: ['Hồ sơ kỹ thuật', 'Tiêu chuẩn hợp đồng'],
    slaLabel: '3–5 ngày',
    active: true,
  },
  {
    id: 'COAL_LOT_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-THAN-01',
    name: 'Giám định lô than',
    productGroup: 'COAL',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'CHEMICAL'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-08', name: 'Giám định than' },
    ],
    defaultStandards: ['TCVN 8910', 'Tiêu chuẩn hợp đồng'],
    slaLabel: 'Theo kế hoạch',
    active: true,
  },
];

export interface PgdSteelTtlt58SamplingPlan {
  lotSizeMin: number;
  lotSizeMax: number;
  visualLabelSampleCount: number;
  mechanicalWeightSampleCount: number;
  chemicalCoatingSampleCount: number;
  aqlVisualDimensionWeight: 4;
  aqlMechanicalChemicalCoating: 1.5;
  reference: 'QT-GĐ-14 / TTLT 58/2015';
}

const PGD_STEEL_TTLT58_SAMPLING_TABLE: readonly PgdSteelTtlt58SamplingPlan[] = [
  { lotSizeMin: 1, lotSizeMax: 25, visualLabelSampleCount: 2, mechanicalWeightSampleCount: 2, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
  { lotSizeMin: 26, lotSizeMax: 50, visualLabelSampleCount: 3, mechanicalWeightSampleCount: 2, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
  { lotSizeMin: 51, lotSizeMax: 150, visualLabelSampleCount: 3, mechanicalWeightSampleCount: 3, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
  { lotSizeMin: 151, lotSizeMax: 500, visualLabelSampleCount: 5, mechanicalWeightSampleCount: 3, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
  { lotSizeMin: 501, lotSizeMax: 1200, visualLabelSampleCount: 5, mechanicalWeightSampleCount: 3, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
  { lotSizeMin: 1201, lotSizeMax: 3200, visualLabelSampleCount: 8, mechanicalWeightSampleCount: 3, chemicalCoatingSampleCount: 1, aqlVisualDimensionWeight: 4, aqlMechanicalChemicalCoating: 1.5, reference: 'QT-GĐ-14 / TTLT 58/2015' },
];

/** Returns the QT-GĐ-14 appendix plan; multi-product lots use the B column (one fewer mechanical/weight sample). */
export function getPgdSteelTtlt58SamplingPlan(lotSize: number, sameGradeMultiProduct: boolean): PgdSteelTtlt58SamplingPlan | null {
  if (!Number.isInteger(lotSize) || lotSize < 1) return null;
  const sourcePlan = PGD_STEEL_TTLT58_SAMPLING_TABLE.find((plan) => lotSize >= plan.lotSizeMin && lotSize <= plan.lotSizeMax);
  if (!sourcePlan) return null;
  return {
    ...sourcePlan,
    mechanicalWeightSampleCount: sameGradeMultiProduct ? Math.max(1, sourcePlan.mechanicalWeightSampleCount - 1) : sourcePlan.mechanicalWeightSampleCount,
  };
}

export function isPgdCatalogItemAllowed(catalogItemId: string, catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): boolean {
  const normalizedId = String(catalogItemId || '').trim();
  if (!normalizedId || /QC20/i.test(normalizedId)) return false;
  return catalog.some((item) => item.domain === PGD_DOMAIN
    && item.active
    && item.id === normalizedId
    && !/QC20/i.test(`${item.id} ${item.code} ${item.name}`)
    && item.methodOptions.every((method) => !/QC20/i.test(`${method.code} ${method.name}`)));
}

export function isPgdCatalogRecordAllowed(value: unknown): value is PgdCatalogItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<PgdCatalogItem>;
  return item.domain === PGD_DOMAIN
    && typeof item.id === 'string'
    && typeof item.code === 'string'
    && typeof item.name === 'string'
    && !/QC20/i.test(`${item.id} ${item.code} ${item.name}`)
    && ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(String(item.productGroup || ''))
    && item.active === true
    && Array.isArray(item.methodOptions)
    && item.methodOptions.every((method) => method && typeof method.code === 'string' && typeof method.name === 'string' && Boolean(method.code.trim()) && Boolean(method.name.trim()) && !/QC20/i.test(`${method.code} ${method.name}`));
}

export interface PgdRequesterSnapshot {
  name: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

export type PgdCustomerSnapshot = Pick<CustomerRef, 'name' | 'address' | 'taxId' | 'phone' | 'email' | 'contactPerson'>;

export interface PgdProductDetails {
  grade?: string;
  dimensions?: string;
  productStandard?: string;
  origin?: string;
  manufacturer?: string;
  importer?: string;
  customsDocuments?: Array<{ document?: string; number?: string; date?: string }>;
  steelLotSize?: number;
  steelSameGradeMultiProduct?: boolean;
  steelManualSamplingPlanNote?: string;
}

export const PGD_REGISTRY_DOCUMENT_KINDS = [
  'CONTRACT',
  'INVOICE',
  'PACKING_LIST',
  'BILL_OF_LADING',
  'CUSTOMS_DECLARATION',
  'CERTIFICATE_OF_ORIGIN',
  'TECHNICAL_DOSSIER',
  'OTHER',
] as const;

export type PgdRegistryDocumentKind = typeof PGD_REGISTRY_DOCUMENT_KINDS[number];

export interface PgdRegistryDocument {
  kind: PgdRegistryDocumentKind;
  number?: string;
  date?: string;
  note?: string;
}

/** Source-derived registry metadata for a new request; never a historical workbook import. */
export interface PgdRequestRegistryMetadata {
  registrationNumber?: string;
  receivedAt?: string;
  documents?: PgdRegistryDocument[];
  technicalDossierNote?: string;
  deficiencyNote?: string;
  returnedPackageNote?: string;
  courierName?: string;
}

export interface PgdDocumentPointer {
  id: string;
  domain: typeof PGD_DOMAIN;
  fileName: string;
  assetId?: string;
  requirementCode?: string;
  uploadedAt?: string;
  sourceCollection: string;
  sourceDocumentId: string;
  version: number;
  checksum: string;
  uploadedByUsername?: string;
}

export interface PgdGeneratedDocument {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  requestCode: string;
  kind: string;
  templateId: string;
  templateCode: string;
  templateVersion: string;
  templateSnapshot: PgdDocumentTemplateSnapshot;
  cellValues: Record<string, unknown>;
  format: 'DOCX' | 'PDF';
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  fileAssetId?: string;
  contextHash: string;
  sourceCollection: typeof PGD_COLLECTIONS.requests;
  sourceDocumentId: string;
  generatedByUsername: string;
  generatedAt: string;
  status: 'DRAFT' | 'ISSUED';
  lockedAt?: string;
}

export interface PgdInspectionRequestInput {
  id: string;
  requestCode: string;
  intakeChannel: PgdIntakeChannel;
  requester: PgdRequesterSnapshot;
  customerSnapshot: PgdCustomerSnapshot;
  productGroup: PgdProductGroup;
  catalogItemId: string;
  productName: string;
  productCode?: string;
  brand?: string;
  productDetails?: PgdProductDetails;
  quantity: number;
  unit?: string;
  weight?: number;
  weightUnit?: string;
  lotCode?: string;
  inspectionScope: string;
  inspectionLocation: string;
  inspectionScheduledAt?: string;
  standards: string[];
  method?: string;
  assessmentMethod?: PgdAssessmentMethod;
  documentPointers?: PgdDocumentPointer[];
  registryMetadata?: PgdRequestRegistryMetadata;
  targetDate?: string;
  note?: string;
  status?: PgdInspectionStatus;
}

export interface PgdInspectionRequest extends Omit<PgdInspectionRequestInput, 'status' | 'documentPointers'> {
  domain: typeof PGD_DOMAIN;
  status: PgdInspectionStatus;
  documentPointers: PgdDocumentPointer[];
  assignmentId?: string;
  fieldInspectionId?: string;
  sampleIds: string[];
  labRequestIds: string[];
  resultTemplateSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PgdInspectionAssignment {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  leadInspectorUsername?: string;
  inspectorUsernames: string[];
  technicalReviewerUsername?: string;
  method?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'RETURNED';
  approvedByUsername?: string;
  approvedAt?: string;
  overrideReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PgdFieldInspection {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  performedAt: string;
  location: string;
  inspectorUsernames: string[];
  lotObservation?: string;
  packaging?: string;
  labeling?: string;
  measurements?: Record<string, string | number>;
  nonconformities?: string[];
  evidenceAssetIds?: string[];
  sampleIds: string[];
  completed: boolean;
  note?: string;
}

export interface PgdSample {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  sampleCode: string;
  description: string;
  quantity: number;
  unit?: string;
  disposition: PgdSampleDisposition;
  sealNumber?: string;
  sampleSize?: string;
  lotQuantity?: number;
  lotUnit?: string;
  sampledAt?: string;
  samplingLocation?: string;
  sampledByUsername?: string;
  retentionStatus?: 'ACTIVE' | 'DESTROYED';
  laboratoryName?: string;
  handedOverAt?: string;
  retainedUntil?: string;
  destroyedAt?: string;
  destroyedByUsername?: string;
  destructionNote?: string;
  note?: string;
}

export interface PgdLabRequest {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  sampleId: string;
  status: PgdLabRequestStatus;
  laboratoryName: string;
  testItems: string[];
  testMethods?: string[];
  handover?: {
    sentAt: string;
    senderUsername?: string;
    receiverName?: string;
    quantity: number;
    note?: string;
  };
  resultId?: string;
}

export interface PgdResultValue {
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit?: string;
  conclusion?: string;
}

export interface PgdLabResult {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  labRequestId: string;
  reportNumber?: string;
  receivedAt: string;
  values: PgdResultValue[];
  acceptedAt?: string;
  acceptedByUsername?: string;
  issue?: string;
}

export interface PgdResultTemplateField {
  key: string;
  label: string;
  type: PgdResultFieldType;
  required: boolean;
  unit?: string;
}

export interface PgdResultTemplate {
  id: string;
  code: string;
  name: string;
  version: string;
  productGroup: PgdProductGroup;
  fields: PgdResultTemplateField[];
  active: boolean;
}

export interface PgdResultTemplateSnapshot extends Omit<PgdResultTemplate, 'id' | 'active'> {
  templateId: string;
  capturedAt: string;
}

export interface PgdInspectionReport {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  reportNumber?: string;
  title: string;
  standardSnapshot: string[];
  templateSnapshot?: PgdResultTemplateSnapshot;
  values: PgdResultValue[];
  conclusion: string;
  status: 'DRAFT' | 'APPROVED' | 'RETURNED';
  createdAt: string;
  updatedAt: string;
}

export interface PgdApprovalStep {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  sequence: number;
  role: 'TECHNICAL_REVIEW' | 'LEADERSHIP_APPROVAL';
  status: PgdApprovalStatus;
  actedByUsername?: string;
  actedAt?: string;
  comment?: string;
}

export type PgdApprovalRole = PgdApprovalStep['role'];

export interface PgdInspectionCertificate {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  documentNumber?: string;
  title: string;
  standardSnapshot?: string[];
  conclusion: string;
  templateSnapshot?: PgdResultTemplateSnapshot;
  status: 'DRAFT' | 'SIGNED' | 'RETURNED';
  signedByUsername?: string;
  signedAt?: string;
  returnedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PgdValidationIssue {
  field: string;
  message: string;
}

export interface PgdTransitionContext {
  hasApprovedAssignment?: boolean;
  hasFieldInspection?: boolean;
  hasSampleHandover?: boolean;
  labRequests?: PgdLabRequest[];
  reportReady?: boolean;
  hasCertificate?: boolean;
  signed?: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) return false;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return !Number.isNaN(parsed.getTime());
}

export function validatePgdRegistryMetadata(input: unknown): PgdValidationIssue[] {
  const issues: PgdValidationIssue[] = [];
  if (input === undefined) return issues;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'registryMetadata', message: 'Metadata sổ đăng ký PGD không hợp lệ.' }];
  }
  const metadata = input as Partial<PgdRequestRegistryMetadata>;
  if (metadata.registrationNumber !== undefined && (typeof metadata.registrationNumber !== 'string' || metadata.registrationNumber.trim().length > 120)) {
    issues.push({ field: 'registryMetadata.registrationNumber', message: 'Số đăng ký PGD không hợp lệ hoặc quá dài.' });
  }
  if (metadata.receivedAt !== undefined && (typeof metadata.receivedAt !== 'string' || !isValidIsoDate(metadata.receivedAt.trim()))) {
    issues.push({ field: 'registryMetadata.receivedAt', message: 'Ngày tiếp nhận PGD phải là ngày hợp lệ.' });
  }
  const noteFields = [
    ['technicalDossierNote', 'Ghi chú hồ sơ kỹ thuật'],
    ['deficiencyNote', 'Ghi chú thiếu hồ sơ'],
    ['returnedPackageNote', 'Ghi chú hoàn trả'],
    ['courierName', 'Đơn vị chuyển phát'],
  ] as const;
  for (const [key, label] of noteFields) {
    const value = metadata[key];
    if (value !== undefined && (typeof value !== 'string' || value.trim().length > 500)) {
      issues.push({ field: `registryMetadata.${key}`, message: `${label} không hợp lệ hoặc quá dài.` });
    }
  }
  if (metadata.documents !== undefined && !Array.isArray(metadata.documents)) {
    issues.push({ field: 'registryMetadata.documents', message: 'Danh sách chứng từ sổ đăng ký PGD không hợp lệ.' });
  } else if (Array.isArray(metadata.documents)) {
    metadata.documents.forEach((document, index) => {
      if (!document || typeof document !== 'object' || Array.isArray(document) || !PGD_REGISTRY_DOCUMENT_KINDS.includes(String((document as Partial<PgdRegistryDocument>).kind || '') as PgdRegistryDocumentKind)) {
        issues.push({ field: `registryMetadata.documents[${index}].kind`, message: 'Loại chứng từ sổ đăng ký PGD không hợp lệ.' });
        return;
      }
      const item = document as Partial<PgdRegistryDocument>;
      if (item.number !== undefined && (typeof item.number !== 'string' || item.number.trim().length > 160)) issues.push({ field: `registryMetadata.documents[${index}].number`, message: 'Số chứng từ sổ đăng ký PGD không hợp lệ hoặc quá dài.' });
      if (item.date !== undefined && (typeof item.date !== 'string' || !isValidIsoDate(item.date.trim()))) issues.push({ field: `registryMetadata.documents[${index}].date`, message: 'Ngày chứng từ sổ đăng ký PGD không hợp lệ.' });
      if (item.note !== undefined && (typeof item.note !== 'string' || item.note.trim().length > 500)) issues.push({ field: `registryMetadata.documents[${index}].note`, message: 'Ghi chú chứng từ sổ đăng ký PGD không hợp lệ hoặc quá dài.' });
    });
  }
  return issues;
}

export function normalizePgdRegistryMetadata(input: unknown): PgdRequestRegistryMetadata | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const metadata = input as Partial<PgdRequestRegistryMetadata>;
  const documents = Array.isArray(metadata.documents)
    ? metadata.documents
      .filter((document): document is PgdRegistryDocument => Boolean(document && typeof document === 'object' && !Array.isArray(document) && PGD_REGISTRY_DOCUMENT_KINDS.includes(String((document as Partial<PgdRegistryDocument>).kind || '') as PgdRegistryDocumentKind)))
      .map((document) => ({
        kind: document.kind,
        ...(String(document.number || '').trim() ? { number: String(document.number).trim() } : {}),
        ...(String(document.date || '').trim() ? { date: String(document.date).trim() } : {}),
        ...(String(document.note || '').trim() ? { note: String(document.note).trim() } : {}),
      }))
    : [];
  const normalized: PgdRequestRegistryMetadata = {
    ...(String(metadata.registrationNumber || '').trim() ? { registrationNumber: String(metadata.registrationNumber).trim() } : {}),
    ...(String(metadata.receivedAt || '').trim() ? { receivedAt: String(metadata.receivedAt).trim() } : {}),
    ...(documents.length > 0 ? { documents } : {}),
    ...(String(metadata.technicalDossierNote || '').trim() ? { technicalDossierNote: String(metadata.technicalDossierNote).trim() } : {}),
    ...(String(metadata.deficiencyNote || '').trim() ? { deficiencyNote: String(metadata.deficiencyNote).trim() } : {}),
    ...(String(metadata.returnedPackageNote || '').trim() ? { returnedPackageNote: String(metadata.returnedPackageNote).trim() } : {}),
    ...(String(metadata.courierName || '').trim() ? { courierName: String(metadata.courierName).trim() } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function validatePgdIntake(input: Partial<PgdInspectionRequestInput>, catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): PgdValidationIssue[] {
  const issues: PgdValidationIssue[] = [];
  if (!String(input.id || '').trim()) issues.push({ field: 'id', message: 'PYC PGD cần có mã định danh.' });
  if (!String(input.requestCode || '').trim()) issues.push({ field: 'requestCode', message: 'Cần nhập mã PYC giám định.' });
  if (!String(input.requester?.name || '').trim()) issues.push({ field: 'requester.name', message: 'Cần ghi nhận người/đơn vị gửi yêu cầu.' });
  if (!['DIRECT', 'PHONE', 'ONLINE_ZALO', 'EMAIL', 'OTHER'].includes(String(input.intakeChannel || ''))) {
    issues.push({ field: 'intakeChannel', message: 'Kênh tiếp nhận PYC PGD không hợp lệ.' });
  }
  if (!['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(String(input.productGroup || ''))) {
    issues.push({ field: 'productGroup', message: 'Nhóm sản phẩm PGD không hợp lệ.' });
  }
  if (!isPgdCatalogItemAllowed(String(input.catalogItemId || ''), catalog)) issues.push({ field: 'catalogItemId', message: 'Loại hình không thuộc catalog PGD hoặc đã bị loại khỏi miền PGD.' });
  const catalogItem = catalog.find((item) => item.id === String(input.catalogItemId || '').trim() && item.domain === PGD_DOMAIN && item.active);
  if (catalogItem && catalogItem.productGroup !== input.productGroup) issues.push({ field: 'productGroup', message: 'Loại hình giám định không khớp nhóm sản phẩm PGD.' });
  if (catalogItem && String(input.method || '').trim() && !catalogItem.methodOptions.some((method) => method.code.toUpperCase() === String(input.method).trim().toUpperCase())) {
    issues.push({ field: 'method', message: 'Mã phương thức PGD phải được chọn từ catalog của loại hình giám định.' });
  }
  if (input.assessmentMethod !== undefined && !PGD_ASSESSMENT_METHOD_OPTIONS.some((option) => option.code === input.assessmentMethod)) {
    issues.push({ field: 'assessmentMethod', message: 'Phương thức ĐGSPH phải được chọn từ danh mục đã xác nhận.' });
  }
  if (String(input.method || '').trim().toUpperCase() === 'QT-GĐ-14' && input.productDetails?.steelLotSize !== undefined) {
    const lotSize = input.productDetails.steelLotSize;
    if (!Number.isInteger(lotSize) || lotSize < 1) {
      issues.push({ field: 'productDetails.steelLotSize', message: 'Cỡ lô QT-GĐ-14 phải là số nguyên dương theo đơn vị bó/kiện/cuộn.' });
    } else if (!getPgdSteelTtlt58SamplingPlan(lotSize, input.productDetails.steelSameGradeMultiProduct === true)
      && !String(input.productDetails.steelManualSamplingPlanNote || '').trim()) {
      issues.push({ field: 'productDetails.steelManualSamplingPlanNote', message: 'Cỡ lô ngoài bảng 1–3200 cần ghi căn cứ/kế hoạch lấy mẫu thủ công.' });
    }
  }
  if (input.documentPointers !== undefined && (!Array.isArray(input.documentPointers) || input.documentPointers.some((pointer) => pointer.domain !== PGD_DOMAIN || pointer.sourceCollection !== PGD_COLLECTIONS.documents || !String(pointer.sourceDocumentId || '').trim() || !Number.isInteger(pointer.version) || pointer.version < 1 || !/^[a-f0-9]{64}$/i.test(String(pointer.checksum || ''))))) {
    issues.push({ field: 'documentPointers', message: 'Tài liệu PGD phải có provenance, phiên bản và checksum hợp lệ của collection PGD.' });
  }
  issues.push(...validatePgdRegistryMetadata(input.registryMetadata));
  if (!String(input.productName || '').trim()) issues.push({ field: 'productName', message: 'Cần nhập tên hàng hóa/sản phẩm.' });
  if (!String(input.inspectionLocation || '').trim()) issues.push({ field: 'inspectionLocation', message: 'Cần nhập địa điểm giám định.' });
  if (!Array.isArray(input.standards) || input.standards.length === 0 || input.standards.every((item) => !String(item || '').trim())) {
    issues.push({ field: 'standards', message: 'Cần chọn hoặc nhập ít nhất một tiêu chuẩn/phương pháp đối chiếu.' });
  }
  if (!String(input.inspectionScope || '').trim()) issues.push({ field: 'inspectionScope', message: 'Cần nhập nội dung yêu cầu giám định.' });
  if (!String(input.customerSnapshot?.name || '').trim()) issues.push({ field: 'customerSnapshot.name', message: 'Cần nhập khách hàng/đơn vị yêu cầu.' });
  if (!String(input.customerSnapshot?.address || '').trim()) issues.push({ field: 'customerSnapshot.address', message: 'Cần nhập địa chỉ khách hàng.' });
  if (!Number.isFinite(input.quantity) || Number(input.quantity) <= 0) issues.push({ field: 'quantity', message: 'Số lượng phải lớn hơn 0.' });
  return issues;
}

export interface PgdAssignmentUserSnapshot {
  username: string;
  active?: boolean;
  departmentScopes?: string[];
  pgdRole?: string;
}

export function validatePgdAssignment(
  input: { inspectorUsernames?: string[]; technicalReviewerUsername?: string },
  users: PgdAssignmentUserSnapshot[],
): PgdValidationIssue[] {
  const issues: PgdValidationIssue[] = [];
  const byUsername = new Map(users.map((user) => [String(user.username || '').trim().toLowerCase(), user]));
  const inspectorUsernames = Array.from(new Set((input.inspectorUsernames || []).map((username) => String(username || '').trim().toLowerCase()).filter(Boolean)));
  if (inspectorUsernames.length === 0) issues.push({ field: 'inspectorUsernames', message: 'Cần chọn ít nhất một giám định viên có scope PGD.' });
  for (const username of inspectorUsernames) {
    const user = byUsername.get(username);
    const scopes = new Set((user?.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
    if (!user || user.active === false || !scopes.has('PGD') || String(user.pgdRole || '').toUpperCase() === 'PGD_VIEWER') {
      issues.push({ field: 'inspectorUsernames', message: `Nhân sự ${username} không có tài khoản hoạt động với scope PGD.` });
    }
  }
  const reviewerUsername = String(input.technicalReviewerUsername || '').trim().toLowerCase();
  if (!reviewerUsername) {
    issues.push({ field: 'technicalReviewerUsername', message: 'Cần chọn người soát xét kỹ thuật PGD.' });
  } else {
    const user = byUsername.get(reviewerUsername);
    const scopes = new Set((user?.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
    const role = String(user?.pgdRole || '').toUpperCase();
    if (!user || user.active === false || !scopes.has('PGD') || !['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL'].includes(role)) {
      issues.push({ field: 'technicalReviewerUsername', message: `Nhân sự ${reviewerUsername} không phù hợp để soát xét kỹ thuật PGD.` });
    }
  }
  return issues;
}

export function validatePgdInspectors(
  usernames: string[] | undefined,
  users: PgdAssignmentUserSnapshot[],
): PgdValidationIssue[] {
  const issues: PgdValidationIssue[] = [];
  const byUsername = new Map(users.map((user) => [String(user.username || '').trim().toLowerCase(), user]));
  const normalizedUsernames = Array.from(new Set((usernames || []).map((username) => String(username || '').trim().toLowerCase()).filter(Boolean)));
  if (normalizedUsernames.length === 0) {
    issues.push({ field: 'inspectorUsernames', message: 'Biên bản PGD cần có ít nhất một giám định viên.' });
    return issues;
  }
  for (const username of normalizedUsernames) {
    const user = byUsername.get(username);
    const scopes = new Set((user?.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
    if (!user || user.active === false || !scopes.has('PGD') || String(user.pgdRole || '').toUpperCase() === 'PGD_VIEWER') {
      issues.push({ field: 'inspectorUsernames', message: `Nhân sự ${username} không có tài khoản hoạt động với scope PGD.` });
    }
  }
  return issues;
}

export function createPgdInspectionRequest(input: PgdInspectionRequestInput, now = new Date().toISOString(), catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): PgdInspectionRequest {
  const issues = validatePgdIntake(input, catalog);
  if (issues.length > 0) throw new Error(`Dữ liệu PYC PGD chưa đủ: ${issues.map((issue) => issue.field).join(', ')}`);
  const registryMetadata = normalizePgdRegistryMetadata(input.registryMetadata);
  return {
    ...clone(input),
    domain: PGD_DOMAIN,
    ...(registryMetadata ? { registryMetadata } : {}),
    status: 'DRAFT',
    documentPointers: clone(input.documentPointers || []),
    sampleIds: [],
    labRequestIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

const PGD_TRANSITIONS: Record<PgdInspectionStatus, PgdInspectionStatus> = {
  DRAFT: 'CAPABILITY_REVIEW',
  CAPABILITY_REVIEW: 'READY_TO_EXECUTE',
  READY_TO_EXECUTE: 'PREPARING',
  PREPARING: 'FIELD_INSPECTION',
  FIELD_INSPECTION: 'WAITING_LAB_RESULTS',
  WAITING_LAB_RESULTS: 'RESULTS_REVIEW',
  RESULTS_REVIEW: 'TECHNICAL_REVIEW',
  TECHNICAL_REVIEW: 'LEADERSHIP_APPROVAL',
  LEADERSHIP_APPROVAL: 'SIGNED',
  SIGNED: 'RESULT_RETURNED',
  RESULT_RETURNED: 'ARCHIVED',
  ARCHIVED: 'ARCHIVED',
  REJECTED: 'CAPABILITY_REVIEW',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'CAPABILITY_REVIEW',
};

export function getPgdTransitionDenial(
  current: PgdInspectionStatus,
  next: PgdInspectionStatus,
  context: PgdTransitionContext = {},
): string | null {
  if (['REJECTED', 'CANCELLED', 'ON_HOLD'].includes(next)) {
    if (current === 'ARCHIVED') return 'Hồ sơ PGD đã lưu trữ, không thể chuyển sang nhánh ngoại lệ.';
    return null;
  }
  if (current === 'DRAFT' && next === 'READY_TO_EXECUTE') return 'Hồ sơ PGD phải đi qua bước xem xét năng lực.';
  if (PGD_TRANSITIONS[current] !== next) return 'Hồ sơ PGD phải đi theo đúng thứ tự lifecycle.';
  if (current === 'CAPABILITY_REVIEW' && !context.hasApprovedAssignment) return 'Hồ sơ PGD phải được xem xét năng lực và phê duyệt phân công.';
  if (current === 'FIELD_INSPECTION') {
    if (!context.hasFieldInspection) return 'Chưa hoàn tất biên bản giám định hiện trường.';
    if (!context.hasSampleHandover) return 'Cần hoàn tất bàn giao mẫu cho PTN trước khi chờ kết quả.';
  }
  if (current === 'WAITING_LAB_RESULTS') {
    const labRequests = context.labRequests || [];
    if (labRequests.some((request) => !['RESULT_RECEIVED', 'CLOSED'].includes(request.status))) return 'Chưa nhận đủ kết quả PTN của các yêu cầu đang mở.';
  }
  if (current === 'TECHNICAL_REVIEW' && !context.reportReady) return 'Chưa hoàn thiện báo cáo giám định để trình phê duyệt.';
  if (current === 'LEADERSHIP_APPROVAL' && !context.hasCertificate) return 'Chưa có dự thảo chứng thư giám định để trình ký.';
  if (current === 'SIGNED' && !context.signed) return 'Chưa ghi nhận đầy đủ chữ ký trước khi trả kết quả.';
  return null;
}

export function getPgdApprovalDenial(
  currentStatus: PgdInspectionStatus,
  approvalRole: PgdApprovalRole,
  user: { role?: string; systemRole?: string; pgdRole?: string } = {},
): string | null {
  if (currentStatus !== approvalRole) return 'Bước phê duyệt không khớp trạng thái hồ sơ PGD.';
  const systemRole = String(user.systemRole || user.role || '').trim().toLowerCase();
  const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
  if (systemRole === 'admin' || pgdRole === 'PGD_ADMIN') return null;
  if (approvalRole === 'TECHNICAL_REVIEW' && ['PGD_MANAGER', 'PGD_TECHNICAL'].includes(pgdRole)) return null;
  if (approvalRole === 'LEADERSHIP_APPROVAL' && pgdRole === 'PGD_MANAGER') return null;
  return approvalRole === 'TECHNICAL_REVIEW'
    ? 'Tài khoản không có phạm vi phê duyệt kỹ thuật PGD.'
    : 'Tài khoản không có phạm vi phê duyệt lãnh đạo PGD.';
}

export function splitPgdSample(
  input: {
    requestId: string;
    sampleCodePrefix: string;
    description: string;
    quantity: number;
    unit?: string;
    sampledByUsername?: string;
    samplingLocation?: string;
    sampleSize?: string;
    lotQuantity?: number;
    lotUnit?: string;
  },
  now = new Date().toISOString(),
): { lab: PgdSample; retained: PgdSample } {
  if (!Number.isFinite(input.quantity) || input.quantity < 2) throw new Error('Mẫu PGD phải có đủ số lượng để tách phần PTN và mẫu lưu.');
  const labQuantity = Math.ceil(input.quantity / 2);
  const sampledAt = new Date(now).toISOString();
  const nonce = sampledAt.replace(/[-:.TZ]/g, '') + '-' + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const base = `${String(input.sampleCodePrefix || '').trim()}-${nonce}`;
  const common = {
    domain: PGD_DOMAIN,
    requestId: input.requestId,
    description: input.description,
    unit: input.unit,
    sampleSize: input.sampleSize || input.description,
    lotQuantity: input.lotQuantity ?? input.quantity,
    lotUnit: input.lotUnit || input.unit,
    sampledAt,
    samplingLocation: input.samplingLocation,
    sampledByUsername: input.sampledByUsername,
  };
  return {
    lab: {
      id: `${base}-lab`,
      ...common,
      sampleCode: `${base}-L`,
      quantity: labQuantity,
      disposition: 'LAB',
      sealNumber: `${base}-L-SEAL`,
      note: `Tách mẫu lúc ${sampledAt}`,
    },
    retained: {
      id: `${base}-retained`,
      ...common,
      sampleCode: `${base}-R`,
      quantity: input.quantity - labQuantity,
      disposition: 'RETAINED',
      sealNumber: `${base}-R-SEAL`,
      retentionStatus: 'ACTIVE',
      note: `Tách mẫu lưu lúc ${sampledAt}`,
    },
  };
}

export function buildPgdLabRequest(
  input: PgdLabRequest,
  actorUsername: string,
  now = new Date().toISOString(),
  existing?: PgdLabRequest,
): PgdLabRequest {
  const actor = String(actorUsername || '').trim();
  const laboratoryName = String(input.laboratoryName || '').trim();
  const testItems = Array.from(new Map(
    (input.testItems || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => [item.toLocaleLowerCase(), item] as const),
  ).values());
  const status = String(input.status || '').trim().toUpperCase() as PgdLabRequestStatus;
  const resultId = String(existing?.resultId || input.resultId || '').trim() || undefined;
  if (!input?.id || input.domain !== PGD_DOMAIN || !input.requestId || !input.sampleId) throw new Error('Yêu cầu PTN PGD thiếu thông tin liên kết mẫu/hồ sơ.');
  if (!actor) throw new Error('Yêu cầu PTN PGD cần ghi nhận người bàn giao.');
  if (!laboratoryName) throw new Error('Yêu cầu PTN PGD cần có tên phòng thử nghiệm.');
  if (testItems.length === 0) throw new Error('Yêu cầu PTN PGD cần có ít nhất một hạng mục thử nghiệm.');
  if (!input.handover || !Number.isFinite(input.handover.quantity) || input.handover.quantity <= 0) throw new Error('Yêu cầu PTN PGD cần có số lượng bàn giao lớn hơn 0.');
  if (!['DRAFT', 'SENT', 'RECEIVED', 'RESULT_RECEIVED', 'ISSUE', 'CLOSED'].includes(status)) throw new Error('Trạng thái yêu cầu PTN PGD không hợp lệ.');
  if (['RESULT_RECEIVED', 'CLOSED'].includes(status) && !resultId) throw new Error('Không thể đánh dấu yêu cầu PTN đã có kết quả khi chưa có kết quả PTN liên kết.');
  const finalStatus = resultId && status !== 'CLOSED' ? 'RESULT_RECEIVED' : status;
  return {
    ...clone(input),
    domain: PGD_DOMAIN,
    status: finalStatus,
    laboratoryName,
    testItems,
    ...(resultId ? { resultId } : {}),
    handover: {
      ...clone(input.handover),
      sentAt: existing?.handover?.sentAt || now,
      senderUsername: actor,
      quantity: input.handover.quantity,
    },
  };
}

export function buildPgdLabResult(
  input: PgdLabResult,
  actorUsername: string,
  now = new Date().toISOString(),
): PgdLabResult {
  const actor = String(actorUsername || '').trim();
  if (!input?.id || input.domain !== PGD_DOMAIN || !input.requestId || !input.labRequestId) throw new Error('Kết quả PTN PGD thiếu thông tin liên kết.');
  if (!actor) throw new Error('Kết quả PTN PGD cần ghi nhận người tiếp nhận.');
  if (!Array.isArray(input.values)) throw new Error('Kết quả PTN PGD cần có danh sách giá trị.');
  return {
    ...clone(input),
    domain: PGD_DOMAIN,
    receivedAt: now,
    acceptedAt: now,
    acceptedByUsername: actor,
    values: clone(input.values),
    ...(String(input.reportNumber || '').trim() ? { reportNumber: String(input.reportNumber).trim() } : { reportNumber: undefined }),
    ...(String(input.issue || '').trim() ? { issue: String(input.issue).trim() } : { issue: undefined }),
  };
}

export function snapshotPgdResultTemplate(template: PgdResultTemplate, capturedAt = new Date().toISOString()): PgdResultTemplateSnapshot {
  const copy = clone(template);
  return {
    templateId: copy.id,
    code: copy.code,
    name: copy.name,
    version: copy.version,
    productGroup: copy.productGroup,
    fields: copy.fields,
    capturedAt,
  };
}

export type PgdMutationOperation = 'write' | 'delete';

export interface PgdMutationUser {
  role?: string;
  systemRole?: string;
  departmentScopes?: string[];
  pgdRole?: string;
}

const PGD_COLLECTION_SET = new Set<string>(Object.values(PGD_COLLECTIONS));

export function getPgdCollectionMutationDenial(
  collectionName: string,
  role: string | undefined,
  operation: PgdMutationOperation,
  user: PgdMutationUser = {},
): string | null {
  if (!PGD_COLLECTION_SET.has(collectionName)) return 'Collection không thuộc phạm vi PGD; không được ghi dữ liệu PCN từ boundary PGD.';
  const normalizedRole = String(role || user.systemRole || user.role || '').trim().toLowerCase();
  if (normalizedRole === 'viewer' || String(user.pgdRole || '').trim().toUpperCase() === 'PGD_VIEWER') {
    return 'Tài khoản viewer PGD chỉ được đọc dữ liệu.';
  }
  const scopes = new Set((user.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
  if (normalizedRole !== 'admin' && !scopes.has('PGD')) return 'Tài khoản chưa được cấp phạm vi PGD.';
  if (!['admin', 'staff'].includes(normalizedRole)) return 'Phiên PGD không có role hợp lệ để thay đổi dữ liệu.';
  if (operation === 'delete' && collectionName === PGD_COLLECTIONS.activityLogs) return 'Nhật ký PGD là append-only và không được xóa.';
  return null;
}

export function getPgdStatusLabel(status: PgdInspectionStatus): string {
  return PGD_WORKFLOW_STATES.find((state) => state.code === status)?.label || ({ REJECTED: 'Từ chối / trả lại', CANCELLED: 'Đã hủy', ON_HOLD: 'Tạm dừng' } as Record<string, string>)[status] || status;
}

// --- End of pgdDomain.ts ---
