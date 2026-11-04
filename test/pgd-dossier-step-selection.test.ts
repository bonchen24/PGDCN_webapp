import assert from 'node:assert/strict';
import test from 'node:test';

import type { PgdDossierFlowStepId } from '../components/PgdDossierFlow';
import * as pgdWorkspace from '../components/PgdWorkspace';
import type { PgdInspectionStatus } from '../utils/pgdDomain';

test('PGD detail preserves accessible step selection and reconciles request and deep-link changes across 7 stages', () => {
  const resolver = (pgdWorkspace as unknown as Record<string, unknown>).reconcilePgdDossierStepSelection;
  assert.equal(typeof resolver, 'function');
  const reconcilePgdDossierStepSelection = resolver as (input: {
    selectedStepId: PgdDossierFlowStepId;
    status: PgdInspectionStatus;
    requestId: string;
    initialStepId?: PgdDossierFlowStepId;
    previousContext: { requestId: string; initialStepId?: PgdDossierFlowStepId };
  }) => string;

  // Selected stage 2 (review-assignment) while at stage 5 (WAITING_LAB_RESULTS) -> allowed to inspect past stage
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'review-assignment',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-1',
    previousContext: { requestId: 'request-1' },
  }), 'review-assignment');

  // Forward jump to stage 4 (execution) while at stage 3 (PREPARING) -> clamped to current stage (plan)
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'execution',
    status: 'PREPARING',
    requestId: 'request-1',
    previousContext: { requestId: 'request-1' },
  }), 'plan');

  // Switching request context with no initialStepId resets to the target request current stage (results-evaluation for WAITING_LAB_RESULTS)
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'review-assignment',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-2',
    previousContext: { requestId: 'request-1' },
  }), 'results-evaluation');

  // Deep-link initialStepId preserved if it is a completed or current stage
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'reporting-approval',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-1',
    initialStepId: 'execution',
    previousContext: { requestId: 'request-1', initialStepId: 'review-assignment' },
  }), 'execution');

  // Deep-link forward jump clamped to intake for DRAFT
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'reporting-approval',
    status: 'DRAFT',
    requestId: 'request-1',
    initialStepId: 'execution',
    previousContext: { requestId: 'request-1' },
  }), 'intake');
});
