// Author: Codex
// OS support: Web
// Description: Same-origin API client for controlled PCN DOCX annotation

import type { ActivityLog, PcnTemplateAnnotationMapping, PcnTemplateDefinition } from '../types.ts';

export interface PcnTemplateAnnotationResponse {
  template: PcnTemplateDefinition;
  activityLog?: ActivityLog;
}
export async function annotatePcnTemplate(
  templateId: string,
  mappings: PcnTemplateAnnotationMapping[],
): Promise<PcnTemplateAnnotationResponse> {
  const response = await fetch(`/api/pcn/templates/${encodeURIComponent(templateId)}/annotate`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mappings }),
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Chú thích template PCN trả về HTTP ${response.status}`);
  }
  return payload as PcnTemplateAnnotationResponse;
}
