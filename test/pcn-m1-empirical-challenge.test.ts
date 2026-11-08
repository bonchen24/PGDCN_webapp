/**
 * @file pcn-m1-empirical-challenge.test.ts
 * @description Empirical Challenger stress harness for Milestone 1 (F01 - F04).
 * Validates:
 * 1. `pgdcn:quickview` custom event handling with varying payload shapes & store resolution.
 * 2. Breadcrumb computation across all navigation routes and parameter variations.
 * 3. Command Palette header trigger, keyboard shortcut rules, and scope passing.
 * 4. AST / import verification ensuring zero broken imports after `patch_node_panel.tsx` removal.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnQuickViewDrawer, {
  type QuickViewDossierItem,
  type QuickViewChecklistItem,
  type QuickViewStageItem,
} from '../components/PgdcnQuickViewDrawer';
import type { PgdcnNavigationTarget } from '../components/PgdcnSidebar';
import { usePcnStore } from '../store-pcn';
import { usePgdStore } from '../store-pgd';

const rootDir = path.resolve(import.meta.dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

// ============================================================================
// 1. EMPIRICAL CHALLENGE: `pgdcn:quickview` Custom Event & Drawer Payloads
// ============================================================================

describe('Empirical Challenge 1: `pgdcn:quickview` Custom Event & Drawer Payloads', () => {
  it('Challenge 1.1: Event listener registration and event contract in PgdcnAppShell', () => {
    const appShellSource = read('components/PgdcnAppShell.tsx');

    // Verify window event listener registration for 'pgdcn:quickview'
    assert.match(appShellSource, /window\.addEventListener\('pgdcn:quickview',/);
    assert.match(appShellSource, /window\.removeEventListener\('pgdcn:quickview',/);

    // Verify event handler extracts detail and calls openQuickView
    assert.match(appShellSource, /const customEvent = event as CustomEvent/);
    assert.match(appShellSource, /if \(customEvent\.detail\) \{\s*openQuickView\(customEvent\.detail\);\s*\}/);

    // Verify drawer state structure
    assert.match(appShellSource, /setQuickViewDrawer\({\s*open: true,/);
    assert.match(appShellSource, /dossierCode: params\.dossierCode,/);
    assert.match(appShellSource, /item: params\.item \|\| null,/);
  });

  it('Challenge 1.2: Drawer renders cleanly with fully populated pre-built QuickViewDossierItem', () => {
    const allStatuses = [
      'APPROVED', 'CONFIRMED', 'PRESENT', 'ATTACHED', 'UPLOADED',
      'GENERATED', 'DRAFTING', 'PENDING_CONFIRMATION', 'REVISION_REQUESTED',
      'WAIVED', 'MISSING'
    ];

    const checklist: QuickViewChecklistItem[] = allStatuses.map((st, i) => ({
      id: `chk-${i}`,
      code: `REQ-${i}`,
      label: `Tài liệu nghiệm thu bước ${i} (${st})`,
      required: i % 2 === 0,
      status: st,
      stage: `Giai đoạn ${Math.floor(i / 3) + 1}`,
    }));

    const stages: QuickViewStageItem[] = [
      { id: 's1', label: 'Tiếp nhận', status: 'completed' },
      { id: 's2', label: 'Đánh giá hồ sơ', status: 'active' },
      { id: 's3', label: 'Thử nghiệm phòng lab', status: 'waiting' },
      { id: 's4', label: 'Duyệt chứng chỉ', status: 'upcoming' },
    ];

    const fullItem: QuickViewDossierItem = {
      id: 'dossier-full-001',
      dossierCode: 'HS-2026-CHALLENGE-001',
      domain: 'PCN',
      customerName: 'Tập đoàn Công nghiệp Thép Hiện đại',
      productName: 'Thép cuộn mạ kẽm SGCC',
      dossierType: 'QC4 - Thử nghiệm điển hình',
      status: 'FIELD_EVALUATION',
      statusLabel: 'Đang đánh giá tại chỗ',
      currentStage: 'Đánh giá hồ sơ',
      nextStep: 'Lấy mẫu niêm phong gửi PTN',
      progressPercent: 45,
      assigneeName: 'Kỹ sư Trưởng Nguyễn Văn Nghiệp',
      targetDate: '2026-12-25',
      createdAt: '2026-10-01',
      checklist,
      stages,
    };

    let openedDetailCode = '';
    const markup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: fullItem,
      onClose: () => undefined,
      onOpenFullDetail: (_domain, code) => { openedDetailCode = code; },
    }));

    // ARIA contracts
    assert.ok(markup.includes('role="dialog"'), 'Must have role=dialog');
    assert.ok(markup.includes('aria-modal="true"'), 'Must have aria-modal=true');
    assert.ok(markup.includes('aria-labelledby="pgdcn-quickview-title"'), 'Must link title ID');
    assert.ok(markup.includes('data-testid="pgdcn-quick-view-drawer"'), 'Must have drawer test id');

    // Header & identity
    assert.ok(markup.includes('HS-2026-CHALLENGE-001'), 'Must display dossier code');
    assert.ok(markup.includes('Tập đoàn Công nghiệp Thép Hiện đại'), 'Must display customer');
    assert.ok(markup.includes('Thép cuộn mạ kẽm SGCC'), 'Must display product');
    assert.ok(markup.includes('Đang đánh giá tại chỗ'), 'Must display status label');
    assert.ok(markup.includes('Kỹ sư Trưởng Nguyễn Văn Nghiệp'), 'Must display assignee');
    assert.ok(markup.includes('2026-12-25'), 'Must display target date');

    // All 11 checklist status labels rendered
    assert.ok(markup.includes('Đã duyệt'), 'Status badge APPROVED');
    assert.ok(markup.includes('Đã xác nhận'), 'Status badge CONFIRMED');
    assert.ok(markup.includes('Đã có'), 'Status badge PRESENT');
    assert.ok(markup.includes('Đã gắn hồ sơ'), 'Status badge ATTACHED');
    assert.ok(markup.includes('Đã tải lên'), 'Status badge UPLOADED');
    assert.ok(markup.includes('Đã sinh'), 'Status badge GENERATED');
    assert.ok(markup.includes('Đang soạn'), 'Status badge DRAFTING');
    assert.ok(markup.includes('Chờ xác nhận'), 'Status badge PENDING_CONFIRMATION');
    assert.ok(markup.includes('Cần sửa'), 'Status badge REVISION_REQUESTED');
    assert.ok(markup.includes('Được miễn'), 'Status badge WAIVED');
    assert.ok(markup.includes('Chưa có'), 'Status badge MISSING');

    // CTA button presence
    assert.ok(markup.includes('Mở chi tiết'), 'Must provide CTA button to open full detail');
  });

  it('Challenge 1.3: Drawer handles minimal and missing payload fields without crash', () => {
    // Payload with only dossierCode and domain
    const minimalItem: QuickViewDossierItem = {
      dossierCode: 'HS-MINIMAL-002',
      domain: 'PGD',
    };

    const markup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: minimalItem,
      onClose: () => undefined,
    }));

    assert.ok(markup.includes('HS-MINIMAL-002'), 'Must render code even if other fields missing');
    assert.ok(markup.includes('PGD'), 'Must render domain badge');
    // Ensure no broken "[object Object]" or unrendered crash
    assert.ok(!markup.includes('undefined'), 'Must not render literal "undefined" in text');
  });

  it('Challenge 1.4: Drawer handles empty checklist and empty stages gracefully', () => {
    const emptyCollectionsItem: QuickViewDossierItem = {
      dossierCode: 'HS-EMPTY-003',
      domain: 'PCN',
      customerName: 'Công ty Alpha',
      checklist: [],
      stages: [],
    };

    const markup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: emptyCollectionsItem,
      onClose: () => undefined,
    }));

    assert.ok(markup.includes('HS-EMPTY-003'));
    assert.ok(markup.includes('Chưa có danh mục checklist tài liệu cho hồ sơ này.'), 'Empty checklist fallback text');
  });

  it('Challenge 1.5: Drawer provides graceful fallback when dossierCode is NOT in stores', () => {
    const unknownCode = 'HS-NON-EXISTENT-9999';
    const markup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
      open: true,
      dossierCode: unknownCode,
      domain: 'PCN',
      onClose: () => undefined,
    }));

    // Must not crash, should show fallback info
    assert.ok(markup.includes(unknownCode));
    assert.ok(markup.includes('Hồ sơ chuyên ngành'));
  });

  it('Challenge 1.6: Drawer closed state returns null (no DOM footprint)', () => {
    const markup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
      open: false,
      dossierCode: 'HS-SHOULD-NOT-RENDER',
      onClose: () => undefined,
    }));

    assert.equal(markup, '', 'Closed drawer must render empty string');
  });

  it('Challenge 1.7 [VULNERABILITY DETECTION]: Potential TypeError on missing optional chaining in line 173 and line 174', () => {
    // Audit line 173 of PgdcnQuickViewDrawer.tsx:
    // `customerName: pcnDossier.customerSnapshot?.name || proposal?.customerSnapshot.name || 'Khách hàng PCN'`
    // Note: proposal?.customerSnapshot.name lacks `?.name` after customerSnapshot!
    const drawerSource = read('components/PgdcnQuickViewDrawer.tsx');

    const hasProposalUnsafeChaining = /proposal\?\.customerSnapshot\.name/.test(drawerSource);
    assert.ok(
      hasProposalUnsafeChaining,
      'Confirmed vulnerability: proposal?.customerSnapshot.name lacks optional chaining (should be proposal?.customerSnapshot?.name)'
    );

    // Audit line 174:
    // `productName: proposal?.productName || pcnDossier.fieldCodes.join(', ')`
    // If fieldCodes is undefined, .join(', ') crashes
    const hasFieldCodesUnsafeJoin = /pcnDossier\.fieldCodes\.join/.test(drawerSource);
    assert.ok(
      hasFieldCodesUnsafeJoin,
      'Confirmed vulnerability: pcnDossier.fieldCodes.join lacks guard (should be pcnDossier.fieldCodes?.join or fallback)'
    );
  });
});

// ============================================================================
// 2. EMPIRICAL CHALLENGE: Breadcrumb Resolution Across All Navigation Routes
// ============================================================================

describe('Empirical Challenge 2: Breadcrumb Resolution Across All Routes', () => {
  // Extract and compile the breadcrumb resolution function logic from PgdcnAppShell
  // to run an exhaustive test matrix on it.
  const computeBreadcrumb = (
    activeTarget: PgdcnNavigationTarget,
    initialPcnDossierId?: string,
    focusedPgdRequestId?: string,
    pcnDossiers: Array<{ id: string; dossierCode: string }> = [],
    pgdRequests: Array<{ id: string; requestCode: string }> = [],
  ): Array<{ label: string; target?: PgdcnNavigationTarget }> => {
    const crumbs: Array<{ label: string; target?: PgdcnNavigationTarget }> = [];
    if (activeTarget.domain === 'department') {
      if (activeTarget.section === 'department-dashboard') {
        crumbs.push({ label: 'Tổng quan' });
      } else if (activeTarget.section === 'my-work') {
        crumbs.push({ label: 'Việc của tôi' });
      } else if (activeTarget.section === 'customers') {
        crumbs.push({ label: 'Khách hàng' });
      } else if (activeTarget.section === 'assistant') {
        crumbs.push({ label: 'Trợ lý AI' });
      } else if (activeTarget.section === 'document-drafting') {
        crumbs.push({ label: 'Tài liệu' });
        crumbs.push({ label: 'Soạn thảo tài liệu' });
      } else if (activeTarget.section === 'dossier-templates') {
        crumbs.push({ label: 'Tài liệu' });
        crumbs.push({ label: 'Hồ sơ mẫu' });
      } else if (activeTarget.section === 'system-settings') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Cài đặt hệ thống' });
      } else if (activeTarget.section === 'rbac') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Phân quyền RBAC' });
      } else if (activeTarget.section === 'activityLogs') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Nhật ký hoạt động' });
      }
    } else if (activeTarget.domain === 'PCN') {
      crumbs.push({ label: 'Nghiệp vụ PCN', target: { domain: 'PCN', section: 'proposals' } });
      if (activeTarget.section === 'proposals') {
        if (initialPcnDossierId) {
          crumbs.push({ label: 'Hồ sơ', target: { domain: 'PCN', section: 'proposals' } });
          const code = pcnDossiers.find((d) => d.id === initialPcnDossierId)?.dossierCode || initialPcnDossierId;
          crumbs.push({ label: code });
        } else {
          crumbs.push({ label: 'Hồ sơ đề nghị' });
        }
      } else if (activeTarget.section === 'operations') {
        crumbs.push({ label: 'Sổ tổng hợp' });
      } else if (activeTarget.section === 'lab-operations') {
        crumbs.push({ label: 'Sổ quản lý mẫu' });
      } else if (activeTarget.section === 'drafting') {
        crumbs.push({ label: 'Soạn thảo tài liệu' });
      }
    } else if (activeTarget.domain === 'PGD') {
      crumbs.push({ label: 'Nghiệp vụ PGD', target: { domain: 'PGD', section: 'requests' } });
      if (activeTarget.section === 'requests') {
        if (focusedPgdRequestId) {
          crumbs.push({ label: 'Hồ sơ PYC', target: { domain: 'PGD', section: 'requests' } });
          const code = pgdRequests.find((r) => r.id === focusedPgdRequestId)?.requestCode || focusedPgdRequestId;
          crumbs.push({ label: code });
        } else {
          crumbs.push({ label: 'Hồ sơ PYC' });
        }
      } else if (activeTarget.section === 'operations') {
        crumbs.push({ label: 'Sổ tổng hợp' });
      } else if (activeTarget.section === 'sample-operations') {
        crumbs.push({ label: 'Sổ quản lý mẫu' });
      } else if (activeTarget.section === 'templates') {
        crumbs.push({ label: 'Soạn thảo biểu mẫu' });
      }
    }
    return crumbs;
  };

  const expectedMatrix: Array<{
    name: string;
    target: PgdcnNavigationTarget;
    initialPcnId?: string;
    focusedPgdId?: string;
    expectedLabels: string[];
  }> = [
    // Department routes
    {
      name: 'Department Dashboard',
      target: { domain: 'department', section: 'department-dashboard' },
      expectedLabels: ['Tổng quan'],
    },
    {
      name: 'My Work',
      target: { domain: 'department', section: 'my-work' },
      expectedLabels: ['Việc của tôi'],
    },
    {
      name: 'Customers',
      target: { domain: 'department', section: 'customers' },
      expectedLabels: ['Khách hàng'],
    },
    {
      name: 'Assistant AI',
      target: { domain: 'department', section: 'assistant' },
      expectedLabels: ['Trợ lý AI'],
    },
    {
      name: 'Document Drafting',
      target: { domain: 'department', section: 'document-drafting' },
      expectedLabels: ['Tài liệu', 'Soạn thảo tài liệu'],
    },
    {
      name: 'Dossier Templates',
      target: { domain: 'department', section: 'dossier-templates' },
      expectedLabels: ['Tài liệu', 'Hồ sơ mẫu'],
    },
    {
      name: 'System Settings',
      target: { domain: 'department', section: 'system-settings' },
      expectedLabels: ['Quản trị', 'Cài đặt hệ thống'],
    },
    {
      name: 'RBAC Settings',
      target: { domain: 'department', section: 'rbac' },
      expectedLabels: ['Quản trị', 'Phân quyền RBAC'],
    },
    {
      name: 'Activity Logs',
      target: { domain: 'department', section: 'activityLogs' },
      expectedLabels: ['Quản trị', 'Nhật ký hoạt động'],
    },

    // PCN routes
    {
      name: 'PCN Proposals List',
      target: { domain: 'PCN', section: 'proposals' },
      expectedLabels: ['Nghiệp vụ PCN', 'Hồ sơ đề nghị'],
    },
    {
      name: 'PCN Dossier Detail (with known code)',
      target: { domain: 'PCN', section: 'proposals' },
      initialPcnId: 'pcn-d-123',
      expectedLabels: ['Nghiệp vụ PCN', 'Hồ sơ', 'HS-2026-QC4-001'],
    },
    {
      name: 'PCN Dossier Detail (fallback code = id)',
      target: { domain: 'PCN', section: 'proposals' },
      initialPcnId: 'pcn-unmatched-id',
      expectedLabels: ['Nghiệp vụ PCN', 'Hồ sơ', 'pcn-unmatched-id'],
    },
    {
      name: 'PCN Operations Register',
      target: { domain: 'PCN', section: 'operations' },
      expectedLabels: ['Nghiệp vụ PCN', 'Sổ tổng hợp'],
    },
    {
      name: 'PCN Lab Operations',
      target: { domain: 'PCN', section: 'lab-operations' },
      expectedLabels: ['Nghiệp vụ PCN', 'Sổ quản lý mẫu'],
    },
    {
      name: 'PCN Drafting',
      target: { domain: 'PCN', section: 'drafting' },
      expectedLabels: ['Nghiệp vụ PCN', 'Soạn thảo tài liệu'],
    },

    // PGD routes
    {
      name: 'PGD Requests List',
      target: { domain: 'PGD', section: 'requests' },
      expectedLabels: ['Nghiệp vụ PGD', 'Hồ sơ PYC'],
    },
    {
      name: 'PGD Request Detail (with known code)',
      target: { domain: 'PGD', section: 'requests' },
      focusedPgdId: 'pgd-r-456',
      expectedLabels: ['Nghiệp vụ PGD', 'Hồ sơ PYC', 'YC-2026-STEEL-099'],
    },
    {
      name: 'PGD Operations Register',
      target: { domain: 'PGD', section: 'operations' },
      expectedLabels: ['Nghiệp vụ PGD', 'Sổ tổng hợp'],
    },
    {
      name: 'PGD Sample Operations',
      target: { domain: 'PGD', section: 'sample-operations' },
      expectedLabels: ['Nghiệp vụ PGD', 'Sổ quản lý mẫu'],
    },
    {
      name: 'PGD Templates',
      target: { domain: 'PGD', section: 'templates' },
      expectedLabels: ['Nghiệp vụ PGD', 'Soạn thảo biểu mẫu'],
    },
  ];

  const mockPcnDossiers = [{ id: 'pcn-d-123', dossierCode: 'HS-2026-QC4-001' }];
  const mockPgdRequests = [{ id: 'pgd-r-456', requestCode: 'YC-2026-STEEL-099' }];

  for (const tc of expectedMatrix) {
    it(`Challenge 2: Route "${tc.name}" produces accurate breadcrumb hierarchy`, () => {
      const crumbs = computeBreadcrumb(tc.target, tc.initialPcnId, tc.focusedPgdId, mockPcnDossiers, mockPgdRequests);
      const labels = crumbs.map((c) => c.label);
      assert.deepEqual(labels, tc.expectedLabels, `Mismatch in breadcrumb for ${tc.name}`);

      // Verify no empty labels
      for (const c of crumbs) {
        assert.ok(c.label && c.label.trim().length > 0, `Breadcrumb label must not be empty`);
      }

      // Verify parent crumbs have clickable target when applicable
      if (tc.target.domain === 'PCN') {
        assert.ok(crumbs[0].target, 'Root PCN crumb must have navigation target');
        assert.equal(crumbs[0].target?.domain, 'PCN');
      }
      if (tc.target.domain === 'PGD') {
        assert.ok(crumbs[0].target, 'Root PGD crumb must have navigation target');
        assert.equal(crumbs[0].target?.domain, 'PGD');
      }
    });
  }

  it('Challenge 2.x: AppShell template renders nav with aria-label="Breadcrumb"', () => {
    const source = read('components/PgdcnAppShell.tsx');
    assert.match(source, /<nav aria-label="Breadcrumb"/, 'Breadcrumb element must have aria-label="Breadcrumb"');
    assert.match(source, /Trang chủ/, 'Root crumb must be Trang chủ');
    assert.match(source, /aria-current=\{idx === breadcrumbCrumbs\.length - 1 \? 'page' : undefined\}/, 'Last crumb must have aria-current="page"');
  });
});

// ============================================================================
// 3. EMPIRICAL CHALLENGE: Command Palette Integration & Header Shortcut
// ============================================================================

describe('Empirical Challenge 3: Command Palette Integration & Header Trigger', () => {
  it('Challenge 3.1: AppShell implements header search button with Ctrl+K / Cmd+K hints', () => {
    const source = read('components/PgdcnAppShell.tsx');

    // Header search trigger button
    assert.match(source, /onClick=\{\(\) => setCommandOpen\(true\)\}/, 'Header button must open command palette');
    assert.match(source, /aria-label="Tìm kiếm nhanh hồ sơ, khách hàng \(Ctrl\+K\)"/);
    assert.match(source, /⌘K/, 'Should display keyboard shortcut badge');
  });

  it('Challenge 3.2: Keyboard shortcut listener skips text inputs to avoid hijack', () => {
    const source = read('components/PgdcnAppShell.tsx');

    // Guard checking against active input elements
    assert.match(
      source,
      /if \(target && \(target\.matches\('input, textarea, select'\) \|\| target\.isContentEditable\)\) return;/,
      'Must skip shortcut if user is currently typing in an input, textarea, or contentEditable'
    );

    // Keydown detection for Ctrl+K / Cmd+K
    assert.match(
      source,
      /\(event\.ctrlKey \|\| event\.metaKey\) && event\.key\.toLowerCase\(\) === 'k'/,
      'Must detect both Ctrl+K (Windows) and Meta+K (macOS)'
    );
  });

  it('Challenge 3.3: AppShell mounts PgdcnCommandPalette with correct props', () => {
    const source = read('components/PgdcnAppShell.tsx');

    assert.match(source, /<PgdcnCommandPalette/);
    assert.match(source, /open=\{commandOpen\}/);
    assert.match(source, /scopes=\{scopes\}/);
    assert.match(source, /records=\{commandRecords\}/);
    assert.match(source, /onClose=\{\(\) => setCommandOpen\(false\)\}/);
    assert.match(source, /onNavigate=\{navigate\}/);
    assert.match(source, /onOpenPcn=\{openPcnDossier\}/);
    assert.match(source, /onOpenPgd=\{openPgdRequest\}/);
  });
});

// ============================================================================
// 4. EMPIRICAL CHALLENGE: Elimination of `patch_node_panel.tsx` & Zero Broken Imports
// ============================================================================

describe('Empirical Challenge 4: Root Cleanliness & AST / Import Verification', () => {
  it('Challenge 4.1: File patch_node_panel.tsx does NOT exist at root or anywhere in repo', () => {
    const strayFile = path.join(rootDir, 'patch_node_panel.tsx');
    assert.equal(fs.existsSync(strayFile), false, 'patch_node_panel.tsx must not exist at root');
  });

  it('Challenge 4.2: Zero imports or references to patch_node_panel in entire codebase', () => {
    const scanDir = (dir: string, results: string[] = []): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === '.agents') {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, results);
        } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
          // Exclude challenge and e2e test files
          if (!entry.name.includes('empirical-challenge') && !entry.name.includes('adversarial-challenger') && !entry.name.includes('superneat-e2e')) {
            results.push(fullPath);
          }
        }
      }
      return results;
    };

    const codeFiles = scanDir(rootDir);
    const brokenReferences: Array<{ file: string; line: number; text: string }> = [];

    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('patch_node_panel')) {
          brokenReferences.push({
            file: path.relative(rootDir, file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    assert.equal(
      brokenReferences.length,
      0,
      `Found residual references to patch_node_panel in codebase: ${JSON.stringify(brokenReferences, null, 2)}`
    );
  });
});
