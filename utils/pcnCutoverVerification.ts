import { createHash } from 'node:crypto';
import type { PcnBackupVerification } from './pcnBackupVerification.ts';
import type { PcnCustomerImportAuditCheckpoint } from './pcnCustomerImportAudit.ts';

export const PCN_ACTIVE_COLLECTIONS = [
  'pcnCertificationFields',
  'certificationProposals',
  'certificationDossiers',
  'pcnDocumentRequirements',
  'pcnTemplateDefinitions',
  'pcnOfficialGeneratedDocuments',
  'dossierDocuments',
  'dossierAttachments',
  'pcnGeneratedDocuments',
  'pcnSampleLots',
  'pcnSampleRoutes',
  'pcnSampleFlowEvents',
  'labRequests',
  'returnedResults',
  'approvalSteps',
  'issuancePackages',
  'pcnSignerDelegations',
  'customers',
  'pcnHaimyStaging',
  'systemUsers',
  'pcnDepartmentRoles',
  'systemConfig',
  'userPreferences',
  'passwordResetRequests',
  'notifications',
  'activityLogs',
] as const;

export const PCN_DDT_COLLECTIONS = [
  'requests',
  'handoverDocs',
  'kqtnRecords',
  'products',
  'brands',
] as const;

const PCN_ACTIVITY_ENTITY_TYPES = new Set([
  'PCN_PROPOSAL',
  'PCN_DOSSIER',
  'PCN_CUSTOMER',
  'PCN_LAB_REQUEST',
  'PCN_RESULT',
  'PCN_APPROVAL',
  'PCN_ISSUANCE',
  'PCN_TEMPLATE',
  'PCN_FIELD',
  'PCN_USER',
  'PCN_SIGNER_DELEGATION',
  'PCN_QUALITY_DOCUMENT',
  'PCN_SAMPLE_LOT',
  'SYSTEM',
]);

const REQUIRED_FILE_POINTER_FIELDS = [
  ['bucketName', 'bucket_name'],
  ['objectPath', 'object_path'],
  ['sourceCollection', 'source_collection'],
  ['sourceDocumentId', 'source_document_id'],
  ['sourceJsonPath', 'source_json_path'],
  ['mimeType', 'mime_type'],
] as const;

type CutoverRow = Record<string, unknown>;

export interface PcnCutoverFileAssetRow extends CutoverRow {
  id: string;
  bucketName?: string;
  bucket_name?: string;
  objectPath?: string;
  object_path?: string;
  sourceCollection?: string;
  source_collection?: string;
  sourceDocumentId?: string;
  source_document_id?: string;
  sourceJsonPath?: string;
  source_json_path?: string;
  mimeType?: string;
  mime_type?: string;
  byteSize?: number | string;
  byte_size?: number | string;
  sha256?: string | null;
}

export interface PcnCutoverReconciliationInput {
  proposals?: CutoverRow[];
  dossiers?: CutoverRow[];
  fileAssets?: PcnCutoverFileAssetRow[];
  notifications?: CutoverRow[];
  activityLogs?: CutoverRow[];
}

