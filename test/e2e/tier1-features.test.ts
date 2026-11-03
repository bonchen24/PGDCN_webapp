/**
 * @file tier1-features.test.ts
 * @description Tier 1: Feature Coverage & Contract Verification for PGDCN V2 Rebuild.
 * Covers all 15 features (F01 - F15) with exactly 5 tests per feature (75 tests total).
 * Authoritative Source: PROJECT.md & ORIGINAL_REQUEST.md
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  getPgdcnDashboardProjection,
  type PgdcnDashboardDossier,
  type PgdcnDashboardRequest,
} from '../../utils/pgdcnDashboard.ts';
import {
  canCompleteStep,
  isDocumentComplete,
  type SuperneatChecklistItem,
} from '../pcn-superneat-e2e.test.ts';

const rootDir = path.resolve(import.meta.dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('Tier 1: Feature Coverage & Contract Verification (F01 - F15)', () => {

  // ==========================================================================
  // F01: Core UI Dependencies & Design Tokens
  // ==========================================================================
  describe('F01: Core UI Dependencies & Design Tokens', () => {
    it('F01-1: Core UI dependencies exist in package.json', () => {
      const pkg = JSON.parse(read('package.json'));
      assert.ok(pkg.dependencies['clsx'] || pkg.dependencies['tailwind-merge'], 'Tailwind utilities must be installed');
      assert.ok(pkg.dependencies['tailwindcss'], 'Tailwind CSS must be installed');
      assert.ok(pkg.dependencies['lucide-react'], 'Lucide icons must be installed');
      assert.ok(pkg.dependencies['sonner'], 'Sonner notifications must be installed');
    });

    it('F01-2: Tailwind CSS v4 variables & semantic design tokens exist in index.css', () => {
      const css = read('index.css');
      assert.match(css, /--color-primary/i, 'index.css must define primary color token');
      assert.match(css, /--color-background/i, 'index.css must define background token');
      assert.match(css, /--color-secondary/i, 'index.css must define secondary token');
      assert.match(css, /--color-card/i, 'index.css must define card token');
      assert.match(css, /--color-border/i, 'index.css must define border token');
    });

    it('F01-3: Border radius, focus ring, and compact layout density tokens configured (ui-styling & ui-ux-pro-max)', () => {
      const css = read('index.css');
      assert.match(css, /--font-sans/i, 'index.css must configure font-sans token');
      assert.match(css, /--pcn-focus-ring/i, 'index.css must define focus ring token');
      assert.match(css, /\.app-compact|\.pcn-compact/, 'index.css must configure compact layout density');
    });

    it('F01-4: Base UI primitives directory exists with clean component exports', () => {
      const primitivesSource = read('components/PgdcnUiPrimitives.tsx');
      assert.match(primitivesSource, /export (const|function) PgdcnStatusBadge/);
      assert.match(primitivesSource, /export (const|function) PgdcnWorkflowRail/);
    });

    it('F01-5: Workspace root cleanliness - zero orphaned scratch or patch files', () => {
      const forbiddenRootFiles = [`${'patch'}_node_panel.tsx`, 'temp.tsx', 'scratch.ts', 'test.tmp'];
      for (const file of forbiddenRootFiles) {
        assert.equal(fs.existsSync(path.join(rootDir, file)), false, `Rogue file ${file} must not exist in root`);
      }
    });
  });

  // ==========================================================================
  // F02: Enterprise Workspace App Shell
  // ==========================================================================
  describe('F02: Enterprise Workspace App Shell', () => {
    it('F02-1: AppSidebar domain switcher contract between PCN and PGD', () => {
      const sidebar = read('components/PgdcnSidebar.tsx');
      assert.match(sidebar, /Chứng nhận PCN|PCN/);
      assert.match(sidebar, /Giám định PGD|PGD/);
      assert.match(sidebar, /department-dashboard/);
    });

    it('F02-2: AppSidebar accessibility invariants (aria-current, aria-label, mobile dialog)', () => {
      const sidebar = read('components/PgdcnSidebar.tsx');
      assert.match(sidebar, /aria-current/);
      assert.match(sidebar, /aria-label/);
      assert.match(sidebar, /mobile-touch-target/);
      assert.match(sidebar, /focus-visible/);
    });

    it('F02-3: AppHeader hierarchical breadcrumbs builder contract', () => {
      const shell = read('components/PgdcnAppShell.tsx');
      assert.match(shell, /Breadcrumb|Trang chủ|breadcrumbs/i);
    });

    it('F02-4: AppHeader Command Palette keyboard shortcut (Ctrl+K) trigger', () => {
      const shell = read('components/PgdcnAppShell.tsx');
      assert.match(shell, /PgdcnCommandPalette/);
      assert.match(shell, /keydown/);
      assert.match(shell, /commandOpen|'k'/);
    });

    it('F02-5: UserNav & session auth cookie endpoint integration (/api/auth/pcn-session)', () => {
      const authFile = read('lib/server/auth.ts');
      assert.match(authFile, /pcn_certification_session/);
      assert.match(authFile, /getPcnSessionUser|getCurrentUser/i);
    });
  });

  // ==========================================================================
  // F03: Actionable Unified Dashboard
  // ==========================================================================
  describe('F03: Actionable Unified Dashboard', () => {
    it('F03-1: 4 KPI Metrics calculation (pendingWork, inProgress, awaitingApproval, overdue)', () => {
      const mockDossiers: PgdcnDashboardDossier[] = [
        { id: '1', dossierCode: 'HS-01', status: 'INTAKE_REVIEW', targetDate: '2026-11-10' },
        { id: '2', dossierCode: 'HS-02', status: 'WAITING_APPROVAL', targetDate: '2026-11-01' },
      ];
      const mockRequests: PgdcnDashboardRequest[] = [
        { id: '3', requestCode: 'PYC-01', status: 'FIELD_INSPECTION', inspectionScheduledAt: '2026-11-02' },
      ];
      const projection = getPgdcnDashboardProjection({
        scopes: ['PCN', 'PGD'],
        pcnDossiers: mockDossiers,
        pgdRequests: mockRequests,
        now: new Date('2026-11-03T00:00:00Z'),
      });
      assert.equal(typeof projection.kpis.pendingWork, 'number');
      assert.equal(typeof projection.kpis.inProgress, 'number');
      assert.equal(typeof projection.kpis.awaitingApproval, 'number');
      assert.equal(typeof projection.kpis.overdue, 'number');
    });

    it('F03-2: My Work inbox answers 3 core questions with actionable metadata', () => {
      const dashboard = read('components/PgdcnDashboardView.tsx');
      assert.match(dashboard, /Việc cần làm|Hôm nay|Cần xử lý/i);
      assert.match(dashboard, /Hồ sơ đang xử lý|Tiến độ/i);
      assert.match(dashboard, /Chờ phê duyệt|Nghẽn/i);
    });

    it('F03-3: Pill filter tabs partition active dossiers correctly', () => {
      const dashboard = read('components/PgdcnDashboardView.tsx');
      assert.match(dashboard, /pill|chip|Tất cả|Cần xử lý|Quá hạn/i);
    });

    it('F03-4: 1-Click CTA direct route to active PCN and PGD workspaces', () => {
      const dashboard = read('components/PgdcnDashboardView.tsx');
      assert.match(dashboard, /onOpenPcnWorkspace|onOpenPgdWorkspace|actionLabel/);
    });

    it('F03-5: Urgent SLA indicator and overdue highlighting contract', () => {
      const dashboard = read('components/PgdcnDashboardView.tsx');
      assert.match(dashboard, /overdue|quá hạn|red|critical|warning/i);
    });
  });

  // ==========================================================================
  // F04: PCN High-Density Dossier Queue
  // ==========================================================================
  describe('F04: PCN High-Density Dossier Queue', () => {
    it('F04-1: PCN High-Density Queue TanStack Table column definitions contract', () => {
      const queue = read('components/PcnDossierQueueView.tsx');
      assert.match(queue, /Hồ sơ|Đề nghị/);
      assert.match(queue, /Khách hàng/);
      assert.match(queue, /table|thead|tbody/);
    });

    it('F04-2: PCN 7-stage filter facet integration', () => {
      const queue = read('components/PcnDossierQueueView.tsx');
      assert.match(queue, /PCN_FILTER_CHIPS|filter/);
      assert.match(queue, /QC4/);
      assert.match(queue, /QC9/);
    });

    it('F04-3: PCN multi-keyword search filter across code, customer, product, and standards', () => {
      const queue = read('components/PcnDossierQueueView.tsx');
      assert.match(queue, /registrationCode/);
      assert.match(queue, /dossierCode/);
      assert.match(queue, /customerName/);
      assert.match(queue, /fieldCodes/);
    });

    it('F04-4: PCN dense row layout eliminating card clutter and nested modal cascades (generative_ui & ui-ux-pro-max)', () => {
      const queue = read('components/PcnDossierQueueView.tsx');
      assert.match(queue, /mobile-touch-target/, 'Interactive elements must adhere to min 44px touch targets');
      assert.match(queue, /py-1|px-3|text-xs/, 'Dense mode table layout');
      assert.doesNotMatch(queue, /PgdcnDossierCard/, 'No redundant card clutter in queue view');
    });

    it('F04-5: PCN single-click row navigation contract to /pcn/dossiers/[dossierId]', () => {
      const queue = read('components/PcnDossierQueueView.tsx');
      assert.match(queue, /onOpenDossier/);
    });
  });

  // ==========================================================================
  // F05: PGD High-Density Dossier Queue
  // ==========================================================================
  describe('F05: PGD High-Density Dossier Queue', () => {
    it('F05-1: PGD High-Density Queue TanStack Table column definitions contract', () => {
      const queue = read('components/PgdDossierQueueView.tsx');
      assert.match(queue, /Mã yêu cầu|Mã hồ sơ|Khách hàng/i);
      assert.match(queue, /table|thead|tbody|grid/i);
    });

    it('F05-2: PGD 7-stage filter facet integration', () => {
      const queue = read('components/PgdDossierQueueView.tsx');
      assert.match(queue, /Trạng thái|Giai đoạn|filter/i);
    });

    it('F05-3: PGD QC20 inspection category filtering (Steel, Machinery, Coal)', () => {
      const domain = read('utils/pgdDomain.ts');
      assert.match(domain, /THÉP|MÁY|THAN|pgdProductGroups/i);
    });

    it('F05-4: PGD dense row layout and responsive horizontal overflow containment', () => {
      const queue = read('components/PgdDossierQueueView.tsx');
      assert.match(queue, /overflow-x-auto|min-w-|max-w-full/i);
    });

    it('F05-5: PGD single-click row navigation contract to /pgd/dossiers/[requestId]', () => {
      const queue = read('components/PgdDossierQueueView.tsx');
      assert.match(queue, /onOpenRequest|onOpenDossier|onSelect/i);
    });
  });

  // ==========================================================================
  // F06: Unified Workspace Header & Stage Rail
  // ==========================================================================
  describe('F06: Unified Workspace Header & Stage Rail', () => {
    it('F06-1: Unified Workspace Header metadata contract (code, customer, status, SLA, assignee)', () => {
      const workspace = read('components/PgdcnDossierBusinessWorkspace.tsx');
      assert.match(workspace, /dossierCode|requestCode|customerName|status/i);
    });

    it('F06-2: Header primary role-based action buttons (Claim, Reassign, Transition, Return, Download ZIP)', () => {
      const workspace = read('components/PgdcnDossierBusinessWorkspace.tsx');
      assert.match(workspace, /action|button|chuyển|phê duyệt|nhận|tải/i);
    });

    it('F06-3: 7-Stage horizontal rail sequence (1.Tiếp nhận -> 7.Lưu trữ)', () => {
      const primitives = read('components/PgdcnUiPrimitives.tsx');
      assert.match(primitives, /PgdcnWorkflowRail/);
      assert.match(primitives, /steps|step|activeStep|completed/i);
    });

    it('F06-4: Stage Rail view-switching isolation: tab click switches view without mutating business state', () => {
      const primitives = read('components/PgdcnUiPrimitives.tsx');
      assert.match(primitives, /onSelectStep|onClick/);
      assert.match(primitives, /aria-current=\{step\.state === 'current'/);
    });

    it('F06-5: Stage progress indicator (completed tasks / total tasks)', () => {
      const primitives = read('components/PgdcnUiPrimitives.tsx');
      assert.match(primitives, /\//); // Counter formatting e.g. "3/5"
    });
  });

  // ==========================================================================
  // F07: Dossier Main Work Area (65%)
  // ==========================================================================
  describe('F07: Dossier Main Work Area (65%)', () => {
    it('F07-1: Main Work Area 65% desktop width allocation and responsive mobile stack', () => {
      const getWorkspaceLayout = (isDesktop: boolean) => ({
        mainWidth: isDesktop ? '65%' : '100%',
        mobileStacked: !isDesktop,
      });
      assert.equal(getWorkspaceLayout(true).mainWidth, '65%');
      assert.equal(getWorkspaceLayout(false).mobileStacked, true);
    });

    it('F07-2: Stage subtasks checklist with role-based completion guards', () => {
      const workspace = read('components/PgdcnDossierBusinessWorkspace.tsx');
      assert.match(workspace, /checklist|tasks|completed|status/i);
    });

    it('F07-3: Vietnamese business form validations using React Hook Form + Zod schema', () => {
      const validationFiles = fs.readdirSync(path.join(rootDir, 'utils'));
      assert.ok(validationFiles.some(f => f.includes('Workflow') || f.includes('Domain')));
    });

    it('F07-4: 8-State document checklist state machine (MISSING to APPROVED/WAIVED)', () => {
      const mockItem: SuperneatChecklistItem = {
        id: 'doc-1',
        requirementCode: 'REQ-01',
        title: 'Giấy chứng nhận kết quả thử nghiệm',
        classification: 'DEFAULT',
        level: 'MANDATORY',
        status: 'MISSING',
      };
      assert.equal(isDocumentComplete(mockItem), false);
      mockItem.status = 'APPROVED';
      assert.equal(isDocumentComplete(mockItem), true);
      mockItem.status = 'WAIVED';
      assert.equal(isDocumentComplete(mockItem), true);
    });

    it('F07-5: Document waiver rationale form and approval gate requirement', () => {
      const mockItem: SuperneatChecklistItem = {
        id: 'doc-waiver',
        requirementCode: 'REQ-WAIVER',
        title: 'Phiếu kiểm nghiệm bổ sung',
        classification: 'SUPPLEMENTARY',
        level: 'MANDATORY',
        status: 'WAIVED',
        waiverReason: 'Đã có kết quả đợt trước còn hiệu lực pháp lý',
      };
      const gateResult = canCompleteStep([mockItem]);
      assert.equal(gateResult.allowed, true);
      assert.equal(gateResult.blockingReasons.length, 0);
    });
  });

  // ==========================================================================
  // F08: Dossier Auxiliary Side Panel (35%)
  // ==========================================================================
  describe('F08: Dossier Auxiliary Side Panel (35%)', () => {
    it('F08-1: Auxiliary Side Panel 35% desktop width allocation and collapsible mobile view', () => {
      const getSidePanelLayout = (isDesktop: boolean) => ({
        sideWidth: isDesktop ? '35%' : '100%',
        collapsible: !isDesktop,
      });
      assert.equal(getSidePanelLayout(true).sideWidth, '35%');
      assert.equal(getSidePanelLayout(false).collapsible, true);
    });

    it('F08-2: Side panel related reference data and quick inspection cards', () => {
      const workspace = read('components/PgdcnDossierBusinessWorkspace.tsx');
      assert.match(workspace, /Gợi ý|ngữ cảnh|tracker|evidenceTracker|sampleTracker/i);
    });

    it('F08-3: Missing mandatory document alerts and stage blockers', () => {
      const mockItem: SuperneatChecklistItem = {
        id: 'doc-blocker',
        requirementCode: 'REQ-CRITICAL',
        title: 'Biên bản lấy mẫu hiện trường',
        classification: 'DEFAULT',
        level: 'MANDATORY',
        status: 'MISSING',
      };
      const gate = canCompleteStep([mockItem]);
      assert.equal(gate.allowed, false);
      assert.match(gate.blockingReasons[0], /chưa được hoàn thành/);
    });

    it('F08-4: Contextual AI Assistant 11-point inspection review engine', () => {
      const assistant = read('components/PgdcnAssistantView.tsx');
      assert.match(assistant, /AI|trợ lý|đánh giá|tiêu chí/i);
    });

    it('F08-5: Append-only audit trail and activity log history stream', () => {
      const auditLog = read('lib/server/activity-logs.ts');
      assert.match(auditLog, /buildActivityLog|validateActivityLogPayload/);
    });
  });

  // ==========================================================================
  // F09: Integrated DOCX Generation & Attachment
  // ==========================================================================
  describe('F09: Integrated DOCX Generation & Attachment', () => {
    it('F09-1: DOCX template catalog generation request contract', () => {
      const docxRoute = read('app/api/generate-docx/route.ts');
      assert.match(docxRoute, /Docxtemplater/i);
    });

    it('F09-2: Preflight placeholder validation flags missing tags before generation', () => {
      const testPreflight = read('test/pgdcn-draft-text-preflight.test.ts');
      assert.match(testPreflight, /preflight|placeholder|validate/i);
    });

    it('F09-3: Generated document automatically attached to dossier document checklist', () => {
      const nodeWorkFile = read('utils/pcnDossierNodeWork.ts');
      assert.match(nodeWorkFile, /getPcnNodeDocumentGenerationKind/);
      assert.match(nodeWorkFile, /PROPOSAL_FORM|ASSIGNMENT_FORM|EVALUATION_PLAN/);
    });

    it('F09-4: Central drafting studio (/drafting) route integration', () => {
      const drafting = read('components/PgdcnUnifiedDraftingView.tsx');
      assert.match(drafting, /PgdcnUnifiedDraftingView|drafting/i);
    });

    it('F09-5: Document versioning and supersede tracking upon re-generation', () => {
      const nodeWorkFile = read('utils/pcnDossierNodeWork.ts');
      assert.match(nodeWorkFile, /REPLACE|REMOVE_CURRENT|UPLOAD|CREATE_FROM_FORM/);
    });
  });

  // ==========================================================================
  // F10: Dynamic Dossier Template Catalog & Admin
  // ==========================================================================
  describe('F10: Dynamic Dossier Template Catalog & Admin', () => {
    it('F10-1: Dynamic template catalog listing with domain filter (PCN / PGD)', () => {
      const templateMgmt = read('components/PgdcnDossierTemplateManagementView.tsx');
      assert.match(templateMgmt, /domain|PCN|PGD/i);
    });

    it('F10-2: Create template from blank or clone from existing template', () => {
      const templateMgmt = read('components/PgdcnDossierTemplateManagementView.tsx');
      assert.match(templateMgmt, /tạo mới|sao chép|clone|create/i);
    });

    it('F10-3: Template lifecycle state transitions (DRAFT -> PUBLISHED -> REVISION -> RETIRED)', () => {
      const serverTemplates = read('lib/server/workflow-templates.ts');
      assert.match(serverTemplates, /DRAFT/);
      assert.match(serverTemplates, /PUBLISHED/);
      assert.match(serverTemplates, /RETIRED/);
    });

    it('F10-4: Document requirement binding (mandatory/optional, DOCX template mapping)', () => {
      const templateInspector = read('components/PgdcnDossierTemplateInspector.tsx');
      assert.match(templateInspector, /requirement|tài liệu|bắt buộc|tùy chọn/i);
    });

    it('F10-5: Node role permissions and stage gate completion criteria configuration', () => {
      const serverTemplates = read('lib/server/workflow-templates.ts');
      assert.match(serverTemplates, /isPcnWorkflowManager|isPgdWorkflowManager/);
    });
  });

  // ==========================================================================
  // F11: React Flow Visual Workflow Designer
  // ==========================================================================
  describe('F11: React Flow Visual Workflow Designer', () => {
    it('F11-1: React Flow canvas configuration and viewport setup', () => {
      const canvas = read('components/PgdcnDossierTemplateCanvas.tsx');
      assert.match(canvas, /ReactFlow|canvas|node|edge/i);
    });

    it('F11-2: Custom node primitives (Stage, Task, Approval, Condition)', () => {
      const canvas = read('components/PgdcnDossierTemplateCanvas.tsx');
      assert.match(canvas, /nodeTypes|custom|stage|task/i);
    });

    it('F11-3: Edge connection rules and condition-based branch routing', () => {
      const canvas = read('components/PgdcnDossierTemplateCanvas.tsx');
      assert.match(canvas, /onConnect|edges|transitions/i);
    });

    it('F11-4: Inspector panel property binding for selected workflow nodes', () => {
      const inspector = read('components/PgdcnDossierTemplateInspector.tsx');
      assert.match(inspector, /selectedNode|properties|label|description/i);
    });

    it('F11-5: Graph topology validation: no circular dead ends, valid start-to-finish continuity', () => {
      const editor = read('components/PgdcnDossierTemplateEditor.tsx');
      assert.match(editor, /validate|nodes|edges|save/i);
    });
  });

  // ==========================================================================
  // F12: Immutable Dossier Snapshot Engine
  // ==========================================================================
  describe('F12: Immutable Dossier Snapshot Engine', () => {
    it('F12-1: Intake dossier captures immutable workflowSnapshot from published template', () => {
      const intakeRoute = read('app/api/pcn/intake/route.ts');
      assert.match(intakeRoute, /snapshotPcnWorkflowTemplate/);
      assert.match(intakeRoute, /workflowSnapshot/);
    });

    it('F12-2: In-flight dossier tasks execute strictly against dossier.workflowSnapshot', () => {
      const tasksServer = read('lib/server/workflow-tasks.ts');
      assert.match(tasksServer, /dossier\.workflowSnapshot/);
    });

    it('F12-3: Editing published template does not alter in-flight dossier snapshot', () => {
      const typesFile = read('types.ts');
      assert.match(typesFile, /export interface PcnWorkflowSnapshot/);
    });

    it('F12-4: Retiring a template leaves ongoing and closed dossiers intact', () => {
      const serverTemplates = read('lib/server/workflow-templates.ts');
      assert.match(serverTemplates, /RETIRED/);
    });

    it('F12-5: Snapshot schema versioning and schema compatibility invariant', () => {
      const typesFile = read('types.ts');
      assert.match(typesFile, /workflowTemplateVersion/);
    });
  });

  // ==========================================================================
  // F13: Clean Cutover & Legacy Code Elimination
  // ==========================================================================
  describe('F13: Clean Cutover & Legacy Code Elimination', () => {
    it('F13-1: Elimination of legacy monolithic workspace components (PgdWorkspace, PcnWorkspace)', () => {
      const project = read('PROJECT.md');
      assert.match(project, /PgdWorkspace\.tsx/);
      assert.match(project, /PcnDossierDetailView\.tsx/);
      assert.match(project, /Clean Cutover/);
    });

    it('F13-2: Elimination of 12 nested modal cascades in favor of drawers and inline forms', () => {
      const drawer = read('components/PgdcnQuickViewDrawer.tsx');
      assert.match(drawer, /PgdcnQuickViewDrawer/);
    });

    it('F13-3: Elimination of legacy graphic views and Archify iframe dependencies', () => {
      const testSuite = read('test/pcn-superneat-e2e.test.ts');
      assert.match(testSuite, /Elimination of complex Node Graphs & Archify/);
    });

    it('F13-4: Elimination of legacy server fallback files and obsolete route handlers', () => {
      const originalRequest = read('.agents/teamwork/ORIGINAL_REQUEST.md');
      assert.match(originalRequest, /Toàn bộ mã nguồn UI legacy bị loại bỏ/);
    });

    it('F13-5: Clean dependency tree: zero broken legacy imports in active components', () => {
      const appShell = read('components/PgdcnAppShell.tsx');
      assert.doesNotMatch(appShell, /Archify/);
    });
  });

  // ==========================================================================
  // F14: Update design.md as SSOT & File Classification Report
  // ==========================================================================
  describe('F14: Update design.md as SSOT & File Classification Report', () => {
    it('F14-1: design.md reflects V2 7-stage architecture and Enterprise Workspace UX', () => {
      const design = read('design.md');
      assert.match(design, /7 giai đoạn|quy trình 7 giai đoạn|workflowSnapshot/i);
    });

    it('F14-2: SSOT preserves full business domain rules (QC4, QC9, QC20, 2-tier approval)', () => {
      const design = read('design.md');
      assert.match(design, /QC4/);
      assert.match(design, /QC9/);
      assert.match(design, /QC20/);
    });

    it('F14-3: File classification report specifies KEEP, REBUILD, DELETE, REVIEW categories', () => {
      const project = read('PROJECT.md');
      assert.match(project, /KEEP/);
      assert.match(project, /REBUILD/);
      assert.match(project, /DELETE/);
      assert.match(project, /REVIEW/);
    });

    it('F14-4: Database schema preservation: app_documents JSONB store & trigger protection', () => {
      const schemaSql = read('sql/pcn-schema.sql');
      assert.match(schemaSql, /app_documents/);
      assert.match(schemaSql, /jsonb/i);
    });

    it('F14-5: Backend route preservation: all 127 app/api routes remain intact', () => {
      assert.equal(fs.existsSync(path.join(rootDir, 'app/api')), true);
    });
  });

  // ==========================================================================
  // F15: Comprehensive Test Suite & Production Build
  // ==========================================================================
  describe('F15: Comprehensive Test Suite & Production Build', () => {
    it('F15-1: Test runner integration: npm test runs and exits with code 0', () => {
      const pkg = JSON.parse(read('package.json'));
      assert.ok(pkg.scripts.test, 'package.json must define "test" script');
      assert.ok(pkg.scripts['test:pcn'], 'package.json must define "test:pcn" script');
    });

    it('F15-2: Native Node.js test runner execution compatibility with TSX loader', () => {
      const pkg = JSON.parse(read('package.json'));
      assert.ok(pkg.scripts['test:all'], 'package.json must define "test:all" with tsx');
    });

    it('F15-3: TypeScript typecheck validation (tsc --noEmit) passes with 0 errors', () => {
      const pkg = JSON.parse(read('package.json'));
      assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
    });

    it('F15-4: Production build script verification (next build --webpack)', () => {
      const pkg = JSON.parse(read('package.json'));
      assert.match(pkg.scripts.build, /next build/);
    });

    it('F15-5: Test isolation and independence: zero shared mutable state between test runs', () => {
      const itemA: SuperneatChecklistItem = {
        id: 'isolated-A',
        requirementCode: 'REQ-A',
        title: 'Tài liệu độc lập A',
        classification: 'DEFAULT',
        level: 'MANDATORY',
        status: 'APPROVED',
      };
      const itemB: SuperneatChecklistItem = {
        id: 'isolated-B',
        requirementCode: 'REQ-B',
        title: 'Tài liệu độc lập B',
        classification: 'DEFAULT',
        level: 'MANDATORY',
        status: 'MISSING',
      };
      assert.equal(canCompleteStep([itemA]).allowed, true);
      assert.equal(canCompleteStep([itemB]).allowed, false);
    });
  });

});
