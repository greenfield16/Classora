#!/usr/bin/env python3
"""Local inventory only: never emits matched values or document contents."""
import pathlib,re,json,collections
root=pathlib.Path(__file__).resolve().parents[1]
skip={'node_modules','.next','dist','out','.git','.firebase','artifacts'}
findings=[]; counts=collections.Counter()
patterns={'embedded credential/project configuration':r'AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|mongodb(?:\+srv)?://[^\s:/]+:[^\s@]+@','legacy/provenance marker':r'IT Services|itservices|Greenfield|copyright|Copyright|stackoverflow|github.com/'}
for p in root.rglob('*'):
    if not p.is_file() or any(x in skip for x in p.relative_to(root).parts): continue
    rel=str(p.relative_to(root))
    if rel.startswith('docs/oss/') or rel.startswith('scripts/audit-'): continue
    if p.name.startswith('.env') and p.name!='.env.example':
        findings.append({'path':rel,'category':'private environment file (not read)'}); continue
    if p.suffix.lower() in {'.mp3','.mp4','.wav','.webm','.docx','.pdf','.xlsx','.bson','.dump','.bak','.pem','.key'} or 'service-account' in p.name or 'credential' in p.name.lower() or rel.startswith('scratch/'):
        counts['excluded data/assets needing owner review']+=1; continue
    if p.stat().st_size>2_000_000: counts['large files not scanned']+=1;continue
    try: s=p.read_text()
    except (UnicodeError,OSError): counts['binary assets not scanned']+=1;continue
    for category,pattern in patterns.items():
        if re.search(pattern,s): findings.append({'path':rel,'category':category})
(root/'docs/oss/source-inventory.json').write_text(json.dumps({'findings':findings,'omitted_counts':dict(counts),'note':'Heuristic scan; no proof of ownership or absence of secrets. Private environment values were not read.'},indent=2)+'\n')
print('Source inventory:',len(findings),'path-only findings; values suppressed')
