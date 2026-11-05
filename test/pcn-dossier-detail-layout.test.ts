import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PCN_DOSSIER_FLOW_STAGES } from '../components/PcnDossierFlow.tsx';
import { buildPcnSupplementaryDossierAttachment } from '../utils/pcnDossierDocuments.ts';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PCN detail keeps seven compact stage buttons inside one workflow card', () => {
  const panel = read('../components/PcnDossierWorkflowPanel.tsx');
  const flow = read('../components/PcnDossierFlow.tsx');

  assert.equal(PCN_DOSSIER_FLOW_STAGES.length, 7);
  assert.match(panel, /data-testid="pcn-workflow-step-card"[\s\S]*<PcnDossierFlow/);
  assert.match(flow, /data-testid="pcn-dossier-flow-scroll"[\s\S]*\{stagesWithNodes\.map/);
  assert.match(flow, /min-h-11/);
  assert.doesNotMatch(flow, /min-h-\[106px\]|w-\[218px\]/);
});

test('document reader uses dossier files and attachments with inline supported previews', () => {
  const detail = read('../components/PcnDossierDetailView.tsx');

  assert.match(detail, /<PcnDossierDocumentReader[\s\S]*documents=\{dossierDocuments\}[\s\S]*attachments=\{dossierAttachments\}/);
  assert.match(detail, /getPcnFilePreviewKind/);
  assert.match(detail, /previewKind === 'PDF'[\s\S]*<iframe/);
  assert.match(detail, /previewKind === 'IMAGE'[\s\S]*<img/);
  assert.match(detail, /previewKind === 'UNSUPPORTED'[\s\S]*Định dạng này chưa hỗ trợ xem trực tiếp\./);
  assert.match(detail, /getPcnFileUrl\([^)]*,\s*\{\s*download:\s*true/);
  assert.match(detail, /target="_blank"/);
});

test('PCN step rows use a pencil for drafting and offer stage-scoped supplementary uploads', () => {
  const panel = read('../components/PcnDossierNodeWorkPanel.tsx');
  const workflow = read('../components/PcnDossierWorkflowPanel.tsx');
  const detail = read('../components/PcnDossierDetailView.tsx');
  const typeSource = read('../types.ts');
  const uploadRoute = read('../app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts');

  assert.match(panel, /onUploadSupplementary/);
  assert.match(panel, /aria-label=/);
  assert.match(panel, /<Pencil size=\{14\} aria-hidden="true" \/>/);
  assert.match(workflow, /onUploadSupplementary/);
  assert.match(workflow, /uploadDossierSupplementary/);
  assert.match(detail, /supplementaryStageId/);
  assert.match(typeSource, /supplementaryStageId\?: string/);
  assert.match(uploadRoute, /isPcnDossierPostApprovalLocked/);
  assert.match(uploadRoute, /assignedUsername/);
  assert.doesNotMatch(uploadRoute, /applyPcnDossierDocumentRework|markPcnDossierChecklist/);
});

test('PCN supplementary attachments retain stage context without becoming a checklist requirement', () => {
  const attachment = buildPcnSupplementaryDossierAttachment({
    dossierId: 'dossier-1',
    fieldCode: 'F01',
    stageId: 'node-review',
    stageLabel: 'Rà soát hồ sơ',
    assetId: 'pcn-file-a1-b2',
    fileName: 'evidence.pdf',
    mimeType: 'application/pdf',
    byteSize: 128,
    sha256: 'a'.repeat(64),
    uploadedAt: '2026-11-05T00:00:00.000Z',
  });

  assert.equal(attachment.supplementaryStageId, 'node-review');
  assert.equal(attachment.assetId, 'pcn-file-a1-b2');
  assert.equal(Object.hasOwn(attachment, 'requirementId'), false);
});

test('mobile detail switch is labeled for work and document reading', () => {
  const detail = read('../components/PcnDossierDetailView.tsx');

  assert.match(detail, /aria-label="Chuyển chế độ xem hồ sơ"/);
  assert.match(detail, /Công việc/);
  assert.match(detail, /Xem tài liệu/);
});
