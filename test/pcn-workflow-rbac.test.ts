import assert from 'node:assert/strict';
import test from 'node:test';

import { getPcnWorkflowTemplateMutationDenial } from '../utils/pcnRbac.ts';

test('only admin or PCN manager may change workflow template definitions', () => {
  assert.equal(getPcnWorkflowTemplateMutationDenial({ role: 'admin', systemRole: 'admin' }), null);
  assert.equal(getPcnWorkflowTemplateMutationDenial({ role: 'staff', systemRole: 'staff', departmentRoleCode: 'LEADERSHIP' }), null);
  assert.match(String(getPcnWorkflowTemplateMutationDenial({ role: 'staff', systemRole: 'staff' })), /Admin|Quản lý/);
  assert.match(String(getPcnWorkflowTemplateMutationDenial({ role: 'viewer', systemRole: 'viewer' })), /Admin|Quản lý/);
  assert.match(String(getPcnWorkflowTemplateMutationDenial(null)), /Admin|Quản lý/);
});
