# Wahron AI - Project Handoff

This file is the durable project context for future development requests. Read it
before starting work so prior decisions, completed work, validation, and the next
planned milestone remain connected across chat sessions.

> **Do not put credentials, secret keys, database URLs, or `.env` contents in
> this file.** Record configuration variable names and safe setup instructions
> only.

## Project overview

Wahron AI is a React frontend with a FastAPI backend. Its current foundation
includes cookie-based authentication, organization/workspace onboarding, and
workspace-scoped business profiles. The Content Studio MVP supports reusable
Instagram caption ideas and a saved draft library.

```text
AI Project/
├── backend/       FastAPI, SQLAlchemy, PostgreSQL, authentication and tenancy API
└── wahron-ai/     React, TypeScript, Vite, Redux Toolkit, Material UI
```

The original product direction is an AI marketing platform. Planned onboarding
will eventually collect business details, brand voice, and marketing objectives.

## Current implementation

### Frontend (`wahron-ai/`)

- React, TypeScript, Vite, React Router, Redux Toolkit, and React Redux.
- Material UI and Emotion, Tailwind CSS, Lucide icons, and Motion.
- Login and registration screens call the FastAPI authentication endpoints.
- RTK Query includes cookies (`credentials: 'include'`) and defaults to
  `http://localhost:8000/api/v1`; `VITE_API_BASE_URL` can override it.
- Authenticated users are checked for workspace membership before entering
  `/app`. Users without a workspace are sent to `/onboarding`.
- Onboarding creates an organization and its first workspace, then prompts for
  the workspace's first business profile.
- Business profile API client supports workspace-scoped listing, creation, and
  updates.
- Content Studio offers business-specific Instagram caption ideas with tone,
  audience, and call-to-action inputs; users can choose, save, edit, copy, and
  archive drafts.
- Video Studio accepts multiple content photos, face/reference photos, and video
  clips; users can preview, select, reorder, and save them with a prompt,
  aspect ratio, and target duration as a workspace/business-scoped draft.
- Video source files are stored under `backend/media` by default (override with
  `MEDIA_STORAGE_DIR`); API downloads require workspace membership. JPEG, PNG,
  and WebP photos are capped at 15 MB each; MP4, WebM, and MOV clips at 100 MB.
- Video Studio can queue a Gemini video job for a saved brief, show stage
  progress and its Gemini-generated storyboard, then preview/download a private
  FFmpeg-assembled MP4. Jobs support 15 or 30 seconds; 30-second videos use two
  generated scenes. Each job sends up to six image references (photos and
  locally sampled video frames, up to 20 MB combined) to Gemini; full uploaded
  video clips stay local and are inserted during FFmpeg assembly. Generated
  and final clips are stored under `backend/media`.
- Face/reference photos require an explicit permission confirmation before
  generation. Gemini calls use `store: false`; API credentials stay on the
  backend. Audio is omitted from the assembled MVP output.
- Generation uses FastAPI in-process background tasks for local development.
  Jobs are persisted, but a server restart can interrupt a running task; deploy
  a durable worker/queue and object storage before production use.
- Caption suggestions still use built-in deterministic writing patterns; no
  external text-generation model, social publishing, or scheduling is connected.

Useful frontend files:

- `wahron-ai/src/main.tsx` - React, Redux, theme, and router providers.
- `wahron-ai/src/routes/AppRoutes.tsx` - public, protected, onboarding, and app routes.
- `wahron-ai/src/routes/WorkspaceGate.tsx` - loads memberships and enforces onboarding.
- `wahron-ai/src/pages/onboarding/WorkspaceOnboarding.tsx` - first-workspace form.
- `wahron-ai/src/pages/onboarding/BusinessOnboarding.tsx` - first business profile form.
- `wahron-ai/src/features/workspace/workspaceApi.ts` - workspace RTK Query endpoints.
- `wahron-ai/src/features/business/businessApi.ts` - business profile RTK Query endpoints.
- `wahron-ai/src/pages/content/ContentStudio.tsx` - caption creation and saved drafts UI.
- `wahron-ai/src/pages/content/VideoStudio.tsx` - media uploads, ordered video briefs, and saved brief UI.
- `wahron-ai/src/features/content/contentApi.ts` - Content Studio RTK Query endpoints.
- `wahron-ai/src/features/content/contentTypes.ts` - Content Studio API types.
- `wahron-ai/src/routes/BusinessGate.tsx` - loads a workspace's businesses and enforces onboarding.
- `wahron-ai/src/services/baseApi.ts` - API base URL and cookie configuration.

### Backend (`backend/`)

