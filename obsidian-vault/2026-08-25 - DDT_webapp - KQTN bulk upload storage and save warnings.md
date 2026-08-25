<!--
Author: Gemini
OS support: Web/Node/Docker Desktop
Description: Summary of KQTN Bulk Upload segmentation, storage wiring and footer warning behavior
-->

# DDT_webapp — KQTN Bulk Upload Storage & Footer Warning Completion

> Date: 2026-08-25 (Asia/Ho_Chi_Minh)
> Workspace: `E:\CODING\DDT_webapp`

## Change summary

- Bulk Upload uses the shared TVCI PaddleOCR footer-first job for large scanned PDFs. The browser uploads the source once and polls the job; recognition uses visual candidates and first-page metadata OCR. Gemini is not required for bulk mapping; missing/failed local metadata keeps the row in manual review instead of triggering a Gemini request.
- The validated 116-page scan is split into six groups: `M02 1-20`, `M03 21-39`, `M04 40-59`, `M05 60-78`, `M06 79-96`, `M07 97-116`.
- Mapping uses a searchable combobox. A pending sample head can be selected with a warning and receives a minimal KQTN record before PDF upload. Existing PDF targets require overwrite confirmation. Page-range inputs preserve blank transient edits.
- Footer `current/total` mismatches are displayed as warnings and no longer block splitting or saving. Invalid, overlapping or out-of-source ranges still block.

## Storage fix

- Root cause: production Compose passed empty `SUPABASE_STORAGE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the canonical TVCI Supabase env exposes `SERVICE_ROLE_KEY`.
- Compose now defaults the internal URL to `http://supabase-storage:5000` and maps both service-role variable names. Secrets remain external to the repository.
- Runtime limits: 25 MiB for each single/result PDF, 100 MiB for a combined source PDF, and no hard-coded page-count limit.

## Verification and deployment

- Docker container: `ddt_webapp-webapp-1`, published on `2359:2359`.
- `/api/health`: HTTP 200.
- `/api/db/health`: HTTP 200 with PostgreSQL.
- Storage smoke upload/delete: HTTP 200/200; duplicate bucket response: HTTP 400 with `statusCode=409` and `error=Duplicate`, handled by the client.
- Full test suite: `311/311` pass.
- `npm run lint`: pass.
- `npm run build`: pass; existing non-blocking chunk-size warning remains.
- `git diff --check`: exit 0; only normal line-ending warnings were reported.

## Operational note

- Do not commit `.env`, service-role keys, or the remote attachment image. Production deployment must continue using the external Supabase env file.

## Runtime incident resolved

- Docker logs showed the PaddleOCR footer job completing `116/116`, followed by repeated Gemini `400 API key not valid` responses. The failure was the old automatic Gemini fallback, not Storage or PaddleOCR.
- The bulk modal now removes that fallback for both single PDFs and combined PDFs. It uses PaddleOCR plus filename matching and explicitly asks for manual combobox mapping when metadata is missing.
- The production image must be rebuilt after the new commit so the running container contains this fix.

<!-- --- End of 2026-08-25 - DDT_webapp - KQTN bulk upload storage and save warnings.md --- -->
