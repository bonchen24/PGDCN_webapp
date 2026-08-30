// Author: Codex
// OS support: Node
// Description: Resolve a catalog-relative PCN template source without allowing root escape

import fs from 'node:fs';
import path from 'node:path';

import { validatePcnTemplateRelativePath } from './pcnTemplateDiscovery.ts';

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return Boolean(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function resolvePcnTemplateSourceFile(sourceRoot: string, sourceRelativePath: string): string {
  const rawRoot = String(sourceRoot || '').trim();
  if (!rawRoot) throw new Error('Thiếu sourceRoot: hãy chọn thư mục nguồn PCN.');

  const normalizedRelativePath = String(sourceRelativePath || '').trim().replace(/\\/g, '/');
  if (!normalizedRelativePath || normalizedRelativePath.startsWith('/') || /^[A-Za-z]:\//.test(normalizedRelativePath)) {
    throw new Error('Đường dẫn mẫu PCN phải là đường dẫn tương đối.');
  }
  if (normalizedRelativePath.split('/').some((segment) => !segment || segment === '..')) {
    throw new Error('Đường dẫn mẫu PCN không được đi ra ngoài thư mục nguồn.');
  }

  const rootPath = path.resolve(rawRoot);
  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(rootPath);
  } catch {
    throw new Error(`Không tìm thấy thư mục nguồn PCN: ${rawRoot}`);
  }
  if (!rootStat.isDirectory()) throw new Error(`SourceRoot PCN không phải thư mục: ${rawRoot}`);

  const candidatePath = path.resolve(rootPath, ...normalizedRelativePath.split('/'));
  if (!isPathWithin(rootPath, candidatePath)) throw new Error('Đường dẫn mẫu PCN đi ra ngoài thư mục nguồn.');

  let realRoot: string;
  let realCandidate: string;
  try {
    realRoot = fs.realpathSync(rootPath);
    realCandidate = fs.realpathSync(candidatePath);
  } catch {
    throw new Error(`Không tìm thấy file mẫu PCN: ${normalizedRelativePath}`);
  }
  if (!isPathWithin(realRoot, realCandidate)) throw new Error('File mẫu PCN đi ra ngoài thư mục nguồn qua symlink.');

  let candidateStat: fs.Stats;
  try {
    candidateStat = fs.statSync(realCandidate);
  } catch {
    throw new Error(`Không tìm thấy file mẫu PCN: ${normalizedRelativePath}`);
  }
  if (!candidateStat.isFile()) throw new Error(`Nguồn template PCN không phải file: ${normalizedRelativePath}`);
  return realCandidate;
}

/**
 * Keep the catalog's full PCN folder in metadata when an older runtime row
 * stored only the QC4/QC9 field prefix. The server uses this before resolving
 * a sourceRoot that points at the PCN root.
 */
export function resolvePcnTemplateImportSourceRelativePath(
  storedSourceRelativePath: string,
  baselineSourceRelativePath: string,
  fieldCode: string,
): string {
  const baseline = validatePcnTemplateRelativePath(baselineSourceRelativePath);
  const stored = String(storedSourceRelativePath || '').trim();
  if (!stored) return baseline;
  const normalizedStored = validatePcnTemplateRelativePath(stored);
  const normalizedFieldCode = String(fieldCode || '').trim().toUpperCase();
  if (normalizedStored.toUpperCase().startsWith(`${normalizedFieldCode}/`)) return baseline;
  return normalizedStored;
}