- FastAPI endpoints are mounted under `/api/v1`.
- SQLAlchemy 2.x models use PostgreSQL through psycopg 3.
- Auth uses signed JWTs in HTTP-only cookies, Argon2 password hashing, and
  Pydantic request/response schemas.
- In development, startup calls `Base.metadata.create_all`; production schema
  changes should use migrations.
- Workspace endpoints require an authenticated user:
  - `POST /api/v1/organizations` creates an organization, a default workspace,
    and an `owner` membership in one transaction.
  - `GET /api/v1/workspaces` returns only workspaces belonging to the current user.
- Business profile endpoints enforce workspace membership. Only workspace
  owners and admins can create or update a business:
  - `GET /api/v1/workspaces/{workspace_id}/businesses`
  - `POST /api/v1/workspaces/{workspace_id}/businesses`
  - `PATCH /api/v1/businesses/{business_id}`
- A business stores its name, industry, optional description, and optional website.
- Content Studio persists Instagram caption drafts per workspace and business.
  Workspace members can generate ideas, save drafts, edit captions, and archive:
  - `POST /api/v1/workspaces/{workspace_id}/content/generate`
  - `GET /api/v1/workspaces/{workspace_id}/content/drafts`
  - `POST /api/v1/workspaces/{workspace_id}/content/drafts`
  - `PATCH /api/v1/content/drafts/{draft_id}`
- Video Studio provides member-authorized media upload/list/file/delete and
  prompt brief persistence plus asynchronous-by-request generation status:
  - `POST /api/v1/workspaces/{workspace_id}/media` (multipart upload)
  - `GET /api/v1/workspaces/{workspace_id}/media?business_id=...`
  - `GET` / `DELETE /api/v1/workspaces/{workspace_id}/media/{media_id}[/file]`
  - `POST /api/v1/workspaces/{workspace_id}/video-projects`
  - `GET /api/v1/workspaces/{workspace_id}/video-projects?business_id=...`
  - `POST /api/v1/workspaces/{workspace_id}/video-projects/{project_id}/generate`
  - `GET /api/v1/workspaces/{workspace_id}/video-jobs?business_id=...`
  - `GET /api/v1/workspaces/{workspace_id}/video-jobs/{job_id}/file`
  - Video briefs store prompt, selected media IDs in order, aspect ratio,
    duration, and `draft` status. Generation jobs persist status/stage/progress,
    storyboard, generated clip keys, errors, and final output key. Assets cannot
    be deleted while referenced by a saved brief.
- Generation flow: validate access/media/consent/configuration; persist a job;
  enqueue a FastAPI background task; Gemini analyzes selected photos and video
  keyframes sampled locally with FFmpeg and returns schema-validated storyboard
  JSON; Gemini Omni Flash generates one or two scenes (up to 15 seconds per
  scene); FFmpeg normalizes and assembles those scenes with selected content
  photos/clips; the worker saves the MP4 and marks the job complete. Full video
  clips are not sent to Gemini in this MVP.
- Configure backend-only environment variables: `GEMINI_API_KEY`,
  `GEMINI_STORYBOARD_MODEL` (default `gemini-4-hydrogen`),
  `GEMINI_VIDEO_MODEL` (default `gemini-omni-1.2-flash`), and
  `FFMPEG_BINARY` (default `ffmpeg`). Install FFmpeg and make it available on
  the backend process `PATH`; API checks configuration before queueing.
- Gemini is called through its REST Interactions API, so no Gemini Python SDK
  package is required by this implementation.
- New database tables are registered for development `create_all`; no Alembic
  migration exists yet, so existing production databases need a migration
  before these endpoints are deployed.
- Generation is currently a deterministic local template helper. Do not describe
  it as an LLM/AI integration until a provider is selected and implemented.

Useful backend files:

- `backend/app/main.py` - application, middleware, routers, development schema creation.
- `backend/app/api/auth.py` - register, login, logout, current-user authentication.
- `backend/app/api/workspaces.py` - organization creation and membership-scoped listing.
- `backend/app/api/businesses.py` - membership-scoped business profile CRUD.
- `backend/app/api/content.py` - caption suggestions and tenant-scoped draft operations.
- `backend/app/api/video_projects.py` - briefs, generation queue/status, and private output route.
- `backend/app/services/video_generation.py` - Gemini storyboard/scenes and FFmpeg worker.
- `backend/app/models/video_generation_job.py` - persisted generation jobs.
- `backend/app/models/organization.py`
- `backend/app/models/workspace.py`
- `backend/app/models/workspace_membership.py`
- `backend/app/models/business.py`
- `backend/app/models/content_draft.py`
- `backend/app/schemas/workspaces.py`
- `backend/app/schemas/businesses.py`
- `backend/app/schemas/content.py`
- `backend/app/database/session.py` - selects `postgresql+psycopg` for default PostgreSQL URLs.
- `backend/requirements.txt` - backend dependencies.

