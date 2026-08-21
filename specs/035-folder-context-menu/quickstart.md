# Quickstart: Folder Context Menu

Validation scenarios for spec 035. Registry/file-manager behaviour is not drivable by the Playwright suite (spec Assumptions), so scenarios marked **manual** run against real built artifacts; the automated checks at the bottom run in CI.

Prerequisites: `npm install`, then build artifacts with `npm run dist` (NSIS + zip + AppImage land in `dist/`). For the Scoop path, publish or point a local bucket at a built zip per spec 034's flow.

## US1 + US3 — Windows NSIS installer

1. Install `dist/markdownmeister-<version>-windows-x64.exe` for the current user.
2. **Manual** — Right-click any folder in Explorer → "Show more options" (Windows 11) → "Open in MarkdownMeister" exists, with the app icon. Click it: the app launches with that folder as the workspace.
3. **Manual** — With the app already running on a different workspace containing an unsaved document: invoke the folder action again. The existing confirmation prompt names the dirty file; cancelling leaves the current workspace untouched (FR-003).
4. **Manual** — Invoke the folder action for the folder that is *already* open: the existing window comes to front, no duplicate session (FR-004).
5. **Manual** — Uninstall. Verify in `regedit` under `HKCU\Software\Classes`: no `Directory\shell\MarkdownMeister`, no verb under the recorded file classes, state key `Software\MarkdownMeister\OsOpenState` gone. Right-click a folder and a `.md` file: neither shows a MarkdownMeister entry; entries from other apps still work (FR-008/FR-009).
6. **Manual** — Between install and uninstall, change your default app for `.md`; uninstall anyway; confirm every entry is still gone (state-record removal).

## Windows Scoop portable

1. Install via the bucket manifest (`scoop install markdownmeister` from the project bucket).
2. **Manual** — Same folder right-click checks as steps 2–4 above (registration came from `post_install` → `open-with.ps1`).
3. **Manual** — `scoop uninstall markdownmeister`; repeat the registry/menu checks from step 5.

## macOS

1. Mount the DMG, copy the app to /Applications, launch once.
2. **Manual** — Drop a folder on the Dock icon (after pinning): opens as workspace.
3. **Manual** — `open -a MarkdownMeister <folder path>` (include a path with spaces): opens as workspace.
4. **Manual** — In a third-party file manager that offers folder Open With (e.g. Path Finder), if available: MarkdownMeister appears; stock Finder showing nothing is expected (spec Clarifications 2026-08-21).
5. **Manual** — Delete the app bundle: no system residue to clean; nothing folder-related appears in Finder context menus afterwards.

## Linux AppImage

1. Run `dist/markdownmeister-<version>-linux-x64.AppImage` once from its final location.
2. Check `$XDG_DATA_HOME/applications/markdownmeister.desktop` exists with `MimeType=inode/directory;` and `Exec` quoting the absolute AppImage path; icon present under hicolor.
3. **Manual** — Nautilus (or Dolphin): right-click a folder → Open With → MarkdownMeister is in the recommended list; choose it: opens as workspace. Double-clicking a folder still opens the file manager — we are NOT the default (FR-009, research D4).
4. **Manual** — Run `<AppImage> --remove-folder-action`: desktop entry and icon are gone; `mimeapps.list` untouched.
5. Move the AppImage elsewhere, run it: entry rewritten to the new path (no stale Exec).
6. Delete the AppImage without removing the entry: file managers show no dead entry (TryExec auto-hide).

## Automated checks (CI)

```bash
npm run lint
npm run typecheck
npm run test        # includes new tests/main/linuxDesktopEntry.test.ts:
                    #   renders correct keys (%f quoting, MimeType, TryExec)
                    #   idempotent rewrite when path changes
                    #   hostile paths (spaces, quotes, non-Latin) survive round-trip
                    #   remove is success when files absent
npm run test:e2e    # existing suite must stay green (no renderer changes expected)
```

## Failure triage

- Entry missing on Windows after install → check the OsOpenState record lists `Directory`; see scripts/installer.nsh header notes.
- Linux double-click opens MarkdownMeister instead of the file manager → something wrote `[Default Applications]`; that violates FR-009/D4 — treat as a defect.
- Stale label ("Open with…") on folders after update → old verb key kept with new display value; verify the label write targets the same verb key (D5).
