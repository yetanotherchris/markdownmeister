# Contract: Save an Opened File (`file:writeOpened`)

One fixed named operation (Principle I). Workspace-relative saves stay on `file:write`. The location dialog stays on `file:saveDialog`.

## IPC

| Field | Request | Response |
|-------|---------|----------|
| Channel | `file:writeOpened` | `Result<WriteReceipt>` |
| Request | `{ canonicalPath: string, content: string }` | `Result<WriteReceipt>` |
| Preload | `writeOpenedFile(canonicalPath: string, content: string): Promise<Result<WriteReceipt>>` | `Promise<Result<WriteReceipt>>` |

`WriteReceipt` is the existing `{ mtimeMs, size }`.

### Validation (all in main, before any write)

1. The caller is the authorized renderer. Otherwise `IO` / `Unauthorized renderer`.
2. The argument has `canonicalPath` and `content`, both strings.
3. Resolve `canonicalPath` with the same real-path helper used at open time (`realpath`, falling back to a resolved path only when the path does not exist).
4. Reject unless that real path is in the opened-path allowlist. The rejection is `OUTSIDE_WORKSPACE` for a path that was never opened or chosen, including `..`, a different absolute path, a UNC path, a device name, and a symlink whose current real path is not the allowlisted path.
5. The real path must be an existing file. A missing path returns `NOT_FOUND` and does not create a file. A directory returns `IO`.
6. Error messages go through `sanitizeError` so absolute paths are scrubbed.

### Write (after validation)

Open the allowlisted real path and write that file descriptor. Do not write the path again by name. Before the bytes change, `realpath` must still be the allowlisted path and the directory entry must be the same file as the handle. Map errno the same way `writeFile` does: `EBUSY`, `EPERM`, and `EACCES` become `LOCKED` with the existing locked-file message. `ENOSPC` and other write failures become `IO`. A thrown write restores the previous bytes. A crash during the handle write can leave a mixture of old and new bytes; it must not be aimed at a path that was substituted for the opened file.

On success, return `ok({ mtimeMs, size })`. Do not change the open folder.

## Save dialog addition

`file:saveDialog` stays the location dialog. On a successful write it also:

- resolves the chosen file's real path
- adds that real path to the allowlist
- returns it as `OpenedFile.canonicalPath`
- returns `OpenedFile.path` as the workspace-relative path, or null when the chosen file is outside the folder

Cancelling still returns `ok(null)` and allowlists nothing.

## Renderer save decision

`saveDocument` / `saveDocumentNow`:

| Condition | Call | On failure |
|-----------|------|------------|
| `doc.path` is set and the caller did not force the dialog | `writeFile(doc.path, content)` | `failed`, `SAVE_FAILED`, no dialog |
| `doc.path` is null, `doc.canonicalPath` is set, and the caller did not force the dialog | `writeOpenedFile(doc.canonicalPath, content)` | `failed`, `SAVE_FAILED`, no dialog |
| otherwise (never saved, or the caller forced the dialog) | `saveFileDialog` | `cancelled` when the user cancels. No file is created |

Forced callers remain Save As and the removed-file "save a copy" choice. Close and quit Save are not forced, so an opened file writes in place.

A successful opened-file write or save dialog dispatches `SAVE_SUCCESS` with the path rule in `data-model.md`: null path clears a previous relative path, and `canonicalPath` becomes the written file.
