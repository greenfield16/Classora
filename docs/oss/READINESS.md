# OSS readiness — updated 2026-10-21

The full source is public under Apache-2.0, attributed to Joseph. MD. This is a development preview, not a production certification.

## Current architecture

The frontend now uses one NestJS/MongoDB persistence and JWT authentication path. Teacher profiles/feedback and skill templates/submissions have MongoDB implementations. AI runs from NestJS through OpenAI. Firebase runtime dependencies, functions, rules/configuration and the obsolete MongoDB-to-Firestore migration script were removed. Existing external databases/deployments were not accessed or changed.

See the current [feature matrix](../FEATURE_STATUS.md), [setup](../SELF_HOSTING.md) and [database migration guide](../DATABASE.md). Historical pre-migration findings in the UX audit and old validation entries are retained as history; they do not assert that Firebase is still required.

## Verified scope

- Synthetic MongoDB HTTP integration exercises identity, teacher/student authorization, workspace isolation, question/exam publication, persisted sessions and grading, results, profiles/feedback, flashcards, quiz/poll, PDF and skill recording/submission.
- The actual frontend adapters are also exercised against the test API. No browser or real microphone automation was used.
- Unit tests retain parser/scoring, auth/DTO/HTTP and mocked OpenAI coverage.
- Source-only publication excludes private environment files, databases, audio recordings, dependencies and builds.

## Remaining production work

- Audit all public session/quiz/poll/media endpoints for abuse limits, enumeration, identity/capability use and resource quotas under realistic load.
- Complete deadline, concurrent submission/recovery, answer validation/scoring edge-case and interrupted network scenarios.
- Harden untrusted DOCX/image uploads, including decompression limits. OMR and live OpenAI educational accuracy remain unverified.
- Define data retention/deletion, recording permissions, privacy/consent and backup/restore procedures. Local recording files require separate persistent storage/backup.
- Rehearse actual legacy data/account/index migration in staging; do not automatically claim unscoped records. No generic safe importer for unknown existing datasets is included.
- Complete browser/device, accessibility, mobile layout, draft recovery and deployment security review. Static hosting rewrites and HTTPS/CORS must be configured by the operator.
- Remove or explicitly define inherited licensing stubs and unused non-education API/type surface.
- A verified private security reporting contact still needs to be configured by the maintainer.

The Docker development definition was reviewed but not executed locally. Successful synthetic integration does not establish readiness for real student records.
