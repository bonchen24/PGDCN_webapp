'use client';

import type { PgdInspectionStatus, PgdTransitionContext } from '../utils/pgdDomain';
import { PGD_WORKFLOW_STATES } from '../utils/pgdDomain';
import PcnArchifyWorkflowEmbed from './PcnArchifyWorkflowEmbed';

/** Compatibility entry kept for callers while the PGD map is now the shared Archify reader. */
export default function PgdWorkflowMap({ status, evidence }: { status: PgdInspectionStatus; evidence: PgdTransitionContext }) {
  const context = evidence as PgdTransitionContext & { requestId?: string; requestCode?: string };
  if (!context.requestId) return null;
  const nodes = PGD_WORKFLOW_STATES.map((state) => ({ id: `pgd-${state.code.toLowerCase()}`, label: state.label }));
  return <PcnArchifyWorkflowEmbed domain="pgd" recordId={context.requestId} recordCode={context.requestCode || context.requestId} nodes={[...nodes, { id: 'pgd-archived', label: 'Lưu trữ hồ sơ PGD' }]} />;
}
