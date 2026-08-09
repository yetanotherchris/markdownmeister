# Research: File Association (spec 006)

**Branch**: `phase-030-file-association` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

Every claim below was either verified against the cited source during planning
or — where noted — settled empirically on the actual Windows host. Items that
cannot be verified on this machine (macOS behaviour, a real NSIS install) are
marked UNVERIFIED and carry an explicit verification step in `tasks.md` /
`quickstart.md`.

## R1 — Electron app events for OS opens (verified, electronjs.org/docs/latest/api/app)

- **`app.on('open-file', (event, path) => …)` — macOS only.** Emitted when the
  user wants to open a file with the app; "usually emitted when the application
  is already open and the OS wants to reuse the application". It "is also
  emitted when a file is dropped onto the dock and the application is not yet
  running. Make sure to listen for the `open-file` event very early in your
  application startup (even before the `ready` event is emitted)". Call
  `event.preventDefault()` to handle it. "On Windows, you have to parse
  `process.argv` (in the main process) to get the filepath."
- **`app.requestSingleInstanceLock([additionalData]) → boolean`.** Returns
  `true` for the primary instance (continue loading); `false` means another
  instance holds the lock and this one should exit immediately.
- **`app.on('second-instance', (event, argv, workingDirectory, additionalData) => …)`**.
  Fires in the primary instance when a second instance runs and calls
  `requestSingleInstanceLock()`. `argv` is the second instance's command line;
  "the order might change and additional arguments might be appended". "This
  event is guaranteed to be emitted after the `ready` event." The NSIS verb
  launches `app.exe "%1"`, so the path arrives as an `argv` element.
- **macOS single instance**: "the system enforces single instance automatically
  when users try to open a second instance of your app in Finder, and the
  `open-file` and `open-url` events will be emitted for that. However when
  users start your app in command line, the system's single instance mechanism
  will be bypassed, and you have to use this method to ensure single instance."

## R2 — electron-builder `fileAssociations` on Windows sets the DEFAULT handler (verified, electron-builder source)

electron-builder's NSIS macro `APP_ASSOCIATE` (`templates/nsis/include/FileAssociation.nsh`),
driven by the `fileAssociations` config, writes per extension:

```
WriteRegStr SHELL_CONTEXT "Software\Classes\.ext" "" "<ProgID>"
```

Setting the extension's `(Default)` ProgID makes the app the default handler
for that extension on install (absent a user `UserChoice` override, which takes
precedence). **That violates spec FR-012** ("Installing the application MUST NOT
change the user's existing default application … without explicit user action").
electron-builder also writes `<ProgID>\shell\open\command`, the `OpenWithProgids`
value, and the ProgID registration. **Decision: do NOT use `fileAssociations` on
Windows.** The Windows registration is hand-written in the installer instead
(R5). Note: v27 of electron-builder changes the ProgID format; this project pins
electron-builder ^26, so the issue does not bite here.

## R3 — electron-builder `fileAssociations` on macOS is safe (verified, Apple CFBundleDocumentTypes docs)

On macOS the whole `fileAssociations` array is emitted as `CFBundleDocumentTypes`
in Info.plist. Declaring a document type makes the app appear in Finder's
"Open With…" submenu for that type. Launch Services ranks candidates via
`LSHandlerRank` and the *effective default* is the user's own choice (stored in
LSPreferences / set via "Get Info → Open With → Always Open With"); an installed
app that merely declares a type does not displace the existing default handler.
**Decision: declare `.md`/`.markdown` via `fileAssociations` (or a
`mac.extendInfo` array) with `role: Viewer` and `LSHandlerRank: Alternate` — safe
on macOS.**

## R4 — macOS folders: `open-file` fires for folders; declare `public.folder` (verified, Electron source + VS Code precedent)

Electron has **no** `open-folder` event (only `open-file` and `open-url` are
listed on the app docs). Electron's macOS delegate (`electron_application_delegate.mm`
`application:openFile:`) forwards the path AppKit provides — a file *or* a
folder — to `Browser::OpenFile`, which emits the `open-file` event. So a folder
opened with the app arrives as an `open-file` event with a directory path.

