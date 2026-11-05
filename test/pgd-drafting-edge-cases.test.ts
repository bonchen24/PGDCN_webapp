import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confirmPgdDraftTitleDiscard,
  requirePgdDraftSaveContext,
} from '../components/PgdDraftingWorkspaceView.tsx';
import { getPgdDossierRequirements, getPgdDossierRequirementsWithCustom } from '../utils/pgdDossier.ts';
import { getPgdDocumentTemplates, type PgdDocumentTemplate } from '../utils/pgdDocumentTemplates.ts';
import type { DossierTemplateRequirementDefinition } from '../types.ts';
import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain.ts';
import * as pgdDrafting from '../utils/pgdDrafting.ts';
import {
  getPgdDocumentsForRequirement,
  getPgdDocumentRequirementCode,
  hasPgdDeepContext,
  isPgdDocumentForRequirement,
  resolvePgdDraftingContext,
} from '../utils/pgdDrafting.ts';

const request = { id: 'req-1', productGroup: 'STEEL_METAL' } as PgdInspectionRequest;

const generated = (id: string, kind: string, requestId = request.id) => ({
  id,
  domain: 'pgd',
  requestId,
  kind,
  generatedAt: id === 'older' ? '2026-09-20T00:00:00.000Z' : '2026-09-21T00:00:00.000Z',
} as unknown as PgdGeneratedDocument);

test('PGD deep context is locked only by a dossier/request identity, not by kind alone', () => {
  assert.equal(hasPgdDeepContext({}), false);
  assert.equal(hasPgdDeepContext({ templateKind: 'INSPECTION_PLAN' }), false);
  assert.equal(hasPgdDeepContext({ requestId: 'req-1', templateKind: 'INSPECTION_PLAN' }), true);
});

test('PGD generated/review documents are scoped to the active requirement', () => {
  const plan = generated('plan', 'INSPECTION_PLAN');
  const field = generated('field', 'FIELD_INSPECTION');
  const foreignRequest = generated('foreign', 'INSPECTION_PLAN', 'req-2');

  assert.equal(getPgdDocumentRequirementCode(plan, request.productGroup), 'INSPECTION_PLAN');
  assert.equal(getPgdDocumentRequirementCode(field, request.productGroup), 'FIELD_INSPECTION_MINUTES');
  assert.equal(isPgdDocumentForRequirement({
    document: field,
    requestId: request.id,
    requirementCode: 'INSPECTION_PLAN',
    productGroup: request.productGroup,
  }), false);
  assert.deepEqual(
    getPgdDocumentsForRequirement({
      documents: [foreignRequest, plan, field],
      requestId: request.id,
      requirementCode: 'FIELD_INSPECTION_MINUTES',
      productGroup: request.productGroup,
    }),
    [field],
  );
});

test('PGD drafting resolver follows the selected requirement and its mapped template', () => {
  const requirements = getPgdDossierRequirements(request.productGroup);
  const templates = getPgdDocumentTemplates();
  const resolved = resolvePgdDraftingContext({
    request,
    requirements,
    templates,
    selectedRequirementCode: 'FIELD_INSPECTION_MINUTES',
  });

  assert.equal(resolved.activeRequirementCode, 'FIELD_INSPECTION_MINUTES');
  assert.equal(resolved.activeRequirement?.code, 'FIELD_INSPECTION_MINUTES');
  assert.equal(resolved.selectedTemplate?.kind, 'FIELD_INSPECTION');
  assert.equal(resolved.invalidDeepContext, false);
});

test('PGD custom DOCX requirement resolves its linked template for the dossier checklist action', () => {
  const templates = getPgdDocumentTemplates().filter((template) => template.active && template.productGroups.includes(request.productGroup));
  const linkedTemplate = templates[0];
  assert.ok(linkedTemplate);
  const definition: DossierTemplateRequirementDefinition = {
    domain: 'PGD',
    id: 'pgd-custom-docx-link-01',
    code: 'CUSTOM_DOCX_FORM',
    name: 'Biểu mẫu DOCX riêng',
    level: 'REQUIRED',
    source: 'DRAFT_FROM_DOCX_TEMPLATE',
    ownerRole: 'PGD_DOCUMENT_CLERK',
    multiplicity: 'SINGLE',
    linkedDocxTemplateId: linkedTemplate.id,
  };
  const requirement = getPgdDossierRequirementsWithCustom(request.productGroup, [definition]).find((item) => item.code === definition.id)!;
  const selectTemplate = (pgdDrafting as unknown as {
    getPgdDocumentTemplateForRequirement?: (item: typeof requirement, catalog: PgdDocumentTemplate[], productGroup: PgdInspectionRequest['productGroup']) => PgdDocumentTemplate | undefined;
  }).getPgdDocumentTemplateForRequirement;
  const selected = selectTemplate?.(requirement, templates, request.productGroup);

  assert.equal(selected?.id, linkedTemplate.id);
});

test('PGD draft save context throws a specific validation error for each missing dependency', () => {
  assert.throws(
    () => requirePgdDraftSaveContext({ activeRequirementCode: 'FIELD_INSPECTION_MINUTES', template: {} as never }),
    { message: 'Không thể lưu bản nháp: chưa chọn hồ sơ/PYC PGD.' },
  );
  assert.throws(
    () => requirePgdDraftSaveContext({ request, template: {} as never }),
    { message: 'Không thể lưu bản nháp: chưa xác định mục tài liệu trong hồ sơ PGD.' },
  );
  assert.throws(
    () => requirePgdDraftSaveContext({ request, activeRequirementCode: 'FIELD_INSPECTION_MINUTES' }),
    { message: 'Không thể lưu bản nháp: chưa có biểu mẫu hợp lệ trong danh mục PGD.' },
  );
});

test('PGD title discard guard prompts only when the title differs from its saved or loaded baseline', () => {
  let promptCount = 0;
  let promptMessage = '';
  const confirmDiscard = (message: string) => {
    promptCount += 1;
    promptMessage = message;
    return false;
  };

  assert.equal(confirmPgdDraftTitleDiscard('Bản soạn', 'Bản soạn', confirmDiscard), true);
  assert.equal(promptCount, 0);
  assert.equal(confirmPgdDraftTitleDiscard('Bản soạn đã đổi', 'Bản soạn', confirmDiscard), false);
  assert.equal(promptCount, 1);
  assert.equal(promptMessage, 'Tên bản soạn đã thay đổi kể từ lần lưu hoặc nạp gần nhất. Bạn có muốn tiếp tục và bỏ thay đổi tiêu đề này không?');
});
