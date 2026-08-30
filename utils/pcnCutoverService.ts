import { pool } from './db.js';
import { buildPcnCustomerReconciliation, hashPcnCustomers } from './pcnCustomerMigration.ts';
import type { CustomerRef } from '../types.ts';
import { buildPcnCutoverReconciliation, PCN_DDT_COLLECTIONS, type PcnCutoverSnapshot } from './pcnCutoverVerification.ts';
import { PCN_LEGACY_COLLECTION_MAPPINGS, planPcnLegacyCollectionReconciliation } from './pcnLegacyCollectionPolicy.ts';
import { listBackups, verifyBackupArchive } from './backupManager.js';
import { getLatestPcnCustomerImportCheckpoint } from './pcnCustomerImportAudit.ts';

export interface PcnCutoverSnapshotResult {
  snapshot: PcnCutoverSnapshot;
  customers: CustomerRef[];
}

function toCustomer(row: { document_id: unknown; data: unknown }): CustomerRef {
  const data = (row.data || {}) as CustomerRef;
  return {
    ...data,
    name: String(data.name || ''),
    address: String(data.address || ''),
    customerCode: data.customerCode || (data.name ? undefined : String(row.document_id || '')),
  };
}

export async function loadPcnCutoverSnapshot(): Promise<PcnCutoverSnapshotResult> {
  const backups = listBackups();
  const latestBackup = backups[0];
  const backupVerification = latestBackup ? await verifyBackupArchive(latestBackup.filename) : undefined;
  const databaseResult = await pool.query('SELECT current_database() AS database');
  const collectionsResult = await pool.query(
    'SELECT DISTINCT collection_name FROM app_documents ORDER BY collection_name',
  );
  const collectionNames = collectionsResult.rows.map((row) => String(row.collection_name));
  const ddtCollectionSet = new Set<string>(PCN_DDT_COLLECTIONS);
  const ddtCollectionNames = collectionNames.filter((name) => ddtCollectionSet.has(name));
  const legacyCollectionNames = PCN_LEGACY_COLLECTION_MAPPINGS.flatMap((mapping) => [mapping.legacyCollection, mapping.canonicalCollection]);
  const legacyRowsResult = await pool.query(
    `SELECT collection_name, document_id, data
     FROM app_documents
     WHERE collection_name = ANY($1::text[])
     ORDER BY collection_name, document_id`,
    [legacyCollectionNames],
  );
  const fieldsResult = await pool.query(
    `SELECT document_id
     FROM app_documents
     WHERE collection_name = 'pcnCertificationFields'
       AND COALESCE((data->>'active')::boolean, false) = true
     ORDER BY document_id`,
  );
  const customersResult = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'customers'
     ORDER BY document_id`,
  );
  const proposalsResult = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'certificationProposals'
     ORDER BY document_id`,
  );
  const dossiersResult = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'certificationDossiers'
     ORDER BY document_id`,
  );
  const fileAssetsRowsResult = await pool.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
     FROM file_assets
     ORDER BY id`,
  );
  const notificationsResult = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'notifications'
     ORDER BY document_id`,
  );
  const activityLogsResult = await pool.query(
    `SELECT document_id, data
     FROM app_documents
     WHERE collection_name = 'activityLogs'
     ORDER BY document_id`,
  );
  const triggerResult = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_trigger trigger_row
       JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
       JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
       WHERE namespace_row.nspname = 'public'
         AND table_row.relname = 'app_documents'
         AND trigger_row.tgname = 'trg_pcn_activity_logs_append_only'
         AND trigger_row.tgisinternal = false
     ) AS enabled`,
  );
  const fileAssetsPresenceResult = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'file_assets'
     ) AS present`,
  );

  const customers = customersResult.rows.map(toCustomer);
  const activityLogs = activityLogsResult.rows.map((row) => ({ ...(row.data || {}), id: String(row.document_id) }));
  const latestCustomerImportCheckpoint = getLatestPcnCustomerImportCheckpoint(activityLogs);
  const checkpointBackup = latestCustomerImportCheckpoint
    ? backups.find((backup) => backup.filename === latestCustomerImportCheckpoint.filename
      && Date.parse(backup.createdAt) === Date.parse(latestCustomerImportCheckpoint.createdAt))
    : undefined;
  const customerImportBackupVerification = checkpointBackup
    ? (checkpointBackup.filename === latestBackup?.filename
      ? backupVerification
      : await verifyBackupArchive(checkpointBackup.filename))
    : undefined;
  const customerBusinessFields = ['name', 'address', 'customerCode', 'taxId', 'phone', 'email', 'contactPerson'] as const;
  const emptyTargetCustomerCount = customersResult.rows.filter((row) => {
    const data = (row.data || {}) as Record<string, unknown>;
    return !customerBusinessFields.some((field) => String(data[field] || '').trim());
  }).length;
  const reconciliation = buildPcnCutoverReconciliation({
    proposals: proposalsResult.rows.map((row) => ({ ...(row.data || {}), id: String(row.document_id) })),
    dossiers: dossiersResult.rows.map((row) => ({ ...(row.data || {}), id: String(row.document_id) })),
    fileAssets: fileAssetsRowsResult.rows.map((row) => ({
      id: String(row.id),
      bucketName: String(row.bucket_name || ''),
      objectPath: String(row.object_path || ''),
      sourceCollection: String(row.source_collection || ''),
      sourceDocumentId: String(row.source_document_id || ''),
      sourceJsonPath: String(row.source_json_path || ''),
      mimeType: String(row.mime_type || ''),
      byteSize: Number(row.byte_size),
      sha256: row.sha256 ? String(row.sha256) : null,
    })),
    notifications: notificationsResult.rows.map((row) => ({ ...(row.data || {}), id: String(row.document_id) })),
    activityLogs,
  });
  const legacyRowsByCollection = new Map<string, Array<{ documentId: string; data: Record<string, unknown> }>>();
  for (const row of legacyRowsResult.rows) {
    const collectionName = String(row.collection_name);
    legacyRowsByCollection.set(collectionName, [
      ...(legacyRowsByCollection.get(collectionName) || []),
      { documentId: String(row.document_id), data: (row.data || {}) as Record<string, unknown> },
    ]);
  }
  const legacyCollectionReconciliation = PCN_LEGACY_COLLECTION_MAPPINGS.map((mapping) => {
    const plan = planPcnLegacyCollectionReconciliation({
      ...mapping,
      legacyDocuments: legacyRowsByCollection.get(mapping.legacyCollection) || [],
      canonicalDocuments: legacyRowsByCollection.get(mapping.canonicalCollection) || [],
    });
    return {
      legacyCollection: plan.legacyCollection,
      canonicalCollection: plan.canonicalCollection,
      legacyCount: plan.legacyCount,
      matchingCount: plan.matchingIds.length,
      missingCanonicalCount: plan.missingCanonicalIds.length,
      conflictingCount: plan.conflictingIds.length,
      safeToRemove: plan.safeToRemove,
    };
  });

  return {
    snapshot: {
      profile: String(process.env.APP_PROFILE || '').trim().toLowerCase(),
      database: String(databaseResult.rows[0]?.database || ''),
      collectionNames,
      ddtCollectionNames,
      fieldCodes: fieldsResult.rows.map((row) => String(row.document_id)),
      customerCount: customers.length,
      customerHash: hashPcnCustomers(customers),
      customerDataIntegrity: { emptyTargetRecordCount: emptyTargetCustomerCount },
      latestCustomerImportCheckpoint,
      customerImportBackupVerification,
      backupVerification,
      legacyCollectionReconciliation,
      hasActivityLogAppendOnlyTrigger: Boolean(triggerResult.rows[0]?.enabled),
      hasFileAssetsTable: Boolean(fileAssetsPresenceResult.rows[0]?.present),
      reconciliation,
    },
    customers,
  };
}

export function buildPcnCutoverSourceComparison(source: CustomerRef[], target: CustomerRef[]) {
  const reconciliation = buildPcnCustomerReconciliation(source, target);
  return {
    sourceCount: reconciliation.sourceCount,
    targetCount: reconciliation.targetCount,
    sourceUniqueKeyCount: reconciliation.sourceUniqueKeyCount,
    targetUniqueKeyCount: reconciliation.targetUniqueKeyCount,
    sourceUnkeyedCount: reconciliation.sourceUnkeyedCount,
    targetUnkeyedCount: reconciliation.targetUnkeyedCount,
    missingKeyCount: reconciliation.missingKeys.length,
    extraKeyCount: reconciliation.extraKeys.length,
    changedKeyCount: reconciliation.changedKeys.length,
    duplicateSourceKeyCount: reconciliation.duplicateSourceKeys.length,
    duplicateTargetKeyCount: reconciliation.duplicateTargetKeys.length,
    possibleAliasMatchCount: reconciliation.possibleAliasMatches.length,
    fieldDifferenceCounts: reconciliation.fieldDifferenceCounts,
    sampleMissingKeys: reconciliation.missingKeys.slice(0, 20),
    sampleExtraKeys: reconciliation.extraKeys.slice(0, 20),
    sampleChangedFieldsByKey: reconciliation.changedFieldsByKey.slice(0, 20),
    samplePossibleAliasMatches: reconciliation.possibleAliasMatches.slice(0, 20),
  };
}

// --- End of pcnCutoverService.ts ---
