import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_ADMIN_ONLY_COLLECTIONS,
  PCN_APPEND_ONLY_COLLECTIONS,
  PCN_DEDICATED_MUTATION_COLLECTIONS,
  PCN_STAFF_MUTABLE_COLLECTIONS,
  getPcnDepartmentScopeDenial,
  getPcnCollectionMutationDenial,
} from '../utils/pcnRbac.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PCN RBAC permits staff business mutations but keeps viewers read-only', () => {
  assert.match(getPcnCollectionMutationDenial('customers', 'staff', 'write') || '', /endpoint chuyên biệt/i);
  assert.match(getPcnCollectionMutationDenial('certificationProposals', 'staff', 'write') || '', /endpoint chuyên biệt/i);
  assert.match(getPcnCollectionMutationDenial('customers', 'viewer', 'write') || '', /chỉ được đọc/i);
  assert.match(getPcnCollectionMutationDenial('systemConfig', 'staff', 'write') || '', /endpoint chuyên biệt/i);
  assert.match(getPcnCollectionMutationDenial('pcnSampleFlowEvents', 'staff', 'delete') || '', /append-only/i);
});

test('PCN collection policy keeps configuration and generated artifacts behind dedicated APIs', () => {
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('certificationDossiers'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('issuancePackages'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('customers'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('dossierDocuments'));
  assert.ok(PCN_APPEND_ONLY_COLLECTIONS.has('activityLogs'));
  assert.ok(PCN_APPEND_ONLY_COLLECTIONS.has('pcnSampleFlowEvents'));
  assert.ok(PCN_ADMIN_ONLY_COLLECTIONS.has('pcnTemplateDefinitions'));
  assert.ok(PCN_ADMIN_ONLY_COLLECTIONS.has('pcnOfficialGeneratedDocuments'));
  assert.ok(PCN_ADMIN_ONLY_COLLECTIONS.has('pcnSignerDelegations'));
  assert.ok(PCN_ADMIN_ONLY_COLLECTIONS.has('pcnQualityDocuments'));
  assert.match(getPcnCollectionMutationDenial('pcnQualityDocuments', 'staff', 'write') || '', /endpoint chuyên biệt/i);
});

test('server rechecks PCN mutation role on generic and business endpoints', () => {
  assert.match(serverSource, /function requirePcnCollectionMutation/);
  assert.match(serverSource, /requirePcnCollectionMutation\(req, res, collectionName, 'write'\)/);
  assert.match(serverSource, /requirePcnCollectionMutation\(req, res, collectionName, 'delete'\)/);
  assert.match(serverSource, /if \(!requirePcnMutation\(req, res\)\) return;/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/intake'/);
  assert.doesNotMatch(serverSource, /app\.post\('\/api\/pcn\/historical-review'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/documents\/generate'/);
  assert.match(serverSource, /app\.post\("\/api\/pcn\/files"/);
});

test('department scopes isolate PCN from PGD at the server session boundary', () => {
  assert.match(getPcnDepartmentScopeDenial({ systemRole: 'staff', departmentScopes: ['PGD'] }) || '', /scope PCN/i);
  assert.equal(getPcnDepartmentScopeDenial({ systemRole: 'staff', departmentScopes: ['PCN'] }), null);
  assert.equal(getPcnDepartmentScopeDenial({ systemRole: 'staff', departmentScopes: ['PCN', 'PGD'] }), null);
  assert.equal(getPcnDepartmentScopeDenial({ systemRole: 'staff' }), null);
  assert.match(serverSource, /requirePcnDepartmentSessionMiddleware/);
  assert.match(serverSource, /app\.use\(\['\/api\/db', '\/api\/db-meta', '\/api\/pcn', '\/api\/activity-logs'\], requirePcnDepartmentSessionMiddleware\)/);
  assert.match(serverSource, /app\.use\('\/api\/pgd', requirePcnSessionMiddleware\)/);
});

// --- End of pcn-rbac-boundary.test.ts ---
