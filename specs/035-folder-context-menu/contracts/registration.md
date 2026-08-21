# Contract: OS Registration Surface

Date: 2026-08-21. What this feature writes to the operating system, and the guarantees removal makes. The renderer sees none of this; the app's IPC surface is unchanged (see archived spec 006 `contracts/os-open.md`, consumed as-is).

## Windows — registry verbs (NSIS + Scoop)

Written under `HKCU\Software\Classes` only, per user, no elevation:

| Key | Values |
|-----|--------|
| `<class>\shell\MarkdownMeister` | `(default)` = display label; `Icon` = exe path |
| `<class>\shell\MarkdownMeister\command` | `(default)` = `"<exe>" "%1"` |

- `<class>` for folders: `Directory`. Label: **Open in MarkdownMeister**.
- `<class>` for files: effective ProgID or `*` per existing 006 resolution. Label: **Open with MarkdownMeister** (unchanged).
- Every `<class>` written is recorded in `HKCU\Software\MarkdownMeister\OsOpenState` (value name = class name).

**Removal guarantee**: uninstall (or Scoop `pre_uninstall` → `open-with.ps1 -Action unregister`) deletes every verb key recorded at install plus the known legacy locations (`Directory`, `*`, bare extension keys from v0.1.0), then deletes the state key. After removal: no menu entry bearing the product name remains for folders or `.md`/`.markdown` files; other applications' entries and the user's defaults are untouched. Removal is idempotent and safe to run repeatedly.

## Linux — desktop entry

Files written (user scope, XDG):

```ini
[Desktop Entry]
Type=Application
Name=MarkdownMeister
Exec="<absolute path to AppImage>" %f
TryExec=<absolute path to AppImage>
MimeType=inode/directory;
```

plus `$XDG_DATA_HOME/icons/hicolor/256x256/apps/markdownmeister.png`.

**Guarantees**: association only — the entry never appears in `[Default Applications]` of any `mimeapps.list`; the app never invokes `xdg-mime default`. `--remove-folder-action` deletes both files and exits; it MUST NOT touch `mimeapps.list`. Rewriting after the AppImage moves replaces the stale Exec/TryExec paths.

## CLI flag (Linux/AppImage)

| Flag | Behaviour |
|------|-----------|
| `--remove-folder-action` | Remove the user-level desktop entry + icon, print a one-line outcome, exit 0. Unknown-state-safe: absent files are success, not error. |
| (no flag) | Normal launch; when running as an AppImage, ensure the entry exists and matches the current path (best-effort, silent). |

The flag is handled in the main process before window creation and must not require the single-instance lock.

## macOS

No registration surface outside the app bundle: the spec 006 `CFBundleDocumentTypes` folder declaration lives inside the bundle and disappears when the bundle is deleted. No cleanup obligations.
