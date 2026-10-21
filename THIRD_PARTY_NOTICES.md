# Third-party notices

Classora's original source and documentation are licensed under Apache-2.0, Copyright 2026 Joseph. MD. This does **not** relicense third-party dependencies or assign their copyrights to Joseph. MD.

## UI icons and related packages

| Package | Locked version | License | Use / retained notice |
|---|---|---|---|
| @phosphor-icons/react | 2.1.10 | MIT | Actual UI icon imports; exact copyright and permission notice in third-party-licenses/phosphor-icons-react-MIT.txt |
| lucide-react | 0.469.0 | ISC, with Feather-derived portions under MIT | Declared dependency, no current source imports found; exact installed notice in third-party-licenses/lucide-react-ISC.txt. If Feather-derived icons are bundled later, retain the additional upstream Feather MIT notice as well |
| @lottiefiles/react-lottie-player | 3.6.0 | MIT | Declared dependency, no current source imports found; exact notice in third-party-licenses/lottie-react-player-MIT.txt. The player license does not automatically license animation assets |

Phosphor permits redistribution, modification and commercial use subject to keeping its notice. There is no requirement to license original Classora files under MIT just because they import Phosphor. See [Phosphor upstream license](https://github.com/phosphor-icons/react/blob/master/LICENSE) and [Lucide licensing](https://lucide.dev/license).

The Classora wordmark is plain text authored in this preparation, using system fonts without bundling a font file. Previous company logos/favicons were removed from the app and release allowlist; private backups are excluded from publication.

## Packages missing license metadata

Installed upstream LICENSE/README texts for busboy, limiter, passport-strategy, pause, png-js and streamsearch contain MIT permission terms. Exact texts are retained in third-party-licenses/; docs/oss/license-evidence.json records source paths and hashes. This resolves seven inventory entries (limiter appears in backend and Functions). The inventory does not silently assume missing metadata means MIT.

## Dependencies with additional obligations

The source review archive includes package manifests/locks and selected notice texts, **not** node_modules, compiled bundles, containers or vendored dependency code. Dependencies fetched by npm remain under their own terms.

- **sharp/libvips:** optional image-processing dependencies of Next.js include LGPL-3.0-or-later native packages. Original Classora files are not automatically relicensed by declaring them, but redistributing their binaries/containers requires a specific LGPL/libvips compliance review, retained notices, corresponding source access and applicable replacement/relinking rights. Do not treat Apache-2.0 as covering those binaries. The frontend currently uses static export with images.unoptimized; this does not prove every future deployment omits libvips. See [sharp-libvips upstream packaging and licenses](https://github.com/lovell/sharp-libvips).
- **axe-core:** MPL-2.0 development dependency. MPL terms remain on those files and any modifications; original separate Classora files retain Apache-2.0. If redistributing axe executable/source, satisfy MPL source-availability and notice obligations. No axe code is vendored in the source archive. See [Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
- **caniuse-lite:** CC-BY-4.0 browser compatibility data; preserve attribution/license/source/change indication when distributing that data. It is build tooling data, not authored Classora source. See [upstream](https://github.com/browserslist/caniuse-lite).
- Other MIT, ISC, BSD, Apache, BlueOak and Python-licensed dependencies retain their own notices and conditions. The full lockfile inventory is in docs/oss/DEPENDENCIES.md and dependency-inventory.json.

## Distribution boundary

This notice is a source-publication review, not a complete compliance manifest for every possible compiled app, installer or container. Before distributing built artifacts, generate their actual bundled dependency/asset notices and comply with all included licenses. Do not remove upstream .LICENSE.txt/NOTICE output from bundlers or apply the root license to third-party files.