export interface PcnCutoverReconciliation {
  ok: boolean;
  proposalCount: number;
  dossierCount: number;
  fileAssetCount: number;
  notificationCount: number;
  activityLogCount: number;
  proposalHash: string;
  dossierHash: string;
  fileAssetHash: string;
  notificationHash: string;
  activityLogHash: string;
  orphanProposalLinkCount: number;
  orphanDossierLinkCount: number;
  invalidFilePointerCount: number;
  invalidNotificationCount: number;
  invalidActivityLogCount: number;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as CutoverRow)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hashRows(rows: CutoverRow[]): string {
  const canonical = rows
    .map((row) => stableValue(row))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

function rowId(row: CutoverRow): string {
  return String(row.id ?? row.documentId ?? row.document_id ?? '').trim();
}

function rowValue(row: CutoverRow, camelKey: string, snakeKey: string): string {
  return String(row[camelKey] ?? row[snakeKey] ?? '').trim();
}

function countOrphanLinks(rows: CutoverRow[], linkKey: string, targetIds: Set<string>): number {
  return rows.filter((row) => {
    const link = String(row[linkKey] ?? '').trim();
    return !link || !targetIds.has(link);
  }).length;
}

function isValidFilePointer(row: PcnCutoverFileAssetRow): boolean {
  if (!rowId(row)) return false;
  if (REQUIRED_FILE_POINTER_FIELDS.some(([camelKey, snakeKey]) => !rowValue(row, camelKey, snakeKey))) return false;
  const byteSize = Number(row.byteSize ?? row.byte_size);
  if (!Number.isFinite(byteSize) || byteSize < 0) return false;
  return /^[a-f0-9]{64}$/i.test(String(row.sha256 || '').trim());
}

export function buildPcnCutoverReconciliation(input: PcnCutoverReconciliationInput = {}): PcnCutoverReconciliation {
  const proposals = input.proposals || [];
  const dossiers = input.dossiers || [];
  const fileAssets = input.fileAssets || [];
  const notifications = input.notifications || [];
  const activityLogs = input.activityLogs || [];
  const proposalIds = new Set(proposals.map(rowId).filter(Boolean));
  const dossierIds = new Set(dossiers.map(rowId).filter(Boolean));
  const orphanProposalLinkCount = countOrphanLinks(proposals, 'dossierId', dossierIds);
  const orphanDossierLinkCount = countOrphanLinks(dossiers, 'proposalId', proposalIds);
  const invalidFilePointerCount = fileAssets.filter((row) => !isValidFilePointer(row)).length;
  const invalidNotificationCount = notifications.filter((row) => {
    const entityType = String(row.entityType || '').trim();
    return !rowId(row).startsWith('pcn-notif-') || !PCN_ACTIVITY_ENTITY_TYPES.has(entityType) || !entityType.startsWith('PCN_');
  }).length;
  const invalidActivityLogCount = activityLogs.filter((row) => !PCN_ACTIVITY_ENTITY_TYPES.has(String(row.entityType || '').trim())).length;

  return {
    ok: orphanProposalLinkCount === 0 && orphanDossierLinkCount === 0 && invalidFilePointerCount === 0 && invalidNotificationCount === 0 && invalidActivityLogCount === 0,
    proposalCount: proposals.length,
    dossierCount: dossiers.length,
    fileAssetCount: fileAssets.length,
    notificationCount: notifications.length,
    activityLogCount: activityLogs.length,
    proposalHash: hashRows(proposals),
    dossierHash: hashRows(dossiers),
    fileAssetHash: hashRows(fileAssets),
    notificationHash: hashRows(notifications),
    activityLogHash: hashRows(activityLogs),
    orphanProposalLinkCount,
    orphanDossierLinkCount,
    invalidFilePointerCount,
    invalidNotificationCount,
    invalidActivityLogCount,
  };
}

export interface PcnCutoverSnapshot {
  profile: string;
  database: string;
  collectionNames: string[];
  ddtCollectionNames?: string[];
  fieldCodes: string[];
  customerCount: number;
  customerHash?: string;
  customerKeyReconciliation?: PcnCustomerKeyReconciliationSummary;
  customerDataIntegrity?: PcnCustomerDataIntegritySummary;
  latestCustomerImportCheckpoint?: PcnCustomerImportAuditCheckpoint;
  customerImportBackupVerification?: PcnBackupVerification;
  backupVerification?: PcnBackupVerification;
  legacyCollectionReconciliation?: PcnLegacyCollectionReconciliationSummary[];
  hasActivityLogAppendOnlyTrigger: boolean;
  hasFileAssetsTable: boolean;
  reconciliation?: PcnCutoverReconciliation;
}

export interface PcnCustomerKeyReconciliationSummary {
  missingKeyCount: number;
  extraKeyCount: number;
  changedKeyCount: number;
  duplicateSourceKeyCount: number;
  duplicateTargetKeyCount: number;
}

export interface PcnCustomerDataIntegritySummary {
  emptyTargetRecordCount: number;
}

export interface PcnLegacyCollectionReconciliationSummary {
  legacyCollection: string;
  canonicalCollection: string;
  legacyCount: number;
  matchingCount: number;
  missingCanonicalCount: number;
  conflictingCount: number;
  safeToRemove: boolean;
}

export interface PcnCutoverVerificationOptions {
  expectedDatabase: string;
  expectedCustomerCount?: number;
  expectedCustomerHash?: string;
  requireVerifiedBackup?: boolean;
  requireCustomerImportCheckpoint?: boolean;
}

export interface PcnCutoverVerificationResult {
  ok: boolean;
  errors: string[];
}

export function verifyPcnCutoverSnapshot(
  snapshot: PcnCutoverSnapshot,
  options: PcnCutoverVerificationOptions,
): PcnCutoverVerificationResult {
  const errors: string[] = [];
  const allowedCollections = new Set<string>(PCN_ACTIVE_COLLECTIONS);
  const unknownCollections = snapshot.collectionNames.filter((name) => !allowedCollections.has(name));
  const ddtCollections = new Set<string>(PCN_DDT_COLLECTIONS);
  const ddtCollectionNames = snapshot.ddtCollectionNames || snapshot.collectionNames.filter((name) => ddtCollections.has(name));

  if (snapshot.profile.trim().toLowerCase() !== 'pcn') {
    errors.push(`APP_PROFILE phải là pcn, nhận được: ${snapshot.profile || '(trống)'}.`);
  }
  if (snapshot.database !== options.expectedDatabase) {
    errors.push(`Database hiện tại phải là ${options.expectedDatabase}, nhận được: ${snapshot.database || '(trống)'}.`);
  }
  if (ddtCollectionNames.length > 0) {
    errors.push(`Phát hiện collection nghiệp vụ DDT trong database PCN: ${ddtCollectionNames.join(', ')}.`);
  }
  if (unknownCollections.length > 0) {
    const legacyPlans = new Map(
      (snapshot.legacyCollectionReconciliation || []).map((plan) => [plan.legacyCollection, plan]),
    );
    const legacyDetails = unknownCollections.map((collectionName) => {
      const plan = legacyPlans.get(collectionName);
      if (!plan) return collectionName;
      const status = plan.safeToRemove && plan.missingCanonicalCount === 0 && plan.conflictingCount === 0
        ? 'an toàn để dọn sau khi nghiệm thu'
        : 'chưa an toàn để dọn';
      return `${collectionName} → ${plan.canonicalCollection}: ${plan.legacyCount} bản ghi, trùng ${plan.matchingCount}, thiếu canonical ${plan.missingCanonicalCount}, xung đột ${plan.conflictingCount}; ${status}`;
    });
    errors.push(`Phát hiện collection ngoài allowlist PCN: ${legacyDetails.join('; ')}.`);
  }

  const fieldCodes = new Set(snapshot.fieldCodes.map((code) => code.trim().toUpperCase()));
  for (const requiredCode of ['QC4', 'QC9']) {
    if (!fieldCodes.has(requiredCode)) errors.push(`Thiếu lĩnh vực quy chuẩn bắt buộc: ${requiredCode}.`);
  }
  if (options.expectedCustomerCount !== undefined && snapshot.customerCount !== options.expectedCustomerCount) {
    errors.push(`Số khách hàng phải là ${options.expectedCustomerCount}, nhận được ${snapshot.customerCount}.`);
  }
  if (options.expectedCustomerHash && snapshot.customerHash !== options.expectedCustomerHash) {
    const reconciliation = snapshot.customerKeyReconciliation;
    const detail = reconciliation
      ? ` (đối soát khóa: thiếu ${reconciliation.missingKeyCount}, thừa ${reconciliation.extraKeyCount}, khác trường ${reconciliation.changedKeyCount}; trùng nguồn ${reconciliation.duplicateSourceKeyCount}, trùng đích ${reconciliation.duplicateTargetKeyCount})`
      : '';
    errors.push(`Hash danh mục khách hàng không khớp với file nguồn đối soát${detail}.`);
  }
  const emptyCustomerCount = snapshot.customerDataIntegrity?.emptyTargetRecordCount || 0;
  if (emptyCustomerCount > 0) {
    errors.push(`Danh mục customers có ${emptyCustomerCount} bản ghi khách hàng không có dữ liệu nghiệp vụ.`);
  }
  if (options.requireVerifiedBackup) {
    if (!snapshot.backupVerification) {
      errors.push('Chưa có archive PCN được kiểm chứng trước cutover.');
    } else if (!snapshot.backupVerification.ok) {
      const details = snapshot.backupVerification.errors.slice(0, 3).join(' ');
      errors.push(`Archive PCN chưa đạt cổng kiểm chứng${details ? `: ${details}` : '.'}`);
    }
    if (options.requireCustomerImportCheckpoint && !snapshot.latestCustomerImportCheckpoint) {
      errors.push('Chưa có bằng chứng checkpoint backup PCN trước lần import khách hàng.');
    }
    if (snapshot.latestCustomerImportCheckpoint) {
      const checkpoint = snapshot.latestCustomerImportCheckpoint;
      const checkpointAt = Date.parse(checkpoint.createdAt);
      const auditAt = Date.parse(checkpoint.auditCreatedAt);
      if (!Number.isFinite(checkpointAt) || !Number.isFinite(auditAt) || checkpointAt > auditAt) {
        errors.push(`Checkpoint backup ${checkpoint.filename} không có thứ tự thời gian hợp lệ trước audit import.`);
      }
      if (!/^[a-f0-9]{64}$/i.test(String(checkpoint.sourceFingerprint || '').trim())) {
        errors.push(`Checkpoint backup ${checkpoint.filename} thiếu fingerprint nguồn hợp lệ.`);
      }
      const checkpointVerification = snapshot.customerImportBackupVerification;
      if (!checkpointVerification) {
        errors.push(`Archive checkpoint ${checkpoint.filename} không còn được kiểm chứng lại hoặc không khớp mốc đã ghi trong audit import.`);
      } else if (checkpointVerification.filename !== checkpoint.filename
        || !checkpointVerification.ok
        || checkpointVerification.status !== 'VALID') {
        const details = checkpointVerification.errors.slice(0, 3).join(' ');
        errors.push(`Archive checkpoint ${checkpoint.filename} chưa đạt trạng thái VALID${details ? `: ${details}` : '.'}`);
      }
    }
  }
  if (!snapshot.hasActivityLogAppendOnlyTrigger) {
    errors.push('Thiếu trigger append-only cho activityLogs.');
  }
  if (!snapshot.hasFileAssetsTable) {
    errors.push('Thiếu bảng file_assets cho metadata pointer của tệp.');
  }
  if (snapshot.reconciliation && !snapshot.reconciliation.ok) {
    const reconciliation = snapshot.reconciliation;
    if (reconciliation.orphanProposalLinkCount > 0 || reconciliation.orphanDossierLinkCount > 0) {
      errors.push(`Hồ sơ PCN có ${reconciliation.orphanProposalLinkCount + reconciliation.orphanDossierLinkCount} liên kết Đề nghị/Hồ sơ mồ côi.`);
    }
    if (reconciliation.invalidFilePointerCount > 0) {
      errors.push(`Có ${reconciliation.invalidFilePointerCount} file pointer PCN không hợp lệ.`);
    }
    if (reconciliation.invalidNotificationCount > 0) {
      errors.push(`Có ${reconciliation.invalidNotificationCount} notification ngoài namespace PCN hợp lệ.`);
    }
    if (reconciliation.invalidActivityLogCount > 0) {
      errors.push(`Có ${reconciliation.invalidActivityLogCount} activity log ngoài allowlist entity PCN.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// --- End of pcnCutoverVerification.ts ---
