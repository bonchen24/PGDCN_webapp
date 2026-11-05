import assert from 'node:assert/strict';
import test from 'node:test';
import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';

const dossierRoute = await import('../app/api/pcn/dossiers/[dossierId]/route.ts');

test('PCN dossier owner update rejects a viewer with stale leadership metadata at the server boundary', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed('certificationDossiers', 'dossier-1', {
    id: 'dossier-1', dossierCode: 'PCN-OWNER-001', status: 'INTAKE_REVIEW',
    ownerUsername: '', fieldCodes: ['QC4'],
  });
  db.seed('systemUsers', 'pcn-staff', {
    username: 'pcn-staff', name: 'Nhân viên PCN', role: 'staff', systemRole: 'staff',
    active: true, departmentScopes: ['PCN'], fieldCodes: ['QC4'],
  });

  const viewerLeader = {
    username: 'viewer-leader', name: 'Viewer Leader', role: 'viewer', systemRole: 'viewer', active: true,
    managementRoleCode: 'DEPARTMENT_HEAD', departmentRoleCode: 'LEADERSHIP',
  };
  const response = await dossierRoute.POST(
    routeRequest('/api/pcn/dossiers/dossier-1', 'POST', {
      updates: { ownerUsername: 'pcn-staff' }, idempotencyKey: 'viewer-owner-assignment',
    }, viewerLeader),
    { params: Promise.resolve({ dossierId: 'dossier-1' }) },
  );

  assert.equal(response.status, 403);
  assert.equal(db.list('certificationDossiers')[0].data.ownerUsername, '');
  assert.equal(db.list('activityLogs').length, 0);
  assert.equal(db.statements.some((sql) => /^(INSERT|UPDATE)/.test(sql)), false);
});
