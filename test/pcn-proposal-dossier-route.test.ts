import assert from 'node:assert/strict';
import test from 'node:test';
import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';
import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment.ts';

const intake = await import('../app/api/pcn/intake/route.ts');
const actor = { username: 'creator', name: 'Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'] };
const proposal = {
  id: 'proposal-owner-regression', fieldCodes: ['QC4'], channel: 'EMAIL',
  customerSnapshot: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact' },
  warehouseAddress: 'Warehouse',
  productGroup: 'ELECTRICAL_ELECTRONIC',
  registrationNumber: 'PCN-2026-001',
  registrationDate: '2026-11-06',
  receivedAt: '2026-11-06',
  productName: 'Electric fan', productType: 'Fan',
  model: 'F1', brand: 'Brand', specifications: '220V', manufacturer: 'Factory',
  quantity: 1, standards: 'QCVN 04:2009/BKHCN',
};
const legacyProposal = {
  id: 'proposal-legacy-owner-regression', fieldCodes: ['QC4'], channel: 'EMAIL',
  customerSnapshot: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact' },
  warehouseAddress: 'Warehouse', productName: 'Electric fan', productType: 'Fan',
  model: 'F1', brand: 'Brand', specifications: '220V', manufacturer: 'Factory',
  quantity: 1, standards: 'QCVN 4:2009/BKHCN',
};
const dossier = { id: 'dossier-owner-regression', proposalId: proposal.id, fieldCodes: ['QC4'], method: 'METHOD_1', ownerUsername: '', labRequestIds: [], returnedResultIds: [] };

test('PCN conversion creates one linked unassigned dossier and an idempotent retry does not create another', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  const convert = (nextDossier = dossier) => intake.POST(routeRequest('/api/pcn/intake', 'POST', { proposal, dossier: nextDossier }, actor));
  const created = await convert();
  assert.equal(created.status, 201);
  const initial = await created.json();
  assert.equal(initial.proposal.status, 'CONVERTED');
  assert.equal(initial.proposal.dossierId, dossier.id);
  assert.equal(initial.dossier.proposalId, proposal.id);
  assert.equal(initial.dossier.ownerUsername, '');
  assert.equal(initial.dossier.status, 'INTAKE_REVIEW');
  assert.equal(initial.dossier.workflowSchemaVersion, 2);
  assert.deepEqual(initial.dossier.fieldCodes, ['QC4']);
  assert.equal(initial.dossier.workflowTemplatePending, true);
  assert.equal(initial.activityLogs.length, 2);
  const retry = await convert();
  assert.equal(retry.status, 200);
  const retried = await retry.json();
  assert.equal(retried.idempotent, true);
  assert.deepEqual(retried.dossier, initial.dossier);
  assert.deepEqual(retried.activityLogs, []);
  assert.equal((await convert({ ...dossier, id: 'second-dossier' })).status, 409);
  assert.equal(db.list('certificationProposals').length, 1);
  assert.equal(db.list('certificationDossiers').length, 1);
  assert.equal(db.list('activityLogs').length, 2);
});

test('PCN conversion preserves an assigned legacy dossier on retry', async (t) => {
  const db = installDocumentDatabase(t);
  const legacyDossier = { ...dossier, id: 'dossier-legacy-owner-regression', proposalId: legacyProposal.id };
  db.seed('certificationProposals', legacyProposal.id, { ...legacyProposal, status: 'CONVERTED', dossierId: legacyDossier.id });
  db.seed('certificationDossiers', legacyDossier.id, { ...legacyDossier, ownerUsername: 'legacy-owner', status: 'ASSIGNED' });
  const response = await intake.POST(routeRequest('/api/pcn/intake', 'POST', { proposal: legacyProposal, dossier: legacyDossier }, actor));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).dossier.ownerUsername, 'legacy-owner');
  assert.equal(db.list('certificationDossiers').length, 1);
  assert.equal(db.list('activityLogs').length, 0);
});

