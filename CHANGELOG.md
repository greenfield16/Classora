# Changelog

## Unreleased — preparation, 2026-10-21

- Added English/Vietnamese README, explicit architecture and self-hosting limitations.
- Added independently exportable DOCX/scoring core, synthetic tests/demo, dependency/source inventories and SHA-256 source manifest.
- Added backend authorization/validation tests; reject revoked JWT identities and honor controller role metadata.
- Removed seed password fallback and obsolete Prisma Docker build command.
- Patched adm-zip to 0.6.1 after dependency audit; fixed two frontend lint errors.
- Added contribution/security policies, issue/PR templates, CI and release checklist.
- No public release, source-license grant, production deployment or entitlement change.

### Warning cleanup follow-up

- Removed all frontend lint/build warnings; enforce zero warnings in lint and CI.
- Updated NestJS/Firebase SDKs and security-related transitives; backend and Functions audits now clean, frontend production audit clean.
- Retained explicit tracking of one unpatched development-tool braces advisory (7 transitive entries) and upstream SDK install deprecations.
- Added HTTP compatibility and schema-index regression tests; removed redundant index declaration while retaining uniqueness.

### Full-project introduction and UX/UI audit

- Rewrote English/Vietnamese README for the intended full-application public scope; added GitHub About/introduction copy and an evidence-based feature matrix.
- Added Impeccable technical UX/UI audit, desktop/mobile evidence, verified detector triage and prioritized findings.
- Updated publication scope, roadmap and release checklist; no public upload or source-license grant.

### Community application entry

- Removed the sales landing page, pricing tables and unsupported marketing claims from `/`.
- Root now opens the teacher workspace; the existing admin guard sends signed-out visitors to login.
- Replaced login's home-page link with guidance for students to use teacher-shared exam/practice links. README remains the project introduction.

### Classora repository preparation

- Verified the new greenfield16/Classora remote is empty.
- Renamed visible application/README introduction to Classora and removed old Firebase project fallbacks from source. Existing local environment files unchanged.
- Added allowlisted full-project exporter and local source review archive/manifest; no GitHub push.

### Text wordmark and license

- Removed old company logo/favicon assets from active app/release scope; use the plain-text Classora wordmark.
- Applied Apache-2.0 to original source/documentation, Copyright 2026 Joseph. MD, based on the author's stated self-authorship and license choice.
- Added NOTICE, third-party icon/dependency notices and exact MIT evidence for missing package metadata; updated package license/author fields.
- Updated source exporters to include license/notice files and exclude old brand assets. No public push.

### Initial public-source scope

- Removed the unused external SSO integration, provider-specific configuration, callback route and alternative login control before the first public push.
- Kept email/password authentication; no private environment files or persisted user data were migrated.
