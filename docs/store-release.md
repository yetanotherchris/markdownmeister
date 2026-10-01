# Microsoft Store release procedure

Spec 062 (FR-003, FR-010, FR-013, FR-017, FR-018). How a Store build of MarkdownMeister is produced, verified and submitted, and what a human must check that CI cannot. The automation ends at a verified, unsigned MSIX artifact; Partner Center upload and real-device checks remain manual.

For the listing itself, see `docs/store-listing.md`.

## What ships

A single `.appx`/`.msix` package containing the regular Electron app plus `app\resources\shell-extension\MarkdownMeisterShellExtension.dll`, with manifest declarations for the execution alias (`markdownmeister.exe`), the packaged COM class, and the `windows.fileExplorerContextMenus` Directory verb, which places "Open in MarkdownMeister" in Windows 11's first-level folder menu. The Store re-signs the package during certification, which provides trusted package identity without any developer-purchased certificate.

The package declares exactly one restricted capability, `runFullTrust` (spec 062 FR-011), and registers no file association (FR-016). `.md`/`.markdown` shell association stays with the classic NSIS/Scoop channels.

## Product identity

Recorded from Partner Center (Product setup, Product identity). These identifiers are not secret: they are inside the shipped package manifest and readable on any machine with `Get-AppxPackage`. They are listed here so the maintainer, the README link, and the listing all refer to the same values. The build still injects identity from the repository variables, not from this table, and `electron-builder.yml` keeps its placeholders.

| Field | Value |
| --- | --- |
| Package/Identity Name | `yetanotherchris.dev.markdownmeister` |
| Package/Identity Publisher | `CN=003FD62F-3FAA-48D7-96BE-2F9DEAFA3CCF` |
| Publisher Display Name | `yetanotherchris.dev` |
| Package Family Name | `yetanotherchris.dev.markdownmeister_y1y9c52xk6eer` |
| Store ID | `9PJX3ZXLFH6K` |
| Web Store URL | `https://apps.microsoft.com/detail/9PJX3ZXLFH6K` (live once the product is published) |

Update this table if the product is ever re-reserved or renamed.

## One-time setup: Partner Center identity

