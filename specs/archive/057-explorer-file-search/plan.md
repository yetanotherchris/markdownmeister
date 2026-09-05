# Implementation Plan: File Explorer Search

**Branch**: `spec-057-explorer-file-search` (per-spec implementation branch; all four specs of this batch are specified together on branch `specs-055-058-search-and-new-file`, PR #99) | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/057-explorer-file-search/spec.md`

## Summary

Add a search box to the file explorer that live-filters the tree to entries whose names contain the term, surfacing matches inside collapsed folders while keeping ancestor folders visible. Clearing the term restores the tree exactly. The tree library already ships filtering support (verified against the installed package's own type definitions), so the work is a labelled input, an explicit match predicate, open-state snapshot/restore, and an empty state. Renderer-only; no IPC changes.

## Technical Context

**Language/Version**: TypeScript (strict) on Electron, renderer process

**Primary Dependencies**: React; react-arborist 3.16.0 (installed; provides `searchTerm`/`searchMatch` tree filtering)

**Storage**: None. The term lives in component state and is never persisted.

**Testing**: Vitest (unit tests for the predicate and restore helpers) + Playwright e2e against the real built app

**Target Platform**: Windows/Linux/macOS desktop (renderer)

**Performance Goals**: Live filtering per keystroke with no perceptible lag at thousands of entries; the tree list is already virtualized

**Constraints**: Renderer-only; display-only filtering (the tree data and all file operations are unchanged); no new dependencies

**Scale/Scope**: One small pure helper module, input + wiring in the explorer, unit + e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Process Isolation**: Renderer-only; no IPC changes. PASS
- **II. Every Path Is Untrusted**: No new filesystem work; filtering operates only on entries already listed in the tree (FR-007). PASS
- **III. Never Lose The User's Words**: Filtering is display-only; no writes, no confirmations bypassed, no operations gated by the filter state. PASS
- **IV. Calm, Predictable Editing**: No dialogs or focus stealing; Escape has one defined meaning (clear and return focus); the virtualized list already handles large trees. PASS
- **V. Test What Can Corrupt Or Escape**: The failure modes are a filter that matches more than names (privacy of scope) and a restore that loses expansion/selection; both are covered by exact unit fixtures and e2e restore scenarios. PASS

## Project Structure

### Documentation (this feature)

```text
specs/057-explorer-file-search/
├── spec.md                 # WHAT and WHY (complete)
├── plan.md                 # This file
├── research.md             # Phase 0 output
└── checklists/
    └── requirements.md     # Specify-phase quality checklist
```

data-model.md, contracts/, and quickstart.md are not generated: no persisted entities, no IPC surface changes, no install/run flow beyond the existing app.

### Source Code (repository root)

```text
src/renderer/
├── explorer/
│   ├── Tree.tsx              # Render the search input row; pass searchTerm/searchMatch to the tree
│   └── explorerSearch.ts     # NEW: match predicate + open-state snapshot/restore helpers (pure)
└── App.tsx                   # Term state stays with the explorer container; no structural change
tests/
├── renderer/
│   └── explorerSearch.test.ts
└── e2e/
    └── explorer-search.spec.ts
```

**Structure Decision**: The predicate and the open-state snapshot/restore are pure functions so both are unit-testable without a mounted tree, matching the existing pattern of small pure modules beside their consumers (treeRename, treeMove, operations).

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
