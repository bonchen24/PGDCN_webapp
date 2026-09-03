import type { AssistantReviewRequest } from '../types.ts';

export function isPgdcnAssistantReviewRequest(value: unknown): value is AssistantReviewRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (request.domain === 'PCN') {
    return typeof request.fieldCode === 'string'
      && request.fieldCode.trim().length > 0
      && typeof request.dossierId === 'string'
      && request.dossierId.trim().length > 0
      && !('requestId' in request);
  }
  if (request.domain === 'PGD') {
    return typeof request.requestId === 'string'
      && request.requestId.trim().length > 0
      && !('fieldCode' in request)
      && !('dossierId' in request);
  }
  return false;
}
