# Full-project publication plan

Owner direction recorded 2026-10-21: prepare **the full exam application** for a public repository. This supersedes the earlier recommendation to publish only the parser/scoring core. The core archive remains an optional, narrower artifact and must not be mistaken for a full-project release archive.

## Intended source scope

Include reviewed frontend/backend/Functions source, rules, package manifests/locks, tests, synthetic examples, CI and documentation. Include public brand assets only after provenance approval. Preserve licensing/entitlement code unless an explicit product decision changes it. EDU ERP/EduEng repositories and commercial application source are outside this exam project's scope.

Public source availability and production service readiness are separate milestones. An early preview can describe incomplete functionality honestly; it must not claim a working hosted exam service or an open-source license grant before those facts exist.

## Concrete publication gates

- [x] New target verified empty: https://github.com/greenfield16/Classora. This does not establish the absence of older repositories elsewhere.
- [ ] For any older repository used as source, inspect its tracked files/history and branch status. No `.git` exists at this checkout's root, so `.gitignore` alone is not a publication boundary or history audit.
- [x] Author confirms the application was personally initiated and self-authored, not commissioned or assigned work; Apache-2.0 selected, attribution Joseph. MD, LICENSE/NOTICE and third-party notices added. No external contract/assignment audit is implied.
- [ ] Review the updated root README, README.vi.md, docs/GITHUB_INTRO.md and feature matrix. The old sales landing/pricing route has been removed; `/` opens the teacher workspace. Keep remaining workspace capability labels aligned with the feature matrix.
- [ ] Establish a monitored private security-reporting channel and verify contact details. Do not publish detailed unresolved exploit reproductions as routine issue examples.
- [ ] Replace embedded production Firebase fallback identifiers in a fresh publication candidate with explicit development configuration; do not alter production credentials as incidental export cleanup. Keep server secrets absent and verify fresh-clone startup failure/help when config is missing.
- [ ] Create and review a **full-project** allowlisted source candidate; exclude all actual .env files, service accounts, credentials, database/audio/student files, scratch, generated builds, caches and exam papers without rights. Current artifact/manifest covers only core and cannot approve this wider release.
- [ ] Scan exact source and all history that will become public. Record hashes/file manifest and human review. Dependency/source inventories are supporting evidence, not automatic clearance.
- [ ] Decide whether the first public milestone is source preview or runnable release. For preview, clearly label unsupported flows and prevent mock grades/actions from being treated as real results. For a runnable release resolve P0/P1 UX and auth/session/rules blockers first.
- [ ] Reproduce clean Node 22 install/lint/build/tests. Verify anonymous/public routes and deployed static rewrites, student submission, restart/retry, owner isolation and audio retention in an isolated project.
- [x] Owner explicitly authorized pushing the reviewed source to the public greenfield16/Classora repository. Final index/commit scans and remote verification are recorded as part of the push workflow.

## Current deliverables

- Root README and Vietnamese README now introduce the full app and explain actual architecture.
- docs/GITHUB_INTRO.md contains About text, longer introduction and suggested topics ready to use once the repository is identified.
- docs/FEATURE_STATUS.md separates implemented code, stubs, provider dependencies and unverified flows.
- docs/ux/AUDIT.md records 16 UX/UI findings with source/browser evidence and a repair sequence.
- Licensed full-project and core source review candidates are generated under artifacts/, with SHA-256 manifests. Old company logos are excluded; only the new text wordmark is selected. Public source-preview push is now authorized; a private reporting contact remains open.

## Decisions still needed

Private security contact and future runnable-release acceptance remain. The owner authorized public source-preview publication. Copyright attribution is Joseph. MD and original source is Apache-2.0. None of these values should be fabricated. Saying the full project is intended to become public establishes scope; it does not supply a repository destination or grant a specific legal license.
