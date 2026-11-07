import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pcnDialog = read('components/dashboard/create-pcn-proposal-dialog.tsx');
const pgdDialog = read('components/dashboard/create-pgd-request-dialog.tsx');
const pcnWorkspace = read('components/PcnWorkspace.tsx');
const pgdWorkspace = read('components/PgdWorkspace.tsx');
const attachmentTypes = read('utils/pgdcnB1Attachments.ts');
const attachmentPanelPath = new URL('../components/PgdcnB1AttachmentSection.tsx', import.meta.url);
const attachmentPanel = fs.existsSync(attachmentPanelPath) ? fs.readFileSync(attachmentPanelPath, 'utf8') : '';
const pcnUploadRoute = read('app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts');
const pgdUploadRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/route.ts');
const attachmentWorkflow = await import('../utils/pgdcnB1Attachments.ts');
const pcnDossierRequirements = await import('../utils/pcnDossierDocuments.ts');
const pgdDossierRequirements = await import('../utils/pgdDossier.ts');
type SelectedAttachment = import('../utils/pgdcnB1Attachments.ts').PgdcnB1SelectedAttachment;

test('Dashboard creation reuses each domain workspace intake form', () => {
  assert.match(pcnDialog, /PcnProposalView|PcnProposalIntakeForm/);
  assert.match(pcnWorkspace, /export function PcnProposalView|export function PcnProposalIntakeForm/);
  assert.match(pgdDialog, /PgdIntakeForm/);
  assert.match(pgdWorkspace, /export function PgdIntakeForm/);
  assert.match(pgdDialog, /const requestIdToOpen = recoveryRequestId;[\s\S]*setRecoveryRequestId\(undefined\)/);
});

