# Contributing

Classora is an unreleased development preview. Original project source and documentation are licensed under Apache-2.0, Copyright 2026 Joseph. MD. By intentionally submitting a contribution for inclusion, you submit it under Apache-2.0 unless explicitly stated otherwise, consistent with section 5 of LICENSE. Submit only work you have the right to contribute; third-party material must retain its own notices.

Use Node 22 and `npm ci` within each package. For the backend run `npm test` and `npm run build`; for functions run `npm run build`; for frontend run `npm run build` and report lint findings. For the independent core candidate run `npm ci`, `npm test`, and `npm run demo` inside the exported package.

Submit a focused change with the user-visible problem, implementation, meaningful checks, and limitations. Use synthetic exam questions and fictitious identities. Include failing-case coverage for grading, DOCX parsing, access boundaries, or validation changes. Do not attach learner recordings, real exam papers, tokens, environment files, or database dumps.

Describe the origin and license of any copied code or media. Keep EDU ERP/EduEng integrations outside the core. Do not change licensing/entitlement behavior as incidental cleanup. Security reports must follow SECURITY.md rather than a public issue.

Maintainer workflow: reproduce, assess impact and ownership, review the diff and tests, record release notes, and obtain release approval. No response-time promise is made until a maintainer commits to one.
