# Quickstart: First-Level Folder Context Menu (spec 038)

Automated coverage ends at the process boundary: the Playwright suite cannot see Explorer's menus, and Store submission cannot be exercised from this repository (spec Assumptions). Everything below marked **manual** runs against real built artifacts and real Windows 11; the automated checks at the bottom run in CI and must be green first.

Prerequisites:

- `npm install`
- Build the shell extension once: `pwsh scripts/build-shell-extension.ps1` (requires VS 2022 with the C++ workload and a Windows 11 SDK — the script prints exactly what is missing when it is not).
- Produce the unsigned Store package: `npx electron-builder --win appx --publish never` (with `CSC_IDENTITY_AUTO_DISCOVERY=false` if any signing auto-discovery noise appears). The artifact lands in `dist/` as `markdownmeister-<version>-x64.appx` — content-wise this is an MSIX; see docs/store-release.md for turning it into `.msixupload` for Partner Center.

## US1 + US2 — first-level placement and behavioural parity (manual, Windows 11)

1. Install the built package: `Add-AppxPackage -Path dist\markdownmeister-<version>-x64.appx` (or sideload via double-click after enabling sideloading).
2. **Manual** — Right-click a folder in File Explorer. "Open in MarkdownMeister" appears in the FIRST-LEVEL menu, next to entries like "Open in Terminal", with the app icon. Do NOT press "Show more options" (FR-003, SC-001). Record observed result.
3. **Manual** — Invoke it with the app closed. The app launches directly into that folder as the workspace (US1 scenario 3).
4. **Manual** — With the app running on a different workspace holding an UNSAVED edit, invoke the entry again for another folder. The confirmation prompt names the dirty file; cancelling leaves everything unchanged (FR-004).
5. **Manual** — Invoke for the folder already open: the existing window comes forward; no duplicate session.
6. **Manual** — Repeat steps 3–5 using the CLASSIC entry ("Show more options" → Open in MarkdownMeister) against the same folders. Outcomes must match step-for-step (SC-002 parity matrix).

## US3 — channel isolation and coexistence (manual)

1. On a clean machine with ONLY the NSIS installer build: right-click a folder → "Show more options" shows the classic entry and works; NO first-level entry exists (nothing registered it).
2. Install the Store build alongside: both placements work independently.
3. `regedit`: confirm `HKCU\Software\Classes\Directory\shell\MarkdownMeister` exists only where installer/Scoop put it; a Store-only machine has no such key (each channel registers only itself).
4. Uninstall one channel; verify exactly its entries disappeared and the other still works.

## US4 — install / update / uninstall lifecycle (manual)

1. Fresh install: entry present and functional (step 2 above).
2. Install a higher version over it (`Add-AppxPackage` of the new appx): entry remains, launches the updated version (check About/version in-app or the install location).
3. Uninstall (`Remove-AppxPackage <PackageFullName>`): right-click folders — no MarkdownMeister first-level entry anywhere, INCLUDING after restarting Explorer (kill/start explorer.exe). Other applications' modern and classic entries unaffected.

## US5 — fault-injection checklist (manual, MANDATORY before declaring done)

Run each scenario on a machine with the package installed; after EACH step confirm: Explorer did not crash or hang, unrelated context-menu entries render normally, and recovery needs at most an Explorer restart.

| # | Fault | Procedure | Expected |
|---|-------|-----------|----------|
| F1 | DLL removed after registration | Rename/delete `MarkdownMeisterShellExtension.dll` inside `C:\Program Files\WindowsApps\<pkg>\app\resources\shell-extension\` (take ownership if needed); restart Explorer; right-click folders | Entry absent or inert; Explorer healthy |
| F2 | Corrupted component | Overwrite the DLL with random bytes; restart Explorer; right-click folders repeatedly | No crash/hang; other entries fine; entry absent |
| F3 | Exception during query/invoke | Replace the DLL with a debug build whose `GetTitle`/`Invoke` deliberately raise an access violation inside the SEH frame (temporary local build; never commit it) | Explorer survives every right-click; entry absent; event log shows the fault was contained to our module |
| F4 | Alias target missing | Unregister/disable the alias in Settings → Apps → Advanced app settings → App execution aliases; invoke the entry (or launch from the extension path directly) | Nothing launches; Explorer unharmed; app itself unaffected |
| F5 | Cost of presence | With the package installed, do NOT touch the entry; check Process Explorer for threads/handles attributable to the DLL after several menu opens | No measurable ongoing activity |

Restore the package (`Remove-AppxPackage`, reinstall) after fault scenarios. Record outcomes in the implementation PR description; automated gates do NOT substitute for this (spec Assumptions).

## Automated checks (CI)

```bash
npm run lint
npm run typecheck
npm test          # includes tests/main/channelIsolation.test.ts (SC-003 guard),
                  # tests/main/storeHandoff.test.ts (alias/classic argv parity +
                  # adversarial paths), tests/main/storeManifest.test.ts
                  # (manifest fragment XML well-formedness)
npm run test:e2e  # includes tests/e2e/store-handoff.spec.ts (cold-launch argv
                  # parity by spawning the real binary; running-instance routing;
                  # missing-folder failure closes quietly)
```

## Failure triage

- Entry missing on Win11 → verify the manifest inside the appx actually contains `windows.fileExplorerContextMenus` (`makeappx unpack /p <appx> /d out`); verify identity values were replaced before submission-time validation.
- Entry present but dead click → check the alias file exists under `%LOCALAPPDATA%\Microsoft\WindowsApps`; run the app manually with a folder argument to isolate app vs extension.
- Classic channels changed → `npm test` fails the channel-isolation guard FIRST; fix whatever touched scripts/installer.nsh, scripts/open-with.ps1, markdownmeister.json, or electron-builder.yml's existing keys.
