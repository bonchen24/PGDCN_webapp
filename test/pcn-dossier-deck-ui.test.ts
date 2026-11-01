import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React, { createElement } from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';
import { PgdcnDossierDeck, PgdcnDossierQuickPeek, type PgdcnDossierItemModel } from '../components/PgdcnDossierDeck';
import PcnDossierGroupCard, {
  buildPcnDossierRequiredDocumentSummary,
  buildPcnSampleProgress,
  getPcnSampleItemResultState,
} from '../components/PcnDossierGroupCard';
import type { CertificationDossier, CertificationProposal, PcnDocumentRequirement, PcnDossierDocument, PcnSampleItem, PcnSampleRoute } from '../types';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('shared dossier deck components exist and export the unified DDT interaction primitives', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  assert.match(deckSource, /export function PgdcnDossierDeck/);
  assert.match(deckSource, /export function PgdcnDossierCard/);
  assert.match(deckSource, /export function PgdcnDossierCardHeader/);
  assert.match(deckSource, /export function PgdcnDossierQuickActions/);
  assert.match(deckSource, /export function PgdcnDossierCardExpanded/);
  assert.match(deckSource, /grid grid-cols-1 gap-2/);
});

test('dossier deck keeps model data readable and does not imply completeness without a missing count', () => {
  const item: PgdcnDossierItemModel = {
    id: 'dossier-1',
    domain: 'PCN',
    primaryCode: 'PCN-001',
    status: 'IN_PROGRESS',
    statusLabel: 'Đang xử lý',
    customerName: 'Công ty Kiểm định',
    productName: 'Thiết bị đo',
    currentStepLabel: 'Thẩm định hồ sơ',
    deadlineDisplay: '24/10/2026',
    ownerName: 'Nguyễn An',
    completenessPercent: 60,
  };
  const markup = renderToStaticMarkup(React.createElement(PgdcnDossierDeck, {
    items: [item],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const card = $('[data-testid="pgdcn-dossier-card"]');
  const progressText = card.find('[data-testid="dossier-progress-zone"]').text();
  const deckClass = card.parent().attr('class') || '';

  assert.match(deckClass, /\bgrid-cols-1\b/);
  assert.doesNotMatch(deckClass, /\bmd:grid-cols-2\b/);
  for (const value of ['PCN-001', 'Đang xử lý', 'Công ty Kiểm định', 'Thiết bị đo', 'Thẩm định hồ sơ', '24/10/2026', 'Nguyễn An']) {
    assert.ok(card.text().includes(value), `the dossier card shows ${value}`);
  }
  assert.doesNotMatch(progressText, /Đủ tài liệu/);
});

test('collapsed dossier card keeps metadata on compact inline rows and names its progress bar', () => {
  const item: PgdcnDossierItemModel = {
    id: 'dossier-compact',
    domain: 'PCN',
    primaryCode: 'PCN-COMPACT-001',
    secondaryCode: 'ĐN: DN-COMPACT-001',
    status: 'IN_PROGRESS',
    statusLabel: 'Đang xử lý',
    customerName: 'Công ty Kiểm định Thiết bị Công nghiệp',
    productName: 'Thiết bị đo công suất',
    currentStepLabel: 'Thẩm định hồ sơ',
    deadlineDisplay: '24/10/2026',
    ownerName: 'Nguyễn An',
    completenessPercent: 60,
    completenessLabel: '60%',
    missingRequiredCount: 2,
    businessBadges: [{ id: 'samples', label: 'Mẫu 3/3' }],
  };
  const markup = renderToStaticMarkup(React.createElement(PgdcnDossierDeck, {
    items: [item],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const card = $('[data-testid="pgdcn-dossier-card"]');
  const metadata = card.find('[data-testid="dossier-metadata-zone"]');
  const metadataClass = metadata.attr('class') || '';

  for (const label of ['Khách hàng:', 'Đối tượng:', 'Bước nghiệp vụ:', 'Người phụ trách:']) {
    const labelElement = metadata.find('span').filter((_, span) => $(span).text().trim() === label);
    assert.equal(labelElement.length, 1, `${label} remains visible`);
    assert.equal(labelElement.parent().get(0)?.tagName, 'p', `${label} shares a line with its value`);
  }
  assert.match(metadataClass, /gap-y-1/);
  assert.doesNotMatch(metadataClass, /lg:grid-cols-4/, 'metadata does not squeeze four labeled columns into each card');

  const progress = card.find('[data-testid="dossier-progress-zone"] [role="progressbar"]');
  assert.equal(progress.attr('aria-label'), 'Tiến độ hoàn tất hồ sơ');
  assert.equal(progress.attr('aria-valuetext'), '60% hoàn tất');
});

test('PCN and PGD dossier queues completely eliminate large top KPI cards and display compact 1-line counters', () => {
  const pcnQueue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');

  // Verify no 4 large KPI cards at top
  assert.doesNotMatch(pcnQueue, /grid-cols-2 gap-2 lg:grid-cols-4/);
  assert.doesNotMatch(pgdQueue, /grid-cols-2 gap-3 lg:grid-cols-4/);

  // Verify compact filter chips with count pills
  assert.match(pcnQueue, /activeChip/);
  assert.match(pgdQueue, /activeChip/);
  assert.match(pcnQueue, /grid grid-cols-1 md:grid-cols-2 gap-4/);
  assert.match(pgdQueue, /grid grid-cols-1 md:grid-cols-2 gap-4/);
});

test('PCN and PGD dossier queues use the shared dossier deck and card primitives with Zone 4 business badges', () => {
  const pcnQueue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');
  const groupCard = read('../components/PcnDossierGroupCard.tsx');

  assert.match(pcnQueue, /PgdcnDossierCard/);
  assert.match(pcnQueue, /PgdcnDossierCardExpanded/);
  assert.match(pcnQueue, /PgdcnDossierQuickActions/);
  assert.match(pcnQueue, /domain:\s*'PCN'/);
  assert.match(pcnQueue, /businessBadges/);

  assert.match(pgdQueue, /PgdcnDossierCard/);
  assert.match(pgdQueue, /PgdcnDossierCardExpanded/);
  assert.match(pgdQueue, /PgdcnDossierQuickActions/);
  assert.match(pgdQueue, /domain:\s*'PGD'/);
  assert.match(pgdQueue, /businessBadges/);

  assert.match(groupCard, /aria-expanded=\{isExpanded\}/);
  assert.match(groupCard, /setIsExpanded/);
});

test('PCN dossier group card uses semantic controls, mobile touch targets, and clipboard feedback', () => {
  const proposal = {
    id: 'proposal-1',
    proposalCode: 'PCN-001',
    quantity: 3,
    customerSnapshot: { name: 'Acme Manufacturing' },
    productName: 'Widget',
    model: 'W-1',
    brand: 'Acme',
    productType: 'Device',
  } as unknown as CertificationProposal;
  const dossier = {
    id: 'dossier-1',
    dossierCode: 'DS-001',
    fieldCodes: ['QC4'],
    status: 'INTAKE_REVIEW',
    targetDate: '2026-12-01',
    ownerUsername: 'owner',
  } as unknown as CertificationDossier;
  const markup = renderToStaticMarkup(React.createElement(PcnDossierGroupCard, {
    proposal,
    dossier,
    documentRequirements: [],
    dossierDocuments: [],
    dataLoaded: true,
    canEdit: true,
    onOpenDossier: () => {},
    onEdit: () => {},
    onDelete: () => {},
  }));
  const $ = cheerio.load(markup);
  const card = $('[data-testid="pcn-dossier-card"]');
  const quickActions = card.find('.request-card-action-group');

  assert.equal(card.length, 1, 'the component renders its card');
  assert.equal(card.attr('role'), undefined, 'the card surface stays a container, not a button with nested controls');
  assert.equal(card.find('button[aria-expanded="false"]').length, 2, 'both expand controls expose their collapsed state');
  assert.equal(card.find('h3 button').text(), 'Acme Manufacturing', 'the customer navigation target is a button');
  assert.equal(card.find('button').filter((_, button) => $(button).text().trim() === 'PCN-001').length, 1, 'proposal navigation uses a button');
  assert.match(markup, /flex flex-col gap-2 xl:flex-row/, 'the header stacks on narrow cards');

  assert.equal(quickActions.find('button').length, 5, 'edit permission exposes all five icon actions');
  quickActions.find('button').each((_, button) => {
    const action = $(button);
    const className = action.attr('class') || '';
    assert.ok(action.attr('aria-label'), 'every icon action has an accessible name');
    assert.ok(className.includes('min-h-11 min-w-11'), 'every icon action meets the 44px touch target');
    assert.ok(className.includes('focus-visible:ring-2'), 'every icon action has a visible keyboard focus ring');
  });

  const source = read('../components/PcnDossierGroupCard.tsx');
  const copyHandler = source.match(/const handleCopyCode = async[\s\S]*?\n  };/)?.[0] || '';
  assert.match(copyHandler, /e\.stopPropagation\(\)/);
  assert.ok(copyHandler.indexOf('await navigator.clipboard.writeText') < copyHandler.indexOf('toast.success'), 'clipboard success follows a completed write');
  assert.match(copyHandler, /catch[\s\S]*toast\.error/);
  assert.match(copyHandler, /navigator\.clipboard\?\.writeText[\s\S]*toast\.error/);
});

test('PCN dossier card keeps required-document loading separate from zero missing and names the first two missing items', () => {
  const dossier = {
    id: 'dossier-documents',
    dossierCode: 'DS-DOCS',
    proposalId: 'proposal-documents',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    status: 'AWAITING_DOCUMENTS',
    labRequestIds: [],
    returnedResultIds: [],
  } as CertificationDossier;
  const proposal = {
    id: 'proposal-documents',
    proposalCode: 'PCN-DOCS',
    customerSnapshot: { name: 'Acme Manufacturing' },
    productName: 'Widget',
  } as CertificationProposal;
  const requirements: PcnDocumentRequirement[] = [
    { id: 'required-1', fieldCode: 'QC4', code: 'REQ_1', name: 'Đề nghị đăng ký', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'required-2', fieldCode: 'QC4', code: 'REQ_2', name: 'Báo giá', stages: ['INTAKE'], required: true, active: true, sortOrder: 2 },
    { id: 'required-3', fieldCode: 'QC4', code: 'REQ_3', name: 'Biên bản kiểm tra', stages: ['INTAKE'], required: true, active: true, sortOrder: 3 },
    { id: 'optional-1', fieldCode: 'QC4', code: 'OPTIONAL', name: 'Tài liệu tham khảo', stages: ['INTAKE'], required: false, active: true, sortOrder: 4 },
  ];
  const documents: PcnDossierDocument[] = [
    {
      id: 'document-1',
      dossierId: dossier.id,
      requirementId: 'required-1',
      fieldCode: 'QC4',
      currentVersionId: 'asset-1',
      status: 'PRESENT',
      versions: [{ assetId: 'asset-1', fileName: 'de-nghi.pdf', uploadedAt: '2026-10-01T00:00:00.000Z' }],
    },
  ];

  assert.deepEqual(
    buildPcnDossierRequiredDocumentSummary({ dossier, proposal, requirements, documents, dataLoaded: false }),
    { state: 'LOADING' },
    'empty arrays before the PCN store finishes loading do not appear as zero missing documents',
  );
  assert.deepEqual(
    buildPcnDossierRequiredDocumentSummary({ dossier, proposal, requirements, documents: [], dataLoaded: true }),
    { state: 'MISSING', missingCount: 3, labels: ['Đề nghị đăng ký', 'Báo giá'], additionalMissingCount: 1 },
    'the canonical checklist names the first two missing required items and counts the rest',
  );
  assert.deepEqual(
    buildPcnDossierRequiredDocumentSummary({ dossier, proposal, requirements: [requirements[0]], documents, dataLoaded: true }),
    { state: 'COMPLETE', missingCount: 0, labels: [], additionalMissingCount: 0 },
    'a loaded checklist with no missing required item is distinct from loading',
  );

  const source = read('../components/PcnDossierGroupCard.tsx');
  assert.match(source, /buildPcnDossierCompleteness/);
  assert.match(source, /data-testid="pcn-dossier-required-documents"/);
  assert.match(source, /requiredDocumentSummary\.labels/);
});

test('PCN sample progress uses item snapshots and stays unknown or empty without tracked sample items', () => {
  const items: PcnSampleItem[] = [
    { id: 'item-a', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Đèn bàn', model: 'A1', quantity: 1 },
    { id: 'item-b', sampleLotId: 'lot-1', sampleCode: 'M-02', sampleType: 'Quạt bàn', model: 'B1', quantity: 1 },
  ];
  const sharedRoute: PcnSampleRoute = {
    id: 'route-shared',
    sampleLotId: 'lot-1',
    labCode: 'PERFORMANCE',
    labName: 'Phòng thử Hiệu suất',
    status: 'RESULT_RETURNED',
    sampleItemIds: ['item-a', 'item-b'],
    itemSnapshots: {
      'item-a': { status: 'RESULT_RETURNED' },
      'item-b': { status: 'SENT' },
    },
  };

  assert.deepEqual(getPcnSampleItemResultState(items[0], [sharedRoute]), {
    hasResult: true,
    isTesting: false,
    isComplete: true,
  });
  assert.deepEqual(getPcnSampleItemResultState(items[1], [sharedRoute]), {
    hasResult: false,
    isTesting: true,
    isComplete: false,
  }, 'one route aggregate cannot overwrite another item’s in-flight snapshot');
  assert.deepEqual(buildPcnSampleProgress({ items, routes: [sharedRoute], dataLoaded: true }), {
    state: 'TRACKED',
    totalItems: 2,
    completedItems: 1,
    percent: 50,
  });
  assert.deepEqual(buildPcnSampleProgress({ items: [], routes: [], dataLoaded: false }), { state: 'LOADING' });
  assert.deepEqual(buildPcnSampleProgress({ items: [], routes: [], dataLoaded: true }), { state: 'EMPTY' });

  const source = read('../components/PcnDossierGroupCard.tsx');
  assert.doesNotMatch(source, /matchingItems\.length \|\| proposal\.quantity \|\| 1/);
  assert.doesNotMatch(source, /const isDone =/);
  assert.match(source, /data-testid="pcn-sample-progress"/);
  assert.match(source, /role="progressbar"/);
});

test('card expands in place on card body click without navigating away, while explicit detail action navigates', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  assert.match(deckSource, /handleCardClick/);
  assert.match(deckSource, /target\.closest\('button, a, input, select, textarea, \[data-no-card-expand\]'\)/);
  assert.match(deckSource, /onToggleExpand\(\)/);
  assert.match(deckSource, /data-testid="pgdcn-dossier-card"/);
  assert.match(deckSource, /data-testid="pgdcn-dossier-card-expanded"/);
  assert.match(deckSource, /Mở toàn bộ hồ sơ/);
  assert.match(deckSource, /onOpenDetail\(\)/);
});

test('collapsed card enforces DDT 5-zone structure and thin progress bar', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  // Zone 1 Header & Quick Actions
  assert.match(deckSource, /data-testid="dossier-header-zone"/);
  assert.match(deckSource, /data-testid="dossier-quick-actions"/);

  // Zone 2 Metadata
  assert.match(deckSource, /data-testid="dossier-metadata-zone"/);

  // Zone 3 Progress Bar (thin 1-line progress like DDT)
  assert.match(deckSource, /data-testid="dossier-progress-zone"/);
  assert.match(deckSource, /h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-100/);

  // Zone 4 Business Badges
  assert.match(deckSource, /data-testid="dossier-business-badges"/);
});

test('card supports deep search auto-expand matching DDT interaction', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  assert.match(deckSource, /searchQuery/);
  assert.match(deckSource, /autoExpandOnSearch/);
});

test('expanded card drawer projects Next Action, Blockers, and Component Breakdown', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');
  const pcnQueue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');

  assert.match(deckSource, /Việc cần làm tiếp theo/);
  assert.match(deckSource, /Cảnh báo & Điểm nghẽn/);
  assert.match(deckSource, /Thành phần hồ sơ/);
  assert.match(deckSource, /data-testid="dossier-next-action"/);
  assert.match(deckSource, /data-testid="dossier-blockers"/);
  assert.match(deckSource, /data-testid="dossier-components-breakdown"/);

  // PCN 8 stages
  for (const stage of ['Đề nghị', 'Tài liệu', 'Hiện trường', 'Mẫu thử', 'Gửi PTN', 'KQTN', 'Phê duyệt', 'Phát hành']) {
    assert.match(pcnQueue, new RegExp(stage));
  }

  // PGD 8 stages
  for (const stage of ['Tiếp nhận PYC', 'Tài liệu & hồ sơ', 'Kế hoạch', 'Hiện trường', 'Bàn giao PTN', 'KQTN & Đánh giá', 'Báo cáo & Chứng thư', 'Lưu trữ hồ sơ']) {
    assert.match(pgdQueue, new RegExp(stage));
  }
});

test('quick peek states a blocker once and uses the existing next-action callback and label', () => {
  const item = {
    id: 'peek-pcn-1',
    domain: 'PCN',
    primaryCode: 'PCN-QA-001',
    status: 'AWAITING_DOCUMENTS',
    statusLabel: 'Chờ bổ sung hồ sơ',
    customerName: 'Khách hàng thử nghiệm',
    productName: 'Sản phẩm thử nghiệm',
    currentStepTitle: 'Bổ sung hồ sơ',
    ownerName: 'synthetic_staff',
    deadlineDisplay: 'Chưa có hạn',
    missingRequiredCount: 14,
    nextAction: {
      title: 'Mở để xử lý ngoại lệ',
      reason: 'Còn 14 tài liệu bắt buộc cần bổ sung.',
      owner: 'synthetic_staff',
      actionLabel: 'Mở để xử lý ngoại lệ',
      onAction: () => {},
    },
    blockers: [{
      id: 'pcn-missing-peek-1',
      title: 'Thiếu tài liệu bắt buộc',
      reason: 'Còn thiếu 14 mục tài liệu theo quy định.',
      severity: 'HARD',
    }],
  } as unknown as PgdcnDossierItemModel;

  const markup = renderToStaticMarkup(createElement(PgdcnDossierQuickPeek, {
    item,
    onClose: () => {},
    onOpenDossier: () => {},
  }));

  assert.equal((markup.match(/14 (?:tài liệu|mục tài liệu|đầu mục)/g) || []).length, 1, 'the same missing-document count should appear once');
  assert.match(markup, /Mở để xử lý ngoại lệ/, 'the primary action should carry the projected action label');
  assert.doesNotMatch(markup, /Chưa có hạn/, 'an absent deadline should not occupy quick-peek space');
  assert.doesNotMatch(markup, /Cảnh báo &amp; Điểm nghẽn/, 'quick peek should not add a second blocker panel');
});

test('quick actions isolate clicks with stopPropagation and enforce RBAC/disabled states', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  assert.match(deckSource, /e\.stopPropagation\(\)/);
  assert.match(deckSource, /disabled=\{act\.disabled\}/);
  assert.match(deckSource, /data-testid="dossier-quick-actions"/);
});

test('toolbar features status filter chips with counts, search, and responsive mobile filter toggle', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');
  const pcnQueue = read('../components/PcnDossierQueueView.tsx');
  const pgdQueue = read('../components/PgdDossierQueueView.tsx');

  assert.match(deckSource, /data-testid="dossier-filter-chips"/);
  assert.match(deckSource, /data-testid="dossier-mobile-filter-toggle"/);
  assert.match(pcnQueue, /PCN_FILTER_CHIPS/);
  assert.match(pgdQueue, /PGD_FILTER_CHIPS/);
  assert.match(pcnQueue, /mobile-scroll-x/);
  assert.match(pgdQueue, /mobile-scroll-x/);
});

