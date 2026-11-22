# Renderer Contracts: One Tab Per File

This document describes the renderer-facing change for spec 073. The preload API remains a fixed list of named operations. No channel, operation, or generic `invoke(channel, ...args)` escape hatch is added. The renderer still has no Node.js or filesystem access.

## Surface summary

| Surface | Change |
|---------|--------|
| `file:read` | The successful `OpenedFile` now includes `canonicalPath`, the file's absolute real identity. |
| `file:openDialog` | No shape change. It already returns the identity through `openFileFromPath`. |
| `recent:openFile` | No shape change. It already returns the identity through `openFileFromPath`. |
| `file:saveDialog` | No shape change. It already returns the identity for the chosen file. |
| `os:fileOpen` | No shape change. It carries the `OpenedFile` produced by `openFileFromPath`. |
| `file:write` and `file:writeOpened` | No change. The renderer still writes through the existing named operations and main still validates the path. |
| `entry:move` | No shape change. The renderer clears a moved document's identity because the old absolute path is stale. |
| Preload method list | No change. `readFile(relativePath)` keeps the same signature and return type. |

## `OpenedFile`

| Field | Type | Required in the type? | Runtime guarantee |
|-------|------|-----------------------|-------------------|
| `path` | `string \| null` | Yes | Workspace-relative POSIX path when the file is inside the open folder; null when it is outside or when the document is untitled. |
| `name` | `string` | Yes | Display name. |
| `content` | `string` | Yes | UTF-8 file content. |
| `mtimeMs` | `number` | Yes | File modification time at read time. |
| `size` | `number` | Yes | File size at read time. |
| `canonicalPath` | `string \| undefined` | No | Every successful main-process handler that returns a file supplies the absolute real path in the filesystem's on-disk spelling. The field stays optional because a document can lack an identity after an in-app move or when a path cannot be resolved, and because untitled documents are not files. |

The identity is a comparison value and must not be shown to the user. It is not a new access token. The renderer must not pass it to `file:read` or `file:write`, which take workspace-relative paths. The existing `file:writeOpened` operation continues to accept it for a file outside the folder, and main continues to reject any value that is not in its opened-path allowlist.

## `file:read`

Request, unchanged:

```json
{ "path": "notes/a.md" }
```

Successful response, after this feature:

```json
{
  "ok": true,
  "value": {
    "path": "notes/a.md",
    "name": "a.md",
    "content": "# A\n\nalpha\n",
    "mtimeMs": 1763769600000,
    "size": 14,
    "canonicalPath": "C:\\Users\\chris\\Notes\\notes\\a.md"
  }
}
```

A POSIX example:

```json
{
  "ok": true,
  "value": {
    "path": "notes/a.md",
    "name": "a.md",
    "content": "# A\n\nalpha\n",
    "mtimeMs": 1763769600000,
    "size": 14,
    "canonicalPath": "/home/chris/Notes/notes/a.md"
  }
}
```

Error response, unchanged:

```json
{
  "ok": false,
  "code": "OUTSIDE_WORKSPACE",
  "message": "Path escapes workspace"
}
```

The error path does not include `canonicalPath`. Containment is still checked in main before the file is read. `sanitizeError` still scrubs absolute paths from renderer-visible error messages.

## Identity comparison contract

The renderer uses one comparison, `sameFile`, with this order:

1. If both documents have a non-empty `canonicalPath`, compare those strings exactly. Equal means the same file. Different means different files, even when `path` strings are equal.
2. Otherwise, if either `path` is null, return false.
3. Otherwise, compare the two `path` strings exactly.

The comparison performs no case folding, no basename comparison, and no folder-relative guessing. An empty `canonicalPath` is treated as missing.

### Examples

| Existing document | Incoming open | Same tab? | Why |
|-------------------|---------------|-----------|-----|
| `path: null`, identity `C:\Notes\dir\a.md` | `path: "a.md"`, identity `C:\Notes\dir\a.md` | Yes | Both identities match. This is F1. |
| `path: "a.md"`, identity `C:\Notes\dir\a.md` | `path: "a.md"`, identity `C:\Notes\dir2\a.md` | No | Different identities. This is the H8 boundary and the FR-004 guard. |
| `path: "a.md"`, identity `C:\Notes\dir\a.md` | `path: "a.md"`, identity missing | Yes | Fallback to exact path equality because one identity is missing. |
| `path: null`, identity `C:\Notes\dir\a.md` | `path: "a.md"`, identity missing | No | A null path never matches a relative path. |
| `path: null`, identity missing | `path: null`, identity missing | No | Two untitled or unresolved documents are distinct. |
| `path: "a.md"`, identity `C:\Notes\dir\a.md` | `path: "A.md"`, identity `C:\Notes\dir\a.md` | Yes | The filesystem reported the same identity. On a case-sensitive filesystem main would report different identities and the answer would be no. |

## Open payloads

The `OPEN_EXISTING` payload shape is unchanged:

| Field | Type | Meaning |
|-------|------|---------|
| `value` | `OpenedFile & { view?: "formatted" \| "source" }` | The file read result plus an optional initial view. |
| `mode` | `"replace" \| "new"` or omitted | Spec 024 replacement intent. It is ignored when the identity matches an existing document. |

Every open route produces this payload through the same path: menu Open File, recent items, operating-system open, explorer click, search result, new-tab action, created-file open, and the source-view context menu. No route adds a second identity field or a second dedupe rule.

The reducer treats an identity match as an activation. It does not change the existing document's content, baseline, dirty flag, revision, cursor, scroll, or undo history. If the existing document has no identity and the incoming payload has one, the reducer stores the incoming identity. It does not adopt the incoming `path`.

## Save As

The `file:saveDialog` response is unchanged in shape and now confirms the identity contract: a successful save returns the chosen file's `path`, `name`, `content`, `mtimeMs`, `size`, and `canonicalPath`. The renderer dispatches `SAVE_SUCCESS` with that identity.

After Save As:

- The tab's `canonicalPath` is the chosen file's identity.
- The tab's `path` is the chosen file's workspace-relative path, or null when the chosen file is outside the open folder.
- The tab's title follows the chosen file's name.
- Opening the chosen file activates this tab.
- Opening the old file is an ordinary open of a different file. It creates a new tab or replaces a clean active tab according to spec 024.

Save As onto a file that is already open in another tab is not merged. The feature records that limitation because merging is a Save As policy change outside the specification's scope.

## Rename and move

There is no new IPC request or response for rename or move. The existing `entry:move` operation returns the moved entry, and `REROUTE_PATHS` rewrites the open document's `path`. Because the document's old absolute identity no longer names the file, `REROUTE_PATHS` clears `canonicalPath`. The next `file:read` of the moved file supplies the new identity, and the reducer backfills it when it activates the existing tab.

## Security and process-isolation notes

- The identity is data, not an access path. It is produced from the path main already resolved and validated for containment.
- `file:read` and `file:write` keep their workspace-relative request shapes. An absolute identity cannot be sent to either operation without failing main's validation.
- `file:writeOpened` keeps its existing allowlist check in `ctx.openedPaths`. This feature does not add any value to that allowlist for explorer reads and does not widen the operation.
- The preload API remains the fixed list in `src/preload/index.ts`. There is no generic `invoke`, no raw `fs`, and no path-to-anything reader.
- No absolute path from the identity is added to an error message. Error sanitisation and workspace-root redaction are unchanged.
- The renderer does not display the identity. Tabs keep their current titles and dirty and warning markers.
