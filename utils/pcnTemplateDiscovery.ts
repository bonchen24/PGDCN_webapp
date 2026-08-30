// Author: Codex
// OS support: Node
// Description: One-time, no-write inspection of PCN DOCX/DOC template sources

import { createHash } from 'node:crypto';

import PizZip from 'pizzip';

import type { PcnTemplateFormat, PcnTemplateStatus } from '../types.ts';

export type PcnTemplateDiscoveryWarning =
  | 'LEGACY_FORMAT_REQUIRES_ANNOTATION'
  | 'NO_MACHINE_PLACEHOLDERS'
  | 'DOCX_NOT_READABLE';

export interface PcnTemplateInspection {
  fileName: string;
  sourceRelativePath: string;
  format: PcnTemplateFormat;
  byteSize: number;
  sha256: string;
  placeholderKeys: string[];
  suggestedStatus: PcnTemplateStatus;
  warnings: PcnTemplateDiscoveryWarning[];
}

function normalizePlaceholderKey(value: string): string {
  return String(value || '').trim().replace(/^\[\[|\]\]$/g, '').trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Extract [[placeholder]] keys from document XML, including keys split over w:r runs. */
export function extractPcnTemplatePlaceholderKeys(bytes: Buffer): string[] {
  const zip = new PizZip(bytes);
  const xml = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name))
    .sort()
    .map((name) => zip.file(name)?.asText() || '')
    .join('');
  const text = decodeXmlEntities(xml.replace(/<[^>]*>/g, ''));
  const keys = new Set<string>();
  const pattern = /\[\[\s*([^\[\]]+?)\s*\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const key = normalizePlaceholderKey(match[1]);
    if (key) keys.add(key);
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function validatePcnTemplateRelativePath(sourceRelativePath: string): string {
  const normalized = String(sourceRelativePath || '').trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error('Đường dẫn mẫu PCN phải là đường dẫn tương đối.');
  }
  const segments = normalized.split('/');
  if (segments.includes('..')) throw new Error('Đường dẫn mẫu PCN không được đi ra ngoài thư mục nguồn.');
  const forbiddenSegment = segments.find((segment) => ['desktop', 'dist'].includes(segment.toLowerCase()));
  if (forbiddenSegment) throw new Error(`Đường dẫn mẫu PCN không được chứa dependency runtime ${forbiddenSegment}.`);
  return normalized;
}

export function inspectPcnTemplateSource(input: {
  fileName: string;
  sourceRelativePath: string;
  bytes: Buffer;
}): PcnTemplateInspection {
  const fileName = String(input.fileName || '').trim();
  const sourceRelativePath = validatePcnTemplateRelativePath(input.sourceRelativePath);
  const lowerName = fileName.toLowerCase();
  const format: PcnTemplateFormat = lowerName.endsWith('.docx') ? 'DOCX' : lowerName.endsWith('.doc') ? 'DOC' : (() => { throw new Error('Mẫu PCN phải có định dạng .docx hoặc .doc.'); })();
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const warnings: PcnTemplateDiscoveryWarning[] = [];
  let placeholderKeys: string[] = [];

  if (format === 'DOC') {
    warnings.push('LEGACY_FORMAT_REQUIRES_ANNOTATION');
  } else {
    try {
      placeholderKeys = extractPcnTemplatePlaceholderKeys(input.bytes);
      if (placeholderKeys.length === 0) warnings.push('NO_MACHINE_PLACEHOLDERS');
    } catch {
      warnings.push('DOCX_NOT_READABLE');
    }
  }

  return {
    fileName,
    sourceRelativePath,
    format,
    byteSize: input.bytes.length,
    sha256,
    placeholderKeys,
    suggestedStatus: format === 'DOCX' && placeholderKeys.length > 0 && warnings.length === 0 ? 'DISCOVERED' : 'NEEDS_ANNOTATION',
    warnings,
  };
}

// --- End of pcnTemplateDiscovery.ts ---
