# Contract: OS-Initiated Opens (spec 006)

**Branch**: `phase-030-file-association` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

Behaviour contract deltas this feature introduces on top of spec 004 (recent
opens), spec 008 (native dialogs / folder flow), spec 024 (same-tab vs new-tab),
and the spec 017 main context. Existing behaviour is unchanged unless a row says
so.

## 1. Preload surface (additions only)

| Method | Channel(s) | Direction | Payload |
|--------|-----------|-----------|---------|
| `onOsFileOpen(cb)` | `os:fileOpen` | main → renderer | `OpenedFile` |
| `onOsFolderOpen(cb)` | `os:folderOpen` | main → renderer | `WorkspaceInfo` |
| `onOsOpenFailed(cb)` | `os:openFailed` | main → renderer | `{ message: string }` |
| `notifyOsReady()` | `os:ready` | renderer → main | none |

All three subscriptions follow the existing `on*` pattern (wrap
`ipcRenderer.on`, return an unsubscribe). No generic `invoke` is added
(Principle I).

## 2. Main-side routing

| OS input | Platform | Validation (all in main, before any read) | Result → renderer |
|----------|----------|-------------------------------------------|-------------------|
| First-launch `argv` path | Windows | realpath, `stat`, file: extension ∈ {`.md`, `.markdown`} (case-insensitive); folder: is a directory | `os:fileOpen` / `os:folderOpen` |
| `second-instance` `argv` path | Windows | same as above | same |
| `open-file` event | macOS | same as above (folder arrives via the same event, research R4) | same |
| Anything else (nonexistent, unreadable, wrong type, unsupported extension) | both | rejected before touching disk | `os:openFailed` with a scrubbed message; session unchanged (FR-011) |

## 3. File opens

Route through the existing generic single-file open — exactly the File → Open
path (`session.openFileFromTree`):

- Workspace file → relative `path`; replace-clean-active-tab / new-tab / existing
  tab activation per spec 024 (generic behaviour, not the explorer preference).
- Detached file (no workspace, or outside it) → `path: null`; FR-007 dedupe via
  the new `canonicalPath` (research R8) so a repeated OS-open of the same file
  activates the existing tab instead of duplicating it.
- Successful opens record a Recent Item exactly like the File → Open dialog
  (existing `recordRecent` call in the dialog path — the OS host reuses
  `openFileFromPath` and the same recording).

## 4. Folder opens

Reuse the existing two-phase flow with the prepare step performed by main:

1. Main validates and writes `ctx.pendingFolderOpen` (via the workspace handler
   module's new `prepareFolderFromOsPath`).
2. Main sends `os:folderOpen` with the `WorkspaceInfo`.
3. Renderer `runPreparedFolderOpen(info)` runs the existing dirty-check →
   confirm (`folder-open` native box) → save-or-discard → `commitFolderOpen`
   flow. Cancellation → `cancelFolderOpen` (slot cleared, session unchanged).

Guarantees preserved (spec 004 FR-009/FR-010, Principle III): a cancelled or
failed folder OS-open leaves the current workspace and documents untouched; a
workspace with unsaved workspace-relative documents prompts before replacing.

## 5. Single-instance & session

- `requestSingleInstanceLock()` runs before `ready` (gated by
  `MM_SINGLE_INSTANCE !== '0'`, research R7); a secondary instance quits
  immediately after its `argv` has been forwarded to the primary via
  `second-instance` (FR-008).
- A `second-instance` while the primary is running focuses/restores the primary
  window before routing the path (FR-008).
- Only one selected item is processed per invocation (FR-014). A burst of OS
  opens is serialized: file opens drain in order; a folder open refuses a second
  pending folder with an in-context error (existing "folder open already in
  progress" rule).

## 6. Windows installer registration (FR-001/002/012/013/015)

- Install (`!macro customInstall` in `scripts/installer.nsh`): per-user verbs
  `Open with <product name>` for `.md`, `.markdown`, and `Directory`, each
  `command` = `"$INSTDIR\markdownmeister.exe" "%1"`, icon = the exe; preserves
  any pre-existing `(Default)` (research R5); marks each class key it created
  fresh in `HKCU\Software\MarkdownMeister\OsOpenState`.
- Uninstall (`!macro customUnInstall`): removes the three verb keys; deletes a
  created class key (state marker set at install) only when it now holds no
  remaining subkeys; clears the state key; then `SHChangeNotify`.
- Never writes the extension `(Default)` to a value it did not preserve; never
  registers a ProgID as the default; `fileAssociations` is NOT used on Windows
  (research R2). Result: the existing default handler is unchanged (FR-012).
- Product display name (FR-015): the label text derives from electron-builder's
  `${PRODUCT_NAME}` define (fallback: a local `!define` mirroring the same
  `productName` value).

## 7. macOS Finder registration (FR-003/004/012)

- Info.plist declares (via `mac.extendInfo.CFBundleDocumentTypes`):
  - `.md`/`.markdown` — `CFBundleTypeExtensions`, role `Viewer`,
    `LSHandlerRank: Alternate`;
  - `public.folder` — role `Viewer`, `LSHandlerRank: Alternate`.
- The app therefore appears in Finder's "Open With…" for files and folders but
  never becomes the default (research R3/R4). **UNVERIFIED on a Mac** — see
  `quickstart.md`.

## 8. Failure semantics

All OS-open failures fail closed (FR-011):

- Nothing is read, opened, or replaced on a rejected path.
- The renderer shows a quiet footer note (same surface as reveal failures);
  no modal unless a later data-loss decision needs one.
- Error messages are scrubbed of absolute paths (`sanitizeError` / `scrubAbsolutePaths`).
