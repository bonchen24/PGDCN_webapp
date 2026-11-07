# PGDCN Bidirectional Requirement and File Mapping Plan

> **For agentic workers:** AGY executes this plan under Codex orchestration. Codex reviews the diff and runs the verification matrix.

**Goal:** Persist and render a verified two-way relationship between each PCN/PGD dossier-template requirement and every private-storage file/version attached to it.

**Architecture:** Extend the existing domain-specific PCN/PGD file records and upload boundaries with immutable template/version and exact requirement identity. Resolve B1 choices from the selected PUBLISHED template snapshot (node/stage references plus requirement definitions or the domain catalog labels); use the domain baseline only when no template was selected. Keep unmatched files as searchable `PENDING_MAPPING` records until an authorized user maps them explicitly.

**Tech Stack:** Next.js 16.4.3 Route Handlers, TypeScript, React, PostgreSQL JSONB `app_documents`, existing private-storage clients, Node test runner/tsx, Playwright.

**Spec:** `design.md` sections `0.2.3 B1`, `0A.5 PGD B1`, and `0.10 Dossier Templates`; acceptance details are in the user task.

## Global Constraints

- The canonical B1 list comes from the selected PUBLISHED domain template and its matching immutable snapshot; use baseline requirements only when no template is selected.
- PCN `QC4`/`QC9` and PGD remain separate in IDs, templates, APIs, storage, reads, and RBAC.
- Never map by original filename. Keep the requirement code and original filename unchanged; display the canonical requirement name from its definition.
- Store the private file asset pointer, dossier/request ID, domain, template ID/version, requirement ID/code, B1–B7 stage when applicable, document kind, original filename, display name, version/cardinality, status, uploader/time, checksum, and audit provenance.
- `SINGLE` keeps one current file and every superseded version; `MULTIPLE` keeps every file/version/round without silent replacement.
- A user may save `Tài liệu bổ sung khác` as `PENDING_MAPPING`; mapping later requires an explicit authorized choice and never guesses when a template arrives.
- Zero files remain valid. Create the request first; a file failure does not roll back it. Retries are idempotent and do not duplicate a file/version.
- Private bytes are served only through existing authenticated domain boundaries. Uploading or mapping B1 never adds a new workflow gate.
- Keep legacy dossiers unchanged unless a user explicitly maps a file through the authorized mapping action.

---

### Task 1: Resolve the exact B1 requirement roster

**Files:**
- Modify: `utils/pcnDossierDocuments.ts`
- Modify: `utils/pgdDossier.ts`
- Create or modify: `utils/pgdcnB1Attachments.ts`
- Test: `test/pcn-pgd-b1-intake-attachments.test.ts`

**Interfaces:**
- Add a resolver that returns domain, template ID/version, stage ID, requirement ID/code/name, multiplicity, and source provenance for each selectable B1 row.
- For a selected PCN template, consume the exact QC4/QC9 requirement IDs referenced by its intake nodes; resolve labels from that template's requirement definition snapshot, or the matching PCN catalog row for legacy published templates without definitions.
- For a selected PGD template, consume only the request/intake node codes; resolve labels from the PGD catalog for legacy templates without definitions. Custom definitions use `definition.name` and stable `definition.id`.
- When no template is selected, return the domain baseline with explicit baseline provenance.

- [ ] Add a unit test that resolves live DB fixture equivalents for PCN QC4 and QC9 independently and asserts the exact selectable IDs/names.
- [ ] Add a PGD test asserting `REQUEST_PYC` and `REQUEST_SUPPORTING` are sourced from the selected PGD request node, not the PCN or PGD commercial node.
- [ ] Add a custom requirement test where template v1 and v2 share an ID but change `name`; each dossier snapshot resolves its own version's name.
- [ ] Verify the resolver tests fail against the current category-only upload model, then implement the resolver and rerun them.

Example contract test:

```ts
test('PCN QC4 intake rows follow the selected template requirement IDs', () => {
  const rows = resolveB1AttachmentRequirements({ domain: 'PCN', fieldCode: 'QC4', template: qc4PublishedV2 });
  assert.deepEqual(rows.map(({ requirementId, displayName }) => [requirementId, displayName]), [
    ['QC4-PROPOSAL', 'Đề nghị / đơn đăng ký'],
    ['QC4-COMMERCIAL', 'Báo giá / hợp đồng'],
  ]);
});
```

### Task 2: Persist mapped file assets, cardinality, and mapping decisions

