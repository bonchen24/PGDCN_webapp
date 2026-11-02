import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');
const read = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

describe('Milestone 3: Detail Workspace 65/35 & Horizontal Workflow Rail (F09-F12)', () => {
  it('F09: Completely removes PcnWorkflowMap and legacy graphics from PCN Detail Workspace', () => {
    const detailSource = read('components/PcnDossierDetailView.tsx');

    // Asserts no import or JSX usage of PcnWorkflowMap
    assert.doesNotMatch(detailSource, /import\s+.*PcnWorkflowMap/);
    assert.doesNotMatch(detailSource, /<PcnWorkflowMap/);
    assert.doesNotMatch(detailSource, /showLegacyGraphic/);
    assert.doesNotMatch(detailSource, /data-testid="pcn-legacy-process-map"/);

    // Operational UI renders workflow rail and workflow panel instead
    assert.match(detailSource, /<PgdcnWorkflowRail/);
    assert.match(detailSource, /PcnDossierWorkflowPanel/);
  });

  it('F10: Enhances PgdcnWorkflowRail with accent ring, checklist badge, and smooth horizontal touch scroll', () => {
    const primitivesSource = read('components/PgdcnUiPrimitives.tsx');

    // Current step accent ring and highlight
    assert.match(primitivesSource, /ring-2 ring-indigo-500 ring-offset-1/);
    assert.match(primitivesSource, /border-indigo-400 bg-indigo-50\/90 text-indigo-950 font-black/);

    // Checklist badge count formatting
    assert.match(primitivesSource, /checklistCount\?:\s*\{\s*completed:\s*number;\s*total:\s*number\s*\}/);
    assert.match(primitivesSource, /step\.checklistCount\s*\?\s*`\$\{step\.checklistCount\.completed\}\/\$\{step\.checklistCount\.total\}\s*việc`/);

    // Smooth horizontal touch scrolling
    assert.match(primitivesSource, /mobile-scroll-x/);
    assert.match(primitivesSource, /overflow-x-auto/);
    assert.match(primitivesSource, /scroll-smooth/);
    assert.match(primitivesSource, /touch-pan-x/);

    // Semantic list accessibility
    assert.match(primitivesSource, /role="list"/);
    assert.match(primitivesSource, /role="listitem"/);
    assert.match(primitivesSource, /aria-current=\{step\.state === 'current' \? 'step' : undefined\}/);
  });

  it('F11: Implements PCN Detail Workspace 65/35 desktop split and mobile tab switcher', () => {
    const detailSource = read('components/PcnDossierDetailView.tsx');

    // Desktop 65/35 layout tokens
    assert.match(detailSource, /grid grid-cols-1 lg:grid-cols-\[65%_35%\] xl:grid-cols-\[68%_32%\] gap-4/);

    // Mobile adaptive workspace mode switcher
    assert.match(detailSource, /mobileWorkspaceTab/);
    assert.match(detailSource, /Công việc & Checklist \(Chính 65%\)/);
    assert.match(detailSource, /Xem trước & Trợ lý \(Phụ 35%\)/);

    // Left Column (65%): Form inputs, PcnDossierNodeWorkPanel, and checklist
    assert.match(detailSource, /dossier\.workflowSnapshot \? <PcnDossierWorkflowPanel/);
    assert.match(detailSource, /tabContent/);

    // Right Column (35%): Live preview, legal standards, AI assistant, activity logs
    assert.match(detailSource, /Xem trước & Hồ sơ/);
    assert.match(detailSource, /Căn cứ pháp lý & Quy chuẩn/);
    assert.match(detailSource, /Trợ lý AI TVCI/);
    assert.match(detailSource, /Lịch sử hoạt động/);
  });

  it('F12: PGD Dossier Flow uses compact horizontal rail matching PgdcnWorkflowRail', () => {
    const flowSource = read('components/PgdDossierFlow.tsx');

    // Replaces 218px wide cumbrous cards with compact horizontal rail
    assert.doesNotMatch(flowSource, /w-\[218px\]/);
    assert.match(flowSource, /mobile-scroll-x/);
    assert.match(flowSource, /scroll-smooth/);
    assert.match(flowSource, /touch-pan-x/);
    assert.match(flowSource, /role="tablist"/);
    assert.match(flowSource, /role="tab"/);

    // Prominent highlight on active step
    assert.match(flowSource, /ring-2 ring-blue-500 ring-offset-1/);
  });

  it('F12: PGD Request Detail activates unhidden 65/35 desktop workspace without stacked disclosures', () => {
    const workspaceSource = read('components/PgdWorkspace.tsx');

    // Unhidden workflow rail at top of detail view
    assert.match(workspaceSource, /<PgdDossierFlow/);

    // Stacked <details> disclosures removed
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-step-work-disclosure/);
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-workflow-disclosure/);
    assert.doesNotMatch(workspaceSource, /<details[^>]*pgd-dossier-business-disclosure/);

    // Desktop 65/35 layout active
    assert.match(workspaceSource, /grid-cols-1 lg:grid-cols-\[65%_35%\] xl:grid-cols-\[68%_32%\] gap-4/);

    // Mobile adaptive tab switcher
    assert.match(workspaceSource, /mobileSection/);
    assert.match(workspaceSource, /Checklist & Thao tác \(Chính 65%\)/);
    assert.match(workspaceSource, /Hồ sơ & Trợ lý \(Phụ 35%\)/);

    // Left Column (65%): Quick customer info (4 cards) and PgdDossierStepWorkPanel
    assert.match(workspaceSource, /data-testid="pgd-dossier-step-work-panel"/);
    assert.match(workspaceSource, /lg:grid-cols-4/);

    // Right Column (35%): AI Assistant, Standards/Scope (QC20), Business workspace
    assert.match(workspaceSource, /Trợ lý hồ sơ PGD/);
    assert.match(workspaceSource, /Tiêu chuẩn & Căn cứ kỹ thuật \(QC20\)/);
    assert.match(workspaceSource, /<PgdDossierBusinessWorkspace/);
  });
});
