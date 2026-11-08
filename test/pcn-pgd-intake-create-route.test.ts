import assert from 'node:assert/strict';
import test from 'node:test';

import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';

const pgdIntake = await import('../app/api/pgd/requests/route.ts');
const actor = {
  username: 'pgd-intake-creator',
  name: 'PGD Intake Creator',
  role: 'staff',
  systemRole: 'staff',
  active: true,
  departmentScopes: ['PGD'],
  pgdRole: 'PGD_STAFF',
};

test('PGD intake creates without attachments and snapshots the selected published template version', async (t) => {
  const db = installDocumentDatabase(t);
  const template = {
    domain: 'pgd',
    id: 'pgd-intake-template-v7',
    code: 'PGD-OTHER-INTAKE',
    name: 'PGD Other Intake',
    appliesTo: { productGroups: ['OTHER'] },
    version: 7,
    status: 'PUBLISHED',
    nodes: [
      { id: 'request', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận PYC', requirementCodes: ['REQUEST_PYC', 'REQUEST_SUPPORTING'], active: true, sortOrder: 1 },
      { id: 'end', kind: 'END', label: 'Kết thúc', requirementCodes: [], active: true, sortOrder: 2 },
    ],
    transitions: [{ id: 'request-end', fromNodeId: 'request', toNodeId: 'end', condition: 'ALWAYS' }],
    createdAt: '2026-11-01T00:00:00.000Z',
    createdBy: 'template-admin',
    updatedAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'template-admin',
  };
  db.seed('pgdWorkflowTemplates', template.id, template);

  const response = await pgdIntake.POST(routeRequest('/api/pgd/requests', 'POST', {
    id: 'pgd-intake-no-files',
    intakeChannel: 'DIRECT',
    requester: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact', phone: '0900000000' },
    customerSnapshot: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact' },
    productGroup: 'OTHER',
    catalogItemId: 'GENERAL_GOODS_INSPECTION',
    productName: 'Inspection item',
    quantity: 1,
    inspectionScope: 'Visual and dimensional inspection',
    inspectionLocation: 'Ha Noi',
    standards: ['Tiêu chuẩn hợp đồng'],
    method: 'QT-GĐ-04',
    workflowTemplateSelection: { id: template.id, version: template.version },
  }, actor));

  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  const { request, samples } = await response.json();
  assert.deepEqual(samples, []);
  assert.equal(request.workflowTemplateId, template.id);
  assert.equal(request.workflowTemplateVersion, template.version);
  assert.equal(request.workflowSnapshot.templateId, template.id);
  assert.equal(request.workflowSnapshot.templateVersion, template.version);
  assert.equal(request.workflowTemplatePending, undefined);
  assert.ok(request.dossierChecklist.length > 0);
  assert.ok(request.dossierChecklist.every((item: { status: string }) => item.status === 'MISSING'));
  assert.equal(db.list('pgdInspectionRequests').length, 1);
  assert.equal(db.list('pgdDossierDocuments').length, 0);
});
