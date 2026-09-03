// Author: Codex
// OS support: Web/Node
// Description: Accent-insensitive Vietnamese search helpers for PCN catalogs.

export function normalizePcnSearchText(value: unknown): string {
  return String(value ?? '')
    .replace(/[Đđ]/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function getPcnSearchTokens(query: unknown): string[] {
  return normalizePcnSearchText(query).split(' ').filter(Boolean);
}

export function matchesPcnSearchQuery(fields: readonly unknown[], query: unknown): boolean {
  const tokens = getPcnSearchTokens(query);
  if (tokens.length === 0) return true;

  const normalizedFields = fields
    .map(normalizePcnSearchText)
    .filter(Boolean);

  return tokens.every((token) => normalizedFields.some((field) => field.includes(token)));
}

export function filterPcnCatalogOptions<T>(
  options: readonly T[],
  query: unknown,
  getSearchFields: (option: T) => readonly unknown[],
): T[] {
  if (getPcnSearchTokens(query).length === 0) return [...options];
  return options.filter((option) => matchesPcnSearchQuery(getSearchFields(option), query));
}
