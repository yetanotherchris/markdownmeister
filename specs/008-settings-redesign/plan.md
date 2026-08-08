# Implementation Plan: Settings Redesign

**Branch**: `phase-029-settings-redesign` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-settings-redesign/spec.md`

## Summary

Redesign the existing settings modal into a wider two-area dialog: General provides spellcheck, explorer file-opening behavior, and developer-tools access; Theme provides the existing application and editor-theme controls. The feature extends the established settings store with two validated values, preserves the live-dirty tab safety rule, gates developer-tools shortcuts in the main process, makes the formatted editor canvas fill its viewport, and replaces the source icon with the requested Heroicons glyph and a fixed legible dark blue.

## Technical Context

**Language/Version**: TypeScript 5.8 with strict mode across main, preload, and renderer.

**Primary Dependencies**: Electron 43, React 19, @milkdown/crepe, and the already-installed @heroicons/react package. No new runtime dependency is required.

**Storage**: Existing atomic shared per-user `config.json` at `appData/markdownmeister/config.json`, using the `settings` object and the `MM_CONFIG_DIR` test seam. Add validated `fileOpenBehavior` and `developerToolsEnabled` fields.

**Testing**: Vitest 4 for main-process and renderer state; Playwright against the built Electron app for every user-visible story. Required gates are `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e`.

**Target Platform**: Windows, macOS, and Linux desktop.

**Project Type**: Electron desktop WYSIWYG Markdown editor with React renderer.

**Performance Goals**: Settings updates perform no work on the editor keystroke path. Switching settings areas is local modal state. Explorer open remains a single document-session decision and editor canvas styling is CSS-only.

**Constraints**: The renderer remains sandboxed and uses only the existing named settings IPC operations. Settings values are closed unions or booleans validated in main. Same-tab mode retains the live dirty-document guard. The source view's app-theme canvas is unchanged. The dark-blue source icon must remain distinguishable on both chrome themes.

**Scale/Scope**: One settings modal, two persisted settings fields, existing explorer open paths, one main-process shortcut gate, and targeted editor CSS/icon changes. No new settings persistence mechanism, file-system API, or document session model is introduced.

## Constitution Check

*GATE: Passed before research and re-checked after design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Process Isolation Is Absolute | Settings use existing named `getSettings` and `updateSettings` operations. Developer-tools authorization is evaluated in main; the renderer gains no Electron or Node access. | **PASS** |
| II. Every Path Is Untrusted | The new preferences never cross the IPC boundary as paths. Explorer reads continue through the existing main-process path validation. | **PASS** |
| III. Never Lose The User's Words | Same-tab behavior preserves spec 024's live dirty check, so a dirty active tab is never replaced. No save, close, or document-content code changes. | **PASS** |
| IV. Calm, Predictable Editing | Modal navigation and setting changes are explicit. Canvas sizing is CSS-only. The existing app-theme immediate and editor-theme Save-gated behaviors remain intact. | **PASS** |
| V. Test What Can Corrupt Or Escape | Unit tests cover new settings validation and shortcut gating; Playwright covers each settings, tab behavior, canvas, and icon acceptance path. | **PASS** |

## Phase 0 Research Decisions

**Settings persistence**: Add `fileOpenBehavior: 'same-tab' | 'new-tab'`, defaulting to `'same-tab'`, and `developerToolsEnabled: boolean`, defaulting to `false`, to `Settings`, `DEFAULTS`, field-by-field loading, patch merging, renderer defaults, the IPC fallback, and legacy-known-key migration. Both values reuse atomic config writes and existing named settings operations. `settings:update` rejects a present new field with an invalid value as a typed `IO` result before merging; it does not silently coerce malformed IPC input.

**Dialog interaction**: The modal owns a local active area that initializes to General on each mount. General settings persist immediately; the existing staged editor-theme Save behavior remains unchanged. Native checkbox inputs styled as accessible switches provide the Tailwind-like pill control, with all inputs, selects, navigation buttons, and footer buttons included in the focus trap.

**Explorer-only file preference**: Split the session operation into an explorer-specific entry point and retain the current generic open behavior for File-menu and recent-item actions. Explorer single-click, activation, context-menu Open, and middle-click call the explorer entry point. Existing-tab activation still wins; middle-click stays explicit-new; same-tab mode only replaces a live-clean tab.

**Developer-tools access**: Remove the hamburger action and its renderer-to-main toggle IPC operation. The main `before-input-event` handler recognizes the existing shortcuts, prevents their default behavior, and toggles only when cached settings permit it. Disabling the setting immediately closes currently open developer tools.

**Editor canvas**: Make the formatted `.milkdown` surface at least the full height of its definite-height `.editor-host`. This extends each editor theme's existing `--crepe-color-background` below short content without changing the empty state or source view.

**View-source icon**: Use the installed Heroicons outline code-bracket-square SVG path in Crepe's string-based toolbar API. Set `color: #2563eb`, `fill: none`, and `stroke: currentColor`; `#2563eb` is a dark blue with sufficient contrast against the current light and dark toolbar surfaces.

