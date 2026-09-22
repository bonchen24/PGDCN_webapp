const INTERNAL_DOSSIER_PATHS = ['/pgdcn/pcn/dossiers/', '/pgdcn/pgd/dossiers/'] as const;

function encodeRoutePart(value: string): string {
  return encodeURIComponent(value);
}

/** Keep return navigation inside the app and discard malformed/external values. */
export function sanitizeInternalReturnTo(value?: string | null): string | undefined {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return undefined;
  try {
    const parsed = new URL(candidate, 'https://pgdcn.local');
    if (parsed.origin !== 'https://pgdcn.local' || !INTERNAL_DOSSIER_PATHS.some((prefix) => parsed.pathname.startsWith(prefix))) {
      return undefined;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export function buildPcnDossierReturnRoute(
  dossierId: string,
  options: { tab?: string; nodeId?: string } = {},
): string {
  const query = new URLSearchParams();
  if (options.tab) query.set('tab', options.tab);
  if (options.nodeId) query.set('node', options.nodeId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `/pgdcn/pcn/dossiers/${encodeRoutePart(dossierId)}${suffix}`;
}

export function buildPgdDossierReturnRoute(
  requestId: string,
  options: { step?: string } = {},
): string {
  const query = options.step ? `?step=${encodeURIComponent(options.step)}` : '';
  return `/pgdcn/pgd/dossiers/${encodeRoutePart(requestId)}${query}`;
}

export function buildPcnDraftingRoute(input: {
  dossierId: string;
  requirementId?: string;
  nodeId?: string;
  kind?: string;
  returnTo?: string;
}): string {
  const query = new URLSearchParams({ dossierId: input.dossierId });
  if (input.requirementId) query.set('requirementId', input.requirementId);
  if (input.nodeId) query.set('node', input.nodeId);
  if (input.kind) query.set('kind', input.kind);
  const returnTo = sanitizeInternalReturnTo(input.returnTo);
  if (returnTo) query.set('returnTo', returnTo);
  return `/pgdcn/pcn/drafting?${query.toString()}`;
}

export function buildPgdDraftingRoute(input: {
  requestId: string;
  requirementCode?: string;
  templateKind?: string;
  returnTo?: string;
}): string {
  const query = new URLSearchParams({ requestId: input.requestId });
  if (input.requirementCode) query.set('requirementCode', input.requirementCode);
  if (input.templateKind) query.set('templateKind', input.templateKind);
  const returnTo = sanitizeInternalReturnTo(input.returnTo);
  if (returnTo) query.set('returnTo', returnTo);
  return `/pgdcn/pgd/drafting?${query.toString()}`;
}

// --- End of draftingNavigation.ts ---
