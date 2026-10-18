import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('business dossier workspace keeps the business-first projection contract', () => {
  const shared = read('../components/PgdcnDossierBusinessWorkspace.tsx');
  const pcn = read('../components/PcnDossierBusinessWorkspace.tsx');
  const pgd = read('../components/PgdDossierBusinessWorkspace.tsx');
  const pcnUtils = read('../utils/pcnBusinessWorkspace.ts');
  const design = read('../design.md');

  for (const marker of ['Next Action', 'dossier-hard-blockers', 'dossier-field-session', 'dossier-evidence-tracker', 'dossier-contextual-actions', "kind === 'sample'", 'dossier-event-timeline', 'Projection từ dữ liệu hiện có']) assert.ok(shared.includes(marker), marker);
  assert.ok(pcnUtils.includes("REQUEST: 'Yêu cầu & phân công'"), "REQUEST: 'Yêu cầu & phân công'");
  assert.ok(pcn.includes("title: '1. ' + PCN_BUSINESS_SECTION_LABELS.REQUEST"), "title: '1. ' + PCN_BUSINESS_SECTION_LABELS.REQUEST");
  for (const marker of ['Yêu cầu & phân công', 'Chứng từ thương mại/hải quan', 'Mẫu & thử nghiệm', 'PYC và KQTN', 'Kiểm tra trước thẩm xét', 'Mở mẫu & PYC', 'Mở soạn báo cáo', 'Sinh báo cáo']) assert.ok(pcn.includes(marker), marker);
  for (const marker of ['Phiên hiện trường', 'Event Timeline / Work Log', 'Mẫu & bàn giao PTN', 'KQTN & xem xét', 'Lập PYC PTN', 'Theo dõi KQTN', 'Soạn báo cáo giám định']) assert.ok(pgd.includes(marker), marker);
  assert.match(design, /5A\.26\. Business Dossier Workspace/);
  assert.match(design, /5A\.27\. Contextual Automation Shortcuts/);
});

test('the dossier projection does not introduce persistence or workflow mutation surfaces', () => {
  const shared = read('../components/PgdcnDossierBusinessWorkspace.tsx');
  for (const marker of ['fetch(', 'localStorage', 'supabase', 'transitionRequest']) assert.equal(shared.includes(marker), false, marker);
});
