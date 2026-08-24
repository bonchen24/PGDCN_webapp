<!--
Author: Gemini
OS support: Web/Node
Description: Local and Docker Desktop setup instructions for the DDT Lab app
-->

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3442c325-6206-4e60-8538-7888971c79de

## Run locally

**Prerequisites:** Node.js, Docker Desktop, and the existing self-hosted Supabase stack with the `supabase_default` network.

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key if AI features are needed.
3. Start DDT against the Supabase PostgreSQL database:
   `docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.yml up --build -d`
4. Open `http://localhost:2359`.
5. Check services with `http://localhost:2359/api/health` and `http://localhost:2359/api/db/health`.

The DDT app no longer starts or stores data in a local `postgres_db` service. Stop the webapp with:
`docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.yml down`

## Run production with the existing Supabase PostgreSQL

The Supabase production mode connects DDT to the existing `supabase-db` container on the external `supabase_default` Docker network. It uses a separate database named `ddt_lab`; it does not use or remove Supabase's system database.

1. Create the `ddt_lab` database in the existing Supabase PostgreSQL instance if it does not already exist.
2. Build and start DDT with the Supabase environment file:
   `docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.supabase.yml up --build -d`
3. Open `http://localhost:2359`.
4. Check `http://localhost:2359/api/health` and `http://localhost:2359/api/db/health`.

The standalone `ddt_webapp-postgres_db` container and its Docker volumes were removed after the Supabase migration and health checks were verified. Production data now lives in Supabase PostgreSQL database `ddt_lab`.

## Current test and deployment target

The current test/deployment target is Docker Desktop on the local workstation. Do not deploy this project to the Synology NAS. Use `deploy.sh`, or run the equivalent Compose command directly:

`docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.supabase.yml up --build -d`

The deployment keeps the Supabase environment file on the local machine; it does not rsync `.env` or other secrets to a remote host. Verify `http://localhost:2359/api/health` and `http://localhost:2359/api/db/health` after the container starts.

## Image persistence boundary

Images used by OCR and the report form are session-only. They remain available for crop, OCR and DOCX generation during the current session, but saving a KQTN record strips the image fields and `emcData.images` before PostgreSQL persistence. New report images are not sent to Supabase Storage either.

The private `ddt-files` bucket is retained as an empty private bucket for compatibility. The one-time legacy objects and all `file_assets` rows were deleted after confirmation on 2026-08-18. New OCR/report images are not sent to this bucket.

KQTN result PDFs are different from session-only report images. They are stored as private objects in the `ddt-files` bucket and referenced by `resultPdf` metadata in `file_assets`. Configure these variables through the external Supabase env file before enabling the feature:

- `SUPABASE_STORAGE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `ddt-files`)
- `KQTN_PDF_MAX_BYTES` (default: 26214400)

The KQTN page can upload one PDF per sample head, view/download it, replace it after confirmation, or use Bulk Upload with manual mapping.
When Bulk Upload AI matching is used, each selected PDF is sent to the configured Gemini endpoint only to extract sample code, model, and brand. The AI output is a suggestion; the user must review or manually change the target before upload.

## Backup Supabase database and files

A complete backup for the legacy objects has three artifacts:

1. A `pg_dump -Fc` backup of the DDT database `ddt_lab`, including `file_assets` metadata.
2. A `pg_dump -Fc -d postgres -n storage` backup of Supabase Storage bucket/object metadata.
3. A copy or archive of the self-hosted Storage backend directory `E:\CODING\TVCI_APP\supabase-docker\volumes\storage`.

Keeping only the DDT PostgreSQL dump is not sufficient for restoring the historical pre-cleanup state; the pre-cleanup checkpoint in `backups/` includes `ddt_lab_pre_legacy_image_cleanup.dump` and `supabase_storage_pre_legacy_image_cleanup.dump`. The current runtime no longer requires file backup for OCR/report images because those images are session-only.

<!-- --- End of README.md --- -->
