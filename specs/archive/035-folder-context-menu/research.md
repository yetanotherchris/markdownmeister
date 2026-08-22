# Research: Folder Context Menu

Date: 2026-08-21. Each decision states the choice, the evidence, and the rejected alternatives. Platform behaviour claims were verified against primary sources during this phase (Microsoft Learn, microsoft/vscode, microsoft/terminal, freedesktop specs, Apple documentation).

## D1 — Windows mechanism: classic per-user registry verbs (extend spec 006's model)

**Decision**: Keep the existing registration model — per-user verbs under `HKCU\Software\Classes\…` written by `scripts/installer.nsh` (NSIS) and mirrored by `scripts/open-with.ps1` (Scoop). The folder verb stays registered under the `Directory` class; this feature changes its display label and hardens uninstall. No new Windows mechanism is introduced.

**Rationale**: The mechanism exists, works per-user without elevation, survives unsigned distribution, and already has an uninstall record (`OsOpenState` key) that removes exactly what was added even when defaults change between install and uninstall (installer.nsh header comments; 006 fix of 2026-08-09).

**Alternatives considered**:

- *Sparse MSIX package + native IExplorerCommand COM DLL* — the only way into Windows 11's modern top-level menu (VS Code does exactly this: `resources/win32/appx/AppxManifest.xml`, `vscode-explorer-command` repo, registered via `Add-AppxPackage -Path <signed appx> -ExternalLocation`; Windows Terminal ships `WindowsTerminalShellExt.dll`). Rejected: requires a signed identity package (releases are unsigned per spec 005) plus shipping and maintaining a native C++/WRL shell-extension DLL for one menu placement. Recorded as a spec Clarification (2026-08-21) rather than silently descoped.
- *electron-builder `fileAssociations` for folders* — would take over the default folder handler; already rejected in 006 (research R2 there) for exactly this reason.

## D2 — Windows 11 menu level: classic menu accepted

**Decision**: The folder action appears where classic verbs appear on Windows 11: in the legacy menu, reached via "Show more options". Spec FR-002/SC-002 were rescoped accordingly (Clarifications 2026-08-21), with user approval during planning ("this is just a new reg key").

**Rationale**: Microsoft requires package identity + IExplorerCommand for modern-menu placement ("Context menu extensions that implement IContextMenu will appear in the older context menu instead" — learn.microsoft.com/windows/apps/get-started/make-apps-great-for-windows). Nearly all applications' "Open with X" entries live in the same place.

**Alternatives considered**: top-level placement via D1's rejected route; no third option exists.

## D3 — macOS: rely on the shipped document-type declaration

**Decision**: No new macOS code. The `CFBundleDocumentTypes` entry declaring `public.folder` (Viewer role, `LSHandlerRank Alternate`) shipped by spec 006 already enables Dock drops, `open -a MarkdownMeister <folder>`, and "Open With" in third-party file managers (e.g. Path Finder). Spec FR-005 was reworded to these OS hand-off routes (Clarifications 2026-08-21).

**Rationale**: Finder offers no "Open With"/third-party context entry for folders on any current macOS version — confirmed by sindresorhus filing Apple FB9987605 and VS Code maintainers testing ImageOptim's identical plist entry with no Finder entry appearing (microsoft/vscode#146977); VS Code merged `public.folder` support for third-party finders precisely because stock Finder cannot show it (#147686). Electron cannot implement NSServices providers from JS (electron/electron#36439 closed unsolved; VS Code's native-services PR still unmerged at #302816).

**Alternatives considered**:

