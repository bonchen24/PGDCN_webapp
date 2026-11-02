import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PgdcnWorkflowRail,
  type PgdcnWorkflowStepItem,
} from '../components/PgdcnUiPrimitives.tsx';

import {
  PgdDossierFlow,
  PGD_DOSSIER_FLOW_STEPS,
  getPgdDossierCurrentStepNumber,
  getPgdDossierFlowStepIdForStatus,
} from '../components/PgdDossierFlow.tsx';

import type { PgdInspectionStatus, PgdTransitionContext } from '../utils/pgdDomain.ts';

const rootDir = path.resolve(import.meta.dirname, '..');
const read = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

describe('Challenger M3-1 Empirical Probing: 65/35 Split & Responsive Adaptation', () => {

  // -------------------------------------------------------------------------
  // 1. PCN Detail Workspace 65/35 Split & Structural Integrity
  // -------------------------------------------------------------------------
  describe('1. PCN Detail Workspace (components/PcnDossierDetailView.tsx)', () => {
    const pcnSource = read('components/PcnDossierDetailView.tsx');

    it('1.1: Desktop 65/35 split grid tokens and breakpoint progression', () => {
      // Must feature single column on mobile, 65/35 on desktop (lg), and 68/32 on wide screens (xl)
      assert.match(
        pcnSource,
        /grid grid-cols-1 lg:grid-cols-\[65%_35%\] xl:grid-cols-\[68%_32%\] gap-4/,
        'PCN detail workspace must define responsive grid: 1-col mobile, 65/35 on lg, 68/32 on xl'
      );
    });

    it('1.2: Left (65%) and Right (35%) columns preserve container min-w-0 to prevent flex blowout', () => {
      // Left column min-w-0 prevents wide content (like tables or long text) from expanding the column past 65%
      assert.match(
        pcnSource,
        /<div className=\{`min-w-0 flex flex-col gap-3 \$\{mobileWorkspaceTab === 'auxiliary' \? 'hidden lg:flex' : 'flex'\}`\}>/,
        'Left column must use min-w-0 and lg:flex to maintain strict width adherence'
      );

      // Right column min-w-0 with border separator on desktop
      assert.match(
        pcnSource,
        /<div className=\{`min-w-0 flex flex-col gap-3 border-l-0 lg:border-l lg:border-slate-200 lg:pl-4 \$\{mobileWorkspaceTab === 'main' \? 'hidden lg:flex' : 'flex'\}`\}>/,
        'Right column must use min-w-0, border separation on desktop, and lg:flex'
      );
    });

    it('1.3: Content distribution aligns with 65/35 operational split specification', () => {
      // Left column contains operational workflow panel, forms, and document checklist
      assert.match(pcnSource, /PcnDossierWorkflowPanel/, 'Left column must host PcnDossierWorkflowPanel');
      assert.match(pcnSource, /DossierWorkflowSummary/, 'Left column must host DossierWorkflowSummary fallback');
      assert.match(pcnSource, /\{!workflowFirst && tabContent\}/, 'Left column must host tabContent for non-workflowFirst');

      // Right column contains auxiliary panels: Live preview, legal standards QC20, AI assistant, activity log
      assert.match(pcnSource, /Xem trước & Hồ sơ/, 'Right column must host Live Preview & Package Summary');
      assert.match(pcnSource, /Căn cứ pháp lý & Quy chuẩn/, 'Right column must host Standards & Legal Basis');
      assert.match(pcnSource, /Trợ lý AI TVCI/, 'Right column must host AI Assistant panel');
      assert.match(pcnSource, /Lịch sử hoạt động/, 'Right column must host Activity History');
    });

    it('1.4: Mobile adaptive tab switcher toggle mechanism', () => {
      // Mobile switcher is hidden on desktop (flex lg:hidden)
      assert.match(pcnSource, /className="flex lg:hidden items-center gap-1\.5 mb-3 p-1 rounded-lg bg-slate-100 border border-slate-200"/);

      // Tab 1: Main (65%)
      assert.match(pcnSource, /onClick=\{\(\) => setMobileWorkspaceTab\('main'\)\}/);
      assert.match(pcnSource, /Công việc & Checklist \(Chính 65%\)/);

      // Tab 2: Auxiliary (35%)
      assert.match(pcnSource, /onClick=\{\(\) => setMobileWorkspaceTab\('auxiliary'\)\}/);
      assert.match(pcnSource, /Xem trước & Trợ lý \(Phụ 35%\)/);

      // State default is 'main'
      assert.match(pcnSource, /const \[mobileWorkspaceTab, setMobileWorkspaceTab\] = useState<'main' \| 'auxiliary'>\('main'\);/);
    });

    it('1.5: Total eradication of PcnWorkflowMap and legacy node graphics', () => {
      assert.doesNotMatch(pcnSource, /import\s+.*PcnWorkflowMap/, 'Must have no import of PcnWorkflowMap');
      assert.doesNotMatch(pcnSource, /<PcnWorkflowMap/, 'Must have no JSX usage of PcnWorkflowMap');
      assert.doesNotMatch(pcnSource, /showLegacyGraphic/, 'Must have no legacy graphic toggle');
      assert.doesNotMatch(pcnSource, /pcn-legacy-process-map/, 'Must have no legacy node map test id');
    });

    it('1.6: Preservation of workflowFirst deep-link compatibility', () => {
      assert.match(pcnSource, /const workflowFirst = Boolean\(dossier\.workflowSnapshot\) && !workspaceExpanded;/);
      assert.match(pcnSource, /\{!workflowFirst && <DossierRegionSelector/);
      assert.match(pcnSource, /\{!workflowFirst && tabContent\}/);
      assert.match(pcnSource, /\{!workflowFirst && <footer/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. PGD Detail Workspace 65/35 Split & Removal of Stacked Details
  // -------------------------------------------------------------------------
  describe('2. PGD Detail Workspace (components/PgdWorkspace.tsx)', () => {
    const pgdSource = read('components/PgdWorkspace.tsx');

    it('2.1: Desktop 65/35 split grid tokens and breakpoint progression', () => {
      assert.match(
        pgdSource,
        /grid grid-cols-1 lg:grid-cols-\[65%_35%\] xl:grid-cols-\[68%_32%\] gap-4/,
        'PGD detail workspace must define responsive grid: 1-col mobile, 65/35 on lg, 68/32 on xl'
      );
    });

    it('2.2: Removal of all 4 stacked <details> disclosure blocks in PgdRequestDetail', () => {
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-step-work-disclosure/);
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-workflow-disclosure/);
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-business-disclosure/);
    });

    it('2.3: Unhidden compact horizontal flow rail mounted at the top of detail view', () => {
      assert.match(
        pgdSource,
        /<div className="mt-3">\s*<PgdDossierFlow status=\{request\.status\} evidence=\{context\} selectedStepId=\{selectedStepId\} onSelectStep=\{setSelectedStepId\} \/>\s*<\/div>/,
        'PgdDossierFlow must be unhidden and mounted at the top above the 65/35 split'
      );
    });

    it('2.4: Left (65%) and Right (35%) column content layout and responsive toggling', () => {
      // Left column: customer summary cards (4 cols on lg), PgdDossierStepWorkPanel
      assert.match(pgdSource, /grid gap-2 sm:grid-cols-2 lg:grid-cols-4/, 'Summary cards must preserve 4-column layout on desktop');
      assert.match(pgdSource, /data-testid="pgd-dossier-step-work-panel"/);
      assert.match(pgdSource, /Phân công theo năng lực/);
      assert.match(pgdSource, /Hiện trường, lấy mẫu và bàn giao PTN/);
      assert.match(pgdSource, /Kết quả PTN và báo cáo \/ chứng thư linh hoạt/);

      // Right column: AI assistant, QC20 guidelines, business workspace, evidence, forms
      assert.match(pgdSource, /Trợ lý hồ sơ PGD/);
      assert.match(pgdSource, /Tiêu chuẩn & Căn cứ kỹ thuật \(QC20\)/);
      assert.match(pgdSource, /<PgdDossierBusinessWorkspace/);
      assert.match(pgdSource, /<PgdCaseEvidencePanel/);
      assert.match(pgdSource, /<PgdSourceFormsPanel/);
      assert.match(pgdSource, /Cổng tiếp theo/);
    });

    it('2.5: Mobile adaptive tab switcher toggle mechanism for PGD', () => {
      // Mobile switcher is hidden on desktop (flex lg:hidden)
      assert.match(pgdSource, /className="flex lg:hidden items-center gap-1\.5 mt-3 p-1 rounded-lg bg-slate-100 border border-slate-200"/);

      // Tab 1: Work (65%)
      assert.match(pgdSource, /onClick=\{\(\) => setMobileSection\('work'\)\}/);
      assert.match(pgdSource, /Checklist & Thao tác \(Chính 65%\)/);

      // Tab 2: Auxiliary (35%)
      assert.match(pgdSource, /onClick=\{\(\) => setMobileSection\('auxiliary'\)\}/);
      assert.match(pgdSource, /Hồ sơ & Trợ lý \(Phụ 35%\)/);

      // State default is 'work'
      assert.match(pgdSource, /const \[mobileSection, setMobileSection\] = useState<'work' \| 'auxiliary'>\('work'\);/);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Component Static Markup & Empirical Rendering Stress-Testing
  // -------------------------------------------------------------------------
  describe('3. Empirical Component Rendering: PgdcnWorkflowRail', () => {

    it('3.1: Renders active step highlight ring (ring-2 ring-indigo-500) and aria-current="step"', () => {
      const steps: PgdcnWorkflowStepItem[] = [
        { id: 'step-1', label: 'Tiếp nhận', state: 'complete' },
        { id: 'step-2', label: 'Đánh giá hiện trường', state: 'current', checklistCount: { completed: 3, total: 5 } },
        { id: 'step-3', label: 'Thử nghiệm mẫu', state: 'upcoming' },
        { id: 'step-4', label: 'Bị chặn', state: 'blocked' },
      ];

      const html = renderToStaticMarkup(
        React.createElement(PgdcnWorkflowRail, { steps })
      );

      // Active step
      assert.ok(html.includes('aria-current="step"'), 'Current step must have aria-current="step"');
      assert.ok(html.includes('ring-2 ring-indigo-500 ring-offset-1'), 'Current step must have indigo focus ring');
      assert.ok(html.includes('(3/5 việc)'), 'Current step must display formatted checklist count');

      // Complete step
      assert.ok(html.includes('border-emerald-200 bg-emerald-50 text-emerald-800'), 'Completed step must have emerald style');

      // Blocked step
      assert.ok(html.includes('border-rose-200 bg-rose-50 text-rose-800'), 'Blocked step must have rose style');

      // Touch scroll container
      assert.ok(html.includes('mobile-scroll-x min-w-0 overflow-x-auto scroll-smooth touch-pan-x'));
    });

    it('3.2: Handles empty steps array gracefully without exception', () => {
      const html = renderToStaticMarkup(
        React.createElement(PgdcnWorkflowRail, { steps: [] })
      );
      assert.ok(html.includes('role="list"'));
      assert.ok(!html.includes('role="listitem"'));
    });

    it('3.3: Stress test: Massive 25-step rail renders with clean numbering and no layout break', () => {
      const longSteps: PgdcnWorkflowStepItem[] = Array.from({ length: 25 }, (_, i) => ({
        id: `step-${i + 1}`,
        label: `Bước quy trình số ${i + 1} với tên dài kiểm tra overflow`,
        state: i < 10 ? 'complete' : i === 10 ? 'current' : 'upcoming',
        checklistCount: i === 10 ? { completed: 4, total: 4 } : undefined,
      }));

      const html = renderToStaticMarkup(
        React.createElement(PgdcnWorkflowRail, { steps: longSteps })
      );

      assert.ok(html.includes('Bước quy trình số 25'), 'Must render all 25 steps');
      assert.ok(html.includes('(4/4 việc)'), 'Must render 4/4 việc on current step');
      assert.ok(html.includes('min-w-max'), 'Container must use min-w-max for horizontal rail swiping');
    });
  });

  describe('4. Empirical Component Rendering: PgdDossierFlow', () => {

    it('4.1: Compact horizontal flow rail renders 7 stages matching PgdcnWorkflowRail ergonomics', () => {
      const dummyEvidence: PgdTransitionContext = {
        hasApprovedAssignment: true,
        hasFieldInspection: true,
        hasSampleHandover: false,
        labRequests: [],
        reportReady: false,
        hasCertificate: false,
        signed: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(PgdDossierFlow, {
          status: 'FIELD_INSPECTION',
          evidence: dummyEvidence,
          selectedStepId: 'execution',
          onSelectStep: () => undefined,
        })
      );

      // Verify removal of legacy 218px width
      assert.ok(!html.includes('w-[218px]'), 'Must not contain legacy w-[218px] card classes');

      // Verify active step highlight: ring-2 ring-blue-500
      assert.ok(html.includes('ring-2 ring-blue-500 ring-offset-1'), 'Active step must have blue highlight ring');

      // Verify all 7 stages are rendered in tablist
      for (const step of PGD_DOSSIER_FLOW_STEPS) {
        const expectedLabel = step.label.replace('&', '&amp;');
        assert.ok(html.includes(expectedLabel), `Must render step: ${step.label}`);
      }

      // Verify touch scrolling classes
      assert.ok(html.includes('mobile-scroll-x min-w-0 overflow-x-auto scroll-smooth touch-pan-x'));
      assert.ok(html.includes('role="tablist"'));
      assert.ok(html.includes('role="tab"'));
    });

    it('4.2: Step status computation across lifecycle stages', () => {
      assert.equal(getPgdDossierCurrentStepNumber('DRAFT'), 1);
      assert.equal(getPgdDossierCurrentStepNumber('CAPABILITY_REVIEW'), 2);
      assert.equal(getPgdDossierCurrentStepNumber('READY_TO_EXECUTE'), 2);
      assert.equal(getPgdDossierCurrentStepNumber('PREPARING'), 3);
      assert.equal(getPgdDossierCurrentStepNumber('FIELD_INSPECTION'), 4);
      assert.equal(getPgdDossierCurrentStepNumber('WAITING_LAB_RESULTS'), 5);
      assert.equal(getPgdDossierCurrentStepNumber('RESULTS_REVIEW'), 5);
      assert.equal(getPgdDossierCurrentStepNumber('TECHNICAL_REVIEW'), 6);
      assert.equal(getPgdDossierCurrentStepNumber('LEADERSHIP_APPROVAL'), 6);
      assert.equal(getPgdDossierCurrentStepNumber('SIGNED'), 7);

      // Step ID lookup
      assert.equal(getPgdDossierFlowStepIdForStatus('DRAFT'), 'intake');
      assert.equal(getPgdDossierFlowStepIdForStatus('FIELD_INSPECTION'), 'execution');
      assert.equal(getPgdDossierFlowStepIdForStatus('LEADERSHIP_APPROVAL'), 'reporting-approval');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Boundary Condition & Adversarial Edge Cases
  // -------------------------------------------------------------------------
  describe('5. Adversarial Edge Cases & Boundary Probing', () => {

    it('5.1: Missing Customer Snapshot fallback resilience', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      // Verify fallback string when customerSnapshot?.name is missing
      assert.match(pcnSource, /customerSnapshot\?\.name \|\| 'Chưa gắn khách hàng'/);
      assert.match(pcnSource, /proposal\?\.productName \|\| 'Hồ sơ chứng nhận'/);
      assert.match(pcnSource, /proposal\?\.proposalCode \|\| 'Chưa có mã Đề nghị'/);
    });

    it('5.2: Extra-long text boundary protection (truncate and break-words)', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      const pgdSource = read('components/PgdWorkspace.tsx');

      // PCN header title has break-words to prevent layout blowout from 500+ character customer/product names
      assert.match(pcnSource, /break-words text-base font-black text-slate-800/);

      // PCN context summary badges truncate long strings
      assert.match(pcnSource, /max-w-full truncate rounded-full border border-slate-200/);

      // PGD header title has break-words
      assert.match(pgdSource, /break-words text-base font-black text-slate-800/);

      // PGD context summary badges truncate long strings
      assert.match(pgdSource, /max-w-full truncate rounded-full border border-slate-200/);
    });

    it('5.3: Zero / Missing checklist badge formatting in PgdcnWorkflowRail', () => {
      const stepWithZero: PgdcnWorkflowStepItem = {
        id: 'zero-checklist',
        label: 'Không có checklist',
        state: 'current',
        checklistCount: { completed: 0, total: 0 },
      };

      const html = renderToStaticMarkup(
        React.createElement(PgdcnWorkflowRail, { steps: [stepWithZero] })
      );

      // Renders (0/0 việc) cleanly without NaN or division error
      assert.ok(html.includes('(0/0 việc)'), 'Must render (0/0 việc) safely');
    });

    it('5.4: Missing Required Count tone indicator (Amber for missing, Emerald for complete)', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      const pgdSource = read('components/PgdWorkspace.tsx');

      // PCN: missingRequiredCount > 0 triggers amber border/bg
      assert.match(pcnSource, /missingRequiredCount > 0 \? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'/);
      assert.match(pcnSource, /missingRequiredCount > 0 \? `Còn \$\{missingRequiredCount\} tài liệu bắt buộc` : 'Đủ tài liệu bắt buộc'/);

      // PGD: missingRequiredCount > 0 triggers amber border/bg
      assert.match(pgdSource, /missingRequiredCount > 0 \? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'/);
      assert.match(pgdSource, /missingRequiredCount > 0 \? `Còn \$\{missingRequiredCount\} đầu mục bắt buộc` : 'Đủ đầu mục bắt buộc'/);
    });

    it('5.5: Adversarial probe: Out-of-order forward step navigation clamping in reconcilePgdDossierStepSelection', async () => {
      const { reconcilePgdDossierStepSelection } = await import('../components/PgdWorkspace.tsx');

      // Attack: User tries to tamper with URL ?step=approval or jump directly to step 6 while dossier is in DRAFT (step 1)
      const clampedStep = reconcilePgdDossierStepSelection({
        selectedStepId: 'reporting-approval',
        status: 'DRAFT',
        requestId: 'req-1',
        initialStepId: 'reporting-approval',
        previousContext: { requestId: 'req-1', initialStepId: 'reporting-approval' },
      });
      assert.equal(clampedStep, 'intake', 'Forward navigation to step 6 while at step 1 must be clamped to current step intake');

      // Permitted: User inspects a previous step that was already passed (e.g. step 2 while at step 4)
      const allowedPastStep = reconcilePgdDossierStepSelection({
        selectedStepId: 'review-assignment',
        status: 'FIELD_INSPECTION',
        requestId: 'req-1',
        initialStepId: undefined,
        previousContext: { requestId: 'req-1' },
      });
      assert.equal(allowedPastStep, 'review-assignment', 'Backwards navigation to previous completed steps is permitted');
    });

    it('5.6: Typography strictness: PCN Detail auxiliary panels adhere to >= 11px standard', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');

      // Right column auxiliary panels must not contain illegible tiny fonts (text-[9px] or text-[10px])
      const auxiliarySection = pcnSource.slice(pcnSource.indexOf('Right Column (30-35%)'));
      assert.doesNotMatch(auxiliarySection, /text-\[9px\]/, 'Auxiliary panels must not use text-[9px]');
      assert.doesNotMatch(auxiliarySection, /text-\[10px\]/, 'Auxiliary panels must not use text-[10px]');
      assert.match(auxiliarySection, /text-\[11px\]/, 'Auxiliary panels must strictly use text-[11px] or text-xs for readability');
    });

    it('5.7: Viewport adaptability: Desktop grid vs Mobile tab switcher visibility matrix', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      const pgdSource = read('components/PgdWorkspace.tsx');

      // Check switcher visibility: flex on mobile, hidden on lg desktop
      assert.match(pcnSource, /flex lg:hidden/);
      assert.match(pgdSource, /flex lg:hidden/);

      // Check column visibility on lg desktop: always flex (lg:flex) regardless of mobile tab state
      assert.match(pcnSource, /hidden lg:flex/);
      assert.match(pgdSource, /hidden lg:flex/);
    });
  });

});
