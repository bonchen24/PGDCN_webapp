import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnDossierNextStatuses } from '../utils/pcnWorkflow.ts';

const detailPath = new URL('../components/PcnDossierDetailView.tsx', import.meta.url);
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const issuanceSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');

test('exposes only valid next states for a PCN dossier', () => {
  assert.deepEqual(getPcnDossierNextStatuses('DRAFT'), ['INTAKE_REVIEW', 'CANCELLED']);
  assert.deepEqual(getPcnDossierNextStatuses('WAITING_APPROVAL'), ['APPROVED', 'REJECTED', 'TECHNICAL_REVIEW']);
  assert.deepEqual(getPcnDossierNextStatuses('ARCHIVED'), []);
});

test('dossier detail keeps the PCN operational tabs and avoids schedule concepts', () => {
  assert.equal(fs.existsSync(detailPath), true);
  const source = fs.readFileSync(detailPath, 'utf8');
  for (const label of ['Tổng quan', 'Tài liệu hồ sơ', 'Mẫu & PYC', 'KQTN', 'Phê duyệt', 'Tệp liên kết trong bộ hồ sơ', 'Lịch sử xử lý']) {
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
  assert.doesNotMatch(storeSource, /fetchCollection<ActivityLog>\('activityLogs'\)/);
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
  assert.match(source, /onOpenStation|onSelectNode/);
  assert.match(source, /getPcnDossierStationTab/);
  assert.match(source, /data-testid="pcn-current-step-missing-summary"/);
  assert.match(source, /stationMissing\.slice\(0, 3\)/);
  assert.match(source, /remainingStationMissing/);
  assert.match(source, /buildPcnDossierStationChecklist/);
  assert.match(source, /stationChecklist/);
  assert.match(source, /Tài liệu tại bước/);
  assert.match(source, /Xem danh sách tài liệu/);
  assert.match(source, /Phương thức chứng nhận/);
  assert.match(source, /value=\{method\}/);
  assert.match(source, /option value="METHOD_1"/);
  assert.match(source, /option value="METHOD_5"/);
  assert.match(source, /option value="METHOD_7"/);
  assert.match(source, /disabled=\{Boolean\(issuance\)\}/);
  assert.match(source, /method,\r?\n/);
  assert.match(source, /Người soát xét kỹ thuật/);
  assert.match(source, /Chủ hồ sơ/);
  assert.match(source, /ownerUsername/);
  assert.match(source, /getPcnOwnerAssignmentAuthorityDenial/);
  assert.match(source, /canManageOwner/);
  assert.match(source, /Nhân viên chỉ có thể tự nhận hồ sơ đang chưa có chủ/);
  assert.match(source, /Hạn xử lý/);
  assert.match(source, /value=\{reviewerUsername\}/);
  assert.match(source, /PgdcnDateInput[^>]*value=\{targetDate\}/);
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
  assert.match(source, /Mở vùng phát hành để/);
  assert.match(source, /'lập bộ trình duyệt'/);
  assert.match(source, /'phê duyệt hồ sơ'/);
  assert.match(source, /'cấp số phát hành'/);
  assert.match(source, /'giao khách hàng'/);
  assert.match(source, /'lưu trữ'/);
});

test('dossier detail uses shared workspace tabs and retains compact business-area navigation', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /Khu vực hồ sơ/);
  assert.match(source, /aria-label="Khu vực hồ sơ"/);
  assert.match(source, /value=\{activeTab\}/);
  assert.match(source, /onChange=\{setActiveTab\}/);
  assert.match(source, /selectableTabs\.filter/);
  assert.match(source, /PgdcnDossierWorkspace/);
  assert.match(source, /activeTab=\{workspaceTab\}/);
  assert.match(source, /onTabChange=\{setWorkspaceTab\}/);
});

test('dossier detail opens the current workflow region and only presents step-five preparation from technical review', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /setActiveTab\(initialTab \|\| getPcnDossierStationTab\(currentStation\.key\)\)/);
  assert.match(issuanceSource, /dossier\.status === 'TECHNICAL_REVIEW'[\s\S]*?issuance\.status === 'RETURNED'/);
  const openHandler = workspaceSource.slice(
    workspaceSource.indexOf('const openDossierAtCurrentStation'),
    workspaceSource.indexOf('const findNotificationDossier'),
  );
  assert.match(openHandler, /router\.push\(`\/pgdcn\/pcn\/dossiers/);
  assert.match(openHandler, /initialTab \? `\?tab=/);
  assert.doesNotMatch(openHandler, /setSelectedDossierTab\(initialTab\)/);
  assert.match(workspaceSource, /<ProposalView[\s\S]*onOpenDossier=\{openDossierAtCurrentStation\}/);
});

test('dossier detail provides a focused workspace and an obvious document supplementation path', () => {
  const source = fs.readFileSync(detailPath, 'utf8');

  assert.match(source, /data-testid="pcn-dossier-focus-shell"/);
  assert.match(source, /aria-label="Không gian làm việc hồ sơ"/);
  assert.match(source, /h-\[100dvh\] min-h-0 w-full flex-col/);
  assert.match(source, /const openDocumentCompletion = \(\) =>/);
  assert.match(source, /Bổ sung tài liệu/);
  assert.match(source, /scrollIntoView\(/);
  assert.match(source, /id=\{`pcn-dossier-requirement-\$\{requirement\.id\}`\}/);
  assert.match(source, /current \? 'Thay phiên bản' : 'Bổ sung file'/);
  assert.match(source, /'Đang khóa'|Chưa đến bước hiện tại/);
});

test('dossier document operations stay in one collapsed advanced detail region after visual inspection', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.match(source, /data-testid="pcn-document-history" data-disclosure="advanced"/);
  assert.match(source, /Chi tiết phiên và tải tài liệu/);
  assert.doesNotMatch(source, /<details open data-testid="pcn-document-history"/);
  assert.match(source, /Lịch sử phiên bản và nút tải · mở khi cần/);
  assert.match(source, /history\.open = true/);
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

test('station checklist stays read-only while the document region owns version uploads', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  const stationChecklistSource = source.slice(source.indexOf('function DossierStationChecklist'), source.indexOf('function DossierWorkflowSummary'));
  assert.match(source, /function DossierStationChecklist\(\{ stationChecklist, users \}/);
  assert.match(source, /current \? 'Thay phiên bản' : 'Bổ sung file'/);
  assert.match(source, /data-testid="pcn-document-history"/);
  assert.doesNotMatch(stationChecklistSource, /type="file"/);
  assert.doesNotMatch(stationChecklistSource, /onUploadDocument\(item\.requirement\.id, file\)/);
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
  assert.match(source, /Mở vùng phê duyệt \/ phát hành/);
  assert.match(source, /station\.key === 'APPROVAL' \|\| station\.key === 'ISSUANCE' \|\| station\.key === 'DELIVERY_ARCHIVE'/);
  assert.match(source, /onOpenApprovalModule=\{\(\) => setActiveTab\('issuance'\)\}/);
});

test('dossier detail does not expose historical-review actions in the active PCN product', () => {
  const source = fs.readFileSync(detailPath, 'utf8');
  assert.doesNotMatch(source, /Thiếu Đề nghị liên kết/);
  assert.doesNotMatch(source, /hasHistoricalReview/);
  assert.doesNotMatch(source, /historicalReview|historicalImport/);
});
