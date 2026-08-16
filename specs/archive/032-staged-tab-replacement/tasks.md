# Tasks: Staged Same-Tab Replacement

**Input**: Design documents from `specs/032-staged-tab-replacement/`

**Prerequisites**: `spec.md`, `plan.md`, `.specify/memory/constitution.md`

**Tests**: Required. The specification requires automated coverage for visible editor continuity, atomic commit, dirty/source-edit cancellation, and superseded replacements. The repository workflow also requires Playwright coverage for user-visible behavior.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently.

## Phase 1: Setup

**Purpose**: Establish the focused test seams and inspect the existing open-file replacement flow without changing behavior.

- [x] T001 Map the current same-tab open, panel identity, and editor-pool lifecycle in `src/renderer/hooks/useDocumentSession.ts`, `src/renderer/state/documents.ts`, and `src/renderer/hooks/useEditorPool.ts`.
- [x] T002 Add reducer test fixtures for same-tab replacement transitions in `tests/renderer/documents.open-replace.test.ts`.

## Phase 2: Foundational

**Purpose**: Define the staged replacement state and state transitions that every user story relies on.

- [x] T003 Add a stable visual-panel identity and one pending replacement slot per panel in `src/renderer/state/documents.ts`.
- [x] T004 Add prepare, commit, cancel, supersede, and tab-close staged-replacement reducer actions in `src/renderer/state/documents.ts`.
- [x] T005 Add reducer tests for staged replacement preparation, atomic commit, cancellation, supersession, and closing in `tests/renderer/documents.open-replace.test.ts`.

## Phase 3: User Story 1 - Browse Files Without an Empty Editor (Priority: P1)

**Goal**: Keep the outgoing formatted editor visible and interactive until an invisible staged editor is ready, then commit the new title, path, content, and document identity together.

**Independent Test**: Open a clean document, open another file in the current tab, and verify the outgoing non-empty editor remains visible until the destination title and content appear atomically.

- [x] T006 [US1] Add an explicit ready callback from `src/renderer/editor/CrepeHost.tsx` after Milkdown initialization completes.
- [x] T007 [US1] Render visible outgoing and layoutable, inert staged editor hosts keyed by stable panel identity in `src/renderer/editor/EditorPanel.tsx`.
- [x] T008 [US1] Add the hidden, non-interactive staged-host styling in `src/renderer/editor/editor.css` without using `display: none`.
- [x] T009 [US1] Orchestrate prepare-on-open and ready-gated atomic commit for clean same-tab opens in `src/renderer/hooks/useDocumentSession.ts`.
- [x] T010 [US1] Pass staged document and panel identity data from `src/renderer/App.tsx` into `src/renderer/editor/EditorPanel.tsx`.
- [x] T011 [US1] Allow exactly one temporary staged pool member and release it on commit in `src/renderer/hooks/useEditorPool.ts`.
- [x] T012 [US1] Add an Electron test proving the outgoing editor stays visible and the title/content switch atomically in `tests/e2e/open-in-current-tab.spec.ts`.

## Phase 4: User Story 2 - Preserve Existing Tab and Data-Loss Behavior (Priority: P1)

**Goal**: Cancel staging whenever the outgoing document becomes unsafe to replace, while retaining all existing dirty-tab, explicit-new-tab, already-open-file, source-view, close, and pool behavior.

**Independent Test**: Begin a staged replacement, edit the outgoing formatted and source documents before completion, and verify each edit is retained and protected by existing unsaved-change behavior.

- [x] T013 [US2] Re-check live dirty state immediately before staged commit and cancel without changing the outgoing document when it is dirty in `src/renderer/hooks/useDocumentSession.ts`.
- [x] T014 [US2] Cancel a pending replacement on formatted-editor and source-view content updates in `src/renderer/hooks/useDocumentSession.ts`.
- [x] T015 [US2] Cancel and destroy a pending staged editor when its request is superseded or its outgoing tab closes in `src/renderer/hooks/useDocumentSession.ts`.
- [x] T016 [US2] Preserve the existing explicit-new-tab, dirty-tab, and already-open-file branches in `src/renderer/hooks/useDocumentSession.ts`.
- [x] T017 [US2] Release staged editor-pool members on cancellation and supersession in `src/renderer/hooks/useEditorPool.ts`.
- [x] T018 [US2] Extend reducer coverage for live-dirty, source-edit, superseded-request, and closed-tab cancellation in `tests/renderer/documents.open-replace.test.ts`.
- [x] T019 [US2] Add Electron scenarios for dirty formatted/source edits, superseded opens, and preserved new-tab behavior in `tests/e2e/open-in-current-tab.spec.ts`.

## Phase 5: Polish and Validation

**Purpose**: Verify the completed feature, update its artifacts, and archive it with the implementation change.

- [x] T020 Add focused comments for non-obvious staged-host visibility, live-dirty, and pool-release invariants in `src/renderer/editor/EditorPanel.tsx`, `src/renderer/hooks/useDocumentSession.ts`, and `src/renderer/hooks/useEditorPool.ts`.
- [x] T021 Run `npm run lint` and resolve feature-related failures.
- [x] T022 Run `npm run typecheck` and resolve feature-related failures.
- [x] T023 Run `npm run test` and resolve feature-related failures.
- [x] T024 Run `npm run test:e2e` and resolve feature-related failures.
- [x] T025 Mark completed tasks in `specs/032-staged-tab-replacement/tasks.md`, move the feature to `specs/archive/032-staged-tab-replacement/`, and set `spec.md` status to `Archived` when the implementation PR is opened.

## Dependencies and Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks both user stories.
- User Story 1 (Phase 3) establishes staged rendering and commit, then User Story 2 (Phase 4) adds cancellation safety to that flow.
- Phase 5 follows all implementation and test tasks.

## Parallel Opportunities

- After T003 and T004 define the state shape, T006 and T008 can proceed in parallel because they edit separate files.
- After T009 is complete, T011 and T012 can proceed in parallel because they respectively cover pool lifecycle and end-to-end behavior.
- After T013 through T017 are complete, T018 and T019 can proceed in parallel because they edit separate test files.

## Implementation Strategy

1. Deliver the MVP through User Story 1: mount the next editor invisibly, retain the outgoing editor, then commit only on readiness.
2. Deliver User Story 2: protect the outgoing document by cancelling every unsafe or obsolete staged request.
3. Run the full validation suite before archiving the feature in its implementation PR.
