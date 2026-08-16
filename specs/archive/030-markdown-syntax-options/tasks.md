# Tasks: Markdown Syntax and Formatting Options

**Input**: Design documents from `/specs/030-markdown-syntax-options/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/markdown-syntax.md

**Tests**: Required — spec.md mandates e2e coverage per AGENTS.md, plus unit tests for settings validation and the options→pipeline mapping.

**Organization**: Tasks are grouped by plan phase.

## Format: `[ID] [P?] [Phase] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Phase]**: Phase 1..5
- Exact file paths in descriptions

## Phase 1: Foundational — contract + settings fields + validation + options module

**Purpose**: The shared settings schema, main-process validation, renderer cache, and the pure options→remark-pipeline mapping — everything later phases build on.

**⚠️ CRITICAL**: No user-visible work can begin until the six settings fields and the options module exist.

- [x] T001 [P] [1] Add the six boolean fields to `Settings` in `src/shared/ipc-contract.ts`: `hardBreaks`, `strikethrough`, `tables`, `taskLists`, `math`, `autolink`, with doc comments citing FR-003..FR-008 and FR-013 defaults.
- [x] T002 [P] [1] Extend `DEFAULTS` in `src/main/settingsFile.ts` (hardBreaks `false`, the rest `true` — FR-013); add per-field tolerant validation in `validateSettings` (missing/invalid → default) and `mergeSettingsPatch`.
- [x] T003 [P] [1] Add STRICT pre-merge validation in `validateSettingsPatch` (`src/main/settingsFile.ts`): a PRESENT non-boolean for any of the six throws the typed `IO` error (research R5; never silently coerced).
- [x] T004 [P] [1] Add the six fields to `known` in `migrateLegacySettingsFile` (so legacy migration preserves them).
- [x] T005 [P] [1] Mirror the six defaults in `src/renderer/state/settings.ts` (renderer cache, FR-013).
- [x] T006 [P] [1] Create `src/renderer/editor/markdownSyntaxOptions.ts`: `MarkdownSyntaxOptions` interface, `DEFAULT_MARKDOWN_SYNTAX_OPTIONS`, and the pure `markdownSyntaxRemark(options)` unified plugin that composes only the enabled micromark/mdast extensions (strikethrough/table/task-list/autolink via `micromark-extension-gfm-*` + `mdast-util-gfm-*`, math via `remark-math`, footnote always on; R1). Plus the hard-break soft/hard selection (R2: soft = stock `remarkLineBreak` `isInline:true`; hard = custom transform emitting `isInline:false`).

**Checkpoint**: Six settings fields round-trip through main validation and the cache; the pure mapping composes the right extensions per options combination.

---

## Phase 2: Runtime reconfiguration + settings dialog Markdown area (US1 + US2)

**Purpose**: Toggling a switch re-parses every live editor with the new pipeline; the dialog gains a `Markdown` area with the six pill switches (FR-001..FR-009).

### Tests first ⚠️

- [x] T007 [P] [2] Unit test `tests/renderer/markdownSyntaxOptions.test.ts`: options→extension-composition matrix — every on/off combination includes/excludes the correct extensions; hard-break soft↔hard emission (contract §Verification).
- [x] T008 [P] [2] Extend `tests/main/settings.test.ts`: six-field validation — valid booleans accepted; present non-boolean rejected in `validateSettingsPatch`; missing/invalid on disk → per-field default.

### Implementation

- [x] T009 [2] Create `src/renderer/editor/markdownSyntaxRuntime.ts`: `reconfigureAll(instancePool, options)` — for each live editor, capture `getMarkdown()` BEFORE the serializer swap, rebuild `remarkCtx` + `parserCtx` + `serializerCtx` from the unchanged `schemaCtx` via `editor.action`, then `replaceAll(captured)`; suppress the re-parse's `markdownUpdated` emission; best-effort cursor/scroll restore (R3, R6).
- [x] T010 [2] In `CrepeHost.tsx`, build the conditional remark pipeline at editor create (use the pure `markdownSyntaxRemark`); drop the re-parse emission like the source-view lock already does.
- [x] T011 [2] Add a `Markdown` entry to `SettingsArea`/`SETTINGS_AREAS` in `src/renderer/chrome/SettingsDialog.tsx` (FR-001) and a three-way area dispatch rendering a Markdown panel with the six `settings-switch` pill toggles (FR-002..FR-009), labels per contract.

