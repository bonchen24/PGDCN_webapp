// Author: Gemini
// OS support: Web/Node
// Description: Cursor-paginated REST client for append-only system activity logs

import type { ActivityKpiSummary, ActivityLog, ActivityLogAction, ActivityLogDomain, ActivityLogEntityType } from '../types';

export interface ActivityLogFilters {
  limit?: number;
  domain?: ActivityLogDomain | 'ALL';
  actor?: string | string[];
  action?: ActivityLogAction | '';
  entityType?: ActivityLogEntityType | '';
  from?: string;
  to?: string;
  search?: string;
}

export interface ActivityLogPage {
  items: ActivityLog[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ActivityKpiPage {
  items: ActivityKpiSummary[];
}

export interface ActivityLogClient {
  fetchPage: (filters?: ActivityLogFilters, cursor?: string | null) => Promise<ActivityLogPage>;
  fetchSummary: (filters?: ActivityLogFilters) => Promise<ActivityKpiPage>;
  append: (log: ActivityLog) => Promise<void>;
  appendBatch: (logs: ActivityLog[]) => Promise<void>;
  fetchAll: (filters?: ActivityLogFilters) => Promise<ActivityLog[]>;
}

const API_PATH = '/api/activity-logs';

const clampLimit = (limit?: number): number => {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(Number(limit))));
};

const normalizeActors = (actor?: string | string[]): string[] =>
  (Array.isArray(actor) ? actor : actor ? [actor] : [])
    .map(value => value.trim())
    .filter(Boolean);

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Activity log API trả về HTTP ${response.status}`);
  }
  return payload;
}

export function createActivityLogClient(fetchImpl: typeof fetch = fetch): ActivityLogClient {
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetchImpl(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    return parseResponse(response);
  };

  return {
    async fetchPage(filters: ActivityLogFilters = {}, cursor?: string | null): Promise<ActivityLogPage> {
      const params = new URLSearchParams();
      params.set('limit', String(clampLimit(filters.limit)));
      if (cursor) params.set('cursor', cursor);
      if (filters.domain && filters.domain !== 'ALL') params.set('domain', filters.domain);
      normalizeActors(filters.actor).forEach(actor => params.append('actor', actor));
      if (filters.action) params.set('action', filters.action);
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.search?.trim()) params.set('search', filters.search.trim());

      const payload = await request(`${API_PATH}?${params.toString()}`);
      return {
        items: Array.isArray(payload?.items) ? payload.items : [],
        nextCursor: payload?.nextCursor ? String(payload.nextCursor) : null,
        hasMore: Boolean(payload?.hasMore),
      };
    },

    async fetchSummary(filters: ActivityLogFilters = {}): Promise<ActivityKpiPage> {
      const params = new URLSearchParams();
      if (filters.domain && filters.domain !== 'ALL') params.set('domain', filters.domain);
      normalizeActors(filters.actor).forEach(actor => params.append('actor', actor));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const payload = await request(`${API_PATH}/summary?${params.toString()}`);
      return { items: Array.isArray(payload?.items) ? payload.items : [] };
    },

    async append(log: ActivityLog): Promise<void> {
      await request(API_PATH, {
        method: 'POST',
        body: JSON.stringify(log),
      });
    },

    async appendBatch(logs: ActivityLog[]): Promise<void> {
      const validLogs = Array.isArray(logs) ? logs.filter(Boolean) : [];
      for (let index = 0; index < validLogs.length; index += 250) {
        await request(`${API_PATH}/batch`, {
          method: 'POST',
          body: JSON.stringify({ items: validLogs.slice(index, index + 250) }),
        });
      }
    },

    async fetchAll(filters: ActivityLogFilters = {}): Promise<ActivityLog[]> {
      const items: ActivityLog[] = [];
      let cursor: string | null = null;
      const seenCursors = new Set<string>();

      while (true) {
        const page = await this.fetchPage({ ...filters, limit: filters.limit || 100 }, cursor);
        items.push(...page.items);
        if (!page.hasMore || !page.nextCursor || seenCursors.has(page.nextCursor)) break;
        seenCursors.add(page.nextCursor);
        cursor = page.nextCursor;
      }

      return items;
    },
  };
}

export const activityLogClient = createActivityLogClient();

// --- End of activityLogApi.ts ---