## Setup and run

### Backend

From PowerShell:

```powershell
cd "C:\Users\awahi\Desktop\AI Project\backend"
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Using `python -m uvicorn` after activating the project venv avoids accidentally
running a global Uvicorn installation. The venv is currently Python 3.9, so
backend annotations need to remain Python 3.9-compatible unless the supported
Python version is deliberately raised.

The backend reads `DATABASE_URL`, `SECRET_KEY`, and other settings from
`backend/.env`. Configure a reachable local PostgreSQL database before running
against the real database. Never copy actual `.env` values into chat or docs.
To enable Video Studio rendering, also set `GEMINI_API_KEY` in the backend
environment and install FFmpeg so `ffmpeg` is available on that process's
`PATH`. The Gemini key is never needed by the browser.

### Frontend

In another PowerShell terminal:

```powershell
cd "C:\Users\awahi\Desktop\AI Project\wahron-ai"
npm install
npm run dev
```

The Vite development server normally runs at `http://localhost:5173`. Keep the
frontend and backend hostnames consistent (`localhost` rather than mixing
`localhost` and `127.0.0.1`) when using cookie authentication.

### Sign-in connection errors

`ERR_CONNECTION_REFUSED` for `/api/v1/auth/login` means the browser could not
connect to the API host/port, so the login route has not received the request.
Confirm the backend process is running at port `8000`; if Uvicorn exits during
startup, use its terminal traceback to diagnose the dependency, environment, or
database startup issue. If `VITE_API_BASE_URL` is set, it must point to the
backend API root, normally `http://localhost:8000/api/v1`. The login page now
shows a specific API connection message for fetch failures.

## Decisions and fixes already made

1. **MUI Typography errors:** MUI v9 styling props such as `fontWeight` and
   `textAlign` are passed through `sx`, not as direct component props.
2. **Blank page / invalid hook call:** React was resolved from different
   `node_modules` directories by the app and MUI. UI dependencies were added to
   the frontend package so the app and MUI share its React installation.
3. **Frontend structure and type errors:** Added the missing auth layout,
   restored the app shell in `AppLayout.tsx`, updated MUI props, and changed
   Redux `PayloadAction` imports to type-only imports.
4. **SQLAlchemy import error:** The initial command resolved global Python 3.9
   with SQLAlchemy 1.4, but the code uses SQLAlchemy 2.x. Backend requirements
   now declare SQLAlchemy 2.x and include the runtime packages used by the app.
5. **Python 3.9 compatibility:** Replaced the Python 3.10-only `str | None`
   annotation in `backend/app/api/auth.py` with `Optional[str]`.
6. **PostgreSQL driver mismatch:** SQLAlchemy's bare `postgresql` URL selected
   psycopg2 while the installed dependency is psycopg v3. The engine now maps
   bare PostgreSQL URLs to `postgresql+psycopg`.
7. **Workspace onboarding:** Added organization, workspace, and role-based
   membership models; authenticated API endpoints; and frontend onboarding
   routing and form.
8. **Business profiles:** Added workspace-scoped business records and
   create/list/update API operations. Business writes require workspace owner
   or admin membership; reads and writes are isolated to the member's workspace.
   The frontend now collects the first business profile before showing the app.
9. **Content Studio MVP:** Added Instagram caption idea generation based on
   business, topic, audience, tone, and CTA; saved draft CRUD/listing; editing,
   copying, and archiving; and workspace membership checks. This MVP uses
   deterministic local templates and does not call an AI model or publish posts.

The project workspace is not a Git repository at its root, so don't assume
there is Git history available for earlier changes.

## Validation already performed

- Frontend `npm run build`: passed after the workspace onboarding changes.
- Frontend `npm run lint`: passed.
- Backend Python 3.9 source compilation and Uvicorn app import: passed.
- Isolated API smoke test using a temporary SQLite database: registration,
  empty workspace list, organization/workspace creation, owner membership, and
  membership-scoped workspace listing all passed.
- Business API smoke test using a temporary SQLite database: registration,
  workspace creation, business create/list/update, and rejection of a different
  user's workspace access passed.
- Content Studio shell/build/lint and live API integration tests were attempted
  but blocked by the current Windows sandbox, which rejected command execution
  before the commands ran. VS Code Problems checks found no errors in the new
  Python or TypeScript files. Runtime behavior remains unverified for this slice.
