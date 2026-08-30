// Author: Codex
// OS support: Node/Web
// Description: Deterministic selection and naming policy for official PCN documents

import type { PcnCertificationMethod, PcnGeneratedDocumentFormat, PcnOfficialDocumentKind, PcnTemplateDefinition } from '../types.ts';
import { getPcnTimestampDenial } from './pcnDossierDate.ts';

function normalize(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function safeSegment(value: string): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'document';
}

function parseValidPcnTimestamp(value: string): number | undefined {
  if (getPcnTimestampDenial('Mốc nguồn', value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function getPcnOfficialSourceUpdatedAt(...values: Array<string | undefined>): string | undefined {
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => value && parseValidPcnTimestamp(value) !== undefined)
    .sort((left, right) => (parseValidPcnTimestamp(right)! - parseValidPcnTimestamp(left)!) || right.localeCompare(left))[0];
}

export function selectPcnOfficialTemplate(
  templates: PcnTemplateDefinition[],
  fieldCodes: string[],
  method: PcnCertificationMethod,
  documentKind: PcnOfficialDocumentKind,
): PcnTemplateDefinition | undefined {
  const fields = new Set(fieldCodes.map(normalize));
  return templates
    .filter((template) => fields.has(normalize(template.fieldCode))
      && template.documentKind === documentKind
      && (!template.method || template.method === method))
    .sort((left, right) => Number(Boolean(right.method)) - Number(Boolean(left.method)) || left.id.localeCompare(right.id))[0];
}

export function buildPcnOfficialDocumentId(
  issuanceId: string,
  templateId: string,
  format: PcnGeneratedDocumentFormat,
  contextHash: string,
): string {
  return `pcn-official-${safeSegment(issuanceId)}-${safeSegment(templateId)}-${format.toLowerCase()}-${safeSegment(contextHash.slice(0, 16))}`;
}

export function buildPcnOfficialFileAssetId(contentSha256: string, documentId?: string): string {
  const contentToken = safeSegment(contentSha256.slice(0, 16).toLowerCase());
  if (!documentId) return `pcn-file-official-${contentToken}`;
  const documentToken = safeSegment(documentId).toLowerCase().replace(/_/g, '-');
  return `pcn-file-official-${documentToken}-${contentToken}`;
}

export function buildPcnOfficialFileName(
  dossierCode: string,
  documentKind: PcnOfficialDocumentKind,
  format: PcnGeneratedDocumentFormat,
): string {
  const label = documentKind === 'CERTIFICATE'
    ? 'gcn-chinh-thuc'
    : documentKind === 'DECISION'
      ? 'quyet-dinh-chinh-thuc'
      : documentKind === 'PROPOSAL'
        ? 'de-nghi-chinh-thuc'
        : documentKind === 'SAMPLE_HANDOVER'
          ? 'bien-ban-giao-nhan-mau'
          : 'bao-cao-danh-gia';
  return `${safeSegment(dossierCode)}-${label}.${format.toLowerCase()}`;
}

// --- End of pcnOfficialDocumentPolicy.ts ---
