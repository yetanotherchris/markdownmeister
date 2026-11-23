# Data Model: One Tab Per File

This model describes the values that decide whether two open requests name the same file. It is intentionally small: one existing payload field becomes a runtime guarantee, one pure comparison gains a fixed truth table, and one document field is cleared when a rename makes it stale.

## Identity-bearing values

| Name | Type | Produced by | Meaning | Used to access a file? |
|------|------|-------------|---------|------------------------|
| `path` | `string \| null` | Main, stored by the renderer | Workspace-relative POSIX path for a file inside the open folder, or null for a file outside the folder or an untitled document. | Yes. `file:read` and `file:write` take this value and validate it in main. |
| `canonicalPath` | `string \| undefined` | Main only | Absolute real path in the filesystem's on-disk spelling. This is the file identity. | No new access. The existing `file:writeOpened` operation still takes it for a file outside the folder, and main checks it against the opened-path allowlist. The identity feature never passes it to `file:read` or `file:write`. |
| `id` | `string` | Renderer | Tab and editor-instance key. It may be a path at open time or a generated `file-...` value. | No. It is never used for dedupe. |
| `title` | `string` | Renderer | Display name shown on the tab. | No. |
| `pendingReplacement` | `DocumentState \| undefined` | Renderer | A staged document for spec 024 replacement. It is not a visible tab. | No. The identity search covers visible `documents` only. |

No new persistent field is introduced. The identity is the existing `canonicalPath` value.

## Invariants

- **INV-1**: At most one visible document may represent a given file. A file-backed document is identified by `canonicalPath` when it is present.
- **INV-2**: When both documents have a non-empty `canonicalPath`, exact identity equality decides. Different identities are different files even when the `path` strings are equal.
- **INV-3**: When either document lacks an identity, the only fallback is exact `path` equality, and only when both paths are non-null.
- **INV-4**: A null `path` never matches a non-null `path`. Two null paths never match each other. Untitled documents are never deduped.
- **INV-5**: The renderer never derives an identity, never uses it as a `file:read` or `file:write` argument, and never displays it. Main produces it from the path it has already resolved and validated.
- **INV-6**: Activating an existing document changes its active state and, if needed, its view. A missing identity may be backfilled from the incoming payload, and a different incoming `path` replaces the stored `path` and `title` so the tab saves the file it represents under the current root. Activation does not change `content`, `baseline`, `editorBaseline`, `dirty`, `revision`, `cursorOffset`, `scrollTop`, or undo history.
- **INV-7**: `Save As` replaces `path`, `canonicalPath`, and `title` together on success. After that point the tab represents the chosen file, not the old file.
- **INV-8**: A plain save leaves `path` and `canonicalPath` unchanged. A failed save leaves the document dirty and its association unchanged.
- **INV-9**: An in-app rename or move that changes `path` clears `canonicalPath` because the old absolute path no longer names the file. The next open of the moved file supplies and backfills the current value.

## Route shapes before and after

| Route | Before this feature | After this feature | Identity available? |
|-------|---------------------|--------------------|---------------------|
| Explorer click (`file:read`) | `path: "a.md"`, no `canonicalPath`. | `path: "a.md"`, `canonicalPath` is the absolute on-disk real path. | Yes. This is the main F1 gap. |
| Open File, file inside the open folder | `path: "a.md"`, `canonicalPath` absolute. | Unchanged. | Yes. |
| Open File, file outside the open folder | `path: null`, `canonicalPath` absolute. | Unchanged. | Yes. |
| Operating-system open | `path` relative when inside the folder, null when outside; `canonicalPath` absolute. | Unchanged. | Yes. |
| Recent Items file | Same as Open File through `openFileFromPath`. | Unchanged. | Yes. |
| Save As | `path` relative or null, `canonicalPath` absolute for the chosen file. | Unchanged; the document stores the new identity on `SAVE_SUCCESS`. | Yes. |
| Source view or tree context menu | `file:read` result had no identity for an in-folder file. | The requested path is read first, so the result carries identity. | Yes. |
| Untitled document | `path: null`, no `canonicalPath`. | Unchanged. | No, deliberately. |