test('PCN assignment retains manager transfer, staff self-claim, viewer denial and field-scope policy', () => {
  const transfer = { currentUsername: 'old-owner', nextUsername: 'new-owner', actorUsername: 'staff', actorSystemRole: 'staff' };
  assert.ok(getPcnOwnerAssignmentAuthorityDenial(transfer));
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({ ...transfer, actorSystemRole: 'admin' }), null);
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({ ...transfer, actorDepartmentRoleCode: 'LEADERSHIP' }), null);
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({ ...transfer, currentUsername: '', nextUsername: 'staff' }), null);
  assert.ok(getPcnOwnerAssignmentAuthorityDenial({ ...transfer, currentUsername: '', nextUsername: 'staff', actorSystemRole: 'viewer' }));
  const assignment = { assignmentLabel: 'Owner', nextUsername: 'candidate', dossierFieldCodes: ['QC4'], users: [{ username: 'candidate', active: true, role: 'staff', departmentScopes: ['PCN'], fieldCodes: ['QC4'] }] };
  assert.equal(getPcnDossierAssignmentDenial(assignment), null);
  for (const invalid of [{ active: false }, { role: 'viewer' }, { departmentScopes: ['PGD'] }, { fieldCodes: ['QC9'] }]) {
    assert.ok(getPcnDossierAssignmentDenial({ ...assignment, users: [{ ...assignment.users[0], ...invalid }] }));
  }
});

test('newly created PCN Đề nghị with zero attachments creates successfully with workflowSchemaVersion 2 without blocking create/save', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed('pcnDocumentRequirements', 'QC4-PROPOSAL', {
    id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị đăng ký',
    stages: ['INTAKE'], required: true, active: true, sortOrder: 10,
  });
  db.seed('pcnWorkflowTemplates', 'pcn-template-required-intake-upload', {
    id: 'pcn-template-required-intake-upload',
    code: 'PCN-QC4-INTAKE',
    name: 'PCN QC4 intake',
    appliesTo: { fieldCodes: ['QC4'] },
    version: 1,
    status: 'PUBLISHED',
    stages: [{ id: 'intake-documents', label: 'Tiếp nhận', sortOrder: 10, requirementIds: ['pcn-custom-intake-upload'] }],
    requirementDefinitions: [{
      domain: 'PCN', id: 'pcn-custom-intake-upload', code: 'INTAKE_UPLOAD', name: 'Hồ sơ đầu vào',
      level: 'REQUIRED', source: 'UPLOAD_EXTERNAL', ownerRole: 'CUSTOMER', multiplicity: 'SINGLE',
    }],
    nodes: [
      { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['pcn-custom-intake-upload'], active: true, sortOrder: 1, stageId: 'intake-documents' },
      { id: 'end', kind: 'END', label: 'Hoàn tất', requirementIds: [], active: true, sortOrder: 2, stageId: 'issuance-archive' },
    ],
    transitions: [{ id: 'intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS' }],
  });
  const zeroAttachProposal = {
    id: 'proposal-zero-attach',
    fieldCodes: ['QC4'],
    channel: 'EMAIL',
    customerSnapshot: { name: 'Customer', address: 'Ha Noi', contactPerson: 'Contact' },
    productGroup: 'ELECTRICAL_ELECTRONIC',
    registrationNumber: 'PCN-2026-ZERO',
    registrationDate: '2026-11-06',
    receivedAt: '2026-11-06',
    quantity: 1,
    standards: ['QCVN 04:2009/BKHCN'],
  };
  const zeroAttachDossier = {
    ...dossier,
    id: 'dossier-zero-attach',
    proposalId: zeroAttachProposal.id,
  };
  const response = await intake.POST(
    routeRequest('/api/pcn/intake', 'POST', { proposal: zeroAttachProposal, dossier: zeroAttachDossier }, actor),
  );
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.dossier.workflowSchemaVersion, 2);
  assert.equal(data.dossier.status, 'INTAKE_REVIEW');
  assert.equal(data.dossier.workflowTemplatePending, undefined);
  assert.equal(data.dossier.workflowSnapshot.requirementDefinitions[0].level, 'REQUIRED');
  assert.ok(data.dossierDocuments.length > 0);
  for (const doc of data.dossierDocuments) {
    assert.equal(doc.status, 'MISSING');
    assert.equal(doc.versions.length, 0);
  }
  assert.ok(data.dossierDocuments.some((doc) => doc.requirementId === 'pcn-custom-intake-upload'));
  assert.equal(db.list('dossierAttachments').length, 0);
});
