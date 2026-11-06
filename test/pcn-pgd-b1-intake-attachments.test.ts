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
