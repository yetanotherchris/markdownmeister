# Research: Save an Opened File in Place

**Feature**: `069-save-opened-file` | **Date**: 2026-10-13

## R1. Why Save opens the location dialog

**Decision**: Treat a missing workspace-relative path as the bug, not the shortcut or the menu label.

**Rationale**: `saveDocumentNow` in `src/renderer/hooks/useDocumentSession.ts` writes with `writeFile` only when `doc.path` is set and the caller did not force the dialog. Otherwise it calls `saveFileDialog`, which is `dialog.showSaveDialog`. `openFileFromPath` in `src/main/ipc/handlers/context.ts` returns `path: null` and sets `canonicalPath` to the real path when no folder is open or the file is outside the folder. The same function serves Open File, recent files, and operating-system opens.

The click-through on 13 October 2026 matched that split. With no folder, Open File then Save called `showSaveDialog` with `defaultPath` equal to the file name only, and the file on disk was unchanged. The same happened for Ctrl+S after an edit, and for Open File of a file outside an open folder. A file opened from the explorer, and Open File of a file inside the open folder, saved with zero save dialogs and the edit reached disk. A never-saved document still showed the dialog.

`matchShortcut` maps unmodified Ctrl/Cmd+S to `save` and Ctrl/Cmd+Shift+S to `save-as`. The hamburger Save item sends `save`. Both commands reach the same dialog because the document has no relative path.

**Alternatives considered**: Remapping the shortcut. Rejected because the menu command has the same result, and files inside the folder already save correctly with that shortcut.

## R2. How to write the opened file without trusting a renderer path

**Decision**: Add one named operation, `file:writeOpened` / `writeOpenedFile(canonicalPath, content)`. Main keeps a process-lifetime set of real paths. `openFileFromPath` adds the real path it just resolved. The save dialog adds the real path of a file the user chose, after that write succeeds. The handler realpath-resolves the argument and writes only when the result is in the set, is an existing file, and is the same path that was allowlisted. The write uses `atomicWrite` and the errno mapping in `writeFile`.

**Rationale**: Principle I requires a fixed named operation. Principle II says a renderer-supplied path is untrusted. The allowlist is filled only by main, from an open it performed or a dialog the user confirmed. `scrubAbsolutePaths` already strips absolute paths from errors, and `sanitizeError` must be used on this channel too.

**Alternatives considered**:

- Pass the absolute path through `file:write`. Rejected. That handler requires a workspace and `resolveWithinRoot`. Relaxing either check would let a renderer path escape the folder.
- On Open File, make the file's parent the open folder so the existing relative write works. Rejected. It changes the open folder, including replacing a folder the user already opened, which FR-010 forbids.
- Keep the location dialog for files outside the folder. Rejected. That is the reported bug, and it also fails spec 001's rule that Save writes the original file.

## R3. What the document remembers after Save and Save As

**Decision**: Keep `path` workspace-relative or null. Keep the real path in `canonicalPath`. Save uses `canonicalPath` only when `path` is absent and the caller did not force the dialog (`save-as`, and the removed-file copy choice, pass force). On success, `SAVE_SUCCESS` stores the returned relative path, using null when the file is outside the folder, and stores the returned canonical path. The reducer must apply a null path rather than keeping the previous path with `path || previous`.

**Rationale**: Explorer and containment code treat `path` as workspace-relative. An absolute path in that field would look like a relative path and fail containment or select the wrong tree row. The current reducer expression `path || d.path` also drops an empty save-dialog path and keeps the old relative path, so Save As to a file outside the folder does not retarget the document. The next ordinary Save would write the old file. FR-005 requires the chosen file to become the save target.

**Alternatives considered**: Store the absolute path in `path`. Rejected because the rest of the session assumes a workspace-relative path there.

## R4. A removed file is not recreated by Save

**Decision**: `file:writeOpened` opens the allowlisted real path and treats a missing path as `NOT_FOUND`. It does not create a directory entry. The renderer treats that as a failed save and does not open the dialog. The removed-file confirmation still calls `saveDocument(doc, true)`, which forces the dialog.

**Rationale**: A rename onto a missing path would create a file, which FR-009 forbids. Opening the existing file fails when it is already gone, and writing that handle does not create a new name if the entry disappears afterwards. The required behaviour is that a file which is already gone at the start of Save is not created.

**Alternatives considered**: Let the write recreate the file. Rejected by FR-009. Opening the location dialog automatically on `NOT_FOUND` is also rejected. The removed-file confirmation is the existing way to choose a new location.

## R5. Failure stays on the failed-save path

**Decision**: A failed `writeOpenedFile` returns `failed`, dispatches `SAVE_FAILED`, and does not call `saveFileDialog`. Error text uses the existing sanitize path. No new error toast is added. Close and quit already report a failed save in their confirmation.

**Rationale**: FR-008 says the failure is surfaced the same way a failed in-folder save is surfaced. Menu and shortcut Save of an in-folder file already leave the document unsaved without a new dialog. Falling through to the location dialog would hide the failure and could write a different file.

**Alternatives considered**: Show a new modal for this channel only. Rejected because it would make outside files louder than inside files, and the spec says not to add a new presentation.

## R6. The opened-file write uses the handle it checked

**Decision**: `writeOpenedFile` opens the allowlisted real path and writes that file descriptor. It writes only when `realpath` of the path is still that allowlisted path and the directory entry's identity (`dev` and `ino`) is the opened handle. A missing file is still `NOT_FOUND`. A directory is still `IO`. The bytes are written at the start of the handle and the handle is then truncated to the new length, then `fsync`'d. If that write throws, the previous bytes are written back.

**Rationale**: Resolving the path and later calling `atomicWrite` on the path opens a window where a parent directory can be replaced with a junction or the directory entry can be swapped. The rename would then follow the new name. Constitution II requires the check and the write to use the same handle. An open handle stays on the file that was checked: replacing the directory entry, or on platforms that allow it the parent directory, does not retarget the descriptor. Holding the handle also prevents replacing it with `rename` on Windows (`EPERM`), so a temp-file rename cannot be the write on that platform. Workspace saves stay on `atomicWrite`. The save dialog does too, because that write is the user's chosen path and it is not an allowlisted reopen.

**Alternatives considered**: Re-checking the real path immediately before `rename`. Rejected. The check and the rename would still be two path lookups. Writing through `/proc/self/fd` on Linux only. Rejected. Windows and macOS cannot express that directory-relative rename in Node, and the final directory entry could still be swapped inside the pinned directory.
