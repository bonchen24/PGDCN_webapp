import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PgdDossierFlow, type PgdDossierFlowProps } from '../components/PgdDossierFlow';
import type { PgdTransitionContext } from '../utils/pgdDomain';

function renderFlow(status: PgdDossierFlowProps['status'], evidence: PgdTransitionContext) {
  return renderToStaticMarkup(createElement(PgdDossierFlow, {
    status,
    evidence,
    selectedStepId: 'execution',
    onSelectStep: () => undefined,
  }));
}

function cardFor(markup: string, stepId: string) {
  const card = markup.match(new RegExp(`<button\\b[^>]*id="pgd-dossier-step-tab-${stepId}"[\\s\\S]*?<\\/button>`))?.[0];
  assert.ok(card, `missing step card: ${stepId}`);
  return card;
}

test('PGD flow counts only verified evidence as completed progress in 7 stages', () => {
  const beforeLabResults = renderFlow('WAITING_LAB_RESULTS', {
    hasApprovedAssignment: true,
    hasFieldInspection: true,
    hasSampleHandover: false,
    labRequests: [],
  });

  // 7 stages progress verification
  assert.equal((beforeLabResults.match(/role="tab"/g) ?? []).length, 7);
  assert.match(beforeLabResults, /aria-current="step"/);
  assert.match(cardFor(beforeLabResults, 'review-assignment'), /Đã hoàn tất/);
  assert.match(cardFor(beforeLabResults, 'plan'), /Đã hoàn tất/);
  assert.match(cardFor(beforeLabResults, 'execution'), /Đã kiểm tra hiện trường/);

  const beforeReview = renderFlow('RESULTS_REVIEW', {
    hasSampleHandover: true,
    labRequests: [{
      id: 'lab-1',
      domain: 'pgd',
      requestId: 'request-1',
      sampleId: 'sample-1',
      status: 'SENT',
      laboratoryName: 'PTN',
      testItems: [],
    }],
  });

  assert.match(cardFor(beforeReview, 'results-evaluation'), /0\/1 KQTN/);
  assert.doesNotMatch(cardFor(beforeReview, 'results-evaluation'), /Đã hoàn tất/);
});
