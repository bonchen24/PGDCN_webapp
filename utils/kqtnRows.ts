// Author: Gemini
// OS support: Web/Node
// Description: Builds one KQTN workbench row for each canonical sample head.

import type { KQTNRecord, TestRequest } from '../types';
import { getKqtnSampleCode, normalizeKqtnSampleKey } from './kqtnIdentity';

export type KqtnSampleHeadRow = KQTNRecord & {
  isPending: boolean;
  sourceRequest?: TestRequest;
};

function recordTime(record: KQTNRecord): number {
  return new Date(record.updatedAt || record.createdAt || 0).getTime();
}

function pickLatest(records: KQTNRecord[]): KQTNRecord | undefined {
  return [...records].sort((left, right) => recordTime(right) - recordTime(left))[0];
}

function createPendingRow(request: TestRequest, sampleCode: string, sampleKey: string): KqtnSampleHeadRow {
  return {
    id: `sample-head:${sampleKey}`,
    requestId: request.id,
    requestCode: request.requestCode,
    sampleCode,
    sampleKey,
    reportNo: '',
    sealStamp: request.sealStamp,
    sampleName: request.type || request.modelName,
    model: request.modelName,
    brand: request.brand,
    senderUnit: request.customerName,
    standardId: '',
    standardTitle: request.standard || '',
    version: 0,
    versionHistory: [],
    createdAt: request.receivedDate || request.createdAt || request.requestDate,
    createdBy: '',
    updatedAt: request.updatedAt || request.receivedDate || request.requestDate,
    updatedBy: '',
    isPending: true,
    sourceRequest: request,
  };
}

export function mergeKqtnSampleHeads(
  requests: TestRequest[],
  records: KQTNRecord[],
): KqtnSampleHeadRow[] {
  const recordsByKey = new Map<string, KQTNRecord[]>();
  for (const record of records || []) {
    const key = normalizeKqtnSampleKey(record.sampleKey || getKqtnSampleCode(record));
    if (!key) continue;
    const group = recordsByKey.get(key) || [];
    group.push(record);
    recordsByKey.set(key, group);
  }

  const rows: KqtnSampleHeadRow[] = [];
  const seenKeys = new Set<string>();
  for (const request of requests || []) {
    const sampleCode = getKqtnSampleCode(request);
    const sampleKey = normalizeKqtnSampleKey(sampleCode);
    if (!sampleKey || seenKeys.has(sampleKey)) continue;
    seenKeys.add(sampleKey);
    const existing = pickLatest(recordsByKey.get(sampleKey) || []);
    rows.push(existing
      ? { ...existing, requestId: request.id, requestCode: existing.requestCode || request.requestCode, sampleCode: existing.sampleCode || sampleCode, sampleKey, isPending: false, sourceRequest: request }
      : createPendingRow(request, sampleCode, sampleKey));
  }

  for (const [sampleKey, groupedRecords] of recordsByKey) {
    if (seenKeys.has(sampleKey)) continue;
    const existing = pickLatest(groupedRecords);
    if (existing) rows.push({ ...existing, sampleKey, isPending: false });
  }

  return rows;
}

// --- End of kqtnRows.ts ---
