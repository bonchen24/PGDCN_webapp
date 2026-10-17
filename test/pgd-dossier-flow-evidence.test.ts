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
    selectedStepId: 'sampling',
    onSelectStep: () => undefined,
  }));
}

function cardFor(markup: string, stepId: string) {
  const card = markup.match(new RegExp(`<button\\b[^>]*id="pgd-dossier-step-tab-${stepId}"[\\s\\S]*?<\\/button>`))?.[0];
  assert.ok(card, `missing step card: ${stepId}`);
  return card;
}

test('PGD flow counts only verified evidence as completed progress', () => {
  const beforeLabResults = renderFlow('WAITING_LAB_RESULTS', {
    hasApprovedAssignment: true,
    hasFieldInspection: true,
    hasSampleHandover: false,
    labRequests: [],
  });

  assert.match(beforeLabResults, /2\/12 việc đã xong/);
  assert.match(cardFor(beforeLabResults, 'assignment'), /Đã hoàn tất/);
  assert.match(cardFor(beforeLabResults, 'sampling'), /Đã qua · chưa xác minh/);
  assert.match(cardFor(beforeLabResults, 'sampling'), /Chưa bàn giao/);
  assert.doesNotMatch(cardFor(beforeLabResults, 'sampling'), /Đã hoàn tất/);
  assert.match(cardFor(beforeLabResults, 'lab-request'), /Đã qua · chưa xác minh/);
  assert.match(cardFor(beforeLabResults, 'lab-request'), /0 PYC PTN/);

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

  assert.match(cardFor(beforeReview, 'lab-result'), /Đã qua · chưa xác minh/);
  assert.match(cardFor(beforeReview, 'lab-result'), /0\/1 KQTN/);
  assert.doesNotMatch(cardFor(beforeReview, 'lab-result'), /Đã hoàn tất/);
});