- *In-app installer for an Automator Quick Action (.workflow into `~/Library/Services`)* — the pattern VS Code is currently building (#302413): right-click → Quick Actions → "Open in …" would work in stock Finder, pure JS/file operations. Deferred as a possible future enhancement; not needed to satisfy the rescoped FR-005, and it adds an uninstall residue problem (orphaned .workflow) this feature explicitly tries to avoid.
- *Native NSServices provider* — requires Objective-C code Electron does not expose; highest effort/risk. Rejected.
- *Finder Sync extension* — native app extension; unavailable to a pure Electron app. Rejected.

## D4 — Linux: user-level desktop-entry association, opt-in-by-running, never touching defaults

**Decision**: When running as an AppImage, the main process idempotently writes `~/.local/share/applications/markdownmeister.desktop` advertising `MimeType=inode/directory;` with `Exec=<absolute AppImage path> %f` and `TryExec=<same path>`, plus an icon extracted into `~/.local/share/icons/hicolor/256x256/apps/`. A `--remove-folder-action` CLI flag removes both files; moving the AppImage and relaunching rewrites the entry. The app never writes `[Default Applications]`, never runs `xdg-mime default`, and never touches `mimeapps.list`.

**Rationale**: The desktop-entry spec's `MimeType` + `%f` field code is the standard way to appear in Nautilus/Dolphin "Open With" lists for folders (freedesktop desktop-entry spec; verified against VS Code PR #266119 which showed `inode/directory` moves the app into the recommended list). Defaults live exclusively in `mimeapps.list [Default Applications]`; associations alone never displace a configured default, but on systems with none they can win implicitly — VS Code shipped exactly that bug (#114425, #15741: "drive paths open in VS Code") and removed install-time `inode/directory` because of it (#209510). An AppImage writing a *user-level* entry when the user runs it avoids the forced-pollution criticism while matching how NSIS/Scoop behave on Windows (register as a side effect of choosing the app). Stale entries self-hide: launchers hide desktop entries whose `Exec`/`TryExec` target is missing (Arch wiki: Desktop entries), so deleting the AppImage leaves no visible dead entry.

**Alternatives considered**:

- *Ship nothing* — file managers' "all applications" Open With list still finds the app (Nautilus lists everything), but discoverability is poor and the spec requires an offered action where the DE supports it. Rejected.
- *nautilus-python MenuProvider extension* — precise folder-only menu item, but a Python runtime dependency, Nautilus-API breakage history, and no Dolphin equivalent. Rejected for scope.
- *Flatpak/Snap* — out of scope: their sandboxed desktop wiring is owned by those stores (documented unsupported in the spec).
- *Prompt-based integration (AppImageLauncher style)* — nicer consent UX, more machinery (dialog, settings persistence). The automatic write is reversible via `--remove-folder-action` and invisible until a folder is opened; revisit if users object. Rejected for now.

## D5 — Labels: split folder and file verbs

**Decision**: Folder verb label becomes "Open in MarkdownMeister" (mirrors "Open in Terminal"); the file verb keeps "Open with MarkdownMeister". Both derive from the single product name (spec FR-011, continuing 006 FR-015). In NSIS this splits `MM_VERB_DISPLAY` into file/folder variants; `open-with.ps1` mirrors it; the Linux desktop entry uses the product name as `Name`. The verb key itself stays the product name (`shell\MarkdownMeister`) so uninstall removal keys are unchanged.

**Alternatives considered**: single shared label ("Open with MarkdownMeister" for both) — less conventional for folder actions; renaming the verb key would orphan registrations from earlier versions until their uninstall runs. Rejected both.

## D6 — Invocation routing and validation: reuse the OS-open host unchanged

**Decision**: No new routing code. Windows passes the folder as argv (first launch and `second-instance`); macOS hands off via `open-file`; Linux `%f` produces a plain path argv identical to Windows. All flow through `initOsOpenHost` → `classifyOsTarget` → queued drain → `prepareFolderFromOsPath` (main-process validation, confirm→commit workspace pipeline, scrubbed errors) — Principle II and III preserved without modification (src/main/osOpenHost.ts).

**Rationale**: Every requirement in spec FR-003/FR-004/FR-007 maps onto behaviour already implemented and tested by spec 006; duplicating any of it would add risk, not value.

**Alternatives considered**: none worth recording — this is straight reuse.

## D7 — Uninstall/removal guarantees per channel

**Decision**: Each channel removes what it added, verified end-to-end in quickstart.md:

| Channel | Install adds | Uninstall removes |
|---------|-------------|-------------------|
| NSIS installer | File verbs + Directory verb (recorded in `OsOpenState`) | Verbs from every recorded class, legacy v0.1.0 keys, standard locations, then state key (existing `customUnInstall`) |
| Scoop portable | Same via `open-with.ps1 -Action register` (`post_install`) | Same via `-Action unregister` (`pre_uninstall`) |
| Linux AppImage | User desktop entry + icon | `--remove-folder-action` deletes both files; deleting the AppImage alone leaves an auto-hidden entry |
| macOS | Bundle-internal declaration only | Nothing to remove — deleting the bundle removes the declaration (LaunchServices rebuilds; `lsregister` not required) |

**Rationale**: FR-008/FR-009 demand zero dead entries. The NSIS/Scoop paths exist and only need the label change; the Linux path is new and gets explicit removal code; macOS needs nothing (Apple's documented uninstall procedure is dragging the app to Trash — no database cleanup exists or is needed).

**Alternatives considered**: a cross-platform "cleanup tool"; unnecessary — each channel already owns its lifecycle.

## References

Full URLs for every source cited above, grouped by platform.

### Windows — context-menu mechanisms

- Classic verbs land in the older menu; modern placement requires package identity + IExplorerCommand: https://learn.microsoft.com/en-us/windows/apps/get-started/make-apps-great-for-windows
- `desktop4:FileExplorerContextMenus` manifest how-to: https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions
- Sparse-package identity, `Add-AppxPackage -ExternalLocation`, per-user registration, signing requirement: https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/grant-identity-to-nonpackaged-apps
- VS Code's sparse manifest: https://github.com/microsoft/vscode/blob/main/resources/win32/appx/AppxManifest.xml
- VS Code's native IExplorerCommand DLL: https://github.com/microsoft/vscode-explorer-command
- VS Code registration at install time (Inno `Add-AppxPackage`): https://github.com/microsoft/vscode/pull/257741 · tracking issue: https://github.com/microsoft/vscode/issues/127365
- Windows Terminal's shell-extension DLL and manifest: https://github.com/microsoft/terminal/blob/main/src/cascadia/CascadiaPackage/Package.appxmanifest
- Update-path duplicate/stale entries VS Code hit (why uninstall hygiene matters): https://github.com/microsoft/vscode/issues/291065

### macOS — folder hand-off

- Finder offers no folder Open With; Apple FB9987605; ImageOptim test: https://github.com/microsoft/vscode/issues/146977
- `public.folder` declaration for third-party file managers: https://github.com/microsoft/vscode/pull/147686
- Electron cannot implement NSServices providers from JS: https://github.com/electron/electron/issues/36439
- VS Code's unmerged native services provider: https://github.com/microsoft/vscode/pull/302816
- Automator Quick Action installer pattern (deferred alternative): https://github.com/microsoft/vscode/pull/302413
- Services require a native provider object: https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/SysServices/Articles/providing.html
- `LSHandlerRank` semantics: https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundledocumenttypes/lshandlerrank.md

### Linux — desktop entries

- Desktop entry spec (`MimeType`, `Exec` field codes, `TryExec`, `NoDisplay`): https://specifications.freedesktop.org/desktop-entry-spec/latest/
- Mime apps spec (defaults live only in `mimeapps.list [Default Applications]`): https://specifications.freedesktop.org/mime-apps-spec/latest/default.html
- `inode/directory` moves an app into Nautilus's recommended list: https://github.com/microsoft/vscode/pull/266119
- VS Code's default-handler takeover bug: https://github.com/microsoft/vscode/issues/114425 · user reports: https://github.com/microsoft/vscode/issues/15741
- VS Code removing install-time `inode/directory` pollution: https://github.com/microsoft/vscode/pull/209510
- Launchers hide entries whose Exec/TryExec target is missing: https://wiki.archlinux.org/title/Desktop_entries
- AppImage desktop integration is external by design: https://github.com/TheAssassin/AppImageLauncher/blob/master/README.md
