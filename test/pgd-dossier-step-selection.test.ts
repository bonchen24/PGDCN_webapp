import assert from 'node:assert/strict';
import test from 'node:test';

import type { PgdDossierFlowStepId } from '../components/PgdDossierFlow';
import * as pgdWorkspace from '../components/PgdWorkspace';
import type { PgdInspectionStatus } from '../utils/pgdDomain';

test('PGD detail preserves accessible step selection and reconciles request and deep-link changes', () => {
  const resolver = (pgdWorkspace as unknown as Record<string, unknown>).reconcilePgdDossierStepSelection;
  assert.equal(typeof resolver, 'function');
  const reconcilePgdDossierStepSelection = resolver as (input: {
    selectedStepId: PgdDossierFlowStepId;
    status: PgdInspectionStatus;
    requestId: string;
    initialStepId?: PgdDossierFlowStepId;
    previousContext: { requestId: string; initialStepId?: PgdDossierFlowStepId };
  }) => string;

  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'capability',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-1',
    previousContext: { requestId: 'request-1' },
  }), 'capability');
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'sampling',
    status: 'PREPARING',
    requestId: 'request-1',
    previousContext: { requestId: 'request-1' },
  }), 'plan');
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'capability',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-2',
    previousContext: { requestId: 'request-1' },
  }), 'lab-result');
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'report',
    status: 'WAITING_LAB_RESULTS',
    requestId: 'request-1',
    initialStepId: 'field',
    previousContext: { requestId: 'request-1', initialStepId: 'capability' },
  }), 'field');
  assert.equal(reconcilePgdDossierStepSelection({
    selectedStepId: 'report',
    status: 'DRAFT',
    requestId: 'request-1',
    initialStepId: 'field',
    previousContext: { requestId: 'request-1' },
  }), 'intake');
});
