/**
 * @file m3-challenger-rail-checklist.test.ts
 * @description Independent Empirical Adversarial Stress Testing Suite for Milestone 3:
 * Horizontal Workflow Rail, Checklist Count Badges, and PGD Dossier Flow Rail.
 *
 * Covers:
 * 1. PgdcnWorkflowRail empirical component rendering & stress harness
 *    - Active step ring highlight (ring-indigo-500)
 *    - Checklist count badge edge cases (undefined, 0/0, 0/5, 5/5, 8/5, 1000/2000, custom badge override, parens formatting)
 *    - Step boundaries (first step, last step, single step, empty array)
 *    - Touch scrolling and responsive styling (touch-pan-x, mobile-scroll-x, overflow-x-auto)
 *    - Interactive click handlers and cursor-pointer states
 * 2. PgdDossierFlow empirical component rendering & stress harness
 *    - Elimination of heavy 218px cards
 *    - Active step ring highlight (ring-blue-500)
 *    - First step (intake) vs Last step (return) boundary checks & ChevronRight count
 *    - Lifecycle progression & step locking (DRAFT, FIELD_INSPECTION, LEADERSHIP_APPROVAL, ARCHIVED)
 *    - Fallback behavior on invalid step IDs, unknown statuses, and missing evidence
 *    - Verified step completion styling with evidence
 * 3. Subsystem Domain Isolation & Accessibility
 *    - Color tokens: PCN (indigo) vs PGD (blue)
 *    - ARIA roles and semantics: list/listitem vs tablist/tab
 */

import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PgdcnWorkflowRail,
  type PgdcnWorkflowStepItem,
} from '../components/PgdcnUiPrimitives.tsx';

import PgdDossierFlow, {
  PGD_DOSSIER_FLOW_STEPS,
  getPgdDossierCurrentStepNumber,
  getPgdDossierFlowStepIdForStatus,
  type PgdDossierFlowStepId,
} from '../components/PgdDossierFlow.tsx';

import type { PgdInspectionStatus, PgdTransitionContext } from '../utils/pgdDomain.ts';

// ============================================================================
// SUITE 1: PgdcnWorkflowRail Empirical Component Rendering & Stress Harness
// ============================================================================

