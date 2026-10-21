# Local change inventory

No Git metadata was available for an automatic baseline diff. Review these authored/edited files directly. Generated build/dependency directories are not release inputs.

## Runtime and dependency changes

- backend/src/auth/jwt.strategy.ts — reject inactive/deleted identities during JWT validation.
- backend/src/auth/guards.ts — resolve role metadata on handler and controller.
- backend/src/exams/scoring.ts — extracted existing scoring helper.
- backend/src/exams/exams.service.ts — use shared helper; scoring algorithm unchanged.
- backend/src/seed.ts — require explicit admin credentials; remove default password.
- backend/package.json, backend/package-lock.json — test command and patched adm-zip 0.6.1 dependency.
- backend/Dockerfile.dev, frontend/Dockerfile.dev — Node 22/npm ci; remove backend Prisma generation.
- frontend/src/lib/firebase-api.ts — two let-to-const lint fixes; behavior unchanged.

## Tests and independent package

- backend/test/domain.test.cjs, backend/test/security-validation.test.cjs.
- core/package.json, core/package-lock.json, core/tsconfig.json, core/README.md, core/demo.cjs, core/test/domain.cjs, core/test/core.test.cjs, core/.github/workflows/checks.yml.
- scripts/export-core.py, scripts/audit-dependencies.py, scripts/audit-source.py.

## Configuration and governance

- README.md, README.vi.md, CONTRIBUTING.md, SECURITY.md, ROADMAP.md, CHANGELOG.md.
- .env.example, backend/.env.example, frontend/.env.example; existing private environment files unchanged.
- .gitignore, backend/.dockerignore, frontend/.dockerignore, docker-compose.local.yml.
- .github/workflows/checks.yml, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/pull_request_template.md.
- docs/SELF_HOSTING.md, docs/RELEASE_CHECKLIST.md and docs/oss reports/inventories.

## Generated review artifacts

- artifacts/green-exams-core/ — allowlisted source candidate, initially unlicensed; superseded by the licensed Apache-2.0 candidate after the owner license decision.
- artifacts/green-exams-core-review.tar.gz — 13-file source archive.
- artifacts/core-manifest.json — SHA-256 by file, no private values.

Full-app licensing module, Firebase rules and existing private data were not changed. No EDU ERP repository was modified.

## Warning cleanup follow-up

- Frontend warning sites: admin/login, home, skills recording, flashcard hook, AdminUI, ExamPanel, SkillsExamPanel, QuizLivePanel, lib/api and lib/firebase-api. Removed unused imports/bindings, marked unused adapter parameters, corrected hook/memoization and preserved navigation behavior.
- frontend/eslint.config.mjs, frontend/next.config.js, firebase.json and frontend/package*.json: zero-warning lint, Webpack builds, hosting header, SDK deduplication and dependency fixes.
- backend/package*.json and functions/package*.json: compatible patched dependency sets and removal of unused/deprecated direct tools.
- functions/src/index.ts and backend/src/migrate.ts: modular Admin SDK imports; migration not run.
- backend/src/exams/schemas/flashcard-set.schema.ts and backend/test/security-validation.test.cjs: retain one sparse unique access-code index.
- backend/test/http-compatibility.test.cjs: isolated HTTP regression after the framework update.
- .nvmrc, .github/workflows/checks.yml, docs/oss/WARNING-CLEANUP.md, updated validation/readiness/inventory/audit reports and docs/SELF_HOSTING.md.
- Existing core archive and manifest remain unchanged.

## UX/UI audit and full-project GitHub introduction

- README.md / README.vi.md rewritten to introduce full-app scope, architecture, feature truth and development setup.
- docs/GITHUB_INTRO.md and docs/FEATURE_STATUS.md added.
- docs/ux/AUDIT.md, impeccable-detector.json and local synthetic evidence added.
- docs/oss/FULL-PROJECT-PUBLICATION.md added; readiness/license notes, release checklist, roadmap and changelog updated for owner's intended full-project scope.
- No UI/business source changes in this audit pass. No GitHub upload/visibility operation.

## Remove sales Home for community entry

- frontend/src/app/page.tsx: replace sales/pricing landing with client navigation to /admin and accessible static fallback link/status.
- frontend/src/app/admin/login/page.tsx: replace home loop link with student entry guidance.
- README.md / README.vi.md, CHANGELOG.md, UX audit follow-up and full-project publication plan updated.
- Verification: zero-warning frontend lint, successful static build, no Impeccable findings on the two changed routes, static HTML confirms old pricing/claims are absent. Browser verification unavailable because local browser use remains disabled in Work settings.

## Classora repository preparation

- README.md / README.vi.md / docs/GITHUB_INTRO.md: Classora name and actual GitHub destination.
- frontend/src/app/page.tsx, layout.tsx, admin/page.tsx, admin/login/page.tsx and backend PDF attribution: visible name updated.
- frontend/src/lib/firebase.ts: old hardcoded Firebase configuration replaced with nonproduction demo placeholders.
- scripts/export-project.py: allowlisted full-project source candidate, secret-pattern check and manifest.
- Publication/self-hosting/readiness notes updated. Local lint and frontend build passed.

## Wordmark / Apache-2.0 follow-up

- frontend/src/app/admin/page.tsx and admin/login/page.tsx now use text-only Classora branding; frontend/src/app/layout.tsx uses the newly authored text SVG. Flashcard branding uses Classora. Old public logo/favicon assets are backed up only under ignored scratch/private-brand-backup.
- LICENSE (unmodified official Apache-2.0), NOTICE (Copyright 2026 Joseph. MD), THIRD_PARTY_NOTICES.md and third-party-licenses/ added.
- All package manifests/lock roots declare Apache-2.0 for original package source and Joseph. MD as author; dependencies keep their own licenses.
- docs/oss/LICENSE-DECISION.md records author-supplied provenance and actual distribution limits; license-evidence.json plus audit script resolves missing upstream MIT metadata by exact license hashes.
- README/policies/publication checklist and both exporters updated; clean local review candidates regenerated with licenses and without old logo assets.
- Frontend zero-warning lint/build and changed-route Impeccable detector passed. No browser screenshot due to previously disabled local browser access. No public push.

## Remove external SSO before publication

- Removed the unused external-provider login UI, OAuth controller/service code, callback page/hosting rewrite and provider user-schema field.
- Removed provider environment examples and corresponding feature/setup references. Existing private .env files and database documents were not changed.
- Kept email/password authentication and private configuration for the remaining optional services.
