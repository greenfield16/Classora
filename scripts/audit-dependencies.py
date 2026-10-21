#!/usr/bin/env python3
"""Metadata inventory, not a legal verdict. Does not print environment values."""
import json,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]
rows=[]
evidence=json.loads((root/"docs/oss/license-evidence.json").read_text()) if (root/"docs/oss/license-evidence.json").exists() else {}
for project in ['backend','frontend','functions','core']:
    lockpath=root/project/'package-lock.json'
    if not lockpath.exists(): continue
    lock=json.loads(lockpath.read_text())
    for location,data in lock.get('packages',{}).items():
        if not location: continue
        lic=data.get('license')
        if not lic:
            installed=root/project/location/'package.json'
            if installed.exists(): lic=json.loads(installed.read_text()).get('license')
        package_name=location.split('node_modules/')[-1]
        license_evidence=None
        if not lic and package_name in evidence:
            record=evidence[package_name]
            import hashlib
            evidence_path=root/record['evidence']
            if hashlib.sha256(evidence_path.read_bytes()).hexdigest()!=record['sha256']:
                raise SystemExit('License evidence hash mismatch: '+package_name)
            lic=record['license'];license_evidence=record['evidence']
        rows.append({'licenseEvidence':license_evidence,'project':project,'path':location,'version':data.get('version'),'license':lic or 'UNKNOWN','dev':data.get('dev',False),'review':not lic or any(x in str(lic) for x in ['GPL','UNKNOWN','SEE LICENSE','UNLICENSED'])})
(root/'docs/oss/dependency-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
counts=collections.Counter(str(r['license']) for r in rows)
report='# Dependency metadata review\n\nGenerated from package locks, installed metadata and hash-verified exact upstream license evidence for packages with missing metadata. Transitive versions included; this is not copyright clearance or a vulnerability scan. Dev-only entries are retained.\n\n'
report+='| Declared license | Entries |\n|---|---:|\n'+''.join(f'| {k} | {v} |\n' for k,v in sorted(counts.items()))
report+='\n## Requires manual review\n\n'+''.join(f"- `{r['project']}/{r['path']}` {r['version']}: {r['license']}\n" for r in rows if r['review'])
report+='\nPreserve upstream license/NOTICE files when bundling dependencies. The core archive contains no vendored dependencies. Inspect exact installed LICENSE files and bundled assets before distributing a built app.\n'
(root/'docs/oss/DEPENDENCIES.md').write_text(report)
print('Inventoried',len(rows),'dependency entries;',sum(r['review'] for r in rows),'need manual review')
