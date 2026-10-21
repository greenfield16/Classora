# Setup and self-hosting

Classora now uses one persistence path: **Next.js → NestJS → MongoDB**. Login uses MongoDB users and backend JWTs. AI calls OpenAI from NestJS. Firebase/Firestore/Functions are not required and their runtime code/configuration has been removed.

Use Node 22 and a fresh clone for evaluation. The development stack has not been certified for production or real student records.

## Local setup

1. Start a dedicated local MongoDB, for example `docker compose -f docker-compose.local.yml up -d` (listens only on 127.0.0.1:27017).
2. Copy `backend/.env.example` to `backend/.env`. Set `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET` (e.g. generate with `openssl rand -hex 32`), `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 16 characters. The sample database is `classora_local`.
3. In `backend/`: `npm ci`, `npm test`, `npm run build`, `npm run seed`, then `npm run start:prod`. Seed reads only `backend/.env` and creates the administrator if absent; it does not reset existing passwords.
4. Copy `frontend/.env.example` to `frontend/.env.local`. Set `NEXT_PUBLIC_API_URL=http://localhost:3001`.
5. In `frontend/`: `npm ci`, `npm run lint`, `npm run dev`. Open `http://localhost:3000`, sign in with the administrator credentials and create a subject/question/exam.

No Firebase project, Firebase browser variables, separate callable function deployment or private AI worker is needed. Old Firebase browser sessions are deliberately not reused; sign in again with a MongoDB account.

## Docker development stack

After configuring `backend/.env`, run `docker compose up --build`. MongoDB is internal to the development network; frontend/backend ports bind to localhost. In another terminal run `docker compose exec backend npm run seed`, then open localhost:3000. This is a development definition with watch mode and source mounts, not a production deployment. The Docker stack was source-reviewed; local integration tests used an isolated native MongoDB process rather than Docker.

The standalone `docker-compose.local.yml` is an alternative MongoDB-only service for running Node processes on the host. It uses a separate named volume.

## AI and files

AI needs only `OPENAI_API_KEY` in `backend/.env`, followed by a backend restart. The server uses `gpt-4.1-mini` via OpenAI Responses for text and image input. Never put the key into a `NEXT_PUBLIC_*` variable, browser storage or committed file. API billing/credits and model access are required. Automated checks mock OpenAI; live output quality remains unverified.

Camera/image uploads use the optional R2-compatible storage configuration in the backend example file. Skill-exam recordings use local disk under `UPLOAD_DIR/recordings` (default `backend/uploads/recordings`) and MongoDB metadata; they no longer use Firebase Storage. The upload route checks the published template/question and a 20 MB file limit. Playback URLs use unguessable identifiers and should be treated as bearer links. The local disk directory must be persistent and backed up separately from MongoDB. A shared filesystem or storage adapter is required before running multiple backend replicas.

Question content, session information or OMR images are sent to OpenAI when the corresponding AI action is requested. Calls request `store: false`; provider retention policies still apply. Evaluate consent, data minimization and output accuracy before real-student use.

## Test the database integration

Against a dedicated local test MongoDB:

```sh
cd backend
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

The test only accepts an explicit loopback URI, creates a random `classora_integration_*` database, uses synthetic records and removes that test database afterward. It exercises real HTTP requests plus the actual frontend adapters: login, tenant boundaries, question/exam creation, publication, persisted session tokens, grading/results, teacher profile/feedback, flashcards, quiz/poll, PDF output and skill recordings/submissions. It does not read or import production databases. CI runs this test against a fresh MongoDB service.

## Existing data and migration

This code change **does not copy, delete or modify existing Firestore or MongoDB data**. See [database architecture and migration](DATABASE.md) before pointing the new application at an existing database. Do not run seed/backfill/index changes against an existing environment without a reviewed backup and migration plan.

## Static hosting

`npm run build` in `frontend/` exports `frontend/out`. Configure `NEXT_PUBLIC_API_URL` before building; it is embedded in the client bundle. Serve over HTTPS, configure `FRONTEND_URL` on the backend for CORS, and put a reverse proxy in front of the API.

Dynamic static routes need explicit rewrites to the exported placeholder documents for `/e/:code`, `/skills/:code`, `/quiz/live/:code`, `/poll/live/:code`, `/quiz/flashcard/:code`, `/quiz/matching/:setId`, `/admin/exam-print/:id`, `/admin/exam-sheet/:id`, and `/admin/skills-exam-print/:id`. For example `/e/ABC` must serve `/e/placeholder.html` while preserving the browser URL. Do not rewrite unknown API routes to HTML. Set security/cache headers in your chosen host or proxy; the obsolete Firebase hosting configuration has been removed.

## Remaining production work

Rate/abuse limits on public endpoints, time/deadline enforcement, data retention/deletion, backup restoration drills, malformed uploads and deployment hardening still need review. The inherited licensing endpoints remain no-op stubs. The historical UX audit is retained as a prior snapshot; its Firebase-adapter findings are superseded by this migration. Browser/device behavior, real microphone capture and production operations have not been fully validated.