- Video Studio foundation: VS Code Problems reported no errors in the touched
  Python and TypeScript files. Frontend build and lint were attempted, but the
  Windows sandbox rejected both commands before execution; backend runtime,
  upload behavior, and API isolation remain unverified.
- Video generation implementation: diagnostics/build/API smoke tests have not
  yet been run in this turn. VS Code Problems reports no errors in the changed
  Python/TypeScript files. Python parsing, frontend build, and lint were
  attempted but the Windows sandbox rejected command execution before they
  ran. No Gemini request was made and no API key was accessed. Provider output
  compatibility, FFmpeg assembly, and database startup against the user's
  environment remain unverified.
- PostgreSQL connection against the configured database has **not** been
  verified. The smoke test does not prove that the local PostgreSQL service,
  database, or credentials are working.
- Vite reports a bundle-size warning (>500 kB minified); this was not addressed.

## Recent response checkpoints

- **2026-11-19 - Video generation flow:** Added persisted generation jobs,
  Gemini media analysis/storyboard and Omni scene-generation calls, FFmpeg
  source/generated clip assembly, authenticated MP4 preview/download, UI
  progress polling, and face-reference permission confirmation. Requires
  `GEMINI_API_KEY` and FFmpeg on the backend. Runtime provider/FFmpeg rendering
  has not been tested; FastAPI's in-process background tasks are development
  only and not restart-safe.
- **Video Studio foundation:** Added private workspace/business-scoped image
  and clip uploads, a media library with previews and ordering, and persisted
  video briefs.

- **2026-11-18 - Content Studio MVP implementation:** Added workspace/business
  scoped Instagram caption suggestion and draft API, plus UI to generate,
  select, save, edit, copy, and archive drafts. Suggestions are local writing
  templates, not an external AI model. Shell build/lint/API tests were blocked
  by sandbox restrictions; VS Code Problems checks reported no errors.
- **2026-11-17 - Business profile milestone:** Added workspace-scoped business
  create/list/update API and persisted business name, industry, description, and
  website. Added first-business onboarding and a gate that routes users without
  a profile to setup. Frontend build/lint and a temporary-SQLite API test passed,
  including another user's access being denied. Live PostgreSQL integration
  remains unverified.
- **2026-11-17 - Project handoff:** Created this root README so future requests
  can recover project structure, decisions, validation, and next steps.
- **2026-11-13 - Organization/workspace milestone:** Added tenant organization,
  workspace, owner membership, API endpoints, and first-workspace onboarding.
  Build, lint, and isolated SQLite API tests passed.
- **2026-11-13 - Frontend and backend startup fixes:** Corrected MUI v9 props,
  React dependency resolution, missing auth layout, type-only Redux imports,
  SQLAlchemy 2.x/psycopg configuration, and Python 3.9 annotation compatibility.
  Frontend build and backend startup smoke tests passed.

## Project conversation / background

The original project discussion and product direction are in:

<https://chatgpt.com/c/6ae8c2b3-19b8-83e8-97a8-64eec2c93ebd>

It outlines completing and testing authentication first, then moving to
multi-tenant workspaces and business onboarding. Use this README as the compact
implementation checkpoint rather than assuming the linked chat is accessible.

## Next planned work

The initial organization/workspace, general business profile, caption draft
MVP, and local-development Gemini/FFmpeg generation path are implemented.
Continue in this order:

1. **Validate and run video generation:** install FFmpeg, configure a backend
   Gemini API key, run the focused endpoint/worker checks, and render a test
   project. Do not share the key in chat or commit it.
2. **Durable production processing:** add a task queue/worker and persistent
   private object storage before production; current FastAPI background tasks
   are interrupted by process restarts.
3. **Database migrations:** introduce Alembic before relying on new tables in
   existing deployments; `create_all` does not update existing schemas.
4. **Media policy and controls:** agree on data retention/deletion, per-user
   cost limits, and provider terms; the current workflow sends photos and
   sampled video frames to Gemini but keeps complete video files local.
5. **Brand voice and marketing objectives:** model and persist these as
   workspace/business-scoped data and feed them into content generation.
5. **Preview, calendar, and publishing:** only after selecting platform
   authorization and publishing requirements; keep credentials on the backend.

## Updating this handoff

At the end of each substantial project request, update this README with:

- Date and concise outcome.
- Important files or API contracts changed.
- Commands/tests actually run and their results.
- Anything not verified or still blocked.
- The next agreed step.

Keep the history factual and concise. Never record secrets or claim that a
service/database works unless that exact integration was tested.
