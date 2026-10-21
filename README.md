# Classora

**An exam workspace for teachers, with browser-based assessment and student practice.**

[Tiếng Việt](README.vi.md) · [Setup](docs/SELF_HOSTING.md) · [Feature status](docs/FEATURE_STATUS.md) · [UX/UI audit](docs/ux/AUDIT.md) · [Roadmap](ROADMAP.md)

Classora brings question banks, exam authoring, DOCX import, student results and practice activities into one education-focused project. Its interface is primarily Vietnamese, with question formats for multiple choice, true/false statements and short answers.

The intended public scope is the **full application**: frontend, backend, Firebase Functions, rules, tests and documentation. A small independently usable parser/scoring package is also available as an optional extraction.

> **Development preview.** This full-source development preview is under active development. Original Classora source is licensed under Apache-2.0, with attribution to Joseph. MD; third-party dependencies retain their own licenses. Several visible features remain incomplete; this is not yet a validated production system for real student records.

## What is in the project?

- **Teacher workspace:** organize subjects and questions, compose exams, review results and manage student information.
- **DOCX import:** read structured Vietnamese question documents; synthetic fixtures cover all three supported question formats.
- **Assessment interfaces:** public exam entry, timed answering, submission and result screens.
- **Practice and classroom activities:** flashcard/SRS, matching, quiz and poll interfaces, with different levels of backend integration.
- **Skill-based exams:** reading, listening/TTS, writing and quiz sections, including browser audio recording and submission code.
- **Optional AI:** question generation, explanation and analysis directly through OpenAI (server-side API key only).

**Feature presence is not a completion claim.** Quiz/poll methods in the current Firebase adapter are stubs; camera grading returns a fixed mock result; analytics/PDF adapter paths are incomplete. Public exam submission also has unresolved session/authentication integration. Read the [feature matrix](docs/FEATURE_STATUS.md) before evaluating or deploying a flow.

The application opens directly into the teacher workspace at `/`; signed-out visitors are sent to `/admin/login`. Student exam/practice links remain directly accessible. Project introduction and setup live in this README; the application has no sales landing page or pricing table.

## Architecture

| Directory | Purpose |
|---|---|
| `frontend/` | Next.js 16 / React 19 interface, static export, Firebase browser SDK |
| `backend/` | NestJS 12 API, MongoDB/Mongoose, separate JWT authentication, DOCX parser and report services |
| `functions/` | Firebase callable functions, grading and optional AI integration |
| `core/` | Standalone package template and shared domain tests |
| `docs/` | Setup, audits, contribution and release planning |
| `scripts/` | Dependency/source inventories and allowlisted core export |

The current frontend uses Firebase Auth, Firestore and callable functions for principal workflows. The NestJS/MongoDB backend has a separate authentication/data path. Setting `NEXT_PUBLIC_API_URL` does not switch the whole UI to MongoDB. Consolidating these paths is a major roadmap item.

## Start with a verified local example

Use Node 22 (`.nvmrc`), npm and Python 3. From the repository root:

```sh
python3 scripts/export-core.py
cd artifacts/green-exams-core
npm ci
npm test
npm run demo
```

This example needs no database, Firebase project or AI credentials. It builds a DOCX question parser and true/false scorer, runs synthetic tests, and prints a demo score of **0.25**. The exporter refuses to overwrite an existing candidate; move an earlier candidate aside before regenerating it.

## Run the application for development

Follow the [setup and self-hosting guide](docs/SELF_HOSTING.md) in a fresh working directory with your own development services. It covers the MongoDB backend and Firebase frontend separately, lists environment variables and explains static-host rewrites. Example files contain no usable credentials.

```sh
# Backend: after configuring an isolated backend/.env
cd backend
npm ci
npm test
npm run build

# Frontend: after configuring your own frontend/.env.local
cd ../frontend
npm ci
npm run lint
npm run build
npm run dev

# Firebase Functions: compile locally; deployment is a separate action
cd ../functions
npm ci
npm run lint
npm run build
```

**Before using the full application:** resolve the [release blockers](docs/oss/READINESS.md), especially public submission, teacher/tenant authorization, Firebase rules and draft recovery. There is no complete one-command production deployment yet. External AI and object storage require separately configured providers and may incur their own costs.

## Quality and current limits

The latest local verification passed 9 backend tests, frontend lint with zero warnings, and builds for frontend, backend and Functions. Core tests use newly authored synthetic questions. Full MongoDB/Firebase end-to-end workflows, real-device recording, accessibility conformance and production readiness have not been established.

Backend/Functions dependency audits and the frontend production audit returned zero known findings at the last check. The frontend development graph retains one unpatched upstream `braces` advisory across seven dependency entries. See [validation](docs/oss/VALIDATION.md) and [dependency review](docs/oss/WARNING-CLEANUP.md) for exact scope.

The [Impeccable UX/UI audit](docs/ux/AUDIT.md) records interaction, accessibility, responsive and product-integrity issues, with evidence and a prioritized remediation plan.

## Contribute

Useful starting points include reliable student submission, accessible shared form/dialog components, explicit feature availability, safe exam draft recovery, Firebase rules tests and deployment documentation.

Read [CONTRIBUTING.md](CONTRIBUTING.md), use synthetic data, and document the origin of copied code or assets. Contributions follow the Apache-2.0 terms described in CONTRIBUTING.md. Security issues follow [SECURITY.md](SECURITY.md); the private reporting channel is pending owner confirmation.

## Release and license

Copyright 2026 **Joseph. MD**. Original project source and documentation are licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE), [third-party notices](THIRD_PARTY_NOTICES.md), [license/provenance review](docs/oss/LICENSE-DECISION.md) and the [publication checklist](docs/oss/FULL-PROJECT-PUBLICATION.md). The application uses a plain-text Classora wordmark; previous company logo assets are excluded.

The proposed release includes this exam application. EDU ERP/EduEng commercial products, private credentials, student records, recordings, database backups and exam materials without redistribution rights are outside its publication scope.
