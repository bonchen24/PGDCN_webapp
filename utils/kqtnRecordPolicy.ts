// Author: Gemini
// OS support: Web/Node
// Description: Pure policy helpers enforcing one current KQTN result per sample head.

import { normalizeKqtnSampleKey } from './kqtnIdentity';

type KqtnRecordIdentity = {
  id: string;
  sampleCode?: string;
  sampleKey?: string;
};

export function findKqtnRecordBySampleKey<T extends KqtnRecordIdentity>(
  records: T[],
  sampleCodeOrKey: string,
): T | undefined {
  const key = normalizeKqtnSampleKey(sampleCodeOrKey);
  if (!key) return undefined;
  return records.find((record) => normalizeKqtnSampleKey(record.sampleKey || record.sampleCode) === key);
}

export function shouldOverwriteKqtnRecord(overwriteConfirmed: boolean): boolean {
  return overwriteConfirmed === true;
}

// --- End of kqtnRecordPolicy.ts ---
