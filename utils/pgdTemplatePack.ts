import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { extractPcnTemplatePlaceholderKeys } from './pcnTemplateDiscovery.ts';
import type { PgdDocumentTemplate } from './pgdDocumentTemplates.ts';

export type PgdTemplateSourceStatus = 'READY' | 'MISSING' | 'INVALID' | 'PLACEHOLDER_MISMATCH';

export interface PgdTemplateSourceInspection {
  status: PgdTemplateSourceStatus;
  fileName: string;
  byteSize?: number;
  placeholderKeys: string[];
  missingPlaceholderKeys: string[];
  extraPlaceholderKeys: string[];
  message?: string;
}

function sortedKeys(keys: readonly string[]): string[] {
  return [...new Set(keys.map((key) => String(key).trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function diffKeys(expected: readonly string[], actual: readonly string[]): { missing: string[]; extra: string[] } {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((key) => !actualSet.has(key)),
    extra: actual.filter((key) => !expectedSet.has(key)),
  };
}

export function resolvePgdTemplateSourcePath(template: Pick<PgdDocumentTemplate, 'fileName'>, projectRoot = process.cwd()): string | undefined {
  const fileName = String(template.fileName || '').trim();
  if (!fileName || path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith('.docx')) return undefined;
  return path.join(path.resolve(projectRoot, 'templates', 'pgd'), fileName);
}

export function inspectPgdTemplateSource(template: Pick<PgdDocumentTemplate, 'fileName' | 'placeholderKeys'>, projectRoot = process.cwd()): PgdTemplateSourceInspection {
  const fileName = String(template.fileName || '').trim();
  const expectedKeys = sortedKeys(template.placeholderKeys || []);
  const filePath = resolvePgdTemplateSourcePath(template, projectRoot);
  if (!filePath) {
    return {
      status: 'INVALID',
      fileName,
      placeholderKeys: [],
      missingPlaceholderKeys: expectedKeys,
      extraPlaceholderKeys: [],
      message: 'Tên file template phải là DOCX và không chứa thư mục.',
    };
  }
  if (!existsSync(filePath)) {
    return {
      status: 'MISSING',
      fileName,
      placeholderKeys: [],
      missingPlaceholderKeys: expectedKeys,
      extraPlaceholderKeys: [],
      message: `Không tìm thấy file nguồn trong templates/pgd: ${fileName}`,
    };
  }
  try {
    const sourceKeys = sortedKeys(extractPcnTemplatePlaceholderKeys(readFileSync(filePath)));
    const { missing, extra } = diffKeys(expectedKeys, sourceKeys);
    return {
      status: missing.length > 0 || extra.length > 0 ? 'PLACEHOLDER_MISMATCH' : 'READY',
      fileName,
      byteSize: statSync(filePath).size,
      placeholderKeys: sourceKeys,
      missingPlaceholderKeys: missing,
      extraPlaceholderKeys: extra,
      ...(missing.length > 0 || extra.length > 0 ? { message: 'Trường dữ liệu trong siêu dữ liệu không khớp với tệp DOCX nguồn.' } : {}),
    };
  } catch (error: any) {
    return {
      status: 'INVALID',
      fileName,
      placeholderKeys: [],
      missingPlaceholderKeys: expectedKeys,
      extraPlaceholderKeys: [],
      message: `Không đọc được tệp DOCX nguồn: ${error?.message || String(error)}`,
    };
  }
}

// --- End of pgdTemplatePack.ts ---
