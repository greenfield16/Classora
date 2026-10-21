#!/usr/bin/env python3
"""Export an allowlisted, unreleased source candidate. Never copy runtime data."""
import hashlib, json, pathlib, re, shutil, sys, tarfile
root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'artifacts' / 'green-exams-core'
if out.exists():
    raise SystemExit('Output exists. Choose a fresh review directory by moving the previous artifacts/green-exams-core first.')
files = {str(p.relative_to(root/'core')):p for p in (root/'core').rglob('*') if p.is_file() and 'node_modules' not in p.parts}
for name in ['docx-parser.ts','scoring.ts']:
    files['src/'+name] = root/'backend/src/exams'/name
files['LICENSE'] = root/'LICENSE'
for name in ['CONTRIBUTING.md','SECURITY.md']:
    files[name]=root/name
# Explicit allowlist prevents unnoticed template files from entering the package.
allowed={'package.json','package-lock.json','tsconfig.json','README.md','demo.cjs','test/domain.cjs','test/core.test.cjs','src/docx-parser.ts','src/scoring.ts','CONTRIBUTING.md','SECURITY.md','LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','.github/workflows/checks.yml'}
if set(files)-allowed: raise SystemExit('Unexpected core template path; review allowlist.')
patterns=[r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----',r'AIza[0-9A-Za-z_-]{30,}',r'AKIA[0-9A-Z]{16}',r'gh[pousr]_[0-9A-Za-z]{20,}',r'mongodb(?:\+srv)?://[^\s:/]+:[^\s@]+@']
for rel,source in files.items():
    if source.is_symlink(): raise SystemExit('Symlinks are forbidden: '+rel)
    content=source.read_text()
    if any(re.search(p,content) for p in patterns): raise SystemExit('Potential credential in '+rel+' (value suppressed)')
out.mkdir(parents=True)
for rel,source in sorted(files.items()):
    dest=out/rel; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(source,dest)
(out/'src/index.ts').write_text("export { parseDocxBuffer } from './docx-parser'\nexport type { ParsedQuestion } from './docx-parser'\nexport { scoreTrueFalse } from './scoring'\n")
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}
(out.parent/'core-manifest.json').write_text(json.dumps({'status':'LICENSED_LOCAL_REVIEW_ONLY','files':manifest},indent=2)+'\n')
with tarfile.open(out.parent/'green-exams-core-review.tar.gz','w:gz') as archive:
    for rel in sorted(manifest): archive.add(out/rel,arcname='green-exams-core/'+rel,recursive=False)
print('Exported',len(manifest),'allowlisted files to',out)
