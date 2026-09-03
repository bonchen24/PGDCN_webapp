import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, PcnDocumentRequirement, PcnDossierDocument } from '../types.ts';
import {
  PCN_PIPELINE_STATIONS,
  buildPcnDossierCompleteness,
  buildPcnDossierStationChecklist,
  filterPcnDossiersByField,
  groupPcnPipelineRequirementsForDisplay,
  getPcnPipelineStationCatalog,
  getPcnPipelineStation,
  getPcnPipelineStationRequirements,
  getPcnDossierOwnerAssignmentDenial,
} from '../utils/pcnDossierPipeline.ts';
import { getPcnDossierStationGenerationKind, getPcnDossierStationTab } from '../utils/pcnDossierNavigation.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS } from '../utils/pcnDossierDocuments.ts';

const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pipelineBoard = fs.readFileSync(new URL('../components/PcnPipelineBoard.tsx', import.meta.url), 'utf8');
const dossierDetail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const design = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

const dossier: CertificationDossier = {
  id: 'dossier-pipeline', dossierCode: 'HS-PIPELINE', proposalId: 'proposal-pipeline', ownerUsername: 'owner-qc4',
  fieldCodes: ['QC4'], method: 'METHOD_1', status: 'AWAITING_DOCUMENTS', labRequestIds: [], returnedResultIds: [],
};

const proposal: CertificationProposal = {
  id: 'proposal-pipeline', proposalCode: 'DN-PIPELINE', channel: 'DIRECT', status: 'CONVERTED',
  customerSnapshot: { name: 'Công ty mẫu', address: 'Hà Nội' }, productName: 'Thiết bị mẫu', quantity: 1,
  fieldCodes: ['QC4'], receivedAt: '2026-08-29T00:00:00.000Z',
};

const requirements: PcnDocumentRequirement[] = [
  { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  { id: 'QC4-COMMERCIAL', fieldCode: 'QC4', code: 'COMMERCIAL', name: 'Báo giá', stages: ['INTAKE'], required: true, active: true, sortOrder: 2 },
  { id: 'QC4-LAB', fieldCode: 'QC4', code: 'LAB_REQUEST', name: 'PYC', stages: ['LAB_ROUTING'], required: true, active: true, sortOrder: 3 },
];

const documents: PcnDossierDocument[] = [
  { id: 'doc-proposal', dossierId: dossier.id, requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4', currentVersionId: 'asset-proposal', versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.docx', uploadedAt: '2026-08-29T00:00:00.000Z' }], status: 'PRESENT' },
  { id: 'doc-commercial', dossierId: dossier.id, requirementId: 'QC4-COMMERCIAL', fieldCode: 'QC4', versions: [], status: 'MISSING' },
];

test('pipeline maps every active dossier status to a visible station', () => {
  assert.equal(PCN_PIPELINE_STATIONS.length, 11);
  assert.equal(getPcnPipelineStation('INTAKE_REVIEW').key, 'INTAKE');
  assert.equal(getPcnPipelineStation('AWAITING_DOCUMENTS').key, 'DOCUMENTS');
  assert.equal(getPcnPipelineStation('FIELD_EVALUATION').key, 'EVALUATION');
  assert.equal(getPcnPipelineStation('TECHNICAL_REVIEW').key, 'TECHNICAL_REVIEW');
  assert.equal(getPcnPipelineStation('ARCHIVED').key, 'DELIVERY_ARCHIVE');
  assert.equal(getPcnPipelineStation('ON_HOLD').key, 'EXCEPTIONS');
});

test('station requirements follow the dossier field and current station stage', () => {
  assert.deepEqual(getPcnPipelineStationRequirements('AWAITING_DOCUMENTS', dossier.fieldCodes, requirements).map((item) => item.id), ['QC4-PROPOSAL', 'QC4-COMMERCIAL']);
  assert.deepEqual(getPcnPipelineStationRequirements('SENT_TO_LAB', dossier.fieldCodes, requirements).map((item) => item.id), ['QC4-LAB']);
});

