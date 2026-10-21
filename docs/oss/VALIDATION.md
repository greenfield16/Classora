# Validation — 2026-10-21

Updated after the requested warning cleanup. Node 22.23.3 is the verified runtime. The initial Node 25/Turbopack checks and initial 78 lint warnings are superseded by the results below.

| Check | Result | Boundary |
|---|---|---|
| Core archive fresh extraction + npm ci/test/demo | PASS | 9 dependencies, 3 domain tests, score 0.25; source package unchanged by warning cleanup |
| Core audit | 0 known findings at last check | Patched adm-zip 0.6.1; no claim of security certification |
| Archive allowlist + hashes | PASS, 13 regular files | Every tar entry matched SHA-256 manifest; no dependencies, data, media or private environment files |
| Backend npm test | PASS, 9 tests | DOCX/scoring, auth/validation, sparse unique index invariant, real loopback HTTP through upgraded Nest adapter; no database |
| Backend npm run build | PASS | Nest CLI build on Node 22, no warnings; previous stalled wrapper no longer reproduces |
| Functions npm run build and npm run lint | PASS | Modular Admin SDK imports, v1 callable compatibility, TypeScript checks on Node 22 |
| Frontend npm run lint | PASS | 0 errors, 0 warnings; max-warnings=0 enforced |
| Frontend npm run build | PASS | Webpack compiles, typechecks and exports 15 pages on Node 22; no build warnings |
| Backend full npm audit | 0 | Initial 54 findings resolved |
| Functions full npm audit | 0 | Initial 23 findings resolved |
| Frontend full npm audit | 7 high, upstream blocker | All derive from one unpatched braces advisory in development tooling; initial 30 findings reduced |
| Frontend npm audit --omit=dev | 0 | Production dependency graph excludes the development-tool advisory |
| MongoDB/Docker smoke | NOT RUN | Docker daemon unavailable; no seed or existing database actions performed |
| Firebase rules/emulator/browser E2E | NOT RUN | No test project provisioned; application auth/rules blockers remain |
| Git diff/history | NOT AVAILABLE at root | No `.git`; no commit/push or inference about other repositories |

Detailed changes, upstream advisory links and remaining SDK install deprecation notices are in WARNING-CLEANUP.md. Unfiltered backend/frontend/functions audit JSON is retained alongside this report. Dependency/source inventories are heuristic reviews and do not prove ownership or absence of secrets.

The backend HTTP test uses real controllers, JWT/Passport guards and the Nest/Express adapter, with in-memory service doubles and a loopback ephemeral port. It checks anonymous rejection, authenticated subject listing/creation, organization propagation and malformed login rejection. It does not validate MongoDB persistence or full exam flows. The index regression test verifies that deleting a redundant index declaration retains the existing sparse unique access-code index.

No production database connections, migrations, seed, Firebase deployment, public repository creation, source-license grant, form submission or outbound messaging occurred. Existing private environment files and licensing stubs remain unchanged. EDU ERP was not modified.

For reproduction, use `.nvmrc` (Node 22), `npm ci` in each package, then the commands above. `scripts/audit-dependencies.py` regenerates license metadata; `scripts/audit-source.py` records path-only findings; `scripts/export-core.py` refuses to overwrite an existing candidate. CI checks source only and never publishes/deploys.

## Wordmark and license follow-up

After the owner identified Joseph. MD and selected Apache-2.0 for review/application, LICENSE/NOTICE and third-party notices were added. Old logos are excluded from regenerated source candidates. Frontend lint/build and static text-branding checks passed; Impeccable detector returned no findings for changed routes. Core fresh install and 3 tests passed after license packaging changes. The regenerated core archive contains 16 source/notice entries; full-project candidate contains 174. Archive SHA-256 and no-old-brand checks passed. Earlier 13-file core counts above describe the initial candidate, not the current licensed artifact. Public upload remains unperformed.

## Initial-publication integration removal

The requested external SSO provider, callback route/hosting rewrite and example variables were removed before initial publication. Existing private environment files/database records remain untouched. Email/password behavior was verified by the regression suite: 10/10 backend tests, including the new successful-active-login case. Backend build passed. Frontend lint passed; the final static build no longer includes the retired callback route (14 generated pages expected). Generated development type-cache references to the removed page were discarded before rebuilding; no source workaround was added.


### Direct OpenAI migration (2026-10-21)

Removed the private AI worker protocol from both server runtimes. AI now uses OpenAI Responses with a fixed `gpt-4.1-mini` default, server-only `OPENAI_API_KEY`, text/image input, JSON mode where requested, a request timeout and `store: false`. Firebase binds the new secret. The browser API contract is unchanged.

Backend tests: 11/11 pass, including mocked text/image transport, missing key, HTTP authentication error, incomplete response and refusal handling; adapter parity is asserted between backend and Functions. Backend and Functions compile. No live OpenAI request was made; credentials, provider access and educational output quality remain unverified. Frontend source did not change.


### MongoDB consolidation (2026-10-21)

The current frontend persistence/auth/AI path is NestJS + MongoDB + JWT, replacing the historical Firebase path described above. Firebase runtime packages, Functions sources/config/rules and the obsolete migration script were removed. Existing cloud/local databases were not accessed, migrated or deleted.

- Backend unit suite: 11/11 pass, covering parser/scoring, auth/DTO/HTTP and mocked OpenAI behavior.
- An isolated MongoDB 8.0.15 process, bound to 127.0.0.1:27029 with temporary storage, passed the synthetic HTTP integration scenario. Each run creates/drops a new random test database. CI is configured with MongoDB 7.
- Integration includes the real frontend adapters over HTTP; teacher/student auth, tenant/legacy-record isolation, question/exam publication, real session capability/grade/result persistence, repeated submission rejection, profile/feedback, empty and populated flashcards, quiz/poll room setup/join, PDF bytes, skill publication/upload/playback/submission and password changes.
- Fixed PDF font loading and empty flashcard authoring exposed by activating the backend path. Student filter-option queries are scoped too.
- Fresh dependency installs succeeded using the Firebase-free lockfiles. Backend install retains upstream node-domexception/jpeg-exif deprecation notices. Frontend full audit retains the previously tracked seven development findings; production auditing is separate.
- Frontend lint and static build pass. No browser automation, actual microphone recording, live OpenAI call, Docker startup or production migration was performed.

Database/account/index migration and separate local recording-file backups are documented in `docs/DATABASE.md` and `docs/SELF_HOSTING.md`. Remaining deployment, timing, privacy, retention and abuse-control work is explicit; successful integration is not production certification.

Clean-source follow-up: backend tests/build and the MongoDB integration passed again with freshly installed dependencies and no private environment files; frontend zero-warning lint/static build passed too. Both production dependency audits report zero vulnerabilities. Earlier GitHub failures were missing optional peer metadata in lockfiles; the repaired locks now pass fresh `npm ci`.

GitHub CI follow-up: npm 10.9.9 (bundled with the runner Node 22) required additional optional peer entries that npm 11 did not retain. Regenerated both lockfiles with npm 10.9.9; clean installs now pass with that exact version. No existing locked dependency version was upgraded.
