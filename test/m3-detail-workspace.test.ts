import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');
const read = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

describe('Milestone 3: Detail Workspace 60/40 & Seven-Stage Workflow (F09-F12)', () => {
  it('F09: Completely removes PcnWorkflowMap and legacy graphics from PCN Detail Workspace', () => {
    const detailSource = read('components/PcnDossierDetailView.tsx');

    // Asserts no import or JSX usage of PcnWorkflowMap
    assert.doesNotMatch(detailSource, /import\s+.*PcnWorkflowMap/);
    assert.doesNotMatch(detailSource, /<PcnWorkflowMap/);
    assert.doesNotMatch(detailSource, /showLegacyGraphic/);
    assert.doesNotMatch(detailSource, /data-testid="pcn-legacy-process-map"/);

    // Both snapshot-backed and adapted legacy dossiers use the seven-stage flow.
    assert.match(detailSource, /<PcnDossierFlow/);
    assert.match(detailSource, /buildLegacyStageFlowNodes/);
    assert.match(detailSource, /dossierWorkflowDetailProjection/);
    assert.match(detailSource, /PcnDossierWorkflowPanel/);
  });

  it('F10: PCN workflow renders seven accessible stage tabs with keyboard selection', () => {
    const flowSource = read('components/PcnDossierFlow.tsx');

    assert.match(flowSource, /PCN_DOSSIER_FLOW_STAGES\s*:\s*readonly PcnStageDefinition\[\]\s*=\s*\[/);
    assert.match(flowSource, /role="tablist"/);
    assert.match(flowSource, /role="tab"/);
    assert.match(flowSource, /aria-posinset=\{index \+ 1\}/);
    assert.match(flowSource, /aria-setsize=\{PCN_DOSSIER_FLOW_STAGES\.length\}/);
    assert.match(flowSource, /event\.key === 'ArrowRight'/);
    assert.match(flowSource, /event\.key === 'Home' \|\| event\.key === 'End'/);
    assert.match(flowSource, /aria-selected=\{isSelected\}/);
  });

  it('F11: Implements PCN Detail Workspace 60/40 desktop split and mobile work/reader switcher', () => {
    const detailSource = read('components/PcnDossierDetailView.tsx');

    assert.match(detailSource, /grid grid-cols-1 gap-4 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/);

    assert.match(detailSource, /data-testid="pcn-dossier-mobile-switcher"/);
    assert.match(detailSource, /Công việc\s*<\/button>/);
    assert.match(detailSource, /Xem tài liệu\s*<\/button>/);
    assert.match(detailSource, /useState<'main' \| 'auxiliary'>\('main'\)/);

    assert.match(detailSource, /dossier\.workflowSnapshot \? <PcnDossierWorkflowPanel/);
    assert.match(detailSource, /tabContent/);
    assert.match(detailSource, /<PcnDossierDocumentReader/);
    assert.match(detailSource, /<details data-testid="pcn-dossier-support"/);
  });

  it('F12: PGD Dossier Flow uses compact horizontal rail matching PgdcnWorkflowRail', () => {
    const flowSource = read('components/PgdDossierFlow.tsx');

    // Replaces 218px wide cards with a compact, locally scrollable stage rail
    assert.doesNotMatch(flowSource, /w-\[218px\]/);
    assert.match(flowSource, /overflow-x-auto overscroll-x-contain/);
    assert.match(flowSource, /touch-pan-x/);
    assert.match(flowSource, /role="tablist"/);
    assert.match(flowSource, /role="tab"/);

    assert.match(flowSource, /aria-selected=\{selected\}/);
    assert.match(flowSource, /focus-visible:ring-2 focus-visible:ring-blue-500/);
    assert.match(flowSource, /'border-blue-600 bg-blue-50 text-blue-950 shadow-xs'/);
  });

  it('F12: PGD Request Detail activates a 60/40 workspace without duplicate disclosures', () => {
    const workspaceSource = read('components/PgdWorkspace.tsx');

    // Unhidden workflow rail at top of detail view
    assert.match(workspaceSource, /<PgdDossierFlow/);

    // Stacked <details> disclosures removed
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-step-work-disclosure/);
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-workflow-disclosure/);
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-business-disclosure/);

    assert.match(workspaceSource, /grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\] lg:gap-4/);

    // Mobile work and reader tabs
    assert.match(workspaceSource, /mobileSection/);
    assert.match(workspaceSource, /id="pgd-dossier-mobile-tab-work"/);
    assert.match(workspaceSource, /id="pgd-dossier-mobile-tab-reader"/);
    assert.match(workspaceSource, /aria-selected=\{mobileSection === 'work'\}/);
    assert.match(workspaceSource, /aria-selected=\{mobileSection === 'reader'\}/);

    // Work card contains the seven-stage selector, current work and the reader is a sibling region.
    assert.match(workspaceSource, /data-testid="pgd-dossier-step-work-panel"/);
    assert.match(workspaceSource, /<PgdDossierFlow/);
    assert.match(workspaceSource, /<PgdDossierStepWorkPanel/);
    assert.match(workspaceSource, /<aside role="tabpanel"[^>]*aria-label="Đọc tài liệu hồ sơ PGD"[^>]*>\s*<PgdDossierDocumentReader/);
    assert.match(workspaceSource, /<details data-testid="pgd-dossier-secondary-disclosure"/);
  });
});