test('operational form requirements are routed to their exact pipeline stations', () => {
  assert.deepEqual(getPcnPipelineStationRequirements('ASSIGNED', ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS).map((item) => item.code), ['ASSIGNMENT_FORM']);
  assert.deepEqual(getPcnPipelineStationRequirements('FIELD_EVALUATION', ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS).map((item) => item.code), ['EVALUATION_PLAN', 'FIELD_INSPECTION']);
  assert.deepEqual(getPcnPipelineStationRequirements('AWAITING_SAMPLING', ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS).map((item) => item.code), ['LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER']);
  assert.deepEqual(getPcnPipelineStationRequirements('TECHNICAL_REVIEW', ['QC4'], DEFAULT_PCN_DOCUMENT_REQUIREMENTS).map((item) => item.code), ['TEST_REPORT', 'CERTIFICATION_RESULT']);
});

test('station catalog follows only active requirements in the station stages', () => {
  const catalog = getPcnPipelineStationCatalog(PCN_PIPELINE_STATIONS.find((station) => station.key === 'DOCUMENTS')!, ['QC4'], [
    ...requirements,
    { id: 'QC4-RETIRED', fieldCode: 'QC4', code: 'RETIRED', name: 'Đã ngừng dùng', stages: ['INTAKE'], required: true, active: false, sortOrder: 0 },
    { id: 'QC9-OTHER', fieldCode: 'QC9', code: 'OTHER', name: 'Không thuộc QC4', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  ]);
  assert.deepEqual(catalog.map((item) => item.id), ['QC4-PROPOSAL', 'QC4-COMMERCIAL']);
});

test('Kanban requirement display groups the same document type across fields without changing IDs', () => {
  const grouped = groupPcnPipelineRequirementsForDisplay([
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị chứng nhận', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'QC9-PROPOSAL', fieldCode: 'QC9', code: 'PROPOSAL', name: 'Đề nghị chứng nhận', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'QC9-COMMERCIAL', fieldCode: 'QC9', code: 'COMMERCIAL', name: 'Báo giá / hợp đồng', stages: ['INTAKE'], required: false, active: true, sortOrder: 2 },
  ]);

  assert.deepEqual(grouped.map(({ code, fieldCodes, requirementIds, requiredForAll, requiredForSome }) => ({ code, fieldCodes, requirementIds, requiredForAll, requiredForSome })), [
    { code: 'PROPOSAL', fieldCodes: ['QC4', 'QC9'], requirementIds: ['QC4-PROPOSAL', 'QC9-PROPOSAL'], requiredForAll: true, requiredForSome: true },
    { code: 'COMMERCIAL', fieldCodes: ['QC9'], requirementIds: ['QC9-COMMERCIAL'], requiredForAll: false, requiredForSome: false },
  ]);

  const reversed = groupPcnPipelineRequirementsForDisplay([
    { id: 'QC9-PROPOSAL', fieldCode: 'QC9', code: 'PROPOSAL', name: 'Đề nghị chứng nhận', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị chứng nhận', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  ]);
  assert.deepEqual(reversed[0]?.fieldCodes, ['QC4', 'QC9']);
});

test('station checklist exposes required and conditional documents using only valid current versions', () => {
  const stationRequirements: PcnDocumentRequirement[] = [
    ...requirements,
    { id: 'QC4-OPTIONAL', fieldCode: 'QC4', code: 'OPTIONAL', name: 'Tài liệu điều kiện', stages: ['INTAKE'], required: false, active: true, sortOrder: 4 },
    { id: 'QC4-RETIRED', fieldCode: 'QC4', code: 'RETIRED', name: 'Tài liệu đã ngừng dùng', stages: ['INTAKE'], required: true, active: false, sortOrder: 5 },
  ];
  const result = buildPcnDossierStationChecklist({
    dossierId: dossier.id,
    status: 'AWAITING_DOCUMENTS',
    fieldCodes: dossier.fieldCodes,
    requirements: stationRequirements,
    documents: [
      ...documents,
      { id: 'doc-optional', dossierId: dossier.id, requirementId: 'QC4-OPTIONAL', fieldCode: 'QC4', currentVersionId: 'asset-old', versions: [{ assetId: 'asset-current', fileName: 'optional.pdf', uploadedAt: '2026-08-29T00:00:00.000Z' }], status: 'PRESENT' },
    ],
  });

  assert.deepEqual(result.items.map((item) => item.requirement.id), ['QC4-PROPOSAL', 'QC4-COMMERCIAL', 'QC4-OPTIONAL']);
  assert.equal(result.total, 3);
  assert.equal(result.present, 1);
  assert.equal(result.requiredTotal, 2);
  assert.equal(result.requiredPresent, 1);
  assert.equal(result.missing, 2);
});

test('station checklist follows the selected graphic workflow node, not only the dossier status', () => {
  const result = buildPcnDossierStationChecklist({
    dossierId: dossier.id,
    status: 'AWAITING_DOCUMENTS',
    fieldCodes: dossier.fieldCodes,
    requirements: DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
    documents: [],
    stationKey: 'SAMPLING_LAB',
  });

  assert.equal(result.station.key, 'SAMPLING_LAB');
  assert.deepEqual(result.items.map((item) => item.requirement.code), ['LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER']);
});

test('completeness reports required documents, core fields, owner and missing labels', () => {
  const result = buildPcnDossierCompleteness({ dossier, proposal, requirements, documents });
  assert.equal(result.requiredDocumentTotal, 3);
  assert.equal(result.requiredDocumentPresent, 1);
  assert.equal(result.missingRequirementIds.includes('QC4-COMMERCIAL'), true);
  assert.equal(result.hasOwner, true);
  assert.equal(result.coreFieldTotal, 6);
  assert.equal(result.coreFieldPresent, 6);
  assert.equal(result.score, 60);
  assert.equal(result.stationScore, 50);
  assert.equal(result.missingLabels.includes('Báo giá'), true);
  assert.deepEqual(result.missingRequiredByStage, [
    { stage: 'INTAKE', label: 'Tiếp nhận & đầu vào', labels: ['Báo giá'] },
    { stage: 'LAB_ROUTING', label: 'Lấy mẫu & gửi PTN', labels: ['PYC'] },
  ]);
  assert.equal(result.station.key, 'DOCUMENTS');
});

test('station score is unavailable for an exception station without checklist requirements', () => {
  const result = buildPcnDossierCompleteness({
    dossier: { ...dossier, status: 'ON_HOLD' },
    proposal,
    requirements,
    documents,
  });

  assert.equal(result.station.key, 'EXCEPTIONS');
  assert.equal(result.stationScore, null);
});

test('completeness does not repeat the same missing label across checklist stages', () => {
  const result = buildPcnDossierCompleteness({
    dossier: { ...dossier, status: 'ARCHIVED' },
    proposal,
    requirements: [requirements[1], { ...requirements[1], id: 'QC4-COMMERCIAL-ARCHIVE', stages: ['ARCHIVE'] }],
    documents: [],
  });
  assert.deepEqual(result.missingLabels, ['Báo giá']);
  assert.deepEqual(result.stationMissingLabels, ['Báo giá']);
});

test('completeness only counts requirements for the dossier fields', () => {
  const result = buildPcnDossierCompleteness({
    dossier,
    proposal,
    requirements: [...requirements, { ...requirements[0], id: 'QC9-PROPOSAL', fieldCode: 'QC9' }],
    documents,
  });
  assert.equal(result.requiredDocumentTotal, 3);
  assert.equal(result.requiredDocumentPresent, 1);
  assert.equal(result.missingLabels.includes('Đề nghị'), false);
});

test('owner assignment accepts only active non-viewer users in dossier scope', () => {
  const users = [
    { username: 'owner-qc4', active: true, systemRole: 'staff', fieldCodes: ['QC4'] },
    { username: 'viewer-qc4', active: true, systemRole: 'viewer', fieldCodes: ['QC4'] },
    { username: 'owner-qc9', active: true, systemRole: 'staff', fieldCodes: ['QC9'] },
  ];
  assert.equal(getPcnDossierOwnerAssignmentDenial({ currentUsername: '', nextUsername: 'owner-qc4', dossierFieldCodes: ['QC4'], users }), null);
  assert.match(getPcnDossierOwnerAssignmentDenial({ currentUsername: '', nextUsername: 'viewer-qc4', dossierFieldCodes: ['QC4'], users }) || '', /viewer/i);
  assert.match(getPcnDossierOwnerAssignmentDenial({ currentUsername: '', nextUsername: 'owner-qc9', dossierFieldCodes: ['QC4'], users }) || '', /Lĩnh vực/i);
});

test('PCN workspace exposes one dossier-card surface on the dashboard', () => {
  assert.match(workspace, /PcnPipelineBoard/);
  assert.match(pipelineBoard, /Hồ sơ cần hoàn thiện/);
  assert.doesNotMatch(pipelineBoard, /PcnWorkflowMap/);
  assert.doesNotMatch(pipelineBoard, /buildPcnWorkflowOverview/);
  assert.doesNotMatch(pipelineBoard, /selectedNodeKey/);
  assert.doesNotMatch(pipelineBoard, /onSelectNode/);
  assert.match(pipelineBoard, /buildPcnDossierCompleteness/);
  assert.match(pipelineBoard, /Tài liệu còn thiếu/);
  assert.match(pipelineBoard, /missingRequiredByStage/);
  assert.match(pipelineBoard, /Tài liệu bắt buộc còn thiếu/);
  assert.match(pipelineBoard, /missingCoreLabels/);
  assert.match(pipelineBoard, /Thông tin lõi còn thiếu/);
  assert.match(pipelineBoard, /Chủ hồ sơ/);
  assert.match(pipelineBoard, /getPcnDossierStatusLabel/);
  assert.match(pipelineBoard, /getPcnDossierStatusLabel/);
  assert.match(pipelineBoard, /Tài liệu tại bước/);
  assert.doesNotMatch(pipelineBoard, /PcnHistoricalScopeBadge|historicalImport/);
  assert.doesNotMatch(pipelineBoard, /function StationColumn/);
  assert.doesNotMatch(pipelineBoard, /Mỗi cột là một trạm/);
});

test('PCN workspace passes the active checklist and user snapshot to the dashboard', () => {
  assert.match(workspace, /<PcnDashboard[\s\S]{0,520}documentRequirements=\{pcn\.documentRequirements\}/);
  assert.match(workspace, /<PcnDashboard[\s\S]{0,620}users=\{pcn\.users\}/);
});

test('workflow cards expose the current step action and checklist progress', () => {
  assert.match(pipelineBoard, /station\.actionLabel|currentNode\.actionLabel/);
  assert.match(pipelineBoard, /Tài liệu tại bước|Bước hiện tại/);
  assert.match(pipelineBoard, /completeness\.stationDocumentPresent/);
  assert.match(pipelineBoard, /completeness\.stationDocumentTotal/);
  assert.match(pipelineBoard, /completeness\.stationScore/);
  assert.match(pipelineBoard, /Điểm bước/);
  assert.match(pipelineBoard, /station\.key === 'EXCEPTIONS'|EXCEPTIONS/);
  assert.match(pipelineBoard, /dossier\.exceptionReason/);
  assert.match(pipelineBoard, /Chưa ghi nhận lý do ngoại lệ/);
  assert.match(pipelineBoard, /getPcnDossierStationTab\(station\.key\)/);
});

test('dossier detail exposes the selected station score beside its upload checklist', () => {
  assert.match(dossierDetail, /stationScore/);
  assert.match(dossierDetail, /Điểm bước/);
  assert.match(dossierDetail, /data-testid="pcn-workflow-step-checklist"/);
  assert.match(dossierDetail, /Chi tiết phiên và tải tài liệu/);
  assert.match(dossierDetail, /current \? 'Thay phiên bản' : 'Bổ sung file'/);
  assert.doesNotMatch(dossierDetail, /onUploadDocument\(item\.requirement\.id, file\)/);
});

test('workflow cards expose the existing self-claim action for unassigned dossiers', () => {
  assert.match(pipelineBoard, /onClaimDossier/);
  assert.match(pipelineBoard, /Nhận hồ sơ/);
  assert.match(pipelineBoard, /getPcnOwnerAssignmentAuthorityDenial/);
  assert.match(workspace, /<PcnPipelineBoard[\s\S]{0,900}onClaimDossier=\{onClaimDossier\}/);
});

test('dashboard keeps workflow navigation inside the dossier detail', () => {
  assert.doesNotMatch(pipelineBoard, /PcnWorkflowMap/);
  assert.doesNotMatch(pipelineBoard, /selectedNodeKey/);
  assert.match(dossierDetail, /PcnWorkflowMap/);
  assert.match(dossierDetail, /buildPcnDossierWorkflowMap/);
  assert.doesNotMatch(pipelineBoard, /getPcnPipelineStationCatalog/);
  assert.doesNotMatch(pipelineBoard, /StationColumn/);
  assert.doesNotMatch(pipelineBoard, /Hồ sơ cần làm tại trạm/);
  assert.doesNotMatch(pipelineBoard, /function stationDocumentCatalog/);
});

test('pipeline field filter keeps multi-field dossiers visible in the selected field', () => {
  const multiFieldDossier = { ...dossier, id: 'dossier-qc4-qc9', fieldCodes: ['QC4', 'QC9'] };
  const qc4Dossiers = filterPcnDossiersByField([dossier, multiFieldDossier], 'QC4');
  const qc9Dossiers = filterPcnDossiersByField([dossier, multiFieldDossier], 'QC9');

  assert.deepEqual(qc4Dossiers.map((item) => item.id), ['dossier-pipeline', 'dossier-qc4-qc9']);
  assert.deepEqual(qc9Dossiers.map((item) => item.id), ['dossier-qc4-qc9']);
  assert.deepEqual(filterPcnDossiersByField([dossier, multiFieldDossier]), [dossier, multiFieldDossier]);
});

test('dossier-card surface exposes a field filter and scopes its card list', () => {
  assert.match(pipelineBoard, /Lọc theo Lĩnh vực/);
  assert.match(pipelineBoard, /filterPcnDossiersByField/);
  assert.match(pipelineBoard, /fieldFilter/);
  assert.match(pipelineBoard, /visibleDossiers/);
  assert.match(workspace, /<PcnPipelineBoard[^>]*fields=\{fields\}/);
});

test('Kanban cards use human-readable PCN identity labels', () => {
  assert.match(pipelineBoard, /getPcnUserDisplayName/);
  assert.doesNotMatch(pipelineBoard, /\$\{user\.name\} · \$\{user\.username\}/);
  assert.match(pipelineBoard, /codeReview\.source/);
  assert.match(pipelineBoard, /Mã nguồn PCN/);
  assert.match(pipelineBoard, /Cần đối chiếu mã nguồn/);
});

test('dashboard filters and dossier actions keep touch-friendly hit areas', () => {
  assert.equal((pipelineBoard.match(/min-h-11/g) || []).length >= 2, true);
});

test('workflow node actions open the matching dossier work area', () => {
  assert.equal(getPcnDossierStationTab('INTAKE'), 'overview');
  assert.equal(getPcnDossierStationTab('DOCUMENTS'), 'documents');
  assert.equal(getPcnDossierStationTab('SAMPLING_LAB'), 'lab');
  assert.equal(getPcnDossierStationTab('RESULTS'), 'results');
  assert.equal(getPcnDossierStationTab('TECHNICAL_REVIEW'), 'documents');
  assert.equal(getPcnDossierStationTab('APPROVAL'), 'issuance');
  assert.equal(getPcnDossierStationTab('EXCEPTIONS'), 'documents');
  assert.match(pipelineBoard, /getPcnDossierStationTab/);
  assert.match(dossierDetail, /PcnWorkflowMap/);
  assert.match(dossierDetail, /initialTab/);
  assert.match(dossierDetail, /getPcnDossierStationTab/);
  assert.match(workspace, /selectedDossierTab/);
  assert.match(workspace, /initialTab=\{selectedDossierTab\}/);
});

test('workflow steps belong to one dossier and do not filter the dashboard card list', () => {
  assert.doesNotMatch(pipelineBoard, /selectedNodeKey/);
  assert.doesNotMatch(pipelineBoard, /filterPcnWorkflowDossiers/);
  assert.doesNotMatch(pipelineBoard, /Bấm vào một bước để lọc/);
  assert.match(dossierDetail, /buildPcnDossierWorkflowMap/);
  assert.match(dossierDetail, /onSelectNode/);
});

test('active design keeps workflow steps scoped to one dossier', () => {
  assert.match(design, /Phạm vi của quy trình là \*\*một hồ sơ cụ thể\*\*/);
  assert.match(design, /Dashboard hiển thị danh sách hồ sơ và chỉ dùng các bộ lọc phạm vi nghiệp vụ/);
  assert.match(design, /Graphic workflow của chi tiết hồ sơ hiển thị tên 5 bước/);
  assert.doesNotMatch(design, /lưới card hồ sơ bên dưới được lọc theo trạng thái thật/);
  assert.doesNotMatch(design, /Dashboard PCN ưu tiên \*\*graphic workflow và card hồ sơ\*\*/);
  assert.doesNotMatch(design, /Mỗi nút trong graphic workflow phải hiển thị tên bước, trạng thái tổng hợp, số hồ sơ/);
});

test('dossier detail binds upload controls to the selected workflow node', () => {
  assert.match(dossierDetail, /selectedStationChecklist/);
  assert.match(dossierDetail, /stationKey: selectedWorkflowNodeKey/);
  assert.match(dossierDetail, /const station = getPcnPipelineStationByKey\(selectedWorkflowNodeKey\)/);
  assert.match(dossierDetail, /activeWorkflowNodeKey=\{station\.key\}/);
  assert.match(dossierDetail, /current \? 'Thay phiên bản' : 'Bổ sung file'/);
});

test('station generation action selects the first useful internal form', () => {
  assert.equal(getPcnDossierStationGenerationKind('INTAKE'), 'PROPOSAL_SUMMARY');
  assert.equal(getPcnDossierStationGenerationKind('DOCUMENTS'), 'PROPOSAL_FORM');
  assert.equal(getPcnDossierStationGenerationKind('ASSIGNMENT'), 'ASSIGNMENT_FORM');
  assert.equal(getPcnDossierStationGenerationKind('EVALUATION'), 'EVALUATION_PLAN');
  assert.equal(getPcnDossierStationGenerationKind('TECHNICAL_REVIEW'), 'EVALUATION_REPORT');
  assert.equal(getPcnDossierStationGenerationKind('SAMPLING_LAB', 'AWAITING_SAMPLING'), 'SAMPLE_TAKING');
  assert.equal(getPcnDossierStationGenerationKind('SAMPLING_LAB', 'SENT_TO_LAB'), 'LAB_REQUEST');
  assert.equal(getPcnDossierStationGenerationKind('APPROVAL'), 'DOSSIER_COVER');
  assert.match(dossierDetail, /getPcnDossierStationGenerationKind/);
});

// --- End of pcn-pipeline.test.ts ---
