# Release checklist

- [x] Intended scope recorded: full exam application, with optional standalone core.
- [x] Apache-2.0 selected for original source; author-supplied provenance recorded as Joseph. MD. LICENSE/NOTICE and third-party notices included.
- [x] Owner authorized public source-preview push after self-authorship/license confirmation; final allowlist/secret checks are part of the push workflow.
- [ ] Confirm private security channel, maintainer identity, supported versions and response policy.
- [ ] Review source/dependency inventories and all copied code/assets; resolve UNKNOWN/copyleft metadata for the selected package.
- [ ] Review exact exported allowlist, archive content and SHA-256 manifest; independent secret scan and human review. No .env, credentials, data, recordings, backups, branding or unlicensed exam materials.
- [ ] Run clean Node 22 npm ci/build/test/demo from archive, not the working tree; record versions and outputs.
- [ ] Resolve parser/scorer input-hardening before exposing untrusted uploads. For full app resolve all architecture/security blockers and run tenant/rules/end-to-end tests.
- [ ] Review README, changelog, contributor policy and provenance sign-off. Remove private:true only for an explicitly authorized npm release.
- [ ] Owner approves exact repository visibility and archive/commit before public upload. Preserve an approval record.
- [ ] After authorized release, verify public source + license and reproduce setup from a clean machine.
- [ ] Use only real maintenance history, issues, releases and verified educational outcomes in any program application. Owner reviews application before submission; selection is not guaranteed.

Separate licensed core and full-project source review archives are now prepared locally. Neither has been uploaded. See docs/oss/FULL-PROJECT-PUBLICATION.md. CI below performs checks only, never publication or deployment.