describe('Empirical Suite 1: PgdcnWorkflowRail Rendering & Boundary Stress Testing', () => {

  it('1.1: Active step highlight ring (ring-indigo-500) applied exclusively to current step', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      { id: 'step-1', label: 'Tiếp nhận', state: 'complete' },
      { id: 'step-2', label: 'Đánh giá', state: 'current' },
      { id: 'step-3', label: 'Thử nghiệm', state: 'upcoming' },
      { id: 'step-4', label: 'Bị chặn', state: 'blocked' },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps }));
    const $ = cheerio.load(html);

    const items = $('[role="listitem"]');
    assert.equal(items.length, 4, 'Must render exactly 4 step items');

    // Step 2 is 'current'
    const step2 = items.eq(1);
    const step2Class = step2.attr('class') || '';
    assert.ok(step2Class.includes('ring-2'), 'Current step must have ring-2');
    assert.ok(step2Class.includes('ring-indigo-500'), 'Current step must have ring-indigo-500');
    assert.ok(step2Class.includes('ring-offset-1'), 'Current step must have ring-offset-1');
    assert.ok(step2Class.includes('border-indigo-400'), 'Current step must have border-indigo-400');
    assert.ok(step2Class.includes('bg-indigo-50/90'), 'Current step must have bg-indigo-50/90');
    assert.ok(step2Class.includes('text-indigo-950'), 'Current step must have text-indigo-950');
    assert.equal(step2.attr('aria-current'), 'step', 'Current step must have aria-current="step"');

    // Number bubble for current step
    const step2Number = step2.find('span').first();
    assert.ok((step2Number.attr('class') || '').includes('bg-indigo-600'), 'Current step number must have bg-indigo-600');
    assert.ok((step2Number.attr('class') || '').includes('text-white'), 'Current step number must be white text');
    assert.equal(step2Number.text().trim(), '2', 'Must display 1-based step index "2"');

    // Non-current steps (1, 3, 4) must NOT have current ring or aria-current
    for (const idx of [0, 2, 3]) {
      const other = items.eq(idx);
      const otherClass = other.attr('class') || '';
      assert.ok(!otherClass.includes('ring-indigo-500'), `Step ${idx + 1} must NOT have ring-indigo-500`);
      assert.equal(other.attr('aria-current'), undefined, `Step ${idx + 1} must NOT have aria-current`);
    }

    // Step 1 is complete
    assert.ok((items.eq(0).attr('class') || '').includes('border-emerald-200 bg-emerald-50 text-emerald-800'));
    // Step 4 is blocked
    assert.ok((items.eq(3).attr('class') || '').includes('border-rose-200 bg-rose-50 text-rose-800'));
    // Step 3 is upcoming
    assert.ok((items.eq(2).attr('class') || '').includes('border-slate-200 bg-white text-slate-500'));
  });

  it('1.2: Boundary Step 1 (First Step) active when dossier is newly created', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      { id: 's1', label: 'Bước đầu tiên', state: 'current' },
      { id: 's2', label: 'Bước thứ hai', state: 'upcoming' },
      { id: 's3', label: 'Bước thứ ba', state: 'upcoming' },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps }));
    const $ = cheerio.load(html);

    const firstItem = $('[role="listitem"]').first();
    assert.ok((firstItem.attr('class') || '').includes('ring-indigo-500'), 'First step must receive ring-indigo-500');
    assert.equal(firstItem.attr('aria-current'), 'step', 'First step must have aria-current="step"');
    assert.equal(firstItem.find('span').first().text().trim(), '1');
  });

  it('1.3: Boundary Step N (Last Step) active when dossier is at final stage', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      { id: 's1', label: 'Bước 1', state: 'complete' },
      { id: 's2', label: 'Bước 2', state: 'complete' },
      { id: 's3', label: 'Bước 3', state: 'complete' },
      { id: 's4', label: 'Bước 4', state: 'complete' },
      { id: 's5', label: 'Bước 5', state: 'complete' },
      { id: 's6', label: 'Bước cuối cùng', state: 'current' },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps }));
    const $ = cheerio.load(html);

    const lastItem = $('[role="listitem"]').last();
    assert.ok((lastItem.attr('class') || '').includes('ring-indigo-500'), 'Last step must receive ring-indigo-500');
    assert.equal(lastItem.attr('aria-current'), 'step', 'Last step must have aria-current="step"');
    assert.equal(lastItem.find('span').first().text().trim(), '6', 'Last step index must be 6');
  });

  it('1.4: Extreme boundaries: Single step and Empty step list', () => {
    // Case 1: Empty list
    const emptyHtml = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps: [] }));
    const $empty = cheerio.load(emptyHtml);
    assert.equal($empty('[role="list"]').length, 1, 'Container must render even when steps are empty');
    assert.equal($empty('[role="listitem"]').length, 0, 'No listitems when empty');

    // Case 2: Single step
    const singleSteps: PgdcnWorkflowStepItem[] = [
      { id: 'solo', label: 'Bước duy nhất', state: 'current' },
    ];
    const singleHtml = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps: singleSteps }));
    const $single = cheerio.load(singleHtml);
    assert.equal($single('[role="listitem"]').length, 1);
    assert.equal($single('[role="listitem"]').first().text().includes('Bước duy nhất'), true);
  });

  it('1.5: Checklist Count Badge Stress: undefined, 0/0, 0/5, 5/5, 8/5, large numbers', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      // Case A: undefined
      { id: 'c-undef', label: 'Undef', state: 'upcoming', checklistCount: undefined },
      // Case B: 0/0
      { id: 'c-zero', label: 'Zero', state: 'upcoming', checklistCount: { completed: 0, total: 0 } },
      // Case C: 0/5
      { id: 'c-unstarted', label: 'Unstarted', state: 'current', checklistCount: { completed: 0, total: 5 } },
      // Case D: 5/5
      { id: 'c-full', label: 'Full', state: 'complete', checklistCount: { completed: 5, total: 5 } },
      // Case E: 8/5 (completed > total)
      { id: 'c-over', label: 'Over', state: 'complete', checklistCount: { completed: 8, total: 5 } },
      // Case F: 1250/2500 (high density numbers)
      { id: 'c-large', label: 'Large', state: 'upcoming', checklistCount: { completed: 1250, total: 2500 } },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps }));
    const $ = cheerio.load(html);
    const items = $('[role="listitem"]');

    // Case A: undefined checklistCount -> no badge rendered
    assert.equal(items.eq(0).find('span').length, 2, 'Only index and label, no badge span');
    assert.ok(!items.eq(0).text().includes('việc'));

    // Case B: 0/0 -> renders (0/0 việc)
    assert.ok(items.eq(1).text().includes('(0/0 việc)'), '0/0 must render (0/0 việc)');

    // Case C: 0/5 on current step -> renders (0/5 việc) with active badge styling
    assert.ok(items.eq(2).text().includes('(0/5 việc)'), '0/5 must render (0/5 việc)');
    const stepCBag = items.eq(2).find('span').last();
    const stepCBagClass = stepCBag.attr('class') || '';
    assert.ok(stepCBagClass.includes('bg-indigo-100'), 'Current step badge has bg-indigo-100');
    assert.ok(stepCBagClass.includes('text-indigo-900'), 'Current step badge has text-indigo-900');
    assert.ok(stepCBagClass.includes('ring-indigo-300'), 'Current step badge has ring-indigo-300');

    // Case D: 5/5 on complete step -> renders (5/5 việc) with slate styling
    assert.ok(items.eq(3).text().includes('(5/5 việc)'), '5/5 must render (5/5 việc)');
    const stepDBagClass = items.eq(3).find('span').last().attr('class') || '';
    assert.ok(stepDBagClass.includes('bg-slate-100'), 'Non-current step badge has bg-slate-100');
    assert.ok(stepDBagClass.includes('text-slate-600'), 'Non-current step badge has text-slate-600');

    // Case E: 8/5 -> renders (8/5 việc) without crash or truncation
    assert.ok(items.eq(4).text().includes('(8/5 việc)'), '8/5 must render (8/5 việc)');

    // Case F: 1250/2500 -> renders (1250/2500 việc)
    assert.ok(items.eq(5).text().includes('(1250/2500 việc)'), 'Large count must render correctly');
  });

  it('1.6: Custom badge priority and parenthesis normalization', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      // Custom badge overrides checklistCount
      {
        id: 'b-override',
        label: 'Override',
        state: 'current',
        badge: 'Ưu tiên cao',
        checklistCount: { completed: 2, total: 4 },
      },
      // Pre-parenthesized badge does not double parenthesize
      {
        id: 'b-parens',
        label: 'Parens',
        state: 'upcoming',
        badge: '(3 việc bổ sung)',
      },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps }));
    const $ = cheerio.load(html);
    const items = $('[role="listitem"]');

    // Custom badge priority: renders '(Ưu tiên cao)' instead of '(2/4 việc)'
    assert.ok(items.eq(0).text().includes('(Ưu tiên cao)'), 'Must render custom badge in parens');
    assert.ok(!items.eq(0).text().includes('2/4 việc'), 'Custom badge must override checklistCount');

    // Pre-parenthesized badge: preserves single pair of parens
    assert.ok(items.eq(1).text().includes('(3 việc bổ sung)'));
    assert.ok(!items.eq(1).text().includes('((3 việc bổ sung))'), 'Must not produce double parens');
  });

  it('1.7: Touch scrolling, smooth swipe classes and ergonomic dimensions', () => {
    const steps: PgdcnWorkflowStepItem[] = [
      { id: 't1', label: 'Chạm 1', state: 'upcoming' },
      { id: 't2', label: 'Chạm 2', state: 'upcoming' },
    ];

    const html = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, {
      steps,
      className: 'custom-rail-class',
    }));
    const $ = cheerio.load(html);

    const container = $('[role="list"]');
    const containerClass = container.attr('class') || '';

    // Horizontal touch scroll attributes
    assert.ok(containerClass.includes('mobile-scroll-x'), 'Must contain mobile-scroll-x');
    assert.ok(containerClass.includes('overflow-x-auto'), 'Must contain overflow-x-auto');
    assert.ok(containerClass.includes('scroll-smooth'), 'Must contain scroll-smooth');
    assert.ok(containerClass.includes('touch-pan-x'), 'Must contain touch-pan-x');
    assert.ok(containerClass.includes('pb-1'), 'Must contain pb-1 for scrollbar breathing room');
    assert.ok(containerClass.includes('custom-rail-class'), 'Must preserve passed className');

    // Inner scroll track
    const innerTrack = container.children().first();
    const trackClass = innerTrack.attr('class') || '';
    assert.ok(trackClass.includes('flex min-w-max items-center gap-1.5'), 'Track must be flex min-w-max gap-1.5');

    // Step item dimensions
    const item = $('[role="listitem"]').first();
    const itemClass = item.attr('class') || '';
    assert.ok(itemClass.includes('mobile-touch-target'), 'Item must have mobile-touch-target');
    assert.ok(itemClass.includes('min-w-[9.5rem]'), 'Item min-width on mobile');
    assert.ok(itemClass.includes('sm:min-w-[10.5rem]'), 'Item min-width on tablet/desktop');
  });

  it('1.8: Interactivity cursor classes based on onSelectStep / onClick presence', () => {
    // Without click handler: no cursor-pointer
    const htmlNoClick = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, {
      steps: [{ id: 'static', label: 'Tĩnh', state: 'upcoming' }],
    }));
    const $noClick = cheerio.load(htmlNoClick);
    assert.ok(!($noClick('[role="listitem"]').attr('class') || '').includes('cursor-pointer'));

    // With onSelectStep on rail: has cursor-pointer
    const htmlWithSelect = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, {
      steps: [{ id: 'interactive', label: 'Động', state: 'upcoming' }],
      onSelectStep: () => {},
    }));
    const $withSelect = cheerio.load(htmlWithSelect);
    assert.ok(($withSelect('[role="listitem"]').attr('class') || '').includes('cursor-pointer'));

    // With individual step onClick: has cursor-pointer
    const htmlWithStepClick = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, {
      steps: [{ id: 'step-click', label: 'Từng bước', state: 'upcoming', onClick: () => {} }],
    }));
    const $withStepClick = cheerio.load(htmlWithStepClick);
    assert.ok(($withStepClick('[role="listitem"]').attr('class') || '').includes('cursor-pointer'));
  });
});

