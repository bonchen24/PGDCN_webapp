import type {
  PcnHaimyDiscoveryInput,
  PcnHaimyDiscoveryReport,
  PcnHaimyExportRecord,
  PcnHaimyImportPlan,
  PcnHaimyStagingIssue,
  PcnHaimyStagingRecord,
} from '../types.ts';

export type {
  PcnHaimyDiscoveryInput,
  PcnHaimyDiscoveryReport,
  PcnHaimyExportRecord,
  PcnHaimyImportPlan,
  PcnHaimyStagingIssue,
  PcnHaimyStagingRecord,
};

type Capability = 'api' | 'export' | 'identifiers' | 'retry' | 'credentials';

const CAPABILITIES: readonly Capability[] = ['api', 'export', 'identifiers', 'retry', 'credentials'];
const SUPPORTED_EXPORT_FORMATS = new Set(['csv', 'json', 'xlsx']);

interface NormalizedHaimyRecord {
  sourceSystem: string;
  externalRegistrationId: string;
  externalBatchId: string;
  externalCertificateId: string;
  registrationCode: string;
  customerName: string;
  productName: string;
  model: string;
  brand: string;
  fieldCode: string;
  quantityProvided: boolean;
  quantity?: number;
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

/** A deterministic, browser-safe digest for idempotency namespacing, not a security checksum. */
function stableDigest(value: string): string {
  let left = 2166136261;
  let right = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left ^= code;
    left = Math.imul(left, 16777619);
    right ^= code + index;
    right = Math.imul(right, 3266489917);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildPcnHaimyDiscoveryReport(input: PcnHaimyDiscoveryInput = {}): PcnHaimyDiscoveryReport {
  const hasApi = Boolean(text(input.apiEndpoint));
  const hasExport = (input.exportFormats || []).some((format) => SUPPORTED_EXPORT_FORMATS.has(text(format).toLowerCase().replace(/^\./, '')));
  const hasIdentifiers = (input.identifiers || []).some((identifier) => text(identifier) === 'externalRegistrationId');
  const hasRetry = Boolean(input.retryContract?.supportsIdempotencyKey && text(input.retryContract.duplicateResponseSemantics));
  const hasCredentials = input.credentialConfigured === true;
  const confirmedCapabilities = CAPABILITIES.filter((capability) => ({
    api: hasApi,
    export: hasExport,
    identifiers: hasIdentifiers,
    retry: hasRetry,
    credentials: hasCredentials,
  })[capability]);
  const unknownCapabilities = CAPABILITIES.filter((capability) => !confirmedCapabilities.includes(capability));
  const importEnabled = hasExport && hasIdentifiers;

  return {
    provider: 'HAIMY',
    status: confirmedCapabilities.length === CAPABILITIES.length ? 'CONTRACT_READY' : importEnabled ? 'IMPORT_ONLY' : 'UNCONFIGURED',
    importEnabled,
    canWriteUpstream: false,
    confirmedCapabilities,
    unknownCapabilities,
    writeBlockReason: 'Boundary ghi ngược upstream chưa được triển khai; PCN chỉ cho phép staging/import một lần cho tới khi contract được phê duyệt.',
  };
}

function normalizeRecord(record: PcnHaimyExportRecord): NormalizedHaimyRecord {
  const source = record && typeof record === 'object' ? record : {};
  const quantityText = text(source.quantity);
  const quantity = quantityText === '' ? undefined : Number(quantityText);
  return {
    sourceSystem: text(source.sourceSystem).toUpperCase() || 'HAIMY',
    externalRegistrationId: text(source.externalRegistrationId),
    externalBatchId: text(source.externalBatchId),
    externalCertificateId: text(source.externalCertificateId),
    registrationCode: text(source.registrationCode),
    customerName: text(source.customerName),
    productName: text(source.productName),
    model: text(source.model),
    brand: text(source.brand),
    fieldCode: text(source.fieldCode).toUpperCase(),
    quantityProvided: source.quantity !== undefined && source.quantity !== null && quantityText !== '',
    quantity: Number.isFinite(quantity) ? quantity : undefined,
  };
}

function addIssue(issues: PcnHaimyStagingIssue[], code: string, message: string): void {
  issues.push({ code, message });
}

function buildStagingRecord(batchId: string, record: PcnHaimyExportRecord): PcnHaimyStagingRecord {
  const normalized = normalizeRecord(record);
  const externalRegistrationId = String(normalized.externalRegistrationId || '');
  const sourceSystem = String(normalized.sourceSystem || 'HAIMY');
  const sourcePayloadFingerprint = stableDigest(stableJson(normalized));
  const identitySeed = externalRegistrationId
    ? `${sourceSystem}|externalRegistrationId|${externalRegistrationId}`
    : `${sourceSystem}|payload|${sourcePayloadFingerprint}`;
  const issues: PcnHaimyStagingIssue[] = [];

  if (!externalRegistrationId) addIssue(issues, 'MISSING_EXTERNAL_REGISTRATION_ID', 'Thiếu mã đăng ký bên ngoài; cần đối chiếu trước khi liên kết hồ sơ.');
  if (!normalized.customerName) addIssue(issues, 'MISSING_CUSTOMER_NAME', 'Thiếu tên khách hàng.');
  if (!normalized.productName) addIssue(issues, 'MISSING_PRODUCT_NAME', 'Thiếu tên sản phẩm.');
  if (!normalized.fieldCode) addIssue(issues, 'MISSING_FIELD_CODE', 'Thiếu mã lĩnh vực QC4/QC9.');
  else if (!['QC4', 'QC9'].includes(String(normalized.fieldCode))) addIssue(issues, 'UNSUPPORTED_FIELD_CODE', 'Mã lĩnh vực chưa thuộc danh mục PCN hiện hành.');
  if (normalized.quantityProvided && (normalized.quantity === undefined || !Number.isInteger(normalized.quantity) || normalized.quantity < 0)) addIssue(issues, 'INVALID_QUANTITY', 'Số lượng phải là số nguyên không âm.');

  return {
    batchId,
    sourceSystem,
    idempotencyKey: `pcn-haimy-${stableDigest(identitySeed)}`,
    sourcePayloadFingerprint,
    ...(externalRegistrationId ? { externalRegistrationId } : {}),
    ...(normalized.externalBatchId ? { externalBatchId: String(normalized.externalBatchId) } : {}),
    ...(normalized.externalCertificateId ? { externalCertificateId: String(normalized.externalCertificateId) } : {}),
    ...(normalized.registrationCode ? { registrationCode: String(normalized.registrationCode) } : {}),
    ...(normalized.customerName ? { customerName: String(normalized.customerName) } : {}),
    ...(normalized.productName ? { productName: String(normalized.productName) } : {}),
    ...(normalized.model ? { model: String(normalized.model) } : {}),
    ...(normalized.brand ? { brand: String(normalized.brand) } : {}),
    ...(normalized.fieldCode ? { fieldCode: String(normalized.fieldCode) } : {}),
    ...(normalized.quantity !== undefined && Number.isInteger(normalized.quantity) && normalized.quantity >= 0 ? { quantity: normalized.quantity } : {}),
    status: issues.length === 0 ? 'READY_FOR_REVIEW' : 'NEEDS_REVIEW',
    issues,
  };
}

export function buildPcnHaimyImportPlan(input: { batchId: string; records: PcnHaimyExportRecord[] }): PcnHaimyImportPlan {
  const batchId = text(input.batchId);
  if (!batchId) throw new Error('batchId là bắt buộc cho import Haimy.');
  if (!Array.isArray(input.records)) throw new Error('records phải là một mảng export Haimy.');

  const items = input.records.map((record) => buildStagingRecord(batchId, record));
  const byIdentity = new Map<string, PcnHaimyStagingRecord>();
  for (const item of items) {
    const previous = byIdentity.get(item.idempotencyKey);
    if (!previous) {
      byIdentity.set(item.idempotencyKey, item);
      continue;
    }
    const samePayload = previous.sourcePayloadFingerprint === item.sourcePayloadFingerprint;
    item.status = samePayload ? 'DUPLICATE_NOOP' : 'CONFLICT';
    if (!samePayload) previous.status = 'CONFLICT';
    addIssue(item.issues, samePayload ? 'DUPLICATE_IDENTICAL_RECORD' : 'CONFLICTING_EXTERNAL_IDENTITY', samePayload
      ? 'Bản ghi trùng định danh và cùng nội dung; không tạo lần ghi mới.'
      : 'Định danh bên ngoài đã xuất hiện với nội dung khác; không được ghi đè tự động.');
    if (!samePayload) addIssue(previous.issues, 'CONFLICTING_EXTERNAL_IDENTITY', 'Định danh bên ngoài đã xuất hiện với nội dung khác; không được ghi đè tự động.');
  }

  return { batchId, mode: 'STAGING_ONLY', items, upstreamActions: [] };
}

export function comparePcnHaimyStagingRecords(left: PcnHaimyStagingRecord, right: PcnHaimyStagingRecord): {
  sameIdentity: boolean;
  samePayload: boolean;
  action: 'NOOP' | 'CONFLICT' | 'NEW';
} {
  const sameIdentity = left.idempotencyKey === right.idempotencyKey;
  const samePayload = left.sourcePayloadFingerprint === right.sourcePayloadFingerprint;
  return { sameIdentity, samePayload, action: sameIdentity ? (samePayload ? 'NOOP' : 'CONFLICT') : 'NEW' };
}

// --- End of pcnIntegration.ts ---
