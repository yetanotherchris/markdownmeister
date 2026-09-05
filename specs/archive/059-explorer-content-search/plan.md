# Implementation Plan: Explorer Content Search

**Branch**: `spec-057-explorer-file-search` (additive spec 059 implemented on the same branch, per request) | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/059-explorer-content-search/spec.md`

## Summary

Extend the explorer search box so that, in addition to filtering by file name, it also surfaces markdown files whose contents contain the term. The renderer cannot read files (constitution I), so a new named IPC operation runs the scan in the main process from the validated workspace root. When the term changes (debounced), the renderer asks main for content-matching relative paths, loads the ancestor folders of those paths into the tree data so the nodes exist, and extends the tree's match predicate to include them. Filename search behaviour is unchanged; content matches appear alongside. Read-only, never persisted.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron

**Primary Dependencies**: None new. Reuses the existing fs read helpers (`isMarkdown`), the workspace lazy-load reducer actions, and react-arborist's `searchMatch`/`searchTerm` props.

**Storage**: None. The content-match set lives in component state, keyed to the active term, and is dropped on term clear, workspace change, or restart.

**Testing**: Vitest (main-process scan unit tests + renderer helper tests) + Playwright e2e against the real built app.

**Target Platform**: Windows/Linux/macOS desktop (main + renderer)

**Performance Goals**: Debounced scan (~250 ms); single recursive walk per search; files over a size cap (1 MB) skipped; the renderer never blocks typing.

**Constraints**: Renderer-only state; the new IPC is a fixed named operation (no generic escape hatch); the scan stays inside the validated workspace root and never follows symlinks; search is read-only.

**Scale/Scope**: One main-process scan module + one IPC handler + one renderer hook, a predicate extension in the tree, and unit + e2e tests.

## Constitution Check

- **I. Process Isolation**: The scan runs in main; the renderer only receives relative paths through a fixed named operation. PASS
- **II. Every Path Is Untrusted**: The scan walks from the resolved workspace root using `Dirent`s, descends only into real directories, reads only regular markdown files, and never follows symlinks, so no path can escape the root. The term is validated as a bounded plain string and is never used as a path. PASS
- **III. Never Lose The User's Words**: Search is strictly read-only; it never gates or rewrites save, delete, or rename, and loading ancestor folders is the same non-destructive expansion the user triggers by clicking. PASS
- **IV. Calm, Predictable Editing**: Debounced scan with a stale-response guard; oversized/unreadable files skipped silently; no dialogs or focus stealing; the existing empty state and Escape behaviour are preserved. PASS
- **V. Test What Can Corrupt Or Escape**: The escape vector is a symlink pointing outside the root, pinned by an adversarial unit test; the read-only guarantee is pinned by an e2e that compares file bytes before and after a search. PASS

## Project Structure

### Documentation (this feature)

```text
specs/059-explorer-content-search/
├── spec.md                 # WHAT and WHY
├── plan.md                 # This file
├── research.md             # Key decisions
├── tasks.md                # Ordered work items
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

### Source Code (repository root)

```text
src/main/fs/search.ts               # NEW: recursive content scan (pure, root-bounded)
src/main/ipc/handlers/search.ts     # NEW: 'workspace:searchContents' handler + term validation
src/shared/ipc-contract.ts          # searchContents named operation + result type
src/preload/index.ts                # expose searchContents
src/main/ipc/register.ts            # register the handler
src/renderer/hooks/useContentSearch.ts  # NEW: debounce, stale guard, ancestor loading
src/renderer/explorer/contentSearch.ts  # NEW: pure helpers (content-match ids, ancestor dirs)
src/renderer/App.tsx                # wire the hook; pass content-match state to the tree
src/renderer/explorer/Tree.tsx      # extend searchMatch + empty-state to include content matches
tests/main/search.test.ts           # scan unit tests (incl. symlink escape)
tests/renderer/contentSearch.test.ts# helper unit tests
tests/e2e/explorer-content-search.spec.ts # NEW e2e suite
tests/e2e/explorer-search.spec.ts   # adjust the FR-007 scenario for content-search semantics
```

**Structure Decision**: The scan is a small pure main-side module beside the existing `fs/read.ts`; the renderer helpers are pure functions beside the tree, matching the pattern of `explorerSearch.ts`. The hook owns the debounce, the stale-response guard, and the ancestor loading because those are stateful.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |