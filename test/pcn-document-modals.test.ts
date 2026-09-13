import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_DOCUMENT_MODAL_DEFINITIONS,
  getPcnDocumentModalDefinition,
  getPcnDocumentOutputFormats,
} from '../utils/pcnDocumentModalPolicy.ts';

const root = new URL('../', import.meta.url);

function read(relativePath: string): string {
  return fs.readFileSync(new URL(relativePath, root), 'utf8');
}

test('PCN document modal catalog covers the dossier forms and both file outputs', () => {
  const expectedKinds = [
    'PROPOSAL_FORM',
    'PROPOSAL_SUMMARY',
    'ASSIGNMENT_FORM',
    'EVALUATION_PLAN',
    'FIELD_INSPECTION',
    'SAMPLE_TAKING',
    'SAMPLE_CODING',
    'SAMPLE_HANDOVER',
    'SAMPLE_RETURN',
    'LAB_REQUEST',
    'EVALUATION_REPORT',
    'DOSSIER_COVER',
  ] as const;

  for (const kind of expectedKinds) {
    const definition = getPcnDocumentModalDefinition(kind);
    assert.equal(definition.kind, kind);
    assert.ok(definition.label.length > 0);
    assert.deepEqual(getPcnDocumentOutputFormats(kind), ['DOCX', 'PDF']);
  }
  assert.equal(getPcnDocumentModalDefinition('SAMPLE_HANDOVER').requiresSampleRoute, true);
  assert.equal(getPcnDocumentModalDefinition('LAB_REQUEST').requiresLabRequest, true);
  assert.equal(PCN_DOCUMENT_MODAL_DEFINITIONS.length, expectedKinds.length);
});

test('proposal and sample handover details are modal actions inside the dossier card', () => {
  const detail = read('components/PcnDossierDetailView.tsx');
  const sampleFlow = read('components/PcnSampleFlowView.tsx');

  assert.match(detail, /PcnProposalDetailModal/);
  assert.match(detail, /PcnSampleHandoverModal/);
  assert.match(detail, /PcnDocumentOutputModal/);
  assert.match(detail, /onOpenHandover/);
  assert.match(sampleFlow, /onOpenHandover/);
  assert.match(sampleFlow, /<RouteCell[\s\S]*onOpenHandover=\{onOpenHandover\}/);
  assert.doesNotMatch(`${detail}\n${sampleFlow}`, /(?:^|[./'])RequestModal|(?:^|[./'])HandoverModal|(?:^|[./'])PrintFormModal/);
});

test('document output modal exposes preflight, DOCX, PDF and private-file actions', () => {
  const output = read('components/PcnDocumentOutputModal.tsx');
  const generation = read('components/PcnDocumentGenerationPanel.tsx');
  const api = read('utils/pcnDocumentGenerationApi.ts');

  assert.match(output, /PcnDocumentGenerationPanel/);
  assert.match(output, /Sinh DOCX/);
  assert.match(output, /Sinh PDF/);
  assert.match(output, /Kiểm tra dữ liệu/);
  assert.match(output, /Đóng/);
  assert.match(generation, /expectedContextHash/);
  assert.match(api, /credentials:\s*['"]same-origin['"]/);
  assert.match(api, /api\/pcn\/documents\/generate/);
});

test('official issuance documents remain a separate approval-gated output', () => {
  const issuance = read('components/PcnIssuanceView.tsx');
  const policy = read('utils/pcnOfficialDocumentApi.ts');

  assert.match(issuance, /Sinh DOCX chính thức/);
  assert.match(issuance, /Sinh PDF chính thức/);
  assert.match(issuance, /Kiểm tra dữ liệu chính thức/);
  assert.match(policy, /expectedContextHash/);
  assert.match(policy, /official-documents\/generate/);
});

test('PCN keeps template configuration in admin settings and excludes DDT template/report screens', () => {
  const activeShell = [
    read('app/page.tsx'),
    read('components/PcnWorkspace.tsx'),
    read('components/PcnDossierDetailView.tsx'),
  ].join('\n');
  const settings = read('components/PcnSettingsView.tsx');

  assert.doesNotMatch(activeShell, /DocxSettingsModal|ReportGeneratorView|SettingsModal/);
  assert.match(settings, /QC4/);
  assert.match(settings, /QC9/);
  assert.doesNotMatch(settings, /QC20/);
  assert.match(settings, /template|biểu mẫu/i);
});

test('PCN template settings use the existing in-place surface for upload, download and review', () => {
  const settings = read('components/PcnSettingsView.tsx');
  const modal = read('components/PcnTemplateSettingsModal.tsx');

  assert.match(settings, /PcnTemplateSettingsModal/);
  assert.match(settings, /onUploadTemplate/);
  assert.match(settings, /Tải xuống/);
  assert.match(settings, /Tải bản mới/);
  assert.match(settings, /onReviewTemplate/);
  assert.match(settings, /PcnTemplateReviewAction/);
  assert.match(settings, /Yêu cầu chỉnh sửa/);
  assert.doesNotMatch(modal, /mapping|placeholder|annotatePcnTemplate|onReviewTemplate|onAnnotateTemplate/i);
  assert.match(modal, /Tải xuống tệp hiện tại/);
  assert.match(modal, /ghi đè tệp hiện tại/);
  assert.doesNotMatch(`${settings}\n${modal}`, /DocxSettingsModal|ReportGeneratorView/);
});

test('PYC and KQTN entry forms stay inside dossier-scoped dialogs', () => {
  const lab = read('components/PcnLabRequestView.tsx');
  const result = read('components/PcnResultReturnView.tsx');

  assert.match(lab, /role="dialog"/);
  assert.match(lab, /aria-modal="true"/);
  assert.match(lab, /Thông tin PYC gửi PTN/);
  assert.match(result, /role="dialog"/);
  assert.match(result, /aria-modal="true"/);
  assert.match(result, /KQTN từ PTN/);
});

test('PYC and KQTN cards expose dedicated detail dialogs before document actions', () => {
  const labView = read('components/PcnLabRequestView.tsx');
  const labModal = read('components/PcnLabRequestDetailModal.tsx');

  assert.match(labView, /PcnLabRequestDetailModal/);
  assert.match(labView, /setSelectedRequestId\(request\.id\)/);
  assert.match(labModal, /Chi tiết PYC gửi PTN/);
  assert.match(labModal, /onOpenDocuments/);
  assert.match(labModal, /onMoveStatus/);
});

test('KQTN cards open a detail dialog with integrity and file context', () => {
  const resultView = read('components/PcnResultReturnView.tsx');
  const resultModal = read('components/PcnResultDetailModal.tsx');

  assert.match(resultView, /PcnResultDetailModal/);
  assert.match(resultView, /setSelectedResultId\(result\.id\)/);
  assert.match(resultModal, /Chi tiết KQTN/);
  assert.match(resultModal, /result\.reportNumber/);
  assert.match(resultModal, /getPcnFileUrl/);
});
