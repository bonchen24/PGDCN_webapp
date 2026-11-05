import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PCN_DOSSIER_FLOW_STAGES } from '../components/PcnDossierFlow.tsx';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PCN detail keeps seven compact stage buttons inside one workflow card', () => {
  const panel = read('../components/PcnDossierWorkflowPanel.tsx');
  const flow = read('../components/PcnDossierFlow.tsx');

  assert.equal(PCN_DOSSIER_FLOW_STAGES.length, 7);
  assert.match(panel, /data-testid="pcn-workflow-step-card"[\s\S]*<PcnDossierFlow/);
  assert.match(flow, /data-testid="pcn-dossier-flow-scroll"[\s\S]*\{stagesWithNodes\.map/);
  assert.match(flow, /min-h-10/);
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

test('mobile detail switch is labeled for work and document reading', () => {
  const detail = read('../components/PcnDossierDetailView.tsx');

  assert.match(detail, /aria-label="Chuyển chế độ xem hồ sơ"/);
  assert.match(detail, /Công việc/);
  assert.match(detail, /Xem tài liệu/);
});
