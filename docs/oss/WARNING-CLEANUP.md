# Warning cleanup — 2026-10-21

## Result

Frontend ESLint now enforces `--max-warnings=0`. Unused imports/bindings are removed, intentionally unused adapter parameters are explicitly named with `_`, and a redundant hook dependency and incompatible memoization are corrected. No warning rule was disabled as part of this cleanup. The underscore argument convention is documented in the ESLint configuration; existing stub/API signatures remain compatible.

Builds use Node 22 (`.nvmrc` and package engines). Frontend production builds use Webpack because Turbopack's PostCSS worker needs process/port permissions unavailable in the sandbox. The obsolete Next static-export `headers` hook is removed; its favicon cache header now lives in Firebase Hosting configuration. Updated dependencies refresh Browserslist data and install the native Next bindings. Backend's duplicate nonunique flashcard access-code index declaration is removed; its original sparse unique index is retained and tested. No database index commands were run.

## Dependency changes

- NestJS adapters/core/CLI updated together to the patched 12.x line; backend build and real loopback HTTP tests verify routing, JSON parsing, authentication and validation.
- Firebase Admin updated to 14.5.x. Functions explicitly imports the v1 callable API to preserve existing function signatures; Firestore access uses modular Admin SDK imports. The offline migration script is updated for the SDK but was not executed.
- Firebase client remains on 12.x for Node 22. Pinning its shared app registry to 0.16.2 avoids duplicate registries, static-export auth registration failure, and the Node 24 requirement introduced by the newer app release. This override must be revisited when upgrading the SDK/runtime.
- gRPC is overridden to patched 1.14.6+; selector-parser to 7.1.6+. TypeScript/build checks validate the frontend dependency combination.
- Unused inherited backend dependencies (including nodemailer, cheerio, pdf-parse, fast-xml-parser, schedule/throttler and passport-local) are removed after scanning application imports.
- Obsolete Functions TSLint is removed; `npm run lint` now runs TypeScript checking, including the existing strict/no-unused/no-implicit-return settings.
- CI adds production dependency audits, Functions checking and zero-warning frontend lint. It does not waive the remaining development advisory.

## Audit results and upstream limits

| Package scope | Before | After |
|---|---:|---:|
| Backend, all dependencies | 54 | 0 |
| Functions, all dependencies | 23 | 0 |
| Frontend, all dependencies | 30 | 7 high |
| Frontend, production dependencies only | — | 0 |
| Independent core | 0 after previous patch | Unchanged |

All 7 remaining frontend audit entries arise from **one** advisory, GHSA-vfj7-8cjw-p6xm, in development tooling: braces → micromatch/fast-glob/chokidar → Tailwind/Next ESLint. `braces` 3.0.3 is the latest upstream release and the advisory lists **no patched version**. See the [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [upstream discussion](https://github.com/micromatch/braces/issues/70).

The affected pattern inputs in this project are checked-in lint/Tailwind configuration, not exam submissions. `npm audit --omit=dev` returns zero for the frontend. This limits the application exposure but does not make an unfiltered audit clean. No audit exception, fabricated version, vulnerable SDK downgrade or disabled audit was used. Keep untrusted pattern input away from build/lint tools; revisit the advisory when upstream releases a fix or when the tooling is replaced through a separately tested migration.

A fresh backend/Functions install can still print upstream deprecation notices for `glob@10.5.0` and `node-domexception@1.0.0` through Firebase Admin/Google SDK dependencies. The current Admin SDK still pulls these packages. They are not lint/build warnings or known audit findings in the final dependency tree. No incompatible transitive substitution was made solely to hide those notices.

## Scope of verification

See VALIDATION.md for final command results. No production database, Firebase deployment, student records, entitlement logic or source license was changed. Full Firebase/MongoDB application E2E and tenant/security-rule work remain separate release blockers.
