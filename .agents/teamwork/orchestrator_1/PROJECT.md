# Project: TVCI Web App UI/UX Audit & Remediation Plan

## Architecture & Scope
- **Target Application**: TVCI Web App (frontend code in `components/`, `app/`, `utils/`, `index.css`)
- **Reference Specification (SSOT)**: `design.md` (specifically Sections 2, 3, 4, 5, 7, 8)
- **Core Directive**: Strict read-only audit. ZERO source code edits (R4 constraint).

## Feature Inventory & Audit Coverage
| # | Area / Scope | Description | Milestone | Source | Status |
|---|--------------|-------------|-----------|--------|--------|
| 1 | R1: Design Tokens & Typography | Colors, badge tokens, typography, spacing, hardcoded values | M1 | design.md §2 | DONE |
| 2 | R3: Global Layout & Responsive | Sidebar, header, dashboard layout, responsive desktop/mobile/tablet | M1 | design.md §5 | DONE |
| 3 | R2: PCN & PGD Modules | Request/Sample/Schedule/Log Cards, Request/TestExecution/Handover Modals, interactions | M2 | design.md §3, §4 | DONE |
| 4 | R2: Sổ KQTN & Admin/Settings | KQTN Grid, ReportGeneratorView, Admin forms, Table views, dialogs | M3 | design.md §3, §4, §7 | DONE |
| 5 | R4: Synthesis & Remediation Plan | Unified Audit Report (52 findings) & Prioritized Remediation Plan | M4 | ORIGINAL_REQUEST.md | DONE |
| 6 | Verification & Forensic Audit | Independent Review (APPROVE) & Forensic Audit (CLEAN) | M5 | Integrity Policy | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Outputs |
|---|------|-------|-------------|--------|-------------|
| M1 | Audit Tokens & Layout | R1 (Tokens/Typography/Colors) + R3 (Dashboard, Sidebar, Header, Responsive) | none | DONE | 19 findings, explorer_tokens_layout/audit_findings.md |
| M2 | Audit PCN & PGD | R2 (Cards, Modals, Interactions in PCN & PGD) | none | DONE | 16 findings, explorer_pcn_pgd/audit_findings.md |
| M3 | Audit KQTN & Admin | R2 (KQTN Grid, Report Generator, Admin/Settings) | none | DONE | 16 findings, explorer_kqtn_admin/audit_findings.md |
| M4 | Synthesis & Remediation | Aggregate M1-M3 into UI_UX_AUDIT_REPORT.md and REMEDIATION_PLAN.md | M1, M2, M3 | DONE | UI_UX_AUDIT_REPORT.md (52 findings), REMEDIATION_PLAN.md (4 phases + guardrails) |
| M5 | Independent Review & Audit | Reviewer & Forensic Auditor verification of report quality & zero-code-change compliance | M4 | DONE | auditor_1: CLEAN, reviewer_2: APPROVE, GATE_STATUS.md: PASS |

## Standards and Guidelines
- Reference `design.md` sections:
  - Mục 2: Bảng màu, Typography, Spacing, Badge Tokens.
  - Mục 3: Card Components (Request, Sample, Schedule, Log).
  - Mục 4: Modal Components (RequestModal, TestExecutionModal, HandoverModal, ReportGeneratorView, KQTN Grid).
  - Mục 5: Layout và điều hướng (Sidebar, Header, Dashboard, Responsive).
  - Mục 7 & Phụ lục 5A: Admin, Backup, Ergonomics.
