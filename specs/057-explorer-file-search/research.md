# Research: File Explorer Search

**Feature**: specs/057-explorer-file-search | **Date**: 2026-09-02

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives.

## R1. The tree library ships the filtering behaviour the spec describes

**Decision**: Use the tree library's built-in `searchTerm`/`searchMatch` props rather than building a filtered data pipeline.

**Evidence**: The installed package's own type definitions (`node_modules/react-arborist/dist/main/types/tree-props.d.ts`, react-arborist 3.16.0) declare `searchTerm?: string` and `searchMatch?: (node: NodeApi<T>, searchTerm: string) => boolean` on the tree props, and the package's documentation states the filtering contract: a non-empty term shows only matching nodes, parents of matches are kept so the structure remains, and internal nodes are opened while filtering. That contract matches FR-003, FR-004, and FR-005 directly.

**Alternatives rejected**:

- _Filtering in the workspace reducer or a derived data selector_: state churn and a second copy of the tree shape for what is a display-time concern; also risks regressions in expansion handling that the library already owns.
- _A separate results list under the tree_: a second UI to keep in sync with the tree's activation and context-menu behaviour, for no added capability over filtering in place.

## R2. The match predicate must be supplied explicitly

**Decision**: Pass a `searchMatch` predicate that tests the entry's name only, case-insensitively.

**Evidence**: The library's default predicate is deliberately loose: it stringifies the node's data and searches the whole result, so a term could match fields other than the name. The spec's FR-003 allows the name field only, so an explicit predicate (`name.toLowerCase().includes(term.toLowerCase())`) is required, not optional.

**Consequence**: The predicate lives in the small pure module (explorerSearch.ts) with unit fixtures, including the negative cases that pin FR-006 (a folder matching does not surface its children unless they match too).

## R3. Restore-on-clear must be verified, with a snapshot fallback

**Decision**: When a term first becomes non-empty, snapshot the tree's open (expansion) map and current selection; when the term is cleared, reapply the snapshot if and only if the library has not already restored the pre-filter state.

**Evidence**: The library opens internal nodes while filtering, and its documentation does not promise that clearing the term restores the exact pre-filter open state. The tree api exposes the open-state controls needed for both the snapshot and the reapply. Whether the manual reapply is necessary is an implementation-time verification (task 2.1); the spec's FR-008 is fixed either way, so the fallback costs one small pure helper (explorerSearch.ts) that is unit-tested regardless.

**Consequence**: FR-008 does not depend on undocumented library behaviour; if the library already restores state, the helper is a no-op path and the tests still pass.

## R4. State placement: component state in the explorer container, nothing persisted

**Decision**: The term lives in React state in the explorer container (wired in App.tsx alongside the existing tree props), not in the workspace reducer, and is dropped when the workspace changes or the app restarts.

**Evidence**: The term is display state with no consumer outside the explorer; the reducer's existing concerns (tree contents, pending edit, selection) would gain a field that every workspace transition must remember to clear (FR-013), for no benefit.

## R5. Escape and focus follow the app's existing conventions

**Decision**: The input handles Escape (clear term, restore, focus the tree container) and the input is labelled for accessibility; the tree keeps its existing focus handling for rows.

**Evidence**: Escape already closes the tree context menu and other transient surfaces in the renderer with the same clear-and-return-focus shape; reusing that convention keeps the interaction model uniform (FR-014).
