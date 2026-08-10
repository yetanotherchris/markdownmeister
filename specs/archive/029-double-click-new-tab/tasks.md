# Tasks: Double-Click Open in New Tab

**Input**: Design documents from `/specs/029-double-click-new-tab/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/file-open-gesture.md

**Tests**: Required — spec.md mandates e2e coverage per AGENTS.md, plus unit tests for the pure gesture decision.

**Organization**: Tasks are grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3)
- Exact file paths in descriptions

## Phase 1: Foundational

**Purpose**: Pure gesture-decision module + row routing + hook wiring — the shared infrastructure every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] [US1] Create pure gesture module `src/renderer/explorer/openGesture.ts` exporting `DOUBLE_CLICK_WINDOW_MS = 500` and `resolveFileOpenGesture(detail, preferNewTab): 'open-new' | 'open-now' | 'defer'` (double-click → open-new; single-click + new-tab → open-now; single-click + same-tab → defer).
- [x] T002 [P] [US1] Add `onFileOpen: (node: TreeNode, gesture: 'single-click' | 'double-click') => void` to `TreeProps` in `src/renderer/explorer/Tree.tsx` and wire it through `renderRow` to `TreeRow`.
- [x] T003 [US1] In `TreeRow` (`src/renderer/explorer/Tree.tsx`), route FILE rows to the gesture: `onClick` calls `node.select()` then `onFileOpen(node.data, e.detail >= 2 ? 'double-click' : 'single-click')`; do NOT call `node.handleClick` for files. Add `onDoubleClick={() => { if (node.data.kind === 'directory') node.toggle() }}` for directories (US3 groundwork, same row).
- [x] T004 [US1] Add `handleFileOpen` to `useWorkspaceTree.ts` implementing the decision table from `contracts/file-open-gesture.md`: double-click → cancel pending + `openFileFromExplorer(file, true)`; single-click new-tab → open now; single-click same-tab → 500 ms deferred `openFileFromExplorer(file)` keyed by path in a pending-opens map. Expose it on `WorkspaceTreeApi`.
- [x] T005 [US1] Slim `handleTreeSelect` in `useWorkspaceTree.ts` to SELECT dispatch only (no file open) so the row gesture router is the sole mouse open path for files. Keep `handleTreeActivate` unchanged (keyboard).
- [x] T006 [P] [US1] Wire `onFileOpen={tree.handleFileOpen}` in `src/renderer/App.tsx`.

**Checkpoint**: Foundation ready — a file row click routes to a single gesture handler; keyboard activation still works.

---

## Phase 2: User Story 1 - Same-tab users pin a file to its own tab (Priority: P1) 🎯 MVP

**Goal**: With the setting disabled, double-clicking a file opens it in a new tab, leaving the previous tab untouched; single-click still replaces a clean tab after the double-click window.

**Independent Test**: Setting disabled + clean active tab → double-click a different file → it opens in a NEW tab, previous tab unchanged.

### Tests for User Story 1 ⚠️

> **NOTE: Write these FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Unit test `tests/renderer/openGesture.test.ts`: resolveFileOpenGesture decision matrix (double-click always open-new; single-click new-tab → open-now; single-click same-tab → defer) and window constant.
- [x] T008 [P] [US1] e2e `tests/e2e/double-click-new-tab.spec.ts`: US1 acceptance scenarios — clean active (new tab, original untouched), dirty active (new tab, dirty untouched), no tabs (single new tab), untitled clean active (new tab, untitled stays), already-open file (existing tab activated, no duplicate), and single-click still replaces a clean tab (FR-007).

### Implementation for User Story 1

- [x] T009 [US1] Verify double-click opens new tab in same-tab mode via `openFileFromExplorer(file, true)` (dedupe + dirty-safety from spec 024 gate).
- [x] T010 [US1] Verify deferred single-click commit uses `openFileFromExplorer(file)` (replace-clean-live) and is cancelled by a same-file double-click, independent per path.

**Checkpoint**: US1 fully functional and testable independently.

---

## Phase 3: User Story 2 - New-tab users see no change (Priority: P2)

**Goal**: With the setting enabled, double-click produces the same result as single-click — a new tab, no duplicate.

**Independent Test**: Setting enabled → double-click a file → exactly one new tab; double-click an already-open file → existing tab activated.

### Tests for User Story 2 ⚠️

- [x] T011 [P] [US2] e2e in `tests/e2e/double-click-new-tab.spec.ts`: US2 scenarios — double-click opens one new tab (no duplicate); double-click already-open file activates existing tab.

### Implementation for User Story 2

- [x] T012 [US2] Verify single-click in new-tab mode opens immediately (no deferral) and double-click dedupes via the existing already-open gate.

**Checkpoint**: US1 AND US2 both work independently.

---

## Phase 4: User Story 3 - Directories keep their current behaviour (Priority: P2)

**Goal**: Double-clicking a directory expands/collapses it and never opens a tab.

**Independent Test**: Collapse a directory, double-click → expands, no tab; double-click expanded → collapses, no tab.

### Tests for User Story 3 ⚠️

- [x] T013 [P] [US3] e2e in `tests/e2e/double-click-new-tab.spec.ts`: US3 scenarios — directory double-click expands (no tab), collapses (no tab).

### Implementation for User Story 3

- [x] T014 [US3] Verify `onDoubleClick` → `node.toggle()` on directory rows only (T003) and that `handleFileOpen` is never called for directories.

**Checkpoint**: All user stories independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T015 [P] Run `npm run lint`, `npm run typecheck`, `npm run test` (full suite must stay green).
- [x] T016 [P] Run `npm run test:e2e` (full e2e suite, including existing `open-in-current-tab.spec.ts`).
- [x] T017 [P] Archive spec: `git mv specs/029-double-click-new-tab specs/archive/029-double-click-new-tab`, set spec **Status** to `Archived`.
- [x] T018 [P] Update `checklists/requirements.md` status; mark all tasks `[x]`; open PR with `AI usage:` line.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS all user stories.
- **US1 (Phase 2)**: Depends on Phase 1.
- **US2 (Phase 3)**: Depends on Phase 1; shares the same row/gesture path as US1.
- **US3 (Phase 4)**: Depends on T003 (directory toggle added in Phase 1).
- **Polish (Phase 5)**: Depends on all user stories.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Pure module before hook before wiring.

### Parallel Opportunities

- T001/T002/T006/T007/T008/T011/T013 are `[P]` (different files, no dependencies).
- T003 and T004 are sequential within Phase 1 (row routes to the hook method).
