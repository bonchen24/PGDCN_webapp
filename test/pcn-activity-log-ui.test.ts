import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const activitySource = `${fs.readFileSync(new URL('../components/ActivityLogView.tsx', import.meta.url), 'utf8')}
${fs.readFileSync(new URL('../components/PcnUserKpiTable.tsx', import.meta.url), 'utf8')}`;
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN shell exposes the read-only system activity log module', () => {
  assert.match(workspaceSource, /import \{ ActivityLogView \} from ['"]\.\/ActivityLogView['"]/);
  assert.match(workspaceSource, /'activityLogs'/);
  assert.match(workspaceSource, /Nhật ký hệ thống/);
  assert.match(workspaceSource, /activeSection === 'activityLogs'/);
});

test('PCN activity log receives the PCN user directory instead of DDT users', () => {
  assert.match(workspaceSource, /<ActivityLogView currentUser=\{currentUser\} systemUsers=\{pcn\.users\} \/>/);
  assert.match(activitySource, /currentUser\?: UserAccount \| null/);
  assert.match(activitySource, /systemUsers\?: UserAccount\[\]/);
  assert.match(activitySource, /providedSystemUsers/);
});

test('ActivityLogView does not pull the legacy store when callers provide their own context', () => {
  assert.doesNotMatch(activitySource, /import \{ useStore \} from ['"]\.\.\/store['"]/);
  assert.doesNotMatch(activitySource, /const storeState = useStore\(\)/);
  assert.doesNotMatch(activitySource, /user\.id/);
});

test('PCN activity log remains cursor based and non-mutating', () => {
  assert.match(activitySource, /fetchPage/);
  assert.match(activitySource, /fetchSummary/);
  assert.doesNotMatch(activitySource, /deleteActivityLog|deleteDocFromPostgres\(['"]activityLogs['"]\)/);
  assert.match(designSource, /Shell PCN phải có nhánh `Nhật ký hệ thống`/);
  assert.match(designSource, /danh sách người dùng để lọc phải lấy từ `systemUsers` PCN/);
});

test('PCN activity KPI maps PCN entities instead of collapsing all work into other', () => {
  const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /const pcnActivityKpi = DATABASE_PROFILE === ['"]pcn['"]/);
  assert.match(serverSource, /pcnActivityKpi[\s\S]{0,1200}PCN_PROPOSAL/);
  assert.match(serverSource, /pcnActivityKpi[\s\S]{0,1800}PCN_RESULT/);
  assert.match(serverSource, /pcnActivityKpi[\s\S]{0,2400}PCN_LAB_REQUEST/);
  assert.match(serverSource, /pcnActivityKpi[\s\S]{0,3000}PCN_SAMPLE_LOT/);
  assert.match(designSource, /KPI nhật ký phải phân nhóm `PCN_PROPOSAL`/);
});

test('activity actor filter uses only the server-marked room roster and disambiguates duplicate names', () => {
  assert.match(activitySource, /getPcnDepartmentKpiMembers\(systemUsers\)/);
  assert.doesNotMatch(activitySource, /PRESET_ACCOUNTS/);
  assert.match(activitySource, /displayName/);
  assert.match(activitySource, /\$\{name\} \(\$\{username\}\)/);
});

test('KPI distinguishes an empty room, an invalid actor filter and a period with no activity', () => {
  assert.match(activitySource, /Chưa có nhân viên thuộc phòng/);
  assert.match(activitySource, /Không có nhân viên phù hợp với bộ lọc/);
  assert.match(activitySource, /Chưa có hoạt động trong kỳ/);
  assert.match(activitySource, /selectedKpiMemberCount/);
});

test('design contract makes the PCN/PGD KPI roster server-authoritative and fail-closed', () => {
  assert.match(designSource, /KPI.*nhân sự đang hoạt động.*PCN.*PGD/);
  assert.match(designSource, /departmentScopes.*không.*tư cách nhân sự/);
  assert.match(designSource, /username.*khóa định danh.*tên hiển thị không dùng/i);
  assert.match(designSource, /\/api\/activity-logs\/summary.*session.*Route tự truy vấn.*server/);
  assert.match(designSource, /Chưa có nhân viên thuộc phòng/);
});
