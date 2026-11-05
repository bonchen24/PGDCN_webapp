import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PgdcnDossierTemplateManagementView from '../components/PgdcnDossierTemplateManagementView.tsx';

const sidebar = readFileSync(new URL('../components/PgdcnSidebar.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
const management = readFileSync(new URL('../components/PgdcnDossierTemplateManagementView.tsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../components/PgdcnDossierTemplateEditor.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../components/PgdcnSystemSettingsView.tsx', import.meta.url), 'utf8');

test('shared navigation exposes Hồ sơ mẫu to eligible managers', () => {
  assert.match(sidebar, /dossier-templates/);
  assert.match(sidebar, /Hồ sơ mẫu/);
  assert.match(sidebar, /isPcnSystemManager|PGD_MANAGER/);
  assert.match(shell, /PgdcnDossierTemplateManagementView/);
});

test('management workspace separates PCN and PGD requirements and lifecycle actions', () => {
  assert.match(management, /PCN/);
  assert.match(management, /PGD/);
  assert.match(management, /Tìm kiếm|Tìm bộ hồ sơ/);
  assert.match(management, /Đang áp dụng|Bản nháp|Đã ngừng/);
  assert.match(management, /Tạo phiên bản mới/);
  assert.match(editor, /Lưu bản nháp/);
  assert.match(management, /requirementIds|requirementCodes/);
  assert.match(editor, /selectedNodeId/);
  assert.doesNotMatch(management, /<textarea/);
});

test('template cards expose their application scope without opening the editor', () => {
  assert.match(management, /Phạm vi áp dụng/);
  assert.match(management, /QC4/);
  assert.match(management, /Thép và kim loại/);
  assert.match(management, /data-testid=\{`pgdcn-dossier-template-scope-/);
});

test('employees can propose private drafts while common templates remain clone-only', () => {
  assert.match(management, /canProposePcn|canProposePgd/);
  assert.match(management, /Đề xuất riêng/);
  assert.match(management, /Nhân bản để đề xuất/);
  assert.match(management, /cloneInsteadOfOpen/);
  assert.match(management, /activeCanManage && template\.status === 'PUBLISHED'/);
  assert.match(sidebar, /canAccessDossierTemplates/);
});

test('employee workspace lists only published common templates and their own private drafts', () => {
  const employee: any = { username: 'staff-1', name: 'Nhân viên', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'] };
  const makeTemplate = (id: string, overrides: Record<string, unknown> = {}): any => ({
    id,
    code: id.toUpperCase(),
    name: `Mẫu ${id}`,
    version: 1,
    status: 'PUBLISHED',
    appliesTo: { fieldCodes: ['QC4'], methods: [] },
    nodes: [],
    transitions: [],
    ...overrides,
  });
  const common = makeTemplate('common');
  const ownProposal = makeTemplate('mine', { scope: 'PERSONAL', status: 'DRAFT', createdBy: employee.username });
  const otherProposal = makeTemplate('other', { scope: 'PERSONAL', status: 'DRAFT', createdBy: 'staff-2' });
  const unpublishedCommon = makeTemplate('common-draft', { scope: 'COMMON', status: 'DRAFT' });
  const markup = renderToStaticMarkup(createElement(PgdcnDossierTemplateManagementView, {
    currentUser: employee,
    pcnTemplates: [common, ownProposal, otherProposal, unpublishedCommon],
    pcnRequirements: [],
    pgdTemplates: [],
    pgdRequirements: [],
    onCreatePcnWorkflowTemplate: async (template: any) => template,
    onUpdatePcnWorkflowTemplate: async (_id: string, template: any) => template,
    onCreatePcnWorkflowRevision: async (_id: string, template: any) => template,
    onPublishPcnWorkflowTemplate: async (templateId: string) => common,
    onRetirePcnWorkflowTemplate: async (templateId: string) => common,
    onCreatePgdWorkflowTemplate: async (template: any) => template,
    onUpdatePgdWorkflowTemplate: async (_id: string, template: any) => template,
    onCreatePgdWorkflowRevision: async (_id: string, template: any) => template,
    onPublishPgdWorkflowTemplate: async (templateId: string) => common,
    onRetirePgdWorkflowTemplate: async (templateId: string) => common,
  }));

  assert.match(markup, /pgdcn-dossier-template-card-common/);
  assert.match(markup, /pgdcn-dossier-template-card-mine/);
  assert.doesNotMatch(markup, /pgdcn-dossier-template-card-other/);
  assert.doesNotMatch(markup, /pgdcn-dossier-template-card-common-draft/);
  assert.match(markup, /Nhân bản để đề xuất/);
  assert.match(markup, /Mở đề xuất riêng/);
  assert.doesNotMatch(markup, /Tạo phiên bản mới|Công bố|Ngừng áp dụng/);
});

test('management workspace guards unsaved visual-editor changes', () => {
  assert.match(management, /editorDirty/);
  assert.match(management, /Thay đổi chưa lưu/);
  assert.match(management, /window\.confirm/);
});

test('template management uses the native editor without an Archify preview', () => {
  assert.match(management, /PgdcnDossierTemplateEditor/);
  assert.doesNotMatch(management, /PgdcnDossierTemplateArchifyPreview|previewModel|onPreview|Archify/);
  assert.doesNotMatch(editor, /onPreview|Xem trước Archify|Archify/);
});

test('settings no longer renders raw JSON workflow editor as the primary surface', () => {
  assert.doesNotMatch(settings, /PcnWorkflowTemplateManagementView/);
  assert.doesNotMatch(settings, /topologyJson|Nodes và transitions \(JSON\)/);
  assert.match(settings, /Cài đặt hệ thống/);
  assert.match(settings, /PcnUserManagementView/);
});

test('template cards render Xem trước button and management wires saved-model adapters', () => {
  assert.match(management, /toPcnDossierTemplateEditorModel/);
  assert.match(management, /toPgdDossierTemplateEditorModel/);
  assert.match(management, /PgdcnDossierTemplatePreview/);
  assert.match(management, /pgdcn-dossier-template-preview-surface/);

  const dummyUser: any = {
    username: 'admin',
    role: 'admin',
    departmentScopes: ['PCN', 'PGD'],
  };
  const dummyTemplate: any = {
    id: 'pcn-template-1',
    code: 'PCN-QC4-01',
    name: 'Quy trình mẫu QC4',
    version: 1,
    status: 'PUBLISHED',
    appliesTo: { fieldCodes: ['QC4'], methods: [] },
    nodes: [],
    transitions: [],
  };
  const markup = renderToStaticMarkup(
    createElement(PgdcnDossierTemplateManagementView, {
      currentUser: dummyUser,
      pcnTemplates: [dummyTemplate],
      pcnRequirements: [],
      pgdTemplates: [],
      pgdRequirements: [],
      onCreatePcnWorkflowTemplate: async () => dummyTemplate,
      onUpdatePcnWorkflowTemplate: async () => dummyTemplate,
      onCreatePcnWorkflowRevision: async () => dummyTemplate,
      onPublishPcnWorkflowTemplate: async () => dummyTemplate,
      onRetirePcnWorkflowTemplate: async () => dummyTemplate,
      onCreatePgdWorkflowTemplate: async () => dummyTemplate,
      onUpdatePgdWorkflowTemplate: async () => dummyTemplate,
      onCreatePgdWorkflowRevision: async () => dummyTemplate,
      onPublishPgdWorkflowTemplate: async () => dummyTemplate,
      onRetirePgdWorkflowTemplate: async () => dummyTemplate,
    }),
  );
  assert.match(markup, />Xem trước<\/button>/);
});
