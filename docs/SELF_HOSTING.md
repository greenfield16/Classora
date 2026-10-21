# Local setup and self-hosting status

## Supported independent candidate

Use Node 22 (`.nvmrc`) and npm (lockfile v3), Python 3 for export. Run the core commands in the root README. That path is database-free and the intended first release scope. It includes source, types, meaningful tests and a deterministic scoring demo. No service starts and no data is transmitted by the tests/demo. `npm ci` fetches dependencies from the npm registry.

## Isolated NestJS backend development

Use a fresh copy of the review source in a new directory to avoid existing `.env` files. The existing workspace contains local environment files; do not overwrite or reuse them for a demo. Node 22 is the target runtime; local validation results disclose the actual runtime used.

1. Start Docker and run `docker compose -f docker-compose.local.yml up -d mongo`. This exposes a new MongoDB 7 instance only on 127.0.0.1:27017 and uses a dedicated named volume. If this port is already in use, select a different host port and update your new configuration. Never point at a production database.
2. In the fresh copy: `cp backend/.env.example backend/.env`. Set a random JWT_SECRET (e.g. output of `openssl rand -hex 32`), ADMIN_EMAIL and an independently generated ADMIN_PASSWORD of at least 16 characters. Keep MONGODB_DB=green_exams_local and local MongoDB URI. Do not copy the root `.env`; the seed script also reads it, so the fresh root must have no `.env`.
3. Run `cd backend`, `npm ci`, `npm test`, `npm run build`, `npm run seed`, then `npm run start:prod`. Seed creates an administrator only if absent; it does not reset an existing password. Seed was not run against any existing database during readiness work.
4. POST JSON `{ "email": "your configured address", "password": "your configured password" }` to `http://localhost:3001/auth/login`. Use the returned bearer token for `GET /exams/subjects`. Avoid pasting credentials or tokens into public logs.

This path tests a backend API, not Firebase frontend authentication. MongoDB startup, seed and database integration still need an isolated smoke run on a machine with the required image/runtime. Do not use the old `docker-compose.yml` as a production deployment definition: it reads the existing root environment and has development mounts. Dockerfile.dev now uses Node 22/npm ci and no longer invokes nonexistent Prisma generation.

## Firebase frontend development — incomplete self-hosting path

The UI's `exams` export delegates to `firebase-api.ts`. Authentication uses Firebase; major data flows bypass NestJS. A new development Firebase project needs Email/Password Auth, Firestore, Storage, Functions and appropriate hosting. Provisioning, billing eligibility, teacher authorization, custom claims and rule deployment are not automated here. They must be validated before any real-user deployment.

In a fresh isolated copy, copy `frontend/.env.example` to `frontend/.env.local` and fill **every** Firebase identifier from your own development project, then `cd frontend && npm ci && npm run dev`. Unconfigured builds now use inert `demo-classora` identifiers rather than the old project identifiers. These placeholders allow static compilation only; configure every value for your own Firebase project before testing data/auth flows. No emulator connection is configured automatically. Do not deploy existing Firestore/Storage rules for real learners: authenticated user is often treated as admin, public question reads may expose answers, and anonymous write validation needs review.

For build checks use `npm run build`, which selects Webpack. The Firebase shared-app override is required for the current Node 22 client dependency combination; see WARNING-CLEANUP.md. Next uses static export, producing `frontend/out`; `next start` is not the appropriate server for that output. A static host needs the dynamic-path rewrites documented in `firebase.json` (placeholder pages), which require browser smoke testing. Static cache headers are configured in firebase.json because Next static export does not serve headers.

Functions: `cd functions && npm ci && npm run build`. AI calls OpenAI directly; no private worker is needed. See the OpenAI setup below. Do not run the existing deploy script during local review. AI/storage are optional for core; their application flows are not claimed to work without providers.

## Before production hosting

Resolve READINESS.md blockers, select one authoritative auth/data architecture, establish least-privilege rules and tenant tests, validate upload limits and grading server-side, then document HTTPS, reverse proxy/body limits, secret management, backups/restores, data retention/deletion and operator recovery for the chosen architecture. This preparation does not certify a production-ready deployment.

## Tiếng Việt

Core là đường chạy độc lập có thể tái lập. Backend chỉ chạy thử trong thư mục mới với MongoDB local và biến môi trường tự tạo; không seed vào DB hiện có. Giao diện hiện dùng Firebase, không dùng JWT backend cho đăng nhập thông thường. Chưa có quy trình triển khai toàn app hoàn chỉnh/an toàn production; cần sửa các blocker trước khi sử dụng dữ liệu học viên thật.


## Optional OpenAI setup / Cấu hình AI

Only `OPENAI_API_KEY` is required for AI. The server uses `gpt-4.1-mini` for text and image input through the Responses API. No custom URL or private worker is required.

- NestJS: add your key to `backend/.env` as `OPENAI_API_KEY=...`, then restart the backend.
- Firebase (the current frontend AI path): run `firebase functions:secrets:set OPENAI_API_KEY` for your own project, enter the key at the prompt, then deploy the `examAi` function. Setting only the NestJS environment does not configure Firebase.
- Firebase emulation: add `OPENAI_API_KEY=...` to `functions/.secret.local`; this file is ignored by Git.
- Never use `NEXT_PUBLIC_OPENAI_API_KEY`, browser storage, or a committed file. The UI has no API-key entry form.

Câu hỏi, thông tin phiên thi và ảnh OMR được gửi tới OpenAI khi dùng tính năng tương ứng. Review dữ liệu trước khi sử dụng với học sinh thật. Calls request `store: false`; provider retention policies still apply. API usage requires an API account with billing/credits and model access. Missing keys preserve existing fallback messages where supported; generation and OMR require a working provider.

Protocol reference: https://developers.openai.com/api/docs/guides/text and https://developers.openai.com/api/docs/guides/images-vision. Automated checks mock the provider; they do not verify live credentials or educational accuracy.
