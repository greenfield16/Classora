# Dependency metadata review

Generated from package locks, installed metadata and hash-verified exact upstream license evidence for packages with missing metadata. Transitive versions included; this is not copyright clearance or a vulnerability scan. Dev-only entries are retained.

| Declared license | Entries |
|---|---:|
| (MIT AND Zlib) | 1 |
| 0BSD | 2 |
| Apache-2.0 | 154 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| BSD-2-Clause | 14 |
| BSD-3-Clause | 8 |
| BlueOak-1.0.0 | 4 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| ISC | 41 |
| LGPL-3.0-or-later | 10 |
| MIT | 867 |
| MPL-2.0 | 1 |
| Python-2.0 | 1 |

## Requires manual review

- `frontend/node_modules/@img/sharp-libvips-darwin-arm64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-darwin-x64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-arm` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-arm64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-ppc64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-riscv64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-s390x` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linux-x64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linuxmusl-arm64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-libvips-linuxmusl-x64` 1.3.4: LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-wasm32` 0.35.5: Apache-2.0 AND LGPL-3.0-or-later AND MIT
- `frontend/node_modules/@img/sharp-win32-arm64` 0.35.5: Apache-2.0 AND LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-win32-ia32` 0.35.5: Apache-2.0 AND LGPL-3.0-or-later
- `frontend/node_modules/@img/sharp-win32-x64` 0.35.5: Apache-2.0 AND LGPL-3.0-or-later

Preserve upstream license/NOTICE files when bundling dependencies. The core archive contains no vendored dependencies. Inspect exact installed LICENSE files and bundled assets before distributing a built app.