// ============================================================================
// SUITE 2: PgdDossierFlow Empirical Component Rendering & Stress Harness
// ============================================================================

describe('Empirical Suite 2: PgdDossierFlow Compact Rail & State Stress Testing', () => {

  it('2.1: Completely eliminates legacy heavy cards in favor of compact horizontal rail', () => {
    const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'DRAFT',
      selectedStepId: 'intake',
      onSelectStep: () => {},
    }));
    const $ = cheerio.load(html);

    // Assert absence of heavy cards (218px width or height)
    assert.ok(!html.includes('w-[218px]'), 'Must not contain w-[218px]');
    assert.ok(!html.includes('min-h-[218px]'), 'Must not contain min-h-[218px]');
    assert.ok(!html.includes('h-[218px]'), 'Must not contain h-[218px]');

    // Assert compact horizontal rail structure
    const scrollContainer = $('[data-testid="pgd-dossier-flow-scroll"]');
    assert.equal(scrollContainer.length, 1, 'Scroll container must be present');
    const scrollClass = scrollContainer.attr('class') || '';
    assert.ok(scrollClass.includes('mobile-scroll-x'), 'Must contain mobile-scroll-x');
    assert.ok(scrollClass.includes('overflow-x-auto'), 'Must contain overflow-x-auto');
    assert.ok(scrollClass.includes('scroll-smooth'), 'Must contain scroll-smooth');
    assert.ok(scrollClass.includes('touch-pan-x'), 'Must contain touch-pan-x');

    // Assert tablist with exactly 7 stage tabs
    const tablist = $('[role="tablist"]');
    assert.equal(tablist.length, 1, 'Must have role="tablist"');
    const tabs = $('button[role="tab"]');
    assert.equal(tabs.length, 7, 'Must render exactly 7 compact stage tabs');
  });

  it('2.2: Selected step in PGD rail receives prominent blue ring (ring-2 ring-blue-500 ring-offset-1)', () => {
    const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'PREPARING',
      selectedStepId: 'plan', // Stage 3
      onSelectStep: () => {},
    }));
    const $ = cheerio.load(html);

    const step3Tab = $('#pgd-dossier-step-tab-plan');
    assert.equal(step3Tab.length, 1, 'Tab 3 (plan) must exist');

    const step3Class = step3Tab.attr('class') || '';
    assert.ok(step3Class.includes('ring-2'), 'Selected tab must have ring-2');
    assert.ok(step3Class.includes('ring-blue-500'), 'Selected tab must have ring-blue-500');
    assert.ok(step3Class.includes('ring-offset-1'), 'Selected tab must have ring-offset-1');
    assert.ok(step3Class.includes('border-blue-500'), 'Selected tab must have border-blue-500');
    assert.ok(step3Class.includes('bg-blue-50/90'), 'Selected tab must have bg-blue-50/90');
    assert.ok(step3Class.includes('text-blue-950'), 'Selected tab must have text-blue-950');
    assert.equal(step3Tab.attr('aria-selected'), 'true', 'Selected tab must have aria-selected="true"');
    assert.equal(step3Tab.attr('tabindex'), '0', 'Selected tab must have tabindex="0"');

    // Other unselected tabs must NOT have active ring (ring-2 ring-blue-500 ring-offset-1)
    for (const otherId of ['intake', 'review-assignment', 'execution']) {
      const otherTab = $(`#pgd-dossier-step-tab-${otherId}`);
      const otherClass = otherTab.attr('class') || '';
      assert.ok(!otherClass.includes('ring-offset-1'), `Tab ${otherId} must NOT have active ring-offset-1`);
      assert.doesNotMatch(otherClass, /(?<!focus-visible:)ring-2\s+ring-blue-500/, `Tab ${otherId} must NOT have persistent ring-2 ring-blue-500`);
      assert.equal(otherTab.attr('aria-selected'), 'false', `Tab ${otherId} must have aria-selected="false"`);
      assert.equal(otherTab.attr('tabindex'), '-1', `Tab ${otherId} must have tabindex="-1"`);
    }
  });

  it('2.3: Boundary testing: Stage 1 (Intake) vs Stage 7 (Issuance & Archive) & Chevron separator count', () => {
    const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'ARCHIVED',
      selectedStepId: 'issuance-archive',
      evidence: { signed: true },
      onSelectStep: () => {},
    }));
    const $ = cheerio.load(html);

    // Step 1 check
    const step1 = $('#pgd-dossier-step-tab-intake');
    assert.equal(step1.attr('aria-posinset'), '1', 'Stage 1 must have aria-posinset="1"');
    assert.equal(step1.attr('aria-setsize'), '7', 'Stage 1 must have aria-setsize="7"');

    // Stage 7 check
    const step7 = $('#pgd-dossier-step-tab-issuance-archive');
    assert.equal(step7.attr('aria-posinset'), '7', 'Stage 7 must have aria-posinset="7"');
    assert.equal(step7.attr('aria-setsize'), '7', 'Stage 7 must have aria-setsize="7"');
    assert.equal(step7.attr('aria-selected'), 'true', 'Stage 7 must be selected');

    // Boundary check on ChevronRight separators:
    // With 7 stages, there should be EXACTLY 6 ChevronRight separators between items!
    // The 7th item must NOT have a trailing ChevronRight.
    const chevrons = $('[role="tablist"] svg.text-slate-300');
    assert.equal(chevrons.length, 6, 'Must have exactly 6 ChevronRight separators for 7 stages');
  });

  it('2.4: Lifecycle progression & Step locking behavior (DRAFT vs FIELD vs LEADERSHIP vs ARCHIVED)', () => {
    // Lifecycle Scenario A: DRAFT (Current Step = 1)
    const draftHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'DRAFT',
      selectedStepId: 'intake',
      onSelectStep: () => {},
    }));
    const $draft = cheerio.load(draftHtml);
    assert.equal($draft('#pgd-dossier-step-tab-intake').attr('disabled'), undefined, 'Step 1 is unlocked');
    for (let i = 1; i < PGD_DOSSIER_FLOW_STEPS.length; i++) {
      const stepId = PGD_DOSSIER_FLOW_STEPS[i].id;
      const stepBtn = $draft(`#pgd-dossier-step-tab-${stepId}`);
      assert.equal(stepBtn.attr('disabled'), 'disabled', `Step ${stepId} must be locked in DRAFT`);
      assert.ok((stepBtn.attr('class') || '').includes('cursor-not-allowed'), 'Locked step must have cursor-not-allowed');
      assert.ok((stepBtn.attr('class') || '').includes('opacity-70'), 'Locked step must have opacity-70');
    }

    // Lifecycle Scenario B: FIELD_INSPECTION (Current Step = 4)
    const fieldHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'FIELD_INSPECTION',
      selectedStepId: 'execution',
      onSelectStep: () => {},
    }));
    const $field = cheerio.load(fieldHtml);
    // Stages 1 to 4 unlocked
    for (let i = 0; i < 4; i++) {
      assert.equal($field(`#pgd-dossier-step-tab-${PGD_DOSSIER_FLOW_STEPS[i].id}`).attr('disabled'), undefined);
    }
    // Stages 5 to 7 locked
    for (let i = 4; i < 7; i++) {
      assert.equal($field(`#pgd-dossier-step-tab-${PGD_DOSSIER_FLOW_STEPS[i].id}`).attr('disabled'), 'disabled');
    }

    // Lifecycle Scenario C: LEADERSHIP_APPROVAL (Current Step = 6)
    const approvalHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'LEADERSHIP_APPROVAL',
      selectedStepId: 'reporting-approval',
      onSelectStep: () => {},
    }));
    const $approval = cheerio.load(approvalHtml);
    for (let i = 0; i < 6; i++) {
      assert.equal($approval(`#pgd-dossier-step-tab-${PGD_DOSSIER_FLOW_STEPS[i].id}`).attr('disabled'), undefined);
    }
    assert.equal($approval('#pgd-dossier-step-tab-issuance-archive').attr('disabled'), 'disabled', 'Stage 7 issuance-archive is locked');

    // Lifecycle Scenario D: ARCHIVED (Current Step = 7)
    const archivedHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'ARCHIVED',
      selectedStepId: 'issuance-archive',
      evidence: { signed: true },
      onSelectStep: () => {},
    }));
    const $archived = cheerio.load(archivedHtml);
    for (let i = 0; i < 7; i++) {
      assert.equal($archived(`#pgd-dossier-step-tab-${PGD_DOSSIER_FLOW_STEPS[i].id}`).attr('disabled'), undefined, 'All steps unlocked when archived');
    }
  });

  it('2.5: Graceful fallback on invalid/unexpected step ID or unknown status', () => {
    // Invalid selectedStepId fallback
    const htmlInvalidStep = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'PREPARING',
      selectedStepId: 'non-existent-step-id' as any,
      onSelectStep: () => {},
    }));
    const $invalid = cheerio.load(htmlInvalidStep);
    // Context container falls back gracefully to step 3 (PREPARING)
    const contextBox = $invalid('[data-testid="pgd-dossier-flow-context"]');
    assert.equal(contextBox.length, 1);
    assert.ok(contextBox.text().includes('Giai đoạn 3: Lập kế hoạch'));

    // Unknown status fallback
    const unknownStepNum = getPgdDossierCurrentStepNumber('NON_STANDARD_STATUS' as any);
    assert.equal(unknownStepNum, 7, 'Unknown status must safely fallback to step 7');

    // Missing evidence fallback
    const htmlNoEvidence = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'WAITING_LAB_RESULTS',
      selectedStepId: 'results-evaluation',
      evidence: undefined,
      onSelectStep: () => {},
    }));
    assert.ok(htmlNoEvidence.includes('Chưa có dữ liệu xác minh'), 'Must handle undefined evidence gracefully');
  });

  it('2.6: Evidence completion rendering & verification label updates', () => {
    const evidence: PgdTransitionContext = {
      hasApprovedAssignment: true,
      hasFieldInspection: true,
      hasSampleHandover: true,
      labRequests: [
        { id: 'lr-1', code: 'PYC-01', status: 'RESULT_RECEIVED', labName: 'PTN 1' } as any,
        { id: 'lr-2', code: 'PYC-02', status: 'CLOSED', labName: 'PTN 2' } as any,
      ],
      labResultReview: {
        status: 'FINAL',
        retestRequired: false,
        conformity: 'CONFORMING',
      } as any,
      reportReady: true,
      signed: true,
    };

    const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'ARCHIVED',
      selectedStepId: 'issuance-archive',
      evidence,
      onSelectStep: () => {},
    }));
    const $ = cheerio.load(html);

    // Verified completed review-assignment step
    const assignmentTab = $('#pgd-dossier-step-tab-review-assignment');
    assert.ok((assignmentTab.attr('class') || '').includes('border-emerald-200 bg-emerald-50 text-emerald-800'));
    assert.ok(assignmentTab.text().includes('Đã phân công'));

    // Results evaluation step shows completed count
    const labResultTab = $('#pgd-dossier-step-tab-results-evaluation');
    assert.ok(labResultTab.text().includes('2/2 KQTN'));

    // Issuance & Archive step shows archived
    const returnTab = $('#pgd-dossier-step-tab-issuance-archive');
    assert.ok(returnTab.text().includes('Đã lưu trữ'));
  });

  it('2.7: Mobile gesture helper text is present', () => {
    const html = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'DRAFT',
      selectedStepId: 'intake',
      onSelectStep: () => {},
    }));
    const $ = cheerio.load(html);

    const mobileHint = $('p.md\\:hidden');
    assert.equal(mobileHint.length, 1);
    assert.ok(mobileHint.text().includes('Vuốt ngang để xem đủ 7 giai đoạn quy trình'));
  });
});

