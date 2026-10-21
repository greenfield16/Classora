# OSS readiness assessment — 2026-10-21

## Intended publication boundary — updated after owner direction

The owner now intends to publish the **full exam application**: frontend, backend, Firebase Functions, rules, tests and documentation. This supersedes the earlier core-first recommendation as the publication scope. The independent DOCX/scoring core remains an optional extraction, and the existing core archive is not a sanitized full-project artifact. Full-source publication preparation and production readiness have separate gates; see [full-project publication plan](FULL-PROJECT-PUBLICATION.md).

The application remains a development preview with unresolved integration and security blockers. The new [feature matrix](../FEATURE_STATUS.md) and [UX/UI audit](../ux/AUDIT.md) describe actual behavior. EDU ERP/EduEng remains outside scope.

| Component | Observed implementation | Release implication |
|---|---|---|
| Frontend | Next 16 static export; admin, exam entry, quiz/poll, skills routes | Firebase Auth + Firestore/callables are required for principal flows |
| NestJS | MongoDB connection named mgmt; password JWT auth, exam/storage modules, PDF service | Separate API, not a drop-in UI persistence replacement |
| Firebase Functions | Callable exam/AI workflows | Requires Firebase project and server-only OPENAI_API_KEY for AI |
| DOCX | Backend ZIP/XML paragraph parser; separate browser implementation | Core tests cover backend only; table/image/formula fidelity incomplete |
| Grading | Online/sheet backend paths share extracted true/false helper | Full grading, idempotency, timing and ownership integration tests remain |
| Licensing | Guard returns true; service returns valid/ok | Existing no-op stubs, unchanged; no enforcement claim |
| Legacy surface | api.ts still includes ticket/project/warehouse APIs/types; schemas contain inherited code | Ownership and extraction review needed despite earlier README exclusions |

## Blockers for full-app release

- Backend and Functions dependency audits are now clean. Frontend production audit is clean; its full development audit retains 7 entries from one upstream braces advisory without a patched release. See WARNING-CLEANUP.md and the audit JSON reports. Core audit remains clean after pinning adm-zip 0.6.1.

- Firebase rule `isAuthed()` is not an admin check. Several collections allow every authenticated account to write. Public question/quiz reads require answer-key and personal-data exposure review. Browser ownership filtering is not authorization.
- Anonymous submission/recording writes and flashcard progress reads/writes need abuse controls, ownership validation, retention and emulator tests.
- Backend exam routes frequently accept `any` payloads and JWT alone; RolesGuard fixes do not install missing role requirements. Object/tenant authorization and public submission ownership must be tested comprehensively.
- Firebase frontend login and NestJS JWT are distinct. Resolve or explicitly support both architectures before claiming a full self-hosted app.
- DOCX decompression limits, malformed/missing answer validation and formula/table handling are incomplete. Current core is suitable for trusted reviewed documents; hostile upload service is not validated.
- Full-path grading for MCQ/short answer, timing, duplicate submission and Firebase parity is not covered by the new unit tests.
- Old Firebase fallback identifiers have been replaced with explicit demo placeholders for source publication. Configure and test your own development Firebase project; dummy defaults do not constitute a working full-app demo.
- Author confirms a self-initiated personal project, not commissioned/assigned work; Apache-2.0 applies to original source with Joseph. MD attribution. Exact third-party icon notices are included and old logos removed. No contract/assignment history or rights to outside exam materials have been independently certified.

## Completed local fixes

The warning-cleanup follow-up also updates NestJS/Firebase dependencies, removes unused legacy dependencies, enforces zero-warning frontend lint, moves static hosting headers into firebase.json, uses Webpack for reproducible builds, removes a duplicate schema index declaration and adds HTTP/index regression tests. See WARNING-CLEANUP.md.

JWT validation rejects inactive/deleted users; role metadata resolves handler then controller; seed no longer supplies a known default password. Docker dev definitions use npm ci and Node 22, removing an obsolete Prisma command. Shared backend true/false scoring is extracted without changing its algorithm. Licensing and production data remain untouched.

The generated core source archive is a review artifact only. No public repository, deployment, release, enrollment application or adoption evidence was created.
