import { createPcnAgentProvider, type PcnAgentProvider } from './pcnAgentProvider.ts';
import { proposePcnAgentAssignment, proposePcnAgentTask } from './pcnAgentActions.ts';
import { createPcnAgentToolRegistry, type PcnAgentToolName, type PcnAgentToolRegistry } from './pcnAgentTools.ts';
import type { PcnAgentResponseBlock, PcnAgentWorkItem, PcnAgentWorkspace } from './pcnAgentTypes.ts';

export interface PcnAgentChatResult {
  blocks: PcnAgentResponseBlock[];
  toolsUsed: PcnAgentToolName[];
  recordsAccessed: string[];
}

function normalized(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase('vi-VN');
}

function vietnamCalendarDate(value: unknown): string | undefined {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return undefined;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = new Map(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.get('year') || '0000'}-${values.get('month') || '01'}-${values.get('day') || '01'}`;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function parseTaskDueAt(message: string, asOf: string): string | undefined {
  const query = normalized(message);
  const explicit = message.match(/(?:ngày\s+)?(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/i);
  if (explicit) {
    const first = Number(explicit[1]);
    const second = Number(explicit[2]);
    const third = Number(explicit[3]);
    const year = String(explicit[1]).length === 4 ? first : third;
    const month = String(explicit[1]).length === 4 ? second : second;
    const day = String(explicit[1]).length === 4 ? third : first;
    const timestamp = Date.UTC(year, month - 1, day);
    if (year >= 2000 && year <= 2100 && new Date(timestamp).getUTCFullYear() === year && new Date(timestamp).getUTCMonth() === month - 1 && new Date(timestamp).getUTCDate() === day) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  const today = vietnamCalendarDate(asOf);
  if (!today) return undefined;
  if (query.includes('ngày mai')) return addCalendarDays(today, 1);
  if (query.includes('hôm nay')) return today;
  return undefined;
}

function recordList(workspace: PcnAgentWorkspace, title: string, records: PcnAgentWorkItem[]): PcnAgentResponseBlock[] {
  return records.length > 0
    ? [{ type: 'record_list', title, records }]
    : [{ type: 'message', text: 'Không tìm thấy hồ sơ phù hợp trong phạm vi dữ liệu bạn được phép xem.' }];
}

function taskList(title: string, tasks: PcnAgentWorkspace['tasks']): PcnAgentResponseBlock[] {
  return tasks.length > 0
    ? [{ type: 'task_list', title, tasks }]
    : [];
}

function findRecord(workspace: PcnAgentWorkspace, message: string): PcnAgentWorkItem | undefined {
  const query = normalized(message);
  return (workspace.allWork || workspace.myWork).find((record) =>
    [record.dossierCode, record.proposalCode, record.customerName, record.productName].some((value) => {
      const candidate = normalized(value);
      return Boolean(candidate) && query.includes(candidate);
    }),
  );
}

function asToolResult(tool: PcnAgentToolName, result: unknown): { tool: PcnAgentToolName; result: unknown } {
  return { tool, result };
}

function responseTextFallback(message: string, workspace: PcnAgentWorkspace, toolResults: Array<{ tool: string; result: unknown }>): string {
  const query = normalized(message);
  if (query.includes('phòng') || query.includes('quá tải')) {
    return workspace.departmentWorkload
      ? `Tôi đã tổng hợp workload của ${workspace.departmentWorkload.length} nhân sự PCN.`
      : 'Bạn không có quyền xem workload toàn phòng.';
  }
  if (query.includes('hôm nay') || query.includes('việc')) return workspace.briefing;
  if (query.includes('deadline') || query.includes('quá hạn') || query.includes('chậm')) {
    return `Tôi đã kiểm tra ${workspace.upcomingDeadlines.length} deadline và ${workspace.metrics.overdue} việc quá hạn trong phạm vi của bạn.`;
  }
  if (toolResults.length > 0) return `Đã kiểm tra dữ liệu PCN bằng ${toolResults.map((item) => item.tool).join(', ')}.`;
  return 'Tôi có thể hỗ trợ việc được giao, deadline, hồ sơ thiếu dữ liệu, review và bước xử lý tiếp theo.';
}

async function maybeExplain(
  provider: PcnAgentProvider | null,
  message: string,
  workspace: PcnAgentWorkspace,
  toolResults: Array<{ tool: string; result: unknown }>,
  fallback: string,
): Promise<string> {
  if (!provider) return fallback;
  const explanation = await provider.explain({
    message,
    toolResults,
    userContext: {
      id: workspace.user.id,
      username: workspace.user.username,
      name: workspace.user.name,
      department: workspace.user.department,
      position: workspace.user.position,
      systemRole: workspace.user.systemRole,
      departmentRoleCode: workspace.user.departmentRoleCode,
      fieldCodes: workspace.user.fieldCodes,
      permissions: workspace.user.permissions,
      responsibilities: workspace.user.responsibilities,
      capabilities: workspace.user.capabilities,
      current_date: workspace.asOf,
      assigned_work: {
        dossier_count: workspace.myWork.length,
        task_count: workspace.tasks.length,
        overdue_count: workspace.metrics.overdue,
        upcoming_deadline_count: workspace.upcomingDeadlines.length,
      },
    },
  });
  return explanation || fallback;
}

export async function runPcnAgentChat(
  workspace: PcnAgentWorkspace,
  message: string,
  registry: PcnAgentToolRegistry = createPcnAgentToolRegistry(),
  provider: PcnAgentProvider | null = createPcnAgentProvider(),
): Promise<PcnAgentChatResult> {
  const normalizedMessage = normalized(message);
  const toolsUsed: PcnAgentToolName[] = [];
  const toolResults: Array<{ tool: string; result: unknown }> = [];
  const call = (tool: PcnAgentToolName, input: Record<string, unknown> = {}) => {
    const result = registry.execute(tool, workspace, input);
    toolsUsed.push(tool);
    toolResults.push(asToolResult(tool, result));
    return result;
  };

  let blocks: PcnAgentResponseBlock[] = [];
  const target = findRecord(workspace, normalizedMessage);
  const isTaskRequest = normalizedMessage.includes('tạo task') || normalizedMessage.includes('tạo công việc') || normalizedMessage.includes('lập công việc');
  const isAssignmentRequest = normalizedMessage.includes('giao cho ai') || normalizedMessage.includes('nên giao') || normalizedMessage.includes('đề xuất phân công');
  if (isAssignmentRequest) {
    if (!workspace.user.capabilities.includes('PROPOSE_ASSIGNMENT')) {
      blocks = [{ type: 'warning', title: 'Không được phép', text: 'Tài khoản hiện tại không được đề xuất phân công qua AI.' }];
    } else {
      try {
        const unassigned = call('get_unassigned_records') as PcnAgentWorkItem[];
        const record = (target?.relation === 'UNASSIGNED' ? target : unassigned[0]);
        if (!record) {
          blocks = [{ type: 'message', text: 'Hiện không có hồ sơ chưa phân công trong phạm vi được phép xem.' }];
        } else {
          const candidates = call('get_assignment_candidates', { dossierId: record.dossierId }) as Array<{
            username: string;
            name: string;
            fieldCodes: string[];
            dossierCount: number;
            overdueCount: number;
            dueSoonCount: number;
            risk: 'NORMAL' | 'HIGH';
          }>;
          const candidate = candidates[0];
          if (!candidate) {
            blocks = [{ type: 'warning', title: 'Chưa có ứng viên phù hợp', text: `Không tìm thấy nhân sự đang hoạt động thuộc phạm vi ${record.fieldCodes.join(', ') || 'của hồ sơ'} để đề xuất phân công.` }];
          } else {
            const action = proposePcnAgentAssignment({
              actor: {
                username: workspace.user.username,
                name: workspace.user.name,
                role: workspace.user.systemRole,
                systemRole: workspace.user.systemRole,
                departmentRoleCode: workspace.user.departmentRoleCode,
                fieldCodes: workspace.user.fieldCodes as any,
                active: true,
                position: workspace.user.position,
              },
              dossierId: record.dossierId,
              dossierCode: record.dossierCode,
              assigneeUsername: candidate.username,
              assigneeName: candidate.name,
              assigneeWorkload: {
                dossierCount: candidate.dossierCount,
                overdueCount: candidate.overdueCount,
                dueSoonCount: candidate.dueSoonCount,
                risk: candidate.risk,
              },
              fieldCodes: record.fieldCodes,
              description: `Đề xuất giao ${record.dossierCode} cho ${candidate.name}. Ứng viên hiện có ${candidate.dossierCount} hồ sơ, ${candidate.overdueCount} hồ sơ quá hạn và ${candidate.dueSoonCount} deadline gần; phù hợp phạm vi ${record.fieldCodes.join(', ') || 'hồ sơ'}. Chưa thay đổi dữ liệu phân công.`,
            });
            blocks = [
              { type: 'message', text: 'Tôi đã lập đề xuất phân công. Đây chỉ là bản nháp; chưa có thay đổi nào được ghi vào hồ sơ.' },
              ...recordList(workspace, 'Hồ sơ đề xuất điều phối', [record]),
              { type: 'proposed_action', action },
            ];
          }
        }
      } catch (error) {
        blocks = [{ type: 'warning', title: 'Không thể lập đề xuất phân công', text: String((error as any)?.message || error) }];
      }
    }
  } else if (isTaskRequest) {
    if (!workspace.user.capabilities.includes('PROPOSE_TASK')) {
      blocks = [{ type: 'warning', title: 'Không được phép', text: 'Tài khoản hiện tại không được đề xuất task qua AI.' }];
    } else {
      const dueAt = parseTaskDueAt(message, workspace.asOf);
      const action = proposePcnAgentTask({ actor: {
        username: workspace.user.username,
        name: workspace.user.name,
        role: workspace.user.systemRole,
        systemRole: workspace.user.systemRole,
        departmentRoleCode: workspace.user.departmentRoleCode,
        fieldCodes: workspace.user.fieldCodes as any,
        active: true,
        position: workspace.user.position,
      }, dossierId: target?.dossierId, dossierCode: target?.dossierCode, title: target ? `Theo dõi ${target.dossierCode}` : 'Công việc theo dõi hồ sơ', description: dueAt ? `Task được đề xuất từ AI Trợ lý PCN. Hạn đề xuất: ${dueAt}.` : 'Task được đề xuất từ AI Trợ lý PCN.', dueAt });
      blocks = [{ type: 'message', text: 'Tôi đã chuẩn bị đề xuất. Chưa có dữ liệu nào được ghi cho đến khi bạn xác nhận.' }, { type: 'proposed_action', action }];
    }
  } else if (target && (normalizedMessage.includes('pcn-') || normalizedMessage.includes('hồ sơ') || normalizedMessage.includes('phân tích') || normalizedMessage.includes('tóm tắt') || normalizedMessage.includes('thiếu gì') || normalizedMessage.includes('bước tiếp'))) {
    const record = call('get_certification_record', { dossierId: target.dossierId }) as PcnAgentWorkItem | null;
    const workflow = call('get_record_workflow', { dossierId: target.dossierId });
    const isSupplementationDraft = normalizedMessage.includes('soạn') && (normalizedMessage.includes('bổ sung') || normalizedMessage.includes('yêu cầu'));
    const missing = (normalizedMessage.includes('thiếu') || isSupplementationDraft)
      ? call('get_missing_documents', { dossierId: target.dossierId }) as { missing?: string[] } | null
      : null;
    if (normalizedMessage.includes('kết quả') || normalizedMessage.includes('kqtn') || normalizedMessage.includes('thử nghiệm')) call('get_test_results', { dossierId: target.dossierId });
    const customer = isSupplementationDraft
      ? call('get_customer_information', { dossierId: target.dossierId }) as { name?: string } | null
      : null;
    const fallback = `Hồ sơ ${target.dossierCode} đang ở trạm ${target.stationTitle}. ${target.priorityReasons.join('; ')}.`;
    const missingLabels = (missing?.missing || []).filter(Boolean);
    const blocksForRecord: PcnAgentResponseBlock[] = [
      { type: 'message', text: await maybeExplain(provider, message, workspace, toolResults, fallback) },
      ...(record ? [{ type: 'record_list', title: 'Hồ sơ được hỏi', records: [record] } as PcnAgentResponseBlock] : []),
      ...(missingLabels.length > 0 ? [{ type: 'warning', title: 'Tài liệu còn thiếu', text: missingLabels.join('\n') } as PcnAgentResponseBlock] : []),
    ];
    if (isSupplementationDraft) {
      const recipient = customer?.name || 'Quý khách hàng';
      const requestedDocuments = missingLabels.length > 0 ? missingLabels.map((label) => `- ${label}`).join('\n') : '- Chưa xác định được tài liệu thiếu từ checklist hiện tại.';
      blocksForRecord.push({
        type: 'draft',
        title: 'Dự thảo yêu cầu bổ sung tài liệu',
        dossierId: target.dossierId,
        text: `Kính gửi ${recipient},\n\nĐề nghị bổ sung tài liệu cho hồ sơ ${target.dossierCode}:\n${requestedDocuments}\n\nVui lòng gửi lại tài liệu để Phòng Chứng nhận tiếp tục xử lý hồ sơ.`,
      });
    }
    if (workflow) {
      blocksForRecord.push({ type: 'recommendation', title: 'Bước xử lý tiếp theo', recommendations: workspace.recommendations.filter((item) => item.dossierId === target.dossierId) });
    }
    blocks = blocksForRecord;
  } else if (normalizedMessage.includes('quá tải') || normalizedMessage.includes('toàn phòng') || normalizedMessage.includes('tình hình phòng') || normalizedMessage.includes('phòng có vấn đề') || normalizedMessage.includes('backlog phòng')) {
    const workload = call('get_department_workload');
    const fallback = responseTextFallback(message, workspace, toolResults);
    blocks = [
      { type: 'message', text: await maybeExplain(provider, message, workspace, toolResults, fallback) },
      { type: 'chart_data', title: 'Workload nhân sự PCN', rows: (workload as Array<any>).map((item) => ({ name: item.name, hồ_sơ: item.dossierCount, quá_hạn: item.overdueCount, risk: item.risk })) },
    ];
  } else if (normalizedMessage.includes('review') || normalizedMessage.includes('soát xét')) {
    try {
      const records = call('get_pending_reviews') as PcnAgentWorkItem[];
      blocks = [{ type: 'message', text: await maybeExplain(provider, message, workspace, toolResults, `Có ${records.length} hồ sơ đang chờ soát xét.`) }, ...recordList(workspace, 'Hồ sơ chờ review', records)];
    } catch (error) {
      blocks = [{ type: 'warning', title: 'Không thể xem hồ sơ review', text: String((error as any)?.message || error) }];
    }
  } else if (normalizedMessage.includes('kqtn mới') || normalizedMessage.includes('kết quả mới') || normalizedMessage.includes('vừa trả') || normalizedMessage.includes('mới trả')) {
    try {
      const results = call('get_recent_test_results') as PcnAgentWorkspace['testResults'];
      const resultIds = new Set(results.map((result) => result.id));
      const recommendations = workspace.recommendations.filter((item) => item.kind === 'NEW_RESULT' && item.source.some((source) => source.startsWith('returnedResults:') && resultIds.has(source.slice('returnedResults:'.length))));
      const records = (workspace.allWork || workspace.myWork).filter((record) => results.some((result) => result.dossierId === record.dossierId));
      blocks = [{ type: 'message', text: `Có ${results.length} KQTN mới cần kiểm tra trong phạm vi được phép xem.` }, ...(recommendations.length > 0 ? [{ type: 'recommendation', title: 'KQTN mới cần kiểm tra', recommendations }] as PcnAgentResponseBlock[] : []), ...recordList(workspace, 'Hồ sơ có KQTN mới', records)];
    } catch (error) {
      blocks = [{ type: 'warning', title: 'Không thể xem KQTN mới', text: String((error as any)?.message || error) }];
    }
  } else if (normalizedMessage.includes('chờ kết quả') || normalizedMessage.includes('kết quả thử nghiệm') || normalizedMessage.includes('kqtn')) {
    try {
      const records = call('get_pending_test_results') as PcnAgentWorkItem[];
      blocks = [{ type: 'message', text: `Có ${records.length} hồ sơ đang chờ kết quả thử nghiệm.` }, ...recordList(workspace, 'Hồ sơ chờ KQTN', records)];
    } catch (error) {
      blocks = [{ type: 'warning', title: 'Không thể xem hồ sơ chờ KQTN', text: String((error as any)?.message || error) }];
    }
  } else if (normalizedMessage.includes('phê duyệt') || normalizedMessage.includes('đang duyệt')) {
    try {
      const records = call('get_pending_approvals') as PcnAgentWorkItem[];
      blocks = [{ type: 'message', text: await maybeExplain(provider, message, workspace, toolResults, `Có ${records.length} hồ sơ đang chờ phê duyệt.`) }, ...recordList(workspace, 'Hồ sơ chờ phê duyệt', records)];
    } catch (error) {
      blocks = [{ type: 'warning', title: 'Không thể xem hồ sơ phê duyệt', text: String((error as any)?.message || error) }];
    }
  } else if (normalizedMessage.includes('deadline') || normalizedMessage.includes('quá hạn') || normalizedMessage.includes('chậm')) {
    const isOverdueQuery = normalizedMessage.includes('quá hạn') || normalizedMessage.includes('chậm');
    const records = isOverdueQuery
      ? call('get_overdue_work') as PcnAgentWorkItem[]
      : workspace.upcomingDeadlines;
    const tasks = isOverdueQuery
      ? call('get_overdue_tasks') as PcnAgentWorkspace['tasks']
      : [];
    if (isOverdueQuery) {
      blocks = [{ type: 'work_summary', title: 'Tóm tắt công việc', metrics: workspace.metrics }];
      if (records.length > 0) blocks.push(...recordList(workspace, 'Hồ sơ cần ưu tiên', records as PcnAgentWorkItem[]));
      blocks.push(...taskList('Task quá hạn', tasks));
      if (records.length === 0 && tasks.length === 0) blocks.push({ type: 'message', text: 'Không có hồ sơ hoặc task quá hạn trong phạm vi của bạn.' });
    } else {
      if (!toolsUsed.includes('get_upcoming_deadlines')) call('get_upcoming_deadlines');
      blocks = [{ type: 'work_summary', title: 'Tóm tắt deadline', metrics: workspace.metrics }, { type: 'message', text: workspace.upcomingDeadlines.length ? workspace.upcomingDeadlines.map((item) => `${item.dossierCode}: ${item.overdue ? 'quá hạn' : `còn ${item.daysRemaining} ngày`}`).join('\n') : 'Chưa có deadline trong phạm vi của bạn.' }];
    }
  } else if (normalizedMessage.includes('thiếu')) {
    const records = (call('get_my_work') as PcnAgentWorkItem[]).filter((record) => record.missingRequiredCount > 0 || record.missingCoreLabels.length > 0);
    blocks = [{ type: 'message', text: `Tôi tìm thấy ${records.length} hồ sơ còn thiếu dữ liệu bắt buộc.` }, ...recordList(workspace, 'Hồ sơ thiếu dữ liệu', records)];
  } else if (normalizedMessage.includes('tìm') || normalizedMessage.includes('tra cứu') || normalizedMessage.includes('search')) {
    const records = call('search_certification_records', { query: message }) as PcnAgentWorkItem[];
    blocks = [{ type: 'message', text: `Đã tìm thấy ${records.length} hồ sơ trong phạm vi được phép xem.` }, ...recordList(workspace, 'Kết quả tìm hồ sơ', records)];
  } else if (normalizedMessage.includes('chưa phân công') || normalizedMessage.includes('chưa được phân công') || normalizedMessage.includes('chưa giao')) {
    try {
      const records = call('get_unassigned_records') as PcnAgentWorkItem[];
      blocks = [{ type: 'message', text: `Có ${records.length} hồ sơ chưa được phân công.` }, ...recordList(workspace, 'Hồ sơ chưa phân công', records)];
    } catch (error) {
      blocks = [{ type: 'warning', title: 'Không thể xem hồ sơ chưa phân công', text: String((error as any)?.message || error) }];
    }
  } else {
    const records = call('get_my_work') as PcnAgentWorkItem[];
    const tasks = call('get_my_tasks') as PcnAgentWorkspace['tasks'];
    blocks = [{ type: 'work_summary', title: 'Công việc của tôi', metrics: workspace.metrics }, ...recordList(workspace, 'Hồ sơ liên quan', records), ...taskList('Task của tôi', tasks)];
    const fallback = responseTextFallback(message, workspace, toolResults);
    blocks.unshift({ type: 'message', text: await maybeExplain(provider, message, workspace, toolResults, fallback) });
  }

  const recordsAccessed = [...new Set(toolResults.flatMap((entry) => {
    const value: any = entry.result;
    if (Array.isArray(value)) return value.map((item) => String(item?.dossierId || '')).filter(Boolean);
    if (value && typeof value === 'object') return [String(value.dossierId || '')].filter(Boolean);
    return [];
  }))];
  return { blocks, toolsUsed, recordsAccessed };
}
