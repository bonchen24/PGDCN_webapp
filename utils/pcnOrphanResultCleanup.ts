// Author: Codex
// OS support: Node
// Description: Narrow planning policy for removing empty, unlinked PCN result fixtures

export interface PcnOrphanResultCleanupRecord {
  documentId: string;
  data: unknown;
  dossierReferenceCount: number;
  labRequestReferenceCount: number;
  fileAssetCount: number;
  activityReferenceCount: number;
}

export interface PcnOrphanResultCleanupPlan {
  safeToRemove: boolean;
  candidateIds: string[];
  blockedIds: string[];
  reasons: Record<string, string[]>;
}

export function planPcnOrphanResultCleanup(
  records: Array<PcnOrphanResultCleanupRecord | Record<string, unknown>>,
): PcnOrphanResultCleanupPlan {
  const candidateIds: string[] = [];
  const blockedIds: string[] = [];
  const reasons: Record<string, string[]> = {};

  for (const rawRecord of records) {
    const record = rawRecord as Partial<PcnOrphanResultCleanupRecord>;
    const documentId = String(record.documentId || '').trim();
    const recordReasons: string[] = [];
    const data = record.data;
    if (!documentId) recordReasons.push('MISSING_DOCUMENT_ID');
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 0) {
      recordReasons.push('PAYLOAD_NOT_EMPTY');
    }
    if (Number(record.dossierReferenceCount || 0) > 0) recordReasons.push('DOSSIER_REFERENCE');
    if (Number(record.labRequestReferenceCount || 0) > 0) recordReasons.push('LAB_REQUEST_REFERENCE');
    if (Number(record.fileAssetCount || 0) > 0) recordReasons.push('FILE_ASSET_REFERENCE');
    if (Number(record.activityReferenceCount || 0) > 0) recordReasons.push('ACTIVITY_REFERENCE');

    if (recordReasons.length === 0) {
      candidateIds.push(documentId);
    } else {
      const key = documentId || '(missing-document-id)';
      blockedIds.push(key);
      reasons[key] = recordReasons;
    }
  }

  return {
    safeToRemove: blockedIds.length === 0,
    candidateIds,
    blockedIds,
    reasons,
  };
}

// --- End of pcnOrphanResultCleanup.ts ---