**Files:**
- Modify: `types.ts`
- Modify: `app/api/pcn/dossiers/[dossierId]/supplementary-attachments/route.ts`
- Modify: `app/api/pgd/requests/[requestId]/dossier-documents/route.ts`
- Modify or create: domain-specific attachment mapping API route(s)
- Test: `test/pcn-pgd-b1-upload-route.test.ts`

**Interfaces:**
- Each uploaded record carries canonical `fileAssetId`, `dossierId`, `domain`, `templateId`, `templateVersion`, `requirementId`, `requirementCode`, `stageId`, `documentKind`, `originalFileName`, `displayName`, `version`, `status`, uploader/time, checksum, storage locator, and audit fields; preserve existing fields for compatibility.
- Validate domain, dossier ownership, selected snapshot/version, requirement ID/code and stage server-side before writing bytes or metadata.
- A request with `PENDING_MAPPING` stores the byte and checksum but no guessed requirement. A later mapping mutation writes the chosen ID plus actor/time and leaves the asset/version history intact.
- `SINGLE` appends an immutable superseding version and updates one current pointer. `MULTIPLE` stores independent current files, grouped by assessment round where one exists.
- Upload retry with the same idempotency key and asset metadata returns the existing record; changed requirement or bytes must not alias the prior record.

- [ ] Add tests for two files on one requirement under `SINGLE` and `MULTIPLE`, including current/history projections.
- [ ] Add tests for PGD assessment-round separation and request/document version increment.
- [ ] Add tests that reject cross-domain requirement/template IDs before storage upload.
- [ ] Add tests that deny unauthorized file metadata reads and private file downloads across PCN/PGD scopes.
- [ ] Add tests for zero-file entity creation, two-file upload, failed upload followed by retry, reload persistence, and pending mapping followed by an authorized explicit map.
- [ ] Verify the tests fail before route changes, then implement with existing private storage and transaction patterns.

### Task 3: Render both directions in intake and dossier detail

**Files:**
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx` and the PGD dossier checklist/document view identified by Graphify
- Modify: domain file API/store projections as needed
- Test: focused PCN/PGD intake and detail UI tests; Playwright coverage for the Dashboard create path

**Interfaces:**
- Extend the existing canonical `PcnProposalView` and `PgdIntakeForm` attachment rows with a required requirement dropdown. It displays the selected template's B1 rows and `Tài liệu bổ sung khác`; it displays original filename separately from the requirement name.
- A checklist requirement row expands to every mapped file, current version, prior version, and assessment round, each using the authenticated download endpoint. Unmapped/pending files remain visible in a separate list with an authorized map action.
- Display `SINGLE` current/history and `MULTIPLE` independent files explicitly without replacing existing checklist labels or lifecycle states.
- Use the same resolved requirement `displayName` in the create modal, B1 checklist, dossier detail, document list, supplementary upload, download label, and review projection.
- Retry only failed files with the existing per-file idempotency key; successful files remain successful after reload.

- [ ] Add a UI contract test asserting dropdown labels come from the selected template, the original filename remains visible, and `Tài liệu bổ sung khác` is available.
- [ ] Add detail tests asserting a requirement row lists all file IDs/versions and pending files remain discoverable.
- [ ] Add projection tests asserting create, checklist, document list, download, and review surfaces use the same requirement ID/name pair.
- [ ] Exercise zero files, two files, reload, mapping later, and desktop/mobile Dashboard paths.

### Task 4: Update the durable design contract and verify

**Files:**
- Modify: `design.md` sections `0.2.3`, `0A.5`, and `0.10` only.

- [ ] Document the exact canonical link fields, selected-template source rule, pending mapping, domain separation, private downloads, idempotent retry, `SINGLE` history, and `MULTIPLE`/round behavior.
- [ ] Remove the conflicting rule that newly published templates may only use `SINGLE`; keep old snapshots readable and immutable.
- [ ] Run targeted route/UI tests, `npm run typecheck`, `npm run build`, then Playwright against the deployed Dashboard.
- [ ] Update Graphify after substantial code edits and keep `graphify-out/` out of the commit.
- [ ] Review and commit only this plan, `design.md`, implementation files, and tests; integrate safely into the shared PCN/PGD branch and local `master` without staging unrelated dirty files.
- [ ] Deploy with the existing production compose file only after tests pass. Do not migrate or write to production database, change credentials, or recreate database/storage volumes.
