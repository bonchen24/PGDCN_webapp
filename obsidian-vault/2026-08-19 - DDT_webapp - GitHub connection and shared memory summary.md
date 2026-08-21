<!--
Author: Gemini
OS support: Web/Node
Description: Shared working-memory summary for DDT_webapp GitHub connection and snapshot synchronization
-->

# DDT_webapp — GitHub Connection & Shared Working Memory

> Vault: `G:/My Drive/HungXVaul`
> Project folder: `TVCI_APP/`
> Date: 2026-08-19 (Asia/Ho_Chi_Minh)

## Objective

Connect the local DDT Lab workspace to `bonchen24/DDT-app-v3.0`, synchronize the current local snapshot, validate it, and record the working context in the shared Obsidian vault.

## What happened

1. The connected GitHub account was confirmed as `bonchen24`.
2. The target repository was selected as [`bonchen24/DDT-app-v3.0`](https://github.com/bonchen24/DDT-app-v3.0), default branch `main`.
3. The local folder `E:\CODING\DDT_webapp` was compared with the remote `main` snapshot.
4. Because the local folder was not a Git checkout, the snapshot was committed through the connected GitHub workflow rather than a local `git push`.
5. A review branch was created: `agent/sync-local-snapshot`.
6. The resulting commit is [`970c8d6`](https://github.com/bonchen24/DDT-app-v3.0/commit/970c8d6aa2429d324c71539f89d40b77e414af18), parent `4e537ab74ec02f22d130eadf253a4dbc450f552f`.
7. `npm run lint` was run successfully; `tsc --noEmit` returned exit code 0.

## Current GitHub state

- `main` was not changed.
- The synchronized snapshot is on `agent/sync-local-snapshot`.
- No pull request was opened.
- The local workspace still has no `.git`, `origin`, or local branch tracking. Future local commits require cloning the repository or initializing/configuring Git locally.

## Snapshot boundary and safety decisions

- The selected scope was the full local snapshot, so remote-only content such as `LapBaoCao/**` was removed from the review branch.
- `node_modules` and `dist` were not included.
- Credential-bearing or sensitive operational material was excluded: `.env` changes, `service-account.json`, `tvci_backup_*.json`, `scratch/**`, SSH/deploy tooling, `PROJECT_MEMORY.md`, and files rejected by GitHub's sensitive-egress guard.
- Existing remote environment files were preserved where they were already tracked; the local `.env.example` update was not applied.

## Project rules to preserve

- `AGENTS.md` and `design.md` are the governing project instructions.
- `design.md` is the single source of truth for architecture, schema, UI/UX, and coding conventions.
- For future business-flow, schema, or UI changes: confirm scope, update `design.md` first, then implement.
- Keep the required source-file headers and footers.
- Before another commit: inspect scope, exclude secrets/generated files, run relevant checks, and verify the remote commit.

## Next actions

1. Review the snapshot branch and decide whether to open a pull request.
2. Decide whether to keep the remote-only `LapBaoCao/**` deletion or restore it before merging.
3. If ongoing local Git work is needed, clone `bonchen24/DDT-app-v3.0` into a Git checkout and point the working process at that directory.
4. Keep this memo and `TVCI_APP/00-current-context.md` aligned after future DDT changes.

## Follow-up: DOCX dynamic label composite fix

- The report form now treats all dynamic label photos as one ordered horizontal composite mapped only to `anh_1`.
- The composite is generated as PNG with aspect-ratio preservation; supporting sample/setup images are mapped after the composite.
- Source of truth updated in `design.md`; implementation is in `lib/reportDocxImageMapping.ts` and `server.ts`.
- Regression tests cover numeric ordering, composite PNG dimensions, DOCX embedding, and no post-mapping `anh_*` overwrite.
- Verification: focused tests `8/8`, TypeScript, and production build passed. Full suite has one unrelated pre-existing Compose contract failure.

## Related notes

- [[TVCI_APP/00-current-context]]
- [[99-Agent/Hermes-Memory-Index]]
- [[99-Agent/Hermes-Memory]]

<!-- --- End of 2026-08-19 - DDT_webapp - GitHub connection and shared memory summary.md --- -->
