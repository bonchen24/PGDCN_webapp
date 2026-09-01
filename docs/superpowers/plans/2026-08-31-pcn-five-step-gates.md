# PCN five-step workflow and mandatory document gates

## Objective

Reduce the visible PCN workflow to five understandable steps and enforce sequential completion. A user may move a dossier forward only after every required document in the current step is either present in its current version or explicitly waived with a reason.

## Tasks

- [x] Update `design.md` as the source of truth for the five visible steps and the mandatory gate rule.
- [x] Add a five-step workflow adapter while keeping detailed internal statuses for traceability and compatibility.
- [x] Add reasoned document waivers with actor and timestamp, without deleting documents or history.
- [x] Enforce the same gate in dossier update and issuance APIs, including jump prevention.
- [x] Show the five-step pipeline, completion state, unresolved documents and waiver controls in the dossier UI.
- [x] Add automated coverage for stage mapping, sequential transitions and waiver validation.
- [ ] Run final lint, test, build and diff checks after the last documentation/test adjustments.
