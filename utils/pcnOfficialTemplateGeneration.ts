// Author: Codex
// OS support: Node
// Description: Controlled QC4 official-template data mapping and DOCX rendering

import { createHash } from 'node:crypto';

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { PcnGeneratedDocumentFormat, PcnOfficialDocumentKind, PcnTemplateDefinition } from '../types.ts';

export { buildPcnOfficialTemplateData, getPcnOfficialGenerationReadiness } from './pcnOfficialTemplatePolicy.ts';
export type { PcnOfficialGenerationReason, PcnOfficialGenerationReadiness } from './pcnOfficialTemplatePolicy.ts';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export function buildPcnOfficialContextHash(
  baseContextHash: string,
  template: PcnTemplateDefinition,
  data: Record<string, string>,
): string {
  const orderedData = Object.fromEntries(Object.entries(data).sort(([left], [right]) => left.localeCompare(right)));
  const orderedMappings = (template.annotation?.mappings || [])
    .map((mapping) => ({
      key: clean(mapping.key),
      sourceText: clean(mapping.sourceText),
      ...(mapping.occurrence === undefined ? {} : { occurrence: mapping.occurrence }),
    }))
    .sort((left, right) => `${left.key}\u0000${left.sourceText}\u0000${left.occurrence ?? ''}`.localeCompare(`${right.key}\u0000${right.sourceText}\u0000${right.occurrence ?? ''}`));
  const templateBinding = {
    id: template.id,
    fieldCode: template.fieldCode,
    documentKind: template.documentKind,
    method: template.method || '',
    variant: template.variant || '',
    format: template.format,
    status: template.status,
    placeholderKeys: [...template.placeholderKeys].map(clean).sort(),
    requiredPlaceholderKeys: [...template.requiredPlaceholderKeys].map(clean).sort(),
    sourceFingerprint: {
      sourceRelativePath: clean(template.sourceFingerprint.sourceRelativePath),
      byteSize: template.sourceFingerprint.byteSize,
      sha256: clean(template.sourceFingerprint.sha256),
    },
    annotation: template.annotation ? {
      sourceAssetId: clean(template.annotation.sourceAssetId),
      sourceSha256: clean(template.annotation.sourceSha256),
      appliedAt: clean(template.annotation.appliedAt),
      appliedBy: clean(template.annotation.appliedBy),
      mappings: orderedMappings,
    } : null,
  };
  return createHash('sha256')
    .update(JSON.stringify({ baseContextHash, template: templateBinding, data: orderedData }))
    .digest('hex');
}

export function buildPcnOfficialGenerationContextHash(
  items: Array<{ documentKind: PcnOfficialDocumentKind; contextHash: string }>,
  formats: PcnGeneratedDocumentFormat[] = [],
): string {
  const orderedItems = [...items]
    .map((item) => ({ documentKind: item.documentKind, contextHash: clean(item.contextHash) }))
    .sort((left, right) => left.documentKind.localeCompare(right.documentKind));
  const orderedFormats = [...new Set(formats.map((format) => String(format).trim().toUpperCase()))].sort();
  return createHash('sha256')
    .update(JSON.stringify({ items: orderedItems, formats: orderedFormats }))
    .digest('hex');
}

export function renderPcnOfficialDocx(templateBytes: Buffer, data: Record<string, string>): Buffer {
  if (!templateBytes || templateBytes.length === 0) throw new Error('Template DOCX rỗng.');
  const zip = new PizZip(templateBytes);
  const document = new Docxtemplater(zip, {
    delimiters: { start: '[[', end: ']]' },
    paragraphLoop: true,
    linebreaks: true,
  });
  document.render(data);
  return document.getZip().generate({ type: 'nodebuffer' });
}

// --- End of pcnOfficialTemplateGeneration.ts ---
