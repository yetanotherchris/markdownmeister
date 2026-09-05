# Implementation Plan: Explorer Search Results

**Branch**: `spec-057-explorer-file-search` (additive spec 060 on the same branch, per request) | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/060-explorer-search-results/spec.md`

## Summary

Replace the in-place tree filtering (specs 057/059) with a VS Code-style results view shown in place of the tree while a term is active. The main-process content scan returns, per matching file, the occurrence count and the distinct matching lines; the renderer merges these with name matches from the loaded tree data and renders a report: a summary line, collapsible per-file sections (icon, name, directory path, chevron, circular badge), and snippet lines with the term highlighted and long lines truncated with ellipses. Clicking a result opens the file. Clearing the term returns the untouched tree, so spec 057's snapshot/restore and ancestor-loading machinery are removed, and the tree is never modified during a search.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron

**Primary Dependencies**: None new. The results view is plain React; highlighting uses a term-escaped regex; truncation is a pure helper.

**Storage**: None. Results live in component state keyed to the active term; the main-process content cache (spec 059) is retained.

**Testing**: Vitest (scan result unit tests + pure helpers) + Playwright e2e (a new results suite, with the 057/059 suites reworked to the new presentation).

**Target Platform**: Windows/Linux/macOS desktop (main + renderer)

**Performance Goals**: Debounced scan; the results view renders thousands of matches via a plain (virtualized-not-required) list of sections; typing never blocks.

**Constraints**: Renderer-only state; the fixed named IPC operation now returns richer results; the scan stays root-bounded and never follows symlinks; search is read-only.

**Scale/Scope**: A main-side result-shape change, a results-view component, a merged-results hook, and removal of the now-unneeded tree-filter wiring, with unit + e2e rework.

## Constitution Check

- **I. Process Isolation**: The scan stays in main behind the fixed `workspace:searchContents` operation; the renderer receives per-file result data, never file contents wholesale beyond snippet lines. PASS
- **II. Every Path Is Untrusted**: The scan is unchanged from spec 059 (root-bounded, no symlinks); snippet paths are workspace-relative and only used to open files through the existing validated read flow. PASS
- **III. Never Lose The User's Words**: Search stays read-only; opening a result routes through the existing open flow; the tree is never modified during search, so nothing to restore. PASS
- **IV. Calm, Predictable Editing**: Debounced scan, settle-aware empty state, expanded-by-default sections, no dialogs or focus stealing; Escape clears and refocuses the tree. PASS
- **V. Test What Can Corrupt Or Escape**: The scan's symlink containment and read-only guarantees keep their adversarial tests; the badge-count correctness (SC-005) is pinned by unit tests comparing counts to a hand-counted fixture. PASS

## Project Structure

### Documentation (this feature)

```text
specs/060-explorer-search-results/
├── spec.md                 # WHAT and WHY
├── plan.md                 # This file
├── research.md             # Key decisions
├── tasks.md                # Ordered work items
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

### Source Code (repository root)

```text
src/main/fs/search.ts                # return SearchContentResult[] (count + matching lines)
src/shared/ipc-contract.ts           # SearchContentResult type
src/renderer/explorer/searchResults.ts   # NEW: pure helpers (name matches, merge, truncate, summary)
src/renderer/explorer/SearchResults.tsx  # NEW: the results view component
src/renderer/hooks/useSearchResults.ts   # NEW: debounced hook returning merged results
src/renderer/explorer/Tree.tsx       # render the results view while a term is active
src/renderer/App.tsx                 # wire the new hook; drop the content-match props
tests/main/search.test.ts            # update for count/lines
tests/renderer/searchResults.test.ts # NEW: helper unit tests
tests/e2e/explorer-search-results.spec.ts  # NEW e2e suite
tests/e2e/explorer-search.spec.ts    # rework to the results presentation
tests/e2e/explorer-content-search.spec.ts  # rework to the results presentation
```

**Structure Decision**: Pure snippet/merge/count helpers live beside the results view (matching the `explorerSearch.ts` pattern) so they are unit-testable without a mount; the hook owns debounce, the stale guard, and merging.

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |