import type { CustomerRef, OrganizationManagementRoleCode, ProfessionalRoleCode } from '../types.ts';
import type { PgdDocumentTemplateSnapshot } from './pgdDocumentTemplates.ts';
import { isOrganizationLeader } from './pcnRbac.ts';

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
  inspectionPlans: 'pgdInspectionPlans',
  caseEvents: 'pgdCaseEvents',
  fieldActivityLogs: 'pgdFieldActivityLogs',
  labResultReviews: 'pgdLabResultReviews',
  dossierIndexes: 'pgdDossierIndexes',
  calibrationInstruments: 'pgdCalibrationInstruments',
  workflowTemplates: 'pgdWorkflowTemplates',
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
export const PGD_V1_PRODUCT_GROUPS = ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'] as const satisfies readonly PgdProductGroup[];
export type PgdV1ProductGroup = typeof PGD_V1_PRODUCT_GROUPS[number];

export interface PgdSampleTypeOption {
  id: string;
  label: string;
  productGroups: readonly PgdProductGroup[];
}

/** Catalog of common sample labels. The intake UI may still accept a custom label. */
export const PGD_SAMPLE_TYPE_OPTIONS = [
  { id: 'STEEL_COIL', label: 'Thép cuộn', productGroups: ['STEEL_METAL'] },
  { id: 'STEEL_SHEET', label: 'Thép tấm / thép lá', productGroups: ['STEEL_METAL'] },
  { id: 'STEEL_BAR', label: 'Thép thanh / thép hình', productGroups: ['STEEL_METAL'] },
  { id: 'MACHINERY_LINE', label: 'Dây chuyền / máy móc', productGroups: ['MACHINERY_LINE'] },
  { id: 'MACHINERY_EQUIPMENT', label: 'Thiết bị cơ khí', productGroups: ['MACHINERY_LINE'] },
  { id: 'COAL_LUMP', label: 'Than cục', productGroups: ['COAL'] },
  { id: 'COAL_FINE', label: 'Than cám', productGroups: ['COAL'] },
  { id: 'OTHER_GOODS', label: 'Mẫu hàng hóa khác', productGroups: ['OTHER'] },
] as const satisfies readonly PgdSampleTypeOption[];

export type PgdInspectionGroupCode = 'QC20';
export const PGD_QC20_GROUP_CODE: PgdInspectionGroupCode = 'QC20';
export const PGD_GROUP_LABELS: Record<PgdInspectionGroupCode, string> = {
  QC20: 'QC20 · Thép không gỉ / QCVN 20',
};
export type PgdInspectionProfileCode =
  | 'QUANTITY_WEIGHT'
  | 'CONDITION_ORIGIN'
  | 'STEEL_STANDARD_COMPLIANCE'
  | 'STEEL_TT58'
  | 'STEEL_CAO_BANG'
  | 'MACHINERY_LINE'
  | 'MACHINERY_MANUFACTURING_THAI_NGUYEN'
  | 'COAL'
  | 'OUTSIDE_GENERAL'
  | 'OUTSIDE_COLUMN_BRACES'
  | 'GENERAL_GOODS';
export const PGD_INTERVIEW_PROFILE_CODES: readonly PgdInspectionProfileCode[] = [
  'QUANTITY_WEIGHT',
  'CONDITION_ORIGIN',
  'STEEL_STANDARD_COMPLIANCE',
  'STEEL_TT58',
  'STEEL_CAO_BANG',
  'MACHINERY_LINE',
  'MACHINERY_MANUFACTURING_THAI_NGUYEN',
  'COAL',
  'OUTSIDE_GENERAL',
  'OUTSIDE_COLUMN_BRACES',
  'GENERAL_GOODS',
] as const;
export type PgdPriority = 'NORMAL' | 'URGENT';
export type PgdInvoiceStatus = 'NOT_REQUIRED' | 'PENDING' | 'ISSUED' | 'PAID';
export type PgdCalibrationStatus = 'VALID' | 'DUE_SOON' | 'EXPIRED' | 'OUT_OF_SERVICE';
export interface PgdCalibrationInstrument {
  id: string;
  domain: typeof PGD_DOMAIN;
  code: string;
  name: string;
  serialNumber?: string;
  calibrationStandard?: string;
  calibratedAt?: string;
  expiresAt: string;
  status?: PgdCalibrationStatus;
  active: boolean;
  note?: string;
}
export const PGD_RETENTION_POLICY = {
  retainedSampleMonths: 3,
  paperFileYears: 1,
  digitalFileYears: 10,
} as const;
export function getPgdCalibrationStatus(input: Pick<PgdCalibrationInstrument, 'expiresAt'> & { active?: boolean }, now = new Date().toISOString()): PgdCalibrationStatus {
  if (input.active === false) return 'OUT_OF_SERVICE';
  const expiry = new Date(input.expiresAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(current)) return 'OUT_OF_SERVICE';
  if (expiry <= current) return 'EXPIRED';
  return expiry - current <= 30 * 24 * 60 * 60 * 1000 ? 'DUE_SOON' : 'VALID';
}
export function isPgdV1ProductGroup(group: PgdProductGroup): group is PgdV1ProductGroup {
  return PGD_V1_PRODUCT_GROUPS.some((activeGroup) => activeGroup === group);
}
export type PgdSampleDisposition = 'LAB' | 'RETAINED';
export type PgdSteelLotDefinition = 'PRODUCT_LOT' | 'SHIPMENT_LOT';
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
  /** Stable PGD grouping code; distinct from the profile routing code and PCN field code. */
  groupCode?: PgdInspectionGroupCode;
  /** Stable application routing key; legacy persisted catalog rows may omit it. */
  profileCode?: PgdInspectionProfileCode;
  inspectionTypes: string[];
  methodOptions: PgdMethodOption[];
  defaultStandards: string[];
  slaLabel: string;
  slaDays?: { min: number; max: number };
  active: boolean;
}

export interface PgdMethodOption {
  code: string;
  name: string;
}

export const PGD_STEEL_CATALOG_ITEM_CODE = 'GĐ-THEP-KG';
export const PGD_GENERAL_STEEL_CATALOG_ITEM_CODE = 'GĐ-THEP-TT58';
export const PGD_CAO_BANG_STEEL_CATALOG_ITEM_CODE = 'GĐ-THEP-CB';
export const PGD_OUTSIDE_CATALOG_ITEM_CODE = 'GĐ-NGOAI-01';
export const PGD_OTHER_CATALOG_ITEM_CODE = 'GĐ-HH-01';
const PGD_STEEL_CATALOG_ITEM_CODES = [PGD_STEEL_CATALOG_ITEM_CODE, PGD_GENERAL_STEEL_CATALOG_ITEM_CODE, PGD_CAO_BANG_STEEL_CATALOG_ITEM_CODE] as const;
export const PGD_STEEL_STANDARD_REFS = [
  'QCVN 20:2019/BKHCN',
  'Sửa đổi 1:2021 QCVN 20:2019/BKHCN',
] as const;

export function isPgdInspectionGroupCode(value: unknown): value is PgdInspectionGroupCode {
  return value === PGD_QC20_GROUP_CODE;
}

const PGD_REQUEST_CODE_PATTERN = /^PGD-(\d{6})-(\d{2})$/;

function getPgdVietnamDateParts(date: Date): { day: string; month: string; year: string } {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('PGD request date must be valid.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  if (!values.day || !values.month || !values.year) throw new Error('Unable to resolve the Vietnam calendar date for the PGD number.');
  return { day: values.day, month: values.month, year: values.year };
}

/** Official PGD request code: YYMMDD plus a two-digit serial reset to 01 every Vietnam calendar day. */
export function formatPgdRequestCode(serial: number, date: Date = new Date()): string {
  if (!Number.isInteger(serial) || serial < 1 || serial > 99) throw new Error('PGD request serial must be between 1 and 99.');
  const parts = getPgdVietnamDateParts(date);
  return `PGD-${parts.year.slice(-2)}${parts.month}${parts.day}-${String(serial).padStart(2, '0')}`;
}

export function getPgdVietnamDateKey(date: Date = new Date()): string {
  const parts = getPgdVietnamDateParts(date);
  return `${parts.year.slice(-2)}${parts.month}${parts.day}`;
}

/** PGD catalog is intentionally not a copy of the PCN certification fields. */
export const DEFAULT_PGD_CATALOG: readonly PgdCatalogItem[] = [
  {
    id: 'STEEL_LOT_INSPECTION',
    domain: PGD_DOMAIN,
    code: PGD_STEEL_CATALOG_ITEM_CODE,
    name: 'Giám định lô thép / kim loại theo tiêu chuẩn áp dụng',
    productGroup: 'STEEL_METAL',
    groupCode: PGD_QC20_GROUP_CODE,
    profileCode: 'STEEL_STANDARD_COMPLIANCE',
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
    defaultStandards: [...PGD_STEEL_STANDARD_REFS, 'JIS', 'ASTM', 'GB/T'],
    slaLabel: '5–7 ngày',
    slaDays: { min: 5, max: 7 },
    active: true,
  },
  {
    id: 'STEEL_TT58_INSPECTION',
    domain: PGD_DOMAIN,
    code: PGD_GENERAL_STEEL_CATALOG_ITEM_CODE,
    name: 'Giám định thép / kim loại theo TT58',
    productGroup: 'STEEL_METAL',
    profileCode: 'STEEL_TT58',
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
    defaultStandards: ['TT58', 'JIS', 'ASTM', 'GB/T', 'Tiêu chuẩn hợp đồng'],
    slaLabel: '5–7 ngày',
    slaDays: { min: 5, max: 7 },
    active: true,
  },
  {
    id: 'MACHINERY_LINE_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-MAY-01',
    name: 'Giám định máy móc và dây chuyền',
    productGroup: 'MACHINERY_LINE',
    profileCode: 'MACHINERY_LINE',
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
    slaDays: { min: 3, max: 5 },
    active: true,
  },
  {
    id: 'COAL_LOT_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-THAN-01',
    name: 'Giám định lô than',
    productGroup: 'COAL',
    profileCode: 'COAL',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'CHEMICAL'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-08', name: 'Giám định than' },
    ],
    defaultStandards: ['TCVN 8910', 'Tiêu chuẩn hợp đồng'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 5, max: 10 },
    active: true,
  },
  {
    id: 'OUTSIDE_INSPECTION',
    domain: PGD_DOMAIN,
    code: PGD_OUTSIDE_CATALOG_ITEM_CODE,
    name: 'Giám định ngoài',
    productGroup: 'OTHER',
    profileCode: 'OUTSIDE_GENERAL',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'FIELD_ASSESSMENT'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-05', name: 'Giám định tình trạng' },
      { code: 'QT-GĐ-06', name: 'Giám định xuất xứ' },
    ],
    defaultStandards: ['Tiêu chuẩn hợp đồng', 'Hồ sơ kỹ thuật'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 3, max: 7 },
    active: true,
  },
  {
    id: 'GENERAL_GOODS_INSPECTION',
    domain: PGD_DOMAIN,
    code: PGD_OTHER_CATALOG_ITEM_CODE,
    name: 'Giám định hàng hóa / đối tượng khác',
    productGroup: 'OTHER',
    profileCode: 'GENERAL_GOODS',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'FIELD_ASSESSMENT'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-05', name: 'Giám định tình trạng' },
      { code: 'QT-GĐ-06', name: 'Giám định xuất xứ' },
    ],
    defaultStandards: ['Tiêu chuẩn hợp đồng', 'Hồ sơ kỹ thuật'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 3, max: 7 },
    active: true,
  },
  {
    id: 'QUANTITY_WEIGHT_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-SL-KL-01',
    name: 'Giám định số lượng / khối lượng',
    productGroup: 'OTHER',
    profileCode: 'QUANTITY_WEIGHT',
    inspectionTypes: ['QUANTITY_WEIGHT'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-03', name: 'Giám định khối lượng qua cân' },
    ],
    defaultStandards: ['Hợp đồng / packing list', 'Quy định lấy mẫu'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 3, max: 7 },
    active: true,
  },
  {
    id: 'CONDITION_ORIGIN_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-TTXX-01',
    name: 'Giám định tình trạng / xuất xứ',
    productGroup: 'OTHER',
    profileCode: 'CONDITION_ORIGIN',
    inspectionTypes: ['FIELD_ASSESSMENT', 'ORIGIN'],
    methodOptions: [
      { code: 'QT-GĐ-05', name: 'Giám định tình trạng' },
      { code: 'QT-GĐ-06', name: 'Giám định xuất xứ' },
    ],
    defaultStandards: ['Hồ sơ nguồn gốc', 'Tiêu chuẩn hợp đồng'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 3, max: 7 },
    active: true,
  },
  {
    id: 'STEEL_CAO_BANG_INSPECTION',
    domain: PGD_DOMAIN,
    code: PGD_CAO_BANG_STEEL_CATALOG_ITEM_CODE,
    name: 'Giám định thép Cao Bằng',
    productGroup: 'STEEL_METAL',
    profileCode: 'STEEL_CAO_BANG',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'CHEMICAL', 'MECHANICAL'],
    methodOptions: [
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-10', name: 'Giám định vật liệu kim loại' },
      { code: 'QT-GĐ-14', name: 'Giám định chất lượng thép theo TTLT 58/2015' },
    ],
    defaultStandards: ['Tiêu chuẩn công bố Cao Bằng', 'JIS', 'ASTM', 'GB/T'],
    slaLabel: '5–7 ngày',
    slaDays: { min: 5, max: 7 },
    active: true,
  },
  {
    id: 'MACHINERY_MANUFACTURING_THAI_NGUYEN_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-MAY-TN',
    name: 'Giám định máy chế tạo / Thái Nguyên',
    productGroup: 'MACHINERY_LINE',
    profileCode: 'MACHINERY_MANUFACTURING_THAI_NGUYEN',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'MECHANICAL', 'FIELD_ASSESSMENT'],
    methodOptions: [
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-09', name: 'Giám định máy móc thiết bị' },
      { code: 'QT-GĐ-12', name: 'Giám định tính đồng bộ dây chuyền / máy móc' },
    ],
    defaultStandards: ['Hồ sơ chế tạo', 'Hồ sơ kỹ thuật Thái Nguyên', 'Tiêu chuẩn hợp đồng'],
    slaLabel: '3–5 ngày',
    slaDays: { min: 3, max: 5 },
    active: true,
  },
  {
    id: 'OUTSIDE_COLUMN_BRACES_INSPECTION',
    domain: PGD_DOMAIN,
    code: 'GĐ-NGOAI-CT',
    name: 'Giám định ngoài / cột chống',
    productGroup: 'OTHER',
    profileCode: 'OUTSIDE_COLUMN_BRACES',
    inspectionTypes: ['VISUAL_DIMENSIONAL', 'QUANTITY_WEIGHT', 'FIELD_ASSESSMENT'],
    methodOptions: [
      { code: 'QT-GĐ-02', name: 'Giám định số lượng' },
      { code: 'QT-GĐ-04', name: 'Giám định quy cách / phẩm chất hàng hóa' },
      { code: 'QT-GĐ-05', name: 'Giám định tình trạng' },
    ],
    defaultStandards: ['Bản vẽ / hồ sơ kỹ thuật', 'Tiêu chuẩn hợp đồng'],
    slaLabel: 'Theo kế hoạch',
    slaDays: { min: 3, max: 7 },
    active: true,
  },
];

export function getPgdCatalogItemLabel(catalogItemId: unknown, catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): string {
  const normalizedId = String(catalogItemId || '').trim();
  if (!normalizedId) return 'Chưa chọn loại hồ sơ';
  const item = catalog.find((candidate) => candidate.id === normalizedId || candidate.code === normalizedId)
    || DEFAULT_PGD_CATALOG.find((candidate) => candidate.id === normalizedId || candidate.code === normalizedId);
  return item ? `${item.code} · ${item.name}` : normalizedId;
}

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
    && (!item.groupCode || (isPgdInspectionGroupCode(item.groupCode) && item.groupCode === PGD_QC20_GROUP_CODE && item.code === PGD_STEEL_CATALOG_ITEM_CODE))
    && (item.productGroup !== 'STEEL_METAL' || PGD_STEEL_CATALOG_ITEM_CODES.includes(item.code as typeof PGD_STEEL_CATALOG_ITEM_CODES[number]))
    && !/QC20/i.test(`${item.id} ${item.code} ${item.name}`)
    && item.methodOptions.every((method) => !/QC20/i.test(`${method.code} ${method.name}`)));
}

export function getPgdGroupCodeForCatalogItem(catalogItemId: string, catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): PgdInspectionGroupCode | undefined {
  const item = catalog.find((candidate) => candidate.domain === PGD_DOMAIN && candidate.active && candidate.id === String(catalogItemId || '').trim());
  return item?.groupCode;
}

/** Runtime catalog for the approved v1 rollout, covering every source-derived PGD group. */
export function getPgdActiveCatalog(catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG): PgdCatalogItem[] {
  return catalog.filter((item) => PGD_V1_PRODUCT_GROUPS.includes(item.productGroup as PgdV1ProductGroup) && isPgdCatalogItemAllowed(item.id, catalog)).map(clone);
}

/**
 * Keep built-in source-derived profiles available when an older persisted catalog
 * contains only a subset of the current PGD catalog. Persisted rows override by id.
 */
export function mergePgdCatalogDefaults(catalog: readonly PgdCatalogItem[] = []): PgdCatalogItem[] {
  const byId = new Map(DEFAULT_PGD_CATALOG.map((item) => [item.id, clone(item)]));
  for (const item of catalog) {
    const baseline = byId.get(item.id);
    byId.set(item.id, clone({
      ...baseline,
      ...item,
      ...(baseline?.groupCode && item.groupCode === undefined ? { groupCode: baseline.groupCode } : {}),
    }));
  }
  return Array.from(byId.values());
}

export function isPgdCatalogRecordAllowed(value: unknown): value is PgdCatalogItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<PgdCatalogItem>;
  return item.domain === PGD_DOMAIN
    && typeof item.id === 'string'
    && typeof item.code === 'string'
    && typeof item.name === 'string'
    && (item.groupCode === undefined || isPgdInspectionGroupCode(item.groupCode))
    && !/QC20/i.test(`${item.id} ${item.code} ${item.name}`)
    && ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(String(item.productGroup || ''))
    && (!item.groupCode || (item.groupCode === PGD_QC20_GROUP_CODE && item.code === PGD_STEEL_CATALOG_ITEM_CODE))
    && (item.productGroup !== 'STEEL_METAL' || PGD_STEEL_CATALOG_ITEM_CODES.includes(item.code as typeof PGD_STEEL_CATALOG_ITEM_CODES[number]))
    && Array.isArray(item.defaultStandards)
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

