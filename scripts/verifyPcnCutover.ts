import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { pool } from '../utils/db.js';
import { buildPcnCustomerMigrationPreview, buildPcnCustomerReconciliation } from '../utils/pcnCustomerMigration.ts';
import { readPcnCustomerSource } from './migratePcnCustomers.ts';
import { resolveDatabaseConfig } from '../utils/pcnDatabase.ts';
import { verifyPcnCutoverSnapshot } from '../utils/pcnCutoverVerification.ts';
import { loadPcnCutoverSnapshot } from '../utils/pcnCutoverService.ts';
import { buildSafePcnCutoverSnapshot } from '../utils/pcnCutoverReport.ts';

interface CutoverOptions {
  inputPath: string;
}

function parseArguments(argv: string[]): CutoverOptions {
  const inputArgument = argv.find((value) => value.startsWith('--input='));
  return { inputPath: inputArgument ? inputArgument.slice('--input='.length) : '' };
}

const loadPcnSnapshot = loadPcnCutoverSnapshot;

export async function runPcnCutoverVerification(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(argv);
  const config = resolveDatabaseConfig(process.env);
  if (config.profile !== 'pcn') throw new Error('Kiểm chứng cutover PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  if (options.inputPath && !fs.existsSync(path.resolve(options.inputPath))) {
    throw new Error(`Không tìm thấy file nguồn đối soát: ${options.inputPath}`);
  }

  const { snapshot, customers } = await loadPcnSnapshot();
  let expectedCustomerCount: number | undefined;
  let expectedCustomerHash: string | undefined;
  let sourceReport: Record<string, unknown> | undefined;
  if (options.inputPath) {
    const incoming = readPcnCustomerSource(options.inputPath);
    const preview = buildPcnCustomerMigrationPreview(incoming, [], {
      sourceLabel: path.basename(options.inputPath),
    });
    const customerReconciliation = buildPcnCustomerReconciliation(preview.acceptedCustomers, customers);
    snapshot.customerKeyReconciliation = {
      missingKeyCount: customerReconciliation.missingKeys.length,
      extraKeyCount: customerReconciliation.extraKeys.length,
      changedKeyCount: customerReconciliation.changedKeys.length,
      duplicateSourceKeyCount: customerReconciliation.duplicateSourceKeys.length,
      duplicateTargetKeyCount: customerReconciliation.duplicateTargetKeys.length,
    };
    expectedCustomerCount = preview.sourceCount;
    expectedCustomerHash = preview.sourceHash;
    sourceReport = {
      sourceLabel: preview.sourceLabel,
      sourceCount: preview.sourceCount,
      validCount: preview.validCount,
      rejected: preview.rejected,
      duplicateKeys: preview.duplicateKeys,
      sourceHash: preview.sourceHash,
      reconciliation: {
        sourceCount: customerReconciliation.sourceCount,
        targetCount: customerReconciliation.targetCount,
        sourceUniqueKeyCount: customerReconciliation.sourceUniqueKeyCount,
        targetUniqueKeyCount: customerReconciliation.targetUniqueKeyCount,
        sourceUnkeyedCount: customerReconciliation.sourceUnkeyedCount,
        targetUnkeyedCount: customerReconciliation.targetUnkeyedCount,
        duplicateSourceKeys: customerReconciliation.duplicateSourceKeys,
        duplicateTargetKeys: customerReconciliation.duplicateTargetKeys,
        missingKeyCount: customerReconciliation.missingKeys.length,
        extraKeyCount: customerReconciliation.extraKeys.length,
        changedKeyCount: customerReconciliation.changedKeys.length,
        possibleAliasMatchCount: customerReconciliation.possibleAliasMatches.length,
        fieldDifferenceCounts: customerReconciliation.fieldDifferenceCounts,
        sampleMissingKeys: customerReconciliation.missingKeys.slice(0, 20),
        sampleExtraKeys: customerReconciliation.extraKeys.slice(0, 20),
        sampleChangedFieldsByKey: customerReconciliation.changedFieldsByKey.slice(0, 20),
        samplePossibleAliasMatches: customerReconciliation.possibleAliasMatches.slice(0, 20),
      },
    };
  }

  const result = verifyPcnCutoverSnapshot(snapshot, {
    expectedDatabase: config.database,
    expectedCustomerCount,
    expectedCustomerHash,
    requireVerifiedBackup: true,
    requireCustomerImportCheckpoint: Boolean(options.inputPath),
  });
  const safeSnapshot = buildSafePcnCutoverSnapshot(snapshot);
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    profile: snapshot.profile,
    database: snapshot.database,
    snapshot: safeSnapshot,
    source: sourceReport,
    ok: result.ok,
    errors: result.errors,
  }, null, 2));
  if (!result.ok) throw new Error(`PCN cutover verification failed: ${result.errors.join(' ')}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnCutoverVerification().catch((error) => {
    console.error('Kiểm chứng cutover PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of verifyPcnCutover.ts ---
