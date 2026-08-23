# Microsoft Store release checklist

Spec 038 (FR-001/FR-010): how the Store build of MarkdownMeister reaches the Microsoft Store, and what a human must verify that CI cannot. The automation ends at an unsigned MSIX artifact; everything below is manual by nature.

## What ships

A single `.appx`/`.msix` package containing the regular Electron app plus `app\resources\shell-extension\MarkdownMeisterShellExtension.dll`, with manifest declarations for the execution alias (`markdownmeister.exe`), the packaged COM class, and the `windows.fileExplorerContextMenus` Directory verb — the combination that places "Open in MarkdownMeister" in Windows 11's first-level folder menu. The Store re-signs the package during certification, which provides trusted package identity without any developer-purchased certificate.

## One-time setup: Partner Center identity

1. Enroll a Microsoft Partner Center developer account (individual accounts are free since September 2025 — spec 038 Clarifications).
2. Reserve the app name **MarkdownMeister** (Dashboard → Apps and Games → New product). The reserved name must match the manifest display name.
3. Copy the two identity values Partner Center assigns under Product setup:
   - **Package/Identity Name** (individual accounts look like `12345YourName.MarkdownMeister`) → goes into `identityName`.
   - **Publisher** (format `CN=<GUID>`) → goes into `publisher`.
4. Fill them in ONE of two ways:
   - Edit the clearly marked placeholders in `electron-builder.yml` (`appx.identityName`, `appx.publisher`) in a reviewed commit; or
   - Set repository variables `STORE_IDENTITY_NAME` and `STORE_PUBLISHER` (Settings → Secrets and variables → Actions → Variables) and let `build-store.yml` inject them at build time without touching the file.
5. `publisherDisplayName` may stay `MarkdownMeister`; Partner Center displays the account's publisher name regardless.

Submission FAILS certification while placeholders are in place — that is intentional; the placeholder values exist only so local packaging can run.

## Build the submission candidate

Either dispatch **Build Microsoft Store package** (.github/workflows/build-store.yml) from the Actions tab on the release commit, or locally:

```powershell
npm install
pwsh scripts/build-shell-extension.ps1        # needs VS2022 C++ + Win11 SDK
npm run build
npx electron-builder --win appx --x64 --publish never   # CSC_IDENTITY_AUTO_DISCOVERY=false if needed
```

The unsigned `dist/markdownmeister-<version>-windows-x64.appx` is the candidate. Partner Center's package upload accepts `.appx`/`.msix`/`.msixupload`; if a future UI revision demands `.msixupload` specifically, wrap this artifact with the Windows SDK tooling (`makeappx bundle /p out.msixupload /f mapping.txt` listing the .msix) rather than rebuilding.

## Submission steps

1. Dashboard → the reserved MarkdownMeister product → Start submission.
2. Pricing/availability as desired; packages page: upload the candidate built above (built AFTER identity values were filled).
3. In Submission options → Capabilities, declare the **runFullTrust** restricted capability with the standard desktop-bridge justification (the app is a full-trust desktop application distributed through the Store; same declaration every packaged Electron desktop app makes).
4. Notes for certification: state that the shell extension only launches the app's own execution alias with the chosen folder path and performs no filesystem access of its own.
5. Submit. Certification adds days-to-weeks lag versus GitHub releases (spec Assumptions) — plan announcements accordingly.

## Mandatory pre-submission verification

Run the full manual matrix in `specs/archive/038-win11-first-level-menu/quickstart.md` against the built artifacts — especially US5 fault injection (F1–F5: removed/corrupted/faulting DLL, missing alias, cost-of-presence). Explorer must survive every scenario untouched before submitting. Also confirm US3 coexistence on a machine that has both the installer and Store builds, and US4 uninstall cleanliness after `Remove-AppxPackage` including an Explorer restart.

## Updates

For each subsequent version: re-run the workflow (or the local commands) at the new tag, re-check quickstart US1–US5 against the new artifact, and submit as an update. The Store keeps the entry registered across updates and removes it atomically on uninstall (platform semantics backing FR-009/FR-010); the manual checks exist to keep that claim honest.
