# Initial source publication check — 2026-10-21

Destination: https://github.com/greenfield16/Classora, public `main`. The owner explicitly authorized the push after confirming this is a personally initiated/self-authored project, selecting Apache-2.0 and requesting attribution to Joseph. MD.

## Scope and credentials

Only the allowlisted source/manifest selection is to be committed. Actual .env files, service accounts, production credentials, node_modules, build output, scratch, old logo backups, student data/audio and private archive history are excluded. The application uses a plain-text Classora wordmark.

Gitleaks 8.30.1 was obtained from the official gitleaks/gitleaks release and its downloaded archive was verified against that release's SHA-256 checksum list. A directory scan of the source candidate returned no findings. An additional exact-match scan compared credential-bearing values in existing local environment files against selected source; it returned zero matches. Neither credential values nor private environment contents are stored in this report.

The unused external SSO provider, its callback route and example variables were removed at the owner's request before publication. The source still intentionally contains API integration code and variable names: Firebase, the optional external AI worker and R2-compatible storage. This is not a claim that the application has no APIs. Real keys/passwords/connection credentials are supplied privately at runtime. Old hardcoded Firebase project identifiers have been replaced by demo placeholders; example files contain blank credential fields or explicit sample values.

Before push, the final Git index/tree is compared to the allowlist and the committed history is scanned again. The exact commit, remote ref and GitHub checks can be verified after the push. Reports/manifests generated under ignored artifacts/ are local review records, not application data to upload.

## Limits

Secret scanners and value comparisons are useful checks, not proof of the absence of every possible unknown secret. This is a source-development preview, not a production deployment. Existing UX/session/auth/rules and development-tool advisory limitations remain documented. No production Firebase deployment, database seed/migration or application API call is part of publishing this source.

The private vulnerability-reporting channel is still pending configuration. Do not publish student data or exploit details in routine public issues; follow SECURITY.md. Copyright/license notice is in LICENSE/NOTICE and third-party dependencies retain their terms.
