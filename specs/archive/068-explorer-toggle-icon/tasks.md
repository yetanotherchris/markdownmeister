---
description: "Task list for the file explorer toggle icon"
---

# Tasks: File Explorer Toggle Icon

**Input**: Design documents from `/specs/068-explorer-toggle-icon/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/renderer.md, quickstart.md

**Tests**: Included. The repository requires a Playwright e2e suite for user-visible behaviour. The spec's acceptance scenarios are that suite.

**Organization**: User Story 1 replaces the glyph and proves its shape. User Story 2 proves themes, labels, keyboard use, alignment, and an unsaved document. Both stories share one e2e file, so their test tasks are sequential.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Phase 1: Setup

**Purpose**: Confirm the glyph comes from a dependency that is already installed.

- [X] T001 Confirm `package.json` already depends on `lucide-react` and that `PanelLeft` is an exported component. Do not add a package.

---

## Phase 2: Foundational

**Purpose**: Nothing new has to exist before the stories. The header button, `.chrome-icon`, and `handleToggleExplorer` already implement the behaviour this feature must keep.

**Checkpoint**: No file in this phase. Do not edit `src/renderer/chrome/chrome.css` or `src/renderer/hooks/useSidebarLayout.ts`.

---

## Phase 3: User Story 1 - Recognize and Toggle the File Explorer (Priority: P1)

**Goal**: The header control shows an outlined window with a narrow left pane and a wider right pane, and that symbol stays while the explorer hides and returns.

**Independent Test**: Open a workspace, read the toggle svg against the contract geometry, then activate the button twice. The explorer hides and returns, and the svg is unchanged. With no workspace, the button is disabled and still shows that svg.

### Tests for User Story 1

- [X] T002 [US1] Add `tests/e2e/explorer-toggle-icon.spec.ts` asserting one rounded rect, the single path `M9 3v18`, a divider left of center, a narrower left pane, `fill="none"`, and `stroke-width="1.5"` (FR-001, FR-002, SC-001). Assert the same svg after hide and restore, and while the button is disabled with no workspace (FR-004).

### Implementation for User Story 1

- [X] T003 [US1] In `src/renderer/App.tsx`, replace `Squares2X2Icon` with `PanelLeft` from `lucide-react`, using `className="chrome-icon"` and `strokeWidth={1.5}`. Leave the button's class, labels, `disabled` rule, and `onClick` as they are (FR-001, FR-003, FR-005, FR-006).

**Checkpoint**: The control shows the left-sidebar symbol in every availability state and still hides and restores the explorer.

---

## Phase 4: User Story 2 - Use the Control Across Themes and Input Methods (Priority: P2)

**Goal**: The same control stays legible in light and dark, keeps its name, matches its neighbour's size, and does not touch an unsaved document.

**Independent Test**: Compare the glyph with the menu icon in both themes, read the tooltip and accessible name, activate the focused control from the keyboard, and hide and restore the explorer while a document is dirty.

### Tests for User Story 2

- [X] T004 [US2] Extend `tests/e2e/explorer-toggle-icon.spec.ts` so light and dark both keep the stroke equal to the menu button color and different from the header background, the button and glyph bounds match the menu control, hover and keyboard focus keep the existing treatment, and the tooltip and accessible name stay `Toggle file explorer` (FR-003, FR-005, FR-007, SC-002, SC-003).
- [X] T005 [US2] Extend `tests/e2e/explorer-toggle-icon.spec.ts` so hiding and restoring the explorer leaves the typed text and the dirty marker unchanged (FR-006, SC-004).

**Checkpoint**: Themes, labels, keyboard activation, alignment, and unsaved text are covered without a behaviour change.

---

## Phase 5: Polish

**Purpose**: Keep the surrounding notes accurate, format the new test, run the gates, and archive the spec.

- [X] T006 [P] Update the glyph comment in `tests/e2e/native.spec.ts` so it names the left-sidebar symbol instead of `Squares2X2`.
- [X] T007 Add `tests/e2e/explorer-toggle-icon.spec.ts` to the `format:check` script in `package.json`.
- [X] T008 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`.
- [X] T009 Archive the feature with `git mv specs/068-explorer-toggle-icon specs/archive/068-explorer-toggle-icon`, set **Status** in `spec.md` to `Archived`, and mark every task in `tasks.md` done.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup has no dependency.
- Foundational work is empty and blocks nothing that is not already in the tree.
- User Story 1 starts after Setup. User Story 2 extends the same e2e file, so it starts after T002.
- Polish starts after both stories.

### User Story Dependencies

- **User Story 1 (P1)**: The glyph swap and the geometry tests. No dependency on User Story 2.
- **User Story 2 (P2)**: Uses the glyph from User Story 1. Its tests extend `tests/e2e/explorer-toggle-icon.spec.ts`, so they are not parallel with T002.

### Parallel Opportunities

- T006 touches only `tests/e2e/native.spec.ts` and can run beside T004 and T005.
- T003 waits until T002 has described the assertions, so a failure is about the old four-square glyph.

### Parallel Example: User Story 2

```text
T006  tests/e2e/native.spec.ts
T004  tests/e2e/explorer-toggle-icon.spec.ts
```

T004 and T005 are the same file, so they stay sequential. T006 can run with either of them.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Confirm `PanelLeft` is already installed.
2. Add the geometry and availability assertions.
3. Swap the icon in `src/renderer/App.tsx`.
4. Stop and run `tests/e2e/explorer-toggle-icon.spec.ts` for the shape and the hide/restore cases.

### Incremental Delivery

1. User Story 1 delivers the symbol and the existing toggle.
2. User Story 2 adds theme, alignment, keyboard, label, and dirty-state proof.
3. Polish runs the four gates and archives the spec.

## Notes

- The button markup, stylesheet, and sidebar hook are out of scope except for the icon child.
- Commit the plan artifacts separately from the icon change.