1. Enroll a Microsoft Partner Center developer account (individual accounts are free; spec 038 Clarifications).
2. Reserve the app name **MarkdownMeister** (Dashboard, Apps and Games, New product). The reserved name must match the package display name.
3. Copy the identity values Partner Center assigns under Product setup:
   - **Package/Identity Name** (individual accounts look like `12345YourName.MarkdownMeister`).
   - **Publisher** (format `CN=<GUID>`).
   - **Publisher Display Name** (the account's publisher name, for example `yetanotherchris.dev`). The manifest's `PublisherDisplayName` must equal this exactly; using the product name here fails certification.
4. Store them as repository variables, Settings, Secrets and variables, Actions, Variables:
   - `STORE_IDENTITY_NAME` = the identity name from step 3.
   - `STORE_PUBLISHER` = the publisher string from step 3.
   - `STORE_PUBLISHER_DISPLAY_NAME` = the publisher display name from step 3.
   The Store workflow reads these, injects identity at build time, and verifies the packaged manifest against all three. It fails if an identity value is unset or still a placeholder, or if the packaged `PublisherDisplayName` disagrees, so a mismatched package cannot be produced.
5. `electron-builder.yml` keeps placeholder identity values and the account's publisher display name so local packaging runs; the workflow overrides both from the variables. A local build can pass them with `-c.appx.identityName=... -c.appx.publisher=... -c.appx.publisherDisplayName=...` instead. The values themselves are recorded under Product identity above.

## Build the submission candidate

Dispatch **Build Microsoft Store package** (`.github/workflows/build-store.yml`) from the **release tag**:

- `version`: the release version without the leading `v`, for example `1.6.58`. It must equal the tag; the workflow asserts this when run against a tag.
- `publishedVersion`: the version currently live in the Store, for example `1.6.57.0`. Leave blank only for the first submission. The workflow fails if the new version is not strictly greater.

The workflow validates the inputs, builds the shell extension and app, packages with that version, then unpacks the produced `.appx` and verifies that its `AppxManifest.xml` identity name, publisher and version match the inputs. The uploaded artifact is `dist/markdownmeister-<version>-windows-x64.appx`.

Locally (needs VS 2022 C++ and a Windows 11 SDK for the shell extension):

```powershell
npm install
pwsh scripts/build-shell-extension.ps1
npm run build
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npx electron-builder --win appx --x64 --publish never `
  -c.extraMetadata.version=1.6.58 `
  -c.appx.identityName=$env:STORE_IDENTITY_NAME `
  -c.appx.publisher=$env:STORE_PUBLISHER
```

## Version rules

Partner Center accepts a four-part version `major.minor.patch.revision`, where the first part is non-zero, every part is 0 to 65535, and the revision must be **0** in a Store build. `scripts/store-submission.mjs` derives `major.minor.patch.0` from the three-part repository version and rejects anything else. The submitted version must be strictly greater than the published Store version, and the package version, the app's reported version and the intended release version must agree (spec FR-017). Building from the release tag with the `version` input is what keeps those three in step.

## Submission steps

1. Dashboard, open the reserved MarkdownMeister product, Start submission.
2. Pricing and availability as desired. On the packages page, upload the artifact built above.
3. Capabilities are declared in the package (`runFullTrust`); provide the certification note from `docs/store-listing.md`.
4. Fill the listing from `docs/store-listing.md`: name, short and full description, category, age rating, screenshots, support URL, privacy URL, and the statement that the Explorer folder action requires Windows 11.
5. Notes for certification: state that the shell extension only launches the app's own execution alias with the chosen folder path and performs no filesystem access of its own.
6. Submit. Certification adds days-to-weeks versus GitHub releases (spec Assumptions); plan announcements accordingly.

## Mandatory pre-submission verification

Run the full matrix in `specs/archive/038-win11-first-level-menu/quickstart.md` against the built artifact, especially US5 fault injection (F1 to F5: removed, corrupted or faulting DLL, missing alias, cost of presence). Explorer must survive every scenario before submitting (spec FR-018, SC-009). Also confirm US3 coexistence on a machine with both an installer and the Store build, and US4 uninstall cleanliness after `Remove-AppxPackage` including an Explorer restart. The workflow's manifest check covers identity and version only; it does not replace these device checks.

## Updates

For each subsequent version:

1. Let the normal release run (`build-release.yml`) publish the tag and update `package.json`.
2. Dispatch `build-store.yml` from the new tag with `version` set to the new version and `publishedVersion` set to the version currently in the Store.
3. Re-check the spec 038 quickstart US1 to US5, including the fault matrix, against the new artifact.
4. Submit as an update. The Store keeps the entry registered across updates and removes it atomically on uninstall (platform semantics backing FR-008/FR-009).
5. If certification rejects the submission, the previously published version and its folder integration stay live; the direct-download release and the Scoop/Homebrew package definitions are untouched (spec FR-015).

## Failure triage

- Workflow fails on identity: set `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` repository variables; confirm they match Product setup in Partner Center exactly.
- Workflow fails on version: the input must be `major.minor.patch`, strictly greater than `publishedVersion`, and equal to the tag.
- Manifest mismatch after packaging: the variable values and the build inputs disagree; re-run from the tag with the correct variables.
- Entry missing on Windows 11 after install: verify the manifest inside the appx contains `windows.fileExplorerContextMenus` (`Expand-Archive` the appx and read `AppxManifest.xml`); confirm identity values were real, not placeholder.
- Classic channels changed unexpectedly: `npm test` fails the channel-isolation guard first; fix whatever touched `scripts/installer.nsh`, `scripts/open-with.ps1`, `markdownmeister.json`, or the existing `electron-builder.yml` keys.
