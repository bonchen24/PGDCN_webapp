import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnDossierNextStatuses } from '../utils/pcnWorkflow.ts';

const detailPath = new URL('../components/PcnDossierDetailView.tsx', import.meta.url);
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('exposes only valid next states for a PCN dossier', () => {
  assert.deepEqual(getPcnDossierNextStatuses('DRAFT'), ['INTAKE_REVIEW', 'CANCELLED']);
  assert.deepEqual(getPcnDossierNextStatuses('WAITING_APPROVAL'), ['APPROVED', 'REJECTED', 'TECHNICAL_REVIEW']);
  assert.deepEqual(getPcnDossierNextStatuses('ARCHIVED'), []);
});

test('dossier detail keeps the PCN operational tabs and avoids schedule concepts', () => {
  assert.equal(fs.existsSync(detailPath), true);
  const source = fs.readFileSync(detailPath, 'utf8');
  for (const label of ['Tổng quan', 'Đề nghị & đầu vào', 'PYC/Giao nhận', 'KQTN trả về', 'Phê duyệt & Phát hành', 'Tệp đính kèm', 'Lịch sử']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /Lịch ITD|Lịch EMC|auto.?schedule/i);
  assert.match(source, /fileAssetId|fileAssetIds/);
  assert.match(source, /activityActionLabels/);
  assert.match(source, /log\.changes/);
  assert.match(source, /getPcnDossierCustomerSnapshot/);
  assert.match(source, /evaluationAt/);
  assert.match(source, /effectiveAt/);
  assert.match(source, /onUpdateDossier/);
  assert.match(source, /PcnUserAccount/);
  assert.match(source, /users\.filter/);
  assert.doesNotMatch(source, /<input[^>]+evaluatorUsername/);
});

test('PCN store persists dossier status changes without replacing the dossier record', () => {
  assert.match(storeSource, /updateDossier:/);
  assert.match(storeSource, /updatePcnDossier/);
  assert.match(storeSource, /markPcnProposalConverted/);
  assert.match(storeSource, /ensurePcnDossierCustomerSnapshot/);
  assert.match(storeSource, /dossiers\.map/);
  assert.match(workspaceSource, /PcnDossierDetailView/);
  assert.match(storeSource, /activityLogs: ActivityLog\[\]/);
  assert.match(storeSource, /fetchCollection<ActivityLog>\('activityLogs'\)/);
  assert.match(workspaceSource, /activityLogs=\{pcn\.activityLogs\}/);
  assert.match(workspaceSource, /onUpdateDossier=/);
});

test('dossier detail exposes the graphic workflow and controlled reviewer/deadline controls', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /PcnWorkflowMap/);
  assert.match(source, /buildPcnDossierWorkflowMap/);
  assert.match(source, /Bước hiện tại/);
  assert.match(source, /onSelectNode/);
  assert.doesNotMatch(source, /<DossierStationSummary/);
  assert.doesNotMatch(source, /Trạm hiện tại/);
  assert.match(source, /getPcnPipelineStation/);
  assert.match(source, /Việc tiếp theo/);
  assert.match(source, /station\.actionLabel|currentNode\.actionLabel/);
  assert.match(source, /Không áp dụng/);
  assert.match(source, /exceptionReason/);
  assert.match(source, /Lý do ngoại lệ/);
  assert.match(source, /window\.prompt/);
  assert.match(source, /missingRequiredByStage/);
  assert.match(source, /Tài liệu bắt buộc còn thiếu/);
  assert.match(source, /onOpenStation|onSelectNode/);
  assert.match(source, /stationTab/);
  assert.match(source, /Tài liệu còn thiếu/);
  assert.match(source, /buildPcnDossierStationChecklist/);
  assert.match(source, /stationChecklist/);
  assert.match(source, /Tài liệu tại bước/);
  assert.match(source, /Mở checklist/);
  assert.match(source, /Phương thức chứng nhận/);
  assert.match(source, /value=\{method\}/);
  assert.match(source, /option value="METHOD_1"/);
  assert.match(source, /option value="METHOD_5"/);
  assert.match(source, /option value="METHOD_7"/);
  assert.match(source, /disabled=\{Boolean\(issuance\)\}/);
  assert.match(source, /method,\n/);
  assert.match(source, /Người soát xét kỹ thuật/);
  assert.match(source, /Chủ hồ sơ/);
  assert.match(source, /ownerUsername/);
  assert.match(source, /getPcnOwnerAssignmentAuthorityDenial/);
  assert.match(source, /canManageOwner/);
  assert.match(source, /Nhân viên chỉ có thể tự nhận hồ sơ đang chưa có chủ/);
  assert.match(source, /Hạn xử lý/);
  assert.match(source, /value=\{reviewerUsername\}/);
  assert.match(source, /type="date" value=\{targetDate\}/);
  assert.match(source, /const updates: PcnDossierUpdateInput = \{[\s\S]*reviewerUsername[\s\S]*targetDate/);
  assert.match(source, /onUpdateDossier\(updates\)/);
  assert.match(source, /evaluatorOptions\.map/);
  assert.match(source, /user\.fieldCodes\.some/);
});

