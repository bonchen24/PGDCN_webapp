<!--
Author: Gemini
OS support: Web/Node
Description: Daily record of RequestModal draft persistence and reset behavior
-->

# DDT_webapp — RequestModal Draft Persistence

> Date: 2026-08-20 (Asia/Ho_Chi_Minh)
> Workspace: `E:\CODING\DDT_webapp`

## Change summary

- Added the draft persistence rule to `design.md` before implementation.
- Added `utils/requestDraft.ts` using IndexedDB with normalized account-scoped keys and payload validation.
- New-request `RequestModal` stores only general form data, sample list, current sample, and invoice checkbox state. Scan files, OCR data, and transient UI state are excluded.
- Reopening the modal presents `Khôi phục bản nháp` and `Xóa bản nháp` when a draft exists.
- `Xóa bản nháp` deletes the local draft, resets the current modal to the same fresh state as opening it, and does not call `onClose`.
- Successful request creation removes the corresponding draft. Existing-request editing does not participate in draft persistence.

## Verification

- Draft and request-save contract tests: `6/6` pass.
- `npm run lint`: pass.
- `npm run build`: pass; existing non-blocking bundle-size warning remains.
- Full test suite: `214/215` pass. The remaining failure is the pre-existing Compose contract mismatch around `SUPABASE_SERVICE_ROLE_KEY`.

## Production deployment

- Rebuilt `ddt_webapp-webapp:latest` and recreated `ddt_webapp-webapp-1` with `docker-compose.supabase.yml`.
- Container is `Up` and publishes `2359:2359`.
- `/api/health`: HTTP 200.
- `/api/db/health`: HTTP 200.

<!-- --- End of 2026-08-20 - DDT_webapp - Request modal draft persistence.md --- -->
