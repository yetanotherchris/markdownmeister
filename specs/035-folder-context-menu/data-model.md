# Data Model: Folder Context Menu

Date: 2026-08-21. This feature adds registration metadata only — no application data entities, no persisted documents, no IPC payload changes. Entities below describe what exists on the user's machine or is derived at write time.

## FolderVerbRegistration (Windows)

One verb per class, per user. Written by `scripts/installer.nsh` and `scripts/open-with.ps1`.

| Field | Value / rule |
|-------|--------------|
| Class | `Directory` for folders; effective ProgID or `*` for files (existing 006 resolution logic, unchanged) |
| Verb key | Product name (`MarkdownMeister`) under `<class>\shell\` — unchanged from 006 so existing uninstall paths keep working |
| Display label | "Open in MarkdownMeister" for `Directory`; "Open with MarkdownMeister" for file classes (D5) |
| Icon | Absolute path to the installed executable |
| Command | `"<exe>" "%1"` — exactly one selected item (FR-013) |

Validation rules: written under HKCU only (FR-012); never under HKLM; never modifies the class's default value or any other application's keys.

## OsOpenState record (Windows)

The existing `HKCU\Software\MarkdownMeister\OsOpenState` key: one value per class that received a verb at install time. Uninstall enumerates it and deletes each recorded verb key, then itself. Rule: every class written MUST be recorded; uninstall MUST NOT delete classes absent from the record except the known legacy locations already cleaned today.

## DesktopEntry (Linux)

A user-level freedesktop desktop entry written when the app runs as an AppImage (D4).

| Field | Value / rule |
|-------|--------------|
| Path | `$XDG_DATA_HOME/applications/markdownmeister.desktop` (default `~/.local/share/applications/…`) |
| `Type` | `Application` |
| `Name` | Product display name (FR-011) |
| `Exec` | `"<absolute AppImage path>" %f` — `%f` guarantees a single plain path argument; path quoted because AppImage paths may contain spaces/non-Latin characters (edge cases in spec) |
| `TryExec` | Absolute AppImage path — makes launchers hide the entry automatically once the file is deleted |
| `MimeType` | `inode/directory;` — association only; MUST NOT appear as a `[Default Applications]` value anywhere |
| Icon file | `$XDG_DATA_HOME/icons/hicolor/256x256/apps/markdownmeister.png`, extracted from the AppImage at write time |

State transitions: `absent → present` on launch-as-AppImage (idempotent rewrite when the Exec path or version changes); `present → absent` via `--remove-folder-action`; deleting the AppImage leaves the file but launchers hide it (no dead visible entry). Writing MUST fail soft: an unwritable XDG dir logs a warning and never blocks startup.

## ExternalFolderPath (all platforms)

An untrusted folder path arriving from the OS. No new validation code — flows through the existing spec 006 pipeline (`classifyOsTarget` → `prepareFolderFromOsPath`). Restated here because FR-007 depends on it: classification happens in main before use; failures produce scrubbed errors and leave the session unchanged.
