# Data Model: Save an Opened File in Place

**Feature**: `069-save-opened-file` | **Date**: 2026-10-13

## 1. Document save target

Existing `DocumentState` fields. No new persisted record.

| Field | Meaning for this feature |
|-------|--------------------------|
| `path` | Workspace-relative path, or null when the file is not inside the open folder. Save uses this first. |
| `canonicalPath` | Real path main resolved when it opened the file, or the real path of a completed Save As. Save uses this when `path` is null and the caller did not force the location dialog. |
| `dirty` | Stays set when a save fails or the user cancels the location dialog. Clears only after a successful write of this document's current content. |

`path` must not hold an absolute path. A file outside the folder is `path: null` plus `canonicalPath`.

### Transitions

| Event | `path` | `canonicalPath` |
|-------|--------|-----------------|
| Open a file inside the folder | relative path | real path, when main supplied one |
| Open a file with no folder, or outside the folder | null | real path |
| Save in place | unchanged | unchanged |
| Save As to a file inside the folder | the new relative path | the chosen file's real path |
| Save As to a file outside the folder, or with no folder open | null (clears any previous relative path) | the chosen file's real path |
| Save As cancelled | unchanged | unchanged |
| Direct Save of a missing file | unchanged | unchanged |
| Never-saved document | null | absent until the first completed Save As |

## 2. Opened-path allowlist

Process-lifetime set on the main-process context. Not written to disk. Not visible to the renderer.

A real path enters the set only when:

- `openFileFromPath` has resolved it for an open the user or the operating system requested, or
- the save dialog has written a file the user chose, and that write succeeded.

A path leaves the set only when the process ends. Changing the open folder does not clear it, because an outside document can stay open across that change.

The set is not a general permission to write. `file:writeOpened` still requires the argument's current real path to be an existing file and to equal the allowlisted path. The bytes are written to the handle opened for that check.

## 3. Save result

`SAVE_SUCCESS` payload gains an explicit path that may be null, plus the canonical path and the file name when the write was an opened-file write or a save dialog.

| Payload field | Rule |
|---------------|------|
| `path` | Relative path, or null when the file is outside the folder. Null is stored. It must not fall back to the previous relative path. |
| `canonicalPath` | Present when the target has a real path. Replaces the document's previous canonical path. |
| `name` | File name of the target. Updates the document title when present. |

`SAVE_FAILED` is unchanged: it does not modify the document. The unsaved flag stays as it was.