export interface PgdMachineryDetails {
  machineType?: string;
  model?: string;
  serialNumber?: string;
  manufacturingYear?: number;
  technicalParameters?: string;
  condition?: string;
  completeness?: string;
  synchronization?: string;
  installationStatus?: string;
  safetyStandard?: string;
}

export interface PgdCoalDetails {
  coalType?: string;
  source?: string;
  sizeRange?: string;
  qualityStandard?: string;
  samplingBasis?: string;
  moisture?: number;
  ash?: number;
  calorificValue?: number;
  sulfur?: number;
}

export interface PgdProductDetails {
  productForm?: string;
  grade?: string;
  dimensions?: string;
  productStandard?: string;
  origin?: string;
  countryOfOrigin?: string;
  manufacturer?: string;
  manufacturerLotCode?: string;
  importer?: string;
  hsCode?: string;
  lotDefinition?: PgdSteelLotDefinition;
  customsDocuments?: Array<{ document?: string; number?: string; date?: string }>;
  steelLotSize?: number;
  steelSameGradeMultiProduct?: boolean;
  steelManualSamplingPlanNote?: string;
  machinery?: PgdMachineryDetails;
  coal?: PgdCoalDetails;
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

export type PgdDossierChecklistStatus = 'MISSING' | 'PRESENT' | 'WAIVED';

export interface PgdDossierChecklistItem {
  domain: typeof PGD_DOMAIN;
  requirementCode: string;
  group: string;
  title: string;
  required: boolean;
  status: PgdDossierChecklistStatus;
  currentDocumentId?: string;
  currentDocumentVersion?: number;
  waiverReason?: string;
  waivedByUsername?: string;
  waivedAt?: string;
  updatedAt: string;
}

export interface PgdInspectionRequestInput {
  id: string;
  /** Assigned by the server in the PGD transaction; retained on persisted records for compatibility. */
  requestCode?: string;
  intakeChannel: PgdIntakeChannel;
  requester: PgdRequesterSnapshot;
  /** Authenticated receiver; never used as a substitute for requester. */
  receivedByUsername?: string;
  customerSnapshot: PgdCustomerSnapshot;
  productGroup: PgdProductGroup;
  /** Snapshot of the PGD business group; this is not a PCN field code. */
  pgdGroupCode?: PgdInspectionGroupCode;
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
  transportName?: string;
  inspectionScope: string;
  inspectionLocation: string;
  inspectionScheduledAt?: string;
  standards: string[];
  method?: string;
  assessmentMethod?: PgdAssessmentMethod;
  priority?: PgdPriority;
  urgentReason?: string;
  pricingSnapshot?: { basis: 'PRODUCT_GROUP' | 'REQUEST_ITEM' | 'CONTRACT'; priceListVersion?: string; note?: string };
  invoiceStatus?: PgdInvoiceStatus;
  invoiceNumber?: string;
  documentPointers?: PgdDocumentPointer[];
  registryMetadata?: PgdRequestRegistryMetadata;
  targetDate?: string;
  note?: string;
  /** Người phụ trách xuyên suốt hồ sơ; server luôn chuẩn hóa theo actor khi tạo PYC. */
  ownerUsername?: string;
  ownerAssignedAt?: string;
  dossierChecklist?: PgdDossierChecklistItem[];
  status?: PgdInspectionStatus;
}

export interface PgdIntakeSampleDraft {
  id?: string;
  sampleCode: string;
  catalogOptionId?: string;
  sampleTypeLabel: string;
  customLabel?: string;
  description?: string;
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
  laboratoryName?: string;
  note?: string;
}

/** Create-only envelope; draft sample rows are persisted in the same transaction as the request. */
export interface PgdInspectionRequestCreateInput extends PgdInspectionRequestInput {
  sampleDrafts?: PgdIntakeSampleDraft[];
}

export interface PgdInspectionRequest extends Omit<PgdInspectionRequestInput, 'status' | 'documentPointers' | 'requestCode'> {
  domain: typeof PGD_DOMAIN;
  requestCode: string;
  status: PgdInspectionStatus;
  documentPointers: PgdDocumentPointer[];
  assignmentId?: string;
  fieldInspectionId?: string;
  sampleIds: string[];
  labRequestIds: string[];
  resultTemplateSnapshotId?: string;
  inspectionPlanId?: string;
  caseEventIds?: string[];
  fieldActivityLogIds?: string[];
  labResultReviewId?: string;
  dossierIndexId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  /** Latest reasoned exception branch; the full history remains in PGD activity logs. */
  exceptionReason?: string;
  exceptionAt?: string;
  exceptionByUsername?: string;
}

export type PgdInspectionRequestEditPatch = Partial<Pick<PgdInspectionRequestInput,
  | 'intakeChannel'
  | 'requester'
  | 'customerSnapshot'
  | 'productName'
  | 'productCode'
  | 'brand'
  | 'productDetails'
  | 'quantity'
  | 'unit'
  | 'weight'
  | 'weightUnit'
  | 'lotCode'
  | 'transportName'
  | 'inspectionScope'
  | 'inspectionLocation'
  | 'inspectionScheduledAt'
  | 'standards'
  | 'method'
  | 'assessmentMethod'
  | 'registryMetadata'
  | 'targetDate'
  | 'note'
>>;

const PGD_EDITABLE_REQUEST_FIELDS = [
  'intakeChannel',
  'requester',
  'customerSnapshot',
  'productName',
  'productCode',
  'brand',
  'productDetails',
  'quantity',
  'unit',
  'weight',
  'weightUnit',
  'lotCode',
  'transportName',
  'inspectionScope',
  'inspectionLocation',
  'inspectionScheduledAt',
  'standards',
  'method',
  'assessmentMethod',
  'registryMetadata',
  'targetDate',
  'note',
] as const satisfies readonly (keyof PgdInspectionRequestEditPatch)[];

const PGD_CUSTOMER_EDIT_FIELDS = ['name', 'address', 'taxId', 'phone', 'email', 'contactPerson'] as const;
const PGD_REQUESTER_EDIT_FIELDS = ['name', 'address', 'contactPerson', 'phone', 'email'] as const;

export function normalizePgdInspectionRequestEdit(input: unknown): PgdInspectionRequestEditPatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const field of PGD_EDITABLE_REQUEST_FIELDS) {
    if (!(field in source)) continue;
    if (field === 'customerSnapshot' && source[field] && typeof source[field] === 'object' && !Array.isArray(source[field])) {
      const value = source[field] as Record<string, unknown>;
      patch[field] = Object.fromEntries(PGD_CUSTOMER_EDIT_FIELDS.filter((key) => key in value).map((key) => [key, value[key]]));
      continue;
    }
    if (field === 'requester' && source[field] && typeof source[field] === 'object' && !Array.isArray(source[field])) {
      const value = source[field] as Record<string, unknown>;
      patch[field] = Object.fromEntries(PGD_REQUESTER_EDIT_FIELDS.filter((key) => key in value).map((key) => [key, value[key]]));
      continue;
    }
    patch[field] = clone(source[field]);
  }
  return patch as PgdInspectionRequestEditPatch;
}

