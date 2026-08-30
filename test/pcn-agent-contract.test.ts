import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('PCN Agent API is session-bound, dedicated and does not reuse the DDT client-context chat contract', () => {
  const server = read('server.ts');
  assert.match(server, /app\.get\('\/api\/pcn\/agent\/workspace'/);
  assert.match(server, /app\.post\('\/api\/pcn\/agent\/chat'/);
  assert.match(server, /app\.post\('\/api\/pcn\/agent\/actions\/:id\/confirm'/);
  assert.match(server, /loadPcnAgentSnapshot\(req\)/);
  assert.match(server, /resolveFreshPcnAgentUser\(req\)/);
  assert.doesNotMatch(server, /agent\/chat[\s\S]{0,1200}x-gemini-api-key/i);
  assert.doesNotMatch(server, /agent\/chat[\s\S]{0,1200}appContext/i);
});

test('Agent conversation restore is a dedicated, user-isolated read boundary', () => {
  const server = read('server.ts');
  const api = read('utils/pcnAgentApi.ts');
  const view = read('components/PcnAgentWorkspaceView.tsx');
  assert.match(server, /app\.get\('\/api\/pcn\/agent\/conversations\/latest'/);
  assert.match(server, /agentConversations[\s\S]{0,900}userUsername/);
  assert.match(server, /agentMessages[\s\S]{0,900}conversationId/);
  assert.match(server, /data->>'createdAt'[\s\S]{0,240}CASE/);
  assert.match(server, /response blocks|blocks/);
  assert.match(api, /fetchLatestPcnAgentConversation/);
  assert.match(view, /fetchLatestPcnAgentConversation/);
  assert.match(view, /setConversationId/);
});

test('PCN proposal management uses one compact card per proposal', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  assert.match(workspace, /proposals: 'Quản lý Đề nghị'/);
  assert.match(workspace, /function ProposalRegisterRow/);
  assert.match(workspace, /grid gap-3 md:grid-cols-2 xl:grid-cols-3/);
  assert.match(workspace, /Mỗi thẻ là một Đề nghị/);
});

test('AI audit is append-only and Agent collections are not exposed through generic PCN CRUD', () => {
  const schema = read('sql/pcn-schema.sql');
  const server = read('server.ts');
  assert.match(schema, /OLD\.collection_name IN \('activityLogs', 'agentAuditLogs'\)/);
  assert.match(schema, /collection_name = 'agentAuditLogs'/);
  assert.match(server, /const PCN_AGENT_SOURCE_COLLECTIONS = \[/);
  assert.match(server, /'pcnTasks'/);
  const genericPcnCollections = server.match(/const PCN_DB_COLLECTIONS = new Set\(\[[\s\S]*?\]\);/)?.[0] || '';
  assert.doesNotMatch(genericPcnCollections, /agentAuditLogs|agentActions|agentMessages/);
});

test('Agent tool and action boundaries keep capability and permission checks separate', () => {
  const capabilities = read('utils/pcnAgentCapabilities.ts');
  const tools = read('utils/pcnAgentTools.ts');
  const actions = read('utils/pcnAgentActions.ts');
  assert.match(capabilities, /getPcnAgentPermissionForCapability/);
  assert.match(capabilities, /hasPcnAgentPermission/);
  assert.match(tools, /requiredPermission/);
  assert.match(tools, /workspace\.user\.permissions/);
  assert.match(actions, /pcn\.agent\.task\.propose/);
  assert.match(actions, /pcn\.agent\.assignment\.propose/);
  assert.match(tools, /get_assignment_candidates/);
  assert.match(actions, /proposePcnAgentAssignment/);
});

test('LLM system prompt preserves Agent action policy and role/permission separation', () => {
  const provider = read('utils/pcnAgentProvider.ts');
  assert.match(provider, /READ/);
  assert.match(provider, /DRAFT\/PROPOSE/);
  assert.match(provider, /EXECUTE_WITH_CONFIRMATION/);
  assert.match(provider, /trách nhiệm.*quyền|quyền.*trách nhiệm/i);
  assert.match(provider, /xác nhận/i);
  assert.match(provider, /prompt injection|dữ liệu không tin cậy/i);
});

test('Agent UI is a first-class Sidebar workspace and not a floating PCN chatbot', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const sidebar = read('components/PcnSidebar.tsx');
  const navigation = read('utils/pcnNavigation.ts');
  const view = read('components/PcnAgentWorkspaceView.tsx');
  assert.match(workspace, /agent: 'AI Trợ lý'/);
  assert.match(navigation, /PCN_PRIMARY_NAVIGATION[\s\S]{0,120}'agent'/);
  assert.match(sidebar, /agent: Bot/);
  assert.match(workspace, /activeSection === 'agent'/);
  assert.match(workspace, /PcnAgentWorkspaceView/);
  assert.match(view, /Công việc ưu tiên/);
  assert.match(view, /AI đề xuất/);
  assert.match(view, /Hỏi AI Trợ lý/);
  assert.match(view, /task_list/);
  assert.match(view, /workspace\.tasks/);
  assert.match(view, /openTasks/);
  assert.match(view, /Hoạt động nghiệp vụ/);
  assert.match(view, /workspace\.activity/);
  assert.match(view, /assigneeWorkload/);
});

test('Agent UI locks proposed actions and renders a resolved status after confirmation', () => {
  const view = read('components/PcnAgentWorkspaceView.tsx');
  assert.match(view, /pendingActionId/);
  assert.match(view, /resolvedActions/);
  assert.match(view, /setPendingActionId\(action\.id\)/);
  assert.match(view, /finally[\s\S]{0,180}setPendingActionId\(null\)/);
  assert.match(view, /disabled=\{pendingActionId !== null\}/);
  assert.match(view, /Đang xác nhận/);
  assert.match(view, /Đang hủy/);
  assert.match(view, /Đã tạo task/);
  assert.match(view, /Đã hủy đề xuất/);
  assert.match(view, /resolvedActions=\{resolvedActions\}/);
});

test('Agent conversation restore reconciles persisted action status before rendering', () => {
  const server = read('server.ts');
  assert.match(server, /collection_name = 'agentActions'/);
  assert.match(server, /getPcnAgentConversationActionIds/);
  assert.match(server, /document_id = ANY/);
  assert.match(server, /hydratePcnAgentConversationBlocks/);
  assert.match(server, /status: actionStatus/);
});