test('dossier detail routes issued and delivered lifecycle actions to the issuance module', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /getPcnDossierManualNextStatuses/);
  assert.match(source, /requiresIssuanceLifecycleAction/);
  assert.match(source, /issuanceLifecycleActionLabel/);
  assert.match(source, /Mở module phát hành để/);
  assert.match(source, /'lập bộ trình duyệt'/);
  assert.match(source, /'phê duyệt hồ sơ'/);
  assert.match(source, /'cấp số phát hành'/);
  assert.match(source, /'giao khách hàng'/);
  assert.match(source, /'lưu trữ'/);
});

test('dossier detail uses one compact region selector instead of a visible tab strip', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /Khu vực hồ sơ/);
  assert.match(source, /aria-label="Khu vực hồ sơ"/);
  assert.match(source, /value=\{activeTab\}/);
  assert.match(source, /onChange=\{setActiveTab\}/);
  assert.match(source, /tabs\.filter/);
});

test('dossier document operations stay in one collapsed detail region after visual inspection', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /data-testid="pcn-document-history"/);
  assert.match(source, /Chi tiết phiên và tải tài liệu/);
  assert.match(source, /Tài liệu chi tiết thu gọn/);
});

test('dossier detail keeps source-code review visible without mutating the operator value', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /completeness\.codeReview/);
  assert.match(source, /Mã nguồn PCN/);
  assert.match(source, /Mã gốc/);
  assert.match(source, /Mã chuẩn hóa/);
  assert.match(source, /Cần đối chiếu mã nguồn/);
  assert.match(source, /Giữ nguyên mã gốc/);
});

test('station checklist lets operators upload a new version inline while managers stay read-only', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /function DossierStationChecklist\(\{ stationChecklist, canEdit, onUploadDocument, uploadingRequirementId, users \}/);
  assert.match(source, /Tải phiên mới/);
  assert.match(source, /onUploadDocument\(item\.requirement\.id, file\)/);
  assert.match(source, /<DossierStationChecklist[\s\S]*canEdit=\{canEditMilestones\}[\s\S]*onUploadDocument=\{\(requirementId, file\) =>/);
  assert.match(source, /uploadRequirement\(requirement, file\)/);
});

test('station checklist resolves uploader usernames to PCN display names', () => {
  const source = fs.readFileSync(detailPath, 'utf8');

  assert.match(source, /function DossierStationChecklist\([^)]*users/);
  assert.match(source, /Người tải: \{getPcnUserDisplayName\(item\.currentVersion\.uploadedBy, users\)/);
  assert.match(source, /<DossierStationChecklist[\s\S]*users=\{users\}/);
});

test('dossier document list resolves the current uploader to a PCN display name', () => {
  const source = fs.readFileSync(detailPath, 'utf8');

  assert.match(source, /current\.uploadedBy \? ` • Người tải: \$\{getPcnUserDisplayName\(current\.uploadedBy, users\)\}`/);
});

test('approval station exposes a direct shortcut to the real approval module', () => {
  const source = fs.readFileSync(detailPath, 'utf8');

  assert.match(source, /onOpenApprovalModule/);
  assert.match(source, /Mở module phê duyệt/);
  assert.match(source, /station\.key === 'APPROVAL' \|\| station\.key === 'ISSUANCE' \|\| station\.key === 'DELIVERY_ARCHIVE'/);
  assert.match(workspaceSource, /onOpenApprovalModule=\{\(\) => \{[\s\S]*setActiveSection\('issuance'\)[\s\S]*setFocusedDossierId\(selectedDossier\.id\)/);
});

test('historical review makes a missing proposal linkage actionable', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /Thiếu Đề nghị liên kết/);
  assert.match(source, /hasHistoricalReview && !proposal/);
  assert.match(source, /cảnh báo toàn vẹn dữ liệu/);
});
