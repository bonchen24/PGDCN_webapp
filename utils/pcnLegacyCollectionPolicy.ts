export interface PcnLegacyCollectionDocument {
  documentId: string;
  data: Record<string, unknown>;
}

export interface PcnLegacyCollectionPlan {
  legacyCollection: string;
  canonicalCollection: string;
  legacyCount: number;
  matchingIds: string[];
  missingCanonicalIds: string[];
  conflictingIds: string[];
  safeToRemove: boolean;
}

export const PCN_LEGACY_COLLECTION_MAPPINGS = [
  { legacyCollection: 'pcnSchemeBranches', canonicalCollection: 'pcnCertificationFields' },
] as const;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function planPcnLegacyCollectionReconciliation(input: {
  legacyCollection: string;
  canonicalCollection: string;
  legacyDocuments: PcnLegacyCollectionDocument[];
  canonicalDocuments: PcnLegacyCollectionDocument[];
}): PcnLegacyCollectionPlan {
  const canonicalById = new Map(input.canonicalDocuments.map((document) => [document.documentId, document]));
  const matchingIds: string[] = [];
  const missingCanonicalIds: string[] = [];
  const conflictingIds: string[] = [];

  for (const legacyDocument of input.legacyDocuments) {
    const canonicalDocument = canonicalById.get(legacyDocument.documentId);
    if (!canonicalDocument) {
      missingCanonicalIds.push(legacyDocument.documentId);
    } else if (stableJson(legacyDocument.data) === stableJson(canonicalDocument.data)) {
      matchingIds.push(legacyDocument.documentId);
    } else {
      conflictingIds.push(legacyDocument.documentId);
    }
  }

  return {
    legacyCollection: input.legacyCollection,
    canonicalCollection: input.canonicalCollection,
    legacyCount: input.legacyDocuments.length,
    matchingIds,
    missingCanonicalIds,
    conflictingIds,
    safeToRemove: missingCanonicalIds.length === 0 && conflictingIds.length === 0,
  };
}

// --- End of pcnLegacyCollectionPolicy.ts ---