// ============================================================================
// SUITE 3: Subsystem Domain Isolation & Ergonomics Verification
// ============================================================================

describe('Empirical Suite 3: Domain Isolation & Ergonomics Verification', () => {

  it('3.1: Strict color token separation: PCN (Indigo) vs PGD (Blue)', () => {
    // PCN Workflow Rail uses indigo accent ring
    const pcnSteps: PgdcnWorkflowStepItem[] = [
      { id: 'pcn-cur', label: 'PCN Active', state: 'current' },
    ];
    const pcnHtml = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, { steps: pcnSteps }));
    assert.ok(pcnHtml.includes('ring-indigo-500'), 'PCN rail must use ring-indigo-500');
    assert.ok(!pcnHtml.includes('ring-blue-500'), 'PCN rail must not use ring-blue-500');

    // PGD Dossier Flow uses blue accent ring
    const pgdHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'DRAFT',
      selectedStepId: 'intake',
      onSelectStep: () => {},
    }));
    assert.ok(pgdHtml.includes('ring-blue-500'), 'PGD flow must use ring-blue-500');
    assert.ok(!pgdHtml.includes('ring-indigo-500'), 'PGD flow must not use ring-indigo-500');
  });

  it('3.2: Accessibility semantic hierarchy: List/Listitem vs Tablist/Tab', () => {
    // PCN rail semantic structure
    const pcnHtml = renderToStaticMarkup(React.createElement(PgdcnWorkflowRail, {
      steps: [{ id: 's', label: 'Step', state: 'current' }],
    }));
    const $pcn = cheerio.load(pcnHtml);
    assert.equal($pcn('[role="list"]').length, 1);
    assert.equal($pcn('[role="listitem"]').length, 1);

    // PGD flow semantic structure
    const pgdHtml = renderToStaticMarkup(React.createElement(PgdDossierFlow, {
      status: 'DRAFT',
      selectedStepId: 'intake',
      onSelectStep: () => {},
    }));
    const $pgd = cheerio.load(pgdHtml);
    assert.equal($pgd('[role="tablist"]').length, 1);
    assert.equal($pgd('[role="tab"]').length, 7);
    assert.equal($pgd('[aria-selected="true"]').length, 1);
  });
});
