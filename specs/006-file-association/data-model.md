# Data Model: File Association (spec 006)

**Branch**: `phase-030-file-association` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

This feature adds no persisted data. Its "model" is the shapes that cross the
main↔renderer boundary for OS-initiated opens, plus the small set of in-process
state that makes them work. All types live in `src/shared/ipc-contract.ts`.

## 1. `OpenedFile.canonicalPath` (new optional field)

```ts
export interface OpenedFile {
  path: string | null        // workspace-relative, or null for a detached file
  name: string
  content: string
  mtimeMs: number
  size: number
  /** Spec 006 (research R8): the realpath of the file, populated by
   *  `openFileFromPath` for every open (dialog, recent, OS). Gives detached
   *  files a stable identity so FR-007 ("activate the existing tab, never
   *  duplicate") holds outside the workspace too. Never fed back into any
   *  filesystem call by the renderer. */
  canonicalPath?: string
}
```

Renderer counterpart — `DocumentState.canonicalPath?: string`, set by `openFile`
from the same field, and used by `handleOpenExisting` for dedupe:

```
existing = docs.find(d =>
  (d.path === value.path && value.path !== null) ||
  (d.canonicalPath !== undefined && value.canonicalPath !== undefined &&
   d.canonicalPath === value.canonicalPath)
)
```

## 2. OS-open request shapes (main → renderer events)

A discriminated union of what the OS asked the app to open, after main has
validated it. Only validated, read-ready data crosses the boundary — never a
raw path the renderer could act on (Principle I).

```ts
export type OsOpenRequest =
  | { kind: 'file'; file: OpenedFile }              // channel 'os:fileOpen'
  | { kind: 'folder'; info: WorkspaceInfo }         // channel 'os:folderOpen'
  | { kind: 'failed'; message: string }             // channel 'os:openFailed'
```

- **file**: the existing `OpenedFile` (same shape File → Open and Recent Items
  already deliver). The renderer routes it through `session.openFileFromTree`.
- **folder**: the existing `WorkspaceInfo` (same shape `prepareFolderOpen`
  returns). The renderer runs the confirm→commit half of the folder flow.
- **failed**: a scrubbed, user-facing message; the renderer shows a footer note.
  No path components, no error codes — it is a display string only (Principle II).

## 3. In-process state (main)

| State | Home | Lifecycle | Purpose |
|-------|------|-----------|---------|
| `pendingFolderOpen` | moved from `registerWorkspaceHandlers` closure into `ctx` (spec 017 shared context) | prepared → committed / cancelled / failed | The prepared-but-unconfirmed folder open. Now written by both the `workspace:prepareFolderOpen` handler *and* the OS-open host. Single slot: a second prepare while one is pending is refused (existing rule). |
| `osOpenQueue` | module scope of `osOpenHost.ts` | drained when the renderer signals `os:ready`; emptied on drain | One-shot validated OS requests that arrived before the window/renderer was ready (e.g. first-launch `argv`, pre-ready `open-file`). |
| `osOpenBusy` | module scope of `osOpenHost.ts` | set while a folder confirm is in flight | Serializes a burst of OS opens (FR-014: one selected item per invocation); later requests drain after the in-flight flow resolves. |

## 4. Installer state (Windows registry, uninstall cleanup)

`HKCU\Software\MarkdownMeister\OsOpenState` holds one DWORD per class key the
installer created fresh (`mdCreated`, `markdownCreated`), so uninstall deletes
whole keys it created but never touches keys that pre-existed (or gained other
content). This is written and read only by the NSIS `customInstall` /
`customUnInstall` macros — it is not app state.

## 5. No changes to

Settings, Recent Items, window state, spellcheck dictionaries, or any persisted
config. OS-open handling is stateless across runs.
