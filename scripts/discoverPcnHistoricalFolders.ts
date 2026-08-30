import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildPcnHistoricalSourceCandidate,
  buildPcnHistoricalSourceCoverage,
  DEFAULT_PCN_HISTORICAL_SCAN_ROOTS,
  DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS,
  sortPcnHistoricalSourceCandidates,
  type PcnHistoricalDiscoveryResult,
  type PcnHistoricalSourceCandidate,
  type PcnHistoricalSourceFileSummary,
} from '../utils/pcnHistoricalSourceDiscovery.ts';
import { isPcnHistoricalFolderName } from '../utils/pcnHistoricalImport.ts';

interface ParsedArguments {
  sourceRoot: string;
  fieldCode?: 'QC4' | 'QC9';
}

const MAX_NESTED_GROUP_DEPTH = 1;

function parseArguments(argv: string[]): ParsedArguments {
  const sourceArgument = argv.find((value) => value.startsWith('--source='));
  const fieldArgument = argv.find((value) => value.startsWith('--field='))?.slice('--field='.length).trim().toUpperCase();
  if (fieldArgument && !['QC4', 'QC9'].includes(fieldArgument)) throw new Error('--field chỉ nhận QC4 hoặc QC9.');
  return {
    sourceRoot: sourceArgument?.slice('--source='.length).trim() || String(process.env.PCN_HISTORICAL_SOURCE_ROOT || '').trim(),
    ...(fieldArgument ? { fieldCode: fieldArgument as 'QC4' | 'QC9' } : {}),
  };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function safeChildPath(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(resolvedRoot, relativePath);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    throw new Error(`Đường dẫn scan nằm ngoài nguồn: ${relativePath}`);
  }
  return resolvedCandidate;
}

function isCandidateFolder(fieldCode: 'QC4' | 'QC9', folderName: string): boolean {
  return isPcnHistoricalFolderName(fieldCode, folderName);
}

