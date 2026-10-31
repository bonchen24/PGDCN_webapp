# Wave D — canonical dossier workspace tabs

Branch: `task/c2c/dossier-tabs`, based on `765df811`.

## Scope

- Added a shared PCN/PGD workspace with **Thông tin / Tài liệu / Công việc / Lịch sử**, owner/next-action context, linked ARIA tabs/panels, roving keyboard focus and 44px tab targets. Panels stay mounted while hidden so switching tabs preserves local form input.
- PCN canonical detail keeps its dossier code/status header, owner assignment, proposal detail action and milestone controls; documents reuse the existing package/checklist/upload/drafting surface; work reuses native workflow and existing lab/results/issuance callbacks; history uses scoped activity logs with actor, timestamp and field changes. Existing PCN detail query destinations map to the appropriate shared tab.
- PGD canonical request detail reuses its code/status header, evidence/source-form panels, workflow rail, work panels and current mutation gates. Information reads the canonical request. History reuses `buildPgdBusinessTimeline` with scoped case events, field activity, samples, PTN/results, approvals and issuance projections. The existing edit modal now renders outside the previously hidden legacy block so its header action can open it.
- Main header codes, owner names, information fields and history text wrap. Domain business summaries remain available as secondary work content; their duplicate timeline is suppressed when mounted inside canonical details.
- No shell, dossier library/list, database, route handler, lifecycle rule or upload/review API changes. `PgdWorkspace.tsx` changes are confined to imports and `PgdRequestDetail`; its wizard-facing props and mount are untouched. `design.md` §0.10.1 was consulted; the coordinator owns contract reconciliation.

## RED / GREEN

Initial RED command:

```text
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-dossier-workspace-tabs.test.ts
```

Observed before implementation: exit 1, **5 tests, 0 pass, 5 fail**. Assertions identified missing PCN/PGD workspace mounting, missing shared tab model/component and missing separate PGD history component. A subsequent focused RED check identified business actions failing to reveal their collapsed PCN destination; the controlled work disclosure fixes that case.

Final focused command:

```text
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-dossier-workspace-tabs.test.ts test/pcn-dossier-detail.test.ts test/pcn-dossier-detail-ux.test.ts test/pcn-dossier-route.test.ts test/pcn-native-dossier-flow-ui.test.ts test/pgd-native-dossier-flow-ui.test.ts test/dossier-mobile-focus-ui.test.ts test/pgdcn-pgd-aligned-dossier-ui.test.ts test/pgd-dossier-operations-ui.test.ts
```

Observed after the final source edit, exit 0:

```text
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`npm run typecheck` printed `tsc --noEmit` and exited 0. `git diff --check` exited 0. The new `pcn-dossier-workspace-tabs.test.ts` matches the active `test:pcn` discovery pattern. Full suite is reserved for integration.

## Browser component smoke

Used Playwright CLI against `http://127.0.0.1:34629`, serving the actual `PgdcnDossierWorkspace` component bundled with React and its Tailwind classes. This was a standalone synthetic component fixture, not an authenticated application page.

- Home/End and ArrowLeft/ArrowRight activated the expected tab and moved focus; arrows wrapped at either end.
- Tab moved from the selected tab into its associated panel. Only the selected panel was accessible.
- Input text remained after switching to history and returning to information.
- The next-action navigation button opened work without invoking a domain mutation.
- At 320/390/1440px widths, document scroll width exactly matched viewport width; all four tabs measured 44px high and retained normal text wrapping. At 320px they used two columns, each 135px wide; at 390px each was 170px; desktop used four columns at 258.5px each.

The fixture console contained one expected favicon 404 and no JavaScript/runtime warnings. The temporary browser/server were stopped after the check.

## Limits

Authenticated full dossier screens and mutation flows were not exercised by this component smoke. Domain action authorization and lifecycle behavior remain the existing API/panel contracts. New tab selection is local UI state; canonical record URLs and legacy PCN detail destinations remain unchanged. No production deployment or migration was performed.
