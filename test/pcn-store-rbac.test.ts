import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  assertPcnClientAdmin,
  assertPcnClientMutationAllowed,
  getPcnClientMutationDenial,
} from '../utils/pcnRbac';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('PCN client mutation guard rejects missing sessions and viewers', () => {
  assert.equal(
    getPcnClientMutationDenial(null),
    'Phiên PCN không hợp lệ.',
  );
  assert.equal(
    getPcnClientMutationDenial({ username: 'viewer', role: 'viewer', systemRole: 'staff' }),
    'Tài khoản viewer PCN chỉ được đọc dữ liệu.',
  );
  assert.equal(
    getPcnClientMutationDenial({ username: 'viewer', role: 'staff', systemRole: 'viewer' }),
    'Tài khoản viewer PCN chỉ được đọc dữ liệu.',
  );
  assert.doesNotThrow(() => assertPcnClientMutationAllowed({ username: 'staff', role: 'staff', systemRole: 'staff' }));
  assert.doesNotThrow(() => assertPcnClientMutationAllowed({ username: 'admin', role: 'admin', systemRole: 'admin' }));
  assert.throws(
    () => assertPcnClientMutationAllowed({ username: 'viewer', role: 'viewer', systemRole: 'viewer' }),
    /viewer PCN chỉ được đọc dữ liệu/,
  );
});

test('PCN client admin guard keeps administrative mutations restricted', () => {
  assert.doesNotThrow(() => assertPcnClientAdmin({ username: 'admin', role: 'admin', systemRole: 'admin' }));
  assert.throws(
    () => assertPcnClientAdmin({ username: 'staff', role: 'staff', systemRole: 'staff' }),
    /Chỉ Admin PCN được thực hiện thao tác này\./,
  );
  assert.throws(
    () => assertPcnClientAdmin(null),
    /Chỉ Admin PCN được thực hiện thao tác này\./,
  );
});

test('Zustand PCN store guards every mutation while leaving reads and preflight unguarded', () => {
  const source = read('store-pcn.ts');
  const getMethodBody = (method: string): string => source.match(
    new RegExp(`${method}: async[\\s\\S]*?(?=\\n\\n\\s{2}\\w+: async|\\n\\n}\\)\\);)`),
  )?.[0] || '';
  const mutationMethods = [
    'addPcnUser', 'updatePcnUser', 'deletePcnUser', 'resetPcnUserPassword', 'addSignerDelegation', 'revokeSignerDelegation',
    'addQualityDocument', 'updateQualityDocument', 'retireQualityDocument',
    'markPcnNotificationAsRead', 'markAllPcnNotificationsAsRead', 'clearPcnNotifications',
    'addSampleLot', 'updateSampleRoute', 'addCustomer', 'updateCustomer', 'deleteCustomer',
    'addProposal', 'addDossier', 'updateProposal', 'uploadDossierDocument', 'updateDossier',
    'generateDossierDocuments', 'confirmGeneratedDocument', 'generateOfficialDocuments',
    'reviewPcnTemplate', 'annotatePcnTemplate', 'addLabRequest', 'updateLabRequest',
    'addReturnedResult', 'attachResultFile', 'createIssuanceBundle', 'actOnApprovalStep', 'issuePackage',
    'deliverPackage', 'archivePackage', 'setDossierLegalHold', 'attachIssuanceFile',
  ];
  for (const method of mutationMethods) {
    const methodBody = getMethodBody(method);
    assert.match(methodBody, /assertPcnStore(?:Admin|Personnel)?MutationAllowed\(\);/,
      `${method} must enforce the client-side PCN mutation guard before calling an API`);
  }
  assert.doesNotMatch(getMethodBody('refreshPcnNotifications'), /assertPcnStore(?:Admin|Personnel)?MutationAllowed\(\);/);
  assert.doesNotMatch(getMethodBody('preflightDossierDocuments'), /assertPcnStore(?:Admin|Personnel)?MutationAllowed\(\);/);
  assert.doesNotMatch(getMethodBody('preflightOfficialDocuments'), /assertPcnStore(?:Admin|Personnel)?MutationAllowed\(\);/);
  assert.doesNotMatch(getMethodBody('preflightPcnTemplateSources'), /assertPcnStore(?:Admin|Personnel)?MutationAllowed\(\);/);
});
