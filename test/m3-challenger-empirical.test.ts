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

describe('PGD/PCN dossier workspace: 60/40 split & responsive adaptation', () => {

  // -------------------------------------------------------------------------
  // 1. PCN Detail Workspace 60/40 Split & Structural Integrity
  // -------------------------------------------------------------------------
  describe('1. PCN Detail Workspace (components/PcnDossierDetailView.tsx)', () => {
    const pcnSource = read('components/PcnDossierDetailView.tsx');

    it('1.1: Desktop 60/40 split keeps one column on mobile', () => {
      assert.match(
        pcnSource,
        /grid grid-cols-1 gap-4 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/,
        'PCN detail workspace must use a 3:2 work-to-reader ratio and stack on mobile'
      );
    });

    it('1.2: Work and reader columns preserve min-width boundaries and mobile switching', () => {
      assert.match(
        pcnSource,
        /<div className=\{`min-w-0 flex flex-col gap-3 \$\{mobileWorkspaceTab === 'auxiliary' \? 'hidden lg:flex' : 'flex'\}`\}>/,
        'Work column must remain min-w-0 and stay visible on desktop'
      );
      assert.match(
        pcnSource,
        /<div className=\{`min-w-0 border-l-0 lg:border-l lg:border-slate-200 lg:pl-4 \$\{mobileWorkspaceTab === 'main' \? 'hidden lg:block' : 'block'\}`\}>\s*<PcnDossierDocumentReader/,
        'Reader column must remain min-w-0 and show the document reader'
      );
    });

    it('1.3: Work stays left and reader stays right while support information is collapsed', () => {
      assert.match(pcnSource, /PcnDossierWorkflowPanel/, 'Left column must host PcnDossierWorkflowPanel');
      assert.match(pcnSource, /DossierWorkflowSummary/, 'Left column must host DossierWorkflowSummary fallback');
      assert.match(pcnSource, /\{!workflowFirst && tabContent\}/, 'Left column must host tabContent for non-workflowFirst');
      assert.match(pcnSource, /<PcnDossierDocumentReader/);
      assert.match(pcnSource, /<details data-testid="pcn-dossier-support"/);
      assert.match(pcnSource, /Thông tin hỗ trợ \(Căn cứ pháp lý, AI, Lịch sử\)/);
      const support = pcnSource.match(/<details data-testid="pcn-dossier-support"[^]*?<\/details>/)?.[0] || '';
      assert.notEqual(support, '', 'support details must exist');
      assert.doesNotMatch(support, /<details[^>]*open/);
    });

    it('1.4: Mobile adaptive tab switcher toggle mechanism', () => {
      assert.match(pcnSource, /data-testid="pcn-dossier-mobile-switcher"/);
      assert.match(pcnSource, /aria-label="Chuyển chế độ xem hồ sơ"/);
      assert.match(pcnSource, /onClick=\{\(\) => setMobileWorkspaceTab\('main'\)\}/);
      assert.match(pcnSource, /Công việc\s*<\/button>/);
      assert.match(pcnSource, /onClick=\{\(\) => setMobileWorkspaceTab\('auxiliary'\)\}/);
      assert.match(pcnSource, /Xem tài liệu\s*<\/button>/);
      assert.match(pcnSource, /aria-pressed=\{mobileWorkspaceTab === 'main'\}/);
      assert.match(pcnSource, /aria-pressed=\{mobileWorkspaceTab === 'auxiliary'\}/);
      assert.match(pcnSource, /const \[mobileWorkspaceTab, setMobileWorkspaceTab\] = useState<'main' \| 'auxiliary'>\('main'\);/);
      assert.match(pcnSource, /setSelectedReaderFileId\(file\.id\); setMobileWorkspaceTab\('auxiliary'\)/);
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
  // 2. PGD Detail Workspace 60/40 Split & Removal of Stacked Details
  // -------------------------------------------------------------------------
  describe('2. PGD Detail Workspace (components/PgdWorkspace.tsx)', () => {
    const pgdSource = read('components/PgdWorkspace.tsx');

    it('2.1: Desktop 60/40 split stacks on mobile', () => {
      assert.match(
        pgdSource,
        /grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\] lg:gap-4/,
        'PGD detail workspace must use a 3:2 work-to-reader ratio and stack on mobile'
      );
    });

    it('2.2: Removal of all 4 stacked <details> disclosure blocks in PgdRequestDetail', () => {
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-step-work-disclosure/);
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-workflow-disclosure/);
      assert.doesNotMatch(pgdSource, /<details[^>]*pgd-dossier-business-disclosure/);
    });

    it('2.3: Seven-stage rail and current work panel are mounted inside the left work card', () => {
      assert.match(
        pgdSource,
        /data-testid="pgd-dossier-step-work-panel"[^]*?<PgdDossierFlow status=\{request\.status\} workflowSchemaVersion=\{workflowSchemaVersion\} evidence=\{context\} selectedStepId=\{selectedStepId\} onSelectStep=\{setSelectedStepId\} \/>[^]*?<PgdDossierStepWorkPanel/,
        'The stage rail and selected stage actions must share the left work card'
      );
      assert.match(pgdSource, /<PgdDossierDocumentReader/);
    });

    it('2.4: Work content stays left and support details remain collapsed', () => {
      // Left column: customer summary cards (4 cols on lg), PgdDossierStepWorkPanel
      assert.match(pgdSource, /grid gap-2 sm:grid-cols-2 lg:grid-cols-4/, 'Summary cards must preserve 4-column layout on desktop');
      assert.match(pgdSource, /data-testid="pgd-dossier-step-work-panel"/);
      assert.match(pgdSource, /data-testid="pgd-workspace-assignment-forms"[\s\S]*?Phân công đã ghi nhận/);
      assert.match(pgdSource, /Trưởng đoàn:[\s\S]*?Chuyên gia đánh giá:[\s\S]*?Thẩm xét:[\s\S]*?Văn phòng:[\s\S]*?Lưu trữ:/);
      assert.match(pgdSource, /Hiện trường, lấy mẫu và bàn giao PTN/);
      assert.match(pgdSource, /Kết quả PTN và báo cáo \/ chứng thư linh hoạt/);

      assert.match(pgdSource, /<details data-testid="pgd-dossier-secondary-disclosure"/);
      assert.match(pgdSource, /Thông tin liên quan · trợ lý, căn cứ và lịch sử/);
      const support = pgdSource.match(/<details data-testid="pgd-dossier-secondary-disclosure"[^]*?<\/details>/)?.[0] || '';
      assert.notEqual(support, '', 'support details must exist');
      assert.doesNotMatch(support, /<details[^>]*open/);
      assert.match(pgdSource, /<aside role="tabpanel"[^>]*aria-label="Đọc tài liệu hồ sơ PGD"[^>]*>\s*<PgdDossierDocumentReader/);
    });

    it('2.5: Mobile adaptive tab switcher toggle mechanism for PGD', () => {
      assert.match(pgdSource, /role="tablist" aria-label="Chuyển vùng hồ sơ PGD"/);
      assert.match(pgdSource, /onClick=\{\(\) => setMobileSection\('work'\)\}/);
      assert.match(pgdSource, /id="pgd-dossier-mobile-tab-reader"[\s\S]*?onClick=\{\(\) => setMobileSection\('reader'\)\}[\s\S]*?Xem tài liệu/);
      assert.match(pgdSource, /aria-selected=\{mobileSection === 'work'\}/);
      assert.match(pgdSource, /aria-selected=\{mobileSection === 'reader'\}/);
      assert.match(pgdSource, /const \[mobileSection, setMobileSection\] = useState<'work' \| 'reader'>\('work'\);/);
      assert.match(pgdSource, /setSelectedReaderDocId\(docId\); setMobileSection\('reader'\)/);
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

    it('4.1: Compact flow renders seven numbered, keyboard-accessible stage tabs', () => {
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

      // Selected styling and keyboard focus styling remain distinct.
      assert.ok(html.includes('border-blue-600 bg-blue-50 text-blue-950'), 'Active step must have selected styling');
      assert.ok(html.includes('focus-visible:ring-2 focus-visible:ring-blue-500'), 'Active step must have visible keyboard focus styling');

      // Verify all 7 stages are rendered in tablist
      for (const step of PGD_DOSSIER_FLOW_STEPS) {
        const expectedLabel = step.label.replace('&', '&amp;');
        assert.ok(html.includes(expectedLabel), `Must render step: ${step.label}`);
      }

      // The scroller stays inside the card; focus styling is separate from selection styling.
      assert.ok(html.includes('overflow-x-auto overscroll-x-contain touch-pan-x'));
      assert.ok(html.includes('role="tablist"'));
      assert.ok(html.includes('role="tab"'));
      assert.ok(html.includes('focus-visible:ring-2 focus-visible:ring-blue-500'));
      assert.equal((html.match(/aria-selected="true"/g) || []).length, 1, 'exactly one stage tab is selected');
      assert.equal((html.match(/role="tab"/g) || []).length, 7, 'all seven stage tabs are rendered');
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

    it('5.1: Customer and product header fallbacks remain explicit', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      assert.match(pcnSource, /proposal\?\.productName \|\| 'Hồ sơ chứng nhận'\} · \{customerSnapshot\?\.name \|\| 'Chưa gắn khách hàng'/);
    });

    it('5.2: Extra-long text boundary protection (truncate and break-words)', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      const pgdSource = read('components/PgdWorkspace.tsx');

      assert.match(pcnSource, /className="break-words text-sm font-black text-slate-800"/);
      assert.match(pcnSource, /min-w-0[\s\S]*?overflow-x-hidden/);
      assert.match(pgdSource, /className="break-words text-sm font-black text-slate-800"/);
      assert.match(pgdSource, /min-w-0 grid-cols-1 gap-3 lg:grid-cols-/);
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
      const pgdSource = read('components/PgdDossierStepWorkPanel.tsx');

      assert.match(pcnSource, /missingRequiredCount > 0 \? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'/);
      assert.match(pcnSource, /missingRequiredCount > 0 \? `Toàn bộ hồ sơ còn thiếu \$\{missingRequiredCount\} tài liệu bắt buộc` : 'Toàn bộ hồ sơ đã đủ tài liệu bắt buộc hoặc đã có đánh dấu bỏ qua'/);
      assert.match(pgdSource, /const missingStepRequirements = requiredStepRequirements\.filter\(\(item\) => !currentDocumentsByCode\.has\(item\.code\) && !waivedRequirementCodes\.has\(item\.code\)\)/);
      assert.match(pgdSource, /data-testid="pgd-step-missing-requirements" className="mt-1 text-xs leading-5 text-amber-900"/);
      assert.match(pgdSource, /Còn thiếu \{missingRequiredCount\} tài liệu bắt buộc ở giai đoạn này/);
      assert.match(pgdSource, /Đã có hoặc được miễn toàn bộ tài liệu bắt buộc ở giai đoạn này/);
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

      const auxiliarySection = pcnSource.match(/<details data-testid="pcn-dossier-support"[^]*?<\/details>/)?.[0] || '';
      assert.notEqual(auxiliarySection, '', 'support information must stay in its disclosure');
      assert.doesNotMatch(auxiliarySection, /text-\[9px\]/, 'Auxiliary panels must not use text-[9px]');
      assert.doesNotMatch(auxiliarySection, /text-\[10px\]/, 'Auxiliary panels must not use text-[10px]');
      assert.match(auxiliarySection, /text-\[11px\]/, 'Auxiliary panels must strictly use text-[11px] or text-xs for readability');
    });

    it('5.7: Viewport adaptability: Desktop grid vs Mobile tab switcher visibility matrix', () => {
      const pcnSource = read('components/PcnDossierDetailView.tsx');
      const pgdSource = read('components/PgdWorkspace.tsx');

      // Check switcher visibility: flex on mobile, hidden on lg desktop
      assert.match(pcnSource, /data-testid="pcn-dossier-mobile-switcher"[^>]*lg:hidden/);
      assert.match(pgdSource, /role="tablist" aria-label="Chuyển vùng hồ sơ PGD"[^>]*flex lg:hidden/);

      // Work and reader regions remain visible at desktop breakpoints.
      assert.match(pcnSource, /hidden lg:flex/);
      assert.match(pcnSource, /hidden lg:block/);
      assert.match(pgdSource, /hidden lg:flex/);
      assert.match(pgdSource, /hidden lg:block/);
    });
  });

});
