import type { PcnAgentAction, PcnAgentResponseBlock, PcnAgentTask, PcnAgentWorkspace } from './pcnAgentTypes.ts';

export interface PcnAgentConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  blocks?: PcnAgentResponseBlock[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `AI Trợ lý PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function fetchPcnAgentWorkspace(): Promise<PcnAgentWorkspace> {
  const response = await fetch('/api/pcn/agent/workspace', { credentials: 'same-origin' });
  const payload = await parseResponse(response);
  return payload.workspace as PcnAgentWorkspace;
}

export async function fetchLatestPcnAgentConversation(): Promise<{
  conversationId?: string;
  messages: PcnAgentConversationMessage[];
}> {
  const response = await fetch('/api/pcn/agent/conversations/latest', { credentials: 'same-origin' });
  const payload = await parseResponse(response);
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const messages = rawMessages.flatMap((entry: unknown): PcnAgentConversationMessage[] => {
    if (!entry || typeof entry !== 'object') return [];
    const value = entry as { id?: unknown; role?: unknown; text?: unknown; blocks?: unknown };
    const id = String(value.id || '').trim();
    if (!id) return [];
    if (value.role === 'user' && typeof value.text === 'string' && value.text.trim()) {
      return [{ id, role: 'user', text: value.text }];
    }
    if (value.role === 'assistant' && Array.isArray(value.blocks)) {
      return [{ id, role: 'assistant', blocks: value.blocks as PcnAgentResponseBlock[] }];
    }
    return [];
  });
  const conversationId = typeof payload?.conversationId === 'string' && payload.conversationId.trim()
    ? payload.conversationId.trim()
    : undefined;
  return { conversationId, messages };
}

export async function sendPcnAgentMessage(input: { message: string; conversationId?: string }): Promise<{
  conversationId: string;
  blocks: PcnAgentResponseBlock[];
  toolsUsed: string[];
  recordsAccessed: string[];
}> {
  const response = await fetch('/api/pcn/agent/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response);
}

export async function confirmPcnAgentAction(actionId: string): Promise<{ action: PcnAgentAction; task: PcnAgentTask }> {
  const response = await fetch(`/api/pcn/agent/actions/${encodeURIComponent(actionId)}/confirm`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response);
}

export async function cancelPcnAgentAction(actionId: string): Promise<{ action: PcnAgentAction }> {
  const response = await fetch(`/api/pcn/agent/actions/${encodeURIComponent(actionId)}/cancel`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response);
}