test('both domain intake forms show the optional multi-file B1 attachment section', () => {
  assert.match(pcnWorkspace, /PgdcnB1AttachmentSection/);
  assert.match(pcnWorkspace, /!editingProposal\s*&&\s*<PgdcnB1AttachmentSection/);
  assert.match(pgdWorkspace, /PgdcnB1AttachmentSection/);
  assert.match(attachmentPanel, /Tệp đính kèm \(tùy chọn\)/);
  assert.match(attachmentPanel, /multiple/);
  assert.match(attachmentPanel, /onDrop/);
  for (const label of ['Phiếu / đề nghị', 'Hợp đồng', 'Hóa đơn', 'Vận đơn', 'Tờ khai', 'Tài liệu kỹ thuật', 'Hình ảnh', 'Khác']) {
    assert.ok(attachmentTypes.includes(label), `missing B1 attachment type: ${label}`);
  }
  assert.match(attachmentPanel, /file\.size|byteSize/);
  assert.match(attachmentPanel, /Xóa|Loại bỏ/);
  const fileInputs = attachmentPanel.match(/<input\b(?=[^>]*type=["']file["'])[^>]*>/gi) || [];
  assert.ok(fileInputs.length > 0);
  assert.ok(fileInputs.every((input) => !/\brequired\b|aria-required=["']true/i.test(input)));
});

test('Dashboard and workspace B1 uploads use the private domain APIs, not note text', () => {
  assert.match(pcnWorkspace, /uploadPcnDossierSupplementaryAttachment/);
  assert.match(pgdWorkspace, /saveDossierDocument\(/);
  assert.doesNotMatch(pgdWorkspace, /onFileAccepted=\{\(file\) => update\('note', `Tài liệu nhập nhanh:/);
});

test('supplementary routes make stable attachment retries idempotent', () => {
  assert.match(pcnUploadRoute, /idempotent/i);
  assert.match(pgdUploadRoute, /idempotent/i);
  assert.match(pcnUploadRoute, /supplementaryItemId/);
  assert.match(pgdUploadRoute, /supplementaryStageId/);
});

test('upload retry skips completed files and retries only failed files without re-creating an entity', async () => {
  let attachments: SelectedAttachment[] = [
    { id: 'a', file: { name: 'request.pdf', size: 3 } as File, kind: 'REQUEST' as const, status: 'READY' as const },
    { id: 'b', file: { name: 'contract.pdf', size: 4 } as File, kind: 'CONTRACT' as const, status: 'READY' as const },
    { id: 'c', file: { name: 'photo.jpg', size: 5 } as File, kind: 'IMAGE' as const, status: 'UPLOADED' as const },
  ];
  const calls = new Map<string, number>();
  let failContractOnce = true;
  const update = (id: string, patch: { status: 'READY' | 'UPLOADING' | 'UPLOADED' | 'FAILED'; error?: string }) => {
    attachments = attachments.map((attachment) => attachment.id === id ? { ...attachment, ...patch } : attachment);
  };
  const upload = async (attachment: { id: string }) => {
    calls.set(attachment.id, (calls.get(attachment.id) || 0) + 1);
    if (attachment.id === 'b' && failContractOnce) {
      failContractOnce = false;
      throw new Error('storage unavailable');
    }
  };

  const first = await attachmentWorkflow.uploadPendingPgdcnB1Attachments(attachments, upload, update);
  assert.deepEqual(first, { attempted: 2, failed: 1 });
  assert.equal(attachments.find((item) => item.id === 'a')?.status, 'UPLOADED');
  assert.equal(attachments.find((item) => item.id === 'b')?.status, 'FAILED');

  const retry = await attachmentWorkflow.uploadPendingPgdcnB1Attachments(attachments, upload, update);
  assert.deepEqual(retry, { attempted: 1, failed: 0 });
  assert.deepEqual(Object.fromEntries(calls), { a: 1, b: 2 });
  assert.equal(attachments.find((item) => item.id === 'b')?.status, 'UPLOADED');
});

test('PCN QC4 intake rows follow the selected template requirement IDs', () => {
  const qc4Template = {
    id: 'pcn-qc4-standard-v2',
    code: 'QC-STANDARD',
    name: 'Lưu trình PCN QC4 tiêu chuẩn',
    version: 2,
    status: 'PUBLISHED' as const,
    appliesTo: { fieldCodes: ['QC4'] },
    stages: [],
    requirementDefinitions: [],
    nodes: [
      { id: 'intake', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL', 'QC4-COMMERCIAL'] },
    ],
  };
  const rows = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PCN', fieldCode: 'QC4', template: qc4Template as any });
  assert.deepEqual(rows.map(({ requirementId, displayName }) => [requirementId, displayName]), [
    ['QC4-PROPOSAL', 'Đề nghị / đơn đăng ký'],
    ['QC4-COMMERCIAL', 'Báo giá / hợp đồng'],
  ]);
  assert.equal(rows[0].sourceProvenance, 'TEMPLATE_NODE_CATALOG');
});

test('PCN QC9 intake rows follow the selected template requirement IDs', () => {
  const qc9Template = {
    id: 'pcn-qc9-standard-v2',
    code: 'QC-STANDARD',
    name: 'Lưu trình PCN QC9 tiêu chuẩn',
    version: 2,
    status: 'PUBLISHED' as const,
    appliesTo: { fieldCodes: ['QC9'] },
    stages: [],
    requirementDefinitions: [],
    nodes: [
      { id: 'intake', label: 'Tiếp nhận', requirementIds: ['QC9-PROPOSAL', 'QC9-COMMERCIAL'] },
    ],
  };
  const rows = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PCN', fieldCode: 'QC9', template: qc9Template as any });
  assert.deepEqual(rows.map(({ requirementId, displayName }) => [requirementId, displayName]), [
    ['QC9-PROPOSAL', 'Đề nghị / đơn đăng ký'],
    ['QC9-COMMERCIAL', 'Báo giá / hợp đồng'],
  ]);
});

test('PGD intake requirements are sourced from the selected PGD request node, not the commercial node', () => {
  const pgdTemplate = {
    domain: 'pgd' as const,
    id: 'pgd-standard-v1',
    code: 'PGD-STANDARD',
    name: 'Lưu trình PGD tiêu chuẩn',
    version: 1,
    status: 'PUBLISHED' as const,
    appliesTo: { productGroups: ['STEEL_METAL' as const, 'MACHINERY_LINE' as const, 'COAL' as const, 'OTHER' as const] },
    stages: [],
    requirementDefinitions: [],
    nodes: [
      { id: 'request', label: 'Tiếp nhận PYC', kind: 'DOCUMENT_TASK' as const, requirementCodes: ['REQUEST_PYC', 'REQUEST_SUPPORTING'], active: true, sortOrder: 1 },
      { id: 'commercial', label: 'Hồ sơ thương mại', kind: 'DOCUMENT_TASK' as const, requirementCodes: ['COMMERCIAL_CONTRACT', 'COMMERCIAL_INVOICE'], active: true, sortOrder: 2 },
    ],
  };
  const rows = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PGD', template: pgdTemplate as any });
  assert.deepEqual(rows.map(({ requirementId, displayName }) => [requirementId, displayName]), [
    ['REQUEST_PYC', 'Phiếu yêu cầu giám định'],
    ['REQUEST_SUPPORTING', 'Tài liệu tiếp nhận và thông tin PYC'],
  ]);
  assert.ok(!rows.some((row) => row.requirementId === 'COMMERCIAL_CONTRACT' || row.requirementId === 'COMMERCIAL_INVOICE'));
});

test('custom requirements resolve their own snapshot definition names and multiplicity across template versions', () => {
  const templateV1 = {
    id: 'pcn-custom-v1',
    version: 1,
    nodes: [{ id: 'intake', requirementIds: ['pcn-custom-spec'] }],
    requirementDefinitions: [
      { id: 'pcn-custom-spec', domain: 'PCN' as const, code: 'SPEC', name: 'Bản vẽ kỹ thuật v1', level: 'REQUIRED' as const, source: 'UPLOAD_EXTERNAL' as const, ownerRole: 'CUSTOMER' as const, multiplicity: 'SINGLE' as const },
    ],
  };
  const templateV2 = {
    id: 'pcn-custom-v2',
    version: 2,
    nodes: [{ id: 'intake', requirementIds: ['pcn-custom-spec'] }],
    requirementDefinitions: [
      { id: 'pcn-custom-spec', domain: 'PCN' as const, code: 'SPEC', name: 'Bản vẽ kỹ thuật v2 (sửa đổi)', level: 'OPTIONAL' as const, source: 'UPLOAD_EXTERNAL' as const, ownerRole: 'CUSTOMER' as const, multiplicity: 'MULTIPLE' as const },
    ],
  };
  const rowsV1 = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PCN', template: templateV1 as any });
  const rowsV2 = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PCN', template: templateV2 as any });
  assert.equal(rowsV1[0].displayName, 'Bản vẽ kỹ thuật v1');
  assert.equal(rowsV1[0].multiplicity, 'SINGLE');
  assert.equal(rowsV2[0].displayName, 'Bản vẽ kỹ thuật v2 (sửa đổi)');
  assert.equal(rowsV2[0].multiplicity, 'MULTIPLE');
  assert.equal(pcnDossierRequirements.getPcnDossierRequirementsWithCustom({ fieldCodes: ['QC4'], workflowSnapshot: templateV2 as any }).find((item) => item.id === 'pcn-custom-spec')?.multiplicity, 'MULTIPLE');

  const pgdCustom = { id: 'pgd-custom-file', domain: 'PGD' as const, code: 'PGD-SPEC', name: 'PGD spec', level: 'OPTIONAL' as const, source: 'UPLOAD_EXTERNAL' as const, ownerRole: 'CUSTOMER' as const, multiplicity: 'MULTIPLE' as const };
  assert.equal(pgdDossierRequirements.getPgdDossierRequirementsWithCustom('OTHER', [pgdCustom as any]).find((item) => item.code === pgdCustom.id)?.multiplicity, 'MULTIPLE');
  const pgdRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PGD',
    template: {
      domain: 'pgd',
      id: 'pgd-custom-request-v2',
      version: 2,
      status: 'PUBLISHED',
      nodes: [{ id: 'request', label: 'Customer request', requirementCodes: [pgdCustom.id], active: true }],
      requirementDefinitions: [pgdCustom],
    } as any,
  });
  assert.deepEqual(pgdRows.map(({ requirementId, displayName, multiplicity }) => [requirementId, displayName, multiplicity]), [
    ['pgd-custom-file', 'PGD spec', 'MULTIPLE'],
  ]);
});

test('returns domain baseline when no template is selected', () => {
  const pcnBaseline = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PCN', fieldCode: 'QC4' });
  assert.equal(pcnBaseline[0].sourceProvenance, 'BASELINE');
  assert.equal(pcnBaseline[0].requirementId, 'QC4-PROPOSAL');
  assert.equal(pcnBaseline[1].requirementId, 'QC4-COMMERCIAL');

  const pgdBaseline = attachmentWorkflow.resolveB1AttachmentRequirements({ domain: 'PGD' });
  assert.equal(pgdBaseline[0].sourceProvenance, 'BASELINE');
  assert.equal(pgdBaseline[0].requirementId, 'REQUEST_PYC');
  assert.equal(pgdBaseline[1].requirementId, 'REQUEST_SUPPORTING');
});

test('selected template with no B1 requirements does not fall back to a guessed baseline', () => {
  const pcnRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PCN',
    fieldCode: 'QC4',
    template: { id: 'pcn-empty-v3', version: 3, nodes: [{ id: 'review', label: 'Review', requirementIds: [] }] } as any,
  });
  const pgdRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PGD',
    template: { domain: 'pgd', id: 'pgd-commercial-only-v2', version: 2, nodes: [{ id: 'commercial', label: 'Commercial', requirementCodes: ['COMMERCIAL_CONTRACT'] }] } as any,
  });
  assert.deepEqual(pcnRows, []);
  assert.deepEqual(pgdRows, []);
});

test('resolved requirements retain the selected template ID and the B1 stage', () => {
  const rows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PCN',
    fieldCode: 'QC4',
    template: { id: 'pcn-qc4-v4', version: 4, nodes: [{ id: 'intake', stageId: 'B1', label: 'Intake', requirementIds: ['QC4-PROPOSAL'] }] } as any,
  });
  assert.equal(rows[0].templateId, 'pcn-qc4-v4');
  assert.equal(rows[0].templateVersion, 4);
  assert.equal(rows[0].stageId, 'B1');
});

test('a selected template with a missing snapshot does not guess baseline requirements', () => {
  const pcnRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PCN',
    fieldCode: 'QC9',
    templateId: 'pcn-qc9-v7',
    templateVersion: 7,
  });
  const pgdRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PGD',
    templateId: 'pgd-request-v5',
    templateVersion: 5,
  });

  assert.deepEqual(pcnRows, []);
  assert.deepEqual(pgdRows, []);
});

test('resolver rejects a snapshot whose template ID or version does not match the selected template', () => {
  const pcnRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PCN',
    fieldCode: 'QC4',
    templateId: 'pcn-qc4-v2',
    templateVersion: 2,
    workflowSnapshot: {
      templateId: 'pcn-qc4-v1',
      templateVersion: 1,
      nodes: [{ id: 'B1', stageId: 'B1', requirementIds: ['QC4-PROPOSAL'] }],
    },
  });
  const pgdRows = attachmentWorkflow.resolveB1AttachmentRequirements({
    domain: 'PGD',
    templateId: 'pgd-request-v2',
    templateVersion: 2,
    workflowSnapshot: {
      templateId: 'pgd-request-v2',
      templateVersion: 1,
      nodes: [{ id: 'B1', stageId: 'B1', requirementCodes: ['REQUEST_PYC'] }],
    },
  });

  assert.deepEqual(pcnRows, []);
  assert.deepEqual(pgdRows, []);
});

test('new files start unmapped until a user chooses a requirement', () => {
  assert.match(attachmentPanel, /requirementId:\s*'PENDING_MAPPING'/);
  assert.doesNotMatch(attachmentPanel, /const defaultOption = requirementOptions\[0\]/);
  assert.match(attachmentPanel, /value=\{currentReqId\}/);
});

test('intake attachment UI includes requirement dropdown with template items and Tài liệu bổ sung khác', () => {
  assert.match(attachmentPanel, /Tài liệu bổ sung khác|PENDING_MAPPING/);
  assert.match(attachmentPanel, /requirementOptions|requirements|requirementId/);
});

test('both intake upload flows carry the selected requirement display name', () => {
  assert.match(pcnWorkspace, /const category = attachment\.displayName/);
  assert.match(pgdWorkspace, /const category = attachment\.displayName/);
  assert.doesNotMatch(pcnWorkspace, /PGDCN_B1_ATTACHMENT_TYPES\.find/);
  assert.doesNotMatch(pgdWorkspace, /PGDCN_B1_ATTACHMENT_TYPES\.find/);
});
