export type PgdcnDossierLibraryDomain = 'PCN' | 'PGD';
export type PgdcnDossierLibraryView = 'ALL' | PgdcnDossierLibraryDomain | 'MINE' | 'REVIEW';

export interface PgdcnDossierLibraryEntry {
  domain: PgdcnDossierLibraryDomain;
  id: string;
  code: string;
  customerName: string;
  productName?: string;
  status: string;
  ownerUsername?: string;
  responsibleUsernames?: string[];
  updatedAt?: string;
}

export function isPgdcnDossierAwaitingReview(entry: Pick<PgdcnDossierLibraryEntry, 'domain' | 'status'>): boolean {
  const status = entry.status.toLocaleUpperCase();
  return entry.domain === 'PCN'
    ? status === 'TECHNICAL_REVIEW' || status === 'WAITING_APPROVAL'
    : status === 'RESULTS_REVIEW' || status === 'TECHNICAL_REVIEW' || status === 'LEADERSHIP_APPROVAL';
}

export function filterPgdcnDossierLibrary(
  entries: readonly PgdcnDossierLibraryEntry[],
  options: { view: PgdcnDossierLibraryView; username: string; query?: string },
): PgdcnDossierLibraryEntry[] {
  const query = options.query?.trim().toLocaleLowerCase('vi-VN') || '';
  const username = options.username.trim().toLocaleLowerCase();
  if (options.view === 'MINE' && !username) return [];
  return entries
    .filter((entry) => {
      if (options.view === 'PCN' || options.view === 'PGD') return entry.domain === options.view;
      if (options.view === 'MINE') return [entry.ownerUsername, ...(entry.responsibleUsernames || [])].some((name) => String(name || '').toLocaleLowerCase() === username);
      if (options.view === 'REVIEW') return isPgdcnDossierAwaitingReview(entry);
      return true;
    })
    .filter((entry) => !query || `${entry.code} ${entry.customerName} ${entry.productName || ''} ${entry.status}`.toLocaleLowerCase('vi-VN').includes(query))
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')) || left.code.localeCompare(right.code, 'vi-VN'));
}
