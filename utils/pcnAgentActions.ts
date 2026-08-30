import type { PcnUserAccount } from '../types.ts';
import { hasPcnAgentCapability, hasPcnAgentPermission } from './pcnAgentCapabilities.ts';
import type { PcnAgentAction, PcnAgentTask } from './pcnAgentTypes.ts';

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

export function getPcnAgentActionDenial(
  actionType: PcnAgentAction['actionType'],
  actor: PcnUserAccount,
): string | null {
  if (!actor || actor.active === false) return 'Tài khoản PCN không còn hoạt động.';
  if (actionType === 'APPROVE_CERTIFICATE') return 'AI không được tự phê duyệt chứng nhận.';
  if (actionType === 'ISSUE_CERTIFICATE') return 'AI không được tự phát hành chứng nhận.';
  if (actionType === 'SIGN_DOCUMENT') return 'AI không được tự ký tài liệu.';
  if (actionType === 'DELETE_RECORD') return 'AI không được xóa hồ sơ hoặc tài liệu.';
  if (actionType === 'CHANGE_PERMISSION') return 'AI không được thay đổi quyền người dùng.';
  if (actionType === 'CREATE_TASK' && (!hasPcnAgentCapability(actor, 'PROPOSE_TASK') || !hasPcnAgentPermission(actor, 'pcn.agent.task.propose'))) {
    return 'Tài khoản viewer không được tạo task qua AI.';
  }
  if (actionType === 'PROPOSE_ASSIGNMENT' && (!hasPcnAgentCapability(actor, 'PROPOSE_ASSIGNMENT') || !hasPcnAgentPermission(actor, 'pcn.agent.assignment.propose'))) {
    return 'Chức vụ hoặc quyền hiện tại không được đề xuất phân công qua AI.';
  }
  return null;
}

export function proposePcnAgentTask(input: {
  actor: PcnUserAccount;
  dossierId?: string;
  dossierCode?: string;
  title: string;
  description?: string;
  dueAt?: string;
  now?: string;
  conversationId?: string;
}): PcnAgentAction {
  const denial = getPcnAgentActionDenial('CREATE_TASK', input.actor);
  if (denial) throw new Error(denial);
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Task AI phải có tiêu đề.');
  if (title.length > 240) throw new Error('Tiêu đề task AI quá dài.');
  const createdAt = input.now || new Date().toISOString();
  return {
    id: makeId('agent-action'),
    actionType: 'CREATE_TASK',
    actionLevel: 'EXECUTE_WITH_CONFIRMATION',
    status: 'PROPOSED',
    title: `Tạo task: ${title}`,
    description: input.description || 'Task được đề xuất từ AI Trợ lý PCN.',
    payload: {
      title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.dossierId ? { dossierId: input.dossierId } : {}),
      ...(input.dossierCode ? { dossierCode: input.dossierCode } : {}),
      assigneeUsername: input.actor.username,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    },
    requiredCapability: 'PROPOSE_TASK',
    actorUsername: input.actor.username,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    createdAt,
  };
}

export function proposePcnAgentAssignment(input: {
  actor: PcnUserAccount;
  dossierId: string;
  dossierCode: string;
  assigneeUsername: string;
  assigneeName?: string;
  assigneeWorkload?: {
    dossierCount: number;
    overdueCount: number;
    dueSoonCount: number;
    risk: 'NORMAL' | 'HIGH';
  };
  fieldCodes?: string[];
  description?: string;
  now?: string;
}): PcnAgentAction {
  const denial = getPcnAgentActionDenial('PROPOSE_ASSIGNMENT', input.actor);
  if (denial) throw new Error(denial);
  const dossierId = String(input.dossierId || '').trim();
  const dossierCode = String(input.dossierCode || '').trim();
  const assigneeUsername = normalizeUsername(input.assigneeUsername);
  if (!dossierId || !dossierCode) throw new Error('Đề xuất phân công phải gắn với hồ sơ cụ thể.');
  if (!assigneeUsername) throw new Error('Đề xuất phân công phải có người nhận.');
  const createdAt = input.now || new Date().toISOString();
  return {
    id: makeId('agent-action'),
    actionType: 'PROPOSE_ASSIGNMENT',
    actionLevel: 'DRAFT',
    status: 'PROPOSED',
    title: `Đề xuất phân công ${dossierCode}`,
    description: input.description || `Đề xuất giao hồ sơ cho ${input.assigneeName || input.assigneeUsername}. Chưa thay đổi chủ hồ sơ.`,
    payload: {
      dossierId,
      dossierCode,
      assigneeUsername,
      ...(input.assigneeName ? { assigneeName: input.assigneeName } : {}),
      ...(input.assigneeWorkload ? {
        assigneeWorkload: {
          dossierCount: Math.max(0, Number(input.assigneeWorkload.dossierCount) || 0),
          overdueCount: Math.max(0, Number(input.assigneeWorkload.overdueCount) || 0),
          dueSoonCount: Math.max(0, Number(input.assigneeWorkload.dueSoonCount) || 0),
          risk: input.assigneeWorkload.risk === 'HIGH' ? 'HIGH' as const : 'NORMAL' as const,
        },
      } : {}),
      ...(input.fieldCodes?.length ? { fieldCodes: [...input.fieldCodes] } : {}),
    },
    requiredCapability: 'PROPOSE_ASSIGNMENT',
    actorUsername: input.actor.username,
    createdAt,
  };
}

export function confirmPcnAgentTask(
  action: PcnAgentAction,
  actor: PcnUserAccount,
  persist: (task: PcnAgentTask) => Promise<void> | void,
  now = new Date().toISOString(),
): Promise<{ action: PcnAgentAction; task: PcnAgentTask }> {
  const denial = getPcnAgentActionDenial(action.actionType, actor);
  if (denial) throw new Error(denial);
  if (action.actionType !== 'CREATE_TASK') throw new Error('Action AI chưa được hỗ trợ thực thi.');
  if (action.status !== 'PROPOSED') throw new Error('Action AI không còn ở trạng thái chờ xác nhận.');
  if (normalizeUsername(action.actorUsername) !== normalizeUsername(actor.username)) {
    throw new Error('Chỉ người tạo đề xuất mới được xác nhận action AI này.');
  }
  const payload = action.payload || {};
  const title = String(payload.title || '').trim();
  if (!title || title.length > 240) throw new Error('Payload task AI không hợp lệ.');
  const task: PcnAgentTask = {
    id: makeId('pcn-task'),
    title,
    ...(String(payload.description || '').trim() ? { description: String(payload.description).trim() } : {}),
    ...(String(payload.dossierId || '').trim() ? { dossierId: String(payload.dossierId).trim() } : {}),
    ...(String(payload.dossierCode || '').trim() ? { dossierCode: String(payload.dossierCode).trim() } : {}),
    assigneeUsername: actor.username,
    ...(String(payload.dueAt || '').trim() ? { dueAt: String(payload.dueAt).trim() } : {}),
    status: 'OPEN',
    source: 'AGENT',
    createdAt: now,
    updatedAt: now,
    createdByUsername: actor.username,
  };
  return Promise.resolve(persist(task)).then(() => ({
    task,
    action: { ...action, status: 'EXECUTED', confirmedAt: now, executedAt: now, executionResult: { taskId: task.id } },
  }));
}