## Project Structure

### Documentation (this feature)

```text
specs/008-settings-redesign/
├── spec.md                     # Requirements and recorded clarifications
├── plan.md                     # This implementation plan
├── research.md                 # Decisions and rejected alternatives
├── data-model.md               # Persisted settings and behavioral state
├── quickstart.md               # Manual validation guide
├── contracts/
│   └── settings-ui.md          # Renderer/main UI and behavior contract
└── tasks.md                    # Ordered implementation and verification tasks
```

### Source Code (repository root)

```text
src/shared/ipc-contract.ts                  # MODIFY: two Settings fields
src/main/settingsFile.ts                    # MODIFY: defaults, validation, merge, migration keys
src/main/ipc/handlers/settings.ts           # MODIFY: fallback and immediate developer-tools disable
src/main/ipc/handlers/app.ts                # MODIFY: remove obsolete devtools IPC handler
src/main/shortcuts.ts                       # MODIFY: gate developer-tools shortcuts in main
src/preload/index.ts                        # MODIFY: remove obsolete toggleDevTools bridge
src/renderer/state/settings.ts              # MODIFY: synchronous defaults
src/renderer/hooks/useSettingsState.ts      # MODIFY: preference state and persist handlers
src/renderer/hooks/useDocumentSession.ts    # MODIFY: explorer-specific open decision
src/renderer/hooks/useWorkspaceTree.ts      # MODIFY: explorer click/activation use the preference
src/renderer/hooks/useSourceViewToggle.ts   # MODIFY: explorer context Open uses the preference
src/renderer/chrome/SettingsDialog.tsx      # MODIFY: General/Theme navigation and accessible toggles
src/renderer/chrome/settings.css            # MODIFY: wider responsive sidebar layout and toggle styles
src/renderer/chrome/menuModel.ts            # MODIFY: remove Toggle Developer Tools menu item
src/renderer/chrome/HamburgerMenu.tsx       # MODIFY: remove obsolete action dispatch
src/renderer/App.tsx                        # MODIFY: wire explorer-open preference and settings props
src/renderer/editor/editor.css              # MODIFY: full-height canvas and fixed source icon styling
src/renderer/editor/CrepeHost.tsx           # MODIFY: Heroicons code-bracket-square payload
tests/main/settings.test.ts                 # MODIFY: new persisted fields and validation
tests/main/ipc.test.ts                      # MODIFY: malformed settings-update patch rejection
tests/main/shortcuts.test.ts                # MODIFY: developer-tools setting gate
tests/renderer/useSettingsState.test.tsx    # MODIFY: new immediate-persist handlers
tests/renderer/menuModel.test.ts            # MODIFY: removed hamburger action
tests/e2e/settings.spec.ts                  # MODIFY: settings areas, controls, and persistence
tests/e2e/open-in-current-tab.spec.ts       # MODIFY: explorer preference behavior and dedupe
tests/e2e/source.spec.ts                    # MODIFY: explorer context Open preference path
tests/e2e/editor-canvas-background.spec.ts  # NEW: short-document canvas coverage
tests/e2e/view-source-icon.spec.ts          # MODIFY: requested glyph and fixed dark-blue treatment
```

**Structure Decision**: Settings remain one validated shared model, persistence remains in main, the renderer owns settings presentation and local modal navigation, and document-session code owns tab replacement decisions. This preserves process isolation and puts the data-loss guard at the only decision point.

## Phase Status

- Phase 1: Setup - baseline and project-ignore verification
- Phase 2: Foundational - persisted settings schema and main developer-tools gate
- Phase 3: US1 - General/Theme sidebar dialog and moved controls
- Phase 4: US2 - explorer file-opening preference
- Phase 5: US3 - developer-tools setting behavior
- Phase 6: US4 - full-height editor canvas
- Phase 7: US5 - code-bracket-square source icon
- Phase 8: Polish - complete gates, archive, review, and PR

## Complexity Tracking

None. The feature uses existing IPC and settings persistence, retains the main-process security boundary, and preserves the live dirty-tab replacement invariant.
