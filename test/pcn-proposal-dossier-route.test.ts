import assert from 'node:assert/strict';
import test from 'node:test';
import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';
import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment.ts';

const intake = await import('../app/api/pcn/intake/route.ts');
const actor = { username: 'creator', name: 'Creator', role: 'staff', systemRole: 'staff', active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'] };
const proposal = {
  id: 'proposal-owner-regression', fieldCodes: ['QC4'], channel: 'EMAIL',
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
  db.seed('certificationProposals', proposal.id, { ...proposal, status: 'CONVERTED', dossierId: dossier.id });
  db.seed('certificationDossiers', dossier.id, { ...dossier, ownerUsername: 'legacy-owner', status: 'ASSIGNED' });
  const response = await intake.POST(routeRequest('/api/pcn/intake', 'POST', { proposal, dossier }, actor));
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
