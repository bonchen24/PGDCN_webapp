<!--
Author: Gemini
OS support: Web/Node
Description: Daily record of the request-save synchronization fix and Docker Desktop production deployment
-->

# DDT_webapp — Request Save Sync Fix & Production Deployment

> Date: 2026-08-20 (Asia/Ho_Chi_Minh)
> Workspace: `E:\CODING\DDT_webapp`

## Change summary

- RequestModal now checks only the PostgreSQL `requests` collection before duplicate validation.
- The modal passes `skipSync=true` to `addRequests()` and performs one post-save full sync.
- Other `addRequests()` callers retain the default persistence behavior.
- API failure during the targeted pre-check falls back to local requests instead of treating the database as empty.
- `design.md` was updated before implementation to record this persistence boundary.

## Verification

- Focused regression tests: `15/15` pass.
- TypeScript check: `npm run lint` pass.
- Production frontend build: `npm run build` pass.
- Full test suite: `211/212` pass; the single failure is the unrelated existing Compose contract that rejects `SUPABASE_SERVICE_ROLE_KEY` in the Compose environment.

## Docker Desktop deployment

- Compose file: `docker-compose.supabase.yml`
- Image: `ddt_webapp-webapp:latest`
- Container: `ddt_webapp-webapp-1`
- Port: `2359:2359`
- PostgreSQL initialization: successful
- `/api/health`: HTTP 200
- `/api/db/health`: HTTP 200
- Current request count from PostgreSQL API: `587`

## Follow-up

- The production build reports a non-blocking bundle-size warning for the main JavaScript chunk (>500 kB).
- The existing Compose contract mismatch should be handled separately from the request-save performance fix.

<!-- --- End of 2026-08-20 - DDT_webapp - Request save sync fix and production deployment.md --- -->