For the app to be offered in Finder's "Open With…" for folders, its Info.plist
must declare the folder content type. VS Code ran into exactly this and fixed it
(issue #146977 / PR #147686) by adding a document type with
`LSItemContentTypes: ["public.folder"]`, `CFBundleTypeRole: Viewer`, modelled on
ImageOptim. **Decision: the macOS Info.plist gets a second CFBundleDocumentTypes
entry for `public.folder` (role `Viewer`).** electron-builder's `fileAssociations`
cannot express `public.folder`, so the full `CFBundleDocumentTypes` array is
provided via `mac.extendInfo`. Declaring `public.folder` does not change the
default folder opener (same Launch Services rule as R3). **UNVERIFIED on a real
Mac** — `quickstart.md` covers the manual check.

## R5 — Windows context-menu verbs without changing defaults (partly verified, Microsoft docs; settled empirically here)

Microsoft's merged-view documentation states that per-user `HKCU\Software\Classes`
immediate subkeys **shadow** the machine-wide `HKLM\Software\Classes` subkeys of
the same name. That raises a risk: creating `HKCU\Software\Classes\.md` fresh (to
add a verb) could hide the machine-wide `.md` class and, with no `(Default)`
value of its own, change how `.md` files open. Practitioner accounts disagree
(see elevenforum thread), so this was **tested empirically on the actual Windows
host**:

1. `HKCU\Software\Classes\.md` already exists on this machine with `(Default) = Markdown`.
2. A verb subkey `HKCU\Software\Classes\.md\shell\MMTestVerb\command` was added and then removed.
3. `assoc .md` returned "File association not found" both before and after — the resolved association and the `(Default)` value were unchanged.

**Mitigation adopted for the fresh-create case** (a machine where `HKCU\.md`
does not exist): before writing a verb, read the merged default
(`ReadRegStr … HKCR ".md" ""`) and write it back as the new `HKCU\.md` `(Default)`
value. The verb is then added under the preserved class, so the effective default
is byte-for-byte the same as before install. Uninstall deletes only our verb
keys and then drops a class key it created **only when the key now holds no
remaining subkeys** — a pre-existing class (or one the user extended) is never
touched. **Final safety check remains the automated install/uninstall assertion
in `tasks.md` / `quickstart.md`.**

Key layout used (Microsoft "Extending Shortcut Menus", "Predefined Shell Objects"):

- Files: `HKCU\Software\Classes\.md\shell\<verb>\command` and
  `.markdown\shell\<verb>\command`.
- Folders (right-click **on** a folder, not folder background):
  `HKCU\Software\Classes\Directory\shell\<verb>\command`. (`Directory\Background`
  is for the empty space inside a folder window — not our scenario.)

`HKCU\Software\Classes` is the per-user, admin-free equivalent of `HKCR`
(hkcr writes resolve to `HKLM\Software\Classes` and require elevation).

## R6 — NSIS customization (verified, electron-builder nsis docs + templates)

electron-builder's NSIS option is **`include`** (path to a custom `.nsh`,
default `build/installer.nsh`), **not** `customInclude`. The templates invoke
`!macro customInstall` (install section) and `!macro customUnInstall`
(uninstall section) when the included file defines them — that is the sanctioned
extension point for installer-side registry work. `SHChangeNotify`
(`System::Call 'shell32::SHChangeNotify(…)'`) refreshes Explorer so new verbs
appear without a shell restart. NSIS `/S` performs a fully silent install /
uninstall, which is what the automated registry assertion test uses.

## R7 — single-instance must not break the e2e suite (empirically known from this repo)

Most e2e specs call `launchApp(configDir?, testFolder?)` without a
`MM_USER_DATA_DIR`, so several test processes share the developer's default
Chromium profile. If the app unconditionally called `requestSingleInstanceLock()`,
a test app could collide with the developer's real running app (or a previous
test's app that has not fully exited) and quit immediately. **Decision: gate the
lock behind `process.env.MM_SINGLE_INSTANCE !== '0'`, and have the e2e launch
helper set `MM_SINGLE_INSTANCE=0` by default** (same seam pattern as
`MM_CONFIG_DIR` / `MM_USER_DATA_DIR`). The dedicated second-instance spec opts in
(omits the seam) with a private user-data dir for both instances.

## R8 — detached-file dedupe needs a stable identity (design decision)

`handleOpenExisting` dedupes by `doc.path === value.path`, but a file opened from
outside the workspace is a *detached* document whose `path` is `null` and whose
id is `file-${Date.now()}` — so FR-007 ("activate the existing tab rather than
create a duplicate") would fail for detached files. **Decision: `OpenedFile`
gains an optional `canonicalPath` (the realpath), populated by
`openFileFromPath` for every open (dialog, recent, OS). `DocumentState` stores it
and `handleOpenExisting` dedupes on it first.** This also fixes the latent
duplicate-tab bug in File → Open for files outside the workspace. The renderer
already receives absolute paths today (`RecentItem.path`), so carrying a
realpath for dedupe introduces no new privilege — the renderer still has no
filesystem access (Principle I).
