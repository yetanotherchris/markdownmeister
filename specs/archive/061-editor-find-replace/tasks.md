---

description: "Task list for find and replace in the editor"
---

# Tasks: Find and Replace in the Editor

**Input**: Design documents from `/specs/061-editor-find-replace/`

**Prerequisites**: plan.md, spec.md, research.md

**Tests**: The spec's constitution (Principle V) and AGENTS.md require unit tests for pure logic and e2e for user-visible behaviour, so tests are included.

**Organization**: Tasks are grouped by user story (spec.md US1/US2/US3) after the shared plumbing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

## Phase 1: Setup (Shared Plumbing)

- [X] T001 Add `@codemirror/commands` to `dependencies` in `package.json` (already present transitively via `@milkdown/crepe`; promote it to a direct dependency) and run `npm install`
- [X] T002 [P] Add `'replace'` to the `MenuCommand` union in `src/shared/ipc-contract.ts`
- [X] T003 [P] Map Ctrl/Cmd+H to `'replace'` in `src/main/shortcuts.ts` and cover it in `tests/main/shortcuts.test.ts`
- [X] T004 [P] Add the `Replace…` hamburger entry and `Ctrl+H`/`⌘H` accelerator in `src/renderer/chrome/menuModel.ts` and update `tests/renderer/menuModel.test.ts`

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 [P] Add `nonOverlapping(matches)` to `src/renderer/search/findMatches.ts`, with fixtures in `tests/renderer/search/findMatches.test.ts` (overlaps such as `ana` in `banana`, no double replacement)
- [X] T006 Extend `SearchPanel` in `src/renderer/search/SearchPanel.tsx`: replace toggle, controlled replace row (`search-replace-input`, `search-replace`, `search-replace-all`), `replaceOpen` prop, and the new callbacks; buttons disabled when `total === 0`
- [X] T007 Add the two-row panel layout styles to `src/renderer/search/search.css`
- [X] T008 Carry the replace flag on the find request: extend `FindRequest`/`findSignal` in `src/renderer/search/useVisualSearch.ts`, route `'replace'` in `src/renderer/hooks/useMenuCommands.ts`, and pass the flag from `src/renderer/App.tsx`

## Phase 3: User Story 1 + 2 - Replace one and Replace all (Priority: P1)

**Goal**: A user can replace the current match or every non-overlapping occurrence in either editing view, with the match total recomputed and the document dirty.

**Independent Test**: With matches shown and a replacement entered, activate replace (one occurrence changes, count recomputed, dirty) and Replace All (all non-overlapping occurrences change in one action).

- [X] T009 [US1] Extend the visual search plugin in `src/renderer/search/visualSearch.ts`: `replaceOpen`/`replacement` state, `setReplaceOpen`/`setReplacement` effects, `replaceCurrent`/`replaceAll`, marks-at-match-start insertion, and one-step undo isolation (`closeHistory` plus a following meta-only `closeHistory` transaction)
- [X] T010 [US1] Extend the search handle in `src/renderer/editor/CrepeHost.tsx` with `open(replace)`, `setReplaceOpen`, `setReplacement`, `replaceCurrent`, `replaceAll`
- [X] T011 [US2] Extend the source search module in `src/renderer/search/sourceSearch.ts`: `replaceOpen`/`replacement` state, effects, `replaceCurrent`/`replaceAll` (change sets annotated with `isolateHistory.of('full')`, caret placed on the next remaining match)
- [X] T012 [US2] Extend `src/renderer/search/useVisualSearch.ts` and `src/renderer/editor/EditorPanel.tsx` to pass `replaceOpen`, the replacement callbacks, and the two actions to `SearchPanel`
- [X] T013 [US2] Wire the source actions in `src/renderer/editor/SourceView.tsx` (open with replace, replacement change, replace, replace all) and add the CodeMirror `history()` + `historyKeymap` extensions with `Transaction.addToHistory.of(false)` on the external refresh
- [X] T014 [P] [US1] Add unit tests for source replace (current advances, replace-all non-overlapping, empty replacement deletes, undo restores, no other content changes) to `tests/renderer/search/sourceSearch.test.ts`

## Phase 4: User Story 3 - Replacement is safe, scoped, and view-correct (Priority: P2)

**Goal**: Replace works in both views, follows each view's search scope, is single-document, participates in undo and dirty tracking, and leaves no residue on dismissal.

**Independent Test**: Perform a replace in each view, undo it, dismiss the box, and confirm content, dirty state, undo history, and highlights are exactly as expected, including after undoing a replacement in a document that had a pre-existing edit.

- [X] T015 [US3] Add `tests/e2e/find-replace.spec.ts` covering the spec's acceptance scenarios: replace current in visual and source, empty replacement, zero-match inertness, Replace All over a fixture with overlaps and a replacement containing the query, single-step undo (single and all), dismissal removing highlights while keeping replacements, view scope (frontmatter/`**` only in source), no cross-document effect, and a 10,000-line Replace All
- [X] T016 [US3] Update the existing search suites if the panel structure changed (`tests/e2e/visual-search.spec.ts`, `tests/e2e/source-search.spec.ts`)

## Phase 5: Polish

- [X] T017 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`; fix any failures
- [X] T018 Move `specs/061-editor-find-replace/` to `specs/archive/061-editor-find-replace/` with `git mv` and set `**Status**: Archived` in `spec.md`

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: T006/T008 depend on T002 (the `replace` command name); T005 is independent.
- **US1/US2 (Phase 3)**: T009/T010 (visual) and T011/T013 (source) both depend on T005, T006, and T008; T012 depends on T006 and the handle shapes from T010/T011.
- **US3 (Phase 4)**: depends on both surfaces being functional.
- **Polish (Phase 5)**: depends on all stories.

## Parallel Opportunities

- T002, T003, T004, T005 edit different files and can run together.
- T009/T010 (visual) and T011/T013 (source) are separate file sets and can be worked in parallel.
- T014 runs alongside the remaining implementation.

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Complete the visual replace current path (T009, T010, T012).
3. Validate one-at-a-time replacement in visual editing, then add the source and Replace All paths.
