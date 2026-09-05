# Tasks: Explorer Search Results

## Phase 1: Main-side result shape (R2, FR-002/004/005/006/015, SC-005)

- [X] 1.1 Update `tests/main/search.test.ts`: per-file counts match a hand-counted fixture (SC-005); distinct matching lines returned in order; a line with multiple occurrences counts each but appears once; case-insensitive; empty/whitespace term returns nothing; markdown-only; symlink/junction containment; oversized/unreadable skipped
- [X] 1.2 Implement `searchContents` returning `SearchContentResult[]` (`{ path, count, lines }`) in `src/main/fs/search.ts`; keep the mtime/size cache, the async root-bounded walk, and the silent skips
- [X] 1.3 Add `SearchContentResult` to `src/shared/ipc-contract.ts`; update the preload/contract types
- [X] 1.4 Verify: `npm run test -- search.test` and `npm run typecheck`

## Phase 2: Renderer results view (R1, R3, R4, FR-001..016)

- [X] 2.1 Write unit tests `tests/renderer/searchResults.test.ts`: `truncateSnippet` keeps the match visible with `...` on truncated sides; `highlightSnippet` wraps every occurrence case-insensitively with a term-escaped regex; name-match extraction from tree data; name+content merge (both → content count, once); summary counts (content occurrences + name-only matches)
- [X] 2.2 Implement `src/renderer/explorer/searchResults.ts` (pure helpers) and `src/renderer/explorer/SearchResults.tsx` (summary line, file sections with icon/name/dir/chevron/badge, expanded-by-default snippets with highlighting and truncation, click-to-open)
- [X] 2.3 Implement `src/renderer/hooks/useSearchResults.ts`: debounce, stale guard, settle flag, merge of name matches (from tree data) and content results (from main), sorted sections
- [X] 2.4 Rework `src/renderer/explorer/Tree.tsx` and `src/renderer/App.tsx`: render the results view while a term is active, remove `searchMatch`/`contentMatchIds`/snapshot-restore/ancestor loading; keep Escape/clear and the workspace-change reset
- [X] 2.5 Verify: `npm run typecheck`, `npm run lint`, `npm run test`

## Phase 3: E2E rework and new suite (R5, US1-3, FR-001..016)

- [X] 3.1 Rework `tests/e2e/explorer-search.spec.ts` and `tests/e2e/explorer-content-search.spec.ts` to the results presentation (summary, sections, badges, snippets); rework the create/rename/delete-while-filtered scenario to clear-then-operate (R5); keep Escape/clear/whitespace/empty-state/reset scenarios
- [X] 3.2 Write `tests/e2e/explorer-search-results.spec.ts`: summary line totals (FR-002); sections with icon/name/dir/chevron/badge (FR-003/004); expanded-by-default and collapsible (FR-005); snippets per matching line (FR-006); term highlighting (FR-007); name match badge 1 and both-kinds merge (FR-008); click-to-open with duplicate-tab focus (FR-009); clear restores the untouched tree (FR-010); reset on workspace change/restart (FR-011); empty state (FR-012); whitespace no-op (FR-013); read-only byte comparison (FR-015, SC-004); Escape focus (FR-016); a generated workspace with thousands of matches renders within a bounded wait (FR-014/SC-002)
- [X] 3.3 Build and run: `npm run test:e2e -- explorer-search`, iterate to green

## Phase 4: Full verification and archive

- [X] 4.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [X] 4.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files (LF-normalized locally for the CRLF checkout; verify each committed blob)
- [X] 4.3 Archive: `git mv specs/060-explorer-search-results specs/archive/060-explorer-search-results`, set Status Archived