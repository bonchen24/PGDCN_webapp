import assert from 'node:assert/strict';
import test from 'node:test';

import { isPgdcnAssistantReviewRequest } from '../utils/pgdcnAssistant.ts';

test('accepts exactly one domain-specific assistant review request shape', () => {
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PCN', fieldCode: 'QC20', dossierId: 'dossier-1' }), true);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PGD', requestId: 'request-1' }), true);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PGD', fieldCode: 'QC20', dossierId: 'dossier-1' }), false);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PCN', requestId: 'request-1' }), false);
});
