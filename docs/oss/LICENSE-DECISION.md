# License decision and provenance

Decision recorded 2026-10-21: **Apache-2.0** for original Classora source/documentation, with the requested attribution **Copyright 2026 Joseph. MD**. The user states they personally initiated and authored the application from beginning to end as a self-directed personal project, not commissioned or assigned work. This clarification is recorded as author-supplied provenance. No independent contract or external repository-history audit is claimed.

The unmodified Apache-2.0 text is in LICENSE, downloaded from the Apache Software Foundation's official source. NOTICE identifies Classora/Joseph. MD; THIRD_PARTY_NOTICES.md and third-party-licenses/ retain third-party distinctions and selected exact permission notices. Package manifests record license/author. Private:true remains in the core package to prevent accidental registry publication; it does not cancel the source license.

## Can self-authored source be made public?

Generally, a copyright owner can publish and license their own original code. Personally writing code is relevant but does not alone establish ownership of every economic/publication right: an employment assignment, commissioning contract, transfer or third-party copied portion can change the answer. In Vietnam, Article 39 of the consolidated IP Law addresses ownership for assigned/contracted works, unless agreed otherwise. [Official 2025 consolidated text, Article 39](https://congbaocdn.chinhphu.vn/CongBaoCP/VanBan/2025/9/46214/58977-1-20251383-1384155-vbhn-vpqh.pdf).

On the user's stated authorship and intent to open the project, the local release candidate applies the selected Apache-2.0 license to original Classora material. This is not independent verification that a company/client has no rights. Joseph. MD is the requested attribution name, not a verified legal identity or a claim about professional credentials. If a contract/assignment exists, resolve the actual rights before the public push; the repository destination remains greenfield16/Classora.

## What Apache-2.0 permits

Others may use, modify, redistribute and sell covered software, including in proprietary products, subject to its notice/license conditions. It includes a patent grant with specified termination terms. It does not generally grant trademark rights, nor relicense dependencies. Keep the original license text; do not add a noncommercial restriction while calling it Apache-2.0. [Apache license](https://www.apache.org/licenses/LICENSE-2.0), [official reuse FAQ](https://www.apache.org/foundation/license-faq.html).

## Review findings

- Phosphor Icons, the actual imported UI icon family, uses MIT terms permitting redistribution with retained copyright/permission notices. Compatible use with original Apache-2.0 source was found in the reviewed import/package boundary.
- Lucide is a declared but currently unimported ISC dependency with Feather/MIT history. Lottie player is declared but unimported MIT software; separate animation assets would need separate rights. Exact installed license texts are retained rather than relabelled.
- Previous company logo/favicons were removed from active frontend/public and the release allowlist. The new wordmark is plain Classora text. Private originals remain under ignored scratch solely as backup.
- Seven missing-metadata license entries were resolved by exact installed MIT license texts, with hashes recorded. Fourteen remaining inventory flags concern platform-specific LGPL image binaries. These are dependency review flags, not fourteen separate findings that the original source cannot be Apache-licensed.
- MPL axe-core (dev) and CC-BY caniuse-lite data require their respective notices/source/attribution if actually distributed. No vendored implementation of either is selected for the source archive.
- The source archive contains no node_modules, builds, recordings, database copies or real environment files. Built frontend/container licensing must be reviewed against the actual included binaries; this source review does not certify future distribution formats.

## Publication scope

Full exam application source, rules, tests and documentation, with an optional core extraction. EDU ERP/EduEng, private secrets, learner data and exam content without redistribution rights are outside this publication scope. The copyright decision does not authorize disclosure of private student data or grant rights to unrelated materials.

Public upload/visibility approval and a verified private reporting channel remain separate from the local license/attribution work. No public push was performed during this review.
