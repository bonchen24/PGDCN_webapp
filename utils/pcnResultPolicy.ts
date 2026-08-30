import type { PcnResultOutcome, PcnSampleIssue, ReturnedTestResult } from '../types';
import { getPcnTimestampDenial } from './pcnDossierDate.ts';
import { getOfficialPcnResultRound } from './pcnWorkflow.ts';

export interface PcnReturnedResultDraft {
  id: string;
  dossierId: string;
  labRequestId: string;
  round: number | string;
  outcome: PcnResultOutcome;
  receivedAt: string;
  reportNumber?: string;
  fileAssetId?: string;
  notes?: string;
  sampleIssue?: PcnSampleIssue;
  createdAt?: string;
  updatedAt?: string;
}

function optionalText(value?: string): string | undefined {
  const trimmed = String(value || '').trim();
  return trimmed || undefined;
}

export function buildPcnReturnedResult(input: PcnReturnedResultDraft, now = new Date().toISOString()): ReturnedTestResult {
  const id = String(input.id || '').trim();
  const dossierId = String(input.dossierId || '').trim();
  const labRequestId = String(input.labRequestId || '').trim();
  const receivedAt = String(input.receivedAt || '').trim();
  const round = Number(input.round);

  if (!id) throw new Error('KQTN trả về phải có mã kết quả');
  if (!dossierId) throw new Error('KQTN trả về phải liên kết với hồ sơ chứng nhận');
  if (!labRequestId) throw new Error('KQTN trả về phải liên kết với PYC');
  if (!Number.isInteger(round) || round < 1) throw new Error('Vòng KQTN không hợp lệ');
  if (!['PASS', 'FAIL', 'PENDING'].includes(input.outcome)) throw new Error('Kết quả KQTN không hợp lệ');
  if (!receivedAt) throw new Error('KQTN trả về phải có ngày nhận');
  const receivedAtDenial = getPcnTimestampDenial('Thời điểm nhận KQTN', receivedAt);
  if (receivedAtDenial) throw new Error(receivedAtDenial);

  return {
    id,
    dossierId,
    labRequestId,
    round,
    outcome: input.outcome,
    receivedAt,
    reportNumber: optionalText(input.reportNumber),
    fileAssetId: optionalText(input.fileAssetId),
    notes: optionalText(input.notes),
    ...(input.sampleIssue ? { sampleIssue: input.sampleIssue } : {}),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function markOfficialPcnResults(results: ReturnedTestResult[]): ReturnedTestResult[] {
  const officialRound = getOfficialPcnResultRound(results);
  return results.map((result) => ({
    ...result,
    isOfficial: officialRound !== null && result.round === officialRound && result.outcome !== 'PENDING',
  }));
}
