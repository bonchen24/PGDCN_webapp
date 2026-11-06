import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierFlow, { PGD_DOSSIER_FLOW_STEPS } from '../components/PgdDossierFlow.tsx';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD dossier rail renders seven numbered, accessible stages inside the work card', () => {
  const flow = read('components/PgdDossierFlow.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
    status: 'DRAFT',
    selectedStepId: 'intake',
    onSelectStep: () => {},
  }));
  const $ = cheerio.load(html);

  assert.equal($('[data-testid="pgd-dossier-native-flow"]').attr('aria-label'), 'Bước xử lý');
  assert.equal($('[role="tablist"]').length, 1);
  assert.equal($('button[role="tab"]').length, 7);
  assert.equal($('button[role="tab"][aria-selected="true"]').length, 1);
  assert.equal($('#pgd-dossier-step-tab-intake').attr('tabindex'), '0');

  PGD_DOSSIER_FLOW_STEPS.forEach((step, index) => {
    const tab = $(`#pgd-dossier-step-tab-${step.id}`);
    assert.equal(tab.length, 1, `stage ${index + 1} must have a stable tab id`);
    assert.equal(tab.attr('aria-posinset'), String(index + 1));
    assert.equal(tab.attr('aria-setsize'), '7');
    assert.equal(tab.find('span').first().text().trim(), `0${index + 1}`);
    assert.equal(tab.attr('aria-controls'), `pgd-dossier-step-panel-${step.id}`);
    assert.ok(tab.attr('aria-label')?.includes(step.label), `stage ${index + 1} must have an accessible name`);
  });

  assert.match(flow, /id=\{'pgd-dossier-step-tab-' \+ step\.id\}/);
  assert.match(flow, /focus-visible:ring-2 focus-visible:ring-blue-500/);
  assert.match(flow, /event\.key === 'ArrowRight'/);
  assert.match(flow, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(flow, /overflow-x-auto overscroll-x-contain touch-pan-x/);
  assert.match(workspace, /data-testid="pgd-dossier-step-work-panel"[^]*?<PgdDossierFlow[^]*?<PgdDossierStepWorkPanel/);
  assert.doesNotMatch(workspace, /PgdWorkflowMap/);
});

test('PGD work card keeps the selected stage panel connected to its tab', () => {
  const panel = read('components/PgdDossierStepWorkPanel.tsx');
  const workspace = read('components/PgdWorkspace.tsx');

  for (const marker of [
    'PgdCaseEvidencePanel',
    'PgdDossierOperationsPanel',
    'PgdAssignmentStepPanel',
    'PgdPlanStepPanel',
    'PgdFieldInspectionStepPanel',
    'PgdLabRequestStepPanel',
    'PgdResultsStepPanel',
  ]) assert.ok(panel.includes(marker), `${marker} remains available in the stage work panel`);

  assert.match(panel, /id=\{`pgd-dossier-step-panel-\$\{selectedStepId\}`\}/);
  assert.match(panel, /role="tabpanel"/);
  assert.match(panel, /aria-labelledby=\{`pgd-dossier-step-tab-\$\{selectedStepId\}`\}/);
  assert.match(workspace, /<PgdDossierStepWorkPanel[\s\S]*?onCompleteCurrent=\{completeCurrentStep\}/);
});

test('PGD detail keeps its 60/40 work-reader contract and mobile tab relationships', () => {
  const workspace = read('components/PgdWorkspace.tsx');

  assert.match(workspace, /grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\] lg:gap-4/);
  assert.match(workspace, /role="tabpanel" id="pgd-dossier-work-region" aria-labelledby="pgd-dossier-mobile-tab-work"/);
  assert.match(workspace, /<aside role="tabpanel" id="pgd-dossier-reader-region" aria-labelledby="pgd-dossier-mobile-tab-reader"[^>]*>\s*<PgdDossierDocumentReader/);
  assert.match(workspace, /aria-controls="pgd-dossier-work-region"/);
  assert.match(workspace, /aria-controls="pgd-dossier-reader-region"/);
  assert.match(workspace, /const \[mobileSection, setMobileSection\] = useState<'work' \| 'reader'>\('work'\);/);
  assert.match(workspace, /setSelectedReaderDocId\(docId\); setMobileSection\('reader'\)/);
});

test('PGD rail falls back to the current stage for an unknown selection', () => {
  const flow = read('components/PgdDossierFlow.tsx');
  const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
    status: 'PREPARING',
    selectedStepId: 'not-a-stage' as any,
    onSelectStep: () => {},
  }));
  const $ = cheerio.load(html);

  assert.equal($('#pgd-dossier-step-tab-plan').attr('aria-selected'), 'true', 'unknown selection falls back to the current stage');
  assert.equal($('[role="tab"][aria-selected="true"]').length, 1);
  assert.match(flow, /onKeyDown=\{\(event\) => handleKeyDown\(event, index\)\}/);
});
