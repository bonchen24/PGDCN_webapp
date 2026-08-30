// Author: Codex
// OS support: Web/Node
// Description: Pure approval-state policy for PCN official template metadata

import type { PcnTemplateDefinition, PcnTemplateReviewAction } from '../types.ts';
import { getPcnTemplateReadiness } from './pcnTemplateCatalog.ts';

export function reviewPcnTemplateDefinition(
  template: PcnTemplateDefinition,
  action: PcnTemplateReviewAction,
  options: { now?: string; approverUsername?: string } = {},
): PcnTemplateDefinition {
  if (action === 'REQUEST_ANNOTATION') {
    return { ...template, status: 'NEEDS_ANNOTATION', approvedAt: undefined, approvedByUsername: undefined };
  }
  if (action === 'RETIRE') {
    return { ...template, status: 'RETIRED' };
  }

  const approvalProbe = { ...template, status: 'APPROVED' as const };
  const readiness = getPcnTemplateReadiness(approvalProbe, { availablePlaceholderKeys: template.placeholderKeys });
  if (!readiness.ready) {
    throw new Error(`Không thể phê duyệt template: ${readiness.reasons.join(', ')}.`);
  }
  const approverUsername = String(options.approverUsername || '').trim();
  const importerUsername = String(template.importedByUsername || '').trim();
  if (approverUsername && importerUsername && approverUsername.toLowerCase() === importerUsername.toLowerCase()) {
    throw new Error('Người nhập template không được tự phê duyệt cùng asset.');
  }
  return {
    ...template,
    status: 'APPROVED',
    ...(approverUsername ? { approvedByUsername: approverUsername } : {}),
    approvedAt: template.approvedAt || options.now || new Date().toISOString(),
  };
}

// --- End of pcnTemplateReview.ts ---
