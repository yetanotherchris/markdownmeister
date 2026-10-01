# Research: Windows Store Distribution

Date: 2026-09-30. Each decision states the choice, the evidence, and the rejected alternatives. Tooling behaviour was verified against the installed electron-builder 26.15.3 source in `node_modules/`; platform requirements cite Microsoft's own documentation and Partner Center submission flow.

## D1: Identity and version are gated before and after packaging

**Decision**: `scripts/store-submission.mjs` validates the submission inputs (identity present and not a placeholder, version a strict three-part semver strictly greater than the published version when one is supplied) and then validates the identity and version read back from the built package's `AppxManifest.xml`. Any failure exits non-zero before the artifact is uploaded.

**Evidence**:

- The placeholders in `electron-builder.yml` (`ReplaceWithPartnerCenterIdentity.MarkdownMeister`, `CN=00000000-0000-0000-0000-000000000000`) are the exact strings the current workflow would ship if the repository variables are unset, so a placeholder check is a literal string comparison, not a heuristic.
- Partner Center rejects a package whose `Identity/@Name` or `Identity/@Publisher` does not match the reserved product, and rejects a version that is not strictly greater than the published one. Catching both in CI avoids consuming a certification cycle (spec FR-003, FR-017).
- `AppxTarget.writeManifest` substitutes `${identityName}`, `${publisher}` and `${version}` into the generated manifest (spec 038 research R4, re-verified at `node_modules/app-builder-lib/out/targets/AppxTarget.js:167`); unpacking the `.appx` (a zip) and reading that file is therefore an authoritative check of what Partner Center will receive.

**Version shape evidence**: `AppInfo.getVersionInWeirdWindowsForm` (`node_modules/app-builder-lib/out/appInfo.js:66`) maps a semver `major.minor.patch` to the four-part Windows form `major.minor.patch.0` unless `setBuildNumber` is true. Repository versions are three-part (`package.json`), so the script derives and expects `major.minor.patch.0`. Microsoft's app package requirements state the first part cannot be zero and the fourth part must be 0 in a Store build.

**Alternatives considered**:

- Rejected: *warn on placeholders instead of failing*. A warning is exactly how FR-003 gets violated (spec AGENTS "never do these": skipping a gate because it is inconvenient).
- Rejected: *add an XML parser dependency to read the manifest*. Only three attribute values are needed and the document is machine-generated; a dependency-free attribute reader is smaller and has no supply-chain surface. The separate `storeManifest.test.ts` already proves the fragment's well-formedness with `fast-xml-parser`.

## D2: Repository variables are the CI identity path; the file placeholders stay local-only

**Decision**: `.github/workflows/build-store.yml` requires `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` repository variables and injects them with electron-builder's `-c.appx.*` CLI overrides. The committed placeholders in `electron-builder.yml` keep local packaging runnable and are never the CI source.

**Evidence**: Spec 038's workflow (`.github/workflows/build-store.yml:51-57`) already supports both a file edit and variable injection but silently falls back to placeholders when neither is present. Spec 062 FR-003 requires placeholder values never reach a submission, so the ambiguous fallback is replaced with a required variable plus D1's fail-closed validation.

**Alternatives considered**:

- Rejected: *commit the real identity to `electron-builder.yml`*. The identifiers are public (they ship in every package manifest), so secrecy is not the reason; committing them would make a generic build file carry one product's channel identity and force every fork and local build to rewrite it. The placeholders keep the file generic, and repository variables give CI one explicit injection path. The values themselves are recorded in `docs/store-release.md` for maintainers.

## D3: Version comes from a dispatched input and is checked against the release tag

**Decision**: `build-store.yml` gains a required `version` input and an optional `publishedVersion` input. The build passes `version` to electron-builder via `--config.extraMetadata.version`, so the packaged app, the MSIX identity version, and the intended release version agree (FR-017). When the workflow runs against a tag, it asserts the input equals the tag.

**Evidence**: The release workflow takes its version from the tag and syncs `package.json` afterwards (`.github/workflows/build-release.yml:108-114,220-225`), so a Store build from a branch could otherwise carry a stale `package.json` version. Passing the version explicitly removes that dependency. The current Store workflow does not override the version at all.

**Alternatives considered**:

- Rejected: *derive the version from `package.json` only*. It is the source of the defect spec FR-017 calls out (the Store build "takes its version from the source tree rather than the release tag").
- Rejected: *require the `publishedVersion` input*. The first submission has no published version; making it optional with an explicit "strictly greater" comparison when present is sufficient, and Partner Center remains the backstop.

## D4: Listing content is a repository artifact; the privacy URL is served by GitHub Pages

**Decision**: `docs/store-listing.md` holds the exact listing fields and the Windows 11 folder-action statement; `docs/site/privacy.html` is the privacy policy, published by the existing `pages-deploy.yml`, giving the listing a reachable privacy URL. Support points at the repository's GitHub Issues.

**Evidence**: The Store requires a privacy policy URL even for an app that collects no personal data, and requires reachable support and privacy links (spec FR-004). `pages-deploy.yml` uploads `docs/site` verbatim on pushes touching it (`.github/workflows/pages-deploy.yml:5-8,63-66`), so a committed `privacy.html` becomes reachable at `https://yetanotherchris.github.io/markdownmeister/privacy.html` with no new infrastructure. The support URL follows the repository's existing public issue tracker.

**Alternatives considered**:

- Rejected: *host the privacy policy externally*. It adds a dependency on a page this repository does not control, and the site already deploys a static tree.
- Deferred: *point support at a custom page*. The issue tracker is a reachable, relevant page today; a dedicated support page can come later.

## D5: Capability discipline and no advertised file association are enforced by tests

**Decision**: `electron-builder.yml` declares only the `runFullTrust` restricted capability for the appx target (explicitly, to make the intent reviewable), and a unit test asserts no other capability is configured and no `fileAssociations` or `protocols` are declared.

**Evidence**: `AppxTarget.getCapabilities` always includes `runFullTrust` and maps only the capability names present in configuration (`node_modules/app-builder-lib/out/targets/AppxTarget.js:290-301`; `runFullTrust` is a valid name at `out/targets/AppxCapabilities.js:197`). `AppxTarget.getExtensions` also emits protocol and file-association extensions from `protocols` and `fileAssociations` configuration, so keeping both unset is what prevents the Store package from advertising an association it does not register (FR-016, spec 038 Clarifications). No `fileAssociations`/`protocols` key exists in the current `electron-builder.yml`.

**Alternatives considered**:

- Rejected: *rely on the default implicit `runFullTrust`*. It is invisible in the configuration a reviewer reads, and a test cannot assert the intent behind an absent key as clearly as it can assert one capability against a denylist.
- Rejected: *also register the classic folder verb or a file association in the package*. FR-016 and FR-019 scope the package to the Windows 11 folder action; the classic channels own `.md`/`.markdown`.

## References

- Spec 038 `research.md` R1-R6 (MSIX + IExplorerCommand + `windows.fileExplorerContextMenus`, alias hand-off, containment, packaging hooks), consumed unchanged.
- Partner Center app reservation and package upload: `learn.microsoft.com/windows/apps/publish/`.
- MSIX package versioning (four-part, monotonically increasing, first part non-zero, revision zero for Store): `learn.microsoft.com/windows/apps/publish/publish-your-app/msix/app-package-requirements`.
- electron-builder AppX target and capabilities: `node_modules/app-builder-lib/out/targets/AppxTarget.js`, `out/targets/AppxCapabilities.js`, `out/appInfo.js`.
