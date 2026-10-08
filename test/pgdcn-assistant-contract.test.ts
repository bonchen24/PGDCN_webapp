import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { isPgdcnAssistantReviewRequest } from '../utils/pgdcnAssistant.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('accepts exactly one domain-specific assistant review request shape', () => {
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PCN', fieldCode: 'QC4', dossierId: 'dossier-1' }), true);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PGD', requestId: 'request-1' }), true);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PGD', fieldCode: 'GĐ-THEP-KG', dossierId: 'dossier-1' }), false);
  assert.equal(isPgdcnAssistantReviewRequest({ domain: 'PCN', requestId: 'request-1' }), false);
});

test('PGD assistant review stays server-owned, scoped and read-only', () => {
  assert.match(serverSource, /app\.post\('\/api\/pgd\/assistant\/review'/);
  assert.match(serverSource, /PGD_COLLECTIONS\.dossierDocuments/);
  assert.match(serverSource, /documentPointers/);
  assert.match(serverSource, /evidenceAssetIds/);
  assert.match(serverSource, /getPgdStorageClient/);
  assert.match(serverSource, /fetchPgdAssistantPaddlePage/);
  assert.match(serverSource, /fetchPgdAssistantGeminiPage/);
  assert.match(serverSource, /fetchPgdAssistantOcrPage\(req/);
  assert.match(serverSource, /semanticReviewPgdCriterion/);
  assert.match(serverSource, /documentTexts\)/);
  assert.match(serverSource, /total: baseReview\.criteria\.length/);
  assert.match(serverSource, /Kết quả sẽ hiện lần lượt theo 11 tiêu chí/);
  const routeStart = serverSource.indexOf("app.post('/api/pgd/assistant/review'");
  const routeEndOffset = serverSource.slice(routeStart).search(/\r?\n\s+app\.post\('\/api\/pgd\/calibration-instruments'/);
  const routeEnd = routeEndOffset < 0 ? serverSource.length : routeStart + routeEndOffset;
  const route = serverSource.slice(routeStart, routeEnd);
  assert.doesNotMatch(route, /applyPgdApproval|approvePgdStep|transitionPgdInspection|INSERT INTO app_documents|UPDATE app_documents/);
});