function collectFileSummaries(directory: string): PcnHistoricalSourceFileSummary[] {
  const summaries: PcnHistoricalSourceFileSummary[] = [];
  const walk = (currentDirectory: string, relativeDirectory = '') => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = normalizeRelativePath(path.join(relativeDirectory, entry.name));
      if (entry.isDirectory()) walk(absolutePath, relativePath);
      else if (entry.isFile()) {
        const stat = fs.statSync(absolutePath);
        summaries.push({
          relativePath,
          fileName: entry.name,
          extension: path.extname(entry.name).toLowerCase(),
          byteSize: stat.size,
          lastModifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  };
  walk(directory);
  return summaries;
}

function collectReferenceSourceCoverages(resolvedRoot: string, fieldFilter?: 'QC4' | 'QC9'): ReturnType<typeof buildPcnHistoricalSourceCoverage>[] {
  return DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS
    .filter((referenceRoot) => !fieldFilter || referenceRoot.fieldCode === fieldFilter)
    .map((referenceRoot) => {
      const absolutePath = safeChildPath(resolvedRoot, referenceRoot.sourceRelativePath);
      const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
      return buildPcnHistoricalSourceCoverage({
        ...referenceRoot,
        status: exists ? 'SCANNED' : 'MISSING',
        files: exists ? collectFileSummaries(absolutePath) : [],
      });
    });
}

function collectNestedCandidateFolders(input: {
  fieldCode: 'QC4' | 'QC9';
  groupDirectory: string;
  resolvedRoot: string;
  ignoredFolders: Array<{ fieldCode: 'QC4' | 'QC9'; sourceRelativePath: string; folderName: string; reason: 'NAME_NOT_RECOGNIZED' }>;
  candidates: PcnHistoricalSourceCandidate[];
  depth: number;
}): number {
  if (input.depth > MAX_NESTED_GROUP_DEPTH) return 0;
  let discoveredCount = 0;
  for (const entry of fs.readdirSync(input.groupDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const absolutePath = path.join(input.groupDirectory, entry.name);
    const sourceRelativePath = normalizeRelativePath(path.relative(input.resolvedRoot, absolutePath));
    if (isCandidateFolder(input.fieldCode, entry.name)) {
      input.candidates.push(buildPcnHistoricalSourceCandidate({
        fieldCode: input.fieldCode,
        sourceRelativePath,
        folderName: entry.name,
        files: collectFileSummaries(absolutePath),
      }));
      discoveredCount += 1;
      continue;
    }
    const nestedCount = input.depth < MAX_NESTED_GROUP_DEPTH
      ? collectNestedCandidateFolders({ ...input, groupDirectory: absolutePath, depth: input.depth + 1 })
      : 0;
    if (nestedCount === 0) {
      input.ignoredFolders.push({ fieldCode: input.fieldCode, sourceRelativePath, folderName: entry.name, reason: 'NAME_NOT_RECOGNIZED' });
    }
    discoveredCount += nestedCount;
  }
  return discoveredCount;
}

export function discoverPcnHistoricalFolders(sourceRoot: string, fieldFilter?: 'QC4' | 'QC9'): PcnHistoricalDiscoveryResult {
  const resolvedRoot = path.resolve(sourceRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) throw new Error(`Không tìm thấy thư mục nguồn lịch sử: ${sourceRoot}`);
  const inspectedRoots: Array<{ fieldCode: 'QC4' | 'QC9'; sourceRelativePath: string; status: 'SCANNED' | 'MISSING' }> = [];
  const ignoredFolders: Array<{ fieldCode: 'QC4' | 'QC9'; sourceRelativePath: string; folderName: string; reason: 'NAME_NOT_RECOGNIZED' }> = [];
  const candidates: PcnHistoricalSourceCandidate[] = [];

  for (const scanRoot of DEFAULT_PCN_HISTORICAL_SCAN_ROOTS) {
    if (fieldFilter && scanRoot.fieldCode !== fieldFilter) continue;
    const absoluteScanRoot = safeChildPath(resolvedRoot, scanRoot.sourceRelativePath);
    if (!fs.existsSync(absoluteScanRoot) || !fs.statSync(absoluteScanRoot).isDirectory()) {
      inspectedRoots.push({ ...scanRoot, status: 'MISSING' });
      continue;
    }
    inspectedRoots.push({ ...scanRoot, status: 'SCANNED' });
    for (const entry of fs.readdirSync(absoluteScanRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRelativePath = normalizeRelativePath(path.relative(resolvedRoot, path.join(absoluteScanRoot, entry.name)));
      if (!isCandidateFolder(scanRoot.fieldCode, entry.name)) {
        const nestedCount = collectNestedCandidateFolders({
          fieldCode: scanRoot.fieldCode,
          groupDirectory: path.join(absoluteScanRoot, entry.name),
          resolvedRoot,
          ignoredFolders,
          candidates,
          depth: 1,
        });
        if (nestedCount === 0) ignoredFolders.push({ fieldCode: scanRoot.fieldCode, sourceRelativePath, folderName: entry.name, reason: 'NAME_NOT_RECOGNIZED' });
        continue;
      }
      candidates.push(buildPcnHistoricalSourceCandidate({
        fieldCode: scanRoot.fieldCode,
        sourceRelativePath,
        folderName: entry.name,
        files: collectFileSummaries(path.join(absoluteScanRoot, entry.name)),
      }));
    }
  }
  return {
    sourceRoot: resolvedRoot,
    inspectedRoots,
    referenceSources: collectReferenceSourceCoverages(resolvedRoot, fieldFilter),
    ignoredFolders,
    candidates: sortPcnHistoricalSourceCandidates(candidates),
  };
}

export function runPcnHistoricalFolderDiscovery(argv = process.argv.slice(2)): void {
  const options = parseArguments(argv);
  if (!options.sourceRoot) throw new Error('Thiếu nguồn hồ sơ. Ví dụ: npm run discover:pcn-history -- --source="C:\\Users\\HungX\\Desktop\\PCN"');
  const result = discoverPcnHistoricalFolders(options.sourceRoot, options.fieldCode);
  console.log(JSON.stringify({ inspectedAt: new Date().toISOString(), ...result }, null, 2));
  console.log('DRY-RUN: read-only; không hash/upload tệp và không ghi database hoặc Storage.');
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    runPcnHistoricalFolderDiscovery();
  } catch (error) {
    console.error('Kiểm kê thư mục hồ sơ lịch sử PCN thất bại:', error);
    process.exitCode = 1;
  }
}

// --- End of discoverPcnHistoricalFolders.ts ---