**Checkpoint**: A switch toggle changes rendering in the open tab immediately; the dialog shows the Markdown area with six switches.

---

## Phase 3: Multi-tab immediate apply + persistence + defaults (US3 + US4)

**Purpose**: All open tabs reflect a toggle; the six values persist and restore with FR-013 defaults on a fresh install.

- [x] T012 [3] Extend `src/renderer/hooks/useSettingsState.ts`: six local states seeded from the cache + six `handle*Change` callbacks that update local state, persist via `updateSettings` → `window.api.updateSettings`, and fan out to `markdownSyntaxRuntime.reconfigureAll` (R5/R6).
- [x] T013 [3] Wire the six values + handlers through `src/renderer/App.tsx` into `SettingsDialog` and the editor panel so every open `EditorPanel` gets the current options.
- [x] T014 [3] Pass `markdownOptions` (or equivalent) into `src/renderer/editor/EditorPanel.tsx` / `CrepeHost.tsx` so a toggle re-parses every live instance (multi-tab sync, FR-010/011; persistence FR-012 + defaults FR-013 handled by the settings store from Phase 1).
- [x] T015 [P] [3] Extend `tests/renderer/useSettingsState.test.tsx`: six markdown handlers update local state + cache + IPC + fan out (contract §Verification).

**Checkpoint**: Toggling in the dialog re-renders all open tabs while dirty state, undo history, cursor, and scroll survive (US3); settings survive restart and fresh installs get FR-013 defaults (US4).

---

## Phase 4: Verification — unit + e2e

- [x] T016 [P] [4] e2e `tests/e2e/markdown-syntax-options.spec.ts` (contract §Verification + quickstart): dialog shows the six toggles; each toggle switches rendering in an open tab; multi-tab sync (US3 S1/S2/S3 — dirty dot, unsaved edits, undo/redo, cursor/scroll survive); hard-break re-flow (US2); persistence across restart + fresh-install defaults (US4, FR-013); round-trip both directions — disabled syntax saves exact bytes, enabling syntax present in raw file does not rewrite it (SC-004); source view unaffected; unclosed `~`/`$` stays literal in both states; rapid toggling settles on the final state.
- [x] T017 [P] [4] Input-rule gating: verify typing a disabled syntax delimiter (e.g. `~~`) does not auto-format it (R4), unit-testable via the runtime gate helper.

**Checkpoint**: Full suite green — `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`.

---

## Phase 5: Polish & cross-cutting

- [x] T018 [P] [5] Run `npm run lint`, `npm run typecheck`, `npm run test` (full suite stays green).
- [x] T019 [P] [5] Run `npm run test:e2e` (full e2e suite, including existing specs).
- [x] T020 [P] [5] Archive spec: `git mv specs/030-markdown-syntax-options specs/archive/030-markdown-syntax-options`, set spec **Status** to `Archived`.
- [x] T021 [P] [5] Update `checklists/implementation.md`; mark all tasks `[x]`; open PR with `AI usage:` line ending the description.

---

## Dependencies & Execution Order

- **Phase 1 (T001..T006)**: No dependencies — BLOCKS all user stories.
- **Phase 2 (T007..T011)**: Depends on Phase 1.
- **Phase 3 (T012..T015)**: Depends on Phase 2 (reconfiguration path) and Phase 1 (persistence).
- **Phase 4 (T016..T017)**: Depends on all user stories.
- **Phase 5 (T018..T021)**: Depends on all phases.

### Within each phase

- Tests MUST be written and FAIL before implementation where feasible (T007/T008 before T009..T011).
- Pure module before runtime before wiring.

