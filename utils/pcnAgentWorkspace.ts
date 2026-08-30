import type { CertificationDossier, PcnUserAccount } from '../types.ts';
import { buildPcnWorkQueueRows, type PcnWorkQueueRow } from './pcnWorkQueue.ts';
import { buildPcnAgentUserContext, hasPcnAgentCapability } from './pcnAgentCapabilities.ts';
import type {
  PcnAgentActivity,
  PcnAgentDeadline,
  PcnAgentMetrics,
  PcnAgentRecommendation,
  PcnAgentRecommendationKind,
  PcnAgentSnapshot,
  PcnAgentTask,
  PcnAgentTestResult,
  PcnAgentLabRequest,
  PcnAgentCustomerInfo,
  PcnAgentUserContext,
  PcnAgentWorkItem,
  PcnAgentWorkloadRow,
  PcnAgentWorkspace,
} from './pcnAgentTypes.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['ISSUED', 'DELIVERED', 'ARCHIVED', 'CANCELLED']);
const WAITING_CUSTOMER_STATUSES = new Set(['AWAITING_DOCUMENTS', 'CORRECTIVE_ACTION']);
const BLOCKED_STATUSES = new Set(['AWAITING_DOCUMENTS', 'AWAITING_RESULTS', 'ON_HOLD', 'REJECTED']);

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function hasFieldScope(dossier: CertificationDossier, user: PcnUserAccount): boolean {
  const fieldScopes = (user.fieldCodes || []).map(normalizeUsername).filter(Boolean);
  if (fieldScopes.length === 0) return true;
  return (dossier.fieldCodes || []).some((fieldCode) => fieldScopes.includes(normalizeUsername(fieldCode)));
}

