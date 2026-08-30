// Author: Codex
// OS support: Web
// Description: Dedicated PCN boundary for attaching a private report asset to a returned result

import type { ActivityLog, ReturnedTestResult } from '../types.ts';

export interface PcnReturnedResultFileMutationResponse {
  result: ReturnedTestResult;
  activityLog?: ActivityLog;
}

async function parsePcnResultFileResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN result file API trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function attachPcnReturnedResultFile(
  resultId: string,
  assetId: string,
  fileName?: string,
): Promise<PcnReturnedResultFileMutationResponse> {
  const response = await fetch(`/api/pcn/results/${encodeURIComponent(resultId)}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      ...(fileName ? { fileName } : {}),
    }),
  });
  return await parsePcnResultFileResponse(response) as PcnReturnedResultFileMutationResponse;
}

// --- End of pcnResultFileApi.ts ---
