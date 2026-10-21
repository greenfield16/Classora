#!/usr/bin/env python3
"""Build a local source review candidate; no Git initialization or network upload."""
import hashlib, json, pathlib, re, shutil, tarfile
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'artifacts/classora-source-review'
if out.exists(): raise SystemExit('Candidate exists; move it aside before regenerating.')
files=set()
root_files=['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','README.md','README.vi.md','CONTRIBUTING.md','SECURITY.md','ROADMAP.md','CHANGELOG.md','DESIGN.md','.gitignore','.nvmrc','.env.example','docker-compose.yml','docker-compose.local.yml']
for rel in root_files:files.add(pathlib.Path(rel))
for directory in ['backend/src','backend/test','frontend/src','core/test','core/.github','.github','scripts']:
 for p in (root/directory).rglob('*'):
  if p.is_file() and p.suffix in {'.ts','.tsx','.css','.cjs','.js','.py','.yml','.md'}:files.add(p.relative_to(root))
for project in ['backend','frontend','core']:
 for p in (root/project).iterdir():
  if p.is_file() and (p.name in {'package.json','package-lock.json','README.md','NOTICE','THIRD_PARTY_NOTICES.md','demo.cjs','Dockerfile.dev','.dockerignore','.env.example'} or p.name.startswith(('tsconfig','nest-cli','eslint.config','next.config','postcss.config','tailwind.config'))):
   if p.suffix not in {'.tsbuildinfo'}:files.add(p.relative_to(root))
for p in (root/'third-party-licenses').glob('*.txt'):
 if p.is_file():files.add(p.relative_to(root))
for p in (root/'docs').rglob('*'):
 if p.is_file() and p.suffix in {'.md','.json'}:files.add(p.relative_to(root))
# Only the newly authored text wordmark is selected; no legacy brand binaries.
files.add(pathlib.Path('frontend/public/classora-wordmark.svg'))
patterns=[r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----',r'AIza[0-9A-Za-z_-]{30,}',r'AKIA[0-9A-Z]{16}',r'gh[pousr]_[0-9A-Za-z]{20,}',r'mongodb(?:\+srv)?://[^\s:/]+:[^\s@]+@',r'"private_key"\s*:\s*"[^"\s]{12,}']
for rel in sorted(files):
 p=root/rel
 if p.is_symlink():raise SystemExit('Symlink rejected: '+str(rel))
 if p.name.startswith('.env') and p.name!='.env.example':raise SystemExit('Private environment file rejected')
 try:content=p.read_text()
 except UnicodeDecodeError:continue
 if any(re.search(pattern,content) for pattern in patterns):raise SystemExit('Potential secret in '+str(rel)+'; value suppressed')
out.mkdir(parents=True)
manifest={}
for rel in sorted(files):
 dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/rel,dest)
 manifest[str(rel)]=hashlib.sha256(dest.read_bytes()).hexdigest()
metadata={'repository':'https://github.com/greenfield16/Classora','status':'READY_FOR_AUTHORIZED_INITIAL_PUSH','license':'Apache-2.0','copyright':'2026 Joseph. MD','authorshipEvidence':'Joseph. MD confirms a personally initiated self-authored project, not commissioned or assigned work','pending':['private security contact'],'asset_review':[],'files':manifest}
(out.parent/'classora-source-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
with tarfile.open(out.parent/'classora-source-review.tar.gz','w:gz') as archive:
 for rel in manifest:archive.add(out/rel,arcname='Classora/'+rel,recursive=False)
print('Prepared',len(manifest),'review files:',out)
print('Manifest:',out.parent/'classora-source-manifest.json')
print('Original source: Apache-2.0; third-party licenses retained. No Git operation or upload performed.')
