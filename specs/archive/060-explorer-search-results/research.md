# Research: Explorer Search Results

**Feature**: specs/060-explorer-search-results | **Date**: 2026-09-05

## R1. The tree is never modified during a search, so restore becomes free

**Decision**: While a term is active the tree is unmounted from view but its data and internal state are untouched; clearing the term simply shows it again. This removes spec 057's selection snapshot/restore and spec 059's ancestor loading and predicate extension entirely.

**Evidence**: Spec 057's restore machinery existed because the in-place filter mutated react-arborist's open/selection state. With a results view rendered instead of the tree, nothing mutates, so the pre-search state persists by construction. Spec 059's ancestor loading existed to make content-match nodes exist inside the tree; a flat results view has no such need.

**Consequence**: The renderer drops `contentMatchIds`, `shouldShowNoMatchState`, `searchMatchWithContent`, and ancestor loading; name matching for the results is computed from the loaded tree data, content matching from the scan, and the two merge into the results list.

## R2. The scan must return per-file counts and matching lines, not just paths

**Decision**: `workspace:searchContents` returns `SearchContentResult[]` = `{ path, count, lines }`. `count` is the number of case-insensitive occurrences of the term in the file; `lines` are the distinct file lines (in order) that contain at least one occurrence, full text.

**Evidence**: The badge (FR-004), summary (FR-002), and snippets (FR-006) all need occurrence-level data; paths alone cannot produce them. The full matching lines travel to the renderer so truncation and highlighting are renderer-side (the renderer owns the term and the layout width).

**Consequence**: The main-process cache (mtime+size keyed) stores content; on a cache hit the occurrence scan runs against cached content, so repeated searches stay stat-only. The count is computed by scanning each matching line for occurrences, and a line with several occurrences counts each while appearing once as a snippet (edge case pinned by a unit test).

## R3. Snippet truncation and highlighting are pure renderer helpers

**Decision**: `truncateSnippet(line, term, maxChars)` keeps a window around the first occurrence of the term, appends `...` on each truncated side, and never hides the term; a `highlightSnippet(text, term)` helper wraps every occurrence (term-escaped, case-insensitive regex) in a `<mark>`.

**Evidence**: The user asked for ellipsis truncation of long surrounding text with the match kept visible and highlighted (spec FR-006/007). Doing both in pure helpers keeps them unit-testable and avoids sending occurrence positions from main.

## R4. Merging name and content matches

**Decision**: Name matches come from the loaded tree data (files whose name matches, badge 1, no snippet); content matches come from the scan. A path that matches both appears once with the content count; sections are sorted by directory then name; the summary counts content occurrences plus name-only matches.

**Evidence**: Spec 059's "filenames take precedence" and the user's VS Code request both require name and content matches to coexist. A file matching both showing content matches (not 1) keeps the badge honest (SC-005).

## R5. Clicking a result opens the file; tree operations require clearing the search

**Decision**: Clicking a file section or snippet calls the existing open handler (duplicate-tab rules intact). While a search is active the tree is hidden, so create/rename/move/delete from the tree are unavailable until the search is cleared, matching VS Code and the user's choice that the results view replaces the tree.

**Consequence**: The spec 057 e2e scenario asserting create/rename/delete while filtered is reworked: those operations now require clearing the search, and the reworked test verifies they work immediately after clearing.