# Tasks: Search Box for Visual Editing

## Phase 1: Pure matcher (R3, FR-002/010/011)

- [x] 1.1 Write unit tests `tests/renderer/search/findMatches.test.ts`: literal case-insensitive matching; a phrase crossing inline formatting boundaries inside one block; no false match across block boundaries (sentinel); punctuation/symbol queries; empty and whitespace-only queries return none; repeated and overlapping matches ("aa" in "aaa"); offset-to-position mapping round-trips; a 10,000-line fixture completes well inside the imperceptibility budget (FR-012/SC-002)
- [x] 1.2 Implement `src/renderer/search/findMatches.ts`: per-block text concatenation with boundary sentinel, literal case-insensitive scan, offset-to-position mapping; pure, never throws
- [x] 1.3 Verify: `npm run test -- findMatches`

## Phase 2: Plugin and panel (R2, FR-001/003/004/005/006/007/008)

- [ ] 2.1 Verify the decoration API surface against the installed prosemirror-view type definitions (inline decorations, DecorationSet mapping across transactions) before wiring; record anything that differs from R2 in research.md
- [ ] 2.2 Implement `src/renderer/search/visualSearch.ts`: plugin state (query, matches, current index) recomputed on query-set effect and on document changes while active; highlight decorations plus a distinct current-match decoration; next/previous commands with wrap-around; close command clears all state
- [ ] 2.3 Implement `src/renderer/search/SearchPanel.tsx`: labelled input (autofocused), "current of total" count, prev/next and close buttons; Enter/Shift+Enter navigation; Escape closes; calm zero-match rendering
- [ ] 2.4 Wire the plugin into `src/renderer/editor/CrepeHost.tsx` and mount the panel over the editing area for the active document only; the panel dispatches no document-changing transactions; closing returns focus to the editor
- [ ] 2.5 Verify: `npm run typecheck` and `npm run lint`

## Phase 3: Shortcut and menu routing (R4, FR-001/013)

- [ ] 3.1 Add the find shortcut (Ctrl/Cmd+F) to `src/main/shortcuts.ts` and a Find entry showing it to `src/renderer/chrome/menuModel.ts`; extend `tests/main/shortcuts.test.ts` and `tests/renderer/menuModel.test.ts`
- [ ] 3.2 Route the find command in `src/renderer/hooks/useMenuCommands.ts` to the active document's visual host (open with an empty query, focus the input); no-op when the source view is active (spec 056 owns that surface)
- [ ] 3.3 Verify: `npm run test -- shortcuts`

## Phase 4: E2E scenarios

- [ ] 4.1 Write `tests/e2e/visual-search.spec.ts`: shortcut opens the box (FR-001); live count and highlights on typing (US1); current match distinct and scrolled into view; matches inside heading, list, table, and code block (FR-011); next/previous wrap both ways and Enter/Shift+Enter (US2); editing while open refreshes counts; Escape closes with content byte-identical, dirty state clean, and focus in the document (US3/FR-009); zero-match calm state; a generated 10,000-line document searches without perceptible lag (FR-012/SC-002)
- [ ] 4.2 Build and run: `npm run test:e2e -- visual-search`, iterate to green

## Phase 5: Full verification and archive

- [ ] 5.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 5.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 5.3 Archive: `git mv specs/055-visual-editor-search specs/archive/055-visual-editor-search`, set Status Archived
