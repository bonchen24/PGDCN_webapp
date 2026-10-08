import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('shared dossier deck components exist and export the unified DDT interaction primitives', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');

  assert.match(deckSource, /export function PgdcnDossierDeck/);
  assert.match(deckSource, /export function PgdcnDossierCard/);
  assert.match(deckSource, /export function PgdcnDossierCardHeader/);
  assert.match(deckSource, /export function PgdcnDossierQuickActions/);
  assert.match(deckSource, /export function PgdcnDossierCardExpanded/);
  assert.match(deckSource, /grid-cols-1 md:grid-cols-2 gap-4/);
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

  assert.match(groupCard, /handleCardClick/);
  assert.match(groupCard, /setIsExpanded/);
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
  assert.match(deckSource, /h-1 bg-slate-100 rounded-full/);

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


test('shared dossier quick actions remain compact on desktop and meet mobile touch and focus contracts', () => {
  const deckSource = read('../components/PgdcnDossierDeck.tsx');
  const quickActions = deckSource.match(/export function PgdcnDossierQuickActions[\s\S]*?\n}\n/)?.[0] || '';
  const actionClasses = [...quickActions.matchAll(/className=\{`([^`]*inline-flex[^`]*)`|className="([^"]*inline-flex[^"]*)"/g)]
    .map((match) => match[1] || match[2]);

  assert.equal(actionClasses.length, 4, 'dynamic, copy, open, and expand actions should share one control contract');
  for (const className of actionClasses) {
    assert.match(className, /min-h-11 min-w-11/);
    assert.match(className, /md:min-h-0 md:min-w-0 md:h-5\.5 md:w-5\.5/);
    assert.match(className, /md:min-h-0 md:min-w-0/);
    assert.match(className, /focus-visible:ring-2/);
  }
  assert.match(quickActions, /aria-label=\{act\.label\}/);
  assert.match(quickActions, /title=\{act\.label\}/);
  assert.match(quickActions, /flex w-full flex-wrap items-center justify-end/);
  assert.match(deckSource, /data-testid="dossier-header-zone" className="flex flex-wrap items-start/);
});