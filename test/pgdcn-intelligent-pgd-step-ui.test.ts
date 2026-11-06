import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PcnUserAccount } from '../types';
import PgdDossierStepWorkPanel from '../components/PgdDossierStepWorkPanel';
import { PGD_DOMAIN, type PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdDossierRequirements } from '../utils/pgdDossier';

function request(overrides: Partial<PgdInspectionRequest> = {}): PgdInspectionRequest {
  return {
    id: 'pgd-intelligent-step-test',
    domain: PGD_DOMAIN,
    requestCode: 'PYC-INTELLIGENT-TEST',
    productGroup: 'OTHER',
    customerName: 'Khách hàng thử nghiệm',
    customerSnapshot: { name: 'Khách hàng thử nghiệm', address: '' },
    productName: 'Sản phẩm thử nghiệm',
    standards: [],
    status: 'DRAFT',
    dossierChecklist: [],
    ...overrides,
  } as unknown as PgdInspectionRequest;
}

test('read-only users see the selected step, missing requirement, and a permission-aware next action', () => {
  const requiredIntakeRequirement = getPgdDossierRequirements('OTHER')
    .find((item) => item.group === 'REQUEST' && item.required)!;
  const markup = renderToStaticMarkup(createElement(PgdDossierStepWorkPanel, {
    request: request(),
    currentUser: { username: 'viewer', pgdRole: 'PGD_VIEWER' } as PcnUserAccount,
    selectedStepId: 'intake',
    dossierRequirements: [requiredIntakeRequirement],
    dossierDocuments: [],
    samples: [],
    canMutate: false,
    completeDisabled: false,
    onCompleteCurrent: () => undefined,
  }));

  assert.match(markup, /data-testid="pgd-step-position"[^>]*>Giai đoạn 1\/7 · Giai đoạn đang chọn/);
  assert.match(markup, /data-testid="pgd-step-continuation-guidance"/);
  assert.match(markup, /Tài khoản hiện tại chỉ có quyền xem/);
  assert.match(markup, /nhờ người có quyền PGD bổ sung tài liệu/);
  assert.match(markup, /Còn thiếu 1 tài liệu bắt buộc/);
  assert.ok(markup.includes(requiredIntakeRequirement.title));
  assert.match(markup, /<button(?=[^>]*disabled="")(?=[^>]*aria-describedby="pgd-step-continuation-reasons-intake")/);
  assert.match(markup, /aria-describedby="pgd-step-continuation-reasons-intake"/);
  assert.match(markup, /id="pgd-step-continuation-reasons-intake"/);
});
