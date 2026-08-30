import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { initDbSchema, pool } from '../utils/db.js';
import { PCN_ALIAS_KEEP_SOURCE_KEY, PCN_ALIAS_MAP_TO_TARGET, type PcnCustomerAliasDecision } from '../utils/pcnCustomerImportAlias.ts';
import { buildPcnCustomerMigrationPreview, parsePcnCustomerCsv } from '../utils/pcnCustomerMigration.ts';
import { applyPcnCustomerImport, loadPcnCustomersForImport, preparePcnCustomerImportAliasDecisions, requirePcnImportBackup } from '../utils/pcnCustomerImportService.ts';

dotenv.config();

const APPLY_CONFIRMATION = 'KHOI_TAO_DANH_MUC_PCN';

export function readPcnCustomerSource(filePath: string): unknown[] {
  const sourcePath = path.resolve(filePath);
  const extension = path.extname(sourcePath).toLowerCase();
  const raw = fs.readFileSync(sourcePath, 'utf8');
  if (extension === '.csv') return parsePcnCustomerCsv(raw);
  const payload = JSON.parse(raw) as unknown;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { customers?: unknown[] }).customers)) {
    return (payload as { customers: unknown[] }).customers;
  }
  throw new Error('Nguồn khách hàng phải là mảng JSON, object có trường customers, hoặc CSV.');
}

function parseAliasDecisions(argv: string[]): PcnCustomerAliasDecision[] {
  const decisions: PcnCustomerAliasDecision[] = [];
  for (const argument of argv.filter((value) => value.startsWith('--keep-alias='))) {
    const sourceKey = argument.slice('--keep-alias='.length).trim();
    if (!sourceKey) throw new Error('Thiếu khóa nguồn trong --keep-alias=<sourceKey>.');
    decisions.push({ sourceKey, mode: PCN_ALIAS_KEEP_SOURCE_KEY });
  }
  for (const argument of argv.filter((value) => value.startsWith('--map-alias='))) {
    const mapping = argument.slice('--map-alias='.length);
    const separator = mapping.indexOf('=');
    const sourceKey = separator >= 0 ? mapping.slice(0, separator).trim() : '';
    const targetKey = separator >= 0 ? mapping.slice(separator + 1).trim() : '';
    if (!sourceKey || !targetKey) throw new Error('Định dạng --map-alias phải là --map-alias=<sourceKey>=<targetKey>.');
    decisions.push({ sourceKey, mode: PCN_ALIAS_MAP_TO_TARGET, targetKey });
  }
  return decisions;
}

function parseArguments(argv: string[]): { inputPath: string; apply: boolean; confirmation: string; aliasDecisions: PcnCustomerAliasDecision[] } {
  const inputArgument = argv.find((value) => value.startsWith('--input='));
  const positional = argv.find((value) => !value.startsWith('--')) || '';
  const apply = argv.includes('--apply');
  const confirmationArgument = argv.find((value) => value.startsWith('--confirm=')) || '';
  return {
    inputPath: inputArgument ? inputArgument.slice('--input='.length) : positional,
    apply,
    confirmation: confirmationArgument.slice('--confirm='.length),
    aliasDecisions: parseAliasDecisions(argv),
  };
}

export async function runPcnCustomerMigration(argv = process.argv.slice(2)): Promise<void> {
  const migrationStartedAt = new Date();
  const options = parseArguments(argv);
  if (String(process.env.APP_PROFILE || '').trim().toLowerCase() !== 'pcn') {
    throw new Error('Migration danh mục PCN bị từ chối: hãy chạy với APP_PROFILE=pcn.');
  }
  if (!options.inputPath) {
    throw new Error('Thiếu file nguồn. Ví dụ: npm run migrate:pcn-customers -- --input=export.csv');
  }
  const inputArgument = argv.find((value) => value.startsWith('--input='));
  const sourcePath = inputArgument ? inputArgument.slice('--input='.length) : options.inputPath;
  if (!fs.existsSync(path.resolve(sourcePath))) throw new Error(`Không tìm thấy nguồn khách hàng: ${sourcePath}`);

  await initDbSchema();
  const existing = await loadPcnCustomersForImport(pool);
  const incoming = readPcnCustomerSource(sourcePath);
  const preview = buildPcnCustomerMigrationPreview(incoming, existing, { sourceLabel: path.basename(sourcePath) });
  console.log(JSON.stringify({
    sourceLabel: preview.sourceLabel,
    sourceCount: preview.sourceCount,
    validCount: preview.validCount,
    acceptedCount: preview.acceptedCount,
    rejected: preview.rejected,
    duplicateKeys: preview.duplicateKeys,
    existingConflictCount: preview.existingConflictCount,
    sourceHash: preview.sourceHash,
    targetHashBefore: preview.targetHashBefore,
    targetHashAfter: preview.targetHashAfter,
    generatedAt: preview.generatedAt,
  }, null, 2));

  if (!options.apply) {
    console.log('DRY-RUN: chưa ghi dữ liệu. Dùng --apply --confirm=KHOI_TAO_DANH_MUC_PCN sau khi đối soát preview.');
    return;
  }
  if (options.confirmation !== APPLY_CONFIRMATION) throw new Error(`Thiếu xác nhận chính xác: --confirm=${APPLY_CONFIRMATION}`);
  if (preview.rejected.length > 0) throw new Error('Không thể apply khi nguồn còn dòng không hợp lệ.');
  if (preview.duplicateKeys.length > 0) throw new Error('Không thể apply khi nguồn còn khóa khách hàng trùng.');
  preparePcnCustomerImportAliasDecisions(preview, existing, options.aliasDecisions);

  const backupCheckpoint = await requirePcnImportBackup(migrationStartedAt);
  const client = await pool.connect();
  let importedCount = 0;
  try {
    await client.query('BEGIN');
    const applied = await applyPcnCustomerImport(preview, existing, backupCheckpoint, {
      name: 'PCN customer import job',
      role: 'admin',
    }, client, options.aliasDecisions);
    importedCount = applied.importedCount;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({
    backupCheckpoint,
    importedCount,
    database: process.env.PCN_POSTGRES_DB || 'pcn_certification',
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnCustomerMigration().catch((error) => {
    console.error('Migration danh mục PCN thất bại:', error);
    process.exitCode = 1;
  }).finally(async () => {
    await pool.end();
  });
}

// --- End of migratePcnCustomers.ts ---
