import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PcnDossierNodeWorkPanel from '../components/PcnDossierNodeWorkPanel.tsx';
import type { UserAccount } from '../types.ts';
import type { PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork.ts';

function projection(overrides: Partial<PcnDossierNodeWorkProjection> = {}): PcnDossierNodeWorkProjection {
  return {
    nodeId: 'sampling',
    nodeLabel: 'Lấy mẫu',
    status: 'IN_PROGRESS',
    cycleNo: 2,
    documents: [],
    businessFacts: [],
    unresolvedRequiredCount: 0,
    suggestions: [],
    canContinue: true,
    isSelectable: true,
    isEditable: true,
    requiresReworkOnMutation: false,
    ...overrides,
  };
}

function markup(
  work: PcnDossierNodeWorkProjection,
  props: Partial<ComponentProps<typeof PcnDossierNodeWorkPanel>> = {},
) {
  return renderToStaticMarkup(createElement(PcnDossierNodeWorkPanel, { projection: work, ...props }));
}

const reviewer: UserAccount = {
  username: 'reviewer',
  name: 'Người soát xét',
  role: 'tester',
  professionalRoleCodes: ['CERTIFICATION_EXPERT'],
};

test('shows the current role and the next workflow action exposed for this session', () => {
  const html = markup(projection(), {
    taskId: 'task-sampling',
    currentUser: reviewer,
    onCompleteTask: async () => undefined,
  });

  assert.match(html, /aria-label="Vai trò và thao tác trong phiên hiện tại"/);
  assert.match(html, /data-testid="pcn-node-current-role"[^>]*>Chuyên gia chứng nhận/);
  assert.match(html, /data-testid="pcn-node-next-action"[^>]*>Hoàn tất bước này để chuyển tiếp hồ sơ/);
  assert.doesNotMatch(html, /Người soát xét \/ Quản lý PCN/);
});

test('keeps blocked completion explicit and gives keyboard users a path to its reasons', () => {
  const blockedProjection = projection({
    documents: [
      {
        kind: 'DOCUMENT_REQUIREMENT',
        requirementId: 'required-lab-request',
        code: 'LAB_REQUEST',
        label: 'Phiếu yêu cầu thử nghiệm',
        required: true,
        status: 'MISSING',
        actions: ['UPLOAD', 'CREATE_FROM_FORM', 'WAIVE'],
      },
      {
        kind: 'DOCUMENT_REQUIREMENT',
        requirementId: 'optional-note',
        code: 'OPTIONAL_NOTE',
        label: 'Ghi chú bổ sung',
        required: false,
        status: 'MISSING',
        actions: ['UPLOAD'],
      },
    ],
    unresolvedRequiredCount: 1,
    suggestions: ['Bổ sung Phiếu yêu cầu thử nghiệm'],
    canContinue: false,
    blockedReason: 'MISSING_DOCUMENT',
  });
  const blockersId = 'pcn-node-completion-blockers-sampling';
  const html = markup(blockedProjection, {
    taskId: 'task-sampling',
    currentUser: reviewer,
    canEdit: true,
    onCompleteTask: async () => undefined,
    onUploadDocument: async () => undefined,
  });

  assert.match(html, /data-testid="pcn-required-progress"[^>]*>[\s\S]*?0\/1/);
  assert.match(html, /data-testid="pcn-optional-progress"[^>]*>[\s\S]*?0\/1/);
  assert.match(html, /data-testid="pcn-node-next-action"[^>]*>Bổ sung tài liệu bắt buộc: Phiếu yêu cầu thử nghiệm/);
  assert.match(html, new RegExp(`<button(?=[^>]*disabled)(?=[^>]*aria-describedby="${blockersId}")[^>]*>Hoàn tất bước</button>`));
  assert.match(html, new RegExp(`id="${blockersId}"[^>]*tabindex="-1"`));
  assert.match(html, new RegExp(`href="#${blockersId}"[^>]*>Xem lý do chưa thể hoàn tất</a>`));
  assert.match(html, /data-testid="pcn-node-suggestions"><summary[^>]*>Gợi ý xử lý/);
  assert.match(html, /mobile-touch-target min-h-11[^>]*>Hoàn tất bước/);
  assert.match(html, /Thiếu tài liệu bắt buộc: Phiếu yêu cầu thử nghiệm/);
  assert.doesNotMatch(html, /Thiếu tài liệu bắt buộc: Ghi chú bổ sung/);
});