export function updatePgdInspectionRequest(
  current: PgdInspectionRequest,
  input: unknown,
  now = new Date().toISOString(),
  catalog: readonly PgdCatalogItem[] = DEFAULT_PGD_CATALOG,
): PgdInspectionRequest {
  const patch = normalizePgdInspectionRequestEdit(input);
  const next = {
    ...clone(current),
    ...patch,
    customerSnapshot: patch.customerSnapshot ? { ...current.customerSnapshot, ...patch.customerSnapshot } : current.customerSnapshot,
    requester: patch.requester ? { ...current.requester, ...patch.requester } : current.requester,
    updatedAt: now,
  } as PgdInspectionRequest;
  const issues = validatePgdIntake(next, catalog);
  if (issues.length > 0) throw new Error(`Dữ liệu hồ sơ PGD chưa hợp lệ: ${issues.map((issue) => issue.field).join(', ')}`);
  return next;
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

export type PgdFieldSessionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface PgdFieldInspection {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  performedAt: string;
  startedAt?: string;
  endedAt?: string;
  sessionCode?: string;
  activityType?: string;
  location: string;
  inspectorUsernames: string[];
  objectDescription?: string;
  inspectedQuantity?: number;
  inspectedUnit?: string;
  lotObservation?: string;
  packaging?: string;
  labeling?: string;
  measurements?: Record<string, string | number>;
  nonconformities?: string[];
  inspectionResult?: string;
  customerRepresentative?: string;
  evidenceAssetIds?: string[];
  sampleIds: string[];
  status?: PgdFieldSessionStatus;
  completed: boolean;
  note?: string;
}

export type PgdFieldSession = PgdFieldInspection;

export interface PgdSample {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  sampleCode: string;
  catalogOptionId?: string;
  sampleTypeLabel?: string;
  customLabel?: string;
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

export function validatePgdIntakeSampleDraft(draft: Partial<PgdIntakeSampleDraft>, index = 0): PgdValidationIssue[] {
  const prefix = `sampleDrafts[${index}]`;
  const issues: PgdValidationIssue[] = [];
  if (!String(draft.sampleCode || '').trim()) issues.push({ field: `${prefix}.sampleCode`, message: 'Cần nhập mã mẫu.' });
  if (!String(draft.sampleTypeLabel || draft.description || '').trim()) issues.push({ field: `${prefix}.sampleTypeLabel`, message: 'Cần nhập tên hoặc mô tả mẫu.' });
  if (!Number.isFinite(Number(draft.quantity)) || Number(draft.quantity) <= 0) issues.push({ field: `${prefix}.quantity`, message: 'Số lượng mẫu phải lớn hơn 0.' });
  if (!String(draft.unit || '').trim()) issues.push({ field: `${prefix}.unit`, message: 'Cần nhập đơn vị mẫu.' });
  if (!['LAB', 'RETAINED'].includes(String(draft.disposition || ''))) issues.push({ field: `${prefix}.disposition`, message: 'Phân loại mẫu không hợp lệ.' });
  if (draft.disposition === 'LAB' && !String(draft.laboratoryName || '').trim()) issues.push({ field: `${prefix}.laboratoryName`, message: 'Mẫu gửi PTN cần có tên phòng thử nghiệm.' });
  if (draft.disposition === 'RETAINED' && !String(draft.sealNumber || '').trim()) issues.push({ field: `${prefix}.sealNumber`, message: 'Mẫu lưu cần có số niêm phong.' });
  if (draft.catalogOptionId && !PGD_SAMPLE_TYPE_OPTIONS.some((option) => option.id === draft.catalogOptionId)) {
    issues.push({ field: `${prefix}.catalogOptionId`, message: 'Loại mẫu không có trong danh mục PGD.' });
  }
  return issues;
}

export function validatePgdIntakeSampleDrafts(drafts: readonly Partial<PgdIntakeSampleDraft>[] = []): PgdValidationIssue[] {
  const issues = drafts.flatMap((draft, index) => validatePgdIntakeSampleDraft(draft, index));
  const seen = new Map<string, number>();
  drafts.forEach((draft, index) => {
    const code = String(draft.sampleCode || '').trim().toLocaleUpperCase();
    if (!code) return;
    const previous = seen.get(code);
    if (previous !== undefined) issues.push({ field: `sampleDrafts[${index}].sampleCode`, message: `Mã mẫu trùng với dòng ${previous + 1}.` });
    else seen.set(code, index);
  });
  return issues;
}

export function createPgdSampleFromIntakeDraft(
  requestId: string,
  draft: PgdIntakeSampleDraft,
  actorUsername?: string,
  now = new Date().toISOString(),
): PgdSample {
  const option = PGD_SAMPLE_TYPE_OPTIONS.find((candidate) => candidate.id === draft.catalogOptionId);
  const label = String(draft.customLabel || draft.sampleTypeLabel || draft.description || option?.label || '').trim();
  const sampleCode = String(draft.sampleCode || '').trim();
  const id = String(draft.id || '').trim() || `pgd-sample-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`;
  return {
    id,
    domain: PGD_DOMAIN,
    requestId,
    sampleCode,
    ...(option ? { catalogOptionId: option.id } : {}),
    sampleTypeLabel: label,
    ...(draft.customLabel ? { customLabel: String(draft.customLabel).trim() } : {}),
    description: String(draft.description || label).trim(),
    quantity: Number(draft.quantity),
    ...(String(draft.unit || '').trim() ? { unit: String(draft.unit).trim() } : {}),
    disposition: draft.disposition,
    ...(String(draft.sealNumber || '').trim() ? { sealNumber: String(draft.sealNumber).trim() } : {}),
    ...(String(draft.sampleSize || '').trim() ? { sampleSize: String(draft.sampleSize).trim() } : {}),
    ...(draft.lotQuantity !== undefined ? { lotQuantity: Number(draft.lotQuantity) } : {}),
    ...(String(draft.lotUnit || '').trim() ? { lotUnit: String(draft.lotUnit).trim() } : {}),
    ...(String(draft.sampledAt || '').trim() ? { sampledAt: String(draft.sampledAt).trim() } : { sampledAt: now }),
    ...(String(draft.samplingLocation || '').trim() ? { samplingLocation: String(draft.samplingLocation).trim() } : {}),
    ...(String(draft.sampledByUsername || actorUsername || '').trim() ? { sampledByUsername: String(draft.sampledByUsername || actorUsername).trim() } : {}),
    ...(String(draft.laboratoryName || '').trim() ? { laboratoryName: String(draft.laboratoryName).trim() } : {}),
    ...(draft.disposition === 'RETAINED' ? { retentionStatus: 'ACTIVE' as const } : {}),
    ...(String(draft.note || '').trim() ? { note: String(draft.note).trim() } : {}),
  };
}

export interface PgdLabRequest {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  sampleId: string;
  status: PgdLabRequestStatus;
  laboratoryName: string;
  laboratoryCode?: string;
  senderUnit?: string;
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
  packageManifestHash?: string;
  packageManifestSnapshot?: Record<string, unknown>;
}

export type PgdApprovalRole = PgdApprovalStep['role'];
export const PGD_APPROVAL_CHAIN: readonly { sequence: number; role: PgdApprovalRole; label: string }[] = [
  { sequence: 1, role: 'TECHNICAL_REVIEW', label: 'Phê duyệt chuyên môn PGD' },
  { sequence: 2, role: 'LEADERSHIP_APPROVAL', label: 'Phê duyệt lãnh đạo Trung tâm / Viện' },
] as const;

export function getPgdRetentionPolicy() {
  return { ...PGD_RETENTION_POLICY };
}

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
  labResultReview?: {
    status?: 'DRAFT' | 'FINAL';
    conformity?: 'CONFORMING' | 'NON_CONFORMING' | 'NOT_REVIEWED';
    retestRequired?: boolean;
  };
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
  if (!String(input.requester?.address || '').trim()) issues.push({ field: 'requester.address', message: 'Cần ghi nhận địa chỉ người/đơn vị gửi yêu cầu.' });
  if (!String(input.requester?.contactPerson || '').trim()) issues.push({ field: 'requester.contactPerson', message: 'Cần ghi nhận người liên hệ của bên yêu cầu.' });
  if (!String(input.requester?.phone || '').trim()) issues.push({ field: 'requester.phone', message: 'Cần ghi nhận số điện thoại bên yêu cầu.' });
  if (!['DIRECT', 'PHONE', 'ONLINE_ZALO', 'EMAIL', 'OTHER'].includes(String(input.intakeChannel || ''))) {
    issues.push({ field: 'intakeChannel', message: 'Kênh tiếp nhận PYC PGD không hợp lệ.' });
  }
  if (!['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER'].includes(String(input.productGroup || ''))) {
    issues.push({ field: 'productGroup', message: 'Nhóm sản phẩm PGD không hợp lệ.' });
  }
  if (!isPgdCatalogItemAllowed(String(input.catalogItemId || ''), catalog)) issues.push({ field: 'catalogItemId', message: 'Loại hình không thuộc catalog PGD hoặc đã bị loại khỏi miền PGD.' });
  const catalogItem = catalog.find((item) => item.id === String(input.catalogItemId || '').trim() && item.domain === PGD_DOMAIN && item.active);
  if (input.pgdGroupCode !== undefined && !isPgdInspectionGroupCode(input.pgdGroupCode)) issues.push({ field: 'pgdGroupCode', message: 'Nhóm nghiệp vụ PGD không hợp lệ.' });
  if (catalogItem?.groupCode && input.pgdGroupCode !== undefined && input.pgdGroupCode !== catalogItem.groupCode) issues.push({ field: 'pgdGroupCode', message: 'Nhóm nghiệp vụ PGD không khớp loại hình đã chọn.' });
  const isQcvnSteelProfile = catalogItem?.productGroup === 'STEEL_METAL' && catalogItem.code === PGD_STEEL_CATALOG_ITEM_CODE;
  const isSteelMetal = catalogItem?.productGroup === 'STEEL_METAL';
  if (catalogItem && catalogItem.productGroup !== input.productGroup) issues.push({ field: 'productGroup', message: 'Loại hình giám định không khớp nhóm sản phẩm PGD.' });
  if (catalogItem && String(input.method || '').trim() && !catalogItem.methodOptions.some((method) => method.code.toUpperCase() === String(input.method).trim().toUpperCase())) {
    issues.push({ field: 'method', message: 'Mã phương thức PGD phải được chọn từ catalog của loại hình giám định.' });
  }
  if (isSteelMetal) {
    const details = input.productDetails || {};
    const requiredSteelFields: Array<[keyof PgdProductDetails, string]> = [
      ['productForm', 'Dạng sản phẩm thép'],
      ['grade', 'Mác thép'],
      ['dimensions', 'Kích thước thép'],
      ['productStandard', 'Tiêu chuẩn sản phẩm'],
      ['manufacturer', 'Nhà sản xuất'],
      ['importer', 'Nhà nhập khẩu'],
      ['hsCode', 'Mã HS'],
      ['manufacturerLotCode', 'Số lô nhà sản xuất / lô hàng'],
      ['lotDefinition', 'Cách xác định lô'],
    ];
    for (const [key, label] of requiredSteelFields) {
      if (!String(details[key] || '').trim()) issues.push({ field: `productDetails.${key}`, message: `Cần nhập ${label} cho hồ sơ thép/kim loại.` });
    }
    if (!String(details.countryOfOrigin || details.origin || '').trim()) issues.push({ field: 'productDetails.countryOfOrigin', message: 'Cần nhập nước xuất xứ cho hồ sơ thép/kim loại.' });
    if (!String(input.lotCode || '').trim()) issues.push({ field: 'lotCode', message: 'Cần nhập số lô hàng thép/kim loại.' });
    if (!Array.isArray(details.customsDocuments) || details.customsDocuments.length === 0) {
      issues.push({ field: 'productDetails.customsDocuments', message: 'Cần ghi nhận ít nhất một chứng từ hải quan / thương mại.' });
    }
    const method = String(input.method || '').trim().toUpperCase();
    if (isQcvnSteelProfile && !['TT58', 'QT-GĐ-14'].includes(method) && !issues.some((issue) => issue.field === 'method')) issues.push({ field: 'method', message: 'Hồ sơ thép theo profile QCVN phải chọn TT58 hoặc QT-GĐ-14.' });
    if (isQcvnSteelProfile && input.assessmentMethod !== 'METHOD_7') issues.push({ field: 'assessmentMethod', message: 'Hồ sơ thép theo profile QCVN phải dùng Phương thức 7.' });
    if (isQcvnSteelProfile && Array.isArray(input.standards) && input.standards.length > 0 && !input.standards.some((standard) => /QCVN\s*20:2019|Sửa đổi 1:2021/i.test(String(standard)))) {
      issues.push({ field: 'standards', message: 'Profile thép QCVN phải có QCVN 20:2019/BKHCN và Sửa đổi 1:2021.' });
    }
  }
  if (catalogItem?.productGroup === 'MACHINERY_LINE') {
    const machinery = input.productDetails?.machinery || {};
    const requiredMachineryFields: Array<[keyof PgdMachineryDetails, string]> = [
      ['machineType', 'loại máy/thiết bị'],
      ['model', 'model'],
      ['serialNumber', 'số serial'],
      ['manufacturingYear', 'năm sản xuất'],
      ['condition', 'tình trạng máy'],
      ['technicalParameters', 'thông số kỹ thuật'],
    ];
    for (const [key, label] of requiredMachineryFields) {
      const value = machinery[key];
      if (key === 'manufacturingYear' ? !Number.isInteger(value) || Number(value) < 1900 || Number(value) > new Date().getFullYear() + 1 : !String(value || '').trim()) {
        issues.push({ field: `productDetails.machinery.${key}`, message: `Cần nhập ${label} cho hồ sơ máy móc/dây chuyền.` });
      }
    }
    if (String(input.method || '').trim().toUpperCase() === 'QT-GĐ-12' && !String(machinery.synchronization || '').trim()) {
      issues.push({ field: 'productDetails.machinery.synchronization', message: 'Cần ghi nhận tính đồng bộ dây chuyền/máy móc theo QT-GĐ-12.' });
    }
  }
  if (catalogItem?.productGroup === 'COAL') {
    const coal = input.productDetails?.coal || {};
    const requiredCoalFields: Array<[keyof PgdCoalDetails, string]> = [
      ['coalType', 'loại than'],
      ['source', 'nguồn/mỏ than'],
    ];
    for (const [key, label] of requiredCoalFields) {
      if (!String(coal[key] || '').trim()) issues.push({ field: `productDetails.coal.${key}`, message: `Cần nhập ${label} cho hồ sơ than.` });
    }
    if (String(input.method || '').trim().toUpperCase() === 'QT-GĐ-08') {
      if (!String(coal.qualityStandard || '').trim()) issues.push({ field: 'productDetails.coal.qualityStandard', message: 'Cần nhập tiêu chuẩn chất lượng than theo QT-GĐ-08.' });
      if (!String(coal.samplingBasis || '').trim()) issues.push({ field: 'productDetails.coal.samplingBasis', message: 'Cần nhập căn cứ lấy mẫu than theo QT-GĐ-08.' });
    }
  }
  if (input.assessmentMethod !== undefined && !PGD_ASSESSMENT_METHOD_OPTIONS.some((option) => option.code === input.assessmentMethod)) {
    issues.push({ field: 'assessmentMethod', message: 'Phương thức ĐGSPH phải được chọn từ danh mục đã xác nhận.' });
  }
  if (input.priority !== undefined && !['NORMAL', 'URGENT'].includes(String(input.priority))) {
    issues.push({ field: 'priority', message: 'Mức ưu tiên PGD không hợp lệ.' });
  }
  if (input.priority === 'URGENT' && !String(input.urgentReason || '').trim()) {
    issues.push({ field: 'urgentReason', message: 'Hồ sơ ưu tiên phải ghi rõ lý do.' });
  }
  if (input.invoiceStatus !== undefined && !['NOT_REQUIRED', 'PENDING', 'ISSUED', 'PAID'].includes(String(input.invoiceStatus))) {
    issues.push({ field: 'invoiceStatus', message: 'Trạng thái hóa đơn PGD không hợp lệ.' });
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
  managementRoleCode?: OrganizationManagementRoleCode;
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
    if (!user || user.active === false || !scopes.has('PGD') || (!isOrganizationLeader(user) && !['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL'].includes(role))) {
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
  const catalogItem = catalog.find((item) => item.id === String(input.catalogItemId || '').trim() && item.domain === PGD_DOMAIN && item.active);
  const pgdGroupCode = input.pgdGroupCode || catalogItem?.groupCode;
  return {
    ...clone(input),
    requestCode: String(input.requestCode).trim(),
    domain: PGD_DOMAIN,
    ...(pgdGroupCode ? { pgdGroupCode } : {}),
    ...(registryMetadata ? { registryMetadata } : {}),
    status: 'DRAFT',
    documentPointers: clone(input.documentPointers || []),
    sampleIds: [],
    labRequestIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Reassigns the single operational owner of a new PGD dossier.
 * This helper deliberately changes only the owner snapshot and timestamp;
 * authorization and activity-log writing stay at the server boundary.
 */
export function assignPgdDossierOwner(request: PgdInspectionRequest, ownerUsername: string, now = new Date().toISOString()): PgdInspectionRequest {
  const normalizedOwner = String(ownerUsername || '').trim();
  if (!normalizedOwner) throw new Error('Hồ sơ PGD cần username người phụ trách.');
  return {
    ...clone(request),
    domain: PGD_DOMAIN,
    ownerUsername: normalizedOwner,
    ownerAssignedAt: now,
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
  if (current === 'RESULTS_REVIEW' && next === 'TECHNICAL_REVIEW') {
    if (!context.labResultReview || context.labResultReview.status !== 'FINAL') return 'Cần hoàn tất bản đánh giá KQTN trước khi soát xét kỹ thuật.';
    if (context.labResultReview.retestRequired === true || context.labResultReview.conformity === 'NON_CONFORMING') return 'Kết quả KQTN đang yêu cầu kiểm tra/thử lại mẫu trước khi soát xét kỹ thuật.';
  }
  if (current === 'TECHNICAL_REVIEW' && !context.reportReady) return 'Chưa hoàn thiện báo cáo giám định để trình phê duyệt.';
  if (current === 'LEADERSHIP_APPROVAL' && !context.hasCertificate) return 'Chưa có dự thảo chứng thư giám định để trình ký.';
  if (current === 'SIGNED' && !context.signed) return 'Chưa ghi nhận đầy đủ chữ ký trước khi trả kết quả.';
  return null;
}

export function getPgdApprovalDenial(
  currentStatus: PgdInspectionStatus,
  approvalRole: PgdApprovalRole,
  user: PgdMutationUser = {},
): string | null {
  if (currentStatus !== approvalRole) return 'Bước phê duyệt không khớp trạng thái hồ sơ PGD.';
  const systemRole = String(user.systemRole || user.role || '').trim().toLowerCase();
  const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
  if (systemRole === 'admin' || isOrganizationLeader(user) || pgdRole === 'PGD_ADMIN' || pgdRole === 'PGD_MANAGER') return null;
  if (approvalRole === 'TECHNICAL_REVIEW' && pgdRole === 'PGD_TECHNICAL') return null;
  return approvalRole === 'TECHNICAL_REVIEW'
    ? 'Tài khoản không có phạm vi phê duyệt chuyên môn PGD.'
    : 'Tài khoản không có phạm vi phê duyệt lãnh đạo PGD.';
}

/** PGD uses the existing two lifecycle statuses as the two ordered approval steps. */
export function getPgdApprovalRoleForStatus(status: PgdInspectionStatus): PgdApprovalRole | null {
  return status === 'TECHNICAL_REVIEW' || status === 'LEADERSHIP_APPROVAL' ? status : null;
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
    sampledAt?: string;
  },
  now = new Date().toISOString(),
): { lab: PgdSample; retained: PgdSample } {
  if (!Number.isFinite(input.quantity) || input.quantity < 2) throw new Error('Mẫu PGD phải có đủ số lượng để tách phần PTN và mẫu lưu.');
  const labQuantity = Math.ceil(input.quantity / 2);
  const sampledAt = new Date(input.sampledAt || now).toISOString();
  const retainedUntilDate = new Date(sampledAt);
  retainedUntilDate.setUTCMonth(retainedUntilDate.getUTCMonth() + PGD_RETENTION_POLICY.retainedSampleMonths);
  const retainedUntil = retainedUntilDate.toISOString();
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
      retainedUntil,
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
  const laboratoryCode = String(input.laboratoryCode || '').trim() || undefined;
  const senderUnit = String(input.senderUnit || '').trim() || undefined;
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
    ...(laboratoryCode ? { laboratoryCode } : {}),
    ...(senderUnit ? { senderUnit } : {}),
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
  managementRoleCode?: OrganizationManagementRoleCode;
  professionalRoleCodes?: ProfessionalRoleCode[];
  departmentRoleCode?: string;
  position?: string;
  departmentScopes?: string[];
  pgdRole?: string;
}

const PGD_DOSSIER_EDIT_LOCKED_STATUSES = new Set<PgdInspectionStatus>(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED']);

export function isPgdSystemManager(user: PgdMutationUser = {}): boolean {
  const systemRoles = [user.systemRole, user.role].map((value) => String(value || '').trim().toLowerCase());
  if (systemRoles.includes('admin')) return true;
  return isOrganizationLeader(user);
}

/** PGD operational managers may see the action surface, but mutation guards remain authoritative. */
export function isPgdDossierActionViewer(user: PgdMutationUser = {}): boolean {
  if (isPgdSystemManager(user)) return true;
  return ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(user.pgdRole || '').trim().toUpperCase());
}

export function getPgdDossierEditDenial(
  request: Pick<PgdInspectionRequest, 'status'>,
  user: PgdMutationUser = {},
): string | null {
  if (!isPgdSystemManager(user)) return 'Chỉ Admin hoặc Quản lý toàn hệ thống mới được sửa thông tin hồ sơ PGD.';
  if (String(user.pgdRole || '').trim().toUpperCase() === 'PGD_VIEWER') return 'Tài khoản viewer PGD chỉ được đọc dữ liệu.';
  if (PGD_DOSSIER_EDIT_LOCKED_STATUSES.has(request.status)) {
    return 'Hồ sơ PGD đã ký/trả kết quả/lưu trữ; muốn sửa phải thu hồi có lý do trước.';
  }
  return null;
}

const PGD_HARD_DELETABLE_STATUSES = new Set<PgdInspectionStatus>(['DRAFT', 'REJECTED', 'CANCELLED', 'ON_HOLD']);

export function getPgdDossierDeletionDenial(
  request: Pick<PgdInspectionRequest, 'status'>,
  user: PgdMutationUser = {},
): string | null {
  if (!isPgdSystemManager(user)) return 'Chỉ Admin hoặc Quản lý toàn hệ thống mới được xóa hồ sơ PGD.';
  if (String(user.pgdRole || '').trim().toUpperCase() === 'PGD_VIEWER') return 'Tài khoản viewer PGD chỉ được đọc dữ liệu.';
  if (!PGD_HARD_DELETABLE_STATUSES.has(request.status)) {
    return 'Hồ sơ PGD đã có hoạt động thực thi hoặc đã ký/trả/lưu trữ, không thể xóa.';
  }
  return null;
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
