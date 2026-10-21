# Classora

[Tiếng Việt](README.vi.md) · [Setup](docs/SELF_HOSTING.md) · [Database](docs/DATABASE.md) · [Feature status](docs/FEATURE_STATUS.md)

Classora is an open-source education toolkit for teachers to create assessments, organize question banks and support student practice. The interface is primarily Vietnamese, with multiple-choice, true/false and short-answer question formats.

**Development preview.** This personally initiated project is maintained by **Joseph. MD** and licensed under **Apache-2.0**. Several workflows still need production hardening and real-device evaluation; this is not a fully audited system for real student records.

## One application, one database

```text
Next.js frontend → NestJS API → MongoDB
                        ├→ OpenAI (optional)
                        ├→ local skill recordings
                        └→ R2-compatible image storage (optional)
```

Authentication, teacher profiles, feedback, question banks, exams/results, quiz/poll, flashcards and skill exams all use the backend and MongoDB. There is no Firebase SDK, Firestore database or Firebase Functions deployment in the current application. Browser code receives no database credentials or OpenAI secret.

The UI opens directly into the teacher workspace. Student exam and practice links remain directly accessible. Project introduction belongs here rather than in a sales landing page.

## Features

- Subject and question banks; manual authoring and DOCX import.
- Exam publication, variants, persisted student sessions and server-side grading.
- Student/result reports, question analytics and PDF export.
- Quiz/poll APIs, flashcards, matching and spaced repetition.
- Skill-exam templates, written answers and recording uploads.
- Optional OpenAI question generation, explanations, analysis and OMR image extraction. Only a server-side `OPENAI_API_KEY` is needed.

Read the [feature matrix](docs/FEATURE_STATUS.md) for tested scope and limits. AI accuracy, abuse controls, timing enforcement and production operations remain work in progress.

## Run locally

Use Node 22 and your own development MongoDB. Follow the [complete setup guide](docs/SELF_HOSTING.md):

1. Start an isolated MongoDB (`docker compose -f docker-compose.local.yml up -d` is one option).
2. Copy `backend/.env.example` to `backend/.env`; set MongoDB settings, a random JWT secret and administrator credentials.
3. In `backend/`: `npm ci`, `npm run build`, `npm run seed`, `npm run start:prod`.
4. Copy `frontend/.env.example` to `frontend/.env.local` and configure the backend URL.
5. In `frontend/`: `npm ci`, `npm run dev`; open localhost:3000 and sign in.

A Docker development stack is also included. Existing Firebase/MongoDB data is **not automatically migrated**; read [migration notes](docs/DATABASE.md) before changing an existing installation.

## Project layout

| Directory | Purpose |
|---|---|
| `frontend/` | Next.js 16 / React 19 teacher and student UI; HTTP API adapters |
| `backend/` | NestJS, MongoDB/Mongoose, JWT auth, grading, OpenAI, media and reports |
| `core/` | Independently usable parser/scoring package template and synthetic tests |
| `docs/` | Setup, migration, feature status, historical UX/security/license reviews |
| `scripts/` | Source/dependency inventories and allowlisted source exporters |

## Validation

```sh
cd backend
npm test
# Dedicated local test MongoDB only; creates and drops a random synthetic test DB:
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

Frontend checks: `npm run lint` and `npm run build` in `frontend/`. CI includes a fresh MongoDB integration job. The integration test also executes the real frontend adapters against HTTP endpoints; it does not simulate a browser or microphone. Live OpenAI calls have not been verified.

For the independent core demo, run `python3 scripts/export-core.py`, then `npm ci`, `npm test`, `npm run demo` in `artifacts/green-exams-core`. It requires no database or AI credentials. Exporters refuse to overwrite an existing candidate.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [roadmap](ROADMAP.md) and [readiness notes](docs/oss/READINESS.md). Do not include credentials, student records, recordings or assessment material without redistribution rights in issues or pull requests. The historical UX audit remains available; database/adapter findings predating the MongoDB migration are superseded by the current feature matrix.

## License

Copyright 2026 **Joseph. MD**. Original source and documentation are licensed under [Apache-2.0](LICENSE). Dependencies retain their own licenses; see [NOTICE](NOTICE), [third-party notices](THIRD_PARTY_NOTICES.md) and [license review](docs/oss/LICENSE-DECISION.md). Classora uses a plain-text wordmark. Source publication does not grant rights to private learner data or third-party exam content.