function validTimestamp(value: unknown): number | undefined {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function calendarDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = new Map(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.get('year') || '0000'}-${values.get('month') || '01'}-${values.get('day') || '01'}`;
}

function dateOnly(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const timestamp = validTimestamp(normalized);
  return timestamp === undefined ? undefined : calendarDate(timestamp);
}

export function isPcnAgentTaskOverdue(task: PcnAgentTask, now: string | number): boolean {
  const due = dateOnly(task.dueAt);
  if (!due) return false;
  const timestamp = typeof now === 'number' ? now : validTimestamp(now);
  return timestamp !== undefined && due < calendarDate(timestamp);
}

function dateKeyToUtc(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function dayDelta(target: string, now: number): number {
  return Math.round((dateKeyToUtc(target) - dateKeyToUtc(calendarDate(now))) / DAY_MS);
}

function calendarAgeDays(value: unknown, now: number): number | undefined {
  const date = dateOnly(value);
  if (!date) return undefined;
  return -dayDelta(date, now);
}

function sameUser(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeUsername(left);
  return Boolean(normalizedLeft && normalizedLeft === normalizeUsername(right));
}

function isManagementUser(user: PcnUserAccount): boolean {
  return hasPcnAgentCapability(user, 'VIEW_DEPARTMENT_WORK');
}

function relationFor(
  dossier: CertificationDossier,
  user: PcnUserAccount,
  approvalDossierIds: Set<string>,
): PcnAgentWorkItem['relation'] {
  if (sameUser(dossier.ownerUsername, user.username)) return 'OWNER';
  if (sameUser(dossier.evaluatorUsername, user.username)) return 'EVALUATOR';
  if (sameUser(dossier.reviewerUsername, user.username)) return 'REVIEWER';
  if (approvalDossierIds.has(dossier.id)) return 'APPROVAL';
  if (!dossier.ownerUsername) return 'UNASSIGNED';
  return 'UNASSIGNED';
}

function isApprovalAssignment(
  dossierId: string,
  user: PcnUserAccount,
  snapshot: PcnAgentSnapshot,
): boolean {
  const steps = (snapshot.approvalSteps || [])
    .filter((step) => step.dossierId === dossierId && step.status === 'PENDING')
    .sort((left, right) => left.sequence - right.sequence);
  const next = steps[0];
  if (!next) return false;
  if (next.assigneeUsername) return sameUser(next.assigneeUsername, user.username);
  return dossierId !== ''
    && user.departmentRoleCode === 'LEADERSHIP'
    && user.systemRole !== 'viewer'
    && user.role !== 'viewer';
}

function waitingDays(row: PcnWorkQueueRow, now: number): number {
  const updated = validTimestamp(row.updatedAt);
  if (updated === undefined) return 0;
  return Math.max(0, Math.floor((now - updated) / DAY_MS));
}

function buildPriority(row: PcnWorkQueueRow, now: number, relation: PcnAgentWorkItem['relation']): Pick<PcnAgentWorkItem, 'priorityScore' | 'priorityReasons' | 'blocked' | 'waitingDays'> {
  let score = row.priority === 'OVERDUE' ? 100 : row.priority === 'DUE_SOON' ? 60 : 20;
  const reasons: string[] = [];
  if (row.priority === 'OVERDUE') reasons.push('Đã quá hạn');
  if (row.priority === 'DUE_SOON') reasons.push('Deadline trong 3 ngày');
  if (row.missingRequiredCount > 0) {
    score += Math.min(25, row.missingRequiredCount * 5);
    reasons.push(`Thiếu ${row.missingRequiredCount} tài liệu bắt buộc`);
  }
  if (row.missingCoreLabels.length > 0) {
    score += Math.min(15, row.missingCoreLabels.length * 3);
    reasons.push(`Thiếu ${row.missingCoreLabels.length} trường cốt lõi`);
  }
  const blocked = BLOCKED_STATUSES.has(row.status);
  if (blocked) {
    score += 12;
    reasons.push(row.status === 'AWAITING_DOCUMENTS' ? 'Đang chờ bổ sung hồ sơ' : 'Đang chờ điều kiện tiếp theo');
  }
  const staleDays = waitingDays(row, now);
  if (staleDays >= 5) {
    score += Math.min(20, Math.floor(staleDays / 5) * 5);
    reasons.push(`Không thay đổi ${staleDays} ngày`);
  }
  if (row.status === 'WAITING_APPROVAL') {
    score += 10;
    reasons.push('Đang chờ phê duyệt');
  }
  if (relation === 'UNASSIGNED') {
    score += 8;
    reasons.push('Chưa có người phụ trách trực tiếp');
  }
  if (reasons.length === 0) reasons.push('Theo dõi theo trạm hiện tại');
  return { priorityScore: score, priorityReasons: reasons, blocked, waitingDays: staleDays };
}

function toAgentWorkItem(
  row: PcnWorkQueueRow,
  dossier: CertificationDossier,
  user: PcnUserAccount,
  approvalDossierIds: Set<string>,
  now: number,
): PcnAgentWorkItem {
  const relation = relationFor(dossier, user, approvalDossierIds);
  return { ...row, relation, ...buildPriority(row, now, relation) };
}

function buildDeadlines(rows: PcnAgentWorkItem[], labRequests: PcnAgentSnapshot['labRequests'], now: number): PcnAgentDeadline[] {
  const result: PcnAgentDeadline[] = [];
  const rowsByDossier = new Map(rows.map((row) => [row.dossierId, row]));
  for (const row of rows) {
    const target = dateOnly(row.targetDate);
    if (!target) continue;
    const daysRemaining = dayDelta(target, now);
    result.push({
      id: `dossier:${row.dossierId}`,
      kind: 'DOSSIER',
      dossierId: row.dossierId,
      dossierCode: row.dossierCode,
      label: 'Hạn xử lý hồ sơ',
      targetDate: target,
      daysRemaining,
      priority: row.priority,
      overdue: daysRemaining < 0,
    });
  }
  for (const request of (labRequests || [])) {
    const row = rowsByDossier.get(request.dossierId);
    const target = dateOnly(request.targetDate);
    if (!row || !target) continue;
    const daysRemaining = dayDelta(target, now);
    result.push({
      id: `lab:${request.id}`,
      kind: 'LAB_REQUEST',
      dossierId: row.dossierId,
      dossierCode: row.dossierCode,
      label: `Hạn PYC ${request.pycNumber || request.laboratoryName || ''}`.trim(),
      targetDate: target,
      daysRemaining,
      priority: daysRemaining < 0 ? 'OVERDUE' : daysRemaining <= 3 ? 'DUE_SOON' : 'NORMAL',
      overdue: daysRemaining < 0,
    });
  }
  return result.sort((left, right) => left.daysRemaining - right.daysRemaining || left.dossierCode.localeCompare(right.dossierCode, 'vi'));
}

function recommendationFor(item: PcnAgentWorkItem): PcnAgentRecommendation | undefined {
  let kind: PcnAgentRecommendationKind | undefined;
  let title = '';
  let description = '';
  if (item.priority === 'OVERDUE') {
    kind = 'OVERDUE';
    title = `${item.dossierCode} đã quá hạn`;
    description = `Ưu tiên xử lý tại trạm ${item.stationTitle.toLowerCase()}.`;
  } else if (item.missingRequiredCount > 0) {
    kind = 'MISSING_DOCUMENTS';
    title = `${item.dossierCode} còn thiếu hồ sơ`;
    description = `Cần kiểm tra ${item.missingRequiredCount} tài liệu bắt buộc trước khi chuyển trạm.`;
  } else if (item.status === 'TECHNICAL_REVIEW') {
    kind = 'PENDING_REVIEW';
    title = `${item.dossierCode} cần soát xét kỹ thuật`;
    description = 'Mở bảng kiểm trực quan để kiểm tra tính đầy đủ và nhất quán.';
  } else if (item.status === 'WAITING_APPROVAL') {
    kind = 'PENDING_APPROVAL';
    title = `${item.dossierCode} đang chờ phê duyệt`;
    description = 'Kiểm tra bằng chứng hồ sơ trước khi người có thẩm quyền quyết định.';
  } else if (item.waitingDays >= 5) {
    kind = 'STALLED';
    title = `${item.dossierCode} chưa thay đổi ${item.waitingDays} ngày`;
    description = 'Nên xác định điểm đang chờ hoặc cập nhật bước xử lý tiếp theo.';
  } else if (item.priority === 'DUE_SOON') {
    kind = 'DUE_SOON';
    title = `${item.dossierCode} sắp đến hạn`;
    description = `Deadline của hồ sơ là ${item.targetDate || 'chưa cập nhật'}.`;
  }
  if (!kind) return undefined;
  return {
    id: `recommendation:${kind}:${item.dossierId}`,
    kind,
    title,
    description,
    priority: item.priority,
    dossierId: item.dossierId,
    dossierCode: item.dossierCode,
    reasons: item.priorityReasons,
    source: [`certificationDossiers:${item.dossierId}`, 'pcnWorkQueue', 'pcnDossierCompleteness'],
  };
}

function buildWorkload(users: PcnUserAccount[], rows: PcnAgentWorkItem[]): PcnAgentWorkloadRow[] {
  const byUser = new Map<string, PcnAgentWorkItem[]>();
  for (const row of rows) {
    const usernames = new Set([row.ownerUsername, row.assigneeUsername].filter(Boolean).map(normalizeUsername));
    for (const username of usernames) {
      const items = byUser.get(username) || [];
      items.push(row);
      byUser.set(username, items);
    }
  }
  const activeUsers = users.filter((user) => user.active !== false);
  const counts = activeUsers.map((user) => byUser.get(normalizeUsername(user.username))?.length || 0);
  const average = counts.length > 0 ? counts.reduce((total, value) => total + value, 0) / counts.length : 0;
  return activeUsers.map((user, index): PcnAgentWorkloadRow => {
    const items = byUser.get(normalizeUsername(user.username)) || [];
    const overdueCount = items.filter((item) => item.priority === 'OVERDUE').length;
    const dueSoonCount = items.filter((item) => item.priority === 'DUE_SOON').length;
    return {
      username: user.username,
      name: user.name,
      departmentRoleCode: user.departmentRoleCode,
      fieldCodes: [...(user.fieldCodes || [])],
      assignable: user.systemRole !== 'viewer' && user.role !== 'viewer',
      active: user.active !== false,
      dossierCount: counts[index],
      overdueCount,
      dueSoonCount,
      risk: (counts[index] >= 8 || (average > 0 && counts[index] > average * 1.5) || overdueCount >= 2) ? 'HIGH' : 'NORMAL',
    };
  }).sort((left, right) => right.dossierCount - left.dossierCount || left.name.localeCompare(right.name, 'vi'));
}

function getQuickActions(context: PcnAgentUserContext) {
  const actions = [
    { id: 'my-work', label: 'Việc của tôi', description: 'Các hồ sơ và công việc được giao', capability: 'VIEW_MY_WORK' as const, query: 'Hôm nay tôi cần làm gì?' },
    { id: 'overdue', label: 'Việc quá hạn', description: 'Hồ sơ cần ưu tiên xử lý', capability: 'VIEW_UPCOMING_DEADLINES' as const, query: 'Hồ sơ nào của tôi đang bị chậm?' },
    { id: 'missing', label: 'Hồ sơ thiếu dữ liệu', description: 'Kiểm tra checklist còn thiếu', capability: 'CHECK_MISSING_DOCUMENTS' as const, query: 'Hồ sơ của tôi còn thiếu gì?' },
    { id: 'deadlines', label: 'Deadline sắp tới', description: 'Hạn xử lý trong 3 ngày', capability: 'VIEW_UPCOMING_DEADLINES' as const, query: 'Tôi còn deadline nào trong tuần này?' },
    { id: 'review', label: 'Hồ sơ cần review', description: 'Hồ sơ đang chờ soát xét', capability: 'VIEW_PENDING_REVIEWS' as const, query: 'Hồ sơ nào đang chờ review?' },
    { id: 'pending-results', label: 'Chờ kết quả KQTN', description: 'Hồ sơ đang chờ phòng thử nghiệm', capability: 'MONITOR_TEST_RESULTS' as const, query: 'Hồ sơ nào đang chờ kết quả thử nghiệm?' },
    { id: 'department', label: 'Tình hình toàn phòng', description: 'Backlog và workload nhân sự', capability: 'VIEW_DEPARTMENT_WORK' as const, query: 'Hôm nay phòng có vấn đề gì cần xử lý?' },
    { id: 'unassigned', label: 'Hồ sơ chưa phân công', description: 'Các hồ sơ cần điều phối', capability: 'VIEW_UNASSIGNED_RECORDS' as const, query: 'Hồ sơ nào chưa được phân công?' },
    { id: 'assignment-proposal', label: 'Đề xuất phân công', description: 'Gợi ý người nhận hồ sơ theo workload', capability: 'PROPOSE_ASSIGNMENT' as const, query: 'Hồ sơ mới nên giao cho ai?' },
  ];
  return actions.filter((action) => context.capabilities.includes(action.capability));
}

function buildBriefing(
  user: PcnUserAccount,
  metrics: PcnAgentMetrics,
  work: PcnAgentWorkItem[],
  deadlines: PcnAgentDeadline[],
  departmentWork?: PcnAgentWorkItem[],
): string {
  const top = (departmentWork || work).slice(0, 3);
  const lines = [`Chào ${user.name}. Hôm nay bạn có ${metrics.today} việc cần xử lý.`];
  if (departmentWork) {
    lines.push(`Toàn phòng hiện có ${departmentWork.length} hồ sơ cần theo dõi.`);
    const departmentOverdue = departmentWork.filter((item) => item.priority === 'OVERDUE').length;
    if (departmentOverdue > 0) lines.push(`Toàn phòng có ${departmentOverdue} hồ sơ quá hạn cần điều phối.`);
  }
  if (metrics.overdue > 0) lines.push(`Có ${metrics.overdue} việc quá hạn cần ưu tiên.`);
  if (metrics.overdueTasks > 0) lines.push(`Trong đó có ${metrics.overdueTasks} task quá hạn.`);
  if (metrics.openTasks > 0) lines.push(`Bạn còn ${metrics.openTasks} task đang mở.`);
  if (metrics.upcomingDeadlines > 0) lines.push(`Có ${metrics.upcomingDeadlines} deadline trong 3 ngày tới.`);
  if (top.length > 0) {
    lines.push('Ưu tiên:');
    top.forEach((item, index) => lines.push(`${index + 1}. ${item.dossierCode} — ${item.priorityReasons[0]}`));
  }
  if (deadlines.length === 0 && top.length === 0 && metrics.openTasks === 0) lines.push('Hiện chưa có hồ sơ hoặc deadline được giao trực tiếp.');
  return lines.join('\n');
}

export function buildPcnAgentWorkspace(snapshot: PcnAgentSnapshot): PcnAgentWorkspace {
  const user = snapshot.user;
  const asOf = snapshot.now || new Date().toISOString();
  const now = validTimestamp(asOf) ?? Date.now();
  const context = buildPcnAgentUserContext(user);
  const scopedDossiers = snapshot.dossiers.filter((dossier) => hasFieldScope(dossier, user));
  const scopedDossierIds = new Set(scopedDossiers.map((dossier) => dossier.id));
  const scopedProposals = snapshot.proposals.filter((proposal) => scopedDossierIds.has(proposal.dossierId));
  const rows = buildPcnWorkQueueRows({
    dossiers: scopedDossiers,
    proposals: scopedProposals,
    currentUsername: user.username,
    now: asOf,
    documentRequirements: snapshot.documentRequirements,
    dossierDocuments: snapshot.dossierDocuments,
  });
  const dossiersById = new Map(scopedDossiers.map((dossier) => [dossier.id, dossier]));
  const approvalDossierIds = new Set(scopedDossiers.filter((dossier) => isApprovalAssignment(dossier.id, user, snapshot)).map((dossier) => dossier.id));
  const workItems = rows.map((row) => {
    const dossier = dossiersById.get(row.dossierId);
    return dossier ? toAgentWorkItem(row, dossier, user, approvalDossierIds, now) : undefined;
  }).filter((item): item is PcnAgentWorkItem => Boolean(item));
  const departmentAccess = context.capabilities.includes('VIEW_DEPARTMENT_WORK');
  const allWork = departmentAccess ? workItems : undefined;
  const myWork = workItems.filter((item) => item.relation !== 'UNASSIGNED');
  const scopedWork = departmentAccess ? workItems : myWork;
  const upcomingDeadlines = buildDeadlines(scopedWork, snapshot.labRequests, now);
  const workDossierIds = new Set(scopedWork.map((item) => item.dossierId));
  const testResults: PcnAgentTestResult[] = (snapshot.returnedResults || [])
    .filter((result) => workDossierIds.has(result.dossierId))
    .map((result) => ({
      id: result.id,
      dossierId: result.dossierId,
      labRequestId: result.labRequestId,
      round: result.round,
      outcome: result.outcome,
      receivedAt: result.receivedAt,
      ...(result.reportNumber ? { reportNumber: result.reportNumber } : {}),
    }));
  const workItemsByDossierId = new Map(workItems.map((item) => [item.dossierId, item]));
  const newResultRecommendations: PcnAgentRecommendation[] = testResults.flatMap((result) => {
    const ageDays = calendarAgeDays(result.receivedAt, now);
    const item = workItemsByDossierId.get(result.dossierId);
    if (!item || ageDays === undefined || ageDays < 0 || ageDays > 3) return [];
    const outcomeLabel = result.outcome === 'PASS' ? 'Đạt' : result.outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ kết luận';
    return [{
      id: `recommendation:NEW_RESULT:${result.id}`,
      kind: 'NEW_RESULT',
      title: `${item.dossierCode} có KQTN mới`,
      description: `KQTN vòng ${result.round} (${outcomeLabel}) vừa được trả ${ageDays === 0 ? 'hôm nay' : `${ageDays} ngày trước`}; cần kiểm tra và cập nhật bước tiếp theo.`,
      priority: 'DUE_SOON',
      dossierId: item.dossierId,
      dossierCode: item.dossierCode,
      reasons: ['Kết quả thử nghiệm mới trong 3 ngày lịch Việt Nam'],
      source: [`returnedResults:${result.id}`, `certificationDossiers:${item.dossierId}`],
    }];
  });
  const newDocumentRecommendations: PcnAgentRecommendation[] = (snapshot.dossierDocuments || []).flatMap((document) => {
    const item = workItemsByDossierId.get(document.dossierId);
    const currentVersion = document.versions.find((version) => version.assetId === document.currentVersionId)
      || [...document.versions].sort((left, right) => String(right.uploadedAt || '').localeCompare(String(left.uploadedAt || '')))[0];
    const ageDays = calendarAgeDays(currentVersion?.uploadedAt, now);
    if (!item || document.status !== 'PRESENT' || !currentVersion || ageDays === undefined || ageDays < 0 || ageDays > 3) return [];
    const requirement = snapshot.documentRequirements.find((candidate) => candidate.id === document.requirementId);
    const label = requirement?.name || 'Tài liệu checklist';
    return [{
      id: `recommendation:NEW_DOCUMENT:${document.id}:${currentVersion.assetId}`,
      kind: 'NEW_DOCUMENT',
      title: `${item.dossierCode} có tài liệu mới cập nhật`,
      description: `${label} được cập nhật ${ageDays === 0 ? 'hôm nay' : `${ageDays} ngày trước`}; nên kiểm tra lại checklist và bước xử lý.`,
      priority: 'DUE_SOON',
      dossierId: item.dossierId,
      dossierCode: item.dossierCode,
      reasons: ['Tài liệu checklist mới cập nhật trong 3 ngày lịch Việt Nam'],
      source: [`dossierDocuments:${document.id}`, `fileAsset:${currentVersion.assetId}`],
    }];
  });
  const labRequests: PcnAgentLabRequest[] = (snapshot.labRequests || [])
    .filter((request) => workDossierIds.has(request.dossierId))
    .map((request) => ({
      id: request.id,
      dossierId: request.dossierId,
      pycNumber: request.pycNumber,
      laboratoryName: request.laboratoryName,
      status: request.status,
      ...(request.targetDate ? { targetDate: request.targetDate } : {}),
      ...(request.requestedAt ? { requestedAt: request.requestedAt } : {}),
    }));
  const proposalsByDossierId = new Map(scopedProposals.map((proposal) => [proposal.dossierId, proposal]));
  const customers: PcnAgentCustomerInfo[] = scopedWork.flatMap((item) => {
    const dossier = dossiersById.get(item.dossierId);
    const proposal = dossier ? proposalsByDossierId.get(dossier.id) : undefined;
    const customer = dossier?.customerSnapshot || proposal?.customerSnapshot;
    if (!customer?.name) return [];
    return [{
      dossierId: item.dossierId,
      dossierCode: item.dossierCode,
      name: customer.name,
      ...(customer.address ? { address: customer.address } : {}),
      ...(customer.taxId ? { taxId: customer.taxId } : {}),
      ...(customer.contactPerson ? { contactPerson: customer.contactPerson } : {}),
      ...(customer.phone ? { phone: customer.phone } : {}),
      ...(customer.email ? { email: customer.email } : {}),
    }];
  });
  const tasks = (snapshot.tasks || []).filter((task) => sameUser(task.assigneeUsername, user.username) && task.status === 'OPEN');
  const taskDate = (task: PcnAgentTask): string | undefined => dateOnly(task.dueAt);
  const today = calendarDate(now);
  const overdueTasks = tasks.filter((task) => isPcnAgentTaskOverdue(task, now));
  const departmentWorkload = departmentAccess ? buildWorkload(snapshot.users, workItems) : undefined;
  const openWork = myWork.filter((item) => !TERMINAL_STATUSES.has(item.status));
  const metrics: PcnAgentMetrics = {
    today: myWork.filter((item) => dateOnly(item.targetDate) === today).length
      + tasks.filter((task) => taskDate(task) === today).length,
    overdue: myWork.filter((item) => item.priority === 'OVERDUE').length + overdueTasks.length,
    openTasks: tasks.length,
    overdueTasks: overdueTasks.length,
    activeDossiers: openWork.length,
    waitingCustomer: myWork.filter((item) => WAITING_CUSTOMER_STATUSES.has(item.status)).length,
    upcomingDeadlines: upcomingDeadlines.filter((item) => !item.overdue && item.daysRemaining <= 3).length,
  };
  const dossierRecommendations = scopedWork
    .map(recommendationFor)
    .filter((item): item is PcnAgentRecommendation => Boolean(item));
  const taskRecommendations: PcnAgentRecommendation[] = overdueTasks.map((task) => ({
    id: `recommendation:TASK_OVERDUE:${task.id}`,
    kind: 'TASK_OVERDUE',
    title: `Task ${task.title} đã quá hạn`,
    description: `${task.dossierCode ? `Hồ sơ ${task.dossierCode}. ` : ''}Cần xử lý hoặc cập nhật lại hạn task.`,
    priority: 'OVERDUE',
    ...(task.dossierId ? { dossierId: task.dossierId } : {}),
    ...(task.dossierCode ? { dossierCode: task.dossierCode } : {}),
    reasons: ['Task quá hạn'],
    source: [`pcnTasks:${task.id}`],
  }));
  const unassignedRecommendations: PcnAgentRecommendation[] = departmentAccess
    ? workItems.filter((item) => item.relation === 'UNASSIGNED').map((item) => ({
      id: `recommendation:UNASSIGNED:${item.dossierId}`,
      kind: 'UNASSIGNED',
      title: `${item.dossierCode} chưa được phân công`,
      description: `Cần chọn chủ hồ sơ phù hợp trước khi xử lý tại trạm ${item.stationTitle.toLowerCase()}.`,
      priority: item.priority,
      dossierId: item.dossierId,
      dossierCode: item.dossierCode,
      reasons: ['Chưa có người phụ trách trực tiếp', ...item.priorityReasons],
      source: [`certificationDossiers:${item.dossierId}`, 'pcnDossierAssignment'],
    }))
    : [];
  const workloadRecommendations: PcnAgentRecommendation[] = (departmentWorkload || [])
    .filter((row) => row.risk === 'HIGH')
    .map((row) => ({
      id: `recommendation:WORKLOAD_RISK:${row.username}`,
      kind: 'WORKLOAD_RISK',
      title: `${row.name} đang có workload cao`,
      description: `${row.dossierCount} hồ sơ · ${row.overdueCount} quá hạn · ${row.dueSoonCount} deadline gần.`,
      priority: row.overdueCount > 0 ? 'OVERDUE' : row.dueSoonCount > 0 ? 'DUE_SOON' : 'NORMAL',
      reasons: ['Workload vượt ngưỡng điều phối'],
      source: [`systemUsers:${row.username}`, 'departmentWorkload'],
    }));
  const recommendationPriority: Record<PcnWorkQueueRow['priority'], number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    NORMAL: 2,
  };
  const recommendations = [...dossierRecommendations, ...newResultRecommendations, ...newDocumentRecommendations, ...taskRecommendations, ...unassignedRecommendations, ...workloadRecommendations]
    .sort((left, right) => recommendationPriority[left.priority] - recommendationPriority[right.priority] || left.title.localeCompare(right.title, 'vi'))
    .slice(0, 12);
  const activity: PcnAgentActivity[] = [
    {
      id: 'context',
      status: 'DONE',
      label: 'Đã dựng context công việc',
      detail: `${context.name} · ${context.departmentRoleCode}`,
    },
    {
      id: 'work-scope',
      status: 'DONE',
      label: `Đã nạp ${scopedWork.length} hồ sơ trong phạm vi`,
      detail: departmentAccess ? 'Bao gồm projection toàn phòng theo quyền hiện tại.' : 'Chỉ gồm hồ sơ được giao hoặc liên quan trực tiếp.',
    },
    {
      id: 'deadlines',
      status: 'DONE',
      label: 'Đã kiểm tra deadline',
      detail: `${upcomingDeadlines.length} mốc deadline trong dữ liệu hiện tại.`,
    },
    {
      id: 'priorities',
      status: 'DONE',
      label: 'Đã tính mức độ ưu tiên',
      detail: `${recommendations.length} đề xuất từ rule deadline, trạng thái, checklist, KQTN/tài liệu mới, task, phân công và workload.`,
    },
  ];
  return {
    user: context,
    asOf,
    activity,
    briefing: buildBriefing(user, metrics, myWork, upcomingDeadlines, departmentAccess ? workItems : undefined),
    metrics,
    myWork,
    upcomingDeadlines,
    testResults,
    labRequests,
    customers,
    recommendations,
    quickActions: getQuickActions(context),
    ...(allWork ? { allWork } : {}),
    ...(departmentWorkload ? { departmentWorkload } : {}),
    tasks,
  };
}
