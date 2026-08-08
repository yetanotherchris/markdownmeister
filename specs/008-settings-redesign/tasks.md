# Tasks: Settings Redesign

**Feature**: `008-settings-redesign` | **Date**: 2026-08-08

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/settings-ui.md](./contracts/settings-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Required. The project constitution and `AGENTS.md` require unit coverage for new main-process behavior and Playwright coverage for every user-visible phase.

**Implementation strategy**: Establish the branch baseline and complete the persisted settings foundation first. Build the navigable modal around that foundation, then wire explorer-only tab preference, unconditional main-process developer-tools shortcuts, CSS canvas coverage, and the icon update. Each user story has a focused e2e validation before the final full suite. The developer-tools toggle setting was removed from scope (spec clarification 2026-08-08): the shortcuts are always available and the persisted `developerToolsEnabled` field is removed.

## Phase 1: Setup

- [X] T001 Verify project ignore coverage in `.gitignore`, `.prettierignore`, and `eslint.config.mjs`; run the baseline `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` on `phase-029-settings-redesign`.

**Checkpoint**: The branch baseline and design artifacts are complete.

## Phase 2: Foundational Settings And Developer Tools

- [X] T002 [P] Write failing persisted-setting validation, default, merge, migration, and round-trip cases for `fileOpenBehavior` in `tests/main/settings.test.ts`.
- [X] T003 [P] Write failing malformed `settings:update` patch rejection cases in `tests/main/ipc.test.ts`, developer-tools shortcut behavior coverage in `tests/main/shortcuts.test.ts`, and removed-menu assertions in `tests/renderer/menuModel.test.ts`.
- [X] T004 Add the settings field, closed validation, defaults, patch merge branches, and legacy-known-key migration in `src/shared/ipc-contract.ts` and `src/main/settingsFile.ts`.
- [X] T005 Add duplicate renderer defaults and immediate-persist state handlers for the setting in `src/renderer/state/settings.ts` and `src/renderer/hooks/useSettingsState.ts`.
- [X] T006 Add handler-level validation and typed invalid-patch results in `src/main/ipc/handlers/settings.ts`; remove the obsolete handler and bridge API from `src/main/ipc/handlers/app.ts`, `src/preload/index.ts`, and `src/shared/ipc-contract.ts`.
- [X] T007 Remove the obsolete developer-tools hamburger action and dispatch in `src/renderer/chrome/menuModel.ts` and `src/renderer/chrome/HamburgerMenu.tsx`.
- [ ] T006a Remove the `developerToolsEnabled` field from the settings model, validation, defaults, migration, renderer state, `useSettingsState`, `SettingsDialog`, `App.tsx`, and the main shortcut gate; make `src/main/shortcuts.ts` toggle unconditionally (spec clarification 2026-08-08).

**Checkpoint**: `fileOpenBehavior` is validated and persisted, DevTools cannot be enabled through a stale renderer action, and the F12/Ctrl/Cmd+Shift+I shortcuts always toggle developer tools.

## Phase 3: User Story 1 - Navigate Settings By Area (P1)

**Goal**: Settings has a clear General/Theme sidebar, with existing controls moved to their relevant area and accessible pill switches for booleans.

**Independent Test**: Open Settings, switch between General and Theme, and verify that only the selected area's controls appear and General is the default after reopening.

- [X] T008 [US1] Write failing settings-area, focus-trap, responsive-layout, and restart-selection scenarios in `tests/e2e/settings.spec.ts`.
- [X] T009 [US1] Redesign `src/renderer/chrome/SettingsDialog.tsx` with General/Theme navigation, area-specific panels, accessible native switches, and expanded focus trapping.
- [X] T010 [US1] Implement the wider responsive sidebar, selected navigation state, panel layout, and switch styles in `src/renderer/chrome/settings.css`.
- [X] T011 [US1] Wire new settings values and dialog callbacks in `src/renderer/App.tsx` and `src/renderer/hooks/useSettingsState.ts`.
- [X] T012 [US1] Extend immediate-persistence handler coverage in `tests/renderer/useSettingsState.test.tsx`.

**Checkpoint**: General and Theme are independently accessible, controls persist according to their established apply model, and the dialog is keyboard accessible.

## Phase 4: User Story 2 - Configure Explorer File Opening (P1)

**Goal**: Explorer actions follow the saved same-tab or new-tab preference without weakening dirty-document protection.

**Independent Test**: Select each preference and open files through explorer click and context-menu Open, confirming replacement, new-tab, and existing-tab activation behavior.

- [ ] T013 [US2] Write failing preference scenarios for explorer click and activation replacement, new tabs, existing-tab dedupe, dirty-tab safety, and explorer context-menu Open in `tests/e2e/open-in-current-tab.spec.ts` and `tests/e2e/source.spec.ts`.
- [ ] T014 [US2] Add an explorer-specific document-session decision using the persisted preference in `src/renderer/hooks/useDocumentSession.ts`.
- [ ] T015 [US2] Route explorer click and activation through the new decision in `src/renderer/hooks/useWorkspaceTree.ts`, route explorer context Open through it in `src/renderer/hooks/useSourceViewToggle.ts`, and wire explicit middle-click behavior in `src/renderer/App.tsx`.
- [ ] T016 [US2] Confirm File-menu and recent-item paths in `src/renderer/hooks/useMenuCommands.ts` continue using their current generic open behavior.

**Checkpoint**: The preference affects every specified explorer action, never replaces dirty content, and does not widen to File-menu or recent-item opens.

## Phase 5: Developer Tools Available Unconditionally

**Goal**: F12 and Ctrl/Cmd+Shift+I always toggle developer tools; there is no settings entry and the hamburger item stays absent.

**Independent Test**: From the real Electron main process, press F12 and Ctrl/Cmd+Shift+I and verify DevTools toggles. Confirm the settings dialog has no developer-tools control and the hamburger has no Toggle Developer Tools item.

- [ ] T017 [US3] Write failing always-on, toggle-off-then-on, and menu-removal scenarios in `tests/e2e/developer-tools.spec.ts` using `electronApp.evaluate` to inspect the real BrowserWindow DevTools state and `sendInputEvent` to drive the shortcuts.
- [ ] T018 [US3] Confirm no developer-tools control remains in the settings General area and update `tests/e2e/settings.spec.ts` assertions accordingly.

**Checkpoint**: Both shortcuts toggle DevTools unconditionally, no settings control exists, and no hamburger item remains.

## Phase 6: User Story 4 - Fill The Editor Canvas (P1)

**Goal**: A short formatted document's editor-theme canvas covers the entire visible editor host.

**Independent Test**: Open a short document in Rustic and dark Monotone themes and verify the themed `.milkdown` surface reaches the host bottom and updates after a theme change.

- [ ] T019 [US4] Write failing short-document geometry and computed-color scenarios in `tests/e2e/editor-canvas-background.spec.ts`.
- [ ] T020 [US4] Make the formatted canvas fill its host without changing source or empty-state styling in `src/renderer/editor/editor.css`.

**Checkpoint**: No lower-background seam remains for the tested editor themes.

## Phase 7: User Story 5 - Identify View Source (P2)

**Goal**: The View source action uses the requested code-bracket-square glyph and a fixed dark-blue outline treatment.

**Independent Test**: In both application themes, inspect the last toolbar item, confirm its accessible label and Heroicons SVG path, and verify its fixed computed color.

- [ ] T021 [US5] Update expected glyph and cross-theme color assertions in `tests/e2e/view-source-icon.spec.ts`.
- [ ] T022 [US5] Replace the toolbar SVG payload with Heroicons outline code-bracket-square markup in `src/renderer/editor/CrepeHost.tsx`.
- [ ] T023 [US5] Apply the fixed dark-blue outline styling and retain the last-item selector tripwire in `src/renderer/editor/editor.css`.

**Checkpoint**: The requested icon is clear and identifiable without changing its source-view behavior.

## Phase 8: Polish And Delivery

- [ ] T024 Run the manual scenarios and document the external SC-005 usability-study protocol in `specs/008-settings-redesign/quickstart.md`; do not represent automated or single-developer validation as the required 90% participant outcome.
- [ ] T025 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`; resolve failures and mark each completed task `[X]` in `specs/008-settings-redesign/tasks.md`.
- [ ] T026 Archive the completed feature with `git mv specs/008-settings-redesign specs/archive/008-settings-redesign`, set `spec.md` status to `Archived`, and update task paths as needed.
- [ ] T027 Commit the behavioral change, push `phase-029-settings-redesign`, and open the required PR against `main` with the mandated AI usage line.
- [ ] T028 Review the opened PR for correctness, security, and specification compliance with code-review subagents, then post the findings as a PR comment.

## Dependencies And Execution Order

- T001 precedes all implementation tasks.
- T002 and T003 can run in parallel; T004 through T007 complete the foundation before user stories.
- US1 begins after T004 and T005. US2 begins after T004 and T005. The developer-tools removal (T006a) and its e2e scenarios (T017/T018) depend on T006 and T007. US4 and US5 are independent after T001 but run after the settings stories to avoid e2e file conflicts.
- Tasks that share `SettingsDialog.tsx`, `App.tsx`, `editor.css`, `settings.spec.ts`, or `shortcuts.ts` run sequentially.
- T024 through T028 run only after all story checkpoints pass.

## Parallel Opportunities

- T002 and T003 touch distinct test domains and can run together.
- T019 and T021 can prepare distinct e2e specifications in parallel after the baseline.
- T020 and T022 can be implemented independently after their failing tests. T023 follows T020 because both change `src/renderer/editor/editor.css`.

## Implementation Strategy

1. Establish the baseline and settings foundation.
2. Deliver the settings layout and General control surface.
3. Deliver and verify the explorer preference, then make developer tools unconditionally available.
4. Deliver the independent editor-canvas and icon fixes.
5. Run every gate, archive the spec, review, and open the phase PR.
