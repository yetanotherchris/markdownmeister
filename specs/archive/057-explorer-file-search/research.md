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

## R3. Restore-on-clear is verified: the library restores open state, so only selection needs a snapshot

**Decision**: Snapshot the selection when a term first becomes non-empty and reapply it when the term clears. Do not reapply open state: the installed library already restores the pre-filter expansion map.

**Evidence** (task 2.1, read from the installed package's own source, react-arborist 3.16.0): the open slice keeps two maps, `unfiltered` and `filtered`. While a term is active `isOpen(id)` returns `filtered[id] ?? true` (internal nodes forced open), and user toggles during filtering write to the `filtered` map only. When the term becomes empty, `TreeProvider` dispatches `VISIBILITY_CLEAR filtered`, emptying the `filtered` map, so `isOpen` falls back to the untouched `unfiltered` map: the pre-filter expansion state is restored automatically. Selection lives in its own slice driven by the `selection` prop and is never cleared by search, so a pre-filter selection survives the clear too. The one gap is when the user changes selection during filtering (e.g. clicks a match): the click's selection would survive the clear, contradicting FR-008's "same selection", so the explorer snapshots the selection on the term's first non-empty change and reapplies it on clear (transition effect in `Tree.tsx`).

**Consequence**: The open-state reapply helper is not wired (it would be a no-op against the current library); FR-008's open-state half is covered by the library and pinned by the e2e restore scenario. The selection snapshot/restore lives in `Tree.tsx` (a ref captured on the unfiltered→filtered transition) and is pinned by the same e2e scenario; tasks 1.1/1.2 were narrowed to the pure predicate and empty-state helpers accordingly.

## R4. State placement: component state in the explorer container, nothing persisted

**Decision**: The term lives in React state in the explorer container (wired in App.tsx alongside the existing tree props), not in the workspace reducer, and is dropped when the workspace changes or the app restarts.

**Evidence**: The term is display state with no consumer outside the explorer; the reducer's existing concerns (tree contents, pending edit, selection) would gain a field that every workspace transition must remember to clear (FR-013), for no benefit.

## R5. Escape and focus follow the app's existing conventions

**Decision**: The input handles Escape (clear term, restore, focus the tree container) and the input is labelled for accessibility; the tree keeps its existing focus handling for rows.

**Evidence**: Escape already closes the tree context menu and other transient surfaces in the renderer with the same clear-and-return-focus shape; reusing that convention keeps the interaction model uniform (FR-014).