test('no regression in Summary Grid and Dossier Detail views', () => {
  const summaryGrid = read('../components/PgdcnDossierSummaryGrid.tsx');
  const detailView = read('../components/PcnDossierDetailView.tsx');

  assert.match(summaryGrid, /export default function PgdcnDossierSummaryGrid/);
  assert.match(detailView, /data-testid="pcn-dossier-focus-shell"/);
});


test('shared dossier quick actions maintain persistent >=44px touch targets and meet focus and accessibility contracts', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');
  const quickActions = deckSource.match(/export function PgdcnDossierQuickActions[\s\S]*?\r?\n}\r?\n/)?.[0] || '';
  const actionClasses = [...quickActions.matchAll(/className=\{`([^`]*inline-flex[^`]*)`|className="([^"]*inline-flex[^"]*)"/g)]
    .map((match) => match[1] || match[2]);

  assert.equal(actionClasses.length, 5, 'dynamic, peek, copy, open, and expand actions should share one control contract');
  for (const className of actionClasses) {
    assert.match(className, /min-h-11 min-w-11/, 'all control variants retain >=44px control sizing');
    assert.doesNotMatch(className, /md:min-h-0|md:min-w-0|md:h-|md:w-/, 'no desktop breakpoint shrinks control sizing below 44px');
    assert.match(className, /focus-visible:ring-2/, 'focus-visible ring is present');
    assert.match(className, /focus-visible:ring-offset-2/, 'focus-visible ring offset is present');
    assert.match(className, /focus-visible:outline-none/, 'focus-visible outline reset is present');
  }

  // Icons are legible (around 16px, not 11px)
  assert.match(quickActions, /<Icon size=\{16\}/, 'dynamic action icon size is legible');
  assert.match(quickActions, /<Copy size=\{16\}/, 'copy icon size is legible');
  assert.match(quickActions, /<ExternalLink size=\{16\}/, 'open detail icon size is legible');
  assert.match(quickActions, /<ChevronUp size=\{16\}/, 'expand icon size is legible');
  assert.doesNotMatch(quickActions, /size=\{11\}/, 'no 11px icons in quick actions');

  // Tone hierarchy and restrained base styling
  assert.match(quickActions, /act\.tone === 'primary'/, 'primary tone handler exists');
  assert.match(quickActions, /act\.tone === 'danger'/, 'danger tone handler exists');
  assert.match(quickActions, /act\.tone === 'warning'/, 'warning tone handler exists');
  assert.match(quickActions, /text-blue-700/, 'primary blue tone contrast');
  assert.match(quickActions, /text-rose-700/, 'danger rose tone contrast');
  assert.match(quickActions, /text-amber-700/, 'warning amber tone contrast');
  assert.match(quickActions, /text-slate-700/, 'neutral slate tone contrast');

  // Labels and accessibility behavior remain intact
  assert.match(quickActions, /aria-label=\{act\.label\}/);
  assert.match(quickActions, /title=\{act\.label\}/);
  assert.match(quickActions, /aria-label="Sao chép mã hồ sơ"/);
  assert.match(quickActions, /aria-label="Mở hồ sơ chi tiết"/);
  assert.match(quickActions, /aria-label=\{isExpanded \? 'Thu gọn' : 'Mở rộng tại chỗ'\}/);
  assert.match(quickActions, /flex w-full flex-wrap items-center justify-end/);
  assert.match(deckSource, /data-testid="dossier-header-zone" className="flex flex-wrap items-start/);
});