The important asymmetry that caused F1 is gone: an explorer read and an outside-folder open of the same file now both carry the same absolute identity, even though one has a relative path and the other has `path: null`.

## State transitions

| Event | `path` | `canonicalPath` | Tab behaviour |
|-------|--------|-----------------|---------------|
| Open a file that is not open | Set from the payload. | Set from the payload. | Add a new tab, or stage a spec 024 replacement when the active tab is clean and the route is not an explicit new-tab open. |
| Open a file that is already open by identity | Rebound to the incoming route when it differs, including to null; otherwise unchanged. | Backfilled only if the existing value is missing and the incoming value is present. | Activate the existing tab. Do not create or stage a second document. Do not change content or dirty state. Title follows the incoming route when the path changes. |
| Open a file with the same relative path but a different identity | Set from the payload on the new document. | Set from the payload. | Treat it as a different file. Add a new tab or stage a replacement according to spec 024. Never activate the document with the other identity. |
| Plain save succeeds | Unchanged. | Unchanged. | Clear dirty, update the baseline, keep the same file association. |
| Save As succeeds | Replace with the chosen relative path, or null when outside the folder. | Replace with the chosen file's absolute identity. | The tab now represents the chosen file. The old file is no longer represented by this tab. Title follows the chosen file. |
| Save fails | Unchanged. | Unchanged. | The document stays dirty and keeps its association. |
| In-app rename or move | Rewritten to the new relative path. | Cleared until the next open. | Content, dirty state, id, and undo history stay. The next open of the moved file matches by the rewritten path and backfills the identity. |
| Folder switch | Unchanged at switch time. | Unchanged at switch time. | Tabs are not closed or rebound by the switch. The next open of the same file under the new root rebinds its `path` and `title` (FR-009). The remaining F2 tab lifecycle is out of scope. |
| External change or delete | Unchanged. | Unchanged. | Out of scope. Routing stays by workspace-relative path. The F4 recreate-on-save problem remains. |
| Close a tab | Removed. | Removed. | No other document is affected. |
| Quit | Removed with the session. | Removed with the session. | Existing dirty-tab confirmation is unchanged. |

## Dedupe truth table

The comparison is evaluated in the order shown.

| Existing `path` | Existing identity | Incoming `path` | Incoming identity | Same file? | Reason |
|-----------------|-------------------|-----------------|-------------------|------------|--------|
| `null` | `C:\notes\a.md` | `a.md` | `C:\notes\a.md` | Yes | Both identities match. This is F1. |
| `a.md` | `C:\notes\dir\a.md` | `dir/a.md` | `C:\notes\dir\a.md` | Yes | Both identities match after the workspace root changed. The tab rebinds to `dir/a.md`. |
| `null` | `C:\notes\a.md` | `a.md` | `C:\notes\A.md` | Same only if main reports the same on-disk spelling | On a case-insensitive filesystem native realpath makes the identities equal; on a case-sensitive filesystem they are different files. |
| `a.md` | `C:\dir\a.md` | `a.md` | `C:\dir2\a.md` | No | Different identities. This is the H8 boundary. |
| `a.md` | `C:\dir\a.md` | `a.md` | missing | Yes by fallback | Exact path equality, identity missing on one side. |
| `null` | `C:\notes\a.md` | `a.md` | missing | No | Null path never matches a relative path. |
| `null` | missing | `null` | missing | No | Two untitled or unresolved documents are distinct. |
| `a.md` | missing | `a.md` | missing | Yes by fallback | Pre-feature path behaviour for documents with no identity. |

## Spec 024 interaction

The identity check runs before spec 024 replacement logic. If a file is already open, its tab is activated and the active clean tab is not replaced. If the file is not open, the existing rule still decides whether a clean active tab is replaced or a new tab is created. This preserves spec 024's FR-001, FR-002, FR-003, FR-004, FR-008, and FR-009 unchanged.

A staged `pendingReplacement` is not a visible tab and is not searched. Opening the same file again while it is staged either supersedes the staged document or leaves the existing staging rules in charge; it does not create a second visible tab. The identity invariant is over the `documents` list.
