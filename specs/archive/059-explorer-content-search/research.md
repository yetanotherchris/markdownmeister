# Research: Explorer Content Search

**Feature**: specs/059-explorer-content-search | **Date**: 2026-09-05

## R1. The scan must run in the main process behind a named operation

**Decision**: Add a single named IPC operation `searchContents(term)` that returns the relative paths of markdown files whose contents contain the term, scanned in main from the validated workspace root.

**Evidence**: Constitution I forbids the renderer from reading the filesystem, so whole-workspace content matching cannot reuse the existing `readFile` flow (which requires the user to open each file). The preload surface is a fixed list of named operations; `searchContents` is one such operation with an explicit request (`{ term: string }`) and response (`Result<string[]>`), not a generic escape hatch.

**Alternatives rejected**: Searching only already-loaded files would defeat the feature's purpose (files in never-opened folders are the main win). A renderer-side `fetch`/worker is impossible under `sandbox: true` with no Node.

## R2. The scan stays inside the resolved root and never follows symlinks

**Decision**: Walk from the resolved workspace root with `readdirSync(..., { withFileTypes: true })`; descend only into real directories (`dirent.isDirectory()`), read only regular markdown files (`dirent.isFile()`), and read each via its in-walk absolute path. Symlinks (directory or file) are neither descended into nor read.

**Evidence**: `readDir` in `src/main/fs/read.ts` already excludes symlinks by the same Dirent test, so mirroring it keeps content search consistent with what the tree lists. A symlink pointing outside the root is skipped, so the scan cannot escape the workspace (Principle II). The term is validated as a bounded plain string (typeof string, length ≤ 200) and is never used as a path.

**Consequence**: The adversarial symlink case is a unit test (a symlink to a file outside the root must not be read, and the outside file's content must not match).

## R3. Content matches surface by loading ancestor folders and extending the predicate

**Decision**: The tree's `searchMatch` predicate returns true for a node when it is the entry being edited, when its id is in the content-match set, or when its name matches the term. Content-matched files in never-opened folders are made real nodes by loading their ancestor chain through the existing workspace lazy-load actions (`EXPAND_START`/`EXPAND_SUCCESS` via `readDir`), the same non-destructive expansion a user click performs.

**Evidence**: react-arborist's `get()` only resolves nodes in the visible list and only renders nodes that exist in the data, so a file that is not loaded cannot be shown no matter how the predicate reads. Loading ancestors is required to create the nodes. Loaded folders persist after clearing, exactly as a manual expansion would.

**Alternatives rejected**: Injecting ephemeral nodes into the workspace tree and removing them on clear would fight the reducer's ownership of `workspace.nodes`. A separate flat results list was rejected in spec 057 for the same reason (a second UI to keep in sync).

## R4. Debounce, stale responses, and silent skipping

**Decision**: The renderer debounces content searches (~250 ms after typing pauses), guards against stale responses with a sequence number, and treats empty/whitespace terms as "no content search". Main skips files over a 1 MB size cap and files that fail to read (permission, invalid UTF-8), silently.

**Evidence**: Scanning thousands of files per keystroke without debounce would block and feel broken (SC-002); a stale response from an earlier term would show wrong matches. A 1 MB cap keeps a single scan bounded for typical workspaces while comfortably covering the app's own large-document floor (~10k lines ≈ 300 KB); files the editor could not open anyway (invalid UTF-8) are not worth erroring on.

**Consequence**: The e2e "no perceptible lag" scenario types a term and asserts matches within a bounded wait; the renderer never blocks typing because the scan is debounced and runs in main.

## R5. Empty state waits for the content search to settle

**Decision**: The empty-state message shows only when there is no filename match, no content match, and the content search for the current term has completed (a settled flag). While the scan is in flight the tree renders (with any filename matches or blank), so a term that will match content does not flash "No files match".

**Evidence**: Without the settled flag, the first frame after typing would show the empty state before the debounced scan resolves, then flip to matches; that flash contradicts the calm-editing principle (IV).

## R6. Existing explorer-search e2e scenarios are adjusted, not weakened

**Decision**: The spec 057 FR-007 scenario (a never-opened folder's file is not found) changes meaning for content matches: filename matching still requires the entry to be loaded, but content matching now reaches never-opened folders. The scenario is reworded to search a word that appears in a filename but not in its content, and a new content-search scenario covers the never-opened folder.

**Evidence**: The existing fixture files' headings (e.g. "# Quarterly") contain the same words as their filenames, so several spec 057 e2e searches would now also match content and change the asserted tree state; the fixtures must distinguish name-only from content-only matches for the tests to remain meaningful.