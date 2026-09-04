# Tasks: Search Box for Source Editing

**Prerequisite**: spec 055 landed (shared `SearchPanel`). If implemented first, extracting the shared panel from 055's design is part of task 2.1.

## Phase 1: Dependency and glue (R1, R2, FR-002/010/011)

- [X] 1.1 Add `@codemirror/search` to `package.json`; read the installed package's type definitions and pin the exact exports used (query type, query-set effect, find-next/previous, and whether match highlighting is automatic or needs an explicit control); record the finding in research.md R2
- [X] 1.2 Write unit tests `tests/renderer/search/sourceSearch.test.ts`: query building (literal, case-insensitive), total/current count derivation, zero-match handling, open/close clearing state, and an assertion that search dispatches selection-only transactions (dirty state cannot flip)
- [X] 1.3 Implement `src/renderer/search/sourceSearch.ts`: build the query from the panel's term, apply the query effect, compute counts, navigate with wrap-around, place the selection on the current match, expose open/close that add and remove highlights
- [X] 1.4 Verify: `npm run test -- sourceSearch`

## Phase 2: Panel wiring in the source view (R2, R3, R6, FR-001/003/004/005/006/007/008/013)

- [X] 2.1 Mount the shared `SearchPanel` in the source view area of `src/renderer/editor/SourceView.tsx` (only while source view is active); the word wrap checkbox and return button are untouched; register the search extension without the package's default panel and without its default find-shortcut keymap (R4)
- [X] 2.2 Wire the panel: input to query effect per keystroke; count display; Enter/Shift+Enter navigation; Escape closes (clear query, remove highlights, restore focus to the text with the caret where navigation left it)
- [X] 2.3 Verify: `npm run typecheck` and `npm run lint`

## Phase 3: Command routing (R4, FR-001/014)

- [X] 3.1 Extend the find command routing in `src/renderer/hooks/useMenuCommands.ts`: when the source view is active, open the source search instead of the visual one; confirm no double handling of the shortcut
- [X] 3.2 Verify: `npm run test -- shortcuts` and `npm run test -- menuModel`

## Phase 4: E2E scenarios

- [X] 4.1 Write `tests/e2e/source-search.spec.ts`: shortcut opens the box (FR-001); live highlights and count in raw text including frontmatter (FR-011); caret placed on the current match and scrolled into view (FR-004); next/previous wrap and Enter/Shift+Enter (US2); word wrap on and off both work with the wrap state unchanged (FR-013); Escape leaves edits intact, a clean document clean, highlights gone, and focus in the text (US3/FR-009); zero-match calm state; a generated 10,000-line document searches without perceptible lag (FR-012/SC-002)
- [X] 4.2 Build and run: `npm run test:e2e -- source-search`, iterate to green

## Phase 5: Full verification and archive

- [ ] 5.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 5.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 5.3 Archive: `git mv specs/056-source-view-search specs/archive/056-source-view-search`, set Status Archived
