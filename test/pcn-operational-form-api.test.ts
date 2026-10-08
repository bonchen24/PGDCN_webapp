import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnOperationalFormKey, getPcnOperationalFormKind, validatePcnOperationalForm } from '../utils/pcnOperationalForms.ts';
import type { PcnDossierUpdateInput } from '../utils/pcnDossierApi.ts';
import type { PcnOperationalForms } from '../types.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const dossierApiSource = fs.readFileSync(new URL('../utils/pcnDossierApi.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

test('dossier update contract accepts structured operational form snapshots', () => {
  const forms: PcnOperationalForms = {
    evaluationPlan: {
      plannedStartAt: '2026-09-01',
      plannedEndAt: '2026-09-02',
      location: 'Nhà máy A',
      teamMembers: ['Trần Hoàng Phương'],
      scope: 'Đánh giá dây chuyền',
      criteria: 'QCVN 4:2009/BKHCN',
      customerRepresentative: 'Nguyễn Văn A',
      notes: '',
    },
  };
  const update: PcnDossierUpdateInput = { operationalForms: forms };
  assert.equal(update.operationalForms?.evaluationPlan?.location, 'Nhà máy A');
  assert.equal(getPcnOperationalFormKey('EVALUATION_PLAN'), 'evaluationPlan');
  assert.equal(getPcnOperationalFormKind('evaluationPlan'), 'EVALUATION_PLAN');
  assert.equal(getPcnOperationalFormKind('EVALUATION_PLAN'), undefined);
  assert.deepEqual(validatePcnOperationalForm('EVALUATION_PLAN', forms.evaluationPlan), {});
});

test('PCN dossier mutation boundary validates and audits operational form updates', () => {
  assert.match(dossierApiSource, /operationalForms/);
  assert.match(serverSource, /normalizePcnOperationalFormsPatch/);
  assert.match(serverSource, /operationalForms/);
  assert.match(serverSource, /operationalForms|form nghiệp vụ/i);
  assert.match(serverSource, /canProcessPcnOperationalForm/);
  assert.match(serverSource, /canProcessPcnGeneratedDocument/);
  assert.match(serverSource, /futureFormKind/);
  assert.match(storeSource, /updatePcnDossier\(dossierId, updates\)/);
});

test('operational form update never uses the generic collection write boundary', () => {
  const dossierUpdateStart = serverSource.indexOf("app.post('/api/pcn/dossiers/:dossierId'");
  const dossierUpdateEnd = serverSource.indexOf("app.post('/api/pcn/results'", dossierUpdateStart);
  const dossierUpdateSource = serverSource.slice(dossierUpdateStart, dossierUpdateEnd);
  assert.ok(dossierUpdateStart >= 0);
  assert.match(dossierUpdateSource, /withPgTransaction/);
  assert.doesNotMatch(dossierUpdateSource, /genericCollection|\/api\/db/);
});
