import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PgdcnDossierTemplatePreview from '../components/PgdcnDossierTemplatePreview.tsx';
import type { DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import type { DossierTemplateRequirementOption } from '../components/PgdcnDossierTemplateInspector.tsx';

const fixtureModel: DossierTemplateEditorModel = {
  domain: 'PCN',
  id: 'template-fixture-01',
  code: 'PCN-STEEL-V1',
  name: 'Bộ hồ sơ mẫu Thép xây dựng',
  description: 'Quy trình thử nghiệm và chứng nhận thép cốt bê tông.',
  version: 2,
  status: 'PUBLISHED',
  appliesTo: {
    fieldCodes: ['QC4'],
    methods: ['METHOD_5'],
  },
  requirementPolicies: {
    'REQ-PCN-01': { defaultClass: 'DEFAULT_OPTIONAL', sourceMode: 'UPLOAD', cardinality: { min: 1, max: 2 } },
  },
  nodes: [
    {
      id: 'node-intake-01',
      kind: 'DOCUMENT_TASK',
      label: 'Tiếp nhận hồ sơ thép',
      description: 'Kiểm tra tính hợp lệ của hồ sơ',
      actionKey: 'INTAKE_CHECK',
      assigneeRole: 'SPECIALIST',
      slaDays: 2,
      active: true,
      laneId: 'intake',
      column: 1,
      sortOrder: 1,
      requirementRefs: ['REQ-PCN-01', 'REQ-UNKNOWN-99'],
    },
    {
      id: 'node-review-02',
      kind: 'APPROVAL_TASK',
      label: 'Phê duyệt đánh giá',
      description: 'Lãnh đạo phòng xem xét kết quả',
      actionKey: 'LEADER_APPROVAL',
      assigneeRole: 'MANAGER',
      slaDays: 1,
      active: false,
      laneId: 'review',
      column: 4,
      sortOrder: 2,
      requirementRefs: ['REQ-PCN-02'],
    },
    {
      id: 'node-join-all-03',
      kind: 'PARALLEL_JOIN',
      label: 'Gom tất cả nhánh',
      joinPolicy: 'ALL',
      active: true,
      laneId: 'review',
      column: 3,
      sortOrder: 3,
      requirementRefs: [],
    },
    {
      id: 'node-join-any-04',
      kind: 'PARALLEL_JOIN',
      label: 'Gom nhánh đạt yêu cầu',
      joinPolicy: 'ANY',
      active: true,
      laneId: 'review',
      column: 4,
      sortOrder: 4,
      requirementRefs: [],
    },
    {
      id: 'node-decision-03',
      kind: 'DECISION',
      label: 'Đánh giá kết quả',
      active: true,
      laneId: 'review',
      column: 5,
      sortOrder: 3,
      requirementRefs: [],
    },
    {
      id: 'node-end-04',
      kind: 'END',
      label: 'Hoàn tất chứng nhận',
      active: true,
      laneId: 'archive',
      column: 6,
      sortOrder: 4,
      requirementRefs: [],
    },
  ],
  transitions: [
    {
      id: 'edge-01',
      fromNodeId: 'node-intake-01',
      toNodeId: 'node-review-02',
      condition: 'ALWAYS',
      label: 'Chuyển duyệt hồ sơ',
    },
    {
      id: 'edge-02',
      fromNodeId: 'node-decision-03',
      toNodeId: 'node-end-04',
      condition: 'RESULT_PASSED',
      label: 'Đạt kết quả thử',
      returnPolicy: 'REWORK',
      priority: 1,
    },
    {
      id: 'edge-field-match',
      fromNodeId: 'node-intake-01',
      toNodeId: 'node-review-02',
      condition: 'FIELD_MATCH',
      conditionConfig: { expectedFieldCodes: ['QC9'] },
    },
    {
      id: 'edge-method-match',
      fromNodeId: 'node-review-02',
      toNodeId: 'node-decision-03',
      condition: 'METHOD_MATCH',
      conditionConfig: { expectedMethod: 'METHOD_7' },
    },
    {
      id: 'edge-approval-returned',
      fromNodeId: 'node-review-02',
      toNodeId: 'node-intake-01',
      condition: 'APPROVAL_RETURNED',
    },
  ],
};

const fixtureRequirements: DossierTemplateRequirementOption[] = [
  {
    id: 'REQ-PCN-01',
    label: 'Giấy chứng nhận xuất xưởng',
    description: 'Bản chính hoặc bản sao công chứng',
    group: 'QC4',
    required: true,
  },
  {
    id: 'REQ-PCN-02',
    label: 'Báo cáo thử nghiệm cơ lý',
    description: 'Kết quả thử kéo uốn',
    group: 'QC4',
    required: true,
  },
];

test('PgdcnDossierTemplatePreview renders read-only topology, metadata, requirements, and connections', () => {
  let closed = false;
  const markup = renderToStaticMarkup(
    createElement(PgdcnDossierTemplatePreview, {
      model: fixtureModel,
      requirements: fixtureRequirements,
      onClose: () => {
        closed = true;
      },
    }),
  );

  // Metadata
  assert.match(markup, /PCN-STEEL-V1/);
  assert.match(markup, /Bộ hồ sơ mẫu Thép xây dựng/);
  assert.match(markup, /Quy trình thử nghiệm và chứng nhận thép cốt bê tông/);
  assert.match(markup, /phiên bản 2/);
  assert.match(markup, /Đang áp dụng/);
  assert.match(markup, /QC4/);
  assert.match(markup, /Phương thức 5/);

  // Nodes & topology
  assert.match(markup, /node-intake-01/);
  assert.match(markup, /Tiếp nhận hồ sơ thép/);
  assert.match(markup, /Tài liệu \/ nghiệp vụ/);
  assert.match(markup, /Đang hoạt động/);
  assert.match(markup, /INTAKE_CHECK/);
  assert.match(markup, /SPECIALIST/);
  assert.match(markup, /2 ngày/);

  // Inactive node
  assert.match(markup, /node-review-02/);
  assert.match(markup, /Phê duyệt đánh giá/);
  assert.match(markup, /Phê duyệt/);
  assert.match(markup, /Tạm dừng|Không hoạt động/);

  // Requirements: catalog match & fallback
  assert.match(markup, /Giấy chứng nhận xuất xưởng/);
  assert.match(markup, /Báo cáo thử nghiệm cơ lý/);
  assert.match(markup, /REQ-UNKNOWN-99/);
  assert.match(markup, /Mặc định tùy chọn/);
  assert.match(markup, /Tải tệp lên/);
  assert.match(markup, /1–2 tệp/);
  assert.match(markup, /Trạng thái ban đầu: Chưa có/);

  // Transitions & connection endpoints
  assert.match(markup, /Tiếp nhận hồ sơ thép/);
  assert.match(markup, /Chuyển duyệt hồ sơ/);
  assert.match(markup, /Phê duyệt đánh giá/);
  assert.match(markup, /Đạt kết quả thử/);
  assert.match(markup, /Hoàn tất chứng nhận/);
  assert.match(markup, /Làm lại bước trước/);
  assert.match(markup, /Chờ tất cả nhánh/);
  assert.match(markup, /Chờ ít nhất một nhánh/);

  const visibleText = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(visibleText, /Phạm vi điều kiện:\s*QC9 · Hợp chuẩn/);
  assert.match(visibleText, /Phương thức điều kiện:\s*Phương thức 7/);
  assert.match(visibleText, /Bị trả về từ phê duyệt/);

  // Strictly read-only: no input, select, textarea, draggable
  assert.doesNotMatch(markup, /<input/i);
  assert.doesNotMatch(markup, /<select/i);
  assert.doesNotMatch(markup, /<textarea/i);
  assert.doesNotMatch(markup, /draggable="true"/i);
  assert.doesNotMatch(markup, /cursor-grab/i);

  // Interactive controls: only close button
  assert.match(markup, /<button[^>]*>.*Đóng.*<\/button>/i);
  assert.doesNotMatch(markup, />Lưu</);
  assert.doesNotMatch(markup, />Xóa</);
  assert.doesNotMatch(markup, />Thêm</);
  assert.equal((markup.match(/<button\b/g) || []).length, 1);
});

test('PgdcnDossierTemplatePreview renders PGD condition parameters and preserves unknown saved values', () => {
  const pgdModel: DossierTemplateEditorModel = {
    domain: 'PGD',
    id: 'pgd-template-conditions',
    code: 'PGD-THAN-01',
    name: 'Lưu trình giám định than',
    version: 1,
    status: 'DRAFT',
    appliesTo: { productGroups: ['STEEL_METAL'], methodCodes: ['TT58'] },
    nodes: [
      { id: 'pgd-start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', active: true, laneId: 'intake', column: 1, sortOrder: 1, requirementRefs: [] },
      { id: 'pgd-end', kind: 'END', label: 'Kết thúc', active: true, laneId: 'archive', column: 6, sortOrder: 2, requirementRefs: [] },
    ],
    transitions: [
      { id: 'pgd-field-match', fromNodeId: 'pgd-start', toNodeId: 'pgd-end', condition: 'FIELD_MATCH', conditionConfig: { expectedProductGroups: ['COAL'] } },
      { id: 'pgd-method-match', fromNodeId: 'pgd-start', toNodeId: 'pgd-end', condition: 'METHOD_MATCH', conditionConfig: { expectedMethodCodes: ['QT-GĐ-14', 'UNKNOWN_METHOD'] } },
    ],
  };

  const markup = renderToStaticMarkup(
    createElement(PgdcnDossierTemplatePreview, {
      model: pgdModel,
      requirements: [],
      onClose: () => {},
    }),
  );
  const visibleText = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  assert.match(visibleText, /Phạm vi điều kiện:\s*Than/);
  assert.match(visibleText, /Phương thức điều kiện:\s*QT-GĐ-14 · UNKNOWN_METHOD/);
  assert.match(markup, /<button[^>]*aria-label="Đóng xem trước"/);
  assert.equal((markup.match(/<button\b/g) || []).length, 1);
  assert.doesNotMatch(markup, /<input|<select|<textarea|draggable="true"/i);
});

test('PgdcnDossierTemplatePreview renders empty states when topology or connections are empty', () => {
  const emptyModel: DossierTemplateEditorModel = {
    domain: 'PGD',
    id: 'empty-template',
    code: 'PGD-EMPTY',
    name: 'Mẫu rỗng',
    version: 1,
    status: 'DRAFT',
    appliesTo: { productGroups: [] },
    nodes: [],
    transitions: [],
  };

  const markup = renderToStaticMarkup(
    createElement(PgdcnDossierTemplatePreview, {
      model: emptyModel,
      requirements: [],
      onClose: () => {},
    }),
  );

  assert.match(markup, /Chưa có bước nào/);
  assert.match(markup, /Chưa có đường nối/);
  assert.match(markup, /Bản nháp/);
});
