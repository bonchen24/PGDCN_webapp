// Author: Codex
// OS support: Browser/Node
// Description: Pure selectors for the PCN generated-document panel

import type { PcnGeneratedDocument, PcnGeneratedDocumentKind } from '../types.ts';

export type PcnGeneratedDocumentLineageStatus = 'COMPLETE' | 'MISSING_DOCX' | 'MISSING_PDF' | 'CONTEXT_MISMATCH' | 'STALE';

export interface PcnGeneratedDocumentLineage {
  contextHash: string;
  sourceUpdatedAt?: string;
  docx?: PcnGeneratedDocument;
  pdf?: PcnGeneratedDocument;
  status: Exclude<PcnGeneratedDocumentLineageStatus, 'CONTEXT_MISMATCH'>;
  isStale: boolean;
}

export interface PcnGeneratedDocumentLineageSummary {
  status: PcnGeneratedDocumentLineageStatus;
  lineages: PcnGeneratedDocumentLineage[];
  latest?: PcnGeneratedDocumentLineage;
}

export function getPcnGeneratedDocumentsForKind(
  generatedDocuments: PcnGeneratedDocument[],
  dossierId: string,
  kind: PcnGeneratedDocumentKind,
  sampleRouteId?: string,
  labRequestId?: string,
): PcnGeneratedDocument[] {
  return generatedDocuments
    .filter((document) => document.dossierId === dossierId
      && document.kind === kind
      && (!['SAMPLE_TAKING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'SAMPLE_CODING'].includes(kind) || !sampleRouteId || document.sampleRouteId === sampleRouteId)
      && (kind !== 'LAB_REQUEST' || !labRequestId || document.labRequestId === labRequestId))
    .sort((left, right) => String(right.generatedAt || '').localeCompare(String(left.generatedAt || '')) || right.id.localeCompare(left.id));
}

function isNewerDocument(candidate: PcnGeneratedDocument, current?: PcnGeneratedDocument): boolean {
  if (!current) return true;
  return String(candidate.generatedAt || '').localeCompare(String(current.generatedAt || '')) > 0
    || (String(candidate.generatedAt || '') === String(current.generatedAt || '') && candidate.id.localeCompare(current.id) > 0);
}

function lineageSort(left: PcnGeneratedDocumentLineage, right: PcnGeneratedDocumentLineage): number {
  const leftGeneratedAt = Math.max(
    Date.parse(left.docx?.generatedAt || '') || 0,
    Date.parse(left.pdf?.generatedAt || '') || 0,
  );
  const rightGeneratedAt = Math.max(
    Date.parse(right.docx?.generatedAt || '') || 0,
    Date.parse(right.pdf?.generatedAt || '') || 0,
  );
  return rightGeneratedAt - leftGeneratedAt || right.contextHash.localeCompare(left.contextHash);
}

export function getPcnGeneratedDocumentLineageSummary(
  generatedDocuments: PcnGeneratedDocument[],
  dossierId: string,
  kind: PcnGeneratedDocumentKind,
  sampleRouteId?: string,
  currentSourceUpdatedAt?: string,
  labRequestId?: string,
): PcnGeneratedDocumentLineageSummary {
  const selectedDocuments = getPcnGeneratedDocumentsForKind(generatedDocuments, dossierId, kind, sampleRouteId, labRequestId);
  const groups = new Map<string, PcnGeneratedDocumentLineage>();

  for (const document of selectedDocuments) {
    const contextHash = String(document.contextHash || '');
    const sourceUpdatedAt = document.sourceUpdatedAt || undefined;
    const key = `${contextHash}\u0000${sourceUpdatedAt || ''}`;
    const existing = groups.get(key);
    if (existing) {
      if (document.format === 'DOCX' && isNewerDocument(document, existing.docx)) existing.docx = document;
      if (document.format === 'PDF' && isNewerDocument(document, existing.pdf)) existing.pdf = document;
      continue;
    }
    groups.set(key, {
      contextHash,
      ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
      ...(document.format === 'DOCX' ? { docx: document } : { pdf: document }),
      status: 'MISSING_PDF',
      isStale: Boolean(currentSourceUpdatedAt && sourceUpdatedAt && currentSourceUpdatedAt !== sourceUpdatedAt),
    });
  }

  const lineages = [...groups.values()]
    .map((lineage) => {
      const isStale = Boolean(currentSourceUpdatedAt && lineage.sourceUpdatedAt && currentSourceUpdatedAt !== lineage.sourceUpdatedAt);
      const status: PcnGeneratedDocumentLineage['status'] = lineage.docx && lineage.pdf
        ? (isStale ? 'STALE' : 'COMPLETE')
        : lineage.docx ? 'MISSING_PDF' : 'MISSING_DOCX';
      return { ...lineage, isStale, status };
    })
    .sort(lineageSort);

  const latest = lineages[0];
  const hasDocx = lineages.some((lineage) => Boolean(lineage.docx));
  const hasPdf = lineages.some((lineage) => Boolean(lineage.pdf));
  const hasCompleteContextPair = lineages.some((lineage) => Boolean(lineage.docx && lineage.pdf));
  let status: PcnGeneratedDocumentLineageStatus = latest?.status || 'MISSING_DOCX';
  if (hasDocx && hasPdf && !hasCompleteContextPair) status = 'CONTEXT_MISMATCH';

  return { status, lineages, latest };
}

// --- End of pcnGeneratedDocumentView.ts ---
