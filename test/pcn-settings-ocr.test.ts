import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_PCN_SETTINGS,
  normalizePcnSettings,
} from '../utils/pcnSettings.ts';
import {
  isPcnOcrFileSupported,
  normalizePcnOcrDraft,
  requiresPcnOcrConfirmation,
} from '../utils/pcnOcrPolicy.ts';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PCN settings baseline covers only PCN fields and dedicated lab routes', () => {
  assert.deepEqual(DEFAULT_PCN_SETTINGS.fieldCodes, ['QC4', 'QC9']);
  assert.equal('QC20' in DEFAULT_PCN_SETTINGS.labRoutes, false);
  assert.ok(DEFAULT_PCN_SETTINGS.labRoutes.QC4.includes('PERFORMANCE'));
  assert.ok(DEFAULT_PCN_SETTINGS.labRoutes.QC9.includes('EMC'));
  assert.equal(DEFAULT_PCN_SETTINGS.storage.privateOnly, true);
  assert.equal(normalizePcnSettings({ ocr: { confidenceThreshold: 2 } }).ocr.confidenceThreshold, 1);
});

test('settings is an Admin surface, not a new workflow page', () => {
  const navigation = read('utils/pcnNavigation.ts');
  const workspace = read('components/PcnWorkspace.tsx');
  const view = read('components/PcnSettingsView.tsx');
  const api = read('utils/pcnSettingsApi.ts');
  const server = read('server.ts');
  assert.match(navigation, /settings/);
  assert.match(workspace, /PcnSettingsView/);
  assert.match(view, /QC4/);
  assert.match(view, /QC9/);
  assert.doesNotMatch(view, /QC20/);
  assert.match(api, /\/api\/pcn\/settings/);
  assert.match(server, /app\.get\('\/api\/pcn\/settings'/);
  assert.match(server, /app\.put\('\/api\/pcn\/settings'/);
  assert.match(server, /requirePcnAdmin/);
  assert.match(server, /extractPcnDocxEmbeddedImages/);
  assert.match(workspace, /PcnPersonalSettingsPanel/);
  assert.match(read('components/PcnSidebar.tsx'), /Mở thiết lập cá nhân/);
  assert.doesNotMatch(workspace, /UserSettingsModal/);
});

test('OCR accepts supported dossier files and requires confirmation before mutation', () => {
  assert.equal(isPcnOcrFileSupported('application/pdf', 'scan.PDF'), true);
  assert.equal(isPcnOcrFileSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'de-nghi.docx'), true);
  assert.equal(isPcnOcrFileSupported('image/jpeg', 'camera.jpg'), true);
  assert.equal(isPcnOcrFileSupported('text/plain', 'notes.txt'), false);
  const ocrRoute = read('server.ts').slice(read('server.ts').indexOf("app.post('/api/pcn/ocr'"));
  assert.match(ocrRoute, /\/ocr\/image/);
  assert.match(ocrRoute, /wordprocessingml/);
  const draft = normalizePcnOcrDraft({ fields: { proposalCode: 'DN-01' }, confidence: 0.82, sourcePage: 2 });
  assert.equal(draft.fields.proposalCode, 'DN-01');
  assert.equal(draft.sourcePage, 2);
  assert.equal(requiresPcnOcrConfirmation(draft), true);
  assert.equal(requiresPcnOcrConfirmation({ ...draft, confirmed: true }), false);
});
