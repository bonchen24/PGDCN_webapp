import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';
import { reviewPcnTemplateDefinition } from '../utils/pcnTemplateReview.ts';

const discovered = PCN_TEMPLATE_CATALOG.find((template) => template.id === 'pcn-qc4-certificate-tool')!;
const imported = {
  ...discovered,
  fileAssetId: 'pcn-template-asset',
  storageScope: 'PCN_PRIVATE' as const,
};

test('template review only approves an imported private DOCX with complete placeholders', () => {
  assert.throws(() => reviewPcnTemplateDefinition(discovered, 'APPROVE', { now: '2026-08-28T00:00:00.000Z' }), /STATUS_NOT_APPROVED|MISSING_PRIVATE_ASSET/);
  const approved = reviewPcnTemplateDefinition(imported, 'APPROVE', { now: '2026-08-28T00:00:00.000Z' });
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.approvedAt, '2026-08-28T00:00:00.000Z');
  assert.equal(approved.fileAssetId, imported.fileAssetId);
});

test('template review changes metadata status without touching the asset pointer', () => {
  const approved = { ...imported, status: 'APPROVED' as const, approvedAt: '2026-08-27T00:00:00.000Z' };
  const needsAnnotation = reviewPcnTemplateDefinition(approved, 'REQUEST_ANNOTATION');
  assert.equal(needsAnnotation.status, 'NEEDS_ANNOTATION');
  assert.equal(needsAnnotation.approvedAt, undefined);
  assert.equal(needsAnnotation.fileAssetId, approved.fileAssetId);

  const retired = reviewPcnTemplateDefinition(approved, 'RETIRE');
  assert.equal(retired.status, 'RETIRED');
  assert.equal(retired.approvedAt, approved.approvedAt);
  assert.equal(retired.fileAssetId, approved.fileAssetId);
});

test('template approval separates the importer from the approver', () => {
  const importedByStaff = { ...imported, importedByUsername: 'staff-01', importedAt: '2026-08-28T08:00:00.000Z' };
  assert.throws(
    () => reviewPcnTemplateDefinition(importedByStaff, 'APPROVE', { now: '2026-08-28T09:00:00.000Z', approverUsername: 'staff-01' }),
    /không được tự phê duyệt|importer|approver/i,
  );
  const approved = reviewPcnTemplateDefinition(importedByStaff, 'APPROVE', { now: '2026-08-28T09:00:00.000Z', approverUsername: 'admin-01' });
  assert.equal(approved.approvedByUsername, 'admin-01');
  assert.equal(approved.importedByUsername, 'staff-01');
});

test('template review has an Admin-only API and a dedicated PCN management surface', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
  const managementView = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');

  assert.match(server, /app\.post\('\/api\/pcn\/templates\/:templateId\/review'/);
  assert.match(server, /requirePcnAdmin\(req, res\)/);
  assert.match(server, /source_collection !== 'pcnTemplateDefinitions'/);
  assert.match(server, /pcn-\(\?:file\|template\)-\[a-z0-9-\]\+/);
  assert.match(server, /entityType: 'PCN_TEMPLATE'/);
  assert.match(workspace, /PcnTemplateManagementView/);
  assert.match(workspace, /templates: 'Biểu mẫu PCN'/);
  assert.match(managementView, /Admin PCN/);
  assert.match(managementView, /getPcnFileUrl/);
  assert.match(managementView, /Mở mẫu/);
  const readOnlyLinkIndex = managementView.indexOf('{template.fileAssetId && <a');
  const adminActionsIndex = managementView.indexOf('{editable && <div className="flex shrink-0');
  assert.ok(readOnlyLinkIndex >= 0, 'template link should be present');
  assert.ok(adminActionsIndex >= 0, 'admin actions wrapper should be present');
  assert.ok(readOnlyLinkIndex < adminActionsIndex, 'template link must remain available outside the Admin-only actions');
  assert.match(server, /importedByUsername/);
  assert.match(server, /approverUsername: actor\.username/);
  assert.match(server, /Không thể nhập và tự phê duyệt template/);
  assert.match(managementView, /Apply xong, Admin khác phê duyệt/);
  assert.match(managementView, /getPcnTemplateApprovalReadiness\(template, \{ availablePlaceholderKeys: template\.placeholderKeys, requireVerifiedPrivateAsset: true \}\)/);
  assert.match(managementView, /template\.annotation\?\.mappings/);
  assert.match(managementView, /Đã chú thích đủ placeholder/);
  assert.match(managementView, /chờ Admin khác phê duyệt/);
});

test('template annotation has an Admin-only DOCX derivation path', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const api = fs.readFileSync(new URL('../utils/pcnTemplateAnnotationApi.ts', import.meta.url), 'utf8');
  const managementView = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');

  assert.match(server, /app\.post\('\/api\/pcn\/templates\/:templateId\/annotate'/);
  assert.match(server, /annotatePcnDocxTemplate/);
  assert.match(server, /sourceOriginalFingerprint/);
  assert.match(server, /existing\.status !== 'NEEDS_ANNOTATION'/);
  assert.match(server, /source_json_path !== 'fileAssetId'/);
  assert.match(api, /annotatePcnTemplate/);
  assert.match(managementView, /Chú thích DOCX/);
  assert.match(managementView, /sourceText/);
  assert.match(managementView, /getPcnTemplateAnnotationSuggestions/);
  assert.match(managementView, /const suggestions = getPcnTemplateAnnotationSuggestions\(template\)/);
  assert.match(managementView, /sourceText: suggestions\[key\] \|\| ''/);
});

// --- End of pcn-template-review.test.ts ---
